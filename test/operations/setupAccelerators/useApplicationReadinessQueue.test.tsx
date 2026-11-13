import { StrictMode } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useApplicationReadinessQueue } from '../../../src/operations/setupAccelerators/useApplicationReadinessQueue';

const initial = {
  token: 'synthetic-private-token',
  tenant: 'tenant-a',
  endpoint: 'http://localhost:4300/nodics/backoffice',
  concurrency: 1,
};
function mount() {
  return renderHook(
    (props: typeof initial) =>
      useApplicationReadinessQueue({
        accessToken: props.token,
        tenantCode: props.tenant,
        enterpriseCode: 'enterprise-a',
        projectCode: 'project-a',
        connection: {
          moduleName: 'backoffice',
          instanceId: 'owner-a',
          endpoint: props.endpoint,
          state: 'UP',
          environment: 'test',
        },
        policy: {
          contractVersion: 1,
          concurrency: props.concurrency,
          priorityBurst: 1,
        },
      }),
    { initialProps: initial, wrapper: StrictMode },
  );
}

describe('private readiness queue lifetime', () => {
  it('settles initial queries during Strict Mode mount rehearsal without a manual refresh', async () => {
    const read = vi.fn(() => Promise.resolve('Owner ready'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Probe() {
      const { queue, scope } = useApplicationReadinessQueue({
        accessToken: initial.token,
        tenantCode: initial.tenant,
        enterpriseCode: 'a',
        projectCode: 'a',
        connection: {
          moduleName: 'backoffice',
          instanceId: 'a',
          endpoint: initial.endpoint,
          state: 'UP',
          environment: 'test',
        },
        policy: { contractVersion: 1, concurrency: 1, priorityBurst: 1 },
      });
      const query = useQuery({
        queryKey: ['initial-status', scope],
        queryFn: ({ signal }) => queue.run('a', read, signal),
      });
      return (
        <div role="status">
          {query.isError ? query.error.message : (query.data ?? 'Loading')}
        </div>
      );
    }
    render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>
      </StrictMode>,
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Owner ready'),
    );
    expect(read).toHaveBeenCalledTimes(1);
    client.clear();
  });
  it('retains work through equivalent DTO replacement and stores no token in query scope', async () => {
    const hook = mount();
    const queue = hook.result.current.queue,
      scope = hook.result.current.scope;
    hook.rerender({ ...initial });
    expect(hook.result.current.queue).toBe(queue);
    expect(hook.result.current.scope).toBe(scope);
    expect(scope).not.toContain(initial.token);
    expect(await queue.run('profile', () => Promise.resolve('current'))).toBe(
      'current',
    );
  });

  it.each([
    { token: 'another-private-token' },
    { tenant: 'tenant-b' },
    { endpoint: 'http://localhost:4301/nodics/backoffice' },
    { concurrency: 2 },
  ])('retires old queued work and responses when scope changes: %j', async (change) => {
    const hook = mount();
    const queue = hook.result.current.queue;
    let resolve: (value: string) => void = () => {
      throw new Error('No owner read');
    };
    const deferred = new Promise<string>((done) => {
      resolve = done;
    });
    const first = queue.run('running', () => deferred).catch((error: unknown) => error);
    const queuedRead = vi.fn(() => Promise.resolve('obsolete'));
    const second = queue.run('queued', queuedRead).catch((error: unknown) => error);
    await act(async () => {
      await Promise.resolve();
    });
    hook.rerender({ ...initial, ...change });
    expect(hook.result.current.queue).not.toBe(queue);
    expect(await second).toMatchObject({ name: 'AbortError' });
    resolve('old-private-result');
    expect(await first).toMatchObject({ name: 'AbortError' });
    expect(queuedRead).not.toHaveBeenCalled();
    expect(
      await hook.result.current.queue.run('fresh', () => Promise.resolve('current')),
    ).toBe('current');
  });
});
