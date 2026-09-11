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
  it('clears prior success and refreshes the revision after a rejected activation without retrying it', async () => {
    let registered = false;
    let activationRequests = 0;
    let registeredReads = 0;
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url = urlOf(input);
      if (url.endsWith('/register')) {
        registered = true;
        return Promise.resolve(response(moduleItem('nodics.commerce', 'Commerce')));
      }
      if (url.endsWith('/activate')) {
        activationRequests++;
        return Promise.resolve(
          new Response(JSON.stringify({ message: 'Catalogue revision conflict' }), {
            status: 400,
          }),
        );
      }
      if (url.includes('/runtime/modules/available')) {
        return Promise.resolve(
          response({
            items: registered
              ? []
              : [
                  moduleItem('nodics.commerce', 'Commerce', {
                    registrationState: 'AVAILABLE',
                  }),
                ],
          }),
        );
      }
      registeredReads++;
      return Promise.resolve(
        response({
          items: registered ? [moduleItem('nodics.commerce', 'Commerce')] : [],
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Register' }));
    await screen.findByText(/Commerce is registered\. Registry data is refreshed/);
    const readsBefore = registeredReads;
    await userEvent.click(await screen.findByRole('button', { name: 'Activate' }));
    await screen.findByText(/Catalogue revision conflict/);
    expect(
      screen.queryByText(/Commerce is registered\. Registry data is refreshed/),
    ).not.toBeInTheDocument();
    expect(activationRequests).toBe(1);
    expect(registeredReads).toBeGreaterThan(readsBefore);
  });
  it('explains each dependency blocker using backend reasons and recovery guidance', async () => {
    const blockedModule = {
      ...moduleItem('nodics.accelerators', 'Accelerators', {
        registrationState: 'AVAILABLE',
      }),
      activationData: {
        action: 'status',
        dryRun: false,
        executionMode: 'USER_TRIGGERED',
        readiness: 'BLOCKED',
        preflight: {
          runtimeActive: true,
          registered: false,
          protectedModule: false,
          dependencies: ['nodics.commerce', 'nodics.discovery'],
          missingDependencies: ['nodics.commerce', 'nodics.discovery'],
          blockedReasons: [],
          dependencyStates: [
            {
              functionalModule: 'nodics.commerce',
              displayName: 'Commerce',
              registrationState: 'AVAILABLE',
              enabled: false,
              runtimeState: 'ACTIVE',
              satisfied: false,
              reason: 'Commerce is not registered.',
              resolution: 'Register and activate Commerce.',
            },
            {
              functionalModule: 'nodics.discovery',
              displayName: 'Discovery',
              registrationState: 'REGISTERED',
              enabled: false,
              runtimeState: 'ACTIVE',
              satisfied: false,
              reason: 'Discovery is registered but not activated.',
              resolution: 'Activate Discovery.',
            },
          ],
        },
        packages: [],
        receipts: [],
        nextActions: [],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) =>
        Promise.resolve(
          response({
            items: urlOf(input).includes('/runtime/modules/available')
              ? [blockedModule]
              : [],
          }),
        ),
      ),
    );
    renderPage();
    await screen.findByText('Accelerators');
    await userEvent.click(screen.getByRole('button', { name: 'Expand Accelerators' }));
    expect(screen.getByText('Commerce is not registered.')).toBeInTheDocument();
    expect(screen.getByText('Register and activate Commerce.')).toBeInTheDocument();
    expect(
      screen.getByText('Discovery is registered but not activated.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Activate Discovery.')).toBeInTheDocument();
    expect(screen.getByText('Readiness: BLOCKED')).toBeInTheDocument();
    expect(screen.queryByText('Readiness: READY')).not.toBeInTheDocument();
    expect(screen.queryByText(/Activation is waiting for/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument();
  });
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
