import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../../src/bootstrap/publicBootstrap';
import { ProcessWorkflowRoutePage } from '../../../src/operations/processWorkflow/ProcessWorkflowRoutePage';
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
  id: 'process-workflows',
  label: 'Processes',
  route: '/process',
  order: 500,
  moduleName: 'process',
  category: 'operations',
  icon: 'workflow',
  availability: 'UP',
  featureState: 'PREVIEW',
  group: {
    id: 'business-process-automation',
    label: 'Business Process & Automation',
    order: 500,
  },
  help: {
    summary:
      'Design, govern, publish, and monitor business process and workflow definitions owned by nodics.process.',
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
    process: [
      {
        moduleName: 'process',
        instanceId: 'kickoffLocal:processServer:process:0',
        endpoint: 'http://localhost:4330/nodics/process',
        environment: 'kickoffLocal',
        server: 'processServer',
        state: 'UP',
      },
    ],
  },
  documentationSources: [],
  tenantCode: 'default',
};

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ProcessWorkflowRoutePage
          accessToken="employee-token"
          bootstrap={bootstrap}
          navigation={navigation}
          runtime={runtime}
        />
      </QueryClientProvider>
    </AxisThemeProvider>,
  );
}

describe('ProcessWorkflowRoutePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('guides business users through backend-owned process lifecycle steps', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (method === 'PATCH') {
          return Promise.resolve(
            jsonResponse({
              code: 'sample-approval-process',
              draftRevision: 2,
            }),
          );
        }
        if (url.includes('/instances')) {
          return Promise.resolve(
            jsonResponse([
              {
                code: 'instance-1',
                definitionCode: 'sample-approval-process',
                status: 'RUNNING',
                currentNode: 'businessReview',
              },
            ]),
          );
        }
        if (url.includes('/tasks')) {
          return Promise.resolve(
            jsonResponse([
              {
                code: 'task-1',
                instanceCode: 'instance-1',
                assignee: 'content-admin',
                status: 'OPEN',
              },
            ]),
          );
        }
        if (url.includes('/audit-events')) {
          return Promise.resolve(
            jsonResponse([
              {
                eventType: 'task.created',
                outcome: 'success',
                definitionCode: 'sample-approval-process',
                instanceCode: 'instance-1',
              },
            ]),
          );
        }
        return Promise.resolve(
          jsonResponse([
            {
              code: 'sample-approval-process',
              name: 'Sample approval process',
              description: 'A governed approval flow for business review.',
              category: 'operations',
              status: 'DRAFT',
              currentVersion: 0,
              draftRevision: 1,
              graph: {
                nodes: [
                  { code: 'start', type: 'START', name: 'Start' },
                  { code: 'businessReview', type: 'TASK', name: 'Business review' },
                  { code: 'end', type: 'END', name: 'End' },
                ],
                transitions: [
                  {
                    code: 'start_to_review',
                    source: 'start',
                    target: 'businessReview',
                  },
                  { code: 'review_to_end', source: 'businessReview', target: 'end' },
                ],
              },
              validation: {
                valid: true,
                nodeCount: 3,
                transitionCount: 2,
                issues: [],
              },
            },
          ]),
        );
      });

    renderPage();

    expect(screen.getByText('Business Process & Automation')).toBeInTheDocument();
    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('Validate')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
    expect(screen.getByText('Automate')).toBeInTheDocument();
    expect(
      screen.getByText(/business users can model and review/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Create a beginner-safe process draft'),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText('Sample approval process')).toBeInTheDocument(),
    );
    expect(screen.getByText('Definitions')).toBeInTheDocument();
    expect(screen.getByText('Drafts')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Selected issues')).toBeInTheDocument();
    expect(screen.getByText('Runtime operations overview')).toBeInTheDocument();
    expect(screen.getByText('Running instances')).toBeInTheDocument();
    expect(screen.getByText('Open tasks')).toBeInTheDocument();
    expect(screen.getByText('Audit events')).toBeInTheDocument();
    expect(screen.getByText('Edit selected draft')).toBeInTheDocument();
    expect(screen.getByText(/validation and runtime truth stay/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Process name'));
    await user.type(
      screen.getByLabelText('Process name'),
      'Customer onboarding approval',
    );
    await user.click(screen.getByRole('button', { name: 'Save draft changes' }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          const body = init?.body;
          return (
            String(input).includes('/definitions/sample-approval-process/draft') &&
            init?.method === 'PATCH' &&
            typeof body === 'string' &&
            body.includes('Customer onboarding approval')
          );
        }),
      ).toBe(true),
    );
  });
});
