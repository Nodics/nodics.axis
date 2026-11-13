import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { BrowserRouter } from 'react-router';
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
  browserSessionTimeoutMs: 15_000,
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
  allowedActions: ['validate', 'install'],
  destinationRole: 'WCMS_STAGED',
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
  const page = (current: AxisAuthenticatedBootstrap, token = 'employee-token') => (
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ImportExportRoutePage
            accessToken={token}
            bootstrap={current}
            runtime={runtime}
          />
        </BrowserRouter>
      </QueryClientProvider>
    </AxisThemeProvider>
  );
  const rendered = render(page(effectiveBootstrap));
  return {
    ...rendered,
    refreshBootstrap: (next: AxisAuthenticatedBootstrap, token?: string) =>
      rendered.rerender(page(next, token)),
  };
}

function fileIntakeBootstrap(): AxisAuthenticatedBootstrap {
  const owner = bootstrap.moduleConnections.import![1]!;
  return {
    ...bootstrap,
    moduleConnections: {
      ...bootstrap.moduleConnections,
      system: [],
      profile: [
        {
          ...owner,
          moduleName: 'profile',
          instanceId: 'profile-owner',
          endpoint: 'http://localhost:4312/nodics/profile',
        },
      ],
      media: [
        {
          ...owner,
          moduleName: 'media',
          instanceId: 'media-owner',
          endpoint: 'http://localhost:4312/nodics/media',
        },
      ],
    },
  };
}

function renderFileIntakePage() {
  return renderPage(fileIntakeBootstrap());
}

