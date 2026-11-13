import { EnterpriseDisplayContext } from './EnterpriseDisplayContext';
import { useCurrentEnterpriseDisplay } from '../bootstrap/useCurrentEnterpriseDisplay';
import {
  useInvitedEmployeeRegistrationEntry,
  INVITED_EMPLOYEE_REGISTRATION_ROUTE,
} from '../auth/useInvitedEmployeeRegistrationEntry';
import {
  readEnterpriseContext,
  rememberEnterpriseContext,
  clearEnterpriseContext,
  registrationSignInContext,
  enterpriseContextCode,
} from '../auth/enterpriseSessionContext';
import { wasteOverviewAliases } from '../operations/wasteManagement/wasteOverviewAliases';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Stack } from '@mui/material';

import {
  authenticateEmployee,
  logoutEmployee,
  restoreEmployeeSession,
  switchEmployeeEnterprise,
  type EmployeeSession,
} from '../auth/employeeAuthClient';
import { subscribeEmployeeSessionExpired } from '../auth/employeeSessionEvents';
import {
  loadAuthenticatedBootstrap,
  loadPublicBootstrap,
  PublicBootstrapUnavailableError,
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisEmployeePolicy,
  type AxisNavigationItem,
  type AxisPublicBootstrap,
} from '../bootstrap/publicBootstrap';
import {
  NavigationAvailabilityRecoveryContext,
  hasUnavailableBootstrap,
  hasUnavailableNavigation,
  useNavigationAvailabilityRecovery,
} from '../bootstrap/useNavigationAvailabilityRecovery';
import { AssistantRoutePage } from '../assistant/AssistantRoutePage';
import { CopilotWorkspaceRoutePage } from '../assistant/CopilotWorkspaceRoutePage';
import { CopilotActivityRoutePage } from '../assistant/CopilotActivityRoutePage';
import { CopilotUsageRoutePage } from '../assistant/CopilotUsageRoutePage';
import { WorkbenchRoutePage } from '../workbench/WorkbenchRoutePage';
import {
  EnterpriseCreationCheckpoint,
  enterpriseCreationReturnPath,
} from '../operations/enterprise/enterpriseCreationCheckpoint';
import { DocumentationRoutePage } from '../documentation/DocumentationRoutePage';
import { useOnlineDocumentationGuides } from '../bootstrap/onlineDocumentationGuides';
import { OnlineHelpPathsContext } from './help/workspaceHelpModel';
import type { DocumentationPublicationStatus } from '../documentation/api/documentationPublicationClient';
import { isDocumentationNavigationItem } from '../bootstrap/documentationGuides';
import { ModuleHealthRoutePage } from '../operations/moduleHealth/ModuleHealthRoutePage';
import { SystemIntegrationsDashboardRoutePage } from '../operations/systemIntegrations/SystemIntegrationsDashboardRoutePage';
import { CronDashboardRoutePage } from '../operations/cron/CronDashboardRoutePage';
import { ContentDashboardRoutePage } from '../operations/contentExperience/ContentDashboardRoutePage';
import { PublishingDashboardRoutePage } from '../operations/contentExperience/PublishingDashboardRoutePage';
import { PublishingRouteGuidancePage } from '../operations/contentExperience/PublishingRouteGuidancePage';
import { DocumentationManagementRoutePage } from '../operations/documentationManagement/DocumentationManagementRoutePage';
import { ComplianceManagementRoutePage } from '../operations/compliance/ComplianceManagementRoutePage';
import { NotificationManagementRoutePage } from '../operations/notifications/NotificationManagementRoutePage';
import { OrderLifecycleManagementRoutePage } from '../operations/orderLifecycle/OrderLifecycleManagementRoutePage';
import { MediaManagementDashboardRoutePage } from '../operations/mediaManagement/MediaManagementDashboardRoutePage';
import { MediaManagementRoutePage } from '../operations/mediaManagement/MediaManagementRoutePage';
import { ProcessWorkflowRoutePage } from '../operations/processWorkflow/ProcessWorkflowRoutePage';
import { ProductSellabilityWorkspace } from '../operations/productManagement/ProductSellabilityWorkspace';
import { DiscoveryManagementRoutePage } from '../operations/discovery/DiscoveryManagementRoutePage';
import { MerchantRedemptionPanel } from '../operations/promotions/MerchantRedemptionPanel';
import { CouponOfferWorkspace } from '../operations/promotions/CouponOfferWorkspace';
import { CouponAcquisitionReportPanel } from '../operations/promotions/CouponAcquisitionReportPanel';
import { LocalizationOperationsRoutePage } from '../operations/localization/LocalizationOperationsRoutePage';
import { CustomerEngagementRoutePage } from '../operations/customerEngagement/CustomerEngagementRoutePage';
import { SetupAcceleratorsRoutePage } from '../operations/setupAccelerators/SetupAcceleratorsRoutePage';
import { WasteManagementRoutePage } from '../operations/wasteManagement/WasteManagementRoutePage';
import { CommercialAgreementRoutePage } from '../operations/commercialAgreement/CommercialAgreementRoutePage';
import { admitsAgreementWorkspace } from '../operations/commercialAgreement/agreementClient';
import { LoyaltyParticipationRoutePage } from '../operations/loyaltyParticipation/LoyaltyParticipationRoutePage';
import { DigitalParticipationRoutePage } from '../operations/digitalParticipation/DigitalParticipationRoutePage';
import { admitsParticipation } from '../operations/digitalParticipation/participationClient';
import { loyaltyView } from '../operations/loyaltyParticipation/loyaltyClient';
import { EnterpriseRelationshipsRoutePage } from '../operations/enterprise/EnterpriseRelationshipsRoutePage';
import { EnterpriseTeamRoutePage } from '../operations/enterprise/EnterpriseTeamRoutePage';
import { EnterpriseRecoveryRoutePage } from '../operations/enterprise/EnterpriseRecoveryRoutePage';
import { CustomerParticipationRoutePage } from '../operations/enterprise/CustomerParticipationRoutePage';
import { ApplicationRecoveryRoutePage } from '../operations/enterprise/ApplicationRecoveryRoutePage';
import { EnterpriseAdministrationRoutePage } from '../operations/enterprise/EnterpriseAdministrationRoutePage';
import { OrderNotificationRoutePage } from '../operations/notifications/OrderNotificationRoutePage';
import { EnterpriseMembershipRoutePage } from '../operations/enterprise/EnterpriseMembershipRoutePage';
import type { EnterpriseMembership } from '../operations/enterprise/api/enterpriseMembershipClient';
import { useIdleScreenLock } from '../auth/useIdleScreenLock';
import { AxisInitializationWorkspace } from '../initialization/AxisInitializationWorkspace';
import { useInitializationApproval } from '../initialization/useInitializationApproval';
import { BundledLoginPage } from '../initialization/BundledLoginPage';
import {
  initiateAxisInitialization,
  loadAxisInitializationStatus,
  AxisInitializationUnavailableError,
  type AxisInitializationStatus,
} from '../initialization/axisInitializationClient';
import {
  completeProcessTask,
  loadProcessTasks,
} from '../operations/processWorkflow/api/processDefinitionClient';
import { processApprovalUnavailableMessage } from '../operations/processWorkflow/processApprovalDiagnostics';
import {
  clearScreenLock,
  persistScreenLock,
  screenLockReturnLocation,
  restoreScreenLock,
} from '../auth/screenLockState';
import type { CmsRendererActions } from '../cms/renderers/shared/rendererTypes';
import {
  AxisLocalizationBoundary,
  useAxisLocalizationController,
} from '../localization/AxisLocalizationContext';
import {
  RuntimeConfigContext,
  useRuntimeConfig,
} from '../runtime/RuntimeConfigContext';
import {
  BackendOperationsWorkspaceRoutePage,
  type BackendOperationsWorkspaceRoutePageProps,
  PublicBackendOperationsWorkspaceRoutePage,
} from './BackendOperationsWorkspaceRoutePage';
import { CmsRoutePage } from './CmsRoutePage';
import { EmployeeRegistrationRoutePage } from '../operations/enterprise/registration/EmployeeRegistrationRoutePage';
import { EnterpriseManagementRoutePage } from '../operations/enterprise/EnterpriseManagementRoutePage';
import { LoadingScreen } from './LoadingScreen';
import { CmsRenderBoundary } from '../cms/renderers/shared/CmsRenderBoundary';
import { ModuleWorkspacePlaceholder } from './ModuleWorkspacePlaceholder';
import { UnavailableWorkspaceRoutePage } from './UnavailableWorkspaceRoutePage';
import { RecoveryScreen } from './RecoveryScreen';
import { OperationalReadinessInspector } from '../bootstrap/OperationalReadinessInspector';
import { AppShell } from './shell/AppShell';
import { canRenderWorkbenchNavigation } from './workbenchNavigationPolicy';

const ApplicationBuilderRoutePage = lazy(() =>
  import('../operations/applicationBuilder/ApplicationBuilderRoutePage').then(
    (module) => ({ default: module.ApplicationBuilderRoutePage }),
  ),
);
const ContentDesignerRoutePage = lazy(() =>
  import('../operations/contentExperience/ContentDesignerRoutePage').then((module) => ({
    default: module.ContentDesignerRoutePage,
  })),
);
const WcmsExperienceStudioRoutePage = lazy(() =>
  import('../operations/contentExperience/WcmsExperienceStudioRoutePage').then(
    (module) => ({ default: module.WcmsExperienceStudioRoutePage }),
  ),
);
const RulesManagementRoutePage = lazy(() =>
  import('../operations/rulesManagement/RulesManagementRoutePage').then((module) => ({
    default: module.RulesManagementRoutePage,
  })),
);
const KnowledgeStudioRoutePage = lazy(() =>
  import('../assistant/KnowledgeStudioRoutePage').then((module) => ({
    default: module.KnowledgeStudioRoutePage,
  })),
);
const CopilotAdministrationRoutePage = lazy(() =>
  import('../assistant/CopilotAdministrationRoutePage').then((module) => ({
    default: module.CopilotAdministrationRoutePage,
  })),
);
const ProductManagementRoutePage = lazy(() =>
  import('../operations/productManagement/ProductManagementRoutePage').then(
    (module) => ({ default: module.ProductManagementRoutePage }),
  ),
);
const ProductWorkbenchRoutePage = lazy(() =>
  import('../operations/productManagement/ProductWorkbenchRoutePage').then(
    (module) => ({ default: module.ProductWorkbenchRoutePage }),
  ),
);
const PromotionsBuilderRoutePage = lazy(() =>
  import('../operations/promotions/PromotionsBuilderRoutePage').then((module) => ({
    default: module.PromotionsBuilderRoutePage,
  })),
);
const ImportExportRoutePage = lazy(() =>
  import('../operations/importExport/ImportExportRoutePage').then((module) => ({
    default: module.ImportExportRoutePage,
  })),
);
const NavigationCompositionRoutePage = lazy(() =>
  import('../operations/navigationComposition/NavigationCompositionRoutePage').then(
    (module) => ({ default: module.NavigationCompositionRoutePage }),
  ),
);
const FunctionalModuleRegistryRoutePage = lazy(() =>
  import('../operations/moduleRegistry/FunctionalModuleRegistryRoutePage').then(
    (module) => ({ default: module.FunctionalModuleRegistryRoutePage }),
  ),
);
const LocationMapConfigurationRoutePage = lazy(() =>
  import('../operations/location/LocationMapConfigurationRoutePage').then((module) => ({
    default: module.LocationMapConfigurationRoutePage,
  })),
);
const CollectionCentresRoutePage = lazy(() =>
  import('../operations/location/CollectionCentresRoutePage').then((module) => ({
    default: module.CollectionCentresRoutePage,
  })),
);
const RuntimeConfigurationRoutePage = lazy(() =>
  import('../operations/runtimeConfiguration/RuntimeConfigurationRoutePage').then(
    (module) => ({ default: module.RuntimeConfigurationRoutePage }),
  ),
);

const axisDashboardRoute = '/dashboard';
const axisInitializationRoute = '/initialize-axis';
const documentationDesignerRoute = '/docs/designer';
const legacyDocumentationDesignerRoute = '/content/designer/documentation';

function documentationDesignerRedirect(path: string): string {
  return `${documentationDesignerRoute}${path.slice(legacyDocumentationDesignerRoute.length)}`;
}

function normalizeRoutePath(path: string): string {
  return path.replace(/\/$/, '') || '/';
}

const documentationPublicationQueryKey = (
  enterpriseCode: string,
  profileCode: string,
) => ['documentation-publication', enterpriseCode, profileCode] as const;

function safeReturnPath(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return undefined;
  if (
    ['/login', '/forgot-password', '/lock-screen', axisInitializationRoute].includes(
      value,
    )
  ) {
    return undefined;
  }
  return value;
}

/** Retains only an inert pathname across transient initialization reads; destination admission remains authoritative. */
function initializationReturnPath(state: unknown): string | undefined {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return undefined;
  const path = (state as Record<string, unknown>).axisInitializationReturnPath;
  if (
    typeof path !== 'string' ||
    path.length > 512 ||
    !/^\/[A-Za-z0-9_~./-]+$/.test(path) ||
    path.includes('//') ||
    path.split('/').some((segment) => segment === '.' || segment === '..') ||
    path === '/' ||
    path === axisInitializationRoute ||
    path.startsWith(`${axisInitializationRoute}/`)
  )
    return undefined;
  return safeReturnPath(path);
}

