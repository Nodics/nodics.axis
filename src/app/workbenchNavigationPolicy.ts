import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisNavigationItem,
} from '../bootstrap/publicBootstrap';

export function canRenderWorkbenchNavigation(
  bootstrap: AxisAuthenticatedBootstrap,
  navigationItem: AxisNavigationItem,
): boolean {
  if (!navigationItem.workbenchTarget) return false;
  if (!['UP', 'DEGRADED'].includes(navigationItem.availability)) return false;
  if (selectModuleConnection(bootstrap, navigationItem.workbenchTarget.moduleName)) {
    return true;
  }
  return Object.values(bootstrap.moduleConnections).some((connections) =>
    connections.some((connection) => ['UP', 'DEGRADED'].includes(connection.state)),
  );
}