function exportIntakeBootstrap(): AxisAuthenticatedBootstrap {
  const current = fileIntakeBootstrap();
  const owner = current.moduleConnections.profile![0]!;
  return {
    ...current,
    moduleConnections: {
      ...current.moduleConnections,
      export: [
        {
          ...owner,
          moduleName: 'export',
          instanceId: 'export-owner',
          endpoint: 'http://localhost:4312/nodics/export',
        },
      ],
    },
  };
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
  it('uses actual owner API eligibility and origin when a Cron release retains a different role label', async () => {
    const reminder = {
      ...currentRelease,
      releaseCode: 'digitalCore:couponReminderSchedule',
      moduleName: 'digitalCore',
      displayName: 'Coupon reminder schedule',
      dataType: 'init',
      destinationRole: 'CRON',
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    };
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url === 'http://localhost:4330/nodics/import/v0/init')
        return Promise.resolve(jsonResponse([reminder]));
      if (url === 'http://localhost:4330/nodics/import/v0/init/validate')
        return Promise.resolve(
          jsonResponse({ dataType: 'init', tenant: 'default', releases: [reminder] }),
        );
      return Promise.resolve(jsonResponse([]));
    });
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Initialization data' }));
    const checkbox = await screen.findByRole('checkbox', {
      name: 'Select Coupon reminder schedule',
    });
    expect(checkbox).toHaveAccessibleDescription('Runtime PROCESS · processServer');
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: 'Validate selected' }));
    expect(
      await screen.findByText(
        '1 initialization data release(s) validated by the backend.',
      ),
    ).toBeVisible();
    const posts = fetcher.mock.calls.filter(
      ([, options]) => options?.method === 'POST',
    );
    expect(posts).toHaveLength(1);
    expect(fetchInputUrl(posts[0]![0])).toBe(
      'http://localhost:4330/nodics/import/v0/init/validate',
    );
    expect(JSON.parse(posts[0]![1]!.body as string)).toEqual({
      dataType: 'init',
      releaseCodes: ['digitalCore:couponReminderSchedule'],
      expectedReleases: { 'digitalCore:couponReminderSchedule': '1.0.0' },
    });
  });

  it('keeps profiles without destination labels distinct at independent owner APIs', async () => {
    const profile = {
      profileCode: 'sharedFoundation',
      allowedActions: ['validate', 'install'],
      label: 'Shared foundation',
      description: 'Owner-hosted setup plan',
      completionMessage: 'Owner plan completed',
      status: 'ACTION_REQUIRED',
      blocked: false,
      steps: [
        {
          order: 1,
          dataType: 'init',
          releases: [
            {
              ...currentRelease,
              dataType: 'init',
              status: 'NOT_INSTALLED',
              installedVersion: undefined,
            },
          ],
        },
      ],
    };
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (
        [
          'http://localhost:4312/nodics/import/v0/initialization-profiles',
          'http://localhost:4330/nodics/import/v0/initialization-profiles',
        ].includes(url)
      )
        return Promise.resolve(jsonResponse([profile]));
      if (
        url ===
        'http://localhost:4330/nodics/import/v0/initialization-profiles/sharedFoundation/validate'
      )
        return Promise.resolve(
          jsonResponse({ profileCode: profile.profileCode, mode: 'VALIDATE', profile }),
        );
      return Promise.resolve(jsonResponse([]));
    });
    renderPage();
    const processCard = await screen.findByRole('region', {
      name: 'Shared foundation · Runtime PROCESS · processServer',
    });
    expect(
      screen.getByRole('region', {
        name: 'Shared foundation · Runtime WCMS_STAGED · wcmsStagedServer',
      }),
    ).toBeVisible();
    fireEvent.click(within(processCard).getByRole('button', { name: 'Validate plan' }));
    expect(
      await within(processCard).findByText(
        /backend validated the immutable initialization plan/,
      ),
    ).toBeVisible();
    expect(
      fetcher.mock.calls
        .filter(([, options]) => options?.method === 'POST')
        .map(([input]) => fetchInputUrl(input)),
    ).toEqual([
      'http://localhost:4330/nodics/import/v0/initialization-profiles/sharedFoundation/validate',
    ]);
  });

  it('discovers a recovered source without remounting and keeps unchanged sources cached', async () => {
    const staged = bootstrap.moduleConnections.import![1]!;
    const offline = {
      ...bootstrap,
      moduleConnections: {
        ...bootstrap.moduleConnections,
        import: [{ ...staged, state: 'UNAVAILABLE' as const }],
      },
    };
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) =>
        Promise.resolve(
          jsonResponse(
            fetchInputUrl(input) === 'http://localhost:4312/nodics/import/v0/core'
              ? [currentRelease]
              : [],
          ),
        ),
      );
    const page = renderPage(offline);
    fireEvent.click(screen.getByRole('tab', { name: 'Core data' }));
    expect(await screen.findByText(/Source coverage is incomplete/)).toBeVisible();
    expect(
      fetcher.mock.calls.some(([input]) => fetchInputUrl(input).includes(':4312')),
    ).toBe(false);
    const platformReads = () =>
      fetcher.mock.calls.filter(([input]) => fetchInputUrl(input).includes(':3000'))
        .length;
    await waitFor(() => expect(platformReads()).toBe(4));
    const recovered = {
      ...offline,
      moduleConnections: { ...offline.moduleConnections, import: [staged] },
    };
    page.refreshBootstrap(recovered);
    expect(
      await screen.findByRole('heading', { name: 'Scheduled Jobs' }),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByText(/Source coverage is incomplete/)).toBeNull(),
    );
    expect(platformReads()).toBe(4);
    const totalReads = fetcher.mock.calls.length;
    page.refreshBootstrap({
      ...recovered,
      moduleConnections: { ...recovered.moduleConnections, import: [{ ...staged }] },
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(totalReads);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh data' }));
    await waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThan(totalReads));
    expect(fetcher.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
      false,
    );
  });

  it('shows fresh healthy releases while another source is pending and never claims complete coverage', async () => {
    let finish: ((response: Response) => void) | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url === 'http://localhost:4312/nodics/import/v0/core')
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      return Promise.resolve(
        jsonResponse(
          url === 'http://localhost:4330/nodics/import/v0/core'
            ? [{ ...currentRelease, destinationRole: 'PROCESS' }]
            : [],
        ),
      );
    });
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Core data' }));
    expect(
      await screen.findByRole('heading', { name: 'Scheduled Jobs' }),
    ).toBeVisible();
    expect(screen.getByText('Incomplete catalogue')).toBeVisible();
    expect(screen.queryByText('100% current')).toBeNull();
    expect(screen.getByRole('button', { name: 'Refresh data' })).toBeDisabled();
    act(() => {
      finish!(new Response('{}', { status: 403 }));
    });
    expect(
      await screen.findByText(/Some information could not be verified/),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Scheduled Jobs' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Refresh data' })).toBeEnabled();
  });

  it.each(['actor', 'source'] as const)(
    'retires selected intent when the %s changes, including return to the original source',
    async (change) => {
      const pending = {
        ...currentRelease,
        status: 'NOT_INSTALLED',
        installedVersion: undefined,
      };
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input) =>
          Promise.resolve(
            jsonResponse(
              fetchInputUrl(input).endsWith(':4312/nodics/import/v0/core')
                ? [pending]
                : [],
            ),
          ),
        );
      const page = renderPage();
      fireEvent.click(screen.getByRole('tab', { name: 'Core data' }));
      fireEvent.click(
        await screen.findByRole('checkbox', { name: 'Select Scheduled Jobs' }),
      );
      expect(
        screen.getByRole('button', { name: 'Install or update selected' }),
      ).toBeEnabled();
      const changed =
        change === 'source'
          ? {
              ...bootstrap,
              moduleConnections: {
                ...bootstrap.moduleConnections,
                import: bootstrap.moduleConnections.import!.map((source) =>
                  source.server === 'processServer'
                    ? { ...source, state: 'UNAVAILABLE' as const }
                    : source,
                ),
              },
            }
          : bootstrap;
      page.refreshBootstrap(
        changed,
        change === 'actor' ? 'different-employee-token' : undefined,
      );
      expect(
        await screen.findByRole('checkbox', { name: 'Select Scheduled Jobs' }),
      ).not.toBeChecked();
      page.refreshBootstrap(bootstrap);
      expect(
        await screen.findByRole('checkbox', { name: 'Select Scheduled Jobs' }),
      ).not.toBeChecked();
      expect(
        screen.getByRole('button', { name: 'Install or update selected' }),
      ).toBeDisabled();
      expect(fetcher.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
        false,
      );
    },
  );

  it('stops unsent batches after connection changes and preserves original acknowledgements and history inspection', async () => {
    let finish: ((response: Response) => void) | undefined;
    const staged = {
      ...currentRelease,
      releaseCode: 'staged:core',
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    };
    const process = {
      ...staged,
      releaseCode: 'process:core',
      destinationRole: 'PROCESS',
      moduleName: 'workflow',
      displayName: 'Review workflows',
    };
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, options) => {
        const url = fetchInputUrl(input);
        if (options?.method === 'POST')
          return new Promise<Response>((resolve) => {
            finish = resolve;
          });
        return Promise.resolve(
          jsonResponse(
            url.endsWith('/core')
              ? url.includes(':4330')
                ? [process]
                : url.includes(':4312')
                  ? [staged]
                  : []
              : [],
          ),
        );
      });
    const page = renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Core data' }));
    await screen.findByRole('checkbox', { name: 'Select Scheduled Jobs' });
    await screen.findByRole('checkbox', { name: 'Select Review workflows' });
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Select all actionable releases' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Install or update selected' }));
    await waitFor(() => expect(finish).toBeDefined());
    const firstUrl = fetchInputUrl(
      fetcher.mock.calls.find(([, options]) => options?.method === 'POST')![0],
    );
    const first = firstUrl.includes(':4330') ? process : staged;
    page.refreshBootstrap({
      ...bootstrap,
      moduleConnections: {
        ...bootstrap.moduleConnections,
        import: bootstrap.moduleConnections.import!.filter(
          (source) => source.runtimeRole?.publication !== 'ONLINE',
        ),
      },
    });
    // Removing an Online source does not change authoring authority; change an observed source instead.
    page.refreshBootstrap({
      ...bootstrap,
      moduleConnections: {
        ...bootstrap.moduleConnections,
        import: bootstrap.moduleConnections.import!.map((source) =>
          source.runtimeRole?.code === 'PROCESS'
            ? { ...source, state: 'DEGRADED' as const }
            : source,
        ),
      },
    });
    expect(screen.getByRole('tab', { name: 'History' })).toBeDisabled();
    expect(screen.getByText(/original response is still pending/)).toBeVisible();
    act(() => {
      finish!(
        jsonResponse({
          dataType: 'core',
          tenant: 'default',
          releases: [{ ...first, status: 'CURRENT', installedVersion: first.version }],
        }),
      );
    });
    expect(await screen.findByText(/Remaining batches were not sent/)).toBeVisible();
    expect(
      screen.getByText(/Some earlier owner responses were acknowledged/),
    ).toBeVisible();
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === 'POST'),
    ).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'History' })).toBeEnabled();
    const inspect = screen
      .getAllByRole('button', { name: 'Inspect original owner history' })
      .find((button) => !button.hasAttribute('disabled'))!;
    fireEvent.click(inspect);
    await waitFor(() => expect(window.location.search).toContain('area=history'));
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === 'POST'),
    ).toHaveLength(1);
  });

  it.each(['validate', 'install'] as const)(
    'correlates owner prerequisites for %s without adding them to the submitted selection',
    async (mode) => {
      let installed = false;
      const pending = {
        ...currentRelease,
        releaseCode: 'cronjob:core',
        status: 'NOT_INSTALLED',
        installedVersion: undefined,
      };
      const dependency = {
        ...pending,
        releaseCode: 'reference:base',
        moduleName: 'reference',
        displayName: 'Reference baseline',
        checksum: 'b'.repeat(64),
        status: 'CURRENT',
      };
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input, options) => {
          if (options?.method === 'POST') {
            installed = mode === 'install';
            return Promise.resolve(
              jsonResponse({
                dataType: 'core',
                tenant: 'default',
                releases: [
                  dependency,
                  { ...pending, status: installed ? 'CURRENT' : pending.status },
                ],
                selection: {
                  contractVersion: 1,
                  requestedReleaseCodes: ['cronjob:core'],
                  prerequisites: [
                    {
                      releaseCode: dependency.releaseCode,
                      moduleName: dependency.moduleName,
                      dataType: 'core',
                      version: dependency.version,
                      checksum: dependency.checksum,
                    },
                  ],
                },
              }),
            );
          }
          return Promise.resolve(
            jsonResponse(
              fetchInputUrl(input) === 'http://localhost:4312/nodics/import/v0/core'
                ? [{ ...pending, status: installed ? 'CURRENT' : pending.status }]
                : [],
            ),
          );
        });
      renderPage();
      fireEvent.click(screen.getByRole('tab', { name: 'Core data' }));
      fireEvent.click(
        await screen.findByRole('checkbox', { name: 'Select Scheduled Jobs' }),
      );
      fireEvent.click(
        screen.getByRole('button', {
          name:
            mode === 'validate' ? 'Validate selected' : 'Install or update selected',
        }),
      );
      expect(
        await screen.findByText(
          mode === 'validate'
            ? '2 core data release(s) validated by the backend.'
            : '2 core data release(s) installed or updated.',
        ),
      ).toBeVisible();
      const posts = fetcher.mock.calls.filter(
        ([, options]) => options?.method === 'POST',
      );
      expect(posts).toHaveLength(1);
      expect(posts[0]?.[1]?.body).toBe(
        JSON.stringify({
          dataType: 'core',
          releaseCodes: ['cronjob:core'],
          expectedReleases: { 'cronjob:core': pending.version },
        }),
      );
    },
  );

  it.each(['tenant', 'checksum', 'releaseCode'] as const)(
    'holds a response with mismatched %s instead of reporting installation success',
    async (field) => {
      const pending = {
        ...currentRelease,
        releaseCode: 'cronjob:core',
        status: 'NOT_INSTALLED',
        installedVersion: undefined,
      };
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input, options) => {
          if (options?.method === 'POST')
            return Promise.resolve(
              jsonResponse({
                dataType: 'core',
                tenant: field === 'tenant' ? 'other' : 'default',
                releases: [
                  {
                    ...pending,
                    status: 'CURRENT',
                    ...(field === 'checksum' ? { checksum: 'b'.repeat(64) } : {}),
                    ...(field === 'releaseCode' ? { releaseCode: 'other:core' } : {}),
                  },
                ],
              }),
            );
          return Promise.resolve(
            jsonResponse(
              fetchInputUrl(input) === 'http://localhost:4312/nodics/import/v0/core'
                ? [pending]
                : [],
            ),
          );
        });
      renderPage();
      fireEvent.click(screen.getByRole('tab', { name: 'Core data' }));
      fireEvent.click(
        await screen.findByRole('checkbox', { name: 'Select Scheduled Jobs' }),
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'Install or update selected' }),
      );
      expect(
        await screen.findByText(
          /release response does not match the original owner request/,
        ),
      ).toBeVisible();
      expect(screen.queryByText(/1 core data release\(s\) installed/)).toBeNull();
      expect(
        fetcher.mock.calls.filter(([, options]) => options?.method === 'POST'),
      ).toHaveLength(1);
    },
  );

  it('finds releases while keeping selected batch members visible, without issuing commands', async () => {
    const releases = [
      { moduleName: 'catalog', displayName: 'Catalog references' },
      { moduleName: 'media', displayName: 'Media formats' },
      { moduleName: 'workflow', displayName: 'Workflow seeds' },
    ].map((entry) => ({
      ...currentRelease,
      ...entry,
      releaseCode: `${entry.moduleName}:core`,
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    }));
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) =>
        Promise.resolve(
          jsonResponse(
            fetchInputUrl(input) === 'http://localhost:4312/nodics/import/v0/core'
              ? releases
              : [],
          ),
        ),
      );
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Core data' }));
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Select Catalog references' }),
    );
    const search = screen.getByRole('searchbox', { name: 'Find releases' });
    fireEvent.change(search, { target: { value: '  FORMATS  ' } });
    expect(
      screen.getByRole('checkbox', { name: 'Select Catalog references' }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Select Media formats' }),
    ).not.toBeChecked();
    expect(
      screen.queryByRole('checkbox', { name: 'Select Workflow seeds' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Media formats' }));
    fireEvent.change(search, { target: { value: 'no-such-release' } });
    expect(screen.getByText('2 releases shown')).toBeVisible();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Select Catalog references' }),
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Media formats' }));
    expect(screen.getByText('0 releases shown')).toBeVisible();
    expect(
      screen.getByText(
        'No releases match this search. Clear the search or use another name, owner or description.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('0% current')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear release search' }));
    expect(
      screen.getByRole('checkbox', { name: 'Select Workflow seeds' }),
    ).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Workflow seeds' })).toBeVisible();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
      false,
    );
  });

  it.each(['matching', 'mismatched'] as const)(
    'shows a %s durable continuation receipt without claiming the whole plan is installed',
    async (scenario) => {
      let started = false;
      const releases = ['first', 'second'].map((name, index) => ({
        ...currentRelease,
        releaseCode: 'cronjob:' + name,
        displayName: 'Checkpoint ' + name,
        status: 'NOT_INSTALLED',
        installedVersion: undefined,
        continuationSupported: true,
        checksum: String(index).repeat(64),
      }));
      const receipt = {
        code: 'releaseExecution_' + 'a'.repeat(64),
        planHash: 'b'.repeat(64),
        dataType: 'core',
        revision: 3,
        status: 'READY',
        completed: 1,
        total: 2,
        automaticRetry: false,
        canContinue: true,
        nextAction: 'Continue the recorded preparation when ready.',
        releaseCodes: ['cronjob:first', 'cronjob:second'],
        expectedReleases: { 'cronjob:first': '1.0.0', 'cronjob:second': '1.0.0' },
      };
      const current = () =>
        releases.map((release, index) =>
          started && index === 0
            ? { ...release, status: 'CURRENT', installedVersion: release.version }
            : release,
        );
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input, init) => {
          const url = fetchInputUrl(input);
          if (url.endsWith('/core/install')) {
            if (typeof init?.body !== 'string')
              throw new Error('Expected serialized plan');
            expect(JSON.parse(init.body)).toMatchObject({
              continuation: true,
              releaseCodes: receipt.releaseCodes,
            });
            started = true;
            return Promise.resolve(
              jsonResponse({
                dataType: 'core',
                tenant: 'default',
                releases: current(),
                execution:
                  scenario === 'matching'
                    ? receipt
                    : {
                        ...receipt,
                        expectedReleases: {
                          ...receipt.expectedReleases,
                          'cronjob:second': '9.0.0',
                        },
                      },
              }),
            );
          }
          if (url === 'http://localhost:4312/nodics/import/v0/core')
            return Promise.resolve(jsonResponse(current()));
          if (url === 'http://localhost:4312/nodics/import/v0/core/executions')
            return Promise.resolve(jsonResponse(started ? [receipt] : []));
          return Promise.resolve(jsonResponse([]));
        });
      renderPage();
      const user = userEvent.setup();
      await user.click(await screen.findByRole('tab', { name: 'Core data' }));
      await user.click(
        await screen.findByRole('checkbox', { name: 'Select Checkpoint first' }),
      );
      await user.click(
        screen.getByRole('checkbox', { name: 'Select Checkpoint second' }),
      );
      await user.click(
        screen.getByRole('button', { name: 'Install or update selected' }),
      );
      if (scenario === 'matching') {
        expect(
          await screen.findByText(
            'Preparation progress saved. Inspect Recorded preparations below to continue from the owner receipt.',
          ),
        ).toBeVisible();
        expect(await screen.findByText(/1 of 2 release stages prepared/)).toBeVisible();
        expect(
          screen.queryByText(/Refreshed installation state is unverified/),
        ).not.toBeInTheDocument();
      } else {
        expect(
          await screen.findByText(
            /The preparation receipt does not match the reviewed releases/,
          ),
        ).toBeVisible();
        expect(
          screen.queryByText(/Preparation progress saved/),
        ).not.toBeInTheDocument();
      }
      expect(
        fetcher.mock.calls.filter(([input]) =>
          fetchInputUrl(input).endsWith('/core/install'),
        ),
      ).toHaveLength(1);
    },
  );

  it.each([401, 503])(
    'keeps an acknowledged install distinct from a failed %s refresh and hides stale release state',
    async (status) => {
      let installed = false;
      const pendingRelease = {
        ...currentRelease,
        status: 'NOT_INSTALLED',
        installedVersion: undefined,
        destinationRole: 'WCMS_STAGED',
      };
      const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
        const url = fetchInputUrl(input);
        if (url.endsWith('/core/install')) {
          installed = true;
          return Promise.resolve(
            jsonResponse({
              dataType: 'core',
              tenant: 'default',
              releases: [
                { ...pendingRelease, status: 'CURRENT', installedVersion: '1.0.0' },
              ],
            }),
          );
        }
        if (url === 'http://localhost:4312/nodics/import/v0/core')
          return Promise.resolve(
            installed
              ? new Response(JSON.stringify({ message: 'Expired stamp' }), {
                  status,
                })
              : jsonResponse([pendingRelease]),
          );
        return Promise.resolve(jsonResponse([]));
      });
      renderPage();
      const user = userEvent.setup();
      await user.click(await screen.findByRole('tab', { name: 'Core data' }));
      const checkbox = await screen.findByRole('checkbox', { name: /Scheduled Jobs/ });
      await user.click(checkbox);
      await user.click(
        screen.getByRole('button', { name: 'Install or update selected' }),
      );
      expect(
        await screen.findByText(
          /1 release\(s\) acknowledged by the Import owner\. Refreshed installation state is unverified/,
        ),
      ).toBeVisible();
      expect(screen.queryByRole('heading', { name: 'Available to review' })).toBeNull();
      expect(screen.queryByRole('checkbox', { name: /Scheduled Jobs/ })).toBeNull();
      expect(
        fetcher.mock.calls.filter(([input]) =>
          fetchInputUrl(input).endsWith('/core/install'),
        ),
      ).toHaveLength(1);
    },
  );
  it('preserves admitted import runs in combined history when the Export owner denies access', async () => {
    const source = bootstrap.moduleConnections.import?.find(
      ({ server }) => server === 'wcmsStagedServer',
    );
    if (!source) throw new Error('Missing staged Import fixture');
    window.history.replaceState(
      {},
      '',
      `/operations/imports-exports?area=history&importInstance=${encodeURIComponent(source.instanceId)}`,
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.includes('/nodics/export/v0/history'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              code: 'ERR_AUTH_00003',
              message: 'Export access denied',
            }),
            { status: 403 },
          ),
        );
      if (url.includes('/nodics/import/v0/run/history'))
        return Promise.resolve(
          jsonResponse([
            { runId: 'staged-import-run', dataType: 'sample', status: 'COMPLETED' },
          ]),
        );
      return Promise.resolve(jsonResponse([]));
    });
    renderPage({
      moduleConnections: {
        ...bootstrap.moduleConnections,
        export: [
          {
            ...source,
            moduleName: 'export',
            instanceId: source.instanceId.replace(':import:', ':export:'),
            endpoint: source.endpoint.replace('/import', '/export'),
          },
        ],
      },
    });

    expect(
      await screen.findByText(/This view shows import history only/),
    ).toBeVisible();
    expect(screen.getByText(/staged-import-run/)).toBeVisible();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Imports' }));
    expect(await screen.findByText(/staged-import-run/)).toBeVisible();
    expect(screen.queryByText(/This view shows import history only/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Exports' }));
    expect(await screen.findByText('Export access denied')).toBeVisible();
    expect(screen.queryByText(/staged-import-run/)).toBeNull();
  });

  it('does not substitute another run when an explicit target run is absent', async () => {
    window.history.replaceState(
      {},
      '',
      '/operations/imports-exports?area=history&importInstance=kickoffLocal%3AprocessServer%3Aimport%3A0&importRun=import_unavailable',
    );
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(jsonResponse({ runId: 'different-run', status: 'COMPLETED' })),
      );
    renderPage();
    expect(
      await screen.findByText(
        'The exact import run is unavailable from the selected owner.',
      ),
    ).toBeVisible();
    expect(
      fetcher.mock.calls
        .filter(([input]) => fetchInputUrl(input).includes('/run/history'))
        .map(([input]) => fetchInputUrl(input)),
    ).toEqual([
      'http://localhost:4330/nodics/import/v0/run/history/import_unavailable',
    ]);
    expect(screen.queryByText('Run different-run')).toBeNull();
    expect(fetcher.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
      false,
    );
  });
  it('explicitly selects one authorized history runtime and clears an old run reference without writes', async () => {
    window.history.replaceState(
      {},
      '',
      '/operations/imports-exports?area=history&importInstance=kickoffLocal%3AprocessServer%3Aimport%3A0&importRun=import_unavailable',
    );
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) =>
        Promise.resolve(
          jsonResponse(
            fetchInputUrl(input).endsWith('/import_unavailable') ? null : [],
          ),
        ),
      );
    renderPage();
    await screen.findByText(
      'The exact import run is unavailable from the selected owner.',
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: 'History runtime' }));
    await user.click(
      await screen.findByRole('option', { name: 'wcmsStagedServer · WCMS_STAGED' }),
    );
    await waitFor(() =>
      expect(
        fetcher.mock.calls
          .filter(([input]) => fetchInputUrl(input).includes('/run/history'))
          .map(([input]) => fetchInputUrl(input)),
      ).toEqual([
        'http://localhost:4330/nodics/import/v0/run/history/import_unavailable',
        'http://localhost:4312/nodics/import/v0/run/history?limit=50&skip=0',
      ]),
    );
    expect(new URLSearchParams(window.location.search).get('importInstance')).toBe(
      'kickoffLocal:wcmsStagedServer:import:0',
    );
    expect(new URLSearchParams(window.location.search).has('importRun')).toBe(false);
    expect(screen.getByText(/Showing selected runtime history\./)).toBeVisible();
    expect(screen.queryByText(/failed-attempt run evidence/)).toBeNull();
    expect(screen.queryByText(/Run reference:/)).toBeNull();
    expect(fetcher.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
      false,
    );
  });

  it('tracks same-session query navigation and back/forward without retaining another runtime or run', async () => {
    const processPath =
      '/operations/imports-exports?area=history&importInstance=kickoffLocal%3AprocessServer%3Aimport%3A0&importRun=import_process';
    const stagedPath =
      '/operations/imports-exports?area=history&importInstance=kickoffLocal%3AwcmsStagedServer%3Aimport%3A0&importRun=import_staged';
    window.history.replaceState({}, '', processPath);
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(jsonResponse([])));
    renderPage();
    expect(await screen.findByText(/Run reference: import_process/)).toBeVisible();
    act(() => {
      window.history.pushState({}, '', stagedPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByText(/Run reference: import_staged/)).toBeVisible();
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([input]) =>
          fetchInputUrl(input).startsWith(
            'http://localhost:4312/nodics/import/v0/run/history',
          ),
        ),
      ).toBe(true),
    );
    act(() => {
      window.history.back();
    });
    expect(await screen.findByText(/Run reference: import_process/)).toBeVisible();
    expect(screen.queryByText(/Run reference: import_staged/)).toBeNull();
    act(() => {
      window.history.forward();
    });
    expect(await screen.findByText(/Run reference: import_staged/)).toBeVisible();
    const reads = fetcher.mock.calls.length;
    act(() => {
      window.history.pushState({}, '', `${stagedPath}&importInstance=duplicate`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(
      await screen.findByText(
        'The requested Import runtime is unavailable in the authorized catalogue.',
      ),
    ).toBeVisible();
    expect(fetcher.mock.calls).toHaveLength(reads);
    expect(fetcher.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
      false,
    );
  });

  it('rejects duplicate history target selectors without reading a fallback runtime', async () => {
    window.history.replaceState(
      {},
      '',
      '/operations/imports-exports?area=history&importInstance=missing&importInstance=kickoffLocal%3AprocessServer%3Aimport%3A0',
    );
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(jsonResponse([])));
    renderPage();
    expect(
      await screen.findByText(
        'The requested Import runtime is unavailable in the authorized catalogue.',
      ),
    ).toBeVisible();
    expect(
      fetcher.mock.calls.some(([input]) =>
        fetchInputUrl(input).includes('/run/history'),
      ),
    ).toBe(false);
    expect(fetcher.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
      false,
    );
  });
  it.each(['kickoffLocal:processServer:import:0', 'missing-target'])(
    'opens only exact authorized history target without fallback (%s)',
    async (instanceId) => {
      window.history.replaceState(
        {},
        '',
        `/operations/imports-exports?area=history&importInstance=${encodeURIComponent(instanceId)}`,
      );
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(() => Promise.resolve(jsonResponse([])));
      renderPage();
      if (instanceId === 'missing-target') {
        expect(
          await screen.findByText(
            'The requested Import runtime is unavailable in the authorized catalogue.',
          ),
        ).toBeVisible();
        expect(
          fetcher.mock.calls.some(([input]) =>
            fetchInputUrl(input).includes('/run/history'),
          ),
        ).toBe(false);
      } else {
        expect(
          await screen.findByText(/Showing selected runtime history\./),
        ).toBeVisible();
        expect(screen.queryByText(/failed-attempt run evidence/)).toBeNull();
        await waitFor(() =>
          expect(
            fetcher.mock.calls
              .filter(([input]) => fetchInputUrl(input).includes('/run/history'))
              .map(([input]) => fetchInputUrl(input)),
          ).toEqual([
            'http://localhost:4330/nodics/import/v0/run/history?limit=50&skip=0',
          ]),
        );
      }
      expect(fetcher.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
        false,
      );
    },
  );
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('shows guided setup as read-only when the owner omits action eligibility', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      Promise.resolve(
        jsonResponse(
          fetchInputUrl(input).endsWith('/initialization-profiles')
            ? [
                {
                  profileCode: 'readOnlyPlan',
                  label: 'Read-only plan',
                  description: 'Review only',
                  completionMessage: 'Ready',
                  status: 'ACTION_REQUIRED',
                  blocked: false,
                  steps: [
                    {
                      order: 1,
                      dataType: 'core',
                      releases: [
                        {
                          ...currentRelease,
                          status: 'NOT_INSTALLED',
                          allowedActions: [],
                        },
                      ],
                    },
                  ],
                },
              ]
            : [],
        ),
      ),
    );
    renderPage();
    const regions = await screen.findAllByRole('region', { name: /Read-only plan/ });
    for (const region of regions) {
      expect(
        within(region).getByRole('button', { name: 'Validate plan' }),
      ).toBeDisabled();
      expect(
        within(region).getByRole('button', { name: 'Validate and initialize' }),
      ).toBeDisabled();
    }
  });

  it('opens the requested import-export area from URL state and preserves tab changes', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/schemas')) {
        return Promise.resolve(
          jsonResponse({
            schemas: [tenantSchema],
          }),
        );
      }
      if (url === 'http://localhost:4312/nodics/import/v0/core')
        return Promise.resolve(jsonResponse([currentRelease]));
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

  it.each(['mismatched-response', 'unverified-refresh'] as const)(
    'does not report guided installation complete after %s',
    async (scenario) => {
      let installed = false;
      const profile = {
        profileCode: 'localWcmsFoundation',
        allowedActions: ['validate', 'install'],
        label: 'Local WCMS foundation',
        description: 'Install the content foundation.',
        completionMessage: 'Content foundation is complete.',
        moduleIndex: '50.99',
        destinationRole: 'WCMS_STAGED',
        status: 'ACTION_REQUIRED',
        blocked: false,
        steps: [
          {
            order: 1,
            dataType: 'init',
            releases: [
              {
                ...currentRelease,
                dataType: 'init',
                status: 'NOT_INSTALLED',
                installedVersion: undefined,
              },
            ],
          },
        ],
      };
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input, options) => {
          const url = fetchInputUrl(input);
          if (options?.method === 'POST') {
            installed = true;
            return Promise.resolve(
              jsonResponse({
                profileCode:
                  scenario === 'mismatched-response'
                    ? 'differentFoundation'
                    : profile.profileCode,
                mode: 'INSTALL',
                profile: { ...profile, status: 'CURRENT' },
              }),
            );
          }
          if (url === 'http://localhost:4312/nodics/import/v0/initialization-profiles')
            return Promise.resolve(
              installed && scenario === 'unverified-refresh'
                ? new Response('{}', { status: 503 })
                : jsonResponse([profile]),
            );
          return Promise.resolve(jsonResponse([]));
        });
      renderPage();
      fireEvent.click(
        await screen.findByRole('button', { name: 'Validate and initialize' }),
      );
      expect(
        await screen.findByText(
          scenario === 'mismatched-response'
            ? /setup response does not match the original owner request/
            : /Refreshed setup status is unverified/,
        ),
      ).toBeVisible();
      expect(screen.queryByText('Content foundation is complete.')).toBeNull();
      expect(
        fetcher.mock.calls.filter(([, options]) => options?.method === 'POST'),
      ).toHaveLength(1);
    },
  );

  it('validates and initializes a backend-owned guided profile on Staged', async () => {
    const pendingRelease = {
      ...currentRelease,
      dataType: 'init',
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    };
    const profile = {
      profileCode: 'localWcmsFoundation',
      allowedActions: ['validate', 'install'],
      label: 'Local WCMS foundation',
      description: 'Install the Local content foundation.',
      completionMessage: 'The Staged content foundation is ready.',
      moduleIndex: '50.99',
      destinationRole: 'WCMS_STAGED',
      status: 'ACTION_REQUIRED',
      blocked: false,
      steps: [{ order: 1, dataType: 'init', releases: [pendingRelease] }],
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url === 'http://localhost:4312/nodics/import/v0/initialization-profiles')
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
    expect(screen.getByText('Runtime WCMS_STAGED · wcmsStagedServer')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Validate plan' }));
    expect(
      await screen.findByText(/backend validated the immutable initialization plan/iu),
    ).toBeVisible();
    const call = fetchMock.mock.calls.find(([input]) =>
      fetchInputUrl(input).endsWith(
        '/initialization-profiles/localWcmsFoundation/validate',
      ),
    );
    expect(call ? fetchInputUrl(call[0]) : '').toMatch(
      /^http:\/\/localhost:4312\/nodics\/import/u,
    );
    expect(call?.[1]?.method).toBe('POST');
  });

  it('runs the selected guided profile against its destination runtime when profile codes repeat', async () => {
    const pendingRelease = {
      ...currentRelease,
      dataType: 'init',
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    };
    const stagedProfile = {
      profileCode: 'localFoundation',
      allowedActions: ['validate', 'install'],
      label: 'Local WCMS staged setup',
      description: 'Install the Local content foundation.',
      completionMessage: 'The Staged content foundation is ready.',
      moduleIndex: '50.99',
      destinationRole: 'WCMS_STAGED',
      status: 'ACTION_REQUIRED',
      blocked: false,
      steps: [{ order: 1, dataType: 'init', releases: [pendingRelease] }],
    };
    const processProfile = {
      ...stagedProfile,
      label: 'Local process setup',
      description: 'Install the Local process foundation.',
      completionMessage: 'The Process foundation is ready.',
      moduleIndex: '85.99',
      destinationRole: 'PROCESS',
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url === 'http://localhost:4312/nodics/import/v0/initialization-profiles')
        return Promise.resolve(jsonResponse([stagedProfile]));
      if (url === 'http://localhost:4330/nodics/import/v0/initialization-profiles')
        return Promise.resolve(jsonResponse([processProfile]));
      if (url.endsWith('/initialization-profiles/localFoundation/validate')) {
        return Promise.resolve(
          jsonResponse({
            profileCode: processProfile.profileCode,
            mode: 'VALIDATE',
            profile: processProfile,
          }),
        );
      }
      if (url.endsWith('/init') || url.endsWith('/core') || url.endsWith('/sample'))
        return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Local WCMS staged setup')).toBeVisible();
    expect(screen.getByText('Local process setup')).toBeVisible();
    const validateButtons = screen.getAllByRole('button', { name: 'Validate plan' });
    expect(validateButtons).toHaveLength(2);
    await user.click(validateButtons[1] as HTMLElement);

    expect(
      await screen.findByText(/backend validated the immutable initialization plan/iu),
    ).toBeVisible();
    const validateCalls = fetchMock.mock.calls.filter(([input]) =>
      fetchInputUrl(input).endsWith(
        '/initialization-profiles/localFoundation/validate',
      ),
    );
    expect(validateCalls.map(([input]) => fetchInputUrl(input as RequestInfo))).toEqual(
      [
        'http://localhost:4330/nodics/import/v0/initialization-profiles/localFoundation/validate',
      ],
    );
  });

  it.each([
    ['validate', false],
    ['install', false],
    ['validate', true],
    ['install', true],
  ] as const)(
    'locks every guided command through %s and authoritative refresh (failure: %s)',
    async (mode, fails) => {
      const profile = {
        profileCode: 'sharedFoundation',
        allowedActions: ['validate', 'install'],
        label: 'Staged foundation',
        description: 'Owner-defined foundation.',
        completionMessage: 'Foundation ready.',
        destinationRole: 'WCMS_STAGED',
        status: 'ACTION_REQUIRED',
        blocked: false,
        steps: [
          {
            order: 1,
            dataType: 'init',
            releases: [
              {
                ...currentRelease,
                status: 'NOT_INSTALLED',
                installedVersion: undefined,
              },
            ],
          },
        ],
      };
      const ownerProfiles = [
        profile,
        { ...profile, label: 'Process foundation', destinationRole: 'PROCESS' },
      ];
      let finishCommand!: (response: Response) => void;
      let finishProfiles!: () => void;
      let finishCatalogue!: () => void;
      const command = new Promise<Response>((resolve) => {
        finishCommand = resolve;
      });
      const profileRefresh = new Promise<void>((resolve) => {
        finishProfiles = resolve;
      });
      const catalogueRefresh = new Promise<void>((resolve) => {
        finishCatalogue = resolve;
      });
      let refreshing = false;
      let profileReads = 0;
      let catalogueReads = 0;
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
        const url = fetchInputUrl(input);
        if (url.endsWith(`/sharedFoundation/${mode}`)) return command;
        if (
          [
            'http://localhost:4312/nodics/import/v0/initialization-profiles',
            'http://localhost:4330/nodics/import/v0/initialization-profiles',
          ].includes(url)
        ) {
          const observed = [
            url.includes(':4312') ? ownerProfiles[0]! : ownerProfiles[1]!,
          ];
          if (refreshing) {
            profileReads += 1;
            return profileRefresh.then(() => jsonResponse(observed));
          }
          return Promise.resolve(jsonResponse(observed));
        }
        if (refreshing && /\/(init|core|sample)$/u.test(url)) {
          catalogueReads += 1;
          return catalogueRefresh.then(() => jsonResponse([]));
        }
        return Promise.resolve(jsonResponse([]));
      });
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Process foundation');
      const caption = mode === 'validate' ? 'Validate plan' : 'Validate and initialize';
      await user.click(screen.getAllByRole('button', { name: caption })[0]!);
      const expectLocked = () => {
        const buttons = screen.getAllByRole('button', {
          name: /^(Validate plan|Validate and initialize|Validating\.\.\.|Initializing\.\.\.)$/u,
        });
        expect(buttons).toHaveLength(4);
        buttons.forEach((button) => expect(button).toBeDisabled());
        screen.getAllByRole('tab').forEach((tab) => expect(tab).toBeDisabled());
        expect(
          screen.getAllByRole('button', {
            name: mode === 'validate' ? 'Validating...' : 'Initializing...',
          }),
        ).toHaveLength(1);
      };
      expectLocked();
      fireEvent.click(screen.getAllByRole('button', { name: caption }).at(-1)!);
      refreshing = true;
      await act(async () => {
        finishCommand(
          fails
            ? new Response(JSON.stringify({ message: 'Controlled profile failure' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              })
            : jsonResponse({
                profileCode: profile.profileCode,
                mode: mode.toUpperCase(),
                profile,
              }),
        );
        await command;
      });
      await waitFor(() => {
        expect(profileReads).toBeGreaterThan(0);
        expect(catalogueReads).toBeGreaterThan(0);
      });
      expectLocked();
      await act(async () => {
        finishProfiles();
        await profileRefresh;
      });
      expectLocked();
      await act(async () => {
        finishCatalogue();
        await catalogueRefresh;
      });
      await waitFor(() => {
        screen
          .getAllByRole('button', { name: caption })
          .forEach((button) => expect(button).toBeEnabled());
        expect(screen.getByRole('tab', { name: 'History' })).toBeEnabled();
      });
      if (fails) expect(screen.getByText('Controlled profile failure')).toBeVisible();
      expect(
        fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST'),
      ).toHaveLength(1);
    },
  );

  it('shows guided profile operation feedback only on the selected profile card', async () => {
    const pendingRelease = {
      ...currentRelease,
      dataType: 'init',
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    };
    const stagedProfile = {
      profileCode: 'sharedFoundation',
      allowedActions: ['validate', 'install'],
      label: 'Local WCMS staged setup',
      description: 'Install the Local content foundation.',
      completionMessage: 'The Staged content foundation is ready.',
      moduleIndex: '50.99',
      destinationRole: 'WCMS_STAGED',
      status: 'ACTION_REQUIRED',
      blocked: false,
      steps: [{ order: 1, dataType: 'init', releases: [pendingRelease] }],
    };
    const processProfile = {
      ...stagedProfile,
      label: 'Local process setup',
      description: 'Install the Local process foundation.',
      completionMessage: 'The Process foundation is ready.',
      moduleIndex: '85.99',
      destinationRole: 'PROCESS',
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url === 'http://localhost:4312/nodics/import/v0/initialization-profiles')
        return Promise.resolve(jsonResponse([stagedProfile]));
      if (url === 'http://localhost:4330/nodics/import/v0/initialization-profiles')
        return Promise.resolve(jsonResponse([processProfile]));
      if (url.endsWith('/initialization-profiles/sharedFoundation/install')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              message: 'Operation not found: Initialization profile is unavailable',
            }),
            { status: 404, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (url.endsWith('/init') || url.endsWith('/core') || url.endsWith('/sample'))
        return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Local WCMS staged setup')).toBeVisible();
    const initializeButtons = screen.getAllByRole('button', {
      name: 'Validate and initialize',
    });
    expect(initializeButtons).toHaveLength(2);
    await user.click(initializeButtons[1] as HTMLElement);

    expect(
      await screen.findByText(/Local process setup cannot be started on PROCESS/u),
    ).toBeVisible();
    expect(
      screen.queryByText(/Local WCMS staged setup cannot be started/u),
    ).not.toBeInTheDocument();
  });

  it('groups guided setup profiles by required action before current profiles', async () => {
    const pendingRelease = {
      ...currentRelease,
      dataType: 'init',
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    };
    const currentReleaseStep = {
      ...pendingRelease,
      status: 'CURRENT',
      installedVersion: '1.0.0',
    };
    const currentProfile = {
      profileCode: 'localWcmsFoundation',
      allowedActions: ['validate', 'install'],
      label: 'Local WCMS foundation',
      description: 'Install the Local content foundation.',
      completionMessage: 'The Staged content foundation is ready.',
      moduleIndex: '50.99',
      destinationRole: 'WCMS_STAGED',
      status: 'CURRENT',
      blocked: false,
      steps: [{ order: 1, dataType: 'init', releases: [currentReleaseStep] }],
    };
    const actionProfile = {
      profileCode: 'localCommerceFoundation',
      allowedActions: ['validate', 'install'],
      label: 'Local Commerce foundation',
      description: 'Install the Local commerce foundation.',
      completionMessage: 'The Commerce foundation is ready.',
      moduleIndex: '70.99',
      destinationRole: 'COMMERCE',
      status: 'ACTION_REQUIRED',
      blocked: false,
      steps: [{ order: 1, dataType: 'core', releases: [pendingRelease] }],
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url === 'http://localhost:4312/nodics/import/v0/initialization-profiles') {
        return Promise.resolve(jsonResponse([currentProfile]));
      }
      if (url === 'http://localhost:4350/nodics/import/v0/initialization-profiles') {
        return Promise.resolve(jsonResponse([actionProfile]));
      }
      if (url.endsWith('/init') || url.endsWith('/core') || url.endsWith('/sample'))
        return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse([]));
    });

    renderPage({
      moduleConnections: {
        ...bootstrap.moduleConnections,
        import: [
          ...bootstrap.moduleConnections.import!,
          {
            moduleName: 'import',
            instanceId: 'commerce',
            endpoint: 'http://localhost:4350/nodics/import',
            environment: 'kickoffLocal',
            server: 'commerce',
            runtimeRole: { code: 'COMMERCE', publication: 'OPERATIONAL' },
            state: 'UP',
          },
        ],
      },
    });

    const needsActionHeading = await screen.findByRole('heading', {
      name: 'Available to review',
    });
    const currentHeading = screen.getByRole('heading', { name: 'Already current' });
    const actionProfileHeading = screen.getByRole('heading', {
      name: 'Local Commerce foundation',
    });
    const currentProfileHeading = screen.getByRole('heading', {
      name: 'Local WCMS foundation',
    });

    expect(needsActionHeading.compareDocumentPosition(currentHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(actionProfileHeading.compareDocumentPosition(currentProfileHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getAllByText('1 profile')).toHaveLength(2);
  });

  it('orders guided action profiles by backend setup sequence', async () => {
    const pendingRelease = {
      ...currentRelease,
      dataType: 'core',
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    };
    const commerceProfile = {
      profileCode: 'localCommerceFoundation',
      allowedActions: ['validate', 'install'],
      label: 'Local Commerce foundation',
      description: 'Install the Local commerce foundation.',
      completionMessage: 'The Commerce foundation is ready.',
      moduleIndex: '70.99',
      destinationRole: 'COMMERCE',
      status: 'ACTION_REQUIRED',
      blocked: false,
      steps: [{ order: 1, dataType: 'core', releases: [pendingRelease] }],
    };
    const platformProfile = {
      profileCode: 'localPlatformFoundation',
      allowedActions: ['validate', 'install'],
      label: 'Local Platform foundation',
      description: 'Install the Local platform foundation.',
      completionMessage: 'The Platform foundation is ready.',
      moduleIndex: '60.99',
      destinationRole: 'PLATFORM',
      status: 'ACTION_REQUIRED',
      blocked: false,
      steps: [{ order: 1, dataType: 'init', releases: [pendingRelease] }],
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url === 'http://localhost:3000/nodics/import/v0/initialization-profiles')
        return Promise.resolve(jsonResponse([platformProfile]));
      if (url === 'http://localhost:4350/nodics/import/v0/initialization-profiles')
        return Promise.resolve(jsonResponse([commerceProfile]));
      if (url.endsWith('/init') || url.endsWith('/core') || url.endsWith('/sample'))
        return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse([]));
    });

    renderPage({
      moduleConnections: {
        ...bootstrap.moduleConnections,
        import: [
          ...bootstrap.moduleConnections.import!,
          {
            moduleName: 'import',
            instanceId: 'commerce',
            endpoint: 'http://localhost:4350/nodics/import',
            environment: 'kickoffLocal',
            server: 'commerce',
            runtimeRole: { code: 'COMMERCE', publication: 'OPERATIONAL' },
            state: 'UP',
          },
        ],
      },
    });

    const platformHeading = await screen.findByRole('heading', {
      name: 'Local Platform foundation',
    });
    const commerceHeading = screen.getByRole('heading', {
      name: 'Local Commerce foundation',
    });

    expect(platformHeading.compareDocumentPosition(commerceHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('keeps guided setup useful when no initialization profiles are exposed', async () => {
    const initRelease = {
      ...currentRelease,
      dataType: 'init',
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url === 'http://localhost:4312/nodics/import/v0/initialization-profiles') {
        return Promise.resolve(jsonResponse([]));
      }
      if (url === 'http://localhost:4312/nodics/import/v0/init')
        return Promise.resolve(jsonResponse([initRelease]));
      if (url.endsWith('/core') || url.endsWith('/sample')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    renderPage();

    expect(
      await screen.findByText('No guided setup profile is available'),
    ).toBeVisible();
    expect(
      screen.getByText(/You can still review and install available release data/iu),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Initialization data' }));

    expect(window.location.search).toBe('?area=init');
    expect(
      await screen.findByRole('region', { name: 'Initialization data action footer' }),
    ).toBeVisible();
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
      allowedActions: ['validate', 'install'],
      label: 'Local WCMS foundation',
      description: 'Install the Local content foundation.',
      completionMessage: 'The Staged content foundation is ready.',
      destinationRole: 'WCMS_STAGED',
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
      if (url === 'http://localhost:4312/nodics/import/v0/initialization-profiles')
        return Promise.resolve(
          jsonResponse([attempts >= 2 ? currentProfile : pendingProfile]),
        );
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
      if (url === 'http://localhost:4312/nodics/import/v0/core')
        return Promise.resolve(jsonResponse([currentRelease]));
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
    expect(screen.getByRole('heading', { name: 'Already current' })).toBeVisible();
    expect(screen.queryByText('Collapse')).not.toBeInTheDocument();
    const currentGroupToggle = screen.getByRole('button', {
      name: /Already current/iu,
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
      if (url === 'http://localhost:4312/nodics/import/v0/core')
        return Promise.resolve(jsonResponse([updateRelease]));
      if (url.endsWith('/init') || url.endsWith('/sample')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Core data' }));

    expect(
      await screen.findByRole('heading', { name: 'Available to review' }),
    ).toBeVisible();
    expect(await screen.findByText('Available 1.1.0')).toBeVisible();
    expect(screen.getByText('Installed 1.0.0')).toBeVisible();
    const availableGroupToggle = screen.getByRole('button', {
      name: /Available to review/iu,
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

  it('orders data release tab action groups by backend module sequence', async () => {
    const commerceRelease = {
      ...currentRelease,
      releaseCode: 'commerce:core',
      moduleName: 'commerce',
      displayName: 'Local Commerce foundation',
      moduleIndex: '70.99',
      dataType: 'core',
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    };
    const platformRelease = {
      ...currentRelease,
      releaseCode: 'platform:core',
      moduleName: 'platform',
      displayName: 'Local Platform foundation',
      moduleIndex: '60.99',
      dataType: 'core',
      status: 'NOT_INSTALLED',
      installedVersion: undefined,
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url === 'http://localhost:4312/nodics/import/v0/core') {
        return Promise.resolve(jsonResponse([commerceRelease, platformRelease]));
      }
      if (url.endsWith('/init') || url.endsWith('/sample')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Core data' }));

    expect(
      await screen.findByRole('heading', { name: 'Available to review' }),
    ).toBeVisible();
    const platformHeading = screen.getAllByRole('heading', {
      name: 'Local Platform foundation',
    })[0]!;
    const commerceHeading = screen.getAllByRole('heading', {
      name: 'Local Commerce foundation',
    })[0]!;

    expect(platformHeading.compareDocumentPosition(commerceHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('preserves pending operation evidence and refreshes owner state after a lost install response', async () => {
    let finishInstall: ((response: Response) => void) | undefined;
    let applied = false;
    let installCalls = 0;
    let postInstallReads = 0;
    const updateRelease = {
      ...currentRelease,
      releaseCode: 'cronjob:core',
      version: '1.1.0',
      installedVersion: '1.0.0',
      status: 'UPDATE_AVAILABLE',
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/core/install')) {
        installCalls += 1;
        return new Promise<Response>((resolve) => {
          finishInstall = resolve;
        });
      }
      if (url === 'http://localhost:4312/nodics/import/v0/core') {
        if (applied) postInstallReads += 1;
        return Promise.resolve(
          jsonResponse([
            applied
              ? { ...updateRelease, installedVersion: '1.1.0', status: 'CURRENT' }
              : updateRelease,
          ]),
        );
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Core data' }));
    await user.click(
      await screen.findByRole('checkbox', { name: 'Select all actionable releases' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Install or update selected' }),
    );
    await waitFor(() => expect(finishInstall).toBeDefined());
    expect(screen.getByRole('tab', { name: 'History' })).toBeDisabled();
    expect(
      screen.getByRole('checkbox', { name: 'Select Scheduled Jobs' }),
    ).toBeDisabled();
    applied = true;
    act(() => {
      finishInstall!(
        new Response(JSON.stringify({ message: 'Import response lost' }), {
          status: 504,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    expect(await screen.findByText('Import response lost')).toBeVisible();
    expect(await screen.findByText('Version 1.1.0')).toBeVisible();
    expect(postInstallReads).toBeGreaterThan(0);
    expect(installCalls).toBe(1);
    expect(screen.getByRole('tab', { name: 'History' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Install or update selected' }),
    ).toBeDisabled();
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
      if (url === 'http://localhost:4312/nodics/import/v0/core')
        return Promise.resolve(jsonResponse([updateRelease]));
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
      if (url === 'http://localhost:3000/nodics/import/v0/init')
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

  it('keeps independent owner states and commands for the same release at two eligible runtimes', async () => {
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
      if (url === 'http://localhost:4312/nodics/import/v0/init/validate') {
        return Promise.resolve(
          jsonResponse({
            dataType: 'init',
            tenant: 'default',
            releases: [stagedProjection],
          }),
        );
      }
      if (url.endsWith('/init') || url.endsWith('/core') || url.endsWith('/sample')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Initialization data' }));

    expect(
      await screen.findByRole('heading', { name: 'Already current' }),
    ).toBeVisible();
    expect(screen.getAllByText('Catalog Framework')).toHaveLength(2);
    expect(screen.getByText('Version 1.0.3')).toBeVisible();
    expect(
      screen.getByRole('checkbox', {
        name: 'Catalog Framework is already current',
      }),
    ).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Available to review' })).toBeVisible();
    await user.click(
      screen.getByRole('checkbox', { name: 'Select Catalog Framework' }),
    );
    await user.click(screen.getByRole('button', { name: 'Validate selected' }));
    expect(
      await screen.findByText(
        '1 initialization data release(s) validated by the backend.',
      ),
    ).toBeVisible();
    const writes = fetchMock.mock.calls.filter(
      ([, options]) => options?.method === 'POST',
    );
    expect(writes).toHaveLength(1);
    expect(fetchInputUrl(writes[0]![0])).toBe(
      'http://localhost:4312/nodics/import/v0/init/validate',
    );
    expect(JSON.parse(writes[0]![1]!.body as string)).toEqual({
      dataType: 'init',
      releaseCodes: ['catalog:init'],
      expectedReleases: { 'catalog:init': '1.0.0' },
    });
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
      if (url === 'http://localhost:4312/nodics/import/v0/core') {
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
      if (url === 'http://localhost:4312/nodics/import/v0/sample')
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
    expect(
      screen.getByText(/Repair the owning module release descriptor/iu),
    ).toBeVisible();
    expect(screen.queryByText('Preparation readiness')).not.toBeInTheDocument();
    expect(screen.getAllByText('Agora Customer Review Source')[0]).toBeVisible();
    expect(
      screen.getAllByText(/Publishable data must target a Staged runtime/iu)[0],
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
    expect(
      screen.queryByRole('checkbox', {
        name: 'Agora Customer Review Source has an invalid release manifest',
      }),
    ).not.toBeInTheDocument();
    await user.click(repairGroupToggle);
    expect(repairGroupToggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      await screen.findByRole('checkbox', {
        name: 'Agora Customer Review Source has an invalid release manifest',
      }),
    ).toBeDisabled();
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
      if (url === 'http://localhost:4312/nodics/import/v0/init')
        return Promise.resolve(jsonResponse([initRelease]));
      if (url === 'http://localhost:4312/nodics/import/v0/core')
        return Promise.resolve(jsonResponse([coreRelease]));
      if (url === 'http://localhost:4312/nodics/import/v0/sample')
        return Promise.resolve(jsonResponse([sampleRelease]));
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Initialization data' }));
    expect(
      screen.getByRole('region', { name: 'Initialization data action footer' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Available to review' })).toBeVisible();
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
    expect(screen.getByRole('heading', { name: 'Available to review' })).toBeVisible();
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
    expect(screen.getByRole('heading', { name: 'Available to review' })).toBeVisible();
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
      if (url === 'http://localhost:4312/nodics/import/v0/init')
        return Promise.resolve(jsonResponse([cmsFoundation]));
      if (url === 'http://localhost:4330/nodics/import/v0/init')
        return Promise.resolve(jsonResponse([cmsApproval]));
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

  it('validates the selected Editorial model at its owner rather than the first Staged Import', async () => {
    const wcmsImport = bootstrap.moduleConnections.import![1]!;
    const commerceImport = {
      ...wcmsImport,
      instanceId: 'commerce-staged-import',
      endpoint: 'http://localhost:4352/nodics/import',
      server: 'commerceStagedServer',
      runtimeRole: { code: 'COMMERCE_STAGED', publication: 'STAGED' },
    };
    const authorSchema = {
      ...tenantSchema,
      moduleName: 'editorial',
      schemaName: 'editorialAuthor',
      label: 'Editorial Author',
      description: 'Editorial author records',
    };
    const fetched = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/schemas')) {
        return Promise.resolve(
          jsonResponse({ schemas: url.includes('/editorial/') ? [authorSchema] : [] }),
        );
      }
      if (url.includes('/storage/upload')) {
        return Promise.resolve(
          jsonResponse({ code: 'author-source', status: 'READY' }),
        );
      }
      if (url.endsWith('/import/v0/media')) {
        return Promise.resolve(
          jsonResponse({
            validationOnly: true,
            validationPassed: true,
            validationErrorCount: 0,
          }),
        );
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();
    const rendered = renderPage({
      moduleConnections: {
        import: [commerceImport, wcmsImport],
        editorial: [
          {
            ...wcmsImport,
            moduleName: 'editorial',
            instanceId: 'editorial-owner',
            endpoint: 'http://localhost:4312/nodics/editorial',
          },
        ],
        media: [
          {
            ...wcmsImport,
            moduleName: 'media',
            instanceId: 'media-owner',
            endpoint: 'http://localhost:4312/nodics/media',
          },
        ],
        profile: [],
        system: [],
      },
    });
    await user.click(await screen.findByRole('tab', { name: 'File imports' }));
    await user.click(await screen.findByRole('combobox', { name: 'Target model' }));
    await user.click(await screen.findByText('Editorial Author'));
    const input = rendered.container.querySelector('input[type="file"]');
    await user.upload(
      input as HTMLInputElement,
      new File(['[{"code":"author"}]'], 'author.json', { type: 'application/json' }),
    );
    await user.click(screen.getByRole('button', { name: 'Upload to media' }));
    await screen.findByText('Media: author-source');
    await user.click(screen.getByRole('button', { name: 'Validate file import' }));
    await waitFor(() =>
      expect(
        fetched.mock.calls.some(([input]) =>
          fetchInputUrl(input).endsWith('/import/v0/media'),
        ),
      ).toBe(true),
    );
    const validationCalls = fetched.mock.calls.filter(([input]) =>
      fetchInputUrl(input).endsWith('/import/v0/media'),
    );
    expect(validationCalls).toHaveLength(1);
    expect(fetchInputUrl(validationCalls[0]![0])).toBe(
      'http://localhost:4312/nodics/import/v0/media',
    );
    const validationBody = validationCalls[0]![1]?.body;
    if (typeof validationBody !== 'string')
      throw new Error('Expected a JSON validation body');
    expect(JSON.parse(validationBody)).toMatchObject({
      moduleName: 'editorial',
      schemaName: 'editorialAuthor',
      mediaCode: 'author-source',
      validationOnly: true,
    });
  });

  it('explains an unavailable model instead of sending its file to another Staged runtime', async () => {
    const settings = fileIntakeBootstrap();
    const wrongImport = {
      ...settings.moduleConnections.import![1]!,
      server: 'commerceStagedServer',
      instanceId: 'commerce-staged-import',
      endpoint: 'http://localhost:4352/nodics/import',
      runtimeRole: { code: 'COMMERCE_STAGED', publication: 'STAGED' },
    };
    const fetched = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) =>
        Promise.resolve(
          jsonResponse(
            fetchInputUrl(input).endsWith('/schemas')
              ? { schemas: [tenantSchema] }
              : [],
          ),
        ),
      );
    const user = userEvent.setup();
    renderPage({
      ...settings,
      moduleConnections: { ...settings.moduleConnections, import: [wrongImport] },
    });
    await user.click(await screen.findByRole('tab', { name: 'File imports' }));
    await user.click(await screen.findByRole('combobox', { name: 'Target model' }));
    expect(
      await screen.findByRole('option', { name: /File import unavailable/ }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Choose file' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(
      fetched.mock.calls.filter(([input]) =>
        /\/storage\/upload|\/import\/v0\/media/.test(fetchInputUrl(input)),
      ),
    ).toHaveLength(0);
  });

  it('renders backend-owned generic file import workflow from discovered schemas', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/schemas')) {
        return Promise.resolve(
          jsonResponse({
            schemas: [tenantSchema],
          }),
        );
      }
      if (url === 'http://localhost:4312/nodics/import/v0/core')
        return Promise.resolve(jsonResponse([currentRelease]));
      if (url.endsWith('/init') || url.endsWith('/sample')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    renderFileIntakePage();
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

  it('retains model previews while generation services are at a different runtime', async () => {
    const fetched = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/schemas')) {
        return Promise.resolve(
          jsonResponse({
            schemas: [tenantSchema],
          }),
        );
      }
      if (url === 'http://localhost:4312/nodics/import/v0/core')
        return Promise.resolve(jsonResponse([currentRelease]));
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
    await user.click(screen.getByText('Tenant records'));
    expect(screen.getByRole('button', { name: 'Generate export' })).toBeDisabled();
    expect(
      fetched.mock.calls.filter(([input]) =>
        fetchInputUrl(input).endsWith('/export/v0/workspace'),
      ),
    ).toHaveLength(0);
  });

  it('holds generation on owner opt-out and failed availability refresh; recovery performs GET only', async () => {
    let availability: 'DISABLED' | 'AVAILABLE' | 'ERROR' = 'DISABLED';
    const fetched = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/schemas'))
        return Promise.resolve(jsonResponse({ schemas: [tenantSchema] }));
      if (url.endsWith('/workspace')) {
        if (availability === 'ERROR')
          return Promise.resolve(
            new Response(JSON.stringify({ message: 'Availability read failed' }), {
              status: 503,
            }),
          );
        return Promise.resolve(
          jsonResponse({
            contractVersion: 1,
            kind: 'GOVERNED_EXPORT',
            availability,
            formats: ['json'],
            ...(availability === 'DISABLED'
              ? { reason: 'File export is not enabled in this workspace.' }
              : {}),
          }),
        );
      }
      if (url.endsWith('/safe-search'))
        return Promise.resolve(
          jsonResponse({
            records: [{ code: 'export-review' }],
            totalCount: 1,
            pageNumber: 1,
            pageSize: 10,
            sort: { field: 'code', direction: 'ASC' },
          }),
        );
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();
    renderPage(exportIntakeBootstrap());
    await user.click(await screen.findByRole('tab', { name: 'Exports' }));
    await user.click(await screen.findByRole('combobox', { name: 'Export model' }));
    await user.click(await screen.findByText('Tenant records'));
    expect(
      await screen.findByText('File export is not enabled in this workspace.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Generate export' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Preview records' }));
    expect(await screen.findByText('export-review')).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Export$/ })).toBeNull();
    availability = 'AVAILABLE';
    await user.click(
      screen.getByRole('button', { name: 'Refresh export availability' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Generate export' })).toBeEnabled(),
    );
    expect(screen.getByRole('combobox', { name: 'File type' })).toHaveTextContent(
      'JSON',
    );
    availability = 'ERROR';
    await user.click(
      screen.getByRole('button', { name: 'Refresh export availability' }),
    );
    expect(
      await screen.findByText(/Export availability could not be verified/),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Generate export' })).toBeDisabled();
    availability = 'AVAILABLE';
    await user.click(
      screen.getByRole('button', { name: 'Refresh export availability' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Generate export' })).toBeEnabled(),
    );
    expect(
      fetched.mock.calls.filter(([input]) =>
        fetchInputUrl(input).endsWith('/export/v0/export'),
      ),
    ).toHaveLength(0);
    expect(
      fetched.mock.calls
        .filter(([input]) => fetchInputUrl(input).endsWith('/workspace'))
        .every(
          ([, options]) => options?.method === 'GET' && options.body === undefined,
        ),
    ).toBe(true);
  });

  it('locks generation intent and retires old actor results without replay', async () => {
    let complete: ((response: Response) => void) | undefined;
    let schemaReads = 0;
    let generations = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/schemas')) {
        schemaReads++;
        return Promise.resolve(jsonResponse({ schemas: [tenantSchema] }));
      }
      if (url.endsWith('/workspace'))
        return Promise.resolve(
          jsonResponse({
            contractVersion: 1,
            kind: 'GOVERNED_EXPORT',
            availability: 'AVAILABLE',
            formats: ['json'],
          }),
        );
      if (url.endsWith('/export/v0/export')) {
        generations++;
        return new Promise<Response>((resolve) => {
          complete = resolve;
        });
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();
    const settings = exportIntakeBootstrap();
    const rendered = renderPage(settings);
    await user.click(await screen.findByRole('tab', { name: 'Exports' }));
    await user.click(await screen.findByRole('combobox', { name: 'Export model' }));
    await user.click(await screen.findByText('Tenant records'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Generate export' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Generate export' }));
    await waitFor(() => expect(complete).toBeTypeOf('function'));
    expect(screen.getByRole('combobox', { name: 'Export model' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Target enterprise' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('textbox', { name: 'Search records' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Refresh export availability' }),
    ).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'File imports' })).toBeDisabled();
    const before = schemaReads;
    rendered.refreshBootstrap(settings, 'another-employee-token');
    await waitFor(() => expect(schemaReads).toBeGreaterThan(before));
    expect(await screen.findByRole('combobox', { name: 'Export model' })).toHaveValue(
      '',
    );
    await act(async () => {
      complete?.(
        jsonResponse({
          moduleName: 'profile',
          schemaName: 'tenant',
          format: 'json',
          fileName: 'old-actor.json',
          media: { mediaCode: 'old-actor-export', name: 'Old actor export' },
          summary: {
            requestedRecords: 1,
            exportedRecords: 1,
            totalAvailableRecords: 1,
            truncated: false,
          },
        }),
      );
      await Promise.resolve();
    });
    expect(
      screen.queryByRole('button', { name: 'Download generated file' }),
    ).toBeNull();
    expect(screen.queryByText(/old-actor.json/)).toBeNull();
    expect(generations).toBe(1);
  });

  it.each([false, true])(
    'delivers a completed download only while its original actor is current (retire=%s)',
    async (retire) => {
      let finishDownload: ((response: Response) => void) | undefined;
      const createObjectUrl = vi.fn(() => 'blob:controlled-export');
      vi.stubGlobal(
        'URL',
        class extends URL {
          static createObjectURL = createObjectUrl;
          static revokeObjectURL = vi.fn();
        },
      );
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);
      try {
        vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
          const url = fetchInputUrl(input);
          if (url.endsWith('/schemas'))
            return Promise.resolve(jsonResponse({ schemas: [tenantSchema] }));
          if (url.endsWith('/workspace'))
            return Promise.resolve(
              jsonResponse({
                contractVersion: 1,
                kind: 'GOVERNED_EXPORT',
                availability: 'AVAILABLE',
                formats: ['json'],
              }),
            );
          if (url.endsWith('/export/v0/export'))
            return Promise.resolve(
              jsonResponse({
                moduleName: 'profile',
                schemaName: 'tenant',
                format: 'json',
                fileName: 'controlled-export.json',
                media: { mediaCode: 'controlled-export', name: 'Controlled export' },
                summary: {
                  requestedRecords: 1,
                  exportedRecords: 1,
                  totalAvailableRecords: 1,
                  truncated: false,
                },
              }),
            );
          if (url.endsWith('/download/controlled-export'))
            return new Promise<Response>((resolve) => {
              finishDownload = resolve;
            });
          return Promise.resolve(jsonResponse([]));
        });
        const user = userEvent.setup(),
          settings = exportIntakeBootstrap(),
          view = renderPage(settings);
        await user.click(await screen.findByRole('tab', { name: 'Exports' }));
        await user.click(await screen.findByRole('combobox', { name: 'Export model' }));
        await user.click(await screen.findByText('Tenant records'));
        await waitFor(() =>
          expect(screen.getByRole('button', { name: 'Generate export' })).toBeEnabled(),
        );
        await user.click(screen.getByRole('button', { name: 'Generate export' }));
        await user.click(
          await screen.findByRole('button', { name: 'Download generated file' }),
        );
        await waitFor(() => expect(finishDownload).toBeTypeOf('function'));
        if (retire) view.refreshBootstrap(settings, 'replacement-employee-token');
        await act(async () => {
          finishDownload?.(
            new Response('[{"code":"controlled"}]', {
              headers: {
                'content-type': 'application/json',
                'content-disposition': 'attachment; filename="controlled-export.json"',
              },
            }),
          );
          await Promise.resolve();
        });
        await waitFor(() =>
          expect(createObjectUrl).toHaveBeenCalledTimes(retire ? 0 : 1),
        );
        expect(click).toHaveBeenCalledTimes(retire ? 0 : 1);
        if (retire)
          expect(
            screen.queryByRole('button', { name: 'Download generated file' }),
          ).toBeNull();
      } finally {
        vi.unstubAllGlobals();
      }
    },
  );

  it.each(['acknowledged', 'uncertain'] as const)(
    'retires file installation intent after an %s attempt',
    async (outcome) => {
      let installations = 0;
      const inspected: string[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) => {
        const url = fetchInputUrl(input);
        if (url.includes('/run/history')) {
          inspected.push(url);
          expect(options?.method ?? 'GET').toBe('GET');
          const original = {
            runId: 'install-intent-run',
            dataType: 'media',
            status: 'COMPLETED',
            sourceName: 'media:install-intent-source',
          };
          return Promise.resolve(
            jsonResponse(outcome === 'uncertain' ? [original] : original),
          );
        }
        if (url.endsWith('/schemas'))
          return Promise.resolve(jsonResponse({ schemas: [tenantSchema] }));
        if (url.includes('/storage/upload'))
          return Promise.resolve(
            jsonResponse({ code: 'install-intent-source', status: 'READY' }),
          );
        if (url.endsWith('/import/v0/media')) {
          const body: unknown =
            typeof options?.body === 'string' ? JSON.parse(options.body) : {};
          if (
            typeof body === 'object' &&
            body !== null &&
            'validationOnly' in body &&
            body.validationOnly === true
          )
            return Promise.resolve(
              jsonResponse({
                validationOnly: true,
                validationPassed: true,
                validationErrorCount: 0,
              }),
            );
          installations++;
          return Promise.resolve(
            outcome === 'uncertain'
              ? new Response(
                  JSON.stringify({ message: 'Acknowledgement unavailable' }),
                  { status: 503 },
                )
              : jsonResponse({
                  validationOnly: false,
                  importRun: {
                    runId: 'install-intent-run',
                    status: 'COMPLETED',
                    summary: {
                      recordsDispatched: 1,
                      recordsSucceeded: 1,
                      recordsFailed: 0,
                    },
                  },
                }),
          );
        }
        return Promise.resolve(jsonResponse([]));
      });
      const user = userEvent.setup();
      const rendered = renderFileIntakePage();
      await user.click(await screen.findByRole('tab', { name: 'File imports' }));
      await user.click(await screen.findByRole('combobox', { name: 'Target model' }));
      await user.click(await screen.findByText('Tenant records'));
      await user.upload(
        rendered.container.querySelector('input[type="file"]') as HTMLInputElement,
        new File(['[{"code":"intent"}]'], 'intent.json', { type: 'application/json' }),
      );
      await user.click(screen.getByRole('button', { name: 'Upload to media' }));
      await screen.findByText('Media: install-intent-source');
      await user.click(screen.getByRole('button', { name: 'Validate file import' }));
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Install imported data' }),
        ).toBeEnabled(),
      );
      await user.click(screen.getByRole('button', { name: 'Install imported data' }));
      await screen.findByText(
        outcome === 'uncertain' ? 'Acknowledgement unavailable' : '1 succeeded',
      );
      expect(
        screen.getByRole('button', { name: 'Install imported data' }),
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Validate file import' }),
      ).toBeDisabled();
      await user.click(
        screen.getByRole('button', {
          name: outcome === 'uncertain' ? 'Inspect file attempts' : 'Open import run',
        }),
      );
      await screen.findByText('Run install-intent-run');
      expect(inspected).toHaveLength(1);
      if (outcome === 'uncertain') {
        expect(inspected[0]).toContain('mediaCode=install-intent-source');
      } else {
        expect(inspected[0]).toMatch(/\/run\/history\/install-intent-run$/);
        expect(screen.queryByText('Run unrelated-run')).not.toBeInTheDocument();
      }
      expect(installations).toBe(1);
    },
  );

  it('keeps file intake intent and area fixed until the upload acknowledges', async () => {
    let acknowledgeUpload: ((response: Response) => void) | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/schemas')) {
        return Promise.resolve(jsonResponse({ schemas: [tenantSchema] }));
      }
      if (url.includes('/storage/upload')) {
        return new Promise<Response>((resolve) => {
          acknowledgeUpload = resolve;
        });
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();
    const rendered = renderFileIntakePage();
    await user.click(await screen.findByRole('tab', { name: 'File imports' }));
    await user.click(await screen.findByRole('combobox', { name: 'Target model' }));
    await user.click(await screen.findByText('Tenant records'));
    const input = rendered.container.querySelector('input[type="file"]');
    expect(input).toBeInstanceOf(HTMLInputElement);
    await user.upload(
      input as HTMLInputElement,
      new File(['[{"code":"intake-review"}]'], 'intake-review.json', {
        type: 'application/json',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Upload to media' }));
    await waitFor(() => expect(acknowledgeUpload).toBeTypeOf('function'));
    expect(screen.getByRole('combobox', { name: 'Target model' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Target enterprise' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Choose file' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Exports' })).toBeDisabled();
    await act(async () => {
      acknowledgeUpload?.(
        jsonResponse({
          code: 'intake-review-media',
          originalFileName: 'intake-review.json',
          status: 'READY',
        }),
      );
      await Promise.resolve();
    });
    expect(await screen.findByText('Media: intake-review-media')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Target model' })).toBeEnabled();
    expect(input).toBeEnabled();
    expect(screen.getByRole('tab', { name: 'Exports' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Validate file import' })).toBeEnabled();
  });

  it('retires file intent and schema reads when the actor changes in the same enterprise', async () => {
    let acknowledgeUpload: ((response: Response) => void) | undefined;
    let schemaReads = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/schemas')) {
        schemaReads += 1;
        return Promise.resolve(jsonResponse({ schemas: [tenantSchema] }));
      }
      if (url.includes('/storage/upload')) {
        return new Promise<Response>((resolve) => {
          acknowledgeUpload = resolve;
        });
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();
    const rendered = renderFileIntakePage();
    await user.click(await screen.findByRole('tab', { name: 'File imports' }));
    await user.click(await screen.findByRole('combobox', { name: 'Target model' }));
    await user.click(await screen.findByText('Tenant records'));
    const input = rendered.container.querySelector('input[type="file"]');
    await user.upload(
      input as HTMLInputElement,
      new File(['[{"code":"old-actor"}]'], 'old-actor.json', {
        type: 'application/json',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Upload to media' }));
    await waitFor(() => expect(acknowledgeUpload).toBeTypeOf('function'));
    const before = schemaReads;
    rendered.refreshBootstrap(fileIntakeBootstrap(), 'another-employee-token');
    await waitFor(() => expect(schemaReads).toBeGreaterThan(before));
    expect(await screen.findByRole('combobox', { name: 'Target model' })).toHaveValue(
      '',
    );
    expect(screen.getByText('No file selected')).toBeVisible();
    await act(async () => {
      acknowledgeUpload?.(jsonResponse({ code: 'old-actor-media', status: 'READY' }));
      await Promise.resolve();
    });
    expect(screen.queryByText('Media: old-actor-media')).toBeNull();
    expect(screen.getByRole('button', { name: 'Validate file import' })).toBeDisabled();
  });

  it('enables file validation only after explicit target model selection', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.endsWith('/schemas')) {
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
      if (url === 'http://localhost:4312/nodics/import/v0/core')
        return Promise.resolve(jsonResponse([currentRelease]));
      if (url.endsWith('/init') || url.endsWith('/sample')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();

    const rendered = renderFileIntakePage();
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
