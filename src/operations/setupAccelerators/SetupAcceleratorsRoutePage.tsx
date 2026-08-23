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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
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

type DestructiveAcceleratorOperation = Extract<
  AcceleratorOperation,
  'rollback' | 'retire'
>;

interface DestructiveConfirmationState {
  readonly operation: DestructiveAcceleratorOperation;
  readonly profile: ApplicationInitializationProfile;
  readonly status: ApplicationInitializationStatus;
}

const queryRoot = ['setup-accelerators'] as const;

const acceleratorLifecycleSteps = Object.freeze([
  Object.freeze({
    title: 'Select accelerator',
    detail:
      'Choose Nexus or one Agora domain independently. Shared/common data must be declared by the package, not hidden in Axis.',
  }),
  Object.freeze({
    title: 'Initialize Staged data',
    detail:
      'Import init/core/project/docs/media packages into the governed preparation area with checksum and target scope.',
  }),
  Object.freeze({
    title: 'Submit and approve',
    detail:
      'Create the Publishing Request and complete the Process approval task before Online visibility can change.',
  }),
  Object.freeze({
    title: 'Verify Online',
    detail:
      'Confirm Online pointer, history, audit, and browser delivery in Nexus or the selected Agora storefront.',
  }),
  Object.freeze({
    title: 'Rollback or retire',
    detail:
      'Use governed rollback/retire actions with business reason, current Online evidence, and post-action verification.',
  }),
]);

const acceleratorDataClasses = Object.freeze([
  Object.freeze({
    label: 'init',
    detail:
      'Required framework/runtime baseline, safe to install as part of activation.',
  }),
  Object.freeze({
    label: 'core',
    detail:
      'Required module or accelerator business data without which the capability cannot run.',
  }),
  Object.freeze({
    label: 'sample',
    detail:
      'Optional demonstration data; operator-triggered and disabled by default for production.',
  }),
  Object.freeze({
    label: 'project',
    detail:
      'Nexus, Agora, or customer project content that must publish through Staged-to-Online approval.',
  }),
  Object.freeze({
    label: 'docs/media',
    detail:
      'Documentation content and binary references that need ownership, checksum, and provider readiness.',
  }),
]);

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

function acceleratorFamily(profile: ApplicationInitializationProfile): string {
  const code =
    `${profile.code} ${profile.applicationCode} ${profile.siteCode} ${profile.title}`.toLowerCase();
  if (code.includes('nexus')) return 'Nexus corporate site';
  if (code.includes('apparel')) return 'Agora Apparel';
  if (code.includes('electronics')) return 'Agora Electronics';
  if (code.includes('telco')) return 'Agora Telco';
  if (profile.kind === 'PROJECT') return 'Project accelerator';
  return 'Documentation pack';
}

function profilePublishChannel(profile: ApplicationInitializationProfile): string {
  if (profile.kind !== 'PROJECT') return 'Axis Documentation';
  const family = acceleratorFamily(profile);
  if (family.startsWith('Nexus')) return 'Nexus public channel';
  if (family.startsWith('Agora')) return 'Agora storefront channel';
  return 'Customer-facing channel';
}

function requiredPackageCount(profile: ApplicationInitializationProfile): number {
  return profile.dataPackages.filter((pack) => pack.required).length;
}

function optionalPackageCount(profile: ApplicationInitializationProfile): number {
  return profile.dataPackages.filter((pack) => !pack.required).length;
}

