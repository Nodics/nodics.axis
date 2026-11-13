import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import type { AxisAuthenticatedBootstrap } from '../../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../../src/runtime/runtimeConfig';
import { PublicationInspectionPanel } from '../../../src/operations/contentExperience/PublicationInspectionPanel';
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

const bootstrap: AxisAuthenticatedBootstrap = {
  axisPolicy: {
    contractVersion: 0,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 1,
    source: 'DEFAULT',
  },
  navigation: [
    {
      id: 'tasks',
      category: 'publishing',
      icon: 'workflow',
      label: 'Approval Queue',
      route: '/process/tasks',
      order: 1,
      moduleName: 'publish',
      availability: 'UP',
      featureState: 'ACTIVE',
      group: { id: 'publishing', label: 'Publishing', order: 1 },
    },
  ],
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
    publish: [
      {
        moduleName: 'publish',
        instanceId: 'platform-publish',
        endpoint: 'http://localhost:4300/nodics/publish',
        environment: 'kickoffLocal',
        server: 'platformServer',
        state: 'UP',
      },
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

const code = 'cms-page-route-0';
function InspectionHistory() {
  const location = useLocation(),
    navigate = useNavigate();
  return (
    <>
      <output data-testid="inspection-url">{location.search}</output>
      <button onClick={() => void navigate(-1)}>Browser back</button>
      <button onClick={() => void navigate(1)}>Browser forward</button>
    </>
  );
}
function show(path = '/publishing/requests', context = bootstrap, history = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          {history ? <InspectionHistory /> : null}
          <PublicationInspectionPanel
            bootstrap={context}
            accessToken="employee-token"
            runtime={runtime}
          />
        </MemoryRouter>
      </QueryClientProvider>
    </AxisThemeProvider>,
  );
}
afterEach(() => vi.restoreAllMocks());
describe('request evidence journey', () => {
  it('keeps a manual source choice when multiple owners exist rather than showing the first runtime as zero', () => {
    const fetcher = vi.spyOn(globalThis, 'fetch');
    show();
    expect(screen.getByRole('button', { name: 'Open request' })).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Source workspace' }),
    ).toHaveTextContent('Choose a source workspace');
    expect(
      screen.getByText(/Choose a source workspace and open a publication to see/),
    ).toBeVisible();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses the originating workspace from the handoff and preserves actual version, audit and workflow evidence', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'SUC_PUB_00000',
          result: {
            code,
            state: 'PENDING_APPROVAL',
            revision: 3,
            sourceVersion: '0',
            siteCode: 'site-a',
            workflowRef: 'approval-a',
            validation: { valid: true },
            dependencies: [{ schema: 'cmsPage', code: 'page-a', version: '0' }],
            auditTrail: [
              {
                fromState: 'VALIDATED',
                toState: 'PENDING_APPROVAL',
                revision: 3,
                actor: 'creator',
                reason: 'Reviewed draft',
              },
            ],
          },
        }),
      ),
    );
    show(
      '/publishing/requests?' +
        new URLSearchParams({
          publicationCode: code,
          sourceServer: 'wcmsStagedServer',
          sourceEnvironment: 'kickoffLocal',
        }).toString(),
    );
    expect(await screen.findByText('PENDING APPROVAL')).toBeVisible();
    expect(
      screen.getByText(
        'Publication prerequisite checks passed for this source version.',
      ),
    ).toBeVisible();
    expect(screen.getByText('Reviewed draft')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Review this workflow' })).toHaveAttribute(
      'href',
      '/process/tasks?instanceCode=approval-a',
    );
    expect(fetcher.mock.calls[0]?.[0]).toEqual(
      new URL('http://localhost:4312/nodics/publish/v0/publications/' + code),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Refresh request evidence' }),
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(fetcher.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
  });
  it('holds an unavailable originating source instead of falling back to a different healthy runtime', () => {
    const fetcher = vi.spyOn(globalThis, 'fetch');
    const context = {
      ...bootstrap,
      moduleConnections: {
        ...bootstrap.moduleConnections,
        publish: bootstrap.moduleConnections.publish!.map((item) =>
          item.server === 'wcmsStagedServer'
            ? { ...item, state: 'UNAVAILABLE' as const }
            : item,
        ),
      },
    };
    show(
      '/publishing/requests?' +
        new URLSearchParams({
          publicationCode: code,
          sourceServer: 'wcmsStagedServer',
          sourceEnvironment: 'kickoffLocal',
        }).toString(),
      context,
    );
    expect(screen.getByRole('button', { name: 'Open request' })).toBeDisabled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('shows the owner failure and support code without asserting that Online is unchanged', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'SUC_PUB_00000',
          result: {
            code,
            state: 'FAILED',
            revision: 6,
            auditTrail: [
              {
                fromState: 'ACTIVATING',
                toState: 'FAILED',
                revision: 6,
                reason: 'Activation failed',
                details: { failureCode: 'ERR_CMS_00107' },
              },
            ],
          },
        }),
      ),
    );
    show(
      '/publishing/requests?' +
        new URLSearchParams({
          publicationCode: code,
          sourceServer: 'wcmsStagedServer',
          sourceEnvironment: 'kickoffLocal',
        }).toString(),
    );
    expect(await screen.findByText('Support code: ERR_CMS_00107')).toBeVisible();
    expect(
      screen.getByText(/Confirm its target state and workflow history before retrying/),
    ).toBeVisible();
    expect(screen.queryByText(/reports this version Online/)).not.toBeInTheDocument();
  });

  it('explains a denied read and exposes no owner state or decision link', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 403 }));
    show(
      '/publishing/requests?' +
        new URLSearchParams({
          publicationCode: code,
          sourceServer: 'wcmsStagedServer',
          sourceEnvironment: 'kickoffLocal',
        }).toString(),
    );
    expect(
      await screen.findByText('You do not have access to this publication workspace.'),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Review this workflow' }),
    ).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