function resolveCurrentNavigation(
  navigation: readonly AxisNavigationItem[] | undefined,
  pathname: string,
  hash = '',
): AxisNavigationItem | undefined {
  if (!navigation) return undefined;
  const exact = navigation.find((item) => item.route === `${pathname}${hash}`);
  if (exact) return exact;
  const normalizedPath = normalizeRoutePath(pathname);
  return navigation
    .filter((item) => {
      const route = normalizeRoutePath(item.route);
      return normalizedPath === route || normalizedPath.startsWith(`${route}/`);
    })
    .sort(
      (left, right) =>
        normalizeRoutePath(right.route).length -
          normalizeRoutePath(left.route).length || right.order - left.order,
    )[0];
}

function resolveCurrentWorkbenchNavigation(
  navigation: readonly AxisNavigationItem[] | undefined,
  pathname: string,
): AxisNavigationItem | undefined {
  if (!navigation) return undefined;
  const normalizedPath = normalizeRoutePath(pathname);
  return navigation
    .filter((item) => {
      if (!item.workbenchTarget) return false;
      const route = normalizeRoutePath(item.route);
      return normalizedPath === route || normalizedPath.startsWith(`${route}/`);
    })
    .sort(
      (left, right) =>
        normalizeRoutePath(right.route).length -
          normalizeRoutePath(left.route).length || right.order - left.order,
    )[0];
}

/** Recognizes only Profile's declared native fresh-definition task, not another module's matching code. */
function isEnterpriseManagementNavigation(item: AxisNavigationItem): boolean {
  return (
    item.moduleName === 'profile' &&
    item.backendWorkspace?.renderer === 'axis.workspace.native' &&
    item.backendWorkspace.workspaceCode === 'profile.enterpriseManagement' &&
    item.backendWorkspace.viewCode === 'administration'
  );
}

/** Preserves the existing generic command/checkpoint props when a Profile task first loads fresh definitions. */
function BackendWorkspaceEntry({
  navigationItem,
  ...props
}: BackendOperationsWorkspaceRoutePageProps & {
  readonly navigationItem: AxisNavigationItem;
}) {
  const Page = isEnterpriseManagementNavigation(navigationItem)
    ? EnterpriseManagementRoutePage
    : BackendOperationsWorkspaceRoutePage;
  return <Page {...props} />;
}

function isOrderLifecycleNavigation(item: AxisNavigationItem | undefined): boolean {
  if (!item) return false;
  if (item.group?.id === 'order-lifecycle-operations') return true;
  if (item.id.startsWith('order-lifecycle-')) return true;
  return [
    'order-cancellations',
    'order-returns',
    'order-refunds',
    'order-exchanges',
    'order-replacements',
    'order-appeals',
  ].includes(item.id);
}

