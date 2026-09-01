import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
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
    articleComponent: `nodicsDocsComponentGeneratedTopic${String(number)}`,
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

const cmsDocumentationComponents = cmsDocumentationPages.map((page, index) => ({
  code: page.articleComponent,
  typeCode: 'nodicsDocumentationArticleComponentType',
  renderer: 'documentation.component.article',
  accessMode: 'PUBLIC',
  properties: {
    title: page.title,
    route: cmsDocumentationRoutes[index]?.path,
    sectionTitle: 'Framework generated content',
    summary: page.summary,
    audience: page.audience,
    blocks: [
      {
        kind: 'paragraph',
        text: `Detailed component body for ${page.title}.`,
      },
      {
        kind: 'heading',
        level: 2,
        text: 'Implementation notes',
      },
      {
        kind: 'code',
        language: 'javascript',
        text: 'const framework = "nodics";',
      },
    ],
  },
  active: true,
}));

const cmsDocumentationNodes = [
  {
    code: 'nodicsDocsNodeRoot',
    product: 'nodicsDocumentationProduct',
    navigation: 'nodicsDocumentationNavigation',
    nodeLevel: 'SECTION',
    nodeType: 'CONTAINER',
    nodeTitle: 'Nodics Documentation',
    nodeSummary: 'Root documentation node.',
    nodeOrder: 10,
    accessMode: 'PUBLIC',
    active: true,
  },
  {
    code: 'nodicsDocsNodeSecFramework',
    product: 'nodicsDocumentationProduct',
    navigation: 'nodicsDocumentationNavigation',
    parentNode: 'nodicsDocsNodeRoot',
    nodeLevel: 'SECTION',
    nodeType: 'CONTAINER',
    nodeTitle: 'Framework generated content',
    nodeSummary: 'Framework generated content section.',
    nodeOrder: 20,
    accessMode: 'PUBLIC',
    active: true,
  },
  {
    code: 'nodicsDocsNodeSecRuntime',
    product: 'nodicsDocumentationProduct',
    navigation: 'nodicsDocumentationNavigation',
    parentNode: 'nodicsDocsNodeRoot',
    nodeLevel: 'SECTION',
    nodeType: 'CONTAINER',
    nodeTitle: 'Runtime and Operations',
    nodeSummary: 'Runtime and operational documentation section.',
    nodeOrder: 30,
    accessMode: 'PUBLIC',
    active: true,
  },
  ...cmsDocumentationPages.map((page, index) => {
    const number = index + 1;
    return {
      code: `nodicsDocsNodePage${String(number)}`,
      product: 'nodicsDocumentationProduct',
      navigation: 'nodicsDocumentationNavigation',
      parentNode:
        number === 126 ? 'nodicsDocsNodeSecRuntime' : 'nodicsDocsNodeSecFramework',
      nodeLevel: 'PAGE_LINK',
      nodeType: 'PAGE',
      nodeTitle: page.title,
      nodeSummary: page.summary,
      targetDocumentationPage: page.code,
      targetPage: page.targetPage,
      targetRoute: page.targetRoute,
      nodeOrder: number * 10,
      accessMode: 'PUBLIC',
      nodeAudience: page.audience,
      active: true,
    };
  }),
];

