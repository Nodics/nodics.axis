import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/app/App';
import { AppProviders } from '../../src/app/AppProviders';
import { validResolvedPage } from '../cms/fixtures/resolvedPage';

const runtimeConfig = {
  backofficeBaseUrl: 'https://backoffice.example.com',
  enterpriseCode: 'enterprise-a',
  projectCode: 'nodics.kickoff',
  clientContractVersion: 1,
  requestTimeoutMs: 10_000,
  browserSessionCsrfCookieName: 'nodics_axis_csrf',
  assistantMaximumEventBytes: 65_536,
  assistantReconnectWindowMs: 120_000,
  assistantIdleTimeoutMs: 45_000,
};

function fetchInputUrl(input: Parameters<typeof fetch>[0]): string {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}

const publicBootstrap = {
  data: {
    contractVersion: 1,
    clientContractVersion: 1,
    endpoints: {
      profile: 'https://profile.example.com',
      cms: 'https://cms.example.com',
    },
    uiComposition: {
      site: 'axisCmsSite',
      catalog: 'axisContentCatalog',
      defaultPublicPage: '/login',
      defaultAuthenticatedPage: '/dashboard',
      locale: 'en',
      channel: 'web',
      fallbackMode: 'STATIC_RECOVERY_SHELL',
    },
  },
};

const axisInitializationReady = {
  code: 'SUC_BOF_00017',
  data: {
    baselineCode: 'axis',
    releaseCode: 'axis:axisBaseline',
    releaseVersion: '0.0.0',
    releaseStatus: 'CURRENT',
    readiness: 'READY',
    publication: { code: 'cmsBaseline_axis_1_0_0', state: 'ONLINE', revision: 4 },
  },
};

const loginPage = {
  ...validResolvedPage,
  page: {
    ...validResolvedPage.page,
    components: [
      ...validResolvedPage.page.components,
      {
        code: 'axisEmployeeLoginFormComponent',
        typeCode: 'axisEmployeeLoginFormComponentType',
        renderer: 'axis.component.employee-login-form',
        rendererContractVersion: 1,
        rendererChannels: ['web'],
        rendererDeprecated: false,
        properties: {
          title: 'Employee sign in',
          usernameLabel: 'Employee ID',
          passwordLabel: 'Password',
          submitLabel: 'Sign in',
        },
        slot: 'authentication',
        index: 30,
        components: [],
      },
    ],
  },
};

const dashboardPage = {
  ...validResolvedPage,
  path: '/dashboard',
  page: {
    ...validResolvedPage.page,
    code: 'axisDashboardPage',
    typeCode: 'axisDashboardPageType',
    renderer: 'axis.page.dashboard',
    template: 'axisDashboardPageTemplate',
    templateContract: {
      code: 'axisDashboardPageTemplate',
      renderer: 'axis.template.dashboard',
      contractVersion: 0,
    },
    components: [
      {
        code: 'axisDashboardWelcomeComponent',
        typeCode: 'axisMessageComponentType',
        renderer: 'axis.component.message',
        rendererContractVersion: 1,
        rendererChannels: ['web'],
        rendererDeprecated: false,
        properties: {
          title: 'Axis dashboard',
          message: 'Authenticated employee workspace',
        },
        slot: 'welcome',
        index: 10,
        components: [],
      },
    ],
  },
};

const schemaWorkbenchPage = {
  ...validResolvedPage,
  path: '/schema-workbench',
  page: {
    ...validResolvedPage.page,
    code: 'axisSchemaWorkbenchPage',
    name: 'Schema Workbench',
    typeCode: 'axisSchemaWorkbenchPageType',
    renderer: 'axis.page.schema-workbench',
    rendererContractVersion: 1,
    rendererChannels: ['web'],
    rendererDeprecated: false,
    template: 'axisSchemaWorkbenchPageTemplate',
    templateContract: {
      code: 'axisSchemaWorkbenchPageTemplate',
      renderer: 'axis.template.schema-workbench',
      contractVersion: 0,
    },
    components: [
      {
        code: 'axisSchemaWorkbenchComponent',
        typeCode: 'axisSchemaWorkbenchComponentType',
        renderer: 'axis.component.schema-workbench',
        rendererContractVersion: 1,
        rendererChannels: ['web'],
        rendererDeprecated: false,
        properties: {
          schemasLabel: 'Available data types',
          schemaSearchLabel: 'Find a data type',
          schemaSearchPlaceholder: 'Search by data type or module',
          selectSchemaLabel: 'Select a data type to view records.',
          moduleLabel: 'Owning module',
          operationsLabel: 'Available operations',
          searchLabel: 'Search records',
          searchPlaceholder: 'Enter a code or other searchable value',
          createLabel: 'Create',
          noRecordsLabel: 'No records found.',
          loadingSchemasLabel: 'Loading data types',
          loadingRecordsLabel: 'Loading records',
          retryLabel: 'Try again',
          advancedQueryLabel: 'Advanced query',
          gridSettingsLabel: 'Grid settings',
          exportLabel: 'Export',
        },
        slot: 'content',
        index: 10,
        components: [],
      },
    ],
  },
};

