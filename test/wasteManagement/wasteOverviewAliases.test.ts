import { expect, it } from 'vitest';
import { wasteOverviewAliases } from '../../src/operations/wasteManagement/wasteOverviewAliases';
import type { AxisNavigationItem } from '../../src/bootstrap/publicBootstrap';
const owner = (
  moduleName = 'wasteCore',
  route = '/waste/assets',
  viewCode = 'waste.overview',
) =>
  ({
    moduleName,
    route,
    availability: 'UP',
    featureState: 'ACTIVE',
    backendWorkspace: {
      renderer: 'axis.workspace.native',
      workspaceCode: 'waste.review',
      viewCode,
    },
  }) as AxisNavigationItem;
it('redirects both retired bookmarks to their authorized dashboard anchors', () => {
  expect(
    wasteOverviewAliases([
      owner(),
      owner('eWaste', '/waste/assets/electronics', 'ewaste.overview'),
    ]),
  ).toEqual([
    { from: '/waste/assets/overview', to: '/waste/assets' },
    { from: '/waste/assets/electronics/overview', to: '/waste/assets/electronics' },
  ]);
});
it('does not add redirects for missing, unavailable, hidden or mismatched owners', () => {
  expect(wasteOverviewAliases([])).toEqual([]);
  for (const changes of [
    { availability: 'DOWN' },
    { featureState: 'HIDDEN' },
    { moduleName: 'other' },
    {
      backendWorkspace: {
        renderer: 'axis.workspace.native',
        workspaceCode: 'other',
        viewCode: 'waste.overview',
      },
    },
  ])
    expect(
      wasteOverviewAliases([{ ...owner(), ...changes } as AxisNavigationItem]),
    ).toEqual([]);
});
it('preserves a still-published legacy route during a mixed-version rollout', () => {
  expect(
    wasteOverviewAliases([owner(), { ...owner(), route: '/waste/assets/overview' }]),
  ).toEqual([]);
});
