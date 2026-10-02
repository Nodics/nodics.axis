import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { parseBackendWorkspace } from '../../../src/bootstrap/publicBootstrap';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import type { AxisAuthenticatedBootstrap } from '../../../src/bootstrap/publicBootstrap';
import { SetupAcceleratorsRoutePage } from '../../../src/operations/setupAccelerators/SetupAcceleratorsRoutePage';
import type { AxisRuntimeConfig } from '../../../src/runtime/runtimeConfig';
import * as processClient from '../../../src/operations/processWorkflow/api/processDefinitionClient';

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

const baseProfile = {
  kind: 'PROJECT',
  category: 'project',
  order: 10,
  type: 'accelerator',
  owner: 'kickoff',
  applicationCode: 'circa.ewaste',
  siteCode: 'online',
  baselineCode: 'circa:ewaste',
  requiredServers: ['wcmsStagedServer'],
  requiredFunctionalModules: [],
  dataPackages: [],
  activationPolicy: {
    approvalRequiredForOnline: true,
    requiredDataTrigger: 'ACTIVATION',
    sampleDataTrigger: 'USER',
  },
};

const bootstrap = {
  axisPolicy: {
    contractVersion: 0,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 1,
    source: 'DEFAULT',
  },
  environments: ['kickoffLocal'],
  moduleCatalog: {},
  moduleConnections: {
    backoffice: [
      {
        moduleName: 'backoffice',
        instanceId: 'kickoffLocal:platformServer:backoffice:0',
        endpoint: 'http://localhost:4310/nodics/backoffice',
        environment: 'kickoffLocal',
        server: 'platformServer',
        state: 'UP',
      },
    ],
  },
  navigation: [],
  documentationSources: [],
  tenantCode: 'default',
  applicationInitializationProfiles: [
    {
      ...baseProfile,
      code: 'circa-ewaste',
      title: 'Circa eWaste',
      summary: 'Circa published customer pages and media over the eWaste accelerator.',
      order: 10,
    },
    {
      ...baseProfile,
      code: 'agora-apparel',
      title: 'Agora Apparel',
      summary:
        'Apparel storefront accelerator as a complete business-facing domain bundle.',
      applicationCode: 'agora.apparel',
      baselineCode: 'agora:apparel',
      order: 20,
    },
  ],
} as unknown as AxisAuthenticatedBootstrap;

function responseFor(profileCode: string) {
  if (profileCode === 'agora-apparel') {
    return {
      result: {
        profileCode,
        type: 'accelerator',
        owner: 'kickoff',
        applicationCode: 'agora.apparel',
        siteCode: 'online',
        readiness: 'FAILED',
        releaseCode: 'agora:apparel',
        releaseVersion: '0.0.7',
        releaseStatus: 'INVALID_RELEASE',
        allowedActions: [],
        capability: {
          capabilityCode: 'agora.apparel',
          displayName: 'Agora Apparel',
          owningModule: 'agora.apparel',
          capabilityType: 'PUBLICATION_PROFILE',
          group: 'PROJECT_ACCELERATOR',
          businessStatus: 'NEEDS_ATTENTION',
          technicalStatus: 'INVALID_RELEASE',
          disabledReason: 'Release manifest is invalid; repair it before installing.',
          nextAction: 'Repair the owning module release descriptor.',
          blockers: [
            {
              code: 'INVALID_RELEASE',
              severity: 'ERROR',
              owner: 'agora.apparel',
              source: 'nImport',
              message: 'Release manifest is invalid; repair it before installing.',
              action: 'Repair source release descriptor',
            },
          ],
        },
      },
    };
  }
  return {
    result: {
      profileCode,
      type: 'accelerator',
      owner: 'kickoff',
      applicationCode: 'circa.ewaste',
      siteCode: 'online',
      readiness: 'PUBLICATION_PENDING',
      releaseCode: 'circa:ewaste',
      releaseVersion: '1.0.0',
      releaseStatus: 'CURRENT',
      allowedActions: [],
      publication: {
        code: 'circaPublication',
        state: 'PENDING_APPROVAL',
        revision: 1,
        workflowRef: 'cmsPublicationApproval-circa-ewaste',
      },
      capability: {
        capabilityCode: 'circa.ewaste',
        displayName: 'Circa eWaste',
        owningModule: 'circa.ewaste',
        capabilityType: 'PUBLICATION_PROFILE',
        group: 'PROJECT_ACCELERATOR',
        businessStatus: 'APPROVAL_IN_PROGRESS',
        technicalStatus: 'PENDING_APPROVAL',
        nextAction: 'Review the governed Process approval task.',
        approvalDiagnostic: {
          status: 'NO_ACTIONABLE_TASK',
          workflowRef: 'cmsPublicationApproval-circa-ewaste',
          message:
            'Publication approval is pending but no actionable Process task was found.',
          suggestedAction: 'Open Process tasks and verify assignee permissions.',
        },
        blockers: [],
      },
    },
  };
}

