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
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { ShellIcon } from '../../app/shell/ShellIcon';
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
  type ApplicationPreparationStep,
} from './api/applicationInitializationClient';

interface SetupAcceleratorsRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly onBootstrapRefresh?: (() => void | Promise<void>) | undefined;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}

type AcceleratorOperation = 'initiate' | 'rollback' | 'retire' | 'approve' | 'reject';

type AcceleratorFilter =
  | 'ALL'
  | 'PROJECT'
  | 'CUSTOMIZATION'
  | 'DOCUMENTATION'
  | 'NEEDS_ACTION';

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

function stateColor(
  state: string,
): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (state === 'READY') return 'success';
  if (state === 'PUBLICATION_PENDING' || state === 'IMPORTED' || state === 'IMPORTING')
    return 'warning';
  if (state === 'BLOCKED' || state === 'FAILED' || state === 'REJECTED') return 'error';
  if (state === 'NOT_IMPORTED') return 'info';
  return 'default';
}

function operationLabel(operation: AcceleratorOperation): string {
  if (operation === 'initiate') return 'Initialize';
  if (operation === 'rollback') return 'Rollback';
  if (operation === 'retire') return 'Retire';
  if (operation === 'reject') return 'Reject';
  return 'Approve';
}

function canApprove(status: ApplicationInitializationStatus | undefined): boolean {
  return Boolean(
    status?.readiness === 'PUBLICATION_PENDING' &&
    status.publication?.state === 'PENDING_APPROVAL' &&
    status.publication.workflowRef,
  );
}

function statusRefreshesAutomatically(
  status: ApplicationInitializationStatus | undefined,
): boolean {
  return Boolean(
    status?.readiness === 'PUBLICATION_PENDING' ||
      status?.readiness === 'IMPORTING' ||
      status?.readiness === 'IMPORTED' ||
      status?.releaseStatus === 'IMPORTING',
  );
}

function suppressStaleOperationError(
  status: ApplicationInitializationStatus | undefined,
  message: string | undefined,
): boolean {
  return Boolean(
    message &&
      /still running|timed out/iu.test(message) &&
      (status?.readiness === 'PUBLICATION_PENDING' ||
        status?.readiness === 'IMPORTING' ||
        status?.readiness === 'READY' ||
        status?.releaseStatus === 'CURRENT' ||
        status?.releaseStatus === 'IMPORTING'),
  );
}

function preparationNeedsAction(
  status: ApplicationInitializationStatus | undefined,
): boolean {
  return Boolean(
    status?.preparation &&
      !['CURRENT', 'RUNNING', 'BLOCKED'].includes(status.preparation.status),
  );
}

function preparationBlocked(
  status: ApplicationInitializationStatus | undefined,
): boolean {
  return status?.preparation?.status === 'BLOCKED';
}

function blockedPreparationStep(
  status: ApplicationInitializationStatus | undefined,
): ApplicationPreparationStep | undefined {
  return status?.preparation?.steps.find((step) =>
    ['NOT_REGISTERED', 'NOT_ACTIVE', 'RUNTIME_OFFLINE', 'UNAVAILABLE', 'FAILED'].includes(
      step.status ?? '',
    ),
  );
}

function blockedActionSummary(
  status: ApplicationInitializationStatus | undefined,
): string {
  const step = blockedPreparationStep(status);
  if (!step) return 'Required setup needs repair before go-live.';
  const label = step.description || step.label || step.kind || friendlyPackageLabel(step.code);
  if (step.type === 'FUNCTIONAL_MODULE') {
    return `Register and activate ${label} in Module Registry before go-live.`;
  }
  if (step.type === 'MEDIA_ASSET_MANIFEST') {
    return `${step.kind || 'Media setup'} needs developer repair before go-live.`;
  }
  if (step.status === 'UNAVAILABLE') {
    return `${step.kind || 'Setup data'} needs developer repair before go-live.`;
  }
  return `${step.kind || 'Setup data'} needs attention before go-live.`;
}

function setupActionLabel(
  status: ApplicationInitializationStatus | undefined,
): string {
  if (!status) return 'Initialize';
  if (status.readiness === 'READY' && preparationNeedsAction(status)) {
    return 'Prepare setup';
  }
  if (status.readiness === 'READY' && status.releaseStatus === 'UPDATE_AVAILABLE') {
    return 'Update staged';
  }
  return 'Initialize';
}

