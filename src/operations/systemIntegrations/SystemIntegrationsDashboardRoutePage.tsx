import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router';

import { axisTokens } from '../../app/axisTheme';
import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  loadAvailableFunctionalModules,
  loadRegisteredFunctionalModules,
} from '../moduleRegistry/api/functionalModuleRegistryClient';
import {
  loadModuleHealth,
  type ModuleHealthClientConfiguration,
} from '../moduleHealth/api/moduleHealthClient';
import {
  dashboardCardPadding,
  dashboardComponentGap,
  dashboardContentGap,
} from '../shared/workbenchMetricDashboardModel';
import { loadWorkbenchSchemas } from '../../workbench/api/workbenchClient';
import type { WorkbenchSchema } from '../../workbench/api/workbenchContracts';

interface SystemIntegrationsDashboardRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}

interface SystemDashboardData {
  readonly activeRuntimeInstances: number;
  readonly degradedModules: number;
  readonly pendingRegistrationModules: number;
  readonly registeredModules: number;
  readonly runtimeServers: readonly string[];
  readonly unhealthyRuntimeInstances: number;
}

interface SchemaDashboardData {
  readonly ownerModules: number;
  readonly readOnlySchemas: number;
  readonly schemas: readonly WorkbenchSchema[];
  readonly schemasByModule: readonly {
    readonly moduleName: string;
    readonly total: number;
  }[];
  readonly unavailableOwners: number;
  readonly writableSchemas: number;
}

const SYSTEM_ACTION_IDS = new Set([
  'registry',
  'module-health',
  'system-information',
  'module-configuration',
  'axis-configuration',
  'security-policies',
]);
const INTEGRATION_ACTION_IDS = new Set([
  'imports-exports',
  'integrations',
  'events',
  'audit-trail',
  'operational-failures',
]);

function visibleSystemItems(
  navigation: readonly AxisNavigationItem[],
): readonly AxisNavigationItem[] {
  return Object.freeze(
    navigation
      .filter(
        (item) =>
          item.id !== 'system-integrations' && item.group?.id === 'system-integrations',
      )
      .sort(
        (left, right) =>
          left.order - right.order || left.label.localeCompare(right.label),
      ),
  );
}

function MetricCard({
  detail,
  label,
  loading,
  tone = 'default',
  value,
}: {
  readonly detail: string;
  readonly label: string;
  readonly loading: boolean;
  readonly tone?: 'default' | 'success' | 'warning';
  readonly value: number | string;
}) {
  return (
    <Paper
      component="article"
      elevation={0}
      sx={{
        bgcolor: (theme) => alpha(theme.palette.background.default, 0.7),
        borderRadius: `${String(axisTokens.radius.medium)}px`,
        boxShadow: (theme) => `inset 0 0 0 1px ${theme.palette.divider}`,
        minHeight: 104,
        px: 2,
        py: 1.75,
      }}
    >
      <Stack spacing={0.35}>
        <Typography color="text.secondary" variant="caption">
          {label}
        </Typography>
        <Typography
          color={
            tone === 'success'
              ? 'success.main'
              : tone === 'warning'
                ? 'warning.main'
                : 'text.primary'
          }
          sx={{ fontSize: { xs: 26, md: 30 }, fontWeight: 750, lineHeight: 1.1 }}
        >
          {loading ? <CircularProgress size={24} /> : value}
        </Typography>
        <Typography
          color="text.secondary"
          sx={{
            display: '-webkit-box',
            overflow: 'hidden',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
          }}
          variant="caption"
        >
          {detail}
        </Typography>
      </Stack>
    </Paper>
  );
}

