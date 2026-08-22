import {
  useMutation,
  useQueries,
  useQueryClient,
  type Query,
} from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import {
  completeProcessTask,
  loadProcessTasks,
} from '../processWorkflow/api/processDefinitionClient';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  createApplicationInitializationClient,
  type ApplicationInitializationProfile,
  type ApplicationInitializationStatus,
} from './api/applicationInitializationClient';

interface SetupAcceleratorsRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}

type AcceleratorOperation = 'initiate' | 'rollback' | 'retire' | 'approve';

type AcceleratorFilter = 'ALL' | 'PROJECT' | 'DOCUMENTATION' | 'NEEDS_ACTION';


const queryRoot = ['setup-accelerators'] as const;

function stateColor(
  state: string,
): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (state === 'READY') return 'success';
  if (state === 'PUBLICATION_PENDING' || state === 'IMPORTED') return 'warning';
  if (state === 'FAILED' || state === 'REJECTED') return 'error';
  if (state === 'NOT_IMPORTED') return 'info';
  return 'default';
}

function operationLabel(operation: AcceleratorOperation): string {
  if (operation === 'initiate') return 'Initialize';
  if (operation === 'rollback') return 'Rollback';
  if (operation === 'retire') return 'Retire';
  return 'Approve';
}

function canApprove(status: ApplicationInitializationStatus | undefined): boolean {
  return Boolean(
    status?.readiness === 'PUBLICATION_PENDING' &&
      status.publication?.state === 'PENDING_APPROVAL' &&
      status.publication.workflowRef,
  );
}

function triggerLabel(trigger: string): string {
  if (trigger === 'ACTIVATION') return 'activation';
  if (trigger === 'USER') return 'user triggered';
  return trigger.toLowerCase();
}

function readinessLabel(readiness: string): string {
  if (readiness === 'NOT_IMPORTED') return 'Not initialized';
  if (readiness === 'PUBLICATION_PENDING') return 'Waiting for approval';
  if (readiness === 'READY') return 'Online and ready';
  if (readiness === 'ROLLED_BACK') return 'Rolled back';
  return readiness.replaceAll('_', ' ').toLowerCase();
}

function friendlyPackageLabel(code: string): string {
  return code
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[:._-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/\b\w/gu, (value) => value.toUpperCase());
}

function profileErrorMessage(
  profile: ApplicationInitializationProfile,
  message: string,
): string {
  if (/Application initialization target is unavailable/i.test(message)) {
    return `${profile.title} cannot read baseline ${profile.baselineCode}. Check WCMS Staged baseline configuration, release qualification, and required runtime availability.`;
  }
  return message;
}

