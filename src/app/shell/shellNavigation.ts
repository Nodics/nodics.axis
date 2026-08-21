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
  readonly catalogsProducts: ShellNavigationGroupDefinition;
  readonly searchNavigations: ShellNavigationGroupDefinition;
  readonly inventoryOperations: ShellNavigationGroupDefinition;
  readonly ordersCheckouts: ShellNavigationGroupDefinition;
  readonly fulfillmentOperations: ShellNavigationGroupDefinition;
  readonly orderLifeCycle: ShellNavigationGroupDefinition;
  readonly paymentOperations: ShellNavigationGroupDefinition;
  readonly promotionsDiscount: ShellNavigationGroupDefinition;
  readonly mediaManagement: ShellNavigationGroupDefinition;
  readonly editorialSpace: ShellNavigationGroupDefinition;
  readonly processAutomations: ShellNavigationGroupDefinition;
  readonly documentations: ShellNavigationGroupDefinition;
  readonly publishing: ShellNavigationGroupDefinition;
  readonly otherBacklogs: ShellNavigationGroupDefinition;
}

const BUSINESS_GROUPS: BusinessNavigationGroups = Object.freeze({
  systemIntegrations: {
    id: 'system-integrations',
    label: 'System and Integrations',
    order: 100,
  },
  contentExperience: {
    id: 'content-experience',
    label: 'Content and Experience',
    order: 200,
  },
  customersOrganisation: {
    id: 'customers-organisation',
    label: 'Customers and Organisation',
    order: 300,
  },
  catalogsProducts: {
    id: 'catalogs-products',
    label: 'Catalogs and Products',
    order: 400,
  },
  searchNavigations: {
    id: 'search-navigations',
    label: 'Search and Navigations',
    order: 450,
  },
  inventoryOperations: {
    id: 'inventory-operations',
    label: 'Inventory Operations',
    order: 500,
  },
  ordersCheckouts: {
    id: 'orders-checkouts',
    label: 'Orders and Checkouts',
    order: 600,
  },
  fulfillmentOperations: {
    id: 'fulfillment-operations',
    label: 'Fulfillment Operations',
    order: 650,
  },
  orderLifeCycle: {
    id: 'order-life-cycle',
    label: 'Order Life Cycle',
    order: 700,
  },
  paymentOperations: {
    id: 'payment-operations',
    label: 'Payment Operations',
    order: 750,
  },
  promotionsDiscount: {
    id: 'promotions-discount',
    label: 'Promotions and Discount',
    order: 800,
  },
  mediaManagement: {
    id: 'media-management',
    label: 'Media Management',
    order: 850,
  },
  editorialSpace: {
    id: 'editorial-space',
    label: 'Editorial Space',
    order: 900,
  },
  processAutomations: {
    id: 'process-automations',
    label: 'Process and Automations',
    order: 950,
  },
  documentations: {
    id: 'documentations',
    label: 'Documentations',
    order: 1_000,
  },
  publishing: {
    id: 'publishing',
    label: 'Publishing',
    order: 1_050,
  },
  otherBacklogs: {
    id: 'other-backlogs',
    label: 'Other Backlogs',
    order: 1_200,
  },
});

const CATEGORY_GROUPS: Readonly<
  Record<string, ShellNavigationGroupDefinition>
> = Object.freeze({
  content: BUSINESS_GROUPS.contentExperience,
  experience: BUSINESS_GROUPS.contentExperience,
  commerce: BUSINESS_GROUPS.catalogsProducts,
  core: BUSINESS_GROUPS.customersOrganisation,
  operations: BUSINESS_GROUPS.processAutomations,
  platform: BUSINESS_GROUPS.systemIntegrations,
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

export function composeShellNavigation(
  navigation: readonly AxisNavigationItem[],
): readonly ShellNavigationGroup[] {
  const groups = new Map<string, ShellNavigationGroup>();
  groups.set(BUSINESS_GROUPS.systemIntegrations.id, {
    ...BUSINESS_GROUPS.systemIntegrations,
    items: [dashboard],
  });
  const shellItems = navigation
    .filter(
      (item) =>
        item.route !== dashboard.route &&
        item.id !== dashboard.id &&
        item.label.trim().toLowerCase() !== 'dashboard',
    )
    .map<ShellNavigationItem>((item) => ({
      ...item,
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
  const text = itemSearchText(item);
  const directDefinition = directBusinessNavigationGroup(item, text);
  if (directDefinition) return directDefinition;
  const rootItem = rootNavigationItem(item, byIdentity);
  if (rootItem !== item) {
    return (
      directBusinessNavigationGroup(rootItem, itemSearchText(rootItem)) ??
      CATEGORY_GROUPS[item.category] ??
      BUSINESS_GROUPS.otherBacklogs
    );
  }
  return CATEGORY_GROUPS[item.category] ?? BUSINESS_GROUPS.otherBacklogs;
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
    return BUSINESS_GROUPS.searchNavigations;
  }
  if (text.includes('inventory') || text.includes('stock') || text.includes('warehouse')) {
    return BUSINESS_GROUPS.inventoryOperations;
  }
  if (text.includes('fulfillment') || text.includes('shipment') || text.includes('delivery')) {
    return BUSINESS_GROUPS.fulfillmentOperations;
  }
  if (text.includes('payment')) return BUSINESS_GROUPS.paymentOperations;
  if (text.includes('promotion') || text.includes('coupon') || text.includes('discount')) {
    return BUSINESS_GROUPS.promotionsDiscount;
  }
  if (
    text.includes('cancel') ||
    text.includes('return') ||
    text.includes('refund') ||
    text.includes('exchange') ||
    text.includes('life cycle') ||
    text.includes('lifecycle')
  ) {
    return BUSINESS_GROUPS.orderLifeCycle;
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
    return BUSINESS_GROUPS.catalogsProducts;
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
  if (text.includes('workflow') || text.includes('process') || text.includes('automation')) {
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
    return BUSINESS_GROUPS.documentations;
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
    const parent = requestedParent && itemKeys.has(requestedParent)
      ? requestedParent
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
