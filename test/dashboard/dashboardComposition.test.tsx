import { describe, expect, it } from 'vitest';
import { dashboardComposition } from '../../src/dashboard/dashboardComposition';
import { overviewState } from '../../src/dashboard/overviewStatus';
import {
  dashboardFixture,
  mergedDashboardFixture,
} from './dashboardCompositionFixture';
import type { ApplicationInitializationStatus } from '../../src/operations/setupAccelerators/api/applicationInitializationClient';

describe('published dashboard composition', () => {
  it('enables visual operational presentation only through a bounded CMS selection', () => {
    const root = {
      ...mergedDashboardFixture,
      components: mergedDashboardFixture.components.map((tab) =>
        tab.properties.view === 'technical'
          ? { ...tab, properties: { ...tab.properties, presentation: 'visual' } }
          : tab,
      ),
    };
    const parsed = dashboardComposition(root);
    expect(parsed.tabs.find((tab) => tab.view === 'technical')?.presentation).toBe(
      'visual',
    );
    expect(
      parsed.tabs.find((tab) => tab.view === 'overview')?.presentation,
    ).toBeUndefined();
    for (const [view, presentation] of [
      ['technical', 'execute-script'],
      ['applications', 'visual'],
    ])
      expect(() =>
        dashboardComposition({
          ...root,
          components: root.components.map((tab) =>
            tab.properties.view === view
              ? { ...tab, properties: { ...tab.properties, presentation } }
              : tab,
          ),
        }),
      ).toThrow(/Unsupported dashboard presentation/);
  });
  it('restores operational Overview and merges Applications only when CMS selects them', () => {
    const result = dashboardComposition(mergedDashboardFixture);
    expect(result.tabs[0]?.layout).toBe('operational');
    expect(result.tabs[0]?.sections.map((section) => section.properties.kind)).toEqual([
      'context',
      'metrics',
      'receipts',
      'recovery',
      'blockers',
      'workspaces',
      'timeline',
      'footnotes',
    ]);
    expect(result.tabs[1]?.sections.map((section) => section.properties.kind)).toEqual([
      'metrics',
      'catalogue',
      'applications',
      'readiness',
      'attention',
      'details',
    ]);
    expect(dashboardComposition(dashboardFixture).tabs[0]?.layout).toBe('summary');
    const root = structuredClone(mergedDashboardFixture);
    expect(() =>
      dashboardComposition({
        ...root,
        components: root.components.map((tab, index) =>
          index === 0
            ? {
                ...tab,
                properties: { ...tab.properties, layout: 'arbitrary-script' },
              }
            : tab,
        ),
      }),
    ).toThrow(/Unsupported dashboard layout/);
  });
  it('takes the default, labels, tab order and section order from CMS', () => {
    const root = structuredClone(dashboardFixture);
    const tabs = root.components.map((tab, i) => ({
      ...tab,
      index: 30 - i * 10,
      properties: { ...tab.properties, title: 'Custom ' + String(tab.properties.view) },
      components: tab.components.map((section, j) => ({
        ...section,
        index: 100 - j * 10,
      })),
    }));
    const result = dashboardComposition({
      ...root,
      properties: { ...root.properties, defaultView: 'technical' },
      components: tabs,
    });
    expect(result.defaultView).toBe('technical');
    expect(result.tabs.map((tab) => tab.title)).toEqual([
      'Custom technical',
      'Custom applications',
      'Custom overview',
    ]);
    expect(result.tabs[0]?.sections[0]?.properties.kind).toBe('footnotes');
  });
  it('does not add a removed tab or section back through a frontend fallback', () => {
    const root = {
      ...dashboardFixture,
      components: dashboardFixture.components
        .slice(0, 1)
        .map((tab) => ({ ...tab, components: tab.components.slice(0, 1) })),
    };
    const result = dashboardComposition(root);
    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0]?.sections).toHaveLength(1);
  });
  it('rejects unsupported, duplicate and missing-default composition', () => {
    expect(() => dashboardComposition({ ...dashboardFixture, components: [] })).toThrow(
      /default tab/,
    );
    expect(() =>
      dashboardComposition({
        ...dashboardFixture,
        components: [dashboardFixture.components[0]!, dashboardFixture.components[0]!],
      }),
    ).toThrow(/duplicated/);
    const tab = dashboardFixture.components[0]!;
    expect(() =>
      dashboardComposition({
        ...dashboardFixture,
        components: [
          {
            ...tab,
            components: [
              {
                ...tab.components[0]!,
                properties: { kind: 'execute-script', title: 'Unsafe' },
              },
            ],
          },
        ],
      }),
    ).toThrow(/Invalid dashboard section/);
  });
  it('never counts unavailable or stale responses as published', () => {
    const profile = { code: 'test' } as Parameters<typeof overviewState>[0]['profile'];
    const data = { readiness: 'READY' } as ApplicationInitializationStatus;
    expect(overviewState({ profile, query: undefined })).toBe('unknown');
    expect(
      overviewState({ profile, query: { data, isError: true, isPending: false } }),
    ).toBe('unknown');
    expect(
      overviewState({
        profile,
        query: {
          data: {
            ...data,
            capability: { stale: true } as NonNullable<
              ApplicationInitializationStatus['capability']
            >,
          },
          isError: false,
          isPending: false,
        },
      }),
    ).toBe('unknown');
    expect(
      overviewState({ profile, query: { data, isError: false, isPending: false } }),
    ).toBe('published');
  });
});
