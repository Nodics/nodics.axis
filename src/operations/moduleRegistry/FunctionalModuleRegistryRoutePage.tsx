import {
  onlineManager,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMemo, useState, useSyncExternalStore } from 'react';
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
import {
  CapabilityReadinessPanel,
  type CapabilityReadinessBlocker,
  type CapabilityReadinessSummary,
} from '../readiness/CapabilityReadinessPanel';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  applyFunctionalModuleSelection,
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

/** Uses existing browser/query connectivity evidence, not runtime health authority. */
function registryBrowserOnline() {
  return (
    onlineManager.isOnline() &&
    (typeof navigator === 'undefined' || navigator.onLine !== false)
  );
}

/** Keeps cached registry presentation synchronized with connectivity changes. */
function subscribeRegistryConnectivity(listener: () => void) {
  const unsubscribe = onlineManager.subscribe(listener);
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    unsubscribe();
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
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
  const remaining = [...modules].sort((left, right) => {
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
  const ordered: FunctionalModuleRegistration[] = [];
  // Order only declared, present prerequisites. Cycles retain catalogue order.
  while (remaining.length > 0) {
    const pendingCodes = new Set(remaining.map((module) => module.functionalModule));
    const next = remaining.findIndex((module) =>
      (module.activationData?.preflight.dependencies ?? []).every(
        (dependency) => !pendingCodes.has(dependency),
      ),
    );
    if (next === -1) {
      ordered.push(...remaining);
      break;
    }
    ordered.push(...remaining.splice(next, 1));
  }
  return ordered;
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

type SmokeSeverity = 'info' | 'warning' | 'error';

interface RuntimeSmokeIssue {
  readonly code: string;
  readonly severity: SmokeSeverity;
  readonly title: string;
  readonly detail: string;
  readonly action: string;
}

interface RuntimeSmokeReadiness {
  readonly status: 'READY' | 'WARNING' | 'BLOCKED';
  readonly activeRuntimeCount: number;
  readonly importRuntimeCount: number;
  readonly processRuntimeAvailable: boolean;
  readonly issueCount: number;
  readonly issues: readonly RuntimeSmokeIssue[];
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
  if (module.registrationState === 'AVAILABLE') return 'Ready to enable';
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

function allActiveConnections(
  bootstrap: AxisAuthenticatedBootstrap,
): readonly AxisModuleConnection[] {
  return Object.freeze(
    Object.values(bootstrap.moduleConnections)
      .flatMap((connections) => [...connections])
      .filter(
        (connection) => connection.state === 'UP' || connection.state === 'DEGRADED',
      ),
  );
}

function runtimeSmokeSeverity(
  issues: readonly RuntimeSmokeIssue[],
): RuntimeSmokeReadiness['status'] {
  if (issues.some((issue) => issue.severity === 'error')) return 'BLOCKED';
  if (issues.some((issue) => issue.severity === 'warning')) return 'WARNING';
  return 'READY';
}

function runtimeSmokeReadiness(
  bootstrap: AxisAuthenticatedBootstrap,
  modules: readonly FunctionalModuleRegistration[],
): RuntimeSmokeReadiness {
  const activeRuntimeConnections = allActiveConnections(bootstrap);
  const activeServers = new Set(
    activeRuntimeConnections
      .map((connection) => connection.server)
      .filter((server): server is string => Boolean(server)),
  );
  const importConnections = activeConnections(bootstrap.moduleConnections.import);
  const processRuntimeAvailable = activeRuntimeConnections.some(
    (connection) =>
      connection.server === 'processServer' ||
      connection.runtimeRole?.code === 'PROCESS',
  );
  const issues: RuntimeSmokeIssue[] = [];
  if (activeRuntimeConnections.length === 0) {
    issues.push({
      code: 'NO_RUNTIME_CONNECTIONS',
      severity: 'error',
      title: 'No backend runtime connections are visible',
      detail: 'Axis bootstrap did not receive any active runtime lease.',
      action: 'Start the local runtime servers and refresh Axis bootstrap.',
    });
  }
  if (importConnections.length === 0) {
    issues.push({
      code: 'IMPORT_RUNTIME_UNAVAILABLE',
      severity: 'error',
      title: 'Data import runtime is unavailable',
      detail: 'Registry activation and data preparation cannot install releases.',
      action: 'Start a runtime exposing nImport and refresh Module Registry.',
    });
  }
  if (!processRuntimeAvailable) {
    issues.push({
      code: 'PROCESS_RUNTIME_UNAVAILABLE',
      severity: 'warning',
      title: 'Process approval runtime is unavailable',
      detail: 'Publishing approvals may not create or resolve governed Process tasks.',
      action:
        'Start processServer before approving Nexus, Agora, Circa, or docs publishing.',
    });
  }
  modules
    .filter((module) => module.enabled || module.registrationState === 'REGISTERED')
    .forEach((module) => {
      if (module.runtimeState !== 'ACTIVE') {
        issues.push({
          code: `MODULE_RUNTIME_${module.functionalModule}`,
          severity: module.enabled ? 'error' : 'warning',
          title: `${module.displayName} runtime is ${module.runtimeState.toLowerCase()}`,
          detail:
            module.observedServers.length > 0
              ? `Observed server(s): ${module.observedServers.join(', ')}.`
              : 'No runtime server has reported this module.',
          action:
            'Start the owning runtime server or refresh module registration after startup.',
        });
      } else if (module.observedServers.length === 0) {
        issues.push({
          code: `MODULE_NO_SERVER_${module.functionalModule}`,
          severity: 'warning',
          title: `${module.displayName} has no observed runtime server`,
          detail: 'The module is registered but Axis cannot show where it is running.',
          action: 'Refresh the module registry after all local servers have booted.',
        });
      }
      const missingTargetServers = [
        ...new Set(
          (module.activationData?.packages ?? [])
            .map((pack) => pack.targetServer)
            .filter((server) => server && !activeServers.has(server)),
        ),
      ];
      missingTargetServers.forEach((server) => {
        issues.push({
          code: `PACKAGE_TARGET_${module.functionalModule}_${server}`,
          severity: 'warning',
          title: `${module.displayName} data target is not visible`,
          detail: `Data package target server ${server} is not in active bootstrap connections.`,
          action: `Start ${server} or repair the release target mapping before importing this capability.`,
        });
      });
    });
  return Object.freeze({
    status: runtimeSmokeSeverity(issues),
    activeRuntimeCount: activeRuntimeConnections.length,
    importRuntimeCount: importConnections.length,
    processRuntimeAvailable,
    issueCount: issues.length,
    issues: Object.freeze(issues),
  });
}

function moduleCapabilityReadiness(
  module: FunctionalModuleRegistration,
): CapabilityReadinessSummary {
  const blockers: CapabilityReadinessBlocker[] = [];
  if (module.runtimeState !== 'ACTIVE') {
    blockers.push({
      blockerCode: `MODULE_RUNTIME_${module.functionalModule}`,
      code: 'RUNTIME_UNAVAILABLE',
      severity: module.enabled ? 'BLOCKED' : 'WARNING',
      owner: module.functionalModule,
      ownerType: 'MODULE_REGISTRY',
      source: 'RUNTIME_HEARTBEAT',
      message:
        module.observedServers.length > 0
          ? `Observed server(s): ${module.observedServers.join(', ')}.`
          : 'No runtime server has reported this module.',
      action: 'Start or repair target runtime',
      disabledReason:
        'The module is registered in Axis, but runtime heartbeat evidence is missing or not active.',
      technicalStatus: module.runtimeState,
      repair: {
        available: false,
        label: 'Restore target runtime',
        operation: 'runtimeTopology.restoreRuntime',
        action: 'RESTORE_RUNTIME',
        idempotent: true,
        requiresConfirmation: true,
        eligibility: 'NOT_AVAILABLE',
        unavailableReason:
          'The owning runtime must start and register heartbeat evidence.',
      },
    });
  } else if (module.observedServers.length === 0) {
    blockers.push({
      blockerCode: `MODULE_NO_SERVER_${module.functionalModule}`,
      code: 'RUNTIME_OWNER_UNLOCATED',
      severity: 'WARNING',
      owner: module.functionalModule,
      ownerType: 'MODULE_REGISTRY',
      source: 'RUNTIME_HEARTBEAT',
      message: 'The module is active but Axis cannot show which server owns it.',
      action: 'Refresh runtime registration',
      disabledReason: 'The runtime is active, but owner/server evidence is incomplete.',
      technicalStatus: module.runtimeState,
      repair: {
        available: false,
        label: 'Refresh runtime registration',
        operation: 'runtimeTopology.refreshRegistration',
        action: 'REFRESH_RUNTIME_REGISTRATION',
        idempotent: true,
        requiresConfirmation: false,
        eligibility: 'NOT_AVAILABLE',
        unavailableReason:
          'Runtime registration is backend-owned and refreshed by heartbeat.',
      },
    });
  }
  (module.activationData?.preflight.dependencyStates ?? [])
    .filter((dependency) => !dependency.satisfied)
    .forEach((dependency) => {
      blockers.push({
        blockerCode: `MODULE_DEPENDENCY_${module.functionalModule}_${dependency.functionalModule}`,
        code: 'MISSING_DEPENDENCY',
        severity: 'BLOCKED',
        owner: dependency.functionalModule,
        ownerType: 'MODULE_REGISTRY',
        source: 'MODULE_REGISTRY',
        message:
          dependency.reason ||
          `${dependency.displayName} must be registered, active, and enabled first.`,
        action: dependency.resolution || 'Prepare required dependency',
        disabledReason: 'A required framework or accelerator capability is not ready.',
        technicalStatus: dependency.runtimeState,
        repair: {
          available: false,
          label: dependency.resolution || 'Prepare required dependency',
          operation: 'moduleRegistry.prepareDependency',
          action: 'PREPARE_DEPENDENCY',
          idempotent: true,
          requiresConfirmation: true,
          eligibility: 'NOT_AVAILABLE',
          unavailableReason:
            'Register and activate the dependency from Module Registry.',
        },
      });
    });
  (module.activationData?.preflight.blockedReasons ?? []).forEach((reason, index) => {
    blockers.push({
      blockerCode: `MODULE_BLOCKED_${module.functionalModule}_${String(index + 1)}`,
      code: 'MODULE_ACTIVATION_BLOCKED',
      severity: 'BLOCKED',
      owner: module.functionalModule,
      ownerType: 'MODULE_REGISTRY',
      source: 'ACTIVATION_PREFLIGHT',
      message: reason,
      action: 'Review module activation preflight',
      disabledReason: 'Module activation preflight reported a blocking condition.',
      technicalStatus: module.activationData?.readiness,
    });
  });
  return {
    capabilityCode: module.functionalModule,
    displayName: module.displayName,
    owningModule: module.functionalModule,
    capabilityType: 'FUNCTIONAL_MODULE',
    group: 'MODULE_REGISTRY',
    businessStatus:
      blockers.length > 0
        ? blockers.some((blocker) => blocker.severity === 'BLOCKED')
          ? 'NEEDS_ATTENTION'
          : 'ACTIVE_WITH_WARNINGS'
        : module.enabled
          ? 'ONLINE'
          : 'NOT_ACTIVE',
    technicalStatus: module.runtimeState,
    releaseStatus: module.registrationState,
    lastEvaluatedAt: module.lastObservedAt,
    source: 'backoffice.functionalModuleRegistry',
    stale: false,
    disabledReason: blockers[0]?.disabledReason,
    nextAction: blockers[0]?.action ?? 'Monitor module readiness',
    blockers,
  };
}

function runtimeCardHint(module: FunctionalModuleRegistration): string | undefined {
  if (module.runtimeState === 'ACTIVE' && module.observedServers.length > 0) {
    return undefined;
  }
  if (module.registrationState !== 'REGISTERED') {
    return 'Enable this capability before expecting runtime heartbeat evidence.';
  }
  if (!module.enabled) {
    return 'Activate this registered module, then refresh bootstrap after the owning runtime reports heartbeat evidence.';
  }
  if (module.runtimeState === 'ACTIVE') {
    return 'Runtime is active, but server ownership evidence is missing. Refresh Module Registry after all servers boot.';
  }
  return 'Start the owning runtime server, verify heartbeat evidence, then refresh Axis bootstrap.';
}

function runtimeServerSummary(module: FunctionalModuleRegistration): string {
  const observationCount = Math.max(
    module.runtimeObservations.length,
    module.observedServers.length,
  );
  if (observationCount > 0) return `${String(observationCount)} observed`;
  if (module.runtimeState === 'ACTIVE') return 'Active, unlocated';
  if (module.registrationState !== 'REGISTERED') return 'Not registered';
  if (!module.enabled) return 'Not activated';
  return 'No heartbeat';
}

function runtimeObservationTitle(
  observation: FunctionalModuleRegistration['runtimeObservations'][number],
): string {
  return (
    [observation.server, observation.node ? `node ${observation.node}` : undefined]
      .filter(Boolean)
      .join(' · ') || observation.observedServer
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
  readonly onEnableCapability: (module: FunctionalModuleRegistration) => void;
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

function RuntimeSmokeReadinessCard({
  readiness,
  cached = false,
}: {
  readonly readiness: RuntimeSmokeReadiness;
  readonly cached?: boolean;
}) {
  const tone = cached
    ? 'warning'
    : readiness.status === 'READY'
      ? 'success'
      : readiness.status === 'BLOCKED'
        ? 'error'
        : 'warning';
  return (
    <Card
      component="section"
      variant="outlined"
      sx={(theme) => ({
        borderColor: alpha(theme.palette[tone].main, 0.34),
        borderRadius: 1,
        overflow: 'hidden',
      })}
    >
      <CardContent
        sx={(theme) => ({
          '&:last-child': { pb: 1.5 },
          bgcolor: alpha(theme.palette[tone].main, 0.055),
          pb: 1.5,
          px: 2,
          py: 1.5,
        })}
      >
        <Stack spacing={1.25}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            sx={{
              alignItems: { md: 'center' },
              gap: 1,
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography component="h2" variant="h6">
                Runtime smoke readiness
              </Typography>
              <Typography color="text.secondary" variant="body2">
                Server startup, internal module communication, data import, and approval
                dependencies for local validation.
              </Typography>
            </Box>
            <Chip
              color={tone}
              label={cached ? `Cached ${readiness.status}` : readiness.status}
              variant="filled"
            />
          </Stack>
          <Grid container spacing={1}>
            <Grid size={{ xs: 6, md: 3 }}>
              <RegistryMetric
                label="Active runtimes"
                tone={readiness.activeRuntimeCount > 0 ? 'success' : 'error'}
                value={String(readiness.activeRuntimeCount)}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <RegistryMetric
                label="Import runtimes"
                tone={readiness.importRuntimeCount > 0 ? 'success' : 'error'}
                value={String(readiness.importRuntimeCount)}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <RegistryMetric
                label="Process"
                tone={readiness.processRuntimeAvailable ? 'success' : 'warning'}
                value={`${cached ? 'Cached: ' : ''}${readiness.processRuntimeAvailable ? 'Ready' : 'Missing'}`}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <RegistryMetric
                label={cached ? 'Cached issues' : 'Issues'}
                tone={!cached && readiness.issueCount === 0 ? 'success' : tone}
                value={String(readiness.issueCount)}
              />
            </Grid>
          </Grid>
          {readiness.issues.length > 0 ? (
            <Stack spacing={1}>
              {readiness.issues.slice(0, 6).map((issue) => (
                <Alert
                  key={issue.code}
                  severity={issue.severity}
                  sx={{ alignItems: 'flex-start' }}
                >
                  <Typography sx={{ fontWeight: 800 }} variant="body2">
                    {issue.title}
                  </Typography>
                  <Typography variant="body2">{issue.detail}</Typography>
                  <Typography sx={{ mt: 0.35 }} variant="caption">
                    Fix: {issue.action}
                  </Typography>
                </Alert>
              ))}
              {readiness.issues.length > 6 ? (
                <Typography color="text.secondary" variant="caption">
                  {String(readiness.issues.length - 6)} more issue(s) are listed on the
                  related module cards.
                </Typography>
              ) : null}
            </Stack>
          ) : (
            <Alert severity="success">
              Runtime bootstrap, import runtime, and Process approval signals are
              available for local smoke validation.
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function ModuleCard({
  disabled,
  module,
  onAction,
  onEnableCapability,
  onSampleData,
  pendingAction,
  pendingSampleData,
  sampleDataDisabled,
  visibility,
}: ModuleCardProps) {
  const [expanded, setExpanded] = useState(true);
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
  const capabilityReadiness = moduleCapabilityReadiness(module);
  const runtimeObservationCount = Math.max(
    module.runtimeObservations.length,
    module.observedServers.length,
  );
  const runtimeHint = runtimeCardHint(module);
  const serverSummary = runtimeServerSummary(module);
  const serverMetricTone =
    module.runtimeState !== 'ACTIVE'
      ? 'warning'
      : runtimeObservationCount > 0
        ? 'success'
        : 'warning';
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
        ? 'Enabling...'
        : 'Enable'
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
                    (primaryAction === 'register' &&
                      (module.runtimeState !== 'ACTIVE' ||
                        missingDependencyCount > 0)) ||
                    (primaryAction === 'preview' && !isRegistered)
                  }
                  onClick={() =>
                    primaryAction === 'register'
                      ? onEnableCapability(module)
                      : onAction(module, primaryAction)
                  }
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
                tone={serverMetricTone}
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

          {runtimeHint ? (
            <Alert severity={module.runtimeState === 'ACTIVE' ? 'warning' : 'info'}>
              {runtimeHint}
            </Alert>
          ) : null}

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
              {capabilityReadiness.blockers.length ? (
                <CapabilityReadinessPanel readiness={capabilityReadiness} />
              ) : null}
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
                    {runtimeObservationCount > 0
                      ? module.runtimeObservations
                          .map((observation) => runtimeObservationTitle(observation))
                          .join(', ') || module.observedServers.join(', ')
                      : 'No heartbeat observed'}
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

              {module.runtimeObservations.length > 0 ? (
                <Box>
                  <Typography color="text.secondary" sx={{ mb: 1 }} variant="caption">
                    Runtime observations
                  </Typography>
                  <Grid container spacing={1}>
                    {module.runtimeObservations.map((observation) => (
                      <Grid key={observation.observedServer} size={{ xs: 12, md: 6 }}>
                        <Alert severity="success" sx={{ height: '100%' }}>
                          <Typography sx={{ fontWeight: 800 }} variant="body2">
                            {runtimeObservationTitle(observation)}
                          </Typography>
                          <Typography color="text.secondary" variant="caption">
                            {[
                              observation.environment,
                              observation.lastObservedAt
                                ? `seen ${formatTime(observation.lastObservedAt)}`
                                : undefined,
                              observation.reasonCode,
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Runtime heartbeat observed'}
                          </Typography>
                          {observation.recoveryAction ? (
                            <Typography color="text.secondary" variant="caption">
                              {observation.recoveryAction}
                            </Typography>
                          ) : null}
                        </Alert>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ) : null}

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
  const [search, setSearch] = useState('');
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [detailModuleCode, setDetailModuleCode] = useState<string>();
  const [selectedAvailableModules, setSelectedAvailableModules] = useState<
    readonly string[]
  >([]);
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
  const browserOnline = useSyncExternalStore(
    subscribeRegistryConnectivity,
    registryBrowserOnline,
    () => true,
  );
  const ownerAvailable =
    Boolean(connection) &&
    browserOnline &&
    (!props.routeNavigation ||
      ['UP', 'DEGRADED'].includes(props.routeNavigation.availability));
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
    enabled: ownerAvailable,
    staleTime: 0,
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
    enabled: ownerAvailable,
    staleTime: 0,
    queryKey: [...registryQueryRoot, 'available', configuration.projectCode],
    queryFn: () => {
      if (!connection) throw new Error('BackOffice is unavailable');
      return loadAvailableFunctionalModules(connection, configuration);
    },
    refetchOnWindowFocus: true,
  });
  const currentRegistry =
    ownerAvailable &&
    registeredModules.isSuccess &&
    availableModules.isSuccess &&
    !registeredModules.isFetching &&
    !availableModules.isFetching;
  const assertCurrentRegistry = () => {
    if (!currentRegistry || !registryBrowserOnline())
      throw new Error('Registry status is unavailable. This action was not sent.');
  };
  const selection = useMutation({
    onMutate: () => setNavigationRefreshState(undefined),
    mutationFn: async (modules: readonly FunctionalModuleRegistration[]) => {
      assertCurrentRegistry();
      if (!connection) throw new Error('BackOffice is unavailable');
      return applyFunctionalModuleSelection(
        connection,
        modules.map((module) => ({
          functionalModule: module.functionalModule,
          expectedRevision: module.catalogueRevision,
          selected: true,
        })),
        configuration,
      );
    },
    onSuccess: async (result) => {
      setSelectedAvailableModules([]);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [...registryQueryRoot, 'registered', configuration.projectCode],
        }),
        queryClient.invalidateQueries({
          queryKey: [...registryQueryRoot, 'available', configuration.projectCode],
        }),
      ])
        .then(() => props.onBootstrapRefresh?.())
        .then(() => {
          setNavigationRefreshState({
            severity: 'success',
            message: `${String(result.applied)} capability change(s) applied. Axis navigation was refreshed from the BackOffice bootstrap contract.`,
          });
        })
        .catch((error: unknown) => {
          setNavigationRefreshState({
            severity: 'warning',
            message:
              error instanceof Error
                ? `Capability selection completed, but Axis could not refresh navigation automatically: ${error.message}`
                : 'Capability selection completed, but Axis could not refresh navigation automatically.',
          });
        });
    },
    onError: async () => {
      setNavigationRefreshState(undefined);
      await queryClient.invalidateQueries({ queryKey: registryQueryRoot });
    },
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
      assertCurrentRegistry();
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
      assertCurrentRegistry();
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
  const available = useMemo(
    () => sortedModules(availableModules.data ?? []),
    [availableModules.data],
  );
  const enableCandidates = useMemo(
    () =>
      [...registered, ...available].filter(
        (module) =>
          !module.required &&
          !(module.registrationState === 'REGISTERED' && module.enabled),
      ),
    [registered, available],
  );
  const readyAvailable = useMemo(
    () =>
      enableCandidates.filter(
        (module) =>
          module.runtimeState === 'ACTIVE' &&
          (module.activationData?.preflight.missingDependencies.length ?? 0) === 0,
      ),
    [enableCandidates],
  );
  const selectedAvailable = useMemo(
    () =>
      readyAvailable.filter((module) =>
        selectedAvailableModules.includes(module.functionalModule),
      ),
    [readyAvailable, selectedAvailableModules],
  );
  const pendingModule = lifecycle.isPending
    ? lifecycle.variables?.module.functionalModule
    : undefined;
  const pendingAction = lifecycle.isPending ? lifecycle.variables?.action : undefined;
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
  const allModules = sortedModules([...registered, ...available]);
  const visibleModules = allModules.filter((module) =>
    `${module.displayName} ${module.functionalModule}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const moduleGroups = [
    {
      title: 'Registered and activated',
      modules: visibleModules.filter(
        (module) => module.registrationState === 'REGISTERED' && module.enabled,
      ),
    },
    {
      title: 'Pending',
      modules: visibleModules.filter(
        (module) => !(module.registrationState === 'REGISTERED' && module.enabled),
      ),
    },
  ];
  const detailModule = allModules.find(
    (module) => module.functionalModule === detailModuleCode,
  );
  const visibleReadyModules = readyAvailable.filter((module) =>
    visibleModules.some(
      (visible) => visible.functionalModule === module.functionalModule,
    ),
  );
  const busy =
    !currentRegistry ||
    selection.isPending ||
    lifecycle.isPending ||
    sampleData.isPending;
  const smokeReadiness = useMemo(
    () => runtimeSmokeReadiness(props.bootstrap, registered),
    [props.bootstrap, registered],
  );
  const requestModuleAction = (
    module: FunctionalModuleRegistration,
    action: ModuleAction,
  ) => {
    if (!currentRegistry || !registryBrowserOnline()) return;
    sampleData.reset();
    if (action === 'rollback' || action === 'deactivate' || action === 'deregister') {
      setSafetyConfirmation({ action, module });
      return;
    }
    lifecycle.mutate({ action, module });
  };
  const requestCapabilitySelection = (
    modules: readonly FunctionalModuleRegistration[],
  ) => {
    if (!currentRegistry || !registryBrowserOnline()) return;
    lifecycle.reset();
    sampleData.reset();
    selection.mutate(modules);
  };

  if (
    !connection &&
    registeredModules.data === undefined &&
    availableModules.data === undefined
  ) {
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
  const selectionError = selection.error instanceof Error ? selection.error : undefined;
  const sampleDataError =
    sampleData.error instanceof Error ? sampleData.error : undefined;

  return (
    <WorkspaceContainer>
      <WorkspaceHeading
        description={configuration.projectCode}
        help={props.routeNavigation?.help}
        title="Module Registry"
      />

      <Stack spacing={3}>
        {!currentRegistry ? (
          <Alert severity="warning">
            {!browserOnline
              ? 'Axis is offline.'
              : ownerAvailable &&
                  (registeredModules.isFetching || availableModules.isFetching)
                ? 'Checking registry status.'
                : 'Registry status is unavailable.'}{' '}
            Cached registry observations are not current runtime health. Actions are
            unavailable until status refreshes.
          </Alert>
        ) : null}
        {loadError ? <Alert severity="error">{loadError.message}</Alert> : null}
        {lifecycle.isError ? (
          <Alert severity="error">
            {lifecycle.variables
              ? `${lifecycle.variables.module.displayName}: ${
                  lifecycleError?.message ?? 'Module lifecycle request failed'
                }`
              : (lifecycleError?.message ?? 'Module lifecycle request failed')}
          </Alert>
        ) : null}
        {selection.isError ? (
          <Alert severity="error">
            {selectionError?.message ?? 'Capability selection request failed'}
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
        {loading && ownerAvailable ? (
          <Stack sx={{ alignItems: 'center', py: 4 }}>
            <CircularProgress aria-label="Loading functional-module registry" />
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Box
              aria-label="Registry overview"
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(4, minmax(0, 1fr))',
                },
                borderTop: '1px solid',
                borderBottom: '1px solid',
                borderColor: 'divider',
                py: 2,
                gap: 2,
              }}
            >
              {[
                {
                  label: 'Activated',
                  value: enabledRegistered,
                  detail: `${required.length} required modules`,
                  color: 'success.main',
                },
                {
                  label: 'Pending',
                  value: allModules.length - enabledRegistered,
                  detail: 'Not yet enabled',
                  color: 'text.primary',
                },
                {
                  label: currentRegistry ? 'Ready to enable' : 'Cached ready to enable',
                  value: readyAvailable.length,
                  detail: currentRegistry
                    ? 'Runtime and prerequisites ready'
                    : 'Last reported readiness',
                  color: 'info.main',
                },
                {
                  label: 'Runtime issues',
                  value: currentRegistry ? smokeReadiness.issueCount : 'Unknown',
                  detail: currentRegistry
                    ? 'Reported by runtime health'
                    : `Last reported: ${smokeReadiness.issueCount}`,
                  color:
                    !currentRegistry || smokeReadiness.issueCount
                      ? 'warning.dark'
                      : 'success.main',
                },
              ].map((metric) => (
                <Box
                  key={metric.label}
                  sx={{
                    px: 2,
                    borderLeft: '2px solid',
                    borderColor: metric.color,
                    minWidth: 0,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {metric.label}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '1.75rem',
                      lineHeight: 1.4,
                      fontWeight: 700,
                      color: metric.color,
                    }}
                  >
                    {metric.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {metric.detail}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
            >
              <TextField
                label="Search modules"
                value={search}
                size="small"
                onChange={(event) => setSearch(event.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <ShellIcon name="search" fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  width: { xs: '100%', sm: 320 },
                  maxWidth: '100%',
                  bgcolor: 'background.paper',
                }}
              />
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  color="inherit"
                  variant="outlined"
                  onClick={() => setDiagnosticsOpen((open) => !open)}
                  aria-expanded={diagnosticsOpen}
                  aria-controls="registry-diagnostics"
                >
                  Runtime health
                  {smokeReadiness.issueCount > 0
                    ? ` (${smokeReadiness.issueCount})`
                    : ''}
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  endIcon={<ShellIcon name="chevron-right" fontSize="small" />}
                  onClick={() => {
                    void navigate('/setup-accelerators');
                  }}
                >
                  Setup & Accelerators
                </Button>
              </Stack>
            </Stack>
            <Collapse in={diagnosticsOpen} unmountOnExit id="registry-diagnostics">
              <RuntimeSmokeReadinessCard
                readiness={smokeReadiness}
                cached={!currentRegistry}
              />
            </Collapse>
            <Box>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                sx={{
                  py: 1,
                  px: 2,
                  bgcolor: 'background.paper',
                  borderTop: '1px solid',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  alignItems: { sm: 'center' },
                  justifyContent: 'space-between',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }} aria-live="polite">
                  {selectedAvailable.length
                    ? `${selectedAvailable.length} module${selectedAvailable.length === 1 ? '' : 's'} selected`
                    : `${currentRegistry ? '' : 'Last reported: '}${visibleReadyModules.length} module${visibleReadyModules.length === 1 ? '' : 's'} ready to enable`}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}
                >
                  <Button
                    size="small"
                    color="inherit"
                    disabled={visibleReadyModules.length === 0 || busy}
                    onClick={() =>
                      setSelectedAvailableModules((selected) => [
                        ...new Set([
                          ...selected,
                          ...visibleReadyModules.map(
                            (module) => module.functionalModule,
                          ),
                        ]),
                      ])
                    }
                  >
                    Select ready
                  </Button>
                  <Button
                    size="small"
                    color="inherit"
                    disabled={selectedAvailableModules.length === 0 || busy}
                    onClick={() => setSelectedAvailableModules([])}
                  >
                    Clear
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={selectedAvailable.length === 0 || busy}
                    onClick={() => requestCapabilitySelection(selectedAvailable)}
                    startIcon={
                      selection.isPending ? (
                        <CircularProgress color="inherit" size={16} />
                      ) : (
                        <ShellIcon fontSize="small" name="approve" />
                      )
                    }
                  >
                    {selection.isPending
                      ? 'Applying...'
                      : `Enable selected (${selectedAvailable.length})`}
                  </Button>
                </Stack>
              </Stack>
              {moduleGroups.map((group) => (
                <Box component="section" key={group.title} sx={{ mt: 2 }}>
                  <Typography
                    component="h2"
                    variant="subtitle1"
                    sx={{
                      fontWeight: 700,
                      py: 1.5,
                      px: 2,
                      borderLeft: '3px solid',
                      borderColor:
                        group.title === 'Pending' ? 'info.main' : 'success.main',
                      color: 'text.primary',
                      bgcolor: (theme) =>
                        alpha(
                          group.title === 'Pending'
                            ? theme.palette.info.main
                            : theme.palette.success.main,
                          0.08,
                        ),
                      fontSize: '1.125rem',
                    }}
                  >
                    {group.title} ({group.modules.length})
                  </Typography>
                  <Box
                    sx={{
                      display: { xs: 'none', md: 'grid' },
                      gridTemplateColumns:
                        '40px minmax(0, 1fr) minmax(0, 1fr) 160px 40px',
                      gap: 1.5,
                      px: 2,
                      py: 1,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box />
                    {['Module', 'Runtime & prerequisites', 'Activation'].map(
                      (label) => (
                        <Typography
                          key={label}
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontWeight: 700 }}
                        >
                          {label}
                        </Typography>
                      ),
                    )}
                  </Box>
                  <Box
                    component="ul"
                    aria-label={group.title}
                    sx={{
                      listStyle: 'none',
                      m: 0,
                      p: 0,
                      borderTop: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {group.modules.map((module) => {
                      const enabled =
                        module.registrationState === 'REGISTERED' && module.enabled;
                      const selectable = readyAvailable.some(
                        (item) => item.functionalModule === module.functionalModule,
                      );
                      const checked = selectedAvailableModules.includes(
                        module.functionalModule,
                      );
                      const needsAttention =
                        module.runtimeState !== 'ACTIVE' ||
                        (module.activationData?.preflight.missingDependencies.length ??
                          0) > 0;
                      const missingDependencies =
                        module.activationData?.preflight.missingDependencies ?? [];
                      const dependencies =
                        module.activationData?.preflight.dependencies ?? [];
                      const dependencyNames = (codes: readonly string[]) =>
                        codes
                          .map(
                            (code) =>
                              allModules.find((item) => item.functionalModule === code)
                                ?.displayName ?? code,
                          )
                          .join(', ');
                      return (
                        <Box
                          component="li"
                          key={module.functionalModule}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                              xs: '40px minmax(0, 1fr) 40px',
                              md: '40px minmax(0, 1fr) minmax(0, 1fr) 160px 40px',
                            },
                            alignItems: 'center',
                            gap: 1.5,
                            py: 1.5,
                            px: 2,
                            '&:hover': { bgcolor: 'action.hover' },
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            bgcolor: checked ? 'action.selected' : 'background.paper',
                          }}
                        >
                          <Checkbox
                            checked={enabled || checked}
                            disabled={!selectable || busy}
                            slotProps={{
                              input: { 'aria-label': `Select ${module.displayName}` },
                            }}
                            onChange={(event) =>
                              setSelectedAvailableModules((selected) =>
                                event.target.checked
                                  ? [
                                      ...selected.filter(
                                        (code) => code !== module.functionalModule,
                                      ),
                                      module.functionalModule,
                                    ]
                                  : selected.filter(
                                      (code) => code !== module.functionalModule,
                                    ),
                              )
                            }
                          />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
                            >
                              {module.displayName}
                            </Typography>
                            {module.required ? (
                              <Typography variant="caption" color="text.secondary">
                                Required
                              </Typography>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                {module.technicalModules.length} technical modules
                              </Typography>
                            )}
                          </Box>
                          <Box
                            sx={{
                              minWidth: 0,
                              gridColumn: { xs: 2, md: 'auto' },
                              gridRow: { xs: 2, md: 'auto' },
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ alignItems: 'center' }}
                            >
                              <Box
                                aria-hidden
                                sx={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: '50%',
                                  flexShrink: 0,
                                  bgcolor:
                                    currentRegistry && module.runtimeState === 'ACTIVE'
                                      ? 'success.main'
                                      : 'warning.main',
                                }}
                              />
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {!currentRegistry ? 'Cached: ' : ''}
                                {module.runtimeState === 'ACTIVE'
                                  ? 'Runtime connected'
                                  : `Runtime: ${module.runtimeState.toLowerCase()}`}
                              </Typography>
                            </Stack>
                            <Typography
                              variant="caption"
                              color={
                                missingDependencies.length
                                  ? 'warning.dark'
                                  : 'text.secondary'
                              }
                              sx={{
                                display: 'block',
                                mt: 0.5,
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {missingDependencies.length
                                ? `Requires: ${dependencyNames(missingDependencies)}`
                                : dependencies.length
                                  ? `Depends on: ${dependencyNames(dependencies)}`
                                  : module.activationData
                                    ? 'No prerequisites'
                                    : 'Prerequisites not reported'}
                            </Typography>
                          </Box>
                          <Stack
                            spacing={0.5}
                            sx={{
                              gridColumn: { xs: 2, md: 'auto' },
                              gridRow: { xs: 3, md: 'auto' },
                              alignItems: 'flex-start',
                            }}
                          >
                            <Chip
                              size="small"
                              variant="filled"
                              color={
                                enabled ? 'success' : selectable ? 'info' : 'default'
                              }
                              sx={(theme) => ({
                                borderRadius: 1,
                                fontWeight: 600,
                                bgcolor: alpha(
                                  enabled
                                    ? theme.palette.success.main
                                    : selectable
                                      ? theme.palette.info.main
                                      : theme.palette.text.secondary,
                                  0.1,
                                ),
                                color: enabled
                                  ? 'success.dark'
                                  : selectable
                                    ? 'info.dark'
                                    : 'text.secondary',
                              })}
                              label={
                                enabled
                                  ? 'Enabled'
                                  : selectable
                                    ? currentRegistry
                                      ? 'Ready to enable'
                                      : 'Cached: Ready to enable'
                                    : 'Not enabled'
                              }
                            />
                            {needsAttention ? (
                              <Typography variant="caption" color="warning.dark">
                                {module.runtimeState !== 'ACTIVE'
                                  ? 'Runtime needs attention'
                                  : 'Prerequisites missing'}
                              </Typography>
                            ) : null}
                          </Stack>
                          <Tooltip title={`Details for ${module.displayName}`}>
                            <IconButton
                              aria-label={`Details for ${module.displayName}`}
                              onClick={() =>
                                setDetailModuleCode(module.functionalModule)
                              }
                              sx={{
                                gridColumn: { xs: 3, md: 'auto' },
                                gridRow: { xs: 1, md: 'auto' },
                              }}
                            >
                              <ShellIcon name="chevron-right" fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      );
                    })}
                  </Box>
                  {group.modules.length === 0 ? (
                    <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>
                      {search.trim()
                        ? 'No matching modules.'
                        : group.title === 'Pending'
                          ? 'No pending modules.'
                          : 'No modules activated yet.'}
                    </Typography>
                  ) : null}
                </Box>
              ))}
              {visibleModules.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 3 }}>
                  No modules found.
                </Typography>
              ) : null}
            </Box>
          </Stack>
        )}
      </Stack>
      <Drawer
        anchor="right"
        open={Boolean(detailModule)}
        onClose={() => setDetailModuleCode(undefined)}
        slotProps={{
          paper: { sx: { width: { xs: '100%', md: 760 }, maxWidth: '100%', p: 2 } },
        }}
      >
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
        >
          <Typography component="h2" variant="h6">
            Module details
          </Typography>
          <IconButton
            aria-label="Close module details"
            onClick={() => setDetailModuleCode(undefined)}
          >
            <ShellIcon name="close" />
          </IconButton>
        </Stack>
        {detailModule ? (
          <>
            {!currentRegistry ? (
              <Alert severity="warning">
                Cached module observations. Current runtime status is unavailable.
              </Alert>
            ) : null}
            <ModuleCard
              key={detailModule.functionalModule}
              module={detailModule}
              disabled={busy}
              pendingAction={
                pendingModule === detailModule.functionalModule
                  ? pendingAction
                  : undefined
              }
              pendingSampleData={
                sampleData.isPending &&
                sampleData.variables.functionalModule === detailModule.functionalModule
              }
              sampleDataDisabled={
                !selectSampleDataConnection(props.bootstrap, detailModule)
              }
              visibility={
                moduleVisibility.get(detailModule.functionalModule) ?? {
                  activeRoutes: 0,
                  hiddenRoutes: 0,
                  unavailableRoutes: 0,
                }
              }
              onAction={requestModuleAction}
              onEnableCapability={(module) => requestCapabilitySelection([module])}
              onSampleData={(module) => {
                lifecycle.reset();
                sampleData.mutate(module);
              }}
            />
          </>
        ) : null}
      </Drawer>
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
            disabled={busy || !safetyConfirmation}
            variant="contained"
            onClick={() => {
              if (!safetyConfirmation || !currentRegistry || !registryBrowserOnline())
                return;
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
