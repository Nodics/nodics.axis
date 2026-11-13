import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AxisModuleConnection } from '../../../src/bootstrap/publicBootstrap';
import { loadCmsPublicationReview } from '../../../src/operations/processWorkflow/api/cmsPublicationReviewClient';

const connection: AxisModuleConnection = {
  moduleName: 'workflow',
  instanceId: 'process',
  environment: 'test',
  server: 'process',
  endpoint: 'https://process.example.test/nodics/process',
  state: 'UP',
};
const config = {
  accessToken: 'employee-token',
  enterpriseCode: 'enterprise',
  timeoutMs: 1000,
};
const identity = {
  instanceCode: 'instance',
  taskCode: 'task',
  publicationCode: 'release',
  sourceVersion: '0',
  siteCode: 'site',
};
const result = {
  contractVersion: 1,
  ...identity,
  revision: 3,
  catalogCode: 'catalog',
  truncated: false,
  prerequisites: {
    validated: true,
    dependencyCount: 0,
    dependencies: [],
    mediaCount: 0,
    media: [],
  },
  routes: [
    {
      target: {
        site: 'site',
        path: '/service',
        locale: 'en',
        channel: 'web',
        accessMode: 'PUBLIC',
      },
      page: { code: 'service', name: 'Service information' },
      components: [],
      changes: { status: 'NEW', navigationChanged: false, components: [] },
    },
  ],
};
const response = (data: unknown) =>
  new Response(JSON.stringify({ code: 'SUC_PROCESS_00000', data }));
const signal = () => new AbortController().signal;
afterEach(() => vi.unstubAllGlobals());

describe('CMS publication evidence in Process', () => {
  it('uses the current Process connection and original employee for one private read', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(result));
    vi.stubGlobal('fetch', fetcher);
    await expect(
      loadCmsPublicationReview(connection, config, identity, signal()),
    ).resolves.toEqual(result);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0]!;
    const address =
      url instanceof URL ? url.href : typeof url === 'string' ? url : url.url;
    expect(address).toBe(
      'https://process.example.test/nodics/process/v0/instances/instance/tasks/task/cms-review',
    );
    expect(options).toMatchObject({
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      headers: {
        Authorization: 'Bearer employee-token',
        'x-enterprise-code': 'enterprise',
      },
    });
    expect(options?.body).toBeUndefined();
  });

  it('rejects the wrong task, malformed evidence and a foreign connection', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ ...result, taskCode: 'another' }))
      .mockResolvedValueOnce(response({ ...result, prerequisites: {} }));
    vi.stubGlobal('fetch', fetcher);
    await expect(
      loadCmsPublicationReview(connection, config, identity, signal()),
    ).rejects.toThrow();
    await expect(
      loadCmsPublicationReview(connection, config, identity, signal()),
    ).rejects.toThrow();
    await expect(
      loadCmsPublicationReview(
        { ...connection, moduleName: 'cms' },
        config,
        identity,
        signal(),
      ),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
