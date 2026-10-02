import { describe, expect, it, vi } from 'vitest';

import { loadRuntimeConfig } from '../../src/runtime/loadRuntimeConfig';

const validConfig = {
  backofficeBaseUrl: 'http://localhost:3000',
  locationBaseUrl: 'http://localhost:4380/nodics/locationMap',
  wasteApiBaseUrl: 'http://localhost:4370/nodics/wasteApi',
  enterpriseCode: 'default',
  projectCode: 'nodics.kickoff',
  clientContractVersion: 1,
  requestTimeoutMs: 10_000,
  browserSessionCsrfCookieName: 'nodics_axis_csrf',
  assistantMaximumEventBytes: 65_536,
  assistantReconnectWindowMs: 120_000,
  assistantIdleTimeoutMs: 45_000,
};

describe('loadRuntimeConfig', () => {
  it('requests runtime configuration without cache', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(validConfig), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(loadRuntimeConfig(fetchImplementation)).resolves.toEqual({
      ...validConfig,
      publicDiscoveryRetryWindowMs: 300_000,
    });
    expect(fetchImplementation).toHaveBeenCalledWith(
      '/axis-config.json',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'same-origin',
      }),
    );
  });

  it.each([1_000, 120_000, 600_000])(
    'preserves the explicit bounded public discovery retry window %i',
    async (publicDiscoveryRetryWindowMs) => {
      const configured = { ...validConfig, publicDiscoveryRetryWindowMs };
      const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(configured), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(loadRuntimeConfig(fetchImplementation)).resolves.toEqual(configured);
    },
  );

  it.each([0, 999, 600_001, 1_000.5])(
    'rejects an invalid public discovery retry window %s',
    async (publicDiscoveryRetryWindowMs) => {
      const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ ...validConfig, publicDiscoveryRetryWindowMs }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(loadRuntimeConfig(fetchImplementation)).rejects.toThrow(
        'publicDiscoveryRetryWindowMs',
      );
    },
  );

  it('reports an unavailable configuration without exposing transport details', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('secret network detail'));

    await expect(loadRuntimeConfig(fetchImplementation)).rejects.toThrow(
      'Axis runtime configuration could not be reached',
    );
  });

  it('rejects a failed HTTP response', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));

    await expect(loadRuntimeConfig(fetchImplementation)).rejects.toThrow('HTTP 503');
  });
});
