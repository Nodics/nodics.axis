import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisModuleConnection,
  type AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  applyFunctionalModuleLifecycleAction,
  installFunctionalModuleSampleData,
  loadAvailableFunctionalModules,
  loadRegisteredFunctionalModules,
  type FunctionalModuleLifecycleAction,
} from './api/functionalModuleRegistryClient';
import type {
  FunctionalModuleActivationData,
  FunctionalModuleRegistration,
  FunctionalModuleRuntimeState,
} from './api/functionalModuleRegistryContracts';

interface FunctionalModuleRegistryRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly onBootstrapRefresh?: (() => Promise<void>) | undefined;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}

function stateColor(
  state:
    | FunctionalModuleRuntimeState
    | 'REGISTERED'
    | 'AVAILABLE'
    | 'DEREGISTERED'
    | 'DISABLED',
): 'success' | 'warning' | 'error' | 'default' {
  if (state === 'ACTIVE' || state === 'REGISTERED') return 'success';
  if (state === 'AVAILABLE' || state === 'DEGRADED' || state === 'DISABLED') {
    return 'warning';
  }
  if (state === 'OFFLINE' || state === 'INCOMPATIBLE') return 'error';
  return 'default';
}

function formatTime(value: string | undefined): string {
  if (!value) return 'Not observed';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(date);
}

function sortedModules(
  modules: readonly FunctionalModuleRegistration[],
): readonly FunctionalModuleRegistration[] {
  return [...modules].sort((left, right) => {
    const leftIndex = Number(left.moduleIndex);
    const rightIndex = Number(right.moduleIndex);
    if (Number.isFinite(leftIndex) && Number.isFinite(rightIndex)) {
      return (
        leftIndex - rightIndex ||
        left.functionalModule.localeCompare(right.functionalModule)
      );
    }
    if (Number.isFinite(leftIndex)) return -1;
    if (Number.isFinite(rightIndex)) return 1;
    return left.functionalModule.localeCompare(right.functionalModule);
  });
}

const registryQueryRoot = ['functional-module-registry'] as const;
type ModuleAction = FunctionalModuleLifecycleAction | 'preview';
type ModuleReadiness =
  | 'Blocked'
  | 'Ready to activate'
  | 'Active'
  | 'Active with warnings';

interface ModuleVisibilitySummary {
  readonly activeRoutes: number;
  readonly hiddenRoutes: number;
  readonly unavailableRoutes: number;
}

function moduleReadiness(module: FunctionalModuleRegistration): ModuleReadiness {
  if ((module.activationData?.preflight.missingDependencies.length ?? 0) > 0) {
    return 'Blocked';
  }
  if (module.registrationState !== 'REGISTERED') return 'Ready to activate';
  if (!module.enabled && module.runtimeState !== 'ACTIVE') return 'Blocked';
  if (module.enabled && module.runtimeState === 'DEGRADED')
    return 'Active with warnings';
  if (module.enabled) return 'Active';
  return 'Ready to activate';
}

function readinessColor(
  readiness: ModuleReadiness,
): 'success' | 'warning' | 'error' | 'info' {
  if (readiness === 'Active') return 'success';
  if (readiness === 'Active with warnings') return 'warning';
  if (readiness === 'Blocked') return 'error';
  return 'info';
}

function activationMode(module: FunctionalModuleRegistration): string {
  if (module.required) return 'Protected foundation module';
  const missing = module.activationData?.preflight.dependencyStates.filter(
    (dependency) => !dependency.satisfied,
  );
  if (missing && missing.length > 0) {
    return `Waiting for ${missing.map((item) => item.displayName).join(', ')}`;
  }
  if (module.registrationState === 'AVAILABLE') return 'Register before activation';
  if (module.enabled) return 'Active in Axis';
  if (module.activationData?.packages.length === 0) {
    return 'Ready to activate; no required data import';
  }
  return 'Activate after required data is ready';
}

function moduleOwnsNavigationItem(
  module: FunctionalModuleRegistration,
  item: AxisNavigationItem,
): boolean {
  const owners = new Set([
    module.functionalModule,
    ...module.technicalModules,
    module.functionalModule.replace(/^nodics\./u, ''),
  ]);
  return (
    owners.has(item.moduleName) ||
    (item.routeOwner?.ownerModule ? owners.has(item.routeOwner.ownerModule) : false) ||
    (item.workbenchTarget?.moduleName
      ? owners.has(item.workbenchTarget.moduleName)
      : false)
  );
}

function moduleVisibilitySummary(
  module: FunctionalModuleRegistration,
  navigation: readonly AxisNavigationItem[],
): ModuleVisibilitySummary {
  return navigation
    .filter((item) => moduleOwnsNavigationItem(module, item))
    .reduce<ModuleVisibilitySummary>(
      (summary, item) => {
        const featureHidden =
          item.featureState === 'HIDDEN' || item.featureState === 'DISABLED';
        const unavailable = item.availability === 'UNAVAILABLE';
        return {
          activeRoutes: summary.activeRoutes + (!featureHidden && !unavailable ? 1 : 0),
          hiddenRoutes: summary.hiddenRoutes + (featureHidden ? 1 : 0),
          unavailableRoutes: summary.unavailableRoutes + (unavailable ? 1 : 0),
        };
      },
      { activeRoutes: 0, hiddenRoutes: 0, unavailableRoutes: 0 },
    );
}

function activeConnections(
  connections: readonly AxisModuleConnection[] | undefined,
): readonly AxisModuleConnection[] {
  return Object.freeze(
    (connections ?? []).filter(
      (connection) => connection.state === 'UP' || connection.state === 'DEGRADED',
    ),
  );
}

function sampleReceipt(module: FunctionalModuleRegistration) {
  return module.activationData?.receipts.find(
    (receipt) => receipt.dataType === 'sample' && receipt.trigger === 'USER',
  );
}

function canRequestSampleData(module: FunctionalModuleRegistration): boolean {
  const receipt = sampleReceipt(module);
  return Boolean(
    receipt &&
    ['SKIPPED_USER_TRIGGERED', 'FAILED', 'DATA_FAILED'].includes(receipt.status),
  );
}

