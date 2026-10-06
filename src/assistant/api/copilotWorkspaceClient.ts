/** @file Validated read-only projection client for the copilotApi Workspace owner. */
import { assistantRecord } from './assistantContractParsers';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';

/** Validates bounded inert text. */
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 500)
    throw new Error('Invalid Copilot workspace text');
  return value;
}
/** Preserves explicitly absent metadata. */
function nullable(value: unknown): string | null {
  return value === null ? null : text(value);
}
/** Rejects invalid timestamps before rendering localized dates. */
function timestamp(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result)))
    throw new Error('Invalid Copilot workspace timestamp');
  return result;
}
/** Validates a bounded projection array. */
function rows(value: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new Error('Invalid Copilot workspace window');
  return value.map((item) => assistantRecord(item, 'Copilot workspace row'));
}
/** Rejects coercible flags. */
function flag(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Invalid Copilot workspace flag');
  return value;
}

export const workspaceTextKeys = [
  'title',
  'subtitle',
  'newConversation',
  'details',
  'refresh',
  'conversations',
  'tasks',
  'knowledge',
  'provider',
  'budget',
  'recording',
  'emptyConversations',
  'emptyTasks',
  'untitled',
  'search',
  'limitedWindow',
  'configured',
  'notConfigured',
  'unavailable',
  'healthNotChecked',
  'recorded',
  'retentionUnknown',
  'sourceUnavailable',
  'sourceRestricted',
  'sourceDisabled',
  'noSources',
  'tenant',
  'enterprise',
  'noEnterprise',
  'personal',
  'stateCompleted',
  'stateFailed',
  'stateRunning',
  'stateCancelled',
  'sourceReady',
  'sourcePending',
  'sourceFailed',
  'resume',
  'stateUnknown',
] as const;

