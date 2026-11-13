import { afterEach, expect, it, vi } from 'vitest';
import {
  loadCurrentEnterpriseDisplay,
  parseCurrentEnterpriseDisplay,
} from '../../src/bootstrap/currentEnterpriseDisplay';
import type { OperationalOwnerConfiguration } from '../../src/operations/shared/operationalOwnerClient';
import { subscribeEmployeeSessionExpired } from '../../src/auth/employeeSessionEvents';

vi.mock('../../src/bootstrap/publicBootstrap', () => ({
  selectModuleConnection: vi.fn(() => ({
    endpoint: 'https://profile.example.test/nodics/profile',
  })),
}));
afterEach(() => vi.unstubAllGlobals());
const configuration = {
  bootstrap: {},
  accessToken: 'fixture-private-token',
  enterpriseCode: 'RETAIL',
  timeoutMs: 1000,
  sessionGeneration: 17,
} as OperationalOwnerConfiguration;
it('projects only the original current Enterprise label, stripping unrelated scope and private fields', () => {
  const parsed = parseCurrentEnterpriseDisplay(
    {
      enterprise: {
        code: 'RETAIL',
        displayName: ' GreenPerks Retail ',
        contacts: ['private'],
        properties: { secret: 'private' },
      },
      scopes: [{ private: 'unneeded' }],
    },
    'RETAIL',
  );
  expect(parsed).toEqual({ code: 'RETAIL', displayName: 'GreenPerks Retail' });
  expect(Object.isFrozen(parsed)).toBe(true);
});
it.each([
  undefined,
  null,
  {},
  [],
  { enterprise: { code: 'OTHER', displayName: 'Foreign' } },
  { enterprise: { code: 'RETAIL' } },
  { enterprise: { code: 'RETAIL', displayName: '' } },
  { enterprise: { code: 'RETAIL', displayName: { en: 'Never infer' } } },
  { enterprise: { code: 'RETAIL', displayName: 'private\nlabel' } },
])('rejects malformed or foreign display evidence %#', (value) => {
  expect(() => parseCurrentEnterpriseDisplay(value, 'RETAIL')).toThrow();
});
it('preserves owner-reported missing names without humanizing an identifier', () => {
  expect(
    parseCurrentEnterpriseDisplay(
      { enterprise: { code: 'RETAIL', displayName: null } },
      'RETAIL',
    ),
  ).toEqual({ code: 'RETAIL', displayName: null });
});
it('calls the existing self-read once with original credentials and no target selector or cookie', async () => {
  const request = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        data: { enterprise: { code: 'RETAIL', displayName: 'GreenPerks Retail' } },
      }),
      { status: 200 },
    ),
  );
  vi.stubGlobal('fetch', request);
  expect(await loadCurrentEnterpriseDisplay(configuration)).toEqual({
    code: 'RETAIL',
    displayName: 'GreenPerks Retail',
  });
  expect(request).toHaveBeenCalledTimes(1);
  expect(String(request.mock.calls[0]?.[0])).toBe(
    'https://profile.example.test/nodics/profile/v0/identity/scopes/me',
  );
  expect(request.mock.calls[0]?.[1]).toMatchObject({
    method: 'GET',
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    headers: {
      Authorization: 'Bearer fixture-private-token',
      'x-enterprise-code': 'RETAIL',
    },
  });
  expect((request.mock.calls[0]?.[1] as RequestInit).body).toBeUndefined();
});
it.each([401, 403])(
  'keeps denied reads single-attempt and signals only the original 401 generation (%s)',
  async (status) => {
    const observed = vi.fn(),
      unsubscribe = subscribeEmployeeSessionExpired(observed);
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ code: 'ERR_AUTH_00003' }), { status }),
      );
    vi.stubGlobal('fetch', request);
    try {
      await expect(loadCurrentEnterpriseDisplay(configuration)).rejects.toThrow();
      expect(request).toHaveBeenCalledTimes(1);
      expect(observed).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
      if (status === 401)
        expect(observed).toHaveBeenCalledWith({
          accessToken: configuration.accessToken,
          generation: 17,
        });
    } finally {
      unsubscribe();
    }
  },
);
