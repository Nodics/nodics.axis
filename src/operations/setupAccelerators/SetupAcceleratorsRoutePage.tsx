import { useMutation, useQueries, useQueryClient, type Query } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';

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
  type ApplicationInitializationStatus,
} from './api/applicationInitializationClient';

interface SetupAcceleratorsRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}

interface AcceleratorProfile {
  readonly code: string;
  readonly title: string;
  readonly kind: 'PROJECT' | 'DOCUMENTATION';
  readonly summary: string;
}

type AcceleratorOperation = 'initiate' | 'rollback' | 'retire' | 'approve';

const ACCELERATOR_PROFILES: readonly AcceleratorProfile[] = Object.freeze([
  {
    code: 'nexus',
    title: 'Nexus Corporate',
    kind: 'PROJECT',
    summary: 'Corporate site accelerator published from WCMS Staged to Online.',
  },
  {
    code: 'agora',
    title: 'Agora Storefront',
    kind: 'PROJECT',
    summary:
      'Commerce storefront accelerator. Domain-specific bundles will replace the current common profile in a later slice.',
  },
  {
    code: 'frameworkdocs',
    title: 'Framework Documentation',
    kind: 'DOCUMENTATION',
    summary: 'Framework documentation content pack and Online delivery profile.',
  },
  {
    code: 'axisdocs',
    title: 'Nodics Axis Documentation',
    kind: 'DOCUMENTATION',
    summary: 'Axis product documentation content pack and Online delivery profile.',
  },
  {
    code: 'kickoffdocs',
    title: 'Nodics Kickoff Documentation',
    kind: 'DOCUMENTATION',
    summary: 'Reference-project documentation content pack and Online delivery profile.',
  },
]);

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

export function SetupAcceleratorsRoutePage(props: SetupAcceleratorsRoutePageProps) {
  const queryClient = useQueryClient();
  const backofficeConnection = selectModuleConnection(props.bootstrap, 'backoffice');
  const processConnection =
    selectModuleConnection(props.bootstrap, 'flowApi', { server: 'processServer' }) ??
    selectModuleConnection(props.bootstrap, 'workflow', { server: 'processServer' });
  const clients = useMemo(() => {
    if (!backofficeConnection) return new Map<string, ReturnType<typeof createApplicationInitializationClient>>();
    return new Map(
      ACCELERATOR_PROFILES.map((profile) => [
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
  ]);
  const queries = useQueries({
    queries: ACCELERATOR_PROFILES.map((profile) => ({
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
      readonly profile: AcceleratorProfile;
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
  const statuses = ACCELERATOR_PROFILES.map((profile, index) => {
    const query = queries[index];
    if (!query) return undefined;
    return { profile, query };
  }).filter(
    (item): item is { readonly profile: AcceleratorProfile; readonly query: AcceleratorStatusQuery } =>
      Boolean(item),
  );
  const readyCount = statuses.filter(
    (item) => item.query.data?.readiness === 'READY',
  ).length;
  const pendingCount = statuses.filter(
    (item) => item.query.data?.readiness === 'PUBLICATION_PENDING',
  ).length;
  const loading = queries.some((query) => query.isPending);

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
                  Profiles are currently read from the known Kickoff Local
                  application-initialization set. A backend profile catalogue should
                  replace this static list in a later slice.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip color="success" label={`${String(readyCount)} Online`} />
                <Chip
                  color="warning"
                  label={`${String(pendingCount)} pending approval`}
                />
                <Chip label={`${String(ACCELERATOR_PROFILES.length)} profiles`} />
              </Stack>
            </Stack>
          </CardContent>
        </Card>
        {loading ? (
          <Stack sx={{ alignItems: 'center', py: 4 }}>
            <CircularProgress aria-label="Loading setup accelerators" />
          </Stack>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            }}
          >
            {statuses.map(({ profile, query }) => {
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
                          label={profile.kind === 'PROJECT' ? 'Project' : 'Docs'}
                          size="small"
                        />
                      </Stack>
                      {query.error instanceof Error ? (
                        <Alert severity="error">{query.error.message}</Alert>
                      ) : status ? (
                        <>
                          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                            <Chip
                              color={stateColor(status.readiness)}
                              label={status.readiness}
                              size="small"
                            />
                            <Chip
                              label={`${status.releaseCode} ${status.releaseVersion}`}
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
        )}
      </Stack>
    </WorkspaceContainer>
  );
}
