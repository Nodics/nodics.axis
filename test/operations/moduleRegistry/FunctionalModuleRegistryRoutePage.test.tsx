import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../../src/bootstrap/publicBootstrap';
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
    runtimeObservations: [
      {
        observedServer: 'kickoffLocal:platformServer:default',
        environment: 'kickoffLocal',
        server: 'platformServer',
        node: 'default',
        lastObservedAt: '2026-08-28T12:00:00.000Z',
        reasonCode: 'RUNTIME_OBSERVED',
        recoveryAction: 'Runtime heartbeat is currently linked to this module.',
      },
    ],
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
  const page = (currentBootstrap = bootstrap, routeNavigation?: AxisNavigationItem) => (
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FunctionalModuleRegistryRoutePage
            accessToken="employee-token"
            bootstrap={currentBootstrap}
            routeNavigation={routeNavigation}
            runtime={runtime}
          />
        </MemoryRouter>
      </QueryClientProvider>
    </AxisThemeProvider>
  );
  const view = render(page());
  return {
    ...view,
    queryClient,
    refreshBootstrap: (
      current: AxisAuthenticatedBootstrap,
      navigation?: AxisNavigationItem,
    ) => view.rerender(page(current, navigation)),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});

describe('FunctionalModuleRegistryRoutePage', () => {
  it.each(['navigator', 'manager'])(
    'keeps %s-offline rows diagnostic and restores commands only after the existing reads recover',
    async (source) => {
      const fetch = vi.fn<typeof globalThis.fetch>((input) =>
        Promise.resolve(
          response({
            items: urlOf(input).includes('/runtime/modules/registrations')
              ? []
              : [moduleItem('nodics.commerce', 'Commerce')],
          }),
        ),
      );
      vi.stubGlobal('fetch', fetch);
      renderPage();
      await screen.findByText('Commerce');
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Select ready' })).toBeEnabled(),
      );
      const calls = fetch.mock.calls.length;
      const online = vi
        .spyOn(navigator, 'onLine', 'get')
        .mockReturnValue(source !== 'navigator');
      act(() => {
        onlineManager.setOnline(source !== 'manager');
        window.dispatchEvent(new Event('offline'));
      });
      expect(screen.getByText(/Axis is offline/)).toBeInTheDocument();
      expect(screen.getByText('Commerce')).toBeInTheDocument();
      expect(screen.getByText('Cached: Runtime connected')).toBeInTheDocument();
      expect(screen.getByText('Cached ready to enable')).toBeInTheDocument();
      expect(screen.getByText('Last reported readiness')).toBeInTheDocument();
      expect(
        screen.getByText('Last reported: 1 module ready to enable'),
      ).toBeInTheDocument();
      expect(screen.getByText('Cached: Ready to enable')).toBeInTheDocument();
      expect(
        screen.queryByText('Runtime and prerequisites ready'),
      ).not.toBeInTheDocument();
      expect(
        within(screen.getByLabelText('Registry overview')).getByText('Unknown'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Select ready' })).toBeDisabled();
      await userEvent.click(
        screen.getByRole('button', { name: 'Details for Commerce' }),
      );
      expect(screen.getByRole('button', { name: 'Activate' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
      expect(fetch).toHaveBeenCalledTimes(calls);
      online.mockReturnValue(true);
      act(() => {
        onlineManager.setOnline(true);
        window.dispatchEvent(new Event('online'));
      });
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Activate' })).toBeEnabled(),
      );
      expect(fetch.mock.calls.length).toBeGreaterThan(calls);
      expect(
        fetch.mock.calls.every(([, init]) => !init?.method || init.method === 'GET'),
      ).toBe(true);
      expect(screen.queryByText('Cached: Runtime connected')).not.toBeInTheDocument();
      expect(screen.queryByText('Cached ready to enable')).not.toBeInTheDocument();
      expect(screen.queryByText('Cached: Ready to enable')).not.toBeInTheDocument();
    },
  );

  it('disables an already open destructive confirmation when connectivity is lost, without replay on recovery', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>((input) =>
      Promise.resolve(
        response({
          items: urlOf(input).includes('/runtime/modules/registrations')
            ? [moduleItem('nodics.commerce', 'Commerce', { enabled: true })]
            : [],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    renderPage();
    await screen.findByText('Commerce');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Select ready' })).toBeDisabled(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Details for Commerce' }));
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const confirm = screen.getByRole('button', { name: 'Confirm deactivate' });
    expect(confirm).toBeEnabled();
    act(() => onlineManager.setOnline(false));
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(confirm).toBeEnabled());
    expect(
      fetch.mock.calls.every(([, init]) => !init?.method || init.method === 'GET'),
    ).toBe(true);
  });

  it('honors current route owner availability even when retained connections say UP, without dropping rows', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>((input) =>
      Promise.resolve(
        response({
          items: urlOf(input).includes('/runtime/modules/registrations')
            ? []
            : [moduleItem('nodics.commerce', 'Commerce')],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const view = renderPage();
    await screen.findByText('Commerce');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Select ready' })).toBeEnabled(),
    );
    const calls = fetch.mock.calls.length;
    const navigation: AxisNavigationItem = {
      ...bootstrap.navigation[0]!,
      id: 'registry',
      moduleName: 'backoffice',
      route: '/registry',
      availability: 'UNAVAILABLE',
    };
    view.refreshBootstrap(bootstrap, navigation);
    expect(screen.getByText(/Cached registry observations/)).toBeInTheDocument();
    expect(screen.getByText('Commerce')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select ready' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Runtime health/ }));
    expect(screen.getByText(/^Cached (READY|WARNING|BLOCKED)$/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(calls);
    view.refreshBootstrap(
      { ...bootstrap, moduleConnections: { backoffice: [] } },
      navigation,
    );
    expect(screen.getByText('Commerce')).toBeInTheDocument();
    view.refreshBootstrap(bootstrap, { ...navigation, availability: 'UP' });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Select ready' })).toBeEnabled(),
    );
    expect(
      fetch.mock.calls.every(([, init]) => !init?.method || init.method === 'GET'),
    ).toBe(true);
  });

  it('retains cached rows after a failed registry refresh and clears the stale warning on a successful read', async () => {
    let failed = false;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) =>
        failed
          ? Promise.reject(new TypeError('Failed to fetch'))
          : Promise.resolve(
              response({
                items: urlOf(input).includes('/runtime/modules/registrations')
                  ? []
                  : [moduleItem('nodics.commerce', 'Commerce')],
              }),
            ),
      ),
    );
    const view = renderPage();
    await screen.findByText('Commerce');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Select ready' })).toBeEnabled(),
    );
    failed = true;
    await act(() => view.queryClient.refetchQueries());
    expect(screen.getByText('Commerce')).toBeInTheDocument();
    await screen.findByText('Cached: Runtime connected');
    expect(screen.getByRole('button', { name: 'Select ready' })).toBeDisabled();
    failed = false;
    await act(() => view.queryClient.refetchQueries());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Select ready' })).toBeEnabled(),
    );
    expect(screen.queryByText(/Cached registry observations/)).not.toBeInTheDocument();
  });
  it('separates activated modules from pending and orders pending prerequisites first', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) =>
        Promise.resolve(
          response({
            items: urlOf(input).includes('/runtime/modules/available')
              ? [
                  moduleItem('nodics.platform', 'Platform', {
                    registrationState: 'AVAILABLE',
                  }),
                ]
              : [
                  moduleItem('nodics.docs', 'Documentation', { enabled: true }),
                  moduleItem('nodics.commerce', 'Commerce'),
                ],
          }),
        ),
      ),
    );
    renderPage();
    await screen.findByText('Commerce');
    const active = within(
      screen.getByRole('list', { name: 'Registered and activated' }),
    );
    const pending = within(screen.getByRole('list', { name: 'Pending' }));
    expect(pending.getByText('Depends on: Platform')).toBeInTheDocument();
    expect(pending.getAllByText('Runtime connected')).toHaveLength(2);
    expect(pending.getAllByText('Ready to enable')).toHaveLength(2);
    expect(active.getByText('Documentation')).toBeInTheDocument();
    expect(active.queryByText('Commerce')).not.toBeInTheDocument();
    expect(
      pending
        .getAllByRole('listitem')
        .map((row) => within(row).getByRole('button').getAttribute('aria-label')),
    ).toEqual(['Details for Platform', 'Details for Commerce']);
    expect(pending.queryByText('Documentation')).not.toBeInTheDocument();
  });
  it('refreshes after a rejected selection without retrying or losing the selection', async () => {
    let selectionRequests = 0;
    let catalogueReads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = urlOf(input);
        if (url.endsWith('/selection/apply')) {
          selectionRequests++;
          return Promise.resolve(
            new Response(JSON.stringify({ message: 'Catalogue revision conflict' }), {
              status: 400,
            }),
          );
        }
        catalogueReads++;
        return Promise.resolve(
          response({
            items: url.includes('/runtime/modules/available')
              ? [
                  moduleItem('nodics.commerce', 'Commerce', {
                    registrationState: 'AVAILABLE',
                  }),
                ]
              : [],
          }),
        );
      }),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole('checkbox', { name: 'Select Commerce' }),
    );
    const readsBefore = catalogueReads;
    await userEvent.click(screen.getByRole('button', { name: 'Enable selected (1)' }));
    await screen.findByText(/Catalogue revision conflict/);
    expect(selectionRequests).toBe(1);
    expect(catalogueReads).toBeGreaterThan(readsBefore);
    expect(screen.getByRole('checkbox', { name: 'Select Commerce' })).toBeChecked();
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
    expect(
      screen.getByRole('checkbox', { name: 'Select Accelerators' }),
    ).toBeDisabled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Details for Accelerators' }),
    );
    expect(screen.getAllByText('Commerce is not registered.')[0]).toBeInTheDocument();
    expect(
      screen.getAllByText('Register and activate Commerce.')[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Discovery is registered but not activated.')[0],
    ).toBeInTheDocument();
    expect(screen.getAllByText('Activate Discovery.')[0]).toBeInTheDocument();
    expect(screen.getByText('Readiness: BLOCKED')).toBeInTheDocument();
    expect(screen.queryByText('Readiness: READY')).not.toBeInTheDocument();
    expect(screen.queryByText(/Activation is waiting for/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument();
  });
  it('renders each module once, filters the list, and discloses diagnostics on demand', async () => {
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

    await screen.findByText('Commerce');
    expect(screen.getAllByText('Commerce')).toHaveLength(1);
    expect(screen.queryByText('Capability selection')).not.toBeInTheDocument();
    expect(screen.queryByText('Runtime smoke readiness')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Platform' })).toBeDisabled();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search modules' }),
      'Commerce',
    );
    expect(screen.queryByText('Documentation')).not.toBeInTheDocument();
    await userEvent.clear(screen.getByRole('textbox', { name: 'Search modules' }));
    expect(screen.getByText('Documentation')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Runtime health/ }));
    expect(screen.getByText('Data import runtime is unavailable')).toBeInTheDocument();
    expect(
      screen.getByText('Process approval runtime is unavailable'),
    ).toBeInTheDocument();
    expect(screen.getByText('Commerce data target is not visible')).toBeInTheDocument();
    expect(screen.getByText('Commerce')).toBeInTheDocument();
    expect(screen.queryByText('Registry identity')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Details for Commerce' }));
    expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument();

    expect(screen.getByText('Registry identity')).toBeInTheDocument();
    expect(screen.getByText('nodics.commerce')).toBeInTheDocument();
    expect(screen.getByText('Runtime observations')).toBeInTheDocument();
    expect(screen.getAllByText(/platformServer · node default/).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText('Data packages')).toBeInTheDocument();
  });

  it('explains no-runtime module state with shared capability readiness guidance', async () => {
    const offlineModule = {
      ...moduleItem('nodics.loyalty', 'Loyalty', {
        enabled: true,
        registrationState: 'REGISTERED',
      }),
      runtimeState: 'OFFLINE',
      observedServers: [],
      runtimeObservations: [],
      lastObservedAt: undefined,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) =>
        Promise.resolve(
          response({
            items: urlOf(input).includes('/runtime/modules/registrations')
              ? [offlineModule]
              : [],
          }),
        ),
      ),
    );

    renderPage();

    await screen.findByText('Loyalty');
    expect(screen.getByText('Runtime needs attention')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Details for Loyalty' }));
    expect(screen.getByText('No heartbeat')).toBeInTheDocument();
    expect(
      screen.getByText(/Start the owning runtime server, verify heartbeat evidence/iu),
    ).toBeInTheDocument();

    expect(screen.getByText('Capability readiness')).toBeInTheDocument();
    expect(screen.getByText('MODULE_RUNTIME_nodics.loyalty')).toBeInTheDocument();
    expect(screen.getByText('RUNTIME_HEARTBEAT')).toBeInTheDocument();
    expect(screen.getByText('Restore target runtime')).toBeInTheDocument();
    expect(
      screen.getAllByText(/runtime heartbeat evidence is missing or not active/)[0],
    ).toBeInTheDocument();
  });
});
