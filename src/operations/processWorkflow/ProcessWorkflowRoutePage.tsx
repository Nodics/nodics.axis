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
  type AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  createProcessDefinition,
  createSampleGraph,
  cancelProcessInstance,
  cancelProcessTask,
  claimProcessTask,
  completeProcessTask,
  deleteOrArchiveProcessDefinition,
  loadProcessInstanceDetail,
  loadProcessDefinitionVersions,
  loadProcessOperationsSummary,
  loadProcessDefinitions,
  prepareNextProcessDraft,
  publishProcessDraft,
  startProcessInstance,
  updateProcessDraft,
  validateProcessDraft,
  type ProcessDefinition,
  type ProcessDefinitionClientConfiguration,
  type ProcessHumanTask,
  type ProcessRuntimeInstance,
  type ProcessOperationsSummary,
  type ProcessTrigger,
  type ProcessDefinitionVersion,
  type ProcessGraph,
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
const emptyOperationsSummary: ProcessOperationsSummary = Object.freeze({
  auditEvents: Object.freeze([]),
  instances: Object.freeze([]),
  tasks: Object.freeze([]),
  triggers: Object.freeze([]),
});

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

function TaskInbox({
  disabled,
  onCancel,
  onClaim,
  onComplete,
  tasks,
}: {
  readonly disabled: boolean;
  readonly onCancel: (taskCode: string) => void;
  readonly onClaim: (taskCode: string) => void;
  readonly onComplete: (taskCode: string) => void;
  readonly tasks: readonly ProcessHumanTask[];
}) {
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ShellIcon name="task" />
          <Typography variant="h5">Task inbox</Typography>
          <Chip label={`${String(tasks.length)} tasks`} variant="outlined" />
        </Stack>
        {tasks.length === 0 ? (
          <Alert severity="info">
            No human workflow tasks are waiting. Tasks appear here when a published
            process reaches a TASK node.
          </Alert>
        ) : (
          <Stack spacing={1.5}>
            {tasks.map((task) => {
              const actionable = ['OPEN', 'CLAIMED', 'ESCALATED'].includes(task.status);
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
        )}
      </Stack>
    </Paper>
  );
}

function TriggerRelationshipView({
  triggers,
}: {
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
          useful without mixing module responsibilities.
        </Alert>
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
              </Paper>
            ))}
          </Stack>
        )}
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
  const processConnection = selectModuleConnection(bootstrap, 'process');
  const [draftName, setDraftName] = useState('Sample approval process');
  const [selectedCode, setSelectedCode] = useState<string | undefined>();
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [selectedInstanceCode, setSelectedInstanceCode] = useState<
    string | undefined
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
      await invalidate();
    },
  });

  const selectedDefinition =
    definitions.data?.find((definition) => definition.code === selectedCode) ??
    definitions.data?.[0];
  const selectedIsDraft = selectedDefinition?.status === 'DRAFT';

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

  const completeTask = useMutation({
    mutationFn: async (taskCode: string) => {
      if (!processConnection) throw new Error('Process API is unavailable');
      return completeProcessTask(processConnection, configuration, taskCode);
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
  const auditEventCount = operations.data?.auditEvents.length ?? 0;
  const triggerCount = operations.data?.triggers.length ?? 0;
  const busy =
    createDraft.isPending ||
    updateDraft.isPending ||
    validateDraft.isPending ||
    publishDraft.isPending ||
    prepareNextDraft.isPending ||
    deleteDefinition.isPending ||
    startInstance.isPending ||
    claimTask.isPending ||
    completeTask.isPending ||
    cancelTask.isPending ||
    cancelInstance.isPending;
  const latestError =
    createDraft.error ??
    updateDraft.error ??
    validateDraft.error ??
    publishDraft.error ??
    prepareNextDraft.error ??
    deleteDefinition.error ??
    startInstance.error ??
    claimTask.error ??
    completeTask.error ??
    cancelTask.error ??
    cancelInstance.error;

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
                eyebrow="Business Process & Automation"
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
                detail="Recent bounded evidence available for operator review."
                label="Audit events"
                value={operations.isPending ? '—' : auditEventCount}
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
            disabled={busy}
            onCancel={(taskCode) => cancelTask.mutate(taskCode)}
            onClaim={(taskCode) => claimTask.mutate(taskCode)}
            onComplete={(taskCode) => completeTask.mutate(taskCode)}
            tasks={operations.data?.tasks ?? []}
          />
        </Box>

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
          <TriggerRelationshipView triggers={operations.data?.triggers ?? []} />
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
            <Paper
              component="section"
              elevation={0}
              sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
            >
              <Stack spacing={1.5}>
                <Typography variant="h5">Designer implementation direction</Typography>
                <Typography color="text.secondary">
                  Use a Nodics-native graph designer first so the screen stays simple
                  for business users and safe for operators. Add BPMN import/export as
                  an adapter later for interoperability, not as the runtime truth.
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Guardrail: Axis may edit graph JSON and layout metadata; backend
                  validation, publish versioning, audit, and execution remain owned by
                  nodics.process.
                </Typography>
              </Stack>
            </Paper>
          </Stack>
        </Box>
      </Stack>
    </WorkspaceContainer>
  );
}
