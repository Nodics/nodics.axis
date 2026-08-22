import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisModuleConnection,
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  loadProcessOperationsSummary,
  type ProcessHumanTask,
} from '../processWorkflow/api/processDefinitionClient';
import { DashboardSection } from '../shared/WorkbenchMetricDashboard';
import {
  activeConnections,
  connectionKey,
  dashboardCardPadding,
  dashboardComponentGap,
  dashboardContentGap,
  loadWorkbenchMetrics,
  metricsById,
  totalReadyMetrics,
  type WorkbenchMetricDefinition,
} from '../shared/workbenchMetricDashboardModel';

interface PublishingDashboardRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}

const publishingMetrics: readonly WorkbenchMetricDefinition[] = Object.freeze([
  Object.freeze({
    id: 'publishing-requests',
    label: 'Publishing requests',
    moduleName: 'publish',
    schemaName: 'publicationRequest',
    description: 'Governed requests moving staged content toward delivery.',
    route: '/publishing/requests',
    icon: 'workflow',
  }),
  Object.freeze({
    id: 'publishing-status',
    label: 'Publishing status',
    moduleName: 'cms',
    schemaName: 'cmsOnlinePublicationPointer',
    description: 'Operational status for staged-to-online publication flow.',
    route: '/publishing/status',
    icon: 'status',
  }),
  Object.freeze({
    id: 'publishing-manifests',
    label: 'Publication manifests',
    moduleName: 'cms',
    schemaName: 'cmsPublicationManifest',
    description: 'Generated evidence describing prepared publishing payloads.',
    route: '/publishing/manifests',
    icon: 'file',
  }),
  Object.freeze({
    id: 'publishing-history',
    label: 'Publishing history',
    moduleName: 'cms',
    schemaName: 'cmsPublicationDeploymentReceipt',
    description: 'Historical publishing receipts and deployment evidence.',
    route: '/publishing/history',
    icon: 'history',
  }),
  Object.freeze({
    id: 'publishing-audit',
    label: 'Publishing audit',
    moduleName: 'publish',
    schemaName: 'publicationAudit',
    description: 'Traceability records for publishing operations.',
    route: '/publishing/audit',
    icon: 'audit',
  }),
]);

const approvalTaskStates = Object.freeze(['OPEN', 'CLAIMED', 'ESCALATED']);

const operatorPath = Object.freeze([
  Object.freeze({
    eyebrow: 'Prepare',
    title: '1. Prepare setup',
    body: 'Initialize documentation or accelerator packages in Staged before public delivery.',
    evidence:
      'Expected evidence: selected package, target site, release code, and import status.',
    route: '/setup-accelerators',
    action: 'Open Setup',
    secondaryRoute: '/publishing/requests',
    secondaryAction: 'Review Requests',
  }),
  Object.freeze({
    eyebrow: 'Inspect',
    title: '2. Inspect request',
    body: 'Review the exact publication request, source version, target site, and dependency evidence.',
    evidence:
      'Expected evidence: publication request, generated manifest, source version, and target Online profile.',
    route: '/publishing/requests',
    action: 'View Requests',
    secondaryRoute: '/publishing/manifests',
    secondaryAction: 'Open Manifests',
  }),
  Object.freeze({
    eyebrow: 'Govern',
    title: '3. Approve change',
    body: 'Use Process approval tasks for every operation that changes Online visibility.',
    evidence:
      'Expected evidence: claimed task, approve or reject decision, reviewer, reason, and workflow timeline.',
    route: '/process/tasks',
    action: 'Review Approvals',
    secondaryRoute: '/publishing/audit',
    secondaryAction: 'Inspect Audit',
  }),
  Object.freeze({
    eyebrow: 'Verify',
    title: '4. Verify Online',
    body: 'Confirm Online pointers, manifests, receipts, and browser delivery after activation.',
    evidence:
      'Expected evidence: Online pointer, deployment receipt, browser page, and audit trail.',
    route: '/publishing/status',
    action: 'Check Online',
    secondaryRoute: '/publishing/history',
    secondaryAction: 'View History',
  }),
]);

