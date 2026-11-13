import { describe, expect, it, vi } from 'vitest';
import { inspectPublication } from '../../../src/operations/contentExperience/api/publicationInspectionClient';
import type { AxisModuleConnection } from '../../../src/bootstrap/publicBootstrap';
const connection: AxisModuleConnection = {
  moduleName: 'publish',
  instanceId: 'staged-publish',
  endpoint: 'http://localhost:4312/nodics/publish',
  server: 'wcmsStagedServer',
  environment: 'local',
  state: 'UP',
};
const configuration = {
  accessToken: 'test-token',
  enterpriseCode: 'enterprise-a',
  timeoutMs: 1000,
};
const code = 'cms-site-page-route-0';
const record = {
  code,
  state: 'ONLINE',
  revision: 6,
  sourceVersion: '0',
  targetVersion: 'target-0',
  workflowRef: 'workflow-a',
  dependencies: [{ schema: 'cmsComponent', code: 'component-a', version: '0' }],
  auditTrail: [
    {
      fromState: 'APPROVED',
      toState: 'ONLINE',
      revision: 6,
      actor: 'reviewer',
      reason: 'Reviewed publication',
    },
  ],
};
describe('native publication inspection', () => {
  it('reads exact version-zero identities from the selected owner without mutation or invented history', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ code: 'SUC_PUB_00000', result: record })),
      );
    expect(
      await inspectPublication(connection, configuration, code, fetcher),
    ).toMatchObject(record);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({
      'x-enterprise-code': 'enterprise-a',
    });
    expect(fetcher).toHaveBeenCalledWith(
      new URL(`http://localhost:4312/nodics/publish/v0/publications/${code}`),
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
      }),
    );
  });
  it.each([
    { code: 'ERR_PUB_00000', result: record },
    { code: 'SUC_PUB_00000', responseCode: '400', result: record },
    { code: 'SUC_PUB_00000', success: false, result: record },
    { code: 'SUC_PUB_00000', errors: [{ code: 'denied' }], result: record },
    { code: 'SUC_PUB_00000', result: { ...record, code: 'another-request' } },
    { code: 'SUC_PUB_00000', result: { ...record, revision: -1 } },
    {
      code: 'SUC_PUB_00000',
      result: { ...record, dependencies: [{ schema: 'cmsComponent' }] },
    },
  ])(
    'rejects uncertain or mismatched owner evidence without retry: %j',
    async (body) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify(body)));
      await expect(
        inspectPublication(connection, configuration, code, fetcher),
      ).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );
  it.each([400, 401, 403, 503])(
    'keeps HTTP%s distinct from an empty publication collection',
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{}', { status }));
      await expect(
        inspectPublication(connection, configuration, code, fetcher),
      ).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );
  it('refuses an arbitrary source module or path-shaped publication before fetching', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      inspectPublication(
        { ...connection, moduleName: 'cms' },
        configuration,
        code,
        fetcher,
      ),
    ).rejects.toThrow();
    await expect(
      inspectPublication(connection, configuration, '../another', fetcher),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
