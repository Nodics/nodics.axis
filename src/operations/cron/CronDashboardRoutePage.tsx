import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';

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
import {
  applyCronJobAction,
  cronJobLifecycleActionPolicies,
  loadCronJobs,
  saveCronJob,
  type CronJobDefinition,
  type CronJobLifecycleAction,
} from './api/cronJobClient';

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
const cronJobsQueryKey = 'cron-jobs';

function normalizeCode(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 128);
}

function expressionOf(job: CronJobDefinition): string {
  const expression = job.trigger?.expression;
  return typeof expression === 'string' ? expression : '—';
}

function processTriggerOf(job: CronJobDefinition): string | undefined {
  const processTrigger = job.jobDetail?.processTrigger;
  if (
    typeof processTrigger === 'object' &&
    processTrigger !== null &&
    !Array.isArray(processTrigger)
  ) {
    const triggerCode = (processTrigger as Record<string, unknown>).triggerCode;
    return typeof triggerCode === 'string' ? triggerCode : undefined;
  }
  return undefined;
}

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
  const queryClient = useQueryClient();
  const connections = useMemo(() => activeConnections(bootstrap), [bootstrap]);
  const cronConnection = useMemo(
    () => selectModuleConnection(bootstrap, 'cronjob'),
    [bootstrap],
  );
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
  const jobs = useQuery({
    enabled: Boolean(cronConnection),
    queryKey: [
      cronJobsQueryKey,
      runtime.enterpriseCode,
      cronConnection?.instanceId ?? 'missing',
    ],
    queryFn: () => {
      if (!cronConnection) throw new Error('Cron runtime connection is unavailable');
      return loadCronJobs(cronConnection, configuration);
    },
  });
  const [jobCode, setJobCode] = useState('axisDemoCronJob');
  const [jobName, setJobName] = useState('Axis demo Cron job');
  const [triggerExpression, setTriggerExpression] = useState('* * * * * *');
  const [runOnNode, setRunOnNode] = useState('node0');
  const [processTriggerCode, setProcessTriggerCode] = useState('');
  const [processInstanceCode, setProcessInstanceCode] = useState('');
  const createJob = useMutation({
    mutationFn: async () => {
      if (!cronConnection) throw new Error('Cron runtime connection is unavailable');
      const code = normalizeCode(jobCode);
      if (!code) throw new Error('Cron job code is required');
      if (!triggerExpression.trim()) throw new Error('Cron expression is required');
      return saveCronJob(cronConnection, configuration, {
        code,
        active: true,
        name: jobName.trim() || code,
        description:
          'Created from Axis Cron Operations to verify governed Cron ownership.',
        runOnNode: normalizeCode(runOnNode) || 'node0',
        runOnInit: false,
        triggerExpression: triggerExpression.trim(),
        processTriggerCode: normalizeCode(processTriggerCode),
        processInstanceCode: normalizeCode(processInstanceCode),
      });
    },
    onSuccess: (created) => {
      setJobCode(created.code);
      void queryClient.invalidateQueries({ queryKey: [cronJobsQueryKey] });
      void queryClient.invalidateQueries({ queryKey: ['cron-dashboard'] });
    },
  });
  const lifecycle = useMutation({
    mutationFn: async ({
      action,
      code,
    }: {
      readonly action: CronJobLifecycleAction;
      readonly code: string;
    }) => {
      if (!cronConnection) throw new Error('Cron runtime connection is unavailable');
      await applyCronJobAction(cronConnection, configuration, code, action);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [cronJobsQueryKey] });
      void queryClient.invalidateQueries({ queryKey: ['cron-dashboard'] });
    },
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
                description="Monitor scheduled job definitions, execution evidence, runtime health, and governed scheduler actions while Cron remains the backend authority."
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
                : 'Counts and lifecycle actions are loaded from authorized Cron contracts. Axis submits requests and refreshes discovery; Cron owns scheduling, execution, retry, and job state.'}
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

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <WorkspaceHeading
              description="Create a Cron-owned job definition, then ask Cron to create, run, start, stop, pause, or resume it. Axis submits authorized requests only; scheduler state remains backend-owned."
              eyebrow="Governed scheduler controls"
              headingVariant="h4"
              title="Cron job control"
            />
            {!cronConnection ? (
              <Alert severity="warning">
                Cron runtime is not connected. Register and activate nodics.cron, then
                restart or refresh Axis discovery.
              </Alert>
            ) : null}
            {createJob.isError || lifecycle.isError ? (
              <Alert severity="error">
                {createJob.error instanceof Error
                  ? createJob.error.message
                  : lifecycle.error instanceof Error
                    ? lifecycle.error.message
                    : 'Cron operation failed.'}
              </Alert>
            ) : null}
            {createJob.isSuccess ? (
              <Alert severity="success">
                Cron job {createJob.data.code} was saved through Cron-owned APIs.
              </Alert>
            ) : null}
            {lifecycle.isSuccess ? (
              <Alert severity="success">Cron lifecycle request completed.</Alert>
            ) : null}

            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              spacing={2}
              sx={{ alignItems: { lg: 'flex-start' } }}
            >
              <TextField
                disabled={!cronConnection || createJob.isPending}
                label="Job code"
                onChange={(event) => setJobCode(event.target.value)}
                value={jobCode}
              />
              <TextField
                disabled={!cronConnection || createJob.isPending}
                label="Name"
                onChange={(event) => setJobName(event.target.value)}
                value={jobName}
              />
              <TextField
                disabled={!cronConnection || createJob.isPending}
                label="Cron expression"
                onChange={(event) => setTriggerExpression(event.target.value)}
                value={triggerExpression}
              />
              <TextField
                disabled={!cronConnection || createJob.isPending}
                label="Run on node"
                onChange={(event) => setRunOnNode(event.target.value)}
                value={runOnNode}
              />
            </Stack>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
              <TextField
                disabled={!cronConnection || createJob.isPending}
                helperText="Optional Process trigger code for Cron → Process handoff."
                label="Process trigger"
                onChange={(event) => setProcessTriggerCode(event.target.value)}
                value={processTriggerCode}
              />
              <TextField
                disabled={!cronConnection || createJob.isPending}
                helperText="Optional deterministic Process instance code."
                label="Process instance code"
                onChange={(event) => setProcessInstanceCode(event.target.value)}
                value={processInstanceCode}
              />
              <Box sx={{ alignSelf: { lg: 'center' } }}>
                <Button
                  disabled={!cronConnection || createJob.isPending}
                  onClick={() => createJob.mutate()}
                  size="large"
                  variant="contained"
                >
                  {createJob.isPending ? 'Saving…' : 'Save Cron job'}
                </Button>
              </Box>
            </Stack>

            <Divider />

            <Stack spacing={2}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography variant="h5">Recent Cron jobs</Typography>
                  <Typography color="text.secondary">
                    Use “Create in scheduler” after saving a definition, then run or
                    manage lifecycle from Cron-owned endpoints.
                  </Typography>
                </Box>
                <Chip
                  label={
                    jobs.isPending
                      ? 'Loading'
                      : `${String(jobs.data?.length ?? 0)} discovered`
                  }
                  variant="outlined"
                />
              </Stack>
              {jobs.isError ? (
                <Alert severity="warning">
                  {jobs.error instanceof Error
                    ? jobs.error.message
                    : 'Cron jobs are unavailable.'}
                </Alert>
              ) : null}
              {(jobs.data ?? []).slice(0, 6).map((job) => {
                const pending =
                  lifecycle.isPending && lifecycle.variables?.code === job.code;
                const actionPolicies = cronJobLifecycleActionPolicies(job);
                return (
                  <Paper
                    component="article"
                    elevation={0}
                    key={job.code}
                    sx={{ border: 1, borderColor: 'divider', p: 2 }}
                  >
                    <Stack spacing={1.5}>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1}
                        sx={{
                          alignItems: { md: 'center' },
                          justifyContent: 'space-between',
                        }}
                      >
                        <Box>
                          <Typography variant="h6">{job.name ?? job.code}</Typography>
                          <Typography color="text.secondary" variant="body2">
                            {job.code} · {expressionOf(job)} · node{' '}
                            {job.runOnNode ?? '—'}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                          <Chip label={job.state ?? 'NEW'} size="small" />
                          <Chip
                            color={job.active ? 'success' : 'default'}
                            label={job.active ? 'active' : 'inactive'}
                            size="small"
                            variant="outlined"
                          />
                          {processTriggerOf(job) ? (
                            <Chip
                              color="info"
                              label={`Process ${processTriggerOf(job)}`}
                              size="small"
                              variant="outlined"
                            />
                          ) : null}
                        </Stack>
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                        {actionPolicies.map((policy) => (
                          <Button
                            disabled={!cronConnection || pending || policy.disabled}
                            key={policy.action}
                            onClick={() =>
                              lifecycle.mutate({
                                action: policy.action,
                                code: job.code,
                              })
                            }
                            size="small"
                            title={policy.reason}
                            variant={policy.variant}
                          >
                            {pending && lifecycle.variables?.action === policy.action
                              ? 'Working…'
                              : policy.label}
                          </Button>
                        ))}
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
              {!jobs.isPending && !jobs.isError && (jobs.data?.length ?? 0) === 0 ? (
                <Alert severity="info">
                  No Cron jobs exist yet. Save a job above, then create it in the
                  scheduler and run it when ready.
                </Alert>
              ) : null}
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </WorkspaceContainer>
  );
}
