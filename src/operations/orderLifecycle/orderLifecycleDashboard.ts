import type { AxisNavigationItem, AxisNavigationLifecycleAction } from '../../bootstrap/publicBootstrap';
import type { WorkbenchRecord } from '../../workbench/api/workbenchContracts';

export type OrderLifecycleBucket =
  | 'pendingApproval'
  | 'returnHandling'
  | 'refundReconciliation'
  | 'rejectedOrAppealable'
  | 'completed'
  | 'monitoring';

export interface OrderLifecycleDashboardItem {
  readonly bucket: OrderLifecycleBucket;
  readonly label: string;
  readonly urgent: boolean;
  readonly recommendedActionIds: readonly string[];
}

export type OrderLifecycleOperatorQueueCode =
  | 'cancellations'
  | 'returns'
  | 'refunds'
  | 'exchanges'
  | 'appeals';

export interface OrderLifecycleOperatorQueue {
  readonly code: OrderLifecycleOperatorQueueCode;
  readonly label: string;
  readonly route: string;
  readonly ownerModule: string;
  readonly requestTypes: readonly string[];
  readonly actionLabels: readonly string[];
  readonly summary: string;
}

const refundStatuses = new Set(['REFUND_DELAYED', 'REFUND_RECONCILIATION_REQUIRED', 'RECONCILING']);
const returnStatuses = new Set(['RETURN_RECEIVED', 'INSPECTED', 'DISPOSITION_RECORDED']);
const terminalStatuses = new Set(['APPROVED', 'REJECTED', 'COMPLETED', 'REFUND_SUCCEEDED']);

function status(record: WorkbenchRecord): string {
  return String(record.status ?? record.state ?? '').toUpperCase();
}

function requestType(record: WorkbenchRecord): string {
  return String(record.requestType ?? record.type ?? record.lifecycleType ?? '').toUpperCase();
}

function hasEvidence(record: WorkbenchRecord, key: string): boolean {
  const evidence = record.evidence;
  return typeof evidence === 'object' && evidence !== null && key in evidence;
}

function queueCode(navigation: AxisNavigationItem): OrderLifecycleOperatorQueueCode | undefined {
  const value = `${navigation.id} ${navigation.label} ${navigation.route}`.toLowerCase();
  if (value.includes('appeal')) return 'appeals';
  if (value.includes('exchange') || value.includes('replacement')) return 'exchanges';
  if (value.includes('refund')) return 'refunds';
  if (value.includes('return')) return 'returns';
  if (value.includes('cancellation') || value.includes('cancel')) return 'cancellations';
  return undefined;
}

function requestTypes(navigation: AxisNavigationItem, code: OrderLifecycleOperatorQueueCode): readonly string[] {
  const filterTypes = navigation.workbenchPresentation?.fixedFilters
    ?.flatMap((filter) => filter.values ?? (filter.value ? [filter.value] : []))
    .filter((value) => value && /^[A-Z_]+$/u.test(value));
  if (filterTypes?.length) return Array.from(new Set(filterTypes));
  return {
    cancellations: ['CANCELLATION'],
    returns: ['RETURN'],
    refunds: ['REFUND'],
    exchanges: ['EXCHANGE', 'REPLACEMENT'],
    appeals: ['APPEAL'],
  }[code];
}

/**
 * Builds the operator queue overview from backend-published navigation and
 * lifecycle-action metadata. Axis may group and label queues, but the routes,
 * modules, filters, and executable actions remain backend-owned.
 */
export function orderLifecycleOperatorQueues(navigation: readonly AxisNavigationItem[]): readonly OrderLifecycleOperatorQueue[] {
  return navigation
    .map((item): OrderLifecycleOperatorQueue | undefined => {
      const code = queueCode(item);
      if (!code || item.moduleName !== 'order') return undefined;
      return {
        code,
        label: item.label,
        route: item.route,
        ownerModule: item.moduleName,
        requestTypes: requestTypes(item, code),
        actionLabels: Object.freeze((item.lifecycleActions ?? []).map((action) => action.label)),
        summary: item.help?.summary ?? item.workbenchPresentation?.fixedFilters?.[0]?.label ?? item.label,
      };
    })
    .filter((item): item is OrderLifecycleOperatorQueue => Boolean(item));
}

/**
 * Groups backend lifecycle records into operator dashboard buckets without
 * changing the backend action authority. Axis only helps the operator triage
 * records that already came from the Commerce workbench contract.
 */
export function orderLifecycleDashboardItem(
  record: WorkbenchRecord,
  actions: readonly AxisNavigationLifecycleAction[] = [],
): OrderLifecycleDashboardItem {
  const currentStatus = status(record);
  const type = requestType(record);
  const actionIds = new Set(actions.map((action) => action.id));
  if (currentStatus.includes('REJECT')) {
    return {
      bucket: 'rejectedOrAppealable',
      label: 'Rejected or appealable',
      urgent: Boolean(actionIds.has('retry') || actionIds.has('reconcile')),
      recommendedActionIds: ['retry', 'reconcile'].filter((id) => actionIds.has(id)),
    };
  }
  if (refundStatuses.has(currentStatus) || hasEvidence(record, 'reconciliationRequired')) {
    return {
      bucket: 'refundReconciliation',
      label: 'Refund reconciliation',
      urgent: true,
      recommendedActionIds: ['reconcile', 'approve-refund'].filter((id) => actionIds.has(id)),
    };
  }
  if ((type === 'RETURN' || type === 'EXCHANGE' || type === 'REPLACEMENT') && (returnStatuses.has(currentStatus) || hasEvidence(record, 'rmaCode'))) {
    return {
      bucket: 'returnHandling',
      label: 'Return receipt, inspection or disposition',
      urgent: currentStatus !== 'DISPOSITION_RECORDED',
      recommendedActionIds: ['mark-received', 'mark-inspected', 'record-disposition'].filter((id) => actionIds.has(id)),
    };
  }
  if (terminalStatuses.has(currentStatus)) {
    return {
      bucket: 'completed',
      label: 'Completed lifecycle case',
      urgent: false,
      recommendedActionIds: [],
    };
  }
  return {
    bucket: 'pendingApproval',
    label: 'Pending approval',
    urgent: true,
    recommendedActionIds: ['approve', 'reject'].filter((id) => actionIds.has(id)),
  };
}
