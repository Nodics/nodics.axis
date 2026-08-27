import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type Query,
} from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router';

import { axisTokens } from '../app/axisTheme';
import { ShellIcon } from '../app/shell/ShellIcon';
import {
  workspaceComponentGap,
  workspaceContentGap,
  workspacePanelPadding,
} from '../app/shell/workspaceLayout';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisDocumentationCoverage,
  type AxisDocumentationSource,
} from '../bootstrap/publicBootstrap';
import {
  completeProcessTask,
  loadProcessTasks,
} from '../operations/processWorkflow/api/processDefinitionClient';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import { createDocumentationContentPackClient } from './api/documentationContentPackClient';
import {
  createDocumentationPublicationClient,
  type DocumentationPublicationReadiness,
  type DocumentationPublicationStatus,
} from './api/documentationPublicationClient';

interface DocumentationDashboardProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly onPublicationStatusChange?:
    | ((status: DocumentationPublicationStatus) => void | Promise<void>)
    | undefined;
  readonly runtime: AxisRuntimeConfig;
}

const dashboardComponentGap = workspaceComponentGap;
const dashboardContentGap = workspaceContentGap;
const dashboardCardPadding = workspacePanelPadding;
const dashboardPublicationRowGrid = {
  xs: '1fr',
  lg: '250px 260px minmax(0, 1fr)',
} as const;
const dashboardDocumentationSourceRowGrid = {
  xs: '1fr',
  md: 'minmax(260px, 340px) minmax(320px, 1fr)',
  lg: 'minmax(300px, 380px) minmax(320px, 1fr) 220px',
  xl: 'minmax(340px, 420px) minmax(360px, 1fr) 240px',
} as const;
const dashboardRadiusSmall = `${String(axisTokens.radius.small)}px`;
const dashboardRadiusMedium = `${String(axisTokens.radius.medium)}px`;
const dashboardRadiusPill = `${String(axisTokens.radius.pill)}px`;
const approvalTasksRoute = '/process/tasks';
const documentationImportAlreadyRunningMessage =
  'Documentation update is already running. Axis will refresh status automatically.';
