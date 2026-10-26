import { afterEach, expect, it, vi } from 'vitest';
import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from '../../src/operations/shared/operationalOwnerClient';
vi.mock('../../src/bootstrap/publicBootstrap', () => ({
  selectModuleConnection: () => ({ endpoint: 'https://promotion.test' }),
}));
afterEach(() => vi.unstubAllGlobals());
it('retains native admin bearer/header, sends only business target in body, and aborts retired review transport', async () => {
  let request: RequestInit | undefined;
  const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, options) => {
    request = options;
    return new Promise((_resolve, reject) =>
      options?.signal?.addEventListener('abort', () =>
        reject(new DOMException('Aborted', 'AbortError')),
      ),
    );
  });
  vi.stubGlobal('fetch', fetcher);
  const controller = new AbortController();
  const result = invokeOperationalOwner(
    {
      bootstrap: {},
      accessToken: 'admin-proof',
      enterpriseCode: 'default',
      timeoutMs: 1000,
    } as OperationalOwnerConfiguration,
    'promotion',
    '/promotions/offer/administrative-review',
    { issuerEnterpriseCode: 'retail' },
    'POST',
    { signal: controller.signal },
  );
  expect(request?.headers).toMatchObject({
    Authorization: 'Bearer admin-proof',
    'x-enterprise-code': 'default',
  });
  expect(JSON.parse(request?.body as string)).toEqual({
    issuerEnterpriseCode: 'retail',
  });
  controller.abort();
  await expect(result).rejects.toThrow('Aborted');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
