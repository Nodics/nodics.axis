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
  return Boolean(
    selectModuleConnection(bootstrap, navigationItem.workbenchTarget.moduleName),
  );
}
