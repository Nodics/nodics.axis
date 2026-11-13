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
  it('explains an uncertain transport result and never repeats a lifecycle command', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('network unavailable'));
    await expect(
      executeNavigationCompositionAction(
        connection,
        configuration,
        'submit',
        undefined,
        fetcher,
        {
          expectedVersion: 1,
          expectedChecksum: 'a'.repeat(64),
          expectedDraftId: 'nav-draft-1',
        },
      ),
    ).rejects.toThrow(/Refresh lifecycle to inspect the owner state/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('exports the native snapshot with current context and no candidate payload', async () => {
    const data = { checksum: 'native-checksum', sources: [], items: [] };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ code: 'SUC_BOF_00018', data })));
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
      .mockResolvedValue(
        new Response(JSON.stringify({ code: 'SUC_BOF_00017', data: { valid: true } })),
      );
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

it.each([
  'https://person:password@platform.example/nodics/backoffice',
  'https://platform.example/nodics/backoffice?redirect=other',
  'https://platform.example/nodics/backoffice#foreign',
])(
  'rejects ambiguous endpoint coordinates before credentials are attached: %s',
  async (endpoint) => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      executeNavigationCompositionAction(
        { ...connection, endpoint },
        configuration,
        'export',
        undefined,
        fetcher,
      ),
    ).rejects.toThrow(/endpoint/);
    expect(fetcher).not.toHaveBeenCalled();
  },
);
it.each([
  { code: 'ERR_AUTH_00003', data: {} },
  { code: 'SUC_BOF_00026', data: {} },
  { data: {} },
  { code: 'SUC_BOF_00018', data: {}, result: {} },
])('refuses nonmatching success envelopes without retry', async (body) => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(body)));
  await expect(
    executeNavigationCompositionAction(
      connection,
      configuration,
      'export',
      undefined,
      fetcher,
    ),
  ).rejects.toThrow(/acknowledgement/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
