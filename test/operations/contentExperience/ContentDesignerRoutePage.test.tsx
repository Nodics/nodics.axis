import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url =
        input instanceof Request
          ? input.url
          : input instanceof URL
            ? input.href
            : input;
      if (url.includes('/designer/composition/model')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                hierarchy: [
                  'Content Catalog',
                  'Site',
                  'Page Template',
                  'Page',
                  'Template Slots',
                  'Page Sections',
                  'Components',
                  'Media',
                  'Route',
                  'Navigation',
                ],
                operations: [
                  'validateDraftComposition',
                  'saveDraftComposition',
                  'assignRoute',
                  'assignNavigation',
                ],
                rules: {
                  arbitrarySlots: true,
                  catalogFirst: true,
                  frontendPersistence: false,
                  pixelPerfectRendering: false,
                },
              },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );
      }
      if (url.includes('/designer/composition/validate')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                valid: true,
                status: 'VALID_DRAFT',
                evidence: { sectionCount: 3, componentCount: 3 },
              },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );
      }
      if (url.includes('/designer/composition/draft')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                status: 'DRAFT_SAVED',
                saved: { pageCode: 'summerCampaign' },
              },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    renderPage();

    expect(screen.getByRole('heading', { name: 'Content Designer' })).toBeVisible();
    expect(screen.getByText('Choose catalog')).toBeVisible();
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

    expect(screen.getAllByText('Content Catalog').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getByText('Template Slots: any number')).toBeVisible();
    });
    expect(screen.getByText(/Page: summerCampaign/i)).toBeVisible();
    expect(screen.getByText(/Slot: navigation/i)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Validate draft' }));
    await waitFor(() => {
      expect(screen.getByText(/Validation result: VALID_DRAFT/i)).toBeVisible();
    });

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => {
      expect(screen.getByText(/Save result: DRAFT_SAVED/i)).toBeVisible();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'http://localhost:4310/nodics/cms/v0/designer/composition/validate',
      }),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