function documentationDesignerFetch() {
  return vi.fn<typeof fetch>().mockImplementation((input, options) => {
    const path = new URL(requestUrl(input)).pathname;
    if (path.endsWith('/model')) return Promise.resolve(response(authoringModel()));
    if (path.endsWith('/cmsDocumentationPage/capabilities')) {
      return Promise.resolve(
        response(
          documentationWorkbenchSchema('cmsDocumentationPage', 'Documentation Page'),
        ),
      );
    }
    if (path.endsWith('/cmsPageRoute/capabilities')) {
      return Promise.resolve(
        response(documentationWorkbenchSchema('cmsPageRoute', 'Page Route')),
      );
    }
    if (path.endsWith('/cmsComponent/capabilities')) {
      return Promise.resolve(
        response(documentationWorkbenchSchema('cmsComponent', 'CMS Component')),
      );
    }
    if (path.endsWith('/cmsPage/capabilities')) {
      return Promise.resolve(
        response(documentationWorkbenchSchema('cmsPage', 'CMS Page')),
      );
    }
    if (path.endsWith('/cmsDocumentationNode/capabilities')) {
      return Promise.resolve(
        response(
          documentationWorkbenchSchema('cmsDocumentationNode', 'Documentation Node'),
        ),
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
    if (path.endsWith('/cmsComponent/safe-search')) {
      const query = requestJsonBody(options).query as
        | { readonly pageNumber?: number; readonly pageSize?: number }
        | undefined;
      const pageNumber = query?.pageNumber ?? 1;
      const pageSize = query?.pageSize ?? 50;
      const start = (pageNumber - 1) * pageSize;
      return Promise.resolve(
        response({
          records: cmsDocumentationComponents.slice(start, start + pageSize),
          totalCount: cmsDocumentationComponents.length,
          pageNumber,
          pageSize,
          sort: { field: 'title', direction: 'ASC' },
        }),
      );
    }
    if (path.endsWith('/cmsDocumentationNode/safe-search')) {
      const query = requestJsonBody(options).query as
        | { readonly pageNumber?: number; readonly pageSize?: number }
        | undefined;
      const pageNumber = query?.pageNumber ?? 1;
      const pageSize = query?.pageSize ?? 50;
      const start = (pageNumber - 1) * pageSize;
      return Promise.resolve(
        response({
          records: cmsDocumentationNodes.slice(start, start + pageSize),
          totalCount: cmsDocumentationNodes.length,
          pageNumber,
          pageSize,
          sort: { field: 'title', direction: 'ASC' },
        }),
      );
    }
    if (path.endsWith('/cmsComponent') && options?.method === 'PATCH') {
      return Promise.resolve(response({ models: [cmsDocumentationComponents[0]] }));
    }
    if (path.endsWith('/cmsDocumentationPage') && options?.method === 'PATCH') {
      return Promise.resolve(response({ models: [cmsDocumentationPages[0]] }));
    }
    if (path.endsWith('/cmsPageRoute') && options?.method === 'PATCH') {
      return Promise.resolve(response({ models: [cmsDocumentationRoutes[0]] }));
    }
    if (path.endsWith('/cmsDocumentationNode') && options?.method === 'PATCH') {
      return Promise.resolve(response({ models: [cmsDocumentationNodes[2]] }));
    }
    if (
      (path.endsWith('/cmsComponent') ||
        path.endsWith('/cmsDocumentationPage') ||
        path.endsWith('/cmsPageRoute') ||
        path.endsWith('/cmsPage') ||
        path.endsWith('/cmsDocumentationNode')) &&
      options?.method === 'PUT'
    ) {
      return Promise.resolve(response(requestJsonBody(options)));
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
        label: 'Page Content',
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

  it('renders the page editor directly at the base documentation designer route', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(documentationDesignerFetch());
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
    expect(
      await screen.findByRole('heading', {
        name: 'Edit the staged documentation in the same reader layout.',
      }),
    ).toBeVisible();
    expect(screen.getByText('Staged documentation preview')).toBeVisible();
    expect(screen.getByRole('button', { name: /New page/i })).toBeVisible();
    expect(await screen.findByText('127 staged pages')).toBeVisible();
    expect(screen.getByLabelText('Search pages')).toBeVisible();
    expect(screen.queryByText('Create or update a page')).toBeNull();
    expect(screen.queryByText('Place it in navigation')).toBeNull();
    expect(screen.getByText('Publishes to Nexus')).toBeVisible();
    expect(screen.queryByText('Designer Tools')).toBeNull();
    expect(screen.queryByText('Selected area')).toBeNull();
    expect(screen.queryByText('Reader audience')).toBeNull();
    expect(screen.queryByLabelText('Documentation designer views')).toBeNull();
  });

  it('opens a business-facing page editor instead of the raw schema workbench', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(documentationDesignerFetch());
    const user = userEvent.setup();

    renderPage('/docs/designer/pages');

    await screen.findByRole('heading', {
      name: 'Edit the staged documentation in the same reader layout.',
    });
    expect(screen.getByText('Staged documentation preview')).toBeVisible();
    expect(screen.getByRole('button', { name: /New page/i })).toBeVisible();
    expect(await screen.findByText('127 staged pages')).toBeVisible();
    expect(screen.getByLabelText('Search pages')).toBeVisible();
    await user.type(screen.getByLabelText('Search pages'), 'runtime server');
    expect(
      await screen.findByRole('button', { name: /Collapse Runtime and Operations/i }),
    ).toBeVisible();
    expect(await screen.findByText('Runtime Server Composition')).toBeVisible();
    await user.click(screen.getByRole('link', { name: /Runtime Server Composition/i }));
    expect(screen.queryByText('Framework author journey')).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Runtime Server Composition' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Edit page/i }));
    expect(screen.getByLabelText('Page title')).toHaveValue(
      'Runtime Server Composition',
    );
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

    expect(
      screen
        .getAllByRole('link', { name: 'Nodics site' })
        .some((link) => link.getAttribute('href') === 'https://nodics.ai'),
    ).toBe(true);
    expect(
      screen
        .getAllByRole('img', { name: 'Nodics architecture' })
        .some(
          (image) =>
            image.getAttribute('src') === 'https://example.com/nodics-architecture.png',
        ),
    ).toBe(true);

    await user.click(screen.getByRole('button', { name: /Save staged/i }));
    expect(await screen.findByText(/saved to Staged documentation/i)).toBeVisible();
    const requests = vi.mocked(globalThis.fetch).mock.calls;
    expect(
      requests.some(
        ([input, options]) =>
          requestUrl(input).endsWith('/cmsComponent') && options?.method === 'PATCH',
      ),
    ).toBe(true);
    expect(
      requests.some(
        ([input, options]) =>
          requestUrl(input).endsWith('/cmsDocumentationPage') &&
          options?.method === 'PATCH',
      ),
    ).toBe(true);
    expect(screen.getByRole('button', { name: /Link navigation/i })).toBeVisible();
  });

  it('opens navigation editing in the same documentation designer window', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(documentationDesignerFetch());
    const user = userEvent.setup();

    renderPage('/docs/designer/navigation');

    await screen.findByRole('heading', {
      name: 'Edit the staged documentation in the same reader layout.',
    });
    expect(screen.getByText('Navigation placement')).toBeVisible();
    expect(await screen.findByText('127 staged pages')).toBeVisible();
    expect(screen.getByLabelText('Search pages')).toBeVisible();
    expect(screen.getByLabelText('Navigation label')).toBeVisible();
    expect(screen.getByRole('combobox', { name: /Place under/i })).toBeVisible();
    expect(screen.getByText('Reader path preview')).toBeVisible();
    expect(screen.queryByTestId('workbench-schema-navigation-pane')).toBeNull();

    await user.type(screen.getByLabelText('Search pages'), 'runtime server');
    expect(
      await screen.findByRole('button', { name: /Collapse Runtime and Operations/i }),
    ).toBeVisible();
    expect(await screen.findByText('Runtime Server Composition')).toBeVisible();
    await user.click(screen.getByRole('link', { name: /Runtime Server Composition/i }));
    expect(screen.getByLabelText('Navigation label')).toHaveValue(
      'Runtime Server Composition',
    );
    const placeUnder = screen.getByRole('combobox', { name: /Place under/i });
    await user.click(placeUnder);
    expect(screen.getByRole('option', { name: /Top level/i })).toBeVisible();
    expect(
      within(screen.getByRole('listbox')).getByText('Framework generated content'),
    ).toBeVisible();
    await user.clear(placeUnder);
    await user.type(placeUnder, 'topic 1');
    const parentListbox = screen.getByRole('listbox');
    const topicParentOption = within(parentListbox)
      .getByText('Generated documentation topic 1')
      .closest('[role="option"]');
    expect(topicParentOption).not.toBeNull();
    await user.click(topicParentOption!);
    await user.clear(screen.getByLabelText('Navigation label'));
    await user.type(screen.getByLabelText('Navigation label'), 'Business overview');
    await user.click(screen.getByRole('button', { name: /Save navigation/i }));
    expect(
      await screen.findByText(/Business overview saved to Staged navigation/i),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Back to page editing/i }));
    expect(screen.getByLabelText('Page title')).toHaveValue(
      'Runtime Server Composition',
    );
    expect(screen.getByLabelText('Page content')).toBeVisible();
    const requests = vi.mocked(globalThis.fetch).mock.calls;
    expect(
      requests.some(
        ([input, options]) =>
          requestUrl(input).endsWith('/cmsDocumentationNode') &&
          options?.method === 'PATCH',
      ),
    ).toBe(true);
    const navigationPatch = requests.find(
      ([input, options]) =>
        requestUrl(input).endsWith('/cmsDocumentationNode') &&
        options?.method === 'PATCH',
    );
    expect(requestJsonBody(navigationPatch?.[1]).model).toMatchObject({
      nodeTitle: 'Business overview',
      parentNode: 'nodicsDocsNodePage1',
    });
    expect(screen.queryByLabelText('Documentation designer views')).toBeNull();
  });

  it('creates a new documentation page with rich content and staged CMS records', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(documentationDesignerFetch());
    const user = userEvent.setup();

    renderPage('/docs/designer/pages');

    await screen.findByRole('heading', {
      name: 'Edit the staged documentation in the same reader layout.',
    });
    await user.click(screen.getByRole('button', { name: /New page/i }));
    await user.clear(screen.getByLabelText('Page title'));
    await user.type(screen.getByLabelText('Page title'), 'Customer launch checklist');
    await user.clear(screen.getByLabelText('Page URL'));
    await user.type(
      screen.getByLabelText('Page URL'),
      '/docs/framework/customer-launch-checklist',
    );
    await user.clear(screen.getByLabelText('Reader summary'));
    await user.type(
      screen.getByLabelText('Reader summary'),
      'Launch checklist for business owners preparing Nodics documentation.',
    );
    await user.clear(screen.getByLabelText('Link text'));
    await user.type(screen.getByLabelText('Link text'), 'Launch evidence');
    await user.clear(screen.getByLabelText('Link URL'));
    await user.type(screen.getByLabelText('Link URL'), 'https://nodics.ai/docs');
    await user.click(screen.getByRole('button', { name: /Insert link/i }));
    await user.click(screen.getByRole('button', { name: /Save staged/i }));

    expect(
      await screen.findByText(
        /Customer launch checklist saved to Staged documentation/i,
      ),
    ).toBeVisible();
    const requests = vi.mocked(globalThis.fetch).mock.calls;
    expect(
      requests.some(
        ([input, options]) =>
          requestUrl(input).endsWith('/cmsComponent') && options?.method === 'PUT',
      ),
    ).toBe(true);
    expect(
      requests.some(
        ([input, options]) =>
          requestUrl(input).endsWith('/cmsDocumentationPage') &&
          options?.method === 'PUT',
      ),
    ).toBe(true);
    expect(
      requests.some(
        ([input, options]) =>
          requestUrl(input).endsWith('/cmsPage') && options?.method === 'PUT',
      ),
    ).toBe(true);
    expect(
      requests.some(
        ([input, options]) =>
          requestUrl(input).endsWith('/cmsPageRoute') && options?.method === 'PUT',
      ),
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
    expect(screen.queryByLabelText('Documentation designer views')).toBeNull();
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
