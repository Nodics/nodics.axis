import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';

import {
  authenticateEmployee,
  logoutEmployee,
  restoreEmployeeSession,
  type EmployeeSession,
} from '../auth/employeeAuthClient';
import {
  loadAuthenticatedBootstrap,
  loadPublicBootstrap,
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisEmployeePolicy,
  type AxisNavigationItem,
  type AxisPublicBootstrap,
} from '../bootstrap/publicBootstrap';
import { AssistantRoutePage } from '../assistant/AssistantRoutePage';
import { WorkbenchRoutePage } from '../workbench/WorkbenchRoutePage';
import { DocumentationRoutePage } from '../documentation/DocumentationRoutePage';
import { ModuleHealthRoutePage } from '../operations/moduleHealth/ModuleHealthRoutePage';
import { FunctionalModuleRegistryRoutePage } from '../operations/moduleRegistry/FunctionalModuleRegistryRoutePage';
import { SystemIntegrationsDashboardRoutePage } from '../operations/systemIntegrations/SystemIntegrationsDashboardRoutePage';
import { CronDashboardRoutePage } from '../operations/cron/CronDashboardRoutePage';
import { ContentDashboardRoutePage } from '../operations/contentExperience/ContentDashboardRoutePage';
import { ContentDesignerRoutePage } from '../operations/contentExperience/ContentDesignerRoutePage';
import { PublishingDashboardRoutePage } from '../operations/contentExperience/PublishingDashboardRoutePage';
import { ImportExportRoutePage } from '../operations/importExport/ImportExportRoutePage';
import { ComplianceManagementRoutePage } from '../operations/compliance/ComplianceManagementRoutePage';
import { NotificationManagementRoutePage } from '../operations/notifications/NotificationManagementRoutePage';
import { OrderLifecycleManagementRoutePage } from '../operations/orderLifecycle/OrderLifecycleManagementRoutePage';
import { MediaManagementDashboardRoutePage } from '../operations/mediaManagement/MediaManagementDashboardRoutePage';
import { MediaManagementRoutePage } from '../operations/mediaManagement/MediaManagementRoutePage';
import { ProcessWorkflowRoutePage } from '../operations/processWorkflow/ProcessWorkflowRoutePage';
import { ProductManagementRoutePage } from '../operations/productManagement/ProductManagementRoutePage';
import { ProductSellabilityWorkspace } from '../operations/productManagement/ProductSellabilityWorkspace';
import { DiscoveryManagementRoutePage } from '../operations/discovery/DiscoveryManagementRoutePage';
import { PromotionsBuilderRoutePage } from '../operations/promotions/PromotionsBuilderRoutePage';
import { LocalizationOperationsRoutePage } from '../operations/localization/LocalizationOperationsRoutePage';
import { CustomerEngagementRoutePage } from '../operations/customerEngagement/CustomerEngagementRoutePage';
import { useIdleScreenLock } from '../auth/useIdleScreenLock';
import { AxisInitializationWorkspace } from '../initialization/AxisInitializationWorkspace';
import { BundledLoginPage } from '../initialization/BundledLoginPage';
import {
  initiateAxisInitialization,
  loadAxisInitializationStatus,
  type AxisInitializationStatus,
} from '../initialization/axisInitializationClient';
import {
  completeProcessTask,
  loadProcessTasks,
} from '../operations/processWorkflow/api/processDefinitionClient';
import {
  clearScreenLock,
  persistScreenLock,
  restoreScreenLock,
} from '../auth/screenLockState';
import type { CmsRendererActions } from '../cms/renderers/shared/rendererTypes';
import {
  AxisLocalizationBoundary,
  useAxisLocalizationController,
} from '../localization/AxisLocalizationContext';
import { useRuntimeConfig } from '../runtime/RuntimeConfigContext';
import { CmsRoutePage } from './CmsRoutePage';
import { LoadingScreen } from './LoadingScreen';
import { ModuleWorkspacePlaceholder } from './ModuleWorkspacePlaceholder';
import { RecoveryScreen } from './RecoveryScreen';
import { AppShell } from './shell/AppShell';

