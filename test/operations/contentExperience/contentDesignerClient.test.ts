/** Regressions for CMS-owned Designer authority envelopes; no generic schema fallback or command replay. */
import { describe, expect, it, vi } from 'vitest';

import type { AxisModuleConnection } from '../../../src/bootstrap/publicBootstrap';
import {
  loadContentDesignerAuthoringModel,
  retireContentDesignerRecord,
  saveContentDesignerDraft,
  type ContentDesignerDraft,
} from '../../../src/operations/contentExperience/api/contentDesignerClient';
import { retirementPresentation } from './contentDesignerRetirementFixtures';

const connection: AxisModuleConnection = {
  moduleName: 'cms',
  instanceId: 'content-authoring',
  endpoint: 'http://localhost:4312/nodics/cms',
  environment: 'test',
  state: 'UP',
  runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
};
const configuration = {
  accessToken: 'employee-token',
  enterpriseCode: 'enterprise-a',
  timeoutMs: 1_000,
};
const draft: ContentDesignerDraft = {
  catalogCode: 'catalog-a',
  siteCode: 'site-a',
  templateCode: 'template-a',
  page: { code: 'page-a', name: 'Page', typeCode: 'page-type' },
  sections: [],
};

describe('CMS Designer owner responses', () => {
  it('parses owner retirement copy without treating action descriptors as permission grants', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: { rules: {}, operations: [], retirement: retirementPresentation },
        }),
      ),
    );
    const model = await loadContentDesignerAuthoringModel(
      connection,
      configuration,
      fetcher,
    );
    expect(model.retirement).toEqual(retirementPresentation);
    expect(model.operations).toEqual([]);
  });

  it.each([
    { code: 'wrong', active: false, versionId: 1 },
    { code: 'record-a', active: true, versionId: 1 },
    { code: 'record-a', active: false },
    { code: 'record-a', active: false, versionId: '1' },
    {
      code: 'record-a',
      active: false,
      versionId: 1,
      authoringScope: { enterpriseCode: 'foreign', catalogCode: 'catalog-a' },
    },
  ])('rejects uncertain retirement evidence without replay: %j', async (record) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            authoringScope: {
              enterpriseCode: 'enterprise-a',
              catalogCode: 'catalog-a',
            },
            ...record,
          },
        }),
      ),
    );
    await expect(
      retireContentDesignerRecord(
        connection,
        configuration,
        'deleteComponent',
        {
          code: 'record-a',
          siteCode: 'site-a',
          catalogCode: 'catalog-a',
        },
        fetcher,
      ),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('accepts catalog-owned nested placements but rejects a foreign Site placement', async () => {
    const intent = { code: 'record-a', siteCode: 'site-a', catalogCode: 'catalog-a' };
    const record = { code: 'record-a', active: false, versionId: 2 };
    const ownerScope = { enterpriseCode: 'enterprise-a', catalogCode: 'catalog-a' };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: { ...record, authoringScope: ownerScope } }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              ...record,
              authoringScope: { ...ownerScope, siteCode: 'foreign-site' },
            },
          }),
        ),
      );
    await expect(
      retireContentDesignerRecord(
        connection,
        configuration,
        'deleteSection',
        intent,
        fetcher,
      ),
    ).resolves.toEqual({ code: 'record-a', versionId: 2 });
    await expect(
      retireContentDesignerRecord(
        connection,
        configuration,
        'deleteSection',
        intent,
        fetcher,
      ),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([
    { code: 'ERR_AUTH_00003' },
    { code: 'UNKNOWN' },
    { success: false },
    { success: 'true' },
    { acknowledged: false },
    { error: 'denied' },
    { errors: [{ code: 'ERR_AUTH_00003' }] },
    { errors: {} },
  ])(
    'rejects contradictory HTTP-200 authority and write envelopes: %j',
    async (flags) => {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              ...flags,
              result: {
                rules: {},
                operations: ['saveDraftComposition'],
                status: 'DRAFT_SAVED',
                saved: {},
              },
            }),
          ),
        ),
      );
      await expect(
        loadContentDesignerAuthoringModel(connection, configuration, fetcher),
      ).rejects.toThrow('unsuccessful response envelope');
      await expect(
        saveContentDesignerDraft(connection, configuration, draft, fetcher),
      ).rejects.toThrow('unsuccessful response envelope');
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(fetcher.mock.calls.map(([, init]) => init?.method)).toEqual([
        'GET',
        'PUT',
      ]);
    },
  );

  it.each([
    { operations: ['saveDraftComposition', 1] },
    { operations: 'saveDraftComposition' },
    { operations: [null] },
  ])(
    'rejects malformed operations without coercing authority: $operations',
    async ({ operations }) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify({ result: { rules: {}, operations } })),
        );
      await expect(
        loadContentDesignerAuthoringModel(connection, configuration, fetcher),
      ).rejects.toThrow('permitted operations are invalid');
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it('accepts the owner result envelope and treats absent operations as no authority', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ result: { rules: {} }, success: true, errors: [] }),
        ),
      );
    const model = await loadContentDesignerAuthoringModel(
      connection,
      configuration,
      fetcher,
    );
    expect(model.operations).toEqual([]);
  });

  it('rejects the obsolete data envelope without discovery fallback', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: { rules: {}, operations: ['saveDraftComposition'] } }),
        ),
      );
    await expect(
      loadContentDesignerAuthoringModel(connection, configuration, fetcher),
    ).rejects.toThrow('does not contain result data');
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
