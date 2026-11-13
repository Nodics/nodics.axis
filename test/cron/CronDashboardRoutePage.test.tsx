import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AxisThemeProvider } from '../../src/app/AxisThemeProvider';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../src/bootstrap/publicBootstrap';
import { CronDashboardRoutePage } from '../../src/operations/cron/CronDashboardRoutePage';
import { qualifiedCronJobAction } from '../../src/operations/cron/api/cronJobActionAuthority';
import { scheduleLifecycleTextKeys } from '../../src/operations/cron/api/cronScheduleDraftClient';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';
import {
  configuration,
  connection,
  envelope,
  presentation,
} from './scheduleDraftFixture';

vi.mock(
  '../../src/operations/shared/workbenchMetricDashboardModel',
  async (original) => ({
    ...(await original<
      typeof import('../../src/operations/shared/workbenchMetricDashboardModel')
    >()),
    loadWorkbenchMetrics: () => Promise.resolve([]),
  }),
);
const runtime = {
  enterpriseCode: configuration.enterpriseCode,
  projectCode: 'one-project',
  requestTimeoutMs: 1000,
} as AxisRuntimeConfig;
const run = {
  id: 'run',
  order: 10,
  label: 'Run now',
  intent: 'UPDATE',
  ownerModule: 'cronjob',
  permission: 'cronjob.lifecycle.manage',
  featureState: 'ACTIVE',
  httpMethod: 'POST',
  operationRoute: '/job/run/:jobCode',
} as const;
const navigation = {
  id: 'cronjob',
  order: 1,
  category: 'process',
  icon: 'cronjob',
  moduleName: 'cronjob',
  route: '/cron',
  label: 'Cron jobs',
  featureState: 'ACTIVE',
  availability: 'UP',
  lifecycleActions: [run],
} as AxisNavigationItem;
const bootstrap = {
  tenantCode: 'one-tenant',
  navigation: [navigation],
  moduleConnections: { cronjob: [connection] },
  documentationSources: [],
} as unknown as AxisAuthenticatedBootstrap;
const job = {
  code: 'job-a',
  name: 'Current owner job',
  active: true,
  runOnInit: false,
  state: 'NEW',
};
let queryClient: QueryClient;
beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  queryClient.clear();
  vi.restoreAllMocks();
});
function view(token = 'synthetic-actor-a', nav = navigation, context = bootstrap) {
  return (
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <CronDashboardRoutePage
          accessToken={token}
          bootstrap={context}
          routeNavigation={nav}
          runtime={runtime}
        />
      </QueryClientProvider>
    </AxisThemeProvider>
  );
}
function url(input: RequestInfo | URL) {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
}
function response(value: unknown) {
  return new Response(JSON.stringify(value));
}
function transport(
  post: () => Promise<Response> = () =>
    Promise.resolve(response({ code: 'SUC_JOB_00000', data: true })),
) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    if (init?.method === 'POST') return post();
    if (url(input).endsWith('/capabilities'))
      return Promise.resolve(response(envelope({ targets: [], presentation })));
    return Promise.resolve(response({ code: 'SUC_FIND_00000', result: [job] }));
  });
}

const lifecycleCapability = {
  activationEnabled: true,
  presentation: Object.fromEntries(scheduleLifecycleTextKeys.map((key) => [key, key])),
};

it.each([true, false])(
  'shows persisted run evidence and routes reviewed schedule active=%s through its exact controls',
  async (active) => {
    const row = {
      ...job,
      active,
      state: active ? 'ACTIVE' : 'STOPED',
      status: 'SUCCESS',
      startTime: '2026-11-04T08:00:00.004Z',
      endTime: '2026-11-04T08:00:00.123Z',
      jobDetail: { scheduleDraft: { version: 1 } },
    };
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (url(input).endsWith('/capabilities'))
        return Promise.resolve(
          response(
            envelope({ targets: [], presentation, lifecycle: lifecycleCapability }),
          ),
        );
      if (init?.method === 'POST')
        return Promise.resolve(
          response(
            envelope({
              code: row.code,
              revision: active ? 1 : 2,
              intent: active ? 'ACTIVATE' : 'DEACTIVATE',
              reviewDigest: 'a'.repeat(64),
              state: active ? 'ACTIVE' : 'INACTIVE',
            }),
          ),
        );
      return Promise.resolve(response({ code: 'SUC_FIND_00000', result: [row] }));
    });
    const actions = ['create', 'run', 'start', 'stop', 'pause', 'resume'].map((id) => ({
      ...run,
      id,
      label: id === 'create' ? 'Create in scheduler' : id === 'run' ? 'Run now' : id,
      operationRoute: `/job/${id}/:jobCode`,
    }));
    render(view('synthetic-actor', { ...navigation, lifecycleActions: actions }));
    await screen.findByText('Last run succeeded');
    expect(document.querySelectorAll('time')).toHaveLength(2);
    expect(document.querySelector('time')?.getAttribute('datetime')).toBe(
      row.startTime,
    );
    expect(screen.queryByRole('button', { name: 'Create in scheduler' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'stop' })).toBeNull();
    const runButton = screen.getByRole('button', { name: 'Run now' });
    if (active) expect(runButton).toBeEnabled();
    else expect(runButton).toBeDisabled();
    await userEvent.click(
      await screen.findByRole('link', { name: 'Open schedule controls' }),
    );
    expect(screen.getByRole('textbox', { name: 'code' })).toHaveValue(row.code);
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'inspect' }));
    await screen.findByText(active ? 'ACTIVE' : 'INACTIVE');
    const posts = fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(url(posts[0]![0])).toContain('/schedules/lifecycle/inspect');
  },
);

