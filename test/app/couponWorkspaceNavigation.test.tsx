/** Real App registry tests with isolated admission/renderers; no live owners. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { AppProviders } from '../../src/app/AppProviders';
import type { CmsRendererActions } from '../../src/cms/renderers/shared/rendererTypes';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../src/bootstrap/publicBootstrap';
import type { CouponWorkspaceProps } from '../../src/operations/promotions/useCouponWorkspace';
import { runtime } from '../enterprise/registrationFixtures';

const owners = vi.hoisted(() => ({
  publicBootstrap: vi.fn(),
  authenticatedBootstrap: vi.fn(),
  restore: vi.fn(),
  authenticate: vi.fn(),
  status: vi.fn(),
  authoring: vi.fn(),
  reporting: vi.fn(),
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
vi.mock('../../src/operations/promotions/CouponOfferWorkspace', () => ({
  CouponOfferWorkspace: (props: CouponWorkspaceProps) => {
    owners.authoring(props);
    return <div data-testid="coupon-authoring" />;
  },
}));
vi.mock('../../src/operations/promotions/CouponAcquisitionReportPanel', () => ({
  CouponAcquisitionReportPanel: (props: CouponWorkspaceProps) => {
    owners.reporting(props);
    return <div data-testid="coupon-reporting" />;
  },
}));
vi.mock('../../src/app/CmsRoutePage', () => ({
  CmsRoutePage: ({ path, actions }: { path: string; actions?: CmsRendererActions }) => {
    const navigate = useNavigate();
    return path === '/login' ? (
      <button
        onClick={() => actions?.onEmployeeLogin?.('operator', 'fixture-password')}
      >
        Sign in
      </button>
    ) : (
      <button onClick={() => void navigate('/commerce/coupon-fixture')}>
        Open coupon workspace
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
const modes = {
  authoring: {
    workspaceCode: 'promotion.couponOffers',
    runtimeRoleCode: 'COMMERCE_STAGED',
    publicationRole: 'STAGED',
  },
  reporting: {
    workspaceCode: 'promotion.couponAcquisition',
    runtimeRoleCode: 'COMMERCE',
    publicationRole: 'OPERATIONAL',
  },
} as const;

async function mount(
  mode: keyof typeof modes,
  alter?: (item: AxisNavigationItem) => AxisNavigationItem,
  availableOwner = true,
  connectionPublication?: string,
) {
  window.history.replaceState({}, '', '/login');
  const { workspaceCode, ...ownerSelector } = modes[mode];
  let navigation: AxisNavigationItem = {
    id: 'coupon-fixture',
    moduleName: 'promotion',
    label: 'Coupon fixture',
    route: '/commerce/coupon-fixture',
    category: 'commerce',
    icon: 'commerce',
    order: 1,
    availability: 'UP',
    featureState: 'ACTIVE',
    backendWorkspace: {
      contractVersion: 1,
      renderer: 'axis.workspace.native',
      workspaceCode,
      viewCode: mode,
      title: 'Coupon fixture',
      tabs: [],
      ownerSelector,
    },
  };
  if (alter) navigation = alter(navigation);
  const bootstrap: AxisAuthenticatedBootstrap = {
    tenantCode: 'fixture-tenant',
    navigation: [navigation],
    moduleCatalog: {},
    environments: [],
    documentationSources: [],
    axisPolicy: {
      contractVersion: 0,
      screenLockEnabled: true,
      idleTimeoutSeconds: 900,
      recentNavigationLimit: 12,
      revision: 0,
      source: 'DEFAULT',
    },
    moduleConnections: {
      promotion: [
        {
          moduleName: 'promotion',
          instanceId: 'fixture-owner',
          endpoint: 'https://promotion.example.test/nodics/promotion',
          environment: 'Local',
          state: 'UP',
          runtimeRole: {
            code: availableOwner ? ownerSelector.runtimeRoleCode : 'UNRELATED',
            publication: connectionPublication ?? ownerSelector.publicationRole,
          },
        },
      ],
    },
  };
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
  owners.restore.mockRejectedValue(new Error('No session'));
  owners.authenticate.mockResolvedValue({
    accessToken: 'original-fixture-token',
    loginId: 'operator',
    enterpriseCode: runtime.enterpriseCode,
    generation: 7,
  });
  owners.authenticatedBootstrap.mockResolvedValue(bootstrap);
  owners.status.mockResolvedValue({
    baselineCode: 'axis',
    releaseCode: 'fixture',
    releaseVersion: '1.0.0',
    releaseStatus: 'CURRENT',
    readiness: 'READY',
  });
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected transport')));
  render(
    <AppProviders runtimeConfig={runtime}>
      <App />
    </AppProviders>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Sign in' }));
  await user.click(
    await screen.findByRole('button', { name: 'Open coupon workspace' }),
  );
  await waitFor(() => expect(window.location.pathname).toBe(navigation.route));
  return bootstrap;
}

it.each(['authoring', 'reporting'] as const)(
  'dispatches the exact %s workspace and forwards original authority',
  async (mode) => {
    const bootstrap = await mount(mode);
    expect(await screen.findByTestId('coupon-' + mode)).toBeInTheDocument();
    expect(owners[mode]).toHaveBeenLastCalledWith(
      expect.objectContaining({
        bootstrap,
        runtime,
        accessToken: 'original-fixture-token',
        sessionGeneration: 7,
      }),
    );
    expect(
      owners[mode === 'authoring' ? 'reporting' : 'authoring'],
    ).not.toHaveBeenCalled();
  },
);

const denied: Array<[string, (item: AxisNavigationItem) => AxisNavigationItem]> = [
  ['foreign module', (item) => ({ ...item, moduleName: 'digitalCore' })],
  [
    'unknown workspace',
    (item) => ({
      ...item,
      backendWorkspace: {
        ...item.backendWorkspace!,
        workspaceCode: 'promotion.unknown',
      },
    }),
  ],
  [
    'wrong view',
    (item) => ({
      ...item,
      backendWorkspace: { ...item.backendWorkspace!, viewCode: 'unknown' },
    }),
  ],
  [
    'missing selector',
    (item) => ({
      ...item,
      backendWorkspace: { ...item.backendWorkspace!, ownerSelector: undefined },
    }),
  ],
  [
    'wrong runtime role',
    (item) => ({
      ...item,
      backendWorkspace: {
        ...item.backendWorkspace!,
        ownerSelector: {
          ...item.backendWorkspace!.ownerSelector,
          runtimeRoleCode: 'UNRELATED',
        },
      },
    }),
  ],
  [
    'wrong publication',
    (item) => ({
      ...item,
      backendWorkspace: {
        ...item.backendWorkspace!,
        ownerSelector: {
          ...item.backendWorkspace!.ownerSelector,
          publicationRole: 'OTHER',
        },
      },
    }),
  ],
  ['disabled feature', (item) => ({ ...item, featureState: 'DISABLED' })],
  ['unavailable owner', (item) => ({ ...item, availability: 'UNAVAILABLE' })],
];
it.each(denied)('does not mount coupon renderers for %s', async (_label, alter) => {
  await mount('authoring', alter);
  expect(owners.authoring).not.toHaveBeenCalled();
  expect(owners.reporting).not.toHaveBeenCalled();
});
it.each(['authoring', 'reporting'] as const)(
  'does not fall back to an unqualified connection for %s',
  async (mode) => {
    await mount(mode, undefined, false);
    expect(owners.authoring).not.toHaveBeenCalled();
    expect(owners.reporting).not.toHaveBeenCalled();
  },
);

it('rejects an ONLINE report descriptor rather than treating it as operational', async () => {
  await mount(
    'reporting',
    (item) => ({
      ...item,
      backendWorkspace: {
        ...item.backendWorkspace!,
        ownerSelector: { runtimeRoleCode: 'COMMERCE', publicationRole: 'ONLINE' },
      },
    }),
    true,
    'ONLINE',
  );
  expect(owners.reporting).not.toHaveBeenCalled();
});

it('does not select an ONLINE connection for the operational report', async () => {
  await mount('reporting', undefined, true, 'ONLINE');
  expect(owners.reporting).not.toHaveBeenCalled();
});
