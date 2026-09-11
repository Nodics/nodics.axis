import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import { useMemo, useState } from 'react';

import { axisTokens } from '../../app/axisTheme';
import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisDocumentationSource,
  type AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import { createDocumentationPublicationClient } from '../../documentation/api/documentationPublicationClient';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  archiveProcessTrigger,
  assignProcessTask,
  createProcessDefinition,
  createProcessTrigger,
  createSampleGraph,
  executeProcessTrigger,
  cancelProcessInstance,
  cancelProcessTask,
  claimProcessTask,
  completeProcessTask,
  compensateProcessInstance,
  deleteOrArchiveProcessDefinition,
  loadProcessInstanceDetail,
  loadProcessDefinitionVersions,
  loadProcessOperationsSummary,
  loadProcessDefinitions,
  prepareNextProcessDraft,
  publishProcessDraft,
  retryProcessInstance,
  startProcessInstance,
  updateProcessTrigger,
  updateProcessDraft,
  validateProcessDraft,
  type ProcessDefinition,
  type ProcessDefinitionClientConfiguration,
  type ProcessHumanTask,
  type ProcessIncident,
  type ProcessRuntimeInstance,
  type ProcessOperationsSummary,
  type ProcessTrigger,
  type ProcessDefinitionVersion,
  type ProcessGraph,
  type ProcessGraphNode,
} from './api/processDefinitionClient';

interface ProcessWorkflowRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
}

const queryKey = 'process-definitions';
const operationsQueryKey = 'process-operations-summary';
const versionsQueryKey = 'process-definition-versions';
const instanceDetailQueryKey = 'process-instance-detail';
type ProcessTaskDecision = Readonly<Record<string, unknown>>;
type CmsPublicationTaskContext = Readonly<{
  profileCode: string;
  releaseStatus?: string;
  releaseVersion: string;
  requestedBy?: string;
  siteCode: string;
  sourceLabel: string;
  publicationCode?: string;
}>;

function isCmsPublicationApprovalTask(task: ProcessHumanTask): boolean {
  return (
    task.nodeCode === 'publicationReview' &&
    (task.instanceCode?.startsWith('cmsPublicationApproval-') ?? false)
  );
}

function isActionableTask(task: ProcessHumanTask): boolean {
  return ['OPEN', 'CLAIMED', 'ESCALATED'].includes(task.status);
}

function isCmsDocumentationSource(
  source: AxisDocumentationSource,
): source is Extract<AxisDocumentationSource, { readonly type: 'CMS' }> {
  return source.type === 'CMS';
}

function shortCode(value: string | undefined, limit = 18): string {
  if (!value) return 'unknown';
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function createCmsPublicationApprovalDecision(): ProcessTaskDecision {
  return Object.freeze({
    approved: true,
    outcome: 'approved-from-axis',
    reason: 'Publication approved from Axis after operator review',
  });
}

function createCmsPublicationRejectionDecision(): ProcessTaskDecision {
  return Object.freeze({
    approved: false,
    outcome: 'rejected-from-axis',
    reason: 'Publication rejected from Axis; Online must remain unchanged',
  });
}

const emptyOperationsSummary: ProcessOperationsSummary = Object.freeze({
  auditEvents: Object.freeze([]),
  instances: Object.freeze([]),
  tasks: Object.freeze([]),
  triggers: Object.freeze([]),
  incidents: Object.freeze([]),
});
const defaultProcessWorkspace = Object.freeze({
  detail:
    'Model, validate, publish, start, and version workflow definitions with backend governance.',
  icon: 'workflow',
  label: 'Definitions',
  route: '/process/definitions',
});
const processWorkspaces = Object.freeze([
  defaultProcessWorkspace,
  Object.freeze({
    detail:
      'Inspect running instances, human tasks, and timeline evidence from nodics.process.',
    icon: 'activity',
    label: 'Operations',
    route: '/process/tasks',
  }),
  Object.freeze({
    detail:
      'Connect Process trigger metadata to Cron-owned jobs without mixing ownership.',
    icon: 'cronjob',
    label: 'Scheduled triggers',
    route: '/process/triggers',
  }),
  Object.freeze({
    detail:
      'Preview the Nodics-native visual graph contract before the full canvas editor lands.',
    icon: 'schema',
    label: 'Designer',
    route: '/process/designer',
  }),
]);
const designerNodeTypes = Object.freeze([
  'TASK',
  'DECISION',
  'ACTION',
  'TIMER',
  'SUB_PROCESS',
] as const);

function normalizeCode(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 128);
}

function ProcessJourneyStep({
  detail,
  icon,
  label,
  state,
}: {
  readonly detail: string;
  readonly icon: string;
  readonly label: string;
  readonly state: 'available' | 'preview' | 'planned';
}) {
  const tone =
    state === 'available' ? 'success' : state === 'preview' ? 'warning' : 'default';
  return (
    <Paper
      component="article"
      elevation={0}
      sx={{
        bgcolor:
          state === 'available'
            ? alpha(axisTokens.color.success, 0.08)
            : state === 'preview'
              ? alpha(axisTokens.color.signatureGold, 0.08)
              : 'background.paper',
        border: 1,
        borderColor: state === 'available' ? 'success.light' : 'divider',
        p: { xs: 2, md: 2.5 },
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box
            aria-hidden
            sx={{
              alignItems: 'center',
              bgcolor: alpha(axisTokens.color.signatureGold, 0.18),
              borderRadius: axisTokens.radius.medium,
              color: 'primary.main',
              display: 'inline-flex',
              height: 42,
              justifyContent: 'center',
              width: 42,
            }}
          >
            <ShellIcon name={icon} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6">{label}</Typography>
            <Chip color={tone} label={state} size="small" variant="outlined" />
          </Box>
        </Stack>
        <Typography color="text.secondary">{detail}</Typography>
      </Stack>
    </Paper>
  );
}

function SummaryCard({
  detail,
  label,
  value,
}: {
  readonly detail: string;
  readonly label: string;
  readonly value: number | string;
}) {
  return (
    <Paper
      component="article"
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        minHeight: 136,
        p: { xs: 2.5, md: 3 },
      }}
    >
      <Stack spacing={1}>
        <Typography color="text.secondary" variant="body2">
          {label}
        </Typography>
        <Typography sx={{ fontSize: { xs: 34, md: 42 }, fontWeight: 800 }}>
          {value}
        </Typography>
        <Typography color="text.secondary">{detail}</Typography>
      </Stack>
    </Paper>
  );
}

