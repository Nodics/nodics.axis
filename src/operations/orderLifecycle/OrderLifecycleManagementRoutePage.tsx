import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkbenchRoutePage } from '../../workbench/WorkbenchRoutePage';

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
  return (
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
  );
}