const dashboardActionButtonSx = {
  minHeight: 36,
  minWidth: { xs: 0, sm: 108 },
  px: 1.15,
  whiteSpace: 'nowrap',
} as const;
const dashboardSecondaryActionButtonSx = {
  ...dashboardActionButtonSx,
  bgcolor: 'background.paper',
  borderColor: 'divider',
  color: 'text.primary',
  '&:hover': {
    bgcolor: alpha(axisTokens.color.signatureGold, 0.08),
    borderColor: alpha(axisTokens.color.signatureGold, 0.55),
  },
} as const;
const dashboardIconButtonSx = {
  height: 36,
  minWidth: 36,
  p: 0.75,
  width: 36,
} as const;
const dashboardStatusChipSx = {
  maxWidth: '100%',
  minWidth: { md: 190 },
  justifyContent: 'flex-start',
  '& .MuiChip-label': {
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
} as const;
const publicationQueryKey = (enterpriseCode: string, profileCode: string) =>
  ['documentation-publication', enterpriseCode, profileCode] as const;
const packQueryKey = (enterpriseCode: string, packCode: string) =>
  ['documentation-content-pack', enterpriseCode, packCode] as const;

const statusLabels: Readonly<Record<AxisDocumentationCoverage['status'], string>> =
  Object.freeze({
    STRONG: 'Strong',
    PARTIAL: 'Partial',
    NEEDS_WORK: 'Needs work',
    REFERENCE: 'Reference',
  });

const statusColors: Readonly<
  Record<AxisDocumentationCoverage['status'], 'success' | 'warning' | 'error' | 'info'>
> = Object.freeze({
  STRONG: 'success',
  PARTIAL: 'warning',
  NEEDS_WORK: 'error',
  REFERENCE: 'info',
});

function sourceTypeLabel(source: AxisDocumentationSource): string {
  return (
    source.dashboard.kind ?? (source.type === 'OPENAPI' ? 'API contracts' : 'Guide')
  );
}

function sourceSummary(source: AxisDocumentationSource): string {
  return (
    source.dashboard.summary ??
    (source.type === 'OPENAPI'
      ? 'Generated backend API reference and Swagger contracts.'
      : 'Guided documentation from a registered content source.')
  );
}

function documentationSourceDisplayLabel(source: AxisDocumentationSource): string {
  const label = source.label.toLocaleLowerCase();
  if (label.includes('framework')) return 'Framework docs';
  if (label.includes('axis')) return 'Axis docs';
  if (label.includes('kickoff')) return 'Kickoff docs';
  return /docs|documentation/iu.test(source.label)
    ? source.label
    : `${source.label} docs`;
}

function availabilityLabel(
  source: AxisDocumentationSource,
  bootstrap: AxisAuthenticatedBootstrap,
) {
  const connection = selectModuleConnection(bootstrap, source.connectionModule);
  if (!connection) return 'Unavailable';
  if (connection.state === 'UP') return 'Available';
  return connection.state.charAt(0) + connection.state.slice(1).toLocaleLowerCase();
}

function coverageLabel(coverage?: AxisDocumentationCoverage): string {
  if (!coverage) return 'Not measured';
  return `${String(coverage.score)}% documented`;
}

function coverageColor(
  coverage?: AxisDocumentationCoverage,
): 'primary' | 'success' | 'warning' | 'error' | 'info' {
  if (!coverage) return 'primary';
  return statusColors[coverage.status];
}

function DocumentationSourceListItem({
  bootstrap,
  isLast = false,
  source,
}: {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly isLast?: boolean;
  readonly source: AxisDocumentationSource;
}) {
  const [expanded, setExpanded] = useState(false);
  const coverage = source.dashboard.coverage;
  const available = availabilityLabel(source, bootstrap);
  const color = coverageColor(coverage);
  const detailId = `documentation-source-detail-${source.id}`;
  return (
    <Box
      component="li"
      sx={{
        borderBottom: isLast ? 0 : 1,
        borderColor: 'divider',
        display: 'block',
        listStyle: 'none',
        px: { xs: 1.25, md: 1.5 },
        py: { xs: 1.25, md: 1.35 },
      }}
    >
      <Stack spacing={expanded ? dashboardContentGap : 1}>
        <Box
          sx={{
            alignItems: 'center',
            columnGap: { xs: 1, md: 2, xl: 3 },
            display: 'grid',
            gridTemplateColumns: dashboardDocumentationSourceRowGrid,
            minHeight: { md: 68 },
            rowGap: 1,
          }}
        >
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: 'center', minWidth: 0 }}
          >
            <Box
              aria-hidden
              sx={{
                alignItems: 'center',
                bgcolor: alpha(axisTokens.color.signatureGold, 0.16),
                borderRadius: dashboardRadiusSmall,
                color: 'primary.main',
                display: 'inline-flex',
                flex: '0 0 auto',
                height: 40,
                justifyContent: 'center',
                width: 40,
              }}
            >
              <ShellIcon fontSize="small" name={source.dashboard.icon ?? 'content'} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap title={source.label} variant="h6">
                {source.label}
              </Typography>
              <Typography color="text.secondary" noWrap variant="body2">
                {sourceTypeLabel(source)}
              </Typography>
            </Box>
          </Stack>

          <Stack spacing={0.75} sx={{ minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={0}
              sx={{
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 0.75,
                minWidth: 0,
              }}
            >
              <Chip
                label={source.type === 'OPENAPI' ? 'OpenAPI' : 'CMS'}
                size="small"
              />
              <Chip label={available} size="small" variant="outlined" />
              {coverage ? (
                <Chip
                  color={statusColors[coverage.status]}
                  label={statusLabels[coverage.status]}
                  size="small"
                />
              ) : null}
            </Stack>
            <Typography color="text.secondary" variant="caption">
              {coverageLabel(coverage)}
            </Typography>
          </Stack>

          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: 'center',
              gridColumn: { xs: '1', md: '2', lg: 'auto' },
              justifyContent: { xs: 'flex-start', md: 'flex-end' },
              justifySelf: { xs: 'start', md: 'end' },
              minWidth: 0,
            }}
          >
            <Button
              component={RouterLink}
              size="small"
              sx={{
                ...dashboardActionButtonSx,
                minWidth: { xs: 0, sm: 184, lg: 204 },
              }}
              to={source.route}
              variant="contained"
            >
              Open {source.label}
            </Button>
            <Tooltip
              arrow
              title={`${expanded ? 'Hide' : 'Show'} ${source.label} overview details`}
            >
              <IconButton
                aria-controls={detailId}
                aria-expanded={expanded}
                aria-label={`${expanded ? 'Hide' : 'Show'} ${source.label} overview details`}
                onClick={() => setExpanded((current) => !current)}
                size="small"
                sx={dashboardIconButtonSx}
              >
                <ShellIcon
                  fontSize="small"
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        <Collapse id={detailId} in={expanded} timeout="auto" unmountOnExit>
          <Stack spacing={dashboardContentGap} sx={{ pt: 1 }}>
            <Divider />
            <Typography color="text.secondary" variant="body2">
              {sourceSummary(source)}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Chip
                label={`Owner: ${source.ownerModule}`}
                size="small"
                variant="outlined"
              />
              {source.dashboard.audiences.map((audience) => (
                <Chip
                  key={audience}
                  label={audience}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Stack>
            <Box>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
              >
                <Typography variant="subtitle2">{coverageLabel(coverage)}</Typography>
                {coverage ? (
                  <Chip
                    color={statusColors[coverage.status]}
                    label={statusLabels[coverage.status]}
                    size="small"
                  />
                ) : null}
              </Stack>
              <LinearProgress
                aria-label={`${source.label} documentation coverage`}
                color={color}
                value={coverage?.score ?? 0}
                variant="determinate"
                sx={{ borderRadius: dashboardRadiusPill, height: 8 }}
              />
            </Box>
          </Stack>
        </Collapse>
      </Stack>
    </Box>
  );
}

function documentationReadinessLabel(value: string | undefined): string {
  switch (value) {
    case 'CURRENT':
      return 'current';
    case 'UPDATE_AVAILABLE':
      return 'update available';
    case 'NOT_INSTALLED':
      return 'not installed';
    case 'IMPORTING':
      return 'importing';
    case 'INVALID_RELEASE':
      return 'invalid release';
    default:
      return value ? value.replaceAll('_', ' ').toLocaleLowerCase() : 'checking';
  }
}

function documentationPublicationReadinessLabel(
  readiness: DocumentationPublicationReadiness | undefined,
): string {
  switch (readiness) {
    case 'NOT_IMPORTED':
      return 'Not initialized';
    case 'IMPORTED':
      return 'Approval needed';
    case 'PUBLICATION_PENDING':
      return 'Approval in progress';
    case 'READY':
      return 'Online ready';
    case 'REJECTED':
      return 'Rejected';
    case 'FAILED':
      return 'Failed';
    case 'ROLLED_BACK':
      return 'Rolled back';
    case 'RETIRED':
      return 'Retired';
    default:
      return 'Checking';
  }
}

function publicationReadinessColor(
  readiness: DocumentationPublicationStatus['readiness'] | undefined,
): 'default' | 'success' | 'warning' | 'error' {
  if (['FAILED', 'REJECTED'].includes(readiness ?? '')) return 'error';
  if (readiness === 'READY') return 'success';
  if (readiness === 'PUBLICATION_PENDING' || readiness === 'IMPORTED') return 'warning';
  return 'default';
}

function isActionablePublicationTask(task: { readonly status: string }): boolean {
  return ['OPEN', 'CLAIMED', 'ESCALATED'].includes(task.status);
}

function documentationApprovalDecision(
  approved: boolean,
  source: AxisDocumentationSource,
) {
  return Object.freeze({
    approved,
    outcome: approved ? 'approved-from-documentation-dashboard' : 'rejected-from-documentation-dashboard',
    reason: approved
      ? `${source.label} documentation publication approved from Documentation publication center`
      : `${source.label} documentation publication rejected from Documentation publication center`,
  });
}

function DetailValue({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | number | undefined | null;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography color="text.secondary" variant="caption">
        {label}
      </Typography>
      <Typography sx={{ overflowWrap: 'anywhere' }} variant="body2">
        {value ?? 'Unavailable'}
      </Typography>
    </Box>
  );
}

function networkErrorLabel(
  error: string | undefined,
  hasStatusData: boolean,
): string | undefined {
  if (!error) return undefined;
  if (/failed to fetch|networkerror|load failed/iu.test(error)) {
    return hasStatusData ? 'Refresh failed' : 'Backend unavailable';
  }
  return error;
}

function isDocumentationImportAlreadyRunning(error: string | undefined): boolean {
  return Boolean(error && /documentation update is already running|import is already running/iu.test(error));
}

function documentationOperatorGuidance({
  hasAdministrationConnection,
  hasInitializationProfile,
  packOperation,
  packState,
  publicationReadiness,
  transientImportRunning,
}: {
  readonly hasAdministrationConnection: boolean;
  readonly hasInitializationProfile: boolean;
  readonly packOperation: string | undefined;
  readonly packState: string | undefined;
  readonly publicationReadiness: DocumentationPublicationReadiness | undefined;
  readonly transientImportRunning: boolean;
}): {
  readonly body: string;
  readonly severity: 'error' | 'info' | 'success' | 'warning';
  readonly title: string;
} {
  if (!hasAdministrationConnection) {
    return {
      severity: 'error',
      title: 'Connect Platform BackOffice',
      body: 'Axis cannot manage this documentation pack until the Platform BackOffice connection is available.',
    };
  }
  if (!hasInitializationProfile) {
    return {
      severity: 'error',
      title: 'Configure the initialization profile',
      body: 'This source needs an initialization profile before Axis can install or publish its documentation pack.',
    };
  }
  if (transientImportRunning || packState === 'IMPORTING') {
    return {
      severity: 'info',
      title: 'Update is running',
      body: 'Axis has already started the Staged documentation update. Wait for the refresh to complete, then continue with approval.',
    };
  }
  if (packOperation === 'IMPORT') {
    return {
      severity: 'info',
      title: 'Install the pack to Staged',
      body: 'Import the documentation pack into Staged so reviewers can inspect generated pages, navigation, and evidence.',
    };
  }
  if (packOperation === 'UPDATE') {
    return {
      severity: 'info',
      title: 'Update the Staged pack',
      body: 'Refresh the Staged copy first, then request approval for the updated documentation release.',
    };
  }
  if (publicationReadiness === 'IMPORTED') {
    return {
      severity: 'warning',
      title: 'Request approval for Online',
      body: 'Click Request approval. Axis will create a Process task where an admin or reviewer can approve publication without bypassing governance.',
    };
  }
  if (publicationReadiness === 'PUBLICATION_PENDING') {
    return {
      severity: 'info',
      title: 'Pending review',
      body: 'A reviewer can inspect the publication evidence and approve or reject the Online release.',
    };
  }
  if (publicationReadiness === 'READY') {
    return {
      severity: 'success',
      title: 'Open the documentation',
      body: 'This source is Online-ready. The documentation link is available for the configured audience.',
    };
  }
  if (publicationReadiness === 'FAILED') {
    return {
      severity: 'error',
      title: 'Review the failure and retry',
      body: 'Open the details, inspect the publication evidence, resolve the issue, and retry the approval request.',
    };
  }
  if (publicationReadiness === 'REJECTED') {
    return {
      severity: 'warning',
      title: 'Resolve reviewer feedback',
      body: 'The request was rejected. Update the Staged source and submit a new approval request when it is ready.',
    };
  }
  return {
    severity: 'info',
    title: 'Refresh status',
    body: 'Axis is checking the Staged and Online states. Refresh if the latest backend action is not visible yet.',
  };
}

function HeaderMetric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <Box
      sx={{
        minWidth: 96,
        px: 1.5,
        py: 0.75,
      }}
    >
      <Typography color="text.secondary" variant="caption">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }} variant="subtitle2">
        {value}
      </Typography>
    </Box>
  );
}

