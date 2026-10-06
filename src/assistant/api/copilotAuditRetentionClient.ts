/** @file Independent audit-retention contract and no-retry transport. */
import { assistantRecord } from './assistantContractParsers';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';
export const auditRetentionTextKeys = [
  'title',
  'kind',
  'TRANSCRIPT_ACCESS',
  'ACTION',
  'reason',
  'review',
  'confirm',
  'execute',
  'inspect',
  'stop',
  'release',
  'operationCode',
  'PREPARED',
  'COMPLETED',
  'STOPPED',
  'OUTCOME_UNKNOWN',
  'failed',
  'count',
  'cutoff',
  'reference',
] as const;
export type AuditKind = 'TRANSCRIPT_ACCESS' | 'ACTION';
/** Requires complete owner-defined copy and only declared audit categories. */
export function parseAuditRetentionCapability(value: unknown) {
  if (value == null) return undefined;
  const row = assistantRecord(value, 'Audit retention');
  const copy = assistantRecord(row.presentation, 'Audit retention copy');
  if (
    typeof row.canDelete !== 'boolean' ||
    !Array.isArray(row.kinds) ||
    row.kinds.length > 2 ||
    new Set(row.kinds).size !== row.kinds.length ||
    row.kinds.some((kind) => !['TRANSCRIPT_ACCESS', 'ACTION'].includes(String(kind)))
  )
    throw new Error('Invalid audit retention capability');
  const presentation = Object.fromEntries(
    auditRetentionTextKeys.map((key) => {
      const value = copy[key];
      if (typeof value !== 'string' || !value.trim() || value.length > 500)
        throw new Error('Invalid audit retention copy');
      return [key, value];
    }),
  ) as Record<(typeof auditRetentionTextKeys)[number], string>;
  return { canDelete: row.canDelete, kinds: row.kinds as AuditKind[], presentation };
}
export type AuditRetentionCapability = NonNullable<
  ReturnType<typeof parseAuditRetentionCapability>
>;
export interface AuditRetentionReceipt {
  readonly operationCode: string;
  readonly state: 'REVIEWED' | 'PREPARED' | 'COMPLETED' | 'STOPPED' | 'OUTCOME_UNKNOWN';
  readonly kind?: AuditKind;
  readonly cutoff?: string;
  readonly count?: number;
  readonly removed?: number;
  readonly reviewDigest?: string;
}
/** Validates a scoped original receipt, rejecting a contradictory completion count. */
export function parseAuditRetentionReceipt(
  value: unknown,
  enterpriseCode: string,
  operationCode?: string,
): AuditRetentionReceipt {
  const row = assistantRecord(value, 'Audit retention receipt');
  const context = assistantRecord(row.context, 'Audit retention scope');
  if (
    row.error ||
    row.success === false ||
    row.acknowledged === false ||
    (row.errors !== undefined && (!Array.isArray(row.errors) || row.errors.length))
  )
    throw new Error('Contradictory audit acknowledgement');
  if (
    row.contractVersion !== 1 ||
    context.enterpriseCode !== enterpriseCode ||
    typeof row.operationCode !== 'string' ||
    !/^audit-retention-[a-f0-9-]{36}$/.test(row.operationCode) ||
    (operationCode && row.operationCode !== operationCode) ||
    !['REVIEWED', 'PREPARED', 'COMPLETED', 'STOPPED', 'OUTCOME_UNKNOWN'].includes(
      String(row.state),
    )
  )
    throw new Error('Invalid audit retention receipt');
  if (row.state === 'OUTCOME_UNKNOWN')
    return { operationCode: row.operationCode, state: 'OUTCOME_UNKNOWN' };
  if (
    !['TRANSCRIPT_ACCESS', 'ACTION'].includes(String(row.kind)) ||
    typeof row.cutoff !== 'string' ||
    !Number.isFinite(Date.parse(row.cutoff)) ||
    new Date(row.cutoff).toISOString() !== row.cutoff ||
    typeof row.reviewDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(row.reviewDigest) ||
    !Number.isSafeInteger(row.count) ||
    Number(row.count) < 0 ||
    Number(row.count) > 100 ||
    row.removed !== (row.state === 'COMPLETED' ? row.count : 0)
  )
    throw new Error('Invalid audit retention evidence');
  return {
    operationCode: row.operationCode,
    state: row.state as AuditRetentionReceipt['state'],
    kind: row.kind as AuditKind,
    cutoff: row.cutoff,
    count: Number(row.count),
    removed: Number(row.removed),
    reviewDigest: row.reviewDigest,
  };
}
/** Calls one fixed owner route once; offline deletion never queues. */
export function auditRetentionCommand(
  configuration: AssistantTransportConfiguration,
  operation: 'preview' | 'execute' | 'inspect' | 'stop',
  body: Record<string, unknown>,
  signal: AbortSignal,
) {
  if (typeof navigator !== 'undefined' && !navigator.onLine)
    return Promise.reject(new Error('Offline audit retention unavailable'));
  return createAssistantTransport(configuration).request(
    `/activity/audit-retention/${operation}`,
    { method: 'POST', body, signal },
  );
}