function normalizeRoutePath(path: string): string {
  return path.replace(/\/$/, '') || '/';
}

function resolveCurrentNavigation(
  navigation: readonly AxisNavigationItem[] | undefined,
  pathname: string,
): AxisNavigationItem | undefined {
  if (!navigation) return undefined;
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
  const runtime = useRuntimeConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [attempt, setAttempt] = useState(0);
  const [bootstrap, setBootstrap] = useState<AxisPublicBootstrap>();
  const [bootstrapError, setBootstrapError] = useState<string>();
  const [session, setSession] = useState<EmployeeSession>();
  const [authenticatedBootstrap, setAuthenticatedBootstrap] =
    useState<AxisAuthenticatedBootstrap>();
  const [employeePolicy, setEmployeePolicy] = useState<AxisEmployeePolicy>();
  const [locked, setLocked] = useState(false);
  const [lockedReturnPath, setLockedReturnPath] = useState('/dashboard');
  const [authenticationError, setAuthenticationError] = useState<string>();
  const [initializationStatus, setInitializationStatus] =
    useState<AxisInitializationStatus>();
  const [initializationError, setInitializationError] = useState<string>();
  const [initializationBusy, setInitializationBusy] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);
  const localization = useAxisLocalizationController(bootstrap, runtime);

  useEffect(() => {
    let active = true;
    void loadPublicBootstrap(
      runtime.backofficeBaseUrl,
      runtime.clientContractVersion,
      runtime.requestTimeoutMs,
    )
      .then((value) => {
        if (active) setBootstrap(value);
      })
      .catch((error: unknown) => {
        if (active) {
          setBootstrapError(
            error instanceof Error ? error.message : 'BackOffice discovery failed',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [attempt, runtime]);

  useEffect(() => {
    if (!bootstrap || !restoringSession) return;
    let active = true;
    void restoreEmployeeSession(
      bootstrap.endpoints.profile,
      runtime.enterpriseCode,
      runtime.browserSessionCsrfCookieName,
      runtime.requestTimeoutMs,
    )
      .then(async (nextSession) => {
        const employeeBootstrap = await loadAuthenticatedBootstrap(
          runtime.backofficeBaseUrl,
          runtime.clientContractVersion,
          nextSession.accessToken,
          runtime.requestTimeoutMs,
        );
        if (!active) return;
        setSession(nextSession);
        setAuthenticatedBootstrap(employeeBootstrap);
        setEmployeePolicy(employeeBootstrap.axisPolicy);
        const persistedLock = restoreScreenLock();
        if (persistedLock) {
          setLockedReturnPath(persistedLock.returnPath);
          setLocked(true);
          void navigate('/lock-screen', { replace: true });
        }
      })
      .catch(() => {
        if (active) {
          setSession(undefined);
          setAuthenticatedBootstrap(undefined);
          setEmployeePolicy(undefined);
        }
      })
      .finally(() => {
        if (active) setRestoringSession(false);
      });
    return () => {
      active = false;
    };
  }, [bootstrap, navigate, restoringSession, runtime]);

  const lockScreen = useCallback(() => {
    if (!session || locked) return;
    const returnPath = ['/login', '/forgot-password', '/lock-screen'].includes(
      location.pathname,
    )
      ? '/dashboard'
      : location.pathname;
    setLockedReturnPath(returnPath);
    persistScreenLock(returnPath);
    setAuthenticationError(undefined);
    setLocked(true);
    void navigate('/lock-screen', { replace: true });
  }, [location.pathname, locked, navigate, session]);

  useIdleScreenLock(
    Boolean(session) && !locked && employeePolicy?.screenLockEnabled === true,
    employeePolicy?.idleTimeoutSeconds ?? 900,
    lockScreen,
  );

  const refreshAuthenticatedBootstrap = useCallback(async () => {
    if (!session || locked) return;
    const employeeBootstrap = await loadAuthenticatedBootstrap(
      runtime.backofficeBaseUrl,
      runtime.clientContractVersion,
      session.accessToken,
      runtime.requestTimeoutMs,
    );
    setAuthenticatedBootstrap(employeeBootstrap);
    setEmployeePolicy(employeeBootstrap.axisPolicy);
  }, [locked, runtime, session]);

  const refreshInitialization = useCallback(async () => {
    if (!session) return;
    setInitializationBusy(true);
    setInitializationError(undefined);
    try {
      setInitializationStatus(
        await loadAxisInitializationStatus(
          runtime.backofficeBaseUrl,
          session.accessToken,
          runtime.requestTimeoutMs,
        ),
      );
    } catch (error: unknown) {
      setInitializationError(
        error instanceof Error ? error.message : 'Axis initialization status failed',
      );
    } finally {
      setInitializationBusy(false);
    }
  }, [runtime, session]);

  const approveInitialization = useCallback(async () => {
    const workflowRef = initializationStatus?.publication?.workflowRef;
    if (!session || !workflowRef) {
      setInitializationError('The governed Process approval task is unavailable');
      return;
    }
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
      const processConnection =
        selectModuleConnection(latestBootstrap, 'flowApi', {
          server: 'processServer',
        }) ??
        selectModuleConnection(latestBootstrap, 'workflow', {
          server: 'processServer',
        });
      if (!processConnection) {
        throw new Error('The governed Process approval task is unavailable');
      }
      const configuration = {
        accessToken: session.accessToken,
        enterpriseCode: runtime.enterpriseCode,
        timeoutMs: runtime.requestTimeoutMs,
      };
      let tasks = await loadProcessTasks(processConnection, configuration, workflowRef);
      let task = tasks.find((item) =>
        ['OPEN', 'CLAIMED', 'ESCALATED'].includes(item.status),
      );
      if (!task) {
        const replayed = await initiateAxisInitialization(
          runtime.backofficeBaseUrl,
          session.accessToken,
          runtime.requestTimeoutMs,
        );
        const replayedWorkflowRef = replayed.publication?.workflowRef ?? workflowRef;
        tasks = await loadProcessTasks(
          processConnection,
          configuration,
          replayedWorkflowRef,
        );
        task = tasks.find((item) =>
          ['OPEN', 'CLAIMED', 'ESCALATED'].includes(item.status),
        );
      }
      if (!task) throw new Error('No actionable Process approval task was found');
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
  }, [initializationStatus, refreshInitialization, runtime, session]);

  useEffect(() => {
    if (!session || !authenticatedBootstrap) {
      setInitializationStatus(undefined);
      setInitializationError(undefined);
      return;
    }
    void refreshInitialization();
  }, [authenticatedBootstrap, refreshInitialization, session]);

  if (bootstrapError) {
    return (
      <RecoveryScreen
        state={{ kind: 'backoffice', detail: bootstrapError, retryable: true }}
        onRetry={() => {
          setBootstrap(undefined);
          setBootstrapError(undefined);
          setAttempt((current) => current + 1);
        }}
      />
    );
  }
  if (!bootstrap || restoringSession) return <LoadingScreen />;

  const composition = bootstrap.uiComposition;
  const assistantNavigation = authenticatedBootstrap?.navigation.find(
    (item) => item.id === 'assistant' && item.moduleName === 'aiAssistant',
  );
  const assistantConnection = authenticatedBootstrap
    ? selectModuleConnection(authenticatedBootstrap, 'aiAssistant')
    : undefined;
  const workbenchNavigation = authenticatedBootstrap?.navigation.find(
    (item) => item.id === 'schema-workbench' && item.moduleName === 'backoffice',
  );
  const documentationNavigation = authenticatedBootstrap?.navigation.find(
    (item) => item.id === 'documentation' && item.moduleName === 'backoffice',
  ) ?? authenticatedBootstrap?.navigation.find(
    (item) =>
      item.group?.label === 'Documentation' &&
      item.route.startsWith('/docs/') &&
      ['UP', 'DEGRADED'].includes(item.availability),
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
  const importExportNavigation = authenticatedBootstrap?.navigation.find(
    (item) => item.id === 'imports-exports' && item.moduleName === 'backoffice',
  );
  const cronNavigation =
    authenticatedBootstrap?.navigation.find(
      (item) => item.route.startsWith('/cron') || item.moduleName === 'cronjob',
    ) ??
    ({
      id: 'cron',
      label: 'Cron',
      route: '/cron',
      order: 0,
      moduleName: 'cronjob',
      category: 'operations',
      icon: 'cronjob',
      availability:
        authenticatedBootstrap &&
        selectModuleConnection(authenticatedBootstrap, 'cronjob')
          ? 'UP'
          : 'UNKNOWN',
      perspectives: ['operations'],
      contexts: ['scheduler'],
      featureState: 'ACTIVE',
      help: {
        summary:
          'Monitor scheduled job definitions, execution logs, and cron runtime health.',
      },
    } satisfies AxisNavigationItem);
  const mediaManagementNavigation = authenticatedBootstrap?.navigation.find(
    (item) => item.id === 'media-management' && item.moduleName === 'media',
  );
  const cmsWorkbenchNavigation = authenticatedBootstrap?.navigation.find(
    (item) => item.id === 'cms' && item.moduleName === 'cms',
  );
  const contentDashboardNavigation =
    authenticatedBootstrap?.navigation.find(
      (item) => item.route === '/content' && item.group?.id === 'content',
    ) ?? cmsWorkbenchNavigation;
  const publishingDashboardNavigation =
    authenticatedBootstrap?.navigation.find(
      (item) => item.route === '/publishing' && item.group?.id === 'publishing',
    ) ?? cmsWorkbenchNavigation;
  const currentNavigation = resolveCurrentNavigation(
    authenticatedBootstrap?.navigation,
    location.pathname,
  );
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
      accessToken={accessToken}
      actions={actions}
      authenticationError={authenticationError}
      channel={composition.channel}
      cmsBaseUrl={bootstrap.endpoints.cms}
      enterpriseCode={runtime.enterpriseCode}
      locale={composition.locale}
      onLogout={onLogout}
      path={path}
      site={composition.site}
      timeoutMs={runtime.requestTimeoutMs}
      unavailableFallback={unavailableFallback}
    />
  );

  const login = async (loginId: string, password: string) => {
    setAuthenticationError(undefined);
    try {
      const nextSession = await authenticateEmployee(
        bootstrap.endpoints.profile,
        runtime.enterpriseCode,
        loginId,
        password,
        runtime.requestTimeoutMs,
      );
      const employeeBootstrap = await loadAuthenticatedBootstrap(
        runtime.backofficeBaseUrl,
        runtime.clientContractVersion,
        nextSession.accessToken,
        runtime.requestTimeoutMs,
      );
      setSession(nextSession);
      setAuthenticatedBootstrap(employeeBootstrap);
      setEmployeePolicy(employeeBootstrap.axisPolicy);
      clearScreenLock();
      setLocked(false);
      void navigate(composition.defaultAuthenticatedPage, { replace: true });
    } catch (error: unknown) {
      setSession(undefined);
      setAuthenticationError(
        localization.formatError(error, 'Employee authentication failed'),
      );
    }
  };

  const logout = () => {
    const current = session;
    if (!current) {
      void navigate(composition.defaultPublicPage, { replace: true });
      return;
    }
    setAuthenticationError(undefined);
    void logoutEmployee(
      bootstrap.endpoints.profile,
      runtime.enterpriseCode,
      runtime.browserSessionCsrfCookieName,
      runtime.requestTimeoutMs,
    )
      .then(() => {
        setSession(undefined);
        setAuthenticatedBootstrap(undefined);
        setEmployeePolicy(undefined);
        clearScreenLock();
        setLocked(false);
        void navigate(composition.defaultPublicPage, { replace: true });
      })
      .catch(() => {
        setAuthenticationError(
          'Secure logout could not be completed. Please retry before leaving this device.',
        );
        setLocked(true);
        void navigate('/lock-screen', { replace: true });
      });
  };

  const initiateInitialization = async () => {
    if (!session) return;
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
    } finally {
      setInitializationBusy(false);
    }
  };

  const unlock = async (password: string) => {
    if (!session) return;
    setAuthenticationError(undefined);
    try {
      const nextSession = await authenticateEmployee(
        bootstrap.endpoints.profile,
        runtime.enterpriseCode,
        session.loginId,
        password,
        runtime.requestTimeoutMs,
      );
      const employeeBootstrap = await loadAuthenticatedBootstrap(
        runtime.backofficeBaseUrl,
        runtime.clientContractVersion,
        nextSession.accessToken,
        runtime.requestTimeoutMs,
      );
      setSession(nextSession);
      setAuthenticatedBootstrap(employeeBootstrap);
      setEmployeePolicy(employeeBootstrap.axisPolicy);
      clearScreenLock();
      setLocked(false);
      void navigate(lockedReturnPath, { replace: true });
    } catch (error: unknown) {
      setAuthenticationError(localization.formatError(error, 'Employee unlock failed'));
    }
  };

  const authenticatedShell = (content: ReactNode) => (
    <AppShell
      catalog={composition.catalog}
      employeeId={session?.loginId}
      enterpriseCode={runtime.enterpriseCode}
      environments={authenticatedBootstrap?.environments}
      tenantCode={authenticatedBootstrap?.tenantCode}
      navigation={authenticatedBootstrap?.navigation}
      recentNavigationLimit={authenticatedBootstrap?.axisPolicy.recentNavigationLimit}
      site={composition.site}
      onLock={lockScreen}
      onLogout={logout}
    >
      {content}
    </AppShell>
  );
  const sessionFallback = (
    <Navigate
      replace
      to={
        session && !locked
          ? composition.defaultAuthenticatedPage
          : session
            ? '/lock-screen'
            : composition.defaultPublicPage
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
          ['UP', 'DEGRADED'].includes(navigationItem.availability) &&
            selectModuleConnection(
              authenticatedBootstrap,
              navigationItem.workbenchTarget.moduleName,
            ) ? (
            <WorkbenchRoutePage
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
      ? navigationItem.workbenchTarget
        ? workbenchRouteElement(navigationItem)
        : authenticatedShell(<ModuleWorkspacePlaceholder item={navigationItem} />)
      : sessionFallback;
  const cmsWorkbenchElement =
    cmsWorkbenchNavigation && currentWorkbenchSchema
      ? workbenchRouteElement(currentWorkbenchNavigation)
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
  const contentDesignerNavigation =
    authenticatedBootstrap?.navigation.find(
      (item) => item.route === '/content/designer',
    ) ?? contentDashboardNavigation;
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
  const commerceRouteElement = orderLifecycleNavigation
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
  const localizationNavigation = currentNavigation?.route.startsWith('/localization')
    ? currentNavigation
    : authenticatedBootstrap?.navigation.find(
        (item) =>
          item.id === 'localization-operations' &&
          item.moduleName === 'nodics.localization',
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
              locale={composition.locale}
              navigation={localizationNavigation}
              runtime={runtime}
              site={composition.site}
            />
          ) : (
            <ModuleWorkspacePlaceholder item={localizationNavigation} />
          ),
        )
      : sessionFallback;
  const processNavigation = currentNavigation?.route.startsWith('/process')
    ? currentNavigation
    : authenticatedBootstrap?.navigation.find(
        (item) =>
          item.id === 'process-workflows' && item.moduleName === 'nodics.process',
      );
  const processWorkflowElement =
    session && !locked && authenticatedBootstrap && processNavigation
      ? authenticatedShell(
          ['UP', 'DEGRADED'].includes(processNavigation.availability) ? (
            <ProcessWorkflowRoutePage
              accessToken={session.accessToken}
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

  if (
    session &&
    authenticatedBootstrap &&
    initializationStatus?.readiness !== 'READY'
  ) {
    if (!initializationStatus && !initializationError) return <LoadingScreen />;
    return (
      <AxisInitializationWorkspace
        busy={initializationBusy}
        error={initializationError}
        onInitiate={() => void initiateInitialization()}
        onApprove={() => void approveInitialization()}
        onLogout={logout}
        onRefresh={() => void refreshInitialization()}
        status={initializationStatus}
      />
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
                to={locked ? '/lock-screen' : composition.defaultAuthenticatedPage}
              />
            ) : (
              page(
                '/login',
                undefined,
                { onEmployeeLogin: (id, secret) => void login(id, secret) },
                undefined,
                <BundledLoginPage
                  error={authenticationError}
                  onLogin={(id, secret) => void login(id, secret)}
                />,
              )
            )
          }
        />
        <Route path="/forgot-password" element={page('/forgot-password')} />
        <Route
          path="/dashboard"
          element={
            session && !locked && authenticatedBootstrap ? (
              authenticatedShell(page('/dashboard', session.accessToken))
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
            session && !locked && authenticatedBootstrap && assistantNavigation ? (
              authenticatedShell(
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
            ) : (
              <Navigate
                replace
                to={
                  session && !locked
                    ? composition.defaultAuthenticatedPage
                    : session
                      ? '/lock-screen'
                      : composition.defaultPublicPage
                }
              />
            )
          }
        />
        <Route
          path="/schema-workbench"
          element={
            session && !locked && authenticatedBootstrap && workbenchNavigation ? (
              authenticatedShell(
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
            ) : (
              <Navigate
                replace
                to={
                  session && !locked
                    ? composition.defaultAuthenticatedPage
                    : session
                      ? '/lock-screen'
                      : composition.defaultPublicPage
                }
              />
            )
          }
        />
        <Route
          path="/system-integrations"
          element={
            session &&
            !locked &&
            authenticatedBootstrap &&
            systemIntegrationsNavigation ? (
              authenticatedShell(
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
            ) : (
              <Navigate
                replace
                to={
                  session && !locked
                    ? composition.defaultAuthenticatedPage
                    : session
                      ? '/lock-screen'
                      : composition.defaultPublicPage
                }
              />
            )
          }
        />
        <Route
          path="/system"
          element={<Navigate replace to="/system-integrations" />}
        />
        <Route
          path="/registry"
          element={
            session && !locked && authenticatedBootstrap && moduleRegistryNavigation ? (
              authenticatedShell(
                ['UP', 'DEGRADED'].includes(moduleRegistryNavigation.availability) ? (
                  <FunctionalModuleRegistryRoutePage
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
            ) : (
              <Navigate
                replace
                to={
                  session && !locked
                    ? composition.defaultAuthenticatedPage
                    : session
                      ? '/lock-screen'
                      : composition.defaultPublicPage
                }
              />
            )
          }
        />
        <Route path="/system/modules" element={<Navigate replace to="/registry" />} />
        <Route
          path="/operations/module-health"
          element={
            session && !locked && authenticatedBootstrap && moduleHealthNavigation ? (
              authenticatedShell(
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
            ) : (
              <Navigate
                replace
                to={
                  session && !locked
                    ? composition.defaultAuthenticatedPage
                    : session
                      ? '/lock-screen'
                      : composition.defaultPublicPage
                }
              />
            )
          }
        />
        <Route
          path="/system/health"
          element={<Navigate replace to="/operations/module-health" />}
        />
        <Route
          path="/operations/imports-exports"
          element={
            session && !locked && authenticatedBootstrap && importExportNavigation ? (
              authenticatedShell(
                ['UP', 'DEGRADED'].includes(importExportNavigation.availability) ? (
                  <ImportExportRoutePage
                    accessToken={session.accessToken}
                    bootstrap={authenticatedBootstrap}
                    routeNavigation={importExportNavigation}
                    runtime={runtime}
                  />
                ) : (
                  <ModuleWorkspacePlaceholder item={importExportNavigation} />
                ),
              )
            ) : (
              <Navigate
                replace
                to={
                  session && !locked
                    ? composition.defaultAuthenticatedPage
                    : session
                      ? '/lock-screen'
                      : composition.defaultPublicPage
                }
              />
            )
          }
        />
        <Route
          path="/system/imports"
          element={<Navigate replace to="/operations/imports-exports" />}
        />
        <Route path="/system/apis" element={<Navigate replace to="/docs/swaggers" />} />
        <Route
          path="/cron/*"
          element={
            session && !locked && authenticatedBootstrap ? (
              authenticatedShell(
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
            ) : (
              <Navigate
                replace
                to={
                  session && !locked
                    ? composition.defaultAuthenticatedPage
                    : session
                      ? '/lock-screen'
                      : composition.defaultPublicPage
                }
              />
            )
          }
        />
        <Route
          path="/docs/*"
          element={
            session && !locked && authenticatedBootstrap && documentationNavigation ? (
              authenticatedShell(
                ['UP', 'DEGRADED'].includes(documentationNavigation.availability) ? (
                  <DocumentationRoutePage
                    accessToken={session.accessToken}
                    bootstrap={authenticatedBootstrap}
                    channel={composition.channel}
                    cmsBaseUrl={bootstrap.endpoints.cms}
                    locale={composition.locale}
                    path={location.pathname}
                    runtime={runtime}
                  />
                ) : (
                  <ModuleWorkspacePlaceholder item={documentationNavigation} />
                ),
              )
            ) : (
              <Navigate
                replace
                to={
                  session && !locked
                    ? composition.defaultAuthenticatedPage
                    : session
                      ? '/lock-screen'
                      : composition.defaultPublicPage
                }
              />
            )
          }
        />
        <Route path="/media" element={mediaManagementDashboardElement} />
        <Route
          path="/media/*"
          element={
            session &&
            !locked &&
            authenticatedBootstrap &&
            mediaManagementNavigation ? (
              authenticatedShell(
                ['UP', 'DEGRADED'].includes(mediaManagementNavigation.availability) ? (
                  <MediaManagementRoutePage
                    accessToken={session.accessToken}
                    bootstrap={authenticatedBootstrap}
                    runtime={runtime}
                  />
                ) : (
                  <ModuleWorkspacePlaceholder item={mediaManagementNavigation} />
                ),
              )
            ) : (
              <Navigate
                replace
                to={
                  session && !locked
                    ? composition.defaultAuthenticatedPage
                    : session
                      ? '/lock-screen'
                      : composition.defaultPublicPage
                }
              />
            )
          }
        />
        <Route path="/content" element={contentDashboardElement} />
        <Route path="/content/designer" element={contentDesignerElement} />
        <Route path="/content/*" element={cmsWorkbenchElement} />
        <Route path="/publishing" element={publishingDashboardElement} />
        <Route path="/publishing/*" element={cmsWorkbenchElement} />
        <Route path="/compliance-management/*" element={complianceElement} />
        <Route path="/notifications/*" element={notificationElement} />
        <Route path="/commerce/catalog/readiness" element={productSellabilityElement} />
        <Route path="/commerce/catalog/products/*" element={productManagementElement} />
        <Route path="/commerce/search/*" element={discoveryManagementElement} />
        <Route path="/commerce/promotions/*" element={promotionBuilderElement} />
        <Route path="/discovery/*" element={discoveryManagementElement} />
        <Route path="/localization/*" element={localizationOperationsElement} />
        <Route path="/commerce/*" element={commerceRouteElement} />
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
                  !item.route.startsWith('/docs') &&
                  !item.route.startsWith('/engagement') &&
                  !item.route.startsWith('/media') &&
                  !item.route.startsWith('/localization') &&
                  !item.route.startsWith('/process') &&
                  !item.route.startsWith('/publishing') &&
                  !item.route.startsWith('/cron') &&
                  ![
                    '/assistant',
                    '/registry',
                    '/schema-workbench',
                    '/system-integrations',
                    '/operations/module-health',
                    '/operations/imports-exports',
                    '/dashboard',
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
                onEmployeeSignOut: logout,
              })
            ) : (
              <Navigate
                replace
                to={
                  session
                    ? composition.defaultAuthenticatedPage
                    : composition.defaultPublicPage
                }
              />
            )
          }
        />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </AxisLocalizationBoundary>
  );
}
