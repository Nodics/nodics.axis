/** @file Strict call inspection and evidence-backed reconciliation transport; the browser cannot submit token measurements. */
import { assistantRecord } from './assistantContractParsers';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';
import { usageTextKeys } from './copilotUsageClient';
/** Requires bounded inert text. */
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 500)
    throw new Error('Invalid call text');
  return value;
}
/** Requires measured safe integer amounts. */
function count(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new Error('Invalid call count');
  return Number(value);
}
/** Validates an evidence digest. */
function digest(value: unknown): string {
  const result = text(value);
  if (!/^[a-f0-9]{64}$/.test(result)) throw new Error('Invalid evidence digest');
  return result;
}
/** Validates a displayable timestamp. */
function date(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw new Error('Invalid call date');
  return result;
}
/** Parses only explicit safe metadata, counters and audit. */
export function parseUsageCall(value: unknown) {
  const root = assistantRecord(value, 'Call detail'),
    context = assistantRecord(root.context, 'Call context'),
    item = assistantRecord(root.item, 'Call'),
    copy = assistantRecord(root.presentation, 'Call presentation');
  if (
    root.contractVersion !== 1 ||
    typeof root.canReconcile !== 'boolean' ||
    !['MEASURED', 'PENDING', 'RESERVED'].includes(String(item.state))
  )
    throw new Error('Invalid call detail');
  const evidence =
    root.evidence === null ? null : assistantRecord(root.evidence, 'Receipt');
  const audit =
    root.reconciliation === null
      ? null
      : assistantRecord(root.reconciliation, 'Reconciliation audit');
  const consumed = item.state === 'MEASURED' ? count(item.consumed) : null,
    reserved = count(item.reserved);
  if (
    (consumed === null && item.consumed !== null) ||
    (item.state === 'MEASURED' && reserved !== 0) ||
    (root.canReconcile && (!evidence || item.state === 'MEASURED'))
  )
    throw new Error('Invalid call accounting');
  const reconciliation = audit
    ? {
        changeId: text(audit.changeId),
        actor: text(audit.actor),
        reason: text(audit.reason),
        evidenceDigest: digest(audit.evidenceDigest),
        measured: count(audit.measured),
        createdAt: date(audit.createdAt),
      }
    : null;
  if (
    reconciliation &&
    (item.state !== 'MEASURED' || reconciliation.measured !== consumed)
  )
    throw new Error('Invalid reconciled measurement');
  return {
    context: {
      tenantCode: text(context.tenantCode),
      enterpriseCode: text(context.enterpriseCode),
      principalCode: text(context.principalCode),
    },
    periodKey: text(root.periodKey),
    item: {
      callId: text(item.callId),
      principalCode: text(item.principalCode),
      adapter: text(item.adapter),
      profile: text(item.profile),
      model: text(item.model),
      purpose: text(item.purpose),
      state: String(item.state),
      consumed,
      reserved,
      createdAt: date(item.createdAt),
      completedAt: item.completedAt === null ? null : date(item.completedAt),
    },
    evidence: evidence
      ? {
          digest: digest(evidence.digest),
          totalTokens: count(evidence.totalTokens),
          measuredAt: date(evidence.measuredAt),
        }
      : null,
    canReconcile: root.canReconcile,
    reconciliation,
    presentation: Object.fromEntries(
      usageTextKeys.map((key) => [key, text(copy[key])]),
    ) as Record<(typeof usageTextKeys)[number], string>,
  };
}
export type UsageCall = ReturnType<typeof parseUsageCall>;
export interface ReconciliationCommand {
  readonly periodKey: string;
  readonly callId: string;
  readonly evidenceDigest: string;
  readonly changeId: string;
  readonly reason: string;
}
export interface ReconciliationPreview {
  readonly command: ReconciliationCommand;
  readonly reserved: number;
  readonly measured: number;
}
/** Binds every response to the requested call and enterprise, with no fallback or retry writes. */
export function createReconciliationClient(
  configuration: AssistantTransportConfiguration,
  fetchImplementation: typeof fetch = fetch,
) {
  const transport = createAssistantTransport(configuration, fetchImplementation);
  const scoped = (value: unknown, periodKey: string, callId: string) => {
    const result = parseUsageCall(value);
    if (
      result.context.enterpriseCode !== configuration.enterpriseCode ||
      result.periodKey !== periodKey ||
      result.item.callId !== callId
    )
      throw new Error('Call context mismatch');
    return result;
  };
  return {
    get: async (periodKey: string, callId: string, signal?: AbortSignal) =>
      scoped(
        await transport.request('/usage/call', {
          query: { periodKey, callId },
          signal,
        }),
        periodKey,
        callId,
      ),
    preview: async (command: ReconciliationCommand): Promise<ReconciliationPreview> => {
      const root = assistantRecord(
        await transport.request('/usage/reconciliation/preview', {
          method: 'POST',
          body: { ...command },
        }),
        'Reconciliation preview',
      );
      const context = assistantRecord(root.context, 'Preview context'),
        returned = assistantRecord(root.command, 'Preview command');
      if (
        root.contractVersion !== 1 ||
        context.enterpriseCode !== configuration.enterpriseCode ||
        Object.keys(returned).length !== Object.keys(command).length ||
        Object.keys(command).some(
          (key) => returned[key] !== command[key as keyof ReconciliationCommand],
        )
      )
        throw new Error('Reconciliation preview mismatch');
      return {
        command,
        reserved: count(root.reserved),
        measured: count(root.measured),
      };
    },
    reconcile: async (command: ReconciliationCommand) => {
      const result = scoped(
        await transport.request('/usage/reconciliation', {
          method: 'POST',
          body: { ...command, confirmed: true },
          idempotencyKey: command.changeId,
        }),
        command.periodKey,
        command.callId,
      );
      const audit = result.reconciliation;
      if (
        !audit ||
        audit.changeId !== command.changeId ||
        audit.reason !== command.reason ||
        audit.evidenceDigest !== command.evidenceDigest ||
        audit.actor !== result.context.principalCode
      )
        throw new Error('Reconciliation acknowledgement mismatch');
      return result;
    },
  };
}
