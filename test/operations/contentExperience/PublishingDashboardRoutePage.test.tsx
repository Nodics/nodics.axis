import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../../src/bootstrap/publicBootstrap';
import { PublishingDashboardRoutePage } from '../../../src/operations/contentExperience/PublishingDashboardRoutePage';
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

const navigation: AxisNavigationItem = {
  id: 'publishing',
  label: 'Publishing',
  route: '/publishing',
  order: 280,
  moduleName: 'publish',
  category: 'content',
  icon: 'workflow',
  availability: 'UP',
  featureState: 'ACTIVE',
  group: {
    id: 'publishing',
    label: 'Publishing',
    order: 1_700,
  },
  help: {
    summary:
      'Review and manage governed publication from staged authoring content to online delivery state.',
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
  navigation: [navigation],
  environments: ['kickoffLocal'],
  moduleCatalog: {},
  moduleConnections: {
    flowApi: [
      {
        moduleName: 'flowApi',
        instanceId: 'kickoffLocal:processServer:flowApi:0',
        endpoint: 'http://localhost:4330/nodics/process',
        environment: 'kickoffLocal',
        server: 'processServer',
        state: 'UP',
      },
    ],
    workflow: [
      {
        moduleName: 'workflow',
        instanceId: 'kickoffLocal:processServer:workflow:0',
        endpoint: 'http://localhost:4330/nodics/workflow',
        environment: 'kickoffLocal',
        server: 'processServer',
        state: 'UP',
      },
    ],
    publish: [
      {
        moduleName: 'publish',
        instanceId: 'kickoffLocal:wcmsStagedServer:publish:0',
        endpoint: 'http://localhost:4312/nodics/publish',
        environment: 'kickoffLocal',
        server: 'wcmsStagedServer',
        state: 'UP',
      },
    ],
  },
  documentationSources: [],
  tenantCode: 'default',
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ result: { items: [] } })),
  );
  return render(
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PublishingDashboardRoutePage
            accessToken="employee-token"
            bootstrap={bootstrap}
            routeNavigation={navigation}
            runtime={runtime}
          />
        </MemoryRouter>
      </QueryClientProvider>
    </AxisThemeProvider>,
  );
}

describe('PublishingDashboardRoutePage', () => {
  it('makes approval review discoverable from the Publishing workspace', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Publishing' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Approval tasks' })).toBeTruthy();
    expect(await screen.findByText('0 pending')).toBeTruthy();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      new URL('http://localhost:4330/nodics/process/v0/tasks?limit=25'),
      expect.any(Object),
    );
    expect(screen.getByRole('link', { name: 'Review approval tasks' })).toHaveAttribute(
      'href',
      '/process/tasks',
    );
    expect(screen.getByRole('link', { name: 'Check Online status' })).toHaveAttribute(
      'href',
      '/publishing/status',
    );
  });
});
