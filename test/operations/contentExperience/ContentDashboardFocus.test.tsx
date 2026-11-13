import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import type { AxisAuthenticatedBootstrap } from '../../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../../src/runtime/runtimeConfig';
import { ContentDashboardRoutePage } from '../../../src/operations/contentExperience/ContentDashboardRoutePage';
import * as metricOwner from '../../../src/operations/shared/workbenchMetricDashboardModel';
const bootstrap: AxisAuthenticatedBootstrap = {
  axisPolicy: {
    contractVersion: 0,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 1,
    source: 'DEFAULT',
  },
  navigation: [],
  moduleConnections: {},
  moduleCatalog: {},
  documentationSources: [],
  environments: ['local'],
  tenantCode: 'default',
};
const runtime: AxisRuntimeConfig = {
  backofficeBaseUrl: 'http://localhost:4300',
  enterpriseCode: 'default',
  projectCode: 'test',
  clientContractVersion: 1,
  requestTimeoutMs: 1000,
  browserSessionTimeoutMs: 15000,
  browserSessionCsrfCookieName: 'csrf',
  assistantMaximumEventBytes: 1024,
  assistantReconnectWindowMs: 1000,
  assistantIdleTimeoutMs: 1000,
};
function show(fragment: string, initialRead?: typeof metricOwner.loadWorkbenchMetrics) {
  const reads = vi
    .spyOn(metricOwner, 'loadWorkbenchMetrics')
    .mockImplementation((_connections, _bootstrap, _config, definitions) =>
      Promise.resolve(
        definitions.map((definition) => ({
          ...definition,
          status: 'ready',
          value: 3,
          detail: definition.description,
          canOpen: false,
        })),
      ),
    );
  if (initialRead) reads.mockImplementationOnce(initialRead);
  render(
    <AxisThemeProvider>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={['/content' + fragment]}>
          <ContentDashboardRoutePage
            bootstrap={bootstrap}
            runtime={runtime}
            accessToken="private-token"
          />
        </MemoryRouter>
      </QueryClientProvider>
    </AxisThemeProvider>,
  );
  return reads;
}
afterEach(() => vi.restoreAllMocks());
describe('Content group navigation', () => {
  it.each([
    ['sites-catalogs', 'Websites and Content Catalogs', ['sites', 'catalogs']],
    [
      'templates-layout',
      'Templates and Layout',
      ['page-templates', 'slot-definitions'],
    ],
    ['pages-routes', 'Pages and Routes', ['pages', 'routes']],
    [
      'components-content-blocks',
      'Components and Content Blocks',
      ['components', 'component-media'],
    ],
    ['navigation-menus', 'Navigation and Menus', ['navigation']],
    [
      'visibility-experience-rules',
      'Visibility and Experience Rules',
      ['restrictions', 'experience-placements'],
    ],
    [
      'content-types-rendering',
      'Content Types and Rendering',
      ['type-codes', 'renderer-mappings'],
    ],
  ] as const)(
    'opens %s as a focused business view and bounded owner read set',
    async (fragment, title, ids) => {
      const reads = show('#' + fragment);
      expect(screen.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await waitFor(() => expect(reads).toHaveBeenCalled());
      expect(reads.mock.calls[0]![3].map((item) => item.id).sort()).toEqual(
        [...ids].sort(),
      );
      expect(
        screen.queryByRole('heading', { name: 'Publishing readiness' }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'All content' })).toHaveAttribute(
        'href',
        '/content',
      );
    },
  );
  it('returns from a focused group to the complete workspace with its own read set', async () => {
    const user = userEvent.setup();
    const reads = show('#templates-layout');
    await user.click(screen.getByRole('link', { name: 'All content' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Content and Experience' }),
    ).toBeVisible();
    await waitFor(() =>
      expect(reads.mock.calls.some((call) => call[3].length === 18)).toBe(true),
    );
  });
  it('keeps the full overview for an unknown fragment', async () => {
    const reads = show('#unknown');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Content and Experience' }),
    ).toBeVisible();
    await waitFor(() => expect(reads).toHaveBeenCalled());
    expect(reads.mock.calls[0]![3]).toHaveLength(18);
  });
  it('distinguishes an unavailable owner count from an empty inventory and retries only the selected view', async () => {
    const user = userEvent.setup();
    const reads = show(
      '#navigation-menus',
      (_connections, _bootstrap, _config, definitions) =>
        Promise.resolve(
          definitions.map((definition) => ({
            ...definition,
            status: 'unavailable',
            value: undefined,
            detail: 'The owner did not respond.',
            canOpen: false,
          })),
        ),
    );
    const retry = await screen.findByRole('button', { name: 'Retry counts' });
    expect(screen.getByText('Counts unavailable')).toBeVisible();
    expect(screen.queryByText('0 records')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Open designer' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Experience Studio' }),
    ).not.toBeInTheDocument();
    reads.mockImplementationOnce((_connections, _bootstrap, _config, definitions) =>
      Promise.resolve(
        definitions.map((definition) => ({
          ...definition,
          status: 'ready',
          value: 0,
          detail: definition.description,
          canOpen: false,
        })),
      ),
    );
    await user.click(retry);
    expect(
      await screen.findByText('No records are available in this workspace yet.'),
    ).toBeVisible();
    expect(screen.getByText('0 records')).toBeVisible();
    expect(reads.mock.calls.map((call) => call[3].map((item) => item.id))).toEqual([
      ['navigation'],
      ['navigation'],
    ]);
  });
});
