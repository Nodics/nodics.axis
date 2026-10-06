/** @file Explicit bounded retention commands with original-operation recovery and strict scoped receipts. */
import { assistantRecord } from './assistantContractParsers';
import {
  assistantPathSegment,
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';

export const retentionStates = [
  'PREPARED',
  'RESUMING',
  'PURGING',
  'PURGED',
  'STOPPED',
] as const;
export const retentionTextKeys = [
  'open',
  'title',
  'reason',
  'review',
  'reviewResume',
  'resume',
  'reviewClosure',
  'closeConversation',
  'inspectClosure',
  'closureNotice',
  'closureRecorded',
  'inspect',
  'begin',
  'advance',
  'stop',
  'confirm',
  'notice',
  'failure',
  'digest',
  'batch',
  'removed',
  ...retentionStates,
] as const;

/** Accepts only an explicit independently admitted owner capability. */
export function parseRetentionCapability(value: unknown) {
  if (value == null) return undefined;
  const data = assistantRecord(value, 'Retention capability');
  const copy = assistantRecord(data.presentation, 'Retention presentation');
  if (typeof data.canDelete !== 'boolean')
    throw new Error('Invalid retention authority');
  const presentation = Object.fromEntries(
    retentionTextKeys.map((key) => {
      if (typeof copy[key] !== 'string' || !copy[key].trim() || copy[key].length > 500)
        throw new Error('Invalid retention copy');
      return [key, copy[key]];
    }),
  ) as Record<(typeof retentionTextKeys)[number], string>;
  return { canDelete: data.canDelete, presentation };
}

/** Rejects foreign responses before any status or count becomes displayable. */
function scoped(value: unknown, enterpriseCode: string, conversationCode: string) {
  const data = assistantRecord(value, 'Retention response');
  const context = assistantRecord(data.context, 'Retention context');
  if (
    data.contractVersion !== 1 ||
    context.enterpriseCode !== enterpriseCode ||
    data.conversationCode !== conversationCode
  )
    throw new Error('Retention scope mismatch');
  return data;
}

/** Validates an inert review bound to the current parent and policy revision. */
export function parseRetentionReview(
  value: unknown,
  enterpriseCode: string,
  conversationCode: string,
) {
  const data = scoped(value, enterpriseCode, conversationCode);
  const retained = [
    'CONVERSATION_TOMBSTONE',
    'TRANSCRIPT_ACCESS_AUDIT',
    'ACTION_AUDIT',
    'PROVIDER_ACCOUNTING',
  ];
  if (
    data.state !== 'REVIEWED' ||
    typeof data.reviewDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(data.reviewDigest) ||
    typeof data.policyRevision !== 'string' ||
    !/^[a-f0-9]{64}$/.test(data.policyRevision) ||
    !Number.isSafeInteger(data.maximumBatch) ||
    Number(data.maximumBatch) < 1 ||
    Number(data.maximumBatch) > 100 ||
    JSON.stringify(data.retained) !== JSON.stringify(retained)
  )
    throw new Error('Invalid retention review');
  return { reviewDigest: data.reviewDigest, maximumBatch: Number(data.maximumBatch) };
}

/** Keeps only validated original operation metadata, never private policy or content. */
export function parseRetentionReceipt(
  value: unknown,
  enterpriseCode: string,
  conversationCode: string,
) {
  const data = scoped(value, enterpriseCode, conversationCode);
  const removed = assistantRecord(data.removed, 'Retention counts');
  if (
    typeof data.operationCode !== 'string' ||
    !/^retention-[a-f0-9-]{36}$/.test(data.operationCode) ||
    !Number.isSafeInteger(data.revision) ||
    Number(data.revision) < 1 ||
    !retentionStates.includes(data.state as (typeof retentionStates)[number]) ||
    ['messages', 'events', 'turns'].some(
      (key) => !Number.isSafeInteger(removed[key]) || Number(removed[key]) < 0,
    )
  )
    throw new Error('Invalid retention receipt');
  const terminal = ['PURGED', 'STOPPED'].includes(String(data.state));
  if (
    terminal
      ? typeof data.completedAt !== 'string' ||
        !Number.isFinite(Date.parse(data.completedAt))
      : data.completedAt !== null
  )
    throw new Error('Invalid retention completion');
  return {
    operationCode: data.operationCode,
    revision: Number(data.revision),
    state: data.state as (typeof retentionStates)[number],
    removed: {
      messages: Number(removed.messages),
      events: Number(removed.events),
      turns: Number(removed.turns),
    },
  };
}
export type RetentionReceipt = ReturnType<typeof parseRetentionReceipt>;

/** Accepts only an explicitly non-destructive closure review. */
export function parseClosureReview(
  value: unknown,
  enterpriseCode: string,
  conversationCode: string,
) {
  const data = scoped(value, enterpriseCode, conversationCode);
  if (
    data.state !== 'REVIEWED' ||
    data.intent !== 'CLOSE' ||
    typeof data.reviewDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(data.reviewDigest)
  )
    throw new Error('Invalid closure review');
  return { reviewDigest: data.reviewDigest };
}

/** Reads historical closure evidence without interpreting it as cancellation or purge completion. */
export function parseClosureReceipt(
  value: unknown,
  enterpriseCode: string,
  conversationCode: string,
) {
  const data = scoped(value, enterpriseCode, conversationCode);
  if (
    data.state !== 'CLOSURE_RECORDED' ||
    typeof data.operationCode !== 'string' ||
    !/^closure-[a-f0-9-]{36}$/.test(data.operationCode) ||
    typeof data.closedAt !== 'string' ||
    !Number.isFinite(Date.parse(data.closedAt)) ||
    !['CLOSED', 'ARCHIVED', 'PURGING', 'PURGED', 'RETENTION_STOPPED'].includes(
      String(data.conversationState),
    )
  )
    throw new Error('Invalid closure receipt');
  return { operationCode: data.operationCode, closedAt: data.closedAt };
}

/** Sends one fixed command with no retry, arbitrary route, durable browser state or offline queue. */
export async function retentionCommand(
  configuration: AssistantTransportConfiguration,
  conversationCode: string,
  command:
    | 'preview'
    | 'begin'
    | 'inspect'
    | 'advance'
    | 'stop'
    | 'resume-preview'
    | 'resume'
    | 'close-preview'
    | 'close'
    | 'close-inspect',
  body: Readonly<Record<string, unknown>>,
  signal: AbortSignal,
) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    throw new Error('Offline retention unavailable');
  return createAssistantTransport(configuration).request(
    `/activity/${assistantPathSegment(conversationCode, 'Conversation')}/retention/${command}`,
    { method: 'POST', body, signal },
  );
}
