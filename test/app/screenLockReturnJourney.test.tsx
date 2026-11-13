/** App lock/unlock integration: real enterprise form and shell, isolated authentication/CMS owners. */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/app/App';
import { AppProviders } from '../../src/app/AppProviders';
import type {
  AxisAuthenticatedBootstrap,
  AxisPublicBootstrap,
} from '../../src/bootstrap/publicBootstrap';
import type { CmsRendererActions } from '../../src/cms/renderers/shared/rendererTypes';
import { persistScreenLock } from '../../src/auth/screenLockState';
import { observeEmployeeSessionResponse } from '../../src/auth/employeeSessionEvents';
import {
  connection,
  runtime,
  workspace,
} from '../enterprise/enterpriseCreationCheckpointFixtures';
import { task as managementTask } from '../enterprise/enterpriseManagementWorkspaceFixtures';

const owners = vi.hoisted(() => ({
  publicBootstrap: vi.fn(),
  authenticatedBootstrap: vi.fn(),
  restore: vi.fn(),
  authenticate: vi.fn(),
  status: vi.fn(),
}));
// These cases isolate lock/route/command owners. The optional display read has
// its own transport/scope tests and must not consume a native-task fixture body.
vi.mock('../../src/bootstrap/currentEnterpriseDisplay', () => ({
  loadCurrentEnterpriseDisplay: (configuration: { enterpriseCode: string }) =>
    Promise.resolve({ code: configuration.enterpriseCode, displayName: null }),
}));
vi.mock('../../src/bootstrap/publicBootstrap', async (original) => ({
  ...(await original<typeof import('../../src/bootstrap/publicBootstrap')>()),
  loadPublicBootstrap: owners.publicBootstrap,
  loadAuthenticatedBootstrap: owners.authenticatedBootstrap,
}));
vi.mock('../../src/auth/employeeAuthClient', async (original) => ({
  ...(await original<typeof import('../../src/auth/employeeAuthClient')>()),
  restoreEmployeeSession: owners.restore,
  authenticateEmployee: owners.authenticate,
}));
vi.mock('../../src/initialization/axisInitializationClient', async (original) => ({
  ...(await original<
    typeof import('../../src/initialization/axisInitializationClient')
  >()),
  loadAxisInitializationStatus: owners.status,
}));
vi.mock('../../src/operations/processWorkflow/ProcessWorkflowRoutePage', () => ({
  ProcessWorkflowRoutePage: () => {
    const location = useLocation();
    const code = new URLSearchParams(location.search).get('instanceCode');
    return code ? (
      <section aria-label="Selected review">
        <h1>{code}</h1>
      </section>
    ) : (
      <h1>Choose a review</h1>
    );
  },
}));
vi.mock('../../src/operations/rulesManagement/RulesManagementRoutePage', () => ({
  RulesManagementRoutePage: () => (
    <section aria-label="Executable native capability">Rules command workspace</section>
  ),
}));
vi.mock(
  '../../src/operations/runtimeConfiguration/RuntimeConfigurationRoutePage',
  () => ({
    RuntimeConfigurationRoutePage: () => (
      <section aria-label="Executable native capability">
        Configuration command workspace
      </section>
    ),
  }),
);
vi.mock(
  '../../src/operations/documentationManagement/DocumentationManagementRoutePage',
  () => ({
    DocumentationManagementRoutePage: () => <button>Save navigation fixture</button>,
  }),
);
vi.mock('../../src/app/CmsRoutePage', () => ({
  CmsRoutePage: ({
    path,
    actions,
    authenticationError,
  }: {
    path: string;
    actions?: CmsRendererActions;
    authenticationError?: string;
  }) => {
    const navigate = useNavigate();
    return path === '/login' ? (
      <section>
        {authenticationError && <p role="alert">{authenticationError}</p>}
        <button
          onClick={() => actions?.onEmployeeLogin?.('operator', 'fixture-password')}
        >
          Sign in
        </button>
      </section>
    ) : path === '/lock-screen' ? (
      <section>
        <h1>Locked session</h1>
        {actions?.employeeSessionRecoveryMessage && (
          <p role="status">{actions.employeeSessionRecoveryMessage}</p>
        )}
        <button
          aria-busy={actions?.employeeUnlockPending === true}
          onClick={() => actions?.onEmployeeUnlock?.('fixture-password')}
        >
          Unlock
        </button>
        {authenticationError && <p>{authenticationError}</p>}
      </section>
    ) : (
      <>
        <button onClick={() => void navigate('/profile/enterprises?tab=enterprises')}>
          Open enterprises
        </button>
        <button
          onClick={() =>
            void navigate('/process/tasks?instanceCode=review-100#review-details')
          }
        >
          Open review
        </button>
      </>
    );
  },
}));

