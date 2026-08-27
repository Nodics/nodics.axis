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
  label: 'Documentation Management',
  route: '/content/designer/documentation',
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
  route: '/content/designer/documentation/governance',
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
    route: '/content/designer/documentation/navigation',
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
    route: '/content/designer/documentation/pages',
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
      route: '/content/designer/documentation',
      landing: '/content/designer/documentation/dashboard',
      previewRoute: '/content/designer/documentation/preview',
      searchRoute: '/content/designer/documentation/search',
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

function renderPage(path = '/content/designer/documentation') {
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

    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Governed documentation workspace',
      }),
    ).toBeVisible();
    expect(screen.getByText('Framework')).toBeVisible();
    expect(screen.getByText('100')).toBeVisible();
    expect(screen.getByText('Author/Admin')).toBeVisible();
    expect(screen.getByText('Record editor shortcuts')).toBeVisible();
    expect(screen.getAllByText('cmsDocumentationPage').length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole('link', { name: /Navigation Builder/i })
        .some(
          (link) =>
            link.getAttribute('href') === '/content/designer/documentation/navigation',
        ),
    ).toBe(true);
    expect(screen.getByText('Authoring and publication flow')).toBeVisible();
    expect(await screen.findByText('Axis Documentation Workspace')).toBeVisible();
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

    renderPage('/content/designer/documentation/governance');

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
