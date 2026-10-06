/** @file Bounded read-only maintenance receipts, bound to the selected source and enterprise without command replay. */
import { assistantRecord } from './assistantContractParsers';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';
import type { KnowledgeSource } from './knowledgeStudioClient';

export const maintenanceStages = [
  'CLEANUP_AUTHORIZED',
  'CLEANUP_COMPLETED',
  'WRITER_RETIREMENT_AUTHORIZED',
  'WRITER_RETIREMENT_COMPLETED',
] as const;
const copyKeys = [
  'title',
  'load',
  'refresh',
  'empty',
  'unavailable',
  'evidence',
  'operation',
  'actor',
  'revision',
  'previous',
  'next',
  ...maintenanceStages,
] as const;
/** Accepts inert owner-authored labels, not client-authored capability semantics. */
export function parseKnowledgeMaintenanceCopy(value: unknown) {
  const input = assistantRecord(value, 'Maintenance presentation');
  return Object.fromEntries(
    copyKeys.map((key) => {
      const text = input[key];
      if (typeof text !== 'string' || !text.trim() || text.length > 2000)
        throw new Error('Invalid maintenance presentation');
      return [key, text];
    }),
  ) as Record<(typeof copyKeys)[number], string>;
}
export interface KnowledgeMaintenanceHistory {
  readonly page: number;
  readonly mayHaveMore: boolean;
  readonly items: ReadonlyArray<{
    readonly code: string;
    readonly operationCode: string;
    readonly principalCode: string;
    readonly revision: number;
    readonly stage: (typeof maintenanceStages)[number];
    readonly occurredAt: string;
  }>;
}
/** Rejects foreign, malformed and ambiguous receipt windows before rendering. */
export function parseKnowledgeMaintenance(
  value: unknown,
  source: KnowledgeSource,
  enterprise: string,
  page: number,
): KnowledgeMaintenanceHistory {
  const input = assistantRecord(value, 'Maintenance receipts');
  const context = assistantRecord(input.context, 'Maintenance scope');
  if (
    input.contractVersion !== 1 ||
    input.evidence !== 'MAINTENANCE_RECEIPTS' ||
    input.sourceCode !== source.code ||
    input.sourcePolicyDigest !== source.sourcePolicyDigest ||
    context.enterpriseCode !== enterprise ||
    typeof context.tenantCode !== 'string' ||
    !context.tenantCode.trim() ||
    context.tenantCode.length > 128 ||
    input.page !== page ||
    input.limit !== 25 ||
    typeof input.mayHaveMore !== 'boolean' ||
    !Array.isArray(input.items) ||
    input.items.length > 25 ||
    input.mayHaveMore !== (input.items.length === 25)
  )
    throw new Error('Invalid maintenance receipts');
  const items = input.items.map((value) => {
    const row = assistantRecord(value, 'Maintenance receipt');
    if (
      typeof row.code !== 'string' ||
      !/^ckm-[a-f0-9-]{36}$/.test(row.code) ||
      typeof row.operationCode !== 'string' ||
      !/^(cleanup|retire)-[a-f0-9-]{36}$/.test(row.operationCode) ||
      typeof row.principalCode !== 'string' ||
      !row.principalCode.trim() ||
      row.principalCode.length > 192 ||
      !Number.isSafeInteger(row.revision) ||
      Number(row.revision) < 0 ||
      !maintenanceStages.includes(row.stage as (typeof maintenanceStages)[number]) ||
      String(row.stage).startsWith('CLEANUP_') !==
        row.operationCode.startsWith('cleanup-') ||
      typeof row.occurredAt !== 'string' ||
      !Number.isFinite(Date.parse(row.occurredAt)) ||
      new Date(row.occurredAt).toISOString() !== row.occurredAt
    )
      throw new Error('Invalid maintenance receipt');
    return {
      code: row.code,
      operationCode: row.operationCode,
      principalCode: row.principalCode,
      revision: Number(row.revision),
      stage: row.stage as (typeof maintenanceStages)[number],
      occurredAt: row.occurredAt,
    };
  });
  if (new Set(items.map((item) => item.code)).size !== items.length)
    throw new Error('Duplicate maintenance receipt');
  return { page, mayHaveMore: input.mayHaveMore, items };
}
/** Reads one explicit bounded page; exposes no cleanup, retirement, retry or index operation. */
export function createKnowledgeMaintenanceClient(
  configuration: AssistantTransportConfiguration,
  fetcher: typeof fetch = fetch,
) {
  const transport = createAssistantTransport(configuration, fetcher);
  return {
    load: async (source: KnowledgeSource, page: number, signal?: AbortSignal) => {
      if (
        !source.canInspectMaintenance ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(source.code) ||
        !/^[a-f0-9]{64}$/.test(source.sourcePolicyDigest || '') ||
        !Number.isSafeInteger(page) ||
        page < 1 ||
        page > 1000 ||
        !navigator.onLine
      )
        throw new Error('Maintenance unavailable');
      return parseKnowledgeMaintenance(
        await transport.request(
          `/knowledge/sources/${encodeURIComponent(source.code)}/maintenance?page=${page}`,
          { signal },
        ),
        source,
        configuration.enterpriseCode,
        page,
      );
    },
  };
}
