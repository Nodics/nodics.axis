import { Fragment, type ReactNode } from 'react';
import type { CmsComponentContract } from '../cms/cmsContract';

export type DashboardView = 'overview' | 'applications' | 'technical';
export interface DashboardTab {
  readonly component: CmsComponentContract;
  readonly view: DashboardView;
  readonly layout: 'summary' | 'operational' | 'framework';
  readonly presentation?: 'visual';
  readonly title: string;
  readonly description: string;
  readonly sections: readonly CmsComponentContract[];
}
const sectionKinds: Record<DashboardView, readonly string[]> = {
  overview: [
    'metrics',
    'applications',
    'readiness',
    'attention',
    'operations',
    'documentation',
  ],
  applications: [
    'settings',
    'catalogue',
    'details',
    'metrics',
    'applications',
    'readiness',
    'attention',
    'operations',
    'documentation',
  ],
  technical: [
    'context',
    'metrics',
    'receipts',
    'recovery',
    'blockers',
    'workspaces',
    'timeline',
    'footnotes',
  ],
};
const frameworkSections = [
  'context',
  'pulse',
  'domains',
  'work',
  'activity',
  'exceptions',
];

/** Published composition selects installed renderers, never URLs or executable code. */
export function dashboardText(component: CmsComponentContract, key: string): string {
  const value = component.properties[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Dashboard component ${component.code} requires ${key}`);
  }
  return value;
}

/** CMS selects bounded evidence fields, not endpoints or executable queries. */
export function dashboardAreas(component: CmsComponentContract) {
  const areas = component.properties.areas;
  if (!areas || typeof areas !== 'object' || Array.isArray(areas))
    throw new Error('Dashboard operational areas must be an object');
  const result = Object.entries(areas as Record<string, unknown>).map(
    ([key, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid dashboard operational area');
      const fields = value as Record<string, unknown>;
      if (
        !['title', 'metric', 'label'].every(
          (field) => typeof fields[field] === 'string' && fields[field].trim(),
        )
      ) {
        throw new Error('Invalid dashboard operational area');
      }
      return {
        key,
        title: fields.title as string,
        metric: fields.metric as string,
        label: fields.label as string,
      };
    },
  );
  if (result.length > 20) throw new Error('Too many dashboard operational areas');
  return result;
}

export function dashboardComposition(component: CmsComponentContract) {
  if (component.renderer !== 'axis.component.dashboard-workspace') {
    throw new Error('Dashboard workspace renderer is required');
  }
  const seen = new Set<string>();
  const tabs = [...component.components]
    .sort((a, b) => a.index - b.index)
    .map((tab): DashboardTab => {
      const view = dashboardText(tab, 'view') as DashboardView;
      if (
        tab.renderer !== 'axis.component.dashboard-tab' ||
        !Object.hasOwn(sectionKinds, view) ||
        seen.has(view)
      ) {
        throw new Error('Dashboard tab is unsupported or duplicated');
      }
      seen.add(view);
      const layout =
        tab.properties.layout ?? (view === 'technical' ? 'operational' : 'summary');
      if (
        typeof layout !== 'string' ||
        !['summary', 'operational', 'framework'].includes(layout) ||
        (layout === 'framework' && view !== 'overview') ||
        (view === 'applications' && layout !== 'summary') ||
        (view === 'technical' && layout !== 'operational')
      ) {
        throw new Error('Unsupported dashboard layout');
      }
      const allowedKinds =
        layout === 'framework'
          ? frameworkSections
          : layout === 'operational'
            ? sectionKinds.technical
            : sectionKinds[view];
      const presentation = tab.properties.presentation;
      if (
        presentation !== undefined &&
        (presentation !== 'visual' || layout !== 'operational')
      )
        throw new Error('Unsupported dashboard presentation');
      const kinds = new Set<string>();
      const sections = [...tab.components].sort((a, b) => a.index - b.index);
      for (const section of sections) {
        const kind = dashboardText(section, 'kind');
        if (
          section.renderer !== 'axis.component.dashboard-section' ||
          !allowedKinds.includes(kind) ||
          kinds.has(kind) ||
          section.components.length
        ) {
          throw new Error(`Invalid dashboard section: ${section.code}`);
        }
        dashboardText(section, 'title');
        kinds.add(kind);
      }
      return {
        component: tab,
        view,
        layout: layout as DashboardTab['layout'],
        ...(presentation === 'visual' ? ({ presentation } as const) : {}),
        title: dashboardText(tab, 'title'),
        description: dashboardText(tab, 'description'),
        sections,
      };
    });
  const defaultView = dashboardText(component, 'defaultView');
  if (!tabs.length || !tabs.some((tab) => tab.view === defaultView)) {
    throw new Error('Dashboard default tab must be present in published composition');
  }
  return { tabs, defaultView };
}

/** Only referenced CMS sections render, in their delivered order. */
export function renderDashboardSections(
  sections: readonly CmsComponentContract[],
  renderers: Readonly<Record<string, (component: CmsComponentContract) => ReactNode>>,
) {
  return sections.map((component) => {
    const render = renderers[dashboardText(component, 'kind')];
    if (!render) throw new Error(`Unsupported dashboard section: ${component.code}`);
    return <Fragment key={component.code}>{render(component)}</Fragment>;
  });
}
