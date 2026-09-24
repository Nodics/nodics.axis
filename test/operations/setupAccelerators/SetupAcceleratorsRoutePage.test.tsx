import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import type { AxisAuthenticatedBootstrap } from '../../../src/bootstrap/publicBootstrap';
import { SetupAcceleratorsRoutePage } from '../../../src/operations/setupAccelerators/SetupAcceleratorsRoutePage';
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
      summary: 'Apparel storefront accelerator as a complete business-facing domain bundle.',
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
          disabledReason:
            'Release manifest is invalid; repair it before installing.',
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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <AxisThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SetupAcceleratorsRoutePage
            accessToken="employee-token"
            bootstrap={bootstrap}
            runtime={runtime}
          />
        </MemoryRouter>
      </QueryClientProvider>
    </AxisThemeProvider>,
  );
}

describe('SetupAcceleratorsRoutePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
        /\/v0\/applications\/([^/]+)\/initialization/u.exec(String(url))?.[1] ??
        '';
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
    expect(within(panel).getByText('Agora Apparel: release needs repair')).toBeVisible();
    expect(
      within(panel).getByText('Circa eWaste: review approval task'),
    ).toBeVisible();
    expect(within(panel).getByText('Open Data Releases')).toBeVisible();
    expect(within(panel).getByText('Open Approval Queue')).toBeVisible();
    expect(screen.getByText('Approval Queue')).toBeVisible();
  });
});
