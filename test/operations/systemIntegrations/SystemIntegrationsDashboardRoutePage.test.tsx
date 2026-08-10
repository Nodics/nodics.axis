import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../../src/bootstrap/publicBootstrap';
import { SystemIntegrationsDashboardRoutePage } from '../../../src/operations/systemIntegrations/SystemIntegrationsDashboardRoutePage';
import type { AxisRuntimeConfig } from '../../../src/runtime/runtimeConfig';

const clients = vi.hoisted(() => ({
  loadAvailableFunctionalModules: vi.fn(),
  loadModuleHealth: vi.fn(),
  loadRegisteredFunctionalModules: vi.fn(),
  loadWorkbenchSchemas: vi.fn(),
}));

vi.mock(
  '../../../src/operations/moduleRegistry/api/functionalModuleRegistryClient',
  () => ({
    loadAvailableFunctionalModules: clients.loadAvailableFunctionalModules,
    loadRegisteredFunctionalModules: clients.loadRegisteredFunctionalModules,
  }),
);
vi.mock('../../../src/operations/moduleHealth/api/moduleHealthClient', () => ({
  loadModuleHealth: clients.loadModuleHealth,
}));
vi.mock('../../../src/workbench/api/workbenchClient', () => ({
  loadWorkbenchSchemas: clients.loadWorkbenchSchemas,
}));

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

function navigationItem(
  id: string,
  label: string,
  route: string,
  featureState: AxisNavigationItem['featureState'] = 'ACTIVE',
): AxisNavigationItem {
  return {
    id,
    label,
    route,
    order: 100,
    moduleName: 'backoffice',
    category: 'operations',
    icon: 'module',
    availability: 'UP',
    featureState,
    group: { id: 'system-integrations', label: 'System & Integrations', order: 150 },
  };
}

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
    navigationItem('registry', 'Module Registry', '/registry'),
    navigationItem('module-health', 'Module Health', '/operations/module-health'),
    navigationItem(
      'imports-exports',
      'Imports and Exports',
      '/operations/imports-exports',
    ),
    navigationItem(
      'integrations',
      'Integrations',
      '/operations/integrations',
      'DISABLED',
    ),
    navigationItem('schema-workbench', 'Schema Workbench', '/schema-workbench'),
  ],
  environments: ['kickoffLocal'],
  moduleCatalog: {},
  moduleConnections: {
    backoffice: [
      {
        moduleName: 'backoffice',
        instanceId: 'platform-1',
        endpoint: 'http://localhost:4300/nodics/backoffice',
        environment: 'kickoffLocal',
        server: 'platformServer',
        state: 'UP',
      },
    ],
  },
  documentationSources: [],
  tenantCode: 'default',
};

function functionalModule(
  functionalModule: string,
  registrationState: 'AVAILABLE' | 'REGISTERED',
) {
  return {
    project: 'nodics.kickoff',
    functionalModule,
    displayName: functionalModule,
    registrationState,
    enabled: registrationState === 'REGISTERED',
    required: false,
    runtimeState: 'ACTIVE' as const,
    technicalModules: [],
    observedServers: [],
    catalogueRevision: 1,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <AxisThemeProvider>
        <QueryClientProvider client={queryClient}>
          <SystemIntegrationsDashboardRoutePage
            accessToken="employee-token"
            bootstrap={bootstrap}
            runtime={runtime}
          />
        </QueryClientProvider>
      </AxisThemeProvider>
    </MemoryRouter>,
  );
}

