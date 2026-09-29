import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxisThemeProvider } from '../../src/app/AxisThemeProvider';
import { AxisFrameworkOverview } from '../../src/dashboard/AxisFrameworkOverview';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';
import { loadWorkbenchMetrics } from '../../src/operations/shared/workbenchMetricDashboardModel';
import { loadProcessOperationsSummary } from '../../src/operations/processWorkflow/api/processDefinitionClient';
import { dashboardFixture } from './dashboardCompositionFixture';

vi.mock(
  '../../src/operations/shared/workbenchMetricDashboardModel',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../src/operations/shared/workbenchMetricDashboardModel')
    >()),
    loadWorkbenchMetrics: vi.fn(),
  }),
);
vi.mock('../../src/operations/processWorkflow/api/processDefinitionClient', () => ({
  loadProcessOperationsSummary: vi.fn(),
}));
const base = dashboardFixture.components[0]!.components[0]!;
const context = {
  ...base,
  code: 'context',
  properties: {
    kind: 'context',
    title: 'Your business at a glance',
    scope: 'Current enterprise scope',
    refresh: 'Refresh business overview',
    taskNavigationRef: 'publish:tasks',
    search: 'Find a dashboard or workspace',
    openDashboard: 'Open workspace',
    allViews: 'All views',
    close: 'Close workspace directory',
    destinations: 'available views',
    records: 'accessible records',
    unavailable: 'Data unavailable',
    updated: 'Updated',
    noMetrics: 'No business snapshots',
    noDomains: 'No business dashboards',
    noResults: 'No matching dashboards',
    workUnavailable: 'Work summaries unavailable',
    openWork: 'Open work queue',
    escalated: 'escalated',
    overdue: 'overdue in this sample',
    due: 'Due',
    noTasks: 'No open tasks in the current sample',
    bounded: 'Recent authorised sample, not an organisation-wide total',
    observedTasks: 'tasks observed',
    observedProcesses: 'processes observed',
    noActivity: 'No activity in sample',
    noExceptions: 'No exceptions in sample',
  },
};
const sections = [
  context,
  ...[
    {
      kind: 'pulse',
      title: 'Business record snapshot',
      description: 'Accessible records',
      navigationRefs: ['order:orders'],
    },
    {
      kind: 'domains',
      title: 'Your business dashboards',
      description: 'Domain views',
      excludedGroups: ['system'],
    },
    { kind: 'work', title: 'Decisions & work', description: 'Authorised tasks' },
    {
      kind: 'activity',
      title: 'Work activity',
      description: 'Recent task distribution',
    },
    {
      kind: 'exceptions',
      title: 'Business process exceptions',
      description: 'Owner exceptions',
    },
  ].map((properties) => ({ ...base, code: properties.kind, properties })),
];
const nav = {
  id: 'orders',
  moduleName: 'order',
  label: 'Orders',
  route: '/orders',
  order: 1,
  category: 'commerce',
  icon: 'commerce',
  availability: 'UP' as const,
  featureState: 'ACTIVE' as const,
  group: { id: 'commerce', label: 'Commerce', order: 1 },
  workbenchTarget: { moduleName: 'order', schemaName: 'commerceOrder' },
};
const bootstrap: AxisAuthenticatedBootstrap = {
  tenantCode: 'test',
  axisPolicy: {
    contractVersion: 1,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 1,
    source: 'DEFAULT',
  },
  navigation: [
    nav,
    { ...nav, id: 'returns', label: 'Returns', route: '/returns', parentId: 'orders' },
    {
      ...nav,
      id: 'tasks',
      label: 'Task queue',
      route: '/tasks',
      moduleName: 'publish',
      group: { id: 'system', label: 'System', order: 10 },
      workbenchTarget: undefined,
    },
  ],
  moduleConnections: {
    workflow: [
      {
        moduleName: 'workflow',
        instanceId: 'process',
        endpoint: 'http://localhost:9999/nodics/workflow',
        environment: 'test',
        state: 'UP',
        runtimeRole: { code: 'PROCESS', publication: 'NONE' },
      },
    ],
  },
  moduleCatalog: {},
  environments: [],
  documentationSources: [],
};
const runtime: AxisRuntimeConfig = {
  backofficeBaseUrl: 'http://localhost:4300',
  enterpriseCode: 'example',
  projectCode: 'example.project',
  clientContractVersion: 1,
  requestTimeoutMs: 1000,
  browserSessionCsrfCookieName: 'csrf',
  assistantMaximumEventBytes: 1024,
  assistantReconnectWindowMs: 1000,
  assistantIdleTimeoutMs: 1000,
};
function Location() {
  return <output aria-label="Current route">{useLocation().pathname}</output>;
}
function mount(value = bootstrap) {
  return render(
    <AxisThemeProvider>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <AxisFrameworkOverview
            accessToken="test-principal"
            bootstrap={value}
            runtime={runtime}
            sections={sections}
          />
          <Location />
        </MemoryRouter>
      </QueryClientProvider>
    </AxisThemeProvider>,
  );
}
beforeEach(() => {
  vi.mocked(loadWorkbenchMetrics)
    .mockReset()
    .mockResolvedValue([
      {
        id: 'order:orders',
        label: 'Orders',
        moduleName: 'order',
        schemaName: 'commerceOrder',
        description: 'Orders',
        route: '/orders',
        icon: 'commerce',
        status: 'ready',
        detail: 'Orders',
        value: 42,
      },
    ]);
  vi.mocked(loadProcessOperationsSummary)
    .mockReset()
    .mockResolvedValue({
      tasks: [
        {
          code: 'review-1',
          nodeCode: 'Review order',
          instanceCode: 'order-1',
          status: 'OPEN',
          assignee: undefined,
          dueAt: '2020-01-01',
        },
      ],
      instances: [],
      incidents: [],
      triggers: [],
      auditEvents: [],
    });
});
describe('Isolated Framework Overview', () => {
  it('renders owner counts, bounded work and domain navigation without setup or repair controls', async () => {
    mount();
    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(await screen.findByText('Review order')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Commerce' })).toBeInTheDocument();
    expect(
      screen.getAllByText(/not an organisation-wide total/).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Go-live recovery')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /execute|install|publish|activate/i }),
    ).not.toBeInTheDocument();
  });
  it('supports search, full directory and one-click navigation', async () => {
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByLabelText('Find a dashboard or workspace'), 'missing');
    expect(screen.getByText('No matching dashboards')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Find a dashboard or workspace'));
    await user.click(screen.getByRole('button', { name: 'All views' }));
    expect(
      screen.getByRole('button', { name: 'Close workspace directory' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close workspace directory' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Close workspace directory' }),
      ).not.toBeInTheDocument(),
    );
    await user.click(await screen.findByRole('link', { name: 'Open workspace' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/orders');
  });
  it('does not request inaccessible sources or restore their navigation', () => {
    mount({ ...bootstrap, navigation: [] });
    expect(screen.getByText('No business dashboards')).toBeInTheDocument();
    expect(screen.getAllByText('Work summaries unavailable')).toHaveLength(3);
    expect(loadWorkbenchMetrics).not.toHaveBeenCalled();
    expect(loadProcessOperationsSummary).not.toHaveBeenCalled();
  });
  it('keeps source failure distinct from empty queues and refresh can recover', async () => {
    vi.mocked(loadProcessOperationsSummary).mockRejectedValueOnce(
      new Error('HTTP 503'),
    );
    vi.mocked(loadWorkbenchMetrics).mockResolvedValueOnce([]);
    const user = userEvent.setup();
    mount();
    expect((await screen.findAllByText('Work summaries unavailable')).length).toBe(3);
    expect(
      screen.queryByText('No open tasks in the current sample'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Data unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Refresh business overview' }));
    expect(await screen.findByText('Review order')).toBeInTheDocument();
  });
});
