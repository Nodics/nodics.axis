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

function publicationReadinessColor(
  readiness: DocumentationPublicationStatus['readiness'] | undefined,
): 'default' | 'success' | 'warning' | 'error' {
  if (['FAILED', 'REJECTED'].includes(readiness ?? '')) return 'error';
  if (readiness === 'READY') return 'success';
  if (readiness === 'PUBLICATION_PENDING' || readiness === 'IMPORTED') return 'warning';
  return 'default';
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
  const [expanded, setExpanded] = useState(false);
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
  const hasBlockingConfiguration = !administrationConnection || !initializationProfile;
  const hasStatusData = Boolean(pack.data || publication.data);
  const rowError = networkErrorLabel(error, hasStatusData);
  const rowStatus =
    rowError ??
    (!administrationConnection
      ? 'Platform BackOffice is unavailable.'
      : !initializationProfile
        ? 'Initialization profile is not configured.'
        : publication.data?.readiness === 'PUBLICATION_PENDING'
          ? 'Waiting for approval or Online activation.'
          : undefined);

  return (
    <Paper
      component="li"
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        display: 'block',
        listStyle: 'none',
        p: { xs: 1.5, md: 2 },
      }}
    >
      <Stack spacing={expanded ? dashboardContentGap : 1}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { xs: 'stretch', lg: 'center' } }}
        >
          <Box sx={{ minWidth: 0, flex: '1 1 260px' }}>
            <Typography sx={{ overflowWrap: 'anywhere' }} variant="h6">
              {source.label}
            </Typography>
            <Typography
              color="text.secondary"
              sx={{ overflowWrap: 'anywhere' }}
              variant="body2"
            >
              {source.packCode} · {initializationProfile ?? 'profile unavailable'}
            </Typography>
          </Box>

          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: 'center',
              flex: '0 1 auto',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Chip
              label={`Staged: ${documentationReadinessLabel(pack.data?.state)}`}
              size="small"
              variant="outlined"
            />
            <Chip
              color={publicationReadinessColor(publication.data?.readiness)}
              label={`Online: ${documentationReadinessLabel(publication.data?.readiness)}`}
              size="small"
            />
            {rowStatus ? (
              <Chip
                color={error || hasBlockingConfiguration ? 'error' : 'info'}
                label={rowStatus}
                size="small"
                sx={{
                  maxWidth: { xs: '100%', md: 320 },
                  '& .MuiChip-label': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                }}
                title={error ? `Latest backend request failed: ${error}` : undefined}
                variant="outlined"
              />
            ) : null}
          </Stack>

          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: 'center',
              flex: '0 0 auto',
              flexWrap: 'wrap',
              gap: 1,
              justifyContent: { xs: 'flex-start', lg: 'flex-end' },
            }}
          >
            {packOperation ? (
              <Button
                disabled={busy}
                onClick={() => packMutation.mutate()}
                size="small"
                variant="contained"
              >
                {packMutation.isPending
                  ? 'Installing...'
                  : packOperation === 'UPDATE'
                    ? pack.data?.presentation.updateAction
                    : pack.data?.presentation.importAction}
              </Button>
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
                  <IconButton
                    aria-label={
                      publication.data?.readiness === 'FAILED'
                        ? 'Retry publication'
                        : 'Publish / request approval'
                    }
                    disabled={busy}
                    onClick={() => publicationMutation.mutate()}
                    size="small"
                    sx={{
                      bgcolor: alpha(axisTokens.color.signatureGold, 0.22),
                      color: 'primary.main',
                      '&:hover': {
                        bgcolor: alpha(axisTokens.color.signatureGold, 0.34),
                      },
                    }}
                  >
                    <ShellIcon fontSize="small" name="approve" />
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
            <Tooltip arrow title="Refresh status">
              <span>
                <IconButton
                  aria-label="Refresh status"
                  disabled={busy || !canCheck}
                  onClick={() => void reconcile()}
                  size="small"
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
                >
                  <ShellIcon
                    fontSize="small"
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                  />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

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
            {publication.data?.readiness === 'PUBLICATION_PENDING' ? (
              <Alert severity="info">
                Publication is waiting for approval or Online activation.
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
                  Documentation initialization
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 900 }}>
                  Install documentation packs to Staged and publish them Online before
                  product documentation links are opened.
                </Typography>
              </Box>
              <Box
                aria-label="Documentation initialization summary"
                sx={{
                  alignSelf: { xs: 'stretch', lg: 'start' },
                  bgcolor: alpha(axisTokens.color.signatureGold, 0.08),
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: axisTokens.radius.medium,
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
                  label="Online"
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
                Framework, Swaggers, Axis, and Kickoff documentation areas stay locked
                until the publishable documentation source is Online-ready.
              </Alert>
            ) : (
              <Alert severity="success">
                Documentation is Online-ready. The documentation areas below are now
                available.
              </Alert>
            )}
            <Stack
              component="ul"
              spacing={1.25}
              sx={{
                listStyle: 'none',
                m: 0,
                p: 0,
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
            </Stack>
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
