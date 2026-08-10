import type {
  AxisModuleAvailability,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';

export interface ShellNavigationItem extends AxisNavigationItem {
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly local: boolean;
}

export interface ShellNavigationGroup {
  readonly id: string;
  readonly label: string;
  readonly order: number;
  readonly items: readonly ShellNavigationItem[];
}

const CATEGORY_GROUPS: Readonly<
  Record<string, Pick<ShellNavigationGroup, 'id' | 'label' | 'order'>>
> = Object.freeze({
  content: { id: 'content', label: 'Content and Experience', order: 200 },
  experience: { id: 'content', label: 'Content and Experience', order: 200 },
  commerce: { id: 'commerce', label: 'Commerce', order: 300 },
  core: {
    id: 'organization',
    label: 'Customers and Organization',
    order: 400,
  },
  operations: {
    id: 'business-process-automation',
    label: 'Process & Automation',
    order: 500,
  },
  platform: {
    id: 'system-integrations',
    label: 'System & Integrations',
    order: 150,
  },
});

const dashboard: ShellNavigationItem = Object.freeze({
  id: 'dashboard',
  label: 'Dashboard',
  route: '/dashboard',
  order: 0,
  moduleName: 'axis',
  category: 'workspace',
  icon: 'dashboard',
  availability: 'UP',
  perspectives: ['operations'],
  contexts: [],
  featureState: 'ACTIVE',
  depth: 0,
  hasChildren: false,
  local: true,
});

export function composeShellNavigation(
  navigation: readonly AxisNavigationItem[],
): readonly ShellNavigationGroup[] {
  const groups = new Map<string, ShellNavigationGroup>();
  groups.set('workspace', {
    id: 'workspace',
    label: 'Workspace',
    order: 100,
    items: [dashboard],
  });

  navigation.forEach((item) => {
    const definition = item.group ??
      CATEGORY_GROUPS[item.category] ?? {
        id: 'other',
        label: 'Other Capabilities',
        order: 700,
      };
    const existing = groups.get(definition.id);
    const shellItem: ShellNavigationItem = {
      ...item,
      depth: 0,
      hasChildren: false,
      local: false,
    };
    groups.set(definition.id, {
      ...definition,
      items: [...(existing?.items ?? []), shellItem],
    });
  });

  return Object.freeze(
    [...groups.values()]
      .map((group) => ({
        ...group,
        items: Object.freeze(flattenHierarchy(group.items)),
      }))
      .sort((left, right) => left.order - right.order),
  );
}

function flattenHierarchy(
  items: readonly ShellNavigationItem[],
): readonly ShellNavigationItem[] {
  const byParent = new Map<string | undefined, ShellNavigationItem[]>();
  items.forEach((item) => {
    const parent = item.parentId
      ? navigationParentKey(item.parentModuleName ?? item.moduleName, item.parentId)
      : undefined;
    byParent.set(parent, [...(byParent.get(parent) ?? []), item]);
  });
  byParent.forEach((children) => {
    children.sort(
      (left, right) =>
        left.order - right.order || left.label.localeCompare(right.label),
    );
  });
  const flattened: ShellNavigationItem[] = [];
  const append = (item: ShellNavigationItem, depth: number) => {
    const children = byParent.get(navigationParentKey(item.moduleName, item.id)) ?? [];
    flattened.push({ ...item, depth, hasChildren: children.length > 0 });
    children.forEach((child) => append(child, depth + 1));
  };
  (byParent.get(undefined) ?? []).forEach((item) => append(item, 0));
  return flattened;
}

export function navigationParentKey(moduleName: string, id: string): string {
  return `${moduleName}:${id}`;
}

export function availabilityLabel(state: AxisModuleAvailability): string {
  switch (state) {
    case 'UP':
      return 'Available';
    case 'DEGRADED':
      return 'Degraded';
    case 'UNAVAILABLE':
      return 'Unavailable';
    default:
      return 'Unknown';
  }
}
