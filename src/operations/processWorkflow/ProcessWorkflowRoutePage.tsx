import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import { RulesPolicyReviewPanel } from '../rulesManagement/RulesPolicyReviewPanel';
import { loadRulesReview } from '../rulesManagement/api/rulesReviewClient';
import { MediaPublicationReviewPanel } from '../mediaManagement/components/MediaPublicationReviewPanel';
import { CmsPublicationReviewPanel } from '../contentExperience/components/CmsPublicationReviewPanel';
import type { ReactNode } from 'react';
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
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router';

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
import { createApplicationInitializationClient } from '../setupAccelerators/api/applicationInitializationClient';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  assignProcessTask,
  createProcessDefinition,
  createSampleGraph,
  cancelProcessInstance,
  cancelProcessTask,
  claimProcessTask,
  completeProcessTask,
  compensateProcessInstance,
  deleteOrArchiveProcessDefinition,
  loadProcessInstanceDetail,
  loadProcessDefinitionVersions,
  loadPublishedProcessScheduleVersions,
  loadProcessOperationsSummary,
  loadProcessDefinitions,
  prepareNextProcessDraft,
  ProcessHttpError,
  publishProcessDraft,
  retryProcessInstance,
  startProcessInstance,
  updateProcessDraft,
  validateProcessDraft,
  type ProcessDefinition,
  type ProcessDefinitionClientConfiguration,
  type ProcessHumanTask,
  type ProcessTaskPagination,
  type ProcessIncident,
  type ProcessRuntimeInstance,
  type ProcessOperationsSummary,
  type ProcessTrigger,
  type ProcessDefinitionVersion,
  type ProcessGraph,
  type ProcessGraphNode,
} from './api/processDefinitionClient';

import { WorkflowGraphConnections } from './WorkflowGraphConnections';
import {
  canSubmitProcessTriggerCommand,
  loadProcessCommandCapabilities,
  type ProcessCommandCapabilities,
  type ProcessTriggerCommandKind,
} from './api/processCommandCapabilitiesClient';
import {
  createProcessTriggerCommandIntent,
  executeProcessTriggerCommand,
  inspectProcessTriggerCommandReceipt,
  type ProcessTriggerCommandIntent,
} from './api/processTriggerCommandClient';
import {
  TriggerCommandFeedback,
  type TriggerCommandOutcome,
} from './TriggerCommandFeedback';

interface ProcessWorkflowRoutePageProps {
  readonly accessToken: string;
  readonly sessionGeneration?: number | undefined;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
}

