import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkbenchRoutePage } from '../../workbench/WorkbenchRoutePage';
import { orderLifecycleOperatorQueues } from './orderLifecycleDashboard';
import { orderLifecycleGuidance } from './orderLifecycleGuidance';
import { Alert, Chip, Paper, Stack, Typography } from '@mui/material';

interface OrderLifecycleManagementRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly channel: string;
  readonly cmsBaseUrl: string;
  readonly employeeId: string;
  readonly locale: string;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
  readonly site: string;
}

/**
 * Renders Commerce operations through the same compact, backend-governed
 * Schema Workbench composition used by Content data pages. Navigation hierarchy
 * remains in the application rail, while route guidance remains available from
 * the Workbench help affordance instead of being repeated above the workspace.
 */
export function OrderLifecycleManagementRoutePage(
  props: OrderLifecycleManagementRoutePageProps,
) {
  if (!props.navigation.workbenchTarget) return null;
  const queues = orderLifecycleOperatorQueues(props.bootstrap.navigation);
  const guidance = orderLifecycleGuidance(
    props.navigation.id || props.navigation.workbenchTarget.schemaName,
  );
  return (
    <Stack spacing={2}>
      <Paper component="section" sx={{ p: 2 }} variant="outlined">
        <Stack spacing={1.5}>
          <Stack spacing={0.5}>
            <Typography variant="h5">Order Lifecycle Operator Queues</Typography>
            <Typography color="text.secondary">{guidance}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {queues.map((queue) => (
              <Chip
                key={queue.code}
                label={`${queue.label}: ${queue.requestTypes.join('/')}`}
                title={`${queue.ownerModule} owns ${queue.actionLabels.join(', ') || 'read-only queue'}`}
                variant={queue.route === props.navigation.route ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>
          <Alert severity="info">
            Axis groups cancellation, return, refund, exchange, replacement and appeal
            queues from backend navigation metadata. Actions still execute only through
            Commerce-owned workbench contracts.
          </Alert>
        </Stack>
      </Paper>
      <WorkbenchRoutePage
        accessToken={props.accessToken}
        bootstrap={props.bootstrap}
        channel={props.channel}
        cmsBaseUrl={props.cmsBaseUrl}
        employeeId={props.employeeId}
        locale={props.locale}
        routeNavigation={props.navigation}
        routeSchema={props.navigation.workbenchTarget}
        runtime={props.runtime}
        site={props.site}
      />
    </Stack>
  );
}
