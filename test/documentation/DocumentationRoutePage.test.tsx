import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

import { DocumentationRoutePage } from '../../src/documentation/DocumentationRoutePage';

const runtime = {
  backofficeBaseUrl: 'http://localhost:3000',
  enterpriseCode: 'default',
  projectCode: 'nodics.kickoff',
  clientContractVersion: 1,
  requestTimeoutMs: 1_000,
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
    cms: [{ ...connection, moduleName: 'cms' }],
    backoffice: [{ ...connection, moduleName: 'backoffice' }],
  },
  documentationSources: [
    {
      id: 'framework',
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

function renderPage(path = '/docs') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <DocumentationRoutePage
          accessToken="token"
          bootstrap={bootstrap}
          channel="web"
          cmsBaseUrl="http://localhost:3000"
          locale="en"
          path={path}
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
      screen.getByRole('heading', { name: 'Documentation initialization' }),
    ).toBeVisible();
    expect(await screen.findByText('Core framework documentation.')).toBeVisible();
    expect(screen.getByText('Generated API contracts.')).toBeVisible();
    expect(screen.getByText('85% documented')).toBeVisible();
    expect(screen.getByText('100% documented')).toBeVisible();
    expect(screen.queryByRole('tab', { name: 'Framework' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Swaggers' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Framework' })).toHaveAttribute(
      'href',
      '/docs/framework',
    );
    expect(screen.getByRole('link', { name: 'Open Swaggers' })).toHaveAttribute(
      'href',
      '/docs/swaggers',
    );
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

    expect(await screen.findByText('Documentation initialization')).toBeVisible();
    expect(
      screen.getByText(
        /Framework, Swaggers, Axis, and Kickoff documentation areas stay locked/iu,
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Open Framework' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Release code')).not.toBeInTheDocument();
    const detailsToggle = screen.getByRole('button', {
      name: 'Show Framework details',
    });
    expect(detailsToggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(detailsToggle);
    expect(detailsToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Release code')).toBeVisible();
    await user.click(
      await screen.findByRole('button', { name: 'Install documentation' }),
    );
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
    renderPage('/docs/framework');

    expect(
      await screen.findByText(/Install the verified bundle to Staged/),
    ).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Framework' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Swaggers' })).toBeVisible();
    await user.click(
      await screen.findByRole('button', { name: 'Install documentation' }),
    );
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

  it('renders current CMS documentation through public delivery after source authorization', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((request) => {
      const url = new URL(requestPathname(request), 'http://localhost:3000');
      if (url.pathname.includes('/applications/frameworkdocs/initialization')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              code: 'SUC_IMP_00000',
              data: {
                ...response.data,
                readiness: 'READY',
                allowedActions: [],
              },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );
      }
      if (url.pathname.includes('/content-pack')) {
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
      if (url.pathname.includes('/delivery/pages/resolve')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                contractVersion: 0,
                site: 'axisCmsSite',
                path: '/docs',
                locale: 'en',
                channel: 'web',
                page: {
                  code: 'docsPage',
                  name: 'Framework documentation',
                  typeCode: 'documentationArticlePageType',
                  template: 'documentationArticleTemplate',
                  renderer: 'documentation.page.article',
                  templateContract: {
                    code: 'documentationArticleTemplate',
                    renderer: 'documentation.template.article',
                    contractVersion: 0,
                  },
                  components: [],
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
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    renderPage('/docs/framework');

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([request]) =>
          requestPathname(request).includes('/delivery/pages/resolve'),
        ),
      ).toBe(true),
    );
    const cmsRequest = fetchMock.mock.calls
      .map(([request]) => requestPathname(request))
      .find((pathname) => pathname.includes('/delivery/pages/resolve'));
    expect(cmsRequest).toBe('/nodics/cms/v0/delivery/pages/resolve');
    expect(cmsRequest).not.toContain('/authenticated');
    fetchMock.mockRestore();
  });

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
    renderPage('/docs/framework');

    expect((await screen.findAllByText('Staged: CURRENT'))[0]).toBeVisible();
    expect(screen.getAllByText('Online: IMPORTED')[0]).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Validate staged release' }));
    await user.click(
      screen.getByRole('button', { name: 'Publish / request approval' }),
    );
    expect(
      fetchMock.mock.calls.some(
        ([request, init]) =>
          requestPathname(request).endsWith('/initialization/initiate') &&
          init?.method === 'POST',
      ),
    ).toBe(true);
    expect(
      (await screen.findAllByText('Online: PUBLICATION PENDING'))[0],
    ).toBeVisible();
    fetchMock.mockRestore();
  });

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
    renderPage('/docs/swaggers');

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
