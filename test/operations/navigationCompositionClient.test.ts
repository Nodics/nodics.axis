/** @file Native navigation snapshot export and one-attempt owner transport regressions. */
import { describe, expect, it, vi } from 'vitest';
import { executeNavigationCompositionAction } from '../../src/operations/navigationComposition/api/navigationCompositionClient';
import type { AxisModuleConnection } from '../../src/bootstrap/publicBootstrap';

const connection: AxisModuleConnection = {
  moduleName: 'backoffice',
  instanceId: 'platform-one',
  endpoint: 'https://platform.example/nodics/backoffice',
  environment: 'test',
  state: 'UP',
};
const configuration = {
  accessToken: 'employee-test-token',
  enterpriseCode: 'enterprise-one',
  projectCode: 'sample project',
  timeoutMs: 5000,
};

describe('Navigation composition owner transport', () => {
  it('exports the native snapshot with current context and no candidate payload', async () => {
    const data = { checksum: 'native-checksum', sources: [], items: [] };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ data })));
    await expect(
      executeNavigationCompositionAction(
        connection,
        configuration,
        'export',
        { shouldNotWrite: true },
        fetcher,
      ),
    ).resolves.toEqual(data);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect((url as URL).pathname).toBe(
      '/nodics/backoffice/v0/navigation/composition/snapshot',
    );
    expect((url as URL).searchParams.get('project')).toBe('sample project');
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
    expect(init?.redirect).toBe('error');
    expect(init?.credentials).toBe('omit');
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer employee-test-token');
    expect(headers.get('x-enterprise-code')).toBe('enterprise-one');
  });

  it.each([403, 404, 405, 503])(
    'does not fall back after owner HTTP %s',
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{}', { status }));
      await expect(
        executeNavigationCompositionAction(
          connection,
          configuration,
          'export',
          undefined,
          fetcher,
        ),
      ).rejects.toThrow(String(status));
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );

  it('retains the native preview path and never turns preview into export or publish', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ data: { valid: true } })));
    await executeNavigationCompositionAction(
      connection,
      configuration,
      'preview',
      { items: [] },
      fetcher,
    );
    expect((fetcher.mock.calls[0]![0] as URL).pathname).toBe(
      '/nodics/backoffice/v0/navigation/composition/preview',
    );
    expect(fetcher.mock.calls[0]![1]?.method).toBe('POST');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