const documentationPage = {
  ...validResolvedPage,
  path: '/docs/capabilities/content-publishing/wcms-authoring-model',
  page: {
    ...validResolvedPage.page,
    code: 'wcmsAuthoringModelDocumentationPage',
    name: 'Web Content Management System Authoring Model',
    typeCode: 'documentationArticlePageType',
    renderer: 'documentation.page.article',
    rendererContractVersion: 1,
    rendererChannels: ['web'],
    rendererDeprecated: false,
    template: 'documentationArticleTemplate',
    templateContract: {
      code: 'documentationArticleTemplate',
      renderer: 'documentation.template.article',
      contractVersion: 0,
    },
    components: [
      {
        code: 'wcmsDocumentationArticle',
        typeCode: 'documentationArticleComponentType',
        renderer: 'documentation.component.article',
        rendererContractVersion: 1,
        rendererChannels: ['web'],
        rendererDeprecated: false,
        properties: {
          title: 'Web Content Management System Authoring Model',
          summary: 'Framework documentation for WCMS websites and content models.',
          sections: [
            {
              heading: 'Websites',
              anchor: 'websites',
              paragraphs: [
                'Websites group CMS authoring and delivery context for an enterprise experience.',
              ],
            },
          ],
        },
        slot: 'article',
        index: 10,
        components: [],
      },
    ],
  },
};

const cmsPageWorkbenchSchema = {
  moduleName: 'cms',
  schemaName: 'cmsPage',
  label: 'CMS Page',
  description: 'Manage CMS pages.',
  displayProperty: 'code',
  displayProperties: ['code', 'name'],
  queryCapabilities: {
    searchableFields: ['code', 'name'],
    sortableFields: ['code'],
    filterFields: [],
    groupOperators: ['AND'],
    textOperator: 'CONTAINS',
    allowedPageSizes: [10],
    defaultPageSize: 10,
    maximumPageSize: 10,
    defaultSort: { field: 'code', direction: 'ASC' },
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
      description: 'CMS page code.',
      searchable: true,
    },
    {
      name: 'name',
      label: 'Name',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: 'CMS page name.',
      searchable: true,
    },
  ],
  relationships: [],
};

const productItemWorkbenchSchema = {
  moduleName: 'product',
  schemaName: 'productItem',
  label: 'Products',
  description: 'Manage product records.',
  displayProperty: 'itemCode',
  displayProperties: ['itemCode', 'name'],
  queryCapabilities: {
    searchableFields: ['itemCode', 'name'],
    sortableFields: ['itemCode'],
    filterFields: [],
    groupOperators: ['AND'],
    textOperator: 'CONTAINS',
    allowedPageSizes: [10],
    defaultPageSize: 10,
    maximumPageSize: 10,
    defaultSort: { field: 'itemCode', direction: 'ASC' },
  },
  mutationMode: 'GENERATED_CRUD',
  operations: ['search', 'read', 'create', 'update', 'delete'],
  fields: [
    {
      name: 'itemCode',
      label: 'Product',
      type: 'string',
      required: true,
      readOnly: false,
      primary: true,
      description: 'Product item code.',
      searchable: true,
    },
    {
      name: 'name',
      label: 'Name',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: 'Product name.',
      searchable: true,
    },
  ],
  relationships: [],
};

const paymentMethodWorkbenchSchema = {
  moduleName: 'payment',
  schemaName: 'paymentMethod',
  label: 'Payment Methods',
  description: 'Manage governed payment methods.',
  displayProperty: 'code',
  displayProperties: ['code', 'name', 'providerCode'],
  queryCapabilities: {
    searchableFields: ['code', 'name', 'providerCode'],
    sortableFields: ['code'],
    filterFields: [],
    groupOperators: ['AND'],
    textOperator: 'CONTAINS',
    allowedPageSizes: [10],
    defaultPageSize: 10,
    maximumPageSize: 10,
    defaultSort: { field: 'code', direction: 'ASC' },
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
      description: 'Payment method code.',
      searchable: true,
    },
    {
      name: 'name',
      label: 'Name',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: 'Payment method name.',
      searchable: true,
    },
    {
      name: 'providerCode',
      label: 'Provider',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: 'Owning payment provider code.',
      searchable: true,
    },
  ],
  relationships: [],
};

