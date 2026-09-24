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
      id: 'runtime-configuration',
      label: 'Runtime Configuration',
      route: '/administration/runtime-configuration',
      order: 5,
      moduleName: 'system',
      category: 'platform',
      icon: 'settings',
      availability: 'UP',
      backendWorkspace: {
        contractVersion: 1,
        renderer: 'axis.workspace.native',
        workspaceCode: 'system.runtimeConfiguration',
        viewCode: 'runtimeConfiguration.overview',
        title: 'Runtime Configuration',
        description: 'Review module-owned runtime configuration schemas.',
        tabs: [],
      },
    },
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
      workbenchTarget: {
        moduleName: 'product',
        schemaName: 'product',
        searchRoute: '/commerce/catalog/products/search',
      },
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
    {
      id: 'discovery-management',
      label: 'Discovery',
      route: '/discovery',
      order: 35,
      moduleName: 'discoveryConfig',
      category: 'search',
      icon: 'search',
      availability: 'UP',
    },
    {
      id: 'documentation-dashboard',
      label: 'Documentation',
      route: '/docs',
      order: 40,
      moduleName: 'nodics.docs',
      category: 'documentation',
      icon: 'content',
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
  startupValidation: {
    state: 'READY',
    checkedAt: '2026-09-23T00:00:00.000Z',
    source: 'backoffice.operationalReadiness',
    summary: { total: 0, errors: 0, warnings: 0, info: 0, dismissible: 0, acknowledged: 0 },
    bootstrapChecks: {
      total: 3,
      ready: 3,
      missing: 0,
      needsAttention: 0,
      checks: [
        {
          code: 'BOOTSTRAP_ADMIN_PASSWORD_PRESENT',
          state: 'READY',
          owner: 'nAuth',
          ownerType: 'AUTHENTICATION',
          propertyPath: 'bootstrapIdentity.adminPassword',
          message: 'Bootstrap administrator password path is resolved.',
          action:
            'Repair the profile init data or owning private configuration before Axis login.',
          auditRequired: false,
        },
      ],
    },
    findings: [],
  },
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
      screen.getAllByRole('button', { name: /Open Publishing/u })[0],
    ).toBeInTheDocument();
    expect(screen.getByText('Runtime communication is healthy')).toBeInTheDocument();
    expect(
      screen.getByText('Search and configuration controls are visible'),
    ).toBeInTheDocument();
    expect(screen.getByText('Docs and app publishing parity is clear')).toBeInTheDocument();
    expect(screen.getByText('Work areas')).toBeInTheDocument();
  });

  it('surfaces backend-owned startup configuration warnings', async () => {
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
        if (url.endsWith('/v0/init') || url.endsWith('/v0/core')) {
          return Promise.resolve(response([release('CURRENT', 'core')]));
        }
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
    const warnedBootstrap: AxisAuthenticatedBootstrap = {
      ...bootstrap,
      startupValidation: {
        state: 'NEEDS_ATTENTION',
        checkedAt: '2026-09-23T00:00:00.000Z',
        source: 'backoffice.operationalReadiness',
        summary: { total: 1, errors: 0, warnings: 1, info: 0, dismissible: 1, acknowledged: 0 },
        bootstrapChecks: {
          total: 3,
          ready: 2,
          missing: 1,
          needsAttention: 0,
          checks: [
            {
              code: 'BOOTSTRAP_ADMIN_PASSWORD_PRESENT',
              state: 'MISSING',
              owner: 'nAuth',
              ownerType: 'AUTHENTICATION',
              propertyPath: 'bootstrapIdentity.adminPassword',
              message: 'Bootstrap administrator password path is missing.',
              action:
                'Repair the profile init data or owning private configuration before Axis login.',
              auditRequired: true,
            },
          ],
        },
        findings: [
          {
            code: 'LOCAL_SAMPLE_ADMIN_PASSWORD',
            severity: 'WARNING',
            owner: 'nAuth',
            ownerType: 'AUTHENTICATION',
            propertyPath: 'bootstrapIdentity.adminPassword',
            message: 'A local or sample bootstrap admin password is active.',
            action:
              'Rotate the bootstrap admin password through the owning configuration layer.',
            dismissible: true,
            auditRequired: true,
          },
        ],
      },
    };
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <AxisThemeProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AxisDashboardRoutePage
              accessToken="employee-token"
              bootstrap={warnedBootstrap}
              runtime={runtime}
            />
          </MemoryRouter>
        </QueryClientProvider>
      </AxisThemeProvider>,
    );

    expect(await screen.findByText('Review startup configuration')).toBeInTheDocument();
    expect(
      screen.getByText('nAuth: Bootstrap administrator password path is missing.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Bootstrap prerequisites')).toBeInTheDocument();
    expect(screen.getByText('1 missing')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Open Runtime Configuration/u }),
    ).toBeInTheDocument();
  });

  it('surfaces backend-owned acceptance and browser-validation evidence', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>((input) => {
        const url = urlOf(input);
        if (url.includes('/runtime/modules/available')) {
          return Promise.resolve(response({ items: [] }));
        }
        if (url.includes('/runtime/modules/registrations')) {
          return Promise.resolve(
            response({ items: [moduleItem('nodics.platform', 'REGISTERED', true)] }),
          );
        }
        if (url.endsWith('/v0/init') || url.endsWith('/v0/core')) {
          return Promise.resolve(response([release('CURRENT', 'core')]));
        }
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
    const acceptanceBootstrap: AxisAuthenticatedBootstrap = {
      ...bootstrap,
      operationalReadiness: {
        contractVersion: 1,
        state: 'NEEDS_ATTENTION',
        checkedAt: '2026-09-24T00:00:00.000Z',
        source: 'backoffice.operationalReadiness',
        summary: {
          total: 1,
          blockers: 1,
          NEEDS_ATTENTION: 1,
          recoveryMatrix: [
            {
              key: 'imports',
              label: 'Import data',
              description:
                'Install and repair business data releases from owner catalogues.',
              state: 'READY',
              ownerModule: 'import',
              source: 'IMPORT_RELEASE_CATALOGUE',
              route: '/operations/imports-exports',
              blockerCount: 0,
              issueCodes: [],
              nextAction: 'Data releases are prepared in the owning import catalogues.',
            },
            {
              key: 'approval',
              label: 'Complete approvals',
              description:
                'Resolve governed Process approval tasks before Online publication.',
              state: 'NEEDS_ATTENTION',
              ownerModule: 'workflow',
              source: 'PUBLICATION_APPROVAL',
              route: '/process/approval-queue',
              blockerCount: 1,
              issueCodes: ['TASK_NOT_ACTIONABLE'],
              nextAction:
                'Open Approval Queue and reconcile governed publication approval tasks.',
            },
          ],
          timeline: [
            {
              id: '2026-09-24T00:00:00.000Z:NEEDS_ATTENTION',
              eventType: 'backoffice.operationalReadiness.snapshot',
              label: 'Operational readiness',
              state: 'NEEDS_ATTENTION',
              checkedAt: '2026-09-24T00:00:00.000Z',
              blockerCount: 1,
              source: 'backoffice.operationalReadiness.snapshot',
            },
          ],
        },
        sections: [
          {
            key: 'acceptance',
            title: 'Acceptance and browser validation',
            businessStatus: 'NEEDS_ATTENTION',
            ownerModule: 'tooling',
            source: 'NTOOLING_ACCEPTANCE_READINESS',
            route: '/dashboard',
            summary: {
              browserValidationEnabled: true,
              browserValidationState: 'FAILED',
              browserValidationCheckedAt: '2026-09-24T00:06:00.000Z',
              browserValidationRunId: 'provider-browser-smoke-failed',
              browserValidationFailedStep: 'circaMiniApp',
              browserValidationSource: 'NTOOLING_ACCEPTANCE_EVIDENCE',
              browserValidationEvidenceFile:
                'envs/kickoffLocal/generated/acceptance/browser-validation-evidence.json',
              browserValidationCommand: 'npm run docker-local:acceptance',
              operatorCommands: [
                'npm run docker-local:acceptance',
                'npm run project:post-reset-readiness -- --live --json',
                'Refresh Axis dashboard bootstrap',
              ],
              onlineProfileCount: 1,
              pendingProfileCount: 0,
              blockerCount: 1,
            },
            blockers: [
              {
                blockerCode: 'BROWSER_VALIDATION_EVIDENCE_REQUIRED',
                code: 'BROWSER_VALIDATION_EVIDENCE_REQUIRED',
                severity: 'NEEDS_ATTENTION',
                ownerType: 'ACCEPTANCE',
                source: 'NTOOLING_BROWSER_VALIDATION',
                action: 'Run local browser validation',
                message:
                  'Browser validation is enabled for this environment but the latest captured evidence is not attached to readiness.',
                disabledReason:
                  'Browser validation is enabled for this environment but the latest captured evidence is not attached to readiness.',
                repair: {
                  available: false,
                  operation: 'tooling.acceptance.browserValidation',
                  action: 'CAPTURE_BROWSER_VALIDATION',
                  eligibility: 'NOT_AVAILABLE',
                  label: 'Run local browser validation',
                },
                suggestedAction:
                  'Run the local acceptance/browser smoke and refresh Axis after evidence is captured.',
              },
            ],
            nextAction:
              'Complete application parity and capture configured local browser-validation evidence.',
          },
        ],
      },
    };
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <AxisThemeProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AxisDashboardRoutePage
              accessToken="employee-token"
              bootstrap={acceptanceBootstrap}
              runtime={runtime}
            />
          </MemoryRouter>
        </QueryClientProvider>
      </AxisThemeProvider>,
    );

    expect(await screen.findByText('Go-live recovery')).toBeInTheDocument();
    expect(screen.getByText('Import data')).toBeInTheDocument();
    expect(screen.getByText('Complete approvals')).toBeInTheDocument();
    expect(screen.getByText('TASK_NOT_ACTIONABLE')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Open Approval Queue and reconcile governed publication approval tasks.',
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText('Fix these first')).toBeInTheDocument();
    expect(
      screen.getByText('Acceptance and browser validation'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Run the local acceptance/browser smoke and refresh Axis after evidence is captured.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Browser validation is enabled for this environment but the latest captured evidence is not attached to readiness.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Evidence state')).toBeInTheDocument();
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.getByText('provider-browser-smoke-failed')).toBeInTheDocument();
    expect(screen.getByText('circaMiniApp')).toBeInTheDocument();
    expect(
      screen.getByText('NTOOLING_ACCEPTANCE_EVIDENCE'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'npm run docker-local:acceptance -> npm run project:post-reset-readiness -- --live --json -> Refresh Axis dashboard bootstrap',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Readiness timeline')).toBeInTheDocument();
    expect(screen.getAllByText('1 blockers').length).toBeGreaterThan(0);
    expect(
      screen.getByText('backoffice.operationalReadiness.snapshot'),
    ).toBeInTheDocument();
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
