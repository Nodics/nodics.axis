/**
 * Profile owns workspace projection and registration admission. These controlled
 * bootstrap/HTTP fixtures exercise Axis consumption, not backend qualification
 * or live registration. No frontend filtering or registration authority is added.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BackendOperationsWorkspaceRoutePage,
  PublicBackendOperationsWorkspaceRoutePage,
} from '../../src/app/BackendOperationsWorkspaceRoutePage';
import {
  loadAuthenticatedBootstrap,
  selectModuleConnection,
} from '../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';

const runtime: AxisRuntimeConfig = {
  backofficeBaseUrl: 'https://backoffice.example.test',
  enterpriseCode: 'default',
  projectCode: 'example',
  clientContractVersion: 1,
  requestTimeoutMs: 1000,
  browserSessionCsrfCookieName: 'test_csrf',
  assistantMaximumEventBytes: 65536,
  assistantReconnectWindowMs: 1000,
  assistantIdleTimeoutMs: 5000,
};

// Owner-projected authenticated descriptor: public registration is independent.
const ownerBootstrap = {
  data: {
    tenantCode: 'default',
    documentationSources: [],
    startupValidation: {
      state: 'READY',
      checkedAt: '2026-10-01T00:00:00.000Z',
      source: 'backoffice.startupValidation',
      summary: {
        total: 0,
        errors: 0,
        warnings: 0,
        info: 0,
        dismissible: 0,
        acknowledged: 0,
      },
      findings: [],
    },
    axisPolicy: {
      contractVersion: 0,
      screenLockEnabled: true,
      idleTimeoutSeconds: 600,
      recentNavigationLimit: 5,
      revision: 0,
      source: 'DEFAULT',
    },
    modules: {
      profile: [
        {
          instanceId: 'profile-one',
          environment: 'test',
          clientCallable: true,
          endpoint: 'https://profile.example.test',
          state: 'UP',
        },
      ],
    },
    availability: { profile: { state: 'UP' } },
    catalogue: {
      profile: {
        enabled: true,
        compatibility: { status: 'COMPATIBLE' },
        navigation: [
          {
            id: 'enterprises',
            label: 'Enterprises and Users',
            route: '/profile/enterprises',
            featureState: 'ACTIVE',
            backendWorkspace: {
              contractVersion: 0,
              renderer: 'axis.workspace.backend-operations',
              title: 'Enterprise and User Management',
              defaultTab: 'enterprises',
              tabs: [
                {
                  id: 'enterprises',
                  label: 'Enterprises',
                  sections: [
                    {
                      id: 'enterprise-list',
                      type: 'listing',
                      title: 'Enterprise Registry',
                      endpoint: {
                        method: 'GET',
                        path: '/nodics/profile/v0/enterprises/search',
                        resultPath: 'items',
                      },
                      columns: [{ field: 'code', label: 'Code' }],
                      filters: [],
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    },
  },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function assertNoLegacyRegistration() {
  expect(screen.queryByRole('tab', { name: 'Registration' })).not.toBeInTheDocument();
  expect(screen.queryByText('Check Pre-assigned Access')).not.toBeInTheDocument();
  expect(screen.queryByText('Complete Registration')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Create account' }),
  ).not.toBeInTheDocument();
  expect(document.querySelector('input[type="password"]')).toBeNull();
}

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}

describe('Owner-projected enterprise bootstrap registration exposure', () => {
  it('renders the authenticated generic descriptor without public legacy forms or registration requests', async () => {
    const transport = vi.fn<typeof fetch>((input) => {
      const path = new URL(requestUrl(input)).pathname;
      if (path === '/nodics/backoffice/v0/bootstrap')
        return Promise.resolve(Response.json(ownerBootstrap));
      if (path === '/nodics/profile/v0/enterprises/search')
        return Promise.resolve(
          Response.json({
            code: 'SUC_PRFL_00000',
            data: { items: [{ code: 'default' }] },
          }),
        );
      return Promise.reject(new Error('Unexpected request'));
    });
    vi.stubGlobal('fetch', transport);
    const bootstrap = await loadAuthenticatedBootstrap(
      runtime.backofficeBaseUrl,
      1,
      'test-token',
      1000,
    );
    const navigation = bootstrap.navigation.find((item) => item.id === 'enterprises');
    expect(navigation?.route).toBe('/profile/enterprises');
    expect(navigation?.backendWorkspace).toBeDefined();
    if (!navigation?.backendWorkspace) throw new Error('Owner workspace missing');
    render(
      <MemoryRouter initialEntries={['/profile/enterprises?tab=registration']}>
        <BackendOperationsWorkspaceRoutePage
          workspace={navigation.backendWorkspace}
          runtime={runtime}
          connection={selectModuleConnection(bootstrap, 'profile')}
          accessToken="test-token"
        />
      </MemoryRouter>,
    );
    await screen.findByText('default');
    assertNoLegacyRegistration();
    expect(transport).toHaveBeenCalledTimes(2);
    expect(
      transport.mock.calls.every(([, init]) => !init?.method || init.method === 'GET'),
    ).toBe(true);
  });

  it('keeps unavailable canonical public registration unavailable without authenticated-form fallback', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ message: 'Registration is unavailable.' }, { status: 503 }),
      );
    vi.stubGlobal('fetch', transport);
    render(
      <MemoryRouter initialEntries={['/enterprise-access/register']}>
        <PublicBackendOperationsWorkspaceRoutePage
          runtime={runtime}
          profileBaseUrl="https://profile.example.test"
        />
      </MemoryRouter>,
    );
    await screen.findByText('Registration is unavailable.');
    assertNoLegacyRegistration();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    await waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
    const input = transport.mock.calls[0]?.[0];
    if (!input) throw new Error('Workspace discovery missing');
    expect(requestUrl(input)).toBe(
      'https://profile.example.test/nodics/profile/v0/enterprise-access/workspace',
    );
    expect(transport.mock.calls[0]?.[1]?.body).toBeUndefined();
    expect(
      new Headers(transport.mock.calls[0]?.[1]?.headers).has('Authorization'),
    ).toBe(false);
  });
});
