import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import type { AxisAuthenticatedBootstrap } from '../../../src/bootstrap/publicBootstrap';
import { FunctionalModuleRegistryRoutePage } from '../../../src/operations/moduleRegistry/FunctionalModuleRegistryRoutePage';
import type { AxisRuntimeConfig } from '../../../src/runtime/runtimeConfig';

const runtime: AxisRuntimeConfig = {
  backofficeBaseUrl: 'http://localhost:4300',
  enterpriseCode: 'default',
  projectCode: 'nodics.kickoff',
  clientContractVersion: 1,
  requestTimeoutMs: 1_000,
  browserSessionCsrfCookieName: 'csrf',
  assistantMaximumEventBytes: 1_024,
  assistantReconnectWindowMs: 1_000,
  assistantIdleTimeoutMs: 1_000,
};

const bootstrap: AxisAuthenticatedBootstrap = {
  axisPolicy: {
    contractVersion: 1,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 1,
    source: 'DEFAULT',
  },
  navigation: [
    {
      id: 'products',
      label: 'Products',
      route: '/commerce/catalog/products',
      order: 20,
      moduleName: 'product',
      category: 'commerce',
      icon: 'product',
      availability: 'UP',
      workbenchTarget: { moduleName: 'product', schemaName: 'product' },
    },
  ],
  environments: ['kickoffLocal'],
  moduleCatalog: {},
  moduleConnections: {
    backoffice: [
      {
        moduleName: 'backoffice',
        instanceId: 'kickoffLocal:platformServer:backoffice:0',
        endpoint: 'http://localhost:4300/nodics/backoffice',
        environment: 'kickoffLocal',
        server: 'platformServer',
        runtimeRole: { code: 'PLATFORM', publication: 'OPERATIONAL' },
        state: 'UP',
      },
    ],
  },
  applicationInitializationProfiles: [],
  documentationSources: [],
  tenantCode: 'default',
};

function response(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function moduleItem(
  functionalModule: string,
  displayName: string,
  options: {
    readonly enabled?: boolean | undefined;
    readonly required?: boolean | undefined;
    readonly registrationState?: 'AVAILABLE' | 'REGISTERED' | undefined;
  } = {},
) {
  const registrationState = options.registrationState ?? 'REGISTERED';
  return {
    project: 'nodics.kickoff',
    functionalModule,
    displayName,
    registeredVersion: registrationState === 'REGISTERED' ? '0.1.0' : undefined,
    registrationState,
    enabled: options.enabled ?? false,
    required: options.required ?? false,
    runtimeState: 'ACTIVE',
    technicalModules:
      functionalModule === 'nodics.commerce'
        ? ['product', 'price', 'inventory']
        : [functionalModule.replace('nodics.', '')],
    observedServers: ['platformServer'],
    catalogueRevision: 3,
    lastObservedAt: '2026-08-28T12:00:00.000Z',
    activationData:
      functionalModule === 'nodics.commerce'
        ? {
            action: 'activate',
            dryRun: true,
            executionMode: 'PREVIEW',
            readiness: 'READY',
            preflight: {
              runtimeActive: true,
              registered: true,
              protectedModule: false,
              dependencies: ['nodics.platform'],
              blockedReasons: [],
            },
            packages: [
              {
                code: 'commerce-core-v001',
                classification: 'REQUIRED',
                owner: 'nodics.commerce',
                required: true,
                trigger: 'SYSTEM',
                targetModule: 'product',
                targetServer: 'commerceServer',
                targetDatabase: 'commerce',
                operation: 'saveAll',
                dataType: 'core',
              },
            ],
            receipts: [],
            nextActions: ['ACTIVATE'],
          }
        : undefined,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FunctionalModuleRegistryRoutePage
            accessToken="employee-token"
            bootstrap={bootstrap}
            runtime={runtime}
          />
        </MemoryRouter>
      </QueryClientProvider>
    </AxisThemeProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FunctionalModuleRegistryRoutePage', () => {
  it('renders a compact control center with expandable module details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = urlOf(input);
        if (url.includes('/runtime/modules/available')) {
          return Promise.resolve(
            response({
              items: [
                moduleItem('nodics.docs', 'Documentation', {
                  registrationState: 'AVAILABLE',
                }),
              ],
            }),
          );
        }
        if (url.includes('/runtime/modules/registrations')) {
          return Promise.resolve(
            response({
              items: [
                moduleItem('nodics.platform', 'Platform', {
                  enabled: true,
                  required: true,
                }),
                moduleItem('nodics.commerce', 'Commerce'),
              ],
            }),
          );
        }
        return Promise.resolve(response({ items: [] }));
      }),
    );

    renderPage();

    expect(await screen.findByText('Registry control center')).toBeInTheDocument();
    expect(
      screen.getByText('Protected foundation modules for this project.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Project capabilities selected for operators.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Runtime-observed capabilities not yet added to this project.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Commerce')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument();
    expect(screen.queryByText('Registry identity')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Expand Commerce' }));

    expect(screen.getByText('Registry identity')).toBeInTheDocument();
    expect(screen.getByText('nodics.commerce')).toBeInTheDocument();
    expect(screen.getByText('Data packages')).toBeInTheDocument();
  });
});
