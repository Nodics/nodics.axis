import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

import { DocumentationRoutePage } from '../../src/documentation/DocumentationRoutePage';
import type {
  AxisDocumentationSource,
  AxisApplicationInitializationProfile,
  AxisNavigationItem,
} from '../../src/bootstrap/publicBootstrap';
import type { OnlineDocumentationGuideCatalogue } from '../../src/bootstrap/onlineDocumentationGuides';

import { validResolvedPage } from '../cms/fixtures/resolvedPage';

const readCatalogue = vi.hoisted(() => vi.fn());
vi.mock('../../src/bootstrap/onlineDocumentationGuides', () => ({
  useOnlineDocumentationGuides: readCatalogue,
}));
const article = {
  id: 'published',
  label: 'Published topic',
  route: '/docs/framework/published',
  locale: 'en',
  channel: 'web',
  site: 'onlineSite',
  accessMode: 'PUBLIC' as const,
};
const catalogue: OnlineDocumentationGuideCatalogue = {
  contractVersion: 1,
  navigation: [
    { id: 'framework', label: 'Framework', route: '/docs?guide=framework', order: 1 },
    { id: 'project', label: 'Projects', route: '/docs?guide=project', order: 2 },
  ],
  guides: [
    {
      guide: 'framework',
      label: 'Framework',
      route: '/docs?guide=framework',
      topics: [article],
    },
    {
      guide: 'project',
      projectId: 'kickoff',
      label: 'Kickoff',
      route: '/docs?guide=project&project=kickoff',
      topics: [
        { ...article, channelId: 'agora', channelLabel: 'Agora' },
        {
          ...article,
          id: 'telco',
          label: 'Telco',
          route: '/docs/telco',
          channelId: 'agora',
          channelLabel: 'Agora',
          accessMode: 'AUTHENTICATED',
        },
      ],
    },
  ],
};
const management: AxisNavigationItem = {
  id: 'documentation',
  route: '/docs',
  label: 'Publication center',
  order: 1,
  moduleName: 'backoffice',
  category: 'platform',
  icon: 'cms',
  availability: 'UP',
  featureState: 'ACTIVE',
};

