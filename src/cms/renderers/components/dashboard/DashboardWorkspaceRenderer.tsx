import { AxisDashboardRoutePage } from '../../../../dashboard/AxisDashboardRoutePage';
import type { CmsComponentRendererProps } from '../../shared/rendererTypes';

/** Runtime credentials are controller state, never persisted CMS properties. */
export function DashboardWorkspaceRenderer({
  component,
  actions,
}: CmsComponentRendererProps) {
  if (!actions?.dashboard)
    throw new Error('Authenticated dashboard controller unavailable');
  return <AxisDashboardRoutePage {...actions.dashboard} composition={component} />;
}

/** These composition nodes are evaluated only by their typed workspace owner. */
export function DashboardCompositionNodeRenderer(): never {
  throw new Error('Dashboard tabs and sections must belong to a dashboard workspace');
}
