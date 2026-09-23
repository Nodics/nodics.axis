import { useQueries, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  CircularProgress,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router';

import { WorkspaceHeading } from '../app/help/WorkspaceHelp';
import { ShellIcon } from '../app/shell/ShellIcon';
import { WorkspaceContainer } from '../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisDocumentationSource,
  type AxisModuleConnection,
  type AxisOperationalReadinessBlocker,
  type AxisOperationalReadinessSection,
  type AxisStartupValidationReport,
} from '../bootstrap/publicBootstrap';
import {
  createDocumentationPublicationClient,
  type DocumentationPublicationStatus,
} from '../documentation/api/documentationPublicationClient';
import {
  createApplicationInitializationClient,
  type ApplicationInitializationStatus,
} from '../operations/setupAccelerators/api/applicationInitializationClient';
import {
  loadAvailableFunctionalModules,
  loadRegisteredFunctionalModules,
} from '../operations/moduleRegistry/api/functionalModuleRegistryClient';
import type { FunctionalModuleRegistration } from '../operations/moduleRegistry/api/functionalModuleRegistryContracts';
import {
  loadDataReleases,
  type DataReleaseClientConfiguration,
} from '../operations/importExport/api/dataReleaseClient';
import type { DataRelease } from '../operations/importExport/api/dataReleaseContracts';
import { releaseKey } from '../operations/importExport/importExportPresentation';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';

interface AxisDashboardRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
}

interface ActionCardModel {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly route: string;
  readonly primaryAction: string;
  readonly severity: 'success' | 'info' | 'warning' | 'error';
  readonly count?: number | undefined;
  readonly meta?: string | undefined;
  readonly detailRows: readonly Readonly<{
    readonly label: string;
    readonly value: string;
    readonly severity?: ActionCardModel['severity'] | undefined;
  }>[];
}

interface OperationalFixModel {
  readonly id: string;
  readonly title: string;
  readonly sectionTitle: string;
  readonly ownerModule: string;
  readonly route: string;
  readonly severity: ActionCardModel['severity'];
  readonly message: string;
  readonly action: string;
  readonly source: string;
  readonly blocker: AxisOperationalReadinessBlocker;
}

const overviewPanelMinWidth = 320;
const overviewPanelDefaultWidth = 380;
const overviewPanelMaxWidth = 560;
const readyStartupValidation: AxisStartupValidationReport = Object.freeze({
  state: 'READY',
  checkedAt: new Date(0).toISOString(),
  source: 'backoffice.operationalReadiness',
  summary: Object.freeze({
    total: 0,
    errors: 0,
    warnings: 0,
    info: 0,
    dismissible: 0,
    acknowledged: 0,
  }),
  bootstrapChecks: Object.freeze({
    total: 0,
    ready: 0,
    missing: 0,
    needsAttention: 0,
    checks: Object.freeze([]),
  }),
  findings: Object.freeze([]),
});

function boundedOverviewPanelWidth(width: number): number {
  return Math.min(
    overviewPanelMaxWidth,
    Math.max(overviewPanelMinWidth, Math.round(width)),
  );
}

function isCmsDocumentationSource(
  source: AxisDocumentationSource,
): source is Extract<AxisDocumentationSource, { readonly type: 'CMS' }> {
  return source.type === 'CMS';
}

function isConfiguredCmsDocumentationSource(
  source: AxisDocumentationSource,
): source is Extract<AxisDocumentationSource, { readonly type: 'CMS' }> & {
  readonly initializationProfile: string;
} {
  return (
    isCmsDocumentationSource(source) &&
    typeof source.initializationProfile === 'string' &&
    source.initializationProfile.trim().length > 0
  );
}

function createPlatformImportConnection(
  bootstrap: AxisAuthenticatedBootstrap,
  runtime: AxisRuntimeConfig,
): AxisModuleConnection {
  return Object.freeze({
    moduleName: 'import',
    instanceId: `${runtime.enterpriseCode}:platformServer:import:fallback`,
    endpoint: new URL('/nodics/import', runtime.backofficeBaseUrl).toString(),
    environment: bootstrap.environments[0] ?? runtime.enterpriseCode,
    server: 'platformServer',
    runtimeRole: Object.freeze({
      code: 'PLATFORM',
      publication: 'OPERATIONAL',
    }),
    state: 'UP',
  });
}

function selectReleaseCatalogueConnections(
  bootstrap: AxisAuthenticatedBootstrap,
  runtime: AxisRuntimeConfig,
): readonly AxisModuleConnection[] {
  const importConnections = (bootstrap.moduleConnections.import ?? []).filter(
    (connection) =>
      (connection.state === 'UP' || connection.state === 'DEGRADED') &&
      connection.runtimeRole?.publication !== 'ONLINE',
  );
  const values = [...importConnections];
  if (!values.some((connection) => connection.runtimeRole?.code === 'PLATFORM')) {
    values.push(createPlatformImportConnection(bootstrap, runtime));
  }
  return Object.freeze(
    Array.from(
      new Map(values.map((connection) => [connection.instanceId, connection])).values(),
    ),
  );
}

function releaseBelongsToConnection(
  release: DataRelease,
  connection: AxisModuleConnection,
): boolean {
  const runtimeRoleCode = connection.runtimeRole?.code;
  return !release.destinationRole || !runtimeRoleCode
    ? true
    : release.destinationRole === runtimeRoleCode;
}

function mergeReleases(releases: readonly DataRelease[]): readonly DataRelease[] {
  return Object.freeze(
    Array.from(
      new Map(releases.map((release) => [releaseKey(release), release])).values(),
    ),
  );
}

async function loadDataReleasesByDestination(
  connections: readonly AxisModuleConnection[],
  configuration: DataReleaseClientConfiguration,
): Promise<readonly DataRelease[]> {
  const settled = await Promise.allSettled(
    connections.map(
      async (connection): Promise<readonly DataRelease[]> =>
        Object.freeze(
          (await loadDataReleases(connection, configuration)).filter((release) =>
            releaseBelongsToConnection(release, connection),
          ),
        ),
    ),
  );
  const fulfilled = settled
    .filter(
      (item): item is PromiseFulfilledResult<readonly DataRelease[]> =>
        item.status === 'fulfilled',
    )
    .flatMap((item) => item.value);
  if (fulfilled.length > 0) return mergeReleases(fulfilled);
  const failure = settled.find(
    (item): item is PromiseRejectedResult => item.status === 'rejected',
  );
  throw failure?.reason instanceof Error
    ? failure.reason
    : new Error('Data release catalogue is unavailable');
}

function dataReleaseNeedsAction(release: DataRelease): boolean {
  return ['NOT_INSTALLED', 'UPDATE_AVAILABLE', 'FAILED', 'INVALID_RELEASE'].includes(
    release.status,
  );
}

function moduleNeedsAction(module: FunctionalModuleRegistration): boolean {
  return (
    module.registrationState === 'AVAILABLE' ||
    (!module.required && !module.enabled) ||
    module.runtimeState === 'DEGRADED' ||
    module.runtimeState === 'OFFLINE' ||
    module.runtimeState === 'INCOMPATIBLE'
  );
}

function publicationNeedsApproval(
  status: ApplicationInitializationStatus | DocumentationPublicationStatus,
): boolean {
  if ('capability' in status && status.capability?.businessStatus) {
    return (
      status.capability.businessStatus === 'APPROVAL_REQUIRED' ||
      status.capability.businessStatus === 'APPROVAL_IN_PROGRESS'
    );
  }
  return (
    status.readiness === 'PUBLICATION_PENDING' &&
    status.publication?.state === 'PENDING_APPROVAL'
  );
}

