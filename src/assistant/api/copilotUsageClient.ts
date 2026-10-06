/** @file Strictly scoped read-only accounting dashboard transport. */
import { assistantRecord } from './assistantContractParsers';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';

export interface CopilotUsageQuery {
  readonly scope: 'PERSONAL' | 'ENTERPRISE';
  readonly principalCode: string;
  readonly model: string;
  readonly purpose: string;
  readonly periodOffset?: number;
  readonly page?: number;
  readonly calls?: 'ALL' | 'UNRESOLVED';
}
/** Validates bounded inert text. */
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 500)
    throw new Error('Invalid usage text');
  return value;
}
/** Rejects coercion and unknown counts; unknown is represented separately. */
function count(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new Error('Invalid usage amount');
  return Number(value);
}
/** Validates a usable timestamp. */
function date(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw new Error('Invalid usage date');
  return result;
}
export const usageTextKeys = [
  'history',
  'currentPeriod',
  'previousPeriod',
  'comparison',
  'comparisonNotice',
  'noRecordedUsage',
  'noComparison',
  'queue',
  'allCalls',
  'previousPage',
  'nextPage',
  'evidenceAvailable',
  'evidenceMissing',
  'evidenceDisabled',
  'daily',
  'breakdown',
  'details',
  'close',
  'adapter',
  'profile',
  'callId',
  'period',
  'completed',
  'evidence',
  'noEvidence',
  'reconcile',
  'reason',
  'review',
  'confirm',
  'cancel',
  'reviewNotice',
  'uncertain',
  'reviewFailed',
  'refreshCall',
  'reconciled',
  'noBreakdown',
  'allocations',
  'measured',
  'inProgress',
  'reconciliation',
  'conversationPurpose',
  'indexingPurpose',
  'evaluationPurpose',
  'retryPurpose',
  'planningPurpose',
  'title',
  'personal',
  'enterprise',
  'refresh',
  'consumed',
  'reserved',
  'pending',
  'calls',
  'principal',
  'model',
  'purpose',
  'all',
  'apply',
  'recent',
  'state',
  'created',
  'empty',
  'limited',
  'unavailable',
  'reset',
] as const;
/** Parses no raw prompt, response, secret or configuration fields. */
export function parseCopilotUsage(value: unknown) {
  const root = assistantRecord(value, 'Copilot usage');
  if (
    root.contractVersion !== 1 ||
    !['PERSONAL', 'ENTERPRISE'].includes(String(root.scope)) ||
    !['AVAILABLE', 'UNAVAILABLE'].includes(String(root.state)) ||
    typeof root.canViewEnterprise !== 'boolean' ||
    typeof root.hasMore !== 'boolean' ||
    !Array.isArray(root.items) ||
    root.items.length > 100 ||
    (root.scope === 'ENTERPRISE' && !root.canViewEnterprise)
  )
    throw new Error('Invalid usage contract');
  const context = assistantRecord(root.context, 'Usage context');
  if (
    root.state !== 'AVAILABLE' &&
    (root.history !== undefined ||
      root.pagination !== undefined ||
      root.queue !== undefined)
  )
    throw new Error('Unavailable history cannot contain usage metadata');
  const copy = assistantRecord(root.presentation, 'Usage presentation');
  const totals =
    root.state === 'AVAILABLE' ? assistantRecord(root.totals, 'Usage totals') : null;
  const period =
    root.state === 'AVAILABLE' ? assistantRecord(root.period, 'Usage period') : null;
  if (
    !totals &&
    (root.totals !== null || root.period !== null || root.items.length || root.hasMore)
  )
    throw new Error('Invalid unavailable usage');
  const timezone = period ? text(period.timezone) : null;
  if (timezone) new Intl.DateTimeFormat(undefined, { timeZone: timezone });
  const items = root.items.map((value) => {
    const item = assistantRecord(value, 'Usage call');
    if (!['MEASURED', 'PENDING', 'RESERVED'].includes(String(item.state)))
      throw new Error('Invalid accounting state');
    const consumed = item.state === 'MEASURED' ? count(item.consumed) : null;
    if (item.state === 'MEASURED' && item.reserved !== 0)
      throw new Error('Measured usage cannot retain a reservation');
    if (consumed === null && item.consumed !== null)
      throw new Error('Unmeasured consumption is unknown');
    return {
      callId: text(item.callId),
      principalCode: text(item.principalCode),
      model: text(item.model),
      purpose: text(item.purpose),
      state: String(item.state),
      consumed,
      reserved: count(item.reserved),
      createdAt: date(item.createdAt),
    };
  });
  const principalCode = text(context.principalCode);
  if (new Set(items.map((item) => item.callId)).size !== items.length)
    throw new Error('Duplicate usage call');
  const history = root.history === undefined ? null : parseUsageHistory(root.history);
  const paging =
    root.pagination === undefined
      ? null
      : assistantRecord(root.pagination, 'Usage pagination');
  const pagination = paging
    ? {
        page: count(paging.page),
        pageSize: count(paging.pageSize),
        calls: text(paging.calls),
      }
    : null;
  if (
    pagination &&
    (!['ALL', 'UNRESOLVED'].includes(pagination.calls) ||
      pagination.pageSize !== (pagination.calls === 'UNRESOLVED' ? 25 : 100) ||
      pagination.page * pagination.pageSize >= 5000 ||
      items.length > pagination.pageSize ||
      (pagination.calls === 'UNRESOLVED' &&
        items.some((item) => item.state === 'MEASURED')))
  )
    throw new Error('Invalid usage pagination');
  if (
    history &&
    (!period ||
      history.periods[history.offset]!.key !== period.key ||
      history.periods[history.offset]!.startsAt !== period.startsAt ||
      history.periods[history.offset]!.resetsAt !== period.resetsAt ||
      history.periods[history.offset]!.timezone !== period.timezone ||
      history.recorded !== count(totals?.calls) > 0)
  )
    throw new Error('Invalid selected history');
  if (
    root.queue !== undefined &&
    (!Array.isArray(root.queue) || root.queue.length > 25)
  )
    throw new Error('Invalid recovery queue');
  const queue = ((root.queue || []) as unknown[]).map((value) => {
    const row = assistantRecord(value, 'Recovery queue');
    if (!['AVAILABLE', 'MISSING', 'DISABLED'].includes(String(row.evidence)))
      throw new Error('Invalid recovery evidence');
    return { callId: text(row.callId), evidence: String(row.evidence) };
  });
  if (queue.length && (!pagination || pagination.calls !== 'UNRESOLVED'))
    throw new Error('Unexpected recovery queue');
  if (
    pagination?.calls === 'UNRESOLVED' &&
    (queue.length !== items.length ||
      queue.some((row, index) => row.callId !== items[index]?.callId))
  )
    throw new Error('Mismatched recovery queue');
  const insights =
    root.insights === undefined ? null : parseUsageInsights(root.insights);
  if (insights) {
    if (
      !totals ||
      (root.scope === 'PERSONAL' &&
        insights.breakdowns.principalCode.items.some(
          (row) => row.value !== principalCode,
        ))
    )
      throw new Error('Invalid scoped insights');
    for (const key of ['consumed', 'reserved', 'pending', 'calls'] as const) {
      const sum = insights.daily.reduce((value, row) => value + row[key], 0);
      if (!Number.isSafeInteger(sum) || sum !== count(totals[key]))
        throw new Error('Inconsistent daily totals');
    }
  }
  if (
    root.scope === 'PERSONAL' &&
    items.some((item) => item.principalCode !== principalCode)
  )
    throw new Error('Foreign personal usage');
  return {
    scope: root.scope as 'PERSONAL' | 'ENTERPRISE',
    state: String(root.state),
    canViewEnterprise: root.canViewEnterprise,
    hasMore: root.hasMore,
    context: {
      enterpriseCode: text(context.enterpriseCode),
      tenantCode: text(context.tenantCode),
      principalCode,
    },
    presentation: Object.fromEntries(
      usageTextKeys.map((key) => [key, text(copy[key])]),
    ) as Record<(typeof usageTextKeys)[number], string>,
    totals: totals
      ? {
          consumed: count(totals.consumed),
          reserved: count(totals.reserved),
          pending: count(totals.pending),
          calls: count(totals.calls),
        }
      : null,
    period: period
      ? {
          key: period.key === undefined ? null : text(period.key),
          timezone: timezone!,
          startsAt: date(period.startsAt),
          resetsAt: date(period.resetsAt),
        }
      : null,
    items,
    insights,
    history,
    pagination,
    queue,
    observedAt: date(root.observedAt),
  };
}

