import { useMemo } from 'react';
import { useAxisLocalization } from '../../../../localization/AxisLocalizationContext';
import { localizeDashboardComposition } from '../../../../dashboard/dashboardLocalization';
import { AxisDashboardRoutePage } from '../../../../dashboard/AxisDashboardRoutePage';
import type { CmsComponentRendererProps } from '../../shared/rendererTypes';

/** Runtime credentials are controller state, never persisted CMS properties. */
export function DashboardWorkspaceRenderer({
  component,
  actions,
}: CmsComponentRendererProps) {
  const { format, locale } = useAxisLocalization();
  const localized = useMemo(
    () => localizeDashboardComposition(component, format, locale),
    [component, format, locale],
  );
  if (!actions?.dashboard)
    throw new Error('Authenticated dashboard controller unavailable');
  return <AxisDashboardRoutePage {...actions.dashboard} composition={localized} />;
}

/** These composition nodes are evaluated only by their typed workspace owner. */
export function DashboardCompositionNodeRenderer(): never {
  throw new Error('Dashboard tabs and sections must belong to a dashboard workspace');
}
