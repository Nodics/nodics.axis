import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../src/app/AxisThemeProvider';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import { AxisDashboardRoutePage } from '../../src/dashboard/AxisDashboardRoutePage';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';

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

const bootstrap: AxisAuthenticatedBootstrap = {
  axisPolicy: {
    contractVersion: 1,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 1,
    source: 'DEFAULT',
  },
  navigation: [
    {
      id: 'registry',
      label: 'Module Registry',
      route: '/registry',
      order: 10,
      moduleName: 'backoffice',
      category: 'system',
      icon: 'registry',
      availability: 'UP',
    },
    {
      id: 'products',
      label: 'Products',
      route: '/commerce/catalog/products',
      order: 20,
      moduleName: 'product',
      category: 'commerce',
      icon: 'product',
      availability: 'UP',
      workbenchTarget: { moduleName: 'product', schemaName: 'product' },
    },
    {
      id: 'media-management',
      label: 'Media',
      route: '/media',
      order: 30,
      moduleName: 'media',
      category: 'content',
      icon: 'media',
      availability: 'UP',
    },
  ],
  environments: ['kickoffLocal'],
  moduleCatalog: {},
  moduleConnections: {
    backoffice: [
      {
        moduleName: 'backoffice',
        instanceId: 'kickoffLocal:platformServer:backoffice:0',
        endpoint: 'http://localhost:4300/nodics/backoffice',
        environment: 'kickoffLocal',
        server: 'platformServer',
        runtimeRole: { code: 'PLATFORM', publication: 'OPERATIONAL' },
        state: 'UP',
      },
    ],
    import: [
      {
        moduleName: 'import',
        instanceId: 'kickoffLocal:wcmsStagedServer:import:0',
        endpoint: 'http://localhost:4312/nodics/import',
        environment: 'kickoffLocal',
        server: 'wcmsStagedServer',
        runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
        state: 'UP',
      },
    ],
  },
  applicationInitializationProfiles: [
    {
      code: 'agoraapparel',
      title: 'Agora Apparel',
      kind: 'application',
      category: 'project',
      summary: 'Apparel storefront',
      order: 10,
      type: 'PROJECT_ACCELERATOR',
      owner: 'agora.apparel',
      applicationCode: 'agora-apparel',
      siteCode: 'agora-apparel',
      baselineCode: 'agoraapparel',
      requiredServers: ['wcmsStagedServer'],
      dataPackages: [],
      activationPolicy: {
        approvalRequiredForOnline: true,
        requiredDataTrigger: 'ACTIVATION',
        sampleDataTrigger: 'USER',
      },
    },
  ],
  documentationSources: [
    {
      id: 'framework',
      label: 'Framework docs',
      type: 'CMS',
      route: '/docs/framework',
      order: 10,
      ownerModule: 'nodics.docs',
      connectionModule: 'cms',
      site: 'nodics-docs',
      catalog: 'nodics-docs',
      defaultPage: '/docs/framework',
      packCode: 'nodicsDocumentation',
      initializationProfile: 'frameworkdocs',
      dashboard: { audiences: ['developer'] },
    },
  ],
  tenantCode: 'default',
};

