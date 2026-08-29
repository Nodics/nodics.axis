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
import { DocumentationManagementRoutePage } from '../../../src/operations/documentationManagement/DocumentationManagementRoutePage';
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

const documentationManagement: AxisNavigationItem = {
  id: 'documentation-management',
  label: 'Documentation Designer',
  route: '/docs/designer',
  order: 107,
  moduleName: 'backoffice',
  category: 'platform',
  icon: 'cms',
  availability: 'UP',
  featureState: 'ACTIVE',
  group: { id: 'documentation', label: 'Documentation', order: 1600 },
};

const governanceNavigation: AxisNavigationItem = {
  id: 'documentation-governance-readiness',
  parentId: 'documentation-management',
  label: 'Governance and Readiness',
  route: '/docs/designer/governance',
  order: 113,
  moduleName: 'backoffice',
  category: 'platform',
  icon: 'validation',
  availability: 'UP',
  featureState: 'ACTIVE',
  group: { id: 'documentation', label: 'Documentation', order: 1600 },
  workbenchTarget: {
    moduleName: 'cms',
    schemaName: 'cmsDocumentationPublicationState',
    governanceService: 'DefaultCmsDocumentationGovernanceService',
    authoringModelRoute: '/documentation/governance/model',
    validationRoute: '/documentation/governance/validate',
    renderProjectionRoute: '/documentation/governance/render-projection',
    searchRoute: '/documentation/governance/search',
    publicationHandoffRoute: '/documentation/governance/publication-handoff',
    migrationPlanRoute: '/documentation/governance/migration-plan',
  },
};

const childNavigation: readonly AxisNavigationItem[] = [
  {
    id: 'documentation-navigation',
    parentId: 'documentation-management',
    label: 'Navigation Builder',
    route: '/docs/designer/navigation',
    order: 108,
    moduleName: 'backoffice',
    category: 'platform',
    icon: 'list-tree',
    availability: 'UP',
    featureState: 'ACTIVE',
    group: { id: 'documentation', label: 'Documentation', order: 1600 },
    workbenchTarget: { moduleName: 'cms', schemaName: 'cmsDocumentationNode' },
  },
  {
    id: 'documentation-pages',
    parentId: 'documentation-management',
    label: 'Pages and Topic Content',
    route: '/docs/designer/pages',
    order: 109,
    moduleName: 'backoffice',
    category: 'platform',
    icon: 'content',
    availability: 'UP',
    featureState: 'ACTIVE',
    group: { id: 'documentation', label: 'Documentation', order: 1600 },
    workbenchTarget: { moduleName: 'cms', schemaName: 'cmsDocumentationPage' },
  },
  governanceNavigation,
];

