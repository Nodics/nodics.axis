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

type ShellNavigationGroupDefinition = Pick<
  ShellNavigationGroup,
  'id' | 'label' | 'order'
>;

interface BusinessNavigationGroups {
  readonly systemConfiguration: ShellNavigationGroupDefinition;
  readonly systemIntegrations: ShellNavigationGroupDefinition;
  readonly contentExperience: ShellNavigationGroupDefinition;
  readonly customersOrganisation: ShellNavigationGroupDefinition;
  readonly productsMerchandising: ShellNavigationGroupDefinition;
  readonly searchDiscovery: ShellNavigationGroupDefinition;
  readonly inventoryOperations: ShellNavigationGroupDefinition;
  readonly ordersCheckouts: ShellNavigationGroupDefinition;
  readonly shippingOperations: ShellNavigationGroupDefinition;
  readonly fulfillmentOperations: ShellNavigationGroupDefinition;
  readonly orderLifecycleOperations: ShellNavigationGroupDefinition;
  readonly paymentOperations: ShellNavigationGroupDefinition;
  readonly promotionsDiscounts: ShellNavigationGroupDefinition;
  readonly mediaManagement: ShellNavigationGroupDefinition;
  readonly editorialSpace: ShellNavigationGroupDefinition;
  readonly processAutomations: ShellNavigationGroupDefinition;
  readonly sustainabilityOperations: ShellNavigationGroupDefinition;
  readonly documentation: ShellNavigationGroupDefinition;
  readonly publishing: ShellNavigationGroupDefinition;
  readonly otherBacklogs: ShellNavigationGroupDefinition;
}

const BUSINESS_GROUPS: BusinessNavigationGroups = Object.freeze({
  systemConfiguration: {
    id: 'system-configuration',
    label: 'System Configuration',
    order: 90,
  },
  systemIntegrations: {
    id: 'system-integrations',
    label: 'System Integrations',
    order: 100,
  },
  contentExperience: {
    id: 'content',
    label: 'Content & Experience',
    order: 200,
  },
  mediaManagement: {
    id: 'media-management',
    label: 'Media Management',
    order: 300,
  },
  customersOrganisation: {
    id: 'organization',
    label: 'Customers & Organisation',
    order: 400,
  },
  productsMerchandising: {
    id: 'products-merchandising',
    label: 'Products & Merchandising',
    order: 500,
  },
  searchDiscovery: {
    id: 'search-discovery',
    label: 'Search & Discovery',
    order: 600,
  },
  inventoryOperations: {
    id: 'inventory-operations',
    label: 'Inventory Operations',
    order: 700,
  },
  ordersCheckouts: {
    id: 'orders-checkouts',
    label: 'Orders & Checkouts',
    order: 800,
  },
  orderLifecycleOperations: {
    id: 'order-lifecycle-operations',
    label: 'Order Lifecycle Operations',
    order: 900,
  },
  fulfillmentOperations: {
    id: 'fulfillment-operations',
    label: 'Fulfillment Operations',
    order: 1_000,
  },
  shippingOperations: {
    id: 'shipping-operations',
    label: 'Shipping Operations',
    order: 1_100,
  },
  paymentOperations: {
    id: 'payment-operations',
    label: 'Payment Operations',
    order: 1_200,
  },
  promotionsDiscounts: {
    id: 'promotions-discounts',
    label: 'Promotions & Discounts',
    order: 1_300,
  },
  editorialSpace: {
    id: 'editorial-space',
    label: 'Editorial Space',
    order: 1_400,
  },
  processAutomations: {
    id: 'process-and-automations',
    label: 'Process & Automations',
    order: 1_500,
  },
  sustainabilityOperations: {
    id: 'sustainability-operations',
    label: 'Sustainability Operations',
    order: 1_550,
  },
  documentation: {
    id: 'documentation',
    label: 'Documentation',
    order: 1_600,
  },
  publishing: {
    id: 'publishing',
    label: 'Publishing',
    order: 1_700,
  },
  otherBacklogs: {
    id: 'other-backlogs',
    label: 'Other Backlogs',
    order: 9_000,
  },
});

