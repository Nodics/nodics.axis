import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
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
    contractVersion: 0,
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

function renderPage(overrides: Partial<AxisAuthenticatedBootstrap> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const effectiveBootstrap = {
    ...bootstrap,
    ...overrides,
    moduleConnections: {
      ...bootstrap.moduleConnections,
      ...(overrides.moduleConnections ?? {}),
    },
  };
  return render(
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ImportExportRoutePage
          accessToken="employee-token"
          bootstrap={effectiveBootstrap}
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

  it('shows current releases as audit-only without enabling no-op actions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
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
    expect(screen.getByText('Version 1.0.0')).toBeVisible();
    expect(screen.queryByText('Available 1.0.0')).not.toBeInTheDocument();
    expect(screen.queryByText('Installed 1.0.0')).not.toBeInTheDocument();
    expect(screen.getByText('Installed / already current')).toBeVisible();
    expect(screen.queryByText('Collapse')).not.toBeInTheDocument();
    const currentGroupToggle = screen.getByRole('button', {
      name: /Installed \/ already current/iu,
    });
    expect(currentGroupToggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(currentGroupToggle);
    expect(currentGroupToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Version 1.0.0')).not.toBeInTheDocument();
    await user.click(currentGroupToggle);
    expect(currentGroupToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Version 1.0.0')).toBeVisible();
    expect(
      screen.getByRole('checkbox', { name: 'Scheduled Jobs is already current' }),
    ).toBeDisabled();
    expect(screen.getByText('0 of 0 actionable release(s) selected')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Validate selected' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Install or update selected' }),
    ).toBeDisabled();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        fetchInputUrl(input).includes('/core/validate'),
      ),
    ).toBe(false);
    fetchMock.mockRestore();
  });

  it('shows available and installed versions only when they differ', async () => {
    const updateRelease = {
      ...currentRelease,
      releaseCode: 'cronjob:core',
      version: '1.1.0',
      installedVersion: '1.0.0',
      status: 'UPDATE_AVAILABLE',
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/core')) return Promise.resolve(jsonResponse([updateRelease]));
      if (url.endsWith('/init') || url.endsWith('/sample')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Core data' }));

    expect(await screen.findByText('Available to install or update')).toBeVisible();
    expect(await screen.findByText('Available 1.1.0')).toBeVisible();
    expect(screen.getByText('Installed 1.0.0')).toBeVisible();
    const availableGroupToggle = screen.getByRole('button', {
      name: /Available to install or update/iu,
    });
    expect(availableGroupToggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(availableGroupToggle);
    expect(availableGroupToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Available 1.1.0')).not.toBeInTheDocument();
    expect(screen.queryByText('Installed 1.0.0')).not.toBeInTheDocument();
    await user.click(availableGroupToggle);
    expect(availableGroupToggle).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText('Available 1.1.0')).toBeVisible();
    expect(screen.getByText('Installed 1.0.0')).toBeVisible();
  });

  it('shows selected data release operation errors inside the action footer', async () => {
    const updateRelease = {
      ...currentRelease,
      releaseCode: 'cronjob:core',
      version: '1.1.0',
      installedVersion: '1.0.0',
      status: 'UPDATE_AVAILABLE',
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/core')) return Promise.resolve(jsonResponse([updateRelease]));
      if (url.endsWith('/core/validate')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              message: 'Controlled backend validation failure',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (url.endsWith('/init') || url.endsWith('/sample')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Core data' }));
    await user.click(
      await screen.findByRole('checkbox', {
        name: 'Select all actionable releases',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Validate selected' }));

    const footer = await screen.findByRole('region', {
      name: 'Core data action footer',
    });
    expect(
      await within(footer).findByText('Controlled backend validation failure'),
    ).toBeVisible();
  });

  it('validates Platform-targeted releases through the configured Platform import endpoint', async () => {
    const platformRelease = {
      ...currentRelease,
      releaseCode: 'catalog:init',
      displayName: 'Catalog Framework',
      dataType: 'init',
      destinationRole: 'PLATFORM',
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/init'))
        return Promise.resolve(jsonResponse([platformRelease]));
      if (url === 'http://localhost:3000/nodics/import/v0/init/validate') {
        return Promise.resolve(
          jsonResponse({
            dataType: 'init',
            tenant: 'default',
            releases: [platformRelease],
          }),
        );
      }
      if (url.endsWith('/core') || url.endsWith('/sample')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Initialization data' }));
    await user.click(
      await screen.findByRole('checkbox', {
        name: 'Select Catalog Framework',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Validate selected' }));

    expect(
      await screen.findByText(
        '1 initialization data release(s) validated by the backend.',
      ),
    ).toBeVisible();
    const validateCalls = fetchMock.mock.calls.filter(([input]) =>
      fetchInputUrl(input).includes('/init/validate'),
    );
    expect(validateCalls.map(([input]) => fetchInputUrl(input as RequestInfo))).toEqual(
      ['http://localhost:3000/nodics/import/v0/init/validate'],
    );
  });

  it('uses destination runtime catalogue status for Platform releases', async () => {
    const stagedProjection = {
      ...currentRelease,
      releaseCode: 'catalog:init',
      displayName: 'Catalog Framework',
      dataType: 'init',
      destinationRole: 'PLATFORM',
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    };
    const platformProjection = {
      ...stagedProjection,
      status: 'CURRENT',
      installedVersion: '1.0.3',
      version: '1.0.3',
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url === 'http://localhost:4312/nodics/import/v0/init') {
        return Promise.resolve(jsonResponse([stagedProjection]));
      }
      if (url === 'http://localhost:3000/nodics/import/v0/init') {
        return Promise.resolve(jsonResponse([platformProjection]));
      }
      if (url.endsWith('/init') || url.endsWith('/core') || url.endsWith('/sample')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Initialization data' }));

    expect(await screen.findByText('Installed / already current')).toBeVisible();
    expect(screen.getByText('Catalog Framework')).toBeVisible();
    expect(screen.getByText('Version 1.0.3')).toBeVisible();
    expect(
      screen.getByRole('checkbox', {
        name: 'Catalog Framework is already current',
      }),
    ).toBeDisabled();
    expect(
      screen.queryByText('Available to install or update'),
    ).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([input]) =>
          fetchInputUrl(input) === 'http://localhost:3000/nodics/import/v0/init',
      ),
    ).toBe(true);
  });

  it('does not query online runtimes for import release discovery', async () => {
    const platformProjection = {
      ...currentRelease,
      releaseCode: 'catalog:init',
      displayName: 'Catalog Framework',
      dataType: 'init',
      destinationRole: 'PLATFORM',
      status: 'CURRENT',
      installedVersion: '1.0.3',
      version: '1.0.3',
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url === 'http://localhost:4314/nodics/import/v0/init') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              message:
                'Access denied: API category is disabled for this runtime: dataImport',
            }),
            { status: 403, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (url === 'http://localhost:3000/nodics/import/v0/init') {
        return Promise.resolve(jsonResponse([platformProjection]));
      }
      if (url.endsWith('/init') || url.endsWith('/core') || url.endsWith('/sample')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Initialization data' }));

    expect(await screen.findByText('Catalog Framework')).toBeVisible();
    expect(screen.getByText('Version 1.0.3')).toBeVisible();
    expect(
      screen.queryByText(/API category is disabled for this runtime/iu),
    ).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([input]) =>
          fetchInputUrl(input) === 'http://localhost:4314/nodics/import/v0/init',
      ),
    ).toBe(false);
  });

  it('preserves selected releases after validation so the user can install next', async () => {
    const updateRelease = {
      ...currentRelease,
      releaseCode: 'cronjob:core',
      version: '1.0.3',
      installedVersion: undefined,
      status: 'NOT_INSTALLED',
    };
    const currentAfterValidation = {
      ...updateRelease,
      installedVersion: '1.1.0',
      status: 'CURRENT',
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/core')) {
        return Promise.resolve(jsonResponse([updateRelease]));
      }
      if (url.endsWith('/core/validate')) {
        return Promise.resolve(
          jsonResponse({
            dataType: 'core',
            tenant: 'default',
            releases: [currentAfterValidation],
          }),
        );
      }
      if (url.endsWith('/init') || url.endsWith('/sample')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Core data' }));
    await user.click(
      await screen.findByRole('checkbox', {
        name: 'Select Scheduled Jobs',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Validate selected' }));

    expect(
      await screen.findByText(
        '1 core data release(s) validated. Everything is already current; no import or update was required.',
      ),
    ).toBeVisible();
    expect(
      await screen.findByRole('checkbox', {
        name: 'Select Scheduled Jobs',
      }),
    ).toBeChecked();
    expect(screen.getByText('1 of 1 actionable release(s) selected')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Validate selected' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Install or update selected' }),
    ).toBeEnabled();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        fetchInputUrl(input).includes('/core/install'),
      ),
    ).toBe(false);
  });

  it('groups invalid releases as repair-required and keeps them non-selectable', async () => {
    const invalidRelease = {
      ...currentRelease,
      releaseCode: 'agoraCustomerReview:sample',
      displayName: 'Agora Customer Review Source',
      dataType: 'sample',
      description:
        'This data release manifest is invalid and must be repaired before it can be validated or installed.',
      invalidReason:
        'Invalid operation request: Publishable data must target a Staged runtime with immutable, administrator-initiated publication semantics',
      installedVersion: undefined,
      status: 'INVALID_RELEASE',
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/sample'))
        return Promise.resolve(jsonResponse([invalidRelease]));
      if (url.endsWith('/init') || url.endsWith('/core')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Sample data' }));

    expect(await screen.findByText('Requires repair')).toBeVisible();
    expect(screen.getByText(/Repair the owning module data release/iu)).toBeVisible();
    expect(screen.getByText('Agora Customer Review Source')).toBeVisible();
    expect(
      screen.getByText(/Publishable data must target a Staged runtime/iu),
    ).toBeVisible();
    expect(
      screen.getByRole('checkbox', {
        name: 'Agora Customer Review Source has an invalid release manifest',
      }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Validate selected' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Install or update selected' }),
    ).toBeDisabled();
    const repairGroupToggle = screen.getByRole('button', {
      name: /Requires repair/iu,
    });
    await user.click(repairGroupToggle);
    expect(repairGroupToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Agora Customer Review Source')).not.toBeInTheDocument();
    await user.click(repairGroupToggle);
    expect(repairGroupToggle).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText('Agora Customer Review Source')).toBeVisible();
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
    expect(
      screen.getByRole('region', { name: 'Initialization data action footer' }),
    ).toBeVisible();
    expect(screen.getByText('Available to install or update')).toBeVisible();
    await user.click(
      screen.getByRole('checkbox', { name: 'Select all actionable releases' }),
    );
    expect(
      screen.getByRole('checkbox', { name: 'Select Profile Foundation' }),
    ).toBeChecked();
    await user.click(
      screen.getByRole('checkbox', { name: 'Select all actionable releases' }),
    );
    expect(
      screen.getByRole('checkbox', { name: 'Select Profile Foundation' }),
    ).not.toBeChecked();

    await user.click(screen.getByRole('tab', { name: 'Core data' }));
    expect(
      await screen.findByRole('region', { name: 'Core data action footer' }),
    ).toBeVisible();
    expect(screen.getByText('Available to install or update')).toBeVisible();
    await user.click(
      await screen.findByRole('checkbox', {
        name: 'Select all actionable releases',
      }),
    );
    expect(screen.getByRole('checkbox', { name: 'Select Profile Core' })).toBeChecked();
    await user.click(
      screen.getByRole('checkbox', { name: 'Select all actionable releases' }),
    );
    expect(
      screen.getByRole('checkbox', { name: 'Select Profile Core' }),
    ).not.toBeChecked();

    await user.click(screen.getByRole('tab', { name: 'Sample data' }));
    expect(
      await screen.findByRole('region', { name: 'Sample data action footer' }),
    ).toBeVisible();
    expect(screen.getByText('Available to install or update')).toBeVisible();
    await user.click(
      await screen.findByRole('checkbox', {
        name: 'Select all actionable releases',
      }),
    );
    expect(
      screen.getByRole('checkbox', { name: 'Select Profile Sample' }),
    ).toBeChecked();
    await user.click(
      screen.getByRole('checkbox', { name: 'Select all actionable releases' }),
    );
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
      name: 'CMS Foundation is already current',
    });

    await user.click(approvalCheckbox);

    expect(approvalCheckbox).toBeChecked();
    expect(foundationCheckbox).not.toBeChecked();

    expect(approvalCheckbox).toBeChecked();
    expect(foundationCheckbox).not.toBeChecked();
    expect(foundationCheckbox).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Validate selected' }));

    expect(
      await screen.findByText(
        '1 initialization data release(s) validated by the backend.',
      ),
    ).toBeVisible();
    const validateCalls = fetchMock.mock.calls.filter(([input]) =>
      fetchInputUrl(input).includes('/init/validate'),
    );
    expect(validateCalls.map(([input]) => fetchInputUrl(input as RequestInfo))).toEqual(
      ['http://localhost:4330/nodics/import/v0/init/validate'],
    );
    expect(validateCalls[0]?.[1]?.body).toBe(
      JSON.stringify({
        dataType: 'init',
        releaseCodes: ['cms:cmsPublicationApproval'],
        expectedReleases: { 'cms:cmsPublicationApproval': '1.0.0' },
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

  it('shows export models when export and media services are environment-scoped', async () => {
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

    renderPage({
      moduleConnections: {
        ...bootstrap.moduleConnections,
        export: [
          {
            moduleName: 'export',
            instanceId: 'kickoffLocal:platformServer:export:0',
            endpoint: 'http://localhost:4300/nodics/export',
            environment: 'kickoffLocal',
            server: 'platformServer',
            runtimeRole: { code: 'PLATFORM', publication: 'OPERATIONAL' },
            state: 'UP',
          },
        ],
      },
    });

    await user.click(await screen.findByRole('combobox', { name: 'Export model' }));

    expect(await screen.findByText('Tenant records')).toBeVisible();
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