function ProcessWorkspaceCard({
  active,
  detail,
  icon,
  label,
  route,
}: {
  readonly active: boolean;
  readonly detail: string;
  readonly icon: string;
  readonly label: string;
  readonly route: string;
}) {
  return (
    <Paper
      component="a"
      elevation={0}
      href={route}
      sx={{
        bgcolor: active
          ? alpha(axisTokens.color.signatureGold, 0.12)
          : 'background.paper',
        border: 1,
        borderColor: active ? 'primary.main' : 'divider',
        color: 'inherit',
        p: { xs: 2, md: 2.5 },
        textDecoration: 'none',
        transition: 'border-color 160ms ease, transform 160ms ease',
        '&:hover': {
          borderColor: 'primary.main',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Box
            aria-hidden
            sx={{
              alignItems: 'center',
              bgcolor: alpha(axisTokens.color.signatureGold, 0.18),
              borderRadius: axisTokens.radius.medium,
              color: 'primary.main',
              display: 'inline-flex',
              height: 40,
              justifyContent: 'center',
              width: 40,
            }}
          >
            <ShellIcon name={icon} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6">{label}</Typography>
            <Chip
              color={active ? 'warning' : 'default'}
              label={active ? 'Current focus' : 'Open'}
              size="small"
              variant="outlined"
            />
          </Box>
        </Stack>
        <Typography color="text.secondary" variant="body2">
          {detail}
        </Typography>
      </Stack>
    </Paper>
  );
}

function GraphPreview({ graph }: { readonly graph: ProcessGraph | undefined }) {
  const nodes = graph?.nodes ?? [];
  const transitions = graph?.transitions ?? [];
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{
        bgcolor: alpha(axisTokens.color.signatureGold, 0.08),
        border: 1,
        borderColor: 'divider',
        p: { xs: 2.5, md: 3 },
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <ShellIcon name="workflow" />
          <Typography variant="h6">Visual graph preview</Typography>
        </Stack>
        {nodes.length === 0 ? (
          <Typography color="text.secondary">
            Select or create a draft definition to preview the backend-owned graph.
          </Typography>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.5,
              py: 1,
            }}
          >
            {nodes.map((node, index) => (
              <Box
                key={node.code}
                sx={{
                  alignItems: 'center',
                  display: 'inline-flex',
                  gap: 1.5,
                }}
              >
                <Chip
                  color={
                    node.type === 'START'
                      ? 'success'
                      : node.type === 'END'
                        ? 'default'
                        : 'primary'
                  }
                  label={`${node.name ?? node.code} · ${node.type}`}
                  variant={node.type === 'END' ? 'outlined' : 'filled'}
                />
                {index < nodes.length - 1 ? (
                  <Typography color="text.secondary">→</Typography>
                ) : null}
              </Box>
            ))}
          </Box>
        )}
        <Typography color="text.secondary" variant="body2">
          {String(nodes.length)} nodes · {String(transitions.length)} transitions. Axis
          stores layout intent only; validation and runtime truth stay in
          nodics.process.
        </Typography>
      </Stack>
    </Paper>
  );
}

function VersionHistory({
  loading,
  versions,
}: {
  readonly loading: boolean;
  readonly versions: readonly ProcessDefinitionVersion[];
}) {
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ShellIcon name="publish" />
          <Typography variant="h5">Version history</Typography>
          <Chip
            label={loading ? 'Loading' : `${String(versions.length)} versions`}
            variant="outlined"
          />
        </Stack>
        {versions.length === 0 ? (
          <Alert severity="info">
            No immutable versions exist yet. Validate and publish a draft to create the
            first auditable process version.
          </Alert>
        ) : (
          <Stack spacing={1.5}>
            {versions.map((version) => (
              <Paper
                component="article"
                elevation={0}
                key={`${version.definitionCode}-${String(version.version)}`}
                sx={{
                  bgcolor: alpha(axisTokens.color.success, 0.06),
                  border: 1,
                  borderColor: 'divider',
                  p: 2,
                }}
              >
                <Stack spacing={1}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Typography variant="h6">Version {version.version}</Typography>
                    <Chip
                      color={version.status === 'PUBLISHED' ? 'success' : 'default'}
                      label={version.status}
                      size="small"
                    />
                  </Stack>
                  <Typography color="text.secondary" variant="body2">
                    Published by {version.publishedBy ?? 'unknown'} ·{' '}
                    {version.publishedAt ?? 'date unavailable'}
                  </Typography>
                  <Typography
                    color="text.secondary"
                    sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
                    variant="caption"
                  >
                    checksum {version.checksum.slice(0, 24)}
                    {version.checksum.length > 24 ? '…' : ''}
                  </Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function RuntimeInstanceList({
  disabled,
  instances,
  onCancel,
  onSelect,
  selectedCode,
}: {
  readonly disabled: boolean;
  readonly instances: readonly ProcessRuntimeInstance[];
  readonly onCancel: (instanceCode: string) => void;
  readonly onSelect: (instanceCode: string) => void;
  readonly selectedCode: string | undefined;
}) {
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ShellIcon name="workflow" />
          <Typography variant="h5">Process instances</Typography>
          <Chip label={`${String(instances.length)} visible`} variant="outlined" />
        </Stack>
        {instances.length === 0 ? (
          <Alert severity="info">
            No process instances are running yet. Start a published process from a
            definition card to create a real backend-owned runtime instance.
          </Alert>
        ) : (
          <Stack spacing={1.5}>
            {instances.map((instance) => (
              <Paper
                component="article"
                elevation={0}
                key={instance.code}
                sx={{
                  border: 1,
                  borderColor:
                    selectedCode === instance.code ? 'primary.main' : 'divider',
                  p: 2,
                }}
              >
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    sx={{ justifyContent: 'space-between' }}
                  >
                    <Box>
                      <Typography variant="h6">{instance.code}</Typography>
                      <Typography color="text.secondary">
                        {instance.definitionCode ?? 'unknown definition'} · v
                        {String(instance.version)} · node{' '}
                        {instance.currentNode ?? 'unknown'}
                      </Typography>
                    </Box>
                    <Chip
                      color={
                        instance.status === 'COMPLETED'
                          ? 'success'
                          : instance.status === 'CANCELLED'
                            ? 'default'
                            : 'warning'
                      }
                      label={instance.status}
                    />
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Button
                      disabled={disabled}
                      onClick={() => onSelect(instance.code)}
                      variant={
                        selectedCode === instance.code ? 'contained' : 'outlined'
                      }
                    >
                      View timeline
                    </Button>
                    <Button
                      color="error"
                      disabled={
                        disabled ||
                        !['CREATED', 'RUNNING', 'WAITING'].includes(instance.status)
                      }
                      onClick={() => onCancel(instance.code)}
                      variant="outlined"
                    >
                      Cancel instance
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function RecoveryIncidentQueue({
  disabled,
  incidents,
  onCompensate,
  onRetry,
}: {
  readonly disabled: boolean;
  readonly incidents: readonly ProcessIncident[];
  readonly onCompensate: (instanceCode: string) => void;
  readonly onRetry: (incident: ProcessIncident) => void;
}) {
  const actionable = incidents.filter((incident) =>
    ['OPEN', 'DEAD_LETTER'].includes(incident.status),
  );
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ShellIcon name="activity" />
          <Typography variant="h5">Recovery incidents</Typography>
          <Chip label={`${String(actionable.length)} actionable`} variant="outlined" />
        </Stack>
        <Typography color="text.secondary">
          Retry failed workflow actions or invoke their registered domain compensation.
          Process records the recovery; the business module owns state reversal.
        </Typography>
        {actionable.length === 0 ? (
          <Alert severity="success">No workflow recovery incidents need action.</Alert>
        ) : (
          <Stack spacing={1.5}>
            {actionable.map((incident) => (
              <Paper
                component="article"
                elevation={0}
                key={incident.code}
                sx={{ border: 1, borderColor: 'divider', p: 2 }}
              >
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    sx={{ justifyContent: 'space-between' }}
                  >
                    <Box>
                      <Typography variant="h6">{incident.instanceCode}</Typography>
                      <Typography color="text.secondary">
                        {incident.nodeCode} · {incident.errorCode} · attempt{' '}
                        {String(incident.attempt)} of {String(incident.maximumAttempts)}
                      </Typography>
                    </Box>
                    <Chip
                      color={incident.status === 'DEAD_LETTER' ? 'error' : 'warning'}
                      label={incident.status}
                    />
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Button
                      disabled={
                        disabled || incident.attempt >= incident.maximumAttempts
                      }
                      onClick={() => onRetry(incident)}
                      variant="contained"
                    >
                      Retry action
                    </Button>
                    <Button
                      color="warning"
                      disabled={disabled || !incident.compensationAvailable}
                      onClick={() => onCompensate(incident.instanceCode)}
                      variant="outlined"
                    >
                      Run compensation
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function TaskInbox({
  assignee,
  disabled,
  onAssigneeChange,
  onAssign,
  onCancel,
  onClaim,
  onComplete,
  publicationContexts,
  tasks,
  title = 'Task inbox',
}: {
  readonly assignee: string;
  readonly disabled: boolean;
  readonly onAssigneeChange: (assignee: string) => void;
  readonly onAssign: (taskCode: string) => void;
  readonly onCancel: (taskCode: string) => void;
  readonly onClaim: (taskCode: string) => void;
  readonly onComplete: (taskCode: string, decision?: ProcessTaskDecision) => void;
  readonly publicationContexts: ReadonlyMap<string, CmsPublicationTaskContext>;
  readonly tasks: readonly ProcessHumanTask[];
  readonly title?: string;
}) {
  const publicationTasks = tasks
    .filter(isCmsPublicationApprovalTask)
    .filter(isActionableTask);
  const workflowTasks = tasks
    .filter((task) => !isCmsPublicationApprovalTask(task))
    .filter(isActionableTask);
  const [reviewingPublicationTaskCode, setReviewingPublicationTaskCode] =
    useState<string>();

  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', p: { xs: 2, md: 2.5 } }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          sx={{
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <ShellIcon name="task" />
            <Typography variant="h5">{title}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Chip
              color={publicationTasks.length ? 'warning' : 'default'}
              label={`${String(publicationTasks.length)} publication approvals`}
              variant={publicationTasks.length ? 'filled' : 'outlined'}
            />
            <Chip
              label={`${String(workflowTasks.length)} other tasks`}
              variant="outlined"
            />
          </Stack>
        </Stack>
        {tasks.length === 0 ? (
          <Alert severity="info">
            No human workflow tasks are waiting. Tasks appear here when a published
            process reaches a TASK node.
          </Alert>
        ) : (
          <Stack spacing={1.5}>
            {publicationTasks.length ? (
              <Stack spacing={1}>
                <Typography variant="subtitle1">
                  Documentation publication approvals
                </Typography>
                {publicationTasks.map((task) => {
                  const actionable = isActionableTask(task);
                  const context = publicationContexts.get(task.instanceCode ?? '');
                  const canDecide = actionable;
                  return (
                    <Paper
                      component="article"
                      elevation={0}
                      key={task.code}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderLeft: 3,
                        borderLeftColor: 'warning.main',
                        p: 1.5,
                      }}
                    >
                      <Stack spacing={1.5}>
                        <Box
                          sx={{
                            alignItems: { xs: 'stretch', lg: 'center' },
                            display: 'grid',
                            gap: 1.25,
                            gridTemplateColumns: {
                              xs: '1fr',
                              lg: 'minmax(0, 1fr) auto',
                            },
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
                            >
                              <Typography sx={{ fontWeight: 700 }} variant="h6">
                                {context?.sourceLabel ?? 'Documentation publication'}
                              </Typography>
                              <Chip color="warning" label={task.status} size="small" />
                            </Stack>
                            <Typography color="text.secondary" variant="body2">
                              {context
                                ? `${context.profileCode} -> ${context.siteCode} · release ${context.releaseVersion}`
                                : `Workflow ${shortCode(task.instanceCode)} · task ${shortCode(task.code)}`}
                            </Typography>
                            <Typography color="text.secondary" variant="body2">
                              Requested by {context?.requestedBy ?? 'unknown'} ·
                              assigned to {task.assignee ?? 'unassigned'}
                            </Typography>
                          </Box>
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              justifyContent: { xs: 'flex-start', lg: 'flex-end' },
                            }}
                          >
                            <Button
                              onClick={() =>
                                setReviewingPublicationTaskCode((current) =>
                                  current === task.code ? undefined : task.code,
                                )
                              }
                              size="small"
                              variant={
                                reviewingPublicationTaskCode === task.code
                                  ? 'contained'
                                  : 'outlined'
                              }
                            >
                              {reviewingPublicationTaskCode === task.code
                                ? 'Hide review'
                                : 'Review evidence'}
                            </Button>
                            <Button
                              disabled={disabled || !canDecide}
                              onClick={() =>
                                onComplete(
                                  task.code,
                                  createCmsPublicationApprovalDecision(),
                                )
                              }
                              size="small"
                              startIcon={<ShellIcon fontSize="small" name="approve" />}
                              variant="contained"
                            >
                              Approve
                            </Button>
                            <Button
                              color="warning"
                              disabled={disabled || !canDecide}
                              onClick={() =>
                                onComplete(
                                  task.code,
                                  createCmsPublicationRejectionDecision(),
                                )
                              }
                              size="small"
                              variant="outlined"
                            >
                              Reject
                            </Button>
                          </Stack>
                        </Box>
                        {reviewingPublicationTaskCode === task.code ? (
                          <Box
                            sx={{
                              bgcolor: alpha(axisTokens.color.info, 0.04),
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 1,
                              p: 1.5,
                            }}
                          >
                            <Stack spacing={1.5}>
                              <Stack
                                direction={{ xs: 'column', md: 'row' }}
                                spacing={1}
                                sx={{
                                  alignItems: { xs: 'flex-start', md: 'center' },
                                  justifyContent: 'space-between',
                                }}
                              >
                                <Box>
                                  <Typography
                                    sx={{ fontWeight: 700 }}
                                    variant="subtitle1"
                                  >
                                    Review before decision
                                  </Typography>
                                  <Typography color="text.secondary" variant="body2">
                                    This is the staged documentation publication
                                    evidence for the selected approval task.
                                  </Typography>
                                </Box>
                                <Chip
                                  label={
                                    canDecide
                                      ? 'Decision available'
                                      : 'Task is not actionable'
                                  }
                                  size="small"
                                  variant="outlined"
                                />
                              </Stack>
                              <Box
                                sx={{
                                  display: 'grid',
                                  gap: 1,
                                  gridTemplateColumns: {
                                    xs: '1fr',
                                    md: 'repeat(3, minmax(0, 1fr))',
                                  },
                                }}
                              >
                                {[
                                  ['Source', context?.sourceLabel],
                                  ['Staged profile', context?.profileCode],
                                  ['Target site', context?.siteCode],
                                  ['Release version', context?.releaseVersion],
                                  ['Release status', context?.releaseStatus],
                                  ['Publication', context?.publicationCode],
                                  ['Workflow', task.instanceCode],
                                  ['Task', task.code],
                                  ['Requester', context?.requestedBy ?? 'unknown'],
                                ].map(([label, value]) => (
                                  <Box key={label}>
                                    <Typography
                                      color="text.secondary"
                                      sx={{ textTransform: 'uppercase' }}
                                      variant="caption"
                                    >
                                      {label}
                                    </Typography>
                                    <Typography
                                      sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
                                      variant="body2"
                                    >
                                      {value ?? 'not available'}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                              <Alert severity={canDecide ? 'info' : 'warning'}>
                                {canDecide
                                  ? 'Approve publishes the staged documentation release to Online. Reject keeps the current Online documentation unchanged and records the decision in Process.'
                                  : 'This task is no longer waiting for a decision. Refresh the queue to load the latest Process state.'}
                              </Alert>
                            </Stack>
                          </Box>
                        ) : null}
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            ) : null}

            {workflowTasks.length ? (
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
                >
                  <Typography sx={{ flex: '1 1 auto' }} variant="subtitle1">
                    Other workflow tasks
                  </Typography>
                  <TextField
                    disabled={disabled}
                    label="Assign selected task to"
                    onChange={(event) => onAssigneeChange(event.target.value)}
                    placeholder="user, group, or queue code"
                    size="small"
                    sx={{ minWidth: { xs: '100%', md: 280 } }}
                    value={assignee}
                  />
                </Stack>
                {workflowTasks.map((task) => {
                  const actionable = isActionableTask(task);
                  return (
                    <Paper
                      component="article"
                      elevation={0}
                      key={task.code}
                      sx={{ border: 1, borderColor: 'divider', p: 2 }}
                    >
                      <Stack spacing={1.5}>
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={1}
                          sx={{ justifyContent: 'space-between' }}
                        >
                          <Box>
                            <Typography variant="h6">{task.code}</Typography>
                            <Typography color="text.secondary">
                              {task.instanceCode ?? 'unknown instance'} · node{' '}
                              {task.nodeCode ?? 'unknown'} · assignee{' '}
                              {task.assignee ?? 'unassigned'}
                            </Typography>
                          </Box>
                          <Chip
                            color={task.status === 'COMPLETED' ? 'success' : 'warning'}
                            label={task.status}
                          />
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                          <Button
                            disabled={disabled || !actionable || !assignee.trim()}
                            onClick={() => onAssign(task.code)}
                            variant="outlined"
                          >
                            Assign
                          </Button>
                          <Button
                            disabled={disabled || task.status !== 'OPEN'}
                            onClick={() => onClaim(task.code)}
                            variant="outlined"
                          >
                            Claim
                          </Button>
                          <Button
                            disabled={disabled || !actionable}
                            onClick={() => onComplete(task.code)}
                            variant="contained"
                          >
                            Complete
                          </Button>
                          <Button
                            color="error"
                            disabled={disabled || !actionable}
                            onClick={() => onCancel(task.code)}
                            variant="outlined"
                          >
                            Cancel task
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            ) : null}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function TriggerRelationshipView({
  disabled,
  onArchive,
  onCreate,
  onExecute,
  onFieldChange,
  onUpdate,
  triggerCronJobCode,
  triggerDefinitionCode,
  triggerScheduleExpression,
  triggers,
}: {
  readonly disabled: boolean;
  readonly onArchive: (triggerCode: string) => void;
  readonly onCreate: () => void;
  readonly onExecute: (triggerCode: string) => void;
  readonly onFieldChange: (
    field: 'definitionCode' | 'cronJobCode' | 'scheduleExpression',
    value: string,
  ) => void;
  readonly onUpdate: (trigger: ProcessTrigger) => void;
  readonly triggerCronJobCode: string;
  readonly triggerDefinitionCode: string;
  readonly triggerScheduleExpression: string;
  readonly triggers: readonly ProcessTrigger[];
}) {
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ShellIcon name="cronjob" />
          <Typography variant="h5">Scheduled triggers</Typography>
          <Chip label={`${String(triggers.length)} relationships`} variant="outlined" />
        </Stack>
        <Alert severity="info">
          Process owns the trigger relationship. Cron owns actual job scheduling,
          firing, retries, and job lifecycle. This keeps shared processServer topology
          useful without mixing module responsibilities. When a Cron job declares a
          processTrigger target, Cron calls the Process trigger executor and Process
          creates the audited workflow instance.
        </Alert>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr auto' },
          }}
        >
          <TextField
            disabled={disabled}
            label="Process definition code"
            onChange={(event) => onFieldChange('definitionCode', event.target.value)}
            value={triggerDefinitionCode}
          />
          <TextField
            disabled={disabled}
            label="Cron job code"
            onChange={(event) => onFieldChange('cronJobCode', event.target.value)}
            value={triggerCronJobCode}
          />
          <TextField
            disabled={disabled}
            label="Schedule expression"
            onChange={(event) =>
              onFieldChange('scheduleExpression', event.target.value)
            }
            placeholder="0 0 * * *"
            value={triggerScheduleExpression}
          />
          <Button
            disabled={
              disabled || !triggerDefinitionCode.trim() || !triggerCronJobCode.trim()
            }
            onClick={onCreate}
            variant="contained"
          >
            Add trigger
          </Button>
        </Box>
        {triggers.length === 0 ? (
          <Typography color="text.secondary">
            No trigger metadata has been registered yet.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {triggers.map((trigger) => (
              <Paper
                component="article"
                elevation={0}
                key={trigger.code}
                sx={{ border: 1, borderColor: 'divider', p: 2 }}
              >
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  sx={{ justifyContent: 'space-between' }}
                >
                  <Box>
                    <Typography variant="h6">{trigger.code}</Typography>
                    <Typography color="text.secondary">
                      {trigger.definitionCode ?? 'unknown process'} ·{' '}
                      {trigger.triggerType}
                      {trigger.cronJobCode ? ` · cron job ${trigger.cronJobCode}` : ''}
                    </Typography>
                  </Box>
                  <Chip label={trigger.status} />
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                  <Button
                    disabled={disabled || trigger.status !== 'ACTIVE'}
                    onClick={() => onExecute(trigger.code)}
                    variant="contained"
                  >
                    Execute now
                  </Button>
                  <Button
                    disabled={
                      disabled ||
                      trigger.status === 'ACTIVE' ||
                      trigger.status === 'ARCHIVED'
                    }
                    onClick={() => onUpdate(trigger)}
                    variant="outlined"
                  >
                    Activate
                  </Button>
                  <Button
                    color="error"
                    disabled={disabled || trigger.status === 'ARCHIVED'}
                    onClick={() => onArchive(trigger.code)}
                    variant="outlined"
                  >
                    Archive trigger
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function VisualDesignerSkeleton({
  disabled,
  graph,
  onChange,
  onSave,
}: {
  readonly disabled: boolean;
  readonly graph: ProcessGraph | undefined;
  readonly onChange: (graph: ProcessGraph) => void;
  readonly onSave: () => void;
}) {
  const nodes = graph?.nodes ?? [];
  const transitions = graph?.transitions ?? [];
  const [nodeCode, setNodeCode] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [nodeType, setNodeType] = useState<(typeof designerNodeTypes)[number]>('TASK');
  const [sourceCode, setSourceCode] = useState('');
  const [targetCode, setTargetCode] = useState('');

  const updateGraph = (nextGraph: ProcessGraph) => {
    onChange({
      nodes: Object.freeze([...nextGraph.nodes]),
      transitions: Object.freeze([...nextGraph.transitions]),
    });
  };

  const addNode = () => {
    const code = normalizeCode(nodeCode);
    if (!code || nodes.some((node) => node.code === code)) return;
    const nextNode: ProcessGraphNode = {
      code,
      name: nodeName.trim() || code,
      type: nodeType,
      ...(nodeType === 'ACTION'
        ? { action: { moduleName: 'nodics.process', operation: 'noop' } }
        : {}),
      ...(nodeType === 'TIMER' ? { timer: { delayMs: 0, autoContinue: true } } : {}),
      ...(nodeType === 'SUB_PROCESS'
        ? { subProcessDefinitionCode: 'replaceWithProcessDefinitionCode' }
        : {}),
    };
    updateGraph({ nodes: [...nodes, nextNode], transitions });
    setNodeCode('');
    setNodeName('');
  };

  const deleteNode = (code: string) => {
    const node = nodes.find((item) => item.code === code);
    if (!node || ['START', 'END'].includes(node.type)) return;
    updateGraph({
      nodes: nodes.filter((item) => item.code !== code),
      transitions: transitions.filter(
        (transition) => transition.source !== code && transition.target !== code,
      ),
    });
  };

  const connectNodes = () => {
    if (!sourceCode || !targetCode || sourceCode === targetCode) return;
    const code = normalizeCode(`${sourceCode}_to_${targetCode}`);
    if (transitions.some((transition) => transition.code === code)) return;
    updateGraph({
      nodes,
      transitions: [...transitions, { code, source: sourceCode, target: targetCode }],
    });
  };

  const designerIssues = [
    nodes.length === 0 ? 'Create or select a graph before saving.' : undefined,
    nodes.filter((node) => node.type === 'START').length !== 1
      ? 'A valid workflow needs exactly one START node.'
      : undefined,
    nodes.filter((node) => node.type === 'END').length < 1
      ? 'A valid workflow needs at least one END node.'
      : undefined,
  ].filter(Boolean);

  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ShellIcon name="schema" />
          <Typography variant="h5">Visual workflow designer foundation</Typography>
          <Chip label="Nodics-native first" variant="outlined" />
        </Stack>
        <Typography color="text.secondary">
          Add a step, connect it, save the draft, and then let nodics.process validate
          and publish. This MVP intentionally keeps the canvas simple while proving the
          backend-owned graph contract.
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          <SummaryCard
            detail="Nodes are browser layout projections until backend validation accepts them."
            label="Designer nodes"
            value={nodes.length}
          />
          <SummaryCard
            detail="Edges define intended handoffs; backend rejects broken transitions."
            label="Designer edges"
            value={transitions.length}
          />
          <SummaryCard
            detail="Graph JSON and layout metadata remain draft data owned by Process."
            label="Authority"
            value="Backend"
          />
        </Box>
        <Box
          aria-label="Visual workflow designer MVP canvas"
          sx={{
            bgcolor: 'action.hover',
            border: 1,
            borderColor: 'divider',
            borderRadius: axisTokens.radius.large,
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              md:
                nodes.length > 0
                  ? `repeat(${String(Math.min(nodes.length, 4))}, minmax(0, 1fr))`
                  : '1fr',
            },
            minHeight: 220,
            p: { xs: 2, md: 3 },
          }}
        >
          {nodes.length === 0 ? (
            <Stack spacing={1} sx={{ justifyContent: 'center', textAlign: 'center' }}>
              <ShellIcon name="workflow" />
              <Typography variant="h6">
                Create or select a draft to see the canvas
              </Typography>
              <Typography color="text.secondary">
                The MVP designer starts as a safe read/write projection over backend
                graph JSON. Axis can later add drag/drop while nodics.process remains
                the validation authority.
              </Typography>
            </Stack>
          ) : (
            nodes.map((node) => (
              <Paper
                component="article"
                elevation={0}
                key={node.code}
                sx={{
                  alignSelf: 'center',
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor:
                    node.type === 'START'
                      ? 'success.light'
                      : node.type === 'END'
                        ? 'divider'
                        : 'primary.light',
                  p: 2,
                }}
              >
                <Stack spacing={1}>
                  <Chip label={node.type} size="small" variant="outlined" />
                  <Typography variant="h6">{node.name ?? node.code}</Typography>
                  <Typography color="text.secondary" variant="caption">
                    Node code: {node.code}
                  </Typography>
                </Stack>
              </Paper>
            ))
          )}
        </Box>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          }}
        >
          <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="h6">Add workflow step</Typography>
              <TextField
                disabled={disabled}
                label="Step code"
                onChange={(event) => setNodeCode(event.target.value)}
                placeholder="approvalDecision"
                value={nodeCode}
              />
              <TextField
                disabled={disabled}
                label="Step name"
                onChange={(event) => setNodeName(event.target.value)}
                placeholder="Approval decision"
                value={nodeName}
              />
              <TextField
                disabled={disabled}
                label="Step type"
                onChange={(event) =>
                  setNodeType(event.target.value as (typeof designerNodeTypes)[number])
                }
                select
                value={nodeType}
              >
                {designerNodeTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </TextField>
              <Button disabled={disabled || !normalizeCode(nodeCode)} onClick={addNode}>
                Add step
              </Button>
            </Stack>
          </Paper>
          <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="h6">Connect workflow steps</Typography>
              <TextField
                disabled={disabled}
                label="From step"
                onChange={(event) => setSourceCode(event.target.value)}
                select
                value={sourceCode}
              >
                {nodes.map((node) => (
                  <MenuItem key={node.code} value={node.code}>
                    {node.name ?? node.code}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                disabled={disabled}
                label="To step"
                onChange={(event) => setTargetCode(event.target.value)}
                select
                value={targetCode}
              >
                {nodes.map((node) => (
                  <MenuItem key={node.code} value={node.code}>
                    {node.name ?? node.code}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                disabled={disabled || !sourceCode || !targetCode}
                onClick={connectNodes}
              >
                Connect steps
              </Button>
            </Stack>
          </Paper>
        </Box>
        {nodes.length > 0 ? (
          <Stack spacing={1}>
            <Typography variant="h6">Step controls</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              {nodes.map((node) => (
                <Button
                  color="error"
                  disabled={disabled || ['START', 'END'].includes(node.type)}
                  key={node.code}
                  onClick={() => deleteNode(node.code)}
                  variant="outlined"
                >
                  Delete {node.name ?? node.code}
                </Button>
              ))}
            </Stack>
          </Stack>
        ) : null}
        {designerIssues.length > 0 ? (
          <Alert severity="warning">{designerIssues.join(' ')}</Alert>
        ) : (
          <Alert severity="success">
            The local graph shape is ready for backend validation. Save the draft, then
            use Validate draft before publishing.
          </Alert>
        )}
        <Stack direction="row" spacing={1}>
          <Button
            disabled={disabled || designerIssues.length > 0}
            onClick={onSave}
            variant="contained"
          >
            Save designer draft
          </Button>
          <Typography color="text.secondary" sx={{ alignSelf: 'center' }}>
            Axis edits graph JSON only; nodics.process remains validation and runtime
            authority.
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

function DefinitionCard({
  definition,
  disabled,
  onDelete,
  onEdit,
  onPrepare,
  onPublish,
  onSelect,
  onStart,
  onValidate,
  selected,
}: {
  readonly definition: ProcessDefinition;
  readonly disabled: boolean;
  readonly onDelete: () => void;
  readonly onEdit: () => void;
  readonly onPrepare: () => void;
  readonly onPublish: () => void;
  readonly onSelect: () => void;
  readonly onStart: () => void;
  readonly onValidate: () => void;
  readonly selected: boolean;
}) {
  const isDraft = definition.status === 'DRAFT';
  const isPublished = definition.status === 'PUBLISHED';
  return (
    <Paper
      component="article"
      elevation={0}
      sx={{
        border: 1,
        borderColor: selected ? 'primary.main' : 'divider',
        p: { xs: 2.5, md: 3 },
      }}
    >
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">{definition.name}</Typography>
            <Typography color="text.secondary">
              {definition.code} · v{String(definition.currentVersion)} · draft{' '}
              {String(definition.draftRevision)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip
              color={definition.status === 'PUBLISHED' ? 'success' : 'warning'}
              label={definition.status}
            />
            <Chip label={definition.category ?? 'general'} variant="outlined" />
          </Stack>
        </Stack>

        {definition.description ? (
          <Typography color="text.secondary">{definition.description}</Typography>
        ) : null}

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Button
            disabled={disabled}
            onClick={onSelect}
            variant={selected ? 'contained' : 'outlined'}
          >
            Preview
          </Button>
          <Button disabled={disabled || !isDraft} onClick={onEdit} variant="outlined">
            Edit draft
          </Button>
          <Button
            disabled={disabled || !isDraft}
            onClick={onValidate}
            variant="outlined"
          >
            Validate draft
          </Button>
          <Button
            disabled={disabled || !isDraft}
            onClick={onPublish}
            variant="outlined"
          >
            Publish
          </Button>
          <Button
            disabled={disabled || !isPublished}
            onClick={onPrepare}
            variant="outlined"
          >
            Prepare next draft
          </Button>
          <Button
            disabled={disabled || !isPublished}
            onClick={onStart}
            variant="contained"
          >
            Start process
          </Button>
          <Button
            color="error"
            disabled={disabled}
            onClick={onDelete}
            variant="outlined"
          >
            {isDraft ? 'Delete draft' : 'Archive'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

export function ProcessWorkflowRoutePage({
  accessToken,
  bootstrap,
  navigation,
  runtime,
}: ProcessWorkflowRoutePageProps) {
  const queryClient = useQueryClient();
  const processConnection = selectModuleConnection(bootstrap, 'workflow', {
    server: 'processServer',
  });
  const documentationConnection = selectModuleConnection(bootstrap, 'backoffice');
  const documentationSources = bootstrap.documentationSources
    .filter(isCmsDocumentationSource)
    .filter((source) => source.initializationProfile);
  const currentPath =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/process')
      ? window.location.pathname
      : navigation.route;
  const [draftName, setDraftName] = useState('Sample approval process');
  const [selectedCode, setSelectedCode] = useState<string | undefined>();
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [selectedInstanceCode, setSelectedInstanceCode] = useState<
    string | undefined
  >();
  const [taskAssignee, setTaskAssignee] = useState('operationsQueue');
  const [triggerDefinitionCode, setTriggerDefinitionCode] = useState('');
  const [triggerCronJobCode, setTriggerCronJobCode] = useState('');
  const [triggerScheduleExpression, setTriggerScheduleExpression] =
    useState('0 0 * * *');
  const [designerGraphOverlay, setDesignerGraphOverlay] = useState<
    | { readonly definitionCode: string | undefined; readonly graph: ProcessGraph }
    | undefined
  >();

  const configuration = useMemo<ProcessDefinitionClientConfiguration>(
    () => ({
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs],
  );

  const definitions = useQuery({
    enabled: Boolean(processConnection),
    queryKey: [queryKey, runtime.enterpriseCode, processConnection?.endpoint],
    queryFn: () =>
      processConnection
        ? loadProcessDefinitions(processConnection, configuration)
        : Promise.resolve(Object.freeze([])),
  });

  const operations = useQuery({
    enabled: Boolean(processConnection),
    queryKey: [operationsQueryKey, runtime.enterpriseCode, processConnection?.endpoint],
    queryFn: () =>
      processConnection
        ? loadProcessOperationsSummary(processConnection, configuration)
        : Promise.resolve(emptyOperationsSummary),
  });
  const documentationPublicationQueries = useQueries({
    queries: documentationSources.map((source) => ({
      enabled: Boolean(documentationConnection && source.initializationProfile),
      queryKey: [
        'process-task-documentation-publication-context',
        runtime.enterpriseCode,
        source.initializationProfile ?? '',
      ],
      queryFn: () => {
        if (!documentationConnection || !source.initializationProfile) {
          throw new Error('Documentation publication context is unavailable');
        }
        return createDocumentationPublicationClient({
          connection: documentationConnection,
          enterpriseCode: runtime.enterpriseCode,
          accessToken,
          timeoutMs: runtime.requestTimeoutMs,
          profileCode: source.initializationProfile,
        }).getStatus();
      },
    })),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [queryKey] }),
      queryClient.invalidateQueries({ queryKey: [versionsQueryKey] }),
      queryClient.invalidateQueries({ queryKey: [operationsQueryKey] }),
      queryClient.invalidateQueries({ queryKey: [instanceDetailQueryKey] }),
    ]);
  };

  const selectDefinitionForEditing = (definition: ProcessDefinition) => {
    setSelectedCode(definition.code);
    setEditName(definition.name);
    setEditDescription(definition.description ?? '');
    setEditCategory(definition.category ?? 'operations');
    setDesignerGraphOverlay({
      definitionCode: definition.code,
      graph: definition.graph ?? {
        nodes: Object.freeze([]),
        transitions: Object.freeze([]),
      },
    });
  };

  const createDraft = useMutation({
    mutationFn: async () => {
      if (!processConnection) throw new Error('Process API is unavailable');
      const name = draftName.trim() || 'Sample approval process';
      const code = normalizeCode(name).toLowerCase() || `process-${Date.now()}`;
      return createProcessDefinition(processConnection, configuration, {
        code,
        name,
        description:
          'Axis-created sample draft using the Nodics-native START → TASK → END graph contract.',
        category: 'operations',
        graph: createSampleGraph('businessReview'),
      });
    },
    onSuccess: async (definition) => {
      selectDefinitionForEditing(definition);
      await invalidate();
    },
  });

  const validateDraft = useMutation({
    mutationFn: async (definitionCode: string) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      return validateProcessDraft(processConnection, configuration, definitionCode);
    },
    onSuccess: invalidate,
  });

  const publishDraft = useMutation({
    mutationFn: async (definitionCode: string) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      return publishProcessDraft(processConnection, configuration, definitionCode);
    },
    onSuccess: invalidate,
  });

  const deleteDefinition = useMutation({
    mutationFn: async (definitionCode: string) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      return deleteOrArchiveProcessDefinition(
        processConnection,
        configuration,
        definitionCode,
      );
    },
    onSuccess: async () => {
      setSelectedCode(undefined);
      setDesignerGraphOverlay(undefined);
      await invalidate();
    },
  });

  const selectedDefinition =
    definitions.data?.find((definition) => definition.code === selectedCode) ??
    definitions.data?.[0];
  const selectedIsDraft = selectedDefinition?.status === 'DRAFT';
  const selectedOverlay =
    designerGraphOverlay &&
    designerGraphOverlay.definitionCode === selectedDefinition?.code
      ? designerGraphOverlay
      : undefined;
  const designerGraph =
    selectedOverlay !== undefined
      ? selectedOverlay.graph
      : (selectedDefinition?.graph ?? {
          nodes: Object.freeze([]),
          transitions: Object.freeze([]),
        });

  const versions = useQuery({
    enabled: Boolean(processConnection && selectedDefinition),
    queryKey: [
      versionsQueryKey,
      runtime.enterpriseCode,
      processConnection?.endpoint,
      selectedDefinition?.code,
    ],
    queryFn: () =>
      processConnection && selectedDefinition
        ? loadProcessDefinitionVersions(
            processConnection,
            configuration,
            selectedDefinition.code,
          )
        : Promise.resolve(Object.freeze([])),
  });

  const instanceDetail = useQuery({
    enabled: Boolean(processConnection && selectedInstanceCode),
    queryKey: [
      instanceDetailQueryKey,
      runtime.enterpriseCode,
      processConnection?.endpoint,
      selectedInstanceCode,
    ],
    queryFn: () =>
      processConnection && selectedInstanceCode
        ? loadProcessInstanceDetail(
            processConnection,
            configuration,
            selectedInstanceCode,
          )
        : Promise.reject(new Error('Select an instance first')),
  });

  const updateDraft = useMutation({
    mutationFn: async () => {
      if (!processConnection) throw new Error('Process API is unavailable');
      if (!selectedDefinition) throw new Error('Select a process draft first');
      if (!selectedIsDraft)
        throw new Error('Only draft process definitions can be edited');
      return updateProcessDraft(
        processConnection,
        configuration,
        selectedDefinition.code,
        {
          name: editName.trim() || selectedDefinition.name,
          description: editDescription.trim(),
          category: editCategory.trim() || 'operations',
          graph: designerGraph,
        },
      );
    },
    onSuccess: invalidate,
  });

  const prepareNextDraft = useMutation({
    mutationFn: async (definitionCode: string) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      return prepareNextProcessDraft(processConnection, configuration, definitionCode);
    },
    onSuccess: invalidate,
  });

  const startInstance = useMutation({
    mutationFn: async (definitionCode: string) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      return startProcessInstance(processConnection, configuration, definitionCode);
    },
    onSuccess: async () => {
      await invalidate();
    },
  });

  const claimTask = useMutation({
    mutationFn: async (taskCode: string) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      return claimProcessTask(processConnection, configuration, taskCode);
    },
    onSuccess: invalidate,
  });

  const assignTask = useMutation({
    mutationFn: async (taskCode: string) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      const assignee = taskAssignee.trim();
      if (!assignee) throw new Error('Provide an assignee before assigning a task');
      return assignProcessTask(processConnection, configuration, taskCode, assignee);
    },
    onSuccess: invalidate,
  });

  const completeTask = useMutation({
    mutationFn: async ({
      decision,
      taskCode,
    }: {
      readonly decision?: ProcessTaskDecision;
      readonly taskCode: string;
    }) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      return completeProcessTask(processConnection, configuration, taskCode, decision);
    },
    onSuccess: invalidate,
  });

  const cancelTask = useMutation({
    mutationFn: async (taskCode: string) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      return cancelProcessTask(processConnection, configuration, taskCode);
    },
    onSuccess: invalidate,
  });

  const cancelInstance = useMutation({
    mutationFn: async (instanceCode: string) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      return cancelProcessInstance(processConnection, configuration, instanceCode);
    },
    onSuccess: invalidate,
  });

  const retryInstance = useMutation({
    mutationFn: async (incident: ProcessIncident) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      return retryProcessInstance(
        processConnection,
        configuration,
        incident.instanceCode,
        incident.attempt,
      );
    },
    onSuccess: invalidate,
  });

  const compensateInstance = useMutation({
    mutationFn: async (instanceCode: string) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      return compensateProcessInstance(processConnection, configuration, instanceCode);
    },
    onSuccess: invalidate,
  });

  const createTrigger = useMutation({
    mutationFn: async () => {
      if (!processConnection) throw new Error('Process API is unavailable');
      const definitionCode = normalizeCode(triggerDefinitionCode);
      const cronJobCode = normalizeCode(triggerCronJobCode);
      if (!definitionCode || !cronJobCode)
        throw new Error('Provide both process definition and Cron job codes');
      return createProcessTrigger(processConnection, configuration, {
        code: normalizeCode(`${definitionCode}-${cronJobCode}`).toLowerCase(),
        definitionCode,
        triggerType: 'CRON',
        cronJobCode,
        status: 'DRAFT',
        schedule: { expression: triggerScheduleExpression.trim() || '0 0 * * *' },
      });
    },
    onSuccess: invalidate,
  });

  const activateTrigger = useMutation({
    mutationFn: async (trigger: ProcessTrigger) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      const currentSchedule = trigger.schedule?.expression;
      const nextScheduleExpression =
        typeof currentSchedule === 'string' && currentSchedule.trim()
          ? currentSchedule.trim()
          : '0 0 * * *';
      return updateProcessTrigger(processConnection, configuration, trigger.code, {
        status: 'ACTIVE',
        ...(trigger.cronJobCode ? { cronJobCode: trigger.cronJobCode } : {}),
        schedule: { expression: nextScheduleExpression },
      });
    },
    onSuccess: invalidate,
  });

  const archiveTrigger = useMutation({
    mutationFn: async (triggerCode: string) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      return archiveProcessTrigger(processConnection, configuration, triggerCode);
    },
    onSuccess: invalidate,
  });

  const executeTrigger = useMutation({
    mutationFn: async (triggerCode: string) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      return executeProcessTrigger(processConnection, configuration, triggerCode);
    },
    onSuccess: invalidate,
  });

  const definitionCount = definitions.data?.length ?? 0;
  const draftCount =
    definitions.data?.filter((definition) => definition.status === 'DRAFT').length ?? 0;
  const publishedCount =
    definitions.data?.filter((definition) => definition.status === 'PUBLISHED')
      .length ?? 0;
  const selectedIssueCount = selectedDefinition?.validation?.issues.length ?? 0;
  const runningInstanceCount =
    operations.data?.instances.filter((instance) => instance.status === 'RUNNING')
      .length ?? 0;
  const openTaskCount =
    operations.data?.tasks.filter((task) =>
      ['OPEN', 'CLAIMED', 'ESCALATED'].includes(task.status),
    ).length ?? 0;
  const triggerCount = operations.data?.triggers.length ?? 0;
  const incidentCount =
    operations.data?.incidents.filter((incident) =>
      ['OPEN', 'DEAD_LETTER'].includes(incident.status),
    ).length ?? 0;
  const activeWorkspace =
    processWorkspaces.find((workspace) => currentPath.startsWith(workspace.route)) ??
    defaultProcessWorkspace;
  const documentationPublicationContexts = new Map<string, CmsPublicationTaskContext>();
  documentationPublicationQueries.forEach((query, index) => {
    const source = documentationSources[index];
    const publication = query.data;
    const workflowRef = publication?.publication?.workflowRef;
    if (!source || !publication || !workflowRef) return;
    documentationPublicationContexts.set(workflowRef, {
      profileCode: publication.profileCode,
      releaseVersion: publication.releaseVersion,
      siteCode: publication.siteCode,
      sourceLabel: source.label,
      ...(publication.releaseStatus
        ? { releaseStatus: publication.releaseStatus }
        : {}),
      ...(publication.publication?.requestedBy
        ? { requestedBy: publication.publication.requestedBy }
        : {}),
      ...(publication.publication?.code
        ? { publicationCode: publication.publication.code }
        : {}),
    });
  });
  const publicationApprovalTasks =
    operations.data?.tasks.filter(isCmsPublicationApprovalTask) ?? [];
  const actionablePublicationApprovalTasks =
    publicationApprovalTasks.filter(isActionableTask);
  const publicationTasksReadyForDecision = actionablePublicationApprovalTasks.length;
  const busy =
    createDraft.isPending ||
    updateDraft.isPending ||
    validateDraft.isPending ||
    publishDraft.isPending ||
    prepareNextDraft.isPending ||
    deleteDefinition.isPending ||
    startInstance.isPending ||
    claimTask.isPending ||
    assignTask.isPending ||
    completeTask.isPending ||
    cancelTask.isPending ||
    cancelInstance.isPending ||
    retryInstance.isPending ||
    compensateInstance.isPending ||
    createTrigger.isPending ||
    activateTrigger.isPending ||
    executeTrigger.isPending ||
    archiveTrigger.isPending;
  const latestError =
    createDraft.error ??
    updateDraft.error ??
    validateDraft.error ??
    publishDraft.error ??
    prepareNextDraft.error ??
    deleteDefinition.error ??
    startInstance.error ??
    claimTask.error ??
    assignTask.error ??
    completeTask.error ??
    cancelTask.error ??
    cancelInstance.error ??
    retryInstance.error ??
    compensateInstance.error ??
    createTrigger.error ??
    activateTrigger.error ??
    archiveTrigger.error;

  if (activeWorkspace.route === '/process/tasks') {
    return (
      <WorkspaceContainer>
        <Stack spacing={3}>
          <Paper
            component="section"
            elevation={0}
            sx={{ border: 1, borderColor: 'divider', p: { xs: 2.5, md: 3 } }}
          >
            <Stack spacing={2}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                sx={{
                  alignItems: { xs: 'stretch', md: 'flex-start' },
                  justifyContent: 'space-between',
                }}
              >
                <WorkspaceHeading
                  description="Review workflow tasks that are waiting for a business decision. Documentation publication approvals are shown first with their source context."
                  help={navigation.help}
                  eyebrow="Process & Automation"
                  headingVariant="h3"
                  title="Approval tasks"
                />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Chip
                    color={publicationTasksReadyForDecision > 0 ? 'warning' : 'default'}
                    label={`${String(publicationTasksReadyForDecision)} ready for decision`}
                    variant={
                      publicationTasksReadyForDecision > 0 ? 'filled' : 'outlined'
                    }
                  />
                  <Chip
                    color={processConnection ? 'success' : 'warning'}
                    label={
                      processConnection ? processConnection.state : 'API unavailable'
                    }
                    variant={processConnection ? 'filled' : 'outlined'}
                  />
                </Stack>
              </Stack>

              {latestError instanceof Error ? (
                <Alert severity="error">{latestError.message}</Alert>
              ) : operations.isPending ? (
                <Alert severity="info">Loading approval tasks from Process.</Alert>
              ) : publicationApprovalTasks.length ? (
                <Alert severity="warning">
                  {`${String(publicationTasksReadyForDecision)} publication approval task${publicationTasksReadyForDecision === 1 ? '' : 's'} can be reviewed and decided from this page when the signed-in user has approval permission.`}
                </Alert>
              ) : (
                <Alert severity="success">
                  No documentation publication approval tasks are waiting.
                </Alert>
              )}
            </Stack>
          </Paper>

          <TaskInbox
            assignee={taskAssignee}
            disabled={busy}
            onAssigneeChange={setTaskAssignee}
            onAssign={(taskCode) => assignTask.mutate(taskCode)}
            onCancel={(taskCode) => cancelTask.mutate(taskCode)}
            onClaim={(taskCode) => claimTask.mutate(taskCode)}
            onComplete={(taskCode, decision) =>
              completeTask.mutate(decision ? { decision, taskCode } : { taskCode })
            }
            publicationContexts={documentationPublicationContexts}
            tasks={operations.data?.tasks ?? []}
            title="Approval task queue"
          />

          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: {
                xs: '1fr',
                xl: 'minmax(0, 1fr) minmax(0, 1fr)',
              },
            }}
          >
            <RuntimeInstanceList
              disabled={busy}
              instances={operations.data?.instances ?? []}
              onCancel={(instanceCode) => cancelInstance.mutate(instanceCode)}
              onSelect={(instanceCode) => setSelectedInstanceCode(instanceCode)}
              selectedCode={selectedInstanceCode}
            />
            <RecoveryIncidentQueue
              disabled={busy}
              incidents={operations.data?.incidents ?? []}
              onCompensate={(instanceCode) => compensateInstance.mutate(instanceCode)}
              onRetry={(incident) => retryInstance.mutate(incident)}
            />
          </Box>
        </Stack>
      </WorkspaceContainer>
    );
  }

  return (
    <WorkspaceContainer>
      <Stack spacing={3}>
        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
        >
          <Stack spacing={3}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'space-between' }}
            >
              <WorkspaceHeading
                description={
                  navigation.help?.summary ??
                  'Model business processes, validate workflow rules, publish governed definitions, and connect automation without hiding backend control.'
                }
                help={navigation.help}
                eyebrow="Process & Automation"
                headingVariant="h3"
                title={navigation.label}
              />
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Chip label={runtime.enterpriseCode} />
                <Chip
                  color={processConnection ? 'success' : 'warning'}
                  label={
                    processConnection ? processConnection.state : 'API unavailable'
                  }
                  variant={processConnection ? 'filled' : 'outlined'}
                />
                <Chip label={navigation.featureState ?? 'LIVE'} variant="outlined" />
              </Stack>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  lg: 'repeat(4, minmax(0, 1fr))',
                },
              }}
            >
              <ProcessJourneyStep
                detail="Capture the business flow in language a business owner can review before runtime execution exists."
                icon="workflow"
                label="Model"
                state="available"
              />
              <ProcessJourneyStep
                detail="Run backend graph validation so invalid handoffs, missing starts, and broken transitions are caught early."
                icon="schema"
                label="Validate"
                state="available"
              />
              <ProcessJourneyStep
                detail="Publish only validated definitions as immutable versions that operators can audit and promote safely."
                icon="publish"
                label="Publish"
                state="preview"
              />
              <ProcessJourneyStep
                detail="Connect scheduled triggers and cron jobs through module-owned APIs without moving scheduler ownership into Axis."
                icon="cronjob"
                label="Automate"
                state="preview"
              />
            </Box>

            <Alert
              severity={
                latestError ? 'error' : definitions.isError ? 'warning' : 'info'
              }
            >
              {latestError instanceof Error
                ? latestError.message
                : definitions.isError && definitions.error instanceof Error
                  ? definitions.error.message
                  : 'Axis is connected to nodics.process. This workspace is intentionally guided: business users can model and review; backend services validate, version, audit, and execute.'}
            </Alert>
          </Stack>
        </Paper>

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
        >
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h5">Process workspace focus</Typography>
              <Typography color="text.secondary">
                Business users can move through the Process console by intent:
                definitions, operations, scheduled triggers, or designer. Each card
                opens the same backend-owned capability family without creating a second
                workflow authority in Axis.
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
              {processWorkspaces.map((workspace) => (
                <ProcessWorkspaceCard
                  active={activeWorkspace.route === workspace.route}
                  detail={workspace.detail}
                  icon={workspace.icon}
                  key={workspace.route}
                  label={workspace.label}
                  route={workspace.route}
                />
              ))}
            </Box>
          </Stack>
        </Paper>

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(4, minmax(0, 1fr))',
            },
          }}
        >
          <SummaryCard
            detail="Total governed definitions visible to this enterprise."
            label="Definitions"
            value={definitions.isPending ? '—' : definitionCount}
          />
          <SummaryCard
            detail="Editable definitions waiting for validation and publish."
            label="Drafts"
            value={definitions.isPending ? '—' : draftCount}
          />
          <SummaryCard
            detail="Versioned definitions ready for controlled runtime use."
            label="Published"
            value={definitions.isPending ? '—' : publishedCount}
          />
          <SummaryCard
            detail="Validation findings on the selected process preview."
            label="Selected issues"
            value={selectedIssueCount}
          />
        </Box>

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
        >
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'space-between' }}
            >
              <Box>
                <Typography variant="h5">Runtime operations overview</Typography>
                <Typography color="text.secondary">
                  Operations teams need to see whether published processes are producing
                  running instances, human work, and audit evidence. These numbers come
                  from nodics.process read APIs, not from frontend-only assumptions.
                </Typography>
              </Box>
              <Chip
                color={operations.isError ? 'warning' : 'success'}
                label={operations.isError ? 'Inspection limited' : 'Inspection ready'}
                variant={operations.isError ? 'outlined' : 'filled'}
              />
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(4, minmax(0, 1fr))',
                },
              }}
            >
              <SummaryCard
                detail="Active runtime instances currently visible to Axis."
                label="Running instances"
                value={operations.isPending ? '—' : runningInstanceCount}
              />
              <SummaryCard
                detail="Human tasks waiting for action, ownership, or escalation."
                label="Open tasks"
                value={operations.isPending ? '—' : openTaskCount}
              />
              <SummaryCard
                detail="Failed automated actions requiring retry, compensation, or escalation."
                label="Recovery incidents"
                value={operations.isPending ? '—' : incidentCount}
              />
              <SummaryCard
                detail="Process-owned schedule relationships referencing Cron where applicable."
                label="Triggers"
                value={operations.isPending ? '—' : triggerCount}
              />
            </Box>
            {operations.isError && operations.error instanceof Error ? (
              <Alert severity="warning">{operations.error.message}</Alert>
            ) : (
              <Alert severity="info">
                Start a published definition to create an instance and first task.
                Claim, complete, cancel, and timeline views call nodics.process APIs;
                Axis does not calculate runtime state locally.
              </Alert>
            )}
          </Stack>
        </Paper>

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: {
              xs: '1fr',
              xl: 'minmax(0, 1fr) minmax(0, 1fr)',
            },
          }}
        >
          <RuntimeInstanceList
            disabled={busy}
            instances={operations.data?.instances ?? []}
            onCancel={(instanceCode) => cancelInstance.mutate(instanceCode)}
            onSelect={(instanceCode) => setSelectedInstanceCode(instanceCode)}
            selectedCode={selectedInstanceCode}
          />
          <TaskInbox
            assignee={taskAssignee}
            disabled={busy}
            onAssigneeChange={setTaskAssignee}
            onAssign={(taskCode) => assignTask.mutate(taskCode)}
            onCancel={(taskCode) => cancelTask.mutate(taskCode)}
            onClaim={(taskCode) => claimTask.mutate(taskCode)}
            onComplete={(taskCode, decision) =>
              completeTask.mutate(decision ? { decision, taskCode } : { taskCode })
            }
            publicationContexts={documentationPublicationContexts}
            tasks={operations.data?.tasks ?? []}
          />
        </Box>

        <RecoveryIncidentQueue
          disabled={busy}
          incidents={operations.data?.incidents ?? []}
          onCompensate={(instanceCode) => compensateInstance.mutate(instanceCode)}
          onRetry={(incident) => retryInstance.mutate(incident)}
        />

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: {
              xs: '1fr',
              xl: 'minmax(0, 1fr) minmax(0, 1fr)',
            },
          }}
        >
          <Paper
            component="section"
            elevation={0}
            sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
          >
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <ShellIcon name="activity" />
                <Typography variant="h5">Instance timeline</Typography>
                <Chip
                  label={
                    selectedInstanceCode
                      ? instanceDetail.isPending
                        ? 'Loading'
                        : 'Selected'
                      : 'Select instance'
                  }
                  variant="outlined"
                />
              </Stack>
              {!selectedInstanceCode ? (
                <Alert severity="info">
                  Select a process instance to inspect its current state, human tasks,
                  and audit events in one operator-friendly view.
                </Alert>
              ) : instanceDetail.isError && instanceDetail.error instanceof Error ? (
                <Alert severity="warning">{instanceDetail.error.message}</Alert>
              ) : instanceDetail.data ? (
                <Stack spacing={2}>
                  <Paper
                    component="article"
                    elevation={0}
                    sx={{
                      bgcolor: alpha(axisTokens.color.success, 0.06),
                      border: 1,
                      borderColor: 'divider',
                      p: 2,
                    }}
                  >
                    <Typography variant="h6">
                      {instanceDetail.data.instance.code}
                    </Typography>
                    <Typography color="text.secondary">
                      {instanceDetail.data.instance.definitionCode} · status{' '}
                      {instanceDetail.data.instance.status} · node{' '}
                      {instanceDetail.data.instance.currentNode ?? 'unknown'}
                    </Typography>
                  </Paper>
                  <Typography variant="h6">Tasks</Typography>
                  {instanceDetail.data.tasks.length === 0 ? (
                    <Typography color="text.secondary">No tasks recorded.</Typography>
                  ) : (
                    instanceDetail.data.tasks.map((task) => (
                      <Typography color="text.secondary" key={task.code}>
                        {task.code}: {task.status} at {task.nodeCode ?? 'unknown node'}
                      </Typography>
                    ))
                  )}
                  <Typography variant="h6">Audit timeline</Typography>
                  {instanceDetail.data.auditEvents.length === 0 ? (
                    <Typography color="text.secondary">
                      No audit events recorded.
                    </Typography>
                  ) : (
                    instanceDetail.data.auditEvents.map((event, index) => (
                      <Typography
                        color="text.secondary"
                        key={`${event.eventType}-${index}`}
                      >
                        {event.eventType} · {event.outcome}
                      </Typography>
                    ))
                  )}
                </Stack>
              ) : (
                <Typography color="text.secondary">Loading timeline…</Typography>
              )}
            </Stack>
          </Paper>
          <TriggerRelationshipView
            disabled={busy}
            onArchive={(triggerCode) => archiveTrigger.mutate(triggerCode)}
            onCreate={() => createTrigger.mutate()}
            onExecute={(triggerCode) => executeTrigger.mutate(triggerCode)}
            onFieldChange={(field, value) => {
              if (field === 'definitionCode') setTriggerDefinitionCode(value);
              if (field === 'cronJobCode') setTriggerCronJobCode(value);
              if (field === 'scheduleExpression') setTriggerScheduleExpression(value);
            }}
            onUpdate={(trigger) => activateTrigger.mutate(trigger)}
            triggerCronJobCode={triggerCronJobCode}
            triggerDefinitionCode={triggerDefinitionCode}
            triggerScheduleExpression={triggerScheduleExpression}
            triggers={operations.data?.triggers ?? []}
          />
        </Box>

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
        >
          <Stack spacing={2}>
            <Typography variant="h5">Create a beginner-safe process draft</Typography>
            <Typography color="text.secondary">
              Start with a small approval flow that a business user can understand:
              request starts, review task happens, and the process ends. Advanced
              designer features can come later, after the backend contract is proven.
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label="Draft name"
                onChange={(event) => setDraftName(event.target.value)}
                value={draftName}
              />
              <Button
                disabled={!processConnection || busy}
                onClick={() => createDraft.mutate()}
                sx={{ minWidth: 190 }}
                variant="contained"
              >
                Create sample draft
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
        >
          <Stack spacing={2}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              sx={{ justifyContent: 'space-between' }}
            >
              <Box>
                <Typography variant="h5">Edit selected draft</Typography>
                <Typography color="text.secondary">
                  Refine the business-facing name, category, and description before
                  validation. Axis sends these updates to nodics.process; backend
                  validation, versioning, and audit remain the authority.
                </Typography>
              </Box>
              <Chip
                color={selectedIsDraft ? 'warning' : 'default'}
                label={
                  selectedDefinition
                    ? selectedIsDraft
                      ? 'Draft editable'
                      : 'Published read-only'
                    : 'No selection'
                }
                variant="outlined"
              />
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                disabled={!selectedIsDraft || busy}
                fullWidth
                label="Process name"
                onChange={(event) => setEditName(event.target.value)}
                value={editName}
              />
              <TextField
                disabled={!selectedIsDraft || busy}
                label="Category"
                onChange={(event) => setEditCategory(event.target.value)}
                sx={{ minWidth: { md: 220 } }}
                value={editCategory}
              />
            </Stack>
            <TextField
              disabled={!selectedIsDraft || busy}
              fullWidth
              label="Business description"
              minRows={3}
              multiline
              onChange={(event) => setEditDescription(event.target.value)}
              value={editDescription}
            />
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Button
                disabled={!processConnection || !selectedIsDraft || busy}
                onClick={() => updateDraft.mutate()}
                variant="contained"
              >
                Save draft changes
              </Button>
              <Button
                disabled={!selectedIsDraft || busy}
                onClick={() =>
                  selectedDefinition && selectDefinitionForEditing(selectedDefinition)
                }
                variant="outlined"
              >
                Reset fields
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: {
              xs: '1fr',
              xl: 'minmax(0, 1.25fr) minmax(360px, 0.75fr)',
            },
          }}
        >
          <Paper
            component="section"
            elevation={0}
            sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
          >
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="h5">Process definitions</Typography>
                <Chip
                  label={
                    definitions.isPending
                      ? 'Loading'
                      : `${String(definitions.data?.length ?? 0)} definitions`
                  }
                  variant="outlined"
                />
              </Stack>
              <Divider />
              {(definitions.data ?? []).length === 0 ? (
                <Alert severity="info">
                  No process definitions are available yet. Create the sample draft
                  above to see the complete model → validate → publish flow without
                  connecting any domain action or scheduler.
                </Alert>
              ) : (
                <Stack spacing={2}>
                  {(definitions.data ?? []).map((definition) => (
                    <DefinitionCard
                      definition={definition}
                      disabled={busy}
                      key={definition.code}
                      onDelete={() => deleteDefinition.mutate(definition.code)}
                      onEdit={() => selectDefinitionForEditing(definition)}
                      onPrepare={() => prepareNextDraft.mutate(definition.code)}
                      onPublish={() => publishDraft.mutate(definition.code)}
                      onSelect={() => selectDefinitionForEditing(definition)}
                      onStart={() => startInstance.mutate(definition.code)}
                      onValidate={() => validateDraft.mutate(definition.code)}
                      selected={selectedDefinition?.code === definition.code}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>

          <Stack spacing={3}>
            <GraphPreview graph={selectedDefinition?.graph} />
            <VersionHistory
              loading={versions.isPending}
              versions={versions.data ?? []}
            />
            <VisualDesignerSkeleton
              disabled={busy || !selectedIsDraft}
              graph={designerGraph}
              onChange={(graph) =>
                setDesignerGraphOverlay({
                  definitionCode: selectedDefinition?.code,
                  graph,
                })
              }
              onSave={() => updateDraft.mutate()}
            />
          </Stack>
        </Box>
      </Stack>
    </WorkspaceContainer>
  );
}
