/** Real App dispatch and GET-only listing mount; authentication/CMS are isolated fixtures. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { AppProviders } from '../../src/app/AppProviders';
import type { CmsRendererActions } from '../../src/cms/renderers/shared/rendererTypes';
import { runtime } from '../enterprise/registrationFixtures';
import {
  configuration,
  listing,
  presentation,
} from '../wasteManagement/listingFixtures';

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
  CmsRoutePage: ({ path, actions }: { path: string; actions?: CmsRendererActions }) => {
    const navigate = useNavigate();
    return path === '/login' ? (
      <button
        onClick={() =>
          actions?.onEmployeeLogin?.('synthetic-operator', 'synthetic-password')
        }
      >
        Sign in
      </button>
    ) : (
      <button
        onClick={() => void navigate('/waste/assets/electronics/listing-requests')}
      >
        Open contributed listing
      </button>
    );
  },
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

it('mounts the advertised Waste listing view through the real authenticated App route', async () => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/login');
  const selectedRuntime = { ...runtime, enterpriseCode: configuration.enterpriseCode };
  owners.publicBootstrap.mockResolvedValue({
    contractVersion: 1,
    clientContractVersion: 1,
    endpoints: {
      profile: 'https://profile.example.test/nodics/profile',
      cms: 'https://cms.example.test',
    },
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
  });
  owners.restore.mockRejectedValue(new Error('No prior session'));
  owners.authenticate.mockResolvedValue({
    accessToken: configuration.accessToken,
    loginId: 'synthetic-operator',
    enterpriseCode: selectedRuntime.enterpriseCode,
    generation: 1,
  });
  owners.authenticatedBootstrap.mockResolvedValue({
    ...configuration.bootstrap,
    navigation: [
      {
        id: 'ewaste-operations-listing-requests',
        moduleName: 'eWaste',
        label: 'Listing requests',
        route: '/waste/assets/electronics/listing-requests',
        category: 'waste',
        icon: 'waste',
        order: 40,
        availability: 'UP',
        featureState: 'ACTIVE',
        backendWorkspace: {
          contractVersion: 1,
          renderer: 'axis.workspace.native',
          workspaceCode: 'waste.listing',
          viewCode: 'ewaste.listingRequests',
          title: 'Electronics listing requests',
          tabs: [],
        },
      },
    ],
  });
  owners.status.mockResolvedValue({
    baselineCode: 'axis',
    releaseCode: 'synthetic',
    releaseVersion: '1.0.0',
    releaseStatus: 'CURRENT',
    readiness: 'READY',
  });
  const fetcher = vi.fn<typeof fetch>().mockImplementation((input) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: url.endsWith('/listing-workspace')
            ? {
                contractVersion: 1,
                workspaceCode: 'waste.listing',
                viewCode: 'ewaste.listingRequests',
                presentation,
              }
            : { contractVersion: 1, items: [listing], total: 1, page: 1, limit: 25 },
        }),
        { status: 200 },
      ),
    );
  });
  vi.stubGlobal('fetch', fetcher);
  render(
    <AppProviders runtimeConfig={selectedRuntime}>
      <App />
    </AppProviders>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Sign in' }));
  await user.click(
    await screen.findByRole('button', { name: 'Open contributed listing' }),
  );
  const table = await screen.findByRole('table', { name: presentation.labels.title });
  expect(within(table).getByText('SYNTHETIC_ASSET')).toBeVisible();
  expect(window.location.pathname).toBe('/waste/assets/electronics/listing-requests');
  expect(fetcher).toHaveBeenCalledTimes(2);
  for (const [, init] of fetcher.mock.calls) {
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
  }
});
