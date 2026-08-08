import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
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
  AxisNavigationFeatureState,
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

interface SystemIntegrationsDashboardRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}

interface SystemDashboardData {
  readonly activeRuntimeInstances: number;
  readonly availableModules: number;
  readonly degradedModules: number;
  readonly registeredModules: number;
  readonly runtimeServers: readonly string[];
  readonly unhealthyRuntimeInstances: number;
}

const dashboardComponentGap = `${String(axisTokens.spacing.grid)}px`;
const dashboardContentGap = `${String(axisTokens.spacing.grid * 1.5)}px`;
const dashboardCardPadding = {
  xs: `${String(axisTokens.spacing.grid * 2)}px`,
  md: `${String(axisTokens.spacing.grid * 2.5)}px`,
} as const;

function stateColor(
  state: AxisNavigationFeatureState,
): 'success' | 'warning' | 'default' {
  if (state === 'ACTIVE') return 'success';
  if (state === 'PREVIEW') return 'warning';
  return 'default';
}

function availabilityColor(
  state: AxisNavigationItem['availability'],
): 'success' | 'warning' | 'error' | 'default' {
  if (state === 'UP') return 'success';
  if (state === 'DEGRADED') return 'warning';
  if (state === 'UNAVAILABLE') return 'error';
  return 'default';
}

function availabilityLabel(state: AxisNavigationItem['availability']): string {
  if (state === 'UP') return 'Available';
  if (state === 'DEGRADED') return 'Degraded';
  if (state === 'UNAVAILABLE') return 'Unavailable';
  return 'Unknown';
}

function visibleSystemItems(
  navigation: readonly AxisNavigationItem[],
): readonly AxisNavigationItem[] {
  return Object.freeze(
    navigation
      .filter(
        (item) =>
          item.id !== 'system-integrations' &&
          (item.group?.id === 'system-integrations' ||
            item.route.startsWith('/operations/') ||
            item.route === '/registry'),
      )
      .sort(
        (left, right) =>
          left.order - right.order || left.label.localeCompare(right.label),
      ),
  );
}

function SummaryCard({
  detail,
  loading,
  label,
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
        border: 1,
        borderColor: 'divider',
        minHeight: 150,
        p: dashboardCardPadding,
      }}
    >
      <Stack spacing={1}>
        <Typography color="text.secondary" variant="body2">
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
          sx={{ fontSize: { xs: 34, md: 42 }, fontWeight: 800 }}
        >
          {loading ? <CircularProgress size={28} /> : value}
        </Typography>
        <Typography color="text.secondary">{detail}</Typography>
      </Stack>
    </Paper>
  );
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
    availableModules: available.length,
    degradedModules: health.filter((module) => module.availability.state === 'DEGRADED')
      .length,
    registeredModules: registered.length,
    runtimeServers: Object.freeze([...runtimeServers].sort()),
    unhealthyRuntimeInstances,
  });
}

function SystemCapabilityCard({ item }: { readonly item: AxisNavigationItem }) {
  const featureState = item.featureState ?? 'ACTIVE';
  const contexts = item.contexts ?? [];
  const active = featureState === 'ACTIVE' || featureState === 'PREVIEW';
  return (
    <Paper
      component="article"
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        display: 'grid',
        gap: dashboardContentGap,
        gridTemplateRows: 'auto minmax(72px, auto) auto minmax(0, 1fr) auto',
        minHeight: 300,
        p: dashboardCardPadding,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <Box
          aria-hidden
          sx={{
            alignItems: 'center',
            bgcolor: alpha(axisTokens.color.signatureGold, 0.18),
            borderRadius: axisTokens.radius.medium,
            color: 'primary.main',
            display: 'inline-flex',
            flex: '0 0 auto',
            height: 44,
            justifyContent: 'center',
            width: 44,
          }}
        >
          <ShellIcon name={item.icon ?? 'module'} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5">{item.label}</Typography>
          <Typography color="text.secondary" variant="body2">
            {item.moduleName}
          </Typography>
        </Box>
      </Stack>

      <Typography color="text.secondary">
        {item.help?.summary ??
          'This capability is advertised by BackOffice and will become executable when its owning module publishes an active workspace contract.'}
      </Typography>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Chip
          color={availabilityColor(item.availability)}
          label={availabilityLabel(item.availability)}
          size="small"
        />
        <Chip
          color={stateColor(featureState)}
          label={featureState}
          size="small"
          variant="outlined"
        />
      </Stack>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        {contexts.map((context) => (
          <Chip key={context} label={context} size="small" variant="outlined" />
        ))}
      </Stack>

      <Button
        component={active ? RouterLink : 'button'}
        disabled={!active}
        to={active ? item.route : undefined}
        variant={active ? 'contained' : 'outlined'}
      >
        {active ? `Open ${item.label}` : 'Not enabled yet'}
      </Button>
    </Paper>
  );
}