/** Validates owner-selected calendar periods and absence of historical measurements. */
export function parseUsageHistory(value: unknown) {
  const root = assistantRecord(value, 'Usage history');
  const period = (value: unknown) => {
    const row = assistantRecord(value, 'History period');
    const timezone = text(row.timezone);
    new Intl.DateTimeFormat(undefined, { timeZone: timezone });
    const result = {
      key: text(row.key),
      timezone,
      startsAt: date(row.startsAt),
      resetsAt: date(row.resetsAt),
    };
    if (Date.parse(result.startsAt) >= Date.parse(result.resetsAt))
      throw new Error('Invalid period range');
    return result;
  };
  if (
    !Array.isArray(root.periods) ||
    !root.periods.length ||
    root.periods.length > 24 ||
    typeof root.recorded !== 'boolean'
  )
    throw new Error('Invalid history window');
  const periods = root.periods.map(period),
    offset = count(root.offset);
  if (
    offset >= periods.length ||
    new Set(periods.map((row) => row.key)).size !== periods.length ||
    periods.some(
      (row, index) =>
        index > 0 &&
        (row.timezone !== periods[0]!.timezone ||
          row.resetsAt !== periods[index - 1]!.startsAt),
    )
  )
    throw new Error('Invalid history selection');
  const prior = assistantRecord(root.previous, 'Previous usage');
  const previousPeriod = period(prior.period);
  if (
    previousPeriod.resetsAt !== periods[offset]!.startsAt ||
    previousPeriod.timezone !== periods[offset]!.timezone
  )
    throw new Error('Invalid comparison period');
  const raw =
    prior.totals === null ? null : assistantRecord(prior.totals, 'Previous totals');
  const totals = raw
    ? {
        consumed: count(raw.consumed),
        reserved: count(raw.reserved),
        pending: count(raw.pending),
        calls: count(raw.calls),
      }
    : null;
  if (totals && (totals.pending > totals.reserved || totals.calls === 0))
    throw new Error('Invalid comparison totals');
  return {
    offset,
    recorded: root.recorded,
    periods,
    previous: { period: previousPeriod, totals },
  };
}

