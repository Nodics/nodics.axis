/** @file Selects the existing authorized copilotApi native Workspace contribution. */
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../bootstrap/publicBootstrap';

/** Resolves an available declared capability; route text never grants ownership. */
export function copilotWorkspaceNavigation(
  bootstrap: AxisAuthenticatedBootstrap,
  workspaceCode:
    | 'copilot.workspace'
    | 'copilot.knowledge'
    | 'copilot.usage'
    | 'copilot.administration'
    | 'copilot.activity' = 'copilot.workspace',
  viewCode: 'overview' | 'sources' | 'conversations' = 'overview',
): AxisNavigationItem | undefined {
  return bootstrap.navigation.find(
    (item) =>
      item.moduleName === 'copilotApi' &&
      item.backendWorkspace?.renderer === 'axis.workspace.native' &&
      item.backendWorkspace.workspaceCode === workspaceCode &&
      item.backendWorkspace.viewCode === viewCode &&
      !['DISABLED', 'HIDDEN'].includes(item.featureState ?? 'ACTIVE') &&
      ['UP', 'DEGRADED'].includes(item.availability),
  );
}
