import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
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
  browserSessionTimeoutMs: 15_000,
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
  navigation: [
    navigation,
    ...['placements', 'preview', 'index-status'].map((tab) => ({
      ...navigation,
      id: `wcms-${tab}`,
      route: `/content/experience-studio/${tab}`,
    })),
  ],
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
        runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
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
            sessionGeneration={1}
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
    expect(
      screen.getByText(/submit the changes for review before publishing/i),
    ).toBeVisible();
  });

  it('renders placements through the backend-owned workbench schema', async () => {
    renderPage('/content/experience-studio/placements');
    await userEvent.click(
      screen.getByRole('button', { name: 'Advanced placement records' }),
    );

    expect(
      screen.getByText('Workbench: wcmsExperience.cmsExperiencePlacement'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: /Placements/i })).toHaveAttribute(
      'aria-current',
      'page',
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
    expect(previewCall?.[1].body).toContain('"targetCode":"*"');
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
  it('labels a successful empty observation without inventing fallback success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            site: 'agoraApparelSite',
            pageType: 'PRODUCT_LISTING',
            slots: {},
            diagnostics: { matched: false, fallbackUsed: false, placementCount: 0 },
          },
        }),
      ),
    );
    renderPage('/content/experience-studio/preview');
    await userEvent.click(screen.getByRole('button', { name: 'Run staged preview' }));
    expect(await screen.findByText('No matching projection')).toBeVisible();
    expect(screen.queryByText('Fallback only')).not.toBeInTheDocument();
    expect(screen.getByText(/Authored Staged records alone/)).toBeVisible();
  });

  it('retires a pending preview when its context changes and carries context to status', async () => {
    let complete!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      complete = resolve;
    });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(pending)
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            result: {
              status: 'EMPTY',
              indexingMode: 'OUTBOX_EVENTUAL',
              publication: 'STAGED',
              documentCount: 0,
            },
          }),
        ),
      );
    renderPage('/content/experience-studio/preview');
    await userEvent.click(screen.getByRole('button', { name: 'Run staged preview' }));
    await userEvent.clear(screen.getByRole('textbox', { name: 'Site' }));
    expect(screen.getByRole('button', { name: 'Run staged preview' })).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'Site' }), 'another-site');
    await act(async () => {
      complete(
        new Response(
          JSON.stringify({
            result: {
              site: 'agoraApparelSite',
              pageType: 'PRODUCT_LISTING',
              slots: {},
              diagnostics: { matched: false, fallbackUsed: false, placementCount: 0 },
            },
          }),
        ),
      );
      await pending;
    });
    expect(screen.queryByText('No matching projection')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /^Index Status$/ }));
    expect(await screen.findByText('EMPTY')).toBeVisible();
    expect((fetchMock.mock.calls.at(-1)?.[0] as URL).toString()).toContain(
      'site=another-site',
    );
    expect(screen.getByText(/Site: another-site/)).toBeVisible();
  });

  it('shows unavailable evidence and allows an explicit safe status refresh', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            result: {
              status: 'UNAVAILABLE',
              indexingMode: 'OUTBOX_EVENTUAL',
              publication: 'STAGED',
              message: 'Verify Discovery readiness, then refresh.',
            },
          }),
        ),
      ),
    );
    renderPage('/content/experience-studio/index-status');
    expect(await screen.findByText('UNAVAILABLE')).toBeVisible();
    expect(screen.getByText(/Verify Discovery readiness/)).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Refresh index evidence' }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls.every((call) => call[1]?.method === 'GET')).toBe(true);
  });
});
