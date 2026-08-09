import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../../src/bootstrap/publicBootstrap';
import { ContentDesignerRoutePage } from '../../../src/operations/contentExperience/ContentDesignerRoutePage';
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
  id: 'content-designer',
  label: 'Page Designer',
  route: '/content/designer',
  order: 202,
  moduleName: 'cms',
  category: 'content',
  icon: 'layout',
  availability: 'UP',
  featureState: 'PREVIEW',
  group: {
    id: 'content',
    label: 'Content and Experience',
    order: 200,
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
    catalog: [
      {
        moduleName: 'catalog',
        instanceId: 'kickoffLocal:wcmsServer:catalog:0',
        endpoint: 'http://localhost:4310/nodics/catalog',
        environment: 'kickoffLocal',
        state: 'UP',
      },
    ],
    cms: [
      {
        moduleName: 'cms',
        instanceId: 'kickoffLocal:wcmsServer:cms:0',
        endpoint: 'http://localhost:4310/nodics/cms',
        environment: 'kickoffLocal',
        state: 'UP',
      },
    ],
    media: [
      {
        moduleName: 'media',
        instanceId: 'kickoffLocal:wcmsServer:media:0',
        endpoint: 'http://localhost:4310/nodics/media',
        environment: 'kickoffLocal',
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
  return render(
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ContentDesignerRoutePage
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

describe('ContentDesignerRoutePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('guides business users through governed WCMS composition steps', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderPage();

    expect(screen.getByRole('heading', { name: 'Content Designer' })).toBeVisible();
    expect(screen.getByText('Choose or create site')).toBeVisible();
    expect(screen.getByText('Select template')).toBeVisible();
    expect(screen.getByText('Arrange sections and slots')).toBeVisible();
    expect(screen.getByText('Associate media')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open media' })).toHaveAttribute(
      'href',
      '/media/items?folderCode=cmsAssets',
    );

    await user.clear(screen.getByLabelText('Page intent'));
    await user.type(screen.getByLabelText('Page intent'), 'summerCampaign');

    expect(screen.getByText(/page: summerCampaign; first component:/i)).toBeVisible();
  });
});