function triggerLabel(trigger: string): string {
  if (trigger === 'ACTIVATION') return 'activation';
  if (trigger === 'USER') return 'user triggered';
  return trigger.toLowerCase();
}

function readinessLabel(readiness: string): string {
  if (readiness === 'NOT_IMPORTED') return 'Not initialized';
  if (readiness === 'IMPORTING') return 'Preparing Staged';
  if (readiness === 'PUBLICATION_PENDING') return 'Approval in progress';
  if (readiness === 'BLOCKED') return 'Setup blocked';
  if (readiness === 'READY') return 'Online ready';
  if (readiness === 'ROLLED_BACK') return 'Rolled back';
  if (readiness === 'FAILED') return 'Failed';
  if (readiness === 'REJECTED') return 'Rejected';
  return readiness.replaceAll('_', ' ').toLowerCase();
}

function preparationStatusLabel(status: string | undefined, trigger: string): string {
  if (!status) return triggerLabel(trigger);
  if (status === 'SOURCE_READY') return 'Source ready';
  if (status === 'CURRENT') return 'Current';
  if (status === 'NOT_INSTALLED') return 'Not installed';
  if (status === 'NOT_REGISTERED') return 'Register required';
  if (status === 'NOT_ACTIVE') return 'Activate required';
  if (status === 'RUNTIME_OFFLINE') return 'Runtime offline';
  if (status === 'UPDATE_AVAILABLE') return 'Update available';
  if (status === 'UNAVAILABLE') return 'Unavailable';
  if (status === 'OPTIONAL') return 'Optional';
  if (status === 'FAILED') return 'Failed';
  return status.replaceAll('_', ' ').toLowerCase();
}

function releaseStatusLabel(status: string | undefined): string {
  if (status === 'CURRENT') return 'Staged current';
  if (status === 'UPDATE_AVAILABLE') return 'Staged update available';
  if (status === 'NOT_INSTALLED') return 'Staged not installed';
  if (status === 'IMPORTING') return 'Staged importing';
  if (status === 'INVALID_RELEASE') return 'Staged invalid release';
  return status ? `Staged ${status.replaceAll('_', ' ').toLowerCase()}` : 'Staged checking';
}

function releaseStatusColor(
  status: string | undefined,
): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'CURRENT') return 'success';
  if (status === 'INVALID_RELEASE') return 'error';
  if (status === 'UPDATE_AVAILABLE' || status === 'IMPORTING') return 'warning';
  return 'default';
}

function preparationStatusColor(
  status: string | undefined,
): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'CURRENT' || status === 'SOURCE_READY') return 'success';
  if (
    status === 'UNAVAILABLE' ||
    status === 'FAILED' ||
    status === 'NOT_REGISTERED' ||
    status === 'NOT_ACTIVE' ||
    status === 'RUNTIME_OFFLINE'
  )
    return 'error';
  if (status === 'OPTIONAL') return 'default';
  return 'warning';
}

function friendlyPackageLabel(code: string): string {
  return code
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[:._-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/\b\w/gu, (value) => value.toUpperCase());
}

function conciseReleaseLabel(
  profile: ApplicationInitializationProfile,
  status: ApplicationInitializationStatus,
): string {
  const label = friendlyPackageLabel(status.releaseCode);
  const version = status.releaseVersion;
  const family = acceleratorFamily(profile);
  if (family.startsWith('Agora')) {
    if (/content catalog/iu.test(label)) return `Content catalog ${version}`;
    if (/commerce catalog/iu.test(label)) return `Commerce catalog ${version}`;
    return `Storefront release ${version}`;
  }
  if (family.startsWith('Nexus')) {
    if (/partner/iu.test(label)) return `Partner customization ${version}`;
    return `Corporate site ${version}`;
  }
  if (profile.kind !== 'PROJECT') return `Documentation pack ${version}`;
  return `${label} ${version}`;
}

function displayProfileTitle(profile: ApplicationInitializationProfile): string {
  const family = acceleratorFamily(profile);
  if (family.startsWith('Nexus')) return 'Nexus corporate site';
  if (family.startsWith('Agora')) return family;
  if (profile.kind !== 'PROJECT') {
    return profile.title.replace(/\s+documentation$/iu, ' docs');
  }
  return profile.title;
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
  if (isCustomizationProfile(profile)) return 'Customer customization';
  const family = acceleratorFamily(profile);
  if (family.startsWith('Nexus')) return 'Nexus public channel';
  if (family.startsWith('Agora')) return 'Agora storefront channel';
  return 'Customer-facing channel';
}

