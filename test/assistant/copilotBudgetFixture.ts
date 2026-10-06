/** @file Synthetic allocation contract, never a runtime enterprise record. */
import {
  budgetTextKeys,
  parseCopilotBudgets,
} from '../../src/assistant/api/copilotBudgetClient';
/** Creates an isolated current-period administration projection. */
export function allocationFixture() {
  return {
    contractVersion: 1,
    context: {
      tenantCode: 'tenant',
      enterpriseCode: 'enterprise',
      principalCode: 'employee',
    },
    period: {
      key: '2026-10',
      timezone: 'Asia/Dubai',
      startsAt: '2026-09-30T20:00:00Z',
      resetsAt: '2026-10-31T20:00:00Z',
    },
    policyDigest: 'a'.repeat(64),
    revision: 'initial',
    permissions: { enterprise: true, users: true },
    enterprise: { limit: 100000, ceiling: 200000, consumed: 4000, reserved: 600 },
    users: [
      {
        principalCode: 'employee',
        limit: 50000,
        ceiling: 100000,
        consumed: 4000,
        reserved: 600,
      },
    ],
    changes: [],
    hasMoreChanges: false,
    presentation: {
      ...Object.fromEntries(budgetTextKeys.map((key) => [key, key])),
      title: 'Token allocations',
      back: 'Back to usage',
      refresh: 'Refresh allocations',
      periodOnly:
        'Changes apply only to this period. Configured defaults return at the next reset.',
      enterprise: 'Enterprise',
      employee: 'Employee',
      limit: 'Token limit',
      ceiling: 'Maximum allowed',
      consumed: 'Consumed',
      reserved: 'Reserved',
      edit: 'Edit allocation',
      reason: 'Reason',
      preview: 'Review change',
      confirm: 'Confirm allocation',
      cancel: 'Cancel',
      review: 'Review allocation',
      before: 'Current limit',
      after: 'New limit',
      committed: 'Already committed',
      belowCommitted: 'Usage exceeds the new limit. Further calls will be blocked.',
      saveUnknown:
        'The outcome is uncertain. Refresh allocations before another change.',
      previewFailed: 'Review unavailable. Refresh allocations and try again.',
      history: 'Allocation history',
      actor: 'Changed by',
      noChanges: 'No changes this period',
      historyLimited: 'Latest 50 changes',
      noUsers: 'No employees assigned',
    },
  };
}
/** Returns a validated synthetic view model. */
export function allocationViewFixture() {
  return parseCopilotBudgets(allocationFixture());
}