/** Validates bounded owner-produced analytics, never recomputing balances from a truncated call list. */
export function parseUsageInsights(value: unknown) {
  const root = assistantRecord(value, 'Usage insights');
  const breakdowns = assistantRecord(root.breakdowns, 'Usage breakdowns');
  const totals = (value: unknown) => {
    const row = assistantRecord(value, 'Usage totals');
    const result = {
      consumed: count(row.consumed),
      reserved: count(row.reserved),
      pending: count(row.pending),
      calls: count(row.calls),
    };
    if (result.pending > result.reserved) throw new Error('Invalid pending count');
    return result;
  };
  if (!Array.isArray(root.daily) || root.daily.length > 31)
    throw new Error('Invalid daily usage');
  const daily = root.daily.map((value) => {
    const row = assistantRecord(value, 'Daily usage'),
      day = text(row.day);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(Date.parse(day)) ||
      new Date(day).toISOString().slice(0, 10) !== day
    )
      throw new Error('Invalid usage day');
    return { day, ...totals(row) };
  });
  if (new Set(daily.map((row) => row.day)).size !== daily.length)
    throw new Error('Duplicate day');
  const parseGroup = (value: unknown) => {
    const group = assistantRecord(value, 'Usage group');
    if (
      !Array.isArray(group.items) ||
      group.items.length > 20 ||
      typeof group.hasMore !== 'boolean'
    )
      throw new Error('Invalid usage breakdown');
    const items = group.items.map((value) => {
      const row = assistantRecord(value, 'Breakdown row');
      return { value: text(row.value), ...totals(row) };
    });
    if (new Set(items.map((row) => row.value)).size !== items.length)
      throw new Error('Duplicate breakdown');
    return { items, hasMore: group.hasMore };
  };
  return {
    daily,
    breakdowns: {
      principalCode: parseGroup(breakdowns.principalCode),
      model: parseGroup(breakdowns.model),
      purpose: parseGroup(breakdowns.purpose),
    },
  };
}
export type CopilotUsage = ReturnType<typeof parseCopilotUsage>;
/** Reads one authorized view and rejects scope/filter mismatches before display. */
export function createCopilotUsageClient(
  configuration: AssistantTransportConfiguration,
  fetchImplementation: typeof fetch = fetch,
) {
  const transport = createAssistantTransport(configuration, fetchImplementation);
  return {
    get: async (query: CopilotUsageQuery, signal?: AbortSignal) => {
      const result = parseCopilotUsage(
        await transport.request('/usage', {
          signal,
          query: {
            scope: query.scope,
            principalCode: query.principalCode || undefined,
            model: query.model || undefined,
            purpose: query.purpose || undefined,
            periodOffset:
              query.periodOffset === undefined ? undefined : String(query.periodOffset),
            page: query.page === undefined ? undefined : String(query.page),
            calls: query.calls,
          },
        }),
      );
      if (
        result.context.enterpriseCode !== configuration.enterpriseCode ||
        result.scope !== query.scope ||
        (result.state === 'AVAILABLE' &&
          ((query.periodOffset ?? 0) !== (result.history?.offset ?? 0) ||
            (query.page ?? 0) !== (result.pagination?.page ?? 0) ||
            (query.calls ?? 'ALL') !== (result.pagination?.calls ?? 'ALL'))) ||
        (result.insights &&
          (['principalCode', 'model', 'purpose'] as const).some(
            (key) =>
              query[key] &&
              result.insights!.breakdowns[key].items.some(
                (row) => row.value !== query[key],
              ),
          )) ||
        result.items.some(
          (item) =>
            (query.principalCode && item.principalCode !== query.principalCode) ||
            (query.model && item.model !== query.model) ||
            (query.purpose && item.purpose !== query.purpose),
        )
      )
        throw new Error('Usage context mismatch');
      return result;
    },
  };
}