function isCustomizationProfile(profile: ApplicationInitializationProfile): boolean {
  return (
    profile.category === 'customization' ||
    profile.type.toLocaleLowerCase().includes('customization')
  );
}

function nextActionText(
  status: ApplicationInitializationStatus | undefined,
): string {
  if (!status) return 'Status unavailable';
  if (preparationBlocked(status)) {
    return blockedActionSummary(status);
  }
  if (preparationNeedsAction(status)) {
    return 'Required setup data needs preparation.';
  }
  if (status.readiness === 'READY' && status.releaseStatus === 'UPDATE_AVAILABLE') {
    return 'Staged has a newer package available.';
  }
  if (status.releaseStatus === 'INVALID_RELEASE') {
    return 'Release version update required before this can be initialized.';
  }
  if (status.readiness === 'READY') return 'Online channel is available.';
  if (status.readiness === 'PUBLICATION_PENDING') {
    return 'Waiting for reviewer decision.';
  }
  if (status.readiness === 'IMPORTING') {
    return 'Staged setup is running; status refreshes automatically.';
  }
  if (status.readiness === 'FAILED') return 'Last attempt failed; retry after fix.';
  return 'Ready to initialize.';
}

function SetupMetric({
  color = 'default',
  label,
  value,
}: {
  readonly color?: 'default' | 'success' | 'warning' | 'info';
  readonly label: string;
  readonly value: number;
}) {
  return (
    <Box
      sx={{
        alignItems: 'center',
        bgcolor: 'action.hover',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        display: 'flex',
        gap: 0.75,
        minHeight: 40,
        px: 1,
        py: 0.5,
      }}
    >
      <Typography
        sx={{
          color:
            color === 'success'
              ? 'success.main'
              : color === 'warning'
                ? 'warning.main'
                : color === 'info'
                  ? 'info.main'
                  : 'text.primary',
          fontWeight: 800,
          lineHeight: 1,
        }}
        variant="subtitle2"
      >
        {value}
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ fontWeight: 700, lineHeight: 1.1 }}
        variant="caption"
      >
        {label}
      </Typography>
    </Box>
  );
}