const discovery: AxisPublicBootstrap = {
  contractVersion: 1,
  clientContractVersion: 1,
  endpoints: { profile: connection.endpoint, cms: 'https://cms.example.test' },
  uiComposition: {
    site: 'axisCmsSite',
    catalog: 'axisContentCatalog',
    locale: 'en',
    supportedLocales: ['en'],
    fallbackLocales: ['en'],
    channel: 'web',
    defaultPublicPage: '/login',
    defaultAuthenticatedPage: '/dashboard',
    fallbackMode: 'STATIC_RECOVERY_SHELL',
  },
};
const admitted: AxisAuthenticatedBootstrap = {
  axisPolicy: {
    contractVersion: 0,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 0,
    source: 'DEFAULT',
  },
  navigation: [
    {
      id: 'enterprises',
      moduleName: 'profile',
      label: 'Enterprise management',
      route: '/profile/enterprises',
      category: 'profile',
      icon: 'enterprise',
      order: 1,
      availability: 'UP',
      featureState: 'ACTIVE',
      backendWorkspace: workspace,
    },
  ],
  moduleCatalog: {},
  environments: [],
  moduleConnections: { profile: [connection] },
  documentationSources: [],
  tenantCode: 'default',
};

function reviewAdmission(): AxisAuthenticatedBootstrap {
  return {
    ...admitted,
    navigation: [
      ...admitted.navigation,
      {
        id: 'process-workflows',
        moduleName: 'workflow',
        label: 'Review queue',
        route: '/process/tasks',
        category: 'operations',
        icon: 'workflow',
        order: 2,
        availability: 'UP',
        featureState: 'ACTIVE',
      },
    ],
  };
}

/** Authorized generic parent used to distinguish its own route from an absent child. */
function directoryAdmission(): AxisAuthenticatedBootstrap {
  return {
    ...admitted,
    navigation: [
      {
        id: 'customer-workspace',
        moduleName: 'profile',
        label: 'Customer directory',
        route: '/profile',
        category: 'profile',
        icon: 'profile',
        order: 1,
        availability: 'UP',
        featureState: 'ACTIVE',
        backendWorkspace: {
          ...workspace,
          title: 'Customer directory',
          tabs: [{ id: 'directory', label: 'Directory', sections: [] }],
        },
      },
    ],
  };
}

async function prepareReviewLock() {
  const user = userEvent.setup();
  render(
    <AppProviders runtimeConfig={runtime}>
      <App />
    </AppProviders>,
  );
  await user.click(await screen.findByRole('button', { name: 'Sign in' }));
  await user.click(await screen.findByRole('button', { name: 'Open review' }));
  await screen.findByRole('region', { name: 'Selected review' });
  const original =
    window.location.pathname + window.location.search + window.location.hash;
  await user.click(screen.getByRole('button', { name: /Open employee menu/ }));
  await user.click(screen.getByRole('menuitem', { name: 'Lock screen' }));
  await screen.findByRole('heading', { name: 'Locked session' });
  return { user, original };
}

/** Uses the actual App menu and route unmount; no backend writes are permitted. */
async function prepareAndLock() {
  const user = userEvent.setup();
  render(
    <AppProviders runtimeConfig={runtime}>
      <App />
    </AppProviders>,
  );
  await user.click(await screen.findByRole('button', { name: 'Sign in' }));
  await user.click(await screen.findByRole('button', { name: 'Open enterprises' }));
  await user.type(
    await screen.findByLabelText(/^Enterprise code/),
    'unsubmitted-enterprise',
  );
  await user.type(screen.getByLabelText(/^Enterprise name/), 'Unsubmitted Enterprise');
  await user.type(
    screen.getByLabelText(/^Administrator email/),
    'admin@axis-onboarding-acceptance.test',
  );
  await user.click(screen.getByRole('button', { name: /Open employee menu/ }));
  await user.click(screen.getByRole('menuitem', { name: 'Lock screen' }));
  await waitFor(() => expect(window.location.pathname).toBe('/lock-screen'));
  expect(await screen.findByRole('heading', { name: 'Locked session' })).toBeVisible();
  expect(screen.queryByLabelText(/^Enterprise code/)).not.toBeInTheDocument();
  return user;
}

