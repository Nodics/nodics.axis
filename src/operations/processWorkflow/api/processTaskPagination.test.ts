import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadProcessTaskPage } from './processDefinitionClient';
import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';

const connection = {
  endpoint: 'http://localhost:4330/nodics/process',
} as AxisModuleConnection;
const configuration = {
  accessToken: 'test-token',
  enterpriseCode: 'enterprise-one',
  timeoutMs: 1000,
};
afterEach(() => vi.unstubAllGlobals());

describe('Process owner task pagination', () => {
  it('preserves filters and credentials and consumes owner bounds without supplying frontend limits', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ code: 'task-26', status: 'OPEN' }],
          pagination: {
            page: 2,
            pageSize: 25,
            total: 26,
            hasPrevious: true,
            hasNext: false,
          },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    const page = await loadProcessTaskPage(connection, configuration, {
      page: 2,
      queue: 'actionable',
      status: 'OPEN',
      assignee: 'a&b',
      instanceCode: 'instance-one',
    });
    expect(page.tasks[0]?.code).toBe('task-26');
    expect(page.pagination.hasNext).toBe(false);
    const [url, options] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('limit')).toBeNull();
    expect(url.searchParams.get('queue')).toBe('actionable');
    expect(url.searchParams.get('assignee')).toBe('a&b');
    expect(url.searchParams.get('instanceCode')).toBe('instance-one');
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer test-token',
      'x-enterprise-code': 'enterprise-one',
    });
  });

  it.each([
    undefined,
    { page: 1, pageSize: 25, total: 1, hasPrevious: false, hasNext: false },
    { page: 2, pageSize: 25, total: 26, hasPrevious: false, hasNext: false },
    { page: 2, pageSize: 25, total: 26, hasPrevious: true, hasNext: true },
    { page: 2, pageSize: 0, total: 26, hasPrevious: true, hasNext: false },
  ])('rejects missing or contradictory page metadata %j', async (pagination) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [], pagination }))),
    );
    await expect(
      loadProcessTaskPage(connection, configuration, { page: 2 }),
    ).rejects.toThrow();
  });

  it('does not retry an unauthorized page or reinterpret it as an empty queue', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: 'Denied' }), { status: 403 }),
      );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      loadProcessTaskPage(connection, configuration, { page: 2 }),
    ).rejects.toThrow('Denied');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
