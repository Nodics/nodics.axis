import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { loadModuleHealthDetail } from '../moduleHealth/api/moduleHealthClient';
import {
  activeConnections,
  connectionKey,
  dashboardCardPadding,
  dashboardComponentGap,
  dashboardContentGap,
  loadWorkbenchMetrics,
  metricsById,
  totalMetricValue,
  totalReadyMetrics,
  type WorkbenchMetric,
  type WorkbenchMetricDefinition,
} from '../shared/workbenchMetricDashboardModel';
import { DashboardSection } from '../shared/WorkbenchMetricDashboard';

interface CronDashboardRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}

interface CronDashboardData {
  readonly healthyInstances: number;
  readonly metrics: readonly WorkbenchMetric[];
  readonly runtimeInstances: number;
}

const cronMetrics: readonly WorkbenchMetricDefinition[] = Object.freeze([
  Object.freeze({
    id: 'cron-jobs',
    label: 'Cron jobs',
    moduleName: 'cronjob',
    schemaName: 'cronJob',
    description:
      'Persisted job definitions owned by the Cron module and executed by the active automation runtime.',
    route: '/cron/jobs',
    icon: 'cronjob',
  }),
  Object.freeze({
    id: 'cron-job-logs',
    label: 'Job logs',
    moduleName: 'cronjob',
    schemaName: 'cronJobLog',
    description: 'Execution evidence and operational history for scheduled jobs.',
    route: '/cron/logs',
    icon: 'history',
  }),
]);

async function loadCronDashboardData(
  connections: ReturnType<typeof activeConnections>,
  bootstrap: AxisAuthenticatedBootstrap,
  configuration: {
    readonly accessToken: string;
    readonly enterpriseCode: string;
    readonly timeoutMs: number;
  },
): Promise<CronDashboardData> {
  const metrics = await loadWorkbenchMetrics(
    connections,
    bootstrap,
    configuration,
    cronMetrics,
  );
  const backofficeConnection = selectModuleConnection(bootstrap, 'backoffice');
  const health = backofficeConnection
    ? await loadModuleHealthDetail(
        backofficeConnection,
        'cronjob',
        configuration,
      ).catch(() => undefined)
    : undefined;
  return Object.freeze({
    healthyInstances: health?.availability.healthyInstances ?? 0,
    metrics,
    runtimeInstances: health?.availability.activeInstances ?? 0,
  });
}

export function CronDashboardRoutePage({
  accessToken,
  bootstrap,
  routeNavigation,
  runtime,
}: CronDashboardRoutePageProps) {
  const connections = useMemo(() => activeConnections(bootstrap), [bootstrap]);
  const configuration = useMemo(
    () => ({
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs],
  );
  const data = useQuery({
    queryKey: ['cron-dashboard', runtime.enterpriseCode, connectionKey(connections)],
    queryFn: () => loadCronDashboardData(connections, bootstrap, configuration),
  });
  const metrics = data.data?.metrics;
  const readyCount = totalReadyMetrics(metrics);
  const unavailableCount = (metrics?.length ?? cronMetrics.length) - readyCount;
  const totalRecords = totalMetricValue(metrics);

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
                description="Monitor scheduled job definitions, execution history, and cron runtime health without taking scheduler control actions from Axis yet."
                help={routeNavigation?.help}
                eyebrow="Automation workspace"
                headingVariant="h3"
                title="Cron Operations"
              />
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Chip color="success" label={`${String(readyCount)} live`} />
                {unavailableCount > 0 ? (
                  <Chip
                    color="warning"
                    label={`${String(unavailableCount)} unavailable`}
                    variant="outlined"
                  />
                ) : null}
                <Chip label={`${String(data.data?.runtimeInstances ?? 0)} instances`} />
                <Chip
                  color="success"
                  label={`${String(data.data?.healthyInstances ?? 0)} healthy`}
                />
              </Stack>
            </Stack>

            <Alert severity={data.isError ? 'warning' : 'info'}>
              {data.isError
                ? data.error instanceof Error
                  ? data.error.message
                  : 'Cron dashboard metrics are currently unavailable.'
                : 'Counts are loaded from authorized Cron workbench contracts. Start, stop, run, pause, and resume controls remain backend-owned action contracts for a later workflow-safe slice.'}
            </Alert>

            <Box>
              <Typography color="text.secondary" variant="body2">
                Total cron records
              </Typography>
              <Typography sx={{ fontSize: { xs: 34, md: 44 }, fontWeight: 800 }}>
                {data.isPending ? '—' : new Intl.NumberFormat().format(totalRecords)}
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <DashboardSection
          description="Job definitions and execution logs discovered from Cron-owned schemas."
          loading={data.isPending}
          metrics={metricsById(metrics, cronMetrics)}
          title="Scheduler inventory"
        />
      </Stack>
    </WorkspaceContainer>
  );
}
