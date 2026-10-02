/** Authored transport-envelope fixtures; behavioral execution remains joint. */
import { afterEach, expect, it, vi } from 'vitest';
import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from '../../src/operations/shared/operationalOwnerClient';

vi.mock('../../src/bootstrap/publicBootstrap', () => ({
  selectModuleConnection: vi.fn(() => ({ endpoint: 'https://owner.example.test' })),
}));

afterEach(() => vi.unstubAllGlobals());
const configuration = {
  bootstrap: {},
  accessToken: 'fixture-token',
  enterpriseCode: 'acting-enterprise',
  timeoutMs: 1000,
} as OperationalOwnerConfiguration;

it.each([
  { success: false, data: { revision: 1 } },
  { data: { result: { code: 'ERR_PROFILE_DENIED', data: { revision: 1 } } } },
])('rejects explicit failure envelopes even when HTTP succeeds', async (envelope) => {
  const request = vi
    .fn()
    .mockResolvedValue({ ok: true, json: () => Promise.resolve(envelope) });
  vi.stubGlobal('fetch', request);
  await expect(
    invokeOperationalOwner(configuration, 'profile', '/fixture', { revision: 0 }),
  ).rejects.toThrow('could not be confirmed');
  expect(request).toHaveBeenCalledTimes(1);
});

it('projects a successful nested owner DTO without repeating the request', async () => {
  const request = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true, data: { result: { revision: 1 } } }),
  });
  vi.stubGlobal('fetch', request);
  await expect(
    invokeOperationalOwner(configuration, 'profile', '/fixture'),
  ).resolves.toEqual({ revision: 1 });
  expect(request).toHaveBeenCalledTimes(1);
});
it('sends only a bounded stable idempotency header without changing issuer proof', async () => {
  const request = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: { recorded: true } }),
  });
  vi.stubGlobal('fetch', request);
  await invokeOperationalOwner(
    configuration,
    'digitalCore',
    '/fixture',
    { confirmed: true },
    'POST',
    { idempotencyKey: 'confirm:original' },
  );
  expect(request.mock.calls[0]?.[1]).toMatchObject({
    headers: {
      'Idempotency-Key': 'confirm:original',
      'x-enterprise-code': 'acting-enterprise',
      Authorization: 'Bearer fixture-token',
    },
  });
  await expect(
    invokeOperationalOwner(configuration, 'digitalCore', '/fixture', {}, 'POST', {
      idempotencyKey: 'bad\nheader',
    }),
  ).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
});
