import { describe, expect, it, vi } from 'vitest';

import type { AxisModuleConnection } from '../../../../src/bootstrap/publicBootstrap';
import {
  loadModuleHealth,
  loadModuleHealthDetail,
  refreshModuleHealth,
} from '../../../../src/operations/moduleHealth/api/moduleHealthClient';

const connection: AxisModuleConnection = {
  moduleName: 'backoffice',
  instanceId: 'local:monoServer:default:1',
  endpoint: 'http://localhost:3000/nodics/backoffice',
  environment: 'kickoffLocal',
  state: 'UP',
};
const configuration = {
  accessToken: 'employee-token',
  enterpriseCode: 'default',
  timeoutMs: 1000,
};

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('module health client', () => {
  it('parses bounded module summaries and sends employee authorization', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        data: {
          total: 1,
          offset: 0,
          limit: 100,
          items: [
            {
              moduleName: 'profile',
              displayName: 'Employee Profiles',
              parentModule: 'nodics.platform',
              canonicalIdentity: 'nodics.platform/modules/profile',
              version: '0.0.0',
              moduleKind: 'module',
              environments: ['kickoffLocal'],
              servers: ['profileServer'],
              availability: {
                state: 'DEGRADED',
                activeInstances: 2,
                healthyInstances: 1,
                unavailableInstances: 1,
                unknownInstances: 0,
              },
            },
          ],
        },
      }),
    );

    const result = await loadModuleHealth(
      connection,
      configuration,
      fetchImplementation,
    );

    expect(result[0]?.moduleName).toBe('profile');
    expect(result[0]?.displayName).toBe('Employee Profiles');
    expect(result[0]?.parentModule).toBe('nodics.platform');
    expect(result[0]?.canonicalIdentity).toBe('nodics.platform/modules/profile');
    expect(result[0]?.availability.state).toBe('DEGRADED');
    const [url, options] = fetchImplementation.mock.calls[0]!;
    expect(url).toBeInstanceOf(URL);
    expect((url as URL).toString()).toContain(
      '/v0/registry/admin/modules?offset=0&limit=100',
    );
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      'Bearer employee-token',
    );
    expect(new Headers(options?.headers).get('x-enterprise-code')).toBe('default');
  });

  it('parses sanitized node readiness without accepting raw diagnostics', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        data: {
          moduleName: 'profile',
          displayName: 'Employee Profiles',
          availability: {
            state: 'UNAVAILABLE',
            activeInstances: 1,
            healthyInstances: 0,
            unavailableInstances: 1,
            unknownInstances: 0,
          },
          instances: [
            {
              instanceId: 'local:profileServer:profileNode1:99',
              clientCallable: true,
              environment: 'kickoffLocal',
              server: 'profileServer',
              node: 'profileNode1',
              version: '0.0.0',
              lastSeenAt: '2026-07-27T10:00:00.000Z',
              availability: {
                state: 'UNAVAILABLE',
                freshness: 'FRESH',
                observedAt: '2026-07-27T10:00:01.000Z',
                reasonCode: 'OBSERVATION_TIMEOUT',
              },
            },
          ],
        },
      }),
    );

    const result = await loadModuleHealthDetail(
      connection,
      'profile',
      configuration,
      fetchImplementation,
    );

    expect(result.instances[0]?.node).toBe('profileNode1');
    expect(result.displayName).toBe('Employee Profiles');
    expect(result.instances[0]?.clientCallable).toBe(true);
    expect(result.instances[0]?.availability).toEqual({
      state: 'UNAVAILABLE',
      freshness: 'FRESH',
      observedAt: '2026-07-27T10:00:01.000Z',
      reasonCode: 'OBSERVATION_TIMEOUT',
    });
    expect(JSON.stringify(result)).not.toContain('stack');
  });

  it('requests a governed refresh and rejects unsafe module names', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ data: { refreshedInstances: 1 } }, 200));

    await refreshModuleHealth(
      connection,
      'profile',
      configuration,
      fetchImplementation,
    );
    expect(fetchImplementation.mock.calls[0]?.[1]?.method).toBe('POST');
    await expect(
      refreshModuleHealth(connection, '../profile', configuration, fetchImplementation),
    ).rejects.toThrow('module name is invalid');
  });
});
