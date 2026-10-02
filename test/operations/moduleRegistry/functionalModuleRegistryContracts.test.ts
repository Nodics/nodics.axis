import { describe, expect, it, vi } from 'vitest';
import {
  loadAvailableFunctionalModules,
  applyFunctionalModuleSelection,
} from '../../../src/operations/moduleRegistry/api/functionalModuleRegistryClient';

import {
  parseFunctionalModuleCatalogue,
  parseFunctionalModuleRegistration,
} from '../../../src/operations/moduleRegistry/api/functionalModuleRegistryContracts';

function registration(runtimeState: string) {
  return {
    project: 'nodics.kickoff',
    functionalModule: 'nodics.commerce',
    displayName: 'Commerce',
    registrationState: 'AVAILABLE',
    enabled: false,
    required: false,
    runtimeState,
    technicalModules: ['store', 'product'],
    observedServers: [],
    catalogueRevision: 3,
  };
}

describe('functionalModuleRegistryContracts', () => {
  it('shows actionable network errors without replaying reads or uncertain commands', async () => {
    const connection = {
      moduleName: 'backoffice',
      instanceId: 'local',
      endpoint: 'http://localhost:4300/nodics/backoffice',
      environment: 'testLocal',
      state: 'UP' as const,
    };
    const configuration = {
      accessToken: 'fixture-token',
      enterpriseCode: 'default',
      projectCode: 'fixture',
      timeoutMs: 1000,
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(
      loadAvailableFunctionalModules(connection, configuration, fetchImplementation),
    ).rejects.toThrow(
      'The module registry is temporarily unavailable. Check your connection and try refreshing shortly.',
    );
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    fetchImplementation.mockClear();
    await expect(
      applyFunctionalModuleSelection(
        connection,
        [],
        configuration,
        fetchImplementation,
      ),
    ).rejects.toThrow(
      'Connection lost. Check the module status before trying again; the change may have completed.',
    );
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });
  it('accepts the published offline runtime state used after lease expiry', () => {
    expect(parseFunctionalModuleRegistration(registration('OFFLINE'))).toMatchObject({
      functionalModule: 'nodics.commerce',
      runtimeState: 'OFFLINE',
    });
  });

  it('distinguishes read timeouts from uncertain command timeouts without replay', async () => {
    vi.useFakeTimers();
    try {
      const connection = {
        moduleName: 'backoffice',
        instanceId: 'local',
        endpoint: 'http://localhost:4300/nodics/backoffice',
        environment: 'testLocal',
        state: 'UP' as const,
      };
      const configuration = {
        accessToken: 'fixture-token',
        enterpriseCode: 'default',
        projectCode: 'fixture',
        timeoutMs: 1000,
      };
      for (const command of [false, true]) {
        const fetchImplementation = vi.fn<typeof fetch>().mockImplementation(
          (_url, options) =>
            new Promise((_resolve, reject) => {
              options?.signal?.addEventListener(
                'abort',
                () => reject(new DOMException('Aborted', 'AbortError')),
                { once: true },
              );
            }),
        );
        const pending = command
          ? applyFunctionalModuleSelection(
              connection,
              [],
              configuration,
              fetchImplementation,
            )
          : loadAvailableFunctionalModules(
              connection,
              configuration,
              fetchImplementation,
            );
        const assertion = expect(pending).rejects.toThrow(
          command
            ? 'The service did not respond in time. Check the module status before trying again; the change may have completed.'
            : 'The module registry is taking longer than expected. Try refreshing shortly.',
        );
        await vi.advanceTimersByTimeAsync(1000);
        await assertion;
        expect(fetchImplementation).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects unpublished runtime states before they can empty the registry page', () => {
    expect(() =>
      parseFunctionalModuleCatalogue({
        items: [registration('INACTIVE')],
      }),
    ).toThrow('Functional-module runtime state is unsupported');
  });
});