const bootstrap: AxisAuthenticatedBootstrap = {
  axisPolicy: {
    contractVersion: 0,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 1,
    source: 'DEFAULT',
  },
  navigation: [documentationManagement, ...childNavigation],
  environments: ['kickoffLocal'],
  moduleCatalog: {},
  moduleConnections: {
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
  },
  documentationSources: [
    {
      id: 'framework',
      label: 'Framework',
      type: 'CMS',
      route: '/docs/framework',
      order: 100,
      ownerModule: 'backoffice',
      connectionModule: 'cms',
      site: 'nodicsDocumentationSite',
      catalog: 'documentationContentCatalog',
      defaultPage: '/docs/framework',
      packCode: 'nodicsDocumentation',
      dashboard: {
        summary: 'Framework documentation.',
        audiences: ['architect', 'developer'],
      },
    },
    {
      id: 'swaggers',
      label: 'Swaggers',
      type: 'OPENAPI',
      route: '/docs/swaggers',
      order: 110,
      ownerModule: 'backoffice',
      connectionModule: 'backoffice',
      openApiPath: '/openapi.json',
      swaggerPath: '/docs/swaggers',
      dashboard: {
        summary: 'Generated API reference.',
        audiences: ['developer'],
      },
    },
  ],
  tenantCode: 'default',
};

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestJsonBody(options: RequestInit | undefined): Record<string, unknown> {
  if (typeof options?.body !== 'string') return {};
  const parsed: unknown = JSON.parse(options.body);
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function response(result: unknown): Response {
  return new Response(JSON.stringify({ result }), { status: 200 });
}

function documentationWorkbenchSchema(schemaName: string, label: string) {
  return {
    moduleName: 'cms',
    schemaName,
    label,
    description: '',
    displayProperty: 'code',
    displayProperties: ['code', 'title'],
    queryCapabilities: {
      searchableFields: ['code', 'title', 'summary'],
      sortableFields: ['code', 'title'],
      filterFields: [],
      groupOperators: ['AND', 'OR'],
      textOperator: 'CONTAINS',
      allowedPageSizes: [25, 50],
      defaultPageSize: 25,
      maximumPageSize: 50,
      defaultSort: { field: 'title', direction: 'ASC' },
    },
    mutationMode: 'GENERATED_CRUD',
    operations: ['search', 'read', 'create', 'update', 'delete'],
    fields: [
      {
        name: 'code',
        label: 'Code',
        type: 'string',
        required: true,
        readOnly: false,
        primary: true,
        description: '',
        searchable: true,
      },
      {
        name: 'title',
        label: 'Title',
        type: 'string',
        required: true,
        readOnly: false,
        primary: false,
        description: '',
        searchable: true,
      },
    ],
    relationships: [],
  };
}

const cmsDocumentationPages = Array.from({ length: 127 }, (_item, index) => {
  const number = index + 1;
  const slug = `framework-generated-topic-${String(number)}`;
  return {
    code: `nodicsDocsMetadataGeneratedTopic${String(number)}`,
    product: 'nodicsDocumentationProduct',
    documentId: `framework.generated-topic-${String(number)}`,
    title:
      number === 126
        ? 'Runtime Server Composition'
        : `Generated documentation topic ${String(number)}`,
    summary: `Source-backed framework documentation page ${String(number)}.`,
    businessSummary: `Business summary for source-backed framework topic ${String(number)}.`,
    technicalSummary: `Technical summary for source-backed framework topic ${String(number)}.`,
    ownerFunctionalModule: 'nodics.docs',
    technicalModule: 'documentation',
    targetPage: `nodicsDocsPageGeneratedTopic${String(number)}`,
    targetRoute: `nodicsDocsRouteGeneratedTopic${String(number)}`,
    sourcePath: `docs/pages/framework/${slug}.md`,
    audience: ['business', 'architect', 'developer', 'operator'],
    active: true,
  };
});

const cmsDocumentationRoutes = cmsDocumentationPages.map((page, index) => {
  const number = index + 1;
  return {
    code: page.targetRoute,
    site: 'nodicsDocumentationSite',
    path:
      number === 1
        ? '/docs/framework'
        : `/docs/framework/framework-generated-topic-${String(number)}`,
    locale: 'en',
    channel: 'web',
    page: page.targetPage,
    routeType: 'PAGE',
    deliveryState: 'ONLINE',
    accessMode: 'PUBLIC',
    active: true,
  };
});

function documentationDesignerFetch() {
  return vi.fn<typeof fetch>().mockImplementation((input, options) => {
    const path = new URL(requestUrl(input)).pathname;
    if (path.endsWith('/model')) return Promise.resolve(response(authoringModel()));
    if (path.endsWith('/cmsDocumentationPage/capabilities')) {
      return Promise.resolve(
        response(documentationWorkbenchSchema('cmsDocumentationPage', 'Documentation Page')),
      );
    }
    if (path.endsWith('/cmsPageRoute/capabilities')) {
      return Promise.resolve(
        response(documentationWorkbenchSchema('cmsPageRoute', 'Page Route')),
      );
    }
    if (path.endsWith('/cmsDocumentationPage/safe-search')) {
      const query = requestJsonBody(options).query as
        | { readonly pageNumber?: number; readonly pageSize?: number }
        | undefined;
      const pageNumber = query?.pageNumber ?? 1;
      const pageSize = query?.pageSize ?? 50;
      const start = (pageNumber - 1) * pageSize;
      return Promise.resolve(
        response({
          records: cmsDocumentationPages.slice(start, start + pageSize),
          totalCount: cmsDocumentationPages.length,
          pageNumber,
          pageSize,
          sort: { field: 'title', direction: 'ASC' },
        }),
      );
    }
    if (path.endsWith('/cmsPageRoute/safe-search')) {
      const query = requestJsonBody(options).query as
        | { readonly pageNumber?: number; readonly pageSize?: number }
        | undefined;
      const pageNumber = query?.pageNumber ?? 1;
      const pageSize = query?.pageSize ?? 50;
      const start = (pageNumber - 1) * pageSize;
      return Promise.resolve(
        response({
          records: cmsDocumentationRoutes.slice(start, start + pageSize),
          totalCount: cmsDocumentationRoutes.length,
          pageNumber,
          pageSize,
          sort: { field: 'title', direction: 'ASC' },
        }),
      );
    }
    return Promise.resolve(response(authoringModel()));
  });
}

function authoringModel() {
  const sequence = Array.from({ length: 100 }, (_item, index) => ({
    id: index + 1,
    group:
      index < 20
        ? 'Axis Documentation Workspace'
        : index < 40
          ? 'Visual Documentation Contract'
          : index < 70
            ? 'Publishing Workflow'
            : 'Migration, Validation, and Certification',
    code: `doc.item.${String(index + 1)}`,
    label: `Documentation item ${String(index + 1)}`,
    target: index % 2 === 0 ? 'cmsDocumentationPage' : 'readinessReport',
    trigger: index % 3 === 0 ? 'CONTENT_CHANGE' : undefined,
  }));
  return {
    contract: 'cms.documentation.authoring/v1',
    ownerModule: 'cms',
    contentAuthority: 'documentationContentCatalog',
    rendererAuthority: 'axis-runtime-renderers',
    publicationAuthority: 'nPublish',
    workspace: {
      route: '/docs/designer',
      landing: '/docs/designer/dashboard',
      previewRoute: '/docs/designer/preview',
      searchRoute: '/docs/designer/search',
      expandableNavigation: true,
      backendDriven: true,
    },
    panels: [
      {
        code: 'navigation',
        label: 'Navigation Builder',
        schemaName: 'cmsDocumentationNode',
      },
      {
        code: 'pages',
        label: 'Pages and Topic Content',
        schemaName: 'cmsDocumentationPage',
      },
    ],
    accessModes: [
      'PUBLIC',
      'AUTHENTICATED',
      'ROLE_BASED',
      'GROUP_BASED',
      'PERMISSION_BASED',
      'RESTRICTED',
    ],
    lifecycle: {
      readerStates: ['ONLINE'],
      authorStates: ['DRAFT', 'STAGED', 'APPROVED', 'ONLINE'],
      targetTypes: ['PRODUCT', 'NAVIGATION', 'NODE', 'PAGE', 'DASHBOARD'],
      workflowTriggers: {
        PAGE: ['CONTENT_CHANGE'],
        NODE: ['NAVIGATION_CHANGE'],
      },
    },
    sequence,
  };
}

function renderPage(path = '/docs/designer') {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <DocumentationManagementRoutePage
            accessToken="employee-token"
            bootstrap={bootstrap}
            channel="web"
            cmsBaseUrl="http://localhost:4312/nodics/cms"
            employeeId="documentationAuthor"
            locale="en"
            navigation={governanceNavigation}
            path={path}
            runtime={runtime}
            site="axisCmsSite"
          />
        </MemoryRouter>
      </QueryClientProvider>
    </AxisThemeProvider>,
  );
}

