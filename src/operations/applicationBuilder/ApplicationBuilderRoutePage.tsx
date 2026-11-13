/** @module applicationBuilder/route @description Owner-declared planning and optional Local build; Installer owns eligibility and execution. */
import {
  Alert,
  Button,
  Chip,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisNavigationItem,
  type AxisModuleConnection,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import {
  builderRequest,
  parseBuilderInfo,
  parseBuilderOperations,
  parseBuilderPlan,
  parseLocalBuildReceipt,
  type BuilderConfiguration,
  type BuilderInfo,
  type BuilderPlan,
  type BuilderPlanInput,
  type BuilderOperation,
  type LocalBuildReceipt,
} from './api/applicationBuilderClient';
interface Props {
  readonly accessToken: string;
  readonly sessionGeneration: number;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
  readonly routeNavigation: AxisNavigationItem;
}
/** Retires private drafts and results when actor, scope or exact owner changes. */
export function ApplicationBuilderRoutePage(props: Props) {
  const owner = selectModuleConnection(
    props.bootstrap,
    'installer',
    props.routeNavigation.backendWorkspace?.ownerSelector,
  );
  if (!owner)
    return (
      <Alert severity="warning">
        Builder availability is unconfirmed. Refresh the authorized workspace.
      </Alert>
    );
  return (
    <BuilderSession
      key={JSON.stringify([
        props.sessionGeneration,
        props.bootstrap.tenantCode,
        props.runtime.enterpriseCode,
        owner.instanceId,
        owner.endpoint,
        props.routeNavigation.lifecycleActions,
      ])}
      {...props}
      owner={owner}
    />
  );
}
function BuilderSession(props: Props & { readonly owner: AxisModuleConnection }) {
  const configuration: BuilderConfiguration = {
    accessToken: props.accessToken,
    sessionGeneration: props.sessionGeneration,
    enterpriseCode: props.runtime.enterpriseCode,
    timeoutMs: props.runtime.requestTimeoutMs,
  };
  const data = useQuery({
    queryKey: [
      'application-builder',
      props.sessionGeneration,
      props.bootstrap.tenantCode,
      configuration.enterpriseCode,
      props.owner.instanceId,
      props.owner.endpoint,
    ],
    retry: false,
    queryFn: async ({ signal }) => {
      const [info, operations] = await Promise.all([
        builderRequest(props.owner, configuration, 'info', undefined, signal),
        builderRequest(props.owner, configuration, 'operations', undefined, signal),
      ]);
      return {
        info: parseBuilderInfo(info),
        operations: parseBuilderOperations(operations),
      };
    },
  });
  if (data.isPending)
    return (
      <WorkspaceContainer>
        <Typography role="status">Checking Builder availability…</Typography>
      </WorkspaceContainer>
    );
  if (data.isError)
    return (
      <WorkspaceContainer>
        <Stack spacing={2}>
          <WorkspaceHeading title={props.routeNavigation.label} />
          <Alert severity="warning">{data.error.message}</Alert>
          <Button onClick={() => void data.refetch()}>Refresh availability</Button>
        </Stack>
      </WorkspaceContainer>
    );
  return (
    <BuilderForm
      {...props}
      configuration={configuration}
      info={data.data.info}
      operations={data.data.operations}
      refreshing={data.isFetching}
      refresh={() => void data.refetch()}
    />
  );
}
function BuilderForm({
  owner,
  configuration,
  info,
  operations,
  routeNavigation,
  refresh,
  refreshing,
}: Props & {
  readonly owner: AxisModuleConnection;
  readonly configuration: BuilderConfiguration;
  readonly info: BuilderInfo;
  readonly operations: readonly BuilderOperation[];
  readonly refreshing: boolean;
  readonly refresh: () => void;
}) {
  const c = info.presentation;
  const [input, setInput] = useState<BuilderPlanInput>({
    workspaceRoot: '',
    applicationName: '',
    companySiteName: '',
    accelerator: info.planningOptions.defaultAccelerator,
    environment: info.planningOptions.defaultEnvironment,
  });
  const [result, setResult] = useState<BuilderPlan>();
  const [error, setError] = useState<string>();
  const version = useRef(0),
    inFlight = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const canPlan =
    routeNavigation.lifecycleActions?.some(
      (x) =>
        x.id === 'installer-plan' &&
        x.featureState === 'ACTIVE' &&
        x.ownerModule === 'installer' &&
        x.handlerAction === 'setup.plan' &&
        x.httpMethod === 'POST' &&
        x.operationRoute === '/nodics/installer/v0/setup/plan',
    ) &&
    operations.some(
      (x) =>
        x.code === 'setup.plan' &&
        x.executable &&
        !x.mutating &&
        x.state === 'AVAILABLE',
    );
  const plan = useMutation({
    mutationFn: async ({
      snapshot,
      revision,
    }: {
      snapshot: BuilderPlanInput;
      revision: number;
    }) => ({
      value: parseBuilderPlan(
        await builderRequest(owner, configuration, 'plan', snapshot),
      ),
      revision,
    }),
    onSuccess: ({ value, revision }) => {
      if (active.current && revision === version.current) setResult(value);
    },
    onError: (e, variables) => {
      if (active.current && variables.revision === version.current) setError(e.message);
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  const edit = (key: keyof BuilderPlanInput, value: string) => {
    version.current++;
    setResult(undefined);
    setError(undefined);
    setInput((old) => ({ ...old, [key]: value }));
  };
  const submit = () => {
    if (inFlight.current || !canPlan || refreshing) return;
    inFlight.current = true;
    setResult(undefined);
    setError(undefined);
    plan.mutate({ snapshot: { ...input }, revision: version.current });
  };
  return (
    <WorkspaceContainer>
      <Stack spacing={3}>
        <WorkspaceHeading
          title={routeNavigation.backendWorkspace?.title || routeNavigation.label}
          description={c.introduction}
          help={routeNavigation.help}
        />
        <Chip sx={{ alignSelf: 'flex-start' }} label={c.preview} color="info" />
        <Alert severity="info">
          {info.localBuildPresets.length
            ? 'Local project generation is available for approved application families. It creates project files without starting services or importing data.'
            : c.reserved}
        </Alert>
        <Button
          disabled={refreshing || plan.isPending}
          onClick={() => {
            version.current++;
            setResult(undefined);
            setError(undefined);
            refresh();
          }}
          sx={{ alignSelf: 'flex-start' }}
        >
          {c.refresh}
        </Button>
        {!info.workspaceAccessConfigured ? (
          <Alert severity="warning">{c.prerequisite}</Alert>
        ) : (
          <Paper
            component="form"
            variant="outlined"
            sx={{ p: 3 }}
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Stack spacing={2}>
              <Typography variant="h6" component="h2">
                {c.formTitle}
              </Typography>
              {(
                [
                  'workspaceRoot',
                  'applicationName',
                  'companySiteName',
                  'environment',
                ] as const
              ).map((key) => (
                <TextField
                  key={key}
                  label={c[key]}
                  required={key !== 'companySiteName'}
                  value={input[key]}
                  onChange={(e) => edit(key, e.target.value)}
                  slotProps={{
                    htmlInput: {
                      maxLength:
                        key === 'workspaceRoot'
                          ? 4096
                          : info.planningOptions.nameMaxLength,
                    },
                  }}
                />
              ))}
              <TextField
                select
                label={c.accelerator}
                value={input.accelerator}
                onChange={(e) => edit('accelerator', e.target.value)}
              >
                {info.planningOptions.supportedAccelerators.map((v) => (
                  <MenuItem key={v} value={v}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                type="submit"
                variant="contained"
                disabled={!canPlan || plan.isPending || refreshing}
                sx={{ alignSelf: 'flex-start' }}
              >
                {c.plan}
              </Button>
            </Stack>
          </Paper>
        )}
        {error && <Alert severity="warning">{error}</Alert>}
        {result && (
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography component="h2" variant="h6">
                {c.planTitle}
              </Typography>
              {result.messages.map((message, i) => (
                <Alert key={i} severity="warning">
                  {message}
                </Alert>
              ))}
              {result.plan && (
                <>
                  <Typography>
                    {c.vendorRepositories}: {result.plan.vendorRepositories.join(', ')}
                  </Typography>
                  <Typography>
                    {c.customerProjects}: {result.plan.customerProjects.join(', ')}
                  </Typography>
                  <Typography>
                    {c.firstEnvironment}: {result.plan.firstEnvironment}
                  </Typography>
                  <Alert severity="info">{c.dryRun}</Alert>
                </>
              )}
            </Stack>
          </Paper>
        )}
        {info.localBuildPresets.length > 0 && (
          <LocalBuildPanel
            owner={owner}
            configuration={configuration}
            input={input}
            canPrepare={Boolean(
              result?.valid &&
              info.localBuildPresets.includes(input.accelerator) &&
              input.environment === 'local',
            )}
          />
        )}
      </Stack>
    </WorkspaceContainer>
  );
}

/** Reviews, generates and reverses only the receipt pinned by the Installer owner. */
function LocalBuildPanel({
  owner,
  configuration,
  input,
  canPrepare,
}: {
  readonly owner: AxisModuleConnection;
  readonly configuration: BuilderConfiguration;
  readonly input: BuilderPlanInput;
  readonly canPrepare: boolean;
}) {
  const [runId, setRunId] = useState('');
  const [receipt, setReceipt] = useState<LocalBuildReceipt>();
  const [confirmed, setConfirmed] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const running = useRef(false);
  const command = useMutation({
    mutationFn: async ({
      operation,
      id,
      payload,
    }: {
      operation: 'prepareBuild' | 'generateBuild' | 'readBuild' | 'rollbackBuild';
      id: string;
      payload?: Readonly<Record<string, unknown>> | undefined;
    }) =>
      parseLocalBuildReceipt(
        await builderRequest(owner, configuration, operation, {
          runId: id,
          ...payload,
        }),
        id,
      ),
    onSuccess: (next) => {
      setReceipt(next);
      setConfirmed(false);
      setUnconfirmed(false);
    },
    onError: () => {
      setConfirmed(false);
      setUnconfirmed(true);
    },
    onSettled: () => {
      running.current = false;
    },
  });
  const send = (
    operation: 'prepareBuild' | 'generateBuild' | 'readBuild' | 'rollbackBuild',
  ) => {
    if (running.current || (unconfirmed && operation !== 'readBuild')) return;
    const id = operation === 'prepareBuild' ? crypto.randomUUID() : runId;
    const payload =
      operation === 'prepareBuild'
        ? {
            workspaceRoot: input.workspaceRoot,
            applicationName: input.applicationName,
            accelerator: input.accelerator,
            environment: input.environment,
          }
        : operation === 'readBuild'
          ? undefined
          : { confirmed, reviewDigest: receipt?.reviewDigest };
    running.current = true;
    setRunId(id);
    command.mutate({ operation, id, ...(payload ? { payload } : {}) });
  };
  const reviewed = receipt?.state === 'REVIEWED';
  const generated = receipt?.state === 'GENERATED';
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography component="h2" variant="h6">
          Local project build
        </Typography>
        <Typography>
          Review the exact project output before generating it. You can remove unchanged
          generated files using the retained receipt.
        </Typography>
        {!receipt && !unconfirmed && (
          <Button
            disabled={!canPrepare || command.isPending}
            onClick={() => send('prepareBuild')}
          >
            Review generation
          </Button>
        )}
        <TextField
          label="Build receipt ID"
          value={runId}
          disabled={command.isPending}
          onChange={(event) => {
            setRunId(event.target.value);
            setReceipt(undefined);
            setConfirmed(false);
            setUnconfirmed(false);
            command.reset();
          }}
        />
        <Button
          disabled={!runId || command.isPending}
          onClick={() => send('readBuild')}
        >
          Read build receipt
        </Button>
        {command.error && <Alert severity="warning">{command.error.message}</Alert>}
        {receipt && (
          <>
            <Typography>Application: {receipt.applicationName}</Typography>
            <Typography>Build state: {receipt.state}</Typography>
            <Typography>Capabilities: {receipt.capabilities.join(', ')}</Typography>
            <Typography>
              Planned files: {receipt.plannedFiles} · Generated files:{' '}
              {receipt.artifactCount}
            </Typography>
            {(reviewed || generated) && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={confirmed}
                    disabled={unconfirmed || command.isPending}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                }
                label={
                  reviewed
                    ? 'I reviewed this exact build'
                    : 'Remove this build’s unchanged files'
                }
              />
            )}
            {reviewed && (
              <Button
                variant="contained"
                disabled={!confirmed || unconfirmed || command.isPending}
                onClick={() => send('generateBuild')}
              >
                Generate project
              </Button>
            )}
            {generated && (
              <Button
                variant="outlined"
                disabled={!confirmed || unconfirmed || command.isPending}
                onClick={() => send('rollbackBuild')}
              >
                Reverse build
              </Button>
            )}
            {receipt.state === 'ROLLED_BACK' && (
              <Alert severity="success">
                Generated files were removed. The build receipt is retained.
              </Alert>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}