const paymentProviderWorkbenchSchema = {
  moduleName: 'payment',
  schemaName: 'paymentProvider',
  label: 'Payment Providers',
  description: 'Manage governed payment providers.',
  displayProperty: 'providerCode',
  displayProperties: ['providerCode', 'displayName', 'providerType'],
  queryCapabilities: {
    searchableFields: ['providerCode', 'displayName', 'providerType'],
    sortableFields: ['providerCode'],
    filterFields: [],
    groupOperators: ['AND'],
    textOperator: 'CONTAINS',
    allowedPageSizes: [10],
    defaultPageSize: 10,
    maximumPageSize: 10,
    defaultSort: { field: 'providerCode', direction: 'ASC' },
  },
  mutationMode: 'GENERATED_CRUD',
  operations: ['search', 'read', 'create', 'update', 'delete'],
  fields: [
    {
      name: 'providerCode',
      label: 'Provider Code',
      type: 'string',
      required: true,
      readOnly: false,
      primary: true,
      description: 'Safe provider code.',
      searchable: true,
    },
    {
      name: 'displayName',
      label: 'Display Name',
      type: 'string',
      required: true,
      readOnly: false,
      primary: false,
      description: 'Business provider name.',
      searchable: true,
    },
    {
      name: 'providerType',
      label: 'Provider Type',
      type: 'string',
      required: true,
      readOnly: false,
      primary: false,
      description: 'Provider family.',
      searchable: true,
    },
    {
      name: 'apiKey',
      label: 'API Key',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: 'Forbidden unsafe field.',
      searchable: false,
    },
  ],
  relationships: [],
};

const assistantPage = {
  ...validResolvedPage,
  path: '/assistant',
  page: {
    ...validResolvedPage.page,
    code: 'axisAssistantPage',
    name: 'Axis Assistant',
    typeCode: 'axisAssistantPageType',
    renderer: 'axis.page.assistant',
    template: 'axisAssistantPageTemplate',
    templateContract: {
      code: 'axisAssistantPageTemplate',
      renderer: 'axis.template.assistant',
      contractVersion: 0,
    },
    components: [
      {
        code: 'axisAssistantWorkspaceComponent',
        typeCode: 'axisAssistantWorkspaceComponentType',
        renderer: 'axis.component.assistant-workspace',
        rendererContractVersion: 1,
        rendererChannels: ['web', 'mobile-webview'],
        rendererDeprecated: false,
        properties: {
          title: 'How can I help?',
          welcomeMessage: 'Ask about authorized operations.',
          inputPlaceholder: 'Describe what you want to do',
          submitLabel: 'Send',
          stopLabel: 'Stop',
          emptyState: 'Assistant activity appears here.',
          employeeLabel: 'You',
          assistantLabel: 'Axis Assistant',
          workingLabel: 'Working',
          cancellingLabel: 'Stopping',
          errorLabel: 'Request failed',
          historyLabel: 'Conversations',
          newConversationLabel: 'New conversation',
          noConversationsLabel: 'No conversations',
          loadMoreLabel: 'Load more',
          clarificationTitle: 'More information required',
          clarificationSubmitLabel: 'Continue',
          toolPlanTitle: 'Proposed governed action',
          confirmationTitle: 'Review and confirm',
          approveLabel: 'Approve action',
          executeLabel: 'Execute approved action',
          confirmationExpiredLabel: 'Confirmation expired',
          confirmationCompletedLabel: 'Action completed',
          toolPlannedLabel: 'Action prepared',
          toolRunningLabel: 'Action in progress',
          toolSucceededLabel: 'Action completed',
          toolFailedLabel: 'Action failed',
          citationsTitle: 'Sources',
          noCitationsLabel: 'No sources supplied',
          usageTitle: 'AI usage',
          inputTokensLabel: 'Input',
          outputTokensLabel: 'Output',
          cachedTokensLabel: 'Cached input',
          reasoningTokensLabel: 'Reasoning',
          embeddingTokensLabel: 'Embedding',
          reconciliationLabel: 'Accounting status',
        },
        slot: 'workspace',
        index: 20,
        components: [],
      },
    ],
  },
};

