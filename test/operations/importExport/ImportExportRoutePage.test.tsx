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
  environments: ['kickoffLocal'],
  moduleCatalog: {},
  moduleConnections: {
    import: [
      {
        moduleName: 'import',
        instanceId: 'kickoffLocal:wcmsOnlineServer:import:0',
        endpoint: 'http://localhost:4314/nodics/import',
        environment: 'kickoffLocal',
        server: 'wcmsOnlineServer',
        runtimeRole: { code: 'WCMS_ONLINE', publication: 'ONLINE' },
        state: 'UP',
      },
      {
        moduleName: 'import',
        instanceId: 'kickoffLocal:wcmsStagedServer:import:0',
        endpoint: 'http://localhost:4312/nodics/import',
        environment: 'kickoffLocal',
        server: 'wcmsStagedServer',
        runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
        state: 'UP',
      },
      {
        moduleName: 'import',
        instanceId: 'kickoffLocal:processServer:import:0',
        endpoint: 'http://localhost:4330/nodics/import',
        environment: 'kickoffLocal',
        server: 'processServer',
        runtimeRole: { code: 'PROCESS', publication: 'PROCESS' },
        state: 'UP',
      },
    ],
    media: [
      {
        moduleName: 'media',
        instanceId: 'kickoffLocal:monoServer:media:0',
        endpoint: 'http://localhost:3000/nodics/media',
        environment: 'kickoffLocal',
        state: 'UP',
      },
    ],
    system: [
      {
        moduleName: 'system',
        instanceId: 'kickoffLocal:monoServer:system:0',
        endpoint: 'http://localhost:3000/nodics/system',
        environment: 'kickoffLocal',
        state: 'UP',
      },
    ],
    profile: [
      {
        moduleName: 'profile',
        instanceId: 'kickoffLocal:monoServer:profile:0',
        endpoint: 'http://localhost:3000/nodics/profile',
        environment: 'kickoffLocal',
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
  parentModule: 'nodics.platform',
  canonicalIdentity: 'nodics.cron/modules/cronjob',
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

    expect(window.location.search).toBe('?area=init');

    await user.click(screen.getByRole('tab', { name: 'Guided setup' }));
    expect(window.location.search).toBe('');
  });

  it('validates and initializes a backend-owned guided profile on Staged', async () => {
    const pendingRelease = {
      ...currentRelease,
      dataType: 'init',
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    };
    const profile = {
      profileCode: 'localWcmsFoundation',
      label: 'Local WCMS foundation',
      description: 'Install the Local content foundation.',
      completionMessage: 'The Staged content foundation is ready.',
      destinationRole: 'STAGED',
      status: 'ACTION_REQUIRED',
      blocked: false,
      steps: [{ order: 1, dataType: 'init', releases: [pendingRelease] }],
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/initialization-profiles'))
        return Promise.resolve(jsonResponse([profile]));
      if (url.endsWith('/initialization-profiles/localWcmsFoundation/validate')) {
        return Promise.resolve(
          jsonResponse({ profileCode: profile.profileCode, mode: 'VALIDATE', profile }),
        );
      }
      if (url.endsWith('/init') || url.endsWith('/core') || url.endsWith('/sample'))
        return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Local WCMS foundation')).toBeVisible();
    expect(screen.getByText('Target STAGED')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Validate plan' }));
    expect(
      await screen.findByText(/backend validated the immutable initialization plan/iu),
    ).toBeVisible();
    const call = fetchMock.mock.calls.find(([input]) =>
      fetchInputUrl(input).endsWith(
        '/initialization-profiles/localWcmsFoundation/validate',
      ),
    );
    expect(call?.[1]?.method).toBe('POST');
    expect(
      fetchMock.mock.calls.some(([input]) =>
        fetchInputUrl(input).startsWith('http://localhost:4314/'),
      ),
    ).toBe(false);
  });

  it('shows a guided installation failure and allows a successful retry', async () => {
    const pendingRelease = {
      ...currentRelease,
      dataType: 'init',
      status: 'FAILED',
      installedVersion: undefined,
    };
    const pendingProfile = {
      profileCode: 'localWcmsFoundation',
      label: 'Local WCMS foundation',
      description: 'Install the Local content foundation.',
      completionMessage: 'The Staged content foundation is ready.',
      destinationRole: 'STAGED',
      status: 'ACTION_REQUIRED',
      blocked: false,
      steps: [{ order: 1, dataType: 'init', releases: [pendingRelease] }],
    };
    const currentProfile = {
      ...pendingProfile,
      status: 'CURRENT',
      steps: [
        {
          order: 1,
          dataType: 'init',
          releases: [
            { ...pendingRelease, status: 'CURRENT', installedVersion: '1.0.0' },
          ],
        },
      ],
    };
    let attempts = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/initialization-profiles'))
        return Promise.resolve(jsonResponse([pendingProfile]));
      if (url.endsWith('/initialization-profiles/localWcmsFoundation/install')) {
        attempts += 1;
        if (attempts === 1)
          return Promise.resolve(
            new Response(
              JSON.stringify({ message: 'Controlled initialization failure' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        return Promise.resolve(
          jsonResponse({
            profileCode: pendingProfile.profileCode,
            mode: 'INSTALL',
            profile: currentProfile,
          }),
        );
      }
      if (url.endsWith('/init') || url.endsWith('/core') || url.endsWith('/sample'))
        return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Local WCMS foundation');

    await user.click(screen.getByRole('button', { name: 'Validate and initialize' }));
    expect(await screen.findByText('Controlled initialization failure')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Validate and initialize' }));
    expect(
      await screen.findByText('The Staged content foundation is ready.'),
    ).toBeVisible();
    expect(attempts).toBe(2);
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
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          fetchInputUrl(input).startsWith('http://localhost:4312/nodics/import/'),
        ),
      ).toBe(true),
    );
    expect(
      fetchMock.mock.calls.some(([input]) =>
        fetchInputUrl(input).startsWith('http://localhost:4314/nodics/import/'),
      ),
    ).toBe(false);
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

  it('supports visible select and deselect controls for all data release tabs', async () => {
    const initRelease = {
      ...currentRelease,
      releaseCode: 'profile:init',
      displayName: 'Profile Foundation',
      dataType: 'init',
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    };
    const coreRelease = {
      ...currentRelease,
      releaseCode: 'profile:core',
      displayName: 'Profile Core',
      dataType: 'core',
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    };
    const sampleRelease = {
      ...currentRelease,
      releaseCode: 'profile:sample',
      displayName: 'Profile Sample',
      dataType: 'sample',
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/init')) return Promise.resolve(jsonResponse([initRelease]));
      if (url.endsWith('/core')) return Promise.resolve(jsonResponse([coreRelease]));
      if (url.endsWith('/sample'))
        return Promise.resolve(jsonResponse([sampleRelease]));
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Initialization data' }));
    await user.click(screen.getByRole('button', { name: 'Select all visible' }));
    expect(
      screen.getByRole('checkbox', { name: 'Select Profile Foundation' }),
    ).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Deselect all visible' }));
    expect(
      screen.getByRole('checkbox', { name: 'Select Profile Foundation' }),
    ).not.toBeChecked();

    await user.click(screen.getByRole('tab', { name: 'Core data' }));
    await user.click(await screen.findByRole('button', { name: 'Select all visible' }));
    expect(screen.getByRole('checkbox', { name: 'Select Profile Core' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Deselect all visible' }));
    expect(
      screen.getByRole('checkbox', { name: 'Select Profile Core' }),
    ).not.toBeChecked();

    await user.click(screen.getByRole('tab', { name: 'Sample data' }));
    await user.click(await screen.findByRole('button', { name: 'Select all visible' }));
    expect(
      screen.getByRole('checkbox', { name: 'Select Profile Sample' }),
    ).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Deselect all visible' }));
    expect(
      screen.getByRole('checkbox', { name: 'Select Profile Sample' }),
    ).not.toBeChecked();
  });

  it('selects same-module data release sections independently', async () => {
    const cmsFoundation = {
      ...currentRelease,
      releaseCode: 'cms:init',
      sectionCode: 'init',
      moduleName: 'cms',
      displayName: 'CMS Foundation',
      dataType: 'init',
      version: '1.0.3',
      destinationRole: 'WCMS_STAGED',
      status: 'CURRENT',
      installedVersion: '1.0.3',
    };
    const cmsApproval = {
      ...currentRelease,
      releaseCode: 'cms:cmsPublicationApproval',
      sectionCode: 'cmsPublicationApproval',
      moduleName: 'cms',
      displayName: 'CMS Publication Approval Workflow',
      dataType: 'init',
      version: '1.0.0',
      destinationRole: 'PROCESS',
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url === 'http://localhost:4330/nodics/import/v0/init/validate') {
        return Promise.resolve(
          jsonResponse({
            dataType: 'init',
            tenant: 'default',
            releases: [cmsApproval],
          }),
        );
      }
      if (url === 'http://localhost:4312/nodics/import/v0/init/validate') {
        return Promise.resolve(
          jsonResponse({
            dataType: 'init',
            tenant: 'default',
            releases: [cmsFoundation],
          }),
        );
      }
      if (url.endsWith('/init'))
        return Promise.resolve(jsonResponse([cmsApproval, cmsFoundation]));
      if (url.endsWith('/core') || url.endsWith('/sample')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Initialization data' }));
    const approvalCheckbox = await screen.findByRole('checkbox', {
      name: 'Select CMS Publication Approval Workflow',
    });
    const foundationCheckbox = screen.getByRole('checkbox', {
      name: 'Select CMS Foundation',
    });

    await user.click(approvalCheckbox);

    expect(approvalCheckbox).toBeChecked();
    expect(foundationCheckbox).not.toBeChecked();

    await user.click(foundationCheckbox);

    expect(approvalCheckbox).toBeChecked();
    expect(foundationCheckbox).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Validate selected' }));

    expect(
      await screen.findByText(
        '2 initialization data release(s) validated by the backend.',
      ),
    ).toBeVisible();
    const validateCalls = fetchMock.mock.calls.filter(([input]) =>
      fetchInputUrl(input).includes('/init/validate'),
    );
    expect(validateCalls.map(([input]) => fetchInputUrl(input as RequestInfo))).toEqual(
      [
        'http://localhost:4330/nodics/import/v0/init/validate',
        'http://localhost:4312/nodics/import/v0/init/validate',
      ],
    );
    expect(validateCalls[0]?.[1]?.body).toBe(
      JSON.stringify({
        dataType: 'init',
        releaseCodes: ['cms:cmsPublicationApproval'],
        expectedReleases: { 'cms:cmsPublicationApproval': '1.0.0' },
      }),
    );
    expect(validateCalls[1]?.[1]?.body).toBe(
      JSON.stringify({
        dataType: 'init',
        releaseCodes: ['cms:init'],
        expectedReleases: { 'cms:init': '1.0.3' },
      }),
    );
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