function taskIsActionable(task: ProcessHumanTask): boolean {
  return (
    approvalTaskStates.includes(task.status) &&
    task.nodeCode === 'publicationReview' &&
    (task.instanceCode?.startsWith('cmsPublicationApproval-') ?? false)
  );
}

function workflowConnection(
  bootstrap: AxisAuthenticatedBootstrap,
): AxisModuleConnection | undefined {
  return (
    selectModuleConnection(bootstrap, 'flowApi', { server: 'processServer' }) ??
    selectModuleConnection(bootstrap, 'flowApi') ??
    selectModuleConnection(bootstrap, 'workflow', { server: 'processServer' }) ??
    selectModuleConnection(bootstrap, 'workflow')
  );
}

export function PublishingDashboardRoutePage({
  accessToken,
  bootstrap,
  routeNavigation,
  runtime,
}: PublishingDashboardRoutePageProps) {
  const connections = useMemo(() => activeConnections(bootstrap), [bootstrap]);
  const configuration = useMemo(
    () => ({
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs],
  );
  const processConnection = useMemo(() => workflowConnection(bootstrap), [bootstrap]);
  const data = useQuery({
    queryKey: [
      'publishing-dashboard',
      runtime.enterpriseCode,
      connectionKey(connections),
    ],
    queryFn: () =>
      loadWorkbenchMetrics(connections, bootstrap, configuration, publishingMetrics),
  });
  const processSummary = useQuery({
    enabled: Boolean(processConnection),
    queryKey: [
      'publishing-approval-tasks',
      runtime.enterpriseCode,
      processConnection?.instanceId ?? 'unavailable',
      processConnection?.state ?? 'unavailable',
    ],
    queryFn: async () => {
      if (!processConnection) return undefined;
      return loadProcessOperationsSummary(processConnection, configuration);
    },
  });
  const metrics = data.data;
  const readyCount = totalReadyMetrics(metrics);
  const unavailableCount = (metrics?.length ?? publishingMetrics.length) - readyCount;
  const approvalTasks = Object.freeze(
    (processSummary.data?.tasks ?? []).filter(taskIsActionable),
  );

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
                description="Track publication requests, staged-to-online status, generated manifests, deployment receipts, and audit evidence."
                help={routeNavigation?.help}
                eyebrow="Publishing workspace"
                headingVariant="h3"
                title="Publishing"
              />
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Chip label={`${String(publishingMetrics.length)} metrics`} />
                <Chip color="success" label={`${String(readyCount)} live`} />
                {unavailableCount > 0 ? (
                  <Chip
                    color="warning"
                    label={`${String(unavailableCount)} unavailable`}
                    variant="outlined"
                  />
                ) : null}
              </Stack>
            </Stack>

            <Alert severity={data.isError ? 'warning' : 'info'}>
              {data.isError
                ? data.error instanceof Error
                  ? data.error.message
                  : 'Publishing dashboard metrics are currently unavailable.'
                : 'Counts are loaded from authorized publishing and WCMS workbench contracts. Publishing remains a governed backend operation; Axis only presents the workspace.'}
            </Alert>

            <Paper
              elevation={0}
              sx={{
                bgcolor: 'warning.50',
                border: 1,
                borderColor: 'warning.200',
                p: 2,
              }}
            >
              <Stack
                direction={{ xs: 'column', lg: 'row' }}
                spacing={2}
                sx={{ alignItems: { lg: 'center' }, justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography color="warning.dark" variant="overline">
                    Guided publishing lane
                  </Typography>
                  <Typography variant="h6">
                    Setup, approval, publication, and live verification stay in one
                    governed journey.
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Use this cockpit when a data pack, accelerator, CMS page, or media
                    update must move from Staged preparation to Online evidence.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  <Button
                    component={RouterLink}
                    to="/setup-accelerators"
                    variant="contained"
                  >
                    Start setup
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/publishing/requests"
                    variant="outlined"
                  >
                    Inspect requests
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        </Paper>

        <DashboardSection
          description="Operational publishing records used to move approved content from staged authoring toward online delivery."
          loading={data.isPending}
          metrics={metricsById(metrics, publishingMetrics)}
          title="Publishing operations"
        />

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <Box>
              <Typography variant="h5">Guided operator journey</Typography>
              <Typography color="text.secondary">
                Follow the same sequence every time: prepare the change, inspect the
                generated request, approve or reject through Process, then verify Online
                with receipts and browser evidence.
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(4, minmax(0, 1fr))',
                },
              }}
            >
              {operatorPath.map((step, index) => (
                <Paper
                  component="article"
                  elevation={0}
                  key={step.title}
                  sx={{
                    border: 1,
                    borderColor: index === 0 ? 'warning.300' : 'divider',
                    p: 2,
                    position: 'relative',
                  }}
                >
                  <Stack spacing={1.25}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Chip color="warning" label={step.eyebrow} size="small" />
                      <Typography color="text.secondary" variant="caption">
                        Step {String(index + 1)} of {String(operatorPath.length)}
                      </Typography>
                    </Stack>
                    <Typography variant="h6">{step.title}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {step.body}
                    </Typography>
                    <Divider />
                    <Typography color="text.secondary" variant="caption">
                      {step.evidence}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                      <Button
                        component={RouterLink}
                        size="small"
                        to={step.route}
                        variant={index === 0 ? 'contained' : 'outlined'}
                      >
                        {step.action}
                      </Button>
                      <Button
                        component={RouterLink}
                        size="small"
                        to={step.secondaryRoute}
                        variant="text"
                      >
                        {step.secondaryAction}
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Box>
            <Alert severity="success">
              Completion means both sides are proven: the backend approval path has a
              Process decision and the user-facing browser page shows the intended
              Online result.
            </Alert>
          </Stack>
        </Paper>

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
              <Box>
                <Typography variant="h5">Approval tasks</Typography>
                <Typography color="text.secondary">
                  Publication approvals are governed Process tasks. Review them here or
                  open the full task inbox to claim, approve, reject, or inspect
                  workflow evidence.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Chip
                  color={processConnection ? 'success' : 'warning'}
                  label={
                    processConnection ? processConnection.state : 'Process unavailable'
                  }
                  variant={processConnection ? 'filled' : 'outlined'}
                />
                <Chip
                  color={approvalTasks.length ? 'warning' : 'success'}
                  label={`${String(approvalTasks.length)} pending`}
                  variant={approvalTasks.length ? 'filled' : 'outlined'}
                />
              </Stack>
            </Stack>

            {!processConnection ? (
              <Alert severity="warning">
                The Process runtime is not available, so Axis cannot show publication
                approval tasks. Start Process and return to Publishing → Approval Tasks.
              </Alert>
            ) : processSummary.isError ? (
              <Alert severity="warning">
                {processSummary.error instanceof Error
                  ? processSummary.error.message
                  : 'Approval tasks are currently unavailable.'}
              </Alert>
            ) : approvalTasks.length === 0 ? (
              <Alert severity="success">
                No publishing approval tasks are waiting. If Nexus or Agora still show
                unpublished content, inspect Publishing Requests and Staged-to-Online
                Status next.
              </Alert>
            ) : (
              <Stack spacing={1.5}>
                {approvalTasks.slice(0, 5).map((task) => (
                  <Paper
                    component="article"
                    elevation={0}
                    key={task.code}
                    sx={{ border: 1, borderColor: 'divider', p: 2 }}
                  >
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1.5}
                      sx={{ justifyContent: 'space-between' }}
                    >
                      <Box>
                        <Typography variant="h6">{task.code}</Typography>
                        <Typography color="text.secondary">
                          Instance {task.instanceCode ?? 'unknown'} · node{' '}
                          {task.nodeCode ?? 'unknown'} · assignee{' '}
                          {task.assignee ?? 'unassigned'}
                        </Typography>
                      </Box>
                      <Chip color="warning" label={task.status} />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/process/tasks" variant="contained">
                Review approval tasks
              </Button>
              <Button
                component={RouterLink}
                to="/publishing/requests"
                variant="outlined"
              >
                View publishing requests
              </Button>
              <Button component={RouterLink} to="/publishing/status" variant="outlined">
                Check Online status
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </WorkspaceContainer>
  );
}
