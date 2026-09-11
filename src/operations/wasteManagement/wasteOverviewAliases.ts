import type { AxisNavigationItem } from '../../bootstrap/publicBootstrap';

/** Preserves retired Overview bookmarks only when the matching parent dashboard
 * is in the authorized, available navigation. These aliases never add menu items
 * or select a renderer from a URL prefix; the parent keeps its backend binding.
 */
export function wasteOverviewAliases(navigation: readonly AxisNavigationItem[]) {
  const retired = [
    { moduleName: 'wasteCore', viewCode: 'waste.overview', target: '/waste/assets' },
    {
      moduleName: 'eWaste',
      viewCode: 'ewaste.overview',
      target: '/waste/assets/electronics',
    },
  ];
  return retired.flatMap(({ moduleName, viewCode, target }) => {
    const owner = navigation.find(
      (item) =>
        item.moduleName === moduleName &&
        item.route === target &&
        ['UP', 'DEGRADED'].includes(item.availability) &&
        item.featureState !== 'HIDDEN' &&
        item.backendWorkspace?.renderer === 'axis.workspace.native' &&
        item.backendWorkspace.workspaceCode === 'waste.review' &&
        item.backendWorkspace.viewCode === viewCode,
    );
    const from = `${target}/overview`;
    return owner && !navigation.some((item) => item.route === from)
      ? [{ from, to: owner.route }]
      : [];
  });
}
