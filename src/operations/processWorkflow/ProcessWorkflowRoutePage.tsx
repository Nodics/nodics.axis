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
  deleteOrArchiveProcessDefinition,
  loadProcessDefinitions,
  publishProcessDraft,
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

function normalizeCode(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 128);
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
  onPublish,
  onSelect,
  onValidate,
  selected,
}: {
  readonly definition: ProcessDefinition;
  readonly disabled: boolean;
  readonly onDelete: () => void;
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

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: [queryKey] });
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
      setSelectedCode(definition.code);
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
  const busy =
    createDraft.isPending ||
    validateDraft.isPending ||
    publishDraft.isPending ||
    deleteDefinition.isPending;
  const latestError =
    createDraft.error ??
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
          <Stack spacing={2}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'space-between' }}
            >
              <WorkspaceHeading
                description={
                  navigation.help?.summary ??
                  'Create, validate, publish, archive, and inspect backend-governed workflow definitions through nodics.process.'
                }
                help={navigation.help}
                eyebrow="Governed process operations"
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

            <Alert
              severity={
                latestError ? 'error' : definitions.isError ? 'warning' : 'info'
              }
            >
              {latestError instanceof Error
                ? latestError.message
                : definitions.isError && definitions.error instanceof Error
                  ? definitions.error.message
                  : 'Axis is connected to nodics.process. The visual designer remains a projection over backend validation; runtime execution and domain actions stay server-owned.'}
            </Alert>
          </Stack>
        </Paper>

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
        >
          <Stack spacing={2}>
            <Typography variant="h5">Create process draft</Typography>
            <Typography color="text.secondary">
              This creates a beginner-safe sample draft with START, TASK, and END nodes.
              Later designer iterations can add drag/drop layout, domain-action
              palettes, and BPMN import/export adapters.
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
                <Typography color="text.secondary">
                  No process definitions are available yet.
                </Typography>
              ) : (
                <Stack spacing={2}>
                  {(definitions.data ?? []).map((definition) => (
                    <DefinitionCard
                      definition={definition}
                      disabled={busy}
                      key={definition.code}
                      onDelete={() => deleteDefinition.mutate(definition.code)}
                      onPublish={() => publishDraft.mutate(definition.code)}
                      onSelect={() => setSelectedCode(definition.code)}
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
                  Use a Nodics-native graph designer first. Add BPMN import/export as an
                  adapter later for interoperability, not as the runtime truth.
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
