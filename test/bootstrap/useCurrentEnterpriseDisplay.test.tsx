import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useCurrentEnterpriseDisplay } from '../../src/bootstrap/useCurrentEnterpriseDisplay';
import { loadCurrentEnterpriseDisplay } from '../../src/bootstrap/currentEnterpriseDisplay';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';
vi.mock('../../src/bootstrap/currentEnterpriseDisplay', () => ({
  loadCurrentEnterpriseDisplay: vi.fn(),
}));
vi.mock('../../src/bootstrap/publicBootstrap', () => ({
  selectModuleConnection: (bootstrap: AxisAuthenticatedBootstrap) =>
    bootstrap.moduleConnections.profile?.[0],
}));
afterEach(() => vi.clearAllMocks());
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    client,
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}
const props = {
  bootstrap: {
    tenantCode: 'tenant',
    moduleConnections: {
      profile: [
        {
          endpoint: 'https://profile.example.test/nodics/profile',
          instanceId: 'profile-one',
        },
      ],
    },
  } as unknown as AxisAuthenticatedBootstrap,
  runtime: { enterpriseCode: 'RETAIL', requestTimeoutMs: 1000 } as AxisRuntimeConfig,
  accessToken: 'private-original-token',
  generation: 1,
  active: true,
};
it('observes once for equivalent bootstrap values and puts no token in query keys', async () => {
  vi.mocked(loadCurrentEnterpriseDisplay).mockResolvedValue({
    code: 'RETAIL',
    displayName: 'GreenPerks Retail',
  });
  const { client, wrapper } = setup();
  const view = renderHook(useCurrentEnterpriseDisplay, {
    wrapper,
    initialProps: props,
  });
  await waitFor(() =>
    expect(view.result.current?.displayName).toBe('GreenPerks Retail'),
  );
  view.rerender({ ...props, bootstrap: { ...props.bootstrap } });
  expect(loadCurrentEnterpriseDisplay).toHaveBeenCalledTimes(1);
  expect(
    JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((q) => q.queryKey),
    ),
  ).not.toContain(props.accessToken);
  view.unmount();
});
it('retires old actor/Enterprise data and ignores a late response after cancellation', async () => {
  let oldResolve: ((value: { code: string; displayName: string }) => void) | undefined;
  vi.mocked(loadCurrentEnterpriseDisplay)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          oldResolve = resolve;
        }),
    )
    .mockResolvedValueOnce({ code: 'OTHER', displayName: 'Other Enterprise' });
  const { wrapper } = setup();
  const view = renderHook(useCurrentEnterpriseDisplay, {
    wrapper,
    initialProps: props,
  });
  await waitFor(() => expect(loadCurrentEnterpriseDisplay).toHaveBeenCalledTimes(1));
  const oldSignal = vi.mocked(loadCurrentEnterpriseDisplay).mock.calls[0]?.[1];
  view.rerender({
    ...props,
    runtime: { ...props.runtime, enterpriseCode: 'OTHER' },
    accessToken: 'new-private-token',
    generation: 2,
  });
  expect(view.result.current).toBeUndefined();
  expect(oldSignal?.aborted).toBe(true);
  await waitFor(() =>
    expect(view.result.current?.displayName).toBe('Other Enterprise'),
  );
  oldResolve?.({ code: 'RETAIL', displayName: 'Late old name' });
  await waitFor(() =>
    expect(view.result.current?.displayName).toBe('Other Enterprise'),
  );
  view.unmount();
});
it('withholds locked data and clears failed or replaced owner evidence', async () => {
  vi.mocked(loadCurrentEnterpriseDisplay)
    .mockResolvedValueOnce({ code: 'RETAIL', displayName: 'GreenPerks Retail' })
    .mockRejectedValueOnce(new Error('owner unavailable'));
  const { wrapper } = setup();
  const view = renderHook(useCurrentEnterpriseDisplay, {
    wrapper,
    initialProps: props,
  });
  await waitFor(() => expect(view.result.current).toBeDefined());
  view.rerender({ ...props, active: false });
  expect(view.result.current).toBeUndefined();
  view.rerender({
    ...props,
    bootstrap: {
      ...props.bootstrap,
      moduleConnections: {
        profile: [
          {
            ...props.bootstrap.moduleConnections.profile![0]!,
            instanceId: 'replacement',
          },
        ],
      },
    },
  });
  expect(view.result.current).toBeUndefined();
  await waitFor(() => expect(loadCurrentEnterpriseDisplay).toHaveBeenCalledTimes(2));
  expect(view.result.current).toBeUndefined();
  view.unmount();
});
