import {
  NavigationAvailabilityRecoveryContext,
  type NavigationAvailabilityRecovery,
} from '../../../src/bootstrap/useNavigationAvailabilityRecovery';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import { AppProviders } from '../../../src/app/AppProviders';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../../src/bootstrap/publicBootstrap';
import { ContentDesignerRoutePage } from '../../../src/operations/contentExperience/ContentDesignerRoutePage';
import * as metricClient from '../../../src/operations/shared/workbenchMetricDashboardModel';
import type { AxisRuntimeConfig } from '../../../src/runtime/runtimeConfig';
import { retirementPresentation } from './contentDesignerRetirementFixtures';
import { designerFormPresentation } from './contentDesignerFormFixtures';
import type { ContentDesignerDraft } from '../../../src/operations/contentExperience/api/contentDesignerClient';

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

function wouldBlockDocumentExit() {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

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
      id: 'publication-requests',
      route: '/publishing/requests',
      moduleName: 'publish',
    },
    {
      ...navigation,
      id: 'approval-tasks',
      route: '/process/tasks',
      moduleName: 'publish',
    },
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

function renderPage(
  context: AxisAuthenticatedBootstrap = bootstrap,
  recovery?: NavigationAvailabilityRecovery,
  strict = false,
) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const tree = (current: AxisAuthenticatedBootstrap) => (
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NavigationAvailabilityRecoveryContext.Provider value={recovery}>
            <ContentDesignerRoutePage
              accessToken="employee-token"
              bootstrap={current}
              routeNavigation={navigation}
              runtime={runtime}
            />
          </NavigationAvailabilityRecoveryContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    </AxisThemeProvider>
  );
  const surface = (current: AxisAuthenticatedBootstrap) =>
    strict ? <StrictMode>{tree(current)}</StrictMode> : tree(current);
  const rendered = render(surface(context));
  return {
    ...rendered,
    queryClient,
    updateBootstrap: (next: AxisAuthenticatedBootstrap) =>
      rendered.rerender(surface(next)),
  };
}

