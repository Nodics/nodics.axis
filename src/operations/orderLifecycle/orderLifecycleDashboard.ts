import type { AxisNavigationLifecycleAction } from '../../bootstrap/publicBootstrap';
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
  if (type === 'RETURN' && (returnStatuses.has(currentStatus) || hasEvidence(record, 'rmaCode'))) {
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
