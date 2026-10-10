/** App-owned first-run routing tests; Process leaf rendering is isolated, not live approval acceptance. */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/app/App';
import { AppProviders } from '../../src/app/AppProviders';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
  AxisPublicBootstrap,
} from '../../src/bootstrap/publicBootstrap';
import {
  AxisInitializationUnavailableError,
  type AxisInitializationStatus,
} from '../../src/initialization/axisInitializationClient';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';
import { persistScreenLock } from '../../src/auth/screenLockState';

const owners = vi.hoisted(() => ({
  publicBootstrap: vi.fn(),
  authenticatedBootstrap: vi.fn(),
  restoreSession: vi.fn(),
  initializationStatus: vi.fn(),
  initialize: vi.fn(),
  completeTask: vi.fn(),
}));

vi.mock('../../src/bootstrap/publicBootstrap', async (original) => ({
  ...(await original<typeof import('../../src/bootstrap/publicBootstrap')>()),
  loadPublicBootstrap: owners.publicBootstrap,
  loadAuthenticatedBootstrap: owners.authenticatedBootstrap,
}));
vi.mock('../../src/auth/employeeAuthClient', async (original) => ({
  ...(await original<typeof import('../../src/auth/employeeAuthClient')>()),
  restoreEmployeeSession: owners.restoreSession,
}));
vi.mock('../../src/initialization/axisInitializationClient', async (original) => ({
  ...(await original<
    typeof import('../../src/initialization/axisInitializationClient')
  >()),
  loadAxisInitializationStatus: owners.initializationStatus,
  initiateAxisInitialization: owners.initialize,
}));
vi.mock(
  '../../src/operations/processWorkflow/api/processDefinitionClient',
  async (original) => ({
    ...(await original<
      typeof import('../../src/operations/processWorkflow/api/processDefinitionClient')
    >()),
    completeProcessTask: owners.completeTask,
  }),
);
vi.mock('../../src/operations/processWorkflow/ProcessWorkflowRoutePage', () => ({
  ProcessWorkflowRoutePage: ({ navigation }: { navigation: AxisNavigationItem }) => (
    <section aria-label="Admitted Process workspace">
      <span>{navigation.route}</span>
      <span>{navigation.moduleName}</span>
      <input aria-label="In-memory workspace draft" defaultValue="" />
    </section>
  ),
}));
vi.mock('../../src/documentation/DocumentationRoutePage', () => ({
  DocumentationRoutePage: ({ path }: { path: string }) => (
    <section aria-label="Admitted documentation">{path}</section>
  ),
}));
vi.mock('../../src/initialization/AxisInitializationWorkspace', () => ({
  AxisInitializationWorkspace: ({
    onReviewWorkflow,
  }: {
    onReviewWorkflow?: () => void;
  }) => (
    <section>
      <h1>Initializer retained</h1>
      {onReviewWorkflow && <button onClick={onReviewWorkflow}>Review workflow</button>}
    </section>
  ),
}));

const runtime: AxisRuntimeConfig = {
  backofficeBaseUrl: 'https://backoffice.example.test',
  enterpriseCode: 'default',
  projectCode: 'nodics.kickoff',
  clientContractVersion: 1,
  requestTimeoutMs: 10_000,
  browserSessionCsrfCookieName: 'nodics_axis_csrf',
  assistantMaximumEventBytes: 65_536,
  assistantReconnectWindowMs: 120_000,
  assistantIdleTimeoutMs: 45_000,
};
const publicBootstrap: AxisPublicBootstrap = {
  contractVersion: 1,
  clientContractVersion: 1,
  endpoints: {
    profile: 'https://profile.example.test',
    cms: 'https://cms.example.test',
  },
  uiComposition: {
    site: 'axisCmsSite',
    catalog: 'axisContentCatalog',
    defaultPublicPage: '/login',
    defaultAuthenticatedPage: '/dashboard',
    locale: 'en',
    supportedLocales: ['en'],
    fallbackLocales: ['en'],
    channel: 'web',
    fallbackMode: 'STATIC_RECOVERY_SHELL',
  },
};
const taskNavigation: AxisNavigationItem = {
  id: 'process-tasks',
  label: 'Process tasks',
  route: '/process/tasks',
  moduleName: 'workflow',
  order: 1,
  category: 'process',
  icon: 'workflow',
  availability: 'UP',
  featureState: 'ACTIVE',
};
const pendingStatus: AxisInitializationStatus = {
  baselineCode: 'axis',
  releaseCode: 'axis:axisBaseline',
  releaseVersion: '1.0.0',
  releaseStatus: 'CURRENT',
  readiness: 'PUBLICATION_PENDING',
  publication: {
    code: 'baseline-axis',
    state: 'PENDING_APPROVAL',
    revision: 1,
    workflowRef: 'baseline-review-1',
  },
};