function targetRuntimeRole(targetServer: string): string | undefined {
  if (targetServer === 'platformServer') return 'PLATFORM';
  if (targetServer === 'wcmsStaged') return 'WCMS_STAGED';
  if (targetServer === 'wcmsOnline') return 'WCMS_ONLINE';
  if (targetServer === 'commerceServer') return 'COMMERCE';
  if (targetServer === 'commerceStagedServer') return 'COMMERCE_STAGED';
  if (targetServer === 'engagementServer') return 'ENGAGEMENT';
  return undefined;
}

function selectSampleDataConnection(
  bootstrap: AxisAuthenticatedBootstrap,
  module: FunctionalModuleRegistration,
): AxisModuleConnection | undefined {
  const receipt = sampleReceipt(module);
  if (!receipt) return undefined;
  const importConnections = activeConnections(bootstrap.moduleConnections.import);
  if (receipt.targetServer) {
    const serverConnection = importConnections.find(
      (connection) => connection.server === receipt.targetServer,
    );
    if (serverConnection) return serverConnection;
  }
  const role = targetRuntimeRole(receipt.targetServer);
  if (role) {
    const roleConnection = importConnections.find(
      (connection) => connection.runtimeRole?.code === role,
    );
    if (roleConnection) return roleConnection;
  }
  if (receipt.targetModule) {
    const moduleConnection = importConnections.find(
      (connection) => connection.moduleName === receipt.targetModule,
    );
    if (moduleConnection) return moduleConnection;
  }
  return importConnections.length === 1 ? importConnections[0] : undefined;
}

function removeModule(
  modules: readonly FunctionalModuleRegistration[] | undefined,
  functionalModule: string,
): readonly FunctionalModuleRegistration[] {
  return (modules ?? []).filter(
    (module) => module.functionalModule !== functionalModule,
  );
}

function upsertModule(
  modules: readonly FunctionalModuleRegistration[] | undefined,
  nextModule: FunctionalModuleRegistration,
): readonly FunctionalModuleRegistration[] {
  return sortedModules([
    ...removeModule(modules, nextModule.functionalModule),
    nextModule,
  ]);
}

interface ModuleCardProps {
  readonly disabled?: boolean | undefined;
  readonly module: FunctionalModuleRegistration;
  readonly onAction: (
    module: FunctionalModuleRegistration,
    action: ModuleAction,
  ) => void;
  readonly onSampleData: (module: FunctionalModuleRegistration) => void;
  readonly pendingAction?: ModuleAction | undefined;
  readonly pendingSampleData?: boolean | undefined;
  readonly sampleDataDisabled?: boolean | undefined;
  readonly visibility: ModuleVisibilitySummary;
}

function receiptSeverity(status: string): 'success' | 'warning' | 'error' | 'info' {
  if (['FAILED', 'DATA_FAILED'].includes(status)) return 'error';
  if (
    ['RUNNING', 'QUEUED', 'PENDING_IMPORT', 'WAITING_APPROVAL', 'RETRYABLE'].includes(
      status,
    )
  ) {
    return 'warning';
  }
  if (['PLANNED', 'SKIPPED_USER_TRIGGERED', 'DATA_LEFT_INTACT'].includes(status)) {
    return 'info';
  }
  return 'success';
}