describe('employee login journey', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    document.cookie = 'nodics_axis_csrf=; Max-Age=0; Path=/';
  });

  it('restores an authenticated documentation deep link in a fresh browser tab', async () => {
    window.history.pushState(
      {},
      '',
      '/docs/capabilities/content-publishing/wcms-authoring-model#websites',
    );
    document.cookie = 'nodics_axis_csrf=refresh-csrf; Path=/';
    const request = vi.fn<typeof fetch>().mockImplementation((input, options) => {
      const url = fetchInputUrl(input);
      if (url.includes('/bootstrap/public')) {
        return Promise.resolve(
          new Response(JSON.stringify(publicBootstrap), { status: 200 }),
        );
      }
      if (url.includes('/employee/browser/restore')) {
        expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe('refresh-csrf');
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                authToken: 'restored-docs-access',
                loginId: 'operator',
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/axis/initialization')) {
        return Promise.resolve(
          new Response(JSON.stringify(axisInitializationReady), { status: 200 }),
        );
      }
      if (url.includes('/bootstrap')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                modules: {
                  cms: [
                    {
                      moduleName: 'cms',
                      instanceId: 'runtime-1',
                      environment: 'kickoffLocal',
                      clientCallable: true,
                      endpoint: 'https://cms.example.com/nodics/cms',
                      state: 'UP',
                    },
                  ],
                  backoffice: [
                    {
                      moduleName: 'backoffice',
                      instanceId: 'platform-1',
                      environment: 'kickoffLocal',
                      clientCallable: true,
                      endpoint: 'https://platform.example.com/nodics/backoffice',
                      state: 'UP',
                    },
                  ],
                },
                catalogue: {
                  backoffice: {
                    enabled: true,
                    category: 'platform',
                    icon: 'documentation',
                    requiredPermissions: ['backoffice.documentation.view'],
                    compatibility: { status: 'COMPATIBLE' },
                    navigation: [
                      {
                        id: 'documentation',
                        label: 'Documentation',
                        route: '/docs',
                        order: 100,
                        requiredPermissions: ['backoffice.documentation.view'],
                      },
                    ],
                  },
                },
                availability: {
                  backoffice: { state: 'UP' },
                  cms: { state: 'UP' },
                },
                axisPolicy: {
                  contractVersion: 0,
                  screenLockEnabled: true,
                  idleTimeoutSeconds: 900,
                  recentNavigationLimit: 12,
                  revision: 0,
                  source: 'DEFAULT',
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
                    site: 'axisCmsSite',
                    catalog: 'nodicsDocumentationContentCatalog',
                    defaultPage: '/docs',
                    packCode: 'nodicsDocumentation',
                    initializationProfile: 'frameworkdocs',
                  },
                ],
                tenantCode: 'default',
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/applications/frameworkdocs/initialization')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                profileCode: 'frameworkdocs',
                siteCode: 'axisCmsSite',
                readiness: 'READY',
                releaseCode: 'contentPack:nodicsDocumentation',
                releaseVersion: '0.0.0',
                allowedActions: [],
                publication: {
                  code: 'frameworkdocs-0.3.10',
                  state: 'ONLINE',
                  revision: 4,
                },
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/delivery/pages/resolve')) {
        expect(url).not.toContain('/authenticated');
        const authenticated = new Headers(options?.headers).get('Authorization');
        expect(authenticated).toBeNull();
        expect(new URL(url).searchParams.get('path')).toBe(
          '/docs/capabilities/content-publishing/wcms-authoring-model',
        );
        return Promise.resolve(
          new Response(JSON.stringify({ result: documentationPage }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal('fetch', request);

    render(
      <AppProviders runtimeConfig={runtimeConfig}>
        <App />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Web Content Management System Authoring Model',
      }),
    ).toBeVisible();
    expect(
      request.mock.calls.some(([input]) =>
        fetchInputUrl(input).includes('/employee/browser/restore'),
      ),
    ).toBe(true);
  });

  it('opens the documentation dashboard from source registry without a navigation item', async () => {
    window.history.pushState({}, '', '/docs');
    document.cookie = 'nodics_axis_csrf=refresh-csrf; Path=/';
    const request = vi.fn<typeof fetch>().mockImplementation((input, options) => {
      const url = fetchInputUrl(input);
      if (url.includes('/bootstrap/public')) {
        return Promise.resolve(
          new Response(JSON.stringify(publicBootstrap), { status: 200 }),
        );
      }
      if (url.includes('/employee/browser/restore')) {
        expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe('refresh-csrf');
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                authToken: 'restored-docs-access',
                loginId: 'operator',
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/axis/initialization')) {
        return Promise.resolve(
          new Response(JSON.stringify(axisInitializationReady), { status: 200 }),
        );
      }
      if (url.includes('/bootstrap')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                modules: {
                  cms: [
                    {
                      moduleName: 'cms',
                      instanceId: 'runtime-1',
                      environment: 'kickoffLocal',
                      clientCallable: true,
                      endpoint: 'https://cms.example.com/nodics/cms',
                      state: 'UP',
                    },
                  ],
                  backoffice: [
                    {
                      moduleName: 'backoffice',
                      instanceId: 'platform-1',
                      environment: 'kickoffLocal',
                      clientCallable: true,
                      endpoint: 'https://platform.example.com/nodics/backoffice',
                      state: 'UP',
                    },
                  ],
                },
                catalogue: {
                  backoffice: {
                    enabled: true,
                    category: 'platform',
                    icon: 'documentation',
                    requiredPermissions: ['backoffice.documentation.view'],
                    compatibility: { status: 'COMPATIBLE' },
                    navigation: [],
                  },
                },
                availability: {
                  backoffice: { state: 'UP' },
                  cms: { state: 'UP' },
                },
                axisPolicy: {
                  contractVersion: 0,
                  screenLockEnabled: true,
                  idleTimeoutSeconds: 900,
                  recentNavigationLimit: 12,
                  revision: 0,
                  source: 'DEFAULT',
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
                    site: 'axisCmsSite',
                    catalog: 'nodicsDocumentationContentCatalog',
                    defaultPage: '/docs',
                    packCode: 'nodicsDocumentation',
                    initializationProfile: 'frameworkdocs',
                  },
                ],
                tenantCode: 'default',
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/initialization/content-pack')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
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
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (url.includes('/applications/frameworkdocs/initialization')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                profileCode: 'frameworkdocs',
                siteCode: 'nodicsDocumentationSite',
                readiness: 'NOT_IMPORTED',
                releaseCode: 'contentPack:nodicsDocumentation',
                releaseVersion: '0.0.0',
                allowedActions: ['INITIALIZE'],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal('fetch', request);

    render(
      <AppProviders runtimeConfig={runtimeConfig}>
        <App />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Documentation initialization' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Open Framework' }),
    ).not.toBeInTheDocument();
    expect(
      request.mock.calls.some(([input]) =>
        fetchInputUrl(input).includes('/delivery/pages/resolve'),
      ),
    ).toBe(false);
  });

  it('restores a content workbench child route without requiring a cms parent item', async () => {
    window.history.pushState({}, '', '/content/component-media');
    document.cookie = 'nodics_axis_csrf=refresh-csrf; Path=/';
    const request = vi.fn<typeof fetch>().mockImplementation((input, options) => {
      const url = fetchInputUrl(input);
      if (url.includes('/bootstrap/public')) {
        return Promise.resolve(
          new Response(JSON.stringify(publicBootstrap), { status: 200 }),
        );
      }
      if (url.includes('/employee/browser/restore')) {
        expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe('refresh-csrf');
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                authToken: 'restored-content-access',
                loginId: 'operator',
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/axis/initialization')) {
        return Promise.resolve(
          new Response(JSON.stringify(axisInitializationReady), { status: 200 }),
        );
      }
      if (url.includes('/bootstrap')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                modules: {
                  cms: [
                    {
                      moduleName: 'cms',
                      instanceId: 'runtime-1',
                      environment: 'kickoffLocal',
                      clientCallable: true,
                      endpoint: 'https://cms.example.com/nodics/cms',
                      state: 'UP',
                    },
                  ],
                },
                catalogue: {
                  cms: {
                    enabled: true,
                    category: 'content',
                    icon: 'content',
                    requiredPermissions: ['cms.backoffice.view'],
                    compatibility: { status: 'COMPATIBLE' },
                    navigation: [
                      {
                        id: 'component-media',
                        label: 'Component Media',
                        route: '/content/component-media',
                        order: 220,
                        group: {
                          id: 'content',
                          label: 'Content & Experience',
                          order: 200,
                        },
                        requiredPermissions: ['cms.backoffice.view'],
                        workbenchTarget: {
                          moduleName: 'cms',
                          schemaName: 'cmsPage',
                        },
                      },
                    ],
                  },
                },
                availability: {
                  cms: { state: 'UP' },
                },
                axisPolicy: {
                  contractVersion: 0,
                  screenLockEnabled: true,
                  idleTimeoutSeconds: 900,
                  recentNavigationLimit: 12,
                  revision: 0,
                  source: 'DEFAULT',
                },
                documentationSources: [],
                tenantCode: 'default',
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/schema/workbench')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ result: { schemas: [cmsPageWorkbenchSchema] } }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/cmsPage/safe-search')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                records: [{ code: 'home', name: 'Home Page' }],
                totalCount: 1,
                pageNumber: 1,
                pageSize: 10,
                sort: { field: 'code', direction: 'ASC' },
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('path=%2Fschema-workbench')) {
        return Promise.resolve(
          new Response(JSON.stringify({ result: schemaWorkbenchPage }), { status: 200 }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ result: dashboardPage }), { status: 200 }),
      );
    });
    vi.stubGlobal('fetch', request);

    render(
      <AppProviders runtimeConfig={runtimeConfig}>
        <App />
      </AppProviders>,
    );

    expect(
      (await screen.findAllByRole('cell', { name: 'home' }, { timeout: 5_000 }))
        .length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Authenticated employee workspace')).not.toBeInTheDocument();
    expect(
      request.mock.calls.some(([input]) =>
        fetchInputUrl(input).includes('/cmsPage/safe-search'),
      ),
    ).toBe(true);
    expect(
      request.mock.calls.some(([, options]) =>
        new Headers(options?.headers)
          .get('Authorization')
          ?.includes('restored-content-access'),
      ),
    ).toBe(true);
  });

  it('discovers modules, authenticates through Profile, and protects dashboard', async () => {
    window.history.pushState({}, '', '/login');
    const request = vi.fn<typeof fetch>().mockImplementation((input, options) => {
      const url = fetchInputUrl(input);
      if (url.includes('/bootstrap/public')) {
        return Promise.resolve(
          new Response(JSON.stringify(publicBootstrap), { status: 200 }),
        );
      }
      if (url.includes('/employee/browser/authenticate')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                authToken: 'employee-access',
                loginId: 'operator',
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/employee/browser/restore')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                authToken: 'restored-employee-access',
                loginId: 'operator',
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/axis/initialization')) {
        return Promise.resolve(
          new Response(JSON.stringify(axisInitializationReady), { status: 200 }),
        );
      }
      if (url.includes('/bootstrap')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                modules: {
                  cms: [
                    {
                      moduleName: 'cms',
                      instanceId: 'runtime-1',
                      environment: 'kickoffLocal',
                      clientCallable: true,
                      endpoint: 'https://cms.example.com/nodics/cms',
                      state: 'UP',
                    },
                  ],
                  aiAssistant: [
                    {
                      moduleName: 'aiAssistant',
                      instanceId: 'runtime-1',
                      environment: 'kickoffLocal',
                      clientCallable: true,
                      endpoint: 'https://assistant.example.com/nodics/aiAssistant',
                      state: 'UP',
                    },
                  ],
                  product: [
                    {
                      moduleName: 'product',
                      instanceId: 'runtime-1',
                      environment: 'kickoffLocal',
                      clientCallable: true,
                      endpoint: 'https://product.example.com/nodics/product',
                      state: 'UP',
                    },
                  ],
                  payment: [
                    {
                      moduleName: 'payment',
                      instanceId: 'runtime-1',
                      environment: 'kickoffLocal',
                      clientCallable: true,
                      endpoint: 'https://payment.example.com/nodics/payment',
                      state: 'UP',
                    },
                  ],
                },
                catalogue: {
                  cms: {
                    enabled: true,
                    category: 'content',
                    icon: 'content',
                    requiredPermissions: ['cms.backoffice.view'],
                    compatibility: { status: 'COMPATIBLE' },
                    navigation: [
                      {
                        id: 'cms',
                        label: 'Content',
                        route: '/content',
                        order: 200,
                        workbenchTarget: { moduleName: 'cms', schemaName: 'cmsPage' },
                        requiredPermissions: ['cms.backoffice.view'],
                      },
                      {
                        id: 'pages',
                        parentId: 'cms',
                        label: 'Pages',
                        route: '/content/pages',
                        order: 210,
                        workbenchTarget: { moduleName: 'cms', schemaName: 'cmsPage' },
                        requiredPermissions: ['cms.backoffice.view'],
                      },
                    ],
                  },
                  aiAssistant: {
                    enabled: true,
                    category: 'platform',
                    icon: 'assistant',
                    requiredPermissions: ['ai.assistant.use'],
                    compatibility: { status: 'COMPATIBLE' },
                    navigation: [
                      {
                        id: 'assistant',
                        label: 'Axis Assistant',
                        route: '/assistant',
                        order: 50,
                        requiredPermissions: ['ai.assistant.use'],
                      },
                    ],
                  },
                  product: {
                    enabled: true,
                    category: 'commerce',
                    icon: 'product',
                    requiredPermissions: ['product.backoffice.read'],
                    compatibility: { status: 'COMPATIBLE' },
                    navigation: [
                      {
                        id: 'catalog-and-products',
                        label: 'Catalog and Products',
                        route: '/commerce/catalog',
                        order: 410,
                        requiredPermissions: ['product.backoffice.read'],
                        workbenchTarget: {
                          moduleName: 'product',
                          schemaName: 'productItem',
                        },
                      },
                      {
                        id: 'products',
                        parentId: 'catalog-and-products',
                        label: 'Products',
                        route: '/commerce/catalog/products',
                        order: 416,
                        requiredPermissions: ['product.backoffice.read'],
                        workbenchTarget: {
                          moduleName: 'product',
                          schemaName: 'productItem',
                        },
                      },
                    ],
                  },
                  payment: {
                    enabled: true,
                    category: 'commerce',
                    icon: 'payment',
                    requiredPermissions: ['payment.backoffice.read'],
                    compatibility: { status: 'COMPATIBLE' },
                    navigation: [
                      {
                        id: 'payment-operations',
                        label: 'Payment Operations',
                        route: '/commerce/payments',
                        order: 360,
                        group: {
                          id: 'payment-operations',
                          label: 'Payment Operations',
                          order: 360,
                        },
                        requiredPermissions: ['payment.backoffice.read'],
                        workbenchTarget: {
                          moduleName: 'payment',
                          schemaName: 'paymentTransaction',
                        },
                      },
                      {
                        id: 'payment-methods',
                        parentId: 'payment-operations',
                        label: 'Payment Methods',
                        route: '/commerce/payments/methods',
                        order: 362,
                        group: {
                          id: 'payment-operations',
                          label: 'Payment Operations',
                          order: 360,
                        },
                        requiredPermissions: ['payment.backoffice.read'],
                        workbenchTarget: {
                          moduleName: 'payment',
                          schemaName: 'paymentMethod',
                        },
                      },
                      {
                        id: 'payment-providers',
                        parentId: 'payment-operations',
                        label: 'Payment Providers',
                        route: '/commerce/payments/providers',
                        order: 364,
                        group: {
                          id: 'payment-operations',
                          label: 'Payment Operations',
                          order: 360,
                        },
                        requiredPermissions: ['payment.backoffice.read'],
                        workbenchTarget: {
                          moduleName: 'payment',
                          schemaName: 'paymentProvider',
                        },
                        workbenchPresentation: {
                          defaultColumns: [
                            'providerCode',
                            'displayName',
                            'providerType',
                            'apiKey',
                          ],
                          forbiddenFields: ['apiKey'],
                        },
                        lifecycleActions: [
                          {
                            id: 'validate-payment-provider',
                            label: 'Validate provider',
                            intent: 'VALIDATE',
                            permission: 'payment.backoffice.manage',
                            operationRoute: '/providers/lifecycle',
                            featureState: 'PREVIEW',
                          },
                        ],
                      },
                    ],
                  },
                },
                availability: {
                  cms: { state: 'UP' },
                  aiAssistant: { state: 'UP' },
                  product: { state: 'UP' },
                  payment: { state: 'UP' },
                },
                axisPolicy: {
                  contractVersion: 0,
                  screenLockEnabled: true,
                  idleTimeoutSeconds: 900,
                  recentNavigationLimit: 12,
                  revision: 0,
                  source: 'DEFAULT',
                },
                documentationSources: [],
                tenantCode: 'default',
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/token/logout')) {
        return Promise.resolve(
          new Response(JSON.stringify({ result: true }), { status: 200 }),
        );
      }
      if (url.includes('/cmsPage/safe-search')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                records: [{ code: 'home', name: 'Home Page' }],
                totalCount: 1,
                pageNumber: 1,
                pageSize: 10,
                sort: { field: 'code', direction: 'ASC' },
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/productItem/safe-search')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                records: [{ itemCode: 'sku-1', name: 'Demo SKU' }],
                totalCount: 1,
                pageNumber: 1,
                pageSize: 10,
                sort: { field: 'itemCode', direction: 'ASC' },
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/paymentMethod/safe-search')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                records: [
                  {
                    code: 'card',
                    name: 'Card Payment',
                    providerCode: 'stripeProvider',
                  },
                ],
                totalCount: 1,
                pageNumber: 1,
                pageSize: 10,
                sort: { field: 'code', direction: 'ASC' },
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/paymentProvider/safe-search')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                records: [
                  {
                    providerCode: 'stripeProvider',
                    displayName: 'Stripe Provider',
                    providerType: 'CARD_GATEWAY',
                    apiKey: 'should-not-render',
                  },
                ],
                totalCount: 1,
                pageNumber: 1,
                pageSize: 10,
                sort: { field: 'providerCode', direction: 'ASC' },
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/providers/lifecycle')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              code: 'SUC_PAY_00001',
              data: {
                actionId: 'validate-payment-provider',
                providerCode: 'stripeProvider',
                valid: true,
                secretsStoredInPayment: false,
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/schema/workbench')) {
        const schemas = url.includes('cms.example.com')
          ? [cmsPageWorkbenchSchema]
          : url.includes('product.example.com')
            ? [productItemWorkbenchSchema]
            : url.includes('payment.example.com')
              ? [paymentMethodWorkbenchSchema, paymentProviderWorkbenchSchema]
              : [];
        return Promise.resolve(
          new Response(JSON.stringify({ result: { schemas } }), {
            status: 200,
          }),
        );
      }
      const authenticated = new Headers(options?.headers).get('Authorization');
      const deliveredPage = url.includes('path=%2Fassistant')
        ? assistantPage
        : url.includes('path=%2Fschema-workbench')
          ? schemaWorkbenchPage
          : authenticated
            ? dashboardPage
            : loginPage;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            result: deliveredPage,
          }),
          { status: 200 },
        ),
      );
    });
    vi.stubGlobal('fetch', request);
    const user = userEvent.setup();

    const rendered = render(
      <AppProviders runtimeConfig={runtimeConfig}>
        <App />
      </AppProviders>,
    );

    await user.type(await screen.findByLabelText(/Employee ID/), 'operator');
    await user.type(screen.getByLabelText(/Password/), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Authenticated employee workspace')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Axis Assistant' }));
    expect(
      await screen.findByRole('heading', { name: 'How can I help?' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: [
          'Current context: Environment: Kickoff Local',
          'Tenant: Default',
          'Enterprise: Enterprise A',
          'Site: Axis CMS Site',
          'Catalog: Axis Content Catalog',
        ].join(', '),
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Expand Content & Experience' }),
    );
    const contentNavigationItem = screen
      .getAllByRole('button', { name: 'Content' })
      .find((button) => button.getAttribute('aria-level') === '1');
    expect(contentNavigationItem).toBeDefined();
    document.cookie = 'nodics_axis_csrf=refresh-csrf; Path=/';
    rendered.unmount();
    window.history.pushState({}, '', '/content/pages');
    const restoredContent = render(
      <AppProviders runtimeConfig={runtimeConfig}>
        <App />
      </AppProviders>,
    );
    expect(await screen.findByRole('heading', { name: 'Pages' })).toBeVisible();
    expect(screen.queryByText('Available data types')).not.toBeInTheDocument();
    expect(
      (await screen.findAllByRole('cell', { name: 'home' })).length,
    ).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(
      request.mock.calls.some(([, options]) =>
        new Headers(options?.headers).get('Authorization')?.includes('employee-access'),
      ),
    ).toBe(true);

    expect(
      request.mock.calls.some(([, options]) =>
        new Headers(options?.headers)
          .get('Authorization')
          ?.includes('restored-employee-access'),
      ),
    ).toBe(true);

    restoredContent.unmount();
    window.history.pushState({}, '', '/commerce/catalog/products');
    const restoredProduct = render(
      <AppProviders runtimeConfig={runtimeConfig}>
        <App />
      </AppProviders>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Product language management' }),
    ).toBeVisible();
    expect(
      (await screen.findAllByRole('cell', { name: 'sku-1' })).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Module workspace')).not.toBeInTheDocument();

    restoredProduct.unmount();
    window.history.pushState({}, '', '/commerce/payments/methods');
    const restoredPaymentMethods = render(
      <AppProviders runtimeConfig={runtimeConfig}>
        <App />
      </AppProviders>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Payment Methods' }),
    ).toBeVisible();
    expect(
      (await screen.findAllByRole('cell', { name: 'card' })).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Module workspace')).not.toBeInTheDocument();

    restoredPaymentMethods.unmount();
    window.history.pushState({}, '', '/commerce/payments/providers');
    const restoredProvider = render(
      <AppProviders runtimeConfig={runtimeConfig}>
        <App />
      </AppProviders>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Payment Providers' }),
    ).toBeVisible();
    expect(
      (await screen.findAllByRole('cell', { name: 'stripeProvider' })).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('should-not-render')).not.toBeInTheDocument();
    const providerCell = screen.getAllByRole('cell', {
      name: 'stripeProvider',
    })[0];
    if (!providerCell) {
      throw new Error('Expected the payment provider row to render');
    }
    await user.click(providerCell);
    await user.click(await screen.findByRole('button', { name: /Validate provider/ }));
    expect(await screen.findByText(/validate-payment-provider/)).toBeVisible();
    expect(await screen.findByText(/secretsStoredInPayment/)).toBeVisible();
    expect(
      request.mock.calls.some(([input, options]) => {
        const requestUrl = fetchInputUrl(input);
        if (!requestUrl.includes('/providers/lifecycle')) {
          return false;
        }
        const body = options?.body;
        if (typeof body !== 'string') return false;
        const payload: unknown = JSON.parse(body);
        if (!payload || typeof payload !== 'object') return false;
        const actionPayload = payload as {
          readonly actionId?: unknown;
          readonly identity?: { readonly providerCode?: unknown };
          readonly model?: Record<string, unknown>;
        };
        return (
          actionPayload.actionId === 'validate-payment-provider' &&
          actionPayload.identity?.providerCode === 'stripeProvider' &&
          actionPayload.model?.providerCode === 'stripeProvider' &&
          actionPayload.model?.apiKey === undefined
        );
      }),
    ).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Open employee menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(await screen.findByLabelText(/Employee ID/)).toBeVisible();
    restoredProvider.unmount();
  });

  it('restores the lock screen after a browser refresh until password verification', async () => {
    window.history.pushState({}, '', '/lock-screen');
    document.cookie = 'nodics_axis_csrf=refresh-csrf; Path=/';
    window.sessionStorage.setItem(
      'nodics-axis-screen-lock-v1',
      JSON.stringify({ locked: true, returnPath: '/dashboard' }),
    );
    const request = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.includes('/bootstrap/public')) {
        return Promise.resolve(
          new Response(JSON.stringify(publicBootstrap), { status: 200 }),
        );
      }
      if (url.includes('/employee/browser/restore')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                authToken: 'restored-employee-access',
                loginId: 'operator',
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/employee/browser/authenticate')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              result: {
                authToken: 'unlocked-employee-access',
                loginId: 'operator',
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/axis/initialization')) {
        return Promise.resolve(
          new Response(JSON.stringify(axisInitializationReady), { status: 200 }),
        );
      }
      if (url.includes('/bootstrap')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                modules: {},
                catalogue: {},
                availability: {},
                axisPolicy: {
                  contractVersion: 0,
                  screenLockEnabled: true,
                  idleTimeoutSeconds: 900,
                  recentNavigationLimit: 12,
                  revision: 0,
                  source: 'DEFAULT',
                },
                documentationSources: [],
                tenantCode: 'default',
              },
            }),
            { status: 200 },
          ),
        );
      }
      const path = new URL(url).searchParams.get('path');
      const deliveredPage =
        path === '/lock-screen'
          ? {
              ...loginPage,
              path: '/lock-screen',
              page: {
                ...loginPage.page,
                components: [
                  {
                    code: 'axisEmployeeLockFormComponent',
                    typeCode: 'axisEmployeeLockFormComponentType',
                    renderer: 'axis.component.employee-lock-form',
                    rendererContractVersion: 1,
                    rendererChannels: ['web'],
                    rendererDeprecated: false,
                    properties: {
                      passwordLabel: 'Password',
                      submitLabel: 'Unlock',
                    },
                    slot: 'authentication',
                    index: 30,
                    components: [],
                  },
                ],
              },
            }
          : dashboardPage;
      return Promise.resolve(
        new Response(JSON.stringify({ result: deliveredPage }), { status: 200 }),
      );
    });
    vi.stubGlobal('fetch', request);
    const user = userEvent.setup();

    render(
      <AppProviders runtimeConfig={runtimeConfig}>
        <App />
      </AppProviders>,
    );

    expect(await screen.findByRole('button', { name: 'Unlock' })).toBeVisible();
    expect(
      screen.queryByText('Authenticated employee workspace'),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Password/), 'secret');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByText('Authenticated employee workspace')).toBeVisible();
    expect(window.sessionStorage.getItem('nodics-axis-screen-lock-v1')).toBeNull();
  });
});