export function App() {
  const baseRuntime = useRuntimeConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [attempt, setAttempt] = useState(0);
  const [bootstrap, setBootstrap] = useState<AxisPublicBootstrap>();
  const [bootstrapError, setBootstrapError] = useState<string>();
  const [discoveryReconnecting, setDiscoveryReconnecting] = useState(false);
  const publicDiscoveryInFlight = useRef<Promise<AxisPublicBootstrap> | undefined>(
    undefined,
  );
  const [session, setSession] = useState<EmployeeSession>();
  const [enterpriseCreationCheckpoint] = useState(
    () => new EnterpriseCreationCheckpoint(),
  );
  const sessionInvalidated = useRef(false);
  const admittedSession = useRef<EmployeeSession | undefined>(undefined);
  const availabilityReadSequence = useRef(0);
  const loginAttempt = useRef<object | undefined>(undefined);
  const [loginPending, setLoginPending] = useState(false);
  const unlockAttempt = useRef<object | undefined>(undefined);
  const [unlockPending, setUnlockPending] = useState(false);
  const [lockedReturnPath, setLockedReturnPath] = useState(axisDashboardRoute);
  const retireUnlock = useCallback(() => {
    unlockAttempt.current = undefined;
    setUnlockPending(false);
  }, []);
  const retireLogin = useCallback(() => {
    loginAttempt.current = undefined;
    setLoginPending(false);
  }, []);
  const updateSession = useCallback(
    (value: EmployeeSession | undefined, preserveContext = false) => {
      retireLogin();
      retireUnlock();
      if (!preserveContext) {
        enterpriseCreationCheckpoint.clear();
        setLockedReturnPath(axisDashboardRoute);
      }
      if (value) sessionInvalidated.current = false;
      admittedSession.current = value;
      availabilityReadSequence.current += 1;
      setSession(value);
    },
    [enterpriseCreationCheckpoint, retireLogin, retireUnlock],
  );
  const [authenticatedBootstrap, setAuthenticatedBootstrap] =
    useState<AxisAuthenticatedBootstrap>();
  const [employeePolicy, setEmployeePolicy] = useState<AxisEmployeePolicy>();
  const [locked, setLocked] = useState(false);
  const [authenticationError, setAuthenticationError] = useState<string>();
  const [initializationStatus, setInitializationStatus] =
    useState<AxisInitializationStatus>();
  const [initializationError, setInitializationError] = useState<string>();
  const [initializationBusy, setInitializationBusy] = useState(false);
  const initializationReadSequence = useRef(0);
  const initializationRecoveryDeadline = useRef<number | undefined>(undefined);
  const [initializationRecoveryAttempt, setInitializationRecoveryAttempt] = useState(0);
  const [initializationStatusUnavailable, setInitializationStatusUnavailable] =
    useState(false);
  const [restoringSession, setRestoringSession] = useState(true);
  const [restorePhase, setRestorePhase] = useState<'profile' | 'workspace'>('profile');
  const [restoreError, setRestoreError] = useState<string>();
  const [switchingContext, setSwitchingContext] = useState(false);
  const contextTransition = useRef(false);
  const lifetime = useRef({ active: true });
  useEffect(() => {
    const state = lifetime.current;
    state.active = true;
    return () => {
      state.active = false;
      loginAttempt.current = undefined;
    };
  }, []);
  // Routing context never changes project endpoints or constitutes a grant.
  const selectedEnterprise =
    session?.enterpriseCode ??
    registrationSignInContext(location.pathname, location.state) ??
    readEnterpriseContext(baseRuntime.backofficeBaseUrl) ??
    baseRuntime.enterpriseCode;
  const runtime = useMemo(
    () =>
      selectedEnterprise === baseRuntime.enterpriseCode
        ? baseRuntime
        : { ...baseRuntime, enterpriseCode: selectedEnterprise },
    [baseRuntime, selectedEnterprise],
  );
  const enterpriseDisplay = useCurrentEnterpriseDisplay({
    bootstrap: authenticatedBootstrap,
    runtime,
    accessToken: session?.accessToken,
    generation: session?.generation,
    active: Boolean(
      session &&
      authenticatedBootstrap &&
      !locked &&
      !restoringSession &&
      !switchingContext,
    ),
  });
  const localization = useAxisLocalizationController(bootstrap, runtime);
  const employeeRegistrationEntry = useInvitedEmployeeRegistrationEntry({
    runtime: baseRuntime,
    profileBaseUrl: bootstrap?.endpoints.profile,
    available: bootstrap?.invitedEmployeeRegistrationAvailable === true,
    enabled:
      !session &&
      !restoringSession &&
      !bootstrapError &&
      !restoreError &&
      !loginPending &&
      location.pathname === '/login',
    scope: location.key,
  });
  // Retire before paint on any router navigation, including same-path search/state changes.
  useLayoutEffect(() => {
    retireLogin();
    return () => {
      loginAttempt.current = undefined;
    };
  }, [runtime, bootstrap?.endpoints.profile, location.key, retireLogin]);
  const currentRoutePath = sessionInvalidated.current
    ? location.pathname
    : `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + (runtime.publicDiscoveryRetryWindowMs ?? 300_000);
    const discover = async (retryIndex: number) => {
      // A manual retry or effect replacement waits for any outstanding GET.
      await publicDiscoveryInFlight.current?.catch(() => undefined);
      if (!active) return;
      const request = loadPublicBootstrap(
        runtime.backofficeBaseUrl,
        runtime.clientContractVersion,
        runtime.requestTimeoutMs,
      );
      publicDiscoveryInFlight.current = request;
      try {
        const value = await request;
        if (active) {
          setBootstrap(value);
          setBootstrapError(undefined);
          setDiscoveryReconnecting(false);
        }
      } catch (failure: unknown) {
        if (!active) return;
        setBootstrapError(
          failure instanceof Error ? failure.message : 'BackOffice discovery failed',
        );
        const delay = Math.min(1000 * 2 ** Math.min(retryIndex, 4), 10_000);
        const shouldRetry =
          failure instanceof PublicBootstrapUnavailableError &&
          Date.now() + delay <= deadline;
        setDiscoveryReconnecting(shouldRetry);
        if (shouldRetry)
          timer = setTimeout(() => {
            void discover(retryIndex + 1);
          }, delay);
      } finally {
        if (publicDiscoveryInFlight.current === request)
          publicDiscoveryInFlight.current = undefined;
      }
    };
    void discover(0);
    return () => {
      active = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [
    attempt,
    runtime.backofficeBaseUrl,
    runtime.clientContractVersion,
    runtime.requestTimeoutMs,
    runtime.publicDiscoveryRetryWindowMs,
  ]);

  // Route changes do not rotate Profile proof again; completion uses the latest route.
  const finishRestoreNavigation = useEffectEvent(() => {
    const persistedLock = restoreScreenLock();
    if (persistedLock) {
      // A new internal entry is explicit navigation, not a restoration from private storage.
      // Keep it volatile until the existing same-context unlock and route admission succeed.
      const usesStoredDestination = [
        '/',
        '/login',
        '/forgot-password',
        '/lock-screen',
        bootstrap?.uiComposition.defaultPublicPage,
      ].includes(location.pathname);
      setLockedReturnPath(
        usesStoredDestination
          ? persistedLock.returnPath
          : screenLockReturnLocation(location.pathname, location.search, location.hash),
      );
      setLocked(true);
      void navigate('/lock-screen', { replace: true });
    } else if (!['/', '/login', '/forgot-password'].includes(location.pathname)) {
      void navigate(currentRoutePath, { replace: true });
    }
  });

  useEffect(() => {
    if (!bootstrap || !restoringSession) return;
    let active = true;
    let profileRestored = false;
    setRestorePhase('profile');
    void restoreEmployeeSession(
      bootstrap.endpoints.profile,
      runtime.enterpriseCode,
      runtime.browserSessionCsrfCookieName,
      runtime.browserSessionTimeoutMs,
    )
      .then(async (nextSession) => {
        if (!active) return;
        profileRestored = true;
        setRestorePhase('workspace');
        const employeeBootstrap = await loadAuthenticatedBootstrap(
          runtime.backofficeBaseUrl,
          runtime.clientContractVersion,
          nextSession.accessToken,
          runtime.requestTimeoutMs,
        );
        if (!active) return;
        queryClient.clear();
        rememberEnterpriseContext(runtime.backofficeBaseUrl, runtime.enterpriseCode);
        updateSession(nextSession);
        setAuthenticatedBootstrap(employeeBootstrap);
        setEmployeePolicy(employeeBootstrap.axisPolicy);
        finishRestoreNavigation();
      })
      .catch((error: unknown) => {
        if (active) {
          queryClient.clear();
          updateSession(undefined);
          setAuthenticatedBootstrap(undefined);
          setEmployeePolicy(undefined);
          if (profileRestored)
            setRestoreError(
              error instanceof Error
                ? error.message
                : 'BackOffice could not load your authorized workspace.',
            );
        }
      })
      .finally(() => {
        if (active) setRestoringSession(false);
      });
    return () => {
      active = false;
    };
  }, [bootstrap, restoringSession, runtime, queryClient, updateSession]);

  const lockScreen = useCallback(() => {
    if (!session || locked) return;
    availabilityReadSequence.current += 1;
    const persistedReturnPath = ['/login', '/forgot-password', '/lock-screen'].includes(
      location.pathname,
    )
      ? axisDashboardRoute
      : enterpriseCreationReturnPath(
          location.pathname,
          location.search,
          authenticatedBootstrap?.navigation.find(
            (item) => item.moduleName === 'profile' && item.route === location.pathname,
          )?.backendWorkspace,
        );
    setLockedReturnPath(
      screenLockReturnLocation(location.pathname, location.search, location.hash),
    );
    // Durable presentation state keeps its existing restricted path; private detail references stay in memory.
    persistScreenLock(persistedReturnPath);
    setAuthenticationError(undefined);
    setLocked(true);
    void navigate('/lock-screen', { replace: true });
  }, [
    location.pathname,
    location.search,
    location.hash,
    authenticatedBootstrap,
    locked,
    navigate,
    session,
  ]);

  useIdleScreenLock(
    Boolean(session) && !locked && employeePolicy?.screenLockEnabled === true,
    employeePolicy?.idleTimeoutSeconds ?? 900,
    lockScreen,
  );

  const refreshAuthenticatedBootstrap = useCallback(async () => {
    if (!session || locked) return;
    const originalSession = session;
    const sequence = ++availabilityReadSequence.current;
    const employeeBootstrap = await loadAuthenticatedBootstrap(
      runtime.backofficeBaseUrl,
      runtime.clientContractVersion,
      session.accessToken,
      runtime.requestTimeoutMs,
    );
    if (
      !lifetime.current.active ||
      contextTransition.current ||
      admittedSession.current !== originalSession ||
      sequence !== availabilityReadSequence.current
    )
      return;
    setAuthenticatedBootstrap(employeeBootstrap);
    setEmployeePolicy(employeeBootstrap.axisPolicy);
  }, [locked, runtime, session]);

  const onlineGuides = useOnlineDocumentationGuides(
    authenticatedBootstrap,
    runtime,
    session?.accessToken,
    session?.loginId,
    !locked,
  );
  const importedNavigation = onlineGuides.isSuccess
    ? onlineGuides.data.navigation
    : undefined;
  const onlineHelpPaths = useMemo(() => {
    const catalogue = onlineGuides.data;
    return catalogue
      ? new Set([
          '/docs',
          ...catalogue.navigation.map((entry) => entry.route),
          ...catalogue.guides.flatMap((guide) => [
            guide.route,
            ...guide.topics.map((topic) => topic.route),
          ]),
        ])
      : undefined;
  }, [onlineGuides.data]);
  const shellNavigation = useMemo(() => {
    if (!authenticatedBootstrap) return undefined;
    // BackOffice owns management navigation. Only CMS Online can supply reader entries.
    const base = authenticatedBootstrap.navigation.filter((item) => {
      const [route, search] = item.route.split('?');
      const path = normalizeRoutePath(route ?? '');
      if (path === '/docs') {
        const query = new URLSearchParams(search);
        return !query.has('guide') && !query.has('project');
      }
      return (
        !path.startsWith('/docs/') ||
        path === documentationDesignerRoute ||
        path.startsWith(documentationDesignerRoute + '/')
      );
    });
    return [
      ...base,
      ...(importedNavigation ?? []).map(
        (item): AxisNavigationItem => ({
          ...item,
          moduleName: 'cms',
          category: 'documentation',
          icon: 'content',
          availability: 'UP',
          group: { id: 'documentation', label: 'Documentation', order: 1600 },
        }),
      ),
    ];
  }, [authenticatedBootstrap, importedNavigation]);

  const refreshDocumentationNavigation = useCallback(
    async (status: DocumentationPublicationStatus) => {
      queryClient.setQueryData(
        documentationPublicationQueryKey(runtime.enterpriseCode, status.profileCode),
        status,
      );
      await queryClient.invalidateQueries({
        queryKey: documentationPublicationQueryKey(
          runtime.enterpriseCode,
          status.profileCode,
        ),
        exact: true,
      });
      await queryClient.invalidateQueries({
        queryKey: ['online-documentation-guides', runtime.enterpriseCode],
      });
      await refreshAuthenticatedBootstrap();
    },
    [queryClient, refreshAuthenticatedBootstrap, runtime.enterpriseCode],
  );

  const refreshInitialization = useCallback(
    async (background = false, bootstrapAlreadyFresh = false) => {
      if (!session) return;
      const sequence = ++initializationReadSequence.current;
      if (!background) {
        setInitializationBusy(true);
        setInitializationError(undefined);
      }
      try {
        const status = await loadAxisInitializationStatus(
          runtime.backofficeBaseUrl,
          session.accessToken,
          runtime.requestTimeoutMs,
        );
        if (sequence !== initializationReadSequence.current) return;
        setInitializationStatus(status);
        setInitializationStatusUnavailable(false);
        if (initializationRecoveryDeadline.current !== undefined)
          setInitializationError(undefined);
        initializationRecoveryDeadline.current = undefined;
        setInitializationRecoveryAttempt(0);
        if (status.readiness === 'READY') {
          setInitializationError(undefined);
          if (!bootstrapAlreadyFresh) await refreshAuthenticatedBootstrap();
        }
      } catch (error: unknown) {
        if (sequence !== initializationReadSequence.current) return;
        setInitializationStatusUnavailable(true);
        const transient = error instanceof AxisInitializationUnavailableError;
        if (transient && initializationRecoveryDeadline.current === undefined)
          initializationRecoveryDeadline.current =
            Date.now() + (runtime.publicDiscoveryRetryWindowMs ?? 300_000);
        const recovering =
          transient &&
          Date.now() + 5_000 <= (initializationRecoveryDeadline.current ?? 0);
        setInitializationRecoveryAttempt((current) => (recovering ? current + 1 : 0));
        setInitializationError(
          recovering
            ? 'Setup services are still connecting. Status will refresh automatically.'
            : error instanceof Error
              ? error.message
              : 'Axis initialization status failed',
        );
      } finally {
        if (!background) setInitializationBusy(false);
      }
    },
    [runtime, session, refreshAuthenticatedBootstrap],
  );

  const initializationApproval = useInitializationApproval(
    initializationStatus,
    authenticatedBootstrap,
    session?.accessToken,
    runtime.enterpriseCode,
    runtime.requestTimeoutMs,
    initializationStatusUnavailable,
  );

  const approveInitialization = useCallback(async () => {
    if (
      initializationBusy ||
      initializationStatusUnavailable ||
      !initializationApproval.eligible
    )
      return;
    const workflowRef = initializationStatus?.publication?.workflowRef;
    if (!session) {
      setInitializationError('Sign in again before approving the Axis baseline.');
      return;
    }
    if (!workflowRef) {
      setInitializationError(
        processApprovalUnavailableMessage({
          sourceLabel: 'Axis baseline',
          hasProcessConnection: true,
          workflowRef,
        }),
      );
      return;
    }
    initializationReadSequence.current += 1;
    setInitializationBusy(true);
    setInitializationError(undefined);
    try {
      const latestBootstrap = await loadAuthenticatedBootstrap(
        runtime.backofficeBaseUrl,
        runtime.clientContractVersion,
        session.accessToken,
        runtime.requestTimeoutMs,
      );
      setAuthenticatedBootstrap(latestBootstrap);
      const processConnection = selectModuleConnection(latestBootstrap, 'workflow', {
        publicationRole: 'OPERATIONAL',
      });
      const current = await loadAxisInitializationStatus(
        runtime.backofficeBaseUrl,
        session.accessToken,
        runtime.requestTimeoutMs,
      );
      if (
        current.publication?.code !== initializationStatus?.publication?.code ||
        current.publication?.revision !== initializationStatus?.publication?.revision ||
        current.publication?.workflowRef !== workflowRef ||
        current.publication?.state !== 'PENDING_APPROVAL' ||
        current.review?.releaseChecksum !==
          initializationStatus?.review?.releaseChecksum
      )
        throw new Error(
          'Publication changed. Refresh its exact review before approving.',
        );
      if (!processConnection) {
        throw new Error(
          processApprovalUnavailableMessage({
            sourceLabel: 'Axis baseline',
            hasProcessConnection: false,
            workflowRef,
          }),
        );
      }
      const configuration = {
        accessToken: session.accessToken,
        enterpriseCode: runtime.enterpriseCode,
        timeoutMs: runtime.requestTimeoutMs,
      };
      const tasks = await loadProcessTasks(
        processConnection,
        configuration,
        workflowRef,
      );
      const task = tasks.find(
        (item) =>
          item.instanceCode === workflowRef &&
          ['OPEN', 'CLAIMED', 'ESCALATED'].includes(item.status),
      );
      if (!task) {
        throw new Error(
          processApprovalUnavailableMessage({
            sourceLabel: 'Axis baseline',
            hasProcessConnection: true,
            workflowRef,
            taskCount: tasks.length,
          }),
        );
      }
      if (
        task.reviewContext?.publicationCode !== current.publication.code ||
        task.reviewerEligibility?.eligible !== true
      )
        throw new Error(
          task.reviewerEligibility?.message ??
            'Current reviewer eligibility is unavailable. Refresh the Process task.',
        );
      await completeProcessTask(processConnection, configuration, task.code, {
        approved: true,
        reason: 'Axis baseline approved by the authenticated administrator',
      });
      await refreshInitialization();
    } catch (error: unknown) {
      setInitializationError(
        error instanceof Error ? error.message : 'Axis baseline approval failed',
      );
    } finally {
      setInitializationBusy(false);
    }
  }, [
    initializationApproval.eligible,
    initializationStatus,
    initializationBusy,
    initializationStatusUnavailable,
    refreshInitialization,
    runtime,
    session,
  ]);

  const hasAuthenticatedBootstrap = Boolean(authenticatedBootstrap);
  const axisInitializationAdmission =
    authenticatedBootstrap?.axisInitializationAdmission;
  useEffect(() => {
    if (
      !session ||
      !hasAuthenticatedBootstrap ||
      axisInitializationAdmission !== undefined
    ) {
      initializationReadSequence.current += 1;
      setInitializationStatus(undefined);
      setInitializationError(undefined);
      setInitializationStatusUnavailable(false);
      return;
    }
    // This first status read follows a fresh authenticated bootstrap. Later
    // recovery, explicit refresh and setup commands still refresh that bootstrap.
    void refreshInitialization(false, true);
  }, [
    hasAuthenticatedBootstrap,
    refreshInitialization,
    session,
    axisInitializationAdmission,
  ]);

  // Only transient status reads recover automatically; writes and approvals never retry.
  useEffect(() => {
    if (
      !session ||
      locked ||
      initializationBusy ||
      (initializationStatusUnavailable && initializationRecoveryAttempt === 0) ||
      (initializationRecoveryAttempt === 0 &&
        !['IMPORTING', 'PUBLICATION_PENDING'].includes(
          initializationStatus?.readiness ?? '',
        ))
    )
      return;
    const timer = window.setTimeout(
      () => void refreshInitialization(true),
      initializationRecoveryAttempt > 0 ? 5_000 : 2_000,
    );
    return () => window.clearTimeout(timer);
  }, [
    session,
    locked,
    initializationBusy,
    initializationStatusUnavailable,
    initializationRecoveryAttempt,
    initializationStatus,
    refreshInitialization,
  ]);

  useEffect(
    () =>
      subscribeEmployeeSessionExpired((identity) => {
        const current = admittedSession.current;
        if (
          !current ||
          current.accessToken !== identity.accessToken ||
          current.generation !== identity.generation ||
          contextTransition.current
        )
          return;
        initializationReadSequence.current += 1;
        sessionInvalidated.current = true;
        updateSession(undefined);
        setAuthenticatedBootstrap(undefined);
        setEmployeePolicy(undefined);
        setInitializationStatus(undefined);
        setInitializationError(undefined);
        setInitializationStatusUnavailable(false);
        setRestoringSession(false);
        setLocked(false);
        clearScreenLock();
        void queryClient.cancelQueries();
        queryClient.clear();
        setAuthenticationError(
          employeePolicy?.sessionRecoveryPresentation?.expiredMessage ??
            'Your session has expired. Sign in again.',
        );
        const returnPath = safeReturnPath(location.pathname);
        const signIn = bootstrap?.uiComposition.defaultPublicPage ?? '/login';
        void navigate(
          returnPath ? `${signIn}?returnTo=${encodeURIComponent(returnPath)}` : signIn,
          {
            replace: true,
            state: {
              registrationSignIn: {
                enterpriseCode: current.enterpriseCode ?? runtime.enterpriseCode,
              },
            },
          },
        );
      }),
    [
      session,
      queryClient,
      location.pathname,
      navigate,
      bootstrap,
      runtime.enterpriseCode,
      updateSession,
      employeePolicy,
    ],
  );

  const currentNavigation = resolveCurrentNavigation(
    authenticatedBootstrap?.navigation,
    location.pathname,
    location.hash,
  );
  const loadNavigationAvailability = useCallback(
    async (signal: AbortSignal) => {
      if (!session || locked || contextTransition.current) return undefined;
      const originalSession = session;
      const sequence = ++availabilityReadSequence.current;
      const next = await loadAuthenticatedBootstrap(
        runtime.backofficeBaseUrl,
        runtime.clientContractVersion,
        session.accessToken,
        runtime.requestTimeoutMs,
      );
      if (
        signal.aborted ||
        !lifetime.current.active ||
        contextTransition.current ||
        admittedSession.current !== originalSession ||
        sequence !== availabilityReadSequence.current
      )
        return undefined;
      setAuthenticatedBootstrap(next);
      setEmployeePolicy(next.axisPolicy);
      return next;
    },
    [session, locked, runtime],
  );
  const navigationAvailabilityRecovery = useNavigationAvailabilityRecovery({
    item: currentNavigation,
    bootstrap: authenticatedBootstrap,
    enabled:
      Boolean(bootstrap && session) &&
      !bootstrapError &&
      !restoringSession &&
      !locked &&
      !switchingContext &&
      (axisInitializationAdmission ?? initializationStatus?.readiness) === 'READY',
    scopeKey: `${session?.generation ?? 0}:${runtime.backofficeBaseUrl}:${runtime.enterpriseCode}`,
    retryWindowMs: runtime.publicDiscoveryRetryWindowMs ?? 300_000,
    load: loadNavigationAvailability,
  });

  if (bootstrapError) {
    return (
      <RecoveryScreen
        state={{
          kind: 'backoffice',
          detail: bootstrapError,
          retryable: true,
          reconnecting: discoveryReconnecting,
        }}
        onRetry={() => {
          setBootstrap(undefined);
          setBootstrapError(undefined);
          setAttempt((current) => current + 1);
        }}
      />
    );
  }
  if (restoreError) {
    return (
      <RecoveryScreen
        state={{ kind: 'session', detail: restoreError, retryable: true }}
        onRetry={() => {
          setRestoreError(undefined);
          setRestoringSession(true);
        }}
      />
    );
  }
  if (!bootstrap || restoringSession || switchingContext)
    return (
      <LoadingScreen
        label={
          !bootstrap
            ? 'Discovering your workspace'
            : switchingContext
              ? 'Switching enterprise context'
              : restorePhase === 'profile'
                ? 'Restoring your session'
                : 'Loading your authorized workspace'
        }
      />
    );

  const composition = bootstrap.uiComposition;
  const assistantNavigation = authenticatedBootstrap?.navigation.find(
    (item) =>
      item.id === 'assistant' &&
      ['copilotApi', 'aiAssistant'].includes(item.moduleName),
  );
  const assistantConnection = authenticatedBootstrap
    ? selectModuleConnection(
        authenticatedBootstrap,
        assistantNavigation?.moduleName ?? 'copilotApi',
      )
    : undefined;
  const workbenchNavigation = authenticatedBootstrap?.navigation.find(
    (item) => item.id === 'schema-workbench' && item.moduleName === 'backoffice',
  );
  const documentationNavigation = authenticatedBootstrap?.navigation.find(
    isDocumentationNavigationItem,
  );
  const onlineDocsConnection =
    authenticatedBootstrap &&
    selectModuleConnection(authenticatedBootstrap, 'cms', {
      publicationRole: 'ONLINE',
    });
  const openApiSource = authenticatedBootstrap?.documentationSources.find(
    (source) => source.type === 'OPENAPI',
  );
  const moduleHealthNavigation = authenticatedBootstrap?.navigation.find(
    (item) => item.id === 'module-health' && item.moduleName === 'backoffice',
  );
  const systemIntegrationsNavigation = authenticatedBootstrap?.navigation.find(
    (item) => item.id === 'system-integrations' && item.moduleName === 'backoffice',
  );
  const moduleRegistryNavigation = authenticatedBootstrap?.navigation.find(
    (item) => item.id === 'registry' && item.moduleName === 'backoffice',
  );
  const navigationCompositionNavigation = authenticatedBootstrap?.navigation.find(
    (item) => item.id === 'navigation-composition' && item.moduleName === 'backoffice',
  );
  const setupAcceleratorsNavigation = authenticatedBootstrap?.navigation.find(
    (item) =>
      item.route === '/setup-accelerators' ||
      (item.id === 'setup-accelerators' && item.moduleName === 'backoffice'),
  );
  const importExportNavigation = authenticatedBootstrap?.navigation.find(
    (item) => item.id === 'imports-exports' && item.moduleName === 'backoffice',
  );
  const cronNavigation = authenticatedBootstrap?.navigation.find(
    (item) => item.route.startsWith('/cron') || item.moduleName === 'cronjob',
  );
  const mediaManagementNavigation = authenticatedBootstrap?.navigation.find(
    (item) => item.id === 'media-management' && item.moduleName === 'media',
  );
  const cmsWorkbenchNavigation = authenticatedBootstrap?.navigation.find(
    (item) => item.id === 'cms' && item.moduleName === 'cms',
  );
  const contentDashboardNavigation =
    (location.hash &&
    currentNavigation?.moduleName === 'cms' &&
    currentNavigation.route === `/content${location.hash}`
      ? currentNavigation
      : undefined) ??
    authenticatedBootstrap?.navigation.find(
      (item) => item.route === '/content' && item.group?.id === 'content',
    ) ??
    cmsWorkbenchNavigation;
  const publishingDashboardNavigation =
    authenticatedBootstrap?.navigation.find(
      (item) => item.route === '/publishing' && item.group?.id === 'publishing',
    ) ?? cmsWorkbenchNavigation;
  const currentWorkbenchNavigation =
    resolveCurrentWorkbenchNavigation(
      authenticatedBootstrap?.navigation,
      location.pathname,
    ) ?? (currentNavigation?.workbenchTarget ? currentNavigation : undefined);
  const currentWorkbenchSchema = currentWorkbenchNavigation?.workbenchTarget;
  const page = (
    path: string,
    accessToken?: string,
    actions?: CmsRendererActions,
    onLogout?: () => void,
    unavailableFallback?: ReactNode,
  ) => (
    <CmsRoutePage
      embedded={path === axisDashboardRoute}
      sessionGeneration={
        accessToken && accessToken === session?.accessToken
          ? session.generation
          : undefined
      }
      accessToken={accessToken}
      actions={actions}
      authenticationError={authenticationError}
      channel={composition.channel}
      cmsBaseUrl={bootstrap.endpoints.cms}
      enterpriseCode={accessToken ? runtime.enterpriseCode : baseRuntime.enterpriseCode}
      locale={composition.locale}
      onLogout={onLogout}
      path={path}
      site={composition.site}
      timeoutMs={runtime.requestTimeoutMs}
      unavailableFallback={unavailableFallback}
    />
  );

  const switchContext = async (membership: EnterpriseMembership) => {
    if (!session || contextTransition.current || !membership.accepted) return;
    contextTransition.current = true;
    setSwitchingContext(true);
    const current = session;
    updateSession(undefined);
    setAuthenticatedBootstrap(undefined);
    setEmployeePolicy(undefined);
    setInitializationStatus(undefined);
    setInitializationError(undefined);
    setAuthenticationError(undefined);
    clearScreenLock();
    setLocked(false);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      const nextSession = await switchEmployeeEnterprise(
        bootstrap.endpoints.profile,
        current,
        runtime.enterpriseCode,
        membership,
        runtime.browserSessionCsrfCookieName,
        runtime.requestTimeoutMs,
      );
      const nextBootstrap = await loadAuthenticatedBootstrap(
        runtime.backofficeBaseUrl,
        runtime.clientContractVersion,
        nextSession.accessToken,
        runtime.requestTimeoutMs,
      );
      if (!lifetime.current.active) return;
      rememberEnterpriseContext(runtime.backofficeBaseUrl, membership.enterpriseCode);
      setAuthenticatedBootstrap(nextBootstrap);
      setEmployeePolicy(nextBootstrap.axisPolicy);
      updateSession(nextSession);
      void navigate(composition.defaultAuthenticatedPage, { replace: true });
    } catch {
      if (!lifetime.current.active) return;
      queryClient.clear();
      clearEnterpriseContext(runtime.backofficeBaseUrl);
      setAuthenticationError(
        'Enterprise context could not be confirmed. Sign in again.',
      );
      void navigate('/login', {
        replace: true,
        state: { registrationSignIn: { enterpriseCode: membership.enterpriseCode } },
      });
    } finally {
      contextTransition.current = false;
      if (lifetime.current.active) setSwitchingContext(false);
    }
  };

  const login = async (
    loginId: string,
    password: string,
    requestedEnterpriseCode?: string,
  ) => {
    if (
      !lifetime.current.active ||
      contextTransition.current ||
      admittedSession.current ||
      loginAttempt.current
    )
      return;
    // This is request scope only; Profile owns credential and enterprise admission.
    const targetEnterprise = enterpriseContextCode(
      requestedEnterpriseCode ?? runtime.enterpriseCode,
    );
    if (!targetEnterprise) {
      setAuthenticationError('Enter a valid enterprise code.');
      return;
    }
    // Admit synchronously: a second submit can arrive before React disables the form.
    const originalAttempt = {};
    loginAttempt.current = originalAttempt;
    const isCurrent = () =>
      lifetime.current.active &&
      loginAttempt.current === originalAttempt &&
      !contextTransition.current &&
      !admittedSession.current;
    setLoginPending(true);
    setAuthenticationError(undefined);
    try {
      const nextSession = await authenticateEmployee(
        bootstrap.endpoints.profile,
        targetEnterprise,
        loginId,
        password,
        runtime.browserSessionTimeoutMs,
      );
      if (!isCurrent()) return;
      const employeeBootstrap = await loadAuthenticatedBootstrap(
        runtime.backofficeBaseUrl,
        runtime.clientContractVersion,
        nextSession.accessToken,
        runtime.requestTimeoutMs,
      );
      if (!isCurrent()) return;
      rememberEnterpriseContext(runtime.backofficeBaseUrl, targetEnterprise);
      queryClient.clear();
      updateSession(nextSession);
      setAuthenticatedBootstrap(employeeBootstrap);
      setEmployeePolicy(employeeBootstrap.axisPolicy);
      clearScreenLock();
      setLocked(false);
      const returnPath = safeReturnPath(
        new URLSearchParams(location.search).get('returnTo'),
      );
      void navigate(returnPath ?? composition.defaultAuthenticatedPage, {
        replace: true,
      });
    } catch (error: unknown) {
      if (!isCurrent()) return;
      updateSession(undefined);
      setAuthenticationError(
        localization.formatError(error, 'Employee authentication failed'),
      );
    } finally {
      if (loginAttempt.current === originalAttempt) retireLogin();
    }
  };

  const logout = (requestedEnterpriseCode?: string) => {
    if (contextTransition.current) return;
    retireLogin();
    const signInEnterpriseCode = enterpriseContextCode(requestedEnterpriseCode);
    const showSignIn = () =>
      void navigate(signInEnterpriseCode ? '/login' : composition.defaultPublicPage, {
        replace: true,
        state: signInEnterpriseCode
          ? { registrationSignIn: { enterpriseCode: signInEnterpriseCode } }
          : undefined,
      });
    const current = session;
    if (!current) {
      showSignIn();
      return;
    }
    contextTransition.current = true;
    setSwitchingContext(true);
    setAuthenticationError(undefined);
    void logoutEmployee(
      bootstrap.endpoints.profile,
      runtime.enterpriseCode,
      runtime.browserSessionCsrfCookieName,
      runtime.browserSessionTimeoutMs,
    )
      .then(() => {
        updateSession(undefined);
        setAuthenticatedBootstrap(undefined);
        setEmployeePolicy(undefined);
        clearEnterpriseContext(runtime.backofficeBaseUrl);
        queryClient.clear();
        clearScreenLock();
        setLocked(false);
        // Explicit account-access sign-in retires the old session before routing to the new enterprise.
        showSignIn();
      })
      .catch(() => {
        setAuthenticationError(
          'Secure logout could not be completed. Please retry before leaving this device.',
        );
        setLocked(true);
        void navigate('/lock-screen', { replace: true });
      })
      .finally(() => {
        contextTransition.current = false;
        if (lifetime.current.active) setSwitchingContext(false);
      });
  };

  const initiateInitialization = async () => {
    if (
      !session ||
      initializationBusy ||
      initializationStatusUnavailable ||
      !initializationStatus?.allowedActions?.includes('INITIALIZE')
    )
      return;
    initializationReadSequence.current += 1;
    setInitializationBusy(true);
    setInitializationError(undefined);
    try {
      setInitializationStatus(
        await initiateAxisInitialization(
          runtime.backofficeBaseUrl,
          session.accessToken,
          runtime.requestTimeoutMs,
        ),
      );
    } catch (error: unknown) {
      setInitializationError(
        error instanceof Error ? error.message : 'Axis initialization failed',
      );
      // The write may have committed despite a failed response. Observe once, never replay.
      try {
        const status = await loadAxisInitializationStatus(
          runtime.backofficeBaseUrl,
          session.accessToken,
          runtime.requestTimeoutMs,
        );
        setInitializationStatus(status);
        setInitializationStatusUnavailable(false);
        if (
          status.readiness === 'READY' ||
          (status.readiness === 'PUBLICATION_PENDING' &&
            (initializationStatus?.publication?.state !== 'PENDING_APPROVAL' ||
              status.publication?.approvalDiagnostic?.status === 'WAITING_REVIEWER'))
        )
          setInitializationError(undefined);
        if (status.readiness === 'READY') await refreshAuthenticatedBootstrap();
      } catch {
        setInitializationStatusUnavailable(true);
      }
    } finally {
      setInitializationBusy(false);
    }
  };

  const unlock = async (password: string) => {
    if (
      !session ||
      admittedSession.current !== session ||
      contextTransition.current ||
      unlockAttempt.current
    )
      return;
    const originalSession = session;
    const attempt = {};
    unlockAttempt.current = attempt;
    setUnlockPending(true);
    setAuthenticationError(undefined);
    try {
      const nextSession = await authenticateEmployee(
        bootstrap.endpoints.profile,
        runtime.enterpriseCode,
        session.loginId,
        password,
        runtime.browserSessionTimeoutMs,
      );
      const employeeBootstrap = await loadAuthenticatedBootstrap(
        runtime.backofficeBaseUrl,
        runtime.clientContractVersion,
        nextSession.accessToken,
        runtime.requestTimeoutMs,
      );
      if (
        !lifetime.current.active ||
        unlockAttempt.current !== attempt ||
        admittedSession.current !== originalSession ||
        contextTransition.current
      )
        return;
      rememberEnterpriseContext(runtime.backofficeBaseUrl, runtime.enterpriseCode);
      queryClient.clear();
      const sameScope =
        nextSession.loginId === session.loginId &&
        nextSession.enterpriseCode === session.enterpriseCode &&
        employeeBootstrap.tenantCode === authenticatedBootstrap?.tenantCode;
      const returnLocation = new URL(lockedReturnPath, window.location.origin);
      const returnNavigation = resolveCurrentNavigation(
        employeeBootstrap.navigation,
        returnLocation.pathname,
        returnLocation.hash,
      );
      // Private record references cannot survive removal of their fresh route admission.
      // Ordinary unavailable-route recovery retains its URL, so retire it at this boundary.
      if (
        !sameScope ||
        !returnNavigation ||
        normalizeRoutePath(returnNavigation.route) !==
          normalizeRoutePath(returnLocation.pathname) ||
        !['ACTIVE', 'PREVIEW'].includes(returnNavigation.featureState ?? 'ACTIVE') ||
        !['UP', 'DEGRADED'].includes(returnNavigation.availability)
      )
        setLockedReturnPath(composition.defaultAuthenticatedPage);
      updateSession(nextSession, sameScope);
      setAuthenticatedBootstrap(employeeBootstrap);
      setEmployeePolicy(employeeBootstrap.axisPolicy);
      clearScreenLock();
      setLocked(false);
    } catch (error: unknown) {
      if (
        lifetime.current.active &&
        unlockAttempt.current === attempt &&
        admittedSession.current === originalSession &&
        !contextTransition.current
      )
        setAuthenticationError(
          localization.formatError(error, 'Employee unlock failed'),
        );
    } finally {
      if (unlockAttempt.current === attempt) retireUnlock();
    }
  };

  const authenticatedShell = (content: ReactNode) => (
    <RuntimeConfigContext.Provider value={runtime}>
      <EnterpriseDisplayContext.Provider value={enterpriseDisplay}>
        <AppShell
          workspaceTools={
            session && !locked && authenticatedBootstrap ? (
              <OperationalReadinessInspector
                key={`${session.generation}:${authenticatedBootstrap.tenantCode}:${runtime.enterpriseCode}`}
                scope={`${session.generation}:${authenticatedBootstrap.tenantCode}:${runtime.enterpriseCode}:${runtime.projectCode}`}
                bootstrap={authenticatedBootstrap}
                runtime={runtime}
                accessToken={session.accessToken}
              />
            ) : undefined
          }
          catalog={composition.catalog}
          employeeId={session?.loginId}
          enterpriseCode={runtime.enterpriseCode}
          enterpriseDisplayName={enterpriseDisplay?.displayName ?? undefined}
          environments={authenticatedBootstrap?.environments}
          tenantCode={authenticatedBootstrap?.tenantCode}
          navigation={shellNavigation}
          recentNavigationLimit={
            authenticatedBootstrap?.axisPolicy.recentNavigationLimit
          }
          site={composition.site}
          onLock={lockScreen}
          onLogout={logout}
        >
          <NavigationAvailabilityRecoveryContext.Provider
            value={navigationAvailabilityRecovery}
          >
            {navigationAvailabilityRecovery &&
            !hasUnavailableNavigation(currentNavigation) &&
            (hasUnavailableBootstrap(authenticatedBootstrap) ||
              (navigationAvailabilityRecovery.message &&
                !navigationAvailabilityRecovery.refreshing)) ? (
              <Alert
                severity="info"
                action={
                  <Button
                    disabled={navigationAvailabilityRecovery.refreshing}
                    onClick={navigationAvailabilityRecovery.refresh}
                  >
                    Refresh availability
                  </Button>
                }
              >
                {navigationAvailabilityRecovery.message ??
                  'Some workspaces are temporarily unavailable.'}
              </Alert>
            ) : null}
            <OnlineHelpPathsContext.Provider value={onlineHelpPaths}>
              <CmsRenderBoundary
                key={currentRoutePath}
                fallback={
                  <Alert
                    severity="error"
                    role="alert"
                    action={
                      <Button onClick={() => window.location.reload()}>
                        {localization.format(
                          'common.reload-workspace',
                          'Reload workspace',
                        )}
                      </Button>
                    }
                  >
                    {localization.format(
                      'common.workspace-load-failed',
                      'The workspace could not be loaded. Reload to try again.',
                    )}
                  </Alert>
                }
              >
                <Suspense
                  fallback={
                    <LoadingScreen
                      embedded
                      label={localization.format(
                        'common.loading-workspace',
                        'Loading workspace',
                      )}
                    />
                  }
                >
                  {content}
                </Suspense>
              </CmsRenderBoundary>
            </OnlineHelpPathsContext.Provider>
          </NavigationAvailabilityRecoveryContext.Provider>
        </AppShell>
      </EnterpriseDisplayContext.Provider>
    </RuntimeConfigContext.Provider>
  );
  const sessionFallback =
    session && !locked && authenticatedBootstrap ? (
      authenticatedShell(
        <UnavailableWorkspaceRoutePage
          moduleName="axis"
          dashboardRoute={composition.defaultAuthenticatedPage}
        />,
      )
    ) : (
      <Navigate
        replace
        to={
          session
            ? '/lock-screen'
            : `${composition.defaultPublicPage}?returnTo=${encodeURIComponent(
                currentRoutePath,
              )}`
        }
      />
    );
  const workbenchRouteElement = (navigationItem?: AxisNavigationItem) =>
    session &&
    !locked &&
    authenticatedBootstrap &&
    navigationItem &&
    navigationItem.workbenchTarget
      ? authenticatedShell(
          canRenderWorkbenchNavigation(authenticatedBootstrap, navigationItem) ? (
            <ProductWorkbenchRoutePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              channel={composition.channel}
              cmsBaseUrl={bootstrap.endpoints.cms}
              employeeId={session.loginId}
              locale={composition.locale}
              routeNavigation={navigationItem}
              routeSchema={navigationItem.workbenchTarget}
              runtime={runtime}
              site={composition.site}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={navigationItem} />
          ),
        )
      : sessionFallback;
  const navigationRouteElement = (navigationItem?: AxisNavigationItem) =>
    session && !locked && authenticatedBootstrap && navigationItem
      ? navigationItem.backendWorkspace?.renderer === 'axis.workspace.native' &&
        !isEnterpriseManagementNavigation(navigationItem)
        ? authenticatedShell(
            navigationItem.moduleName === 'installer' &&
              navigationItem.backendWorkspace.workspaceCode ===
                'installer.applicationBuilder' &&
              navigationItem.backendWorkspace.viewCode === 'overview' &&
              !['DISABLED', 'HIDDEN'].includes(
                navigationItem.featureState ?? 'ACTIVE',
              ) &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) ? (
              <ApplicationBuilderRoutePage
                accessToken={session.accessToken}
                sessionGeneration={session.generation}
                bootstrap={authenticatedBootstrap}
                runtime={runtime}
                routeNavigation={navigationItem}
              />
            ) : navigationItem.moduleName === 'copilotApi' &&
              navigationItem.backendWorkspace.workspaceCode === 'copilot.workspace' &&
              navigationItem.backendWorkspace.viewCode === 'overview' &&
              !['DISABLED', 'HIDDEN'].includes(
                navigationItem.featureState ?? 'ACTIVE',
              ) &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) ? (
              <CopilotWorkspaceRoutePage
                accessToken={session.accessToken}
                bootstrap={authenticatedBootstrap}
                runtime={runtime}
              />
            ) : navigationItem.moduleName === 'copilotApi' &&
              navigationItem.backendWorkspace.workspaceCode === 'copilot.knowledge' &&
              navigationItem.backendWorkspace.viewCode === 'sources' &&
              !['DISABLED', 'HIDDEN'].includes(
                navigationItem.featureState ?? 'ACTIVE',
              ) &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) ? (
              <KnowledgeStudioRoutePage
                accessToken={session.accessToken}
                bootstrap={authenticatedBootstrap}
                runtime={runtime}
              />
            ) : navigationItem.moduleName === 'copilotApi' &&
              navigationItem.backendWorkspace.workspaceCode === 'copilot.activity' &&
              navigationItem.backendWorkspace.viewCode === 'conversations' &&
              !['DISABLED', 'HIDDEN'].includes(
                navigationItem.featureState ?? 'ACTIVE',
              ) &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) ? (
              <CopilotActivityRoutePage
                accessToken={session.accessToken}
                bootstrap={authenticatedBootstrap}
                runtime={runtime}
              />
            ) : navigationItem.moduleName === 'copilotApi' &&
              navigationItem.backendWorkspace.workspaceCode === 'copilot.usage' &&
              navigationItem.backendWorkspace.viewCode === 'overview' &&
              !['DISABLED', 'HIDDEN'].includes(
                navigationItem.featureState ?? 'ACTIVE',
              ) &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) ? (
              <CopilotUsageRoutePage
                accessToken={session.accessToken}
                bootstrap={authenticatedBootstrap}
                runtime={runtime}
              />
            ) : navigationItem.moduleName === 'copilotApi' &&
              navigationItem.backendWorkspace.workspaceCode ===
                'copilot.administration' &&
              navigationItem.backendWorkspace.viewCode === 'overview' &&
              !['DISABLED', 'HIDDEN'].includes(
                navigationItem.featureState ?? 'ACTIVE',
              ) &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) ? (
              <CopilotAdministrationRoutePage
                accessToken={session.accessToken}
                bootstrap={authenticatedBootstrap}
                runtime={runtime}
              />
            ) : (navigationItem.backendWorkspace.workspaceCode === 'waste.review' ||
                (navigationItem.moduleName === 'eWaste' &&
                  navigationItem.backendWorkspace.workspaceCode === 'waste.listing' &&
                  navigationItem.backendWorkspace.viewCode ===
                    'ewaste.listingRequests' &&
                  !['DISABLED', 'HIDDEN'].includes(
                    navigationItem.featureState ?? 'ACTIVE',
                  ))) &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) ? (
              <WasteManagementRoutePage
                key={`${navigationItem.moduleName}:${navigationItem.id}`}
                accessToken={session.accessToken}
                sessionGeneration={session.generation}
                bootstrap={authenticatedBootstrap}
                employeeId={session.loginId}
                navigation={navigationItem}
                runtime={runtime}
              />
            ) : navigationItem.moduleName === 'profile' &&
              navigationItem.backendWorkspace.workspaceCode ===
                'profile.enterpriseMemberships' &&
              navigationItem.backendWorkspace.viewCode === 'memberships' &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) ? (
              <EnterpriseMembershipRoutePage
                key={`${navigationItem.moduleName}:${navigationItem.id}`}
                accessToken={session.accessToken}
                bootstrap={authenticatedBootstrap}
                runtime={runtime}
                onSwitch={switchContext}
              />
            ) : navigationItem.moduleName === 'profile' &&
              navigationItem.backendWorkspace.workspaceCode ===
                'profile.enterpriseTeam' &&
              navigationItem.backendWorkspace.viewCode === 'team' &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) ? (
              <EnterpriseTeamRoutePage
                key={`${navigationItem.moduleName}:${navigationItem.id}`}
                accessToken={session.accessToken}
                bootstrap={authenticatedBootstrap}
                runtime={runtime}
              />
            ) : navigationItem.moduleName === 'profile' &&
              navigationItem.backendWorkspace.workspaceCode ===
                'profile.enterpriseRecovery' &&
              navigationItem.backendWorkspace.viewCode === 'recovery' &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) ? (
              <EnterpriseRecoveryRoutePage
                key={`${navigationItem.moduleName}:${navigationItem.id}`}
                accessToken={session.accessToken}
                bootstrap={authenticatedBootstrap}
                runtime={runtime}
                title={navigationItem.label}
              />
            ) : navigationItem.moduleName === 'profile' &&
              navigationItem.backendWorkspace.workspaceCode ===
                'profile.customerParticipation' &&
              navigationItem.backendWorkspace.viewCode === 'terms' &&
              navigationItem.featureState === 'ACTIVE' &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) ? (
              <CustomerParticipationRoutePage
                key={`${navigationItem.moduleName}:${navigationItem.id}`}
                accessToken={session.accessToken}
                bootstrap={authenticatedBootstrap}
                runtime={runtime}
              />
            ) : navigationItem.moduleName === 'profile' &&
              navigationItem.backendWorkspace.workspaceCode ===
                'profile.applicationRecovery' &&
              navigationItem.backendWorkspace.viewCode === 'recovery' &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) ? (
              <ApplicationRecoveryRoutePage
                key={`${navigationItem.moduleName}:${navigationItem.id}`}
                accessToken={session.accessToken}
                bootstrap={authenticatedBootstrap}
                runtime={runtime}
                title={navigationItem.label}
              />
            ) : navigationItem.moduleName === 'profile' &&
              navigationItem.backendWorkspace.workspaceCode ===
                'profile.enterpriseAdministration' &&
              navigationItem.backendWorkspace.viewCode === 'administration' &&
              navigationItem.featureState === 'ACTIVE' &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) ? (
              <EnterpriseAdministrationRoutePage
                key={`${navigationItem.moduleName}:${navigationItem.id}`}
                accessToken={session.accessToken}
                bootstrap={authenticatedBootstrap}
                runtime={runtime}
                title={navigationItem.backendWorkspace.title || navigationItem.label}
              />
            ) : navigationItem.moduleName === 'digitalCore' &&
              navigationItem.backendWorkspace.workspaceCode ===
                'commerce.orderNotifications' &&
              navigationItem.backendWorkspace.viewCode ===
                'orderNotifications.detail' &&
              navigationItem.featureState === 'ACTIVE' &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) ? (
              <OrderNotificationRoutePage
                key={`${navigationItem.moduleName}:${navigationItem.id}`}
                accessToken={session.accessToken}
                bootstrap={authenticatedBootstrap}
                runtime={runtime}
                title={navigationItem.label}
              />
            ) : navigationItem.moduleName === 'promotion' &&
              navigationItem.backendWorkspace.workspaceCode ===
                'promotion.couponOffers' &&
              navigationItem.backendWorkspace.viewCode === 'authoring' &&
              navigationItem.backendWorkspace.ownerSelector?.runtimeRoleCode ===
                'COMMERCE_STAGED' &&
              navigationItem.backendWorkspace.ownerSelector.publicationRole ===
                'STAGED' &&
              ['ACTIVE', 'PREVIEW'].includes(navigationItem.featureState || '') &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) &&
              selectModuleConnection(
                authenticatedBootstrap,
                'promotion',
                navigationItem.backendWorkspace.ownerSelector,
              ) ? (
              <CouponOfferWorkspace
                key={`${navigationItem.id}:${session.generation}`}
                accessToken={session.accessToken}
                sessionGeneration={session.generation}
                bootstrap={authenticatedBootstrap}
                runtime={runtime}
              />
            ) : navigationItem.moduleName === 'promotion' &&
              navigationItem.backendWorkspace.workspaceCode ===
                'promotion.couponAcquisition' &&
              navigationItem.backendWorkspace.viewCode === 'reporting' &&
              navigationItem.backendWorkspace.ownerSelector?.runtimeRoleCode ===
                'COMMERCE' &&
              navigationItem.backendWorkspace.ownerSelector.publicationRole ===
                'OPERATIONAL' &&
              ['ACTIVE', 'PREVIEW'].includes(navigationItem.featureState || '') &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) &&
              selectModuleConnection(
                authenticatedBootstrap,
                'promotion',
                navigationItem.backendWorkspace.ownerSelector,
              ) ? (
              <CouponAcquisitionReportPanel
                key={`${navigationItem.id}:${session.generation}`}
                accessToken={session.accessToken}
                sessionGeneration={session.generation}
                bootstrap={authenticatedBootstrap}
                runtime={runtime}
              />
            ) : admitsParticipation(navigationItem) ? (
              <DigitalParticipationRoutePage
                accessToken={session.accessToken}
                sessionGeneration={session.generation}
                bootstrap={authenticatedBootstrap}
                navigation={navigationItem}
                runtime={runtime}
              />
            ) : loyaltyView(navigationItem) ? (
              <LoyaltyParticipationRoutePage
                accessToken={session.accessToken}
                sessionGeneration={session.generation}
                bootstrap={authenticatedBootstrap}
                navigation={navigationItem}
                runtime={runtime}
                cmsBaseUrl={bootstrap.endpoints.cms}
                site={composition.site}
                locale={composition.locale}
                channel={composition.channel}
              />
            ) : admitsAgreementWorkspace(navigationItem) ? (
              <CommercialAgreementRoutePage
                accessToken={session.accessToken}
                sessionGeneration={session.generation}
                bootstrap={authenticatedBootstrap}
                navigation={navigationItem}
                runtime={runtime}
                cmsBaseUrl={bootstrap.endpoints.cms}
                site={composition.site}
                locale={composition.locale}
                channel={composition.channel}
              />
            ) : navigationItem.backendWorkspace.workspaceCode === 'rules.policy' &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) ? (
              <RulesManagementRoutePage
                key={`${navigationItem.moduleName}:${navigationItem.id}`}
                accessToken={session.accessToken}
                bootstrap={authenticatedBootstrap}
                navigation={navigationItem}
                runtime={runtime}
              />
            ) : navigationItem.backendWorkspace.workspaceCode ===
                'system.runtimeConfiguration' &&
              ['UP', 'DEGRADED'].includes(navigationItem.availability) ? (
              <RuntimeConfigurationRoutePage
                key={`${navigationItem.moduleName}:${navigationItem.id}`}
                accessToken={session.accessToken}
                bootstrap={authenticatedBootstrap}
                navigation={navigationItem}
                runtime={runtime}
              />
            ) : (
              <ModuleWorkspacePlaceholder item={navigationItem} />
            ),
          )
        : navigationItem.workbenchTarget
          ? workbenchRouteElement(navigationItem)
          : navigationItem.backendWorkspace &&
              normalizeRoutePath(location.pathname) !==
                normalizeRoutePath(navigationItem.route)
            ? authenticatedShell(
                <UnavailableWorkspaceRoutePage
                  moduleName={navigationItem.moduleName}
                  dashboardRoute={composition.defaultAuthenticatedPage}
                />,
              )
            : navigationItem.backendWorkspace &&
                (['DISABLED', 'HIDDEN'].includes(
                  navigationItem.featureState ?? 'ACTIVE',
                ) ||
                  !['UP', 'DEGRADED'].includes(navigationItem.availability))
              ? authenticatedShell(<ModuleWorkspacePlaceholder item={navigationItem} />)
              : navigationItem.backendWorkspace &&
                  selectModuleConnection(
                    authenticatedBootstrap,
                    navigationItem.moduleName,
                    navigationItem.backendWorkspace.ownerSelector,
                  )
                ? authenticatedShell(
                    <BackendWorkspaceEntry
                      navigationItem={navigationItem}
                      bootstrap={authenticatedBootstrap}
                      spendCms={{
                        baseUrl: bootstrap.endpoints.cms,
                        site: composition.site,
                        locale: composition.locale,
                        channel: composition.channel,
                      }}
                      key={`${session.generation}:${navigationItem.moduleName}:${navigationItem.id}:${navigationItem.route}`}
                      enterpriseCreationCheckpoint={{
                        checkpoint: enterpriseCreationCheckpoint,
                        scope: JSON.stringify([
                          runtime.projectCode,
                          runtime.backofficeBaseUrl,
                          runtime.enterpriseCode,
                          authenticatedBootstrap.tenantCode,
                          session.loginId,
                          navigationItem.moduleName,
                          navigationItem.id,
                          navigationItem.route,
                        ]),
                      }}
                      accessToken={session.accessToken}
                      sessionGeneration={session.generation}
                      enterpriseCode={runtime.enterpriseCode}
                      runtime={runtime}
                      connection={selectModuleConnection(
                        authenticatedBootstrap,
                        navigationItem.moduleName,
                        navigationItem.backendWorkspace.ownerSelector,
                      )}
                      workspace={navigationItem.backendWorkspace}
                      authorizedRoutes={authenticatedBootstrap.navigation
                        .filter(
                          (item) =>
                            !['DISABLED', 'HIDDEN'].includes(
                              item.featureState ?? 'ACTIVE',
                            ) && ['UP', 'DEGRADED'].includes(item.availability),
                        )
                        .map((item) => item.route)}
                    />,
                  )
                : authenticatedShell(
                    <ModuleWorkspacePlaceholder item={navigationItem} />,
                  )
      : sessionFallback;
  const cmsWorkbenchElement =
    currentWorkbenchNavigation && currentWorkbenchSchema
      ? workbenchRouteElement(currentWorkbenchNavigation)
      : currentNavigation?.route.startsWith('/content')
        ? navigationRouteElement(currentNavigation)
        : cmsWorkbenchNavigation
          ? navigationRouteElement(cmsWorkbenchNavigation)
          : sessionFallback;
  const contentDashboardElement =
    session && !locked && authenticatedBootstrap && contentDashboardNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(contentDashboardNavigation.availability) ? (
            <ContentDashboardRoutePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              routeNavigation={contentDashboardNavigation}
              runtime={runtime}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={contentDashboardNavigation} />
          ),
        )
      : sessionFallback;
  const mediaManagementDashboardElement =
    session && !locked && authenticatedBootstrap && mediaManagementNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(mediaManagementNavigation.availability) ? (
            <MediaManagementDashboardRoutePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              routeNavigation={mediaManagementNavigation}
              runtime={runtime}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={mediaManagementNavigation} />
          ),
        )
      : sessionFallback;
  const publishingDashboardElement =
    session && !locked && authenticatedBootstrap && publishingDashboardNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(publishingDashboardNavigation.availability) ? (
            <PublishingDashboardRoutePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              routeNavigation={publishingDashboardNavigation}
              runtime={runtime}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={publishingDashboardNavigation} />
          ),
        )
      : sessionFallback;
  const publishingRouteGuidanceElement =
    session && !locked && authenticatedBootstrap && publishingDashboardNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(publishingDashboardNavigation.availability) ? (
            <PublishingRouteGuidancePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              path={location.pathname}
              routeNavigation={publishingDashboardNavigation}
              runtime={runtime}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={publishingDashboardNavigation} />
          ),
        )
      : sessionFallback;
  const documentationRouteElement =
    session &&
    !locked &&
    authenticatedBootstrap &&
    (documentationNavigation || onlineDocsConnection)
      ? authenticatedShell(
          documentationNavigation &&
            !onlineDocsConnection &&
            !['UP', 'DEGRADED'].includes(documentationNavigation.availability) ? (
            <ModuleWorkspacePlaceholder item={documentationNavigation} />
          ) : (
            <DocumentationRoutePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              channel={composition.channel}
              cmsBaseUrl={bootstrap.endpoints.cms}
              employeeId={session.loginId}
              locale={composition.locale}
              onPublicationStatusChange={refreshDocumentationNavigation}
              path={location.pathname}
              runtime={runtime}
            />
          ),
        )
      : sessionFallback;
  const contentDesignerNavigation =
    authenticatedBootstrap?.navigation.find(
      (item) => item.route === '/content/designer',
    ) ?? contentDashboardNavigation;
  const wcmsExperienceNavigation =
    currentNavigation?.route.startsWith('/content/experience-studio') &&
    currentNavigation.moduleName === 'wcmsExperience'
      ? currentNavigation
      : (authenticatedBootstrap?.navigation.find(
          (item) =>
            item.id === 'wcms-experience-studio' &&
            item.moduleName === 'wcmsExperience',
        ) ?? contentDashboardNavigation);
  const documentationManagementNavigation =
    authenticatedBootstrap?.navigation.find(
      (item) => item.id === 'documentation-governance-readiness',
    ) ??
    authenticatedBootstrap?.navigation.find(
      (item) => item.id === 'documentation-management',
    );
  const documentationManagementElement =
    session && !locked && authenticatedBootstrap && documentationManagementNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(
            documentationManagementNavigation.availability,
          ) ? (
            <DocumentationManagementRoutePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              channel={composition.channel}
              cmsBaseUrl={bootstrap.endpoints.cms}
              employeeId={session.loginId}
              locale={composition.locale}
              navigation={documentationManagementNavigation}
              path={location.pathname}
              runtime={runtime}
              site={composition.site}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={documentationManagementNavigation} />
          ),
        )
      : sessionFallback;
  const contentDesignerElement =
    session && !locked && authenticatedBootstrap && contentDesignerNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(contentDesignerNavigation.availability) ? (
            <ContentDesignerRoutePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              routeNavigation={contentDesignerNavigation}
              runtime={runtime}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={contentDesignerNavigation} />
          ),
        )
      : sessionFallback;
  const wcmsExperienceElement =
    session && !locked && authenticatedBootstrap && wcmsExperienceNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(wcmsExperienceNavigation.availability) ? (
            <WcmsExperienceStudioRoutePage
              sessionGeneration={session.generation}
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              channel={composition.channel}
              cmsBaseUrl={bootstrap.endpoints.cms}
              employeeId={session.loginId}
              locale={composition.locale}
              navigation={wcmsExperienceNavigation}
              runtime={runtime}
              site={composition.site}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={wcmsExperienceNavigation} />
          ),
        )
      : sessionFallback;
  const complianceNavigation = currentNavigation?.route.startsWith(
    '/compliance-management',
  )
    ? currentNavigation
    : authenticatedBootstrap?.navigation.find(
        (item) => item.id === 'compliance-management',
      );
  const complianceElement =
    session && !locked && authenticatedBootstrap && complianceNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(complianceNavigation.availability) ? (
            <ComplianceManagementRoutePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              channel={composition.channel}
              cmsBaseUrl={bootstrap.endpoints.cms}
              employeeId={session.loginId}
              locale={composition.locale}
              navigation={complianceNavigation}
              runtime={runtime}
              site={composition.site}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={complianceNavigation} />
          ),
        )
      : sessionFallback;
  const notificationNavigation = currentNavigation?.route.startsWith('/notifications')
    ? currentNavigation
    : undefined;
  const notificationElement =
    session && !locked && authenticatedBootstrap && notificationNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(notificationNavigation.availability) ? (
            <NotificationManagementRoutePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              channel={composition.channel}
              cmsBaseUrl={bootstrap.endpoints.cms}
              employeeId={session.loginId}
              locale={composition.locale}
              navigation={notificationNavigation}
              runtime={runtime}
              site={composition.site}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={notificationNavigation} />
          ),
        )
      : sessionFallback;
  const promotionBuilderNavigation = currentNavigation?.route.startsWith(
    '/commerce/promotions',
  )
    ? currentNavigation
    : authenticatedBootstrap?.navigation.find(
        (item) =>
          item.id === 'promotions-builder' || item.route === '/commerce/promotions',
      );
  const promotionBuilderElement =
    session && !locked && authenticatedBootstrap && promotionBuilderNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(promotionBuilderNavigation.availability) ? (
            <PromotionsBuilderRoutePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              channel={composition.channel}
              cmsBaseUrl={bootstrap.endpoints.cms}
              employeeId={session.loginId}
              locale={composition.locale}
              navigation={promotionBuilderNavigation}
              runtime={runtime}
              site={composition.site}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={promotionBuilderNavigation} />
          ),
        )
      : sessionFallback;
  const orderLifecycleNavigation = isOrderLifecycleNavigation(currentNavigation)
    ? currentNavigation
    : undefined;
  const discoveryNavigation =
    currentNavigation?.route.startsWith('/discovery') ||
    currentNavigation?.route.startsWith('/commerce/search')
      ? currentNavigation
      : authenticatedBootstrap?.navigation.find(
          (item) => item.id === 'discovery-management',
        );
  const discoveryManagementElement =
    session && !locked && authenticatedBootstrap && discoveryNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(discoveryNavigation.availability) ? (
            <DiscoveryManagementRoutePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              channel={composition.channel}
              cmsBaseUrl={bootstrap.endpoints.cms}
              employeeId={session.loginId}
              locale={composition.locale}
              navigation={discoveryNavigation}
              runtime={runtime}
              site={composition.site}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={discoveryNavigation} />
          ),
        )
      : sessionFallback;
  const orderLifecycleElement =
    session && !locked && authenticatedBootstrap && orderLifecycleNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(orderLifecycleNavigation.availability) ? (
            <OrderLifecycleManagementRoutePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              channel={composition.channel}
              cmsBaseUrl={bootstrap.endpoints.cms}
              employeeId={session.loginId}
              locale={composition.locale}
              navigation={orderLifecycleNavigation}
              runtime={runtime}
              site={composition.site}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={orderLifecycleNavigation} />
          ),
        )
      : sessionFallback;
  const merchantFulfillmentElement =
    session &&
    !locked &&
    authenticatedBootstrap &&
    currentNavigation?.id === 'merchant-coupon-fulfillment'
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(currentNavigation.availability) ? (
            <MerchantRedemptionPanel
              bootstrap={authenticatedBootstrap}
              accessToken={session.accessToken}
              sessionGeneration={session.generation}
              runtime={runtime}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={currentNavigation} />
          ),
        )
      : sessionFallback;
  const commerceRouteElement =
    currentNavigation?.id === 'merchant-coupon-fulfillment'
      ? merchantFulfillmentElement
      : orderLifecycleNavigation
        ? orderLifecycleElement
        : navigationRouteElement(currentNavigation);
  const productManagementNavigation = currentNavigation?.route.startsWith(
    '/commerce/catalog/products',
  )
    ? currentNavigation
    : authenticatedBootstrap?.navigation.find((item) => item.id === 'products');
  const productSellabilityNavigation = currentNavigation?.route.startsWith(
    '/commerce/catalog/readiness',
  )
    ? currentNavigation
    : authenticatedBootstrap?.navigation.find(
        (item) => item.id === 'make-product-sellable',
      );
  const productManagementElement =
    session && !locked && authenticatedBootstrap && productManagementNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(productManagementNavigation.availability) ? (
            <ProductManagementRoutePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              channel={composition.channel}
              cmsBaseUrl={bootstrap.endpoints.cms}
              employeeId={session.loginId}
              locale={composition.locale}
              navigation={productManagementNavigation}
              runtime={runtime}
              site={composition.site}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={productManagementNavigation} />
          ),
        )
      : sessionFallback;
  const productSellabilityElement =
    session && !locked && authenticatedBootstrap && productSellabilityNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(productSellabilityNavigation.availability) ? (
            <ProductSellabilityWorkspace
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              navigation={productSellabilityNavigation}
              runtime={runtime}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={productSellabilityNavigation} />
          ),
        )
      : sessionFallback;
  const localizationNavigation = authenticatedBootstrap?.navigation.find(
    (item) =>
      item.moduleName === 'localizationCore' &&
      item.route.startsWith('/localization') &&
      normalizeRoutePath(item.route) === normalizeRoutePath(location.pathname),
  );
  const localizationOperationsElement =
    session && !locked && authenticatedBootstrap && localizationNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(localizationNavigation.availability) ? (
            <LocalizationOperationsRoutePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              channel={composition.channel}
              cmsBaseUrl={bootstrap.endpoints.cms}
              employeeId={session.loginId}
              fallbackLocales={composition.fallbackLocales}
              navigation={localizationNavigation}
              runtime={runtime}
              site={composition.site}
              supportedLocales={composition.supportedLocales}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={localizationNavigation} />
          ),
        )
      : sessionFallback;
  // Publishing also links to the task queue. Prefer the task owner's help
  // and capabilities when both authorized entries resolve to the same route.
  const workflowTaskNavigation = authenticatedBootstrap?.navigation.find(
    (item) =>
      item.route === currentNavigation?.route &&
      item.id === 'process-tasks' &&
      item.moduleName === 'workflow',
  );
  const processNavigation =
    workflowTaskNavigation ??
    (currentNavigation?.route.startsWith('/process')
      ? currentNavigation
      : authenticatedBootstrap?.navigation.find(
          (item) => item.id === 'process-workflows' && item.moduleName === 'workflow',
        ));
  const processWorkflowElement =
    session && !locked && authenticatedBootstrap && processNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(processNavigation.availability) ? (
            <ProcessWorkflowRoutePage
              accessToken={session.accessToken}
              sessionGeneration={session.generation}
              bootstrap={authenticatedBootstrap}
              navigation={processNavigation}
              runtime={runtime}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={processNavigation} />
          ),
        )
      : sessionFallback;
  const engagementNavigation = currentNavigation?.route.startsWith('/engagement')
    ? currentNavigation
    : authenticatedBootstrap?.navigation.find(
        (item) =>
          item.id === 'customer-engagement' && item.moduleName === 'nodics.engagement',
      );
  const customerEngagementElement =
    session && !locked && authenticatedBootstrap && engagementNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(engagementNavigation.availability) ? (
            <CustomerEngagementRoutePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              channel={composition.channel}
              cmsBaseUrl={bootstrap.endpoints.cms}
              employeeId={session.loginId}
              locale={composition.locale}
              navigation={engagementNavigation}
              runtime={runtime}
              site={composition.site}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={engagementNavigation} />
          ),
        )
      : sessionFallback;
  const collectionCentresNavigation = currentNavigation?.route.startsWith(
    '/waste/collection-centres',
  )
    ? currentNavigation
    : authenticatedBootstrap?.navigation.find(
        (item) =>
          item.id === 'waste-collection-centres' &&
          item.route === '/waste/collection-centres',
      );
  const collectionCentresElement =
    session && !locked && authenticatedBootstrap && collectionCentresNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(collectionCentresNavigation.availability) ? (
            <CollectionCentresRoutePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              navigation={collectionCentresNavigation}
              runtime={runtime}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={collectionCentresNavigation} />
          ),
        )
      : sessionFallback;
  const locationMapNavigation = currentNavigation?.route.startsWith('/location/maps')
    ? currentNavigation
    : authenticatedBootstrap?.navigation.find(
        (item) =>
          item.id === 'location-map' &&
          item.moduleName === 'locationMap' &&
          item.route === '/location/maps',
      );
  const locationMapConfigurationElement =
    session && !locked && authenticatedBootstrap && locationMapNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(locationMapNavigation.availability) ? (
            <LocationMapConfigurationRoutePage
              accessToken={session.accessToken}
              bootstrap={authenticatedBootstrap}
              channel={composition.channel}
              cmsBaseUrl={bootstrap.endpoints.cms}
              employeeId={session.loginId}
              locale={composition.locale}
              navigation={locationMapNavigation}
              runtime={runtime}
              site={composition.site}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={locationMapNavigation} />
          ),
        )
      : sessionFallback;
  const enterpriseRelationshipsNavigation = currentNavigation?.route.startsWith(
    '/enterprises/',
  )
    ? currentNavigation
    : authenticatedBootstrap?.navigation.find(
        (item) =>
          item.moduleName === 'profile' &&
          item.id === 'enterprises' &&
          item.route === '/profile/enterprises',
      );
  const enterpriseRelationshipsElement =
    session && !locked && authenticatedBootstrap && enterpriseRelationshipsNavigation
      ? authenticatedShell(
          <EnterpriseRelationshipsRoutePage
            accessToken={session.accessToken}
            bootstrap={authenticatedBootstrap}
            runtime={runtime}
          />,
        )
      : sessionFallback;
  const profileBackendWorkspaceNavigation =
    currentNavigation?.backendWorkspace &&
    currentNavigation.route.startsWith('/profile')
      ? currentNavigation
      : undefined;
  const profileBackendWorkspaceElement =
    profileBackendWorkspaceNavigation?.backendWorkspace
      ? navigationRouteElement(profileBackendWorkspaceNavigation)
      : navigationRouteElement(currentNavigation);

  const initializationRequired = Boolean(
    session &&
    !locked &&
    authenticatedBootstrap &&
    (axisInitializationAdmission !== undefined
      ? axisInitializationAdmission !== 'READY'
      : (initializationStatus || initializationError) &&
        initializationStatus?.readiness !== 'READY'),
  );
  const initializationLoading = Boolean(
    session &&
    !locked &&
    authenticatedBootstrap &&
    axisInitializationAdmission === undefined &&
    !initializationStatus &&
    !initializationError,
  );
  const setupWorkflowNavigation = authenticatedBootstrap?.navigation.find(
    (item) => item.id === 'process-tasks' && item.moduleName === 'workflow',
  );
  const initializationElement =
    axisInitializationAdmission !== undefined ? (
      <Stack spacing={2} sx={{ p: 3 }}>
        <Alert severity="warning">
          Workspace initialization is not ready. Contact your administrator.
        </Alert>
        {initializationError && <Alert severity="error">{initializationError}</Alert>}
        <Button
          onClick={() => {
            setInitializationError(undefined);
            void refreshAuthenticatedBootstrap().catch(() =>
              setInitializationError('Workspace status is unavailable.'),
            );
          }}
        >
          Refresh status
        </Button>
        <Button onClick={() => logout()}>Sign out</Button>
      </Stack>
    ) : !initializationStatus && !initializationError ? (
      <LoadingScreen />
    ) : (
      <AxisInitializationWorkspace
        approvalEligibility={initializationApproval}
        busy={initializationBusy}
        error={initializationError}
        onInitiate={() => void initiateInitialization()}
        onApprove={() => void approveInitialization()}
        onLogout={logout}
        onRefresh={() => void refreshInitialization()}
        status={initializationStatus}
        statusUnavailable={initializationStatusUnavailable}
        reconnecting={initializationRecoveryAttempt > 0}
        onReviewWorkflow={
          session &&
          !locked &&
          setupWorkflowNavigation &&
          ['UP', 'DEGRADED'].includes(setupWorkflowNavigation.availability) &&
          (!setupWorkflowNavigation.featureState ||
            ['ACTIVE', 'PREVIEW'].includes(setupWorkflowNavigation.featureState))
            ? () => void navigate(`${axisInitializationRoute}/approval`)
            : undefined
        }
      />
    );

  if (initializationLoading) return <LoadingScreen />;

  if (initializationRequired) {
    return (
      <AxisLocalizationBoundary value={localization}>
        <Routes>
          <Route path={axisInitializationRoute} element={initializationElement} />
          {session &&
          !locked &&
          authenticatedBootstrap &&
          initializationStatus?.publication?.workflowRef &&
          setupWorkflowNavigation &&
          ['UP', 'DEGRADED'].includes(setupWorkflowNavigation.availability) &&
          (!setupWorkflowNavigation.featureState ||
            ['ACTIVE', 'PREVIEW'].includes(setupWorkflowNavigation.featureState)) ? (
            <Route
              path={`${axisInitializationRoute}/approval`}
              element={
                <Stack spacing={2} sx={{ p: { xs: 2, md: 3 } }}>
                  <Button
                    onClick={() => void navigate(axisInitializationRoute)}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Back to Axis setup
                  </Button>
                  <ProcessWorkflowRoutePage
                    accessToken={session.accessToken}
                    sessionGeneration={session.generation}
                    bootstrap={authenticatedBootstrap}
                    navigation={setupWorkflowNavigation}
                    runtime={runtime}
                  />
                </Stack>
              }
            />
          ) : null}
          <Route
            path="*"
            element={
              <Navigate
                replace
                to={axisInitializationRoute}
                state={
                  initializationStatusUnavailable
                    ? {
                        axisInitializationReturnPath: initializationReturnPath({
                          axisInitializationReturnPath: location.pathname,
                        }),
                      }
                    : undefined
                }
              />
            }
          />
        </Routes>
      </AxisLocalizationBoundary>
    );
  }

  // Reader access is governed by the Online CMS catalogue. Unavailable
  // BackOffice administration must not hide published articles.
  const canReadOnlineDocumentation =
    currentNavigation?.id === 'documentation-dashboard' &&
    currentNavigation.featureState !== 'HIDDEN' &&
    onlineDocsConnection !== undefined &&
    (location.pathname === '/docs' || location.pathname.startsWith('/docs/')) &&
    location.pathname !== documentationDesignerRoute &&
    !location.pathname.startsWith(`${documentationDesignerRoute}/`) &&
    !new URLSearchParams(location.search).has('manage');
  if (
    session &&
    !locked &&
    authenticatedBootstrap &&
    currentNavigation &&
    !canReadOnlineDocumentation &&
    (!['ACTIVE', 'PREVIEW'].includes(currentNavigation.featureState ?? 'ACTIVE') ||
      !['UP', 'DEGRADED'].includes(currentNavigation.availability))
  ) {
    return (
      <AxisLocalizationBoundary value={localization}>
        {authenticatedShell(
          currentNavigation.featureState === 'HIDDEN' ? (
            <UnavailableWorkspaceRoutePage
              moduleName={currentNavigation.moduleName}
              dashboardRoute={composition.defaultAuthenticatedPage}
            />
          ) : (
            <ModuleWorkspacePlaceholder
              item={currentNavigation}
              dashboardRoute={composition.defaultAuthenticatedPage}
            />
          ),
        )}
      </AxisLocalizationBoundary>
    );
  }

  return (
    <AxisLocalizationBoundary value={localization}>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              replace
              to={
                session
                  ? locked
                    ? '/lock-screen'
                    : composition.defaultAuthenticatedPage
                  : composition.defaultPublicPage
              }
            />
          }
        />
        <Route
          path="/login"
          element={
            session ? (
              <Navigate
                replace
                to={
                  locked
                    ? '/lock-screen'
                    : (safeReturnPath(
                        new URLSearchParams(location.search).get('returnTo'),
                      ) ?? composition.defaultAuthenticatedPage)
                }
              />
            ) : (
              page(
                '/login',
                undefined,
                {
                  onEmployeeLogin: (id, secret, enterprise) =>
                    void login(id, secret, enterprise),
                  employeeLoginEnterpriseCode: runtime.enterpriseCode,
                  employeeLoginPending: loginPending,
                  employeeRegistrationEntry,
                },
                undefined,
                <BundledLoginPage
                  key={runtime.enterpriseCode}
                  enterpriseCode={runtime.enterpriseCode}
                  registrationEntry={employeeRegistrationEntry}
                  error={authenticationError}
                  pending={loginPending}
                  onLogin={(id, secret, enterprise) =>
                    void login(id, secret, enterprise)
                  }
                />,
              )
            )
          }
        />
        <Route
          path="/forgot-password"
          element={
            <EmployeeRegistrationRoutePage
              runtime={runtime}
              profileBaseUrl={bootstrap.endpoints.profile}
              journey="recovery"
              onSignIn={logout}
            />
          }
        />
        <Route
          path={axisInitializationRoute}
          element={
            session && !locked ? (
              <Navigate
                replace
                to={
                  initializationReturnPath(location.state) ??
                  composition.defaultAuthenticatedPage
                }
              />
            ) : (
              <Navigate replace to={composition.defaultPublicPage} />
            )
          }
        />
        <Route
          path={INVITED_EMPLOYEE_REGISTRATION_ROUTE}
          element={
            <PublicBackendOperationsWorkspaceRoutePage
              runtime={runtime}
              profileBaseUrl={bootstrap.endpoints.profile}
              onSignIn={logout}
            />
          }
        />
        <Route
          path={axisDashboardRoute}
          element={
            session && !locked && authenticatedBootstrap ? (
              authenticatedShell(
                page(axisDashboardRoute, session.accessToken, {
                  dashboard: {
                    site: composition.site,
                    catalog: composition.catalog,
                    employeeId: session.loginId,
                    accessToken: session.accessToken,
                    bootstrap: authenticatedBootstrap,
                    runtime,
                  },
                }),
              )
            ) : (
              <Navigate
                replace
                to={session ? '/lock-screen' : composition.defaultPublicPage}
              />
            )
          }
        />
        <Route
          path="/assistant"
          element={
            session && !locked && authenticatedBootstrap && assistantNavigation
              ? authenticatedShell(
                  ['UP', 'DEGRADED'].includes(assistantNavigation.availability) &&
                    assistantConnection ? (
                    <AssistantRoutePage
                      accessToken={session.accessToken}
                      channel={composition.channel}
                      cmsBaseUrl={bootstrap.endpoints.cms}
                      connection={assistantConnection}
                      employeeId={session.loginId}
                      locale={composition.locale}
                      runtime={runtime}
                      site={composition.site}
                    />
                  ) : (
                    <ModuleWorkspacePlaceholder item={assistantNavigation} />
                  ),
                )
              : sessionFallback
          }
        />
        <Route
          path="/schema-workbench"
          element={
            session && !locked && authenticatedBootstrap && workbenchNavigation
              ? authenticatedShell(
                  ['UP', 'DEGRADED'].includes(workbenchNavigation.availability) ? (
                    <WorkbenchRoutePage
                      accessToken={session.accessToken}
                      bootstrap={authenticatedBootstrap}
                      channel={composition.channel}
                      cmsBaseUrl={bootstrap.endpoints.cms}
                      employeeId={session.loginId}
                      locale={composition.locale}
                      routeNavigation={workbenchNavigation}
                      runtime={runtime}
                      site={composition.site}
                    />
                  ) : (
                    <ModuleWorkspacePlaceholder item={workbenchNavigation} />
                  ),
                )
              : sessionFallback
          }
        />
        <Route
          path="/system-integrations"
          element={
            session && !locked && authenticatedBootstrap && systemIntegrationsNavigation
              ? authenticatedShell(
                  ['UP', 'DEGRADED'].includes(
                    systemIntegrationsNavigation.availability,
                  ) ? (
                    <SystemIntegrationsDashboardRoutePage
                      accessToken={session.accessToken}
                      bootstrap={authenticatedBootstrap}
                      routeNavigation={systemIntegrationsNavigation}
                      runtime={runtime}
                    />
                  ) : (
                    <ModuleWorkspacePlaceholder item={systemIntegrationsNavigation} />
                  ),
                )
              : sessionFallback
          }
        />
        <Route
          path="/system"
          element={<Navigate replace to="/system-integrations" />}
        />
        <Route
          path="/registry"
          element={
            session && !locked && authenticatedBootstrap && moduleRegistryNavigation
              ? authenticatedShell(
                  ['UP', 'DEGRADED'].includes(moduleRegistryNavigation.availability) ? (
                    <FunctionalModuleRegistryRoutePage
                      key={session.generation}
                      sessionGeneration={session.generation}
                      accessToken={session.accessToken}
                      bootstrap={authenticatedBootstrap}
                      onBootstrapRefresh={refreshAuthenticatedBootstrap}
                      routeNavigation={moduleRegistryNavigation}
                      runtime={runtime}
                    />
                  ) : (
                    <ModuleWorkspacePlaceholder item={moduleRegistryNavigation} />
                  ),
                )
              : sessionFallback
          }
        />
        <Route
          path="/administration/navigation-composition"
          element={
            session &&
            !locked &&
            authenticatedBootstrap &&
            navigationCompositionNavigation
              ? authenticatedShell(
                  <NavigationCompositionRoutePage
                    accessToken={session.accessToken}
                    bootstrap={authenticatedBootstrap}
                    routeNavigation={navigationCompositionNavigation}
                    runtime={runtime}
                  />,
                )
              : sessionFallback
          }
        />
        <Route
          path="/setup-accelerators"
          element={
            session && !locked && authenticatedBootstrap && setupAcceleratorsNavigation
              ? authenticatedShell(
                  <SetupAcceleratorsRoutePage
                    accessToken={session.accessToken}
                    bootstrap={authenticatedBootstrap}
                    onBootstrapRefresh={refreshAuthenticatedBootstrap}
                    routeNavigation={setupAcceleratorsNavigation}
                    runtime={runtime}
                  />,
                )
              : sessionFallback
          }
        />
        <Route path="/system/modules" element={<Navigate replace to="/registry" />} />
        <Route
          path="/operations/module-health"
          element={
            session && !locked && authenticatedBootstrap && moduleHealthNavigation
              ? authenticatedShell(
                  ['UP', 'DEGRADED'].includes(moduleHealthNavigation.availability) ? (
                    <ModuleHealthRoutePage
                      accessToken={session.accessToken}
                      bootstrap={authenticatedBootstrap}
                      routeNavigation={moduleHealthNavigation}
                      runtime={runtime}
                    />
                  ) : (
                    <ModuleWorkspacePlaceholder item={moduleHealthNavigation} />
                  ),
                )
              : sessionFallback
          }
        />
        <Route
          path="/system/health"
          element={<Navigate replace to="/operations/module-health" />}
        />
        <Route
          path="/operations/imports-exports"
          element={
            session && !locked && authenticatedBootstrap && importExportNavigation
              ? authenticatedShell(
                  ['UP', 'DEGRADED'].includes(importExportNavigation.availability) ? (
                    <ImportExportRoutePage
                      key={session.generation}
                      accessToken={session.accessToken}
                      sessionGeneration={session.generation}
                      bootstrap={authenticatedBootstrap}
                      routeNavigation={importExportNavigation}
                      runtime={runtime}
                    />
                  ) : (
                    <ModuleWorkspacePlaceholder item={importExportNavigation} />
                  ),
                )
              : sessionFallback
          }
        />
        <Route
          path="/system/imports"
          element={<Navigate replace to="/operations/imports-exports" />}
        />
        <Route
          path="/system/apis"
          element={
            openApiSource &&
            authenticatedBootstrap?.navigation.some(
              (item) =>
                item.moduleName === 'backoffice' &&
                item.route === '/docs' &&
                ['UP', 'DEGRADED'].includes(item.availability) &&
                item.featureState !== 'HIDDEN' &&
                item.featureState !== 'DISABLED',
            ) ? (
              <Navigate
                replace
                to={`/docs?manage=${encodeURIComponent(openApiSource.id)}`}
              />
            ) : (
              sessionFallback
            )
          }
        />
        <Route
          path="/cron/*"
          element={
            session && !locked && authenticatedBootstrap
              ? cronNavigation
                ? authenticatedShell(
                    selectModuleConnection(authenticatedBootstrap, 'cronjob') ? (
                      <CronDashboardRoutePage
                        accessToken={session.accessToken}
                        bootstrap={authenticatedBootstrap}
                        routeNavigation={cronNavigation}
                        runtime={runtime}
                      />
                    ) : (
                      <ModuleWorkspacePlaceholder item={cronNavigation} />
                    ),
                  )
                : sessionFallback
              : sessionFallback
          }
        />
        <Route path="/docs" element={documentationRouteElement} />
        <Route path="/docs/*" element={documentationRouteElement} />
        <Route path="/media" element={mediaManagementDashboardElement} />
        <Route
          path="/media/*"
          element={
            currentNavigation?.backendWorkspace
              ? navigationRouteElement(currentNavigation)
              : session &&
                  !locked &&
                  authenticatedBootstrap &&
                  mediaManagementNavigation
                ? authenticatedShell(
                    ['UP', 'DEGRADED'].includes(
                      mediaManagementNavigation.availability,
                    ) ? (
                      <MediaManagementRoutePage
                        accessToken={session.accessToken}
                        bootstrap={authenticatedBootstrap}
                        runtime={runtime}
                      />
                    ) : (
                      <ModuleWorkspacePlaceholder item={mediaManagementNavigation} />
                    ),
                  )
                : sessionFallback
          }
        />
        <Route path="/content" element={contentDashboardElement} />
        <Route
          path={documentationDesignerRoute}
          element={documentationManagementElement}
        />
        <Route
          path={`${documentationDesignerRoute}/*`}
          element={documentationManagementElement}
        />
        <Route
          path={legacyDocumentationDesignerRoute}
          element={
            <Navigate
              replace
              to={`${documentationDesignerRedirect(location.pathname)}${location.search}${location.hash}`}
            />
          }
        />
        <Route
          path={`${legacyDocumentationDesignerRoute}/*`}
          element={
            <Navigate
              replace
              to={`${documentationDesignerRedirect(location.pathname)}${location.search}${location.hash}`}
            />
          }
        />
        <Route path="/content/designer" element={contentDesignerElement} />
        <Route path="/content/experience-studio" element={wcmsExperienceElement} />
        <Route path="/content/experience-studio/*" element={wcmsExperienceElement} />
        <Route path="/content/*" element={cmsWorkbenchElement} />
        <Route path="/publishing" element={publishingDashboardElement} />
        <Route path="/publishing/*" element={publishingRouteGuidanceElement} />
        <Route path="/compliance-management/*" element={complianceElement} />
        <Route path="/notifications/*" element={notificationElement} />
        <Route path="/commerce/catalog/readiness" element={productSellabilityElement} />
        <Route path="/commerce/catalog/products/*" element={productManagementElement} />
        <Route path="/commerce/search/*" element={discoveryManagementElement} />
        <Route path="/commerce/promotions/*" element={promotionBuilderElement} />
        <Route path="/discovery/*" element={discoveryManagementElement} />
        <Route path="/localization/*" element={localizationOperationsElement} />
        <Route path="/commerce/*" element={commerceRouteElement} />
        <Route path="/waste/collection-centres" element={collectionCentresElement} />
        <Route path="/location/maps" element={locationMapConfigurationElement} />
        <Route path="/location/maps/*" element={locationMapConfigurationElement} />
        <Route path="/profile/*" element={profileBackendWorkspaceElement} />
        <Route
          path="/enterprises/:enterpriseCode"
          element={enterpriseRelationshipsElement}
        />
        <Route path="/process/*" element={processWorkflowElement} />
        <Route path="/engagement/*" element={customerEngagementElement} />
        {session && !locked && authenticatedBootstrap
          ? authenticatedBootstrap.navigation
              .filter(
                (item) =>
                  !item.route.startsWith('/commerce') &&
                  !item.route.startsWith('/compliance-management') &&
                  !item.route.startsWith('/notifications') &&
                  !item.route.startsWith('/content') &&
                  !item.route.startsWith(documentationDesignerRoute) &&
                  !item.route.startsWith('/docs') &&
                  !item.route.startsWith('/engagement') &&
                  !item.route.startsWith('/media') &&
                  !item.route.startsWith('/localization') &&
                  !item.route.startsWith('/process') &&
                  !item.route.startsWith('/publishing') &&
                  !item.route.startsWith('/cron') &&
                  !item.route.startsWith('/location/maps') &&
                  ![
                    '/assistant',
                    '/registry',
                    '/administration/navigation-composition',
                    '/schema-workbench',
                    '/system-integrations',
                    '/setup-accelerators',
                    '/operations/module-health',
                    '/operations/imports-exports',
                    axisDashboardRoute,
                    axisInitializationRoute,
                    '/login',
                    '/forgot-password',
                    '/lock-screen',
                  ].includes(item.route),
              )
              .map((item) => (
                <Route
                  key={`${item.moduleName}:${item.id}`}
                  path={item.route}
                  element={navigationRouteElement(item)}
                />
              ))
          : null}
        <Route
          path="/lock-screen"
          element={
            session && locked ? (
              page('/lock-screen', session.accessToken, {
                currentEmployeeId: session.loginId,
                onEmployeeUnlock: (password) => void unlock(password),
                employeeUnlockPending: unlockPending,
                employeeSessionRecoveryMessage:
                  employeePolicy?.sessionRecoveryPresentation?.lockedMessage,
                onEmployeeSignOut: logout,
              })
            ) : (
              <Navigate
                replace
                to={session ? lockedReturnPath : composition.defaultPublicPage}
              />
            )
          }
        />
        {session &&
          !locked &&
          authenticatedBootstrap &&
          wasteOverviewAliases(authenticatedBootstrap.navigation).map((alias) => (
            <Route
              key={alias.from}
              path={alias.from}
              element={
                <Navigate
                  replace
                  to={`${alias.to}${location.search}${location.hash}`}
                />
              }
            />
          ))}
        <Route path="*" element={sessionFallback} />
      </Routes>
    </AxisLocalizationBoundary>
  );
}
