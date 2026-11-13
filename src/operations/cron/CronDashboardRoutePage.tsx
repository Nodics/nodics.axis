import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { qualifiedCronJobAction } from './api/cronJobActionAuthority';
import { CronScheduleDraftPanel } from './CronScheduleDraftPanel';
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
  cronJobExecutionEvidence,
  usesReviewedCronSchedule,
  loadCronJobs,
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
  readonly healthyInstances: number | undefined;
  readonly metrics: readonly WorkbenchMetric[];
  readonly runtimeInstances: number | undefined;
}

/** Presents persisted Cron execution evidence separately from definition flags and scheduler-command acknowledgements. */
function CronJobExecutionSummary({ job }: { readonly job: CronJobDefinition }) {
  const evidence = cronJobExecutionEvidence(job);
  if (evidence.kind !== 'completed')
    return (
      <Typography color="text.secondary" variant="body2">
        {job.state === 'RUNNING'
          ? 'Execution is in progress. Another run is unavailable until it finishes.'
          : evidence.kind === 'none'
            ? 'No completed run is recorded.'
            : 'Completed execution is not confirmed. Refresh job evidence to inspect its current status.'}
      </Typography>
    );
  const formatTime = (value: string) =>
    new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(value));
  return (
    <Stack spacing={0.5}>
      <Chip
        size="small"
        sx={{ alignSelf: 'flex-start' }}
        color={evidence.status === 'SUCCESS' ? 'success' : 'error'}
        label={evidence.status === 'SUCCESS' ? 'Last run succeeded' : 'Last run failed'}
      />
      {evidence.status === 'ERROR' && (
        <Typography variant="body2" color="error.main">
          {job.failure
            ? `The ${job.failure.target === 'external' ? 'external target' : job.failure.target === 'processTrigger' ? 'Process trigger' : 'configured target'} failed (${job.failure.code}).`
            : 'The scheduled execution failed.'}{' '}
          Inspect the target before requesting another run. Runs are never retried
          automatically by the scheduler.
        </Typography>
      )}
      <Typography color="text.secondary" variant="body2">
        One execution per job on this node. Ticks during execution are skipped; missed
        ticks are not replayed.
      </Typography>
      {job.lastSkippedAt && Number.isFinite(Date.parse(job.lastSkippedAt)) && (
        <Typography variant="body2">
          Last skipped tick:{' '}
          <time dateTime={job.lastSkippedAt}>{formatTime(job.lastSkippedAt)}</time>
        </Typography>
      )}
      <Typography variant="body2">
        Started:{' '}
        <time dateTime={evidence.startedAt}>{formatTime(evidence.startedAt)}</time>
      </Typography>
      <Typography variant="body2">
        Finished:{' '}
        <time dateTime={evidence.finishedAt}>{formatTime(evidence.finishedAt)}</time>
      </Typography>
    </Stack>
  );
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
    healthyInstances: health?.availability.healthyInstances,
    metrics,
    runtimeInstances: health?.availability.activeInstances,
  });
}

