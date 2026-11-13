import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../../src/bootstrap/publicBootstrap';
import { ProcessWorkflowRoutePage } from '../../../src/operations/processWorkflow/ProcessWorkflowRoutePage';
import * as commandCapabilitiesClient from '../../../src/operations/processWorkflow/api/processCommandCapabilitiesClient';
import * as triggerCommandClient from '../../../src/operations/processWorkflow/api/processTriggerCommandClient';
import type { AxisRuntimeConfig } from '../../../src/runtime/runtimeConfig';

const runtime: AxisRuntimeConfig = {
  backofficeBaseUrl: 'http://localhost:4300',
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

const navigation: AxisNavigationItem = {
  id: 'process-workflows',
  label: 'Processes',
  route: '/process',
  order: 500,
  moduleName: 'nodics.process',
  category: 'operations',
  icon: 'workflow',
  availability: 'UP',
  featureState: 'PREVIEW',
  group: {
    id: 'business-process-automation',
    label: 'Process & Automation',
    order: 500,
  },
  help: {
    summary:
      'Design, govern, publish, and monitor business process and workflow definitions owned by nodics.process.',
  },
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
  navigation: [navigation],
  environments: ['kickoffLocal'],
  moduleCatalog: {},
  moduleConnections: {
    workflow: [
      {
        moduleName: 'workflow',
        instanceId: 'kickoffLocal:processServer:workflow:0',
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

const bootstrapWithDocumentationSource: AxisAuthenticatedBootstrap = {
  ...bootstrap,
  moduleConnections: {
    ...bootstrap.moduleConnections,
    backoffice: [
      {
        moduleName: 'backoffice',
        instanceId: 'kickoffLocal:platformServer:backoffice:0',
        endpoint: 'http://localhost:4300/nodics/backoffice',
        environment: 'kickoffLocal',
        server: 'platformServer',
        state: 'UP',
      },
    ],
  },
  documentationSources: [
    {
      id: 'framework',
      label: 'Framework',
      type: 'CMS',
      route: '/docs/framework',
      order: 10,
      ownerModule: 'nodicsDocumentation',
      connectionModule: 'backoffice',
      site: 'frameworkdocs',
      catalog: 'frameworkdocs',
      defaultPage: 'framework-home',
      packCode: 'frameworkDocumentation',
      initializationProfile: 'frameworkdocs',
      dashboard: {
        audiences: ['business', 'developer'],
        summary: 'Framework documentation source.',
      },
    },
  ],
};

function jsonResponse(data: unknown, code = 'SUC_PROCESS_00000'): Response {
  return new Response(
    JSON.stringify({
      code,
      data,
      ...(Array.isArray(data)
        ? {
            pagination: {
              page: 1,
              pageSize: 25,
              total: data.length,
              hasNext: false,
              hasPrevious: false,
            },
          }
        : {}),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function ProcessHistoryProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <aside aria-label="Test router history">
      <output aria-label="Test current location">
        {location.pathname}
        {location.search}
        {location.hash}
      </output>
      <button
        onClick={() => {
          void navigate(-1);
        }}
      >
        Test history back
      </button>
      <button
        onClick={() => {
          void navigate(1);
        }}
      >
        Test history forward
      </button>
      <button
        onClick={() => {
          void navigate(`${location.pathname}?instanceCode=%2Fother`);
        }}
      >
        Test invalid record
      </button>
    </aside>
  );
}

function renderPage(
  path = '/process',
  pageBootstrap: AxisAuthenticatedBootstrap = bootstrap,
  historyProbe = false,
) {
  window.history.pushState({}, '', path);
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const rendered = render(
    <MemoryRouter initialEntries={[path]}>
      {historyProbe ? <ProcessHistoryProbe /> : null}
      <AxisThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ProcessWorkflowRoutePage
            accessToken="employee-token"
            bootstrap={pageBootstrap}
            navigation={navigation}
            runtime={runtime}
          />
        </QueryClientProvider>
      </AxisThemeProvider>
    </MemoryRouter>,
  );
  return { ...rendered, queryClient };
}

describe('ProcessWorkflowRoutePage', () => {
  const authorizedCommand = {
    authorization: 'AUTHORIZED',
    receiptInspection: 'AUTHORIZED',
  } as const;
  const authorizedCommands = {
    contractVersion: 1,
    newRecording: 'DISABLED',
    triggerCommands: {
      create: authorizedCommand,
      update: authorizedCommand,
      archive: authorizedCommand,
      execute: authorizedCommand,
    },
  } as const;
  beforeEach(() => {
    // These route fixtures exercise real native clients. Only the independent
    // metadata read has an explicit default contract; its HTTP/parser has its own suite.
    vi.spyOn(
      commandCapabilitiesClient,
      'loadProcessCommandCapabilities',
    ).mockResolvedValue(authorizedCommands);
  });

  it('withholds only the denied trigger action without inferring authority from an active record', async () => {
    vi.mocked(
      commandCapabilitiesClient.loadProcessCommandCapabilities,
    ).mockResolvedValue({
      ...authorizedCommands,
      triggerCommands: {
        ...authorizedCommands.triggerCommands,
        execute: { authorization: 'DENIED', receiptInspection: 'DENIED' },
      },
    });
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      Promise.resolve(
        jsonResponse(
          requestUrl(input).includes('/triggers')
            ? [
                {
                  code: 'review-job',
                  definitionCode: 'review',
                  triggerType: 'CRON',
                  version: 3,
                  status: 'ACTIVE',
                },
              ]
            : [],
        ),
      ),
    );
    renderPage('/process/triggers');
    await screen.findByText('review-job');
    expect(
      screen.getByText('Some actions are unavailable for this session.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Execute now' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Archive trigger' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Execute now' }));
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('keeps failed command metadata read-only and recovers through an explicit metadata refresh', async () => {
    vi.mocked(commandCapabilitiesClient.loadProcessCommandCapabilities)
      .mockRejectedValueOnce(new Error('metadata unavailable'))
      .mockResolvedValue(authorizedCommands);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      Promise.resolve(
        jsonResponse(
          requestUrl(input).includes('/triggers')
            ? [
                {
                  code: 'review-job',
                  definitionCode: 'review',
                  triggerType: 'CRON',
                  version: 3,
                  status: 'DRAFT',
                },
              ]
            : [],
        ),
      ),
    );
    renderPage('/process/triggers');
    await screen.findByText(
      'Command availability could not be verified. Refresh to check again.',
    );
    expect(screen.getByRole('button', { name: 'Activate' })).toBeDisabled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Refresh relationships' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Activate' })).toBeEnabled(),
    );
    expect(
      commandCapabilitiesClient.loadProcessCommandCapabilities,
    ).toHaveBeenCalledTimes(2);
    expect(
      fetcher.mock.calls.some(([, init]) =>
        ['POST', 'PATCH'].includes(init?.method ?? 'GET'),
      ),
    ).toBe(false);
  });

  it('withholds cached command authority while a refresh is pending and after its grant is removed', async () => {
    let finish:
      | ((data: commandCapabilitiesClient.ProcessCommandCapabilities) => void)
      | undefined;
    vi.mocked(commandCapabilitiesClient.loadProcessCommandCapabilities)
      .mockResolvedValueOnce(authorizedCommands)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      Promise.resolve(
        jsonResponse(
          requestUrl(input).includes('/triggers')
            ? [
                {
                  code: 'review-job',
                  definitionCode: 'review',
                  triggerType: 'CRON',
                  version: 3,
                  status: 'DRAFT',
                },
              ]
            : [],
        ),
      ),
    );
    renderPage('/process/triggers');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Activate' })).toBeEnabled(),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Refresh relationships' }),
    );
    expect(await screen.findByText('Checking command availability.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Activate' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    act(() =>
      finish?.({
        ...authorizedCommands,
        triggerCommands: {
          ...authorizedCommands.triggerCommands,
          update: { authorization: 'DENIED', receiptInspection: 'DENIED' },
        },
      }),
    );
    await screen.findByText('Some actions are unavailable for this session.');
    expect(screen.getByRole('button', { name: 'Activate' })).toBeDisabled();
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });
  it('withholds cached command authority while an explicitly requested read is paused offline', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      Promise.resolve(
        jsonResponse(
          requestUrl(input).includes('/triggers')
            ? [
                {
                  code: 'review-job',
                  definitionCode: 'review',
                  triggerType: 'CRON',
                  version: 3,
                  status: 'DRAFT',
                },
              ]
            : [],
        ),
      ),
    );
    renderPage('/process/triggers');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Activate' })).toBeEnabled(),
    );
    act(() => onlineManager.setOnline(false));
    await userEvent.click(
      screen.getByRole('button', { name: 'Refresh relationships' }),
    );
    expect(await screen.findByText('Checking command availability.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Activate' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    expect(
      commandCapabilitiesClient.loadProcessCommandCapabilities,
    ).toHaveBeenCalledTimes(1);
    act(() => onlineManager.setOnline(true));
    await waitFor(() =>
      expect(
        commandCapabilitiesClient.loadProcessCommandCapabilities,
      ).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Activate' })).toBeEnabled(),
    );
    expect(
      fetcher.mock.calls.some(([, init]) =>
        ['POST', 'PATCH'].includes(init?.method ?? 'GET'),
      ),
    ).toBe(false);
  });

  it('holds a lost response through current-record refresh and unknown receipt, then releases only its original completed receipt even after recording shutdown', async () => {
    vi.mocked(commandCapabilitiesClient.loadProcessCommandCapabilities)
      .mockResolvedValueOnce({ ...authorizedCommands, newRecording: 'ENABLED' })
      .mockResolvedValue(authorizedCommands);
    const inspect = vi
      .spyOn(triggerCommandClient, 'inspectProcessTriggerCommandReceipt')
      .mockResolvedValueOnce({ state: 'OUTCOME_UNKNOWN', triggerCode: 'review-job' })
      .mockResolvedValueOnce({ state: 'COMPLETED', triggerCode: 'review-job' });
    let status = 'DRAFT';
    let sentBody: string | undefined;
    let sentKey: string | undefined;
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (init?.method === 'PATCH') {
        status = 'ACTIVE';
        sentBody = init.body as string;
        sentKey = new Headers(init.headers).get('Idempotency-Key') ?? undefined;
        return Promise.reject(new TypeError('response lost'));
      }
      return Promise.resolve(
        jsonResponse(
          requestUrl(input).includes('/triggers')
            ? [
                {
                  code: 'review-job',
                  definitionCode: 'review',
                  triggerType: 'CRON',
                  version: 3,
                  status,
                },
              ]
            : [],
        ),
      );
    });
    renderPage('/process/triggers');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Activate' })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Activate' }));
    await screen.findByText(/The trigger request is unconfirmed/);
    expect(inspect).not.toHaveBeenCalled();
    expect(sentKey).toMatch(/^axis-trigger-/);
    expect(document.body.textContent).not.toContain(sentKey);
    await userEvent.click(
      screen.getByRole('button', { name: 'Refresh relationships' }),
    );
    await screen.findByText('ACTIVE', { exact: true });
    expect(screen.getByRole('button', { name: 'Execute now' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Archive trigger' })).toBeDisabled();
    expect(inspect).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Inspect original receipt' }),
    );
    await screen.findByText(
      'The original receipt does not confirm completion. The request remains held.',
    );
    expect(screen.getByRole('button', { name: 'Execute now' })).toBeDisabled();
    const originalIntent = inspect.mock.calls[0]?.[2];
    expect(originalIntent?.bodyJson).toBe(sentBody);
    expect(originalIntent?.idempotencyKey).toBe(sentKey);
    await userEvent.click(
      screen.getByRole('button', { name: 'Inspect original receipt' }),
    );
    await screen.findByText('Trigger request acknowledged by Process.');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Execute now' })).toBeEnabled(),
    );
    expect(inspect.mock.calls[1]?.[2]).toBe(originalIntent);
    expect(screen.queryByText('response lost')).not.toBeInTheDocument();
    expect(
      fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH'),
    ).toHaveLength(1);
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('dispatches a repeated activation click once before React updates its controls', async () => {
    let status = 'DRAFT';
    let finish: ((value: Response) => void) | undefined;
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (init?.method === 'PATCH')
        return new Promise((resolve) => {
          finish = resolve;
        });
      return Promise.resolve(
        jsonResponse(
          requestUrl(input).includes('/triggers')
            ? [
                {
                  code: 'review-job',
                  definitionCode: 'review',
                  triggerType: 'CRON',
                  version: 3,
                  status,
                },
              ]
            : [],
        ),
      );
    });
    renderPage('/process/triggers');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Activate' })).toBeEnabled(),
    );
    const activate = screen.getByRole('button', { name: 'Activate' });
    act(() => {
      fireEvent.click(activate);
      fireEvent.click(activate);
    });
    await screen.findByText('Submitting the trigger request.');
    await waitFor(() =>
      expect(
        fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH'),
      ).toHaveLength(1),
    );
    act(() => {
      status = 'ACTIVE';
      finish?.(jsonResponse({ code: 'review-job', status }, 'SUC_PROCESS_00010'));
    });
    await screen.findByText('Trigger request acknowledged by Process.');
    expect(
      screen.queryByText('Another trigger request is pending or unconfirmed'),
    ).not.toBeInTheDocument();
    expect(
      fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH'),
    ).toHaveLength(1);
  });

  it.each([false, true])(
    'retains exact trigger-workflow inquiry without automatic navigation or claiming completion; lost response=%s',
    async (loseResponse) => {
      let requestedInstance: string | undefined;
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input, init) => {
          if (init?.method === 'POST') {
            const body = JSON.parse(init.body as string) as {
              instanceCode: string;
              version: number;
            };
            expect(body.version).toBe(3);
            requestedInstance = body.instanceCode;
            if (loseResponse) return Promise.reject(new TypeError('response lost'));
            return Promise.resolve(
              jsonResponse(
                {
                  trigger: { code: 'review-job', definitionCode: 'review' },
                  execution: {
                    instance: {
                      code: requestedInstance,
                      definitionCode: 'review',
                      version: 3,
                      startCompleted: true,
                      status: 'WAITING',
                    },
                  },
                },
                'SUC_PROCESS_00011',
              ),
            );
          }
          return Promise.resolve(
            jsonResponse(
              requestUrl(input).includes('/triggers')
                ? [
                    {
                      code: 'review-job',
                      definitionCode: 'review',
                      triggerType: 'CRON',
                      version: 3,
                      status: 'ACTIVE',
                    },
                  ]
                : [],
            ),
          );
        });
      renderPage('/process/triggers', bootstrap, true);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Execute now' })).toBeEnabled(),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Execute now' }));
      const link = await screen.findByRole('link', {
        name: loseResponse ? 'Inspect requested workflow' : 'Open triggered workflow',
      });
      if (loseResponse) {
        expect(screen.getByRole('button', { name: 'Execute now' })).toBeDisabled();
        expect(
          screen.queryByText('Trigger request acknowledged by Process.'),
        ).not.toBeInTheDocument();
      }
      expect(requestedInstance).toMatch(/^axis-trigger-/);
      expect(link).toHaveAttribute(
        'href',
        `/process/tasks?instanceCode=${requestedInstance ?? ''}`,
      );
      expect(screen.getByLabelText('Test current location')).toHaveTextContent(
        '/process/triggers',
      );
      expect(
        fetcher.mock.calls.filter(([, init]) => init?.method === 'POST'),
      ).toHaveLength(1);
    },
  );

  it.each(['actor', 'owner'] as const)(
    'retires the private unknown intent and receipt read after %s replacement',
    async (change) => {
      vi.mocked(
        commandCapabilitiesClient.loadProcessCommandCapabilities,
      ).mockResolvedValue({ ...authorizedCommands, newRecording: 'ENABLED' });
      let finishInspection:
        | ((value: triggerCommandClient.ProcessTriggerCommandReceipt) => void)
        | undefined;
      const inspect = vi
        .spyOn(triggerCommandClient, 'inspectProcessTriggerCommandReceipt')
        .mockImplementation(
          () =>
            new Promise((resolve) => {
              finishInspection = resolve;
            }),
        );
      let status = 'DRAFT';
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input, init) => {
          if (init?.method === 'PATCH') {
            status = 'ACTIVE';
            return Promise.reject(new TypeError('response lost'));
          }
          return Promise.resolve(
            jsonResponse(
              requestUrl(input).includes('/triggers')
                ? [
                    {
                      code: 'review-job',
                      definitionCode: 'review',
                      triggerType: 'CRON',
                      version: 3,
                      status,
                    },
                  ]
                : [],
            ),
          );
        });
      const page = renderPage('/process/triggers');
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Activate' })).toBeEnabled(),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Activate' }));
      await screen.findByText(/The trigger request is unconfirmed/);
      await userEvent.click(
        screen.getByRole('button', { name: 'Inspect original receipt' }),
      );
      await waitFor(() => expect(inspect).toHaveBeenCalledTimes(1));
      const originalSignal = inspect.mock.calls[0]?.[4];
      const nextBootstrap =
        change === 'owner'
          ? {
              ...bootstrap,
              moduleConnections: {
                ...bootstrap.moduleConnections,
                workflow: (bootstrap.moduleConnections.workflow ?? []).map(
                  (connection) => ({
                    ...connection,
                    endpoint: 'http://replacement.example/nodics/process',
                  }),
                ),
              },
            }
          : bootstrap;
      page.rerender(
        <MemoryRouter initialEntries={['/process/triggers']}>
          <AxisThemeProvider>
            <QueryClientProvider client={page.queryClient}>
              <ProcessWorkflowRoutePage
                accessToken={
                  change === 'actor' ? 'replacement-token' : 'employee-token'
                }
                bootstrap={nextBootstrap}
                navigation={navigation}
                runtime={runtime}
              />
            </QueryClientProvider>
          </AxisThemeProvider>
        </MemoryRouter>,
      );
      expect(originalSignal?.aborted).toBe(true);
      act(() => finishInspection?.({ state: 'COMPLETED', triggerCode: 'review-job' }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Execute now' })).toBeEnabled(),
      );
      expect(
        screen.queryByRole('button', { name: 'Inspect original receipt' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Trigger request acknowledged by Process.'),
      ).not.toBeInTheDocument();
      expect(
        fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH'),
      ).toHaveLength(1);
    },
  );

  it.each([
    {
      group: 'Other workflow tasks',
      title: 'Inspect service request',
      task: {
        code: 'ordinary-review',
        name: 'Inspect service request',
        instanceCode: 'review-instance',
        nodeCode: 'review',
        status: 'OPEN',
      },
    },
    {
      group: 'CMS publication approvals',
      title: 'CMS publication',
      task: {
        code: 'legacy-cms-review',
        instanceCode: 'cmsPublicationApproval-review',
        nodeCode: 'publicationReview',
        status: 'OPEN',
      },
    },
  ])(
    'keeps the task queue heading outline ordered for $group',
    async ({ group, title, task }) => {
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input) =>
          Promise.resolve(
            jsonResponse(requestUrl(input).includes('/tasks?') ? [task] : []),
          ),
        );
      renderPage('/process/tasks');
      expect(
        await screen.findByRole('heading', { level: 3, name: group }),
      ).toBeVisible();
      expect(
        screen.getByRole('heading', { level: 2, name: 'Approval task queue' }),
      ).toBeVisible();
      expect(screen.getByRole('heading', { level: 4, name: title })).toBeVisible();
      expect(
        fetcher.mock.calls.some(([, init]) =>
          ['POST', 'PATCH'].includes(init?.method ?? 'GET'),
        ),
      ).toBe(false);
    },
  );

  it.each(['actor', 'tenant', 'owner', 'publication', 'documentation-owner'] as const)(
    'retires private drafts and cache identity after %s changes while equivalent metadata preserves them',
    async (change) => {
      const request = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(() => Promise.resolve(jsonResponse([])));
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const tree = (current: AxisAuthenticatedBootstrap, token = 'private-actor-a') => (
        <MemoryRouter initialEntries={['/process/definitions']}>
          <AxisThemeProvider>
            <QueryClientProvider client={client}>
              <ProcessWorkflowRoutePage
                accessToken={token}
                bootstrap={current}
                navigation={navigation}
                runtime={runtime}
              />
            </QueryClientProvider>
          </AxisThemeProvider>
        </MemoryRouter>
      );
      const initial: AxisAuthenticatedBootstrap = {
        ...bootstrapWithDocumentationSource,
        moduleConnections: {
          ...bootstrapWithDocumentationSource.moduleConnections,
          workflow: bootstrapWithDocumentationSource.moduleConnections.workflow!.map(
            (connection) => ({
              ...connection,
              runtimeRole: { code: 'PROCESS', publication: 'OPERATIONAL' as const },
            }),
          ),
        },
      };
      const view = render(tree(initial));
      const input = await screen.findByLabelText('Draft name');
      fireEvent.change(input, { target: { value: 'Private unsaved workflow title' } });
      const equivalent = {
        ...initial,
        moduleConnections: { ...initial.moduleConnections },
      };
      view.rerender(tree(equivalent));
      expect(screen.getByLabelText('Draft name')).toHaveValue(
        'Private unsaved workflow title',
      );
      view.rerender(
        tree({
          ...equivalent,
          moduleConnections: {
            ...equivalent.moduleConnections,
            workflow: equivalent.moduleConnections.workflow!.map((connection) => ({
              ...connection,
              state: 'DEGRADED' as const,
            })),
          },
        }),
      );
      expect(screen.getByLabelText('Draft name')).toHaveValue(
        'Private unsaved workflow title',
      );

      const moduleName = change === 'documentation-owner' ? 'backoffice' : 'workflow';
      const current =
        change === 'tenant'
          ? { ...equivalent, tenantCode: 'other-tenant' }
          : ['owner', 'publication', 'documentation-owner'].includes(change)
            ? {
                ...equivalent,
                moduleConnections: {
                  ...equivalent.moduleConnections,
                  [moduleName]: equivalent.moduleConnections[moduleName]!.map(
                    (connection) =>
                      change === 'publication'
                        ? {
                            ...connection,
                            runtimeRole: {
                              code: 'PROCESS',
                              publication: 'STAGED' as const,
                            },
                          }
                        : { ...connection, endpoint: connection.endpoint + '/changed' },
                  ),
                },
              }
            : equivalent;
      view.rerender(
        tree(current, change === 'actor' ? 'private-actor-b' : 'private-actor-a'),
      );
      expect(screen.getByLabelText('Draft name')).toHaveValue(
        'Sample approval process',
      );
      await waitFor(() => expect(request).toHaveBeenCalled());
      expect(
        JSON.stringify(
          client
            .getQueryCache()
            .getAll()
            .map((query) => query.queryKey),
        ),
      ).not.toMatch(/private-actor-[ab]/);
      expect(
        request.mock.calls.every(([, init]) => !init?.method || init.method === 'GET'),
      ).toBe(true);
    },
  );

  it.each(['/process', '/process/tasks'])(
    'keeps explicit timeline selection and router history aligned on %s',
    async (path) => {
      const instances = ['first-record', 'second-record'].map((code) => ({
        code,
        definitionCode: 'review-workflow',
        status: 'COMPLETED',
        currentNode: 'end',
        version: 1,
      }));
      const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
        const url = requestUrl(input);
        const selected = instances.find((item) =>
          url.endsWith(`/instances/${item.code}/detail`),
        );
        if (selected)
          return Promise.resolve(
            jsonResponse({ instance: selected, tasks: [], auditEvents: [] }),
          );
        return Promise.resolve(
          jsonResponse(url.includes('/instances?') ? instances : []),
        );
      });
      const user = userEvent.setup();
      renderPage(`${path}?view=recent#work`, bootstrap, true);
      const timeline = () => screen.getByRole('region', { name: 'Instance timeline' });
      const location = () => screen.getByLabelText('Test current location');
      const select = async (code: string) => {
        const heading = await screen.findByRole('heading', { name: code, level: 3 });
        const card = heading.closest('article');
        if (!card) throw new Error('Instance card missing');
        await user.click(within(card).getByRole('button', { name: 'View timeline' }));
        await within(timeline()).findByText(code);
      };
      await select('first-record');
      expect(location()).toHaveTextContent(
        `${path}?view=recent&instanceCode=first-record#work`,
      );
      await select('second-record');
      expect(location()).toHaveTextContent(
        `${path}?view=recent&instanceCode=second-record#work`,
      );
      await user.click(screen.getByRole('button', { name: 'Test history back' }));
      expect(location()).toHaveTextContent(
        `${path}?view=recent&instanceCode=first-record#work`,
      );
      await within(timeline()).findByText('first-record');
      expect(within(timeline()).queryByText('second-record')).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Test history back' }));
      expect(location()).toHaveTextContent(`${path}?view=recent#work`);
      expect(
        screen.queryByText('first-record', {
          selector: '[aria-label="Instance timeline"] *',
        }),
      ).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Test history forward' }));
      await within(timeline()).findByText('first-record');
      await user.click(screen.getByRole('button', { name: 'Test invalid record' }));
      expect(
        screen.queryByText('first-record', {
          selector: '[aria-label="Instance timeline"] *',
        }),
      ).toBeNull();
      expect(
        fetcher.mock.calls.some(([input]) =>
          requestUrl(input).includes('/instances/%2Fother/detail'),
        ),
      ).toBe(false);
      expect(
        fetcher.mock.calls.every(
          ([, options]) => !options?.method || options.method === 'GET',
        ),
      ).toBe(true);
    },
  );
  it.each(['DRAFT', 'PUBLISHED'])(
    'shows actual connections and keeps %s graph edits within draft save',
    async (status) => {
      const graph = {
        nodes: [
          { code: 'end', name: 'End', type: 'END' },
          { code: 'review', name: 'Request review', type: 'TASK' },
          { code: 'start', name: 'Start', type: 'START' },
        ],
        transitions: [
          { code: 'enter', source: 'start', target: 'review' },
          {
            code: 'finish',
            source: 'review',
            target: 'end',
            name: 'Accepted',
            condition: { approved: true },
          },
          { code: 'back', source: 'review', target: 'start', default: true },
        ],
      };
      const definition = {
        code: 'local-review',
        name: 'Local review',
        status,
        currentVersion: status === 'PUBLISHED' ? 1 : 0,
        draftRevision: 1,
        graph,
      };
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input, init) => {
          const path = new URL(requestUrl(input)).pathname;
          if (init?.method === 'PATCH')
            return Promise.resolve(
              jsonResponse({
                ...definition,
                graph: (
                  JSON.parse(typeof init.body === 'string' ? init.body : '{}') as {
                    graph?: unknown;
                  }
                ).graph,
              }),
            );
          if (path.endsWith('/versions')) return Promise.resolve(jsonResponse([]));
          if (path.endsWith('/definitions'))
            return Promise.resolve(jsonResponse([definition]));
          return Promise.reject(new Error('Unexpected operation'));
        });
      renderPage('/process/designer');
      await screen.findByText('Local review');
      await waitFor(() =>
        expect(
          screen.getAllByRole('list', { name: 'Workflow connections' }),
        ).toHaveLength(2),
      );
      expect(screen.getAllByText('Start → Request review')).toHaveLength(2);
      expect(screen.queryByText('End → Request review')).toBeNull();
      if (status === 'PUBLISHED') {
        expect(
          screen.queryByRole('button', { name: 'Remove connection back' }),
        ).toBeNull();
        expect(
          screen.getByRole('button', { name: 'Save designer draft' }),
        ).toBeDisabled();
      } else {
        await userEvent.click(
          screen.getByRole('button', { name: 'Remove connection back' }),
        );
        const lists = screen.getAllByRole('list', { name: 'Workflow connections' });
        expect(within(lists[0]!).getAllByRole('listitem')).toHaveLength(3);
        expect(within(lists[1]!).getAllByRole('listitem')).toHaveLength(2);
        expect(
          fetcher.mock.calls.every(
            ([, init]) => !init?.method || init.method === 'GET',
          ),
        ).toBe(true);
        await userEvent.click(
          screen.getByRole('button', { name: 'Save designer draft' }),
        );
        await waitFor(() =>
          expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(
            true,
          ),
        );
        const writes = fetcher.mock.calls.filter(
          ([, init]) => init?.method === 'PATCH',
        );
        expect(writes).toHaveLength(1);
        expect(requestUrl(writes[0]![0])).toContain('/definitions/local-review/draft');
        const body = writes[0]![1]?.body;
        if (typeof body !== 'string') throw new Error('Expected JSON draft body');
        const saved = JSON.parse(body) as { graph?: unknown };
        expect(saved.graph).toEqual({
          nodes: graph.nodes,
          transitions: graph.transitions
            .slice(0, 2)
            .map((transition) => ({ ...transition, default: false })),
        });
      }
      expect(
        fetcher.mock.calls.some(([, init]) =>
          ['POST', 'DELETE'].includes(init?.method ?? ''),
        ),
      ).toBe(false);
    },
  );

  it('opens focused authoring on a renamed registered Workflow host without unrelated operational panels', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(requestUrl(input));
      if (url.pathname.endsWith('/definitions'))
        return Promise.resolve(jsonResponse([]));
      return Promise.reject(new Error('Other reads unavailable in this fixture'));
    });
    renderPage('/process/definitions', {
      ...bootstrap,
      moduleConnections: {
        workflow: [
          {
            ...bootstrap.moduleConnections.workflow![0]!,
            server: 'customer-automation-host',
            endpoint: 'http://workflow.example/nodics/process',
          },
        ],
      },
    });
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([input]) =>
          requestUrl(input).startsWith(
            'http://workflow.example/nodics/process/v0/definitions',
          ),
        ),
      ).toBe(true),
    );
    expect(
      screen.getByRole('navigation', { name: 'Process workspaces' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Draft name')).toBeVisible();
    expect(screen.queryByText('Runtime operations overview')).toBeNull();
    expect(screen.queryByText('Process instances')).toBeNull();
    expect(screen.queryByText('Task inbox')).toBeNull();
    expect(screen.queryByLabelText('Workflow designer canvas')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Open workflow designer' }),
    ).toHaveAttribute('href', '/process/designer');
    expect(screen.queryByText('API unavailable')).toBeNull();
    await userEvent.click(screen.getByRole('link', { name: 'Operations' }));
    expect(
      await screen.findByRole('heading', { name: 'Approval tasks' }),
    ).toBeVisible();
  });

  it('navigates owner pages beyond 25 tasks, disables stale decisions on failure and recovers by GET', async () => {
    const user = userEvent.setup();
    let failSecondPage = false;
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const url = new URL(requestUrl(input));
      if (!url.pathname.endsWith('/tasks')) return Promise.resolve(jsonResponse([]));
      const page = Number(url.searchParams.get('page'));
      expect(url.searchParams.get('limit')).toBeNull();
      expect(url.searchParams.get('queue')).toBe('actionable');
      if (page === 2 && failSecondPage)
        return Promise.resolve(
          new Response(JSON.stringify({ message: 'Queue read denied' }), {
            status: 403,
          }),
        );
      const data =
        page === 1
          ? Array.from({ length: 25 }, (_, index) => ({
              code: `task-${String(index + 1)}`,
              instanceCode: 'instance-one',
              nodeCode: 'review',
              status: 'OPEN',
            }))
          : [
              {
                code: 'task-26',
                instanceCode: 'instance-one',
                nodeCode: 'review',
                status: 'OPEN',
              },
            ];
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data,
            pagination: {
              page,
              pageSize: 25,
              total: 26,
              hasNext: page === 1,
              hasPrevious: page > 1,
            },
          }),
        ),
      );
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetcher);
    renderPage('/process/tasks');
    expect(await screen.findByText('Page 1 · 26 matching tasks')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Previous task page' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next task page' }));
    expect(await screen.findByText('task-26')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next task page' })).toBeDisabled();
    expect(screen.queryByText('task-1')).not.toBeInTheDocument();
    failSecondPage = true;
    await user.click(screen.getByRole('button', { name: 'Refresh task evidence' }));
    expect(await screen.findByText('Queue read denied')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Complete' })).toBeDisabled();
    failSecondPage = false;
    await user.click(screen.getByRole('button', { name: 'Refresh task evidence' }));
    await waitFor(() =>
      expect(screen.queryByText('Queue read denied')).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Previous task page' }));
    expect(await screen.findByText('Page 1 · 26 matching tasks')).toBeVisible();
  });

  it.each([
    [
      'REVIEWER_NOT_AUTHORISED',
      false,
      'Your current reviewer identity or permission is not authorised for this task.',
    ],
    ['TASK_NOT_ACTIONABLE', false, 'This task is no longer awaiting a decision.'],
    [
      'INSTANCE_NOT_ACTIONABLE',
      false,
      'This workflow instance is no longer awaiting a decision.',
    ],
    [
      'ELIGIBLE',
      true,
      'Reviewer identity checks passed; completion is rechecked on submission.',
    ],
  ])(
    'renders owner eligibility %s and pinned Media context without inventing authority',
    async (reasonCode, eligible, message) => {
      const task = {
        code: 'opaque-task-code',
        instanceCode: 'media-review',
        nodeCode: 'review',
        status: 'CLAIMED',
        reviewerEligibility: { eligible, reasonCode, message },
        reviewContext: {
          contractVersion: 1,
          owner: 'media',
          publicationCode: 'media-publication-1',
          rootType: 'media',
          rootCode: 'nexusHero',
          sourceVersion: 'a'.repeat(64),
        },
        decisionContract: {
          contractVersion: 1,
          kind: 'APPROVAL',
          approveLabel: 'Approve Media',
          rejectLabel: 'Reject Media',
          reasonLabel: 'Review reason',
          rejectionReasonRequired: true,
          maximumReasonLength: 1000,
        },
      };
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input) =>
          Promise.resolve(
            jsonResponse(requestUrl(input).includes('/tasks?') ? [task] : []),
          ),
        );
      renderPage('/process/tasks');
      const approve = await screen.findByRole('button', { name: 'Approve Media' });
      const reject = screen.getByRole('button', { name: 'Reject Media' });
      expect(screen.getByText('1 awaiting review')).toBeVisible();
      expect(screen.getByText('1 approval task awaiting review.')).toBeVisible();
      expect(screen.queryByText(/ready for decision/)).toBeNull();
      expect(screen.getByText(message)).toBeVisible();
      expect(screen.getByRole('heading', { name: 'nexusHero' })).toBeVisible();
      expect(screen.getByText('opaque-task-code')).toBeVisible();
      expect(
        screen.getByText(`Retained source version: ${'a'.repeat(64)}`),
      ).toBeVisible();
      expect(screen.getByText('Publication: media-publication-1')).toBeVisible();
      await userEvent
        .setup()
        .type(screen.getByLabelText('Review reason'), 'Reviewed retained source');
      if (eligible) {
        expect(approve).toBeEnabled();
        expect(reject).toBeEnabled();
      } else {
        expect(approve).toBeDisabled();
        expect(reject).toBeDisabled();
        fireEvent.click(approve);
        fireEvent.click(reject);
      }
      expect(fetcher.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
        false,
      );
    },
  );
  it.each([
    {
      reviewerEligibility: {
        eligible: true,
        reasonCode: 'REVIEWER_NOT_AUTHORISED',
        message: 'Not eligible',
      },
    },
    {
      reviewerEligibility: {
        eligible: false,
        reasonCode: 'UNKNOWN',
        message: 'Not eligible',
      },
    },
    {
      reviewerEligibility: {
        eligible: false,
        reasonCode: 'REVIEWER_NOT_AUTHORISED',
        message: '',
        permission: 'forged',
      },
    },
    {
      reviewContext: {
        contractVersion: 2,
        owner: 'media',
        publicationCode: 'p',
        rootType: 'media',
        rootCode: 'hero',
        sourceVersion: 'retained',
      },
    },
    {
      reviewContext: {
        contractVersion: 1,
        owner: 'media',
        publicationCode: 'p',
        rootType: 'media',
        rootCode: 'hero',
        sourceVersion: 4,
      },
    },
    ...['x'.repeat(129), 'maker\nprivate', ' maker ', 42].map((requestedBy) => ({
      reviewContext: {
        contractVersion: 1,
        owner: 'cms',
        publicationCode: 'p',
        rootType: 'site',
        rootCode: 'site',
        sourceVersion: '0',
        requestedBy,
      },
    })),
  ])(
    'rejects malformed owner eligibility/context instead of offering completion %j',
    async (patch) => {
      const task = {
        code: 'held-task',
        instanceCode: 'held-instance',
        nodeCode: 'review',
        status: 'CLAIMED',
        ...patch,
      };
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input) =>
          Promise.resolve(
            jsonResponse(requestUrl(input).includes('/tasks?') ? [task] : []),
          ),
        );
      renderPage('/process/tasks');
      expect(
        await screen.findByText(
          /Process (reviewer eligibility|publication review context) is invalid/,
        ),
      ).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Complete' })).toBeNull();
      expect(fetcher.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
        false,
      );
    },
  );
  it.each([
    { nodeCode: 'mediaReview', instanceCode: 'mediaPublicationApproval-successor' },
    { nodeCode: 'projectReview', instanceCode: 'custom-owner-review' },
    { nodeCode: 'publicationReview', instanceCode: 'cmsPublicationApproval-typed' },
  ])(
    'groups approvals only from typed owner contract ($instanceCode)',
    async ({ nodeCode, instanceCode }) => {
      const task = {
        code: 'declared-review',
        name: 'Review enterprise employee application',
        nodeCode,
        instanceCode,
        status: 'CLAIMED',
        decisionContract: {
          contractVersion: 1,
          kind: 'APPROVAL',
          approveLabel: 'Approve owner request',
          rejectLabel: 'Reject owner request',
          reasonLabel: 'Owner reason',
          rejectionReasonRequired: true,
          maximumReasonLength: 1000,
        },
      };
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input) =>
          Promise.resolve(
            jsonResponse(requestUrl(input).includes('/tasks?') ? [task] : []),
          ),
        );
      renderPage('/process/tasks');
      expect(
        await screen.findByRole('button', { name: 'Approve owner request' }),
      ).toBeVisible();
      expect(screen.getByText('1 approval decisions')).toBeVisible();
      expect(
        screen.getByRole('heading', { level: 3, name: 'Approval decisions' }),
      ).toBeVisible();
      expect(
        screen.getByRole('heading', {
          level: 4,
          name: 'Review enterprise employee application',
        }),
      ).toBeVisible();
      expect(screen.getByText('declared-review')).toBeVisible();
      expect(screen.queryByRole('heading', { name: 'declared-review' })).toBeNull();
      expect(screen.queryByText('Other workflow tasks')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Complete' })).toBeNull();
      expect(screen.queryByText('Documentation publication approvals')).toBeNull();
      expect(fetcher.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
        false,
      );
    },
  );
  it.each(['success', 'failed', 'wrong-identity'])(
    'renders selected owner timeline on tasks view with %s state',
    async (outcome) => {
      const instance = {
        code: 'completed-instance',
        definitionCode: 'approved-workflow',
        status: 'COMPLETED',
        currentNode: 'end',
        version: 1,
      };
      let resolveDetail: (response: Response) => void = () => {
        throw new Error('Detail resolver unavailable');
      };
      const detail = new Promise<Response>((resolve) => {
        resolveDetail = resolve;
      });
      const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
        const url = requestUrl(input);
        if (url.endsWith('/instances/completed-instance/detail')) return detail;
        return Promise.resolve(
          jsonResponse(url.includes('/instances?') ? [instance] : []),
        );
      });
      renderPage(
        outcome === 'success'
          ? '/process/tasks?instanceCode=completed-instance'
          : '/process/tasks',
      );
      if (outcome !== 'success')
        await userEvent
          .setup()
          .click(await screen.findByRole('button', { name: 'View timeline' }));
      const timeline = await screen.findByRole('region', { name: 'Instance timeline' });
      const queue = screen.getByRole('heading', { name: 'Approval task queue' });
      expect(
        timeline.compareDocumentPosition(queue) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(within(timeline).getByRole('status')).toHaveTextContent(
        'Loading timeline',
      );
      expect(
        await screen.findByRole('button', { name: 'Cancel instance' }),
      ).toBeDisabled();
      await act(async () => {
        await Promise.resolve();
        resolveDetail(
          outcome !== 'failed'
            ? jsonResponse({
                instance:
                  outcome === 'wrong-identity'
                    ? { ...instance, code: 'another-instance' }
                    : instance,
                tasks: [],
                auditEvents: [
                  {
                    eventType: 'process.completed',
                    outcome: 'approved',
                    instanceCode: instance.code,
                  },
                ],
              })
            : new Response(JSON.stringify({ message: 'Timeline unavailable' }), {
                status: 503,
              }),
        );
      });
      if (outcome === 'success')
        expect(
          await within(timeline).findByText('process.completed · approved'),
        ).toBeVisible();
      else
        expect(
          await within(timeline).findByText(
            outcome === 'failed'
              ? 'Timeline unavailable'
              : 'Process instance detail identity is invalid',
          ),
        ).toBeVisible();
      expect(
        fetcher.mock.calls.filter(([input]) =>
          requestUrl(input).endsWith('/instances/completed-instance/detail'),
        ),
      ).toHaveLength(1);
      expect(fetcher.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
        false,
      );
    },
  );
  it.each([
    {
      decision: { approved: false, reason: 'Retain the published image.' },
      declared: true,
      status: 'COMPLETED',
      choice: 'Decline captured replacement',
    },
    {
      decision: { approved: true },
      declared: true,
      status: 'COMPLETED',
      choice: 'Accept captured replacement',
    },
    {
      decision: { approved: 'false', reason: 'Retain the published image.' },
      declared: true,
      status: 'COMPLETED',
      choice: undefined,
    },
    {
      decision: { approved: false },
      declared: true,
      status: 'COMPLETED',
      choice: undefined,
    },
    {
      decision: { approved: false, reason: 'x'.repeat(101) },
      declared: true,
      status: 'COMPLETED',
      choice: undefined,
    },
    {
      decision: { approved: false, reason: 'Retain the published image.' },
      declared: false,
      status: 'COMPLETED',
      choice: undefined,
    },
    { decision: { approved: true }, declared: true, status: 'OPEN', choice: undefined },
  ])(
    'shows only valid recorded approval history: $status / $choice',
    async ({ decision, declared, status, choice }) => {
      const instance = {
        code: 'recorded-instance',
        definitionCode: 'review-policy',
        status: 'COMPLETED',
        currentNode: 'end',
        version: 1,
      };
      const task = {
        code: 'recorded-task',
        name: 'Review captured replacement',
        instanceCode: instance.code,
        nodeCode: 'review',
        status,
        decision,
        ...(declared
          ? {
              decisionContract: {
                contractVersion: 1,
                kind: 'APPROVAL',
                approveLabel: 'Accept captured replacement',
                rejectLabel: 'Decline captured replacement',
                reasonLabel: 'Recorded explanation',
                rejectionReasonRequired: true,
                maximumReasonLength: 100,
              },
            }
          : {}),
      };
      const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
        const url = requestUrl(input);
        return Promise.resolve(
          jsonResponse(
            url.endsWith('/instances/recorded-instance/detail')
              ? { instance, tasks: [task], auditEvents: [] }
              : url.includes('/instances?')
                ? [instance]
                : [],
          ),
        );
      });
      renderPage('/process/tasks?instanceCode=recorded-instance');
      const timeline = await screen.findByRole('region', { name: 'Instance timeline' });
      expect(
        await within(timeline).findByText('Review captured replacement'),
      ).toBeVisible();
      if (choice) expect(within(timeline).getByText(choice)).toBeVisible();
      else {
        expect(within(timeline).queryByText('Accept captured replacement')).toBeNull();
        expect(within(timeline).queryByText('Decline captured replacement')).toBeNull();
      }
      if (choice === 'Decline captured replacement')
        expect(
          within(timeline).getByText(
            'Recorded explanation: Retain the published image.',
          ),
        ).toBeVisible();
      expect(
        within(timeline).queryByRole('button', {
          name: /Accept captured|Decline captured|Complete/,
        }),
      ).toBeNull();
      expect(fetcher.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
        false,
      );
    },
  );
  it('blocks blank and oversized reasons, stale task decisions and never replays uncertain completion', async () => {
    const task = {
      code: 'employee-review',
      instanceCode: 'application-review-1',
      nodeCode: 'review',
      status: 'CLAIMED',
      decisionContract: {
        contractVersion: 1,
        kind: 'APPROVAL',
        approveLabel: 'Approve application',
        rejectLabel: 'Reject application',
        reasonLabel: 'Review reason',
        rejectionReasonRequired: true,
        maximumReasonLength: 1000,
      },
    };
    let failedRead = false;
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, options) => {
        if (options?.method === 'POST')
          return Promise.reject(new Error('Decision acknowledgement unavailable'));
        if (failedRead && requestUrl(input).includes('/tasks?'))
          return Promise.reject(new Error('Task inspection unavailable'));
        return Promise.resolve(
          jsonResponse(requestUrl(input).includes('/tasks?') ? [task] : []),
        );
      });
    const rendered = renderPage('/process/tasks');
    const approve = await screen.findByRole('button', { name: 'Approve application' });
    const reject = screen.getByRole('button', { name: 'Reject application' });
    fireEvent.change(screen.getByLabelText('Review reason'), {
      target: { value: '   ' },
    });
    expect(reject).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Review reason'), {
      target: { value: 'x'.repeat(1001) },
    });
    await waitFor(() => expect(approve).toBeDisabled());
    expect(reject).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Review reason'), {
      target: { value: 'Reviewed evidence' },
    });
    await userEvent.setup().click(approve);
    await screen.findByText('Decision acknowledgement unavailable');
    expect(approve).toBeDisabled();
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === 'POST'),
    ).toHaveLength(1);
    failedRead = true;
    await act(async () => {
      await rendered.queryClient.invalidateQueries({
        queryKey: ['process-operations-summary'],
      });
    });
    await waitFor(() => expect(approve).toBeDisabled());
    expect(reject).toBeDisabled();
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === 'POST'),
    ).toHaveLength(1);
    failedRead = false;
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Refresh task evidence' }));
    await waitFor(() => expect(approve).toBeEnabled());
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === 'POST'),
    ).toHaveLength(1);
  });
  it.each([{ contractVersion: 2 }, { method: 'POST' }])(
    'rejects unsupported decision metadata instead of offering generic completion %j',
    async (change) => {
      const task = {
        code: 'employee-review',
        status: 'CLAIMED',
        decisionContract: {
          contractVersion: 1,
          kind: 'APPROVAL',
          approveLabel: 'Approve application',
          rejectLabel: 'Reject application',
          reasonLabel: 'Review reason',
          rejectionReasonRequired: true,
          maximumReasonLength: 1000,
          ...change,
        },
      };
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input) =>
          Promise.resolve(
            jsonResponse(requestUrl(input).includes('/tasks?') ? [task] : []),
          ),
        );
      renderPage('/process/tasks');
      await screen.findByText('Process task decision contract is invalid');
      expect(screen.queryByRole('button', { name: 'Complete' })).toBeNull();
      expect(fetcher.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
        false,
      );
    },
  );
  it.each([true, false])(
    'submits typed owner-declared approval %s without generic outcome',
    async (approved) => {
      const task = {
        code: 'employee-review',
        instanceCode: 'application-review-1',
        nodeCode: 'review',
        status: 'CLAIMED',
        decisionContract: {
          contractVersion: 1,
          kind: 'APPROVAL',
          approveLabel: 'Approve application',
          rejectLabel: 'Reject application',
          reasonLabel: 'Review reason',
          rejectionReasonRequired: true,
          maximumReasonLength: 1000,
        },
      };
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input, options) => {
          const url = requestUrl(input);
          if (options?.method === 'POST')
            return Promise.resolve(
              jsonResponse({
                task: { code: task.code, status: 'COMPLETED' },
                instance: { code: task.instanceCode, status: 'COMPLETED' },
              }),
            );
          return Promise.resolve(jsonResponse(url.includes('/tasks?') ? [task] : []));
        });
      renderPage('/process/tasks');
      const approve = await screen.findByRole('button', {
        name: 'Approve application',
      });
      const reject = screen.getByRole('button', { name: 'Reject application' });
      expect(screen.queryByRole('button', { name: 'Complete' })).toBeNull();
      expect(reject).toBeDisabled();
      expect(fetcher.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
        false,
      );
      const user = userEvent.setup();
      if (!approved)
        await user.type(
          screen.getByLabelText('Review reason'),
          'Evidence does not meet the published criteria',
        );
      await user.click(approved ? approve : reject);
      await waitFor(() =>
        expect(
          fetcher.mock.calls.some(
            ([input, options]) =>
              requestUrl(input).endsWith('/tasks/employee-review/complete') &&
              options?.method === 'POST',
          ),
        ).toBe(true),
      );
      const command = fetcher.mock.calls.find(
        ([input, options]) =>
          requestUrl(input).endsWith('/tasks/employee-review/complete') &&
          options?.method === 'POST',
      );
      if (typeof command?.[1]?.body !== 'string')
        throw new Error('Expected decision body');
      const body: unknown = JSON.parse(command[1].body);
      expect(body).toEqual({
        decision: approved
          ? { approved: true }
          : {
              approved: false,
              reason: 'Evidence does not meet the published criteria',
            },
      });
    },
  );
  afterEach(() => {
    onlineManager.setOnline(true);
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('guides business users through backend-owned process lifecycle steps', async () => {
    const user = userEvent.setup();
    let admittedStartCode: string | undefined;
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
          if (typeof init?.body !== 'string') throw new Error('Expected a JSON body');
          admittedStartCode = (JSON.parse(init.body) as { instanceCode: string })
            .instanceCode;
          return Promise.reject(new TypeError('response lost after admission'));
        }
        if (
          admittedStartCode &&
          url.endsWith(`/instances/${admittedStartCode}/detail`)
        ) {
          return Promise.resolve(
            jsonResponse({
              instance: {
                code: admittedStartCode,
                definitionCode: 'published-onboarding-process',
                version: 1,
                status: 'WAITING',
              },
              tasks: [],
              auditEvents: [],
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
        if (method === 'POST' && url.includes('/tasks/task-1/assign')) {
          return Promise.resolve(
            jsonResponse({
              code: 'task-1',
              instanceCode: 'instance-1',
              nodeCode: 'businessReview',
              assignee: 'business-reviewers',
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
        if (method === 'POST' && url.includes('/tasks/cms-task-1/complete')) {
          return Promise.resolve(
            jsonResponse({
              task: { code: 'cms-task-1', status: 'COMPLETED' },
              instance: {
                code: 'cmsPublicationApproval-publication-1',
                status: 'COMPLETED',
              },
            }),
          );
        }
        if (method === 'POST' && url.endsWith('/v0/triggers')) {
          return Promise.resolve(
            jsonResponse(
              {
                code: 'published-onboarding-process-nightlyapprovaljob',
                definitionCode: 'published-onboarding-process',
                version: 1,
                triggerType: 'CRON',
                cronJobCode: 'nightlyApprovalJob',
                status: 'DRAFT',
                schedule: { expression: '0 1 * * *' },
              },
              'SUC_PROCESS_00010',
            ),
          );
        }
        if (method === 'PATCH' && url.includes('/triggers/daily-content-approval')) {
          return Promise.resolve(
            jsonResponse(
              {
                code: 'daily-content-approval',
                status: 'ACTIVE',
              },
              'SUC_PROCESS_00010',
            ),
          );
        }
        if (
          method === 'POST' &&
          url.includes('/triggers/daily-content-approval/archive')
        ) {
          return Promise.resolve(
            jsonResponse(
              {
                code: 'daily-content-approval',
                status: 'ARCHIVED',
                active: false,
              },
              'SUC_PROCESS_00010',
            ),
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
              {
                code: 'cms-task-1',
                instanceCode: 'cmsPublicationApproval-publication-1',
                nodeCode: 'publicationReview',
                assignee: 'admin',
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

    renderPage('/process', bootstrap, true);

    expect(screen.getByText('Process & Automation')).toBeInTheDocument();
    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('Validate')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
    expect(screen.getByText('Automate')).toBeInTheDocument();
    expect(
      screen.getByText(/business users can model and review/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Create a workflow draft')).toBeInTheDocument();
    expect(screen.getByText('Process workspace focus')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Designer')).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText('Sample approval process')).toBeInTheDocument(),
    );
    expect(screen.getAllByText('Definitions').length).toBeGreaterThan(0);
    expect(screen.getByText('Drafts')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Selected issues')).toBeInTheDocument();
    expect(screen.getByText('Runtime operations overview')).toBeInTheDocument();
    expect(screen.getByText('Running instances')).toBeInTheDocument();
    expect(screen.getByText('Open tasks')).toBeInTheDocument();
    expect(screen.getAllByText('Recovery incidents')).toHaveLength(2);
    expect(
      screen.getByText('No workflow recovery incidents need action.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Process instances')).toBeInTheDocument();
    expect(screen.getByText('Task inbox')).toBeInTheDocument();
    expect(screen.getAllByText('Scheduled triggers').length).toBeGreaterThan(0);
    expect(screen.getByText('Workflow designer')).toBeInTheDocument();
    expect(screen.getByLabelText('Workflow designer canvas')).toBeInTheDocument();
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

    expect(await screen.findByText(/start outcome is uncertain/)).toBeVisible();
    expect(
      screen
        .getAllByRole('button', { name: 'Start process' })
        .every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Inspect original start' }));
    expect(
      await screen.findByRole('link', { name: 'Open started workflow' }),
    ).toHaveAttribute('href', `/process/tasks?instanceCode=${admittedStartCode}`);
    expect(
      fetchMock.mock.calls.filter(
        ([input, init]) =>
          init?.method === 'POST' && requestUrl(input).endsWith('/v0/instances'),
      ),
    ).toHaveLength(1);
    expect(screen.getByLabelText('Test current location')).toHaveTextContent(
      '/process',
    );
    expect(screen.getByLabelText('Test current location')).not.toHaveTextContent(
      'instanceCode',
    );
    await user.click(screen.getByRole('button', { name: 'View timeline' }));
    await waitFor(() =>
      expect(
        screen.getByText('process.instance.started · success'),
      ).toBeInTheDocument(),
    );

    const claimButton = screen.getAllByRole('button', { name: 'Claim' })[0];
    if (!claimButton) throw new Error('Expected a generic task claim button');
    await user.click(claimButton);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            requestUrl(input).includes('/tasks/task-1/claim') &&
            init?.method === 'POST',
        ),
      ).toBe(true),
    );

    await user.clear(screen.getByLabelText('Assign selected task to'));
    await user.type(
      screen.getByLabelText('Assign selected task to'),
      'business-reviewers',
    );
    const assignButton = screen.getAllByRole('button', { name: 'Assign' })[0];
    if (!assignButton) throw new Error('Expected a generic task assign button');
    await user.click(assignButton);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          const body = init?.body;
          return (
            requestUrl(input).includes('/tasks/task-1/assign') &&
            init?.method === 'POST' &&
            typeof body === 'string' &&
            body.includes('business-reviewers')
          );
        }),
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

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          const body = init?.body;
          return (
            requestUrl(input).includes('/tasks/cms-task-1/complete') &&
            init?.method === 'POST' &&
            typeof body === 'string' &&
            body.includes('"approved":true') &&
            body.includes('"outcome":"approved-from-axis"')
          );
        }),
      ).toBe(true),
    );

    await user.click(screen.getByRole('combobox', { name: 'Published workflow' }));
    await user.click(
      screen.getByRole('option', { name: /published-onboarding-process/ }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', {
          name: 'Published workflow version',
        }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole('combobox', { name: 'Published workflow version' }),
    );
    await user.click(await screen.findByRole('option', { name: 'Version 1' }));
    await user.type(screen.getByLabelText('Cron job code'), 'nightlyApprovalJob');
    await user.clear(screen.getByLabelText('Schedule expression'));
    await user.type(screen.getByLabelText('Schedule expression'), '0 1 * * *');
    await user.click(screen.getByRole('button', { name: 'Add trigger' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            requestUrl(input).endsWith('/v0/triggers') && init?.method === 'POST',
        ),
      ).toBe(true),
    );

    await user.click(screen.getByRole('button', { name: 'Archive trigger' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            requestUrl(input).includes('/triggers/daily-content-approval/archive') &&
            init?.method === 'POST',
        ),
      ).toBe(true),
    );
  }, 30_000);

  it('shows a retrieved trigger and prevents creating its same relationship again', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      Promise.resolve(
        jsonResponse(
          requestUrl(input).includes('/triggers')
            ? [
                {
                  code: 'sample-process-job',
                  definitionCode: 'sample-process',
                  cronJobCode: 'job',
                  status: 'DRAFT',
                  triggerType: 'CRON',
                },
              ]
            : [],
        ),
      ),
    );
    renderPage('/process/triggers');
    await screen.findByText('sample-process-job');
    await userEvent.click(
      screen.getByRole('button', { name: 'Choose workflow version' }),
    );
    expect(screen.getByText('1 relationship retrieved')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add trigger' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Add trigger' }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
      false,
    );
  });

  it.each([undefined, { expression: '0 * * * * *', timeZone: 'Asia/Dubai' }])(
    'activates only relationship status without replacing saved schedule %j',
    async (schedule) => {
      let status = 'DRAFT';
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input, init) => {
          if (init?.method === 'PATCH') {
            expect(requestUrl(input)).toMatch(/\/triggers\/local-review-job$/);
            expect(JSON.parse(init.body as string)).toEqual({ status: 'ACTIVE' });
            status = 'ACTIVE';
            return Promise.resolve(
              jsonResponse({ code: 'local-review-job', status }, 'SUC_PROCESS_00010'),
            );
          }
          return Promise.resolve(
            jsonResponse(
              requestUrl(input).includes('/triggers')
                ? [
                    {
                      code: 'local-review-job',
                      definitionCode: 'local-review',
                      cronJobCode: 'job',
                      triggerType: 'CRON',
                      version: 3,
                      status,
                      ...(schedule ? { schedule } : {}),
                    },
                  ]
                : [],
            ),
          );
        });
      renderPage('/process/triggers');
      await screen.findByText('local-review-job');
      await userEvent.click(screen.getByRole('button', { name: /^Activate$/ }));
      await screen.findByText('ACTIVE', { exact: true });
      expect(
        fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH'),
      ).toHaveLength(1);
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
        false,
      );
    },
  );

  it.each([403, 503])(
    'shows an explicit trigger execution failure (%s) without replay on refresh',
    async (status) => {
      const message =
        status === 403
          ? 'Owner denied this trigger execution'
          : 'Owner execution service is unavailable';
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input, init) => {
          if (init?.method === 'POST')
            return Promise.resolve(
              new Response(JSON.stringify({ message }), {
                status,
                headers: { 'Content-Type': 'application/json' },
              }),
            );
          return Promise.resolve(
            jsonResponse(
              requestUrl(input).includes('/triggers')
                ? [
                    {
                      code: 'local-review-job',
                      definitionCode: 'local-review',
                      cronJobCode: 'job',
                      triggerType: 'CRON',
                      version: 3,
                      status: 'ACTIVE',
                    },
                  ]
                : [],
            ),
          );
        });
      renderPage('/process/triggers');
      await screen.findByText('local-review-job');
      await userEvent.click(screen.getByRole('button', { name: 'Execute now' }));
      expect(await screen.findByText(message, { exact: true })).toBeVisible();
      await userEvent.click(
        screen.getByRole('button', { name: 'Refresh relationships' }),
      );
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Refresh relationships' }),
        ).toBeEnabled(),
      );
      expect(
        fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST'),
      ).toHaveLength(1);
    },
  );

  it.each([false, true])(
    'pins an existing relationship explicitly and holds uncertain acknowledgement=%s without replay',
    async (loseResponse) => {
      let version: number | undefined;
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input, init) => {
          const url = requestUrl(input);
          if (init?.method === 'PATCH') {
            expect(url).toMatch(/\/triggers\/local-review-job$/);
            expect(JSON.parse(init.body as string)).toEqual({ version: 3 });
            version = 3;
            if (loseResponse) return Promise.reject(new TypeError('response lost'));
            return Promise.resolve(
              jsonResponse(
                { code: 'local-review-job', version: 3 },
                'SUC_PROCESS_00010',
              ),
            );
          }
          if (url.endsWith('/versions'))
            return Promise.resolve(
              jsonResponse([
                {
                  code: 'local-review-v3',
                  definitionCode: 'local-review',
                  version: 3,
                  status: 'PUBLISHED',
                  checksum: 'owner-checksum',
                },
              ]),
            );
          if (url.endsWith('/definitions'))
            return Promise.resolve(
              jsonResponse([
                {
                  code: 'local-review',
                  name: 'Local review',
                  status: 'PUBLISHED',
                  currentVersion: 3,
                  draftRevision: 3,
                },
              ]),
            );
          if (url.includes('/triggers'))
            return Promise.resolve(
              jsonResponse([
                {
                  code: 'local-review-job',
                  definitionCode: 'local-review',
                  cronJobCode: 'job',
                  triggerType: 'CRON',
                  status: 'ACTIVE',
                  schedule: { expression: '0 * * * * *' },
                  ...(version ? { version } : {}),
                },
              ]),
            );
          return Promise.resolve(jsonResponse([]));
        });
      renderPage('/process/triggers');
      await screen.findByText('local-review-job');
      expect(screen.getByRole('button', { name: 'Execute now' })).toBeDisabled();
      await userEvent.click(
        screen.getByRole('button', { name: 'Choose workflow version' }),
      );
      const chooser = screen.getByRole('combobox', {
        name: 'Published workflow version',
      });
      await waitFor(() => expect(chooser).toBeEnabled());
      expect(
        screen.getByRole('button', { name: 'Set published version' }),
      ).toBeDisabled();
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(
        false,
      );
      await userEvent.click(chooser);
      await userEvent.click(screen.getByRole('option', { name: 'Version 3' }));
      expect(screen.getByRole('button', { name: 'Add trigger' })).toBeDisabled();
      await userEvent.click(
        screen.getByRole('button', { name: 'Set published version' }),
      );
      if (loseResponse) {
        await screen.findByText(/version update is unconfirmed/i);
        expect(
          screen.getByRole('button', { name: 'Set published version' }),
        ).toBeDisabled();
        await userEvent.click(
          screen.getByRole('button', { name: 'Refresh relationships' }),
        );
        await screen.findByText('Published workflow version 3');
        expect(screen.getByRole('button', { name: 'Execute now' })).toBeDisabled();
      } else {
        await screen.findByText('Published workflow version 3');
        expect(screen.getByRole('button', { name: 'Execute now' })).toBeEnabled();
      }
      expect(
        fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH'),
      ).toHaveLength(1);
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
        false,
      );
    },
  );

  it('respects explicit owner reviewer denial on legacy CMS tasks without a decision contract', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      Promise.resolve(
        jsonResponse(
          requestUrl(input).includes('/tasks')
            ? [
                {
                  code: 'legacy-cms-held',
                  instanceCode: 'cmsPublicationApproval-held',
                  nodeCode: 'publicationReview',
                  status: 'OPEN',
                  assignee: 'admin',
                  reviewerEligibility: {
                    eligible: false,
                    reasonCode: 'REVIEWER_NOT_AUTHORISED',
                    message: 'Approval permission is required for this publication.',
                  },
                },
              ]
            : [],
        ),
      ),
    );
    renderPage('/process/tasks', bootstrapWithDocumentationSource);
    expect(
      await screen.findByText('Approval permission is required for this publication.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
      false,
    );
  });

  it.each([
    'matched',
    'wrong-publication',
    'wrong-workflow',
    'wrong-site',
    'unavailable',
    'no-requester',
    'ambiguous-profile',
  ])('shows only bound website publication evidence: %s', async (scenario) => {
    const profile = {
      code: 'circa',
      title: 'Circa website',
      kind: 'APPLICATION',
      category: 'web',
      summary: 'Website',
      order: 1,
      type: 'CMS_SITE',
      owner: 'cms',
      applicationCode: 'circa',
      siteCode: 'circa',
      baselineCode: 'circa',
      requiredServers: [],
      requiredFunctionalModules: [],
      dataPackages: [],
      activationPolicy: {
        approvalRequiredForOnline: true,
        requiredDataTrigger: 'MANUAL',
        sampleDataTrigger: 'MANUAL',
      },
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes('/applications/circa/initialization')) {
        if (scenario === 'unavailable')
          return Promise.resolve(new Response('{}', { status: 503 }));
        return Promise.resolve(
          jsonResponse({
            profileCode: 'circa',
            type: 'CMS_SITE',
            owner: 'cms',
            applicationCode: 'circa',
            siteCode: scenario === 'wrong-site' ? 'other' : 'circa',
            readiness: 'PUBLICATION_PENDING',
            releaseCode: 'cms:circa',
            releaseVersion: '0.0.2',
            releaseStatus: 'CURRENT',
            allowedActions: [],
            publication: {
              code:
                scenario === 'wrong-publication' ? 'other' : 'cmsBaseline_circa_0_0_2',
              state: 'PENDING_APPROVAL',
              revision: 3,
              workflowRef:
                scenario === 'wrong-workflow'
                  ? 'other'
                  : 'cmsPublicationApproval-circa',
            },
          }),
        );
      }
      return Promise.resolve(
        jsonResponse(
          url.includes('/tasks')
            ? [
                {
                  code: 'circa-review',
                  instanceCode: 'cmsPublicationApproval-circa',
                  nodeCode: 'publicationReview',
                  status: 'OPEN',
                  assignee: 'review-queue',
                  reviewContext: {
                    contractVersion: 1,
                    owner: 'cms',
                    publicationCode: 'cmsBaseline_circa_0_0_2',
                    rootType: 'site',
                    rootCode: 'circa',
                    sourceVersion: '0',
                    ...(scenario === 'no-requester'
                      ? {}
                      : { requestedBy: 'maker@example.test' }),
                  },
                },
              ]
            : [],
        ),
      );
    });
    renderPage('/process/tasks', {
      ...bootstrapWithDocumentationSource,
      applicationInitializationProfiles: [
        profile,
        ...(scenario === 'ambiguous-profile' ? [{ ...profile, code: 'other' }] : []),
        { ...profile, code: 'unrelated', siteCode: 'unrelated' },
      ],
    });
    await screen.findByText('CMS publication approvals');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Review evidence' }));
    expect(screen.getByText('cmsBaseline_circa_0_0_2')).toBeVisible();
    expect(screen.getAllByText('circa', { selector: 'p' })[0]).toBeVisible();
    expect(screen.getByText('0', { selector: 'p' })).toBeVisible();
    if (['matched', 'no-requester'].includes(scenario)) {
      expect(
        await screen.findByRole('heading', { name: 'Circa website' }),
      ).toBeVisible();
      expect(screen.getByText('0.0.2', { selector: 'p' })).toBeVisible();
      expect(screen.getByText('CURRENT', { selector: 'p' })).toBeVisible();
    } else {
      await waitFor(() =>
        expect(
          fetchMock.mock.calls.filter(([input]) =>
            requestUrl(input).includes('/applications/'),
          ).length,
        ).toBe(scenario === 'ambiguous-profile' ? 0 : 1),
      );
      expect(screen.queryByText('0.0.2', { selector: 'p' })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Circa website' }),
      ).not.toBeInTheDocument();
    }
    expect(screen.queryByText('Documentation publication')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
    if (scenario === 'no-requester')
      expect(screen.getByText(/Requested by not available/)).toBeVisible();
    else
      expect(screen.getByText('maker@example.test', { selector: 'p' })).toBeVisible();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        requestUrl(input).includes('/applications/unrelated/'),
      ),
    ).toBe(false);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
      false,
    );
  });

  it('shows authored CMS review without inventing initialization profile or release requirements', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      Promise.resolve(
        jsonResponse(
          requestUrl(input).includes('/tasks')
            ? [
                {
                  code: 'authored-page-task',
                  instanceCode: 'cmsPublicationApproval-authored-page',
                  nodeCode: 'publicationReview',
                  status: 'OPEN',
                  reviewContext: {
                    contractVersion: 1,
                    owner: 'cms',
                    publicationCode: 'authored-page-publication',
                    rootType: 'site',
                    rootCode: 'businessWebsite',
                    sourceVersion: '7',
                    requestedBy: 'contentAuthor',
                  },
                },
              ]
            : [],
        ),
      ),
    );
    renderPage('/process/tasks', {
      ...bootstrapWithDocumentationSource,
      documentationSources: [],
      applicationInitializationProfiles: [],
    });
    await screen.findByText('CMS publication approvals');
    await userEvent.click(screen.getByRole('button', { name: 'Review evidence' }));
    expect(screen.getByText('businessWebsite · Source version 7')).toBeVisible();
    expect(screen.getByText('authored-page-publication')).toBeVisible();
    expect(screen.getByText('7', { selector: 'p' })).toBeVisible();
    expect(screen.queryByText('Staged profile')).toBeNull();
    expect(screen.queryByText('Release version')).toBeNull();
    expect(screen.queryByText('Release status')).toBeNull();
    expect(screen.queryByText(/Profile not available/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
      false,
    );
  });

  it('shows documentation approvals as a focused work queue on the tasks route', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => {
        const url = requestUrl(input);
        const method = init?.method ?? 'GET';
        if (method === 'POST' && url.includes('/tasks/cms-task-1/complete')) {
          return Promise.resolve(
            jsonResponse({
              task: { code: 'cms-task-1', status: 'COMPLETED' },
              instance: {
                code: 'cmsPublicationApproval-publication-1',
                status: 'COMPLETED',
              },
            }),
          );
        }
        if (url.includes('/applications/frameworkdocs/initialization')) {
          return Promise.resolve(
            jsonResponse({
              profileCode: 'frameworkdocs',
              siteCode: 'frameworkdocs',
              readiness: 'PUBLICATION_PENDING',
              releaseCode: 'cmsBaseline_frameworkdocs_0_16_1',
              releaseVersion: '0.16.1',
              releaseStatus: 'CURRENT',
              allowedActions: [],
              publication: {
                code: 'publication-1',
                state: 'APPROVAL_PENDING',
                revision: 1,
                requestedBy: 'author',
                workflowRef: 'cmsPublicationApproval-publication-1',
              },
            }),
          );
        }
        if (url.includes('/tasks')) {
          return Promise.resolve(
            jsonResponse([
              {
                code: 'cms-task-1',
                instanceCode: 'cmsPublicationApproval-publication-1',
                nodeCode: 'publicationReview',
                assignee: 'admin',
                status: 'OPEN',
                reviewContext: {
                  contractVersion: 1,
                  owner: 'cms',
                  publicationCode: 'publication-1',
                  rootType: 'site',
                  rootCode: 'frameworkdocs',
                  sourceVersion: '0',
                  requestedBy: 'author',
                },
              },
            ]),
          );
        }
        if (
          url.includes('/instances') ||
          url.includes('/incidents') ||
          url.includes('/audit-events') ||
          url.includes('/triggers')
        ) {
          return Promise.resolve(jsonResponse([]));
        }
        return Promise.resolve(jsonResponse([]));
      });

    renderPage('/process/tasks', bootstrapWithDocumentationSource);

    expect(screen.getByText('Approval tasks')).toBeInTheDocument();
    expect(screen.queryByText('Process workspace focus')).not.toBeInTheDocument();
    expect(screen.getByText('Approval task queue')).toBeInTheDocument();
    expect(await screen.findByText('CMS publication approvals')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Framework' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/frameworkdocs -> frameworkdocs/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review evidence' }));
    expect(screen.getByText('Review before decision')).toBeInTheDocument();
    expect(screen.getByText('Staged profile')).toBeInTheDocument();
    expect(screen.getByText('Target site')).toBeInTheDocument();
    expect(screen.getByText('Decision available')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          const body = init?.body;
          return (
            requestUrl(input).includes('/tasks/cms-task-1/complete') &&
            init?.method === 'POST' &&
            typeof body === 'string' &&
            body.includes('"approved":true') &&
            body.includes('"outcome":"approved-from-axis"')
          );
        }),
      ).toBe(true),
    );
  });
  it('does not claim empty queues or zero work before first owner evidence', async () => {
    const pending: ((response: Response) => void)[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      requestUrl(input).includes('/tasks?')
        ? new Promise((resolve) => pending.push(resolve))
        : Promise.resolve(jsonResponse([])),
    );
    renderPage('/process/tasks');
    expect(
      await screen.findByText('Loading approval tasks from Process.'),
    ).toBeVisible();
    expect(screen.getByText('Checking API')).toBeVisible();
    expect(screen.queryByText('UP')).not.toBeInTheDocument();
    expect(screen.queryByText('No tasks on this page.')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/No workflow instances were returned/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('No workflow recovery incidents need action.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('0 awaiting review')).not.toBeInTheDocument();
    expect(screen.queryByText('0 approval decisions')).not.toBeInTheDocument();
    await act(() => Promise.resolve(pending[0]!(jsonResponse([]))));
    expect(await screen.findByText('No tasks on this page.')).toBeVisible();
    expect(screen.getByText(/No workflow instances were returned/)).toBeVisible();
    expect(
      screen.getByText('No workflow recovery incidents need action.'),
    ).toBeVisible();
    expect(screen.getByText('0 awaiting review')).toBeVisible();
  });

  it('keeps approval tasks actionable when the independent incident read is forbidden', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes('/incidents'))
        return Promise.resolve(new Response(null, { status: 403 }));
      if (url.includes('/tasks?'))
        return Promise.resolve(
          jsonResponse([
            { code: 'limited-review-task', status: 'OPEN', instanceCode: 'review-1' },
          ]),
        );
      return Promise.resolve(jsonResponse([]));
    });

    renderPage('/process/tasks');

    expect(await screen.findByText('limited-review-task')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Claim' })).toBeEnabled();
    expect(screen.queryByText('API unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText('Recovery incidents')).not.toBeInTheDocument();
  });

  it('keeps failed task reads unconfirmed and recovers with GET only', async () => {
    let taskReads = 0;
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const failed = requestUrl(input).includes('/tasks?') && ++taskReads === 1;
      return Promise.resolve(
        failed
          ? new Response(
              JSON.stringify({ message: 'Task queue temporarily unavailable' }),
              { status: 503 },
            )
          : jsonResponse([]),
      );
    });
    const user = userEvent.setup();
    renderPage('/process/tasks');
    expect(await screen.findByText('Task queue temporarily unavailable')).toBeVisible();
    expect(screen.getByText('API unavailable')).toBeVisible();
    expect(screen.queryByText('UP')).not.toBeInTheDocument();
    expect(screen.queryByText('No tasks on this page.')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/No workflow instances were returned/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('0 awaiting review')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Refresh task evidence' }));
    expect(await screen.findByText('No tasks on this page.')).toBeVisible();
    expect(screen.getByText('UP')).toBeVisible();
    expect(taskReads).toBe(2);
    expect(
      fetcher.mock.calls.every(
        ([, init]) => (init?.method ?? 'GET') === 'GET' && init?.body === undefined,
      ),
    ).toBe(true);
  });

  it('reports an unavailable owner without a fake loading or empty result', () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([]));
    renderPage('/process/tasks', { ...bootstrap, moduleConnections: {} });
    expect(
      screen.getByText('The work queue is unavailable in the current workspace.'),
    ).toBeVisible();
    expect(
      screen.queryByText('Loading approval tasks from Process.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('No tasks on this page.')).not.toBeInTheDocument();
    expect(screen.queryByText('0 awaiting review')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Refresh task evidence' }),
    ).toBeDisabled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('gives safe network recovery guidance and restores current API evidence after an explicit GET refresh', async () => {
    let taskReads = 0;
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (requestUrl(input).includes('/tasks?') && ++taskReads === 1)
        return Promise.reject(
          new TypeError('Failed to fetch private-provider-address'),
        );
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();
    renderPage('/process/tasks');
    expect(
      await screen.findByText(
        'The Process service could not be reached. Refresh its current evidence before trying again.',
      ),
    ).toBeVisible();
    expect(screen.queryByText(/private-provider-address/)).not.toBeInTheDocument();
    expect(screen.queryByText('UP')).not.toBeInTheDocument();
    expect(screen.getByText('API unavailable')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Refresh task evidence' }));
    expect(await screen.findByText('No tasks on this page.')).toBeVisible();
    expect(screen.getByText('UP')).toBeVisible();
    expect(taskReads).toBe(2);
    expect(
      fetcher.mock.calls.every(
        ([, init]) => (init?.method ?? 'GET') === 'GET' && init?.body === undefined,
      ),
    ).toBe(true);
  });

  it('retains previous owner evidence while a failed refresh holds instance commands', async () => {
    let taskReads = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = requestUrl(input);
      if (url.includes('/tasks?') && ++taskReads > 1)
        return Promise.resolve(
          new Response(JSON.stringify({ message: 'Refresh could not be confirmed' }), {
            status: 503,
          }),
        );
      return Promise.resolve(
        jsonResponse(
          url.includes('/instances?')
            ? [
                {
                  code: 'prior-instance',
                  definitionCode: 'review',
                  version: 1,
                  status: 'WAITING',
                },
              ]
            : [],
        ),
      );
    });
    const user = userEvent.setup();
    renderPage('/process/tasks');
    expect(
      await screen.findByRole('heading', { name: 'prior-instance' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel instance' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Refresh task evidence' }));
    expect(await screen.findByText('Refresh could not be confirmed')).toBeVisible();
    expect(screen.getByText('API unavailable')).toBeVisible();
    expect(screen.queryByText('UP')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'prior-instance' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel instance' })).toBeDisabled();
  });
});