describe('App enterprise creation return after screen unlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/login');
    owners.publicBootstrap.mockResolvedValue(discovery);
    owners.restore.mockRejectedValue(new Error('No prior session'));
    owners.authenticatedBootstrap.mockResolvedValue(admitted);
    owners.authenticate.mockResolvedValue({
      accessToken: 'fixture-access',
      loginId: 'operator',
      enterpriseCode: runtime.enterpriseCode,
      generation: 1,
    });
    owners.status.mockResolvedValue({
      baselineCode: 'axis',
      releaseCode: 'axis:axisBaseline',
      releaseVersion: '1.0.0',
      releaseStatus: 'CURRENT',
      readiness: 'READY',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Unexpected owner request')),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('loads Profile native management through the existing exact-route and command context', async () => {
    window.history.replaceState({}, '', '/profile/enterprises');
    owners.restore.mockResolvedValue({
      accessToken: 'restored-administrator',
      loginId: 'administrator',
      enterpriseCode: runtime.enterpriseCode,
      generation: 1,
    });
    const native: AxisAuthenticatedBootstrap = {
      ...admitted,
      navigation: admitted.navigation.map((item) => ({
        ...item,
        backendWorkspace: {
          contractVersion: 1,
          renderer: 'axis.workspace.native',
          workspaceCode: 'profile.enterpriseManagement',
          viewCode: 'administration',
          title: 'Enterprise management',
          tabs: [],
        },
      })),
    };
    owners.authenticatedBootstrap.mockResolvedValue(native);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'SUC_PRFL_00000',
          data: { ...managementTask, enterpriseCode: runtime.enterpriseCode },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    render(
      <AppProviders runtimeConfig={runtime}>
        <App />
      </AppProviders>,
    );
    expect(await screen.findByRole('button', { name: 'Assign access' })).toBeVisible();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const requested = fetcher.mock.calls[0]?.[0];
    expect(
      typeof requested === 'string'
        ? requested
        : requested instanceof URL
          ? requested.href
          : requested?.url,
    ).toContain('/nodics/profile/v0/enterprises/workspace');
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer restored-administrator',
    });
  });

  it('does not load the native management task at an undeclared nested URL', async () => {
    window.history.replaceState({}, '', '/profile/enterprises/unknown');
    owners.restore.mockResolvedValue({
      accessToken: 'restored-administrator',
      loginId: 'administrator',
      enterpriseCode: runtime.enterpriseCode,
      generation: 1,
    });
    const native: AxisAuthenticatedBootstrap = {
      ...admitted,
      navigation: admitted.navigation.map((item) => ({
        ...item,
        backendWorkspace: {
          contractVersion: 1,
          renderer: 'axis.workspace.native',
          workspaceCode: 'profile.enterpriseManagement',
          viewCode: 'administration',
          title: 'Enterprise management',
          tabs: [],
        },
      })),
    };
    owners.authenticatedBootstrap.mockResolvedValue(native);
    render(
      <AppProviders runtimeConfig={runtime}>
        <App />
      </AppProviders>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Page unavailable' }),
    ).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['rules.policy', 'DISABLED'],
    ['rules.policy', 'HIDDEN'],
    ['system.runtimeConfiguration', 'DISABLED'],
    ['system.runtimeConfiguration', 'HIDDEN'],
    ['rules.policy', 'ACTIVE'],
    ['rules.policy', 'PREVIEW'],
    ['system.runtimeConfiguration', 'ACTIVE'],
    ['system.runtimeConfiguration', 'PREVIEW'],
  ] as const)(
    'admits native %s only for executable owner state %s',
    async (workspaceCode, featureState) => {
      window.history.replaceState({}, '', '/capability-test');
      owners.restore.mockResolvedValue({
        accessToken: 'restored-operator',
        loginId: 'operator',
        enterpriseCode: runtime.enterpriseCode,
        generation: 1,
      });
      owners.authenticatedBootstrap.mockResolvedValue({
        ...admitted,
        navigation: [
          {
            ...admitted.navigation[0]!,
            id: 'capability-test',
            moduleName: 'example',
            route: '/capability-test',
            featureState,
            backendWorkspace: {
              ...workspace,
              renderer: 'axis.workspace.native',
              workspaceCode,
              viewCode: 'overview',
              tabs: [],
            },
          },
        ],
      });
      render(
        <AppProviders runtimeConfig={runtime}>
          <App />
        </AppProviders>,
      );
      if (featureState === 'ACTIVE' || featureState === 'PREVIEW') {
        expect(
          await screen.findByRole('region', { name: 'Executable native capability' }),
        ).toBeVisible();
      } else {
        await screen.findByRole('heading', {
          name:
            featureState === 'HIDDEN' ? 'Page unavailable' : 'Enterprise management',
        });
        expect(
          screen.queryByRole('region', { name: 'Executable native capability' }),
        ).not.toBeInTheDocument();
      }
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('does not let a disabled Documentation Designer child inherit the active parent editor', async () => {
    window.history.replaceState({}, '', '/docs/designer/navigation');
    owners.restore.mockResolvedValue({
      accessToken: 'restored-operator',
      loginId: 'operator',
      enterpriseCode: runtime.enterpriseCode,
      generation: 1,
    });
    const parent = {
      ...admitted.navigation[0]!,
      id: 'documentation-management',
      moduleName: 'backoffice',
      route: '/docs/designer',
      label: 'Documentation Designer',
      backendWorkspace: undefined,
    };
    owners.authenticatedBootstrap.mockResolvedValue({
      ...admitted,
      navigation: [
        parent,
        {
          ...parent,
          id: 'documentation-navigation',
          route: '/docs/designer/navigation',
          label: 'Navigation Builder',
          featureState: 'DISABLED',
        },
      ],
    });
    render(
      <AppProviders runtimeConfig={runtime}>
        <App />
      </AppProviders>,
    );
    expect(await screen.findByText('DISABLED')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Save navigation fixture' }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Return to dashboard' }));
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not substitute an authorized parent workspace for an unavailable child URL', async () => {
    window.history.replaceState({}, '', '/profile/enterprises?tab=users');
    owners.restore.mockResolvedValue({
      accessToken: 'restored-operator',
      loginId: 'operator',
      enterpriseCode: runtime.enterpriseCode,
      generation: 1,
    });
    owners.authenticatedBootstrap.mockResolvedValue(directoryAdmission());
    const user = userEvent.setup();
    render(
      <AppProviders runtimeConfig={runtime}>
        <App />
      </AppProviders>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Page unavailable' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Customer directory' }),
    ).not.toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe(
      '/profile/enterprises?tab=users',
    );
    expect(fetch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('link', { name: 'Return to dashboard' }));
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
  });

  it.each(['/profile', '/profile/', '/profile?filter=retained#directory'])(
    'preserves an admitted generic workspace at its exact route: %s',
    async (path) => {
      window.history.replaceState({}, '', path);
      owners.restore.mockResolvedValue({
        accessToken: 'restored-operator',
        loginId: 'operator',
        enterpriseCode: runtime.enterpriseCode,
        generation: 1,
      });
      owners.authenticatedBootstrap.mockResolvedValue(directoryAdmission());
      render(
        <AppProviders runtimeConfig={runtime}>
          <App />
        </AppProviders>,
      );
      expect(
        await screen.findByRole('heading', { name: 'Customer directory' }),
      ).toBeVisible();
      expect(
        screen.queryByRole('heading', { name: 'Page unavailable' }),
      ).not.toBeInTheDocument();
      expect(
        window.location.pathname + window.location.search + window.location.hash,
      ).toBe(path);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    { featureState: 'DISABLED', availability: 'UP' },
    { featureState: 'HIDDEN', availability: 'UP' },
    { featureState: 'ACTIVE', availability: 'UNAVAILABLE' },
  ] as const)('does not execute generic forms for owner state %j', async (state) => {
    window.history.replaceState({}, '', '/profile/enterprises');
    owners.restore.mockResolvedValue({
      accessToken: 'restored-operator',
      loginId: 'operator',
      enterpriseCode: runtime.enterpriseCode,
      generation: 1,
    });
    const scoped: AxisAuthenticatedBootstrap = {
      ...admitted,
      navigation: admitted.navigation.map((item) => ({ ...item, ...state })),
    };
    owners.authenticatedBootstrap.mockResolvedValue(scoped);
    render(
      <AppProviders runtimeConfig={runtime}>
        <App />
      </AppProviders>,
    );
    expect(
      await screen.findByRole('heading', {
        name:
          state.featureState === 'HIDDEN'
            ? 'Page unavailable'
            : 'Enterprise management',
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Create enterprise' }),
    ).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    'same scope',
    'tenant changed',
    'employee changed',
    'route permission removed',
  ])(
    'keeps an explicit locked-entry record private and respects fresh %s admission',
    async (change) => {
      const incoming = '/process/tasks?instanceCode=review-114&sort=oldest#timeline';
      persistScreenLock('/dashboard');
      window.history.replaceState({}, '', incoming);
      owners.restore.mockResolvedValue({
        accessToken: 'restored-operator',
        loginId: 'operator',
        enterpriseCode: runtime.enterpriseCode,
        generation: 1,
      });
      owners.authenticatedBootstrap.mockResolvedValue(reviewAdmission());
      const user = userEvent.setup();
      render(
        <AppProviders runtimeConfig={runtime}>
          <App />
        </AppProviders>,
      );
      await screen.findByRole('heading', { name: 'Locked session' });
      expect(screen.queryByRole('region', { name: 'Selected review' })).toBeNull();
      const marker = window.sessionStorage.getItem('nodics-axis-screen-lock-v1');
      expect(marker).not.toMatch(/review-114|instanceCode|timeline|restored-operator/);
      owners.authenticate.mockResolvedValue({
        accessToken: 'verified-unlock',
        loginId: change === 'employee changed' ? 'different-employee' : 'operator',
        enterpriseCode: runtime.enterpriseCode,
        generation: 2,
      });
      owners.authenticatedBootstrap.mockResolvedValue(
        change === 'tenant changed'
          ? { ...reviewAdmission(), tenantCode: 'other-tenant' }
          : change === 'route permission removed'
            ? admitted
            : reviewAdmission(),
      );
      await user.click(screen.getByRole('button', { name: 'Unlock' }));
      await waitFor(() =>
        expect(
          window.location.pathname + window.location.search + window.location.hash,
        ).toBe(change === 'same scope' ? incoming : '/dashboard'),
      );
      if (change === 'same scope')
        expect(
          await screen.findByRole('region', { name: 'Selected review' }),
        ).toHaveTextContent('review-114');
      else expect(screen.queryByRole('region', { name: 'Selected review' })).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it('retains the restricted stored destination when restoring the lock-screen entry itself', async () => {
    persistScreenLock('/process/tasks');
    window.history.replaceState({}, '', '/lock-screen');
    owners.restore.mockResolvedValue({
      accessToken: 'restored-operator',
      loginId: 'operator',
      enterpriseCode: runtime.enterpriseCode,
      generation: 1,
    });
    owners.authenticatedBootstrap.mockResolvedValue(reviewAdmission());
    const user = userEvent.setup();
    render(
      <AppProviders runtimeConfig={runtime}>
        <App />
      </AppProviders>,
    );
    await screen.findByRole('heading', { name: 'Locked session' });
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(window.location.pathname).toBe('/process/tasks'));
    expect(window.location.search).toBe('');
    expect(screen.queryByRole('region', { name: 'Selected review' })).toBeNull();
  });

  it('retains the exact review location in memory across same-context unlock without persisting record queries', async () => {
    owners.authenticatedBootstrap.mockResolvedValue(reviewAdmission());
    const { user, original } = await prepareReviewLock();
    expect(screen.queryByRole('region', { name: 'Selected review' })).toBeNull();
    const stored = window.sessionStorage.getItem('nodics-axis-screen-lock-v1');
    expect(stored).not.toBeNull();
    expect(stored).not.toContain('review-100');
    expect(stored).not.toContain('instanceCode');
    expect(stored).not.toContain('fixture-access');
    owners.authenticate.mockResolvedValue({
      accessToken: 'unlocked-fixture-access',
      loginId: 'operator',
      enterpriseCode: runtime.enterpriseCode,
      generation: 2,
    });
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() =>
      expect(
        window.location.pathname + window.location.search + window.location.hash,
      ).toBe(original),
    );
    expect(
      await screen.findByRole('region', { name: 'Selected review' }),
    ).toHaveTextContent('review-100');
    expect(owners.authenticate).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['tenant changed', 'review permission removed'])(
    'does not restore private record context when %s on fresh unlock admission',
    async (change) => {
      owners.authenticatedBootstrap.mockResolvedValue(reviewAdmission());
      const { user } = await prepareReviewLock();
      owners.authenticate.mockResolvedValue({
        accessToken: 'new-context-access',
        loginId: 'operator',
        enterpriseCode: runtime.enterpriseCode,
        generation: 2,
      });
      owners.authenticatedBootstrap.mockResolvedValue(
        change === 'tenant changed'
          ? { ...reviewAdmission(), tenantCode: 'another-tenant' }
          : admitted,
      );
      await user.click(screen.getByRole('button', { name: 'Unlock' }));
      await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
      expect(window.location.search).toBe('');
      expect(window.location.hash).toBe('');
      expect(screen.queryByRole('region', { name: 'Selected review' })).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('explains retained work on lock and retires the private draft on a matching expiry without replay', async () => {
    const presentation = {
      lockedMessage:
        'Retained checkpoints can return; inspect submitted actions before retrying.',
      expiredMessage:
        'Session expired. Sign in and inspect submitted actions; other unsaved edits may be lost.',
    };
    owners.authenticatedBootstrap.mockResolvedValue({
      ...admitted,
      axisPolicy: { ...admitted.axisPolicy, sessionRecoveryPresentation: presentation },
    });
    const user = await prepareAndLock();
    expect(screen.getByRole('status')).toHaveTextContent(presentation.lockedMessage);
    observeEmployeeSessionResponse({ status: 401 }, 'older-session', 1);
    expect(screen.getByRole('heading', { name: 'Locked session' })).toBeVisible();
    observeEmployeeSessionResponse({ status: 403 }, 'fixture-access', 1);
    expect(screen.getByRole('heading', { name: 'Locked session' })).toBeVisible();
    observeEmployeeSessionResponse({ status: 401 }, 'fixture-access', 1);
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(presentation.expiredMessage);
    expect(window.location.search).not.toContain('unsubmitted-enterprise');
    expect(window.sessionStorage.getItem('nodics-axis-screen-lock-v1')).toBeNull();
    owners.authenticate.mockResolvedValue({
      accessToken: 'next-actor-access',
      loginId: 'operator',
      enterpriseCode: runtime.enterpriseCode,
      generation: 2,
    });
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await user.click(await screen.findByRole('button', { name: 'Open enterprises' }));
    expect(await screen.findByLabelText(/^Enterprise code/)).toHaveValue('');
    expect(screen.getByLabelText(/^Enterprise name/)).toHaveValue('');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns to the retained enterprise tab and draft, not the dashboard', async () => {
    const user = await prepareAndLock();
    owners.authenticate.mockResolvedValue({
      accessToken: 'unlocked-fixture-access',
      loginId: 'operator',
      enterpriseCode: runtime.enterpriseCode,
      generation: 2,
    });
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/profile/enterprises');
      expect(window.location.search).toBe('?tab=enterprises');
      expect(screen.getByLabelText(/^Enterprise code/)).toHaveValue(
        'unsubmitted-enterprise',
      );
    });
    expect(screen.getByLabelText(/^Enterprise name/)).toHaveValue(
      'Unsubmitted Enterprise',
    );
    expect(screen.getByLabelText(/^Administrator email/)).toHaveValue(
      'admin@axis-onboarding-acceptance.test',
    );
    expect(owners.authenticate).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('nodics-axis-screen-lock-v1')).toBeNull();
  });

  it('keeps the form inaccessible while unlock authentication is pending or denied', async () => {
    const user = await prepareAndLock();
    let rejectUnlock!: (reason: Error) => void;
    owners.authenticate.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectUnlock = reject;
        }),
    );
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(window.location.pathname).toBe('/lock-screen');
    expect(screen.queryByLabelText(/^Enterprise code/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unlock' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(owners.authenticate).toHaveBeenCalledTimes(2);
    await act(async () => {
      rejectUnlock(new Error('Authentication denied'));
      await Promise.resolve();
    });
    expect(await screen.findByText('Authentication denied')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Unlock' })).toHaveAttribute(
      'aria-busy',
      'false',
    );
    expect(window.location.pathname).toBe('/lock-screen');
    expect(screen.queryByLabelText(/^Enterprise code/)).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['NOT_READY', 'UNAVAILABLE', undefined] as const)(
    'keeps Unlock visible for stale admission %s and rechecks owner admission before restoring the route',
    async (admission) => {
      const user = userEvent.setup();
      window.history.replaceState({}, '', '/profile/enterprises?tab=enterprises');
      persistScreenLock('/profile/enterprises?tab=enterprises');
      owners.restore.mockResolvedValue({
        accessToken: 'restored-fixture-access',
        loginId: 'operator',
        enterpriseCode: runtime.enterpriseCode,
        generation: 1,
      });
      owners.authenticate.mockResolvedValue({
        accessToken: 'unlocked-fixture-access',
        loginId: 'operator',
        enterpriseCode: runtime.enterpriseCode,
        generation: 2,
      });
      owners.authenticatedBootstrap.mockResolvedValueOnce({
        ...admitted,
        axisInitializationAdmission: admission,
      });
      if (admission === undefined)
        owners.status.mockImplementationOnce(() => new Promise(() => {}));
      let resolveBootstrap!: (value: AxisAuthenticatedBootstrap) => void;
      owners.authenticatedBootstrap.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveBootstrap = resolve;
          }),
      );
      render(
        <AppProviders runtimeConfig={runtime}>
          <App />
        </AppProviders>,
      );
      const unlock = await screen.findByRole('button', { name: 'Unlock' });
      expect(unlock).toBeVisible();
      expect(window.location.pathname).toBe('/lock-screen');
      expect(
        screen.queryByRole('button', { name: 'Refresh status' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^Enterprise code/)).not.toBeInTheDocument();
      await user.click(unlock);
      await waitFor(() =>
        expect(owners.authenticatedBootstrap).toHaveBeenCalledTimes(2),
      );
      expect(owners.authenticatedBootstrap).toHaveBeenLastCalledWith(
        runtime.backofficeBaseUrl,
        runtime.clientContractVersion,
        'unlocked-fixture-access',
        runtime.requestTimeoutMs,
      );
      expect(screen.getByRole('button', { name: 'Unlock' })).toBeVisible();
      expect(screen.queryByLabelText(/^Enterprise code/)).not.toBeInTheDocument();
      await act(async () => {
        resolveBootstrap({ ...admitted, axisInitializationAdmission: 'READY' });
        await Promise.resolve();
      });
      expect(await screen.findByLabelText(/^Enterprise code/)).toBeVisible();
      expect(window.location.pathname + window.location.search).toBe(
        '/profile/enterprises?tab=enterprises',
      );
      expect(owners.authenticate).toHaveBeenCalledTimes(1);
      expect(window.sessionStorage.getItem('nodics-axis-screen-lock-v1')).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('retains the setup gate when fresh unlock admission is unavailable and permits explicit status refresh', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/profile/enterprises');
    persistScreenLock('/profile/enterprises');
    owners.restore.mockResolvedValue({
      accessToken: 'restored-fixture-access',
      loginId: 'operator',
      enterpriseCode: runtime.enterpriseCode,
      generation: 1,
    });
    owners.authenticatedBootstrap
      .mockResolvedValueOnce({ ...admitted, axisInitializationAdmission: 'NOT_READY' })
      .mockResolvedValueOnce({
        ...admitted,
        axisInitializationAdmission: 'UNAVAILABLE',
      });
    render(
      <AppProviders runtimeConfig={runtime}>
        <App />
      </AppProviders>,
    );
    await user.click(await screen.findByRole('button', { name: 'Unlock' }));
    expect(
      await screen.findByText(
        'Workspace initialization is not ready. Contact your administrator.',
      ),
    ).toBeVisible();
    expect(screen.queryByLabelText(/^Enterprise code/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unlock' })).not.toBeInTheDocument();
    owners.authenticatedBootstrap.mockResolvedValue({
      ...admitted,
      axisInitializationAdmission: 'READY',
    });
    await user.click(screen.getByRole('button', { name: 'Refresh status' }));
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
    expect(owners.authenticatedBootstrap).toHaveBeenCalledTimes(3);
    expect(owners.status).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
