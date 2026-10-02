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
        <button onClick={() => actions?.onEmployeeUnlock?.('fixture-password')}>
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
    await act(async () => {
      rejectUnlock(new Error('Authentication denied'));
      await Promise.resolve();
    });
    expect(await screen.findByText('Authentication denied')).toBeVisible();
    expect(window.location.pathname).toBe('/lock-screen');
    expect(screen.queryByLabelText(/^Enterprise code/)).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
