import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import type { AxisAuthenticatedBootstrap } from '../../../src/bootstrap/publicBootstrap';
import { ImportExportRoutePage } from '../../../src/operations/importExport/ImportExportRoutePage';
import type { AxisRuntimeConfig } from '../../../src/runtime/runtimeConfig';

const runtime: AxisRuntimeConfig = {
  backofficeBaseUrl: 'http://localhost:3000',
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
  navigation: [],
  environments: ['startioLocal'],
  moduleCatalog: {},
  moduleConnections: {
    import: [
      {
        moduleName: 'import',
        instanceId: 'startioLocal:monoServer:import:0',
        endpoint: 'http://localhost:3000/nodics/import',
        environment: 'startioLocal',
        state: 'UP',
      },
    ],
    media: [
      {
        moduleName: 'media',
        instanceId: 'startioLocal:monoServer:media:0',
        endpoint: 'http://localhost:3000/nodics/media',
        environment: 'startioLocal',
        state: 'UP',
      },
    ],
    system: [
      {
        moduleName: 'system',
        instanceId: 'startioLocal:monoServer:system:0',
        endpoint: 'http://localhost:3000/nodics/system',
        environment: 'startioLocal',
        state: 'UP',
      },
    ],
    profile: [
      {
        moduleName: 'profile',
        instanceId: 'startioLocal:monoServer:profile:0',
        endpoint: 'http://localhost:3000/nodics/profile',
        environment: 'startioLocal',
        state: 'UP',
      },
    ],
  },
  documentationSources: [],
  tenantCode: 'default',
};

const currentRelease = {
  moduleName: 'cronjob',
  displayName: 'Scheduled Jobs',
  parentModule: 'gCore',
  canonicalIdentity: 'gCore/cronjob',
  dataType: 'core',
  version: '1.0.0',
  description: 'Scheduled Jobs core data',
  checksum: 'a'.repeat(64),
  installedVersion: '1.0.0',
  status: 'CURRENT',
};

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fetchInputUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ImportExportRoutePage
          accessToken="employee-token"
          bootstrap={bootstrap}
          runtime={runtime}
        />
      </QueryClientProvider>
    </AxisThemeProvider>,
  );
}

const tenantSchema = {
  moduleName: 'profile',
  schemaName: 'tenant',
  label: 'Tenant',
  description: 'Tenant records',
  displayProperty: 'code',
  displayProperties: ['code', 'description'],
  queryCapabilities: {
    searchableFields: ['code', 'description'],
    sortableFields: ['code'],
    filterFields: [],
    groupOperators: ['AND'],
    textOperator: 'CONTAINS',
    allowedPageSizes: [10, 25],
    defaultPageSize: 10,
    maximumPageSize: 25,
    defaultSort: { field: 'code', direction: 'ASC' },
  },
  mutationMode: 'GENERATED_CRUD',
  operations: ['search', 'read', 'create', 'update'],
  fields: [
    {
      name: 'code',
      label: 'Code',
      type: 'string',
      required: true,
      readOnly: false,
      primary: true,
      description: '',
      searchable: true,
    },
  ],
  relationships: [],
};

const addressSchema = {
  ...tenantSchema,
  schemaName: 'address',
  label: 'Address',
  description: 'Address records',
};

describe('ImportExportRoutePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('opens the requested import-export area from URL state and preserves tab changes', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.includes('/schema/workbench')) {
        return Promise.resolve(
          jsonResponse({
            schemas: [tenantSchema],
          }),
        );
      }
      if (url.endsWith('/core')) return Promise.resolve(jsonResponse([currentRelease]));
      if (url.endsWith('/init') || url.endsWith('/sample')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    window.history.replaceState({}, '', '/operations/import-export?area=exports');
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('2. Choose export model')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Exports' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.click(screen.getByRole('tab', { name: 'File imports' }));

    expect(window.location.search).toBe('?area=file-imports');
    expect(await screen.findByText('2. Choose target model')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Initialization data' }));

    expect(window.location.search).toBe('');
  });

  it('validates current releases without enabling no-op installation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.includes('/core/validate')) {
        return Promise.resolve(
          jsonResponse({
            dataType: 'core',
            tenant: 'default',
            releases: [currentRelease],
          }),
        );
      }
      if (url.endsWith('/core')) return Promise.resolve(jsonResponse([currentRelease]));
      if (url.endsWith('/init') || url.endsWith('/sample')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Core data' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Scheduled Jobs' }));

    expect(screen.getByText(/Selected releases are already current/iu)).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Install or update selected' }),
    ).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Validate selected' }));

    expect(
      await screen.findByText(
        /validated\. Everything is already current; no import or update was required/iu,
      ),
    ).toBeVisible();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        fetchInputUrl(input).includes('/core/validate'),
      ),
    ).toBe(true);
    fetchMock.mockRestore();
  });

  it('renders backend-owned generic file import workflow from discovered schemas', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.includes('/schema/workbench')) {
        return Promise.resolve(
          jsonResponse({
            schemas: [tenantSchema],
          }),
        );
      }
      if (url.endsWith('/core')) return Promise.resolve(jsonResponse([currentRelease]));
      if (url.endsWith('/init') || url.endsWith('/sample')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'File imports' }));

    expect(await screen.findByText('1. Confirm target destination')).toBeVisible();
    expect(screen.getByText('2. Choose target model')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Target model' })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: 'Target enterprise' })).toBeVisible();
    expect(screen.getByText('Technical tenant')).toBeVisible();
    expect(screen.getByText('default')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choose file' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Validate file import' })).toBeDisabled();
  });

  it('enables file validation only after explicit target model selection', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.includes('/schema/workbench')) {
        return Promise.resolve(
          jsonResponse({
            schemas: [addressSchema, tenantSchema],
          }),
        );
      }
      if (url.includes('/storage/upload')) {
        return Promise.resolve(
          jsonResponse({
            code: 'defaultTenantCsvData-b0fbbb7114896806',
            name: 'defaultTenantCsvData.csv',
            originalFileName: 'defaultTenantCsvData.csv',
            sizeBytes: 679,
            status: 'READY',
          }),
        );
      }
      if (url.endsWith('/core')) return Promise.resolve(jsonResponse([currentRelease]));
      if (url.endsWith('/init') || url.endsWith('/sample')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    const rendered = renderPage();
    await user.click(await screen.findByRole('tab', { name: 'File imports' }));
    expect(await screen.findByRole('combobox', { name: 'Target model' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Choose file' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await user.click(screen.getByRole('combobox', { name: 'Target model' }));
    await user.click(await screen.findByText('Tenant records'));
    expect(screen.getByText('Schema: tenant')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choose file' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );

    const input = rendered.container.querySelector('input[type="file"]');
    expect(input).toBeInstanceOf(HTMLInputElement);
    await user.upload(
      input as HTMLInputElement,
      new File(['code,description\none,One'], 'defaultTenantCsvData.csv', {
        type: 'text/csv',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Upload to media' }));

    await waitFor(() =>
      expect(
        screen.getByText('Media: defaultTenantCsvData-b0fbbb7114896806'),
      ).toBeVisible(),
    );
    expect(screen.getByRole('button', { name: 'Validate file import' })).toBeEnabled();

    await user.click(
      screen.getByRole('button', { name: 'Remove selected import file' }),
    );

    expect(
      screen.queryByText('Media: defaultTenantCsvData-b0fbbb7114896806'),
    ).toBeNull();
    expect(screen.getByText('No file selected')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Validate file import' })).toBeDisabled();

    vi.restoreAllMocks();
  });
});
