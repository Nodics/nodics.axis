/** Actual Profile adapter and discovered-owner transport; no live credentials or requests. */
import { afterEach, expect, it, vi } from 'vitest';
import {
  loadEnterpriseManagementWorkspace,
  parseEnterpriseManagementWorkspace,
} from '../../src/operations/enterprise/api/enterpriseManagementWorkspaceClient';
import {
  configuration,
  task,
  workspace,
} from './enterpriseManagementWorkspaceFixtures';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('reads the discovered Profile owner once with the current enterprise and no selectors', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(JSON.stringify({ code: 'SUC_PRFL_00000', data: task })),
    );
  vi.stubGlobal('fetch', fetcher);
  expect((await loadEnterpriseManagementWorkspace(configuration)).title).toBe(
    workspace.title,
  );
  const [url, init] = fetcher.mock.calls[0]!;
  expect(typeof url === 'string' ? url : url instanceof URL ? url.href : url.url).toBe(
    'https://profile.example.test/nodics/profile/v0/enterprises/workspace',
  );
  expect(init).toMatchObject({
    method: 'GET',
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    headers: {
      Authorization: 'Bearer fixture-token',
      'x-enterprise-code': configuration.enterpriseCode,
    },
  });
  expect(init?.body).toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([
  { ...task, enterpriseCode: 'foreign' },
  { ...task, contractVersion: 2 },
  { ...task, kind: 'OTHER_TASK' },
  {
    ...task,
    workspace: {
      contractVersion: 1,
      renderer: 'axis.workspace.native',
      workspaceCode: 'profile.enterpriseManagement',
      viewCode: 'administration',
      title: 'Recursive task',
    },
  },
])('rejects foreign, unsupported or recursive task definitions: %j', (value) => {
  expect(() =>
    parseEnterpriseManagementWorkspace(value, configuration.enterpriseCode),
  ).toThrow();
});

it('does not fall back to another owner when the selected Profile connection is unavailable', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(
    loadEnterpriseManagementWorkspace({
      ...configuration,
      bootstrap: { ...configuration.bootstrap, moduleConnections: {} },
    }),
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});

it('honors the admitted long timeout and aborts one read without retry', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn<typeof fetch>().mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  const pending = loadEnterpriseManagementWorkspace({
    ...configuration,
    timeoutMs: 360000,
  });
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(120001);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(240000);
  await rejected;
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