function response(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function release(status: string, dataType = 'core') {
  return {
    moduleName: 'cms',
    displayName: 'Content Management',
    canonicalIdentity: `nodics.wcms:cms:${dataType}`,
    dataType,
    version: '0.1.0',
    description: 'CMS release data',
    checksum: 'a'.repeat(64),
    releaseCode: `cms-${dataType}-v001`,
    destinationRole: 'WCMS_STAGED',
    status,
  };
}

function moduleItem(
  functionalModule: string,
  registrationState: string,
  enabled: boolean,
) {
  return {
    project: 'nodics.kickoff',
    functionalModule,
    displayName: functionalModule.replace('nodics.', ''),
    registrationState,
    enabled,
    required: false,
    runtimeState: enabled ? 'ACTIVE' : 'OFFLINE',
    technicalModules: [functionalModule.replace('nodics.', '')],
    observedServers: ['platformServer'],
    catalogueRevision: 1,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AxisDashboardRoutePage
            accessToken="employee-token"
            bootstrap={bootstrap}
            runtime={runtime}
          />
        </MemoryRouter>
      </QueryClientProvider>
    </AxisThemeProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AxisDashboardRoutePage', () => {
  it('guides a first-time operator with live module, data, and approval signals', async () => {
    const fetchImplementation = vi.fn<typeof fetch>((input) => {
      const url = urlOf(input);
      if (url.includes('/runtime/modules/available')) {
        return Promise.resolve(
          response({ items: [moduleItem('nodics.discovery', 'AVAILABLE', false)] }),
        );
      }
      if (url.includes('/runtime/modules/registrations')) {
        return Promise.resolve(
          response({ items: [moduleItem('nodics.platform', 'REGISTERED', true)] }),
        );
      }
      if (url.endsWith('/v0/init'))
        return Promise.resolve(response([release('CURRENT', 'init')]));
      if (url.endsWith('/v0/core'))
        return Promise.resolve(response([release('NOT_INSTALLED', 'core')]));
      if (url.endsWith('/v0/sample')) {
        return Promise.resolve(response([release('NOT_INSTALLED', 'sample')]));
      }
      if (url.includes('/applications/agoraapparel/initialization')) {
        return Promise.resolve(
          response({
            profileCode: 'agoraapparel',
            type: 'PROJECT_ACCELERATOR',
            owner: 'agora.apparel',
            applicationCode: 'agora-apparel',
            siteCode: 'agora-apparel',
            readiness: 'PUBLICATION_PENDING',
            releaseCode: 'agoraapparel-v001',
            releaseVersion: '0.1.0',
            releaseStatus: 'CURRENT',
            allowedActions: ['INITIALIZE'],
            publication: {
              code: 'pub-1',
              state: 'PENDING_APPROVAL',
              revision: 1,
              workflowRef: 'wf-1',
            },
          }),
        );
      }
      if (url.includes('/applications/frameworkdocs/initialization')) {
        return Promise.resolve(
          response({
            profileCode: 'frameworkdocs',
            siteCode: 'nodics-docs',
            readiness: 'READY',
            releaseCode: 'nodicsDocumentation',
            releaseVersion: '0.16.7',
            releaseStatus: 'CURRENT',
            allowedActions: ['ROLLBACK'],
          }),
        );
      }
      return Promise.resolve(response({}));
    });
    vi.stubGlobal('fetch', fetchImplementation);

    renderPage();

    expect(
      await screen.findByText('Register and activate modules'),
    ).toBeInTheDocument();
    expect(screen.getByText('Install release data')).toBeInTheDocument();
    expect(screen.getByText('Approval queue needs review')).toBeInTheDocument();
    expect(screen.getByText('Application overview')).toBeInTheDocument();
    expect(screen.getByText('1 active modules')).toBeInTheDocument();
    expect(screen.getByText('1 releases current')).toBeInTheDocument();
    expect(screen.getByText('1 publication item needs action')).toBeInTheDocument();

    const moduleToggle = screen.getByRole('button', {
      name: 'Collapse Register and activate modules',
    });
    expect(moduleToggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(moduleToggle);
    expect(moduleToggle).toHaveAttribute('aria-expanded', 'false');

    const overviewResizer = screen.getByRole('separator', {
      name: 'Resize application overview panel',
    });
    expect(overviewResizer).toHaveAttribute('aria-valuenow', '380');
    overviewResizer.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(overviewResizer).toHaveAttribute('aria-valuenow', '404');

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Collapse application overview panel to right',
      }),
    );
    expect(
      screen.queryByText('Current operator scope and runtime surface.'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Show application overview panel' }),
    );
    expect(
      screen.getByText('Current operator scope and runtime surface.'),
    ).toBeInTheDocument();
  });

  it('keeps dashboard actions explicit when the environment is current', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = urlOf(input);
        if (url.includes('/runtime/modules/available'))
          return Promise.resolve(response({ items: [] }));
        if (url.includes('/runtime/modules/registrations')) {
          return Promise.resolve(
            response({ items: [moduleItem('nodics.platform', 'REGISTERED', true)] }),
          );
        }
        if (url.endsWith('/v0/init'))
          return Promise.resolve(response([release('CURRENT', 'init')]));
        if (url.endsWith('/v0/core'))
          return Promise.resolve(response([release('CURRENT', 'core')]));
        if (url.endsWith('/v0/sample')) return Promise.resolve(response([]));
        if (url.includes('/applications/')) {
          return Promise.resolve(
            response({
              profileCode: 'agoraapparel',
              siteCode: 'agora-apparel',
              readiness: 'READY',
              releaseCode: 'agoraapparel-v001',
              releaseVersion: '0.1.0',
              releaseStatus: 'CURRENT',
              allowedActions: ['ROLLBACK'],
            }),
          );
        }
        return Promise.resolve(response({}));
      }),
    );

    renderPage();

    expect(
      await screen.findByRole('button', {
        name: /Review Registry/u,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review Data/u })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Open Publishing/u }),
    ).toBeInTheDocument();
    expect(screen.getByText('Work areas')).toBeInTheDocument();
  });

  it('deduplicates the same release across runtime catalogue projections', async () => {
    const duplicateCoreRelease = {
      ...release('CURRENT', 'core'),
      destinationRole: undefined,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = urlOf(input);
        if (url.includes('/runtime/modules/available'))
          return Promise.resolve(response({ items: [] }));
        if (url.includes('/runtime/modules/registrations')) {
          return Promise.resolve(
            response({ items: [moduleItem('nodics.platform', 'REGISTERED', true)] }),
          );
        }
        if (url.endsWith('/v0/core'))
          return Promise.resolve(response([duplicateCoreRelease]));
        if (url.endsWith('/v0/init') || url.endsWith('/v0/sample'))
          return Promise.resolve(response([]));
        if (url.includes('/applications/')) {
          return Promise.resolve(
            response({
              profileCode: 'agoraapparel',
              siteCode: 'agora-apparel',
              readiness: 'READY',
              releaseCode: 'agoraapparel-v001',
              releaseVersion: '0.1.0',
              releaseStatus: 'CURRENT',
              allowedActions: ['ROLLBACK'],
            }),
          );
        }
        return Promise.resolve(response({}));
      }),
    );

    renderPage();

    expect(await screen.findByText('1 releases current')).toBeInTheDocument();
    expect(screen.getByText('Data current')).toBeInTheDocument();
  });
});
