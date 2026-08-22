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

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

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
        instanceId: 'kickoffLocal:wcmsStagedServer:catalog:0',
        endpoint: 'http://localhost:4312/nodics/catalog',
        environment: 'kickoffLocal',
        server: 'wcmsStagedServer',
        state: 'UP',
      },
    ],
    cms: [
      {
        moduleName: 'cms',
        instanceId: 'kickoffLocal:wcmsStagedServer:cms:0',
        endpoint: 'http://localhost:4312/nodics/cms',
        environment: 'kickoffLocal',
        server: 'wcmsStagedServer',
        state: 'UP',
      },
    ],
    media: [
      {
        moduleName: 'media',
        instanceId: 'kickoffLocal:wcmsStagedServer:media:0',
        endpoint: 'http://localhost:4312/nodics/media',
        environment: 'kickoffLocal',
        server: 'wcmsStagedServer',
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
                defaults: {
                  componentKinds: [
                    {
                      label: 'Hero banner',
                      renderer: 'axis.hero',
                      typeCode: 'heroBannerComponentType',
                    },
                    {
                      label: 'Rich text',
                      renderer: 'axis.richText',
                      typeCode: 'richTextComponentType',
                    },
                  ],
                  draftDefaults: {
                    accessMode: 'PUBLIC',
                    catalogCode: 'documentationContentCatalog',
                    pageRenderer: 'axis.page',
                    pageTypeCode: 'documentationPageType',
                    routePath: '/docs/home',
                    siteCode: 'axisCmsSite',
                    slots: ['hero', 'body', 'footer'],
                    templateCode: 'documentationLandingTemplate',
                  },
                  maximumReferenceLookupItems: 50,
                  requireNavigationForPublish: true,
                },
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
                metadata: {
                  componentTypeGroups: [
                    { code: 'marketing', name: 'Marketing components' },
                  ],
                  componentTypes: [
                    {
                      code: 'heroBannerComponentType',
                      name: 'Hero banner',
                      typeCode: 'heroBannerComponentType',
                    },
                    {
                      code: 'richTextComponentType',
                      name: 'Rich text',
                      typeCode: 'richTextComponentType',
                    },
                  ],
                  contentCatalogs: [
                    {
                      catalogType: 'CONTENT',
                      code: 'documentationContentCatalog',
                      name: 'Documentation Content Catalog',
                    },
                  ],
                  mediaFolders: [{ code: 'cmsAssets', name: 'CMS Assets' }],
                  mediaFormats: [{ code: 'original', name: 'Original' }],
                  mediaTypes: ['IMAGE', 'VIDEO', 'DOCUMENT'],
                  localization: {
                    defaultLocale: 'en',
                    fallbackLocales: ['en'],
                    supportedLocales: ['en', 'ar'],
                  },
                  navigationNodes: [
                    {
                      code: 'nodicsDocumentation',
                      name: 'Nodics Documentation',
                      siteCode: 'axisCmsSite',
                    },
                  ],
                  pageTemplates: [
                    {
                      code: 'documentationLandingTemplate',
                      name: 'Documentation Landing Template',
                    },
                  ],
                  pageTypes: [
                    {
                      code: 'documentationPageType',
                      name: 'Documentation Page',
                    },
                  ],
                  publicationReadiness: {
                    requiredDraftParts: ['route', 'navigation', 'media references'],
                    requireNavigationForPublish: true,
                  },
                  sites: [
                    {
                      catalogCode: 'documentationContentCatalog',
                      code: 'axisCmsSite',
                      name: 'Axis CMS Site',
                    },
                  ],
                  slotDefinitions: [
                    {
                      code: 'hero',
                      name: 'Hero',
                      templateCode: 'documentationLandingTemplate',
                    },
                    {
                      code: 'body',
                      name: 'Body',
                      templateCode: 'documentationLandingTemplate',
                    },
                    {
                      code: 'footer',
                      name: 'Footer',
                      templateCode: 'documentationLandingTemplate',
                    },
                  ],
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
      if (url.includes('/designer/composition/publication-request')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                status: 'PENDING_APPROVAL',
                publication: { code: 'cms-axisCmsSite-summerCampaign-route-1' },
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
    expect(screen.getByText('Helpful backend hints')).toBeVisible();
    expect(screen.getByText(/Start with the fields below/i)).toBeVisible();
    expect(screen.getByText(/Validate first\. Save will unlock/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit to Publishing' })).toBeDisabled();
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
    expect(screen.getByText(/Catalog: documentationContentCatalog/i)).toBeVisible();
    expect(screen.getByText(/Site: axisCmsSite/i)).toBeVisible();
    expect(screen.getByText(/Template: documentationLandingTemplate/i)).toBeVisible();
    expect(screen.getByText(/Slot: hero/i)).toBeVisible();
    expect(screen.getByText(/Slot: body/i)).toBeVisible();
    expect(screen.getByText(/Slot: footer/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'en' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'ar' }));
    expect(screen.getByRole('button', { name: 'ar' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/Locale ar: summerCampaign hero/i)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Validate draft' }));
    await waitFor(() => {
      expect(screen.getByText(/Validation result: VALID_DRAFT/i)).toBeVisible();
    });
    expect(
      screen.getByText(/This draft is validated and ready to save/i),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => {
      expect(screen.getByText(/Save result: DRAFT_SAVED/i)).toBeVisible();
    });
    expect(screen.getByRole('button', { name: 'Submit to Publishing' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Submit to Publishing' }));
    await waitFor(() => {
      expect(screen.getByText(/Publishing result: PENDING_APPROVAL/i)).toBeVisible();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'http://localhost:4312/nodics/cms/v0/designer/composition/validate',
      }),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'http://localhost:4312/nodics/cms/v0/designer/composition/publication-request',
      }),
      expect.objectContaining({ method: 'POST' }),
    );
    const submitCall = fetchMock.mock.calls.find(([input]) =>
      requestUrl(input).includes('/designer/composition/publication-request'),
    );
    const submitBody = submitCall?.[1]?.body;
    if (typeof submitBody !== 'string') {
      throw new Error('Expected publication submission body');
    }
    const submittedDraft = JSON.parse(submitBody) as {
      route?: { accessMode?: string };
      sections?: Array<{ components?: Array<{ accessMode?: string }> }>;
    };
    expect(submittedDraft.route?.accessMode).toBe('PUBLIC');
    expect(submittedDraft.sections?.[0]?.components?.[0]?.accessMode).toBe('PUBLIC');
  });
});