it('keeps declared recovery in the exact inspected workspace with explicit preparation and confirmation', async () => {
  const recovery = {
    id: 'retry',
    label: 'Retry original operation',
    intent: 'RETRY' as const,
    permission: 'publish.lifecycle.retry',
    ownerModule: 'publish',
    operationRoute: '/publications/:publicationCode/retry',
    httpMethod: 'POST' as const,
    featureState: 'ACTIVE' as const,
    targetStatuses: ['FAILED'],
    order: 1,
  };
  const context = {
    ...bootstrap,
    navigation: [
      ...bootstrap.navigation,
      {
        ...bootstrap.navigation[0]!,
        id: 'publication-requests',
        route: '/publishing/requests',
        lifecycleActions: [recovery],
      },
    ],
  };
  const original = {
    code,
    state: 'FAILED',
    revision: 2,
    domain: 'cms',
    rootType: 'page',
    rootCode: 'page-a',
    sourceVersion: '1',
    operatorOperations: ['retry'],
    operatorGuidance: 'Retry revalidates the original request.',
  };
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((_input, options) =>
    Promise.resolve(
      Response.json({
        code: 'SUC_PUB_00000',
        result:
          options?.method === 'POST'
            ? { ...original, state: 'VALIDATED', revision: 4, operatorOperations: [] }
            : original,
      }),
    ),
  );
  show(
    `/publishing/requests?publicationCode=${code}&sourceServer=wcmsStagedServer&sourceEnvironment=kickoffLocal`,
    context,
  );
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Retry original operation' }),
  );
  expect(fetcher.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(
    true,
  );
  await user.click(await screen.findByRole('button', { name: 'Confirm retry' }));
  expect(await screen.findByText(/original request was revalidated/)).toBeVisible();
  const mutations = fetcher.mock.calls.filter(
    ([, options]) => options?.method === 'POST',
  );
  expect(mutations).toHaveLength(1);
  const mutationUrl = mutations[0]?.[0];
  expect(
    mutationUrl instanceof Request ? mutationUrl.url : mutationUrl?.toString(),
  ).toBe(`http://localhost:4312/nodics/publish/v0/publications/${code}/retry`);
});

it('keeps explicit request selection, refresh and Back/Forward bound to the request URL without mutations', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const selected = url.split('/').at(-1)!;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          code: 'SUC_PUB_00000',
          result: { code: selected, state: 'WITHDRAWN', revision: 7 },
        }),
      ),
    );
  });
  const path =
    '/publishing/requests?' +
    new URLSearchParams({
      publicationCode: 'request-a',
      sourceServer: 'wcmsStagedServer',
      sourceEnvironment: 'kickoffLocal',
    }).toString();
  show(path, bootstrap, true);
  await screen.findByText('WITHDRAWN');
  const user = userEvent.setup();
  await user.clear(screen.getByRole('textbox', { name: 'Publication code' }));
  await user.type(
    screen.getByRole('textbox', { name: 'Publication code' }),
    'request-b',
  );
  await user.click(screen.getByRole('button', { name: 'Open request' }));
  await screen.findByText('WITHDRAWN');
  expect(screen.getByTestId('inspection-url')).toHaveTextContent(
    'publicationCode=request-b',
  );
  expect(screen.getByRole('textbox', { name: 'Publication code' })).toHaveValue(
    'request-b',
  );
  await user.click(screen.getByRole('button', { name: 'Browser back' }));
  await screen.findByText('WITHDRAWN');
  expect(screen.getByRole('textbox', { name: 'Publication code' })).toHaveValue(
    'request-a',
  );
  expect(screen.getByTestId('inspection-url')).toHaveTextContent(
    'publicationCode=request-a',
  );
  await user.click(screen.getByRole('button', { name: 'Browser forward' }));
  await screen.findByText('WITHDRAWN');
  expect(screen.getByRole('textbox', { name: 'Publication code' })).toHaveValue(
    'request-b',
  );
  await user.click(screen.getByRole('button', { name: 'Back to request list' }));
  expect(screen.getByTestId('inspection-url')).not.toHaveTextContent(
    'publicationCode=',
  );
  expect(screen.queryByText('WITHDRAWN')).not.toBeInTheDocument();
  expect(
    fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET'),
  ).toBe(true);
});