function WorkspaceSection({
  actions,
  children,
  description,
  icon,
  title,
}: {
  readonly actions: readonly AxisNavigationItem[];
  readonly children: React.ReactNode;
  readonly description: string;
  readonly icon: string;
  readonly title: string;
}) {
  const enabledActions = actions.filter(
    (item) =>
      (item.featureState ?? 'ACTIVE') !== 'DISABLED' &&
      item.availability !== 'UNAVAILABLE',
  );
  const plannedActions = actions.length - enabledActions.length;
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(axisTokens.radius.large)}px`,
        overflow: 'hidden',
        p: dashboardCardPadding,
      }}
    >
      <Stack spacing={dashboardContentGap}>
        <Box
          sx={{
            alignItems: { sm: 'center' },
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
            <Box
              aria-hidden
              sx={{
                alignItems: 'center',
                bgcolor: alpha(axisTokens.color.signatureGold, 0.16),
                borderRadius: `${String(axisTokens.radius.medium)}px`,
                color: 'primary.main',
                display: 'inline-flex',
                flex: '0 0 auto',
                height: 42,
                justifyContent: 'center',
                width: 42,
              }}
            >
              <ShellIcon name={icon} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5">{title}</Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 680 }} variant="body2">
                {description}
              </Typography>
            </Box>
          </Stack>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flex: '0 0 auto', flexWrap: 'wrap', gap: 0.5 }}
          >
            {enabledActions.map((item) => (
              <Button
                component={RouterLink}
                key={`${item.moduleName}:${item.id}`}
                size="small"
                to={item.route}
                variant="text"
              >
                {item.label}
              </Button>
            ))}
            {plannedActions > 0 ? (
              <Chip
                label={`${String(plannedActions)} planned`}
                size="small"
                variant="outlined"
              />
            ) : null}
          </Stack>
        </Box>
        <Divider />
        {children}
      </Stack>
    </Paper>
  );
}

function metricsGrid(minimumCardWidth: number) {
  return {
    display: 'grid',
    gap: 1,
    gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${String(minimumCardWidth)}px), 1fr))`,
  } as const;
}

async function loadSystemDashboardData(
  bootstrap: AxisAuthenticatedBootstrap,
  configuration: ModuleHealthClientConfiguration & { readonly projectCode: string },
): Promise<SystemDashboardData> {
  const backofficeConnection = bootstrap.moduleConnections.backoffice?.find((item) =>
    ['UP', 'DEGRADED'].includes(item.state),
  );
  if (!backofficeConnection) throw new Error('BackOffice connection is unavailable');
  const [health, registered, available] = await Promise.all([
    loadModuleHealth(backofficeConnection, configuration),
    loadRegisteredFunctionalModules(backofficeConnection, configuration),
    loadAvailableFunctionalModules(backofficeConnection, configuration),
  ]);
  const runtimeServers = new Set<string>();
  const registeredIdentities = new Set(
    registered
      .filter((module) => module.registrationState === 'REGISTERED')
      .map((module) => module.functionalModule),
  );
  let activeRuntimeInstances = 0;
  let unhealthyRuntimeInstances = 0;
  health.forEach((module) => {
    module.servers.forEach((server) => runtimeServers.add(server));
    activeRuntimeInstances += module.availability.activeInstances;
    unhealthyRuntimeInstances +=
      module.availability.unavailableInstances + module.availability.unknownInstances;
  });
  return Object.freeze({
    activeRuntimeInstances,
    degradedModules: health.filter((module) => module.availability.state === 'DEGRADED')
      .length,
    pendingRegistrationModules: available.filter(
      (module) => !registeredIdentities.has(module.functionalModule),
    ).length,
    registeredModules: registeredIdentities.size,
    runtimeServers: Object.freeze([...runtimeServers].sort()),
    unhealthyRuntimeInstances,
  });
}

async function loadSchemaDashboardData(
  bootstrap: AxisAuthenticatedBootstrap,
  configuration: ModuleHealthClientConfiguration,
): Promise<SchemaDashboardData> {
  const connections = Object.values(bootstrap.moduleConnections)
    .flatMap((items) => [...items])
    .filter((connection) => ['UP', 'DEGRADED'].includes(connection.state));
  const discovered = await loadWorkbenchSchemas(connections, configuration);
  const uniqueSchemas = new Map<string, WorkbenchSchema>();
  discovered.forEach((schema) => {
    const key = `${schema.moduleName}:${schema.schemaName}`;
    if (!uniqueSchemas.has(key)) uniqueSchemas.set(key, schema);
  });
  const schemas = Object.freeze([...uniqueSchemas.values()]);
  const moduleCounts = new Map<string, number>();
  schemas.forEach((schema) => {
    moduleCounts.set(schema.moduleName, (moduleCounts.get(schema.moduleName) ?? 0) + 1);
  });
  const schemasByModule = Object.freeze(
    [...moduleCounts.entries()]
      .map(([moduleName, total]) => Object.freeze({ moduleName, total }))
      .sort(
        (left, right) =>
          right.total - left.total || left.moduleName.localeCompare(right.moduleName),
      ),
  );
  const writableSchemas = schemas.filter(
    (schema) =>
      schema.mutationMode === 'GENERATED_CRUD' &&
      schema.operations.some((operation) =>
        ['create', 'update', 'delete'].includes(operation),
      ),
  ).length;
  const unavailableOwners = new Set(
    Object.values(bootstrap.moduleConnections)
      .flatMap((items) => [...items])
      .filter((connection) => ['UNAVAILABLE', 'UNKNOWN'].includes(connection.state))
      .map((connection) => connection.moduleName),
  ).size;
  return Object.freeze({
    ownerModules: moduleCounts.size,
    readOnlySchemas: schemas.length - writableSchemas,
    schemas,
    schemasByModule,
    unavailableOwners,
    writableSchemas,
  });
}

