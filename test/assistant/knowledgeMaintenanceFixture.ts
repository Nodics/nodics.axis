/** @file Synthetic maintenance labels and receipt evidence for local verification only. */
export const knowledgeMaintenanceCopy = {
  title: 'Maintenance receipts',
  load: 'Load maintenance receipts',
  refresh: 'Reload receipts',
  empty: 'No maintenance receipts for this source',
  unavailable: 'Maintenance receipts unavailable',
  evidence:
    'Authorization is not completion. A missing completion receipt remains unconfirmed; inspect current source readiness before any further action.',
  operation: 'Operation',
  actor: 'Administrator',
  revision: 'Manifest revision',
  previous: 'Previous page',
  next: 'Next page',
  CLEANUP_AUTHORIZED: 'Cleanup authorized',
  CLEANUP_COMPLETED: 'Cleanup completion recorded',
  WRITER_RETIREMENT_AUTHORIZED: 'Writer retirement authorized',
  WRITER_RETIREMENT_COMPLETED: 'Writer retirement completion recorded',
};
export const maintenanceReceiptFixture = {
  code: 'ckm-11111111-1111-4111-8111-111111111111',
  operationCode: 'retire-22222222-2222-4222-8222-222222222222',
  principalCode: 'Example administrator',
  revision: 7,
  stage: 'WRITER_RETIREMENT_AUTHORIZED' as const,
  occurredAt: '2026-10-03T10:00:00.000Z',
};
