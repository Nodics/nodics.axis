import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router';

import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkbenchRoutePage } from '../../workbench/WorkbenchRoutePage';
import { orderLifecycleGuidance } from './orderLifecycleGuidance';

interface OrderLifecycleManagementRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly channel: string;
  readonly cmsBaseUrl: string;
  readonly employeeId: string;
  readonly locale: string;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
  readonly site: string;
}

const navigationParentModule = (item: AxisNavigationItem): string =>
  item.parentModuleName ?? item.moduleName;

const hasNavigationParent = (
  item: AxisNavigationItem,
): item is AxisNavigationItem & {
  readonly parentId: string;
} => item.parentId !== undefined && item.parentId.length > 0;

const sameParent = (left: AxisNavigationItem, right: AxisNavigationItem): boolean =>
  hasNavigationParent(left) &&
  hasNavigationParent(right) &&
  left.parentId === right.parentId &&
  navigationParentModule(left) === navigationParentModule(right);

const isChildOf = (item: AxisNavigationItem, parent: AxisNavigationItem): boolean =>
  item.parentId === parent.id && navigationParentModule(item) === parent.moduleName;

const lifecycleText = (item: AxisNavigationItem): string =>
  `${item.id} ${item.route} ${item.label} ${item.workbenchTarget?.schemaName ?? ''}`;

const isOrderLifecycleWorkspace = (item: AxisNavigationItem): boolean =>
  /(cancel|return|refund|lifecycle|rma)/i.test(lifecycleText(item));

const commerceWorkspaceGuidance = (item: AxisNavigationItem): string => {
  const schemaName = item.workbenchTarget?.schemaName;
  const domainText =
    `${item.id} ${item.route} ${item.moduleName} ${schemaName ?? ''}`.toLowerCase();
  if (isOrderLifecycleWorkspace(item)) return orderLifecycleGuidance(schemaName);
  if (domainText.includes('payment'))
    return 'Operate payment methods, provider configuration, transaction evidence, refund execution, and reconciliation through Payment-owned backend actions. Refunds require an existing order/payment trail; Axis never creates a catalog-only refund.';
  if (domainText.includes('product') || domainText.includes('catalog'))
    return 'Manage catalog and product records as sellable truth. Catalog can expose eligibility or policy context, but cancellation, return, and refund actions must start from an order/payment record.';
  if (domainText.includes('fulfillment') || domainText.includes('shipment'))
    return 'Operate fulfillment evidence, release, shipment, RMA receipt, and disposition through Fulfillment-owned backend actions. Payment refunds remain linked through order lifecycle evidence.';
  if (domainText.includes('inventory') || domainText.includes('stock'))
    return 'Operate stock, promise, reservation, movement, and reconciliation evidence through Inventory-owned backend actions. Inventory confirms quantity movement; it does not initiate customer refunds.';
  return 'Operate this Commerce workspace through backend-authorized records and lifecycle actions. Axis presents safe evidence and keeps domain ownership with the publishing capability.';
};

const commerceWorkspaceEyebrow = (item: AxisNavigationItem): string => {
  const domainText =
    `${item.id} ${item.route} ${item.moduleName} ${item.workbenchTarget?.schemaName ?? ''}`.toLowerCase();
  if (isOrderLifecycleWorkspace(item)) return 'Order Lifecycle Management';
  if (domainText.includes('payment')) return 'Payment Operations';
  if (domainText.includes('product') || domainText.includes('catalog'))
    return 'Catalog & Product Management';
  if (domainText.includes('fulfillment') || domainText.includes('shipment'))
    return 'Fulfillment Operations';
  if (domainText.includes('inventory') || domainText.includes('stock'))
    return 'Inventory Operations';
  return item.group?.label ?? 'Commerce Operations';
};

const commerceWorkspaceChips = (item: AxisNavigationItem): readonly string[] => {
  const domainText =
    `${item.id} ${item.route} ${item.moduleName} ${item.workbenchTarget?.schemaName ?? ''}`.toLowerCase();
  if (isOrderLifecycleWorkspace(item))
    return [
      'Cancellation · Fulfillment · Inventory · Payment',
      'Return · RMA · Receipt · Disposition',
      'Refund · Approval · Original rail · Reconciliation',
    ];
  if (domainText.includes('payment'))
    return [
      'Payment-owned provider execution',
      'Refunds require order/payment evidence',
      'Reconciliation stays provider-safe',
    ];
  if (domainText.includes('product') || domainText.includes('catalog'))
    return [
      'Catalog is sellable truth',
      'No catalog-only refund action',
      'Order lifecycle owns reversal intent',
    ];
  return [
    'Backend-owned authority',
    'Safe operational evidence',
    'Customer overrides remain configurable',
  ];
};

const relatedCommerceWorkspaces = (
  navigation: readonly AxisNavigationItem[],
  current: AxisNavigationItem,
): readonly AxisNavigationItem[] => {
  const children = navigation.filter((item) => isChildOf(item, current));
  const related =
    children.length > 0
      ? children
      : hasNavigationParent(current)
        ? navigation.filter((item) => sameParent(item, current))
        : [];
  const scoped = isOrderLifecycleWorkspace(current)
    ? related.filter(isOrderLifecycleWorkspace)
    : related;
  return scoped.sort((left, right) => left.order - right.order);
};

export function OrderLifecycleManagementRoutePage(
  props: OrderLifecycleManagementRoutePageProps,
) {
  const navigate = useNavigate();
  const workspaces = relatedCommerceWorkspaces(
    props.bootstrap.navigation,
    props.navigation,
  );
  const guidance = commerceWorkspaceGuidance(props.navigation);
  const chips = commerceWorkspaceChips(props.navigation);
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            sx={{ justifyContent: 'space-between' }}
          >
            <Box>
              <Typography variant="overline">
                {commerceWorkspaceEyebrow(props.navigation)}
              </Typography>
              <Typography variant="h4">{props.navigation.label}</Typography>
              <Typography color="text.secondary">
                {props.navigation.help?.summary ?? guidance}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Chip label="Backend authorized" color="success" size="small" />
              <Chip label="Owner evidence" size="small" />
              <Chip label={props.navigation.availability} size="small" />
            </Stack>
          </Stack>
          <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap' }}>
            {workspaces.map((item) => (
              <Button
                key={`${item.moduleName}:${item.id}`}
                size="small"
                variant={item.id === props.navigation.id ? 'contained' : 'outlined'}
                onClick={() => void navigate(item.route)}
              >
                {item.label}
              </Button>
            ))}
          </Stack>
          <Alert severity="info">{guidance}</Alert>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {chips.map((chip) => (
              <Chip key={chip} label={chip} />
            ))}
          </Stack>
        </Stack>
      </Paper>
      {props.navigation.workbenchTarget ? (
        <WorkbenchRoutePage
          accessToken={props.accessToken}
          bootstrap={props.bootstrap}
          channel={props.channel}
          cmsBaseUrl={props.cmsBaseUrl}
          employeeId={props.employeeId}
          locale={props.locale}
          routeNavigation={props.navigation}
          routeSchema={props.navigation.workbenchTarget}
          runtime={props.runtime}
          site={props.site}
        />
      ) : null}
    </Stack>
  );
}