const runtime = {
  backofficeBaseUrl: 'http://localhost:3000',
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
const connection = {
  moduleName: 'system',
  instanceId: 'mono/import',
  endpoint: 'http://localhost:3000',
  environment: 'kickoffLocal',
  state: 'UP' as const,
};
const bootstrap = {
  axisPolicy: {
    contractVersion: 0 as const,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 0,
    source: 'DEFAULT' as const,
  },
  navigation: [],
  environments: ['kickoffLocal'],
  moduleCatalog: {
    'nodics.platform': {
      moduleName: 'nodics.platform',
      displayName: 'Core Capabilities',
      moduleKind: 'group',
    },
    profile: {
      moduleName: 'profile',
      displayName: 'Profile and Identity',
      parentModule: 'nodics.platform',
      moduleKind: 'capability',
    },
  },
  moduleConnections: {
    system: [connection],
    cms: [
      {
        ...connection,
        moduleName: 'cms',
        instanceId: 'cms-staged',
        runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
      },
      {
        ...connection,
        moduleName: 'cms',
        endpoint: 'http://localhost:3002/nodics/cms',
        runtimeRole: { code: 'WCMS_ONLINE', publication: 'ONLINE' },
      },
    ],
    backoffice: [{ ...connection, moduleName: 'backoffice' }],
    media: [
      {
        ...connection,
        moduleName: 'media',
        endpoint: 'http://localhost:3000/nodics/media',
        runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
      },
    ],
    workflow: [
      {
        ...connection,
        moduleName: 'workflow',
        instanceId: 'process/local',
        server: 'processServer',
      },
    ],
  },
  documentationSources: [
    {
      id: 'framework',
      guide: 'framework' as const,
      label: 'Framework',
      type: 'CMS' as const,
      route: '/docs/framework',
      order: 100,
      ownerModule: 'backoffice',
      connectionModule: 'system',
      site: 'axisCmsSite',
      catalog: 'nodicsDocumentationContentCatalog',
      defaultPage: '/docs',
      packCode: 'nodicsDocumentation',
      initializationProfile: 'frameworkdocs',
      dashboard: {
        kind: 'Framework guide',
        icon: 'content',
        summary: 'Core framework documentation.',
        audiences: ['developer'],
        coverage: {
          score: 85,
          status: 'STRONG' as const,
          signals: ['Architecture'],
          gaps: ['Recipes'],
        },
      },
    },
    {
      id: 'swaggers',
      guide: 'framework' as const,
      label: 'Swaggers',
      type: 'OPENAPI' as const,
      route: '/docs/swaggers',
      order: 200,
      ownerModule: 'backoffice',
      connectionModule: 'system',
      openApiPath: '/nodics/system/v0/contract/openapi',
      swaggerPath: '/nodics/system/v0/contract/swagger',
      dashboard: {
        kind: 'API contracts',
        icon: 'reference',
        summary: 'Generated API contracts.',
        audiences: ['developer'],
        coverage: {
          score: 100,
          status: 'REFERENCE' as const,
          signals: ['Generated contracts'],
          gaps: ['Narrative examples'],
        },
      },
    },
  ],
  tenantCode: 'default',
};
const response = {
  code: 'SUC_BOF_00021',
  data: {
    profileCode: 'frameworkdocs',
    siteCode: 'nodicsDocumentationSite',
    readiness: 'NOT_IMPORTED',
    releaseCode: 'contentPack:nodicsDocumentation',
    releaseVersion: '0.0.0',
    allowedActions: ['INITIALIZE'],
  },
};
const packResponse = {
  code: 'SUC_IMP_00000',
  data: {
    code: 'nodicsDocumentation',
    enabled: true,
    state: 'NOT_INSTALLED',
    available: true,
    installedVersion: null,
    availableVersion: '1.0.0',
    runId: null,
    allowedOperations: ['IMPORT'],
    presentation: {
      title: 'Nodics documentation',
      unavailableMessage: 'Documentation is unavailable.',
      disabledMessage: 'Documentation is disabled.',
      importAction: 'Install documentation',
      updateAction: 'Update documentation',
      retryAction: 'Retry',
    },
  },
};

function renderPage(
  path = '/docs',
  sources: readonly AxisDocumentationSource[] = bootstrap.documentationSources,
  profiles: readonly AxisApplicationInitializationProfile[] = [],
  navigation: readonly AxisNavigationItem[] = [management],
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <DocumentationRoutePage
          accessToken="token"
          bootstrap={{
            ...bootstrap,
            navigation,
            documentationSources: sources,
            applicationInitializationProfiles: profiles,
          }}
          channel="web"
          cmsBaseUrl="http://localhost:3000"
          employeeId="admin"
          locale="en"
          path={path.split('?')[0]!}
          runtime={runtime}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function requestPathname(request: URL | RequestInfo): string {
  if (request instanceof URL) return request.pathname;
  if (request instanceof Request) return new URL(request.url).pathname;
  return new URL(request).pathname;
}

describe('DocumentationRoutePage', () => {
  beforeEach(() => {
    readCatalogue.mockReturnValue({ data: catalogue, isError: false });
  });

  it('uses the employee’s WCMS Online catalogue even when bootstrap has no documentation packs', async () => {
    const { useOnlineDocumentationGuides } = await vi.importActual<
      typeof import('../../src/bootstrap/onlineDocumentationGuides')
    >('../../src/bootstrap/onlineDocumentationGuides');
    readCatalogue.mockImplementation(useOnlineDocumentationGuides);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ result: catalogue })));
    renderPage('/docs?guide=framework', [], [], []);
    expect(
      await screen.findByRole('link', { name: 'Published topic' }),
    ).toHaveAttribute('href', article.route);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url instanceof URL ? url.href : undefined).toBe(
      'http://localhost:3002/nodics/cms/v0/delivery/documentation/guides',
    );
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token');
    fetchMock.mockRestore();
  });

  it('lists only Online topics and uses the delivered project channel headings', async () => {
    renderPage('/docs?guide=project');
    const picker = screen.getByRole('link', { name: 'Kickoff' });
    expect(picker).toHaveAttribute('href', '/docs?guide=project&project=kickoff');
    await userEvent.click(picker);
    expect(screen.getAllByRole('heading', { name: 'Agora' })).toHaveLength(1);
    const channel = within(screen.getByRole('region', { name: 'Agora' }));
    expect(channel.getByRole('link', { name: 'Telco' })).toHaveAttribute(
      'href',
      '/docs/telco?guide=project&project=kickoff',
    );
    expect(channel.getAllByRole('link')).toHaveLength(2);
    expect(screen.queryByRole('link', { name: 'Swaggers' })).not.toBeInTheDocument();
  });

  it.each([
    '/docs/framework',
    '/docs/framework/published/child',
    '/docs/swaggers',
    '/docs?guide=axis',
    '/docs?guide=project&project=unpublished',
    '/docs?guide=axis&guide=framework',
  ])('refuses unlisted routes and guides without discovery or delivery: %s', (path) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    renderPage(path);
    expect(screen.getByRole('alert')).toHaveTextContent('No Online documentation');
    expect(
      screen.getByRole('link', { name: 'Open publication center' }),
    ).toHaveAttribute('href', '/docs');
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it.each([
    [],
    [{ ...management, featureState: 'HIDDEN' as const }],
    [{ ...management, availability: 'UNAVAILABLE' as const }],
  ])('only offers management to employees with an available grant', (...items) => {
    renderPage('/docs?guide=axis', [], [], items);
    expect(
      screen.queryByRole('link', { name: 'Open publication center' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ask your documentation administrator',
    );
  });

  it('does not open managed source details without the publication-center grant', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    renderPage('/docs?manage=framework', bootstrap.documentationSources, [], []);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ask your documentation administrator',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('hides stale topics after a catalogue error and offers retry', async () => {
    const refetch = vi.fn();
    readCatalogue.mockReturnValue({ data: catalogue, isError: true, refetch });
    renderPage('/docs?guide=framework');
    expect(
      screen.queryByRole('link', { name: 'Published topic' }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Retry Online catalogue' }),
    );
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('refuses an ambiguous unscoped topic without selecting a different Site', () => {
    readCatalogue.mockReturnValue({
      data: {
        ...catalogue,
        guides: [
          ...catalogue.guides,
          {
            ...catalogue.guides[0],
            guide: 'axis',
            topics: [{ ...article, site: 'differentSite' }],
          },
        ],
      },
      isError: false,
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    renderPage(article.route);
    expect(screen.getByRole('alert')).toHaveTextContent('No Online documentation');
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('hides project setup records when the Online catalogue is empty', () => {
    readCatalogue.mockReturnValue({
      data: { navigation: [], guides: [] },
      isError: false,
    });
    renderPage('/docs?guide=project');
    expect(screen.getByRole('alert')).toHaveTextContent('No Online documentation');
    expect(screen.queryByRole('link', { name: 'Kickoff' })).not.toBeInTheDocument();
  });

  it('renders the documentation dashboard from registered documentation sources once published', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((request) => {
      const pathname = requestPathname(request);
      if (pathname.includes('/content-pack')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...packResponse,
              data: {
                ...packResponse.data,
                state: 'CURRENT',
                installedVersion: '1.0.0',
                allowedOperations: [],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...response,
            data: {
              ...response.data,
              readiness: 'READY',
              allowedActions: [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });

    renderPage('/docs');

    expect(
      screen.getByRole('heading', { name: 'Documentation publication center' }),
    ).toBeVisible();
    expect(await screen.findByRole('link', { name: 'Manage Framework' })).toBeVisible();
    expect(screen.queryByText('Core framework documentation.')).not.toBeInTheDocument();
    expect(screen.getByText('100% documented')).toBeVisible();
    expect(screen.queryByRole('tab', { name: 'Framework' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Swaggers' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage Framework' })).toHaveAttribute(
      'href',
      '/docs?manage=framework',
    );
    expect(screen.getByRole('link', { name: 'Open Swaggers' })).toHaveAttribute(
      'href',
      '/docs?manage=swaggers',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Show Framework overview details' }),
    );
    expect(await screen.findByText('Core framework documentation.')).toBeVisible();
    expect(screen.getAllByText('85% documented').length).toBeGreaterThan(0);
    fetchMock.mockRestore();
  });

  it('loads publication profiles only for the current management page', async () => {
    const framework = bootstrap.documentationSources[0];
    if (framework?.type !== 'CMS') throw new Error('Expected Framework CMS fixture');
    const sources = Array.from({ length: 6 }, (_, i) => ({
      ...framework,
      id: `source-${String(i)}`,
      route: `/docs/source-${String(i)}`,
      initializationProfile: `docs${String(i)}`,
    }));
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response('{}', { status: 403 })));
    renderPage('/docs', sources);
    const requested = (profile: string) =>
      fetchMock.mock.calls.some(([request]) =>
        requestPathname(request).includes(`/applications/${profile}/`),
      );
    await waitFor(() => expect(requested('docs0')).toBe(true));
    expect(requested('docs5')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
    await waitFor(() => expect(requested('docs5')).toBe(true));
    fetchMock.mockRestore();
  });

  it('lets operators install documentation from the dashboard when it is absent', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((request) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              requestPathname(request).includes('/content-pack')
                ? packResponse
                : response,
            ),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      );
    const user = userEvent.setup();
    renderPage('/docs');

    expect(await screen.findByText('Documentation publication center')).toBeVisible();
    expect(
      screen.getByText(/Axis is checking documentation publication state/iu),
    ).toBeVisible();
    expect(
      await screen.findByRole('heading', { name: 'Publication candidates', level: 2 }),
    ).toBeVisible();
    expect(
      screen.getByText(
        'The selected candidate has not been imported. Published guides are checked separately by the Online reader.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('Pending', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 6 })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
      false,
    );
    expect(screen.getByText('Publication flow')).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Manage Framework' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Swaggers' })).toHaveAttribute(
      'href',
      '/docs?manage=swaggers',
    );
    expect(screen.queryByText('Release code')).not.toBeInTheDocument();
    const detailsToggle = screen.getByRole('button', {
      name: 'Show Framework details',
    });
    expect(detailsToggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(detailsToggle);
    expect(detailsToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Release code')).toBeVisible();
    await user.click(await screen.findByRole('button', { name: 'Install staged' }));
    expect(fetchMock.mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            pathname:
              '/v0/applications/frameworkdocs/initialization/content-pack/install',
          }),
          expect.objectContaining({ method: 'POST' }),
        ],
      ]),
    );
    fetchMock.mockRestore();
  });

  it('offers the governed import action when documentation is absent', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((request) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              requestPathname(request).includes('/content-pack')
                ? packResponse
                : response,
            ),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      );
    const user = userEvent.setup();
    renderPage('/docs?manage=framework');

    expect(
      await screen.findByText(/Install the verified bundle to Staged/),
    ).toBeVisible();
    await user.click(await screen.findByRole('button', { name: 'Install staged' }));
    expect(fetchMock.mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            pathname:
              '/v0/applications/frameworkdocs/initialization/content-pack/install',
          }),
          expect.objectContaining({ method: 'POST' }),
        ],
      ]),
    );
    fetchMock.mockRestore();
  });

  it.each([
    ['/docs/framework/published', '/nodics/cms/v0/delivery/pages/resolve', null],
    [
      '/docs/telco?guide=project&project=kickoff',
      '/nodics/cms/v0/delivery/pages/resolve/authenticated',
      'Bearer token',
    ],
  ])(
    'resolves the exact Online topic using its declared access mode: %s',
    async (path, endpoint, token) => {
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('{}', { status: 404 }));
      renderPage(path);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const [request, init] = fetchMock.mock.calls[0]!;
      const url = new URL(request instanceof Request ? request.url : String(request));
      expect(url.pathname).toBe(endpoint);
      expect(url.searchParams.get('path')).toBe(path.split('?')[0]);
      expect(url.searchParams.get('site')).toBe('onlineSite');
      expect(new Headers(init?.headers).get('Authorization')).toBe(token);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Online documentation',
      );
      fetchMock.mockRestore();
    },
  );

  it.each([true, false])(
    'verifies the returned Online article identity before displaying its content (matching %s)',
    async (matching) => {
      const renderer = {
        rendererContractVersion: 1,
        rendererDeprecated: false,
        rendererChannels: ['web'],
      };
      const page = {
        ...validResolvedPage,
        site: matching ? article.site : 'otherSite',
        path: article.route,
        locale: article.locale,
        channel: article.channel,
        page: {
          ...validResolvedPage.page,
          ...renderer,
          typeCode: 'documentationArticlePageType',
          renderer: 'documentation.page.article',
          template: 'documentationArticleTemplate',
          templateContract: {
            code: 'documentationArticleTemplate',
            renderer: 'documentation.template.article',
            contractVersion: 0,
          },
          components: [
            {
              ...renderer,
              code: 'article',
              typeCode: 'documentationArticleComponentType',
              renderer: 'documentation.component.article',
              properties: {
                title: 'Delivered article',
                blocks: [{ kind: 'paragraph', text: 'Published article content.' }],
              },
              slot: 'article',
              index: 0,
              components: [],
            },
          ],
        },
      };
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify({ result: page })));
      renderPage(article.route);
      if (matching) {
        expect(await screen.findByText('Published article content.')).toBeVisible();
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(
          screen.queryByRole('navigation', { name: 'Documentation topics' }),
        ).not.toBeInTheDocument();
      } else {
        expect(await screen.findByRole('alert')).toHaveTextContent(
          'No Online documentation',
        );
        expect(
          screen.queryByText('Published article content.'),
        ).not.toBeInTheDocument();
      }
      fetchMock.mockRestore();
    },
  );

  it('keeps Staged validation separate from the governed publication request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((request) => {
      const pathname = requestPathname(request);
      if (pathname.includes('/content-pack')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...packResponse,
              data: {
                ...packResponse.data,
                state: 'CURRENT',
                installedVersion: '1.0.0',
                allowedOperations: [],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...response,
            data: {
              ...response.data,
              readiness: pathname.endsWith('/initiate')
                ? 'PUBLICATION_PENDING'
                : 'IMPORTED',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });
    const user = userEvent.setup();
    renderPage('/docs?manage=framework');

    expect((await screen.findAllByText('Staged: CURRENT'))[0]).toBeVisible();
    expect(screen.getAllByText('Online readiness: Approval needed')[0]).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Validate staged' }));
    await user.click(screen.getByRole('button', { name: 'Request approval' }));
    expect(
      fetchMock.mock.calls.some(
        ([request, init]) =>
          requestPathname(request).endsWith('/initialization/initiate') &&
          init?.method === 'POST',
      ),
    ).toBe(true);
    expect(
      (await screen.findAllByText('Online readiness: Approval in progress'))[0],
    ).toBeVisible();
    fetchMock.mockRestore();
  });

  it('prioritizes reviewer decision when a documentation publication is pending', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((request) => {
      const pathname = requestPathname(request);
      if (pathname.includes('/content-pack')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...packResponse,
              data: {
                ...packResponse.data,
                state: 'UPDATE_AVAILABLE',
                installedVersion: '1.0.0',
                allowedOperations: ['UPDATE'],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (pathname.includes('/tasks')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  code: 'cmsPublicationApprovalTask',
                  instanceCode: 'cmsPublicationApprovalWorkflow',
                  nodeCode: 'reviewPublication',
                  assignee: 'admin',
                  status: 'OPEN',
                  dueAt: null,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...response,
            data: {
              ...response.data,
              readiness: 'PUBLICATION_PENDING',
              allowedActions: [],
              publication: {
                code: 'cmsPublication',
                state: 'PENDING_APPROVAL',
                revision: 1,
                requestedBy: 'admin',
                workflowRef: 'cmsPublicationApprovalWorkflow',
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });
    renderPage('/docs');

    expect(await screen.findByText('Online: approval in progress')).toBeVisible();
    expect(screen.getByText('Pending review · requested by admin')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Update staged' }),
    ).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeVisible();
    expect(
      fetchMock.mock.calls.some(([request]) =>
        requestPathname(request).endsWith('/tasks'),
      ),
    ).toBe(true);
    fetchMock.mockRestore();
  });

  it('refreshes sources without inventing or leaking approval-task errors before a workflow exists', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((request) => {
      if (requestPathname(request).includes('/content-pack')) {
        return Promise.resolve(new Response(JSON.stringify(packResponse)));
      }
      return Promise.resolve(new Response(JSON.stringify(response)));
    });
    try {
      renderPage('/docs');
      const refresh = await screen.findAllByRole('button', { name: 'Refresh status' });
      await userEvent.click(refresh[0]!);
      await userEvent.click(refresh[1]!);
      expect(
        fetchMock.mock.calls.some(([request]) =>
          requestPathname(request).includes('/tasks'),
        ),
      ).toBe(false);
      expect(
        screen.queryByText(/no workflow reference was returned/),
      ).not.toBeInTheDocument();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it.each([false, true])(
    'coordinates normal CMS and Media approvals from one action (Media denied: %s)',
    async (denied) => {
      const mutations: string[] = [];
      const reference = 'publicationApproval-' + 'b'.repeat(64);
      const publicationCode = 'cmsMedia_' + 'a'.repeat(64);
      let cmsApproved = false,
        mediaApproved = false;
      const json = (body: unknown, status = 200) =>
        Promise.resolve(new Response(JSON.stringify(body), { status }));
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation((request, init) => {
          const url = new URL(
            request instanceof Request ? request.url : String(request),
          );
          if (init?.method === 'POST') {
            mutations.push(url.pathname);
            expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token');
          }
          if (url.pathname.endsWith('/cms-task/complete')) {
            cmsApproved = true;
            return json({ data: {} });
          }
          if (url.pathname.endsWith('/media-task/complete')) {
            expect(JSON.parse(init?.body as string)).toEqual({
              decision: {
                approved: true,
                reason:
                  'Framework pinned Media publication approved from Documentation publication center',
              },
            });
            mediaApproved = true;
            return json({ data: {} });
          }
          if (url.pathname.endsWith('/publication/requests')) {
            expect(typeof init?.body).toBe('string');
            expect(JSON.parse(init?.body as string)).toEqual({
              publicationCode,
              mediaCode: 'guide-image',
              versionId: 4,
              expectedChecksum: 'c'.repeat(64),
            });
            return denied
              ? json({}, 403)
              : json({
                  result: {
                    publicationCode,
                    mediaCode: 'guide-image',
                    versionId: 4,
                    revision: 2,
                    state: 'PENDING_APPROVAL',
                    workflowRef: reference,
                    approvalRequired: true,
                  },
                });
          }
          if (url.pathname.endsWith('/tasks')) {
            const instanceCode = url.searchParams.get('instanceCode')!;
            return json({
              data: [
                {
                  code: instanceCode === reference ? 'media-task' : 'cms-task',
                  instanceCode,
                  nodeCode: 'reviewPublication',
                  assignee: 'admin',
                  status: 'OPEN',
                  dueAt: null,
                },
              ],
            });
          }
          if (url.pathname.includes('/content-pack'))
            return json({
              ...packResponse,
              data: {
                ...packResponse.data,
                state: 'CURRENT',
                installedVersion: '1.0.0',
                allowedOperations: [],
              },
            });
          return json({
            data: {
              ...response.data,
              allowedActions: [],
              readiness: mediaApproved
                ? 'READY'
                : cmsApproved
                  ? 'MEDIA_DEPENDENCIES_PENDING'
                  : 'PUBLICATION_PENDING',
              publication: {
                code: 'cmsPublication',
                state: cmsApproved ? 'ONLINE' : 'PENDING_APPROVAL',
                revision: 1,
                requestedBy: 'admin',
                workflowRef: 'cmsWorkflow',
              },
              ...(cmsApproved
                ? {
                    mediaDependencies: {
                      owner: 'media',
                      contractVersion: 1,
                      qualified: mediaApproved,
                      dependencies: [
                        {
                          owner: 'media',
                          mediaCode: 'guide-image',
                          versionId: 4,
                          checksum: 'c'.repeat(64),
                          publicationCode,
                          status: mediaApproved ? 'ACTIVE' : 'NOT_ACTIVATED',
                          qualified: mediaApproved,
                        },
                      ],
                    },
                  }
                : {}),
            },
          });
        });
      try {
        renderPage('/docs');
        const approve = await screen.findByRole('button', { name: 'Approve' });
        expect(mutations).toEqual([]);
        await userEvent.click(approve);
        await waitFor(() =>
          expect(
            mutations.some((value) => value.endsWith('/publication/requests')),
          ).toBe(true),
        );
        if (denied) {
          expect(
            await screen.findByRole('button', { name: 'Complete asset approvals' }),
          ).toBeVisible();
          expect(mediaApproved).toBe(false);
          expect(mutations).toHaveLength(2);
        } else {
          await waitFor(() => expect(mediaApproved).toBe(true));
          expect(mutations).toHaveLength(3);
          expect(mutations[2]).toContain('/media-task/complete');
        }
      } finally {
        fetchMock.mockRestore();
      }
    },
  );

  it('renders the backend-provided live OpenAPI source without embedding the protected Swagger page', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          openapi: '3.0.3',
          info: { title: 'Nodics APIs', version: '0.0.0' },
          paths: {
            '/nodics/profile/v0/employees': {
              get: {
                operationId: 'profile_employee_list_get',
                summary: 'List employees',
                description: 'Returns authorized employee records.',
                tags: ['profile'],
                parameters: [
                  {
                    name: 'active',
                    in: 'query',
                    required: false,
                    description: 'Filter by active employees.',
                    schema: { type: 'boolean' },
                  },
                ],
                responses: {
                  '200': {
                    description: 'Employee records returned.',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Employee' },
                        },
                      },
                    },
                  },
                  '401': { description: 'Authentication is required.' },
                },
                security: [{ bearerAuth: [] }],
                'x-nodics': {
                  moduleName: 'profile',
                  routerGroup: 'employee',
                  schemaName: 'employee',
                  source: 'module-router',
                },
              },
              post: {
                operationId: 'profile_employee_create_post',
                summary: 'Create employee',
                description: 'Creates an employee record.',
                tags: ['profile'],
                requestBody: {
                  required: true,
                  description: 'Employee payload.',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Employee' },
                    },
                  },
                },
                responses: {
                  '201': { description: 'Employee created.' },
                },
                security: [{ bearerAuth: [] }],
                'x-nodics': {
                  moduleName: 'profile',
                  routerGroup: 'employee',
                  schemaName: 'employee',
                  source: 'module-router',
                },
              },
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    const user = userEvent.setup();
    renderPage('/docs?manage=swaggers');

    expect(await screen.findByText('Nodics APIs')).toBeVisible();
    expect(screen.getByText('1 runtime groups')).toBeVisible();
    expect(screen.getByText('2 module groups')).toBeVisible();
    expect(
      screen.getByText(/APIs are grouped by the registered runtime\/module metadata/iu),
    ).toBeVisible();
    expect(
      screen.queryByText('Search the APIs currently exposed by this Nodics runtime.'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Core Capabilities')).toBeVisible();
    expect(screen.getAllByText('2 APIs').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: /Load more APIs/iu }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('⌕')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Search APIs'), 'profile');
    expect(screen.getByRole('button', { name: 'Clear API search' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear API search' }));
    expect(screen.getByLabelText('Search APIs')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: /Core Capabilities/iu }));
    expect(screen.getByText('Profile and Identity')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Profile and Identity/iu }));
    expect(screen.getAllByText('/nodics/profile/v0/employees').length).toBe(2);
    await user.click(
      screen.getByRole('button', { name: /GET.*employees.*List employees/iu }),
    );
    expect(screen.getByText('active (query)')).toBeVisible();
    expect(
      screen.getByText('No request body is declared for this operation.'),
    ).toBeVisible();
    expect(screen.getByText('Employee records returned.')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Open this operation in Swagger' }),
    ).toHaveAttribute(
      'href',
      'http://localhost:3000/nodics/system/v0/contract/swagger#/profile/profile_employee_list_get',
    );
    await user.click(
      screen.getByRole('button', { name: /POST.*employees.*Create employee/iu }),
    );
    expect(screen.getByText('Employee payload.')).toBeVisible();
    expect(screen.getByText('Filter by active employees.')).not.toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Open interactive Swagger' }),
    ).toHaveAttribute(
      'href',
      'http://localhost:3000/nodics/system/v0/contract/swagger',
    );
    expect(screen.queryByTitle('Swaggers API documentation')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
    const [requestUrl, requestOptions] = fetchMock.mock.calls[0] ?? [];
    expect(requestUrl).toBeInstanceOf(URL);
    expect(requestUrl instanceof URL ? requestUrl.href : '').toBe(
      'http://localhost:3000/nodics/system/v0/contract/openapi',
    );
    expect(requestOptions?.headers).toMatchObject({ Authorization: 'Bearer token' });
    fetchMock.mockRestore();
  });
});
