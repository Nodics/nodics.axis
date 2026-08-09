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
import { useEffect, useMemo, useState } from 'react';

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
  deleteOrArchiveProcessDefinition,
  loadProcessOperationsSummary,
  loadProcessDefinitions,
  publishProcessDraft,
  updateProcessDraft,
  validateProcessDraft,
  type ProcessDefinition,
  type ProcessDefinitionClientConfiguration,
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

function DefinitionCard({
  definition,
  disabled,
  onDelete,
  onEdit,
  onPublish,
  onSelect,
  onValidate,
  selected,
}: {
  readonly definition: ProcessDefinition;
  readonly disabled: boolean;
  readonly onDelete: () => void;
  readonly onEdit: () => void;
  readonly onPublish: () => void;
  readonly onSelect: () => void;
  readonly onValidate: () => void;
  readonly selected: boolean;
}) {
  const isDraft = definition.status === 'DRAFT';
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
        : Promise.resolve({
            auditEvents: Object.freeze([]),
            instances: Object.freeze([]),
            tasks: Object.freeze([]),
          }),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: [queryKey] });
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

  useEffect(() => {
    if (selectedDefinition) selectDefinitionForEditing(selectedDefinition);
  }, [selectedDefinition?.code]);

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
  const busy =
    createDraft.isPending ||
    updateDraft.isPending ||
    validateDraft.isPending ||
    publishDraft.isPending ||
    deleteDefinition.isPending;
  const latestError =
    createDraft.error ??
    updateDraft.error ??
    validateDraft.error ??
    publishDraft.error ??
    deleteDefinition.error;

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
                  md: 'repeat(3, minmax(0, 1fr))',
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
            </Box>
            {operations.isError && operations.error instanceof Error ? (
              <Alert severity="warning">{operations.error.message}</Alert>
            ) : (
              <Alert severity="info">
                Execution controls will be added after the runtime engine contract is
                finished. For now, Axis gives business users a safe operational view and
                keeps lifecycle mutation behind backend-owned APIs.
              </Alert>
            )}
          </Stack>
        </Paper>

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
                      onPublish={() => publishDraft.mutate(definition.code)}
                      onSelect={() => selectDefinitionForEditing(definition)}
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
