/** @file Strict budget administration transport; limits, permission and audit remain backend-owned. */
import { assistantRecord } from './assistantContractParsers';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';

export const budgetTextKeys = [
  'title',
  'back',
  'refresh',
  'periodOnly',
  'enterprise',
  'employee',
  'limit',
  'ceiling',
  'consumed',
  'reserved',
  'edit',
  'reason',
  'preview',
  'confirm',
  'cancel',
  'review',
  'before',
  'after',
  'committed',
  'belowCommitted',
  'saveUnknown',
  'previewFailed',
  'history',
  'actor',
  'changed',
  'noChanges',
  'historyLimited',
  'noUsers',
] as const;
/** Validates bounded inert identifiers and text. */
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 500)
    throw new Error('Invalid budget text');
  return value;
}
/** Validates exact nonnegative integer amounts. */
function count(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new Error('Invalid budget amount');
  return Number(value);
}
/** Rejects missing or coercible permission flags. */
function flag(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Invalid budget flag');
  return value;
}
/** Validates timestamps without interpreting them as locale dates. */
function date(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw new Error('Invalid budget date');
  return result;
}
/** Validates the deterministic configuration binding. */
function digest(value: unknown): string {
  const result = text(value);
  if (!/^[a-f0-9]{64}$/.test(result)) throw new Error('Invalid budget digest');
  return result;
}
/** Parses only numerical budget facts and bounded change evidence. */
export function parseCopilotBudgets(value: unknown) {
  const root = assistantRecord(value, 'Budgets'),
    context = assistantRecord(root.context, 'Budget context'),
    period = assistantRecord(root.period, 'Budget period'),
    permissions = assistantRecord(root.permissions, 'Budget permissions'),
    copy = assistantRecord(root.presentation, 'Budget presentation');
  if (
    root.contractVersion !== 1 ||
    !Array.isArray(root.users) ||
    root.users.length > 1000 ||
    !Array.isArray(root.changes) ||
    root.changes.length > 50
  )
    throw new Error('Invalid budgets');
  const amounts = (value: unknown) => {
    const item = assistantRecord(value, 'Allocation');
    return {
      limit: count(item.limit),
      ceiling: count(item.ceiling),
      consumed: count(item.consumed),
      reserved: count(item.reserved),
    };
  };
  const enterprise = amounts(root.enterprise);
  if (enterprise.limit > enterprise.ceiling)
    throw new Error('Invalid enterprise ceiling');
  const users = root.users.map((value) => {
    const item = assistantRecord(value, 'Employee allocation');
    return { ...amounts(item), principalCode: text(item.principalCode) };
  });
  const changes = root.changes.map((value) => {
    const item = assistantRecord(value, 'Allocation change');
    if (
      !['ENTERPRISE', 'USER'].includes(String(item.target)) ||
      (item.target === 'ENTERPRISE' && item.principalCode !== null)
    )
      throw new Error('Invalid allocation target');
    return {
      changeId: text(item.changeId),
      target: item.target as 'ENTERPRISE' | 'USER',
      principalCode: item.target === 'USER' ? text(item.principalCode) : null,
      actor: text(item.actor),
      before: count(item.before),
      after: count(item.after),
      reason: text(item.reason),
      createdAt: date(item.createdAt),
    };
  });
  if (
    new Set(users.map((item) => item.principalCode)).size !== users.length ||
    new Set(changes.map((item) => item.changeId)).size !== changes.length
  )
    throw new Error('Duplicate budget identity');
  const timezone = text(period.timezone),
    startsAt = date(period.startsAt),
    resetsAt = date(period.resetsAt);
  new Intl.DateTimeFormat(undefined, { timeZone: timezone });
  if (Date.parse(startsAt) >= Date.parse(resetsAt))
    throw new Error('Invalid budget period');
  return {
    context: {
      tenantCode: text(context.tenantCode),
      enterpriseCode: text(context.enterpriseCode),
      principalCode: text(context.principalCode),
    },
    period: { key: text(period.key), timezone, startsAt, resetsAt },
    policyDigest: digest(root.policyDigest),
    revision: text(root.revision),
    permissions: {
      enterprise: flag(permissions.enterprise),
      users: flag(permissions.users),
    },
    enterprise,
    users,
    changes,
    hasMoreChanges: flag(root.hasMoreChanges),
    presentation: Object.fromEntries(
      budgetTextKeys.map((key) => [key, text(copy[key])]),
    ) as Record<(typeof budgetTextKeys)[number], string>,
  };
}
export type CopilotBudgets = ReturnType<typeof parseCopilotBudgets>;
export interface BudgetCommand {
  readonly target: 'ENTERPRISE' | 'USER';
  readonly principalCode: string | null;
  readonly limit: number;
  readonly reason: string;
  readonly changeId: string;
  readonly periodKey: string;
  readonly policyDigest: string;
  readonly expectedRevision: string;
}
export interface BudgetPreview {
  readonly command: BudgetCommand;
  readonly impact: {
    readonly before: number;
    readonly after: number;
    readonly committed: number;
    readonly belowCommitted: boolean;
  };
}
/** Requires exact context and command parity; mutations have no retry or fallback transport. */
export function createCopilotBudgetClient(
  configuration: AssistantTransportConfiguration,
  fetchImplementation: typeof fetch = fetch,
) {
  const transport = createAssistantTransport(configuration, fetchImplementation);
  const scoped = (value: unknown) => {
    const result = parseCopilotBudgets(value);
    if (result.context.enterpriseCode !== configuration.enterpriseCode)
      throw new Error('Budget context mismatch');
    return result;
  };
  return {
    get: async (signal?: AbortSignal) =>
      scoped(await transport.request('/budgets', { signal })),
    preview: async (command: BudgetCommand): Promise<BudgetPreview> => {
      const root = assistantRecord(
          await transport.request('/budgets/preview', {
            method: 'POST',
            body: { ...command },
          }),
          'Budget preview',
        ),
        context = assistantRecord(root.context, 'Budget context'),
        returned = assistantRecord(root.command, 'Budget command'),
        impact = assistantRecord(root.impact, 'Budget impact');
      if (
        root.contractVersion !== 1 ||
        context.enterpriseCode !== configuration.enterpriseCode ||
        Object.keys(command).some(
          (key) => returned[key] !== command[key as keyof BudgetCommand],
        ) ||
        Object.keys(returned).length !== Object.keys(command).length
      )
        throw new Error('Budget preview mismatch');
      const parsed = {
        before: count(impact.before),
        after: count(impact.after),
        committed: count(impact.committed),
        belowCommitted: flag(impact.belowCommitted),
      };
      if (
        parsed.after !== command.limit ||
        parsed.belowCommitted !== parsed.after < parsed.committed
      )
        throw new Error('Invalid budget impact');
      return { command, impact: parsed };
    },
    change: async (command: BudgetCommand) => {
      const result = scoped(
        await transport.request('/budgets/allocations', {
          method: 'POST',
          body: { ...command, confirmed: true },
          idempotencyKey: command.changeId,
        }),
      );
      if (
        !result.changes.some(
          (change) =>
            change.changeId === command.changeId &&
            change.target === command.target &&
            change.principalCode === command.principalCode &&
            change.after === command.limit &&
            change.reason === command.reason &&
            change.actor === result.context.principalCode,
        )
      )
        throw new Error('Allocation acknowledgement mismatch');
      return result;
    },
  };
}