export function composeShellNavigation(
  navigation: readonly AxisNavigationItem[],
): readonly ShellNavigationGroup[] {
  const groups = new Map<string, ShellNavigationGroup>();
  const shellItems = navigation
    .filter(
      (item) => item.featureState !== 'HIDDEN' && item.featureState !== 'DISABLED',
    )
    .map<ShellNavigationItem>((item) => ({
      ...item,
      label: navigationDisplayLabel(item.label),
      group:
        item.group === undefined
          ? undefined
          : {
              ...item.group,
              label: navigationDisplayLabel(item.group.label),
            },
      depth: 0,
      hasChildren: false,
      local: false,
    }));
  const byIdentity = new Map(
    shellItems.map((item) => [navigationParentKey(item.moduleName, item.id), item]),
  );

  shellItems.forEach((item) => {
    const definition = businessNavigationGroup(item, byIdentity);
    const existing = groups.get(definition.id);
    groups.set(definition.id, {
      ...definition,
      items: [...(existing?.items ?? []), item],
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

function rootNavigationItem(
  item: ShellNavigationItem,
  byIdentity: ReadonlyMap<string, ShellNavigationItem>,
): ShellNavigationItem {
  let current = item;
  const visited = new Set<string>();
  while (current.parentId) {
    const parentKey = navigationParentKey(
      current.parentModuleName ?? current.moduleName,
      current.parentId,
    );
    if (visited.has(parentKey)) return current;
    visited.add(parentKey);
    const parent = byIdentity.get(parentKey);
    if (!parent) return current;
    current = parent;
  }
  return current;
}

function businessNavigationGroup(
  item: ShellNavigationItem,
  byIdentity: ReadonlyMap<string, ShellNavigationItem>,
): ShellNavigationGroupDefinition {
  const declaredDefinition = declaredBusinessNavigationGroup(item);
  if (declaredDefinition) return declaredDefinition;
  const rootItem = rootNavigationItem(item, byIdentity);
  if (rootItem !== item) {
    const rootDeclaredDefinition = declaredBusinessNavigationGroup(rootItem);
    if (rootDeclaredDefinition) return rootDeclaredDefinition;
  }
  return BUSINESS_GROUPS.otherBacklogs;
}

function declaredBusinessNavigationGroup(
  item: AxisNavigationItem,
): ShellNavigationGroupDefinition | undefined {
  if (!item.group?.id) return undefined;
  return {
    id: item.group.id,
    label: navigationDisplayLabel(item.group.label || item.group.id),
    order: Number.isInteger(item.group.order)
      ? item.group.order
      : BUSINESS_GROUPS.otherBacklogs.order,
  };
}

function navigationDisplayLabel(label: string): string {
  return label
    .replace(/\bAnd\b/g, '&')
    .replace(/\band\b/g, '&')
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+/g, ' ')
    .trim();
}

function flattenHierarchy(
  items: readonly ShellNavigationItem[],
): readonly ShellNavigationItem[] {
  const itemKeys = new Set(
    items.map((item) => navigationParentKey(item.moduleName, item.id)),
  );
  const byParent = new Map<string | undefined, ShellNavigationItem[]>();
  items.forEach((item) => {
    const requestedParent = item.parentId
      ? navigationParentKey(item.parentModuleName ?? item.moduleName, item.parentId)
      : undefined;
    const parent =
      requestedParent && itemKeys.has(requestedParent) ? requestedParent : undefined;
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
    flattened.push({
      ...item,
      label: depth <= 1 ? compactNavigationLabel(item.label) : item.label,
      depth,
      hasChildren: children.length > 0,
    });
    children.forEach((child) => append(child, depth + 1));
  };
  (byParent.get(undefined) ?? []).forEach((item) => append(item, 0));
  return flattened;
}

function compactNavigationLabel(label: string): string {
  return label.replace(/\band\b/gi, '&');
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
