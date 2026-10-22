import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../../src/bootstrap/publicBootstrap';
import { ContentDesignerRoutePage } from '../../../src/operations/contentExperience/ContentDesignerRoutePage';
import * as metricClient from '../../../src/operations/shared/workbenchMetricDashboardModel';
import type { AxisRuntimeConfig } from '../../../src/runtime/runtimeConfig';
import { retirementPresentation } from './contentDesignerRetirementFixtures';

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
    contractVersion: 0,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 1,
    source: 'DEFAULT',
  },
  navigation: [
    navigation,
    {
      ...navigation,
      id: 'media-items',
      moduleName: 'media',
      route: '/media/items',
      featureState: 'ACTIVE',
    },
  ],
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
        runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
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

function renderPage(context: AxisAuthenticatedBootstrap = bootstrap) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const rendered = render(
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ContentDesignerRoutePage
            accessToken="employee-token"
            bootstrap={context}
            routeNavigation={navigation}
            runtime={runtime}
          />
        </MemoryRouter>
      </QueryClientProvider>
    </AxisThemeProvider>,
  );
  return { ...rendered, queryClient };
}

describe('ContentDesignerRoutePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    undefined,
    { code: 'WCMS_ONLINE', publication: 'ONLINE' },
    { code: 'WCMS_STAGED', publication: 'ONLINE' },
    { code: 'COMMERCE_STAGED', publication: 'STAGED' },
  ])(
    'never falls back to server names without the CMS authoring role: %j',
    (runtimeRole) => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      renderPage({
        ...bootstrap,
        moduleConnections: {
          cms: [
            {
              moduleName: 'cms',
              instanceId: 'legacy-cms',
              endpoint: 'http://localhost:4312/nodics/cms',
              environment: 'kickoffLocal',
              server: 'wcmsServer',
              runtimeRole,
              state: 'UP',
            },
          ],
        },
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Validate draft' })).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Save immutable draft' }),
      ).toBeDisabled();
    },
  );

  it('uses the declared CMS authoring role on a customer-named server', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ result: { rules: {}, operations: [] } })),
      );
    renderPage({
      ...bootstrap,
      moduleConnections: {
        cms: [
          {
            moduleName: 'cms',
            instanceId: 'custom-authoring',
            endpoint: 'http://localhost:4400/nodics/cms',
            environment: 'custom',
            server: 'contentAuthoring',
            runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
            state: 'UP',
          },
        ],
      },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls.map(([input]) => requestUrl(input))).toEqual([
      'http://localhost:4400/nodics/cms/v0/designer/composition/model',
    ]);
  });

  it.each([
    {
      name: 'author',
      operations: [
        'validateDraftComposition',
        'saveDraftComposition',
        'submitForPublication',
      ],
    },
    { name: 'view', operations: [] },
    {
      name: 'full control',
      operations: [
        'validateDraftComposition',
        'saveDraftComposition',
        'submitForPublication',
        'deleteSection',
        'deleteComponent',
        'detachMedia',
      ],
    },
    { name: 'missing authority', operations: undefined },
    { name: 'validate only', operations: ['validateDraftComposition'] },
    {
      name: 'save without submission',
      operations: ['validateDraftComposition', 'saveDraftComposition'],
    },
  ])(
    'honors $name owner operations without generic discovery',
    async ({ operations }) => {
      let permittedOperations = operations;
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
                  operations: permittedOperations,
                  retirement: retirementPresentation,
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
        if (url.includes('/designer/composition/sections/delete')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                result: {
                  code: 'placement-a',
                  active: false,
                  versionId: 3,
                  authoringScope: {
                    enterpriseCode: 'default',
                    catalogCode: 'documentationContentCatalog',
                    siteCode: 'axisCmsSite',
                  },
                },
              }),
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

      const { queryClient } = renderPage();

      expect(screen.getByRole('heading', { name: 'Content Designer' })).toBeVisible();
      expect(screen.getByText('Choose catalog')).toBeVisible();
      expect(screen.getByText('Choose or create site')).toBeVisible();
      expect(screen.getByText('Select template')).toBeVisible();
      expect(screen.getByText('Arrange sections and slots')).toBeVisible();
      expect(screen.getByText('Associate media')).toBeVisible();
      expect(screen.getByText('Helpful backend hints')).toBeVisible();
      expect(screen.getByText(/Start with the fields below/i)).toBeVisible();
      expect(screen.getByText(/Validate first\. Save will unlock/i)).toBeVisible();
      expect(
        screen.getByRole('button', { name: 'Save immutable draft' }),
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Submit to governed Publishing' }),
      ).toBeDisabled();
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
      expect(
        screen.getAllByText(/Catalog: documentationContentCatalog/i).length,
      ).toBeGreaterThan(0);
      expect(screen.getAllByText(/Site: axisCmsSite/i).length).toBeGreaterThan(0);
      expect(
        screen.getAllByText(/Template: documentationLandingTemplate/i).length,
      ).toBeGreaterThan(0);
      expect(screen.getAllByText(/Slot: hero/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Slot: body/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Slot: footer/i).length).toBeGreaterThan(0);
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

      expect(
        fetchMock.mock.calls.every(([input]) =>
          requestUrl(input).includes('/designer/composition/model'),
        ),
      ).toBe(true);
      expect(screen.queryByText('Readiness snapshot')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Open pages' }),
      ).not.toBeInTheDocument();
      if (!operations?.includes('validateDraftComposition')) {
        expect(screen.getByRole('button', { name: 'Validate draft' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Validate draft' }));
        expect(
          screen.getByRole('button', { name: 'Save immutable draft' }),
        ).toBeDisabled();
        expect(
          screen.getByRole('button', { name: 'Submit to governed Publishing' }),
        ).toBeDisabled();
        expect(
          fetchMock.mock.calls.every(([input]) =>
            requestUrl(input).includes('/designer/composition/model'),
          ),
        ).toBe(true);
        return;
      }

      await user.click(screen.getByRole('button', { name: 'Validate draft' }));
      await waitFor(() => {
        expect(screen.getByText(/Validation result: VALID_DRAFT/i)).toBeVisible();
      });
      expect(
        screen.getByText(/This draft is validated and ready to save/i),
      ).toBeVisible();
      if (!operations.includes('saveDraftComposition')) {
        expect(
          screen.getByRole('button', { name: 'Save immutable draft' }),
        ).toBeDisabled();
        expect(
          fetchMock.mock.calls.some(([input]) =>
            requestUrl(input).includes('/designer/composition/draft'),
          ),
        ).toBe(false);
        return;
      }
      expect(
        screen.getByRole('button', { name: 'Save immutable draft' }),
      ).toBeEnabled();

      await user.click(screen.getByRole('button', { name: 'Save immutable draft' }));
      await waitFor(() => {
        expect(
          screen.getByText(/Save result: CMS draft saved as governed Staged records/i),
        ).toBeVisible();
      });
      if (!operations.includes('submitForPublication')) {
        expect(
          screen.getByRole('button', { name: 'Submit to governed Publishing' }),
        ).toBeDisabled();
        expect(
          fetchMock.mock.calls.some(([input]) =>
            requestUrl(input).includes('/publication-request'),
          ),
        ).toBe(false);
        return;
      }
      expect(
        screen.getByRole('button', { name: 'Submit to governed Publishing' }),
      ).toBeEnabled();
      await user.click(
        screen.getByRole('button', { name: 'Submit to governed Publishing' }),
      );
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
      if (operations.includes('deleteSection')) {
        await user.type(screen.getByLabelText('Record code'), 'placement-a');
        await user.click(screen.getByRole('button', { name: 'Review retirement' }));
        await user.click(
          screen.getByLabelText(retirementPresentation.acknowledgeLabel),
        );
        await user.click(screen.getByRole('button', { name: 'Confirm retirement' }));
        await waitFor(() =>
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
        );
        expect(
          screen.getByRole('button', { name: 'Save immutable draft' }),
        ).toBeDisabled();
        expect(
          screen.getByRole('button', { name: 'Submit to governed Publishing' }),
        ).toBeDisabled();
        expect(screen.getByLabelText('Page intent')).toHaveValue('summerCampaign');
        expect(
          fetchMock.mock.calls.filter(([input]) =>
            requestUrl(input).includes('/sections/delete'),
          ),
        ).toHaveLength(1);
      }
      const writeCount = fetchMock.mock.calls.filter(
        ([, init]) => init?.method !== 'GET',
      ).length;
      permittedOperations = [];
      await act(async () => {
        await queryClient.invalidateQueries({
          queryKey: ['content-designer-authoring-model'],
        });
      });
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Validate draft' })).toBeDisabled(),
      );
      expect(
        screen.getByRole('button', { name: 'Save immutable draft' }),
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Submit to governed Publishing' }),
      ).toBeDisabled();
      expect(screen.getByLabelText('Page intent')).toHaveValue('summerCampaign');
      expect(
        fetchMock.mock.calls.filter(([, init]) => init?.method !== 'GET').length,
      ).toBe(writeCount);
    },
  );

  it('limits metrics to available backend-authorized Workbench targets and their owners', async () => {
    const metrics = vi
      .spyOn(metricClient, 'loadWorkbenchMetrics')
      .mockResolvedValue([]);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: { operations: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    renderPage({
      ...bootstrap,
      navigation: [
        navigation,
        {
          ...navigation,
          id: 'sites',
          route: '/content/sites',
          featureState: 'ACTIVE',
          workbenchTarget: { moduleName: 'cms', schemaName: 'cmsSite' },
        },
        {
          ...navigation,
          id: 'catalogs',
          route: '/content/catalogs',
          featureState: 'DISABLED',
          workbenchTarget: { moduleName: 'catalog', schemaName: 'catalog' },
        },
        {
          ...navigation,
          id: 'components',
          route: '/content/components',
          featureState: 'HIDDEN',
          workbenchTarget: { moduleName: 'cms', schemaName: 'cmsComponent' },
        },
        {
          ...navigation,
          id: 'pages',
          route: '/content/pages',
          availability: 'UNAVAILABLE',
          workbenchTarget: { moduleName: 'cms', schemaName: 'cmsPage' },
        },
      ],
    });
    await waitFor(() => expect(metrics).toHaveBeenCalledOnce());
    expect(
      metrics.mock.calls[0]?.[0].map((connection) => connection.moduleName),
    ).toEqual(['cms']);
    expect(metrics.mock.calls[0]?.[3].map((metric) => metric.id)).toEqual(['sites']);
  });
});