export function SystemIntegrationsDashboardRoutePage({
  accessToken,
  bootstrap,
  routeNavigation,
  runtime,
}: SystemIntegrationsDashboardRoutePageProps) {
  const items = visibleSystemItems(bootstrap.navigation);
  const systemActions = items.filter((item) => SYSTEM_ACTION_IDS.has(item.id));
  const integrationActions = items.filter((item) =>
    INTEGRATION_ACTION_IDS.has(item.id),
  );
  const schemaActions = items.filter((item) => item.id === 'schema-workbench');
  const configuration = useMemo(
    () => ({
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      projectCode: runtime.projectCode,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [
      accessToken,
      runtime.enterpriseCode,
      runtime.projectCode,
      runtime.requestTimeoutMs,
    ],
  );
  const connectionKey = useMemo(
    () =>
      Object.values(bootstrap.moduleConnections)
        .flatMap((connections) => connections)
        .map(
          (connection) =>
            `${connection.moduleName}:${connection.instanceId}:${connection.state}`,
        )
        .sort()
        .join('|'),
    [bootstrap.moduleConnections],
  );
  const systemDashboard = useQuery({
    queryKey: ['system-dashboard', runtime.enterpriseCode, runtime.projectCode],
    queryFn: () => loadSystemDashboardData(bootstrap, configuration),
    refetchOnWindowFocus: true,
  });
  const schemaDashboard = useQuery({
    queryKey: ['system-dashboard', 'schemas', runtime.enterpriseCode, connectionKey],
    queryFn: () => loadSchemaDashboardData(bootstrap, configuration),
    refetchOnWindowFocus: true,
  });
  const integrationActive = integrationActions.filter(
    (item) => (item.featureState ?? 'ACTIVE') === 'ACTIVE',
  ).length;
  const integrationPlanned = integrationActions.filter(
    (item) => item.featureState === 'DISABLED',
  ).length;
  const integrationAttention = integrationActions.filter((item) =>
    ['DEGRADED', 'UNAVAILABLE'].includes(item.availability),
  ).length;
  const healthAlerts =
    (systemDashboard.data?.degradedModules ?? 0) +
    (systemDashboard.data?.unhealthyRuntimeInstances ?? 0);

  return (
    <WorkspaceContainer>
      <Stack spacing={dashboardComponentGap}>
        <Paper
          component="section"
          elevation={0}
          sx={{
            background: (theme) =>
              `linear-gradient(105deg, ${alpha(axisTokens.color.signatureGold, theme.palette.mode === 'light' ? 0.09 : 0.13)} 0%, ${alpha(theme.palette.background.paper, 0)} 52%)`,
            border: 1,
            borderColor: 'divider',
            borderRadius: `${String(axisTokens.radius.large)}px`,
            p: dashboardCardPadding,
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ justifyContent: 'space-between' }}
          >
            <WorkspaceHeading
              description="Monitor runtime participation, integration operations, and authorized backend schemas from one compact BackOffice-governed overview."
              help={routeNavigation?.help}
              eyebrow="Platform operations"
              headingVariant="h3"
              title="Runtime Dashboard"
            />
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Chip color="success" label="Live registry" size="small" />
              <Chip label={runtime.projectCode} size="small" />
              <Chip label={runtime.enterpriseCode} size="small" variant="outlined" />
            </Stack>
          </Stack>
        </Paper>

        <WorkspaceSection
          actions={systemActions}
          description="Runtime participation, registration readiness, and operational health."
          icon="health"
          title="System Workspace"
        >
          {systemDashboard.isError ? (
            <Alert severity="warning">
              {systemDashboard.error instanceof Error
                ? systemDashboard.error.message
                : 'System metrics are currently unavailable.'}
            </Alert>
          ) : null}
          <Box sx={metricsGrid(280)}>
            <MetricCard
              detail={
                systemDashboard.data?.runtimeServers.join(', ') ||
                'Waiting for runtime observations'
              }
              label="Runtime servers"
              loading={systemDashboard.isPending}
              value={systemDashboard.data?.runtimeServers.length ?? '—'}
            />
            <MetricCard
              detail="Active module instances observed by BackOffice."
              label="Active module instances"
              loading={systemDashboard.isPending}
              tone="success"
              value={systemDashboard.data?.activeRuntimeInstances ?? '—'}
            />
            <MetricCard
              detail="Functional modules registered for this project."
              label="Registered modules"
              loading={systemDashboard.isPending}
              value={systemDashboard.data?.registeredModules ?? '—'}
            />
            <MetricCard
              detail="Eligible modules not yet registered for this project."
              label="Pending registration"
              loading={systemDashboard.isPending}
              tone={
                (systemDashboard.data?.pendingRegistrationModules ?? 0) > 0
                  ? 'warning'
                  : 'success'
              }
              value={systemDashboard.data?.pendingRegistrationModules ?? '—'}
            />
            <MetricCard
              detail="Degraded modules and unhealthy runtime instances."
              label="Health alerts"
              loading={systemDashboard.isPending}
              tone={healthAlerts > 0 ? 'warning' : 'success'}
              value={systemDashboard.isPending ? '—' : healthAlerts}
            />
            <MetricCard
              detail="Module owners reporting degraded availability."
              label="Degraded modules"
              loading={systemDashboard.isPending}
              tone={
                (systemDashboard.data?.degradedModules ?? 0) > 0 ? 'warning' : 'success'
              }
              value={systemDashboard.data?.degradedModules ?? '—'}
            />
          </Box>
          <Paper
            elevation={0}
            sx={(theme) => ({
              bgcolor: alpha(theme.palette.background.default, 0.7),
              border: 1,
              borderColor: 'divider',
              borderRadius: `${String(axisTokens.radius.medium)}px`,
              p: 1.5,
            })}
          >
            <Stack spacing={1.25}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
              >
                <Stack spacing={0.25}>
                  <Typography variant="subtitle1">Runtime topology</Typography>
                  <Typography color="text.secondary" variant="body2">
                    Load Balancer → Nodes. Single-server runtimes are displayed as Node
                    0 so operators have the same mental model locally and in multi-node
                    environments.
                  </Typography>
                </Stack>
                <Button
                  disabled={systemDashboard.isFetching}
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    void systemDashboard.refetch();
                  }}
                >
                  {systemDashboard.isFetching ? 'Refreshing…' : 'Refresh health'}
                </Button>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Chip color="primary" label="Load Balancer" variant="outlined" />
                {(systemDashboard.data?.runtimeServers.length
                  ? systemDashboard.data.runtimeServers
                  : ['No runtime observations yet']
                ).map((server, index) => (
                  <Chip
                    key={server}
                    label={`Node ${String(index)} · ${server}`}
                    variant="outlined"
                  />
                ))}
              </Stack>
              <Box sx={metricsGrid(210)}>
                <MetricCard
                  detail="Awaiting CPU utilization in the backend health contract."
                  label="CPU utilization"
                  loading={systemDashboard.isPending}
                  value="Not reported"
                />
                <MetricCard
                  detail="Awaiting memory utilization in the backend health contract."
                  label="Memory utilization"
                  loading={systemDashboard.isPending}
                  value="Not reported"
                />
                <MetricCard
                  detail="Awaiting thread-pool metrics in the backend health contract."
                  label="Thread overview"
                  loading={systemDashboard.isPending}
                  value="Not reported"
                />
                <MetricCard
                  detail="Awaiting task-queue metrics in the backend health contract."
                  label="Task queue overview"
                  loading={systemDashboard.isPending}
                  value="Not reported"
                />
                <MetricCard
                  detail="Awaiting database pool and ping health in the backend health contract."
                  label="Database health"
                  loading={systemDashboard.isPending}
                  value="Not reported"
                />
              </Box>
            </Stack>
          </Paper>
        </WorkspaceSection>

        <WorkspaceSection
          actions={integrationActions}
          description="Governed data movement, events, integration evidence, and failure triage."
          icon="module"
          title="Integration Workspace"
        >
          <Box sx={metricsGrid(210)}>
            <MetricCard
              detail="Authorized integration capabilities ready to open."
              label="Active capabilities"
              loading={false}
              tone="success"
              value={integrationActive}
            />
            <MetricCard
              detail="Capabilities advertised for a later implementation phase."
              label="Planned capabilities"
              loading={false}
              value={integrationPlanned}
            />
            <MetricCard
              detail="Integration owners reporting degraded or unavailable state."
              label="Needs attention"
              loading={false}
              tone={integrationAttention > 0 ? 'warning' : 'success'}
              value={integrationAttention}
            />
            <MetricCard
              detail="Imports, exports, events, audit, and failure operations in scope."
              label="Governed areas"
              loading={false}
              value={integrationActions.length}
            />
          </Box>
          {integrationPlanned > 0 ? (
            <Alert severity="info" sx={{ py: 0 }}>
              Planned capabilities remain visible as status only and cannot be opened
              until their owning modules advertise an active contract.
            </Alert>
          ) : null}
        </WorkspaceSection>

        <WorkspaceSection
          actions={schemaActions}
          description="A read-only snapshot of schemas discovered from authorized module owners."
          icon="schema"
          title="Schema Workspace"
        >
          {schemaDashboard.isError ? (
            <Alert severity="warning">
              {schemaDashboard.error instanceof Error
                ? schemaDashboard.error.message
                : 'Schema metrics are currently unavailable.'}
            </Alert>
          ) : null}
          <Box sx={metricsGrid(180)}>
            <MetricCard
              detail="Unique authorized module and schema identities."
              label="Available schemas"
              loading={schemaDashboard.isPending}
              value={schemaDashboard.data?.schemas.length ?? '—'}
            />
            <MetricCard
              detail="Modules contributing at least one discoverable schema."
              label="Owner modules"
              loading={schemaDashboard.isPending}
              value={schemaDashboard.data?.ownerModules ?? '—'}
            />
            <MetricCard
              detail="Generated CRUD schemas allowing an authorized mutation."
              label="Writable schemas"
              loading={schemaDashboard.isPending}
              tone="success"
              value={schemaDashboard.data?.writableSchemas ?? '—'}
            />
            <MetricCard
              detail="Schemas exposed for governed query and reference use."
              label="Read-only schemas"
              loading={schemaDashboard.isPending}
              value={schemaDashboard.data?.readOnlySchemas ?? '—'}
            />
            <MetricCard
              detail="Connected module owners currently unavailable or unknown."
              label="Unavailable owners"
              loading={schemaDashboard.isPending}
              tone={
                (schemaDashboard.data?.unavailableOwners ?? 0) > 0
                  ? 'warning'
                  : 'success'
              }
              value={schemaDashboard.data?.unavailableOwners ?? '—'}
            />
          </Box>
          {schemaDashboard.data?.schemasByModule.length ? (
            <Box
              sx={{
                bgcolor: (theme) => alpha(theme.palette.background.default, 0.7),
                borderRadius: `${String(axisTokens.radius.medium)}px`,
                p: 1.5,
              }}
            >
              <Typography sx={{ mb: 1 }} variant="subtitle1">
                Schemas by module
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {schemaDashboard.data.schemasByModule.slice(0, 12).map((module) => (
                  <Chip
                    key={module.moduleName}
                    label={`${module.moduleName} · ${String(module.total)}`}
                    size="small"
                    variant="outlined"
                  />
                ))}
                {schemaDashboard.data.schemasByModule.length > 12 ? (
                  <Chip
                    label={`+${String(schemaDashboard.data.schemasByModule.length - 12)} more`}
                    size="small"
                  />
                ) : null}
              </Stack>
            </Box>
          ) : null}
        </WorkspaceSection>
      </Stack>
    </WorkspaceContainer>
  );
}
