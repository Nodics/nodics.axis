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

interface DocumentationDashboardProps {
  readonly bootstrap: AxisAuthenticatedBootstrap;
}

const dashboardComponentGap = workspaceComponentGap;
const dashboardContentGap = workspaceContentGap;
const dashboardCardPadding = workspacePanelPadding;
const dashboardCardSectionMinHeight = {
  summary: 72,
  metadata: 56,
} as const;

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
        gap: dashboardContentGap,
        gridTemplateRows: {
          xs: 'auto auto auto auto minmax(0, 1fr) auto',
          lg: `auto minmax(${String(dashboardCardSectionMinHeight.summary)}px, auto) minmax(${String(dashboardCardSectionMinHeight.metadata)}px, auto) auto minmax(0, 1fr) auto`,
        },
        minHeight: 300,
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

      <Stack spacing={dashboardContentGap}>
        {coverage?.signals.length ? (
          <Box>
            <Typography variant="subtitle2">Already covered</Typography>
            <Stack component="ul" spacing={0.75} sx={{ m: 0, mt: 1, pl: 2.5 }}>
              {coverage.signals.slice(0, 4).map((signal) => (
                <Typography
                  component="li"
                  key={signal}
                  color="text.secondary"
                  variant="body2"
                >
                  {signal}
                </Typography>
              ))}
            </Stack>
          </Box>
        ) : null}

        {coverage?.gaps.length ? (
          <Box>
            <Typography variant="subtitle2">Documentation gaps</Typography>
            <Stack component="ul" spacing={0.75} sx={{ m: 0, mt: 1, pl: 2.5 }}>
              {coverage.gaps.slice(0, 4).map((gap) => (
                <Typography
                  component="li"
                  key={gap}
                  color="text.secondary"
                  variant="body2"
                >
                  {gap}
                </Typography>
              ))}
            </Stack>
          </Box>
        ) : null}
      </Stack>

      <Button component={RouterLink} to={source.route} variant="contained">
        Open {source.label}
      </Button>
    </Paper>
  );
}

export function DocumentationDashboard({ bootstrap }: DocumentationDashboardProps) {
  const sources = bootstrap.documentationSources;
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
      <Paper
        component="section"
        elevation={0}
        sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
      >
        <Stack spacing={dashboardContentGap}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            sx={{ justifyContent: 'space-between' }}
          >
            <Box>
              <Typography variant="overline">Documentation home</Typography>
              <Typography variant="h3">Nodics Documentation</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 920 }}>
                Explore framework guidance, API references, and application
                documentation from registered backend-owned sources.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Chip label={`${String(sources.length)} areas`} />
              {averageCoverage !== undefined ? (
                <Chip
                  color="primary"
                  label={`${String(averageCoverage)}% avg coverage`}
                />
              ) : null}
            </Stack>
          </Stack>

          <Alert severity="info">
            This dashboard is generated from the BackOffice documentation-source
            registry. Customer modules can add documentation areas and coverage metadata
            through configuration.
          </Alert>
        </Stack>
      </Paper>

      <Box
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
    </Stack>
  );
}