export function SetupAcceleratorsRoutePage(props: SetupAcceleratorsRoutePageProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<AcceleratorFilter>('ALL');
  const [destructiveConfirmation, setDestructiveConfirmation] =
    useState<DestructiveConfirmationState>();
  const [destructiveReason, setDestructiveReason] = useState('');
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
    if (!backofficeConnection)
      return new Map<
        string,
        ReturnType<typeof createApplicationInitializationClient>
      >();
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
        if (!client)
          throw new Error('BackOffice application initialization is unavailable');
        return client.getStatus();
      },
      refetchInterval: (
        query: Query<
          ApplicationInitializationStatus,
          Error,
          ApplicationInitializationStatus,
          readonly unknown[]
        >,
      ) => (query.state.data?.readiness === 'PUBLICATION_PENDING' ? 2_000 : false),
    })),
  });
  const mutation = useMutation({
    mutationFn: async ({
      profile,
      status,
      operation,
      reason,
    }: {
      readonly profile: ApplicationInitializationProfile;
      readonly status?: ApplicationInitializationStatus | undefined;
      readonly operation: AcceleratorOperation;
      readonly reason?: string | undefined;
    }) => {
      const client = clients.get(profile.code);
      if (!client)
        throw new Error('BackOffice application initialization is unavailable');
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
      if (operation === 'rollback') return client.rollback({ reason });
      if (operation === 'retire') return client.retire({ reason });
      return client.initiate();
    },
    onSuccess: (status, variables) => {
      if (variables.operation === 'rollback' || variables.operation === 'retire') {
        setDestructiveConfirmation(undefined);
        setDestructiveReason('');
      }
      queryClient.setQueryData([...queryRoot, variables.profile.code], status);
      void queryClient.invalidateQueries({ queryKey: queryRoot });
    },
  });
  type AcceleratorStatusQuery = (typeof queries)[number];
  const statuses = profiles
    .map((profile, index) => {
      const query = queries[index];
      if (!query) return undefined;
      return { profile, query };
    })
    .filter(
      (
        item,
      ): item is {
        readonly profile: ApplicationInitializationProfile;
        readonly query: AcceleratorStatusQuery;
      } => Boolean(item),
    );
  const readyCount = statuses.filter(
    (item) => item.query.data?.readiness === 'READY',
  ).length;
  const pendingCount = statuses.filter(
    (item) => item.query.data?.readiness === 'PUBLICATION_PENDING',
  ).length;
  const actionCount = statuses.filter(
    (item) => item.query.data?.readiness !== 'READY',
  ).length;
  const projectProfiles = profiles.filter((profile) => profile.kind === 'PROJECT');
  const documentationProfiles = profiles.filter(
    (profile) => profile.kind !== 'PROJECT',
  );
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
  const destructiveReasonIsValid = destructiveReason.trim().length >= 12;
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
        <Alert severity="info" variant="outlined">
          Recommended path: initialize the package, inspect the generated Publishing
          Request, approve or reject the Process task, then verify Online status and the
          browser page. Setup starts the journey; Publishing and Process provide the
          evidence.
        </Alert>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography component="h2" variant="h6">
                  Accelerator lifecycle map
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Nexus and Agora accelerators follow the same governed path, but each
                  domain remains independently selectable, approvable, publishable, and
                  rollback-capable.
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: 'repeat(5, minmax(0, 1fr))',
                  },
                }}
              >
                {acceleratorLifecycleSteps.map((step) => (
                  <Card key={step.title} variant="outlined">
                    <CardContent>
                      <Stack spacing={1}>
                        <Typography variant="subtitle1">{step.title}</Typography>
                        <Typography color="text.secondary" variant="body2">
                          {step.detail}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Box>
              <Divider />
              <Box>
                <Typography component="h3" variant="subtitle1">
                  Data classification
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Packages should be clear before import so operators know what is
                  automatic, required, optional, project-specific, or provider-bound.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {acceleratorDataClasses.map((item) => (
                  <Chip
                    key={item.label}
                    label={`${item.label}: ${item.detail}`}
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
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
                  catalogue. Project modules can add accelerators through configuration
                  without hardcoding new cards into Axis.
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
                <Button
                  onClick={() => navigate('/publishing')}
                  size="small"
                  variant="outlined"
                >
                  Open Publishing
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography component="h2" variant="h6">
                  Available accelerator catalog
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Nexus and each Agora domain are selected independently. Axis is the
                  platform control plane; Nexus and Agora become live only after their
                  own initialize, approval, publish, and browser-verification journey.
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
                {profiles.map((profile) => (
                  <Card key={profile.code} variant="outlined">
                    <CardContent>
                      <Stack spacing={1}>
                        <Chip
                          color={profile.kind === 'PROJECT' ? 'primary' : 'default'}
                          label={acceleratorFamily(profile)}
                          size="small"
                        />
                        <Typography variant="subtitle1">{profile.title}</Typography>
                        <Typography color="text.secondary" variant="body2">
                          {profilePublishChannel(profile)}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                          <Chip
                            label={`${String(profile.requiredServers.length)} runtime(s)`}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            color={
                              requiredPackageCount(profile) > 0 ? 'warning' : 'default'
                            }
                            label={`${String(requiredPackageCount(profile))} required`}
                            size="small"
                          />
                          <Chip
                            label={`${String(optionalPackageCount(profile))} optional`}
                            size="small"
                            variant="outlined"
                          />
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Box>
              <Alert severity="info">
                Project accelerators: {String(projectProfiles.length)}. Documentation
                packs: {String(documentationProfiles.length)}. Shared/common data must
                be declared in the package manifest and must not silently activate all
                Agora domains together.
              </Alert>
            </Stack>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography component="h2" variant="h6">
                  What happens after initialization?
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Axis keeps the flow explicit so an operator can see what data enters
                  Staged, who approved Online movement, and where to verify the public
                  result.
                </Typography>
              </Box>
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
                {[
                  ['1. Import', 'Required package data is imported into Staged.'],
                  [
                    '2. Request',
                    'A governed Publishing Request records target and evidence.',
                  ],
                  ['3. Approve', 'Process approval decides whether Online can change.'],
                  [
                    '4. Verify',
                    'Online state, receipts, audit, and browser page are checked.',
                  ],
                ].map(([title, body]) => (
                  <Card key={title} variant="outlined">
                    <CardContent>
                      <Stack spacing={1}>
                        <Typography variant="subtitle1">{title}</Typography>
                        <Typography color="text.secondary" variant="body2">
                          {body}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Box>
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
                                color={
                                  profile.kind === 'PROJECT' ? 'primary' : 'default'
                                }
                                label={
                                  profile.kind === 'PROJECT'
                                    ? 'Project accelerator'
                                    : 'Documentation'
                                }
                                size="small"
                              />
                            </Stack>
                            {query.error instanceof Error ? (
                              <Alert severity="error">
                                {profileErrorMessage(profile, query.error.message)}
                              </Alert>
                            ) : status ? (
                              <>
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  sx={{ flexWrap: 'wrap' }}
                                >
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
                                  <Card
                                    variant="outlined"
                                    sx={{
                                      bgcolor: 'background.default',
                                      borderStyle: 'dashed',
                                    }}
                                  >
                                    <CardContent>
                                      <Stack spacing={1.25}>
                                        <Stack
                                          direction={{ xs: 'column', sm: 'row' }}
                                          spacing={1}
                                          sx={{ justifyContent: 'space-between' }}
                                        >
                                          <Box>
                                            <Typography
                                              component="h4"
                                              variant="subtitle1"
                                            >
                                              Dependency graph and publish verification
                                            </Typography>
                                            <Typography
                                              color="text.secondary"
                                              variant="body2"
                                            >
                                              {acceleratorFamily(profile)} depends on
                                              declared runtimes, required data packages,
                                              approval, Online status, and browser
                                              evidence for{' '}
                                              {profilePublishChannel(profile)}.
                                            </Typography>
                                          </Box>
                                          <Chip
                                            color={
                                              status.readiness === 'READY'
                                                ? 'success'
                                                : 'warning'
                                            }
                                            label={readinessLabel(status.readiness)}
                                            size="small"
                                          />
                                        </Stack>
                                        <Grid container spacing={1}>
                                          {[
                                            {
                                              label: 'Runtime',
                                              value: `${String(profile.requiredServers.length)} required`,
                                            },
                                            {
                                              label: 'Required data',
                                              value: `${String(requiredPackageCount(profile))} package(s)`,
                                            },
                                            {
                                              label: 'Optional/sample',
                                              value: `${String(optionalPackageCount(profile))} package(s)`,
                                            },
                                            {
                                              label: 'Approval',
                                              value: profile.activationPolicy
                                                .approvalRequiredForOnline
                                                ? 'Required'
                                                : 'Not required',
                                            },
                                          ].map((item) => (
                                            <Grid
                                              key={item.label}
                                              size={{ xs: 12, sm: 6 }}
                                            >
                                              <Alert
                                                severity="info"
                                                sx={{ height: '100%' }}
                                              >
                                                <Typography
                                                  component="div"
                                                  variant="caption"
                                                >
                                                  {item.label}
                                                </Typography>
                                                <Typography
                                                  component="div"
                                                  variant="body2"
                                                >
                                                  {item.value}
                                                </Typography>
                                              </Alert>
                                            </Grid>
                                          ))}
                                        </Grid>
                                        <Stack
                                          direction="row"
                                          spacing={1}
                                          sx={{ flexWrap: 'wrap' }}
                                        >
                                          {[
                                            'Publishing Request',
                                            'Process Approval',
                                            'Online Status',
                                            'History & Audit',
                                            'Browser Verification',
                                          ].map((item) => (
                                            <Chip
                                              key={item}
                                              label={item}
                                              size="small"
                                              variant="outlined"
                                            />
                                          ))}
                                        </Stack>
                                      </Stack>
                                    </CardContent>
                                  </Card>
                                  <Box>
                                    <Typography
                                      color="text.secondary"
                                      variant="caption"
                                    >
                                      Required runtime
                                    </Typography>
                                    <Stack
                                      direction="row"
                                      spacing={0.75}
                                      sx={{ flexWrap: 'wrap' }}
                                    >
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
                                      <Typography
                                        color="text.secondary"
                                        variant="caption"
                                      >
                                        Data packages
                                      </Typography>
                                      <Stack
                                        direction="row"
                                        spacing={0.75}
                                        sx={{ flexWrap: 'wrap' }}
                                      >
                                        {profile.dataPackages.map((pack) => (
                                          <Chip
                                            color={
                                              pack.required ? 'warning' : 'default'
                                            }
                                            key={`${pack.code}:${pack.kind}`}
                                            label={`${friendlyPackageLabel(pack.code)} · ${triggerLabel(pack.trigger)}`}
                                            size="small"
                                            variant={
                                              pack.required ? 'filled' : 'outlined'
                                            }
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
                                    {triggerLabel(
                                      profile.activationPolicy.requiredDataTrigger,
                                    )}{' '}
                                    · sample data via{' '}
                                    {triggerLabel(
                                      profile.activationPolicy.sampleDataTrigger,
                                    )}
                                  </Typography>
                                </Stack>
                                {status.publication ? (
                                  <Box>
                                    <Typography
                                      color="text.secondary"
                                      variant="caption"
                                    >
                                      Publication
                                    </Typography>
                                    <Typography sx={{ overflowWrap: 'anywhere' }}>
                                      {status.publication.code} ·{' '}
                                      {status.publication.state}
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
                                <Alert
                                  severity={
                                    status.readiness === 'READY'
                                      ? 'success'
                                      : status.readiness === 'PUBLICATION_PENDING'
                                        ? 'warning'
                                        : 'info'
                                  }
                                >
                                  {status.readiness === 'READY'
                                    ? 'Next: verify the Online page or storefront, then review history and audit if evidence is needed.'
                                    : status.readiness === 'PUBLICATION_PENDING'
                                      ? 'Next: review the Process approval task. Approving can change Online; rejecting keeps Online unchanged.'
                                      : 'Next: initialize when the target runtime is available. Axis will create the publishing evidence after import.'}
                                </Alert>
                                <Divider />
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  sx={{ flexWrap: 'wrap' }}
                                >
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
                                      {pending &&
                                      mutation.variables?.operation === 'initiate'
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
                                      {pending &&
                                      mutation.variables?.operation === 'approve'
                                        ? 'Approving...'
                                        : 'Approve'}
                                    </Button>
                                  ) : null}
                                  {status.allowedActions.includes('ROLLBACK') ? (
                                    <Button
                                      color="warning"
                                      disabled={pending}
                                      onClick={() => {
                                        setDestructiveReason(
                                          `${profile.title} rollback requested after Online evidence review.`,
                                        );
                                        setDestructiveConfirmation({
                                          operation: 'rollback',
                                          profile,
                                          status,
                                        });
                                      }}
                                      variant="outlined"
                                    >
                                      {operationLabel('rollback')}
                                    </Button>
                                  ) : null}
                                  {status.allowedActions.includes('RETIRE') ? (
                                    <Button
                                      color="warning"
                                      disabled={pending}
                                      onClick={() => {
                                        setDestructiveReason(
                                          `${profile.title} retirement requested after Online evidence review.`,
                                        );
                                        setDestructiveConfirmation({
                                          operation: 'retire',
                                          profile,
                                          status,
                                        });
                                      }}
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
                                  <Button
                                    disabled={pending}
                                    onClick={() => navigate('/publishing/requests')}
                                    variant="text"
                                  >
                                    Requests
                                  </Button>
                                  <Button
                                    disabled={pending}
                                    onClick={() => navigate('/process/tasks')}
                                    variant="text"
                                  >
                                    Approvals
                                  </Button>
                                  <Button
                                    disabled={pending}
                                    onClick={() => navigate('/publishing/status')}
                                    variant="text"
                                  >
                                    Online status
                                  </Button>
                                </Stack>
                              </>
                            ) : (
                              <Alert severity="warning">
                                Profile status is unavailable.
                              </Alert>
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
      <Dialog
        fullWidth
        maxWidth="sm"
        onClose={() => {
          if (!mutation.isPending) {
            setDestructiveConfirmation(undefined);
            setDestructiveReason('');
          }
        }}
        open={Boolean(destructiveConfirmation)}
      >
        <DialogTitle>
          Confirm{' '}
          {destructiveConfirmation
            ? operationLabel(destructiveConfirmation.operation).toLowerCase()
            : 'operation'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              This can change the Online accelerator state. Confirm only after checking
              the current Online version, rollback candidate, audit evidence, and
              expected browser verification path.
            </Alert>
            {destructiveConfirmation ? (
              <Box>
                <Typography variant="subtitle2">
                  {destructiveConfirmation.profile.title}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {destructiveConfirmation.status.publication?.code ??
                    destructiveConfirmation.profile.baselineCode}{' '}
                  · {destructiveConfirmation.status.readiness}
                </Typography>
              </Box>
            ) : null}
            <Stack spacing={0.75}>
              {[
                'Current Online state has been reviewed.',
                'Publication history and audit evidence identify the target.',
                'Business reason and browser verification path are recorded.',
              ].map((item) => (
                <Chip color="warning" key={item} label={item} variant="outlined" />
              ))}
            </Stack>
            <TextField
              autoFocus
              disabled={mutation.isPending}
              fullWidth
              helperText="Required. This reason is sent to the backend publication authority and should explain the evidence and business intent."
              label="Operator reason"
              minRows={3}
              multiline
              onChange={(event) => setDestructiveReason(event.target.value)}
              value={destructiveReason}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={mutation.isPending}
            onClick={() => {
              setDestructiveConfirmation(undefined);
              setDestructiveReason('');
            }}
          >
            Cancel
          </Button>
          <Button
            color="warning"
            disabled={
              !destructiveConfirmation ||
              !destructiveReasonIsValid ||
              mutation.isPending
            }
            onClick={() => {
              if (!destructiveConfirmation) return;
              mutation.mutate({
                operation: destructiveConfirmation.operation,
                profile: destructiveConfirmation.profile,
                reason: destructiveReason.trim(),
                status: destructiveConfirmation.status,
              });
            }}
            variant="contained"
          >
            {mutation.isPending
              ? 'Submitting...'
              : `Confirm ${
                  destructiveConfirmation
                    ? operationLabel(destructiveConfirmation.operation).toLowerCase()
                    : 'operation'
                }`}
          </Button>
        </DialogActions>
      </Dialog>
    </WorkspaceContainer>
  );
}