function DocumentationApprovalGuide() {
  const steps = Object.freeze([
    'Staged ready',
    'Request approval',
    'Reviewer decision',
    'Online unlocked',
  ]);

  return (
    <Box
      sx={{
        bgcolor: alpha(axisTokens.color.signatureGold, 0.04),
        border: 1,
        borderColor: 'divider',
        borderRadius: dashboardRadiusSmall,
        p: { xs: 1.25, md: 1.5 },
      }}
    >
      <Stack spacing={1.25}>
        <Box
          sx={{
            alignItems: { xs: 'stretch', md: 'center' },
            display: 'grid',
            gap: 1,
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) auto' },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2">Publication flow</Typography>
            <Typography color="text.secondary" variant="body2">
              Staged documentation becomes visible only after governed review.
            </Typography>
          </Box>
          <Button
            component={RouterLink}
            size="small"
            startIcon={<ShellIcon fontSize="small" name="tasks" />}
            sx={{
              ...dashboardActionButtonSx,
              bgcolor: axisTokens.color.charcoal[900],
              color: 'common.white',
              justifySelf: { xs: 'start', lg: 'end' },
              minWidth: { xs: 0, sm: 128 },
              '& .MuiButton-startIcon': {
                color: axisTokens.color.signatureGold,
              },
              '&:hover': {
                bgcolor: axisTokens.color.charcoal[700],
              },
            }}
            to={approvalTasksRoute}
            variant="contained"
          >
            Review queue
          </Button>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gap: 0.75,
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
            },
            minWidth: 0,
          }}
        >
          {steps.map((step, index) => (
            <Box
              key={step}
              sx={{
                alignItems: 'center',
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: dashboardRadiusSmall,
                display: 'flex',
                gap: 0.75,
                minHeight: 32,
                minWidth: 0,
                px: 0.9,
              }}
            >
              <Typography
                aria-hidden
                sx={{
                  alignItems: 'center',
                  bgcolor: alpha(axisTokens.color.signatureGold, 0.18),
                  borderRadius: dashboardRadiusPill,
                  color: 'text.primary',
                  display: 'inline-flex',
                  flex: '0 0 auto',
                  fontWeight: 700,
                  height: 20,
                  justifyContent: 'center',
                  width: 20,
                }}
                variant="caption"
              >
                {String(index + 1)}
              </Typography>
              <Typography noWrap sx={{ fontWeight: 700 }} variant="caption">
                {step}
              </Typography>
            </Box>
          ))}
        </Box>
      </Stack>
    </Box>
  );
}

