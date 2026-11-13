/** Regressions for CMS-owned Designer authority envelopes; no generic schema fallback or command replay. */
import { describe, expect, it, vi } from 'vitest';

import type { AxisModuleConnection } from '../../../src/bootstrap/publicBootstrap';
import {
  loadContentDesignerAuthoringModel,
  loadContentDesignerPage,
  retireContentDesignerRecord,
  saveContentDesignerDraft,
  type ContentDesignerDraft,
} from '../../../src/operations/contentExperience/api/contentDesignerClient';
import { retirementPresentation } from './contentDesignerRetirementFixtures';
import { designerFormPresentation } from './contentDesignerFormFixtures';

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

function requestUrlForSavedTest(input: RequestInfo | URL): string {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
}
const draft: ContentDesignerDraft = {
  catalogCode: 'catalog-a',
  siteCode: 'site-a',
  templateCode: 'template-a',
  page: { code: 'page-a', name: 'Page', typeCode: 'page-type' },
  sections: [],
};

describe('CMS Designer owner responses', () => {
  it('accepts only bounded inert owner form copy without changing operations or retrying malformed models', async () => {
    for (const presentation of [
      designerFormPresentation,
      { ...designerFormPresentation, continueLabel: '' },
      { ...designerFormPresentation, pageNameHelp: 'x'.repeat(1025) },
      { ...designerFormPresentation, newPageTitle: 'Name\u0000hidden' },
    ]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            result: {
              rules: {},
              operations: ['getDraftComposition'],
              presentation,
            },
          }),
        ),
      );
      const request = loadContentDesignerAuthoringModel(
        connection,
        configuration,
        fetcher,
      );
      if (presentation === designerFormPresentation) {
        const value = await request;
        expect(value.presentation).toEqual(designerFormPresentation);
        expect(value.operations).toEqual(['getDraftComposition']);
      } else await expect(request).rejects.toThrow('form presentation');
      expect(fetcher).toHaveBeenCalledOnce();
      expect(fetcher.mock.calls[0]?.[1]?.method).not.toBe('POST');
    }
  });
  it('reopens only the exact scoped saved identity and preserves inert extension properties', async () => {
    const sourceVersion = 'a'.repeat(64);
    const stored = {
      ...draft,
      sourceVersion,
      sections: [
        {
          code: 'placement',
          slot: 'main',
          index: 0,
          components: [
            {
              code: 'block',
              typeCode: 'block-type',
              properties: { extension: { preserve: true } },
              localizations: [
                {
                  code: 'legacy-locale',
                  locale: 'en',
                  properties: { title: 'Saved' },
                  seo: { preserve: true },
                },
              ],
              media: [{ code: 'legacy-media', mediaCode: 'image' }],
            },
          ],
        },
      ],
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: { draft: stored, sourceVersion, editable: true, issues: [] },
        }),
      ),
    );
    const result = await loadContentDesignerPage(
      connection,
      configuration,
      { catalogCode: 'catalog-a', siteCode: 'site-a', pageCode: 'page-a' },
      fetcher,
    );
    expect(result.draft).toEqual(stored);
    expect(requestUrlForSavedTest(fetcher.mock.calls[0]![0])).toContain(
      '/designer/composition/draft?catalogCode=catalog-a&siteCode=site-a&pageCode=page-a',
    );
    expect(new Headers(fetcher.mock.calls[0]![1]?.headers).get('Authorization')).toBe(
      'Bearer employee-token',
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('rejects foreign or contradictory saved projections and never falls back or replays denied reads', async () => {
    const sourceVersion = 'a'.repeat(64);
    for (const changed of [
      { ...draft, sourceVersion, siteCode: 'foreign' },
      { ...draft, sourceVersion: 'b'.repeat(64) },
      {
        ...draft,
        sourceVersion,
        sections: [{ code: 'placement', slot: 'main', index: 0, components: [] }],
      },
    ]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            result: { draft: changed, sourceVersion, editable: true, issues: [] },
          }),
        ),
      );
      await expect(
        loadContentDesignerPage(
          connection,
          configuration,
          { catalogCode: 'catalog-a', siteCode: 'site-a', pageCode: 'page-a' },
          fetcher,
        ),
      ).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledOnce();
    }
    const denied = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('Denied', { status: 403 }));
    await expect(
      loadContentDesignerPage(
        connection,
        configuration,
        { catalogCode: 'catalog-a', siteCode: 'site-a', pageCode: 'page-a' },
        denied,
      ),
    ).rejects.toThrow();
    expect(denied).toHaveBeenCalledOnce();
  });
  it('accepts bounded inert field descriptors without granting operations', async () => {
    const fields = [
      {
        property: 'title',
        label: 'Heading',
        control: 'text',
        required: true,
        maxLength: 240,
      },
      {
        property: 'items',
        label: 'Cards',
        control: 'items',
        maximumItems: 12,
        itemFields: [{ property: 'text', label: 'Card text', control: 'multiline' }],
      },
    ];
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            rules: {},
            operations: [],
            defaults: {
              componentKinds: [
                {
                  label: 'Cards',
                  typeCode: 'cardsType',
                  renderer: 'nexus.cardGrid',
                  fields,
                },
              ],
            },
          },
        }),
      ),
    );
    const model = await loadContentDesignerAuthoringModel(
      connection,
      configuration,
      fetcher,
    );
    expect(model.defaults.componentKinds[0]?.fields).toEqual(fields);
    expect(model.operations).toEqual([]);
    expect(Object.isFrozen(model.defaults.componentKinds[0]?.fields)).toBe(true);
  });
  it.each([
    [{ property: 'title.path', label: 'Heading', control: 'text' }],
    [{ property: 'constructor', label: 'Heading', control: 'text' }],
    [{ property: 'title', label: 'Heading', control: 'script' }],
    [{ property: 'title', label: '', control: 'text' }],
    [{ property: 'title', label: 'Heading', control: 'text', maxLength: 100001 }],
    [
      {
        property: 'items',
        label: 'Cards',
        control: 'items',
        maximumItems: 33,
        itemFields: [],
      },
    ],
    [
      {
        property: 'items',
        label: 'Cards',
        control: 'items',
        itemFields: [
          { property: 'more', label: 'More', control: 'items', itemFields: [] },
        ],
      },
    ],
    [
      { property: 'title', label: 'Heading', control: 'text' },
      { property: 'title', label: 'Duplicate', control: 'text' },
    ],
  ])('holds authoring for incompatible field descriptors: %j', async (...fields) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            rules: {},
            defaults: {
              componentKinds: [
                {
                  label: 'Text',
                  typeCode: 'textType',
                  renderer: 'nexus.contentSection',
                  fields,
                },
              ],
            },
          },
        }),
      ),
    );
    await expect(
      loadContentDesignerAuthoringModel(connection, configuration, fetcher),
    ).rejects.toThrow('CMS content fields are incompatible');
    expect(fetcher).toHaveBeenCalledOnce();
  });

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