export function SetupAcceleratorsRoutePage(props: SetupAcceleratorsRoutePageProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<AcceleratorFilter>('ALL');
  const backofficeConnection = selectModuleConnection(props.bootstrap, 'backoffice');
  const processConnection =
    selectModuleConnection(props.bootstrap, 'flowApi', { server: 'processServer' }) ??
    selectModuleConnection(props.bootstrap, 'workflow', { server: 'processServer' });
  const profiles = useMemo(
    () =>
      (props.bootstrap.applicationInitializationProfiles ?? [])
        .slice()
        .sort((left, right) => left.order - right.order),
    [props.bootstrap.applicationInitializationProfiles],
  );
  const clients = useMemo(() => {
    if (!backofficeConnection) return new Map<string, ReturnType<typeof createApplicationInitializationClient>>();
    return new Map(
      profiles.map((profile) => [
        profile.code,
        createApplicationInitializationClient({
          connection: backofficeConnection,
          enterpriseCode: props.runtime.enterpriseCode,
          accessToken: props.accessToken,
          timeoutMs: props.runtime.requestTimeoutMs,
          profileCode: profile.code,
        }),
      ]),
    );
  }, [
    props.accessToken,
    props.runtime.enterpriseCode,
    props.runtime.requestTimeoutMs,
    backofficeConnection,
    profiles,
  ]);
  const queries = useQueries({
    queries: profiles.map((profile) => ({
      enabled: Boolean(backofficeConnection),
      queryKey: [...queryRoot, profile.code],
      queryFn: () => {
        const client = clients.get(profile.code);
        if (!client) throw new Error('BackOffice application initialization is unavailable');
        return client.getStatus();
      },
      refetchInterval: (
        query: Query<
          ApplicationInitializationStatus,
          Error,
          ApplicationInitializationStatus,
          readonly unknown[]
        >,
      ) =>
        query.state.data?.readiness === 'PUBLICATION_PENDING' ? 2_000 : false,
    })),
  });
  const mutation = useMutation({
    mutationFn: async ({
      profile,
      status,
      operation,
    }: {
      readonly profile: ApplicationInitializationProfile;
      readonly status?: ApplicationInitializationStatus | undefined;
      readonly operation: AcceleratorOperation;
    }) => {
      const client = clients.get(profile.code);
      if (!client) throw new Error('BackOffice application initialization is unavailable');
      if (operation === 'approve') {
        if (!processConnection || !status?.publication?.workflowRef) {
          throw new Error('The governed Process approval task is unavailable');
        }
        const tasks = await loadProcessTasks(
          processConnection,
          {
            accessToken: props.accessToken,
            enterpriseCode: props.runtime.enterpriseCode,
            timeoutMs: props.runtime.requestTimeoutMs,
          },
          status.publication.workflowRef,
        );
        const task = tasks.find((item) =>
          ['OPEN', 'CLAIMED', 'ESCALATED'].includes(item.status),
        );
        if (!task) throw new Error('No actionable Process approval task was found');
        await completeProcessTask(
          processConnection,
          {
            accessToken: props.accessToken,
            enterpriseCode: props.runtime.enterpriseCode,
            timeoutMs: props.runtime.requestTimeoutMs,
          },
          task.code,
          {
            approved: true,
            reason: `${profile.title} approved from Setup & Accelerators`,
          },
        );
        return client.getStatus();
      }
      if (operation === 'rollback') return client.rollback();
      if (operation === 'retire') return client.retire();
      return client.initiate();
    },
    onSuccess: (status, variables) => {
      queryClient.setQueryData([...queryRoot, variables.profile.code], status);
      void queryClient.invalidateQueries({ queryKey: queryRoot });
    },
  });
  type AcceleratorStatusQuery = (typeof queries)[number];
  const statuses = profiles.map((profile, index) => {
    const query = queries[index];
    if (!query) return undefined;
    return { profile, query };
  }).filter(
    (item): item is { readonly profile: ApplicationInitializationProfile; readonly query: AcceleratorStatusQuery } =>
      Boolean(item),
  );
  const readyCount = statuses.filter(
    (item) => item.query.data?.readiness === 'READY',
  ).length;
  const pendingCount = statuses.filter(
    (item) => item.query.data?.readiness === 'PUBLICATION_PENDING',
  ).length;
  const actionCount = statuses.filter(
    (item) =>
      item.query.data?.readiness !== 'READY' ||
      item.query.data.allowedActions.length > 0,
  ).length;
  const loading = queries.some((query) => query.isPending);
  const filteredStatuses = statuses.filter((item) => {
    if (filter === 'ALL') return true;
    if (filter === 'PROJECT') return item.profile.kind === 'PROJECT';
    if (filter === 'DOCUMENTATION') return item.profile.kind !== 'PROJECT';
    return (
      item.query.data?.readiness !== 'READY' ||
      Boolean(item.query.data?.allowedActions.length)
    );
  });
  const statusGroups = [
    {
      key: 'projects',
      title: 'Project accelerators',
      description:
        'Business applications such as Nexus, Agora, partner storefronts, and future accelerators.',
      items: filteredStatuses.filter((item) => item.profile.kind === 'PROJECT'),
    },
    {
      key: 'documentation',
      title: 'Documentation packs',
      description:
        'Framework, product, and project documentation that can be installed and published Online.',
      items: filteredStatuses.filter((item) => item.profile.kind !== 'PROJECT'),
    },
  ].filter((group) => group.items.length > 0);

  if (!backofficeConnection) {
    return (
      <WorkspaceContainer>
        <Alert severity="error">BackOffice connection is unavailable.</Alert>
      </WorkspaceContainer>
    );
  }

  return (
    <WorkspaceContainer>
      <WorkspaceHeading
        description="Initialize governed documentation and project accelerators, then publish Staged packages to Online with approval."
        help={props.routeNavigation?.help}
        title="Setup & Accelerators"
      />
      <Stack spacing={3}>
        <Alert severity="info">
          Import and activation inside Platform or Staged are audited operations.
          Anything that changes Online visibility remains approval-gated.
        </Alert>
        <Alert severity="success" variant="outlined">
          Staged is the safe preparation area for imports, versions, validation, and
          approval. Online is the public runtime consumed by Nexus, Agora, and other
          customer-facing channels after approval.
        </Alert>
        {profiles.length === 0 ? (
          <Alert severity="warning">
            Authenticated bootstrap did not include any application-initialization
            profiles. Setup & Accelerators is backend-published, so project or
            environment configuration must contribute profiles before Axis can
            initialize Nexus, Agora, documentation, or future accelerators.
          </Alert>
        ) : null}
        {mutation.error instanceof Error ? (
          <Alert severity="error">{mutation.error.message}</Alert>
        ) : null}
        <Card variant="outlined">
          <CardContent>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
            >
              <Box>
                <Typography component="h2" variant="h5">
                  Publishing onboarding
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Profiles are governed by the BackOffice application-initialization
                  catalogue. Project modules can add accelerators through
                  configuration without hardcoding new cards into Axis.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip color="success" label={`${String(readyCount)} Online`} />
                <Chip
                  color="warning"
                  label={`${String(pendingCount)} pending approval`}
                />
                <Chip color="info" label={`${String(actionCount)} need attention`} />
                <Chip label={`${String(profiles.length)} profiles`} />
                <Button
                  onClick={() => navigate('/registry')}
                  size="small"
                  variant="outlined"
                >
                  Open Module Registry
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
            >
              <Box>
                <Typography component="h2" variant="h6">
                  Focus the setup queue
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Start with profiles that need action, then narrow to project
                  accelerators or documentation packs as the catalogue grows.
                </Typography>
              </Box>
              <TextField
                label="View"
                onChange={(event) => setFilter(event.target.value as AcceleratorFilter)}
                select
                size="small"
                sx={{ minWidth: 240 }}
                value={filter}
              >
                <MenuItem value="ALL">All profiles</MenuItem>
                <MenuItem value="NEEDS_ACTION">Needs action</MenuItem>
                <MenuItem value="PROJECT">Project accelerators</MenuItem>
                <MenuItem value="DOCUMENTATION">Documentation packs</MenuItem>
              </TextField>
            </Stack>
          </CardContent>
        </Card>
        {loading ? (
          <Stack sx={{ alignItems: 'center', py: 4 }}>
            <CircularProgress aria-label="Loading setup accelerators" />
          </Stack>
        ) : (
          <Stack spacing={3}>
            {statusGroups.map((group) => (
              <Stack key={group.key} spacing={1.5}>
                <Box>
                  <Typography component="h3" variant="h6">
                    {group.title}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    {group.description}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: {
                      xs: '1fr',
                      lg: 'repeat(2, minmax(0, 1fr))',
                    },
                  }}
                >
                  {group.items.map(({ profile, query }) => {
              const status = query.data;
              const pending =
                mutation.isPending &&
                mutation.variables?.profile.code === profile.code;
              return (
                <Card key={profile.code} variant="outlined">
                  <CardContent>
                    <Stack spacing={2}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        sx={{ justifyContent: 'space-between' }}
                      >
                        <Box>
                          <Typography component="h3" variant="h6">
                            {profile.title}
                          </Typography>
                          <Typography color="text.secondary" variant="body2">
                            {profile.summary}
                          </Typography>
                        </Box>
                        <Chip
                          color={profile.kind === 'PROJECT' ? 'primary' : 'default'}
                          label={profile.kind === 'PROJECT' ? 'Project accelerator' : 'Documentation'}
                          size="small"
                        />
                      </Stack>
                      {query.error instanceof Error ? (
                        <Alert severity="error">
                          {profileErrorMessage(profile, query.error.message)}
                        </Alert>
                      ) : status ? (
                        <>
                          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                            <Chip
                              color={stateColor(status.readiness)}
                              label={readinessLabel(status.readiness)}
                              size="small"
                            />
                            <Chip
                              label={`${friendlyPackageLabel(status.releaseCode)} ${status.releaseVersion}`}
                              size="small"
                              variant="outlined"
                            />
                            <Chip
                              label={status.owner}
                              size="small"
                              variant="outlined"
                            />
                          </Stack>
                          <Box>
                            <Typography color="text.secondary" variant="caption">
                              Application and site
                            </Typography>
                            <Typography>
                              {status.applicationCode} · {status.siteCode}
                            </Typography>
                          </Box>
                          <Stack spacing={1}>
                            <Box>
                              <Typography color="text.secondary" variant="caption">
                                Required runtime
                              </Typography>
                              <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                                {profile.requiredServers.map((server) => (
                                  <Chip
                                    key={server}
                                    label={server}
                                    size="small"
                                    variant="outlined"
                                  />
                                ))}
                              </Stack>
                            </Box>
                            {profile.dataPackages.length > 0 ? (
                              <Box>
                                <Typography color="text.secondary" variant="caption">
                                  Data packages
                                </Typography>
                                <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                                  {profile.dataPackages.map((pack) => (
                                    <Chip
                                      color={pack.required ? 'warning' : 'default'}
                                      key={`${pack.code}:${pack.kind}`}
                                      label={`${friendlyPackageLabel(pack.code)} · ${triggerLabel(pack.trigger)}`}
                                      size="small"
                                      variant={pack.required ? 'filled' : 'outlined'}
                                    />
                                  ))}
                                </Stack>
                              </Box>
                            ) : null}
                            <Typography color="text.secondary" variant="caption">
                              Online approval{' '}
                              {profile.activationPolicy.approvalRequiredForOnline
                                ? 'required'
                                : 'not required'}{' '}
                              · required data via{' '}
                              {triggerLabel(profile.activationPolicy.requiredDataTrigger)}
                              {' '}· sample data via{' '}
                              {triggerLabel(profile.activationPolicy.sampleDataTrigger)}
                            </Typography>
                          </Stack>
                          {status.publication ? (
                            <Box>
                              <Typography color="text.secondary" variant="caption">
                                Publication
                              </Typography>
                              <Typography sx={{ overflowWrap: 'anywhere' }}>
                                {status.publication.code} · {status.publication.state}
                              </Typography>
                              {status.publication.workflowRef ? (
                                <Typography
                                  color="text.secondary"
                                  sx={{ overflowWrap: 'anywhere' }}
                                  variant="caption"
                                >
                                  Workflow {status.publication.workflowRef}
                                </Typography>
                              ) : null}
                            </Box>
                          ) : null}
                          <Divider />
                          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                            {status.allowedActions.includes('INITIALIZE') ? (
                              <Button
                                disabled={pending}
                                onClick={() =>
                                  mutation.mutate({
                                    operation: 'initiate',
                                    profile,
                                    status,
                                  })
                                }
                                variant="contained"
                              >
                                {pending && mutation.variables?.operation === 'initiate'
                                  ? 'Initializing...'
                                  : 'Initialize'}
                              </Button>
                            ) : null}
                            {canApprove(status) ? (
                              <Button
                                disabled={pending}
                                onClick={() =>
                                  mutation.mutate({
                                    operation: 'approve',
                                    profile,
                                    status,
                                  })
                                }
                                variant="contained"
                              >
                                {pending && mutation.variables?.operation === 'approve'
                                  ? 'Approving...'
                                  : 'Approve'}
                              </Button>
                            ) : null}
                            {status.allowedActions.includes('ROLLBACK') ? (
                              <Button
                                color="warning"
                                disabled={pending}
                                onClick={() =>
                                  mutation.mutate({
                                    operation: 'rollback',
                                    profile,
                                    status,
                                  })
                                }
                                variant="outlined"
                              >
                                {operationLabel('rollback')}
                              </Button>
                            ) : null}
                            {status.allowedActions.includes('RETIRE') ? (
                              <Button
                                color="warning"
                                disabled={pending}
                                onClick={() =>
                                  mutation.mutate({
                                    operation: 'retire',
                                    profile,
                                    status,
                                  })
                                }
                                variant="outlined"
                              >
                                {operationLabel('retire')}
                              </Button>
                            ) : null}
                            <Button
                              disabled={pending}
                              onClick={() => void query.refetch()}
                              variant="text"
                            >
                              Refresh
                            </Button>
                          </Stack>
                        </>
                      ) : (
                        <Alert severity="warning">Profile status is unavailable.</Alert>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              );
                  })}
                </Box>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </WorkspaceContainer>
  );
}
