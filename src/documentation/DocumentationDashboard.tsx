import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
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
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import { createDocumentationContentPackClient } from './api/documentationContentPackClient';
import {
  createDocumentationPublicationClient,
  type DocumentationPublicationStatus,
} from './api/documentationPublicationClient';

interface DocumentationDashboardProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
}

const dashboardComponentGap = workspaceComponentGap;
const dashboardContentGap = workspaceContentGap;
const dashboardCardPadding = workspacePanelPadding;
const dashboardCardSectionMinHeight = {
  summary: 72,
  metadata: 56,
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

function DocumentationSourceCard({
  bootstrap,
  source,
}: {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly source: AxisDocumentationSource;
}) {
  const coverage = source.dashboard.coverage;
  const available = availabilityLabel(source, bootstrap);
  const color = coverageColor(coverage);
  return (
    <Paper
      component="article"
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        display: 'grid',
        gap: 1.5,
        gridTemplateRows: {
          xs: 'auto auto auto auto auto',
          lg: `auto minmax(${String(dashboardCardSectionMinHeight.summary)}px, auto) minmax(${String(dashboardCardSectionMinHeight.metadata)}px, auto) auto auto`,
        },
        minHeight: 230,
        p: dashboardCardPadding,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <Box
          aria-hidden
          sx={{
            alignItems: 'center',
            bgcolor: alpha(axisTokens.color.signatureGold, 0.18),
            borderRadius: axisTokens.radius.medium,
            color: 'primary.main',
            display: 'inline-flex',
            flex: '0 0 auto',
            height: 44,
            justifyContent: 'center',
            width: 44,
          }}
        >
          <ShellIcon name={source.dashboard.icon ?? 'content'} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5">{source.label}</Typography>
          <Typography color="text.secondary" variant="body2">
            {sourceTypeLabel(source)}
          </Typography>
        </Box>
      </Stack>

      <Typography color="text.secondary">{sourceSummary(source)}</Typography>

      <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Chip label={source.type === 'OPENAPI' ? 'OpenAPI' : 'CMS'} size="small" />
          <Chip
            label={`Owner: ${source.ownerModule}`}
            size="small"
            variant="outlined"
          />
          <Chip label={available} size="small" variant="outlined" />
        </Stack>

        {source.dashboard.audiences.length ? (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {source.dashboard.audiences.map((audience) => (
              <Chip key={audience} label={audience} size="small" variant="outlined" />
            ))}
          </Stack>
        ) : null}
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
          sx={{ borderRadius: axisTokens.radius.pill, height: 8 }}
        />
      </Box>

      <Button component={RouterLink} to={source.route} variant="contained">
        Open {source.label}
      </Button>
    </Paper>
  );
}

function documentationReadinessLabel(value: string | undefined): string {
  return value ? value.replaceAll('_', ' ') : 'checking';
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
  runtime,
  source,
}: {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
  readonly source: Extract<AxisDocumentationSource, { readonly type: 'CMS' }>;
}) {
  const queryClient = useQueryClient();
  const administrationConnection = selectModuleConnection(bootstrap, 'backoffice');
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
  const reconcile = async () => {
    await Promise.all([pack.refetch(), publication.refetch()]);
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
      await pack.refetch();
    },
  });
  const packOperation = pack.data?.allowedOperations[0];
  const canPublish =
    pack.data?.state === 'CURRENT' &&
    publication.data?.allowedActions.includes('INITIALIZE');
  const busy =
    pack.isPending ||
    publication.isPending ||
    packMutation.isPending ||
    publicationMutation.isPending;
  const error =
    pack.error instanceof Error
      ? pack.error.message
      : publication.error instanceof Error
        ? publication.error.message
        : packMutation.error instanceof Error
          ? packMutation.error.message
          : publicationMutation.error instanceof Error
            ? publicationMutation.error.message
            : undefined;

  return (
    <Paper
      component="article"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
    >
      <Stack spacing={dashboardContentGap}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ justifyContent: 'space-between' }}
        >
          <Box>
            <Typography variant="h6">{source.label}</Typography>
            <Typography color="text.secondary" variant="body2">
              {source.packCode} · {initializationProfile ?? 'profile unavailable'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Chip
              label={`Staged: ${documentationReadinessLabel(pack.data?.state)}`}
              size="small"
              variant="outlined"
            />
            <Chip
              color={
                ['FAILED', 'REJECTED'].includes(publication.data?.readiness ?? '')
                  ? 'error'
                  : publication.data?.readiness === 'READY'
                    ? 'success'
                    : 'default'
              }
              label={`Online: ${documentationReadinessLabel(publication.data?.readiness)}`}
              size="small"
            />
          </Stack>
        </Stack>

        {!administrationConnection ? (
          <Alert severity="warning">
            Platform BackOffice is unavailable, so documentation initialization cannot
            be managed from Axis right now.
          </Alert>
        ) : !initializationProfile ? (
          <Alert severity="warning">
            This documentation source does not declare an initialization profile.
          </Alert>
        ) : null}

        {error ? <Alert severity="error">{error}</Alert> : null}
        {publication.data?.readiness === 'PUBLICATION_PENDING' ? (
          <Alert severity="info">
            Publication is waiting for approval or Online activation.
          </Alert>
        ) : null}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {packOperation ? (
            <Button
              disabled={busy}
              onClick={() => packMutation.mutate()}
              variant="contained"
            >
              {packMutation.isPending
                ? 'Installing to Staged...'
                : packOperation === 'UPDATE'
                  ? pack.data?.presentation.updateAction
                  : pack.data?.presentation.importAction}
            </Button>
          ) : null}
          {canPublish ? (
            <Button
              disabled={busy}
              onClick={() => publicationMutation.mutate()}
              variant="contained"
            >
              {publicationMutation.isPending
                ? 'Requesting publication...'
                : publication.data?.readiness === 'FAILED'
                  ? 'Retry publication'
                  : 'Publish / request approval'}
            </Button>
          ) : null}
          <Button disabled={busy || !canCheck} onClick={() => void reconcile()}>
            Refresh status
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

export function DocumentationDashboard({
  accessToken,
  bootstrap,
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
  const publicationChecking = publicationQueries.some((query) => query.isPending);
  const documentationVisible =
    cmsSources.length === 0 ||
    (managedCmsSources.length === cmsSources.length &&
      managedCmsSources.length > 0 &&
      readyCmsCount === managedCmsSources.length);
  const measured = sources.filter((source) => source.dashboard.coverage);
  const averageCoverage = measured.length
    ? Math.round(
        measured.reduce(
          (total, source) => total + (source.dashboard.coverage?.score ?? 0),
          0,
        ) / measured.length,
      )
    : undefined;

  return (
    <Stack spacing={dashboardComponentGap}>
      {cmsSources.length ? (
        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              sx={{ justifyContent: 'space-between' }}
            >
              <Box>
                <Typography variant="h4">Documentation initialization</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 900 }}>
                  Install documentation packs to Staged and publish them Online before
                  product documentation links are opened.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Chip
                  label={`${String(readyCmsCount)}/${String(cmsSources.length)} online`}
                />
                <Chip
                  label={`${String(apiSources.length)} API source(s)`}
                  variant="outlined"
                />
                {averageCoverage !== undefined ? (
                  <Chip
                    color={documentationVisible ? 'primary' : 'default'}
                    label={`${String(averageCoverage)}% avg coverage`}
                  />
                ) : null}
              </Stack>
            </Stack>
            {!documentationVisible ? (
              <Alert severity={publicationChecking ? 'info' : 'warning'}>
                Framework, Swaggers, Axis, and Kickoff documentation areas stay locked
                until the publishable documentation source is Online-ready.
              </Alert>
            ) : (
              <Alert severity="success">
                Documentation is Online-ready. The documentation areas below are now
                available.
              </Alert>
            )}
            <Box
              sx={{
                display: 'grid',
                gap: dashboardComponentGap,
                gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {cmsSources.map((source) => (
                <CmsDocumentationReadinessCard
                  accessToken={accessToken}
                  bootstrap={bootstrap}
                  key={source.id}
                  runtime={runtime}
                  source={source}
                />
              ))}
            </Box>
          </Stack>
        </Paper>
      ) : null}

      {documentationVisible ? (
        <Box
          component="section"
          sx={{
            display: 'grid',
            gap: dashboardComponentGap,
            gridTemplateColumns: {
              xs: '1fr',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          {sources.map((source) => (
            <DocumentationSourceCard
              bootstrap={bootstrap}
              key={source.id}
              source={source}
            />
          ))}
        </Box>
      ) : null}
    </Stack>
  );
}