/** Parses only declared display metadata; never retains raw configuration or prompt bodies. */
export function parseCopilotWorkspace(value: unknown) {
  const root = assistantRecord(value, 'Copilot workspace');
  if (root.contractVersion !== 1 || root.scope !== 'PERSONAL')
    throw new Error('Unsupported Copilot workspace contract');
  const context = assistantRecord(root.context, 'Copilot context');
  const copy = assistantRecord(root.presentation, 'Copilot presentation');
  const presentation = Object.fromEntries(
    workspaceTextKeys.map((key) => [key, text(copy[key])]),
  ) as Record<(typeof workspaceTextKeys)[number], string>;
  const activity = assistantRecord(root.activity, 'Copilot activity');
  if (
    !Number.isSafeInteger(activity.limit) ||
    Number(activity.limit) < 1 ||
    Number(activity.limit) > 100
  )
    throw new Error('Invalid Copilot activity limit');
  const knowledge = assistantRecord(root.knowledge, 'Copilot knowledge');
  if (
    !['AVAILABLE', 'DISABLED', 'NOT_AUTHORIZED', 'UNAVAILABLE'].includes(
      String(knowledge.state),
    )
  )
    throw new Error('Invalid Copilot knowledge state');
  const provider = assistantRecord(root.provider, 'Copilot provider');
  if (
    !['CONFIGURED', 'NOT_CONFIGURED'].includes(String(provider.state)) ||
    provider.health !== 'NOT_CHECKED'
  )
    throw new Error('Unsupported provider status');
  const budget = assistantRecord(root.budget, 'Copilot budget');
  const measuredBudget = ['AVAILABLE', 'EXHAUSTED'].includes(String(budget.state));
  if (!measuredBudget && !['UNAVAILABLE', 'UNASSIGNED'].includes(String(budget.state)))
    throw new Error('Unsupported budget contract');
  for (const key of ['allowance', 'consumed', 'reserved', 'available']) {
    if (
      measuredBudget
        ? !Number.isSafeInteger(budget[key]) || Number(budget[key]) < 0
        : budget[key] !== null
    )
      throw new Error('Invalid budget amount');
  }
  const budgetDetail = measuredBudget
    ? (() => {
        const period = assistantRecord(budget.period, 'Copilot budget period');
        new Intl.DateTimeFormat(undefined, { timeZone: text(period.timezone) });
        if (
          !Number.isSafeInteger(budget.pending) ||
          Number(budget.pending) < 0 ||
          Number(budget.pending) > Number(budget.reserved) ||
          !Number.isInteger(budget.warningPercentage) ||
          Number(budget.warningPercentage) < 0 ||
          Number(budget.warningPercentage) > 100 ||
          Number(budget.available) >
            Math.max(
              0,
              Number(budget.allowance) -
                Number(budget.consumed) -
                Number(budget.reserved),
            ) ||
          (budget.state === 'EXHAUSTED') !== (budget.available === 0)
        )
          throw new Error('Invalid budget reconciliation');
        const keys = [
          'budgetAssigned',
          'budgetConsumed',
          'budgetReserved',
          'budgetAvailable',
          'budgetPending',
          'budgetReset',
          'budgetExhausted',
          'budgetWarning',
        ] as const;
        return {
          allowance: Number(budget.allowance),
          consumed: Number(budget.consumed),
          reserved: Number(budget.reserved),
          available: Number(budget.available),
          pending: Number(budget.pending),
          warningPercentage: Number(budget.warningPercentage),
          timezone: text(period.timezone),
          resetsAt: timestamp(period.resetsAt),
          labels: Object.fromEntries(
            keys.map((key) => [key, text(copy[key])]),
          ) as Record<(typeof keys)[number], string>,
        };
      })()
    : null;
  const recording = assistantRecord(root.recording, 'Copilot recording');
  if (
    !['ENABLED', 'DISABLED'].includes(String(recording.state)) ||
    recording.retentionDays !== null
  )
    throw new Error('Unsupported recording contract');
  const actions = assistantRecord(root.actions, 'Copilot actions');
  const attention =
    root.attention === undefined
      ? undefined
      : (() => {
          const raw = assistantRecord(root.attention, 'Copilot attention');
          const labels = {
            BUDGET_EXHAUSTED: 'attentionBudgetExhausted',
            BUDGET_WARNING: 'attentionBudgetWarning',
            BUDGET_RECONCILIATION: 'attentionBudgetReconciliation',
            PROVIDER_UNAVAILABLE: 'attentionProviderUnavailable',
            KNOWLEDGE_ATTENTION: 'attentionKnowledge',
            OUTCOME_UNKNOWN: 'attentionOutcomeUnknown',
            TASK_RUNNING: 'attentionTaskRunning',
            APPROVAL_PENDING: 'attentionApproval',
            TASKS_UNAVAILABLE: 'attentionTasksUnavailable',
          } as const;
          const items = rows(raw.items).map((item) => {
            const kind = text(item.kind);
            if (!Object.hasOwn(labels, kind)) throw new Error('Invalid attention kind');
            return {
              kind,
              label: text(copy[labels[kind as keyof typeof labels]]),
              conversationCode:
                item.conversationCode === undefined
                  ? undefined
                  : text(item.conversationCode),
            };
          });
          return {
            items,
            hasMore: flag(raw.hasMore),
            title: text(copy.attention),
            empty: text(copy.attentionEmpty),
          };
        })();
  const rawOperations =
    root.operations === undefined
      ? undefined
      : assistantRecord(root.operations, 'Copilot operations');
  const operations =
    rawOperations === undefined
      ? undefined
      : (() => {
          if (!['AVAILABLE', 'UNAVAILABLE'].includes(String(rawOperations.state)))
            throw new Error('Invalid operations state');
          return {
            state: String(rawOperations.state),
            hasMore: flag(rawOperations.hasMore),
            title: text(copy.operations),
            empty: text(copy.operationEmpty),
            approval: text(copy.operationApproval),
            labels: {
              IMPLEMENTED: text(copy.operationImplemented),
              ADAPTER_REQUIRED: text(copy.operationAdapterRequired),
              FUTURE: text(copy.operationFuture),
            },
            items: rows(rawOperations.items).map((item) => {
              const maturity = text(item.maturity);
              if (!['IMPLEMENTED', 'ADAPTER_REQUIRED', 'FUTURE'].includes(maturity))
                throw new Error('Invalid operation maturity');
              return {
                code: text(item.code),
                owner: text(item.owner),
                riskClass: text(item.riskClass),
                mutates: flag(item.mutates),
                maturity: maturity as 'IMPLEMENTED' | 'ADAPTER_REQUIRED' | 'FUTURE',
              };
            }),
          };
        })();
  const conversations = rows(activity.conversations).map((row) => ({
    conversationCode: text(row.conversationCode),
    title: nullable(row.title),
    state: text(row.state),
    updatedAt: timestamp(row.updatedAt),
  }));
  const turns = rows(activity.turns).map((row) => ({
    turnCode: text(row.turnCode),
    conversationCode: text(row.conversationCode),
    state: text(row.state),
    acceptedAt: timestamp(row.acceptedAt),
    completedAt: row.completedAt === null ? null : timestamp(row.completedAt),
  }));
  if (
    conversations.length > Number(activity.limit) ||
    turns.length > Number(activity.limit)
  )
    throw new Error('Copilot activity exceeds its limit');
  return {
    observedAt: timestamp(root.observedAt),
    recordingNotice:
      recording.notice === undefined && recording.state === 'ENABLED'
        ? text(copy.recorded)
        : text(recording.notice),
    budget: {
      state: String(budget.state),
      detail: budgetDetail,
      unassigned: budget.state === 'UNASSIGNED' ? text(copy.budgetUnassigned) : null,
    },
    operations,
    attention,
    presentation,
    context: {
      tenantCode: text(context.tenantCode),
      enterpriseCode: nullable(context.enterpriseCode),
      principalCode: text(context.principalCode),
    },
    activity: {
      conversations,
      turns,
      limit: Number(activity.limit),
      hasMoreConversations: flag(activity.hasMoreConversations),
      hasMoreTurns: flag(activity.hasMoreTurns),
    },
    knowledge: {
      state: String(knowledge.state),
      hasMore: flag(knowledge.hasMore),
      sources: rows(knowledge.sources).map((row) => ({
        code: text(row.code),
        state: text(row.state),
        version: text(row.version),
        refreshedAt: row.refreshedAt === null ? null : timestamp(row.refreshedAt),
      })),
    },
    provider: {
      state: String(provider.state),
      model: nullable(provider.model),
      checkLabel:
        provider.checkLabel === undefined ? null : nullable(provider.checkLabel),
    },
    canStartConversation: flag(actions.canStartConversation),
  };
}

export type CopilotWorkspace = ReturnType<typeof parseCopilotWorkspace>;

/** Creates a single GET-only client; page loads never invoke models or mutate configuration. */
export function createCopilotWorkspaceClient(
  configuration: AssistantTransportConfiguration,
  fetchImplementation: typeof fetch = fetch,
) {
  const transport = createAssistantTransport(configuration, fetchImplementation);
  return {
    get: async (signal?: AbortSignal) => {
      const snapshot = parseCopilotWorkspace(
        await transport.request('/workspace', { signal }),
      );
      if (snapshot.context.enterpriseCode !== configuration.enterpriseCode)
        throw new Error('Copilot workspace context mismatch');
      return snapshot;
    },
  };
}