describe('ContentDesignerRoutePage', () => {
  it('lets an author cancel a route change and keep the draft', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 403 }),
    );
    const initialUrl = window.location.href;
    window.history.replaceState({}, '', '/content/designer');
    const user = userEvent.setup();
    const app = render(
      <AppProviders runtimeConfig={runtime}>
        <Routes>
          <Route
            path="/content/designer"
            element={
              <>
                <ContentDesignerRoutePage
                  accessToken="employee-token"
                  bootstrap={bootstrap}
                  routeNavigation={navigation}
                  runtime={runtime}
                />
                <Link to="/elsewhere">Open another workspace</Link>
              </>
            }
          />
          <Route path="/elsewhere" element={<h1>Another workspace</h1>} />
        </Routes>
      </AppProviders>,
    );

    try {
      const code = await screen.findByRole('textbox', { name: 'Page code' });
      await user.type(code, 'unsaved-work');
      await user.click(screen.getByRole('link', { name: 'Open another workspace' }));
      await user.click(await screen.findByRole('button', { name: 'Keep editing' }));
      expect(code).toHaveValue('unsaved-work');
      expect(window.location.pathname).toBe('/content/designer');

      await user.click(screen.getByRole('link', { name: 'Open another workspace' }));
      await user.click(await screen.findByRole('button', { name: 'Leave page' }));
      expect(
        await screen.findByRole('heading', { name: 'Another workspace' }),
      ).toBeVisible();
      expect(wouldBlockDocumentExit()).toBe(false);
    } finally {
      app.unmount();
      window.history.replaceState({}, '', initialUrl);
    }
  });

  it('does not offer configured defaults outside the current enterprise setup as editable references', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            result: {
              rules: {},
              operations: ['validateDraftComposition', 'saveDraftComposition'],
              defaults: {
                draftDefaults: {
                  catalogCode: 'unavailableProjectCatalog',
                  siteCode: 'unavailableProjectSite',
                  templateCode: 'unavailableProjectTemplate',
                },
              },
              metadata: { contentCatalogs: [], sites: [], pageTemplates: [] },
            },
          }),
        ),
      ),
    );
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Refresh content setup' }),
      ).toBeEnabled(),
    );
    for (const name of ['Content Catalog', 'Website', 'Page template']) {
      const field = screen.getByRole('textbox', { name });
      expect(field).toHaveValue('');
      expect(field).toBeDisabled();
    }
    expect(
      screen.queryByText(/Type the .* code when WCMS metadata is unavailable/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Validate draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Refresh content setup' }),
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(
      fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET'),
    ).toBe(true);
  });

  it('refreshes authoring availability without losing entered page and address values or replaying a command', async () => {
    const refresh = vi.fn();
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 403 }));
    const context = {
      ...bootstrap,
      moduleConnections: {
        ...bootstrap.moduleConnections,
        cms: bootstrap.moduleConnections.cms!.map((item) => ({
          ...item,
          state: 'UNAVAILABLE' as const,
        })),
      },
    };
    const page = renderPage(context, {
      itemId: navigation.id,
      moduleName: 'cms',
      route: navigation.route,
      refreshing: false,
      refresh,
    });
    expect(wouldBlockDocumentExit()).toBe(false);
    const user = userEvent.setup();
    await user.clear(screen.getByRole('textbox', { name: 'Page code' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Page code' }),
      'keepThisDraft',
    );
    expect(wouldBlockDocumentExit()).toBe(true);
    await user.clear(screen.getByRole('textbox', { name: 'Web address' }));
    expect(screen.getByRole('textbox', { name: 'Web address' })).toHaveValue('');
    await user.type(
      screen.getByRole('textbox', { name: 'Web address' }),
      '/keep-this-draft',
    );
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: 'Refresh workspace availability' }),
    );
    expect(refresh).toHaveBeenCalledOnce();
    page.updateBootstrap(bootstrap);
    await screen.findByRole('button', { name: 'Retry content setup' });
    expect(screen.getByRole('textbox', { name: 'Page code' })).toHaveValue(
      'keepThisDraft',
    );
    expect(screen.getByRole('textbox', { name: 'Web address' })).toHaveValue(
      '/keep-this-draft',
    );
    expect(
      fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET'),
    ).toBe(true);
  });

  it('keeps missing setup explicit and retries a denied model by GET without submitting a draft', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            code: 'ERR_AUTH_00003',
            message: 'Content access is unavailable',
          }),
          { status: 403 },
        ),
      ),
    );
    renderPage();
    const retry = await screen.findByRole('button', { name: 'Retry content setup' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Draft preview and publication checks' }),
    );
    expect(screen.getByText('Select a page template.')).toBeVisible();
    expect(screen.getByText('Choose a component type for each section.')).toBeVisible();
    expect(screen.getByText(/Content setup is incomplete/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Validate draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await userEvent.click(retry);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(
      fetcher.mock.calls.every(([, init]) => !init?.method || init.method === 'GET'),
    ).toBe(true);
  });

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
      expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
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
      name: 'creation continuation',
      operations: [
        'validateDraftComposition',
        'saveDraftComposition',
        'submitForPublication',
        'listDraftPages',
        'getDraftComposition',
      ],
    },
    {
      name: 'publication uncertain',
      operations: [
        'validateDraftComposition',
        'saveDraftComposition',
        'submitForPublication',
      ],
    },
    {
      name: 'failed save inspection',
      operations: [
        'validateDraftComposition',
        'saveDraftComposition',
        'getDraftComposition',
      ],
    },
    {
      name: 'author',
      operations: [
        'validateDraftComposition',
        'saveDraftComposition',
        'submitForPublication',
      ],
    },
    {
      name: 'delayed acknowledgements',
      operations: [
        'validateDraftComposition',
        'saveDraftComposition',
        'submitForPublication',
      ],
    },
    {
      name: 'bilingual review',
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
    async ({ name, operations }) => {
      const delayed = name === 'delayed acknowledgements';
      let savedInput: ContentDesignerDraft | undefined;
      const held = new Set<string>();
      const pending = new Map<string, () => void>();
      const respond = (kind: string, response: Response): Promise<Response> => {
        if (!delayed || held.has(kind)) return Promise.resolve(response);
        held.add(kind);
        return new Promise((resolve) => pending.set(kind, () => resolve(response)));
      };
      let permittedOperations = operations;
      const user = userEvent.setup({ delay: null });
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((input, init) => {
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
                    presentation:
                      name === 'creation continuation'
                        ? designerFormPresentation
                        : undefined,
                    defaults: {
                      componentKinds: [
                        {
                          label: 'Hero banner',
                          renderer: 'axis.hero',
                          typeCode: 'heroBannerComponentType',
                          fields: [
                            {
                              property: 'title',
                              label: 'Heading',
                              control: 'text',
                              required: true,
                            },
                            {
                              property: 'body',
                              label: 'Body text',
                              control: 'multiline',
                            },
                          ],
                        },
                        {
                          label: 'Rich text',
                          renderer: 'axis.richText',
                          typeCode: 'richTextComponentType',
                          fields: [
                            {
                              property: 'title',
                              label: 'Heading',
                              control: 'text',
                              required: true,
                            },
                            {
                              property: 'body',
                              label: 'Body text',
                              control: 'multiline',
                            },
                          ],
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
                          ...(name === 'bilingual review'
                            ? {
                                propertySchema: {
                                  title: { localized: true, requiredLocales: ['en'] },
                                  body: { localized: true },
                                },
                              }
                            : {}),
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
                        ...(name === 'bilingual review'
                          ? { routeLocale: 'default' }
                          : {}),
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
                          renderer: 'axis.template.documentation',
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
            return respond(
              'validate',
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
          if (url.includes('/designer/composition/pages')) {
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  result: {
                    pages: savedInput
                      ? [{ code: savedInput.page.code, name: savedInput.page.name }]
                      : [],
                  },
                }),
              ),
            );
          }
          if (url.includes('/designer/composition/draft')) {
            if (
              name === 'creation continuation' &&
              init?.method === 'GET' &&
              savedInput
            ) {
              const stored = {
                ...savedInput,
                sourceVersion: 'a'.repeat(64),
                sections: savedInput.sections.map((section) => ({
                  ...section,
                  code: `placement-${section.slot}`,
                  components: section.components.map((component) => ({
                    ...component,
                    media: [],
                    localizations: (component.localizations || []).map((locale) => ({
                      ...locale,
                      code: `${component.code}-${locale.locale}`,
                    })),
                  })),
                })),
                route: { ...savedInput.route, code: 'saved-route' },
              };
              return Promise.resolve(
                new Response(
                  JSON.stringify({
                    result: {
                      draft: stored,
                      sourceVersion: stored.sourceVersion,
                      editable: true,
                      issues: [],
                    },
                  }),
                ),
              );
            }
            if (name === 'failed save inspection')
              return Promise.resolve(
                new Response(
                  JSON.stringify(
                    init?.method === 'GET'
                      ? {
                          code: 'ERR_CMS_00088',
                          message:
                            'The page has no saved record in this authoring scope.',
                        }
                      : {
                          code: 'ERR_CMS_00100',
                          message: 'Save outcome not confirmed',
                          messageKey: 'common.test.safe-owner-message',
                          messageExposure: 'AUTHENTICATED',
                        },
                  ),
                  { status: init?.method === 'GET' ? 404 : 500 },
                ),
              );
            if (init?.method === 'PUT') {
              if (typeof init.body !== 'string')
                throw new Error('Expected a JSON Designer draft');
              savedInput = JSON.parse(init.body) as ContentDesignerDraft;
            }
            return respond(
              'save',
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
            if (name === 'publication uncertain')
              return Promise.reject(new Error('Publication response lost'));
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  result: {
                    status: 'PENDING_APPROVAL',
                    publication: {
                      code: 'cms-axisCmsSite-summerCampaign-route-1',
                      workflowRef: 'pageApproval-1',
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
          return Promise.resolve(
            new Response(JSON.stringify({ data: [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        });

      const { queryClient } = renderPage(
        bootstrap,
        undefined,
        name === 'creation continuation',
      );

      expect(screen.getByRole('heading', { name: 'Page Designer' })).toBeVisible();
      expect(screen.getByRole('heading', { name: 'Page draft' })).toBeVisible();
      expect(screen.getByRole('textbox', { name: 'Page code' })).toHaveValue('');
      expect(
        screen.getByRole('button', { name: 'Website setup and reference workspaces' }),
      ).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(
        screen.getByRole('button', { name: 'Website setup and reference workspaces' }),
      );
      expect(screen.getByText('Choose catalog')).toBeVisible();
      expect(screen.getByText('Choose or create site')).toBeVisible();
      expect(screen.getByText('Select template')).toBeVisible();
      expect(screen.getByText('Arrange sections and slots')).toBeVisible();
      expect(screen.getByText('Associate media')).toBeVisible();
      expect(
        screen.getByRole('button', { name: 'Draft preview and publication checks' }),
      ).toHaveAttribute('aria-expanded', 'false');
      await user.click(
        screen.getByRole('button', { name: 'Draft preview and publication checks' }),
      );
      await user.click(
        await screen.findByRole('button', { name: 'Content setup details' }),
      );
      expect(screen.getByText('Content setup notes')).toBeVisible();
      expect(
        screen.getByText(
          /draft can be validated|Validate the complete draft before saving/i,
        ),
      ).toBeVisible();
      await waitFor(() =>
        expect(screen.getByText(/Validate first\. Save will unlock/i)).toBeVisible(),
      );
      expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Submit for approval' }),
      ).toBeDisabled();
      expect(screen.getByRole('link', { name: 'Open media' })).toHaveAttribute(
        'href',
        '/media/items?folderCode=cmsAssets',
      );

      await user.clear(screen.getByRole('textbox', { name: 'Page code' }));
      if (name === 'creation continuation') {
        expect(
          screen.getByRole('button', { name: designerFormPresentation.newPageTitle }),
        ).toHaveAttribute('aria-expanded', 'true');
        await user.type(
          screen.getByRole('textbox', { name: designerFormPresentation.pageNameLabel }),
          'Summer campaign landing',
        );
      }
      await user.type(
        screen.getByRole('textbox', { name: 'Page code' }),
        'summerCampaign',
      );

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
      await user.click(screen.getByRole('button', { name: /^en$/ }));
      for (const slot of ['hero', 'body', 'footer']) {
        const section = within(
          screen.getByRole('region', {
            name: new RegExp(`^Content for ${slot}$`, 'i'),
          }),
        );
        await user.type(
          section.getByRole('textbox', { name: 'Heading' }),
          `Summer campaign ${slot}`,
        );
      }
      expect(screen.getByRole('button', { name: 'en' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await user.click(screen.getByRole('button', { name: 'ar' }));
      expect(screen.getByRole('button', { name: 'ar' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByText(/Locale ar: Summer campaign hero/i)).toBeVisible();
      if (name === 'bilingual review') {
        expect(
          screen.getByText(/All entered translations must be reviewed/),
        ).toBeVisible();
        for (const slot of ['hero', 'body', 'footer']) {
          const heading = within(
            screen.getByRole('region', {
              name: new RegExp(`^Content for ${slot}$`, 'i'),
            }),
          ).getByRole('textbox', { name: 'Heading' });
          expect(heading).toHaveValue('');
          await user.type(heading, `عنوان ${slot}`);
        }
        await user.click(screen.getByRole('button', { name: 'Mark ar content ready' }));
        await user.click(screen.getByRole('button', { name: /^en$/ }));
        await user.click(screen.getByRole('button', { name: 'Mark en content ready' }));
        expect(
          screen.queryByText(/All entered translations must be reviewed/),
        ).not.toBeInTheDocument();
      }

      expect(
        fetchMock.mock.calls.every(([input]) =>
          requestUrl(input).includes('/designer/composition/model'),
        ),
      ).toBe(true);
      expect(screen.queryByText('Readiness snapshot')).not.toBeInTheDocument();
      if (name === 'failed save inspection') {
        await user.click(screen.getByRole('button', { name: 'Open an existing page' }));
        expect(screen.getByRole('button', { name: 'Page draft' })).toHaveAttribute(
          'aria-expanded',
          'false',
        );
        await waitFor(() => {
          expect(screen.queryByRole('textbox', { name: 'Page code' })).toBeNull();
          expect(
            screen.getByRole('heading', { name: 'Continue a saved page' }),
          ).toBeVisible();
        });
        await user.click(screen.getByRole('button', { name: 'Page draft' }));
        expect(
          screen.getByRole('button', { name: 'Open an existing page' }),
        ).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByRole('textbox', { name: 'Page code' })).toHaveValue(
          'summerCampaign',
        );
        expect(
          within(screen.getByRole('region', { name: /^Content for hero$/i })).getByRole(
            'textbox',
            { name: 'Heading' },
          ),
        ).toHaveValue('Summer campaign hero');
        expect(
          fetchMock.mock.calls.some(([, init]) =>
            ['POST', 'PUT', 'PATCH', 'DELETE'].includes(init?.method ?? ''),
          ),
        ).toBe(false);
      }
      expect(
        screen.queryByRole('link', { name: 'Open pages' }),
      ).not.toBeInTheDocument();
      if (!operations?.includes('validateDraftComposition')) {
        expect(screen.getByRole('button', { name: 'Validate draft' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Validate draft' }));
        expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
        expect(
          screen.getByRole('button', { name: 'Submit for approval' }),
        ).toBeDisabled();
        expect(
          fetchMock.mock.calls.every(([input]) =>
            requestUrl(input).includes('/designer/composition/model'),
          ),
        ).toBe(true);
        return;
      }

      if (delayed) {
        const heading = within(
          screen.getByRole('region', { name: /^Content for hero$/i }),
        ).getByRole('textbox', { name: 'Heading' });
        await user.click(screen.getByRole('button', { name: 'Validate draft' }));
        await waitFor(() => expect(pending.has('validate')).toBe(true));
        fireEvent.change(heading, {
          target: { value: 'Updated after validation started' },
        });
        act(() => pending.get('validate')?.());
        await screen.findByText(/Earlier draft validation: VALID_DRAFT/);
        expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
        await user.click(screen.getByRole('button', { name: 'Validate draft' }));
        await waitFor(() =>
          expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled(),
        );
        await user.click(screen.getByRole('button', { name: 'Save draft' }));
        await waitFor(() => expect(pending.has('save')).toBe(true));
        fireEvent.change(heading, { target: { value: 'Updated after save started' } });
        act(() => pending.get('save')?.());
        await screen.findByText(/Earlier draft save:/);
        expect(
          screen.getByRole('button', { name: 'Submit for approval' }),
        ).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Validate draft' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
        expect(heading).toHaveValue('Updated after save started');
        fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
        expect(
          fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT'),
        ).toHaveLength(1);
        const bodies = fetchMock.mock.calls
          .filter(([, init]) => init?.method === 'POST' || init?.method === 'PUT')
          .map(([, init]) => (typeof init?.body === 'string' ? init.body : ''));
        expect(bodies[0]).toContain('Summer campaign hero');
        expect(bodies[0]).not.toContain('Updated after validation started');
        expect(bodies[2]).toContain('Updated after validation started');
        expect(bodies[2]).not.toContain('Updated after save started');
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
        expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
        expect(
          fetchMock.mock.calls.some(([input]) =>
            requestUrl(input).includes('/designer/composition/draft'),
          ),
        ).toBe(false);
        return;
      }
      expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();

      await user.click(screen.getByRole('button', { name: 'Save draft' }));
      if (name === 'failed save inspection') {
        await screen.findByText('Save outcome not confirmed');
        expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Validate draft' })).toBeDisabled();
        expect(
          screen.getByRole('button', { name: 'Submit for approval' }),
        ).toBeDisabled();
        expect(screen.getByRole('textbox', { name: 'Page code' })).toHaveValue(
          'summerCampaign',
        );
        await user.click(
          screen.getByRole('button', { name: 'Inspect saved page result' }),
        );
        await waitFor(() =>
          expect(screen.getByRole('button', { name: 'Validate draft' })).toBeEnabled(),
        );
        expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
        expect(
          fetchMock.mock.calls.filter(
            ([input, init]) =>
              requestUrl(input).includes('/designer/composition/draft') &&
              init?.method === 'PUT',
          ),
        ).toHaveLength(1);
        return;
      }
      await waitFor(() => {
        expect(
          screen.getByText(/Save result: CMS draft saved as governed Staged records/i),
        ).toBeVisible();
      });
      expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
      if (name === 'creation continuation') {
        expect(savedInput?.page.name).toBe('Summer campaign landing');
        const formHeading = within(
          screen.getByRole('region', { name: /^Content for hero$/i }),
        ).getByRole('textbox', { name: 'Heading' });
        await user.clear(formHeading);
        await user.type(formHeading, 'Later form intent remains local');
        expect(
          screen.getByText(designerFormPresentation.changedAfterCreationMessage),
        ).toBeVisible();
        expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
        expect(
          screen.getByRole('button', { name: 'Submit for approval' }),
        ).toBeDisabled();
        await user.click(
          screen.getByRole('button', { name: designerFormPresentation.continueLabel }),
        );
        await screen.findByRole('heading', { name: 'Summer campaign landing' });
        await waitFor(() =>
          expect(
            within(
              screen.getByRole('region', { name: /^Content for hero$/i }),
            ).getByRole('textbox', { name: 'Heading' }),
          ).toBeEnabled(),
        );
        expect(
          screen.getByRole('button', { name: designerFormPresentation.newPageTitle }),
        ).toHaveAttribute('aria-expanded', 'false');
        expect(
          within(screen.getByRole('region', { name: /^Content for hero$/i })).getByRole(
            'textbox',
            { name: 'Heading' },
          ),
        ).toHaveValue('Summer campaign hero');
        expect(screen.queryByRole('heading', { name: 'Page content' })).toBeNull();
        expect(
          fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT'),
        ).toHaveLength(1);
        expect(
          fetchMock.mock.calls.filter(
            ([input, init]) =>
              requestUrl(input).includes('/designer/composition/draft?') &&
              init?.method === 'GET',
          ),
        ).toHaveLength(1);
        await user.click(
          screen.getByRole('button', { name: designerFormPresentation.newPageTitle }),
        );
        await waitFor(() =>
          expect(screen.getByRole('textbox', { name: 'Page code' })).toBeVisible(),
        );
        expect(
          within(screen.getByRole('region', { name: /^Content for hero$/i })).getByRole(
            'textbox',
            { name: 'Heading' },
          ),
        ).toHaveValue('Later form intent remains local');
        return;
      }
      if (!operations.includes('submitForPublication')) {
        expect(
          screen.getByRole('button', { name: 'Submit for approval' }),
        ).toBeDisabled();
        expect(
          fetchMock.mock.calls.some(([input]) =>
            requestUrl(input).includes('/publication-request'),
          ),
        ).toBe(false);
        return;
      }
      expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeEnabled();
      await user.click(screen.getByRole('button', { name: 'Submit for approval' }));
      if (name === 'publication uncertain') {
        await screen.findByText('Publication response lost');
        for (const label of ['Save draft', 'Validate draft', 'Submit for approval']) {
          expect(screen.getByRole('button', { name: label })).toBeDisabled();
          fireEvent.click(screen.getByRole('button', { name: label }));
        }
        expect(
          screen.getByRole('link', { name: 'Inspect publication request' }),
        ).toHaveAttribute(
          'href',
          '/publishing/requests?sourceServer=wcmsStagedServer&sourceEnvironment=kickoffLocal',
        );
        expect(
          fetchMock.mock.calls.filter(([input]) =>
            requestUrl(input).includes('/publication-request'),
          ),
        ).toHaveLength(1);
        return;
      }
      await waitFor(() => {
        expect(screen.getByText(/Publishing result: PENDING_APPROVAL/i)).toBeVisible();
      });
      expect(
        screen.getByRole('link', { name: 'Inspect this request' }),
      ).toHaveAttribute(
        'href',
        '/publishing/requests?publicationCode=cms-axisCmsSite-summerCampaign-route-1&sourceServer=wcmsStagedServer&sourceEnvironment=kickoffLocal',
      );
      expect(
        screen.getByRole('button', { name: 'Submit for approval' }),
      ).toBeDisabled();
      expect(
        screen.getByRole('link', { name: 'Review this approval' }),
      ).toHaveAttribute('href', '/process/tasks?instanceCode=pageApproval-1');
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
        route?: { accessMode?: string; locale?: string };
        page?: { renderer?: string };
        sections?: Array<{
          components?: Array<{
            accessMode?: string;
            localizations?: Array<{ locale: string; status: string }>;
          }>;
        }>;
      };
      expect(submittedDraft.page?.renderer).toBe('axis.page');
      expect(submittedDraft.route?.accessMode).toBe('PUBLIC');
      if (name === 'bilingual review')
        expect(
          submittedDraft.sections?.[0]?.components?.[0]?.localizations?.map((item) => [
            item.locale,
            item.status,
          ]),
        ).toEqual([
          ['en', 'READY'],
          ['ar', 'READY'],
        ]);
      expect(submittedDraft.route?.locale).toBe(
        name === 'bilingual review' ? 'default' : 'en',
      ); // Translating content must not change the route identity.
      expect(submittedDraft.sections?.[0]?.components?.[0]?.accessMode).toBe('PUBLIC');
      if (operations.includes('deleteSection')) {
        await user.click(
          screen.getByRole('button', { name: 'Manage existing content' }),
        );
        expect(screen.getByLabelText('Record code')).toHaveValue('');
        expect(
          screen.getByRole('button', { name: 'Review retirement' }),
        ).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Review retirement' }));
        expect(
          fetchMock.mock.calls.some(([input]) =>
            requestUrl(input).includes('/sections/delete'),
          ),
        ).toBe(false);
        expect(screen.getByRole('textbox', { name: 'Page code' })).toHaveValue(
          'summerCampaign',
        );
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
      expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Submit for approval' }),
      ).toBeDisabled();
      expect(screen.getByRole('textbox', { name: 'Page code' })).toHaveValue(
        'summerCampaign',
      );
      expect(
        fetchMock.mock.calls.filter(([, init]) => init?.method !== 'GET').length,
      ).toBe(writeCount);
    },
    25_000,
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
    expect(metrics).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Content inventory' }));
    await waitFor(() => expect(metrics).toHaveBeenCalledOnce());
    expect(
      metrics.mock.calls[0]?.[0].map((connection) => connection.moduleName),
    ).toEqual(['cms']);
    expect(metrics.mock.calls[0]?.[3].map((metric) => metric.id)).toEqual(['sites']);
  });
});
