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
  readonly documentation: ShellNavigationGroupDefinition;
  readonly publishing: ShellNavigationGroupDefinition;
  readonly otherBacklogs: ShellNavigationGroupDefinition;
}

const BUSINESS_GROUPS: BusinessNavigationGroups = Object.freeze({
  systemIntegrations: {
    id: 'system-integrations',
    label: 'System & Integrations',
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

const CATEGORY_GROUPS: Readonly<Record<string, ShellNavigationGroupDefinition>> =
  Object.freeze({
    content: BUSINESS_GROUPS.contentExperience,
    experience: BUSINESS_GROUPS.contentExperience,
    commerce: BUSINESS_GROUPS.productsMerchandising,
    core: BUSINESS_GROUPS.customersOrganisation,
    organization: BUSINESS_GROUPS.customersOrganisation,
    operations: BUSINESS_GROUPS.processAutomations,
    platform: BUSINESS_GROUPS.systemIntegrations,
  });

const GROUP_ID_ALIASES: Readonly<Record<string, ShellNavigationGroupDefinition>> =
  Object.freeze({
    'system-integrations': BUSINESS_GROUPS.systemIntegrations,
    content: BUSINESS_GROUPS.contentExperience,
    'content-experience': BUSINESS_GROUPS.contentExperience,
    commerce: BUSINESS_GROUPS.productsMerchandising,
    'media-management': BUSINESS_GROUPS.mediaManagement,
    'products-merchandising': BUSINESS_GROUPS.productsMerchandising,
    'catalogs-products': BUSINESS_GROUPS.productsMerchandising,
    'search-discovery': BUSINESS_GROUPS.searchDiscovery,
    'search-navigations': BUSINESS_GROUPS.searchDiscovery,
    'inventory-operations': BUSINESS_GROUPS.inventoryOperations,
    'orders-checkouts': BUSINESS_GROUPS.ordersCheckouts,
    'order-lifecycle-operations': BUSINESS_GROUPS.orderLifecycleOperations,
    'order-life-cycle': BUSINESS_GROUPS.orderLifecycleOperations,
    'shipping-operations': BUSINESS_GROUPS.shippingOperations,
    'payment-operations': BUSINESS_GROUPS.paymentOperations,
    'fulfillment-operations': BUSINESS_GROUPS.fulfillmentOperations,
    'promotions-discounts': BUSINESS_GROUPS.promotionsDiscounts,
    'promotions-discount': BUSINESS_GROUPS.promotionsDiscounts,
    organization: BUSINESS_GROUPS.customersOrganisation,
    'customers-organisation': BUSINESS_GROUPS.customersOrganisation,
    'customer-experience': BUSINESS_GROUPS.customersOrganisation,
    'editorial-space': BUSINESS_GROUPS.editorialSpace,
    'process-and-automations': BUSINESS_GROUPS.processAutomations,
    'process-automations': BUSINESS_GROUPS.processAutomations,
    'business-process-automation': BUSINESS_GROUPS.processAutomations,
    publishing: BUSINESS_GROUPS.publishing,
    documentation: BUSINESS_GROUPS.documentation,
    documentations: BUSINESS_GROUPS.documentation,
    'other-backlogs': BUSINESS_GROUPS.otherBacklogs,
  });

const dashboard: ShellNavigationItem = Object.freeze({
  id: 'dashboard',
  label: 'Runtime Dashboard',
  route: '/system-integrations',
  order: 0,
  moduleName: 'axis',
  category: 'platform',
  icon: 'dashboard',
  availability: 'UP',
  perspectives: ['operations'],
  contexts: [],
  featureState: 'ACTIVE',
  depth: 0,
  hasChildren: false,
  local: true,
});

function isRuntimeDashboardDuplicate(item: AxisNavigationItem): boolean {
  const label = item.label.trim().toLowerCase();
  const route = item.route.replace(/\/$/, '') || '/';
  return (
    item.id === dashboard.id ||
    (label === 'dashboard' &&
      item.category === 'platform' &&
      (route === dashboard.route || route.startsWith(`${dashboard.route}/`)))
  );
}

export function composeShellNavigation(
  navigation: readonly AxisNavigationItem[],
): readonly ShellNavigationGroup[] {
  const hasBackendDashboard = navigation.some(
    (item) => item.route === dashboard.route || item.id === 'system-integrations',
  );
  const groups = new Map<string, ShellNavigationGroup>();
  groups.set(BUSINESS_GROUPS.systemIntegrations.id, {
    ...BUSINESS_GROUPS.systemIntegrations,
    items: hasBackendDashboard ? [] : [dashboard],
  });
  const shellItems = navigation
    .filter(
      (item) =>
        !isRuntimeDashboardDuplicate(item) &&
        item.featureState !== 'HIDDEN' &&
        item.featureState !== 'DISABLED',
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

function itemSearchText(item: AxisNavigationItem): string {
  return [
    item.id,
    item.label,
    item.route,
    item.moduleName,
    item.category,
    item.group?.id,
    item.group?.label,
    item.workbenchTarget?.moduleName,
    item.workbenchTarget?.schemaName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
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
  const text = itemSearchText(item);
  const directDefinition = directBusinessNavigationGroup(item, text);
  if (directDefinition) return directDefinition;
  if (rootItem !== item) {
    return (
      directBusinessNavigationGroup(rootItem, itemSearchText(rootItem)) ??
      CATEGORY_GROUPS[item.category] ??
      BUSINESS_GROUPS.otherBacklogs
    );
  }
  return CATEGORY_GROUPS[item.category] ?? BUSINESS_GROUPS.otherBacklogs;
}

function declaredBusinessNavigationGroup(
  item: AxisNavigationItem,
): ShellNavigationGroupDefinition | undefined {
  if (!item.group?.id) return undefined;
  const alias = GROUP_ID_ALIASES[item.group.id];
  return {
    id: alias?.id ?? item.group.id,
    label: navigationDisplayLabel(item.group.label || alias?.label || item.group.id),
    order: Number.isInteger(item.group.order)
      ? item.group.order
      : (alias?.order ?? BUSINESS_GROUPS.otherBacklogs.order),
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

function directBusinessNavigationGroup(
  item: AxisNavigationItem,
  text: string,
): ShellNavigationGroupDefinition | undefined {
  if (item.id === 'dashboard' || text.includes('runtime dashboard')) {
    return BUSINESS_GROUPS.systemIntegrations;
  }
  if (text.includes('publish')) return BUSINESS_GROUPS.publishing;
  if (text.includes('media')) return BUSINESS_GROUPS.mediaManagement;
  if (
    text.includes('web content management') ||
    text.includes('wcms') ||
    text.includes('content management') ||
    text.includes('page') ||
    text.includes('component') ||
    text.includes('renderer') ||
    text.includes('template') ||
    text.includes('slot') ||
    text.includes('route') ||
    text.includes('restriction') ||
    text.includes('website') ||
    text.includes('site') ||
    text.includes('navigation node')
  ) {
    return BUSINESS_GROUPS.contentExperience;
  }
  if (
    text.includes('news') ||
    text.includes('blog') ||
    text.includes('article') ||
    text.includes('author') ||
    text.includes('taxonomy') ||
    text.includes('series') ||
    text.includes('editorial')
  ) {
    return BUSINESS_GROUPS.editorialSpace;
  }
  if (text.includes('discovery') || text.includes('search')) {
    return BUSINESS_GROUPS.searchDiscovery;
  }
  if (
    text.includes('inventory') ||
    text.includes('stock') ||
    text.includes('warehouse')
  ) {
    return BUSINESS_GROUPS.inventoryOperations;
  }
  if (
    text.includes('shipment') ||
    text.includes('shipping') ||
    text.includes('carrier')
  ) {
    return BUSINESS_GROUPS.shippingOperations;
  }
  if (text.includes('fulfillment') || text.includes('delivery')) {
    return BUSINESS_GROUPS.fulfillmentOperations;
  }
  if (text.includes('payment')) return BUSINESS_GROUPS.paymentOperations;
  if (
    text.includes('promotion') ||
    text.includes('coupon') ||
    text.includes('discount')
  ) {
    return BUSINESS_GROUPS.promotionsDiscounts;
  }
  if (
    text.includes('cancel') ||
    text.includes('return') ||
    text.includes('refund') ||
    text.includes('exchange') ||
    text.includes('life cycle') ||
    text.includes('lifecycle')
  ) {
    return BUSINESS_GROUPS.orderLifecycleOperations;
  }
  if (text.includes('order') || text.includes('checkout') || text.includes('cart')) {
    return BUSINESS_GROUPS.ordersCheckouts;
  }
  if (
    text.includes('product') ||
    text.includes('catalog') ||
    text.includes('category') ||
    text.includes('classification') ||
    text.includes('pricing') ||
    text.includes('price') ||
    text.includes('tax')
  ) {
    return BUSINESS_GROUPS.productsMerchandising;
  }
  if (
    text.includes('customer') ||
    text.includes('profile') ||
    text.includes('employee') ||
    text.includes('role') ||
    text.includes('permission') ||
    text.includes('enterprise') ||
    text.includes('business unit') ||
    text.includes('contact') ||
    text.includes('engagement')
  ) {
    return BUSINESS_GROUPS.customersOrganisation;
  }
  if (
    text.includes('workflow') ||
    text.includes('process') ||
    text.includes('automation')
  ) {
    return BUSINESS_GROUPS.processAutomations;
  }
  if (
    text.includes('my work') ||
    text.includes('assigned') ||
    text.includes('approval') ||
    text.includes('returned work') ||
    text.includes('completed work')
  ) {
    return BUSINESS_GROUPS.processAutomations;
  }
  if (text.includes('documentation') || text.includes('documentations')) {
    return BUSINESS_GROUPS.documentation;
  }
  if (
    text.includes('schema') ||
    text.includes('model') ||
    text.includes('module') ||
    text.includes('import') ||
    text.includes('export') ||
    text.includes('integration') ||
    text.includes('system')
  ) {
    return BUSINESS_GROUPS.systemIntegrations;
  }
  return undefined;
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