type CmsDocumentationSource = Extract<
  AxisDocumentationSource,
  { readonly type: 'CMS' }
>;

function isCmsDocumentationSource(
  source: AxisDocumentationSource,
): source is CmsDocumentationSource {
  return source.type === 'CMS';
}

function CmsDocumentationReadinessCard({
  accessToken,
  bootstrap,
  isLast = false,
  onPublicationStatusChange,
  runtime,
  source,
}: {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly isLast?: boolean;
  readonly onPublicationStatusChange?:
    | ((status: DocumentationPublicationStatus) => void | Promise<void>)
    | undefined;
  readonly runtime: AxisRuntimeConfig;
  readonly source: Extract<AxisDocumentationSource, { readonly type: 'CMS' }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const administrationConnection = selectModuleConnection(bootstrap, 'backoffice');
  const processConnection = selectModuleConnection(bootstrap, 'workflow', {
    server: 'processServer',
  });
  const initializationProfile = source.initializationProfile;
  const canCheck = Boolean(administrationConnection && initializationProfile);
  const packClient =
    administrationConnection && initializationProfile
      ? createDocumentationContentPackClient({
          connection: administrationConnection,
          enterpriseCode: runtime.enterpriseCode,
          accessToken,
          timeoutMs: runtime.requestTimeoutMs,
          profileCode: initializationProfile,
        })
      : undefined;
  const publicationClient =
    administrationConnection && initializationProfile
      ? createDocumentationPublicationClient({
          connection: administrationConnection,
          enterpriseCode: runtime.enterpriseCode,
          accessToken,
          timeoutMs: runtime.requestTimeoutMs,
          profileCode: initializationProfile,
        })
      : undefined;
  const pack = useQuery({
    queryKey: packQueryKey(runtime.enterpriseCode, source.packCode),
    queryFn: () => {
      if (!packClient) throw new Error('Documentation administration is unavailable');
      return packClient.getStatus();
    },
    enabled: canCheck,
    refetchInterval: (query) =>
      query.state.data?.state === 'IMPORTING' ? 2_000 : false,
  });
  const publication = useQuery({
    queryKey: publicationQueryKey(runtime.enterpriseCode, initializationProfile ?? ''),
    queryFn: () => {
      if (!publicationClient) {
        throw new Error('Documentation publication is unavailable');
      }
      return publicationClient.getStatus();
    },
    enabled: canCheck,
    refetchInterval: (query) =>
      query.state.data?.readiness === 'PUBLICATION_PENDING' ? 2_000 : false,
  });
  const workflowRef = publication.data?.publication?.workflowRef;
  const approvalTasks = useQuery({
    queryKey: [
      'documentation-publication-approval-tasks',
      runtime.enterpriseCode,
      workflowRef ?? '',
    ],
    queryFn: () => {
      if (!processConnection || !workflowRef) {
        throw new Error('The governed Process approval task is unavailable');
      }
      return loadProcessTasks(
        processConnection,
        {
          accessToken,
          enterpriseCode: runtime.enterpriseCode,
          timeoutMs: runtime.requestTimeoutMs,
        },
        workflowRef,
      );
    },
    enabled: Boolean(
      processConnection &&
        workflowRef &&
        publication.data?.readiness === 'PUBLICATION_PENDING',
    ),
    refetchInterval: (query) =>
      query.state.data?.some(isActionablePublicationTask) ? 2_000 : false,
  });
  const actionableApprovalTask = approvalTasks.data?.find(isActionablePublicationTask);
  const reconcile = async () => {
    await Promise.all([pack.refetch(), publication.refetch(), approvalTasks.refetch()]);
  };
  const packMutation = useMutation({
    mutationFn: () => {
      if (!packClient) throw new Error('Documentation administration is unavailable');
      return packClient.importOrUpdate();
    },
    onSuccess: async (nextStatus) => {
      queryClient.setQueryData(
        packQueryKey(runtime.enterpriseCode, source.packCode),
        nextStatus,
      );
      await publication.refetch();
    },
    onError: async (mutationError) => {
      if (!isDocumentationImportAlreadyRunning(mutationError.message)) return;
      await new Promise((resolve) => globalThis.setTimeout(resolve, 1_500));
      await reconcile();
    },
  });
  const publicationMutation = useMutation({
    mutationFn: () => {
      if (!publicationClient) {
        throw new Error('Documentation publication is unavailable');
      }
      return publicationClient.initiate();
    },
    onSuccess: async (nextStatus) => {
      queryClient.setQueryData(
        publicationQueryKey(runtime.enterpriseCode, initializationProfile ?? ''),
        nextStatus,
      );
      await Promise.all([
        pack.refetch(),
        onPublicationStatusChange?.(nextStatus),
      ]);
    },
  });
  const approvalMutation = useMutation({
    mutationFn: async (approved: boolean) => {
      if (!processConnection || !workflowRef) {
        throw new Error('The governed Process approval task is unavailable');
      }
      const tasks = await loadProcessTasks(
        processConnection,
        {
          accessToken,
          enterpriseCode: runtime.enterpriseCode,
          timeoutMs: runtime.requestTimeoutMs,
        },
        workflowRef,
      );
      const task = tasks.find(isActionablePublicationTask);
      if (!task) throw new Error('No actionable Process approval task was found');
      await completeProcessTask(
        processConnection,
        {
          accessToken,
          enterpriseCode: runtime.enterpriseCode,
          timeoutMs: runtime.requestTimeoutMs,
        },
        task.code,
        documentationApprovalDecision(approved, source),
      );
      if (!publicationClient) {
        throw new Error('Documentation publication is unavailable');
      }
      return publicationClient.getStatus();
    },
    onSuccess: async (nextStatus) => {
      queryClient.setQueryData(
        publicationQueryKey(runtime.enterpriseCode, initializationProfile ?? ''),
        nextStatus,
      );
      await Promise.all([
        pack.refetch(),
        approvalTasks.refetch(),
        onPublicationStatusChange?.(nextStatus),
      ]);
    },
  });
  const packOperation = pack.data?.allowedOperations[0];
  const publicationReadiness = publication.data?.readiness;
  const canPublish =
    pack.data?.state === 'CURRENT' &&
    publication.data?.allowedActions.includes('INITIALIZE') &&
    publicationReadiness !== 'PUBLICATION_PENDING' &&
    publicationReadiness !== 'READY';
  const busy =
    pack.isPending ||
    publication.isPending ||
    packMutation.isPending ||
    publicationMutation.isPending ||
    approvalMutation.isPending;
  const error =
    pack.error instanceof Error
      ? pack.error.message
      : publication.error instanceof Error
        ? publication.error.message
        : packMutation.error instanceof Error
          ? packMutation.error.message
          : publicationMutation.error instanceof Error
            ? publicationMutation.error.message
            : approvalTasks.error instanceof Error
              ? approvalTasks.error.message
              : approvalMutation.error instanceof Error
                ? approvalMutation.error.message
                : undefined;
  const hasBlockingConfiguration = !administrationConnection || !initializationProfile;
  const hasStatusData = Boolean(pack.data || publication.data);
  const rowError = networkErrorLabel(error, hasStatusData);
  const transientImportRunning = isDocumentationImportAlreadyRunning(rowError);
  const rowStatus =
    (transientImportRunning ? documentationImportAlreadyRunningMessage : rowError) ??
    (!administrationConnection
      ? 'Platform BackOffice is unavailable.'
      : !initializationProfile
        ? 'Initialization profile is not configured.'
        : publication.data?.readiness === 'IMPORTED'
          ? 'Imported to Staged; request approval for Online readiness.'
          : publication.data?.readiness === 'PUBLICATION_PENDING'
            ? 'Approval or Online activation is in progress.'
            : undefined);
  const operatorGuidance = documentationOperatorGuidance({
    hasAdministrationConnection: Boolean(administrationConnection),
    hasInitializationProfile: Boolean(initializationProfile),
    packOperation,
    packState: pack.data?.state,
    publicationReadiness: publication.data?.readiness,
    transientImportRunning,
  });
  const canOpenApprovalTasks =
    publication.data?.readiness === 'PUBLICATION_PENDING';
  const approvalTaskCount = approvalTasks.data?.length ?? 0;
  const canDecideInline = Boolean(actionableApprovalTask);
  const canModifyStaged = Boolean(packOperation && !canOpenApprovalTasks);
  const pendingApprovalStatus = canOpenApprovalTasks
    ? [
        `Pending review`,
        `requested by ${publication.data?.publication?.requestedBy ?? 'unknown'}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;
  const packActionLabel =
    packOperation === 'UPDATE' ? 'Update staged' : 'Install staged';
  const packActionTooltip =
    packOperation === 'UPDATE'
      ? (pack.data?.presentation.updateAction ?? 'Update documentation')
      : (pack.data?.presentation.importAction ?? 'Install documentation');
  const rowStatusText = rowError ?? pendingApprovalStatus ?? rowStatus;
  const rowStatusIsError = Boolean((rowError && !transientImportRunning) || hasBlockingConfiguration);

  return (
    <Box
      component="li"
      sx={{
        borderBottom: isLast ? 0 : 1,
        borderColor: 'divider',
        display: 'block',
        listStyle: 'none',
        px: { xs: 1.25, md: 1.5 },
        py: { xs: 1.25, md: 1.35 },
      }}
    >
      <Stack spacing={expanded ? dashboardContentGap : 1}>
        <Box
          sx={{
            alignItems: { xs: 'stretch', md: 'center' },
            columnGap: 1.5,
            display: 'grid',
            gridTemplateColumns: dashboardPublicationRowGrid,
            minHeight: { lg: 76 },
            rowGap: 1,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              noWrap
              title={documentationSourceDisplayLabel(source)}
              variant="h6"
            >
              {documentationSourceDisplayLabel(source)}
            </Typography>
            <Typography
              color="text.secondary"
              noWrap
              title={`${source.packCode} · ${initializationProfile ?? 'profile unavailable'}`}
              variant="body2"
            >
              Staged-to-Online release
            </Typography>
          </Box>

          <Stack
            spacing={0.75}
            sx={{
              alignItems: 'flex-start',
              minWidth: 0,
            }}
          >
            <Stack
              direction="column"
              spacing={0.75}
              sx={{
                alignItems: 'flex-start',
                flexWrap: 'nowrap',
                gap: 0.75,
                minWidth: 0,
              }}
            >
              <Chip
                label={`Staged: ${documentationReadinessLabel(pack.data?.state)}`}
                size="small"
                sx={dashboardStatusChipSx}
                variant="outlined"
              />
              <Chip
                color={publicationReadinessColor(publication.data?.readiness)}
                label={`Online: ${documentationPublicationReadinessLabel(
                  publication.data?.readiness,
                ).toLocaleLowerCase()}`}
                size="small"
                sx={dashboardStatusChipSx}
              />
            </Stack>
            {rowStatusText ? (
              <Typography
                color={rowStatusIsError ? 'error' : 'text.secondary'}
                sx={{ overflowWrap: 'anywhere' }}
                title={error ? `Latest backend request failed: ${error}` : undefined}
                variant="caption"
              >
                {rowStatusText}
              </Typography>
            ) : null}
          </Stack>

          <Stack
            direction="row"
            spacing={0}
            sx={{
              alignItems: 'center',
              flexWrap: 'nowrap',
              gap: 1,
              gridColumn: { xs: '1', lg: 'auto' },
              justifyContent: { xs: 'flex-start', lg: 'flex-end' },
              justifySelf: { lg: 'stretch' },
              minWidth: 0,
              overflowX: { xs: 'auto', lg: 'visible' },
              pb: { xs: 0.25, lg: 0 },
              width: '100%',
            }}
          >
            {canModifyStaged ? (
              <Tooltip arrow title={packActionTooltip}>
                <span>
                  <Button
                    disabled={busy}
                    onClick={() => packMutation.mutate()}
                    size="small"
                    sx={
                      canDecideInline || canPublish
                        ? dashboardSecondaryActionButtonSx
                        : dashboardActionButtonSx
                    }
                    variant={canDecideInline || canPublish ? 'outlined' : 'contained'}
                  >
                    {packMutation.isPending ? 'Working...' : packActionLabel}
                  </Button>
                </span>
              </Tooltip>
            ) : null}
            {canPublish ? (
              <Tooltip
                arrow
                title={
                  publication.data?.readiness === 'FAILED'
                    ? 'Retry publication'
                    : 'Publish / request approval'
                }
              >
                <span>
                  <Button
                    aria-label={
                      publication.data?.readiness === 'FAILED'
                        ? 'Retry publication'
                        : 'Publish / request approval'
                    }
                    disabled={busy}
                    onClick={() => publicationMutation.mutate()}
                    size="small"
                    startIcon={<ShellIcon fontSize="small" name="approve" />}
                    sx={{
                      ...dashboardActionButtonSx,
                      bgcolor: alpha(axisTokens.color.signatureGold, 0.22),
                      color: 'primary.main',
                      '&:hover': {
                        bgcolor: alpha(axisTokens.color.signatureGold, 0.34),
                      },
                    }}
                    variant="contained"
                  >
                    {publication.data?.readiness === 'FAILED'
                      ? 'Retry publication'
                      : 'Request approval'}
                  </Button>
                </span>
              </Tooltip>
            ) : null}
            {canDecideInline ? (
              <>
                <Button
                  disabled={busy}
                  onClick={() => approvalMutation.mutate(true)}
                  size="small"
                  startIcon={<ShellIcon fontSize="small" name="approve" />}
                  sx={dashboardActionButtonSx}
                  variant="contained"
                >
                  Approve
                </Button>
                <Button
                  color="warning"
                  disabled={busy}
                  onClick={() => approvalMutation.mutate(false)}
                  size="small"
                  sx={{
                    ...dashboardActionButtonSx,
                    minWidth: { xs: 0, sm: 92 },
                  }}
                  variant="outlined"
                >
                  Reject
                </Button>
              </>
            ) : null}
            <Tooltip arrow title="Refresh status">
              <span>
                <IconButton
                  aria-label="Refresh status"
                  disabled={busy || !canCheck}
                  onClick={() => void reconcile()}
                  size="small"
                  sx={dashboardIconButtonSx}
                >
                  <ShellIcon fontSize="small" name="refresh" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip
              arrow
              title={`${expanded ? 'Hide' : 'Show'} ${source.label} details`}
            >
              <span>
                <IconButton
                  aria-expanded={expanded}
                  aria-label={`${expanded ? 'Hide' : 'Show'} ${source.label} details`}
                  onClick={() => setExpanded((current) => !current)}
                  size="small"
                  sx={dashboardIconButtonSx}
                >
                  <ShellIcon
                    fontSize="small"
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                  />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>

        {!canOpenApprovalTasks ? (
          <Box
            sx={{
              bgcolor:
                operatorGuidance.severity === 'error'
                  ? alpha(axisTokens.color.error, 0.06)
                  : operatorGuidance.severity === 'success'
                    ? alpha(axisTokens.color.success, 0.06)
                    : operatorGuidance.severity === 'warning'
                      ? alpha(axisTokens.color.warning, 0.06)
                      : alpha(axisTokens.color.info, 0.05),
              borderLeft: 3,
              borderColor:
                operatorGuidance.severity === 'error'
                  ? axisTokens.color.error
                  : operatorGuidance.severity === 'success'
                    ? axisTokens.color.success
                    : operatorGuidance.severity === 'warning'
                      ? axisTokens.color.warning
                      : axisTokens.color.info,
              borderRadius: dashboardRadiusSmall,
              px: 1.25,
              py: 1,
            }}
          >
            <Typography sx={{ fontWeight: 700 }} variant="body2">
              Next step: {operatorGuidance.title}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {operatorGuidance.body}
            </Typography>
          </Box>
        ) : null}

        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Stack spacing={dashboardContentGap} sx={{ pt: 1 }}>
            <Divider />
            {!administrationConnection ? (
              <Alert severity="warning">
                Platform BackOffice is unavailable, so documentation initialization
                cannot be managed from Axis right now.
              </Alert>
            ) : !initializationProfile ? (
              <Alert severity="warning">
                This documentation source does not declare an initialization profile.
              </Alert>
            ) : null}

            {error ? (
              <Alert severity="error">Latest backend request failed: {error}</Alert>
            ) : null}
            {publication.data?.readiness === 'IMPORTED' ? (
              <Alert severity="warning">
                The pack is installed in Staged. Create the approval request before
                opening this documentation area for Online readers.
              </Alert>
            ) : publication.data?.readiness === 'PUBLICATION_PENDING' ? (
              <Alert severity="info">
                Review before approval: publication{' '}
                {publication.data?.publication?.code ?? 'pending'}, workflow{' '}
                {workflowRef ?? 'unavailable'}, requested by{' '}
                {publication.data?.publication?.requestedBy ?? 'unknown'}.
                {' '}Approve to move this pack Online, or reject to keep the
                current Online version unchanged.
              </Alert>
            ) : null}

            <Box
              sx={{
                display: 'grid',
                gap: dashboardContentGap,
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(4, minmax(0, 1fr))',
                },
              }}
            >
              <DetailValue label="Owner module" value={source.ownerModule} />
              <DetailValue label="Connection module" value={source.connectionModule} />
              <DetailValue label="Site" value={source.site} />
              <DetailValue label="Catalog" value={source.catalog} />
              <DetailValue label="Default page" value={source.defaultPage} />
              <DetailValue
                label="Available version"
                value={pack.data?.availableVersion}
              />
              <DetailValue
                label="Installed version"
                value={pack.data?.installedVersion}
              />
              <DetailValue label="Import run" value={pack.data?.runId} />
              <DetailValue
                label="Publication site"
                value={publication.data?.siteCode}
              />
              <DetailValue label="Release code" value={publication.data?.releaseCode} />
              <DetailValue
                label="Release version"
                value={publication.data?.releaseVersion}
              />
              <DetailValue
                label="Online readiness"
                value={documentationPublicationReadinessLabel(
                  publication.data?.readiness,
                )}
              />
              <DetailValue
                label="Release status"
                value={publication.data?.releaseStatus}
              />
              <DetailValue
                label="Publication code"
                value={publication.data?.publication?.code}
              />
              <DetailValue
                label="Publication state"
                value={publication.data?.publication?.state}
              />
              <DetailValue
                label="Publication revision"
                value={publication.data?.publication?.revision}
              />
              <DetailValue
                label="Correlation"
                value={publication.data?.publication?.correlationId}
              />
            </Box>
          </Stack>
        </Collapse>
      </Stack>
    </Box>
  );
}

export function DocumentationDashboard({
  accessToken,
  bootstrap,
  onPublicationStatusChange,
  runtime,
}: DocumentationDashboardProps) {
  const sources = bootstrap.documentationSources;
  const cmsSources = sources.filter(isCmsDocumentationSource);
  const apiSources = sources.filter((source) => source.type === 'OPENAPI');
  const administrationConnection = selectModuleConnection(bootstrap, 'backoffice');
  const managedCmsSources = cmsSources.filter((source) => source.initializationProfile);
  const publicationQueries = useQueries({
    queries: managedCmsSources.map((source) => ({
      enabled: Boolean(administrationConnection && source.initializationProfile),
      queryKey: publicationQueryKey(
        runtime.enterpriseCode,
        source.initializationProfile ?? '',
      ),
      queryFn: () => {
        if (!administrationConnection || !source.initializationProfile) {
          throw new Error('Documentation publication is unavailable');
        }
        return createDocumentationPublicationClient({
          connection: administrationConnection,
          enterpriseCode: runtime.enterpriseCode,
          accessToken,
          timeoutMs: runtime.requestTimeoutMs,
          profileCode: source.initializationProfile,
        }).getStatus();
      },
      refetchInterval: (
        query: Query<
          DocumentationPublicationStatus,
          Error,
          DocumentationPublicationStatus,
          readonly unknown[]
        >,
      ) => (query.state.data?.readiness === 'PUBLICATION_PENDING' ? 2_000 : false),
    })),
  });
  const readyCmsCount = publicationQueries.filter(
    (query) => query.data?.readiness === 'READY',
  ).length;
  const pendingCmsCount = publicationQueries.filter(
    (query) => query.data?.readiness === 'PUBLICATION_PENDING',
  ).length;
  const approvalNeededCmsCount = publicationQueries.filter(
    (query) => query.data?.readiness === 'IMPORTED',
  ).length;
  const blockedCmsCount = publicationQueries.filter((query) =>
    ['FAILED', 'REJECTED'].includes(query.data?.readiness ?? ''),
  ).length;
  const publicationChecking = publicationQueries.some((query) => query.isPending);
  const documentationVisible =
    cmsSources.length === 0 ||
    (managedCmsSources.length === cmsSources.length &&
      managedCmsSources.length > 0 &&
      readyCmsCount === managedCmsSources.length);
  const readyCmsProfiles = new Set(
    publicationQueries
      .map((query) =>
        query.data?.readiness === 'READY' ? query.data.profileCode : undefined,
      )
      .filter((profileCode): profileCode is string => Boolean(profileCode)),
  );
  const visibleDocumentationSources = sources.filter((source) => {
    if (source.type === 'OPENAPI') return true;
    return Boolean(
      source.initializationProfile &&
        readyCmsProfiles.has(source.initializationProfile),
    );
  });
  const measured = sources.filter((source) => source.dashboard.coverage);
  const averageCoverage = measured.length
    ? Math.round(
        measured.reduce(
          (total, source) => total + (source.dashboard.coverage?.score ?? 0),
          0,
        ) / measured.length,
      )
    : undefined;
  const publicationSummary =
    blockedCmsCount > 0
      ? `${String(blockedCmsCount)} documentation source${blockedCmsCount === 1 ? '' : 's'} need attention before Online publication can continue.`
      : pendingCmsCount > 0
        ? `${String(pendingCmsCount)} documentation source${pendingCmsCount === 1 ? '' : 's'} waiting for reviewer approval.`
        : approvalNeededCmsCount > 0
          ? `${String(approvalNeededCmsCount)} documentation source${approvalNeededCmsCount === 1 ? '' : 's'} ready for approval request.`
          : publicationChecking
            ? 'Axis is checking documentation publication state.'
            : 'Documentation links remain locked until every publishable source is Online-ready.';

  return (
    <Stack spacing={dashboardComponentGap}>
      {cmsSources.length ? (
        <Paper
          component="section"
          elevation={0}
          sx={{
            border: 1,
            borderColor: 'divider',
            boxSizing: 'border-box',
            minWidth: 0,
            overflow: 'hidden',
            p: dashboardCardPadding,
            width: '100%',
          }}
        >
          <Stack spacing={dashboardContentGap}>
            <Box
              sx={{
                alignItems: { xs: 'stretch', lg: 'center' },
                display: 'grid',
                gap: dashboardContentGap,
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) auto' },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ lineHeight: 1.15 }} variant="h4">
                  Documentation publication center
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 900 }}>
                  Prepare Staged documentation, route approval, and open Online CMS
                  links when each publishable source is ready. API references are
                  available directly from live runtime contracts.
                </Typography>
              </Box>
              <Box
                aria-label="Documentation publication summary"
                sx={{
                  alignSelf: { xs: 'stretch', lg: 'start' },
                  bgcolor: alpha(axisTokens.color.signatureGold, 0.08),
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: dashboardRadiusMedium,
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    sm:
                      averageCoverage === undefined
                        ? 'repeat(2, minmax(0, 1fr))'
                        : 'repeat(3, minmax(0, 1fr))',
                  },
                  overflow: 'hidden',
                  '& > * + *': {
                    borderLeft: { sm: 1 },
                    borderTop: { xs: 1, sm: 0 },
                    borderColor: 'divider',
                  },
                  '& > *:nth-of-type(2)': {
                    borderTop: { xs: 0 },
                  },
                }}
              >
                <HeaderMetric
                  label="Online-ready"
                  value={`${String(readyCmsCount)} / ${String(cmsSources.length)}`}
                />
                <HeaderMetric label="API sources" value={String(apiSources.length)} />
                {averageCoverage !== undefined ? (
                  <HeaderMetric
                    label="Coverage"
                    value={`${String(averageCoverage)}% avg`}
                  />
                ) : null}
              </Box>
            </Box>
            {!documentationVisible ? (
              <Alert severity={publicationChecking ? 'info' : 'warning'}>
                {publicationSummary}
              </Alert>
            ) : (
              <Alert severity="success">
                All documentation sources are Online-ready. The documentation areas
                below are now available.
              </Alert>
            )}
            <DocumentationApprovalGuide />
            <Paper
              component="section"
              elevation={0}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: dashboardRadiusSmall,
                boxSizing: 'border-box',
                minWidth: 0,
                overflow: 'hidden',
                width: '100%',
              }}
            >
              <Box
                component="ul"
                sx={{
                  listStyle: 'none',
                  m: 0,
                  p: 0,
                }}
              >
                {cmsSources.map((source, index) => (
                  <CmsDocumentationReadinessCard
                    accessToken={accessToken}
                    bootstrap={bootstrap}
                    isLast={index === cmsSources.length - 1}
                    key={source.id}
                    onPublicationStatusChange={onPublicationStatusChange}
                    runtime={runtime}
                    source={source}
                  />
                ))}
              </Box>
            </Paper>
          </Stack>
        </Paper>
      ) : null}

      {visibleDocumentationSources.length ? (
        <Paper
          component="section"
          elevation={0}
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: dashboardRadiusSmall,
            boxSizing: 'border-box',
            minWidth: 0,
            overflow: 'hidden',
            width: '100%',
          }}
        >
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {visibleDocumentationSources.map((source, index) => (
              <DocumentationSourceListItem
                bootstrap={bootstrap}
                isLast={index === visibleDocumentationSources.length - 1}
                key={source.id}
                source={source}
              />
            ))}
          </Box>
        </Paper>
      ) : null}
    </Stack>
  );
}
