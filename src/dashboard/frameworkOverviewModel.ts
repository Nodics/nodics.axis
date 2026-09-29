import type { AxisNavigationItem } from '../bootstrap/publicBootstrap';
import type { CmsComponentContract } from '../cms/cmsContract';
import type { WorkbenchMetricDefinition } from '../operations/shared/workbenchMetricDashboardModel';
import type { ProcessHumanTask } from '../operations/processWorkflow/api/processDefinitionClient';

export interface OverviewDomain {
  readonly id: string;
  readonly label: string;
  readonly order: number;
  readonly entry: AxisNavigationItem;
  readonly items: readonly AxisNavigationItem[];
}

/** CMS selects presentation references only, never API paths or business queries. */
export function overviewReferences(
  section: CmsComponentContract | undefined,
  field: string,
): readonly string[] {
  if (!section) return [];
  const value = section.properties[field];
  if (
    !Array.isArray(value) ||
    value.length > 32 ||
    value.some(
      (item) => typeof item !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(item),
    )
  )
    throw new Error(`Invalid overview ${field}`);
  return [...new Set(value as string[])];
}

/** Exact authorized catalogue, including ancestor availability. Presentation never restores denied routes. */
export function overviewNavigation(
  navigation: readonly AxisNavigationItem[],
): readonly AxisNavigationItem[] {
  const byIdentity = new Map(
    navigation.map((item) => [`${item.moduleName}:${item.id}`, item]),
  );
  const allowed = (item: AxisNavigationItem, seen = new Set<string>()): boolean => {
    const key = `${item.moduleName}:${item.id}`;
    if (
      seen.has(key) ||
      !['UP', 'DEGRADED'].includes(item.availability) ||
      (item.featureState && item.featureState !== 'ACTIVE') ||
      !/^\/(?!\/)/.test(item.route) ||
      /[\\\r\n]/.test(item.route) ||
      item.contexts?.some(
        (context) => !['tenant', 'enterprise', 'environment'].includes(context),
      )
    )
      return false;
    if (!item.parentId) return true;
    seen.add(key);
    const parent = byIdentity.get(
      `${item.parentModuleName ?? item.moduleName}:${item.parentId}`,
    );
    return Boolean(parent && allowed(parent, seen));
  };
  return navigation
    .filter((item) => allowed(item))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

/** Group names, links and ownership come from BackOffice; new business groups appear without a client registry. */
export function overviewDomains(
  navigation: readonly AxisNavigationItem[],
  excludedGroups: readonly string[],
): readonly OverviewDomain[] {
  const groups = new Map<string, AxisNavigationItem[]>();
  for (const item of overviewNavigation(navigation)) {
    if (!item.group || excludedGroups.includes(item.group.id)) continue;
    groups.set(item.group.id, [...(groups.get(item.group.id) ?? []), item]);
  }
  return [...groups.entries()]
    .map(([id, items]) => {
      const unique = [...new Map(items.map((item) => [item.route, item])).values()];
      const entry =
        unique.find((item) => !item.parentId && !item.route.includes('#')) ??
        unique[0]!;
      return {
        id,
        label: entry.group!.label,
        order: entry.group!.order,
        entry,
        items: unique,
      };
    })
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

/** Counts bind only to owner-declared unfiltered workbench targets; no inferred schemas or hidden fixed scopes. */
export function overviewMetricDefinitions(
  navigation: readonly AxisNavigationItem[],
  references: readonly string[],
): readonly WorkbenchMetricDefinition[] {
  const authorized = overviewNavigation(navigation);
  return references.flatMap((reference) => {
    const item = authorized.find(
      (item) => `${item.moduleName}:${item.id}` === reference,
    );
    const target = item?.workbenchTarget;
    if (
      !item ||
      !target ||
      target.mode === 'create' ||
      item.workbenchPresentation?.fixedFilters?.length
    )
      return [];
    return [
      {
        id: reference,
        label: item.label,
        moduleName: target.moduleName,
        schemaName: target.schemaName,
        description: item.help?.summary ?? item.label,
        route: item.route,
        icon: item.icon,
      },
    ];
  });
}

/** This is a bounded authorized queue, not a personal assignment claim or an enterprise-wide total. */
export function overviewOpenTasks(
  tasks: readonly ProcessHumanTask[],
  now: number,
): readonly ProcessHumanTask[] {
  return tasks
    .filter((task) => ['OPEN', 'CLAIMED', 'ESCALATED'].includes(task.status))
    .slice()
    .sort((a, b) => {
      const due = (task: ProcessHumanTask) =>
        task.dueAt && Number.isFinite(Date.parse(task.dueAt))
          ? Date.parse(task.dueAt)
          : Infinity;
      const priority = (task: ProcessHumanTask) =>
        task.status === 'ESCALATED' ? 0 : due(task) < now ? 1 : 2;
      return (
        priority(a) - priority(b) || due(a) - due(b) || a.code.localeCompare(b.code)
      );
    });
}
