import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import { Link as RouterLink } from 'react-router';

import { axisTokens } from '../../app/axisTheme';
import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationFeatureState,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';

interface SystemIntegrationsDashboardRoutePageProps {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly routeNavigation?: AxisNavigationItem | undefined;
}

const dashboardComponentGap = `${String(axisTokens.spacing.grid)}px`;
const dashboardContentGap = `${String(axisTokens.spacing.grid * 1.5)}px`;
const dashboardCardPadding = {
  xs: `${String(axisTokens.spacing.grid * 2)}px`,
  md: `${String(axisTokens.spacing.grid * 2.5)}px`,
} as const;

function stateColor(
  state: AxisNavigationFeatureState,
): 'success' | 'warning' | 'default' {
  if (state === 'ACTIVE') return 'success';
  if (state === 'PREVIEW') return 'warning';
  return 'default';
}

function availabilityColor(
  state: AxisNavigationItem['availability'],
): 'success' | 'warning' | 'error' | 'default' {
  if (state === 'UP') return 'success';
  if (state === 'DEGRADED') return 'warning';
  if (state === 'UNAVAILABLE') return 'error';
  return 'default';
}

function availabilityLabel(state: AxisNavigationItem['availability']): string {
  if (state === 'UP') return 'Available';
  if (state === 'DEGRADED') return 'Degraded';
  if (state === 'UNAVAILABLE') return 'Unavailable';
  return 'Unknown';
}

function visibleSystemItems(
  navigation: readonly AxisNavigationItem[],
): readonly AxisNavigationItem[] {
  return Object.freeze(
    navigation
      .filter(
        (item) =>
          item.id !== 'system-integrations' &&
          (item.group?.id === 'system-integrations' ||
            item.route.startsWith('/operations/') ||
            item.route === '/registry'),
      )
      .sort(
        (left, right) =>
          left.order - right.order || left.label.localeCompare(right.label),
      ),
  );
}

function SystemCapabilityCard({ item }: { readonly item: AxisNavigationItem }) {
  const featureState = item.featureState ?? 'ACTIVE';
  const contexts = item.contexts ?? [];
  const active = featureState === 'ACTIVE' || featureState === 'PREVIEW';
  return (
    <Paper
      component="article"
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        display: 'grid',
        gap: dashboardContentGap,
        gridTemplateRows: 'auto minmax(72px, auto) auto minmax(0, 1fr) auto',
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
          <ShellIcon name={item.icon ?? 'module'} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5">{item.label}</Typography>
          <Typography color="text.secondary" variant="body2">
            {item.moduleName}
          </Typography>
        </Box>
      </Stack>

      <Typography color="text.secondary">
        {item.help?.summary ??
          'This capability is advertised by BackOffice and will become executable when its owning module publishes an active workspace contract.'}
      </Typography>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Chip
          color={availabilityColor(item.availability)}
          label={availabilityLabel(item.availability)}
          size="small"
        />
        <Chip
          color={stateColor(featureState)}
          label={featureState}
          size="small"
          variant="outlined"
        />
      </Stack>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        {contexts.map((context) => (
          <Chip key={context} label={context} size="small" variant="outlined" />
        ))}
      </Stack>

      <Button
        component={active ? RouterLink : 'button'}
        disabled={!active}
        to={active ? item.route : undefined}
        variant={active ? 'contained' : 'outlined'}
      >
        {active ? `Open ${item.label}` : 'Not enabled yet'}
      </Button>
    </Paper>
  );
}

export function SystemIntegrationsDashboardRoutePage({
  bootstrap,
  routeNavigation,
}: SystemIntegrationsDashboardRoutePageProps) {
  const items = visibleSystemItems(bootstrap.navigation);
  const active = items.filter(
    (item) => (item.featureState ?? 'ACTIVE') === 'ACTIVE',
  ).length;
  const preview = items.filter((item) => item.featureState === 'PREVIEW').length;
  const disabled = items.length - active - preview;

  return (
    <WorkspaceContainer>
      <Stack spacing={dashboardComponentGap}>
        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'space-between' }}
            >
              <WorkspaceHeading
                description="Operate the project runtime, module registry, health checks, imports, exports, integrations, events, audit evidence, and failure triage from one BackOffice-governed hub."
                help={routeNavigation?.help}
                eyebrow="System workspace"
                headingVariant="h3"
                title="System & Integrations"
              />
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Chip label={`${String(items.length)} capabilities`} />
                <Chip color="success" label={`${String(active)} active`} />
                {preview > 0 ? (
                  <Chip color="warning" label={`${String(preview)} preview`} />
                ) : null}
                {disabled > 0 ? <Chip label={`${String(disabled)} planned`} /> : null}
              </Stack>
            </Stack>

            <Alert severity="info">
              This dashboard is generated from the authenticated BackOffice navigation
              contract. Axis is only presenting authorized capabilities; the owning
              backend modules remain the operation authority.
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
          {items.map((item) => (
            <SystemCapabilityCard item={item} key={`${item.moduleName}:${item.id}`} />
          ))}
        </Box>
      </Stack>
    </WorkspaceContainer>
  );
}
