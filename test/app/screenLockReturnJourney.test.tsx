/** App lock/unlock integration: real enterprise form and shell, isolated authentication/CMS owners. */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/app/App';
import { AppProviders } from '../../src/app/AppProviders';
import type {
  AxisAuthenticatedBootstrap,
  AxisPublicBootstrap,
} from '../../src/bootstrap/publicBootstrap';
import type { CmsRendererActions } from '../../src/cms/renderers/shared/rendererTypes';
import { persistScreenLock } from '../../src/auth/screenLockState';
import {
  connection,
  runtime,
  workspace,
} from '../enterprise/enterpriseCreationCheckpointFixtures';

const owners = vi.hoisted(() => ({
  publicBootstrap: vi.fn(),
  authenticatedBootstrap: vi.fn(),
  restore: vi.fn(),
  authenticate: vi.fn(),
  status: vi.fn(),
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
      <button
        onClick={() => actions?.onEmployeeLogin?.('operator', 'fixture-password')}
      >
        Sign in
      </button>
    ) : path === '/lock-screen' ? (
      <section>
        <h1>Locked session</h1>
        <button
          aria-busy={actions?.employeeUnlockPending === true}
          onClick={() => actions?.onEmployeeUnlock?.('fixture-password')}
        >
          Unlock
        </button>
        {authenticationError && <p>{authenticationError}</p>}
      </section>
    ) : (
      <button onClick={() => void navigate('/profile/enterprises?tab=enterprises')}>
        Open enterprises
      </button>
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
  await user.click(screen.getByRole('button', { name: 'Open employee menu' }));
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