function RouteEvidence() {
  const location = useLocation();
  return (
    <output aria-label="Observed route">
      {location.pathname}
      {location.search}
    </output>
  );
}

function renderPage(path = '/setup-accelerators', selectedBootstrap = bootstrap) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <RouteEvidence />
          <SetupAcceleratorsRoutePage
            accessToken="employee-token"
            bootstrap={selectedBootstrap}
            runtime={runtime}
          />
        </MemoryRouter>
      </QueryClientProvider>
    </AxisThemeProvider>,
  );
}

describe('SetupAcceleratorsRoutePage', () => {
  it.each(['admitted', 'missing', 'disabled', 'conflicting-target', 'ambiguous'])(
    'reviews held prerequisites only through authorized owner import navigation (%s)',
    async (admission) => {
      const result = responseFor('circa-ewaste').result;
      const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            result: {
              ...result,
              readiness: 'BLOCKED',
              publication: undefined,
              preparation: { status: 'BLOCKED', steps: [] },
              capability: {
                ...result.capability,
                businessStatus: 'NEEDS_ATTENTION',
                blockers: [
                  {
                    code: 'READINESS_VALIDATION_BLOCKED',
                    owner: 'circa.ewaste:profile',
                    ownerType: 'DATA_RELEASE',
                    severity: 'REPAIR_REQUIRED',
                    message:
                      'Review individual releases in the owning import workspace.',
                    action: 'Review setup prerequisites',
                    targetServer: 'platformServer',
                    targetRuntimeRole: 'PLATFORM',
                    repair: {
                      available: false,
                      label: 'Review setup prerequisites',
                      action: 'REVIEW_SETUP_PREREQUISITES',
                      requiresConfirmation: false,
                      idempotent: true,
                      targetServer:
                        admission === 'conflicting-target'
                          ? 'otherServer'
                          : 'platformServer',
                      targetRuntimeRole: 'PLATFORM',
                    },
                  },
                ],
              },
            },
          }),
          { status: 200 },
        ),
      );
      const navigation = {
        id: 'imports-exports',
        moduleName: 'backoffice',
        label: 'Imports',
        route: '/custom/owner-imports',
        order: 1,
        category: 'operations',
        icon: 'import',
        availability: 'UP' as const,
        featureState:
          admission === 'disabled' ? ('DISABLED' as const) : ('ACTIVE' as const),
      };
      const connection = {
        moduleName: 'import',
        instanceId: 'approved-platform-import',
        endpoint: 'http://localhost:4310/nodics/import',
        server: 'platformServer',
        environment: 'kickoffLocal',
        state: 'UP' as const,
        runtimeRole: { code: 'PLATFORM', publication: 'NONE' },
      };
      renderPage('/setup-accelerators?profile=circa-ewaste', {
        ...bootstrap,
        applicationInitializationProfiles:
          bootstrap.applicationInitializationProfiles?.slice(0, 1),
        navigation: admission === 'missing' ? [] : [navigation],
        moduleConnections: {
          ...bootstrap.moduleConnections,
          import:
            admission === 'ambiguous'
              ? [connection, { ...connection, instanceId: 'second-platform-import' }]
              : [connection],
        },
      });
      const buttons = await screen.findAllByRole('button', {
        name: 'Review setup prerequisites',
      });
      expect(
        screen.queryByRole('button', { name: 'Open Module Registry' }),
      ).not.toBeInTheDocument();
      if (admission === 'admitted') {
        expect(buttons[0]).toBeEnabled();
        await userEvent.setup().click(buttons[0]!);
        expect(screen.getByLabelText('Observed route')).toHaveTextContent(
          '/custom/owner-imports?area=history&importInstance=approved-platform-import',
        );
      } else buttons.forEach((button) => expect(button).toBeDisabled());
      expect(fetcher.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(
        true,
      );
    },
  );

  it.each([true, false])(
    'opens only an admitted owner Media inspection without publication writes (%s)',
    async (authorized) => {
      const workspace = parseBackendWorkspace({
        contractVersion: 1,
        renderer: 'axis.workspace.backend-operations',
        title: 'Media Publication',
        ownerSelector: { runtimeRoleCode: 'WCMS_STAGED', publicationRole: 'STAGED' },
        tabs: [
          {
            id: 'request',
            label: 'Request',
            sections: [
              {
                id: 'request',
                type: 'form',
                title: 'Request',
                endpoint: {
                  method: 'POST',
                  path: '/nodics/media/v0/library/publications',
                },
                readSource: {
                  parameter: 'mediaCode',
                  fields: { mediaCode: 'code', versionId: 'versionId' },
                  commandId: 'requestPublication',
                  unavailableMessage: 'Inspection unavailable',
                  endpoint: {
                    method: 'GET',
                    path: '/nodics/media/v0/library/{mediaCode}',
                  },
                },
                fields: [
                  {
                    name: 'mediaCode',
                    label: 'Media code',
                    type: 'TEXT',
                    required: true,
                  },
                  { name: 'versionId', label: 'Version', type: 'TEXT', required: true },
                ],
              },
            ],
          },
        ],
      });
      const handoff = {
        owner: 'media',
        route: '/media/publication',
        label: 'Inspect Media source',
        available: true,
        query: { mediaCode: 'nexusHero' },
        backendWorkspace: workspace,
        automaticExecution: false,
        requiresOwnerInspection: true,
      };
      const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                profileCode: 'circa-ewaste',
                type: 'CMS_SITE',
                owner: 'cms',
                applicationCode: 'circa.ewaste',
                siteCode: 'online',
                readiness: 'MEDIA_DEPENDENCIES_PENDING',
                releaseCode: 'cms:circa',
                releaseVersion: '1.0.0',
                allowedActions: [],
                capability: {
                  capabilityCode: 'circa',
                  displayName: 'Circa',
                  owningModule: 'circa',
                  capabilityType: 'ACCELERATOR',
                  group: 'PROJECT',
                  businessStatus: 'NEEDS_ATTENTION',
                  technicalStatus: 'BLOCKED',
                  nextAction: 'Inspect Media',
                  blockers: [
                    {
                      owner: 'nexusHero',
                      ownerType: 'MEDIA',
                      source: 'MEDIA_PUBLICATION',
                      code: 'MEDIA_DEPENDENCY_NOT_ACTIVATED',
                      severity: 'REPAIR_REQUIRED',
                      message: 'Media needs separate approval',
                      action: 'Review Media publication',
                      mediaDependency: {
                        owner: 'media',
                        mediaCode: 'nexusHero',
                        versionId: 4,
                        status: 'NOT_ACTIVATED',
                        qualified: false,
                        handoff,
                      },
                      repair: {
                        available: true,
                        action: 'REVIEW_MEDIA_PUBLICATION',
                        operation: 'media.createRetainedPublication',
                        label: 'Inspect Media source',
                        requiresConfirmation: true,
                        route: handoff.route,
                        handoff,
                      },
                    },
                  ],
                },
              },
            }),
            { status: 200 },
          ),
        ),
      );
      renderPage('/setup-accelerators?profile=circa-ewaste&expanded=circa-ewaste', {
        ...bootstrap,
        navigation: authorized
          ? ([
              {
                id: 'media-publication-requests',
                moduleName: 'media',
                route: handoff.route,
                label: 'Inspect Media source',
                order: 1,
                category: 'media',
                icon: 'media',
                availability: 'UP',
                featureState: 'ACTIVE',
                backendWorkspace: workspace,
              },
            ] as AxisAuthenticatedBootstrap['navigation'])
          : [],
        moduleConnections: {
          ...bootstrap.moduleConnections,
          media: [
            {
              moduleName: 'media',
              instanceId: 'staged-media',
              endpoint: 'http://localhost:4312/nodics/media',
              environment: 'kickoffLocal',
              state: 'UP',
              runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
            },
          ],
        },
      });
      const inspection = await screen.findByRole('button', {
        name: 'Inspect Media source',
      });
      expect(screen.getByText('nexusHero')).toBeVisible();
      expect(screen.queryByRole('link', { name: 'Open Publishing' })).toBeNull();
      if (authorized) {
        expect(inspection).toBeEnabled();
        await userEvent.setup().click(inspection);
        expect(screen.getByLabelText('Observed route')).toHaveTextContent(
          '/media/publication?mediaCode=nexusHero',
        );
      } else expect(inspection).toBeDisabled();
      expect(
        fetcher.mock.calls.every(([, options]) => options?.method !== 'POST'),
      ).toBe(true);
    },
  );
  it('retains exact Platform operation failure handoff after status GET omits the transient receipt', async () => {
    let attempted = false;
    const failure = {
      owner: 'import',
      targetServer: 'platformServer',
      targetRuntimeRole: 'PLATFORM',
      dataType: 'sample',
      releaseCodes: ['wasteCollectionaddresses', 'circprofile', 'circops'],
      failureCode: 'ERR_IMP00010',
      message: 'Review the owning import receipt.',
      automaticRetry: false,
    };
    const baseline = responseFor('circa-ewaste').result;
    const historyStatus = {
      ...baseline,
      capability: {
        ...baseline.capability,
        blockers: [
          {
            code: 'IMPORT_FAILED',
            owner: 'circprofile',
            ownerType: 'DATA_RELEASE',
            severity: 'BLOCKED',
            message: failure.message,
            action: 'Review import history',
            targetServer: failure.targetServer,
            targetRuntimeRole: failure.targetRuntimeRole,
            repair: {
              available: true,
              label: 'Review import history',
              action: 'REVIEW_IMPORT_HISTORY',
              targetServer: failure.targetServer,
              targetRuntimeRole: failure.targetRuntimeRole,
              requiresConfirmation: false,
              route:
                '/operations/imports-exports?area=history&importInstance=kickoff-local-platform-1',
              handoff: {
                contractVersion: 1,
                owner: 'import',
                action: 'REVIEW_IMPORT_HISTORY',
                available: true,
                readOnly: true,
                automaticExecution: false,
                route:
                  '/operations/imports-exports?area=history&importInstance=kickoff-local-platform-1',
                importInstance: 'kickoff-local-platform-1',
                targetServer: failure.targetServer,
                targetRuntimeRole: failure.targetRuntimeRole,
              },
            },
          },
        ],
      },
    };
    const initial = {
      ...baseline,
      readiness: 'IMPORTED',
      allowedActions: [],
      publication: undefined,
      capability: {
        ...baseline.capability,
        businessStatus: 'NEEDS_ATTENTION',
        blockers: [
          {
            code: 'DATA_MISSING',
            owner: 'import',
            severity: 'REPAIR_REQUIRED',
            message: 'Prepare declared data.',
            action: 'Prepare data',
            repair: {
              available: true,
              label: 'Prepare setup',
              operation: 'applicationInitialization.prepareCapability',
              action: 'PREPARE_DATA',
              requiresConfirmation: false,
            },
          },
        ],
      },
    };
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_input, options) => {
        await Promise.resolve();
        if (options?.method === 'POST') {
          attempted = true;
          return new Response(
            JSON.stringify({
              data: {
                ...initial,
                readiness: 'BLOCKED',
                preparation: {
                  status: 'BLOCKED',
                  steps: [],
                  operationFailure: failure,
                },
              },
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({ data: attempted ? historyStatus : initial }),
          {
            status: 200,
          },
        );
      });
    renderPage('/setup-accelerators?profile=circa-ewaste', {
      ...bootstrap,
      navigation: [
        {
          id: 'imports-exports',
          label: 'Imports',
          order: 1,
          category: 'operations',
          icon: 'history',
          moduleName: 'backoffice',
          route: '/operations/imports-exports',
          availability: 'UP',
          featureState: 'ACTIVE',
        },
      ],
      moduleConnections: {
        ...bootstrap.moduleConnections,
        import: [
          {
            moduleName: 'import',
            instanceId: 'kickoff-local-platform-1',
            endpoint: 'https://platform.example/nodics/import',
            environment: 'local',
            server: 'platformServer',
            runtimeRole: { code: 'PLATFORM', publication: 'OPERATIONAL' },
            state: 'UP',
          },
        ],
      },
    });
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Prepare setup' }));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.filter(([, options]) => options?.method !== 'POST').length,
      ).toBeGreaterThan(1),
    );
    expect(await screen.findByText('Circa eWaste: import needs review')).toBeVisible();
    const review = screen.getAllByRole('button', { name: 'Review import history' });
    expect(review.every((button) => !button.hasAttribute('disabled'))).toBe(true);
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === 'POST'),
    ).toHaveLength(1);
    await userEvent.setup().click(review[0]!);
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === 'POST'),
    ).toHaveLength(1);
  });
  it('prioritizes read-only import history and labels historical receipt evidence without retry', async () => {
    const receipt = {
      releaseCode: 'commerce:sample',
      status: 'FAILED',
      version: '1.0.0',
      lastRunId: 'historical-run',
    };
    const failure = {
      owner: 'import',
      targetServer: 'customStaged',
      targetRuntimeRole: 'CUSTOM_STAGED',
      dataType: 'sample',
      releaseCodes: ['commerce:sample'],
      failureCode: 'ERR_IMP_00004',
      message: 'Review the owning import receipt.',
      automaticRetry: false,
    };
    const result = {
      ...responseFor('circa-ewaste').result,
      readiness: 'BLOCKED',
      allowedActions: [],
      preparation: {
        status: 'BLOCKED',
        steps: [],
        operationFailure: failure,
        groupReceipts: [{ ...failure, status: 'FAILED', releases: [receipt] }],
      },
      capability: {
        ...responseFor('circa-ewaste').result.capability,
        businessStatus: 'NEEDS_ATTENTION',
        blockers: [
          {
            code: 'IMPORT_FAILED',
            owner: 'import',
            severity: 'REPAIR_REQUIRED',
            message: failure.message,
            action: 'Review import history',
            targetServer: failure.targetServer,
            targetRuntimeRole: failure.targetRuntimeRole,
            releaseReceipt: receipt,
            repair: {
              available: false,
              label: 'Review import history',
              action: 'REVIEW_IMPORT_HISTORY',
              requiresConfirmation: false,
            },
          },
        ],
      },
    };
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ result }), { status: 200 }));
    renderPage('/setup-accelerators?profile=circa-ewaste&expanded=circa-ewaste', {
      ...bootstrap,
      navigation: [
        {
          id: 'imports-exports',
          label: 'Import and export',
          order: 1,
          category: 'operations',
          icon: 'history',
          moduleName: 'backoffice',
          route: '/operations/imports-exports',
          availability: 'UP',
          featureState: 'ACTIVE',
        },
      ] as AxisAuthenticatedBootstrap['navigation'],
      moduleConnections: {
        ...bootstrap.moduleConnections,
        import: [
          {
            moduleName: 'import',
            instanceId: 'custom-staged',
            endpoint: 'https://staged.example/nodics/import',
            environment: 'local',
            server: 'customStaged',
            runtimeRole: { code: 'CUSTOM_STAGED', publication: 'STAGED' },
            state: 'UP',
          },
        ],
      },
    });
    const buttons = await screen.findAllByRole('button', {
      name: 'Review import history',
    });
    expect(buttons.every((button) => button.hasAttribute('disabled'))).toBe(true);
    expect(
      screen.queryByRole('link', { name: 'Open Process' }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText(
        /Historical run reference: historical-run \(not proof of this attempt\)/,
      ),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Module Registry' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Initialize' })).toBeNull();
    expect(fetcher.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
      false,
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each(['READINESS_UNAVAILABLE', 'READINESS_UNKNOWN'])(
    'binds available %s refresh to explicit GET only, not another owner or preparation',
    async (code) => {
      const baseline = responseFor('circa-ewaste').result;
      const result = {
        ...baseline,
        readiness: 'BLOCKED',
        allowedActions: [],
        capability: {
          ...baseline.capability,
          businessStatus: 'NEEDS_ATTENTION',
          blockers: [
            {
              code,
              owner: 'nexus.web:content',
              ownerType: 'DATA_RELEASE',
              source: 'IMPORT_PREFLIGHT',
              severity: 'BLOCKED',
              message: 'Readiness must be read again.',
              action: 'Refresh readiness',
              repair: {
                available: true,
                label: 'Read readiness again',
                operation: 'applicationInitialization.status',
                action: 'REFRESH_READINESS',
                idempotent: true,
                requiresConfirmation: false,
                unavailableReason: 'Process workflow unrelated to this read',
              },
            },
          ],
        },
      };
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(() =>
          Promise.resolve(
            new Response(JSON.stringify({ data: result }), { status: 200 }),
          ),
        );
      renderPage('/setup-accelerators?profile=circa-ewaste&expanded=circa-ewaste');
      const buttons = await screen.findAllByRole('button', {
        name: 'Read readiness again',
      });
      const before = fetcher.mock.calls.length;
      await userEvent.setup().click(buttons[0]!);
      await waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThan(before));
      expect(fetcher.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(
        true,
      );
      expect(
        screen.queryByRole('link', { name: 'Open Process' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Review import history' }),
      ).not.toBeInTheDocument();
    },
  );

  it.each(['IMPORTED', 'PUBLICATION_PENDING'])(
    'does not repeatedly poll stable %s or human-waiting state',
    async (readiness) => {
      vi.useFakeTimers();
      const result = { ...responseFor('circa-ewaste').result, readiness };
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(() =>
          Promise.resolve(
            new Response(JSON.stringify({ data: result }), { status: 200 }),
          ),
        );
      await act(async () => {
        renderPage('/setup-accelerators?profile=circa-ewaste');
        await vi.advanceTimersByTimeAsync(100);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000);
      });
      expect(fetcher).toHaveBeenCalledOnce();
      expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET');
    },
  );

  it('cools down typed HTTP throttles without automatically replaying a read or write from an unknown state', async () => {
    vi.useFakeTimers();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: 'Read throttled' }), {
          status: 429,
          headers: { 'Retry-After': '30' },
        }),
      ),
    );
    await act(async () => {
      renderPage('/setup-accelerators?profile=circa-ewaste');
      await vi.advanceTimersByTimeAsync(100);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(
      screen.getByRole('button', { name: 'Refresh Circa eWaste status' }),
    ).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    const refresh = screen.getByRole('button', { name: 'Refresh Circa eWaste status' });
    expect(refresh).toBeEnabled();
    expect(fetcher).toHaveBeenCalledOnce();
    await act(async () => {
      fireEvent.click(refresh);
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(
      true,
    );
  });

  it('honors the owner-projected rate-limit cooldown before an explicit available GET action', async () => {
    vi.useFakeTimers();
    const baseline = responseFor('circa-ewaste').result;
    const result = {
      ...baseline,
      readiness: 'BLOCKED',
      allowedActions: [],
      capability: {
        ...baseline.capability,
        businessStatus: 'NEEDS_ATTENTION',
        blockers: [
          {
            code: 'READINESS_RATE_LIMITED',
            owner: 'release',
            severity: 'BLOCKED',
            message: 'Wait',
            action: 'Wait and refresh',
            repair: {
              available: true,
              label: 'Owner refresh after wait',
              action: 'REFRESH_READINESS',
              operation: 'applicationInitialization.status',
              idempotent: true,
              requiresConfirmation: false,
            },
          },
        ],
      },
    };
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: result }), { status: 200 }),
        ),
      );
    await act(async () => {
      renderPage('/setup-accelerators?profile=circa-ewaste');
      await vi.advanceTimersByTimeAsync(100);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(
      screen.getByRole('button', { name: 'Owner refresh after wait' }),
    ).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    const refresh = screen.getByRole('button', { name: 'Owner refresh after wait' });
    expect(refresh).toBeEnabled();
    expect(fetcher).toHaveBeenCalledOnce();
    await act(async () => {
      fireEvent.click(refresh);
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(
      true,
    );
  });

  it('backs off actual importing work and stops observation after the bounded window', async () => {
    vi.useFakeTimers();
    const result = {
      ...responseFor('circa-ewaste').result,
      readiness: 'IMPORTING',
      capability: undefined,
    };
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: result }), { status: 200 }),
        ),
      );
    await act(async () => {
      renderPage('/setup-accelerators?profile=circa-ewaste');
      await vi.advanceTimersByTimeAsync(100);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300_000);
    });
    const calls = fetcher.mock.calls.length;
    expect(calls).toBeGreaterThan(1);
    expect(calls).toBeLessThanOrEqual(16);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(calls);
    expect(fetcher.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(
      true,
    );
  });

  it('does not execute an unavailable readiness descriptor', async () => {
    const baseline = responseFor('circa-ewaste').result;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              ...baseline,
              capability: {
                ...baseline.capability,
                blockers: [
                  {
                    code: 'READINESS_UNKNOWN',
                    owner: 'release',
                    severity: 'BLOCKED',
                    message: 'Unavailable read',
                    action: 'Refresh readiness',
                    repair: {
                      available: false,
                      label: 'Unavailable owner read',
                      operation: 'applicationInitialization.status',
                      action: 'REFRESH_READINESS',
                      requiresConfirmation: false,
                    },
                  },
                ],
              },
            },
          }),
          { status: 200 },
        ),
      ),
    );
    renderPage('/setup-accelerators?profile=circa-ewaste&expanded=circa-ewaste');
    expect(await screen.findByText('Unavailable read')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Unavailable owner read' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Open Process' }),
    ).not.toBeInTheDocument();
  });

  it.each(['ERROR', 'BLOCKED', 'REPAIR_REQUIRED'])(
    'does not display Online ready for an authoritative %s blocker',
    async (severity) => {
      const result = responseFor('circa-ewaste').result;
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            result: {
              ...result,
              readiness: 'READY',
              capability: {
                ...result.capability,
                businessStatus: 'ONLINE',
                blockers: [
                  {
                    code: 'MEDIA_ACTIVATION_UNKNOWN',
                    severity,
                    owner: 'media',
                    source: 'media',
                    message: 'Required Media activation evidence is unavailable.',
                    action: 'Inspect governed Media publication',
                  },
                ],
              },
            },
          }),
          { status: 200 },
        ),
      );
      renderPage('/setup-accelerators?profile=circa-ewaste');
      expect(await screen.findByText('Needs attention')).toBeVisible();
      expect(screen.queryByText('Online ready')).toBeNull();
    },
  );

  it('does not run a hidden repair or initialization when approval has no actionable Process task', async () => {
    const user = userEvent.setup();
    const tasks = vi.spyOn(processClient, 'loadProcessTasks').mockResolvedValue([]);
    const complete = vi.spyOn(processClient, 'completeProcessTask');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(responseFor('circa-ewaste')), { status: 200 }),
        ),
      );
    renderPage('/setup-accelerators?profile=circa-ewaste', {
      ...bootstrap,
      moduleConnections: {
        ...bootstrap.moduleConnections,
        workflow: [
          {
            moduleName: 'workflow',
            instanceId: 'process',
            endpoint: 'http://localhost:4311/nodics/workflow',
            environment: 'kickoffLocal',
            server: 'processServer',
            state: 'UP',
          },
        ],
      },
    });
    const approve = await screen.findByRole('button', { name: 'Approve' });
    await waitFor(() => expect(approve).toBeEnabled());
    await user.click(approve);
    await waitFor(() => expect(tasks).toHaveBeenCalledOnce());
    await waitFor(() => expect(approve).toBeEnabled());
    expect(complete).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
      false,
    );
  });

  it('does not infer initialization authority from preparation requirements', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            ...responseFor('circa-ewaste').result,
            capability: undefined,
            publication: undefined,
            readiness: 'NOT_IMPORTED',
            allowedActions: [],
            preparation: { status: 'NOT_INSTALLED', steps: [] },
          },
        }),
        { status: 200 },
      ),
    );
    renderPage('/setup-accelerators?profile=circa-ewaste');
    await screen.findByRole('button', { name: 'Show Circa eWaste details' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(screen.queryByRole('button', { name: 'Initialize' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Prepare setup' })).toBeNull();
  });

  it('observes a failed initialization once and continues from pending owner status without replay or stale errors', async () => {
    const user = userEvent.setup();
    let submitted = false;
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      await Promise.resolve();
      const url = input instanceof Request ? input.url : input.toString();
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (init?.method === 'POST') {
        submitted = true;
        return new Response(
          JSON.stringify({ message: 'Operation response unavailable' }),
          { status: 409 },
        );
      }
      const result = submitted
        ? responseFor('circa-ewaste').result
        : {
            ...responseFor('circa-ewaste').result,
            capability: undefined,
            publication: undefined,
            readiness: 'NOT_IMPORTED',
            allowedActions: ['INITIALIZE'],
          };
      return new Response(JSON.stringify({ result }), { status: 200 });
    });
    renderPage('/setup-accelerators?profile=circa-ewaste');
    const initialize = await screen.findByRole('button', { name: 'Initialize' });
    await waitFor(() => expect(initialize).toBeEnabled());
    await user.click(initialize);
    await screen.findByText('Circa eWaste: review approval task');
    expect(calls.filter((call) => call.startsWith('POST'))).toHaveLength(1);
    expect(screen.queryByText('Operation response unavailable')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Initialize' })).toBeNull();
  });

  it('blocks writes from stale data after a failed status read while keeping manual refresh available', async () => {
    const user = userEvent.setup();
    let failRead = false;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      await Promise.resolve();
      if (failRead)
        return new Response(JSON.stringify({ message: 'Status unavailable' }), {
          status: 503,
        });
      return new Response(
        JSON.stringify({
          result: {
            ...responseFor('circa-ewaste').result,
            capability: undefined,
            publication: undefined,
            readiness: 'NOT_IMPORTED',
            allowedActions: ['INITIALIZE'],
          },
        }),
        { status: 200 },
      );
    });
    renderPage('/setup-accelerators?profile=circa-ewaste');
    const initialize = await screen.findByRole('button', { name: 'Initialize' });
    await waitFor(() => expect(initialize).toBeEnabled());
    failRead = true;
    await user.click(
      screen.getByRole('button', { name: 'Refresh Circa eWaste status' }),
    );
    await screen.findByText('Status unavailable');
    expect(initialize).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Refresh Circa eWaste status' }),
    ).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const details = screen.getByRole('button', { name: 'Show Circa eWaste details' });
    expect(details).toBeEnabled();
    await user.click(details);
    expect(
      screen.getByRole('button', { name: 'Hide Circa eWaste details' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('circa.ewaste · online')).toBeVisible();
    expect(initialize).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('shows the owner error and an explicit diagnostic-unavailable detail when the first read fails', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Target diagnostic failed' }), {
        status: 500,
      }),
    );
    renderPage('/setup-accelerators?profile=circa-ewaste');
    await screen.findByText('Target diagnostic failed');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Show Circa eWaste details' }));
    expect(screen.getByText(/Dependency details are unavailable/)).toBeVisible();
    expect(screen.getByText('Target diagnostic failed')).toBeVisible();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('focuses the chosen offering without loading unrelated application status', async () => {
    const fetchImplementation = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) => {
        const url = input instanceof Request ? input.url : input.toString();
        expect(url).toContain('/circa-ewaste/');
        return Promise.resolve(
          new Response(JSON.stringify(responseFor('circa-ewaste')), { status: 200 }),
        );
      });
    renderPage('/setup-accelerators?profile=circa-ewaste');
    expect(
      await screen.findByRole('button', { name: 'All applications' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Agora Apparel')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Show Circa eWaste details' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it('shows a guided publication recovery path from backend-owned status', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url =
        input instanceof Request
          ? input.url
          : input instanceof URL
            ? input.href
            : input;
      const profileCode =
        /\/v0\/applications\/([^/]+)\/initialization/u.exec(String(url))?.[1] ?? '';
      return Promise.resolve(
        new Response(JSON.stringify(responseFor(decodeURIComponent(profileCode))), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    renderPage();

    const recovery = await screen.findByText('Publishing recovery path');
    const panel = recovery.closest('.MuiCard-root');
    if (!(panel instanceof HTMLElement)) {
      throw new Error('Publishing recovery path card was not rendered');
    }
    expect(
      within(panel).getByText('Agora Apparel: release needs repair'),
    ).toBeVisible();
    expect(within(panel).getByText('Circa eWaste: review approval task')).toBeVisible();
    expect(within(panel).getByText('Open Data Releases')).toBeVisible();
    expect(within(panel).getByText('Open Approval Queue')).toBeVisible();
    expect(screen.getByText('Approval Queue')).toBeVisible();
  });
});
