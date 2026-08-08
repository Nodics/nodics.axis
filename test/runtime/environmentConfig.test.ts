import { describe, expect, it } from 'vitest';

import { buildRuntimeConfig } from '../../vite.config';

const validEnvironment = {
  AXIS_BACKOFFICE_BASE_URL: 'https://backoffice.example.com/',
  AXIS_ENTERPRISE_CODE: 'default',
  AXIS_PROJECT_CODE: 'kickoff',
  AXIS_CLIENT_CONTRACT_VERSION: '1',
  AXIS_REQUEST_TIMEOUT_MS: '10000',
  AXIS_BROWSER_SESSION_CSRF_COOKIE_NAME: 'nodics_axis_csrf',
  AXIS_ASSISTANT_MAXIMUM_EVENT_BYTES: '65536',
  AXIS_ASSISTANT_RECONNECT_WINDOW_MS: '120000',
  AXIS_ASSISTANT_IDLE_TIMEOUT_MS: '45000',
};

describe('Axis environment configuration', () => {
  it('maps explicit public environment values into the runtime contract', () => {
    expect(buildRuntimeConfig(validEnvironment)).toEqual({
      backofficeBaseUrl: 'https://backoffice.example.com',
      enterpriseCode: 'default',
      projectCode: 'kickoff',
      clientContractVersion: 1,
      requestTimeoutMs: 10000,
      browserSessionCsrfCookieName: 'nodics_axis_csrf',
      assistantMaximumEventBytes: 65536,
      assistantReconnectWindowMs: 120000,
      assistantIdleTimeoutMs: 45000,
    });
  });

  it.each([
    ['missing enterprise code', { ...validEnvironment, AXIS_ENTERPRISE_CODE: '' }],
    ['missing project code', { ...validEnvironment, AXIS_PROJECT_CODE: '' }],
    [
      'credential-bearing BackOffice URL',
      {
        ...validEnvironment,
        AXIS_BACKOFFICE_BASE_URL: 'https://user:secret@example.com',
      },
    ],
    [
      'invalid contract version',
      { ...validEnvironment, AXIS_CLIENT_CONTRACT_VERSION: 'latest' },
    ],
    [
      'timeout above the runtime boundary',
      { ...validEnvironment, AXIS_REQUEST_TIMEOUT_MS: '120001' },
    ],
  ])('rejects %s', (_caseName, environment) => {
    expect(() => buildRuntimeConfig(environment)).toThrow();
  });
});
