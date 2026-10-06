/** @file Synthetic usage analytics and recovery evidence, not live accounting. */
import { usageFixture } from './governanceFixture';
/** Provides bounded trends and breakdowns for renderer verification. */
export function usageInsightsFixture() {
  const base = usageFixture(),
    totals = base.totals;
  return {
    ...base,
    period: { ...base.period, key: 'MONTH:Asia/Dubai:2026-10-01' },
    items: base.items.map((item, index) =>
      index === 0 ? { ...item, createdAt: '2026-10-02T11:00:00Z' } : item,
    ),
    insights: {
      daily: [
        { day: '2026-10-02', consumed: 4000, reserved: 0, pending: 0, calls: 1 },
        { day: '2026-10-03', consumed: 0, reserved: 600, pending: 600, calls: 1 },
      ],
      breakdowns: {
        principalCode: { hasMore: false, items: [{ value: 'employee', ...totals }] },
        model: { hasMore: false, items: [{ value: 'qwen2.5-coder:7b', ...totals }] },
        purpose: { hasMore: false, items: [{ value: 'CONVERSATION', ...totals }] },
      },
    },
  };
}
/** Provides a pending call with measured evidence requiring separate confirmation. */
export function usageCallFixture() {
  const base = usageInsightsFixture();
  return {
    contractVersion: 1,
    context: base.context,
    presentation: base.presentation,
    periodKey: base.period.key,
    item: {
      ...base.items[1],
      adapter: 'ollama',
      profile: 'conversation',
      completedAt: null,
    },
    evidence: {
      digest: 'a'.repeat(64),
      totalTokens: 420,
      measuredAt: '2026-10-03T12:00:01Z',
    },
    canReconcile: true,
    reconciliation: null,
  };
}

/** Supplies two calendar windows and independently measured comparison totals. */
export function usageHistoryFixture() {
  const base = usageInsightsFixture();
  const previous = {
    key: 'MONTH:Asia/Dubai:2026-09-01',
    timezone: 'Asia/Dubai',
    startsAt: '2026-08-31T20:00:00Z',
    resetsAt: base.period.startsAt,
  };
  return {
    ...base,
    history: {
      offset: 0,
      recorded: true,
      periods: [base.period, previous],
      previous: {
        period: previous,
        totals: { consumed: 8000, reserved: 0, pending: 0, calls: 4 },
      },
    },
    pagination: { page: 0, pageSize: 100, calls: 'ALL' },
    queue: [],
  };
}