function receiptStatusLabel(status: string): string {
  if (status === 'NOT_APPLICABLE') return 'No action required';
  if (status === 'PENDING_IMPORT') return 'Import pending';
  if (status === 'QUEUED') return 'Queued';
  if (status === 'RUNNING') return 'Import running';
  if (status === 'WAITING_APPROVAL') return 'Waiting for approval';
  if (status === 'RETRYABLE') return 'Retry available';
  if (status === 'COMPLETED') return 'Completed';
  if (status === 'IMPORTED') return 'Imported';
  if (status === 'FAILED' || status === 'DATA_FAILED') return 'Failed';
  if (status === 'SKIPPED_USER_TRIGGERED') return 'Available on request';
  if (status === 'DATA_LEFT_INTACT') return 'Data left intact';
  if (status === 'PLANNED') return 'Planned';
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function friendlyCodeLabel(code: string): string {
  return code
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[:._-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/\b\w/gu, (value) => value.toUpperCase());
}

function dataTypeLabel(dataType: string | undefined): string {
  if (dataType === 'init') return 'Init data';
  if (dataType === 'core') return 'Core data';
  if (dataType === 'sample') return 'Sample data';
  return 'Data';
}

function classificationLabel(classification: string): string {
  if (classification === 'REQUIRED') return 'Required';
  if (classification === 'OPTIONAL') return 'Optional';
  return receiptStatusLabel(classification);
}

function ActivationDataPanel({
  activationData,
}: {
  readonly activationData?: FunctionalModuleActivationData | undefined;
}) {
  if (!activationData) return null;
  const requiredPackages = activationData.packages.filter(
    (pack) => pack.required || pack.classification === 'REQUIRED',
  );
  const optionalPackages = activationData.packages.filter(
    (pack) => !pack.required && pack.classification !== 'REQUIRED',
  );
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Chip label={`Execution: ${activationData.executionMode}`} size="small" />
        <Chip label={`Readiness: ${activationData.readiness}`} size="small" />
        {activationData.dryRun ? (
          <Chip color="info" label="Dry run" size="small" />
        ) : null}
      </Stack>
      {activationData.preflight.blockedReasons.length > 0 ? (
        <Alert severity="warning">
          Blocked by {activationData.preflight.blockedReasons.join(', ')}
        </Alert>
      ) : null}
      {activationData.preflight.dependencyStates.length > 0 ? (
        <Box>
          <Typography color="text.secondary" sx={{ mb: 1 }} variant="caption">
            Runtime and data dependencies
          </Typography>
          <Stack component="ul" spacing={0} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {activationData.preflight.dependencyStates.map((dependency) => (
              <Box
                component="li"
                key={dependency.functionalModule}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'minmax(140px, 1fr) minmax(0, 3fr)',
                  },
                  gap: { xs: 0.5, sm: 2 },
                  py: 1.25,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  overflowWrap: 'anywhere',
                }}
              >
                <Typography variant="subtitle2">{dependency.displayName}</Typography>
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                  <Typography
                    color={dependency.satisfied ? 'text.secondary' : 'error.main'}
                    variant="body2"
                  >
                    {dependency.reason ||
                      `${dependency.registrationState} · ${dependency.runtimeState}`}
                  </Typography>
                  {dependency.resolution ? (
                    <Typography variant="body2">{dependency.resolution}</Typography>
                  ) : null}
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
      ) : activationData.preflight.dependencies.length > 0 ? (
        <Box>
          <Typography color="text.secondary" sx={{ mb: 1 }} variant="caption">
            Runtime and data dependencies
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {activationData.preflight.dependencies.map((dependency) => (
              <Chip
                key={dependency}
                label={friendlyCodeLabel(dependency)}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        </Box>
      ) : null}
      {activationData.packages.length > 0 ? (
        <Stack spacing={1}>
          <Typography color="text.secondary" variant="caption">
            Data packages
          </Typography>
          <Grid container spacing={1}>
            {[
              {
                label: 'Required/core',
                packages: requiredPackages,
                severity: 'warning' as const,
              },
              {
                label: 'Optional/sample',
                packages: optionalPackages,
                severity: 'info' as const,
              },
            ].map((group) => (
              <Grid key={group.label} size={{ xs: 12, md: 6 }}>
                <Alert severity={group.severity}>
                  <Typography component="div" variant="subtitle2">
                    {group.label}: {String(group.packages.length)}
                  </Typography>
                  {group.packages.length > 0 ? (
                    <Stack spacing={0.5} sx={{ mt: 1 }}>
                      {group.packages.slice(0, 4).map((pack) => (
                        <Typography
                          key={JSON.stringify([
                            pack.code,
                            pack.targetServer,
                            pack.targetModule,
                            pack.targetDatabase,
                          ])}
                          variant="caption"
                        >
                          {friendlyCodeLabel(pack.code)} ·{' '}
                          {dataTypeLabel(pack.dataType)} · {pack.trigger || 'SYSTEM'}
                        </Typography>
                      ))}
                      {group.packages.length > 4 ? (
                        <Typography color="text.secondary" variant="caption">
                          +{String(group.packages.length - 4)} more package(s)
                        </Typography>
                      ) : null}
                    </Stack>
                  ) : (
                    <Typography color="text.secondary" variant="caption">
                      No package declared in this class.
                    </Typography>
                  )}
                </Alert>
              </Grid>
            ))}
          </Grid>
        </Stack>
      ) : null}
      {activationData.receipts.length > 0 ? (
        <Stack spacing={1}>
          <Typography color="text.secondary" variant="caption">
            Data receipts
          </Typography>
          {activationData.receipts.map((receipt) => (
            <Alert key={receipt.receiptKey} severity={receiptSeverity(receipt.status)}>
              <strong>{friendlyCodeLabel(receipt.code)}</strong> ·{' '}
              {classificationLabel(receipt.classification)} ·{' '}
              {dataTypeLabel(receipt.dataType)} · {receiptStatusLabel(receipt.status)}
              {receipt.releaseStatus ? ` · release ${receipt.releaseStatus}` : ''}
              {receipt.importRunId ? ` · run ${receipt.importRunId}` : ''}
              <br />
              <Typography color="text.secondary" component="span" variant="caption">
                Code: {receipt.code}
              </Typography>
              <br />
              {receipt.message}
            </Alert>
          ))}
        </Stack>
      ) : (
        <Alert severity="info">No activation data is required for this module.</Alert>
      )}
      {activationData.nextActions.length > 0 ? (
        <Typography color="text.secondary" variant="caption">
          Next actions: {activationData.nextActions.join(', ')}
        </Typography>
      ) : null}
    </Stack>
  );
}

function RegistryMetric({
  label,
  tone = 'default',
  value,
}: {
  readonly label: string;
  readonly tone?: 'default' | 'success' | 'warning' | 'error' | 'info';
  readonly value: string;
}) {
  const toneColor = {
    default: 'text.primary',
    error: 'error.main',
    info: 'info.main',
    success: 'success.main',
    warning: 'warning.main',
  }[tone];
  return (
    <Box
      sx={{
        bgcolor: (theme) =>
          tone === 'default'
            ? alpha(theme.palette.background.default, 0.54)
            : alpha(theme.palette[tone].main, 0.055),
        border: '1px solid',
        borderColor: (theme) =>
          tone === 'default'
            ? alpha(theme.palette.divider, 0.78)
            : alpha(theme.palette[tone].main, 0.22),
        borderRadius: 1,
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 0.25, sm: 1 },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        boxShadow: (theme) =>
          `inset 0 1px 0 ${alpha(theme.palette.common.white, 0.56)}`,
        minHeight: 48,
        minWidth: 112,
        px: 1.25,
        py: 0.65,
      }}
    >
      <Typography
        color="text.secondary"
        sx={{ display: 'block', fontSize: '0.76rem', lineHeight: 1.15 }}
        variant="caption"
      >
        {label}
      </Typography>
      <Typography
        color={toneColor}
        sx={{
          fontSize: '1.05rem',
          fontWeight: 800,
          lineHeight: 1.15,
          textAlign: { sm: 'right' },
          whiteSpace: 'nowrap',
        }}
        variant="h6"
      >
        {value}
      </Typography>
    </Box>
  );
}

function ModuleCard({
  disabled,
  module,
  onAction,
  onSampleData,
  pendingAction,
  pendingSampleData,
  sampleDataDisabled,
  visibility,
}: ModuleCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [technicalExpanded, setTechnicalExpanded] = useState(false);
  const isRegistered = module.registrationState === 'REGISTERED';
  const canRegister = module.registrationState === 'AVAILABLE';
  const missingDependencyCount =
    module.activationData?.preflight.missingDependencies.length ?? 0;
  const canActivate =
    isRegistered &&
    !module.enabled &&
    module.runtimeState === 'ACTIVE' &&
    missingDependencyCount === 0;
  const canDeactivate = isRegistered && module.enabled && !module.required;
  const canDeregister = isRegistered && !module.required;
  const pending = Boolean(pendingAction);
  const readiness = moduleReadiness(module);
  const impactCount = module.technicalModules.length + module.observedServers.length;
  const activationData = module.activationData;
  const dependencyCount = activationData?.preflight.dependencies.length ?? 0;
  const requiredPackageCount =
    activationData?.packages.filter(
      (pack) => pack.required || pack.classification === 'REQUIRED',
    ).length ?? 0;
  const userSamplePackageCount =
    activationData?.packages.filter(
      (pack) => pack.dataType === 'sample' || pack.trigger === 'USER',
    ).length ?? 0;
  const blockedReasonCount = Math.max(
    activationData?.preflight.blockedReasons.length ?? 0,
    missingDependencyCount,
  );
  const visibleTechnicalModules = technicalExpanded
    ? module.technicalModules
    : module.technicalModules.slice(0, 8);
  const remainingTechnicalModules =
    module.technicalModules.length - visibleTechnicalModules.length;
  const hasSampleData = canRequestSampleData(module);
  const detailId = `module-registry-details-${module.functionalModule.replace(
    /[^A-Za-z0-9_-]/gu,
    '-',
  )}`;
  const routeTotal =
    visibility.activeRoutes + visibility.hiddenRoutes + visibility.unavailableRoutes;
  const dataPackageCount = activationData?.packages.length ?? 0;
  const serverSummary =
    module.observedServers.length > 0
      ? `${String(module.observedServers.length)} runtime`
      : 'No runtime';
  const primaryAction = canRegister
    ? 'register'
    : canActivate
      ? 'activate'
      : !module.enabled
        ? 'preview'
        : undefined;
  const primaryActionLabel =
    primaryAction === 'register'
      ? pendingAction === 'register'
        ? 'Registering...'
        : 'Register'
      : primaryAction === 'activate'
        ? pendingAction === 'activate'
          ? 'Activating...'
          : 'Activate'
        : primaryAction === 'preview'
          ? pendingAction === 'preview'
            ? 'Previewing...'
            : 'Preview'
          : undefined;

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 1,
        borderColor:
          readiness === 'Blocked'
            ? 'error.light'
            : readiness === 'Active with warnings'
              ? 'warning.light'
              : readiness === 'Active'
                ? 'success.light'
                : 'divider',
        boxShadow: (theme) =>
          expanded
            ? `0 18px 44px ${alpha(theme.palette.text.primary, 0.08)}`
            : `0 8px 22px ${alpha(theme.palette.text.primary, 0.04)}`,
        overflow: 'hidden',
        position: 'relative',
        transition: (theme) =>
          theme.transitions.create(['border-color', 'box-shadow', 'transform'], {
            duration: theme.transitions.duration.short,
          }),
        '&:before': {
          bgcolor:
            readiness === 'Blocked'
              ? 'error.main'
              : readiness === 'Active with warnings'
                ? 'warning.main'
                : readiness === 'Active'
                  ? 'success.main'
                  : 'info.main',
          content: '""',
          height: '100%',
          left: 0,
          position: 'absolute',
          top: 0,
          width: 4,
        },
        '&:hover': {
          boxShadow: (theme) => `0 20px 48px ${alpha(theme.palette.text.primary, 0.1)}`,
          transform: 'translateY(-1px)',
        },
      }}
    >
      <CardContent
        sx={{
          '&:last-child': { pb: 1.5 },
          pb: 1.5,
          pl: 2.5,
          pr: 2,
          pt: 1.5,
        }}
      >
        <Stack spacing={1.25}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={1.25}
            sx={{ alignItems: { lg: 'center' }, justifyContent: 'space-between' }}
          >
            <Stack
              direction="row"
              spacing={1.25}
              sx={{ alignItems: 'center', flex: 1, minWidth: 0 }}
            >
              <Box
                sx={{
                  alignItems: 'center',
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                  border: '1px solid',
                  borderColor: (theme) => alpha(theme.palette.primary.main, 0.36),
                  borderRadius: 1,
                  color: 'primary.main',
                  display: 'flex',
                  flexShrink: 0,
                  height: 36,
                  justifyContent: 'center',
                  width: 36,
                }}
              >
                <ShellIcon fontSize="small" name="registry" />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  component="h3"
                  sx={{ fontSize: '1.08rem', fontWeight: 800, lineHeight: 1.2 }}
                  variant="h6"
                >
                  {module.displayName}
                </Typography>
                <Typography
                  color="text.secondary"
                  sx={{ fontSize: '0.86rem', lineHeight: 1.25, mt: 0.25 }}
                  variant="body2"
                >
                  {activationMode(module)}
                </Typography>
                <Stack
                  direction="row"
                  spacing={0.6}
                  sx={{
                    flexWrap: 'wrap',
                    mt: 0.75,
                    rowGap: 0.6,
                    '& .MuiChip-root': { height: 24 },
                    '& .MuiChip-label': { px: 1 },
                  }}
                >
                  <Chip
                    color={readinessColor(readiness)}
                    label={readiness}
                    size="small"
                  />
                  <Chip
                    color={stateColor(module.runtimeState)}
                    label={module.runtimeState}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    color={module.enabled ? 'success' : stateColor('DISABLED')}
                    label={module.enabled ? 'Enabled' : 'Disabled'}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={module.required ? 'Required' : 'Optional'}
                    size="small"
                    variant="outlined"
                  />
                  {module.registeredVersion ? (
                    <Chip
                      label={`v${module.registeredVersion}`}
                      size="small"
                      variant="outlined"
                    />
                  ) : null}
                </Stack>
              </Box>
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                flexShrink: 0,
                flexWrap: 'wrap',
                justifyContent: { xs: 'flex-start', lg: 'flex-end' },
                rowGap: 1,
              }}
            >
              {primaryAction && primaryActionLabel ? (
                <Button
                  disabled={
                    disabled ||
                    pending ||
                    (primaryAction === 'preview' && !isRegistered)
                  }
                  onClick={() => onAction(module, primaryAction)}
                  size="small"
                  startIcon={
                    <ShellIcon
                      fontSize="small"
                      name={primaryAction === 'preview' ? 'visible' : 'approve'}
                    />
                  }
                  variant={primaryAction === 'preview' ? 'outlined' : 'contained'}
                >
                  {primaryActionLabel}
                </Button>
              ) : null}
              <Tooltip title={expanded ? 'Hide details' : 'Show details'}>
                <IconButton
                  aria-controls={detailId}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${module.displayName}`}
                  onClick={() => setExpanded((value) => !value)}
                  size="small"
                  sx={{ height: 32, width: 32 }}
                >
                  <ShellIcon
                    fontSize="small"
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                  />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          <Grid container spacing={0.9}>
            <Grid size={{ xs: 6, md: 3 }}>
              <RegistryMetric
                label="Routes"
                tone={visibility.unavailableRoutes > 0 ? 'error' : 'success'}
                value={`${String(visibility.activeRoutes)}/${String(routeTotal)}`}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <RegistryMetric
                label="Data"
                tone={
                  blockedReasonCount > 0
                    ? 'error'
                    : dataPackageCount > 0
                      ? 'info'
                      : 'default'
                }
                value={
                  blockedReasonCount > 0
                    ? `${String(blockedReasonCount)} blocked`
                    : `${String(dataPackageCount)} pack`
                }
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <RegistryMetric
                label="Servers"
                tone={module.runtimeState === 'ACTIVE' ? 'success' : 'warning'}
                value={serverSummary}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <RegistryMetric
                label="Catalogue"
                value={`r${String(module.catalogueRevision)}`}
              />
            </Grid>
          </Grid>

          <Collapse id={detailId} in={expanded} timeout="auto" unmountOnExit>
            <Stack
              spacing={2}
              sx={{
                borderTop: '1px solid',
                borderColor: 'divider',
                mt: 0.5,
                pt: 2,
              }}
            >
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography color="text.secondary" variant="caption">
                    Registry identity
                  </Typography>
                  <Typography>{module.functionalModule}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography color="text.secondary" variant="caption">
                    Last observed
                  </Typography>
                  <Typography>{formatTime(module.lastObservedAt)}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography color="text.secondary" variant="caption">
                    Observed servers
                  </Typography>
                  <Typography>
                    {module.observedServers.length > 0
                      ? module.observedServers.join(', ')
                      : 'No runtime server observed'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography color="text.secondary" variant="caption">
                    Registration
                  </Typography>
                  <Typography>{module.registrationState}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography color="text.secondary" variant="caption">
                    Runtime signals
                  </Typography>
                  <Typography>
                    {String(impactCount)} technical/server signal(s)
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography color="text.secondary" variant="caption">
                    Data receipts
                  </Typography>
                  <Typography>
                    {activationData
                      ? `${String(activationData.receipts.length)} receipt(s)`
                      : 'Preview available'}
                  </Typography>
                </Grid>
              </Grid>

              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip
                  color={visibility.activeRoutes > 0 ? 'success' : 'default'}
                  label={`${String(visibility.activeRoutes)} visible`}
                  size="small"
                />
                <Chip
                  color={visibility.hiddenRoutes > 0 ? 'warning' : 'default'}
                  label={`${String(visibility.hiddenRoutes)} hidden/disabled`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  color={visibility.unavailableRoutes > 0 ? 'error' : 'default'}
                  label={`${String(visibility.unavailableRoutes)} unavailable`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  color={requiredPackageCount > 0 ? 'warning' : 'default'}
                  label={`${String(requiredPackageCount)} required/core`}
                  size="small"
                />
                <Chip
                  color={userSamplePackageCount > 0 ? 'info' : 'default'}
                  label={`${String(userSamplePackageCount)} sample/user`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`${String(dependencyCount)} dependencies`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  color={blockedReasonCount > 0 ? 'error' : 'success'}
                  label={
                    blockedReasonCount > 0
                      ? `${String(blockedReasonCount)} blocker(s)`
                      : 'No blockers'
                  }
                  size="small"
                />
              </Stack>

              {module.technicalModules.length > 0 ? (
                <Box>
                  <Typography color="text.secondary" sx={{ mb: 1 }} variant="caption">
                    Technical modules
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {visibleTechnicalModules.map((technicalModule) => (
                      <Chip
                        key={technicalModule}
                        label={technicalModule}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                    {module.technicalModules.length > 8 ? (
                      <Button
                        onClick={() => setTechnicalExpanded((value) => !value)}
                        size="small"
                        variant="text"
                      >
                        {technicalExpanded
                          ? 'Show fewer'
                          : `Show ${String(remainingTechnicalModules)} more`}
                      </Button>
                    ) : null}
                  </Stack>
                </Box>
              ) : null}

              <ActivationDataPanel activationData={activationData} />

              {missingDependencyCount === 0 ? (
                <Alert
                  severity={
                    missingDependencyCount > 0
                      ? 'warning'
                      : canActivate
                        ? 'warning'
                        : module.enabled
                          ? 'success'
                          : 'info'
                  }
                >
                  {canActivate
                    ? activationData?.packages.length === 0
                      ? 'No required data package is declared.'
                      : 'Activation imports required data before enabling Axis capabilities.'
                    : module.enabled
                      ? 'Axis capabilities are enabled for this module.'
                      : 'Registry state is ready for operator review.'}
                </Alert>
              ) : null}

              <Divider />

              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {canDeactivate ? (
                  <Button
                    color="warning"
                    disabled={disabled || pending}
                    onClick={() => onAction(module, 'rollback')}
                    variant="outlined"
                  >
                    {pendingAction === 'rollback'
                      ? 'Rolling back...'
                      : 'Rollback activation'}
                  </Button>
                ) : null}
                {canDeactivate ? (
                  <Button
                    color="warning"
                    disabled={disabled || pending}
                    onClick={() => onAction(module, 'deactivate')}
                    variant="outlined"
                  >
                    {pendingAction === 'deactivate' ? 'Deactivating...' : 'Deactivate'}
                  </Button>
                ) : null}
                {canDeregister ? (
                  <Button
                    color="error"
                    disabled={disabled || pending}
                    onClick={() => onAction(module, 'deregister')}
                    variant="outlined"
                  >
                    {pendingAction === 'deregister' ? 'Deregistering...' : 'Deregister'}
                  </Button>
                ) : null}
                {hasSampleData ? (
                  <Button
                    disabled={
                      disabled ||
                      pending ||
                      pendingSampleData ||
                      sampleDataDisabled ||
                      !module.enabled
                    }
                    onClick={() => onSampleData(module)}
                    variant="outlined"
                  >
                    {pendingSampleData
                      ? 'Importing sample data...'
                      : 'Import sample data'}
                  </Button>
                ) : null}
                {hasSampleData && sampleDataDisabled ? (
                  <Alert severity="info" sx={{ flex: 1, py: 0 }}>
                    No active data-import runtime is available for this module target.
                  </Alert>
                ) : null}
                {module.required ? (
                  <Alert severity="info" sx={{ flex: 1, py: 0 }}>
                    Required modules cannot be changed here.
                  </Alert>
                ) : null}
                {isRegistered && !module.enabled && module.runtimeState !== 'ACTIVE' ? (
                  <Alert severity="warning" sx={{ flex: 1, py: 0 }}>
                    Activation is blocked until a compatible runtime server is active.
                  </Alert>
                ) : null}
              </Stack>
            </Stack>
          </Collapse>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function FunctionalModuleRegistryRoutePage(
  props: FunctionalModuleRegistryRoutePageProps,
) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [navigationRefreshState, setNavigationRefreshState] = useState<
    | undefined
    | {
        readonly severity: 'success' | 'warning';
        readonly message: string;
      }
  >();
  const [safetyConfirmation, setSafetyConfirmation] = useState<
    | undefined
    | {
        readonly module: FunctionalModuleRegistration;
        readonly action: Extract<
          ModuleAction,
          'rollback' | 'deactivate' | 'deregister'
        >;
      }
  >();
  const connection = selectModuleConnection(props.bootstrap, 'backoffice');
  const configuration = useMemo(
    () => ({
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      projectCode: props.runtime.projectCode,
      timeoutMs: props.runtime.requestTimeoutMs,
    }),
    [
      props.accessToken,
      props.runtime.enterpriseCode,
      props.runtime.projectCode,
      props.runtime.requestTimeoutMs,
    ],
  );
  const registeredModules = useQuery({
    enabled: Boolean(connection),
    queryKey: [...registryQueryRoot, 'registered', configuration.projectCode],
    queryFn: () => {
      if (!connection) throw new Error('BackOffice is unavailable');
      return loadRegisteredFunctionalModules(connection, configuration);
    },
    refetchOnWindowFocus: true,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((module) =>
        module.activationData?.receipts.some((receipt) =>
          ['RUNNING', 'QUEUED', 'PENDING_IMPORT', 'WAITING_APPROVAL'].includes(
            receipt.status,
          ),
        ),
      )
        ? 5000
        : false,
  });
  const availableModules = useQuery({
    enabled: Boolean(connection),
    queryKey: [...registryQueryRoot, 'available', configuration.projectCode],
    queryFn: () => {
      if (!connection) throw new Error('BackOffice is unavailable');
      return loadAvailableFunctionalModules(connection, configuration);
    },
    refetchOnWindowFocus: true,
  });
  const lifecycle = useMutation({
    onMutate: () => setNavigationRefreshState(undefined),
    mutationFn: async ({
      module,
      action,
    }: {
      readonly module: FunctionalModuleRegistration;
      readonly action: ModuleAction;
    }) => {
      if (!connection) throw new Error('BackOffice is unavailable');
      return applyFunctionalModuleLifecycleAction(
        connection,
        module,
        action === 'preview' ? 'activate' : action,
        configuration,
        { dryRun: action === 'preview' },
      );
    },
    onSuccess: async (updatedModule, variables) => {
      setNavigationRefreshState(undefined);
      const registeredQueryKey = [
        ...registryQueryRoot,
        'registered',
        configuration.projectCode,
      ];
      const availableQueryKey = [
        ...registryQueryRoot,
        'available',
        configuration.projectCode,
      ];
      if (variables.action === 'preview') {
        queryClient.setQueryData<readonly FunctionalModuleRegistration[]>(
          registeredQueryKey,
          (modules) => upsertModule(modules, updatedModule),
        );
        return;
      } else if (variables.action === 'deregister') {
        queryClient.setQueryData<readonly FunctionalModuleRegistration[]>(
          registeredQueryKey,
          (modules) => removeModule(modules, updatedModule.functionalModule),
        );
        queryClient.setQueryData<readonly FunctionalModuleRegistration[]>(
          availableQueryKey,
          (modules) =>
            updatedModule.runtimeState === 'ACTIVE'
              ? upsertModule(modules, {
                  ...updatedModule,
                  enabled: false,
                  registrationState: 'AVAILABLE',
                })
              : removeModule(modules, updatedModule.functionalModule),
        );
      } else {
        queryClient.setQueryData<readonly FunctionalModuleRegistration[]>(
          registeredQueryKey,
          (modules) => upsertModule(modules, updatedModule),
        );
        queryClient.setQueryData<readonly FunctionalModuleRegistration[]>(
          availableQueryKey,
          (modules) => removeModule(modules, updatedModule.functionalModule),
        );
      }
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: registeredQueryKey,
          type: 'active',
        }),
        queryClient.refetchQueries({
          queryKey: availableQueryKey,
          type: 'active',
        }),
      ])
        .then(() => props.onBootstrapRefresh?.())
        .then(() => {
          setNavigationRefreshState({
            severity: 'success',
            message:
              variables.action === 'activate'
                ? `${updatedModule.displayName} is activated. Axis navigation was refreshed from the BackOffice bootstrap contract.`
                : variables.action === 'rollback'
                  ? `${updatedModule.displayName} activation was rolled back. Imported data was retained and Axis navigation was refreshed from the BackOffice bootstrap contract.`
                  : variables.action === 'deactivate'
                    ? `${updatedModule.displayName} is deactivated. Axis navigation was refreshed from the BackOffice bootstrap contract.`
                    : variables.action === 'register'
                      ? `${updatedModule.displayName} is registered. Registry data is refreshed; activate it when required data is ready.`
                      : `${updatedModule.displayName} is deregistered. Registry data and Axis navigation were refreshed.`,
          });
        })
        .catch((error: unknown) => {
          setNavigationRefreshState({
            severity: 'warning',
            message:
              error instanceof Error
                ? `Lifecycle completed, but Axis could not refresh navigation automatically: ${error.message}`
                : 'Lifecycle completed, but Axis could not refresh navigation automatically.',
          });
        });
    },
    onError: async () => {
      setNavigationRefreshState(undefined);
      await queryClient.invalidateQueries({ queryKey: registryQueryRoot });
    },
  });
  const sampleData = useMutation({
    mutationFn: async (module: FunctionalModuleRegistration) => {
      const importConnection = selectSampleDataConnection(props.bootstrap, module);
      if (!importConnection) throw new Error('Import service is unavailable');
      return installFunctionalModuleSampleData(importConnection, module, configuration);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [...registryQueryRoot, 'registered', configuration.projectCode],
        }),
        queryClient.invalidateQueries({
          queryKey: ['import-catalogue', props.runtime.enterpriseCode],
        }),
      ]);
    },
  });
  const registered = useMemo(
    () => sortedModules(registeredModules.data ?? []),
    [registeredModules.data],
  );
  const required = useMemo(
    () => registered.filter((module) => module.required),
    [registered],
  );
  const optional = useMemo(
    () => registered.filter((module) => !module.required),
    [registered],
  );
  const available = useMemo(
    () => sortedModules(availableModules.data ?? []),
    [availableModules.data],
  );
  const pendingModule = lifecycle.isPending
    ? lifecycle.variables?.module.functionalModule
    : undefined;
  const pendingAction = lifecycle.isPending ? lifecycle.variables?.action : undefined;
  const requiredRegistered = required.length;
  const optionalRegistered = optional.length;
  const enabledRegistered = registered.filter((module) => module.enabled).length;
  const moduleVisibility = useMemo(
    () =>
      new Map(
        [...registered, ...available].map((module) => [
          module.functionalModule,
          moduleVisibilitySummary(module, props.bootstrap.navigation),
        ]),
      ),
    [available, props.bootstrap.navigation, registered],
  );
  const blockedRegistered = registered.filter(
    (module) => moduleReadiness(module) === 'Blocked',
  ).length;
  const warningRegistered = registered.filter(
    (module) => moduleReadiness(module) === 'Active with warnings',
  ).length;
  const activeRouteTotal = Array.from(moduleVisibility.values()).reduce(
    (total, visibility) => total + visibility.activeRoutes,
    0,
  );
  const requestModuleAction = (
    module: FunctionalModuleRegistration,
    action: ModuleAction,
  ) => {
    sampleData.reset();
    if (action === 'rollback' || action === 'deactivate' || action === 'deregister') {
      setSafetyConfirmation({ action, module });
      return;
    }
    lifecycle.mutate({ action, module });
  };

  if (!connection) {
    return (
      <WorkspaceContainer>
        <Alert severity="error">BackOffice connection is unavailable.</Alert>
      </WorkspaceContainer>
    );
  }

  const loading = registeredModules.isPending || availableModules.isPending;
  const loadError =
    registeredModules.error instanceof Error
      ? registeredModules.error
      : availableModules.error instanceof Error
        ? availableModules.error
        : undefined;
  const lifecycleError = lifecycle.error instanceof Error ? lifecycle.error : undefined;
  const sampleDataError =
    sampleData.error instanceof Error ? sampleData.error : undefined;

  return (
    <WorkspaceContainer>
      <WorkspaceHeading
        description={`Project ${configuration.projectCode} module lifecycle from BackOffice authority.`}
        help={props.routeNavigation?.help}
        title="Module Registry"
      />

      <Stack spacing={3}>
        {lifecycle.isError ? (
          <Alert severity="error">
            {lifecycle.variables
              ? `${lifecycle.variables.module.displayName}: ${
                  lifecycleError?.message ?? 'Module lifecycle request failed'
                }`
              : (lifecycleError?.message ?? 'Module lifecycle request failed')}
          </Alert>
        ) : null}
        {sampleData.isError ? (
          <Alert severity="error">
            {sampleData.variables
              ? `${sampleData.variables.displayName}: ${
                  sampleDataError?.message ?? 'Sample data request failed'
                }`
              : (sampleDataError?.message ?? 'Sample data request failed')}
          </Alert>
        ) : null}
        {sampleData.isSuccess ? (
          <Alert severity="success">
            Sample data request completed for {String(sampleData.data.releaseCount)}{' '}
            release(s).
          </Alert>
        ) : null}
        {navigationRefreshState ? (
          <Alert severity={navigationRefreshState.severity}>
            {navigationRefreshState.message}
          </Alert>
        ) : null}
        {loading ? (
          <Stack sx={{ alignItems: 'center', py: 4 }}>
            <CircularProgress aria-label="Loading functional-module registry" />
          </Stack>
        ) : loadError ? (
          <Alert severity="error">{loadError.message}</Alert>
        ) : (
          <Stack spacing={2}>
            <Card variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden' }}>
              <CardContent
                sx={{
                  '&:last-child': { pb: 1.5 },
                  background: (theme) =>
                    `linear-gradient(135deg, ${alpha(
                      theme.palette.primary.main,
                      theme.palette.mode === 'light' ? 0.14 : 0.2,
                    )} 0%, ${alpha(theme.palette.background.paper, 0)} 62%)`,
                  borderRadius: 1,
                  pb: 1.5,
                  px: 2,
                  pt: 1.5,
                }}
              >
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.25}
                  sx={{
                    alignItems: { md: 'center' },
                    justifyContent: 'space-between',
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      component="h2"
                      sx={{ fontSize: '1.18rem', fontWeight: 800, lineHeight: 1.2 }}
                      variant="h6"
                    >
                      Registry control center
                    </Typography>
                    <Typography
                      color="text.secondary"
                      sx={{ fontSize: '0.86rem', lineHeight: 1.25, mt: 0.25 }}
                      variant="body2"
                    >
                      Register available capabilities, activate what this project needs,
                      and keep Axis navigation current.
                    </Typography>
                  </Box>
                  <Button
                    onClick={() => {
                      void navigate('/setup-accelerators');
                    }}
                    size="small"
                    startIcon={<ShellIcon fontSize="small" name="automation" />}
                    sx={{ flexShrink: 0, minHeight: 34 }}
                    variant="outlined"
                  >
                    Setup & Accelerators
                  </Button>
                </Stack>
                <Grid container spacing={1} sx={{ mt: 1.25 }}>
                  <Grid size={{ xs: 6, md: 2.4 }}>
                    <RegistryMetric
                      label="Enabled"
                      tone="success"
                      value={String(enabledRegistered)}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 2.4 }}>
                    <RegistryMetric
                      label="Required"
                      value={String(requiredRegistered)}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 2.4 }}>
                    <RegistryMetric
                      label="Optional"
                      value={String(optionalRegistered)}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 2.4 }}>
                    <RegistryMetric
                      label="Available"
                      tone={available.length > 0 ? 'warning' : 'success'}
                      value={String(available.length)}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 2.4 }}>
                    <RegistryMetric
                      label="Visible routes"
                      tone={activeRouteTotal > 0 ? 'info' : 'default'}
                      value={String(activeRouteTotal)}
                    />
                  </Grid>
                </Grid>
                {blockedRegistered > 0 || warningRegistered > 0 ? (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    {String(blockedRegistered)} blocked and {String(warningRegistered)}{' '}
                    warning module(s) need attention.
                  </Alert>
                ) : null}
              </CardContent>
            </Card>

            <Box>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography component="h2" variant="h5">
                    Required modules
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Protected foundation modules for this project.
                  </Typography>
                </Box>
                <Chip label={`${String(required.length)} required`} />
              </Stack>
              <Stack spacing={2} sx={{ mt: 2 }}>
                {required.length === 0 ? (
                  <Alert severity="warning">
                    No required functional modules were returned for this project.
                  </Alert>
                ) : (
                  required.map((module) => (
                    <ModuleCard
                      key={module.functionalModule}
                      disabled={
                        lifecycle.isPending && pendingModule === module.functionalModule
                      }
                      module={module}
                      pendingAction={
                        pendingModule === module.functionalModule
                          ? pendingAction
                          : undefined
                      }
                      pendingSampleData={
                        sampleData.isPending &&
                        sampleData.variables.functionalModule ===
                          module.functionalModule
                      }
                      sampleDataDisabled={
                        !selectSampleDataConnection(props.bootstrap, module)
                      }
                      visibility={
                        moduleVisibility.get(module.functionalModule) ?? {
                          activeRoutes: 0,
                          hiddenRoutes: 0,
                          unavailableRoutes: 0,
                        }
                      }
                      onAction={requestModuleAction}
                      onSampleData={(nextModule) => {
                        lifecycle.reset();
                        sampleData.mutate(nextModule);
                      }}
                    />
                  ))
                )}
              </Stack>
            </Box>

            <Box>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography component="h2" variant="h5">
                    Optional registered modules
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Project capabilities selected for operators.
                  </Typography>
                </Box>
                <Chip label={`${String(optional.length)} optional registered`} />
              </Stack>
              <Stack spacing={2} sx={{ mt: 2 }}>
                {optional.length === 0 ? (
                  <Alert severity="info">
                    No optional functional modules are registered yet.
                  </Alert>
                ) : (
                  optional.map((module) => (
                    <ModuleCard
                      key={module.functionalModule}
                      disabled={
                        lifecycle.isPending && pendingModule === module.functionalModule
                      }
                      module={module}
                      pendingAction={
                        pendingModule === module.functionalModule
                          ? pendingAction
                          : undefined
                      }
                      pendingSampleData={
                        sampleData.isPending &&
                        sampleData.variables.functionalModule ===
                          module.functionalModule
                      }
                      sampleDataDisabled={
                        !selectSampleDataConnection(props.bootstrap, module)
                      }
                      visibility={
                        moduleVisibility.get(module.functionalModule) ?? {
                          activeRoutes: 0,
                          hiddenRoutes: 0,
                          unavailableRoutes: 0,
                        }
                      }
                      onAction={requestModuleAction}
                      onSampleData={(nextModule) => {
                        lifecycle.reset();
                        sampleData.mutate(nextModule);
                      }}
                    />
                  ))
                )}
              </Stack>
            </Box>

            <Box>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography component="h2" variant="h5">
                    Available to register
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Runtime-observed capabilities not yet added to this project.
                  </Typography>
                </Box>
                <Chip label={`${available.length} available`} />
              </Stack>
              <Stack spacing={2} sx={{ mt: 2 }}>
                {available.length === 0 ? (
                  <Alert severity="success">
                    No unregistered functional modules are waiting for registration.
                  </Alert>
                ) : (
                  available.map((module) => (
                    <ModuleCard
                      key={module.functionalModule}
                      disabled={
                        lifecycle.isPending && pendingModule === module.functionalModule
                      }
                      module={module}
                      pendingAction={
                        pendingModule === module.functionalModule
                          ? pendingAction
                          : undefined
                      }
                      pendingSampleData={
                        sampleData.isPending &&
                        sampleData.variables.functionalModule ===
                          module.functionalModule
                      }
                      sampleDataDisabled={
                        !selectSampleDataConnection(props.bootstrap, module)
                      }
                      visibility={
                        moduleVisibility.get(module.functionalModule) ?? {
                          activeRoutes: 0,
                          hiddenRoutes: 0,
                          unavailableRoutes: 0,
                        }
                      }
                      onAction={requestModuleAction}
                      onSampleData={(nextModule) => {
                        lifecycle.reset();
                        sampleData.mutate(nextModule);
                      }}
                    />
                  ))
                )}
              </Stack>
            </Box>
          </Stack>
        )}
      </Stack>
      <Dialog
        fullWidth
        maxWidth="sm"
        open={Boolean(safetyConfirmation)}
        onClose={() => setSafetyConfirmation(undefined)}
      >
        <DialogTitle>
          Confirm module {safetyConfirmation?.action ?? 'lifecycle'} safety
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              {safetyConfirmation?.module.displayName ?? 'This module'} may lose Axis
              navigation entries, feature cards, and capability routes after this
              lifecycle action. Backend registry and bootstrap remain authoritative.
            </Alert>
            {[
              'Check there are no active operators depending on this capability.',
              'Confirm required framework modules are not being changed.',
              'Review Online/publication impact separately when module data is live.',
              'After completion, verify the refreshed Axis navigation and module list.',
            ].map((rule) => (
              <Typography color="text.secondary" key={rule} variant="body2">
                {rule}
              </Typography>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSafetyConfirmation(undefined)}>Cancel</Button>
          <Button
            color={safetyConfirmation?.action === 'deregister' ? 'error' : 'warning'}
            disabled={lifecycle.isPending || !safetyConfirmation}
            variant="contained"
            onClick={() => {
              if (!safetyConfirmation) return;
              lifecycle.mutate({
                action: safetyConfirmation.action,
                module: safetyConfirmation.module,
              });
              setSafetyConfirmation(undefined);
            }}
          >
            Confirm {safetyConfirmation?.action ?? 'action'}
          </Button>
        </DialogActions>
      </Dialog>
    </WorkspaceContainer>
  );
}