/** Private actor and exact runtime scope retire read caches and callbacks without restarting on heartbeats. */
export function CronDashboardRoutePage(props: CronDashboardRoutePageProps) {
  const actor = useMemo(
    () => (props.accessToken ? crypto.randomUUID() : 'anonymous'),
    [props.accessToken],
  );
  const source = selectModuleConnection(props.bootstrap, 'cronjob');
  const scope = JSON.stringify([
    actor,
    props.bootstrap.tenantCode,
    props.runtime.enterpriseCode,
    props.runtime.projectCode,
    source?.instanceId,
    source?.endpoint,
    source?.server,
    source?.environment,
    source?.runtimeRole?.code,
    source?.runtimeRole?.publication,
  ]);
  return <CronDashboardSession key={scope} {...props} privateScope={scope} />;
}
function CronDashboardSession({
  accessToken,
  bootstrap,
  routeNavigation,
  runtime,
  privateScope,
}: CronDashboardRoutePageProps & { readonly privateScope: string }) {
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
    queryKey: ['cron-dashboard', privateScope, connectionKey(connections)],
    queryFn: () => loadCronDashboardData(connections, bootstrap, configuration),
  });
  const jobs = useQuery({
    enabled: Boolean(cronConnection),
    queryKey: [cronJobsQueryKey, privateScope, cronConnection?.instanceId ?? 'missing'],
    queryFn: () => {
      if (!cronConnection) throw new Error('Cron runtime connection is unavailable');
      return loadCronJobs(cronConnection, configuration);
    },
  });
  const accessKey = JSON.stringify([
    routeNavigation?.id,
    routeNavigation?.featureState,
    routeNavigation?.availability,
    routeNavigation?.lifecycleActions,
  ]);
  const currentAccess = useRef(accessKey);
  useEffect(() => {
    currentAccess.current = accessKey;
  }, [accessKey]);
  const dispatched = useRef<
    { key: string; code: string; intentId: string } | undefined
  >(undefined);
  const active = useRef(true);
  const [uncertainJob, setUncertainJob] = useState<string>();
  const admittedIntent = useRef<string | undefined>(undefined);
  const [commandAdmitted, setCommandAdmitted] = useState(false);
  const [scheduleFlowHeld, setScheduleFlowHeld] = useState(false);
  const [scheduleControlsAvailable, setScheduleControlsAvailable] = useState(false);
  const [selectedSchedule, setSelectedSchedule] =
    useState<Readonly<{ code: string; intentId: string }>>();
  const [acknowledgedKey, setAcknowledgedKey] = useState<string>();
  const [failedKey, setFailedKey] = useState<string>();
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const lifecycle = useMutation({
    mutationFn: async ({
      action,
      code,
      intentId,
    }: {
      readonly action: CronJobLifecycleAction;
      readonly code: string;
      readonly intentId: string;
    }) => {
      if (
        !cronConnection ||
        admittedIntent.current !== intentId ||
        scheduleFlowHeld ||
        jobs.isFetching ||
        jobs.isError ||
        uncertainJob ||
        !qualifiedCronJobAction(routeNavigation, action)
      )
        throw new Error(
          'Refresh the current Cron owner evidence and permitted operations before continuing.',
        );
      const job = jobs.data?.find((row) => row.code === code);
      const policy =
        job &&
        cronJobLifecycleActionPolicies(job).find((item) => item.action === action);
      if (
        !job ||
        !policy ||
        policy.disabled ||
        (usesReviewedCronSchedule(job) && action !== 'run')
      )
        throw new Error('Use the current reviewed schedule controls for this job.');
      setAcknowledgedKey(undefined);
      setFailedKey(undefined);
      dispatched.current = { key: accessKey, code, intentId };
      await applyCronJobAction(cronConnection, configuration, code, action);
    },
    onSuccess: async (_result, variables) => {
      if (
        !active.current ||
        currentAccess.current !== dispatched.current?.key ||
        dispatched.current?.intentId !== variables.intentId
      )
        return;
      setAcknowledgedKey(dispatched.current.key);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [cronJobsQueryKey, privateScope],
        }),
        queryClient.invalidateQueries({
          queryKey: ['cron-dashboard', privateScope],
        }),
      ]);
    },
    onError: (_error, variables) => {
      if (active.current && dispatched.current?.intentId === variables.intentId) {
        setUncertainJob(variables.code);
        if (currentAccess.current === dispatched.current.key)
          setFailedKey(dispatched.current.key);
      }
    },
    onSettled: (_result, error, variables) => {
      if (
        admittedIntent.current === variables.intentId &&
        (!error || dispatched.current?.intentId !== variables.intentId)
      ) {
        admittedIntent.current = undefined;
        if (active.current) setCommandAdmitted(false);
      }
    },
  });
  const metrics = data.data?.metrics;
  const readyCount = totalReadyMetrics(metrics);
  const unavailableCount = (metrics?.length ?? cronMetrics.length) - readyCount;
  const totalRecords = totalMetricValue(metrics);
  const completeInventory =
    data.isSuccess &&
    metrics?.length === cronMetrics.length &&
    readyCount === cronMetrics.length;

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
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}
              >
                <Chip
                  color={completeInventory ? 'success' : 'default'}
                  label={
                    data.isPending
                      ? 'Checking inventory'
                      : completeInventory
                        ? `${String(readyCount)} verified`
                        : 'Inventory unverified'
                  }
                />
                {!data.isPending && unavailableCount > 0 ? (
                  <Chip
                    color="warning"
                    label={`${String(unavailableCount)} not verified`}
                    variant="outlined"
                  />
                ) : null}
                <Chip
                  label={
                    data.data?.runtimeInstances === undefined
                      ? 'Runtime unverified'
                      : `${String(data.data.runtimeInstances)} instance${data.data.runtimeInstances === 1 ? '' : 's'}`
                  }
                />
                <Chip
                  color={data.data?.healthyInstances ? 'success' : 'default'}
                  label={
                    data.data?.healthyInstances === undefined
                      ? 'Runtime health unverified'
                      : `${String(data.data.healthyInstances)} healthy`
                  }
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
                {data.isPending
                  ? '—'
                  : completeInventory
                    ? new Intl.NumberFormat().format(totalRecords)
                    : 'Unverified'}
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

        {cronConnection ? (
          <CronScheduleDraftPanel
            connection={cronConnection}
            configuration={configuration}
            existingSelection={selectedSchedule}
            selectionLabel={
              selectedSchedule
                ? jobs.data?.find((job) => job.code === selectedSchedule.code)?.name
                : undefined
            }
            controlsId="cron-schedule-controls"
            onPendingChange={setScheduleFlowHeld}
            onControlsAvailable={setScheduleControlsAvailable}
            commandsBlocked={
              commandAdmitted || lifecycle.isPending || Boolean(uncertainJob)
            }
            onSaved={(code) => {
              if (code && !uncertainJob && !lifecycle.isPending)
                setSelectedSchedule({ code, intentId: crypto.randomUUID() });
              void queryClient.invalidateQueries({
                queryKey: [cronJobsQueryKey, privateScope],
              });
              void queryClient.invalidateQueries({
                queryKey: ['cron-dashboard', privateScope],
              });
            }}
          />
        ) : null}

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <WorkspaceHeading
              description="Review existing jobs and their scheduler state. Create new schedules with the approved inactive-draft journey above."
              eyebrow="Governed scheduler controls"
              headingComponent="h2"
              headingVariant="h5"
              title="Existing job operations"
            />
            {!cronConnection ? (
              <Alert severity="warning">
                The Cron runtime is unavailable. Refresh module availability or ask your
                administrator to check its registration.
              </Alert>
            ) : null}
            {lifecycle.isError && accessKey === failedKey ? (
              <Alert severity="warning">
                {lifecycle.error instanceof Error
                  ? lifecycle.error.message
                  : 'Cron owner acknowledgement is unavailable.'}
              </Alert>
            ) : null}
            {uncertainJob ? (
              <Alert severity="warning">
                The operation outcome for {uncertainJob} is unconfirmed. Inspect current
                scheduler state and execution evidence with the owning administrator
                before another operation. No retry was sent.
              </Alert>
            ) : null}
            {lifecycle.isSuccess && accessKey === acknowledgedKey ? (
              <Alert severity="info">
                Cron acknowledged the request. Refresh job state and inspect execution
                evidence to confirm the result.
              </Alert>
            ) : null}
            <Button
              disabled={!cronConnection || jobs.isFetching || lifecycle.isPending}
              onClick={() => void jobs.refetch()}
            >
              Refresh job evidence
            </Button>

            <Stack spacing={2}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography component="h3" variant="h6">
                    Recent Cron jobs
                  </Typography>
                  <Typography color="text.secondary">
                    These are the recently retrieved owner records. Scheduler commands
                    require current access and fresh job evidence.
                  </Typography>
                </Box>
                <Chip
                  label={
                    jobs.isPending
                      ? 'Loading'
                      : jobs.isError
                        ? 'Unverified'
                        : `${String(jobs.data?.length ?? 0)} retrieved`
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
                const actionPolicies = cronJobLifecycleActionPolicies(job).filter(
                  (policy) =>
                    qualifiedCronJobAction(routeNavigation, policy.action) &&
                    (!usesReviewedCronSchedule(job) || policy.action === 'run'),
                );
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
                          <Typography component="h4" variant="h6">
                            {job.name ?? job.code}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                          {!usesReviewedCronSchedule(job) && job.state ? (
                            <Chip label={job.state} size="small" />
                          ) : null}
                          <Chip
                            color={job.active ? 'success' : 'default'}
                            label={
                              job.active ? 'Active definition' : 'Inactive definition'
                            }
                            size="small"
                            variant="outlined"
                          />
                        </Stack>
                      </Stack>
                      <CronJobExecutionSummary job={job} />
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                        {scheduleControlsAvailable ? (
                          <Button
                            component="a"
                            href="#cron-schedule-controls"
                            disabled={
                              scheduleFlowHeld ||
                              commandAdmitted ||
                              lifecycle.isPending ||
                              Boolean(uncertainJob) ||
                              jobs.isFetching ||
                              jobs.isError
                            }
                            onClick={(event) => {
                              if (
                                admittedIntent.current ||
                                scheduleFlowHeld ||
                                uncertainJob ||
                                jobs.isFetching ||
                                jobs.isError
                              ) {
                                event.preventDefault();
                                return;
                              }
                              setSelectedSchedule({
                                code: job.code,
                                intentId: crypto.randomUUID(),
                              });
                            }}
                          >
                            Open schedule controls
                          </Button>
                        ) : null}
                        {actionPolicies.map((policy) => (
                          <Button
                            disabled={
                              !cronConnection ||
                              pending ||
                              jobs.isFetching ||
                              jobs.isError ||
                              lifecycle.isPending ||
                              commandAdmitted ||
                              scheduleFlowHeld ||
                              Boolean(uncertainJob) ||
                              policy.disabled
                            }
                            key={policy.action}
                            onClick={() => {
                              if (
                                admittedIntent.current ||
                                scheduleFlowHeld ||
                                uncertainJob ||
                                jobs.isFetching ||
                                jobs.isError
                              )
                                return;
                              const intentId = crypto.randomUUID();
                              admittedIntent.current = intentId;
                              setCommandAdmitted(true);
                              if (scheduleControlsAvailable)
                                setSelectedSchedule({
                                  code: job.code,
                                  intentId: crypto.randomUUID(),
                                });
                              lifecycle.mutate({
                                action: policy.action,
                                code: job.code,
                                intentId,
                              });
                            }}
                            size="small"
                            title={policy.reason}
                            variant={policy.variant}
                          >
                            {pending && lifecycle.variables?.action === policy.action
                              ? 'Working…'
                              : qualifiedCronJobAction(routeNavigation, policy.action)
                                  ?.label}
                          </Button>
                        ))}
                      </Stack>
                      <Box
                        component="details"
                        sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
                      >
                        <Typography
                          component="summary"
                          variant="body2"
                          sx={{ cursor: 'pointer' }}
                        >
                          Schedule references
                        </Typography>
                        <Typography variant="body2">Job: {job.code}</Typography>
                        <Typography variant="body2">
                          {usesReviewedCronSchedule(job) ? 'Approved timing' : 'Timing'}
                          : {expressionOf(job)}
                        </Typography>
                        <Typography variant="body2">
                          Execution node: {job.runOnNode ?? 'Not provided'}
                        </Typography>
                        {processTriggerOf(job) ? (
                          <Typography variant="body2">
                            Process relationship: {processTriggerOf(job)}
                          </Typography>
                        ) : null}
                        {job.state ? (
                          <Typography variant="body2">
                            Recorded scheduler state: {job.state}
                          </Typography>
                        ) : null}
                      </Box>
                    </Stack>
                  </Paper>
                );
              })}
              {!jobs.isPending && !jobs.isError && (jobs.data?.length ?? 0) === 0 ? (
                <Alert severity="info">
                  No jobs were returned by the Cron owner. To create one, review an
                  approved inactive schedule draft above. If no target is available, ask
                  your administrator to configure the intended schedule.
                </Alert>
              ) : null}
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </WorkspaceContainer>
  );
}
