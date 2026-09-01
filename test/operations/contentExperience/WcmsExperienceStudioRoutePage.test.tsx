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
import { WcmsExperienceStudioRoutePage } from '../../../src/operations/contentExperience/WcmsExperienceStudioRoutePage';
import type { AxisRuntimeConfig } from '../../../src/runtime/runtimeConfig';

vi.mock('../../../src/workbench/WorkbenchRoutePage', () => ({
  WorkbenchRoutePage: ({
    routeSchema,
  }: {
    readonly routeSchema?: { readonly moduleName: string; readonly schemaName: string };
  }) => (
    <div>
      Workbench: {routeSchema?.moduleName}.{routeSchema?.schemaName}
    </div>
  ),
}));

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
  id: 'wcms-experience-studio',
  label: 'Experience Studio',
  route: '/content/experience-studio',
  order: 560,
  moduleName: 'wcmsExperience',
  category: 'content',
  icon: 'experience',
  availability: 'UP',
  featureState: 'ACTIVE',
  group: {
    id: 'content',
    label: 'Content and Experience',
    order: 200,
  },
  help: {
    summary: 'Configure targeted CMS page experiences.',
    documentationRoute: '/docs/capabilities/content-publishing/experience-targeting',
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
    wcmsExperience: [
      {
        moduleName: 'wcmsExperience',
        instanceId: 'kickoffLocal:wcmsStagedServer:wcmsExperience:0',
        endpoint: 'http://localhost:4312/nodics/wcmsExperience',
        environment: 'kickoffLocal',
        server: 'wcmsStagedServer',
        state: 'UP',
      },
    ],
  },
  documentationSources: [],
  tenantCode: 'default',
};

function renderPage(path = '/content/experience-studio') {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <WcmsExperienceStudioRoutePage
            accessToken="employee-token"
            bootstrap={bootstrap}
            channel="web"
            cmsBaseUrl="/cms"
            employeeId="operator"
            locale="en-US"
            navigation={navigation}
            runtime={runtime}
            site="agoraApparelSite"
          />
        </MemoryRouter>
      </QueryClientProvider>
    </AxisThemeProvider>,
  );
}

describe('WcmsExperienceStudioRoutePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders backend-governed overview for collection, brand, and fallback journeys', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Experience Studio' })).toBeVisible();
    expect(screen.getByText(/without changing frontend code/i)).toBeVisible();
    expect(screen.getByText('Collection journey')).toBeVisible();
    expect(screen.getByText('Brand journey')).toBeVisible();
    expect(screen.getByText('Default fallback')).toBeVisible();
    expect(screen.getByText(/indexed projections only/i)).toBeVisible();
  });

  it('renders placements through the backend-owned workbench schema', () => {
    renderPage('/content/experience-studio/placements');

    expect(
      screen.getByText('Workbench: wcmsExperience.cmsExperiencePlacement'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: /Placements/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('runs staged preview through the authoring endpoint', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            site: 'agoraApparelSite',
            pageType: 'PRODUCT_LISTING',
            release: 'agora.apparel:agoraApparelContentCatalog:0.0.2',
            indexVersion: 'manifest-v12',
            slots: {
              hero: [
                {
                  placementCode: 'newInHeroPlacement',
                  componentCode: 'newInHero',
                  rendererKey: 'agora.heroBanner',
                  contractVersion: 1,
                  properties: { heading: 'Fresh styles just in' },
                  media: [],
                },
              ],
            },
            diagnostics: { matched: true, fallbackUsed: false, placementCount: 1 },
          },
        }),
      ),
    );

    renderPage('/content/experience-studio/preview');
    await user.click(screen.getByRole('button', { name: /Run staged preview/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const previewCall = fetchMock.mock.calls[0] as
      | readonly [URL, RequestInit]
      | undefined;
    expect(previewCall?.[0]).toEqual(
      new URL('http://localhost:4312/nodics/wcmsExperience/v0/authoring/preview'),
    );
    expect(previewCall?.[1].method).toBe('POST');
    expect(typeof previewCall?.[1].body).toBe('string');
    expect(previewCall?.[1].body).toContain('"targetCode":"agoraNewArrivals"');
    expect(await screen.findByText('hero')).toBeVisible();
    expect(screen.getByText(/newInHeroPlacement → newInHero/i)).toBeVisible();
  });

  it('loads index status from the authoring diagnostics endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            status: 'CURRENT',
            indexingMode: 'OUTBOX_EVENTUAL',
            currentIndexVersion: 'manifest-v12',
            documentCount: 42,
            onlineAliasTemplate: 'cms_experience_{site}_online_current',
          },
        }),
      ),
    );

    renderPage('/content/experience-studio/index-status');

    expect(await screen.findByText('CURRENT')).toBeVisible();
    expect(screen.getByText('OUTBOX_EVENTUAL')).toBeVisible();
    expect(screen.getByText('manifest-v12')).toBeVisible();
    expect(screen.getByText('42')).toBeVisible();
  });
});
