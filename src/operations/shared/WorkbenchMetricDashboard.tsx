import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import { type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';

import { axisTokens } from '../../app/axisTheme';
import { ShellIcon } from '../../app/shell/ShellIcon';
import {
  dashboardCardPadding,
  dashboardComponentGap,
  dashboardContentGap,
  type WorkbenchMetric,
} from './workbenchMetricDashboardModel';

function metricValue(metric: WorkbenchMetric, loading: boolean): ReactNode {
  if (loading) return <CircularProgress size={28} />;
  if (metric.status === 'unavailable') return '—';
  return new Intl.NumberFormat().format(metric.value ?? 0);
}

function MetricCard({
  loading,
  metric,
}: {
  readonly loading: boolean;
  readonly metric: WorkbenchMetric;
}) {
  const metricReady = metric.status === 'ready';

  return (
    <Paper
      component="article"
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        display: 'grid',
        gap: dashboardContentGap,
        minHeight: 238,
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
          <ShellIcon name={metric.icon} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography color="text.secondary" variant="body2">
            {metric.moduleName}.{metric.schemaName}
          </Typography>
          <Typography variant="h5">{metric.label}</Typography>
        </Box>
      </Stack>

      <Typography sx={{ fontSize: { xs: 36, md: 44 }, fontWeight: 800 }}>
        {metricValue(metric, loading)}
      </Typography>

      <Typography color="text.secondary">{metric.detail}</Typography>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Chip
          color={metric.status === 'ready' ? 'success' : 'warning'}
          label={metric.status === 'ready' ? 'Live' : 'Unavailable'}
          size="small"
          variant={metric.status === 'ready' ? 'filled' : 'outlined'}
        />
        {metricReady ? (
          <Button component={RouterLink} size="small" to={metric.route} variant="text">
            Open
          </Button>
        ) : (
          <Button disabled size="small" variant="text">
            Unavailable
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

export function DashboardSection({
  metrics,
  loading,
  title,
  description,
}: {
  readonly description: string;
  readonly loading: boolean;
  readonly metrics: readonly WorkbenchMetric[];
  readonly title: string;
}) {
  return (
    <Stack spacing={dashboardComponentGap}>
      <Box>
        <Typography variant="h4">{title}</Typography>
        <Typography color="text.secondary">{description}</Typography>
      </Box>
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
        {metrics.map((metric) => (
          <MetricCard
            key={`${metric.moduleName}:${metric.schemaName}:${metric.id}`}
            loading={loading}
            metric={metric}
          />
        ))}
      </Box>
    </Stack>
  );
}