const queryKey = 'process-definitions';
const operationsQueryKey = 'process-operations-summary';
const versionsQueryKey = 'process-definition-versions';
const instanceDetailQueryKey = 'process-instance-detail';
type ProcessTaskDecision = Readonly<Record<string, unknown>>;
type ProcessStartIntent = Readonly<{ definitionCode: string; instanceCode: string }>;
type CmsPublicationTaskContext = Readonly<{
  profileCode?: string;
  releaseStatus?: string;
  releaseVersion?: string;
  releaseCode?: string;
  sourceVersion?: string;
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

/** Typed review classification comes from the validated Process DTO, not owner names. */
function isDeclaredApprovalTask(task: ProcessHumanTask): boolean {
  return task.decisionContract?.kind === 'APPROVAL';
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

function createCmsPublicationRejectionDecision(reason: string): ProcessTaskDecision {
  return Object.freeze({
    approved: false,
    outcome: 'rejected-from-axis',
    reason,
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
  const { format: workflowText } = useAxisLocalization();
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
            <Chip
              color={tone}
              label={workflowText(`process.state.${state.toLowerCase()}`, state)}
              size="small"
              variant="outlined"
            />
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
  const { format: workflowText } = useAxisLocalization();
  return (
    <Paper
      component={RouterLink}
      elevation={0}
      to={route}
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
              label={
                active
                  ? workflowText('process.ui.current-focus', 'Current focus')
                  : workflowText('process.ui.open', 'Open')
              }
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
  const { format: workflowText } = useAxisLocalization();
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
          <Typography variant="h6">
            {workflowText('process.ui.visual-graph-preview', 'Visual graph preview')}
          </Typography>
        </Stack>
        {nodes.length === 0 ? (
          <Typography color="text.secondary">
            {workflowText(
              'process.ui.select-or-create-a-draft-definition-to-preview-the-backend-owned-graph',
              'Select or create a draft definition to preview the backend-owned graph.',
            )}
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
            {nodes.map((node) => (
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
              </Box>
            ))}
          </Box>
        )}
        {graph ? <WorkflowGraphConnections graph={graph} /> : null}
        <Typography color="text.secondary" variant="body2">
          {String(nodes.length)} {workflowText('process.ui.nodes', 'nodes ·')}{' '}
          {String(transitions.length)}{' '}
          {workflowText(
            'process.ui.transitions-axis-stores-layout-intent-only-validation-and-runtime-truth-',
            'transitions. Axis stores layout intent only; validation and runtime truth stay in nodics.process.',
          )}
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
  const { format: workflowText } = useAxisLocalization();
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ShellIcon name="publish" />
          <Typography component="h2" variant="h5">
            {workflowText('process.ui.version-history', 'Version history')}
          </Typography>
          <Chip
            label={
              loading
                ? workflowText('process.ui.loading', 'Loading')
                : `${String(versions.length)} versions`
            }
            variant="outlined"
          />
        </Stack>
        {versions.length === 0 ? (
          <Alert severity="info">
            {workflowText(
              'process.ui.no-immutable-versions-exist-yet-validate-and-publish-a-draft-to-create-t',
              'No immutable versions exist yet. Validate and publish a draft to create the first auditable process version.',
            )}
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
                    <Typography variant="h6">
                      {workflowText('process.ui.version', 'Version')} {version.version}
                    </Typography>
                    <Chip
                      color={version.status === 'PUBLISHED' ? 'success' : 'default'}
                      label={workflowText(
                        `process.state.${version.status.toLowerCase()}`,
                        version.status,
                      )}
                      size="small"
                    />
                  </Stack>
                  <Typography color="text.secondary" variant="body2">
                    {workflowText('process.ui.published-by', 'Published by')}{' '}
                    {version.publishedBy ?? 'unknown'} ·{' '}
                    {version.publishedAt ?? 'date unavailable'}
                  </Typography>
                  <Typography
                    color="text.secondary"
                    sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
                    variant="caption"
                  >
                    {workflowText('process.ui.checksum', 'checksum')}{' '}
                    {version.checksum.slice(0, 24)}
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
  hasEvidence = true,
  instances,
  onCancel,
  onSelect,
  selectedCode,
}: {
  readonly disabled: boolean;
  readonly hasEvidence?: boolean;
  readonly instances: readonly ProcessRuntimeInstance[];
  readonly onCancel: (instanceCode: string) => void;
  readonly onSelect: (instanceCode: string) => void;
  readonly selectedCode: string | undefined;
}) {
  const { format: workflowText } = useAxisLocalization();
  const [search, setSearch] = useState('');
  const visible = instances.filter((instance) =>
    `${instance.code} ${instance.definitionCode ?? ''} ${instance.status}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ShellIcon name="workflow" />
          <Typography component="h2" variant="h5">
            {workflowText('process.ui.process-instances', 'Process instances')}
          </Typography>
          {hasEvidence ? (
            <Chip
              label={workflowText(
                'process.ui.retrieved-count',
                '{count, number} retrieved',
                { count: instances.length },
              )}
              variant="outlined"
            />
          ) : null}
        </Stack>
        <TextField
          disabled={!hasEvidence}
          label={workflowText('process.ui.find-an-instance', 'Find an instance')}
          size="small"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          helperText={workflowText(
            'process.ui.search-the-recently-retrieved-workflow-instances',
            'Search the recently retrieved workflow instances.',
          )}
        />
        {instances.length === 0 ? (
          hasEvidence ? (
            <Alert severity="info">
              {workflowText(
                'process.ui.no-workflow-instances-were-returned-start-a-published-workflow-from-defi',
                'No workflow instances were returned. Start a published workflow from Definitions to create one.',
              )}
            </Alert>
          ) : null
        ) : !visible.length ? (
          <Alert
            severity="info"
            action={
              <Button onClick={() => setSearch('')}>
                {workflowText('process.ui.clear-search', 'Clear search')}
              </Button>
            }
          >
            {workflowText(
              'process.ui.no-matching-instances-in-these-results',
              'No matching instances in these results.',
            )}
          </Alert>
        ) : (
          <Stack
            spacing={1.5}
            sx={{ maxHeight: 560, overflowY: 'auto', minWidth: 0, pr: 0.5 }}
          >
            {visible.map((instance) => (
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
                      <Typography
                        component="h3"
                        variant="h6"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {instance.code}
                      </Typography>
                      <Typography
                        color="text.secondary"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {instance.definitionCode ?? 'unknown definition'} · v
                        {String(instance.version)}{' '}
                        {workflowText('process.ui.node', '· node')}{' '}
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
                      label={workflowText(
                        `process.state.${instance.status.toLowerCase()}`,
                        instance.status,
                      )}
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
                      {workflowText('process.ui.view-timeline', 'View timeline')}
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
                      {workflowText('process.ui.cancel-instance', 'Cancel instance')}
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
  hasEvidence = true,
  incidents,
  onCompensate,
  onRetry,
}: {
  readonly disabled: boolean;
  readonly hasEvidence?: boolean;
  readonly incidents: readonly ProcessIncident[];
  readonly onCompensate: (instanceCode: string) => void;
  readonly onRetry: (incident: ProcessIncident) => void;
}) {
  const { format: workflowText } = useAxisLocalization();
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
          <Typography component="h2" variant="h5">
            {workflowText('process.ui.recovery-incidents', 'Recovery incidents')}
          </Typography>
          {hasEvidence ? (
            <Chip
              label={workflowText(
                'process.ui.actionable-count',
                '{count, number} actionable',
                { count: actionable.length },
              )}
              variant="outlined"
            />
          ) : null}
        </Stack>
        <Typography color="text.secondary">
          {workflowText(
            'process.ui.retry-failed-workflow-actions-or-invoke-their-registered-domain-compensa',
            'Retry failed workflow actions or invoke their registered domain compensation. Process records the recovery; the business module owns state reversal.',
          )}
        </Typography>
        {actionable.length === 0 ? (
          hasEvidence ? (
            <Alert severity="success">
              {workflowText(
                'process.ui.no-workflow-recovery-incidents-need-action',
                'No workflow recovery incidents need action.',
              )}
            </Alert>
          ) : null
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
                      <Typography
                        component="h3"
                        variant="h6"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {incident.instanceCode}
                      </Typography>
                      <Typography color="text.secondary">
                        {incident.nodeCode} · {incident.errorCode}{' '}
                        {workflowText('process.ui.attempt', '· attempt')}{' '}
                        {String(incident.attempt)} {workflowText('process.ui.of', 'of')}{' '}
                        {String(incident.maximumAttempts)}
                      </Typography>
                    </Box>
                    <Chip
                      color={incident.status === 'DEAD_LETTER' ? 'error' : 'warning'}
                      label={workflowText(
                        `process.state.${incident.status.toLowerCase()}`,
                        incident.status,
                      )}
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
                      {workflowText('process.ui.retry-action', 'Retry action')}
                    </Button>
                    <Button
                      color="warning"
                      disabled={disabled || !incident.compensationAvailable}
                      onClick={() => onCompensate(incident.instanceCode)}
                      variant="outlined"
                    >
                      {workflowText('process.ui.run-compensation', 'Run compensation')}
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
  hasEvidence = true,
  onAssigneeChange,
  onAssign,
  onCancel,
  onClaim,
  onComplete,
  onRefresh,
  refreshDisabled,
  publicationContexts,
  tasks,
  pagination,
  onPageChange,
  title = 'Task inbox',
  reviewEvidence,
}: {
  readonly assignee: string;
  readonly disabled: boolean;
  readonly hasEvidence?: boolean;
  readonly onAssigneeChange: (assignee: string) => void;
  readonly onAssign: (taskCode: string) => void;
  readonly onCancel: (taskCode: string) => void;
  readonly onClaim: (taskCode: string) => void;
  readonly onComplete: (taskCode: string, decision?: ProcessTaskDecision) => void;
  readonly onRefresh: () => void;
  readonly refreshDisabled: boolean;
  readonly publicationContexts: ReadonlyMap<string, CmsPublicationTaskContext>;
  readonly tasks: readonly ProcessHumanTask[];
  readonly pagination: ProcessTaskPagination | undefined;
  readonly onPageChange: (page: number) => void;
  readonly title?: string;
  readonly reviewEvidence?: (task: ProcessHumanTask) => ReactNode;
}) {
  const { format: workflowText } = useAxisLocalization();
  const publicationTasks = tasks
    .filter(
      (task) => isCmsPublicationApprovalTask(task) && !isDeclaredApprovalTask(task),
    )
    .filter(isActionableTask);
  const workflowTasks = tasks
    .filter(
      (task) => !isCmsPublicationApprovalTask(task) || isDeclaredApprovalTask(task),
    )
    .filter(isActionableTask);
  const approvalTasks = workflowTasks.filter(isDeclaredApprovalTask);
  const ordinaryTasks = workflowTasks.filter((task) => !isDeclaredApprovalTask(task));
  const [reviewingPublicationTaskCode, setReviewingPublicationTaskCode] =
    useState<string>();
  const [decisionReasons, setDecisionReasons] = useState<Record<string, string>>({});

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
            <Typography component="h2" variant="h5">
              {title}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Button disabled={refreshDisabled} onClick={onRefresh}>
              {workflowText(
                'process.ui.refresh-task-evidence',
                'Refresh task evidence',
              )}
            </Button>
            {hasEvidence ? (
              <>
                <Chip
                  color={
                    publicationTasks.length + approvalTasks.length
                      ? 'warning'
                      : 'default'
                  }
                  label={workflowText(
                    'process.ui.approval-decisions-count',
                    '{count, number} approval decisions',
                    { count: publicationTasks.length + approvalTasks.length },
                  )}
                  variant={
                    publicationTasks.length + approvalTasks.length
                      ? 'filled'
                      : 'outlined'
                  }
                />
                <Chip
                  label={workflowText(
                    'process.ui.other-tasks-count',
                    '{count, number} other tasks',
                    { count: ordinaryTasks.length },
                  )}
                  variant="outlined"
                />
              </>
            ) : null}
          </Stack>
        </Stack>
        {pagination ? (
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Tooltip
              title={workflowText(
                'process.ui.previous-task-page',
                'Previous task page',
              )}
            >
              <span>
                <IconButton
                  aria-label={workflowText(
                    'process.ui.previous-task-page',
                    'Previous task page',
                  )}
                  disabled={refreshDisabled || !pagination.hasPrevious}
                  onClick={() => onPageChange(pagination.page - 1)}
                >
                  <ShellIcon name="chevron-left" />
                </IconButton>
              </span>
            </Tooltip>
            <Typography role="status">
              {workflowText(
                'process.ui.task-page-count',
                'Page {page, number} · {total, number} matching tasks',
                { page: pagination.page, total: pagination.total },
              )}
            </Typography>
            <Tooltip
              title={workflowText('process.ui.next-task-page', 'Next task page')}
            >
              <span>
                <IconButton
                  aria-label={workflowText(
                    'process.ui.next-task-page',
                    'Next task page',
                  )}
                  disabled={refreshDisabled || !pagination.hasNext}
                  onClick={() => onPageChange(pagination.page + 1)}
                >
                  <ShellIcon name="chevron-right" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ) : null}
        {tasks.length === 0 ? (
          hasEvidence ? (
            <Alert severity="info">
              {workflowText(
                'process.ui.no-tasks-on-this-page',
                'No tasks on this page.',
              )}
            </Alert>
          ) : null
        ) : (
          <Stack spacing={1.5}>
            {publicationTasks.length ? (
              <Stack spacing={1}>
                <Typography component="h3" variant="subtitle1">
                  {workflowText(
                    'process.ui.cms-publication-approvals',
                    'CMS publication approvals',
                  )}
                </Typography>
                {publicationTasks.map((task) => {
                  const actionable = isActionableTask(task);
                  const context = publicationContexts.get(task.instanceCode ?? '');
                  const canDecide =
                    actionable && task.reviewerEligibility?.eligible !== false;
                  const reason = (decisionReasons[task.code] ?? '').trim();
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
                              xs: 'minmax(0, 1fr)',
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
                              <Typography
                                component="h4"
                                sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}
                                variant="h6"
                              >
                                {context?.sourceLabel ?? 'CMS publication'}
                              </Typography>
                              <Chip
                                color="warning"
                                label={workflowText(
                                  `process.state.${task.status.toLowerCase()}`,
                                  task.status,
                                )}
                                size="small"
                              />
                            </Stack>
                            <Typography color="text.secondary" variant="body2">
                              {context
                                ? context.profileCode
                                  ? `${context.profileCode} -> ${context.siteCode} · release ${context.releaseVersion ?? 'not available'}`
                                  : `${context.siteCode} · Source version ${context.sourceVersion ?? 'not available'}`
                                : `Workflow ${shortCode(task.instanceCode)} · task ${shortCode(task.code)}`}
                            </Typography>
                            <Typography color="text.secondary" variant="body2">
                              {workflowText('process.ui.requested-by', 'Requested by')}{' '}
                              {context?.requestedBy ?? 'not available'}{' '}
                              {workflowText('process.ui.assigned-to', '· assigned to')}{' '}
                              {task.assignee ?? 'unassigned'}
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
                                ? workflowText('process.ui.hide-review', 'Hide review')
                                : workflowText(
                                    'process.ui.review-evidence',
                                    'Review evidence',
                                  )}
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
                              {workflowText('process.ui.approve', 'Approve')}
                            </Button>
                            <Button
                              color="warning"
                              disabled={
                                disabled ||
                                !canDecide ||
                                reviewingPublicationTaskCode !== task.code ||
                                !reason
                              }
                              onClick={() =>
                                onComplete(
                                  task.code,
                                  createCmsPublicationRejectionDecision(reason),
                                )
                              }
                              size="small"
                              variant="outlined"
                            >
                              {workflowText('process.ui.reject', 'Reject')}
                            </Button>
                          </Stack>
                        </Box>
                        {task.reviewerEligibility ? (
                          <Alert
                            severity={
                              task.reviewerEligibility.eligible ? 'info' : 'warning'
                            }
                          >
                            {task.reviewerEligibility.message}
                          </Alert>
                        ) : null}
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
                                    {workflowText(
                                      'process.ui.review-before-decision',
                                      'Review before decision',
                                    )}
                                  </Typography>
                                  <Typography color="text.secondary" variant="body2">
                                    {workflowText(
                                      'process.ui.this-is-the-staged-cms-publication-evidence-for-the-selected-approval-ta',
                                      'This is the staged CMS publication evidence for the selected approval task.',
                                    )}
                                  </Typography>
                                </Box>
                                <Chip
                                  label={
                                    canDecide
                                      ? workflowText(
                                          'process.ui.decision-available',
                                          'Decision available',
                                        )
                                      : workflowText(
                                          'process.ui.task-is-not-actionable',
                                          'Task is not actionable',
                                        )
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
                                    xs: 'minmax(0, 1fr)',
                                    md: 'repeat(3, minmax(0, 1fr))',
                                  },
                                }}
                              >
                                {[
                                  ['Source', context?.sourceLabel],
                                  ['Target site', context?.siteCode],
                                  ...(context?.profileCode
                                    ? [
                                        ['Staged profile', context.profileCode],
                                        ['Release version', context.releaseVersion],
                                        ['Release', context.releaseCode],
                                        ['Release status', context.releaseStatus],
                                      ]
                                    : []),
                                  ['Source version', context?.sourceVersion],
                                  ['Publication', context?.publicationCode],
                                  ['Workflow', task.instanceCode],
                                  ['Task', task.code],
                                  ['Requester', context?.requestedBy],
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
                              {reviewEvidence?.(task)}
                              <TextField
                                label={workflowText(
                                  'process.ui.reason-for-rejection',
                                  'Reason for rejection',
                                )}
                                helperText={workflowText(
                                  'process.ui.tell-the-author-what-needs-to-change-before-resubmitting',
                                  'Tell the author what needs to change before resubmitting.',
                                )}
                                value={decisionReasons[task.code] ?? ''}
                                onChange={(event) =>
                                  setDecisionReasons((current) => ({
                                    ...current,
                                    [task.code]: event.target.value,
                                  }))
                                }
                                disabled={disabled || !canDecide}
                                slotProps={{ htmlInput: { maxLength: 1000 } }}
                                size="small"
                                multiline
                                minRows={2}
                              />
                              <Alert severity={canDecide ? 'info' : 'warning'}>
                                {canDecide
                                  ? workflowText(
                                      'process.ui.approve-submits-the-publication-decision-to-its-owner-reject-records-the',
                                      'Approve submits the publication decision to its owner. Reject records the decision in Process without publishing this change.',
                                    )
                                  : workflowText(
                                      'process.ui.this-task-is-no-longer-waiting-for-a-decision-refresh-the-queue-to-load-',
                                      'This task is no longer waiting for a decision. Refresh the queue to load the latest Process state.',
                                    )}
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

            {[
              {
                title: workflowText(
                  'process.ui.approval-decisions-title',
                  'Approval decisions',
                ),
                tasks: approvalTasks,
              },
              {
                title: workflowText(
                  'process.ui.other-workflow-tasks',
                  'Other workflow tasks',
                ),
                tasks: ordinaryTasks,
              },
            ]
              .filter((group) => group.tasks.length)
              .map((group) => (
                <Stack spacing={1.5} key={group.title}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1.5}
                    sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
                  >
                    <Typography
                      component="h3"
                      sx={{ flex: '1 1 auto' }}
                      variant="subtitle1"
                    >
                      {group.title}
                    </Typography>
                    <TextField
                      disabled={disabled}
                      label={workflowText(
                        'process.ui.assign-selected-task-to',
                        'Assign selected task to',
                      )}
                      onChange={(event) => onAssigneeChange(event.target.value)}
                      placeholder={workflowText(
                        'process.ui.user-group-or-queue-code',
                        'user, group, or queue code',
                      )}
                      size="small"
                      sx={{ minWidth: { xs: '100%', md: 280 } }}
                      value={assignee}
                    />
                  </Stack>
                  {group.tasks.map((task) => {
                    const actionable = isActionableTask(task);
                    const contract = task.decisionContract;
                    const reason = decisionReasons[task.code] ?? '';
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
                              <Typography
                                component="h4"
                                variant="h6"
                                sx={{ overflowWrap: 'anywhere' }}
                              >
                                {task.name ?? task.reviewContext?.rootCode ?? task.code}
                              </Typography>
                              {(task.name || task.reviewContext) && (
                                <Typography variant="caption" color="text.secondary">
                                  {task.code}
                                </Typography>
                              )}
                              <Typography color="text.secondary">
                                {task.instanceCode ?? 'unknown instance'}{' '}
                                {workflowText('process.ui.node', '· node')}{' '}
                                {task.nodeCode ?? 'unknown'}{' '}
                                {workflowText('process.ui.assignee', '· assignee')}{' '}
                                {task.assignee ?? 'unassigned'}
                              </Typography>
                              {task.reviewContext ? (
                                <Stack spacing={0.5} sx={{ mt: 1 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{ overflowWrap: 'anywhere' }}
                                  >
                                    {task.reviewContext.owner} ·{' '}
                                    {task.reviewContext.rootType}:{' '}
                                    {task.reviewContext.rootCode}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{ overflowWrap: 'anywhere' }}
                                  >
                                    {workflowText(
                                      'process.ui.publication',
                                      'Publication:',
                                    )}{' '}
                                    {task.reviewContext.publicationCode}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{ overflowWrap: 'anywhere' }}
                                  >
                                    {workflowText(
                                      'process.ui.retained-source-version',
                                      'Retained source version:',
                                    )}{' '}
                                    {task.reviewContext.sourceVersion}
                                  </Typography>
                                </Stack>
                              ) : null}
                            </Box>
                            <Chip
                              color={
                                task.status === 'COMPLETED' ? 'success' : 'warning'
                              }
                              label={workflowText(
                                `process.state.${task.status.toLowerCase()}`,
                                task.status,
                              )}
                            />
                          </Stack>
                          {reviewEvidence?.(task)}
                          {task.reviewerEligibility ? (
                            <Alert
                              severity={
                                task.reviewerEligibility.eligible ? 'info' : 'warning'
                              }
                            >
                              {task.reviewerEligibility.message}
                            </Alert>
                          ) : null}
                          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                            <Button
                              disabled={disabled || !actionable || !assignee.trim()}
                              onClick={() => onAssign(task.code)}
                              variant="outlined"
                            >
                              {workflowText('process.ui.assign', 'Assign')}
                            </Button>
                            <Button
                              disabled={disabled || task.status !== 'OPEN'}
                              onClick={() => onClaim(task.code)}
                              variant="outlined"
                            >
                              {workflowText('process.ui.claim', 'Claim')}
                            </Button>
                            {contract ? (
                              <>
                                <TextField
                                  label={contract.reasonLabel}
                                  value={reason}
                                  disabled={disabled || !actionable}
                                  size="small"
                                  slotProps={{
                                    htmlInput: {
                                      maxLength: contract.maximumReasonLength,
                                    },
                                  }}
                                  onChange={(event) =>
                                    setDecisionReasons((current) => ({
                                      ...current,
                                      [task.code]: event.target.value,
                                    }))
                                  }
                                />
                                <Button
                                  disabled={
                                    disabled ||
                                    !actionable ||
                                    task.reviewerEligibility?.eligible === false ||
                                    reason.length > contract.maximumReasonLength
                                  }
                                  onClick={() =>
                                    onComplete(
                                      task.code,
                                      reason.trim()
                                        ? { approved: true, reason: reason.trim() }
                                        : { approved: true },
                                    )
                                  }
                                  variant="contained"
                                >
                                  {contract.approveLabel}
                                </Button>
                                <Button
                                  color="error"
                                  disabled={
                                    disabled ||
                                    !actionable ||
                                    task.reviewerEligibility?.eligible === false ||
                                    !reason.trim() ||
                                    reason.length > contract.maximumReasonLength
                                  }
                                  onClick={() =>
                                    onComplete(task.code, {
                                      approved: false,
                                      reason: reason.trim(),
                                    })
                                  }
                                  variant="outlined"
                                >
                                  {contract.rejectLabel}
                                </Button>
                              </>
                            ) : (
                              <Button
                                disabled={
                                  disabled ||
                                  !actionable ||
                                  task.reviewerEligibility?.eligible === false
                                }
                                onClick={() => onComplete(task.code)}
                                variant="contained"
                              >
                                {workflowText('process.ui.complete', 'Complete')}
                              </Button>
                            )}
                            <Button
                              color="error"
                              disabled={disabled || !actionable}
                              onClick={() => onCancel(task.code)}
                              variant="outlined"
                            >
                              {workflowText('process.ui.cancel-task', 'Cancel task')}
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function TriggerRelationshipView({
  commandAvailability,
  commandCapabilities,
  commandFeedback,
  definitions,
  disabled,
  onArchive,
  onCreate,
  onExecute,
  onFieldChange,
  onUpdate,
  onPin,
  onSelectRelationship,
  onRefresh,
  pinUnconfirmed,
  triggerCronJobCode,
  triggerDefinitionCode,
  triggerScheduleExpression,
  triggerVersion,
  versions,
  versionsUnavailable,
  triggers,
}: {
  readonly commandAvailability: 'CHECKING' | 'UNAVAILABLE' | 'VERIFIED';
  readonly commandCapabilities: ProcessCommandCapabilities | undefined;
  readonly commandFeedback: ReactNode;
  readonly definitions: readonly ProcessDefinition[];
  readonly disabled: boolean;
  readonly onArchive: (triggerCode: string) => void;
  readonly onCreate: () => void;
  readonly onExecute: (triggerCode: string) => void;
  readonly onFieldChange: (
    field: 'definitionCode' | 'cronJobCode' | 'scheduleExpression' | 'version',
    value: string,
  ) => void;
  readonly onUpdate: (trigger: ProcessTrigger) => void;
  readonly onPin: (trigger: ProcessTrigger) => void;
  readonly onSelectRelationship: (trigger: ProcessTrigger) => void;
  readonly onRefresh: () => void;
  readonly pinUnconfirmed: boolean;
  readonly triggerCronJobCode: string;
  readonly triggerDefinitionCode: string;
  readonly triggerScheduleExpression: string;
  readonly triggerVersion: string;
  readonly versions: readonly ProcessDefinitionVersion[];
  readonly versionsUnavailable: boolean;
  readonly triggers: readonly ProcessTrigger[];
}) {
  const { format: workflowText } = useAxisLocalization();
  const proposedCode = normalizeCode(
    `${normalizeCode(triggerDefinitionCode)}-${normalizeCode(triggerCronJobCode)}`,
  ).toLowerCase();
  const existing = triggers.find((trigger) => trigger.code === proposedCode);
  const alreadyListed = Boolean(existing);
  const versionSelected = versions.some(
    (version) => String(version.version) === triggerVersion,
  );
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        p: { xs: 3, md: 4 },
        minWidth: 0,
        overflowWrap: 'anywhere',
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
        >
          <ShellIcon name="cronjob" />
          <Typography component="h2" variant="h5">
            {workflowText('process.ui.scheduled-triggers', 'Scheduled triggers')}
          </Typography>
          <Chip
            label={workflowText(
              'process.ui.relationships-retrieved',
              '{count, plural, one {# relationship retrieved} other {# relationships retrieved}}',
              { count: triggers.length },
            )}
            variant="outlined"
          />
          <Button onClick={onRefresh}>
            {workflowText('process.ui.refresh-relationships', 'Refresh relationships')}
          </Button>
        </Stack>
        {commandAvailability !== 'VERIFIED' ? (
          <Alert severity={commandAvailability === 'UNAVAILABLE' ? 'warning' : 'info'}>
            {commandAvailability === 'UNAVAILABLE'
              ? workflowText(
                  'process.ui.command-availability-could-not-be-verified-refresh-to-check-again',
                  'Command availability could not be verified. Refresh to check again.',
                )
              : workflowText(
                  'process.ui.checking-command-availability',
                  'Checking command availability.',
                )}
          </Alert>
        ) : (['create', 'update', 'archive', 'execute'] as const).some(
            (kind) => !canSubmitProcessTriggerCommand(commandCapabilities, kind),
          ) ? (
          <Alert severity="info">
            {workflowText(
              'process.ui.some-actions-are-unavailable-for-this-session',
              'Some actions are unavailable for this session.',
            )}
          </Alert>
        ) : null}
        {commandFeedback}
        {pinUnconfirmed ? (
          <Alert severity="warning">
            {workflowText(
              'process.ui.the-version-update-is-unconfirmed-refresh-to-inspect-current-relationshi',
              'The version update is unconfirmed. Refresh to inspect current relationship evidence without repeating the command.',
            )}
          </Alert>
        ) : null}
        <Alert severity="info">
          {workflowText(
            'process.ui.choose-the-published-workflow-and-version-this-schedule-should-run-activ',
            'Choose the published workflow and version this schedule should run. Activate the relationship here, then review and activate its schedule in Cron.',
          )}
        </Alert>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '1fr 1fr' },
          }}
        >
          <TextField
            disabled={disabled}
            select
            label={workflowText('process.ui.published-workflow', 'Published workflow')}
            onChange={(event) => onFieldChange('definitionCode', event.target.value)}
            value={triggerDefinitionCode}
          >
            {definitions
              .filter((definition) => definition.status === 'PUBLISHED')
              .map((definition) => (
                <MenuItem key={definition.code} value={definition.code}>
                  {definition.name} · {definition.code}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            disabled={disabled || !versions.length}
            select
            label={workflowText(
              'process.ui.published-workflow-version',
              'Published workflow version',
            )}
            value={triggerVersion}
            onChange={(event) => onFieldChange('version', event.target.value)}
            helperText={
              versionsUnavailable
                ? workflowText(
                    'process.ui.published-versions-are-unavailable-refresh-the-relationship-evidence-bef',
                    'Published versions are unavailable. Refresh the relationship evidence before continuing.',
                  )
                : workflowText(
                    'process.ui.choose-an-immutable-published-version-it-will-remain-pinned-until-explic',
                    'Choose an immutable published version. It will remain pinned until explicitly changed.',
                  )
            }
          >
            {versions.map((version) => (
              <MenuItem key={version.code} value={String(version.version)}>
                {workflowText('process.ui.version', 'Version')}{' '}
                {String(version.version)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            disabled={disabled}
            label={workflowText('process.ui.cron-job-code', 'Cron job code')}
            onChange={(event) => onFieldChange('cronJobCode', event.target.value)}
            value={triggerCronJobCode}
          />
          <TextField
            disabled={disabled}
            label={workflowText(
              'process.ui.schedule-expression',
              'Schedule expression',
            )}
            onChange={(event) =>
              onFieldChange('scheduleExpression', event.target.value)
            }
            helperText={workflowText(
              'process.ui.use-the-timing-approved-for-this-job-in-cron',
              'Use the timing approved for this job in Cron.',
            )}
            value={triggerScheduleExpression}
          />
          <Button
            disabled={
              disabled ||
              !canSubmitProcessTriggerCommand(commandCapabilities, 'create') ||
              alreadyListed ||
              !triggerDefinitionCode.trim() ||
              !triggerCronJobCode.trim() ||
              !triggerScheduleExpression.trim() ||
              !versionSelected
            }
            onClick={onCreate}
            variant="contained"
          >
            {workflowText('process.ui.add-trigger', 'Add trigger')}
          </Button>
        </Box>
        {alreadyListed ? (
          <Stack spacing={1}>
            <Alert severity="info">
              {workflowText(
                'process.ui.this-relationship-is-already-listed-below-select-its-published-version-h',
                'This relationship is already listed below. Select its published version here to update the existing relationship.',
              )}
            </Alert>
            <Button
              disabled={
                disabled ||
                !canSubmitProcessTriggerCommand(commandCapabilities, 'update') ||
                !versionSelected ||
                existing?.version === Number(triggerVersion) ||
                existing?.status === 'ARCHIVED'
              }
              onClick={() => existing && onPin(existing)}
            >
              {workflowText(
                'process.ui.set-published-version',
                'Set published version',
              )}
            </Button>
          </Stack>
        ) : null}
        {triggers.length === 0 ? (
          <Typography color="text.secondary">
            {workflowText(
              'process.ui.no-trigger-metadata-has-been-registered-yet',
              'No trigger metadata has been registered yet.',
            )}
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
                    <Typography
                      component="h3"
                      variant="h6"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {trigger.name ?? trigger.code}
                    </Typography>
                    <Typography color="text.secondary">
                      {trigger.definitionCode ?? 'unknown process'} ·{' '}
                      {trigger.triggerType}
                      {trigger.cronJobCode ? ` · cron job ${trigger.cronJobCode}` : ''}
                    </Typography>
                    {trigger.version ? (
                      <Typography>
                        {workflowText(
                          'process.ui.published-workflow-version',
                          'Published workflow version',
                        )}{' '}
                        {String(trigger.version)}
                      </Typography>
                    ) : (
                      <Alert severity="warning">
                        {workflowText(
                          'process.ui.choose-a-published-workflow-version-before-using-this-relationship-for-a',
                          'Choose a published workflow version before using this relationship for a schedule.',
                        )}
                      </Alert>
                    )}
                  </Box>
                  <Chip
                    label={workflowText(
                      `process.state.${trigger.status.toLowerCase()}`,
                      trigger.status,
                    )}
                  />
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                  <Button
                    disabled={
                      disabled ||
                      !canSubmitProcessTriggerCommand(commandCapabilities, 'execute') ||
                      trigger.status !== 'ACTIVE' ||
                      (trigger.triggerType === 'CRON' && !trigger.version)
                    }
                    onClick={() => onExecute(trigger.code)}
                    variant="contained"
                  >
                    {workflowText('process.ui.execute-now', 'Execute now')}
                  </Button>
                  <Button
                    disabled={
                      disabled ||
                      !canSubmitProcessTriggerCommand(commandCapabilities, 'update') ||
                      (trigger.triggerType === 'CRON' && !trigger.version) ||
                      trigger.status === 'ACTIVE' ||
                      trigger.status === 'ARCHIVED'
                    }
                    onClick={() => onUpdate(trigger)}
                    variant="outlined"
                  >
                    {workflowText('process.ui.activate', 'Activate')}
                  </Button>
                  <Button
                    disabled={disabled || trigger.status === 'ARCHIVED'}
                    onClick={() => onSelectRelationship(trigger)}
                  >
                    {workflowText(
                      'process.ui.choose-workflow-version',
                      'Choose workflow version',
                    )}
                  </Button>
                  <Button
                    color="error"
                    disabled={
                      disabled ||
                      !canSubmitProcessTriggerCommand(commandCapabilities, 'archive') ||
                      trigger.status === 'ARCHIVED'
                    }
                    onClick={() => onArchive(trigger.code)}
                    variant="outlined"
                  >
                    {workflowText('process.ui.archive-trigger', 'Archive trigger')}
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
  const { format: workflowText } = useAxisLocalization();
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
          <Typography component="h2" variant="h5">
            {workflowText('process.ui.workflow-designer', 'Workflow designer')}
          </Typography>
        </Stack>
        <Typography color="text.secondary">
          {workflowText(
            'process.ui.add-and-connect-steps-save-the-draft-then-validate-before-publishing-pub',
            'Add and connect steps, save the draft, then validate before publishing. Published versions are read-only; prepare a new draft to make changes.',
          )}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          <SummaryCard
            detail="Steps in the selected workflow."
            label={workflowText('process.ui.steps', 'Steps')}
            value={nodes.length}
          />
          <SummaryCard
            detail="Handoffs between workflow steps."
            label={workflowText('process.ui.connections', 'Connections')}
            value={transitions.length}
          />
          <SummaryCard
            detail="Changes are saved to a draft before validation and publication."
            label={workflowText('process.ui.editing', 'Editing')}
            value="Draft only"
          />
        </Box>
        <Box
          aria-label={workflowText(
            'process.ui.workflow-designer-canvas',
            'Workflow designer canvas',
          )}
          sx={{
            bgcolor: 'action.hover',
            border: 1,
            borderColor: 'divider',
            borderRadius: axisTokens.radius.large,
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
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
                {workflowText(
                  'process.ui.create-or-select-a-draft-to-see-the-canvas',
                  'Create or select a draft to see the canvas',
                )}
              </Typography>
              <Typography color="text.secondary">
                {workflowText(
                  'process.ui.choose-an-existing-workflow-or-create-a-draft-then-add-and-connect-its-s',
                  'Choose an existing workflow or create a draft, then add and connect its steps.',
                )}
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
                    {workflowText('process.ui.node-code', 'Node code:')} {node.code}
                  </Typography>
                </Stack>
              </Paper>
            ))
          )}
        </Box>
        {graph ? (
          <WorkflowGraphConnections
            graph={graph}
            onRemove={
              disabled
                ? undefined
                : (code) =>
                    updateGraph({
                      nodes,
                      transitions: transitions.filter(
                        (transition) => transition.code !== code,
                      ),
                    })
            }
          />
        ) : null}
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '1fr 1fr' },
          }}
        >
          <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="h6">
                {workflowText('process.ui.add-workflow-step', 'Add workflow step')}
              </Typography>
              <TextField
                disabled={disabled}
                label={workflowText('process.ui.step-code', 'Step code')}
                onChange={(event) => setNodeCode(event.target.value)}
                placeholder={workflowText(
                  'process.ui.approvaldecision',
                  'approvalDecision',
                )}
                value={nodeCode}
              />
              <TextField
                disabled={disabled}
                label={workflowText('process.ui.step-name', 'Step name')}
                onChange={(event) => setNodeName(event.target.value)}
                placeholder={workflowText(
                  'process.ui.approval-decision',
                  'Approval decision',
                )}
                value={nodeName}
              />
              <TextField
                disabled={disabled}
                label={workflowText('process.ui.step-type', 'Step type')}
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
                {workflowText('process.ui.add-step', 'Add step')}
              </Button>
            </Stack>
          </Paper>
          <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="h6">
                {workflowText(
                  'process.ui.connect-workflow-steps',
                  'Connect workflow steps',
                )}
              </Typography>
              <TextField
                disabled={disabled}
                label={workflowText('process.ui.from-step', 'From step')}
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
                label={workflowText('process.ui.to-step', 'To step')}
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
                {workflowText('process.ui.connect-steps', 'Connect steps')}
              </Button>
            </Stack>
          </Paper>
        </Box>
        {nodes.length > 0 ? (
          <Stack spacing={1}>
            <Typography variant="h6">
              {workflowText('process.ui.step-controls', 'Step controls')}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              {nodes.map((node) => (
                <Button
                  color="error"
                  disabled={disabled || ['START', 'END'].includes(node.type)}
                  key={node.code}
                  onClick={() => deleteNode(node.code)}
                  variant="outlined"
                >
                  {workflowText('process.ui.delete', 'Delete')} {node.name ?? node.code}
                </Button>
              ))}
            </Stack>
          </Stack>
        ) : null}
        {designerIssues.length > 0 ? (
          <Alert severity="warning">{designerIssues.join(' ')}</Alert>
        ) : (
          <Alert severity="success">
            {workflowText(
              'process.ui.save-the-draft-then-validate-its-connections-and-step-settings-before-pu',
              'Save the draft, then validate its connections and step settings before publishing.',
            )}
          </Alert>
        )}
        <Stack direction="row" spacing={1}>
          <Button
            disabled={disabled || designerIssues.length > 0}
            onClick={onSave}
            variant="contained"
          >
            {workflowText('process.ui.save-designer-draft', 'Save designer draft')}
          </Button>
          <Typography color="text.secondary" sx={{ alignSelf: 'center' }}>
            {workflowText(
              'process.ui.axis-edits-graph-json-only-nodics-process-remains-validation-and-runtime',
              'Axis edits graph JSON only; nodics.process remains validation and runtime authority.',
            )}
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
  startBlocked,
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
  readonly startBlocked: boolean;
  readonly onValidate: () => void;
  readonly selected: boolean;
}) {
  const { format: workflowText } = useAxisLocalization();
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
              {definition.code} · v{String(definition.currentVersion)}{' '}
              {workflowText('process.ui.draft', '· draft')}{' '}
              {String(definition.draftRevision)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip
              color={definition.status === 'PUBLISHED' ? 'success' : 'warning'}
              label={workflowText(
                `process.state.${definition.status.toLowerCase()}`,
                definition.status,
              )}
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
            {workflowText('process.ui.preview', 'Preview')}
          </Button>
          <Button disabled={disabled || !isDraft} onClick={onEdit} variant="outlined">
            {workflowText('process.ui.edit-draft', 'Edit draft')}
          </Button>
          <Button
            disabled={disabled || !isDraft}
            onClick={onValidate}
            variant="outlined"
          >
            {workflowText('process.ui.validate-draft', 'Validate draft')}
          </Button>
          <Button
            disabled={disabled || !isDraft}
            onClick={onPublish}
            variant="outlined"
          >
            {workflowText('process.ui.publish', 'Publish')}
          </Button>
          <Button
            disabled={disabled || !isPublished}
            onClick={onPrepare}
            variant="outlined"
          >
            {workflowText('process.ui.prepare-next-draft', 'Prepare next draft')}
          </Button>
          <Button
            disabled={startBlocked || disabled || !isPublished}
            onClick={onStart}
            variant="contained"
          >
            {workflowText('process.ui.start-process', 'Start process')}
          </Button>
          <Button
            color="error"
            disabled={disabled}
            onClick={onDelete}
            variant="outlined"
          >
            {isDraft
              ? workflowText('process.ui.delete-draft', 'Delete draft')
              : workflowText('process.ui.archive', 'Archive')}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

/** Retires private Process forms, receipts and observers when the employee or effective Workflow/BackOffice owner identity changes. Equivalent metadata and in-context navigation retain the workspace. */
export function ProcessWorkflowRoutePage(props: ProcessWorkflowRoutePageProps) {
  const actor = useMemo(
    () =>
      props.accessToken
        ? crypto.getRandomValues(new Uint32Array(4)).join('-')
        : 'anonymous',
    [props.accessToken],
  );
  const identity = (connection: ReturnType<typeof selectModuleConnection>) =>
    connection
      ? [
          connection.moduleName,
          connection.instanceId,
          connection.endpoint,
          connection.environment,
          connection.server,
          connection.runtimeRole?.code,
          connection.runtimeRole?.publication,
        ]
      : null;
  const privateScope = JSON.stringify([
    actor,
    props.sessionGeneration,
    props.bootstrap.tenantCode,
    props.runtime.projectCode,
    props.runtime.enterpriseCode,
    identity(selectModuleConnection(props.bootstrap, 'workflow')),
    identity(selectModuleConnection(props.bootstrap, 'backoffice')),
  ]);
  return (
    <ProcessWorkflowWorkspace
      key={privateScope}
      {...props}
      privateScope={privateScope}
    />
  );
}

function ProcessWorkflowWorkspace({
  accessToken,
  sessionGeneration,
  bootstrap,
  navigation,
  runtime,
  privateScope,
}: ProcessWorkflowRoutePageProps & { readonly privateScope: string }) {
  const { format: workflowText } = useAxisLocalization();
  const queryClient = useQueryClient();
  const processConnection = selectModuleConnection(bootstrap, 'workflow');
  const documentationConnection = selectModuleConnection(bootstrap, 'backoffice');
  const documentationSources = bootstrap.documentationSources
    .filter(isCmsDocumentationSource)
    .filter((source) => source.initializationProfile);
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname.startsWith('/process')
    ? location.pathname
    : navigation.route;
  const focusedAuthoring = ['/process/definitions', '/process/designer'].includes(
    currentPath,
  );
  const focusedTriggers = currentPath === '/process/triggers';
  const focusedTasks = currentPath.startsWith('/process/tasks');
  const triggerCommandsVisible = !focusedAuthoring && !focusedTasks;
  const triggerScope = privateScope;
  const [draftName, setDraftName] = useState('Sample approval process');
  const [selectedCode, setSelectedCode] = useState<string | undefined>();
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const instanceReference = new URLSearchParams(location.search).get('instanceCode');
  const selectedInstanceCode =
    instanceReference && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/.test(instanceReference)
      ? instanceReference
      : undefined;
  /** Explicit record inspection uses router history; the URI grants no Process authority. */
  const selectInstance = (code: string) => {
    if (
      selectedInstanceCode === code ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/.test(code)
    )
      return;
    const search = new URLSearchParams(location.search);
    search.set('instanceCode', code);
    void navigate({
      pathname: location.pathname,
      search: `?${search}`,
      hash: location.hash,
    });
  };
  const [taskAssignee, setTaskAssignee] = useState('operationsQueue');
  const [taskPage, setTaskPage] = useState(1);
  const [triggerForm, setTriggerForm] = useState({
    scope: triggerScope,
    definitionCode: '',
    cronJobCode: '',
    scheduleExpression: '',
    version: '',
  });
  const currentTriggerForm =
    triggerForm.scope === triggerScope
      ? triggerForm
      : {
          scope: triggerScope,
          definitionCode: '',
          cronJobCode: '',
          scheduleExpression: '',
          version: '',
        };
  const {
    definitionCode: triggerDefinitionCode,
    cronJobCode: triggerCronJobCode,
    scheduleExpression: triggerScheduleExpression,
    version: triggerVersion,
  } = currentTriggerForm;
  const pinDispatch = useRef<string | undefined>(undefined);
  const triggerDispatch = useRef<ProcessTriggerCommandIntent | undefined>(undefined);
  const triggerEventDispatch = useRef(false);
  const [triggerOutcome, setTriggerOutcome] = useState<TriggerCommandOutcome>();
  const receiptInspectionAbort = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => receiptInspectionAbort.current?.abort(), []);
  /** Rejects repeated UI dispatch synchronously rather than queuing another mutation before React updates disabled controls. */
  const dispatchTriggerAction = (action: () => void) => {
    if (triggerEventDispatch.current || triggerDispatch.current) return;
    triggerEventDispatch.current = true;
    action();
  };
  const releaseTriggerAction = () => {
    triggerEventDispatch.current = false;
  };
  const [designerGraphOverlay, setDesignerGraphOverlay] = useState<
    | { readonly definitionCode: string | undefined; readonly graph: ProcessGraph }
    | undefined
  >();

  const configuration = useMemo<ProcessDefinitionClientConfiguration>(
    () => ({
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      sessionGeneration,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs, sessionGeneration],
  );

  const definitions = useQuery({
    enabled: Boolean(processConnection && !focusedTasks),
    queryKey: [queryKey, triggerScope],
    queryFn: () =>
      processConnection
        ? loadProcessDefinitions(processConnection, configuration)
        : Promise.resolve(Object.freeze([])),
  });

  const commandCapabilities = useQuery({
    enabled: Boolean(processConnection && triggerCommandsVisible),
    queryKey: ['process-command-capabilities', privateScope],
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: ({ signal }) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      return loadProcessCommandCapabilities(processConnection, configuration, signal);
    },
  });
  /** Advisory metadata never replaces current native API authorization. Pending, failed or obsolete evidence cannot enable a command. */
  const requireTriggerCommand = (kind: ProcessTriggerCommandKind) => {
    if (!commandCapabilities.isSuccess || commandCapabilities.fetchStatus !== 'idle')
      throw new Error('Process command availability could not be verified');
    if (!canSubmitProcessTriggerCommand(commandCapabilities.data, kind))
      throw new Error('This action is unavailable for this session');
  };

  const selectedTriggerDefinition = definitions.isSuccess
    ? definitions.data.find(
        (definition) =>
          definition.code === triggerDefinitionCode &&
          definition.status === 'PUBLISHED',
      )
    : undefined;
  const triggerVersions = useQuery({
    enabled: Boolean(processConnection && selectedTriggerDefinition),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryKey: [
      versionsQueryKey,
      privateScope,
      'schedule-selection',
      triggerDefinitionCode,
    ],
    queryFn: async () => {
      if (!processConnection) throw new Error('Process API is unavailable');
      return loadPublishedProcessScheduleVersions(
        processConnection,
        configuration,
        triggerDefinitionCode,
      );
    },
  });
  const selectedTriggerVersion =
    selectedTriggerDefinition && triggerVersions.isSuccess
      ? triggerVersions.data.find((row) => String(row.version) === triggerVersion)
      : undefined;

  const operations = useQuery({
    enabled: Boolean(processConnection),
    retry: false,
    queryKey: [
      operationsQueryKey,
      privateScope,
      runtime.enterpriseCode,
      processConnection?.endpoint,
      taskPage,
    ],
    queryFn: () =>
      processConnection
        ? loadProcessOperationsSummary(processConnection, configuration, taskPage)
        : Promise.resolve(emptyOperationsSummary),
  });
  const apiObservation = focusedAuthoring || focusedTriggers ? definitions : operations;
  const apiUnavailable = !processConnection || apiObservation.isError;
  const apiConfirmed =
    Boolean(processConnection) &&
    apiObservation.isSuccess &&
    !apiObservation.isFetching;
  const apiObservationLabel = apiUnavailable
    ? workflowText('process.state.api-unavailable', 'API unavailable')
    : apiObservation.isFetching
      ? workflowText('process.state.checking-api', 'Checking API')
      : apiConfirmed
        ? workflowText(
            `process.state.${processConnection?.state.toLowerCase() ?? 'unknown'}`,
            processConnection?.state ?? 'API unconfirmed',
          )
        : workflowText('process.state.api-unconfirmed', 'API unconfirmed');
  const cmsTasks = operations.isSuccess
    ? operations.data.tasks.filter(
        (task) =>
          task.reviewContext?.owner === 'cms' && task.reviewContext.rootType === 'site',
      )
    : [];
  const reviewDocumentationSources = documentationSources.filter((source) =>
    cmsTasks.some((task) => task.reviewContext?.rootCode === source.site),
  );
  const documentationPublicationQueries = useQueries({
    queries: reviewDocumentationSources.map((source) => ({
      enabled: Boolean(documentationConnection && source.initializationProfile),
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      queryKey: [
        'process-task-documentation-publication-context',
        privateScope,
        runtime.enterpriseCode,
        documentationConnection?.endpoint,
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

  // Read only uniquely identified authorized profiles needed by visible CMS tasks.
  const applicationProfiles = (
    bootstrap.applicationInitializationProfiles ?? []
  ).filter(
    (profile, index, all) =>
      all.findIndex((candidate) => candidate.code === profile.code) === index &&
      cmsTasks.some((task) => task.reviewContext?.rootCode === profile.siteCode) &&
      new Set(
        all
          .filter((candidate) => candidate.siteCode === profile.siteCode)
          .map((candidate) => candidate.code),
      ).size === 1 &&
      !documentationSources.some(
        (source) => source.initializationProfile === profile.code,
      ),
  );
  const applicationPublicationQueries = useQueries({
    queries: applicationProfiles.map((profile) => ({
      enabled: Boolean(documentationConnection),
      queryKey: [
        'process-task-application-publication-context',
        privateScope,
        runtime.enterpriseCode,
        documentationConnection?.endpoint,
        profile.code,
      ],
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      queryFn: () => {
        if (!documentationConnection)
          throw new Error('Publication context is unavailable');
        return createApplicationInitializationClient({
          connection: documentationConnection,
          enterpriseCode: runtime.enterpriseCode,
          accessToken,
          timeoutMs: runtime.requestTimeoutMs,
          profileCode: profile.code,
        }).getStatus();
      },
    })),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [queryKey, privateScope] }),
      queryClient.invalidateQueries({ queryKey: [versionsQueryKey, privateScope] }),
      queryClient.invalidateQueries({ queryKey: [operationsQueryKey, privateScope] }),
      queryClient.invalidateQueries({
        queryKey: [instanceDetailQueryKey, privateScope],
      }),
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
      privateScope,
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
    retry: false,
    enabled: Boolean(processConnection && selectedInstanceCode),
    queryKey: [
      instanceDetailQueryKey,
      privateScope,
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

  const [uncertainStart, setUncertainStart] = useState<ProcessStartIntent>();
  const startLock = useRef(false);
  const startInstance = useMutation({
    retry: false,
    mutationFn: async (intent: ProcessStartIntent) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      return startProcessInstance(
        processConnection,
        configuration,
        intent.definitionCode,
        intent.instanceCode,
      );
    },
    onSuccess: invalidate,
    onError: (error, intent) => {
      if (
        !(error instanceof ProcessHttpError) ||
        ![400, 401, 403, 404, 422].includes(error.status)
      )
        setUncertainStart(intent);
    },
    onSettled: () => {
      startLock.current = false;
    },
  });
  const inspectStart = useMutation({
    retry: false,
    mutationFn: async (intent: ProcessStartIntent) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      const detail = await loadProcessInstanceDetail(
        processConnection,
        configuration,
        intent.instanceCode,
      );
      if (detail.instance.definitionCode !== intent.definitionCode)
        throw new Error('Process instance does not match the inspected definition');
      return detail.instance;
    },
    onSuccess: () => {
      setUncertainStart(undefined);
      startInstance.reset();
      void invalidate();
    },
  });
  const startWorkflow = (definitionCode: string) => {
    if (!processConnection || startLock.current || uncertainStart) return;
    startLock.current = true;
    inspectStart.reset();
    startInstance.mutate({
      definitionCode,
      instanceCode: `axis-start-${crypto.randomUUID()}`,
    });
  };
  const acknowledgedStart = startInstance.data ?? inspectStart.data;

  const claimTask = useMutation({
    retry: false,
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
    retry: false,
    mutationFn: async ({
      decision,
      taskCode,
    }: {
      readonly decision?: ProcessTaskDecision;
      readonly taskCode: string;
    }) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      if (operations.isError || operations.isFetching || !operations.data)
        throw new Error('Refresh Process task evidence before deciding');
      const task = operations.data.tasks.find((item) => item.code === taskCode);
      if (!task || !isActionableTask(task))
        throw new Error('Process task is no longer actionable');
      if (task.reviewerEligibility?.eligible === false)
        throw new Error(task.reviewerEligibility.message);
      if (task.decisionContract) {
        if (
          !task.instanceCode ||
          !task.nodeCode ||
          !decision ||
          typeof decision.approved !== 'boolean' ||
          Object.keys(decision).some((key) => !['approved', 'reason'].includes(key)) ||
          (decision.reason !== undefined &&
            (typeof decision.reason !== 'string' ||
              decision.reason.length > task.decisionContract.maximumReasonLength)) ||
          (decision.approved === false &&
            (typeof decision.reason !== 'string' || !decision.reason.trim()))
        )
          throw new Error('Process approval decision is invalid');
      }
      if (task.rulesReviewContext && task.instanceCode)
        await loadRulesReview(
          {
            bootstrap,
            accessToken,
            enterpriseCode: runtime.enterpriseCode,
            timeoutMs: runtime.requestTimeoutMs,
          },
          {
            ...task.rulesReviewContext,
            instanceCode: task.instanceCode,
          },
        );
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
  const refreshTaskEvidence = async () => {
    if (!processConnection) return;
    const result = await operations.refetch();
    if (!result.isError && result.data) {
      await queryClient.invalidateQueries({
        queryKey: [instanceDetailQueryKey, privateScope],
      });
      completeTask.reset();
      await queryClient.invalidateQueries({
        queryKey: [
          'process-task-application-publication-context',
          privateScope,
          runtime.enterpriseCode,
        ],
      });
      await queryClient.invalidateQueries({
        queryKey: [
          'process-task-documentation-publication-context',
          privateScope,
          runtime.enterpriseCode,
        ],
      });
    }
  };

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

  /** Keeps one exact private request until a native acknowledgement or explicit original receipt resolves it. A failed command is never replayed by refresh or inspection. */
  const submitTriggerCommand = async (
    kind: ProcessTriggerCommandKind,
    triggerCode: string,
    body: Readonly<Record<string, unknown>>,
    versionPin = false,
  ) => {
    requireTriggerCommand(kind);
    if (!processConnection) throw new Error('Process API is unavailable');
    if (triggerDispatch.current)
      throw new Error('Another trigger request is pending or unconfirmed');
    const capabilities =
      commandCapabilities.isSuccess && commandCapabilities.fetchStatus === 'idle'
        ? commandCapabilities.data
        : undefined;
    if (!capabilities || capabilities.newRecording === 'UNAVAILABLE')
      throw new Error('Process command availability could not be verified');
    const intent = createProcessTriggerCommandIntent(
      kind,
      triggerCode,
      body,
      capabilities.newRecording,
    );
    triggerDispatch.current = intent;
    setTriggerOutcome({ state: 'PENDING', intent, versionPin });
    try {
      const acknowledgement = await executeProcessTriggerCommand(
        processConnection,
        configuration,
        intent,
      );
      setTriggerOutcome({ state: 'ACKNOWLEDGED', intent, versionPin, acknowledgement });
      triggerDispatch.current = undefined;
      return acknowledgement;
    } catch (error: unknown) {
      setTriggerOutcome({ state: 'UNKNOWN', intent, versionPin });
      throw error;
    }
  };

  const createTrigger = useMutation({
    mutationFn: async () => {
      requireTriggerCommand('create');
      if (!processConnection) throw new Error('Process API is unavailable');
      if (!operations.isSuccess || operations.isFetching)
        throw new Error('Refresh relationships to verify current evidence');
      const definitionCode = normalizeCode(triggerDefinitionCode);
      const cronJobCode = normalizeCode(triggerCronJobCode);
      if (!definitionCode || !cronJobCode)
        throw new Error('Provide both process definition and Cron job codes');
      if (
        !selectedTriggerDefinition ||
        !selectedTriggerVersion ||
        !triggerScheduleExpression.trim()
      )
        throw new Error(
          'Select the published workflow, its exact version and schedule timing',
        );
      const code = normalizeCode(`${definitionCode}-${cronJobCode}`).toLowerCase();
      if (operations.data?.triggers.some((trigger) => trigger.code === code))
        throw new Error(
          'This Process trigger relationship already exists. Inspect its current state.',
        );
      return submitTriggerCommand('create', code, {
        code,
        definitionCode,
        version: selectedTriggerVersion.version,
        triggerType: 'CRON',
        cronJobCode,
        status: 'DRAFT',
        schedule: { expression: triggerScheduleExpression.trim() },
      });
    },
    onSuccess: invalidate,
    onSettled: releaseTriggerAction,
  });

  const pinTrigger = useMutation({
    mutationFn: async ({
      trigger,
      scope,
    }: {
      trigger: ProcessTrigger;
      scope: string;
    }) => {
      requireTriggerCommand('update');
      if (
        !processConnection ||
        !selectedTriggerVersion ||
        !selectedTriggerDefinition ||
        scope !== triggerScope ||
        trigger.definitionCode !== selectedTriggerDefinition.code ||
        trigger.status === 'ARCHIVED'
      )
        throw new Error('Select the published version for this existing relationship');
      if (pinDispatch.current === scope)
        throw new Error('Workflow version update is already in progress');
      pinDispatch.current = scope;
      await submitTriggerCommand(
        'update',
        trigger.code,
        { version: selectedTriggerVersion.version },
        true,
      );
    },
    onSuccess: async () => {
      await invalidate();
      pinDispatch.current = undefined;
    },
    onSettled: releaseTriggerAction,
  });

  const activateTrigger = useMutation({
    mutationFn: async (trigger: ProcessTrigger) => {
      requireTriggerCommand('update');
      if (!processConnection) throw new Error('Process API is unavailable');
      if (trigger.triggerType === 'CRON' && !trigger.version)
        throw new Error(
          'Select a published workflow version before activating this schedule relationship',
        );
      // Activation changes only Process relationship status. Preserve all saved
      // schedule metadata and leave actual timer admission/execution with Cron.
      return submitTriggerCommand('update', trigger.code, {
        status: 'ACTIVE',
      });
    },
    onSuccess: invalidate,
    onSettled: releaseTriggerAction,
  });

  const archiveTrigger = useMutation({
    mutationFn: async (triggerCode: string) => {
      requireTriggerCommand('archive');
      if (!processConnection) throw new Error('Process API is unavailable');
      return submitTriggerCommand('archive', triggerCode, {});
    },
    onSuccess: invalidate,
    onSettled: releaseTriggerAction,
  });

  const executeTrigger = useMutation({
    mutationFn: async (triggerCode: string) => {
      requireTriggerCommand('execute');
      if (!processConnection) throw new Error('Process API is unavailable');
      const trigger =
        operations.isSuccess && !operations.isFetching
          ? operations.data.triggers.find((row) => row.code === triggerCode)
          : undefined;
      if (
        !trigger ||
        trigger.status !== 'ACTIVE' ||
        (trigger.triggerType === 'CRON' && !trigger.version)
      )
        throw new Error(
          'Refresh relationships to verify the active published workflow',
        );
      const reference = crypto.randomUUID();
      return submitTriggerCommand('execute', triggerCode, {
        instanceCode: `axis-trigger-${reference}`,
        correlationId: `axis-${reference}`,
        context: { source: 'axis-trigger-console' },
        ...(trigger.version ? { version: trigger.version } : {}),
      });
    },
    onSuccess: invalidate,
    onSettled: releaseTriggerAction,
  });

  const inspectTriggerReceipt = useMutation({
    mutationFn: async (intent: ProcessTriggerCommandIntent) => {
      if (
        !processConnection ||
        triggerDispatch.current !== intent ||
        !commandCapabilities.isSuccess ||
        commandCapabilities.fetchStatus !== 'idle' ||
        commandCapabilities.data.triggerCommands[intent.kind].receiptInspection !==
          'AUTHORIZED'
      )
        throw new Error('Original trigger command evidence is unavailable');
      if (receiptInspectionAbort.current)
        throw new Error('Original receipt inspection is already in progress');
      const controller = new AbortController();
      receiptInspectionAbort.current = controller;
      try {
        return await inspectProcessTriggerCommandReceipt(
          processConnection,
          configuration,
          intent,
          bootstrap.tenantCode,
          controller.signal,
        );
      } finally {
        if (receiptInspectionAbort.current === controller)
          receiptInspectionAbort.current = undefined;
      }
    },
    onSuccess: async (receipt, intent) => {
      if (triggerDispatch.current !== intent) return;
      if (receipt.state === 'OUTCOME_UNKNOWN') {
        setTriggerOutcome((current) =>
          current?.intent === intent ? { ...current, receiptUnknown: true } : current,
        );
        return;
      }
      setTriggerOutcome((current) =>
        current?.intent === intent
          ? { ...current, state: 'ACKNOWLEDGED', acknowledgement: receipt }
          : current,
      );
      triggerDispatch.current = undefined;
      pinDispatch.current = undefined;
      createTrigger.reset();
      pinTrigger.reset();
      activateTrigger.reset();
      archiveTrigger.reset();
      executeTrigger.reset();
      await invalidate();
    },
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
  cmsTasks.forEach((task) => {
    const context = task.reviewContext!;
    if (!task.instanceCode) return;
    documentationPublicationContexts.set(task.instanceCode, {
      sourceLabel: 'CMS publication',
      siteCode: context.rootCode,
      publicationCode: context.publicationCode,
      sourceVersion: context.sourceVersion,
      ...(context.requestedBy ? { requestedBy: context.requestedBy } : {}),
    });
  });
  applicationPublicationQueries.forEach((query, index) => {
    const profile = applicationProfiles[index];
    const status = query.isSuccess ? query.data : undefined;
    const workflowRef = status?.publication?.workflowRef;
    const context = workflowRef
      ? documentationPublicationContexts.get(workflowRef)
      : undefined;
    if (
      !profile ||
      !status ||
      !workflowRef ||
      !context ||
      status.profileCode !== profile.code ||
      status.siteCode !== profile.siteCode ||
      context.siteCode !== status.siteCode ||
      context.publicationCode !== status.publication?.code
    )
      return;
    documentationPublicationContexts.set(workflowRef, {
      ...context,
      sourceLabel: profile.title,
      profileCode: status.profileCode,
      releaseCode: status.releaseCode,
      releaseVersion: status.releaseVersion,
      ...(status.releaseStatus ? { releaseStatus: status.releaseStatus } : {}),
    });
  });
  documentationPublicationQueries.forEach((query, index) => {
    const source = reviewDocumentationSources[index];
    const publication = query.isSuccess ? query.data : undefined;
    const workflowRef = publication?.publication?.workflowRef;
    const context = workflowRef
      ? documentationPublicationContexts.get(workflowRef)
      : undefined;
    if (
      !source ||
      !publication ||
      !workflowRef ||
      !context ||
      publication.profileCode !== source.initializationProfile ||
      publication.siteCode !== source.site ||
      context.siteCode !== publication.siteCode ||
      context.publicationCode !== publication.publication?.code
    )
      return;
    documentationPublicationContexts.set(workflowRef, {
      ...context,
      profileCode: publication.profileCode,
      releaseVersion: publication.releaseVersion,
      siteCode: publication.siteCode,
      sourceLabel: source.label,
      ...(publication.releaseStatus
        ? { releaseStatus: publication.releaseStatus }
        : {}),
      ...(publication.publication?.code
        ? { publicationCode: publication.publication.code }
        : {}),
    });
  });
  const publicationApprovalTasks =
    operations.data?.tasks.filter(
      (task) => isDeclaredApprovalTask(task) || isCmsPublicationApprovalTask(task),
    ) ?? [];
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
    pinTrigger.isPending ||
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
    (uncertainStart ? undefined : startInstance.error) ??
    claimTask.error ??
    assignTask.error ??
    completeTask.error ??
    cancelTask.error ??
    cancelInstance.error ??
    retryInstance.error ??
    compensateInstance.error ??
    createTrigger.error ??
    pinTrigger.error ??
    activateTrigger.error ??
    executeTrigger.error ??
    archiveTrigger.error;

  const renderReviewEvidence = (
    task: ProcessHumanTask,
    placement: 'queue' | 'timeline',
  ) => {
    if (task.rulesReviewContext && task.instanceCode && placement === 'queue')
      return (
        <RulesPolicyReviewPanel
          key={privateScope + task.code + task.rulesReviewContext.draftRevision}
          privateScope={privateScope}
          configuration={{
            bootstrap,
            accessToken,
            enterpriseCode: runtime.enterpriseCode,
            timeoutMs: runtime.requestTimeoutMs,
          }}
          identity={{ ...task.rulesReviewContext, instanceCode: task.instanceCode }}
        />
      );
    const context = task.reviewContext;
    const cmsReview =
      context?.owner === 'cms' &&
      context.rootType === 'site' &&
      ['OPEN', 'CLAIMED', 'ESCALATED'].includes(task.status);
    const mediaReview = context?.owner === 'media' && context.rootType === 'media';
    if (!context || (!cmsReview && !mediaReview)) return null;
    if (cmsReview && placement === 'timeline') return null;
    if (
      mediaReview &&
      placement === 'queue' &&
      task.instanceCode === selectedInstanceCode &&
      instanceDetail.isSuccess &&
      instanceDetail.data.instance.code === selectedInstanceCode &&
      instanceDetail.data.tasks.some(
        (item) =>
          item.code === task.code &&
          item.reviewContext?.publicationCode === context.publicationCode &&
          item.reviewContext.sourceVersion === context.sourceVersion &&
          item.reviewContext.rootCode === context.rootCode,
      )
    )
      return null;
    if (cmsReview && (!task.instanceCode || !processConnection)) return null;
    if (cmsReview && task.instanceCode && processConnection)
      return (
        <CmsPublicationReviewPanel
          connection={processConnection}
          configuration={configuration}
          privateScope={privateScope}
          identity={{
            instanceCode: task.instanceCode,
            taskCode: task.code,
            publicationCode: context.publicationCode,
            sourceVersion: context.sourceVersion,
            siteCode: context.rootCode,
          }}
        />
      );
    return (
      <MediaPublicationReviewPanel
        accessToken={accessToken}
        bootstrap={bootstrap}
        runtime={runtime}
        identity={{
          owner: 'media',
          rootType: 'media',
          rootCode: context.rootCode,
          publicationCode: context.publicationCode,
          sourceVersion: context.sourceVersion,
        }}
      />
    );
  };
  const instanceTimeline = (
    <Paper
      component="section"
      aria-label={workflowText('process.ui.instance-timeline', 'Instance timeline')}
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ShellIcon name="activity" />
          <Typography component="h2" variant="h5">
            {workflowText('process.ui.instance-timeline', 'Instance timeline')}
          </Typography>
          <Chip
            label={
              selectedInstanceCode
                ? instanceDetail.isFetching
                  ? workflowText('process.ui.loading', 'Loading')
                  : workflowText('process.ui.selected', 'Selected')
                : workflowText('process.ui.select-instance', 'Select instance')
            }
            variant="outlined"
          />
        </Stack>
        {!selectedInstanceCode ? (
          <Alert severity="info">
            {workflowText(
              'process.ui.select-a-process-instance-to-inspect-its-current-state-human-tasks-and-a',
              'Select a process instance to inspect its current state, human tasks, and audit events in one operator-friendly view.',
            )}
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
              <Typography component="h3" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
                {instanceDetail.data.instance.code}
              </Typography>
              <Typography color="text.secondary">
                {instanceDetail.data.instance.definitionCode}{' '}
                {workflowText('process.ui.status', '· status')}{' '}
                {workflowText(
                  `process.state.${instanceDetail.data.instance.status.toLowerCase()}`,
                  instanceDetail.data.instance.status,
                )}{' '}
                {workflowText('process.ui.node', '· node')}{' '}
                {instanceDetail.data.instance.currentNode ?? 'unknown'}
              </Typography>
            </Paper>
            <Typography component="h3" variant="h6">
              {workflowText('process.ui.tasks', 'Tasks')}
            </Typography>
            {instanceDetail.data.tasks.length === 0 ? (
              <Typography color="text.secondary">
                {workflowText('process.ui.no-tasks-recorded', 'No tasks recorded.')}
              </Typography>
            ) : (
              instanceDetail.data.tasks.map((task) => (
                <Stack key={task.code} spacing={1.5}>
                  {task.name ? (
                    <Typography
                      component="h4"
                      variant="subtitle1"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {task.name}
                    </Typography>
                  ) : null}
                  {task.recordedDecision && task.decisionContract ? (
                    <Stack spacing={1} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
                      <Chip
                        color={task.recordedDecision.approved ? 'success' : 'warning'}
                        label={
                          task.recordedDecision.approved
                            ? task.decisionContract.approveLabel
                            : task.decisionContract.rejectLabel
                        }
                        sx={{
                          height: 'auto',
                          '& .MuiChip-label': {
                            whiteSpace: 'normal',
                            overflowWrap: 'anywhere',
                          },
                        }}
                      />
                      {task.recordedDecision.reason ? (
                        <Typography
                          sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
                        >
                          {task.decisionContract.reasonLabel}:{' '}
                          {task.recordedDecision.reason}
                        </Typography>
                      ) : null}
                    </Stack>
                  ) : null}
                  <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                    {task.code}:{' '}
                    {workflowText(
                      `process.state.${task.status.toLowerCase()}`,
                      task.status,
                    )}{' '}
                    {workflowText('process.ui.at', 'at')}{' '}
                    {task.nodeCode ?? 'unknown node'}
                  </Typography>
                  {renderReviewEvidence(task, 'timeline')}
                </Stack>
              ))
            )}
            <Typography component="h3" variant="h6">
              {workflowText('process.ui.audit-timeline', 'Audit timeline')}
            </Typography>
            {instanceDetail.data.auditEvents.length === 0 ? (
              <Typography color="text.secondary">
                {workflowText(
                  'process.ui.no-audit-events-recorded',
                  'No audit events recorded.',
                )}
              </Typography>
            ) : (
              instanceDetail.data.auditEvents.map((event, index) => (
                <Typography color="text.secondary" key={`${event.eventType}-${index}`}>
                  {event.eventType} · {event.outcome}
                </Typography>
              ))
            )}
          </Stack>
        ) : (
          <Typography color="text.secondary" role="status">
            {workflowText('process.ui.loading-timeline', 'Loading timeline...')}
          </Typography>
        )}
      </Stack>
    </Paper>
  );

  if (activeWorkspace.route === '/process/tasks') {
    return (
      <WorkspaceContainer>
        <Stack spacing={3} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
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
                  description={workflowText(
                    'process.ui.review-workflow-tasks-that-are-waiting-for-a-business-decision-with-avai',
                    'Review workflow tasks that are waiting for a business decision, with available owner-provided publication evidence.',
                  )}
                  help={navigation.help}
                  eyebrow={workflowText(
                    'process.ui.process-and-automation',
                    'Process & Automation',
                  )}
                  headingVariant="h3"
                  title={workflowText('process.ui.approval-tasks', 'Approval tasks')}
                />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {operations.data !== undefined ? (
                    <Chip
                      color={
                        publicationTasksReadyForDecision > 0 ? 'warning' : 'default'
                      }
                      label={workflowText(
                        'process.ui.awaiting-review-count',
                        '{count, number} awaiting review',
                        { count: publicationTasksReadyForDecision },
                      )}
                      variant={
                        publicationTasksReadyForDecision > 0 ? 'filled' : 'outlined'
                      }
                    />
                  ) : null}
                  <Chip
                    color={
                      apiUnavailable ? 'warning' : apiConfirmed ? 'success' : 'default'
                    }
                    label={apiObservationLabel}
                    variant={apiConfirmed ? 'filled' : 'outlined'}
                  />
                </Stack>
              </Stack>

              {!processConnection ? (
                <Alert severity="warning">
                  {workflowText(
                    'process.ui.the-work-queue-is-unavailable-in-the-current-workspace',
                    'The work queue is unavailable in the current workspace.',
                  )}
                </Alert>
              ) : latestError instanceof Error ? (
                <Alert severity="error">
                  {latestError.message}
                  {completeTask.isError && (
                    <Typography variant="body2">
                      {workflowText(
                        'process.ui.refresh-task-evidence-to-verify-whether-process-recorded-the-decision',
                        'Refresh task evidence to verify whether Process recorded the decision.',
                      )}
                    </Typography>
                  )}
                </Alert>
              ) : operations.isError && operations.error instanceof Error ? (
                <Alert
                  severity="error"
                  action={
                    taskPage > 1 ? (
                      <Button onClick={() => setTaskPage(1)}>
                        {workflowText('process.ui.first-page', 'First page')}
                      </Button>
                    ) : undefined
                  }
                >
                  {operations.error.message}
                </Alert>
              ) : operations.isPending ? (
                <Alert severity="info">
                  {workflowText(
                    'process.ui.loading-approval-tasks-from-process',
                    'Loading approval tasks from Process.',
                  )}
                </Alert>
              ) : operations.isFetching ? (
                <Alert severity="info">
                  {workflowText(
                    'process.ui.refreshing-task-evidence-showing-the-last-retrieved-records',
                    'Refreshing task evidence. Showing the last retrieved records.',
                  )}
                </Alert>
              ) : publicationApprovalTasks.length ? (
                <Alert severity="warning">
                  {workflowText(
                    'process.ui.approval-review-count',
                    '{count, plural, one {# approval task awaiting review.} other {# approval tasks awaiting review.}}',
                    { count: publicationTasksReadyForDecision },
                  )}
                </Alert>
              ) : (
                <Alert severity="info">
                  {workflowText(
                    'process.ui.no-approval-decisions-on-this-page',
                    'No approval decisions on this page.',
                  )}
                </Alert>
              )}
            </Stack>
          </Paper>

          {selectedInstanceCode ? instanceTimeline : null}

          <TaskInbox
            hasEvidence={operations.data !== undefined}
            reviewEvidence={(task) => renderReviewEvidence(task, 'queue')}
            assignee={taskAssignee}
            disabled={
              busy ||
              operations.isFetching ||
              operations.isError ||
              completeTask.isError
            }
            onRefresh={() => {
              void refreshTaskEvidence();
            }}
            refreshDisabled={busy || operations.isFetching || !processConnection}
            onAssigneeChange={setTaskAssignee}
            onAssign={(taskCode) => assignTask.mutate(taskCode)}
            onCancel={(taskCode) => cancelTask.mutate(taskCode)}
            onClaim={(taskCode) => claimTask.mutate(taskCode)}
            onComplete={(taskCode, decision) =>
              completeTask.mutate(decision ? { decision, taskCode } : { taskCode })
            }
            publicationContexts={documentationPublicationContexts}
            tasks={operations.data?.tasks ?? []}
            pagination={operations.data?.taskPagination}
            onPageChange={setTaskPage}
            title={workflowText(
              'process.ui.approval-task-queue',
              'Approval task queue',
            )}
          />

          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                xl: 'minmax(0, 1fr) minmax(0, 1fr)',
              },
            }}
          >
            <RuntimeInstanceList
              hasEvidence={operations.data !== undefined}
              disabled={
                busy ||
                operations.isFetching ||
                operations.isError ||
                !processConnection
              }
              instances={operations.data?.instances ?? []}
              onCancel={(instanceCode) => cancelInstance.mutate(instanceCode)}
              onSelect={selectInstance}
              selectedCode={selectedInstanceCode}
            />
            {!operations.data?.incidentsAccessDenied && (
              <RecoveryIncidentQueue
                hasEvidence={operations.data !== undefined}
                disabled={
                  busy ||
                  operations.isFetching ||
                  operations.isError ||
                  !processConnection
                }
                incidents={operations.data?.incidents ?? []}
                onCompensate={(instanceCode) => compensateInstance.mutate(instanceCode)}
                onRetry={(incident) => retryInstance.mutate(incident)}
              />
            )}
          </Box>
        </Stack>
      </WorkspaceContainer>
    );
  }

  return (
    <WorkspaceContainer>
      <Stack spacing={3} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
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
                eyebrow={workflowText(
                  'process.ui.process-and-automation',
                  'Process & Automation',
                )}
                headingVariant="h3"
                title={navigation.label}
              />
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Chip label={runtime.enterpriseCode} />
                <Chip
                  color={
                    apiUnavailable ? 'warning' : apiConfirmed ? 'success' : 'default'
                  }
                  label={apiObservationLabel}
                  variant={apiConfirmed ? 'filled' : 'outlined'}
                />
                <Chip label={navigation.featureState ?? 'LIVE'} variant="outlined" />
              </Stack>
            </Stack>

            {!focusedAuthoring && !focusedTriggers && (
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    lg: 'repeat(4, minmax(0, 1fr))',
                  },
                }}
              >
                <ProcessJourneyStep
                  detail="Capture the business flow in language a business owner can review before runtime execution exists."
                  icon="workflow"
                  label={workflowText('process.ui.model', 'Model')}
                  state="available"
                />
                <ProcessJourneyStep
                  detail="Run backend graph validation so invalid handoffs, missing starts, and broken transitions are caught early."
                  icon="schema"
                  label={workflowText('process.ui.validate', 'Validate')}
                  state="available"
                />
                <ProcessJourneyStep
                  detail="Publish only validated definitions as immutable versions that operators can audit and promote safely."
                  icon="publish"
                  label={workflowText('process.ui.publish', 'Publish')}
                  state="preview"
                />
                <ProcessJourneyStep
                  detail="Connect scheduled triggers and cron jobs through module-owned APIs without moving scheduler ownership into Axis."
                  icon="cronjob"
                  label={workflowText('process.ui.automate', 'Automate')}
                  state="preview"
                />
              </Box>
            )}
            <Alert
              severity={
                latestError ? 'error' : definitions.isError ? 'warning' : 'info'
              }
            >
              {latestError instanceof Error
                ? latestError.message
                : definitions.isError && definitions.error instanceof Error
                  ? definitions.error.message
                  : workflowText(
                      'process.ui.axis-is-connected-to-nodics-process-this-workspace-is-intentionally-guid',
                      'Axis is connected to nodics.process. This workspace is intentionally guided: business users can model and review; backend services validate, version, audit, and execute.',
                    )}
            </Alert>
          </Stack>
        </Paper>

        {uncertainStart && (
          <Alert
            severity="warning"
            action={
              <Button
                disabled={!processConnection || inspectStart.isPending}
                onClick={() => inspectStart.mutate(uncertainStart)}
              >
                {workflowText(
                  'process.ui.inspect-original-start',
                  'Inspect original start',
                )}
              </Button>
            }
          >
            {inspectStart.isError
              ? workflowText(
                  'process.ui.process-could-not-confirm-the-original-start-starting-another-workflow-i',
                  'Process could not confirm the original start. Starting another workflow is on hold.',
                )
              : workflowText(
                  'process.ui.the-start-outcome-is-uncertain-inspect-the-original-workflow-before-star',
                  'The start outcome is uncertain. Inspect the original workflow before starting another.',
                )}{' '}
            {workflowText('process.ui.reference', 'Reference')}{' '}
            {uncertainStart.instanceCode}.
          </Alert>
        )}
        {acknowledgedStart && (
          <Alert
            severity="success"
            action={
              <Button
                component={RouterLink}
                to={`/process/tasks?instanceCode=${encodeURIComponent(acknowledgedStart.code)}`}
              >
                {workflowText(
                  'process.ui.open-started-workflow',
                  'Open started workflow',
                )}
              </Button>
            }
          >
            {workflowText(
              'process.ui.workflow-started-reference',
              'Workflow started. Reference:',
            )}{' '}
            {acknowledgedStart.code}
          </Alert>
        )}
        {focusedAuthoring || focusedTriggers ? (
          <Stack
            component="nav"
            aria-label={workflowText(
              'process.ui.process-workspaces',
              'Process workspaces',
            )}
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: 'wrap' }}
          >
            {processWorkspaces.map((workspace) => (
              <Button
                component={RouterLink}
                to={workspace.route}
                key={workspace.route}
                variant={
                  activeWorkspace.route === workspace.route ? 'contained' : 'outlined'
                }
                aria-current={
                  activeWorkspace.route === workspace.route ? 'page' : undefined
                }
              >
                {workspace.label}
              </Button>
            ))}
          </Stack>
        ) : (
          <Paper
            component="section"
            elevation={0}
            sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
          >
            <Stack spacing={2.5}>
              <Box>
                <Typography component="h2" variant="h5">
                  {workflowText(
                    'process.ui.process-workspace-focus',
                    'Process workspace focus',
                  )}
                </Typography>
                <Typography color="text.secondary">
                  {workflowText(
                    'process.ui.business-users-can-move-through-the-process-console-by-intent-definition',
                    'Business users can move through the Process console by intent: definitions, operations, scheduled triggers, or designer. Each card opens the same backend-owned capability family without creating a second workflow authority in Axis.',
                  )}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
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
        )}
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'repeat(4, minmax(0, 1fr))',
            },
          }}
        >
          <SummaryCard
            detail="Total governed definitions visible to this enterprise."
            label={workflowText('process.ui.definitions', 'Definitions')}
            value={definitions.isPending ? '—' : definitionCount}
          />
          <SummaryCard
            detail="Editable definitions waiting for validation and publish."
            label={workflowText('process.ui.drafts', 'Drafts')}
            value={definitions.isPending ? '—' : draftCount}
          />
          <SummaryCard
            detail="Versioned definitions ready for controlled runtime use."
            label={workflowText('process.ui.published', 'Published')}
            value={definitions.isPending ? '—' : publishedCount}
          />
          <SummaryCard
            detail="Validation findings on the selected process preview."
            label={workflowText('process.ui.selected-issues', 'Selected issues')}
            value={selectedIssueCount}
          />
        </Box>

        {!focusedAuthoring && !focusedTriggers && (
          <>
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
                    <Typography component="h2" variant="h5">
                      {workflowText(
                        'process.ui.runtime-operations-overview',
                        'Runtime operations overview',
                      )}
                    </Typography>
                    <Typography color="text.secondary">
                      {workflowText(
                        'process.ui.operations-teams-need-to-see-whether-published-processes-are-producing-r',
                        'Operations teams need to see whether published processes are producing running instances, human work, and audit evidence. These numbers come from nodics.process read APIs, not from frontend-only assumptions.',
                      )}
                    </Typography>
                  </Box>
                  <Chip
                    color={operations.isError ? 'warning' : 'success'}
                    label={
                      operations.isError
                        ? workflowText(
                            'process.ui.inspection-limited',
                            'Inspection limited',
                          )
                        : workflowText(
                            'process.ui.inspection-ready',
                            'Inspection ready',
                          )
                    }
                    variant={operations.isError ? 'outlined' : 'filled'}
                  />
                </Stack>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: {
                      xs: 'minmax(0, 1fr)',
                      md: 'repeat(4, minmax(0, 1fr))',
                    },
                  }}
                >
                  <SummaryCard
                    detail="Active runtime instances currently visible to Axis."
                    label={workflowText(
                      'process.ui.running-instances',
                      'Running instances',
                    )}
                    value={operations.isPending ? '—' : runningInstanceCount}
                  />
                  <SummaryCard
                    detail="Human tasks waiting for action, ownership, or escalation."
                    label={workflowText('process.ui.open-tasks', 'Open tasks')}
                    value={operations.isPending ? '—' : openTaskCount}
                  />
                  <SummaryCard
                    detail="Failed automated actions requiring retry, compensation, or escalation."
                    label={workflowText(
                      'process.ui.recovery-incidents',
                      'Recovery incidents',
                    )}
                    value={operations.isPending ? '—' : incidentCount}
                  />
                  <SummaryCard
                    detail="Process-owned schedule relationships referencing Cron where applicable."
                    label={workflowText('process.ui.triggers', 'Triggers')}
                    value={operations.isPending ? '—' : triggerCount}
                  />
                </Box>
                {operations.isError && operations.error instanceof Error ? (
                  <Alert severity="warning">{operations.error.message}</Alert>
                ) : (
                  <Alert severity="info">
                    {workflowText(
                      'process.ui.start-a-published-definition-to-create-an-instance-and-first-task-claim-',
                      'Start a published definition to create an instance and first task. Claim, complete, cancel, and timeline views call nodics.process APIs; Axis does not calculate runtime state locally.',
                    )}
                  </Alert>
                )}
              </Stack>
            </Paper>

            <Box
              sx={{
                display: 'grid',
                gap: 3,
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  xl: 'minmax(0, 1fr) minmax(0, 1fr)',
                },
              }}
            >
              <RuntimeInstanceList
                hasEvidence={operations.data !== undefined}
                disabled={
                  busy ||
                  operations.isFetching ||
                  operations.isError ||
                  !processConnection
                }
                instances={operations.data?.instances ?? []}
                onCancel={(instanceCode) => cancelInstance.mutate(instanceCode)}
                onSelect={selectInstance}
                selectedCode={selectedInstanceCode}
              />
              <TaskInbox
                hasEvidence={operations.data !== undefined}
                reviewEvidence={(task) => renderReviewEvidence(task, 'queue')}
                assignee={taskAssignee}
                disabled={
                  busy ||
                  operations.isFetching ||
                  operations.isError ||
                  completeTask.isError
                }
                onRefresh={() => {
                  void refreshTaskEvidence();
                }}
                refreshDisabled={busy || operations.isFetching || !processConnection}
                onAssigneeChange={setTaskAssignee}
                onAssign={(taskCode) => assignTask.mutate(taskCode)}
                onCancel={(taskCode) => cancelTask.mutate(taskCode)}
                onClaim={(taskCode) => claimTask.mutate(taskCode)}
                onComplete={(taskCode, decision) =>
                  completeTask.mutate(decision ? { decision, taskCode } : { taskCode })
                }
                publicationContexts={documentationPublicationContexts}
                tasks={operations.data?.tasks ?? []}
                pagination={operations.data?.taskPagination}
                onPageChange={setTaskPage}
              />
            </Box>

            {!operations.data?.incidentsAccessDenied && (
              <RecoveryIncidentQueue
                hasEvidence={operations.data !== undefined}
                disabled={
                  busy ||
                  operations.isFetching ||
                  operations.isError ||
                  !processConnection
                }
                incidents={operations.data?.incidents ?? []}
                onCompensate={(instanceCode) => compensateInstance.mutate(instanceCode)}
                onRetry={(incident) => retryInstance.mutate(incident)}
              />
            )}
          </>
        )}
        {!focusedAuthoring && (
          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                xl: 'minmax(0, 1fr) minmax(0, 1fr)',
              },
            }}
          >
            {!focusedTriggers && instanceTimeline}
            <TriggerRelationshipView
              commandAvailability={
                commandCapabilities.isError
                  ? 'UNAVAILABLE'
                  : !commandCapabilities.isSuccess ||
                      commandCapabilities.fetchStatus !== 'idle'
                    ? 'CHECKING'
                    : commandCapabilities.data.newRecording === 'UNAVAILABLE'
                      ? 'UNAVAILABLE'
                      : 'VERIFIED'
              }
              commandCapabilities={
                commandCapabilities.isSuccess &&
                commandCapabilities.fetchStatus === 'idle'
                  ? commandCapabilities.data
                  : undefined
              }
              commandFeedback={
                <TriggerCommandFeedback
                  outcome={triggerOutcome}
                  inspecting={inspectTriggerReceipt.isPending}
                  inspectionError={inspectTriggerReceipt.error}
                  canInspect={Boolean(
                    triggerOutcome?.intent.idempotencyKey &&
                    commandCapabilities.isSuccess &&
                    commandCapabilities.fetchStatus === 'idle' &&
                    commandCapabilities.data.triggerCommands[triggerOutcome.intent.kind]
                      .receiptInspection === 'AUTHORIZED',
                  )}
                  onInspect={() => {
                    if (triggerOutcome?.state === 'UNKNOWN')
                      inspectTriggerReceipt.mutate(triggerOutcome.intent);
                  }}
                />
              }
              definitions={definitions.isSuccess ? definitions.data : []}
              disabled={
                busy ||
                triggerOutcome?.state === 'PENDING' ||
                triggerOutcome?.state === 'UNKNOWN' ||
                (pinTrigger.isError && pinTrigger.variables.scope === triggerScope) ||
                operations.isError ||
                operations.isFetching ||
                !operations.isSuccess ||
                !commandCapabilities.isSuccess ||
                commandCapabilities.fetchStatus !== 'idle' ||
                commandCapabilities.data?.newRecording === 'UNAVAILABLE'
              }
              pinUnconfirmed={
                pinTrigger.isError &&
                pinTrigger.variables.scope === triggerScope &&
                triggerOutcome?.state !== 'UNKNOWN'
              }
              onRefresh={() => {
                void operations.refetch();
                void commandCapabilities.refetch();
              }}
              onArchive={(triggerCode) =>
                dispatchTriggerAction(() => archiveTrigger.mutate(triggerCode))
              }
              onCreate={() => dispatchTriggerAction(() => createTrigger.mutate())}
              onExecute={(triggerCode) =>
                dispatchTriggerAction(() => executeTrigger.mutate(triggerCode))
              }
              onFieldChange={(field, value) => {
                setTriggerForm({
                  ...currentTriggerForm,
                  [field]: value,
                  ...(field === 'definitionCode' ? { version: '' } : {}),
                });
              }}
              onUpdate={(trigger) =>
                dispatchTriggerAction(() => activateTrigger.mutate(trigger))
              }
              onPin={(trigger) =>
                dispatchTriggerAction(() =>
                  pinTrigger.mutate({ trigger, scope: triggerScope }),
                )
              }
              onSelectRelationship={(trigger) =>
                setTriggerForm({
                  scope: triggerScope,
                  definitionCode: trigger.definitionCode ?? '',
                  cronJobCode: trigger.cronJobCode ?? '',
                  scheduleExpression:
                    typeof trigger.schedule?.expression === 'string'
                      ? trigger.schedule.expression
                      : '',
                  version: '',
                })
              }
              triggerCronJobCode={triggerCronJobCode}
              triggerDefinitionCode={triggerDefinitionCode}
              triggerScheduleExpression={triggerScheduleExpression}
              triggerVersion={triggerVersion}
              versions={
                selectedTriggerDefinition && triggerVersions.isSuccess
                  ? triggerVersions.data
                  : []
              }
              versionsUnavailable={triggerVersions.isError}
              triggers={operations.data?.triggers ?? []}
            />
          </Box>
        )}
        {!focusedTriggers && (
          <>
            <Paper
              component="section"
              elevation={0}
              sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
            >
              <Stack spacing={2}>
                <Typography component="h2" variant="h5">
                  {workflowText(
                    'process.ui.create-a-workflow-draft',
                    'Create a workflow draft',
                  )}
                </Typography>
                <Typography color="text.secondary">
                  {workflowText(
                    'process.ui.start-with-a-request-a-review-task-and-an-end-step-edit-the-steps-valida',
                    'Start with a request, a review task, and an end step. Edit the steps, validate the flow, and publish when it is ready.',
                  )}
                </Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    fullWidth
                    label={workflowText('process.ui.draft-name', 'Draft name')}
                    onChange={(event) => setDraftName(event.target.value)}
                    value={draftName}
                  />
                  <Button
                    disabled={!processConnection || busy}
                    onClick={() => createDraft.mutate()}
                    sx={{ minWidth: 190 }}
                    variant="contained"
                  >
                    {workflowText(
                      'process.ui.create-workflow-draft',
                      'Create workflow draft',
                    )}
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
                    <Typography component="h2" variant="h5">
                      {workflowText(
                        'process.ui.edit-selected-draft',
                        'Edit selected draft',
                      )}
                    </Typography>
                    <Typography color="text.secondary">
                      {workflowText(
                        'process.ui.update-the-name-category-and-business-description-save-changes-then-vali',
                        'Update the name, category, and business description. Save changes, then validate the draft before publishing.',
                      )}
                    </Typography>
                  </Box>
                  <Chip
                    color={selectedIsDraft ? 'warning' : 'default'}
                    label={
                      selectedDefinition
                        ? selectedIsDraft
                          ? workflowText('process.ui.draft-editable', 'Draft editable')
                          : workflowText(
                              'process.ui.published-read-only',
                              'Published read-only',
                            )
                        : workflowText('process.ui.no-selection', 'No selection')
                    }
                    variant="outlined"
                  />
                </Stack>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    disabled={!selectedIsDraft || busy}
                    fullWidth
                    label={workflowText('process.ui.process-name', 'Process name')}
                    onChange={(event) => setEditName(event.target.value)}
                    value={editName}
                  />
                  <TextField
                    disabled={!selectedIsDraft || busy}
                    label={workflowText('process.ui.category', 'Category')}
                    onChange={(event) => setEditCategory(event.target.value)}
                    sx={{ minWidth: { md: 220 } }}
                    value={editCategory}
                  />
                </Stack>
                <TextField
                  disabled={!selectedIsDraft || busy}
                  fullWidth
                  label={workflowText(
                    'process.ui.business-description',
                    'Business description',
                  )}
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
                    {workflowText(
                      'process.ui.save-draft-changes',
                      'Save draft changes',
                    )}
                  </Button>
                  <Button
                    disabled={!selectedIsDraft || busy}
                    onClick={() =>
                      selectedDefinition &&
                      selectDefinitionForEditing(selectedDefinition)
                    }
                    variant="outlined"
                  >
                    {workflowText('process.ui.reset-fields', 'Reset fields')}
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            <Box
              sx={{
                display: 'grid',
                gap: 3,
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
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
                    <Typography component="h2" variant="h5">
                      {workflowText(
                        'process.ui.process-definitions',
                        'Process definitions',
                      )}
                    </Typography>
                    <Chip
                      label={
                        definitions.isPending
                          ? workflowText('process.ui.loading', 'Loading')
                          : `${String(definitions.data?.length ?? 0)} definitions`
                      }
                      variant="outlined"
                    />
                  </Stack>
                  <Divider />
                  {(definitions.data ?? []).length === 0 ? (
                    <Alert severity="info">
                      {workflowText(
                        'process.ui.no-process-definitions-are-available-yet-create-the-sample-draft-above-t',
                        'No process definitions are available yet. Create the sample draft above to see the complete model → validate → publish flow without connecting any domain action or scheduler.',
                      )}
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
                          onStart={() => startWorkflow(definition.code)}
                          startBlocked={Boolean(uncertainStart)}
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
                {currentPath === '/process/definitions' ? (
                  <Button
                    component={RouterLink}
                    to="/process/designer"
                    variant="outlined"
                  >
                    {workflowText(
                      'process.ui.open-workflow-designer',
                      'Open workflow designer',
                    )}
                  </Button>
                ) : (
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
                )}
              </Stack>
            </Box>
          </>
        )}
      </Stack>
    </WorkspaceContainer>
  );
}
