import { describe, expect, it } from 'vitest';

import { parseRuntimeConfig } from '../../src/runtime/runtimeConfig';

const validConfig = {
  backofficeBaseUrl: 'https://backoffice.example.com/',
  locationBaseUrl: 'https://location.example.com/nodics/locationMap/',
  wasteApiBaseUrl: 'https://waste.example.com/nodics/wasteApi/',
  enterpriseCode: 'default',
  projectCode: 'nodics.kickoff',
  clientContractVersion: 1,
  requestTimeoutMs: 10_000,
  browserSessionCsrfCookieName: 'nodics_axis_csrf',
  assistantMaximumEventBytes: 65_536,
  assistantReconnectWindowMs: 120_000,
  assistantIdleTimeoutMs: 45_000,
};

describe('parseRuntimeConfig', () => {
  it('accepts and normalizes a safe configuration', () => {
    expect(parseRuntimeConfig(validConfig)).toEqual({
      backofficeBaseUrl: 'https://backoffice.example.com',
      locationBaseUrl: 'https://location.example.com/nodics/locationMap',
      wasteApiBaseUrl: 'https://waste.example.com/nodics/wasteApi',
      enterpriseCode: 'default',
      projectCode: 'nodics.kickoff',
      clientContractVersion: 1,
      requestTimeoutMs: 10_000,
      publicDiscoveryRetryWindowMs: 300_000,
      browserSessionCsrfCookieName: 'nodics_axis_csrf',
      assistantMaximumEventBytes: 65_536,
      assistantReconnectWindowMs: 120_000,
      assistantIdleTimeoutMs: 45_000,
    });
  });

  it.each([1_000, 10_000, 120_000, 120_001, 360_000, 600_000])(
    'accepts a bounded request timeout of %i ms',
    (requestTimeoutMs) => {
      expect(
        parseRuntimeConfig({ ...validConfig, requestTimeoutMs }).requestTimeoutMs,
      ).toBe(requestTimeoutMs);
    },
  );

  it.each([600_001, Infinity, -Infinity, NaN, 360_000.5, '360000', null, undefined])(
    'rejects an invalid request timeout of %s',
    (requestTimeoutMs) => {
      expect(() => parseRuntimeConfig({ ...validConfig, requestTimeoutMs })).toThrow(
        /requestTimeoutMs/,
      );
    },
  );

  it.each([
    ['relative URL', { ...validConfig, backofficeBaseUrl: '/backoffice' }],
    ['relative Location URL', { ...validConfig, locationBaseUrl: '/location' }],
    ['relative Waste API URL', { ...validConfig, wasteApiBaseUrl: '/wasteApi' }],
    [
      'credentials',
      { ...validConfig, backofficeBaseUrl: 'https://user:secret@example.com' },
    ],
    ['unsupported scheme', { ...validConfig, backofficeBaseUrl: 'file:///tmp/api' }],
    ['zero contract version', { ...validConfig, clientContractVersion: 0 }],
    ['invalid project code', { ...validConfig, projectCode: 'not project' }],
    ['short timeout', { ...validConfig, requestTimeoutMs: 999 }],
    ['long timeout', { ...validConfig, requestTimeoutMs: 600_001 }],
    ['unknown field', { ...validConfig, password: 'must-not-be-here' }],
    ['unbounded discovery', { ...validConfig, publicDiscoveryRetryWindowMs: 600_001 }],
    ['invalid discovery window', { ...validConfig, publicDiscoveryRetryWindowMs: 0 }],
  ])('rejects %s', (_name, value) => {
    expect(() => parseRuntimeConfig(value)).toThrow();
  });
});