function publicationNeedsAction(
  status: ApplicationInitializationStatus | DocumentationPublicationStatus,
): boolean {
  if ('capability' in status && status.capability?.businessStatus) {
    return [
      'NOT_PREPARED',
      'PREPARING',
      'PREPARED_STAGED',
      'NEEDS_ATTENTION',
    ].includes(status.capability.businessStatus);
  }
  return ['NOT_IMPORTED', 'IMPORTED', 'FAILED', 'REJECTED'].includes(status.readiness);
}

function publicationIsReady(
  status: ApplicationInitializationStatus | DocumentationPublicationStatus,
): boolean {
  if ('capability' in status && status.capability?.businessStatus) {
    return status.capability.businessStatus === 'ONLINE';
  }
  return status.readiness === 'READY';
}

function applicationNeedsSetupAction(status: ApplicationInitializationStatus): boolean {
  if (status.capability?.businessStatus) {
    return !['ONLINE', 'RETIRED'].includes(status.capability.businessStatus);
  }
  return status.readiness !== 'READY' || status.releaseStatus === 'UPDATE_AVAILABLE';
}

function startupValidationNeedsAction(
  startupValidation: AxisStartupValidationReport,
): boolean {
  return (
    startupValidation.state !== 'READY' ||
    startupValidation.summary.total > 0 ||
    startupValidation.bootstrapChecks.missing > 0 ||
    startupValidation.bootstrapChecks.needsAttention > 0
  );
}

function readinessSection(
  bootstrap: AxisAuthenticatedBootstrap,
  key: string,
): AxisOperationalReadinessSection | undefined {
  return bootstrap.operationalReadiness?.sections.find((section) => section.key === key);
}

function readinessSeverity(
  status: string | undefined,
): ActionCardModel['severity'] {
  if (status === 'READY') return 'success';
  if (status === 'NOT_READY' || status === 'BLOCKED') return 'error';
  if (status === 'NEEDS_ATTENTION' || status === 'NOT_EXPOSED') return 'warning';
  return 'info';
}

function blockerSeverity(
  blocker: AxisOperationalReadinessBlocker,
): ActionCardModel['severity'] {
  if (blocker.severity === 'BLOCKED' || blocker.severity === 'ERROR') {
    return 'error';
  }
  if (blocker.severity === 'INFO') return 'info';
  return 'warning';
}

function operationalFixes(
  readiness: AxisAuthenticatedBootstrap['operationalReadiness'],
): readonly OperationalFixModel[] {
  if (!readiness) return [];
  return readiness.sections
    .flatMap((section) =>
      section.blockers.map((blocker, index) => ({
        id: `${section.key}:${blocker.code}:${String(index)}`,
        title: blocker.suggestedAction || blocker.action || section.nextAction,
        sectionTitle: section.title,
        ownerModule: section.ownerModule,
        route: section.route || '/dashboard',
        severity: blockerSeverity(blocker),
        message: blocker.message || blocker.disabledReason,
        action: blocker.suggestedAction || blocker.action || section.nextAction,
        source: blocker.source || section.source,
        blocker,
      })),
    )
    .sort((left, right) => {
      const order = { error: 0, warning: 1, info: 2, success: 3 };
      return order[left.severity] - order[right.severity] ||
        left.sectionTitle.localeCompare(right.sectionTitle);
    });
}

function startupValidationRoute(bootstrap: AxisAuthenticatedBootstrap): string {
  return (
    bootstrap.navigation.find(
      (item) =>
        item.backendWorkspace?.workspaceCode === 'system.runtimeConfiguration' &&
        item.featureState !== 'HIDDEN' &&
        ['UP', 'DEGRADED'].includes(item.availability),
    )?.route ?? '/dashboard'
  );
}

function firstVisibleRoute(
  bootstrap: AxisAuthenticatedBootstrap,
  predicate: (item: AxisAuthenticatedBootstrap['navigation'][number]) => boolean,
  fallback: string,
): string {
  return (
    bootstrap.navigation.find(
      (item) => item.featureState !== 'HIDDEN' && predicate(item),
    )?.route ?? fallback
  );
}

function discoveryRoute(bootstrap: AxisAuthenticatedBootstrap): string {
  return firstVisibleRoute(
    bootstrap,
    (item) =>
      item.moduleName === 'discoveryConfig' ||
      item.moduleName === 'commerceSearchCore' ||
      item.route.startsWith('/discovery'),
    '/discovery',
  );
}

function documentationRoute(bootstrap: AxisAuthenticatedBootstrap): string {
  return firstVisibleRoute(
    bootstrap,
    (item) => item.route === '/docs' || item.route.startsWith('/docs/'),
    '/docs',
  );
}

function progressPercent(ready: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((ready / total) * 100);
}

function statusToneColor(tone: ActionCardModel['severity']) {
  if (tone === 'success') return 'success.main';
  if (tone === 'warning') return 'warning.main';
  if (tone === 'error') return 'error.main';
  return 'info.main';
}

function statusToneBackground(tone: ActionCardModel['severity']) {
  if (tone === 'success') return '#eef7ee';
  if (tone === 'warning') return '#fff8e1';
  if (tone === 'error') return '#fdecef';
  return '#eaf4ff';
}

function statusToneLabel(tone: ActionCardModel['severity']) {
  if (tone === 'success') return 'Ready';
  if (tone === 'warning') return 'Needs action';
  if (tone === 'error') return 'Attention';
  return 'Open';
}

