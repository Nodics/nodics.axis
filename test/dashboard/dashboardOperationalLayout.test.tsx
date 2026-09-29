import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';
import { AxisDashboardRoutePage } from '../../src/dashboard/AxisDashboardRoutePage';
import { mergedDashboardFixture } from './dashboardCompositionFixture';

vi.mock('../../src/dashboard/AxisTechnicalDashboard', () => ({
  AxisTechnicalDashboard: () => <h2>Existing operational dashboard</h2>,
}));
afterEach(() => vi.restoreAllMocks());

it('uses the existing operational renderer for Overview without mounting the application board', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/dashboard?view=overview']}>
        <AxisDashboardRoutePage
          composition={mergedDashboardFixture}
          accessToken="test-token"
          bootstrap={
            {
              navigation: [],
              moduleConnections: {},
              applicationInitializationProfiles: [],
            } as unknown as AxisAuthenticatedBootstrap
          }
          runtime={
            { enterpriseCode: 'default', requestTimeoutMs: 1000 } as AxisRuntimeConfig
          }
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(
    await screen.findByRole('heading', { name: 'Existing operational dashboard' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(
    screen.queryByRole('heading', { name: 'Your applications' }),
  ).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});