describe('SystemIntegrationsDashboardRoutePage', () => {
  it('presents system, integration, and schema snapshots from backend-owned contracts', async () => {
    clients.loadModuleHealth.mockResolvedValue([
      {
        moduleName: 'backoffice',
        environments: ['kickoffLocal'],
        servers: ['platformServer'],
        availability: {
          state: 'UP',
          activeInstances: 2,
          healthyInstances: 2,
          unavailableInstances: 0,
          unknownInstances: 0,
        },
      },
    ]);
    clients.loadRegisteredFunctionalModules.mockResolvedValue([
      functionalModule('nodics.platform', 'REGISTERED'),
    ]);
    clients.loadAvailableFunctionalModules.mockResolvedValue([
      functionalModule('nodics.platform', 'AVAILABLE'),
      functionalModule('nodics.commerce', 'AVAILABLE'),
    ]);
    clients.loadWorkbenchSchemas.mockResolvedValue([
      {
        moduleName: 'profile',
        schemaName: 'employee',
        label: 'Employee',
        description: 'Employee records',
        displayProperty: 'code',
        displayProperties: ['code'],
        queryCapabilities: {
          searchableFields: ['code'],
          sortableFields: ['code'],
          filterFields: [],
          groupOperators: ['AND'],
          textOperator: 'CONTAINS',
          allowedPageSizes: [20],
          defaultPageSize: 20,
          maximumPageSize: 100,
          defaultSort: { field: 'code', direction: 'ASC' },
        },
        mutationMode: 'GENERATED_CRUD',
        operations: ['search', 'read', 'create'],
        fields: [],
        relationships: [],
      },
      {
        moduleName: 'profile',
        schemaName: 'address',
        label: 'Address',
        description: 'Address records',
        displayProperty: 'code',
        displayProperties: ['code'],
        queryCapabilities: {
          searchableFields: ['code'],
          sortableFields: ['code'],
          filterFields: [],
          groupOperators: ['AND'],
          textOperator: 'CONTAINS',
          allowedPageSizes: [20],
          defaultPageSize: 20,
          maximumPageSize: 100,
          defaultSort: { field: 'code', direction: 'ASC' },
        },
        mutationMode: 'DOMAIN_OPERATION',
        operations: ['search', 'read'],
        fields: [],
        relationships: [],
      },
    ]);

    renderPage();

    const system = await screen.findByRole('heading', { name: 'System Workspace' });
    const systemSection = system.closest('section');
    expect(systemSection).not.toBeNull();
    const pendingRegistration = within(systemSection!).getByText(
      'Pending registration',
    );
    await waitFor(() =>
      expect(
        within(pendingRegistration.closest('article')!).getByText('1'),
      ).toBeVisible(),
    );
    expect(
      within(systemSection!).getByRole('link', { name: 'Module Registry' }),
    ).toBeVisible();

    const integration = screen.getByRole('heading', {
      name: 'Integration Workspace',
    });
    const integrationSection = integration.closest('section');
    expect(integrationSection).not.toBeNull();
    expect(
      within(integrationSection!).getByRole('link', { name: 'Imports and Exports' }),
    ).toBeVisible();
    expect(
      within(integrationSection!).queryByRole('button', { name: 'Integrations' }),
    ).not.toBeInTheDocument();
    expect(within(integrationSection!).getByText('1 planned')).toBeVisible();

    const schema = screen.getByRole('heading', { name: 'Schema Workspace' });
    const schemaSection = schema.closest('section');
    expect(schemaSection).not.toBeNull();
    expect(within(schemaSection!).getByText('Available schemas')).toBeVisible();
    expect(within(schemaSection!).getByText('profile · 2')).toBeVisible();
    expect(
      within(schemaSection!).getByRole('link', { name: 'Schema Workbench' }),
    ).toBeVisible();
  });

  it('keeps schema discovery failure isolated from system metrics', async () => {
    clients.loadModuleHealth.mockResolvedValue([]);
    clients.loadRegisteredFunctionalModules.mockResolvedValue([]);
    clients.loadAvailableFunctionalModules.mockResolvedValue([]);
    clients.loadWorkbenchSchemas.mockRejectedValue(
      new Error('Authorized schema discovery is currently unavailable'),
    );

    renderPage();

    expect(await screen.findByText('Runtime servers')).toBeVisible();
    expect(
      await screen.findByText('Authorized schema discovery is currently unavailable'),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Integration Workspace' }),
    ).toBeVisible();
  });
});
