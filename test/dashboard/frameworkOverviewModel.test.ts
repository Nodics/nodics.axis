import { describe, expect, it } from 'vitest';
import type { AxisNavigationItem } from '../../src/bootstrap/publicBootstrap';
import {
  overviewDomains,
  overviewMetricDefinitions,
  overviewNavigation,
  overviewOpenTasks,
  overviewReferences,
} from '../../src/dashboard/frameworkOverviewModel';
import { dashboardComposition } from '../../src/dashboard/dashboardComposition';
import { dashboardFixture } from './dashboardCompositionFixture';

const item: AxisNavigationItem = {
  id: 'commerce',
  moduleName: 'order',
  label: 'Commerce',
  route: '/commerce',
  order: 10,
  category: 'commerce',
  icon: 'commerce',
  availability: 'UP',
  featureState: 'ACTIVE',
  group: { id: 'commerce', label: 'Commerce', order: 10 },
};
describe('Framework overview discovery', () => {
  it('discovers later domain contributions without a module name switch', () => {
    const custom = {
      ...item,
      id: 'new-domain',
      moduleName: 'newOwner',
      group: { id: 'new-domain', label: 'New business domain', order: 5 },
      route: '/new-business',
    };
    expect(overviewDomains([item, custom], []).map((d) => d.label)).toEqual([
      'New business domain',
      'Commerce',
    ]);
    expect(overviewDomains([item, custom], ['commerce']).map((d) => d.label)).toEqual([
      'New business domain',
    ]);
  });
  it('rejects unavailable, disabled, hidden, preview and unsafe entries and denied ancestors', () => {
    const variants = ['DISABLED', 'HIDDEN', 'PREVIEW'].map(
      (featureState) => ({ ...item, featureState }) as AxisNavigationItem,
    );
    expect(
      overviewNavigation([
        ...variants,
        { ...item, availability: 'UNAVAILABLE' },
        { ...item, route: '//external.example' },
        { ...item, route: '/\\external.example' },
        { ...item, contexts: ['site'] },
        { ...item, id: 'child', parentId: 'missing' },
      ]),
    ).toEqual([]);
    expect(
      overviewNavigation([
        { ...item, featureState: 'DISABLED' },
        { ...item, id: 'child', parentId: item.id },
      ]),
    ).toEqual([]);
    expect(
      overviewNavigation([
        { ...item, id: 'a', parentId: 'b' },
        { ...item, id: 'b', parentId: 'a' },
      ]),
    ).toEqual([]);
  });
  it('respects cross-module ancestry and deduplicates identical destinations', () => {
    const child = {
      ...item,
      id: 'child',
      moduleName: 'extension',
      parentId: item.id,
      parentModuleName: 'order',
      route: '/commerce/extension',
    };
    expect(
      overviewDomains([item, { ...item, id: 'alias' }, child], [])[0]?.items,
    ).toHaveLength(2);
    expect(overviewNavigation([child])).toEqual([]);
  });
  it('binds counts only to exact owner-declared unfiltered targets', () => {
    const target = {
      ...item,
      workbenchTarget: { moduleName: 'order', schemaName: 'commerceOrder' },
    };
    const definitions = overviewMetricDefinitions(
      [target],
      ['order:commerce', 'other:commerce'],
    );
    expect(definitions).toHaveLength(1);
    expect(definitions[0]).toMatchObject({
      moduleName: 'order',
      schemaName: 'commerceOrder',
      route: '/commerce',
    });
    expect(
      overviewMetricDefinitions(
        [
          {
            ...target,
            workbenchPresentation: {
              fixedFilters: [
                {
                  id: 'fixed',
                  label: 'Fixed',
                  field: 'status',
                  value: 'OPEN',
                  order: 1,
                },
              ],
            },
          },
        ],
        ['order:commerce'],
      ),
    ).toEqual([]);
    expect(
      overviewMetricDefinitions(
        [{ ...target, workbenchTarget: { ...target.workbenchTarget, mode: 'create' } }],
        ['order:commerce'],
      ),
    ).toEqual([]);
  });
  it('rejects executable/unbounded CMS references', () => {
    const section = dashboardFixture.components[0]!.components[0]!;
    for (const navigationRefs of [
      ['https://example.com'],
      Array(33).fill('order:commerce'),
      ['../schema'],
      ['x();'],
    ])
      expect(() =>
        overviewReferences(
          { ...section, properties: { navigationRefs } },
          'navigationRefs',
        ),
      ).toThrow();
  });
  it('prioritises escalation and overdue tasks without claiming they are assigned to me', () => {
    const base = {
      instanceCode: 'workflow',
      nodeCode: 'review',
      assignee: undefined,
      dueAt: undefined,
    };
    const tasks = [
      { ...base, code: 'ordinary', status: 'OPEN' },
      { ...base, code: 'overdue', status: 'CLAIMED', dueAt: '2020-01-01' },
      { ...base, code: 'escalated', status: 'ESCALATED' },
      { ...base, code: 'done', status: 'COMPLETED' },
    ];
    expect(
      overviewOpenTasks(tasks, Date.parse('2026-01-01')).map((t) => t.code),
    ).toEqual(['escalated', 'overdue', 'ordinary']);
  });
  it('allows framework composition only in Overview and keeps the other tabs identical', () => {
    const overview = {
      ...dashboardFixture.components[0]!,
      properties: {
        ...dashboardFixture.components[0]!.properties,
        layout: 'framework',
      },
      components: [],
    };
    const changed = {
      ...dashboardFixture,
      components: [overview, ...dashboardFixture.components.slice(1)],
    };
    const result = dashboardComposition(changed);
    expect(result.tabs[0]?.layout).toBe('framework');
    expect(result.tabs.slice(1)).toEqual(
      dashboardComposition(dashboardFixture).tabs.slice(1),
    );
    expect(() =>
      dashboardComposition({
        ...dashboardFixture,
        components: [
          { ...overview, properties: { ...overview.properties, view: 'applications' } },
        ],
      }),
    ).toThrow();
  });
});