function dashboardError(error: unknown): string {
  return error instanceof Error ? error.message : 'Dashboard signal is unavailable';
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`): string {
  return count === 1 ? singular : pluralLabel;
}

export function AxisDashboardRoutePage({
  accessToken,
  bootstrap,
  runtime,
}: AxisDashboardRoutePageProps) {
  const navigate = useNavigate();
  const [expandedPanels, setExpandedPanels] = useState<ReadonlySet<string>>(
    () =>
      new Set([
        'startup',
        'modules',
        'data',
        'publishing',
        'setup',
        'overview',
        'work-areas',
      ]),
  );
  const [overviewPanelWidth, setOverviewPanelWidth] = useState(
    overviewPanelDefaultWidth,
  );
  const [overviewPanelCollapsed, setOverviewPanelCollapsed] = useState(false);
  const togglePanel = (panel: string) => {
    setExpandedPanels((current) => {
      const next = new Set(current);
      if (next.has(panel)) next.delete(panel);
      else next.add(panel);
      return next;
    });
  };
  const startOverviewPanelResize = (event: ReactPointerEvent<HTMLElement>) => {
    if (overviewPanelCollapsed) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = overviewPanelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const resize = (nextEvent: PointerEvent) => {
      setOverviewPanelWidth(
        boundedOverviewPanelWidth(startWidth + startX - nextEvent.clientX),
      );
    };
    const stopResize = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('pointermove', resize);
      document.removeEventListener('pointerup', stopResize);
    };
    document.addEventListener('pointermove', resize);
    document.addEventListener('pointerup', stopResize, { once: true });
  };
  const backofficeConnection = selectModuleConnection(bootstrap, 'backoffice');
  const releaseConnections = useMemo(
    () => selectReleaseCatalogueConnections(bootstrap, runtime),
    [bootstrap, runtime],
  );
  const dataConfiguration = useMemo(
    () => ({
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs],
  );
  const registryConfiguration = useMemo(
    () => ({
      ...dataConfiguration,
      projectCode: runtime.projectCode,
    }),
    [dataConfiguration, runtime.projectCode],
  );

  const registeredModulesQuery = useQuery({
    enabled: Boolean(backofficeConnection),
    queryKey: ['axis-dashboard', 'registered-modules', runtime.enterpriseCode],
    queryFn: () => {
      if (!backofficeConnection) throw new Error('Module Registry is unavailable');
      return loadRegisteredFunctionalModules(
        backofficeConnection,
        registryConfiguration,
      );
    },
  });
  const availableModulesQuery = useQuery({
    enabled: Boolean(backofficeConnection),
    queryKey: ['axis-dashboard', 'available-modules', runtime.enterpriseCode],
    queryFn: () => {
      if (!backofficeConnection) throw new Error('Module Registry is unavailable');
      return loadAvailableFunctionalModules(
        backofficeConnection,
        registryConfiguration,
      );
    },
  });
  const releasesQuery = useQuery({
    enabled: releaseConnections.length > 0,
    queryKey: ['axis-dashboard', 'data-releases', runtime.enterpriseCode],
    queryFn: () => loadDataReleasesByDestination(releaseConnections, dataConfiguration),
  });
  const applicationProfiles = bootstrap.applicationInitializationProfiles ?? [];
  const applicationStatusQueries = useQueries({
    queries: applicationProfiles.map((profile) => ({
      enabled: Boolean(backofficeConnection),
      queryKey: ['axis-dashboard', 'application-status', profile.code],
      queryFn: () => {
        if (!backofficeConnection) {
          throw new Error('Application initialization is unavailable');
        }
        return createApplicationInitializationClient({
          connection: backofficeConnection,
          enterpriseCode: runtime.enterpriseCode,
          accessToken,
          timeoutMs: runtime.requestTimeoutMs,
          profileCode: profile.code,
        }).getStatus();
      },
    })),
  });
  const documentationSources = bootstrap.documentationSources.filter(
    isConfiguredCmsDocumentationSource,
  );
  const documentationStatusQueries = useQueries({
    queries: documentationSources.map((source) => ({
      enabled: Boolean(backofficeConnection),
      queryKey: [
        'axis-dashboard',
        'documentation-status',
        source.initializationProfile,
      ],
      queryFn: () => {
        if (!backofficeConnection) {
          throw new Error('Documentation publication is unavailable');
        }
        return createDocumentationPublicationClient({
          connection: backofficeConnection,
          enterpriseCode: runtime.enterpriseCode,
          accessToken,
          timeoutMs: runtime.requestTimeoutMs,
          profileCode: source.initializationProfile,
        }).getStatus();
      },
    })),
  });

  const registeredModules = registeredModulesQuery.data ?? [];
  const availableModules = availableModulesQuery.data ?? [];
  const releases = releasesQuery.data ?? [];
  const applicationStatuses = applicationStatusQueries
    .map((query) => query.data)
    .filter((status): status is ApplicationInitializationStatus => Boolean(status));
  const documentationStatuses = documentationStatusQueries
    .map((query) => query.data)
    .filter((status): status is DocumentationPublicationStatus => Boolean(status));
  const allPublicationStatuses = [...applicationStatuses, ...documentationStatuses];
  const availableModuleActionCount = availableModules.filter(moduleNeedsAction).length;
  const registeredModuleActionCount =
    registeredModules.filter(moduleNeedsAction).length;
  const moduleActionCount = availableModuleActionCount + registeredModuleActionCount;
  const startupValidationReported = Boolean(bootstrap.startupValidation);
  const startupValidation = bootstrap.startupValidation ?? readyStartupValidation;
  const operationalReadiness = bootstrap.operationalReadiness;
  const importReadiness = readinessSection(bootstrap, 'imports');
  const publishingReadiness = readinessSection(bootstrap, 'publishing');
  const approvalReadiness = readinessSection(bootstrap, 'approval');
  const mediaReadiness = readinessSection(bootstrap, 'media');
  const searchReadiness = readinessSection(bootstrap, 'search');
  const assistantReadiness = readinessSection(bootstrap, 'assistant');
  const readinessFixes = operationalFixes(operationalReadiness);
  const operationalBlockerCount = operationalReadiness?.summary.blockers;
  const operationalBlockerValue =
    typeof operationalBlockerCount === 'number' ? operationalBlockerCount : undefined;
  const initReleaseCount = releases.filter((release) => release.dataType === 'init');
  const coreReleaseCount = releases.filter((release) => release.dataType === 'core');
  const sampleReleaseCount = releases.filter(
    (release) => release.dataType === 'sample',
  );
  const dataActionCount = releases.filter(dataReleaseNeedsAction).length;
  const startupActionCount = startupValidationNeedsAction(startupValidation)
    ? startupValidation.summary.total
    : 0;
  const startupErrorCount = startupValidation.summary.errors;
  const startupWarningCount = startupValidation.summary.warnings;
  const startupBootstrapMissingCount = startupValidation.bootstrapChecks.missing;
  const startupBootstrapAttentionCount =
    startupValidation.bootstrapChecks.needsAttention;
  const approvalCount = allPublicationStatuses.filter(publicationNeedsApproval).length;
  const publicationActionCount =
    allPublicationStatuses.filter(publicationNeedsAction).length;
  const visiblePublicationActionCount = approvalCount + publicationActionCount;
  const readyApplicationCount = applicationStatuses.filter(publicationIsReady).length;
  const applicationActionCount =
    applicationStatuses.filter(applicationNeedsSetupAction).length;
  const activeModuleCount = registeredModules.filter(
    (module) => module.enabled && module.runtimeState === 'ACTIVE',
  ).length;
  const currentReleaseCount = releases.filter(
    (release) => release.status === 'CURRENT',
  ).length;
  const readyPublicationCount = allPublicationStatuses.filter(publicationIsReady).length;
  const readyDocumentationCount =
    documentationStatuses.filter(publicationIsReady).length;
  const documentationActionCount =
    documentationStatuses.filter(publicationNeedsAction).length +
    documentationStatuses.filter(publicationNeedsApproval).length;
  const readyApplicationParityCount =
    applicationStatuses.filter(publicationIsReady).length;
  const applicationParityActionCount =
    applicationStatuses.filter(applicationNeedsSetupAction).length +
    applicationStatuses.filter(publicationNeedsApproval).length;
  const allConnections = Object.values(bootstrap.moduleConnections).flat();
  const liveConnections = Object.values(bootstrap.moduleConnections)
    .flat()
    .filter(
      (connection) => connection.state === 'UP' || connection.state === 'DEGRADED',
    );
  const degradedConnections = allConnections.filter(
    (connection) => connection.state === 'DEGRADED',
  );
  const unavailableConnections = allConnections.filter(
    (connection) =>
      connection.state === 'UNAVAILABLE' || connection.state === 'UNKNOWN',
  );
  const runtimeCommunicationActionCount =
    degradedConnections.length + unavailableConnections.length + (backofficeConnection ? 0 : 1);
  const runtimeServerCount = new Set(
    liveConnections.map((connection) => connection.server).filter(Boolean),
  ).size;
  const runtimeRoleCount = new Set(
    liveConnections
      .map((connection) => connection.runtimeRole?.code)
      .filter(Boolean),
  ).size;
  const workbenchCount = bootstrap.navigation.filter(
    (item) => item.workbenchTarget && item.featureState !== 'HIDDEN',
  ).length;
  const visibleRouteCount = bootstrap.navigation.filter(
    (item) => item.featureState !== 'HIDDEN',
  ).length;
  const configurationWorkspaceAvailable = bootstrap.navigation.some(
    (item) =>
      item.featureState !== 'HIDDEN' &&
      item.backendWorkspace?.workspaceCode === 'system.runtimeConfiguration',
  );
  const discoveryWorkspaceCount = bootstrap.navigation.filter(
    (item) =>
      item.featureState !== 'HIDDEN' &&
      (item.moduleName === 'discoveryConfig' ||
        item.moduleName === 'commerceSearchCore' ||
        item.route.startsWith('/discovery')),
  ).length;
  const searchableWorkbenchCount = bootstrap.navigation.filter(
    (item) =>
      item.featureState !== 'HIDDEN' &&
      Boolean(item.workbenchTarget?.searchRoute),
  ).length;
  const sourceControlActionCount =
    (configurationWorkspaceAvailable ? 0 : 1) + (discoveryWorkspaceCount > 0 ? 0 : 1);
  const primaryStartupBootstrapCheck = startupValidation.bootstrapChecks.checks.find(
    (check) => check.state === 'MISSING' || check.state === 'NEEDS_ATTENTION',
  );
  const primaryStartupFinding = startupValidation.findings[0];
  const startupPrimaryMeta = primaryStartupBootstrapCheck
    ? `${primaryStartupBootstrapCheck.owner}: ${primaryStartupBootstrapCheck.message}`
    : primaryStartupFinding
      ? `${primaryStartupFinding.owner}: ${primaryStartupFinding.message}`
      : undefined;
  const startupRepairLabel = primaryStartupFinding?.repair
    ? primaryStartupFinding.repair.available
      ? `${primaryStartupFinding.repair.label} · ${primaryStartupFinding.repair.operation}`
      : primaryStartupFinding.repair.unavailableReason ??
        `${primaryStartupFinding.repair.label} unavailable`
    : undefined;
  const totalActionCount =
    startupActionCount +
    moduleActionCount +
    dataActionCount +
    approvalCount +
    runtimeCommunicationActionCount +
    sourceControlActionCount +
    documentationActionCount +
    (operationalReadiness && operationalReadiness.state !== 'READY'
      ? (operationalBlockerValue ?? 1)
      : 0);
  const loading =
    registeredModulesQuery.isLoading ||
    availableModulesQuery.isLoading ||
    releasesQuery.isLoading ||
    applicationStatusQueries.some((query) => query.isLoading) ||
    documentationStatusQueries.some((query) => query.isLoading);
  const firstError =
    registeredModulesQuery.error ??
    availableModulesQuery.error ??
    releasesQuery.error ??
    applicationStatusQueries.find((query) => query.error)?.error ??
    documentationStatusQueries.find((query) => query.error)?.error;
  const actionCards: readonly ActionCardModel[] = [
    startupActionCount > 0
      ? {
          id: 'startup',
          title: 'Review startup configuration',
          description:
            'Server bootstrap detected configuration values or policies that need operator review before this environment is treated as ready.',
          icon: 'settings',
          route: startupValidationRoute(bootstrap),
          primaryAction: 'Open Runtime Configuration',
          severity: startupErrorCount > 0 ? 'error' : 'warning',
          count: startupActionCount,
          meta: startupPrimaryMeta,
          detailRows: [
            {
              label: 'Bootstrap prerequisites',
              value:
                startupBootstrapMissingCount > 0
                  ? `${String(startupBootstrapMissingCount)} missing`
                  : startupBootstrapAttentionCount > 0
                    ? `${String(startupBootstrapAttentionCount)} needs attention`
                    : `${String(startupValidation.bootstrapChecks.ready)} ready`,
              severity:
                startupBootstrapMissingCount > 0
                  ? 'error'
                  : startupBootstrapAttentionCount > 0
                    ? 'warning'
                    : 'success',
            },
            {
              label: 'Blocking errors',
              value: String(startupErrorCount),
              severity: startupErrorCount > 0 ? 'error' : 'success',
            },
            {
              label: 'Warnings',
              value: String(startupWarningCount),
              severity: startupWarningCount > 0 ? 'warning' : 'success',
            },
            {
              label: 'Dismissible with audit',
              value: String(startupValidation.summary.dismissible),
              severity:
                startupValidation.summary.dismissible > 0
                  ? 'warning'
                  : 'info',
            },
            {
              label: 'Acknowledged by backend',
              value: String(startupValidation.summary.acknowledged),
              severity:
                startupValidation.summary.acknowledged > 0
                  ? 'info'
                  : 'success',
            },
            ...(startupRepairLabel
              ? [
                  {
                    label: 'Repair guidance',
                    value: startupRepairLabel,
                    severity: primaryStartupFinding?.repair?.available
                      ? 'info'
                      : 'warning',
                  } as const,
                ]
              : []),
          ],
        }
      : {
          id: 'startup',
          title: 'Startup checks are clear',
          description:
            'BackOffice did not report startup configuration blockers for this operator workspace.',
          icon: 'settings',
          route: startupValidationRoute(bootstrap),
          primaryAction: 'Review Configuration',
          severity: 'success',
          meta: startupValidationReported
            ? `Checked ${new Date(startupValidation.checkedAt).toLocaleString()}`
            : undefined,
          detailRows: [
            {
              label: 'Bootstrap prerequisites',
              value:
                startupValidation.bootstrapChecks.total > 0
                  ? `${String(startupValidation.bootstrapChecks.ready)} ready`
                  : 'Not reported',
              severity:
                startupValidation.bootstrapChecks.total > 0 ? 'success' : 'info',
            },
            {
              label: 'Blocking errors',
              value: '0',
              severity: 'success',
            },
            {
              label: 'Warnings',
              value: '0',
              severity: 'success',
            },
            {
              label: 'Source',
              value: startupValidation.source,
              severity: 'info',
            },
          ],
        },
    ...(operationalReadiness
      ? [
          {
            id: 'operational-readiness',
            title:
              operationalReadiness.state === 'READY'
                ? 'Backend readiness aggregate is clear'
                : 'Backend readiness aggregate needs review',
            description:
              'BackOffice now publishes one canonical readiness aggregate for bootstrap, runtime communication, imports, publishing, approvals, docs, media, search, assistant, and customer applications.',
            icon: 'activity',
            route: '/dashboard',
            primaryAction: 'Review Readiness',
            severity: readinessSeverity(operationalReadiness.state),
            count:
              operationalReadiness.state === 'READY'
                ? undefined
                : (operationalBlockerValue ?? operationalReadiness.sections.length),
            meta: `${String(operationalReadiness.sections.length)} backend-owned sections`,
            detailRows: [
              {
                label: 'State',
                value: operationalReadiness.state,
                severity: readinessSeverity(operationalReadiness.state),
              },
              {
                label: 'Import releases',
                value: importReadiness?.businessStatus ?? 'Not reported',
                severity: readinessSeverity(importReadiness?.businessStatus),
              },
              {
                label: 'Publishing',
                value: publishingReadiness?.businessStatus ?? 'Not reported',
                severity: readinessSeverity(publishingReadiness?.businessStatus),
              },
              {
                label: 'Approval process',
                value: approvalReadiness?.businessStatus ?? 'Not reported',
                severity: readinessSeverity(approvalReadiness?.businessStatus),
              },
              {
                label: 'Media references',
                value: mediaReadiness?.businessStatus ?? 'Not reported',
                severity: readinessSeverity(mediaReadiness?.businessStatus),
              },
              {
                label: 'Search and discovery',
                value: searchReadiness?.businessStatus ?? 'Not reported',
                severity: readinessSeverity(searchReadiness?.businessStatus),
              },
              {
                label: 'Assistant knowledge',
                value: assistantReadiness?.businessStatus ?? 'Not reported',
                severity: readinessSeverity(assistantReadiness?.businessStatus),
              },
            ],
          } satisfies ActionCardModel,
        ]
      : []),
    moduleActionCount > 0
      ? {
          id: 'modules',
          title: 'Register and activate modules',
          description:
            'Review available capabilities, activate required modules, and bring hidden journeys into the BackOffice.',
          icon: 'registry',
          route: '/registry',
          primaryAction: 'Open Module Registry',
          severity: 'warning',
          count: moduleActionCount,
          meta: `${String(activeModuleCount)} active modules`,
          detailRows: [
            {
              label: 'Available to register',
              value: String(availableModuleActionCount),
              severity: availableModuleActionCount > 0 ? 'warning' : 'success',
            },
            {
              label: 'Registered needing action',
              value: String(registeredModuleActionCount),
              severity: registeredModuleActionCount > 0 ? 'warning' : 'success',
            },
            {
              label: 'Runtime active',
              value: String(activeModuleCount),
              severity: activeModuleCount > 0 ? 'success' : 'info',
            },
          ],
        }
      : {
          id: 'modules',
          title: 'Module foundation is active',
          description:
            'Registered modules are online for the current operator workspace.',
          icon: 'registry',
          route: '/registry',
          primaryAction: 'Review Registry',
          severity: 'success',
          meta: `${String(activeModuleCount)} active modules`,
          detailRows: [
            {
              label: 'Runtime active',
              value: String(activeModuleCount),
              severity: 'success',
            },
            {
              label: 'Registered modules',
              value: String(registeredModules.length),
              severity: 'success',
            },
            {
              label: 'Available actions',
              value: '0',
              severity: 'success',
            },
          ],
        },
    dataActionCount > 0
      ? {
          id: 'data',
          title: 'Install release data',
          description:
            'Import init, core, and sample releases that are not installed or need an update before business journeys can run.',
          icon: 'import',
          route: '/operations/imports-exports',
          primaryAction: 'Open Data Releases',
          severity: 'warning',
          count: dataActionCount,
          meta: `${String(currentReleaseCount)} releases current`,
          detailRows: [
            {
              label: 'Init releases',
              value: String(initReleaseCount.length),
              severity: initReleaseCount.some(dataReleaseNeedsAction)
                ? 'warning'
                : 'success',
            },
            {
              label: 'Core releases',
              value: String(coreReleaseCount.length),
              severity: coreReleaseCount.some(dataReleaseNeedsAction)
                ? 'warning'
                : 'success',
            },
            {
              label: 'Sample releases',
              value: String(sampleReleaseCount.length),
              severity: sampleReleaseCount.some(dataReleaseNeedsAction)
                ? 'warning'
                : 'info',
            },
          ],
        }
      : {
          id: 'data',
          title: 'Release data is current',
          description:
            'Available module data releases are installed for this environment.',
          icon: 'import',
          route: '/operations/imports-exports',
          primaryAction: 'Review Data',
          severity: 'success',
          meta: `${String(currentReleaseCount)} releases current`,
          detailRows: [
            {
              label: 'Init releases',
              value: String(initReleaseCount.length),
              severity: 'success',
            },
            {
              label: 'Core releases',
              value: String(coreReleaseCount.length),
              severity: 'success',
            },
            {
              label: 'Sample releases',
              value: String(sampleReleaseCount.length),
              severity: 'info',
            },
          ],
        },
    approvalCount > 0
      ? {
          id: 'publishing',
          title: 'Approval queue needs review',
          description:
            'Governed publication requests are waiting for an authorized decision before Online visibility changes.',
          icon: 'approve',
          route: '/publishing',
          primaryAction: 'Review Approvals',
          severity: 'error',
          count: approvalCount,
          meta: `${String(visiblePublicationActionCount)} ${plural(
            visiblePublicationActionCount,
            'publication item needs',
            'publication items need',
          )} action`,
          detailRows: [
            {
              label: 'Waiting approval',
              value: String(approvalCount),
              severity: 'error',
            },
            {
              label: 'Needs publication action',
              value: String(publicationActionCount),
              severity: publicationActionCount > 0 ? 'warning' : 'success',
            },
            {
              label: 'Online ready',
              value: String(readyPublicationCount),
              severity: readyPublicationCount > 0 ? 'success' : 'info',
            },
          ],
        }
      : {
          id: 'publishing',
          title: 'Publishing flow is clear',
          description:
            'No visible dashboard publication request is waiting for approval.',
          icon: 'approve',
          route: '/publishing',
          primaryAction: 'Open Publishing',
          severity: 'success',
          meta: `${String(readyPublicationCount)} Online-ready sources`,
          detailRows: [
            {
              label: 'Waiting approval',
              value: '0',
              severity: 'success',
            },
            {
              label: 'Online ready',
              value: String(readyPublicationCount),
              severity: 'success',
            },
            {
              label: 'Tracked sources',
              value: String(allPublicationStatuses.length),
              severity: 'info',
            },
          ],
        },
    {
      id: 'setup',
      title: 'Prepare project accelerators',
      description:
        'Initialize documentation packs and project accelerators, then publish approved Staged packages to Online.',
      icon: 'storefront',
      route: '/setup-accelerators',
      primaryAction: 'Open Setup',
      severity:
        applicationActionCount > 0 || visiblePublicationActionCount > 0
          ? 'warning'
          : 'info',
      count: applicationProfiles.length > 0 ? applicationActionCount : undefined,
      meta: `${String(applicationProfiles.length)} setup profiles`,
      detailRows: [
        {
          label: 'Project profiles',
          value: String(applicationProfiles.length),
          severity: applicationProfiles.length > 0 ? 'info' : 'warning',
        },
        {
          label: 'Applications ready',
          value: String(readyApplicationCount),
          severity: readyApplicationCount > 0 ? 'success' : 'info',
        },
        {
          label: 'Needs setup action',
          value: String(applicationActionCount),
          severity: applicationActionCount > 0 ? 'warning' : 'success',
        },
        {
          label: 'Documentation sources',
          value: String(documentationSources.length),
          severity: documentationSources.length > 0 ? 'info' : 'warning',
        },
      ],
    },
    {
      id: 'runtime-communication',
      title:
        runtimeCommunicationActionCount > 0
          ? 'Runtime communication needs attention'
          : 'Runtime communication is healthy',
      description:
        'Runtime-to-runtime health is based on backend module leases, observed servers, and runtime roles, not static project server lists.',
      icon: 'health',
      route: '/registry',
      primaryAction: 'Review Runtime Registry',
      severity: runtimeCommunicationActionCount > 0 ? 'warning' : 'success',
      count:
        runtimeCommunicationActionCount > 0
          ? runtimeCommunicationActionCount
          : undefined,
      meta: `${String(liveConnections.length)} live runtime module connection${liveConnections.length === 1 ? '' : 's'}`,
      detailRows: [
        {
          label: 'Live connections',
          value: String(liveConnections.length),
          severity: liveConnections.length > 0 ? 'success' : 'warning',
        },
        {
          label: 'Observed servers',
          value: String(runtimeServerCount),
          severity: runtimeServerCount > 0 ? 'success' : 'warning',
        },
        {
          label: 'Runtime roles',
          value: String(runtimeRoleCount),
          severity: runtimeRoleCount > 0 ? 'success' : 'info',
        },
        {
          label: 'Unavailable/degraded',
          value: String(degradedConnections.length + unavailableConnections.length),
          severity:
            degradedConnections.length + unavailableConnections.length > 0
              ? 'warning'
              : 'success',
        },
      ],
    },
    {
      id: 'source-control',
      title:
        sourceControlActionCount > 0
          ? 'Search and configuration controls need setup'
          : 'Search and configuration controls are visible',
      description:
        'Runtime configuration and search/read-source policy controls are owned by backend modules and exposed through authorized Axis workspaces.',
      icon: 'search',
      route:
        sourceControlActionCount > 0
          ? startupValidationRoute(bootstrap)
          : discoveryRoute(bootstrap),
      primaryAction:
        sourceControlActionCount > 0
          ? 'Open Runtime Configuration'
          : 'Open Discovery Controls',
      severity: sourceControlActionCount > 0 ? 'warning' : 'success',
      count: sourceControlActionCount > 0 ? sourceControlActionCount : undefined,
      meta: `${String(discoveryWorkspaceCount)} discovery workspace${discoveryWorkspaceCount === 1 ? '' : 's'}`,
      detailRows: [
        {
          label: 'Runtime config workspace',
          value: configurationWorkspaceAvailable ? 'Available' : 'Missing',
          severity: configurationWorkspaceAvailable ? 'success' : 'warning',
        },
        {
          label: 'Discovery controls',
          value: String(discoveryWorkspaceCount),
          severity: discoveryWorkspaceCount > 0 ? 'success' : 'warning',
        },
        {
          label: 'Searchable workbenches',
          value: String(searchableWorkbenchCount),
          severity: searchableWorkbenchCount > 0 ? 'info' : 'warning',
        },
      ],
    },
    {
      id: 'docs-parity',
      title:
        documentationActionCount + applicationParityActionCount > 0
          ? 'Docs and app publishing parity needs review'
          : 'Docs and app publishing parity is clear',
      description:
        'Documentation packs and customer-facing application profiles are tracked together so post-reset publish gaps are visible before manual browser validation.',
      icon: 'content',
      route: documentationActionCount > 0 ? documentationRoute(bootstrap) : '/publishing',
      primaryAction:
        documentationActionCount > 0 ? 'Open Documentation' : 'Open Publishing',
      severity:
        documentationActionCount + applicationParityActionCount > 0
          ? 'warning'
          : 'success',
      count:
        documentationActionCount + applicationParityActionCount > 0
          ? documentationActionCount + applicationParityActionCount
          : undefined,
      meta: `${String(readyDocumentationCount)} docs, ${String(readyApplicationParityCount)} apps ready`,
      detailRows: [
        {
          label: 'Documentation sources',
          value: String(documentationSources.length),
          severity: documentationSources.length > 0 ? 'success' : 'warning',
        },
        {
          label: 'Docs needing action',
          value: String(documentationActionCount),
          severity: documentationActionCount > 0 ? 'warning' : 'success',
        },
        {
          label: 'App profiles needing action',
          value: String(applicationParityActionCount),
          severity: applicationParityActionCount > 0 ? 'warning' : 'success',
        },
        {
          label: 'Post-reset bootstrap',
          value:
            startupValidation.bootstrapChecks.missing > 0
              ? `${String(startupValidation.bootstrapChecks.missing)} missing`
              : `${String(startupValidation.bootstrapChecks.ready)} ready`,
          severity:
            startupValidation.bootstrapChecks.missing > 0 ? 'warning' : 'success',
        },
        {
          label: 'CLI evidence',
          value: 'project:post-reset-readiness --live --json',
          severity: startupValidation.state === 'READY' ? 'success' : 'info',
        },
      ],
    },
  ];

  return (
    <WorkspaceContainer>
      <WorkspaceHeading
        eyebrow="Control center"
        title="Dashboard"
        description="Start with the next operational step, then inspect the live application surface, data readiness, and publication flow from one place."
        actions={
          loading ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <CircularProgress size={18} />
              <Typography color="text.secondary" variant="body2">
                Refreshing signals
              </Typography>
            </Stack>
          ) : null
        }
      />
      {firstError ? (
        <Alert severity="warning">
          Some dashboard signals are unavailable: {dashboardError(firstError)}
        </Alert>
      ) : null}
      <Paper
        elevation={0}
        sx={{
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.text.primary} 0%, ${alpha(
              theme.palette.text.primary,
              0.9,
            )} 56%, ${alpha(theme.palette.primary.main, 0.92)} 160%)`,
          border: '1px solid',
          borderColor: (theme) => alpha(theme.palette.common.white, 0.08),
          borderRadius: 1,
          color: 'common.white',
          overflow: 'hidden',
          p: { xs: 2.5, md: 3 },
          position: 'relative',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
        >
          <Stack spacing={1} sx={{ maxWidth: 760, minWidth: 0 }}>
            <Chip
              label={runtime.projectCode}
              size="small"
              sx={{
                alignSelf: 'flex-start',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.18),
                border: '1px solid',
                borderColor: (theme) => alpha(theme.palette.primary.main, 0.6),
                color: 'common.white',
                fontWeight: 800,
              }}
              variant="outlined"
            />
            <Typography component="h2" sx={{ fontWeight: 800 }} variant="h4">
              Operator readiness at a glance
            </Typography>
            <Typography
              sx={{ color: (theme) => alpha(theme.palette.common.white, 0.78) }}
            >
              Registry, release data, publication, and accelerator signals are grouped
              into one action-first workspace.
            </Typography>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: 'repeat(3, minmax(88px, 1fr))',
              minWidth: { md: 360 },
              width: { xs: '100%', md: 'auto' },
            }}
          >
            {[
              {
                label: 'Actions',
                value: totalActionCount,
              },
              { label: 'Routes', value: visibleRouteCount },
              { label: 'Live', value: liveConnections.length },
            ].map((item) => (
              <Box
                key={item.label}
                sx={{
                  bgcolor: (theme) => alpha(theme.palette.common.white, 0.08),
                  border: '1px solid',
                  borderColor: (theme) => alpha(theme.palette.common.white, 0.14),
                  borderRadius: 1,
                  minHeight: 78,
                  p: 1.5,
                }}
              >
                <Typography sx={{ fontWeight: 900 }} variant="h4">
                  {String(item.value)}
                </Typography>
                <Typography
                  sx={{
                    color: (theme) => alpha(theme.palette.common.white, 0.7),
                    fontWeight: 700,
                  }}
                  variant="caption"
                >
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Stack>
      </Paper>
      <Box
        sx={{
          alignItems: 'stretch',
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: {
            xs: '1fr',
            lg: overviewPanelCollapsed
              ? 'minmax(0, 1fr) 64px'
              : `minmax(0, 1fr) ${String(overviewPanelWidth)}px`,
          },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            boxShadow: (theme) =>
              `0 18px 48px ${alpha(theme.palette.text.primary, 0.08)}`,
            overflow: 'hidden',
          }}
        >
          {readinessFixes.length > 0 ? (
            <Box
              component="section"
              sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: (theme) => alpha(theme.palette.warning.main, 0.055),
              }}
            >
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                sx={{
                  alignItems: { md: 'center' },
                  justifyContent: 'space-between',
                  px: 3,
                  py: 2,
                }}
              >
                <Stack spacing={0.5}>
                  <Typography component="h2" variant="h5">
                    Fix these first
                  </Typography>
                  <Typography color="text.secondary">
                    Backend-owned readiness blockers are grouped by business outcome,
                    owner, and repair route.
                  </Typography>
                </Stack>
                <Chip
                  color={readinessFixes.some((fix) => fix.severity === 'error') ? 'error' : 'warning'}
                  label={`${String(readinessFixes.length)} blocker${readinessFixes.length === 1 ? '' : 's'}`}
                  sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, fontWeight: 800 }}
                />
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' },
                  px: 1.5,
                  pb: 1.5,
                }}
              >
                {readinessFixes.slice(0, 8).map((fix) => (
                  <Box
                    key={fix.id}
                    sx={{
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: (theme) =>
                        alpha(theme.palette[fix.severity === 'error' ? 'error' : 'warning'].main, 0.28),
                      borderRadius: 1,
                      p: 1.5,
                    }}
                  >
                    <Stack spacing={1}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                      >
                        <Chip
                          color={fix.severity === 'error' ? 'error' : 'warning'}
                          label={fix.sectionTitle}
                          size="small"
                          sx={{ fontWeight: 800 }}
                        />
                        <Chip
                          label={fix.ownerModule}
                          size="small"
                          variant="outlined"
                        />
                        <Chip label={fix.source} size="small" variant="outlined" />
                      </Stack>
                      <Typography component="h3" variant="subtitle1">
                        {fix.title}
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        {fix.message}
                      </Typography>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
                      >
                        <Typography color="text.secondary" variant="caption">
                          {fix.blocker.code}
                        </Typography>
                        <Button
                          endIcon={<ShellIcon name="chevron-right" />}
                          onClick={() => void navigate(fix.route)}
                          size="small"
                          variant="outlined"
                        >
                          Open repair workspace
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : null}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{
              alignItems: { md: 'center' },
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              justifyContent: 'space-between',
              px: 3,
              py: 2,
            }}
          >
            <Stack spacing={0.5}>
              <Typography component="h2" variant="h5">
                Next steps
              </Typography>
              <Typography color="text.secondary">
                Guided work cards based on live registry, data, and publication state.
              </Typography>
            </Stack>
            <Chip
              color={
                totalActionCount > 0
                  ? 'warning'
                  : 'success'
              }
              label={
                totalActionCount > 0
                  ? `${String(totalActionCount)} actions`
                  : 'Ready'
              }
              sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, fontWeight: 800 }}
            />
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' },
              p: 1.5,
            }}
          >
            {actionCards.map((card) => {
              const expanded = expandedPanels.has(card.id);
              const detailId = `axis-dashboard-${card.id}-details`;
              return (
                <Box
                  key={card.title}
                  sx={{
                    background: (theme) =>
                      `linear-gradient(180deg, ${alpha(
                        theme.palette.background.paper,
                        0.98,
                      )}, ${alpha(theme.palette.background.default, 0.56)})`,
                    border: '1px solid',
                    borderColor: (theme) =>
                      expanded
                        ? alpha(theme.palette.primary.main, 0.4)
                        : theme.palette.divider,
                    borderRadius: 1,
                    boxShadow: (theme) =>
                      expanded
                        ? `0 14px 32px ${alpha(theme.palette.text.primary, 0.08)}`
                        : 'none',
                    minHeight: 220,
                    p: 2.5,
                    position: 'relative',
                    transition: (theme) =>
                      theme.transitions.create(['border-color', 'box-shadow'], {
                        duration: theme.transitions.duration.short,
                      }),
                  }}
                >
                  <Stack spacing={2}>
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{ alignItems: 'flex-start', minWidth: 0, pr: 6 }}
                    >
                      <Box
                        sx={{
                          alignItems: 'center',
                          bgcolor: statusToneBackground(card.severity),
                          border: '1px solid',
                          borderColor: statusToneColor(card.severity),
                          borderRadius: 1,
                          color: statusToneColor(card.severity),
                          display: 'flex',
                          height: 44,
                          flex: '0 0 auto',
                          justifyContent: 'center',
                          width: 44,
                        }}
                      >
                        <ShellIcon name={card.icon} />
                      </Box>
                      <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                        >
                          <Typography component="h3" variant="h6">
                            {card.title}
                          </Typography>
                          <Chip
                            color={card.severity}
                            label={statusToneLabel(card.severity)}
                            size="small"
                            sx={{ fontWeight: 800 }}
                            variant={
                              card.severity === 'success' ? 'outlined' : 'filled'
                            }
                          />
                          {card.count !== undefined && card.count > 0 ? (
                            <Chip
                              color={card.severity}
                              label={String(card.count)}
                              size="small"
                              sx={{ fontWeight: 800, minWidth: 34 }}
                            />
                          ) : null}
                        </Stack>
                        <Typography color="text.secondary">
                          {card.description}
                        </Typography>
                      </Stack>
                      <Tooltip
                        title={`${expanded ? 'Hide' : 'Show'} ${card.title} details`}
                      >
                        <IconButton
                          aria-controls={detailId}
                          aria-expanded={expanded}
                          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${card.title}`}
                          onClick={() => togglePanel(card.id)}
                          size="small"
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            flex: '0 0 auto',
                            position: 'absolute',
                            right: 2.5,
                            top: 2.5,
                          }}
                        >
                          <ShellIcon
                            fontSize="small"
                            name={expanded ? 'chevron-up' : 'chevron-down'}
                          />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    {card.meta ? (
                      <Typography color="text.secondary" variant="body2">
                        {card.meta}
                      </Typography>
                    ) : null}
                    <Collapse id={detailId} in={expanded} timeout="auto" unmountOnExit>
                      <Box
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          overflow: 'hidden',
                        }}
                      >
                        {card.detailRows.map((row, rowIndex) => (
                          <Stack
                            key={row.label}
                            direction="row"
                            spacing={1.5}
                            sx={{
                              alignItems: 'center',
                              bgcolor:
                                rowIndex % 2 === 0
                                  ? 'background.paper'
                                  : 'action.hover',
                              borderTop: rowIndex === 0 ? 0 : '1px solid',
                              borderColor: 'divider',
                              justifyContent: 'space-between',
                              px: 1.5,
                              py: 1,
                            }}
                          >
                            <Typography color="text.secondary" variant="body2">
                              {row.label}
                            </Typography>
                            <Chip
                              color={row.severity ?? 'default'}
                              label={row.value}
                              size="small"
                              sx={{ fontWeight: 800, minWidth: 42 }}
                              variant={
                                row.severity === 'success' ? 'outlined' : 'filled'
                              }
                            />
                          </Stack>
                        ))}
                      </Box>
                    </Collapse>
                    <Button
                      color={card.severity === 'error' ? 'error' : 'primary'}
                      endIcon={<ShellIcon name="chevron-right" />}
                      onClick={() => void navigate(card.route)}
                      sx={{ alignSelf: 'flex-start' }}
                      variant={card.severity === 'success' ? 'outlined' : 'contained'}
                    >
                      {card.primaryAction}
                    </Button>
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </Paper>
        <Box sx={{ minWidth: 0, position: 'relative' }}>
          {!overviewPanelCollapsed ? (
            <Box
              aria-label="Resize application overview panel"
              aria-orientation="vertical"
              aria-valuemax={overviewPanelMaxWidth}
              aria-valuemin={overviewPanelMinWidth}
              aria-valuenow={overviewPanelWidth}
              onDoubleClick={() => setOverviewPanelWidth(overviewPanelDefaultWidth)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  setOverviewPanelWidth((current) =>
                    boundedOverviewPanelWidth(current + 24),
                  );
                } else if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  setOverviewPanelWidth((current) =>
                    boundedOverviewPanelWidth(current - 24),
                  );
                } else if (event.key === 'Home') {
                  event.preventDefault();
                  setOverviewPanelWidth(overviewPanelMinWidth);
                } else if (event.key === 'End') {
                  event.preventDefault();
                  setOverviewPanelWidth(overviewPanelMaxWidth);
                }
              }}
              onPointerDown={startOverviewPanelResize}
              role="separator"
              sx={{
                alignItems: 'center',
                cursor: 'col-resize',
                display: { xs: 'none', lg: 'flex' },
                height: 'calc(100% - 32px)',
                justifyContent: 'center',
                left: -10,
                outline: 0,
                position: 'absolute',
                top: 16,
                touchAction: 'none',
                width: 18,
                zIndex: 1,
                '&::before': {
                  bgcolor: 'divider',
                  borderRadius: 999,
                  content: '""',
                  height: 52,
                  transition: (theme) =>
                    theme.transitions.create(['background-color', 'height'], {
                      duration: theme.transitions.duration.short,
                    }),
                  width: 4,
                },
                '&:hover::before, &:focus-visible::before': {
                  bgcolor: 'primary.main',
                  height: 72,
                },
              }}
              tabIndex={0}
            />
          ) : null}
          {overviewPanelCollapsed ? (
            <Paper
              elevation={0}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                boxShadow: (theme) =>
                  `0 18px 48px ${alpha(theme.palette.text.primary, 0.06)}`,
                minHeight: { xs: 48, lg: 320 },
                p: { xs: 2, lg: 1 },
              }}
            >
              <Stack
                direction={{ xs: 'row', lg: 'column' }}
                spacing={1.5}
                sx={{
                  alignItems: 'center',
                  justifyContent: { xs: 'flex-start', lg: 'center' },
                  minHeight: { lg: 296 },
                }}
              >
                <Tooltip title="Show application overview panel">
                  <IconButton
                    aria-label="Show application overview panel"
                    onClick={() => setOverviewPanelCollapsed(false)}
                    sx={{ border: '1px solid', borderColor: 'divider' }}
                  >
                    <ShellIcon fontSize="small" name="chevron-left" />
                  </IconButton>
                </Tooltip>
                <Box
                  sx={{
                    alignItems: 'center',
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                    border: '1px solid',
                    borderColor: (theme) => alpha(theme.palette.primary.main, 0.3),
                    borderRadius: 1,
                    color: 'primary.main',
                    display: 'flex',
                    height: 40,
                    justifyContent: 'center',
                    width: 40,
                  }}
                >
                  <ShellIcon name="dashboard" />
                </Box>
                <Typography
                  sx={{
                    fontWeight: 800,
                    transform: { xs: 'none', lg: 'rotate(180deg)' },
                    whiteSpace: 'nowrap',
                    writingMode: { xs: 'horizontal-tb', lg: 'vertical-rl' },
                  }}
                  variant="caption"
                >
                  Overview
                </Typography>
              </Stack>
            </Paper>
          ) : null}
          {overviewPanelCollapsed ? null : (
            <Stack spacing={1.5}>
              <Paper
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  boxShadow: (theme) =>
                    `0 14px 34px ${alpha(theme.palette.text.primary, 0.05)}`,
                  p: 3,
                }}
              >
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
                >
                  <Stack spacing={0.5}>
                    <Typography component="h2" variant="h5">
                      Application overview
                    </Typography>
                    <Typography color="text.secondary">
                      Current operator scope and runtime surface.
                    </Typography>
                  </Stack>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', flexShrink: 0 }}
                  >
                    <Tooltip
                      title={`${expandedPanels.has('overview') ? 'Hide' : 'Show'} application overview details`}
                    >
                      <IconButton
                        aria-controls="axis-dashboard-overview-details"
                        aria-expanded={expandedPanels.has('overview')}
                        aria-label={`${expandedPanels.has('overview') ? 'Collapse' : 'Expand'} application overview`}
                        onClick={() => togglePanel('overview')}
                        size="small"
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          height: 44,
                          width: 44,
                        }}
                      >
                        <ShellIcon
                          fontSize="small"
                          name={
                            expandedPanels.has('overview')
                              ? 'chevron-up'
                              : 'chevron-down'
                          }
                        />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Collapse panel to right">
                      <IconButton
                        aria-label="Collapse application overview panel to right"
                        onClick={() => setOverviewPanelCollapsed(true)}
                        size="small"
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          height: 44,
                          width: 44,
                        }}
                      >
                        <ShellIcon fontSize="small" name="chevron-right" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Paper>
              <Collapse
                id="axis-dashboard-overview-details"
                in={expandedPanels.has('overview')}
                timeout="auto"
                unmountOnExit
              >
                <Stack spacing={1.5}>
                  {[
                    {
                      label: 'Modules active',
                      value: activeModuleCount,
                      total: Math.max(registeredModules.length, activeModuleCount),
                      icon: 'registry',
                    },
                    {
                      label: 'Data current',
                      value: currentReleaseCount,
                      total: Math.max(releases.length, currentReleaseCount),
                      icon: 'import',
                    },
                    {
                      label: 'Online-ready sources',
                      value: readyPublicationCount,
                      total: Math.max(
                        allPublicationStatuses.length,
                        readyPublicationCount,
                      ),
                      icon: 'approve',
                    },
                  ].map((item) => (
                    <Paper
                      elevation={0}
                      key={item.label}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 2,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1.25}
                        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <Stack
                          direction="row"
                          spacing={1.25}
                          sx={{ alignItems: 'center' }}
                        >
                          <Box
                            sx={{
                              alignItems: 'center',
                              bgcolor: (theme) =>
                                alpha(theme.palette.primary.main, 0.1),
                              border: '1px solid',
                              borderColor: (theme) =>
                                alpha(theme.palette.primary.main, 0.3),
                              borderRadius: 1,
                              color: 'primary.main',
                              display: 'flex',
                              height: 36,
                              justifyContent: 'center',
                              width: 36,
                            }}
                          >
                            <ShellIcon fontSize="small" name={item.icon} />
                          </Box>
                          <Typography sx={{ fontWeight: 800 }}>{item.label}</Typography>
                        </Stack>
                        <Chip
                          label={`${String(item.value)} / ${String(item.total)}`}
                          size="small"
                          sx={{ fontWeight: 800 }}
                        />
                      </Stack>
                      <LinearProgress
                        aria-label={item.label}
                        sx={{ mt: 1.25 }}
                        value={progressPercent(item.value, item.total)}
                        variant="determinate"
                      />
                    </Paper>
                  ))}
                  <Paper
                    elevation={0}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 2,
                    }}
                  >
                    <Stack spacing={1.25}>
                      <Typography component="h3" variant="subtitle1">
                        Runtime surface
                      </Typography>
                      <Box
                        sx={{
                          display: 'grid',
                          gap: 1,
                          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        }}
                      >
                        <Chip label={`${String(visibleRouteCount)} routes`} />
                        <Chip label={`${String(workbenchCount)} workbenches`} />
                        <Chip
                          label={`${String(liveConnections.length)} live connections`}
                        />
                        <Chip label={`Tenant ${bootstrap.tenantCode}`} />
                      </Box>
                    </Stack>
                  </Paper>
                </Stack>
              </Collapse>
            </Stack>
          )}
        </Box>
      </Box>
      <Paper
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          boxShadow: (theme) =>
            `0 18px 48px ${alpha(theme.palette.text.primary, 0.05)}`,
          p: 3,
        }}
      >
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
          >
            <Stack spacing={0.5}>
              <Typography component="h2" variant="h5">
                Work areas
              </Typography>
              <Typography color="text.secondary">
                Jump into the major business and platform journeys exposed by the active
                backend contract.
              </Typography>
            </Stack>
            <Tooltip
              title={`${expandedPanels.has('work-areas') ? 'Hide' : 'Show'} work areas`}
            >
              <IconButton
                aria-controls="axis-dashboard-work-areas"
                aria-expanded={expandedPanels.has('work-areas')}
                aria-label={`${expandedPanels.has('work-areas') ? 'Collapse' : 'Expand'} work areas`}
                onClick={() => togglePanel('work-areas')}
                size="small"
                sx={{
                  alignSelf: { xs: 'flex-start', md: 'center' },
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <ShellIcon
                  fontSize="small"
                  name={
                    expandedPanels.has('work-areas') ? 'chevron-up' : 'chevron-down'
                  }
                />
              </IconButton>
            </Tooltip>
          </Stack>
          <Collapse
            id="axis-dashboard-work-areas"
            in={expandedPanels.has('work-areas')}
            timeout="auto"
            unmountOnExit
          >
            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(4, minmax(0, 1fr))',
                },
              }}
            >
              {[
                { label: 'Content', route: '/content', icon: 'content' },
                { label: 'Media', route: '/media', icon: 'media' },
                {
                  label: 'Commerce',
                  route: '/commerce/catalog/products',
                  icon: 'commerce',
                },
                { label: 'Process', route: '/process', icon: 'workflow' },
              ].map((item) => (
                <Button
                  key={item.route}
                  onClick={() => void navigate(item.route)}
                  startIcon={<ShellIcon name={item.icon} />}
                  sx={{
                    bgcolor: 'background.paper',
                    justifyContent: 'flex-start',
                    minHeight: 54,
                    px: 2,
                  }}
                  variant="outlined"
                >
                  {item.label}
                </Button>
              ))}
            </Box>
          </Collapse>
        </Stack>
      </Paper>
    </WorkspaceContainer>
  );
}
