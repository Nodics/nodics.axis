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

const overviewPanelMinWidth = 320;
const overviewPanelDefaultWidth = 380;
const overviewPanelMaxWidth = 560;

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
  return (
    status.readiness === 'PUBLICATION_PENDING' &&
    status.publication?.state === 'PENDING_APPROVAL'
  );
}

function publicationNeedsAction(
  status: ApplicationInitializationStatus | DocumentationPublicationStatus,
): boolean {
  return ['NOT_IMPORTED', 'IMPORTED', 'FAILED', 'REJECTED'].includes(status.readiness);
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
    () => new Set(['modules', 'data', 'publishing', 'setup', 'overview', 'work-areas']),
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
  const initReleaseCount = releases.filter((release) => release.dataType === 'init');
  const coreReleaseCount = releases.filter((release) => release.dataType === 'core');
  const sampleReleaseCount = releases.filter(
    (release) => release.dataType === 'sample',
  );
  const dataActionCount = releases.filter(dataReleaseNeedsAction).length;
  const approvalCount = allPublicationStatuses.filter(publicationNeedsApproval).length;
  const publicationActionCount =
    allPublicationStatuses.filter(publicationNeedsAction).length;
  const visiblePublicationActionCount = approvalCount + publicationActionCount;
  const readyApplicationCount = applicationStatuses.filter(
    (status) => status.readiness === 'READY',
  ).length;
  const activeModuleCount = registeredModules.filter(
    (module) => module.enabled && module.runtimeState === 'ACTIVE',
  ).length;
  const currentReleaseCount = releases.filter(
    (release) => release.status === 'CURRENT',
  ).length;
  const readyPublicationCount = allPublicationStatuses.filter(
    (status) => status.readiness === 'READY',
  ).length;
  const liveConnections = Object.values(bootstrap.moduleConnections)
    .flat()
    .filter(
      (connection) => connection.state === 'UP' || connection.state === 'DEGRADED',
    );
  const workbenchCount = bootstrap.navigation.filter(
    (item) => item.workbenchTarget && item.featureState !== 'HIDDEN',
  ).length;
  const visibleRouteCount = bootstrap.navigation.filter(
    (item) => item.featureState !== 'HIDDEN',
  ).length;
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
        applicationStatuses.some((status) =>
          ['BLOCKED', 'FAILED', 'REJECTED'].includes(status.readiness),
        ) || visiblePublicationActionCount > 0
          ? 'warning'
          : 'info',
      count:
        applicationProfiles.length > 0
          ? Math.max(applicationProfiles.length - readyApplicationCount, 0)
          : undefined,
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
          label: 'Documentation sources',
          value: String(documentationSources.length),
          severity: documentationSources.length > 0 ? 'info' : 'warning',
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
                value: moduleActionCount + dataActionCount + approvalCount,
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
                moduleActionCount + dataActionCount + approvalCount > 0
                  ? 'warning'
                  : 'success'
              }
              label={
                moduleActionCount + dataActionCount + approvalCount > 0
                  ? `${String(moduleActionCount + dataActionCount + approvalCount)} actions`
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
