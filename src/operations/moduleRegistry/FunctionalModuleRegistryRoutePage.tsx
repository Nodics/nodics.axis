import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
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
  return [...modules].sort((left, right) =>
    left.functionalModule.localeCompare(right.functionalModule),
  );
}

const registryQueryRoot = ['functional-module-registry'] as const;
type ModuleAction = FunctionalModuleLifecycleAction | 'preview';
type SampleDataAction = 'sampleData';
type ModuleReadiness = 'Blocked' | 'Ready to activate' | 'Active' | 'Active with warnings';

function moduleReadiness(module: FunctionalModuleRegistration): ModuleReadiness {
  if (module.registrationState !== 'REGISTERED') return 'Ready to activate';
  if (!module.enabled && module.runtimeState !== 'ACTIVE') return 'Blocked';
  if (module.enabled && module.runtimeState === 'DEGRADED') return 'Active with warnings';
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
  if (module.required) return 'Protected framework module';
  if (module.registrationState === 'AVAILABLE') return 'Register before activation';
  if (module.enabled) return 'Activated for Axis presentation';
  if (module.activationData?.packages.length === 0) {
    return 'Activate capabilities; no required data import is declared';
  }
  return 'Activate capabilities; required data imports through nImport first';
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
}

function receiptSeverity(
  status: string,
): 'success' | 'warning' | 'error' | 'info' {
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
    <Stack spacing={1}>
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
      {activationData.preflight.dependencies.length > 0 ? (
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
            Activation package preview
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
                        <Typography key={pack.code} variant="caption">
                          {friendlyCodeLabel(pack.code)} ·{' '}
                          {dataTypeLabel(pack.dataType)} ·{' '}
                          {pack.trigger || 'SYSTEM'}
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
            Activation data receipts
          </Typography>
          {activationData.receipts.map((receipt) => (
            <Alert
              key={receipt.receiptKey}
              severity={receiptSeverity(receipt.status)}
            >
              <strong>{friendlyCodeLabel(receipt.code)}</strong> ·{' '}
              {classificationLabel(receipt.classification)} ·{' '}
              {dataTypeLabel(receipt.dataType)} ·{' '}
              {receiptStatusLabel(receipt.status)}
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
        <Alert severity="info">
          No activation data is required for this module.
        </Alert>
      )}
      {activationData.nextActions.length > 0 ? (
        <Typography color="text.secondary" variant="caption">
          Next actions: {activationData.nextActions.join(', ')}
        </Typography>
      ) : null}
    </Stack>
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
}: ModuleCardProps) {
  const [technicalExpanded, setTechnicalExpanded] = useState(false);
  const isRegistered = module.registrationState === 'REGISTERED';
  const canRegister = module.registrationState === 'AVAILABLE';
  const canActivate =
    isRegistered && !module.enabled && module.runtimeState === 'ACTIVE';
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
  const blockedReasonCount = activationData?.preflight.blockedReasons.length ?? 0;
  const visibleTechnicalModules = technicalExpanded
    ? module.technicalModules
    : module.technicalModules.slice(0, 8);
  const remainingTechnicalModules =
    module.technicalModules.length - visibleTechnicalModules.length;
  const hasSampleData = canRequestSampleData(module);

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor:
          readiness === 'Blocked'
            ? 'error.light'
            : readiness === 'Active with warnings'
              ? 'warning.light'
              : readiness === 'Active'
                ? 'success.light'
                : 'divider',
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ justifyContent: 'space-between' }}
          >
            <Box>
              <Typography component="h3" variant="h6">
                {module.displayName}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {module.functionalModule}
                {module.registeredVersion ? ` · v${module.registeredVersion}` : ''}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip
                color={stateColor(module.registrationState)}
                label={module.registrationState}
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
              />
              <Chip
                color={readinessColor(readiness)}
                label={readiness}
                size="small"
                variant="outlined"
              />
              {module.required ? (
                <Chip color="default" label="Required" size="small" />
              ) : null}
            </Stack>
          </Stack>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography color="text.secondary" variant="caption">
                Catalogue revision
              </Typography>
              <Typography>{module.catalogueRevision}</Typography>
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
          </Grid>

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
                  onClick={() => setTechnicalExpanded((expanded) => !expanded)}
                  size="small"
                  variant="text"
                >
                  {technicalExpanded
                    ? 'Hide technical modules'
                    : `Show ${String(remainingTechnicalModules)} more`}
                </Button>
              ) : null}
            </Stack>
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography color="text.secondary" variant="caption">
                Activation mode
              </Typography>
              <Typography>{activationMode(module)}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography color="text.secondary" variant="caption">
                Impact preview
              </Typography>
              <Typography>
                {String(impactCount)} runtime and technical signals available
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography color="text.secondary" variant="caption">
                Data receipts
              </Typography>
              <Typography>
                {activationData
                  ? `${String(activationData.receipts.length)} receipts`
                  : 'Preview available'}
              </Typography>
            </Grid>
          </Grid>

          <Card
            variant="outlined"
            sx={{ bgcolor: 'background.default', borderStyle: 'dashed' }}
          >
            <CardContent>
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  sx={{ justifyContent: 'space-between' }}
                >
                  <Box>
                    <Typography component="h4" variant="subtitle1">
                      Activation dependency preview
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      Review required data, optional sample data, runtime dependencies,
                      and blockers before enabling module capabilities.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
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
                    {blockedReasonCount > 0 ? (
                      <Chip
                        color="error"
                        label={`${String(blockedReasonCount)} blocker(s)`}
                        size="small"
                      />
                    ) : (
                      <Chip color="success" label="No blockers" size="small" />
                    )}
                  </Stack>
                </Stack>
                <Alert severity={requiredPackageCount > 0 ? 'warning' : 'info'}>
                  Required init/core data belongs to activation. Sample data remains a
                  user-triggered action so demo records do not become hidden production
                  dependencies.
                </Alert>
              </Stack>
            </CardContent>
          </Card>

          <ActivationDataPanel activationData={activationData} />

          <Alert severity={canActivate ? 'warning' : module.enabled ? 'success' : 'info'}>
            {canActivate
              ? activationData?.packages.length === 0
                ? 'Activation enables Axis presentation for this module. No required data package is declared, so nImport does not need to run first.'
                : 'Preview shows declared required/core/sample packages before activation. Activation imports required data through the existing nImport data-release executor before enabling Axis capabilities.'
              : module.enabled
                ? 'Navigation and workspaces become visible only through the refreshed backend bootstrap after activation.'
                : 'Preflight uses current registry data: runtime state, observed servers, protected-module rules, and catalogue revision.'}
          </Alert>

          <Divider />

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {canRegister ? (
              <Button
                disabled={disabled || pending}
                onClick={() => onAction(module, 'register')}
                variant="contained"
              >
                {pendingAction === 'register' ? 'Registering…' : 'Register'}
              </Button>
            ) : null}
            {isRegistered && !module.enabled ? (
              <Button
                disabled={disabled || pending}
                onClick={() => onAction(module, 'preview')}
                variant="outlined"
              >
                {pendingAction === 'preview' ? 'Previewing...' : 'Preview activation'}
              </Button>
            ) : null}
            {canActivate ? (
              <Button
                disabled={disabled || pending}
                onClick={() => onAction(module, 'activate')}
                variant="contained"
              >
                {pendingAction === 'activate'
                  ? 'Activating...'
                  : 'Activate capabilities'}
              </Button>
            ) : null}
            {canDeactivate ? (
              <Button
                color="warning"
                disabled={disabled || pending}
                onClick={() => onAction(module, 'deactivate')}
                variant="outlined"
              >
                {pendingAction === 'deactivate' ? 'Deactivating…' : 'Deactivate'}
              </Button>
            ) : null}
            {canDeregister ? (
              <Button
                color="error"
                disabled={disabled || pending}
                onClick={() => onAction(module, 'deregister')}
                variant="outlined"
              >
                {pendingAction === 'deregister' ? 'Deregistering…' : 'Deregister'}
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
                {pendingSampleData ? 'Importing sample data...' : 'Import sample data'}
              </Button>
            ) : null}
            {hasSampleData && sampleDataDisabled ? (
              <Alert severity="info" sx={{ flex: 1, py: 0 }}>
                Sample data is declared, but no active data-import runtime is available
                for this module target.
              </Alert>
            ) : null}
            {module.required ? (
              <Alert severity="info" sx={{ flex: 1, py: 0 }}>
                Required framework modules cannot be deactivated or deregistered.
              </Alert>
            ) : null}
            {isRegistered && !module.enabled && module.runtimeState !== 'ACTIVE' ? (
              <Alert severity="warning" sx={{ flex: 1, py: 0 }}>
                Activation is blocked until a compatible runtime server is active.
              </Alert>
            ) : null}
          </Stack>
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
    onSuccess: (updatedModule, variables) => {
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
      void Promise.all([
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
  });
  const sampleData = useMutation({
    mutationFn: async (module: FunctionalModuleRegistration) => {
      const importConnection = selectSampleDataConnection(props.bootstrap, module);
      if (!importConnection) throw new Error('Import service is unavailable');
      return installFunctionalModuleSampleData(
        importConnection,
        module,
        configuration,
      );
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
  const lifecycleError =
    lifecycle.error instanceof Error ? lifecycle.error : undefined;
  const sampleDataError =
    sampleData.error instanceof Error ? sampleData.error : undefined;

  return (
    <WorkspaceContainer>
      <WorkspaceHeading
        description={`Project ${configuration.projectCode} functional-module lifecycle is governed by BackOffice.`}
        help={props.routeNavigation?.help}
        title="Module Registry"
      />

      <Stack spacing={3}>
        <Alert severity="info">
          Axis only shows modules reported by BackOffice for this project. Runtime
          availability comes from live module registration; registration state is
          persisted by BackOffice.
        </Alert>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography component="h2" variant="h5">
                  Activation journey
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Use this page as the operator control point for module
                  registration, capability activation, bootstrap refresh, and the
                  required-data receipt workflow backed by nImport data-release
                  execution.
                </Typography>
              </Box>
              <Grid container spacing={1}>
                {[
                  'Check runtime availability',
                  'Register optional module',
                  'Preview capabilities and technical modules',
                  'Import required data through nImport receipts',
                  'Activate Axis presentation',
                  'Refresh navigation from backend bootstrap',
                  'Optional sample data: user-triggered only',
                ].map((step, index) => (
                  <Grid key={step} size={{ xs: 12, md: 6, lg: 4 }}>
                    <Chip
                      label={`${String(index + 1)}. ${step}`}
                      sx={{ justifyContent: 'flex-start', width: '100%' }}
                      variant="outlined"
                    />
                  </Grid>
                ))}
              </Grid>
              <Box>
                <Button
                  onClick={() => navigate('/setup-accelerators')}
                  size="small"
                  variant="outlined"
                >
                  Continue to Setup & Accelerators
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
        {lifecycle.isError ? (
          <Alert severity="error">
            {lifecycle.variables
              ? `${lifecycle.variables.module.displayName}: ${
                  lifecycleError?.message ?? 'Module lifecycle request failed'
                }`
              : lifecycleError?.message ?? 'Module lifecycle request failed'}
          </Alert>
        ) : null}
        {sampleData.isError ? (
          <Alert severity="error">
            {sampleData.variables
              ? `${sampleData.variables.displayName}: ${
                  sampleDataError?.message ?? 'Sample data request failed'
                }`
              : sampleDataError?.message ?? 'Sample data request failed'}
          </Alert>
        ) : null}
        {sampleData.isSuccess ? (
          <Alert severity="success">
            Sample data request completed for {String(sampleData.data.releaseCount)} release(s).
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
          <Stack spacing={4}>
            <Card variant="outlined">
              <CardContent>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  sx={{
                    alignItems: { md: 'center' },
                    justifyContent: 'space-between',
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography component="h2" variant="h5">
                      Project module lifecycle
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      Register makes an observed optional module part of the project
                      catalogue. Activation imports required data through existing
                      nImport receipts before Axis presents the module capability.
                      Optional sample-data opt-in remains separate and user-triggered.
                      Deregister returns an optional module to the available list.
                    </Typography>
                  </Box>
                  <Box
                    aria-label="Module lifecycle summary"
                    sx={{
                      alignSelf: { md: 'center' },
                      display: 'grid',
                      flexShrink: 0,
                      gap: 1,
                      gridTemplateColumns: {
                        xs: 'repeat(2, minmax(0, max-content))',
                        md: 'repeat(4, max-content)',
                      },
                      justifyContent: { xs: 'start', md: 'end' },
                    }}
                  >
                    <Chip
                      color="success"
                      label={`${String(enabledRegistered)} enabled`}
                    />
                    <Chip
                      label={`${String(requiredRegistered)} required`}
                      variant="outlined"
                    />
                    <Chip
                      label={`${String(optionalRegistered)} optional`}
                      variant="outlined"
                    />
                    <Chip
                      color="warning"
                      label={`${String(available.length)} waiting`}
                    />
                  </Box>
                </Stack>
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
                    Framework prerequisites that are automatically registered and cannot
                    be deactivated or deregistered.
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
                        sampleData.variables.functionalModule === module.functionalModule
                      }
                      sampleDataDisabled={
                        !selectSampleDataConnection(props.bootstrap, module)
                      }
                      onAction={(nextModule, action) => {
                        sampleData.reset();
                        lifecycle.mutate({ action, module: nextModule });
                      }}
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
                    Modules selected for this project. Activation controls whether Axis
                      presents their business capabilities.
                      Required activation data imports through nImport before the
                      module is enabled. Optional sample-data import remains a
                      separate user-triggered journey.
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
                        sampleData.variables.functionalModule === module.functionalModule
                      }
                      sampleDataDisabled={
                        !selectSampleDataConnection(props.bootstrap, module)
                      }
                      onAction={(nextModule, action) => {
                        sampleData.reset();
                        lifecycle.mutate({ action, module: nextModule });
                      }}
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
                    Live optional functional modules observed by runtime servers but not
                    yet registered into the project.
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
                        sampleData.variables.functionalModule === module.functionalModule
                      }
                      sampleDataDisabled={
                        !selectSampleDataConnection(props.bootstrap, module)
                      }
                      onAction={(nextModule, action) => {
                        sampleData.reset();
                        lifecycle.mutate({ action, module: nextModule });
                      }}
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
    </WorkspaceContainer>
  );
}