/** Supplies authenticated owner navigation without reproducing route admission policy in the fixture. */
function bootstrap(
  navigation: readonly AxisNavigationItem[],
): AxisAuthenticatedBootstrap {
  return {
    axisPolicy: {
      contractVersion: 0,
      screenLockEnabled: true,
      idleTimeoutSeconds: 900,
      recentNavigationLimit: 12,
      revision: 0,
      source: 'DEFAULT',
    },
    navigation,
    moduleCatalog: {},
    environments: [],
    moduleConnections: {},
    documentationSources: [],
    tenantCode: 'default',
  };
}

function openApproval() {
  window.history.replaceState({}, '', '/initialize-axis/approval');
  render(
    <AppProviders runtimeConfig={runtime}>
      <App />
    </AppProviders>,
  );
}

async function expectInitializer() {
  expect(
    await screen.findByRole('heading', { name: 'Initializer retained' }),
  ).toBeVisible();
  await waitFor(() => expect(window.location.pathname).toBe('/initialize-axis'));
  expect(
    screen.queryByRole('region', { name: 'Admitted Process workspace' }),
  ).not.toBeInTheDocument();
  expect(owners.initialize).not.toHaveBeenCalled();
  expect(owners.completeTask).not.toHaveBeenCalled();
}

describe('App first-run Process approval route admission', () => {
  it('refreshes partial sidebar navigation while keeping the recovered current workspace and query', async () => {
    const commerce = {
      ...taskNavigation,
      id: 'commerce-orders',
      moduleName: 'order',
      label: 'Commerce orders',
      route: '/commerce/orders',
      featureState: 'DISABLED' as const,
      availability: 'UNAVAILABLE' as const,
    };
    const partial = bootstrap([taskNavigation, commerce]);
    owners.initializationStatus.mockResolvedValue({
      ...pendingStatus,
      readiness: 'READY',
    });
    owners.authenticatedBootstrap
      .mockResolvedValueOnce(partial)
      .mockResolvedValueOnce(partial)
      .mockResolvedValue(
        bootstrap([
          taskNavigation,
          { ...commerce, featureState: 'ACTIVE', availability: 'UP' },
        ]),
      );
    window.history.replaceState({}, '', '/process/tasks?expanded=fixture');
    render(
      <AppProviders runtimeConfig={runtime}>
        <App />
      </AppProviders>,
    );
    expect(
      await screen.findByRole('region', { name: 'Admitted Process workspace' }),
    ).toBeVisible();
    await waitFor(() => expect(owners.authenticatedBootstrap).toHaveBeenCalledTimes(2));
    expect(
      screen.queryByRole('button', { name: 'Commerce orders' }),
    ).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText('In-memory workspace draft'),
      'Retained local draft',
    );
    await user.click(screen.getByRole('button', { name: 'Refresh availability' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Refresh availability' }),
      ).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByText('Commerce orders')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.getByLabelText('In-memory workspace draft')).toHaveValue(
      'Retained local draft',
    );
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Admitted Process workspace' }),
      ).toBeVisible(),
    );
    expect(window.location.pathname + window.location.search).toBe(
      '/process/tasks?expanded=fixture',
    );
    expect(owners.completeTask).not.toHaveBeenCalled();
    expect(owners.initialize).not.toHaveBeenCalled();
  });

  it('refreshes unavailable owner navigation without replacing the current path or query', async () => {
    const unavailable = bootstrap([
      { ...taskNavigation, featureState: 'DISABLED', availability: 'UNAVAILABLE' },
    ]);
    owners.initializationStatus.mockResolvedValue({
      ...pendingStatus,
      readiness: 'READY',
    });
    owners.authenticatedBootstrap
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValue(bootstrap([taskNavigation]));
    window.history.replaceState({}, '', '/process/tasks?retained=fixture');
    render(
      <AppProviders runtimeConfig={runtime}>
        <App />
      </AppProviders>,
    );
    const refresh = await screen.findByRole('button', { name: 'Refresh availability' });
    await waitFor(() => expect(owners.authenticatedBootstrap).toHaveBeenCalledTimes(2));
    await userEvent.setup().click(refresh);
    expect(
      await screen.findByRole('region', { name: 'Admitted Process workspace' }),
    ).toBeVisible();
    expect(window.location.pathname + window.location.search).toBe(
      '/process/tasks?retained=fixture',
    );
    expect(owners.initialize).not.toHaveBeenCalled();
    expect(owners.completeTask).not.toHaveBeenCalled();
  });

  it('discards a pending availability reply when the employee locks the session', async () => {
    const unavailable = bootstrap([
      { ...taskNavigation, featureState: 'DISABLED', availability: 'UNAVAILABLE' },
    ]);
    let resolveRead!: (value: AxisAuthenticatedBootstrap) => void;
    const pendingRead = new Promise<AxisAuthenticatedBootstrap>((resolve) => {
      resolveRead = resolve;
    });
    owners.initializationStatus.mockResolvedValue({
      ...pendingStatus,
      readiness: 'READY',
    });
    owners.authenticatedBootstrap
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(unavailable)
      .mockReturnValue(pendingRead);
    window.history.replaceState({}, '', '/process/tasks');
    render(
      <AppProviders runtimeConfig={runtime}>
        <App />
      </AppProviders>,
    );
    const user = userEvent.setup();
    const refresh = await screen.findByRole('button', { name: 'Refresh availability' });
    await waitFor(() => expect(owners.authenticatedBootstrap).toHaveBeenCalledTimes(2));
    await user.click(refresh);
    await waitFor(() => expect(owners.authenticatedBootstrap).toHaveBeenCalledTimes(3));
    await user.click(screen.getByRole('button', { name: 'Open employee menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Lock screen' }));
    await waitFor(() => expect(window.location.pathname).toBe('/lock-screen'));
    await act(async () => {
      resolveRead(bootstrap([taskNavigation]));
      await pendingRead;
    });
    expect(window.location.pathname).toBe('/lock-screen');
    expect(
      screen.queryByRole('region', { name: 'Admitted Process workspace' }),
    ).not.toBeInTheDocument();
    expect(owners.completeTask).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
    owners.publicBootstrap.mockResolvedValue(publicBootstrap);
    owners.restoreSession.mockResolvedValue({
      accessToken: 'fixture-access',
      loginId: 'reviewer',
      enterpriseCode: 'default',
    });
    owners.authenticatedBootstrap.mockResolvedValue(bootstrap([taskNavigation]));
    owners.initializationStatus.mockResolvedValue(pendingStatus);
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockRejectedValue(
          new Error('Unexpected external request in isolated route test'),
        ),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('admits an owner-confirmed ready reviewer without reading the privileged setup endpoint', async () => {
    owners.authenticatedBootstrap.mockResolvedValue({
      ...bootstrap([taskNavigation]),
      axisInitializationAdmission: 'READY',
    });
    window.history.replaceState({}, '', '/process/tasks');
    render(
      <AppProviders runtimeConfig={runtime}>
        <App />
      </AppProviders>,
    );
    expect(
      await screen.findByRole('region', { name: 'Admitted Process workspace' }),
    ).toBeVisible();
    expect(owners.initializationStatus).not.toHaveBeenCalled();
    expect(owners.initialize).not.toHaveBeenCalled();
  });

  it('refreshes restricted admission through bootstrap without setup authority', async () => {
    owners.authenticatedBootstrap.mockResolvedValue({
      ...bootstrap([taskNavigation]),
      axisInitializationAdmission: 'NOT_READY',
    });
    window.history.replaceState({}, '', '/process/tasks');
    render(
      <AppProviders runtimeConfig={runtime}>
        <App />
      </AppProviders>,
    );
    const refresh = await screen.findByRole('button', { name: 'Refresh status' });
    owners.authenticatedBootstrap.mockResolvedValue({
      ...bootstrap([taskNavigation]),
      axisInitializationAdmission: 'READY',
    });
    await userEvent.setup().click(refresh);
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
    expect(
      screen.queryByText(
        'Workspace initialization is not ready. Contact your administrator.',
      ),
    ).not.toBeInTheDocument();
    expect(owners.initializationStatus).not.toHaveBeenCalled();
    expect(owners.initialize).not.toHaveBeenCalled();
    expect(owners.completeTask).not.toHaveBeenCalled();
  });

  it.each(['NOT_READY', 'UNAVAILABLE'] as const)(
    'blocks an ordinary reviewer while owner admission is %s without setup actions',
    async (admission) => {
      owners.authenticatedBootstrap.mockResolvedValue({
        ...bootstrap([taskNavigation]),
        axisInitializationAdmission: admission,
      });
      window.history.replaceState({}, '', '/process/tasks');
      render(
        <AppProviders runtimeConfig={runtime}>
          <App />
        </AppProviders>,
      );
      expect(
        await screen.findByText(
          'Workspace initialization is not ready. Contact your administrator.',
        ),
      ).toBeVisible();
      expect(
        screen.queryByRole('region', { name: 'Admitted Process workspace' }),
      ).not.toBeInTheDocument();
      expect(owners.initializationStatus).not.toHaveBeenCalled();
      expect(owners.initialize).not.toHaveBeenCalled();
      expect(owners.completeTask).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['UP', 'ACTIVE'],
    ['UP', 'PREVIEW'],
    ['DEGRADED', 'ACTIVE'],
    ['DEGRADED', 'PREVIEW'],
  ] as const)(
    'admits %s/%s navigation and passes the canonical task route',
    async (availability, featureState) => {
      owners.authenticatedBootstrap.mockResolvedValue(
        bootstrap([{ ...taskNavigation, availability, featureState }]),
      );
      openApproval();
      const workspace = await screen.findByRole('region', {
        name: 'Admitted Process workspace',
      });
      expect(workspace).toHaveTextContent('/process/tasks');
      expect(workspace).toHaveTextContent('workflow');
      expect(window.location.pathname).toBe('/initialize-axis/approval');
      expect(
        screen.queryByRole('heading', { name: 'Initializer retained' }),
      ).not.toBeInTheDocument();
      expect(owners.initialize).not.toHaveBeenCalled();
      expect(owners.completeTask).not.toHaveBeenCalled();
    },
  );

  it.each(['DISABLED', 'HIDDEN'] as const)(
    'does not admit %s navigation through a deep link',
    async (featureState) => {
      owners.authenticatedBootstrap.mockResolvedValue(
        bootstrap([{ ...taskNavigation, featureState }]),
      );
      openApproval();
      await expectInitializer();
      expect(
        screen.queryByRole('button', { name: 'Review workflow' }),
      ).not.toBeInTheDocument();
    },
  );

  it.each(['UNAVAILABLE', 'UNKNOWN'] as const)(
    'does not admit %s navigation through a deep link',
    async (availability) => {
      owners.authenticatedBootstrap.mockResolvedValue(
        bootstrap([{ ...taskNavigation, availability }]),
      );
      openApproval();
      await expectInitializer();
    },
  );

  it.each([
    ['missing navigation', []],
    ['wrong task identifier', [{ ...taskNavigation, id: 'process-instances' }]],
    ['wrong owner', [{ ...taskNavigation, moduleName: 'backoffice' }]],
  ] satisfies readonly (readonly [string, readonly AxisNavigationItem[]])[])(
    'does not bypass initialization with %s',
    async (_label, navigation) => {
      owners.authenticatedBootstrap.mockResolvedValue(bootstrap(navigation));
      openApproval();
      await expectInitializer();
    },
  );

  it.each([
    ['missing publication', { ...pendingStatus, publication: undefined }],
    [
      'missing workflow',
      {
        ...pendingStatus,
        publication: { code: 'baseline-axis', state: 'PENDING_APPROVAL', revision: 1 },
      },
    ],
    [
      'empty workflow',
      {
        ...pendingStatus,
        publication: { ...pendingStatus.publication!, workflowRef: '' },
      },
    ],
  ])(
    'keeps %s at the initializer even with authorized Process navigation',
    async (_label, status) => {
      owners.initializationStatus.mockResolvedValue(status);
      openApproval();
      await expectInitializer();
    },
  );

  it('does not admit a persisted locked employee session', async () => {
    persistScreenLock('/initialize-axis/approval');
    openApproval();
    await expectInitializer();
    expect(
      screen.queryByRole('button', { name: 'Review workflow' }),
    ).not.toBeInTheDocument();
  });

  it('does not admit an unauthenticated approval deep link', async () => {
    owners.restoreSession.mockRejectedValue(new Error('No Employee session'));
    openApproval();
    expect(await screen.findByRole('heading', { name: 'Nodics Axis' })).toBeVisible();
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(
      screen.queryByRole('region', { name: 'Admitted Process workspace' }),
    ).not.toBeInTheDocument();
    expect(owners.authenticatedBootstrap).not.toHaveBeenCalled();
    expect(owners.initializationStatus).not.toHaveBeenCalled();
    expect(owners.initialize).not.toHaveBeenCalled();
    expect(owners.completeTask).not.toHaveBeenCalled();
  });

  it('opens the authorized task workspace from the initializer review action', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/initialize-axis');
    render(
      <AppProviders runtimeConfig={runtime}>
        <App />
      </AppProviders>,
    );
    await user.click(await screen.findByRole('button', { name: 'Review workflow' }));
    expect(
      await screen.findByRole('region', { name: 'Admitted Process workspace' }),
    ).toHaveTextContent('/process/tasks');
    expect(window.location.pathname).toBe('/initialize-axis/approval');
    expect(owners.initialize).not.toHaveBeenCalled();
    expect(owners.completeTask).not.toHaveBeenCalled();
  });

  it('returns admitted task review to setup without completing a task', async () => {
    const user = userEvent.setup();
    openApproval();
    await screen.findByRole('region', { name: 'Admitted Process workspace' });
    await user.click(screen.getByRole('button', { name: 'Back to Axis setup' }));
    await expectInitializer();
  });

  it.each([true, false])(
    'restores a transiently interrupted documentation path only through existing admission (navigation=%s)',
    async (available) => {
      const path = '/docs/framework/customer-onboarding';
      owners.authenticatedBootstrap.mockResolvedValue(
        bootstrap(
          available
            ? [
                {
                  ...taskNavigation,
                  id: 'documentation',
                  moduleName: 'backoffice',
                  route: '/docs',
                  label: 'Documentation',
                },
              ]
            : [],
        ),
      );
      owners.initializationStatus
        .mockRejectedValueOnce(
          new AxisInitializationUnavailableError('Temporary read failure'),
        )
        .mockResolvedValue({ ...pendingStatus, readiness: 'READY' });
      window.history.replaceState({}, '', `${path}?privateInput=discarded#discarded`);
      render(
        <AppProviders runtimeConfig={runtime}>
          <App />
        </AppProviders>,
      );
      await expectInitializer();
      expect(JSON.stringify(window.history.state)).not.toContain('privateInput');
      expect(JSON.stringify(window.history.state)).not.toContain('discarded');
      expect(
        screen.queryByRole('region', { name: 'Admitted documentation' }),
      ).not.toBeInTheDocument();
      await waitFor(
        () => expect(window.location.pathname).toBe(available ? path : '/dashboard'),
        { timeout: 8_000 },
      );
      if (available) {
        expect(
          await screen.findByRole('region', { name: 'Admitted documentation' }),
        ).toHaveTextContent(path);
        expect(window.location.search).toBe('');
        expect(window.location.hash).toBe('');
      } else {
        expect(
          screen.queryByRole('region', { name: 'Admitted documentation' }),
        ).not.toBeInTheDocument();
      }
      expect(owners.initialize).not.toHaveBeenCalled();
      expect(owners.completeTask).not.toHaveBeenCalled();
      expect(owners.initializationStatus.mock.calls.length).toBeGreaterThanOrEqual(2);
    },
    10_000,
  );

  it.each([
    '//external.example/docs',
    '/docs/../profile/enterprises',
    '/docs?privateInput=value',
    '/docs#privateInput',
    '/initialize-axis/approval',
    '/lock-screen',
  ])('rejects unsafe or special initialization return intent %s', async (path) => {
    owners.initializationStatus.mockResolvedValue({
      ...pendingStatus,
      readiness: 'READY',
    });
    window.history.replaceState(
      { usr: { axisInitializationReturnPath: path } },
      '',
      '/initialize-axis',
    );
    render(
      <AppProviders runtimeConfig={runtime}>
        <App />
      </AppProviders>,
    );
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
    expect(
      screen.queryByRole('region', { name: 'Admitted Process workspace' }),
    ).not.toBeInTheDocument();
    expect(owners.initialize).not.toHaveBeenCalled();
    expect(owners.completeTask).not.toHaveBeenCalled();
  });
});
