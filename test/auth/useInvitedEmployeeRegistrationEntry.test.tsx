import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';

import { useInvitedEmployeeRegistrationEntry } from '../../src/auth/useInvitedEmployeeRegistrationEntry';
import { runtime, profileBaseUrl, workspace } from '../enterprise/registrationFixtures';

const options = {
  runtime,
  profileBaseUrl,
  available: true,
  enabled: true,
  scope: 'login-a',
};
function setup(
  initial: Parameters<typeof useInvitedEmployeeRegistrationEntry>[0] = options,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    ...renderHook((props) => useInvitedEmployeeRegistrationEntry(props), {
      initialProps: initial,
      wrapper,
    }),
  };
}
function reply(title = workspace.presentation.title) {
  return new Response(
    JSON.stringify({
      data: { ...workspace, presentation: { ...workspace.presentation, title } },
    }),
  );
}
afterEach(() => vi.restoreAllMocks());
it.each([{ available: false }, { enabled: false }, { profileBaseUrl: undefined }])(
  'does not discover unadvertised, inactive or missing public Profile: %j',
  (change) => {
    const fetcher = vi.spyOn(globalThis, 'fetch');
    const { result } = setup({ ...options, ...change });
    expect(result.current).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  },
);
it('reads only current Profile copy in the public enterprise context without credentials or commands', async () => {
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(reply('Finish your invitation'));
  const { result } = setup();
  await waitFor(() =>
    expect(result.current).toEqual({ label: 'Finish your invitation' }),
  );
  expect(fetcher).toHaveBeenCalledOnce();
  const [url, init] = fetcher.mock.calls[0]!;
  expect(url instanceof Request ? url.url : url?.toString()).toBe(
    'https://profile.example.test/nodics/profile/v0/enterprise-access/workspace',
  );
  expect(init).toMatchObject({
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    headers: { 'x-enterprise-code': runtime.enterpriseCode },
  });
  expect(init?.method ?? 'GET').toBe('GET');
  expect(init?.body).toBeUndefined();
  expect(new Headers(init?.headers).has('Authorization')).toBe(false);
});
it.each([403, 503])(
  'does not offer or retry a denied/unavailable owner workspace HTTP%i',
  async (status) => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status }));
    const { result, client } = setup();
    await waitFor(() =>
      expect(client.getQueryCache().getAll()[0]?.state.status).toBe('error'),
    );
    expect(result.current).toBeUndefined();
    expect(fetcher).toHaveBeenCalledOnce();
  },
);
it('does not offer registration from an incompatible recovery or malformed workspace', async () => {
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(
        JSON.stringify({ data: { ...workspace, renderer: 'axis.employee-recovery' } }),
      ),
    );
  const { result, client } = setup();
  await waitFor(() =>
    expect(client.getQueryCache().getAll()[0]?.state.status).toBe('error'),
  );
  expect(result.current).toBeUndefined();
  expect(fetcher).toHaveBeenCalledOnce();
});
it('retires a replaced public connection and never renders its late entry copy', async () => {
  let resolveOld!: (response: Response) => void;
  const old = new Promise<Response>((resolve) => {
    resolveOld = resolve;
  });
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockReturnValueOnce(old)
    .mockResolvedValue(reply('Current invitation'));
  const { result, rerender } = setup();
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  const signal = fetcher.mock.calls[0]?.[1]?.signal;
  rerender({
    ...options,
    profileBaseUrl: 'https://current-profile.example.test',
    scope: 'login-b',
  });
  expect(result.current).toBeUndefined();
  await waitFor(() => expect(result.current?.label).toBe('Current invitation'));
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    resolveOld(reply('Retired invitation'));
    await old;
  });
  expect(result.current?.label).toBe('Current invitation');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('removes admitted copy immediately when the public sign-in becomes inactive', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply());
  const { result, rerender } = setup();
  await waitFor(() => expect(result.current?.label).toBe(workspace.presentation.title));
  rerender({ ...options, enabled: false });
  expect(result.current).toBeUndefined();
  expect(fetcher).toHaveBeenCalledOnce();
});
