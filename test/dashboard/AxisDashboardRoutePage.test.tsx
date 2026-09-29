import {
  dashboardFixture,
  mergedDashboardFixture,
  completeApplicationsFixture,
  fullMergedApplicationsFixture,
} from './dashboardCompositionFixture';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxisThemeProvider } from '../../src/app/AxisThemeProvider';
import { AxisDashboardRoutePage } from '../../src/dashboard/AxisDashboardRoutePage';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';

const runtime: AxisRuntimeConfig = {
  backofficeBaseUrl: 'http://localhost:4300',
  enterpriseCode: 'default',
  projectCode: 'test.project',
  clientContractVersion: 1,
  requestTimeoutMs: 1000,
  browserSessionCsrfCookieName: 'csrf',
  assistantMaximumEventBytes: 1024,
  assistantReconnectWindowMs: 1000,
  assistantIdleTimeoutMs: 1000,
};
const profile = {
  code: 'newservice',
  title: 'Partner service',
  kind: 'SERVICE',
  category: 'New category',
  summary: 'A newly contributed business service',
  order: 1,
  type: 'NEW_SERVICE',
  owner: 'partner',
  applicationCode: 'newService',
  siteCode: 'newSite',
  baselineCode: 'newBaseline',
  requiredServers: [],
  dataPackages: [],
  activationPolicy: {
    approvalRequiredForOnline: true,
    requiredDataTrigger: 'ACTIVATION',
    sampleDataTrigger: 'USER',
  },
  setupPlan: {
    contractVersion: 1 as const,
    stages: [
      {
        code: 'partner',
        title: 'Partner requirements',
        summary: 'Requirements from the owning module',
        items: [
          {
            code: 'terms',
            label: 'Review partner terms',
            required: false,
            type: 'REVIEW',
            owner: 'partner',
          },
        ],
      },
    ],
  },
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
      id: 'setup-accelerators',
      label: 'Setup',
      icon: 'settings',
      route: '/setup-accelerators',
      order: 1,
      moduleName: 'backoffice',
      category: 'system',
      availability: 'UP',
    },
  ],
  moduleCatalog: {},
  environments: ['test'],
  tenantCode: 'default',
  documentationSources: [],
  moduleConnections: {
    backoffice: [
      {
        moduleName: 'backoffice',
        instanceId: 'test-platform',
        endpoint: 'http://localhost:4300/nodics/backoffice',
        environment: 'test',
        state: 'UP',
      },
    ],
  },
  applicationInitializationProfiles: [profile],
};
function Location() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}
function renderPage(
  value = bootstrap,
  path = '/dashboard?view=applications',
  composition = dashboardFixture,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AxisThemeProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <AxisDashboardRoutePage
            composition={composition}
            accessToken="test-token"
            bootstrap={value}
            runtime={runtime}
          />
          <Location />
        </MemoryRouter>
      </QueryClientProvider>
    </AxisThemeProvider>,
  );
}
function mockStatus() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        data: {
          profileCode: profile.code,
          type: profile.type,
          owner: profile.owner,
          applicationCode: profile.applicationCode,
          siteCode: profile.siteCode,
          readiness: 'BLOCKED',
          releaseCode: 'release',
          releaseVersion: '1',
          allowedActions: [],
        },
      }),
      { status: 200 },
    ),
  );
}
afterEach(() => vi.restoreAllMocks());
describe('Application-first dashboard', () => {
  it('keeps environment guidance reachable in the complete Applications journey', async () => {
    mockStatus();
    renderPage(
      {
        ...bootstrap,
        startupValidation: {
          state: 'NEEDS_ATTENTION',
          checkedAt: '2026-09-26T00:00:00Z',
          source: 'test',
          summary: {
            total: 1,
            errors: 0,
            warnings: 1,
            info: 0,
            dismissible: 0,
            acknowledged: 0,
          },
          bootstrapChecks: {
            total: 0,
            ready: 0,
            missing: 0,
            needsAttention: 0,
            checks: [],
          },
          findings: [
            {
              code: 'DEFAULT_CREDENTIAL',
              severity: 'WARNING',
              owner: 'profile',
              ownerType: 'MODULE',
              message: 'Default credential requires review',
              action: 'Update through the owning configuration authority',
              dismissible: false,
              auditRequired: true,
            },
          ],
        },
      },
      '/dashboard?view=applications',
      completeApplicationsFixture,
    );
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: /Review environment settings/ }),
    );
    expect(
      screen.getAllByText('Update through the owning configuration authority').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', { name: 'Review diagnostic details' }),
    ).toBeEnabled();
  });
  it('retains the full setup catalogue alongside summary without a duplicate carousel', async () => {
    const fetch = mockStatus();
    renderPage(bootstrap, '/dashboard?view=applications', completeApplicationsFixture);
    expect(screen.getByRole('heading', { name: 'At a glance' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Available applications' });
    expect(within(list).getByText(profile.summary)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: profile.title })).toHaveLength(1);
    expect(
      screen.queryByRole('region', { name: 'Your applications' }),
    ).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(
      screen.getByRole('textbox', { name: 'Search applications' }),
      'absent',
    );
    expect(screen.getByText('No matching applications')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.click(screen.getByRole('button', { name: 'Review Partner service' }));
    const drawer = screen.getByRole('dialog', { name: profile.title });
    expect(within(drawer).getByText('Partner requirements')).toBeInTheDocument();
    expect(within(drawer).getByText('Review partner terms')).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Continue to setup' }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/setup-accelerators?profile=newservice',
    );
    expect(fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
  });
  it('restores all six operational boxes and searchable artwork without losing the setup journey', async () => {
    const fetch = mockStatus();
    renderPage(
      bootstrap,
      '/dashboard?view=applications',
      fullMergedApplicationsFixture,
    );
    const pulse = screen.getByRole('region', { name: 'Operational pulse' });
    for (const title of [
      'Connected services',
      'Business data',
      'Approval workload',
      'Media library',
      'Search & discovery',
      'Knowledge & assistance',
    ])
      expect(within(pulse).getByRole('heading', { name: title })).toBeInTheDocument();
    expect(within(pulse).getAllByText('Not verified')).toHaveLength(6);
    expect(within(pulse).queryByRole('link')).not.toBeInTheDocument();
    const strip = screen.getAllByRole('region', { name: 'Your applications' })[0]!;
    expect(within(strip).getByText(profile.summary)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: profile.title })).toHaveLength(1);
    const user = userEvent.setup();
    await user.type(
      screen.getByRole('textbox', { name: 'Search applications' }),
      'absent',
    );
    expect(screen.getByText('No matching applications')).toBeInTheDocument();
    expect(
      within(pulse).getByRole('heading', { name: 'Media library' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.click(within(strip).getByRole('button', { name: 'Review setup' }));
    const drawer = screen.getByRole('dialog', { name: profile.title });
    expect(within(drawer).getByText('Partner requirements')).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Continue to setup' }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/setup-accelerators?profile=newservice',
    );
    expect(
      fetch.mock.calls.every(([, init]) => (init?.method ?? 'GET') === 'GET'),
    ).toBe(true);
  });
  it('merges summaries with one searchable card list and the existing setup drawer', async () => {
    const fetch = mockStatus();
    renderPage(bootstrap, '/dashboard?view=applications', mergedDashboardFixture);
    expect(screen.getByRole('heading', { name: 'At a glance' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Application readiness' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Partner service' })).toHaveLength(1);
    expect(
      screen.queryByRole('list', { name: 'Available applications' }),
    ).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(
      screen.getByRole('textbox', { name: 'Search applications' }),
      'absent',
    );
    expect(
      screen.queryByRole('heading', { name: 'Partner service' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('No matching applications')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    const strip = screen.getAllByRole('region', { name: 'Your applications' })[0]!;
    await user.click(within(strip).getByRole('button', { name: 'Review setup' }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      'view=applications&offering=newservice',
    );
    expect(screen.getByRole('dialog', { name: 'Partner service' })).toBeInTheDocument();
    expect(fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
  });
  it('opens the CMS default Overview and reviews an application without starting setup', async () => {
    const fetch = mockStatus();
    renderPage(bootstrap, '/dashboard');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByText('Available to set up')).toBeInTheDocument();
    const applicationStrip = screen.getAllByRole('region', {
      name: 'Your applications',
    })[0]!;
    await userEvent.click(
      within(applicationStrip).getByRole('button', { name: 'Review setup' }),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('view=applications');
    expect(screen.getByRole('dialog', { name: 'Partner service' })).toBeInTheDocument();
    expect(fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
  });
  it('does not expose Overview review actions when CMS removes the detail section', async () => {
    mockStatus();
    const composition = {
      ...dashboardFixture,
      components: dashboardFixture.components.map((tab) => ({
        ...tab,
        components: tab.components.filter(
          (section) => section.properties.kind !== 'details',
        ),
      })),
    };
    renderPage(bootstrap, '/dashboard', composition);
    expect(await screen.findByText('Available to set up')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Review setup' }),
    ).not.toBeInTheDocument();
  });
  it('discovers a new category and owner plan without executing setup', async () => {
    const fetch = mockStatus();
    renderPage();
    const user = userEvent.setup();
    expect(await screen.findByText('Requirements to review')).toBeInTheDocument();
    expect(screen.queryByText('Fix these first')).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Category' }));
    await user.click(screen.getByRole('option', { name: 'New category' }));
    await user.click(screen.getByRole('button', { name: 'Review Partner service' }));
    const drawer = screen.getByRole('dialog', { name: 'Partner service' });
    expect(within(drawer).getByText('Partner requirements')).toBeInTheDocument();
    expect(within(drawer).getByText('Review partner terms')).toBeInTheDocument();
    expect(within(drawer).getByText('Optional')).toBeInTheDocument();
    expect(fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
    await user.click(within(drawer).getByRole('button', { name: 'Continue to setup' }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/setup-accelerators?profile=newservice',
    );
  });
  it('restores a selected offering from the URL and returns focus when closed', async () => {
    mockStatus();
    renderPage();
    const user = userEvent.setup();
    const button = screen.getByRole('button', { name: 'Review Partner service' });
    await user.click(button);
    expect(screen.getByTestId('location')).toHaveTextContent('offering=newservice');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(button).toHaveFocus();
  });
  it('keeps an unavailable or unauthorized offering non-executable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    renderPage(
      { ...bootstrap, navigation: [] },
      '/dashboard?view=applications&offering=newservice',
    );
    const drawer = screen.getByRole('dialog');
    expect(
      await within(drawer).findByText(
        'Current status could not be checked. Refresh before continuing.',
      ),
    ).toBeInTheDocument();
    expect(
      within(drawer).queryByRole('button', { name: 'Continue to setup' }),
    ).not.toBeInTheDocument();
  });
  it('shows empty search and unknown deep links without inventing an offering', async () => {
    mockStatus();
    renderPage(bootstrap, '/dashboard?view=applications&offering=missing');
    expect(
      screen.getByRole('dialog', { name: 'Offering unavailable' }),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Close setup review' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.type(
      screen.getByRole('textbox', { name: 'Search applications' }),
      'absent',
    );
    expect(screen.getByText('No matching applications')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(
      screen.getByRole('button', { name: 'Review Partner service' }),
    ).toBeInTheDocument();
  });
});
