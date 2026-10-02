/** Independent cookie-safe switch transport fixtures; no live browser or backend acceptance. */
import { afterEach, expect, it, vi } from 'vitest';
import { switchEmployeeEnterprise } from '../../src/auth/employeeAuthClient';
const session = {
  accessToken: 'current-access',
  loginId: 'person@example.test',
  enterpriseCode: 'first',
  generation: 1,
};
const membership = { code: 'membership', revision: 3, enterpriseCode: 'second' };
afterEach(() => {
  document.cookie = 'switchcsrf=; Max-Age=0; Path=/';
});
it('keeps the current enterprise header and submits only a reviewed membership DTO with browser proof', async () => {
  document.cookie = 'switchcsrf=csrf-proof; Path=/';
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        code: 'SUC_AUTH_00000',
        result: {
          authToken: 'target-access',
          loginId: 'person@example.test',
          enterpriseCode: 'second',
          refreshToken: 'must-not-project',
        },
      }),
      { status: 200 },
    ),
  );
  const result = await switchEmployeeEnterprise(
    'https://profile.example.test',
    session,
    'first',
    membership,
    'switchcsrf',
    1000,
    fetcher,
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, init] = fetcher.mock.calls[0]!;
  expect(url instanceof Request ? url.url : url.toString()).toBe(
    'https://profile.example.test/nodics/profile/v0/employee/browser/switch-enterprise',
  );
  expect(init?.credentials).toBe('include');
  expect(init?.redirect).toBe('error');
  expect(init?.body).toBe(
    JSON.stringify({ assignmentCode: 'membership', revision: 3 }),
  );
  const headers = new Headers(init?.headers);
  expect(headers.get('x-enterprise-code')).toBe('first');
  expect(headers.get('X-CSRF-Token')).toBe('csrf-proof');
  expect(headers.get('Authorization')).toBe('Bearer current-access');
  expect(result.enterpriseCode).toBe('second');
  expect(result).not.toHaveProperty('refreshToken');
});
it('uncertain transport is never retried and mismatched target envelopes fail closed', async () => {
  document.cookie = 'switchcsrf=csrf-proof; Path=/';
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new Error('Acknowledgement lost'));
  await expect(
    switchEmployeeEnterprise(
      'https://profile.example.test',
      session,
      'first',
      membership,
      'switchcsrf',
      1000,
      fetcher,
    ),
  ).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockResolvedValue(
    new Response(
      JSON.stringify({
        code: 'SUC_AUTH_00000',
        result: { authToken: 'access', loginId: 'person', enterpriseCode: 'other' },
      }),
      { status: 200 },
    ),
  );
  await expect(
    switchEmployeeEnterprise(
      'https://profile.example.test',
      session,
      'first',
      membership,
      'switchcsrf',
      1000,
      fetcher,
    ),
  ).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('missing CSRF or invalid revision sends no request', async () => {
  const fetcher = vi.fn<typeof fetch>();
  await expect(
    switchEmployeeEnterprise(
      'https://profile.example.test',
      session,
      'first',
      membership,
      'switchcsrf',
      1000,
      fetcher,
    ),
  ).rejects.toThrow();
  document.cookie = 'switchcsrf=csrf-proof; Path=/';
  await expect(
    switchEmployeeEnterprise(
      'https://profile.example.test',
      session,
      'first',
      { ...membership, revision: 0 },
      'switchcsrf',
      1000,
      fetcher,
    ),
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
