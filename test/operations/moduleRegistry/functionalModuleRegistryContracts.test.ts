import { describe, expect, it } from 'vitest';

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
  it('accepts the published offline runtime state used after lease expiry', () => {
    expect(parseFunctionalModuleRegistration(registration('OFFLINE'))).toMatchObject({
      functionalModule: 'nodics.commerce',
      runtimeState: 'OFFLINE',
    });
  });

  it('rejects unpublished runtime states before they can empty the registry page', () => {
    expect(() =>
      parseFunctionalModuleCatalogue({
        items: [registration('INACTIVE')],
      }),
    ).toThrow('Functional-module runtime state is unsupported');
  });
});
