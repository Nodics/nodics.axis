import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';
import { ModuleHealthRoutePage } from '../../../src/operations/moduleHealth/ModuleHealthRoutePage';
import type { AxisAuthenticatedBootstrap } from '../../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../../src/runtime/runtimeConfig';
import type {
  ModuleHealthSummary,
  ModuleHealthDetail,
} from '../../../src/operations/moduleHealth/api/moduleHealthContracts';
const reads = vi.hoisted(() => vi.fn<() => Promise<readonly ModuleHealthSummary[]>>());
const details = vi.hoisted(() => vi.fn<() => Promise<ModuleHealthDetail>>());
const checks = vi.hoisted(() => vi.fn<() => Promise<void>>());
vi.mock('../../../src/operations/moduleHealth/api/moduleHealthClient', () => ({
  loadModuleHealth: reads,
  loadModuleHealthDetail: details,
  refreshModuleHealth: checks,
}));
const bootstrap = {
  tenantCode: 'tenant',
  moduleConnections: {
    backoffice: [
      {
        moduleName: 'backoffice',
        instanceId: 'one',
        endpoint: 'https://one.example/nodics/backoffice',
        environment: 'local',
        state: 'UP',
      },
    ],
  },
} as unknown as AxisAuthenticatedBootstrap;
const runtime = {
  enterpriseCode: 'business',
  requestTimeoutMs: 1000,
} as AxisRuntimeConfig;
const row: ModuleHealthSummary = {
  moduleName: 'sample',
  displayName: 'Sample owner',
  environments: ['local'],
  servers: ['server'],
  availability: {
    state: 'UP',
    activeInstances: 1,
    healthyInstances: 1,
    unavailableInstances: 0,
    unknownInstances: 0,
  },
};
function view(client: QueryClient, source = bootstrap, actor = 'test-actor') {
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ModuleHealthRoutePage
          accessToken={actor}
          bootstrap={source}
          runtime={runtime}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  reads.mockReset().mockResolvedValue([row]);
  details.mockReset();
  checks.mockReset().mockResolvedValue(undefined);
});

it('inspects current owner state after a partially failed check without replaying the command', async () => {
  const instance = {
    instanceId: 'one',
    clientCallable: true,
    lastSeenAt: '2026-11-07T00:00:00Z',
    availability: { state: 'UP' as const, freshness: 'FRESH' as const },
  };
  details.mockResolvedValueOnce({
    moduleName: 'sample',
    availability: row.availability,
    instances: [instance],
  });
  render(view(new QueryClient({ defaultOptions: { queries: { retry: false } } })));
  await userEvent.click(await screen.findByRole('button', { name: /Sample owner/ }));
  await screen.findByRole('button', { name: 'Check now' });
  const unavailable = {
    ...row.availability,
    state: 'UNAVAILABLE' as const,
    healthyInstances: 0,
    unavailableInstances: 1,
  };
  reads.mockResolvedValueOnce([{ ...row, availability: unavailable }]);
  details.mockResolvedValueOnce({
    moduleName: 'sample',
    availability: unavailable,
    instances: [
      { ...instance, availability: { ...instance.availability, state: 'UNAVAILABLE' } },
    ],
  });
  checks.mockRejectedValueOnce(new Error('Later contract discovery failed'));
  await userEvent.click(screen.getByRole('button', { name: 'Check now' }));
  expect(await screen.findByText('Later contract discovery failed')).toBeVisible();
  expect(
    await screen.findByRole('button', {
      name: /Sample owner 0 of 1 instances ready UNAVAILABLE/,
    }),
  ).toBeVisible();
  expect(checks).toHaveBeenCalledTimes(1);
  expect(reads).toHaveBeenCalledTimes(2);
  expect(details).toHaveBeenCalledTimes(2);
});

it('refreshes an open instance detail with the list instead of restoring an older membership snapshot', async () => {
  const instance = {
    instanceId: 'one',
    clientCallable: true,
    lastSeenAt: '2026-11-07T00:00:00Z',
    availability: { state: 'UP' as const, freshness: 'FRESH' as const },
  };
  details.mockResolvedValueOnce({
    moduleName: 'sample',
    availability: row.availability,
    instances: [instance],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(view(client));
  await userEvent.click(await screen.findByRole('button', { name: /Sample owner/ }));
  expect(await screen.findByText('1 registered runtime instance')).toBeVisible();
  const availability = { ...row.availability, activeInstances: 2, healthyInstances: 2 };
  reads.mockResolvedValueOnce([{ ...row, availability }]);
  details.mockResolvedValueOnce({
    moduleName: 'sample',
    availability,
    instances: [instance, { ...instance, instanceId: 'two' }],
  });
  await userEvent.click(screen.getByRole('button', { name: 'Refresh list' }));
  expect(await screen.findByText('2 registered runtime instances')).toBeVisible();
  expect(screen.queryByText('1 registered runtime instance')).not.toBeInTheDocument();
  expect(details).toHaveBeenCalledTimes(2);
});
it('withholds health totals during initial reads, refresh and failure, then shows verified recovery', async () => {
  let resolve!: (rows: readonly ModuleHealthSummary[]) => void;
  reads.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(view(client));
  const totals = screen.getByRole('group', { name: 'Module health totals' });
  expect(totals).toHaveAttribute('aria-busy', 'true');
  expect(within(totals).queryByText('0')).not.toBeInTheDocument();
  await act(async () => {
    resolve([row]);
    await Promise.resolve();
  });
  await waitFor(() => expect(totals).toHaveAttribute('aria-busy', 'false'));
  expect(within(totals).getAllByText('1')).toHaveLength(2);
  reads.mockRejectedValueOnce(new Error('Registry unavailable'));
  await userEvent.click(screen.getByRole('button', { name: 'Refresh list' }));
  expect(await screen.findByText('Registry unavailable')).toBeVisible();
  expect(within(totals).queryByText('1')).not.toBeInTheDocument();
  expect(within(totals).queryByText('0')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Sample owner/ }),
  ).not.toBeInTheDocument();
  reads.mockResolvedValueOnce([]);
  await userEvent.click(screen.getByRole('button', { name: 'Refresh list' }));
  await waitFor(() => expect(within(totals).getAllByText('0')).toHaveLength(5));
});
it('isolates replacement sources and actors from cached healthy evidence', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rendered = render(view(client));
  await screen.findByRole('button', { name: /Sample owner/ });
  reads.mockImplementation(() => new Promise(() => {}));
  const replacement = {
    ...bootstrap,
    moduleConnections: {
      backoffice: [
        {
          ...bootstrap.moduleConnections.backoffice![0]!,
          instanceId: 'two',
          endpoint: 'https://two.example/nodics/backoffice',
        },
      ],
    },
  };
  rendered.rerender(view(client, replacement, 'another-actor'));
  const totals = screen.getByRole('group', { name: 'Module health totals' });
  expect(within(totals).queryByText('1')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Sample owner/ }),
  ).not.toBeInTheDocument();
  expect(
    JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey),
    ),
  ).not.toContain('test-actor');
  expect(
    JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey),
    ),
  ).not.toContain('another-actor');
});