it('holds competing row commands and selection through an uncertain reviewed lifecycle command', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const path = url(input);
    if (path.endsWith('/capabilities'))
      return Promise.resolve(
        response(
          envelope({ targets: [], presentation, lifecycle: lifecycleCapability }),
        ),
      );
    if (path.endsWith('/execute'))
      return Promise.reject(new TypeError('response lost'));
    if (path.endsWith('/preview'))
      return Promise.resolve(
        response(
          envelope({
            code: job.code,
            revision: 1,
            intent: 'DEACTIVATE',
            reviewDigest: 'b'.repeat(64),
          }),
        ),
      );
    if (init?.method === 'POST')
      return Promise.resolve(
        response(
          envelope({
            code: job.code,
            revision: 1,
            intent: 'ACTIVATE',
            reviewDigest: 'a'.repeat(64),
            state: 'ACTIVE',
          }),
        ),
      );
    return Promise.resolve(
      response({
        code: 'SUC_FIND_00000',
        result: [
          { ...job, state: 'ACTIVE', jobDetail: { scheduleDraft: { version: 1 } } },
        ],
      }),
    );
  });
  render(view());
  await userEvent.click(
    await screen.findByRole('link', { name: 'Open schedule controls' }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'inspect' }));
  await userEvent.click(await screen.findByRole('button', { name: 'deactivate' }));
  await screen.findByRole('checkbox', { name: 'confirm' });
  await userEvent.click(screen.getByRole('checkbox', { name: 'confirm' }));
  await userEvent.click(screen.getByRole('button', { name: 'execute' }));
  await screen.findByText('failed');
  expect(screen.getByRole('button', { name: 'Run now' })).toBeDisabled();
  expect(screen.getByRole('link', { name: 'Open schedule controls' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Refresh job evidence' }));
  expect(screen.getByRole('button', { name: 'Run now' })).toBeDisabled();
  expect(
    fetcher.mock.calls.filter(([input]) => url(input).endsWith('/execute')),
  ).toHaveLength(1);
  expect(fetcher.mock.calls.some(([input]) => url(input).includes('/job/run/'))).toBe(
    false,
  );
});

it('admits at most one simultaneous legacy run before pending state renders', async () => {
  let finish: ((value: Response) => void) | undefined;
  const pendingResponse = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const fetcher = transport(() => pendingResponse);
  render(view());
  const button = await screen.findByRole('button', { name: 'Run now' });
  act(() => {
    fireEvent.click(button);
    fireEvent.click(button);
  });
  await waitFor(() =>
    expect(
      fetcher.mock.calls.filter(([, init]) => init?.method === 'POST'),
    ).toHaveLength(1),
  );
  await act(async () => {
    finish?.(response({ code: 'SUC_JOB_00000', data: true }));
    await pendingResponse;
  });
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(
    1,
  );
});
it('retains one business page heading and the approved draft journey, with no legacy active demo form', async () => {
  const fetcher = transport();
  render(view('synthetic-viewer', { ...navigation, lifecycleActions: [] }));
  await screen.findByText('Current owner job');
  expect(await screen.findByText(presentation.empty)).toBeVisible();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.queryByRole('textbox', { name: 'Job code' })).not.toBeInTheDocument();
  expect(
    screen.queryByRole('textbox', { name: 'Run on node' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Save Cron job' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Run now' })).not.toBeInTheDocument();
  expect(
    fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET'),
  ).toBe(true);
  expect(
    JSON.stringify(
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey),
    ),
  ).not.toContain('synthetic-viewer');
});
it.each([
  { ...navigation, lifecycleActions: [run, run] },
  { ...navigation, featureState: 'DISABLED' as const },
  { ...navigation, lifecycleActions: [{ ...run, ownerModule: 'other' }] },
  { ...navigation, lifecycleActions: [{ ...run, operationRoute: '/other/:jobCode' }] },
  { ...navigation, lifecycleActions: [{ ...run, permission: 'other.manage' }] },
])(
  'does not manufacture Cron authority from incompatible navigation metadata',
  (nav) => {
    expect(qualifiedCronJobAction(nav, 'run')).toBeUndefined();
  },
);
it('holds a negative acknowledgement and keeps read-only refresh from unlocking replay', async () => {
  const fetcher = transport(() => Promise.resolve(response({ code: 'ERR_JOB_00001' })));
  render(view());
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Run now' }));
  expect(
    await screen.findByText(/operation outcome for job-a is unconfirmed/),
  ).toBeVisible();
  expect(screen.queryByText(/Cron acknowledged the request/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Run now' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Refresh job evidence' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Refresh job evidence' })).toBeEnabled(),
  );
  expect(screen.getByRole('button', { name: 'Run now' })).toBeDisabled();
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(
    1,
  );
});
it('shows an unverified read instead of inventing an empty inventory or healthy zero', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
    Promise.resolve(
      response(
        url(input).endsWith('/capabilities')
          ? envelope({ targets: [], presentation })
          : { code: 'SUC_FIND_00000', result: {} },
      ),
    ),
  );
  render(view());
  expect(
    await screen.findByText(
      'Cron job list is incompatible. No empty inventory has been confirmed.',
    ),
  ).toBeVisible();
  expect(
    screen.queryByText(/No jobs were returned by the Cron owner/),
  ).not.toBeInTheDocument();
  expect(screen.getByText('Runtime health unverified')).toBeVisible();
  expect(screen.queryByText('0 healthy')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Run now' })).not.toBeInTheDocument();
});
it('describes a positive command response as an acknowledgement, with one dispatch and refreshed read evidence', async () => {
  const fetcher = transport();
  render(view());
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Run now' }));
  expect(
    await screen.findByText(
      'Cron acknowledged the request. Refresh job state and inspect execution evidence to confirm the result.',
    ),
  ).toBeVisible();
  expect(
    screen.queryByText('Cron lifecycle request completed.'),
  ).not.toBeInTheDocument();
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(
    1,
  );
});
it('retires a delayed private command acknowledgement when the actor changes', async () => {
  let resolvePost!: (value: Response) => void;
  const fetcher = transport(
    () =>
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
  );
  const rendered = render(view());
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Run now' }));
  rendered.rerender(view('synthetic-actor-b'));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Run now' })).toBeEnabled(),
  );
  await act(async () => {
    resolvePost(response({ code: 'SUC_JOB_00000', data: true }));
    await Promise.resolve();
  });
  expect(screen.queryByText(/Cron acknowledged the request/)).not.toBeInTheDocument();
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(
    1,
  );
});
it('hides a delayed acknowledgement when the actor loses command declarations', async () => {
  let resolvePost!: (value: Response) => void;
  transport(
    () =>
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
  );
  const rendered = render(view());
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Run now' }));
  rendered.rerender(view('synthetic-actor-a', { ...navigation, lifecycleActions: [] }));
  await act(async () => {
    resolvePost(response({ code: 'SUC_JOB_00000', data: true }));
    await Promise.resolve();
  });
  expect(screen.queryByRole('button', { name: 'Run now' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Cron acknowledged the request/)).not.toBeInTheDocument();
});
it('does not reuse a same-instance cache or late list when its actual endpoint changes', async () => {
  let resolveOld!: (value: Response) => void;
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    if (url(input).endsWith('/capabilities'))
      return Promise.resolve(response(envelope({ targets: [], presentation })));
    if (url(input).includes('next-owner.invalid'))
      return Promise.resolve(
        response({
          code: 'SUC_FIND_00000',
          result: [{ ...job, code: 'job-b', name: 'New source job' }],
        }),
      );
    return new Promise((resolve) => {
      resolveOld = resolve;
    });
  });
  const rendered = render(view());
  rendered.rerender(
    view('synthetic-actor-a', navigation, {
      ...bootstrap,
      moduleConnections: {
        cronjob: [{ ...connection, endpoint: 'https://next-owner.invalid/cronjob' }],
      },
    }),
  );
  await screen.findByText('New source job');
  await act(async () => {
    resolveOld(response({ code: 'SUC_FIND_00000', result: [job] }));
    await Promise.resolve();
  });
  expect(screen.queryByText('Current owner job')).not.toBeInTheDocument();
});