function SetupStatusChip({
  color = 'default',
  label,
  variant = 'filled',
}: {
  readonly color?: 'success' | 'warning' | 'error' | 'info' | 'default';
  readonly label: string;
  readonly variant?: 'filled' | 'outlined';
}) {
  return (
    <Chip
      color={color}
      label={label}
      size="small"
      sx={{
        borderRadius: 1,
        fontWeight: 700,
        justifyContent: 'flex-start',
        maxWidth: '100%',
        minWidth: { md: 148 },
        '& .MuiChip-label': {
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      }}
      variant={variant}
    />
  );
}

function RowIconAction({
  disabled = false,
  label,
  name,
  onClick,
}: {
  readonly disabled?: boolean;
  readonly label: string;
  readonly name: string;
  readonly onClick: () => void;
}) {
  return (
    <Tooltip arrow title={label}>
      <span>
        <IconButton
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          size="small"
          sx={{
            border: 1,
            borderColor: 'divider',
            height: 36,
            width: 36,
          }}
        >
          <ShellIcon fontSize="small" name={name} />
        </IconButton>
      </span>
    </Tooltip>
  );
}

export function SetupAcceleratorsRoutePage(props: SetupAcceleratorsRoutePageProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<AcceleratorFilter>('ALL');
  const [expandedProfile, setExpandedProfile] = useState<string>();
  const [destructiveConfirmation, setDestructiveConfirmation] =
    useState<DestructiveConfirmationState>();
  const [destructiveReason, setDestructiveReason] = useState('');
  const backofficeConnection = selectModuleConnection(props.bootstrap, 'backoffice');
  const processConnection = selectModuleConnection(props.bootstrap, 'workflow', {
    server: 'processServer',
  });
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
      ) => (statusRefreshesAutomatically(query.state.data) ? 2_000 : false),
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
      if (operation === 'approve' || operation === 'reject') {
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
            approved: operation === 'approve',
            outcome:
              operation === 'approve'
                ? 'approved-from-setup-accelerators'
                : 'rejected-from-setup-accelerators',
            reason:
              operation === 'approve'
                ? `${profile.title} approved from Setup & Accelerators`
                : `${profile.title} rejected from Setup & Accelerators; Online remains unchanged`,
          },
        );
        return client.getStatus();
      }
      if (operation === 'rollback') return client.rollback({ reason });
      if (operation === 'retire') return client.retire({ reason });
      return client.initiate();
    },
    onSuccess: async (status, variables) => {
      if (variables.operation === 'rollback' || variables.operation === 'retire') {
        setDestructiveConfirmation(undefined);
        setDestructiveReason('');
      }
      queryClient.setQueryData([...queryRoot, variables.profile.code], status);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryRoot }),
        props.onBootstrapRefresh?.(),
      ]);
    },
    onError: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryRoot }),
        props.onBootstrapRefresh?.(),
      ]);
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
    (item) =>
      !isCustomizationProfile(item.profile) && item.query.data?.readiness !== 'READY',
  ).length;
  const loading = queries.some((query) => query.isPending);
  const filteredStatuses = statuses.filter((item) => {
    if (filter === 'ALL') return true;
    if (filter === 'PROJECT') {
      return item.profile.kind === 'PROJECT' && !isCustomizationProfile(item.profile);
    }
    if (filter === 'CUSTOMIZATION') return isCustomizationProfile(item.profile);
    if (filter === 'DOCUMENTATION') return item.profile.kind !== 'PROJECT';
    return (
      !isCustomizationProfile(item.profile) &&
      (item.query.data?.readiness !== 'READY' ||
        item.query.data?.releaseStatus === 'UPDATE_AVAILABLE')
    );
  });
  const destructiveReasonIsValid = destructiveReason.trim().length >= 12;
  const statusGroups = [
    {
      key: 'projects',
      title: 'Project accelerators',
      description:
        'Business applications such as Nexus, Agora, partner storefronts, and future accelerators.',
      items: filteredStatuses.filter(
        (item) =>
          item.profile.kind === 'PROJECT' &&
          !isCustomizationProfile(item.profile),
      ),
    },
    {
      key: 'customizations',
      title: 'Customer customizations',
      description:
        'Optional project-layer overlays that change an already initialized site or accelerator.',
      items: filteredStatuses.filter(
        (item) => isCustomizationProfile(item.profile),
      ),
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
      <Stack spacing={2}>
        {profiles.length === 0 ? (
          <Alert severity="warning">
            Authenticated bootstrap did not include any application-initialization
            profiles. Setup & Accelerators is backend-published, so project or
            environment configuration must contribute profiles before Axis can
            initialize Nexus, Agora, documentation, or future accelerators.
          </Alert>
        ) : null}
        <Card variant="outlined">
          <CardContent
            sx={{
              bgcolor: 'background.paper',
              p: { xs: 1.5, md: 2 },
              '&:last-child': { pb: { xs: 1.5, md: 2 } },
            }}
          >
            <Box
              sx={{
                alignItems: { md: 'center' },
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  lg: 'minmax(0, 1fr) auto',
                },
                justifyContent: 'space-between',
                minWidth: 0,
              }}
            >
              <Box
                aria-label="Setup profile summary"
                sx={{
                  display: 'grid',
                  gap: 0.75,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, max-content))',
                  minWidth: 0,
                  width: '100%',
                }}
              >
                <SetupMetric color="success" label="Online" value={readyCount} />
                <SetupMetric
                  color="warning"
                  label="Pending approval"
                  value={pendingCount}
                />
                <SetupMetric
                  color="info"
                  label="Need attention"
                  value={actionCount}
                />
              </Box>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{
                  alignItems: { sm: 'center' },
                  flex: '0 0 auto',
                  justifyContent: { xs: 'flex-start', md: 'flex-end' },
                }}
              >
                <TextField
                  label="View"
                  onChange={(event) =>
                    setFilter(event.target.value as AcceleratorFilter)
                  }
                  select
                  size="small"
                  sx={{ minWidth: { xs: '100%', sm: 220 } }}
                  value={filter}
                >
                  <MenuItem value="NEEDS_ACTION">Needs action</MenuItem>
                  <MenuItem value="PROJECT">Project accelerators</MenuItem>
                  <MenuItem value="CUSTOMIZATION">Customer customizations</MenuItem>
                  <MenuItem value="DOCUMENTATION">Documentation packs</MenuItem>
                  <MenuItem value="ALL">All profiles</MenuItem>
                </TextField>
                <Button
                  onClick={() => {
                    void navigate('/process/tasks');
                  }}
                  size="small"
                  startIcon={<ShellIcon fontSize="small" name="tasks" />}
                  sx={{ minHeight: 38 }}
                  variant="outlined"
                >
                  Approval Queue
                </Button>
                <Button
                  onClick={() => {
                    void navigate('/publishing');
                  }}
                  size="small"
                  sx={{ minHeight: 38 }}
                  variant="outlined"
                >
                  Open Publishing
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>
        {loading ? (
          <Stack sx={{ alignItems: 'center', py: 4 }}>
            <CircularProgress aria-label="Loading setup accelerators" />
          </Stack>
        ) : (
          <Card variant="outlined">
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <Stack divider={<Divider flexItem />} spacing={0}>
                {statusGroups.map((group) => (
                  <Box key={group.key}>
                    <Box
                      sx={{
                        alignItems: { xs: 'stretch', sm: 'center' },
                        bgcolor: 'action.hover',
                        display: 'grid',
                        gap: 0.5,
                        gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                        px: 2,
                        py: 1,
                      }}
                    >
                      <Typography component="h3" sx={{ fontWeight: 800 }} variant="subtitle1">
                        {group.title}
                      </Typography>
                      <Typography
                        color="text.secondary"
                        sx={{ justifySelf: { sm: 'end' }, maxWidth: 760 }}
                        variant="body2"
                      >
                        {group.description}
                      </Typography>
                    </Box>
                    <Stack divider={<Divider flexItem />} spacing={0}>
                      {group.items.map(({ profile, query }) => {
                        const status = query.data;
                        const pending =
                          mutation.isPending &&
                          mutation.variables?.profile.code === profile.code;
                        const expanded = expandedProfile === profile.code;
                        const canInitialize =
                          Boolean(
                            status?.allowedActions.includes('INITIALIZE') ||
                              preparationNeedsAction(status),
                          ) &&
                          !preparationBlocked(status) &&
                          status?.releaseStatus !== 'INVALID_RELEASE' &&
                          status?.readiness !== 'IMPORTING' &&
                          status?.readiness !== 'PUBLICATION_PENDING';
                        const rowMutationError =
                          mutation.error instanceof Error &&
                          mutation.variables?.profile.code === profile.code &&
                          !suppressStaleOperationError(status, mutation.error.message)
                            ? mutation.error.message
                            : undefined;
                        return (
                          <Box key={profile.code} sx={{ px: 2, py: 1.5 }}>
                            <Box
                              sx={{
                                alignItems: { xs: 'stretch', md: 'center' },
                                display: 'grid',
                                gap: { xs: 1.25, md: 2 },
                                gridTemplateColumns: {
                                  xs: '1fr',
                                  md: 'minmax(280px, 0.95fr) minmax(300px, 1fr) minmax(360px, auto)',
                                  xl: 'minmax(360px, 1fr) minmax(360px, 0.95fr) minmax(390px, auto)',
                                },
                                minHeight: 72,
                              }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography
                                  component="h4"
                                  noWrap
                                  sx={{ lineHeight: 1.15 }}
                                  title={displayProfileTitle(profile)}
                                  variant="h6"
                                >
                                  {displayProfileTitle(profile)}
                                </Typography>
                                <Typography
                                  color="text.secondary"
                                  sx={{
                                    display: '-webkit-box',
                                    maxWidth: 520,
                                    overflow: 'hidden',
                                    WebkitBoxOrient: 'vertical',
                                    WebkitLineClamp: 2,
                                  }}
                                  title={profile.summary}
                                  variant="body2"
                                >
                                  {profile.summary}
                                </Typography>
                              </Box>
                              {query.error instanceof Error ? (
                                <Alert severity="error">
                                  {profileErrorMessage(profile, query.error.message)}
                                </Alert>
                              ) : status ? (
                                <Stack spacing={0.75} sx={{ alignItems: 'stretch', minWidth: 0 }}>
                                  <Box
                                    sx={{
                                      alignItems: 'center',
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      gap: 0.75,
                                      minWidth: 0,
                                    }}
                                  >
                                    <SetupStatusChip
                                      color={stateColor(status.readiness)}
                                      label={readinessLabel(status.readiness)}
                                    />
                                    <SetupStatusChip
                                      color={releaseStatusColor(status.releaseStatus)}
                                      label={releaseStatusLabel(status.releaseStatus)}
                                      variant="outlined"
                                    />
                                    <SetupStatusChip
                                      label={conciseReleaseLabel(profile, status)}
                                      variant="outlined"
                                    />
                                  </Box>
                                  <Typography
                                    color={
                                      status.readiness === 'FAILED' ||
                                      status.readiness === 'REJECTED' ||
                                      status.releaseStatus === 'INVALID_RELEASE'
                                        ? 'error'
                                        : 'text.secondary'
                                    }
                                    variant="body2"
                                  >
                                    {nextActionText(status)}
                                  </Typography>
                                </Stack>
                              ) : (
                                <Alert severity="warning">
                                  Profile status is unavailable.
                                </Alert>
                              )}
                              <Stack
                                direction="row"
                                spacing={0}
                                sx={{
                                  alignItems: 'center',
                                  alignSelf: 'center',
                                  flexWrap: 'nowrap',
                                  gap: 1,
                                  justifyContent: { xs: 'flex-start', md: 'flex-end' },
                                  justifySelf: { md: 'end' },
                                  minWidth: 0,
                                  overflowX: { xs: 'auto', md: 'visible' },
                                  pb: { xs: 0.25, md: 0 },
                                  pt: 0.25,
                                  width: { xs: '100%', md: 'auto' },
                                }}
                              >
                                {canInitialize && status ? (
                                  <Button
                                    disabled={pending}
                                    onClick={() =>
                                      mutation.mutate({
                                        operation: 'initiate',
                                        profile,
                                        status,
                                      })
                                    }
                                    size="small"
                                    sx={{ minHeight: 40, minWidth: 132, whiteSpace: 'nowrap' }}
                                    variant="contained"
                                  >
                                    {pending &&
                                    mutation.variables?.operation === 'initiate'
                                      ? 'Working...'
                                      : setupActionLabel(status)}
                                  </Button>
                                ) : null}
                                {status && preparationBlocked(status) ? (
                                  <Button
                                    disabled={pending}
                                    onClick={() => navigate('/registry')}
                                    size="small"
                                    sx={{ minHeight: 40, minWidth: 148, whiteSpace: 'nowrap' }}
                                    variant="outlined"
                                  >
                                    Module Registry
                                  </Button>
                                ) : null}
                                {status && canApprove(status) ? (
                                  <Button
                                    disabled={pending}
                                    onClick={() =>
                                      mutation.mutate({
                                        operation: 'approve',
                                        profile,
                                        status,
                                      })
                                    }
                                    size="small"
                                    startIcon={<ShellIcon fontSize="small" name="approve" />}
                                    sx={{ minHeight: 40, minWidth: 116, whiteSpace: 'nowrap' }}
                                    variant="contained"
                                  >
                                    {pending &&
                                    mutation.variables?.operation === 'approve'
                                      ? 'Approving...'
                                      : 'Approve'}
                                  </Button>
                                ) : null}
                                {status && canApprove(status) ? (
                                  <Button
                                    color="warning"
                                    disabled={pending}
                                    onClick={() =>
                                      mutation.mutate({
                                        operation: 'reject',
                                        profile,
                                        status,
                                      })
                                    }
                                    size="small"
                                    sx={{ minHeight: 40, minWidth: 96, whiteSpace: 'nowrap' }}
                                    variant="outlined"
                                  >
                                    {pending &&
                                    mutation.variables?.operation === 'reject'
                                      ? 'Rejecting...'
                                      : 'Reject'}
                                  </Button>
                                ) : null}
                                {status?.allowedActions.includes('ROLLBACK') ? (
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
                                    size="small"
                                    sx={{ minHeight: 40, minWidth: 96, whiteSpace: 'nowrap' }}
                                    variant="outlined"
                                  >
                                    {operationLabel('rollback')}
                                  </Button>
                                ) : null}
                                {status?.allowedActions.includes('RETIRE') ? (
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
                                    size="small"
                                    sx={{ minHeight: 40, minWidth: 96, whiteSpace: 'nowrap' }}
                                    variant="outlined"
                                  >
                                    {operationLabel('retire')}
                                  </Button>
                                ) : null}
                                <RowIconAction
                                  disabled={pending}
                                  label={`Refresh ${profile.title} status`}
                                  name="refresh"
                                  onClick={() => void query.refetch()}
                                />
                                <Tooltip
                                  arrow
                                  title={`${expanded ? 'Hide' : 'Show'} ${profile.title} details`}
                                >
                                  <span>
                                    <IconButton
                                      aria-expanded={expanded}
                                      aria-label={`${expanded ? 'Hide' : 'Show'} ${profile.title} details`}
                                      disabled={pending}
                                      onClick={() =>
                                        setExpandedProfile(
                                          expanded ? undefined : profile.code,
                                        )
                                      }
                                      size="small"
                                      sx={{
                                        border: 1,
                                        borderColor: 'divider',
                                        height: 36,
                                        width: 36,
                                      }}
                                    >
                                      <ShellIcon
                                        fontSize="small"
                                        name={
                                          expanded
                                            ? 'chevron-up'
                                            : 'chevron-down'
                                        }
                                      />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </Stack>
                            </Box>
                            {rowMutationError ? (
                              <Alert severity="error" sx={{ mt: 1.5 }}>
                                {profileErrorMessage(profile, rowMutationError)}
                              </Alert>
                            ) : null}
                            {expanded && status ? (
                              <Box
                                sx={{
                                  bgcolor: 'action.hover',
                                  borderRadius: 1,
                                  mt: 1.5,
                                  p: 1.5,
                                }}
                              >
                                <Stack spacing={1.25}>
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    sx={{ flexWrap: 'wrap' }}
                                  >
                                    <Chip
                                      label={conciseReleaseLabel(profile, status)}
                                      size="small"
                                      variant="outlined"
                                    />
                                    <Chip
                                      label={profilePublishChannel(profile)}
                                      size="small"
                                      variant="outlined"
                                    />
                                    <Chip
                                      label={`${status.applicationCode} · ${status.siteCode}`}
                                      size="small"
                                      variant="outlined"
                                    />
                                    <Chip
                                      label={status.owner}
                                      size="small"
                                      variant="outlined"
                                    />
                                    <Chip
                                      label={`Online approval ${
                                        profile.activationPolicy
                                          .approvalRequiredForOnline
                                          ? 'required'
                                          : 'not required'
                                      }`}
                                      size="small"
                                      variant="outlined"
                                    />
                                  </Stack>
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
                                  {status.preparation?.steps.length ? (
                                    <Box>
                                      <Typography
                                        color="text.secondary"
                                        variant="caption"
                                      >
                                        Preparation evidence
                                      </Typography>
                                      <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                                        {status.preparation.steps.map((step) => (
                                          <Box
                                            key={`${step.code}:${step.targetServer}`}
                                            sx={{
                                              alignItems: 'center',
                                              display: 'grid',
                                              gap: 1,
                                              gridTemplateColumns: {
                                                xs: '1fr',
                                                md: 'minmax(220px, 1fr) minmax(130px, auto) minmax(130px, auto)',
                                              },
                                            }}
                                          >
                                            <Typography sx={{ overflowWrap: 'anywhere' }} variant="body2">
                                              {step.kind || friendlyPackageLabel(step.code)}
                                            </Typography>
                                            <Chip
                                              label={`${step.targetRuntimeRole} · ${step.dataType}`}
                                              size="small"
                                              variant="outlined"
                                            />
                                            <Chip
                                              color={preparationStatusColor(step.status)}
                                              label={preparationStatusLabel(step.status, step.trigger)}
                                              size="small"
                                              variant={
                                                step.status === 'CURRENT' ||
                                                step.status === 'SOURCE_READY'
                                                  ? 'filled'
                                                  : 'outlined'
                                              }
                                            />
                                            {step.message ? (
                                              <Typography
                                                color="text.secondary"
                                                sx={{
                                                  gridColumn: { md: '1 / -1' },
                                                  overflowWrap: 'anywhere',
                                                }}
                                                variant="caption"
                                              >
                                                {step.message}
                                              </Typography>
                                            ) : null}
                                          </Box>
                                        ))}
                                      </Stack>
                                    </Box>
                                  ) : null}
                                  {status.publication ? (
                                    <Box>
                                      <Typography
                                        color="text.secondary"
                                        variant="caption"
                                      >
                                        Publication evidence
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
                                </Stack>
                              </Box>
                            ) : null}
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
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
