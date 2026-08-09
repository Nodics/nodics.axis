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

function requestUrl(input: RequestInfo | URL): string {
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
        const url = requestUrl(input);
        const method = init?.method ?? 'GET';
        if (method === 'PATCH') {
          return Promise.resolve(
            jsonResponse({
              code: 'sample-approval-process',
              draftRevision: 2,
            }),
          );
        }
        if (method === 'POST' && url.includes('/draft/prepare')) {
          return Promise.resolve(
            jsonResponse({
              code: 'published-onboarding-process',
              currentVersion: 1,
              draftRevision: 3,
              status: 'DRAFT',
            }),
          );
        }
        if (method === 'POST' && url.endsWith('/v0/instances')) {
          return Promise.resolve(
            jsonResponse({
              instance: {
                code: 'published-onboarding-process-001',
                definitionCode: 'published-onboarding-process',
                version: 1,
                status: 'WAITING',
                currentNode: 'businessReview',
              },
              task: {
                code: 'task-1',
                instanceCode: 'published-onboarding-process-001',
                nodeCode: 'businessReview',
                status: 'OPEN',
              },
            }),
          );
        }
        if (method === 'POST' && url.includes('/tasks/task-1/claim')) {
          return Promise.resolve(
            jsonResponse({
              code: 'task-1',
              instanceCode: 'instance-1',
              nodeCode: 'businessReview',
              assignee: 'admin',
              status: 'CLAIMED',
            }),
          );
        }
        if (method === 'POST' && url.includes('/tasks/task-1/complete')) {
          return Promise.resolve(
            jsonResponse({
              task: { code: 'task-1', status: 'COMPLETED' },
              instance: { code: 'instance-1', status: 'COMPLETED' },
            }),
          );
        }
        if (url.includes('/instances/instance-1/detail')) {
          return Promise.resolve(
            jsonResponse({
              instance: {
                code: 'instance-1',
                definitionCode: 'sample-approval-process',
                version: 1,
                status: 'WAITING',
                currentNode: 'businessReview',
              },
              tasks: [
                {
                  code: 'task-1',
                  instanceCode: 'instance-1',
                  nodeCode: 'businessReview',
                  assignee: 'content-admin',
                  status: 'OPEN',
                },
              ],
              auditEvents: [
                {
                  eventType: 'process.instance.started',
                  outcome: 'success',
                  definitionCode: 'sample-approval-process',
                  instanceCode: 'instance-1',
                },
              ],
            }),
          );
        }
        if (url.includes('/versions')) {
          return Promise.resolve(
            jsonResponse([
              {
                code: 'published-onboarding-process_v1',
                definitionCode: 'published-onboarding-process',
                version: 1,
                status: 'PUBLISHED',
                checksum: '1234567890abcdef1234567890abcdef',
                publishedBy: 'publisher',
                publishedAt: '2026-08-09T08:00:00.000Z',
              },
            ]),
          );
        }
        if (url.includes('/instances')) {
          return Promise.resolve(
            jsonResponse([
              {
                code: 'instance-1',
                definitionCode: 'sample-approval-process',
                version: 1,
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
                nodeCode: 'businessReview',
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
        if (url.includes('/triggers')) {
          return Promise.resolve(
            jsonResponse([
              {
                code: 'daily-content-approval',
                definitionCode: 'sample-approval-process',
                triggerType: 'CRON',
                cronJobCode: 'dailyContentApprovalJob',
                status: 'ACTIVE',
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
            {
              code: 'published-onboarding-process',
              name: 'Published onboarding process',
              description: 'An immutable published flow ready for next draft prep.',
              category: 'operations',
              status: 'PUBLISHED',
              currentVersion: 1,
              draftRevision: 2,
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
    expect(screen.getByText('Process instances')).toBeInTheDocument();
    expect(screen.getByText('Task inbox')).toBeInTheDocument();
    expect(screen.getByText('Scheduled triggers')).toBeInTheDocument();
    expect(screen.getByText(/dailyContentApprovalJob/i)).toBeInTheDocument();
    expect(screen.getByText('Edit selected draft')).toBeInTheDocument();
    expect(screen.getByText('Version history')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Version 1')).toBeInTheDocument());
    expect(screen.getByText(/checksum 1234567890abcdef/i)).toBeInTheDocument();
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
            requestUrl(input).includes('/definitions/sample-approval-process/draft') &&
            init?.method === 'PATCH' &&
            typeof body === 'string' &&
            body.includes('Customer onboarding approval')
          );
        }),
      ).toBe(true),
    );

    const prepareButtons = screen.getAllByRole('button', {
      name: 'Prepare next draft',
    });
    const enabledPrepareButton = prepareButtons.find(
      (button) => !(button as HTMLButtonElement).disabled,
    );
    expect(enabledPrepareButton).toBeDefined();
    await user.click(enabledPrepareButton as HTMLButtonElement);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            requestUrl(input).includes(
              '/definitions/published-onboarding-process/draft/prepare',
            ) && init?.method === 'POST',
        ),
      ).toBe(true),
    );

    const startButtons = screen.getAllByRole('button', { name: 'Start process' });
    const enabledStartButton = startButtons.find(
      (button) => !(button as HTMLButtonElement).disabled,
    );
    expect(enabledStartButton).toBeDefined();
    await user.click(enabledStartButton as HTMLButtonElement);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            requestUrl(input).endsWith('/v0/instances') && init?.method === 'POST',
        ),
      ).toBe(true),
    );

    await user.click(screen.getByRole('button', { name: 'View timeline' }));
    await waitFor(() =>
      expect(
        screen.getByText('process.instance.started · success'),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Claim' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            requestUrl(input).includes('/tasks/task-1/claim') &&
            init?.method === 'POST',
        ),
      ).toBe(true),
    );

    await user.click(screen.getByRole('button', { name: 'Complete' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            requestUrl(input).includes('/tasks/task-1/complete') &&
            init?.method === 'POST',
        ),
      ).toBe(true),
    );
  });
});