export function SystemIntegrationsDashboardRoutePage({
  accessToken,
  bootstrap,
  routeNavigation,
  runtime,
}: SystemIntegrationsDashboardRoutePageProps) {
  const items = visibleSystemItems(bootstrap.navigation);
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
  const dashboard = useQuery({
    queryKey: ['system-dashboard', runtime.enterpriseCode, runtime.projectCode],
    queryFn: () => loadSystemDashboardData(bootstrap, configuration),
    refetchOnWindowFocus: true,
  });
  const active = items.filter(
    (item) => (item.featureState ?? 'ACTIVE') === 'ACTIVE',
  ).length;
  const preview = items.filter((item) => item.featureState === 'PREVIEW').length;
  const disabled = items.length - active - preview;

  return (
    <WorkspaceContainer>
      <Stack spacing={dashboardComponentGap}>
        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'space-between' }}
            >
              <WorkspaceHeading
                description="Operate the project runtime, module registry, health checks, imports, exports, integrations, events, audit evidence, and failure triage from one BackOffice-governed hub."
                help={routeNavigation?.help}
                eyebrow="System workspace"
                headingVariant="h3"
                title="System & Integrations"
              />
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Chip label={`${String(items.length)} capabilities`} />
                <Chip color="success" label={`${String(active)} active`} />
                {preview > 0 ? (
                  <Chip color="warning" label={`${String(preview)} preview`} />
                ) : null}
                {disabled > 0 ? <Chip label={`${String(disabled)} planned`} /> : null}
              </Stack>
            </Stack>

            <Alert severity="info">
              This dashboard is generated from the authenticated BackOffice navigation
              contract. Axis is only presenting authorized capabilities; the owning
              backend modules remain the operation authority.
            </Alert>
          </Stack>
        </Paper>

        {dashboard.isError ? (
          <Alert severity="warning">
            {dashboard.error instanceof Error
              ? dashboard.error.message
              : 'System dashboard metrics are currently unavailable.'}
          </Alert>
        ) : null}

        <Box
          sx={{
            display: 'grid',
            gap: dashboardComponentGap,
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
              xl: 'repeat(4, minmax(0, 1fr))',
            },
          }}
        >
          <SummaryCard
            detail={`${dashboard.data?.runtimeServers.join(', ') || 'Waiting for runtime observations'}`}
            label="Runtime servers"
            loading={dashboard.isPending}
            value={dashboard.data?.runtimeServers.length ?? '—'}
          />
          <SummaryCard
            detail="Active runtime module instances observed by BackOffice."
            label="Runtime instances"
            loading={dashboard.isPending}
            tone="success"
            value={dashboard.data?.activeRuntimeInstances ?? '—'}
          />
          <SummaryCard
            detail={`${String(dashboard.data?.availableModules ?? 0)} optional modules are waiting for project registration.`}
            label="Registered modules"
            loading={dashboard.isPending}
            value={dashboard.data?.registeredModules ?? '—'}
          />
          <SummaryCard
            detail={`${String(dashboard.data?.degradedModules ?? 0)} degraded modules, ${String(dashboard.data?.unhealthyRuntimeInstances ?? 0)} unhealthy instances.`}
            label="Health alerts"
            loading={dashboard.isPending}
            tone={
              (dashboard.data?.degradedModules ?? 0) > 0 ||
              (dashboard.data?.unhealthyRuntimeInstances ?? 0) > 0
                ? 'warning'
                : 'success'
            }
            value={
              (dashboard.data?.degradedModules ?? 0) +
              (dashboard.data?.unhealthyRuntimeInstances ?? 0)
            }
          />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gap: dashboardComponentGap,
            gridTemplateColumns: {
              xs: '1fr',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          {items.map((item) => (
            <SystemCapabilityCard item={item} key={`${item.moduleName}:${item.id}`} />
          ))}
        </Box>
      </Stack>
    </WorkspaceContainer>
  );
}