describe('DocumentationManagementRoutePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the backend-driven documentation management dashboard', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(authoringModel()));
    const user = userEvent.setup();

    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Create and publish documentation',
      }),
    ).toBeVisible();
    expect(screen.getAllByText('Framework').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('combobox', { name: /Documentation area/i }));
    expect(screen.getByRole('option', { name: 'Framework' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'Swaggers' })).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.getByText('Create or update a page')).toBeVisible();
    expect(screen.getByText('Place it in navigation')).toBeVisible();
    expect(screen.getAllByText('Preview staged content')).toHaveLength(1);
    expect(screen.getAllByText('Publish when ready')).toHaveLength(1);
    expect(screen.getByText('Publish when ready')).toBeVisible();
    expect(screen.getByText('Publishes to Nexus')).toBeVisible();
    expect(screen.queryByText('Designer Tools')).toBeNull();
    expect(screen.queryByText('Selected area')).toBeNull();
    expect(screen.queryByText('Reader audience')).toBeNull();
    expect(screen.queryByLabelText('Documentation designer views')).toBeNull();
    expect(
      screen
        .getAllByRole('link', { name: /Open preview/i })
        .some((link) => link.getAttribute('href') === '/docs/designer/preview'),
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: /Open publishing/i })
        .some((link) => link.getAttribute('href') === '/docs/designer/publication'),
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: /Open links/i })
        .some((link) => link.getAttribute('href') === '/docs/designer/navigation'),
    ).toBe(true);
  });

  it('opens a business-facing page editor instead of the raw schema workbench', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(documentationDesignerFetch());
    const user = userEvent.setup();

    renderPage('/docs/designer/pages');

    await screen.findByRole('heading', {
      name: 'Select a page, edit content, preview it.',
    });
    expect(screen.getByText('Create new page')).toBeVisible();
    expect(await screen.findByText('127 pages')).toBeVisible();
    expect(screen.getByLabelText('Search pages')).toBeVisible();
    await user.type(screen.getByLabelText('Search pages'), 'runtime server');
    expect(await screen.findByText('1 of 127')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Runtime Server Composition/i }));
    expect(screen.queryByText('Framework author journey')).toBeNull();
    expect(screen.getByLabelText('Page title')).toHaveValue('Runtime Server Composition');
    expect(screen.getByLabelText('Page content')).toBeVisible();
    expect(screen.getAllByText('Live preview').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Insert link/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /Insert image/i })).toBeVisible();
    expect(screen.queryByTestId('workbench-schema-navigation-pane')).toBeNull();

    await user.clear(screen.getByLabelText('Link text'));
    await user.type(screen.getByLabelText('Link text'), 'Nodics site');
    await user.clear(screen.getByLabelText('Link URL'));
    await user.type(screen.getByLabelText('Link URL'), 'https://nodics.ai');
    await user.click(screen.getByRole('button', { name: /Insert link/i }));
    await user.clear(screen.getByLabelText('Image alt text'));
    await user.type(screen.getByLabelText('Image alt text'), 'Nodics architecture');
    await user.type(
      screen.getByLabelText('Image URL'),
      'https://example.com/nodics-architecture.png',
    );
    await user.click(screen.getByRole('button', { name: /Insert image/i }));

    expect(screen.getByRole('link', { name: 'Nodics site' })).toHaveAttribute(
      'href',
      'https://nodics.ai',
    );
    expect(
      screen
        .getAllByRole('img', { name: 'Nodics architecture' })
        .some(
          (image) =>
            image.getAttribute('src') === 'https://example.com/nodics-architecture.png',
        ),
    ).toBe(true);

    await user.click(screen.getByRole('button', { name: /Save staged draft/i }));
    expect(
      await screen.findByText(/saved as a staged documentation draft/i),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: /Link to navigation/i })).toHaveAttribute(
      'href',
      '/docs/designer/navigation',
    );
  });

  it('opens a business-facing navigation editor with a reader path preview', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(authoringModel()));
    const user = userEvent.setup();

    renderPage('/docs/designer/navigation');

    await screen.findByRole('heading', {
      name: 'Choose where the documentation page appears.',
    });
    expect(screen.getByText('Add navigation link')).toBeVisible();
    expect(screen.getByLabelText('Page')).toBeVisible();
    expect(screen.getByLabelText('Link label')).toBeVisible();
    expect(screen.getByText('Reader navigation preview')).toBeVisible();
    expect(screen.queryByTestId('workbench-schema-navigation-pane')).toBeNull();

    await user.clear(screen.getByLabelText('Link label'));
    await user.type(screen.getByLabelText('Link label'), 'Business overview');
    await user.click(screen.getByRole('button', { name: /Save navigation link/i }));
    expect(
      await screen.findByText(/Business overview saved to staged navigation/i),
    ).toBeVisible();
    expect(
      screen
        .getAllByRole('link', { name: /Preview staged content/i })
        .some((link) => link.getAttribute('href') === '/docs/designer/preview'),
    ).toBe(true);
  });

  it('previews staged documentation through the designer projection route', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation((input) => {
      const path = new URL(requestUrl(input)).pathname;
      if (path.endsWith('/model')) return Promise.resolve(response(authoringModel()));
      if (path.endsWith('/render-projection')) {
        return Promise.resolve(
          response({
            contract: 'cms.documentation.render/v1',
            channel: 'AXIS',
            navigation: [{ code: 'docs.framework', title: 'Framework' }],
            pages: [
              {
                code: 'docs.framework.new-topic',
                title: 'New staged framework topic',
              },
            ],
            dashboards: [],
          }),
        );
      }
      return Promise.resolve(response({ status: 'READY', issueCount: 0, issues: [] }));
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(request);
    const user = userEvent.setup();

    renderPage('/docs/designer/preview');

    await screen.findByRole('heading', {
      name: 'Review staged documentation before it goes Online',
    });
    expect(screen.getByLabelText('Documentation designer views')).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Preview Staged Content/i }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByText(/does not use the public Online documentation route/i),
    ).toBeVisible();
    expect(screen.getByText('Preview path')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Preview Axis staged view/i }));
    await waitFor(() =>
      expect(screen.getByText('New staged framework topic')).toBeVisible(),
    );

    expect(
      request.mock.calls.some(([input]) =>
        requestUrl(input).includes('/documentation/governance/render-projection'),
      ),
    ).toBe(true);
    const previewCall = request.mock.calls.find(([input]) =>
      requestUrl(input).includes('/documentation/governance/render-projection'),
    );
    expect(requestJsonBody(previewCall?.[1])).toMatchObject({
      channel: 'AXIS',
      packCode: 'nodicsDocumentation',
    });
  });

  it('executes governance validation, search, handoff, and migration actions', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation((input) => {
      const path = new URL(requestUrl(input)).pathname;
      if (path.endsWith('/model')) return Promise.resolve(response(authoringModel()));
      if (path.endsWith('/validate')) {
        return Promise.resolve(
          response({ status: 'READY', issueCount: 0, issues: [] }),
        );
      }
      if (path.endsWith('/render-projection')) {
        return Promise.resolve(
          response({
            contract: 'cms.documentation.render/v1',
            channel: 'AXIS',
            navigation: [{ code: 'docs.home' }],
            pages: [{ code: 'docs.page' }],
            dashboards: [{ code: 'docs.dashboard' }],
          }),
        );
      }
      if (path.endsWith('/search')) {
        return Promise.resolve(
          response({
            contract: 'cms.documentation.search/v1',
            query: 'cache',
            total: 1,
            results: [
              {
                targetType: 'PAGE',
                targetCode: 'docs.cache',
                title: 'Cache Runtime',
                summary: 'Provider-backed cache behavior.',
                score: 3,
              },
            ],
          }),
        );
      }
      if (path.endsWith('/publication-handoff')) {
        return Promise.resolve(
          response({
            status: 'READY_FOR_NPUBLISH',
            publicationAuthority: 'nPublish',
            domain: 'cms.documentation',
            rootType: 'documentationContentCatalog',
            targets: [{ targetType: 'PAGE', targetCode: 'docs.cache' }],
            validation: { status: 'READY', issueCount: 0, issues: [] },
          }),
        );
      }
      return Promise.resolve(
        response({
          contract: 'cms.documentation.migration/v1',
          source: 'generated/bootstrap',
          target: 'axis-managed-content-catalog',
          recordCount: 7,
          sourceEvidence: [{ sourcePath: 'docs/pages/cache.md' }],
          actions: ['convertPages'],
        }),
      );
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(request);
    const user = userEvent.setup();

    renderPage('/docs/designer/governance');

    await screen.findByText('Governance actions');
    await user.click(screen.getByRole('button', { name: /Validate/i }));
    await waitFor(() => expect(screen.getByText('READY')).toBeVisible());
    await user.clear(screen.getByLabelText('Search preview'));
    await user.type(screen.getByLabelText('Search preview'), 'cache');
    await user.click(screen.getByRole('button', { name: /^Search$/i }));
    await waitFor(() => expect(screen.getByText('Cache Runtime')).toBeVisible());
    await user.click(screen.getByRole('button', { name: /Preview/i }));
    await waitFor(() => expect(screen.getByText('1 nodes')).toBeVisible());
    await user.click(screen.getByRole('button', { name: /Handoff/i }));
    await waitFor(() => expect(screen.getByText('READY_FOR_NPUBLISH')).toBeVisible());
    await user.click(screen.getByRole('button', { name: /Migration/i }));
    await waitFor(() => expect(screen.getByText('7 migration records')).toBeVisible());

    expect(
      request.mock.calls.some(([input]) =>
        requestUrl(input).includes('/documentation/governance/publication-handoff'),
      ),
    ).toBe(true);
    const searchCall = request.mock.calls.find(([input]) =>
      requestUrl(input).includes('/documentation/governance/search'),
    );
    const searchBody = requestJsonBody(searchCall?.[1]);
    expect(searchBody.sourceContext).toMatchObject({
      packCode: 'nodicsDocumentation',
    });
  });
});
