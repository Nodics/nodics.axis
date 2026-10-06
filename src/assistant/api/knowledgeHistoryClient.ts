/** @file Strict Process-backed Knowledge history projection; no raw context or replay commands enter the browser. */
import { assistantRecord } from './assistantContractParsers';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';

const copyKeys = [
  'title',
  'load',
  'refresh',
  'empty',
  'unavailable',
  'definition',
  'version',
  'instance',
  'started',
  'completed',
  'currentPolicy',
  'previousPolicy',
  'previous',
  'next',
  'ready',
  'claimed',
  'done',
  'failed',
  'inspection',
  'recovery',
  'evidence',
] as const;
/** Validates non-executable backend-owned history copy. */
export function parseKnowledgeHistoryCopy(value: unknown) {
  const input = assistantRecord(value, 'History presentation');
  return Object.fromEntries(
    copyKeys.map((key) => {
      if (
        typeof input[key] !== 'string' ||
        !input[key].trim() ||
        input[key].length > 1000
      )
        throw new Error('Invalid history presentation');
      return [key, input[key]];
    }),
  ) as Record<(typeof copyKeys)[number], string>;
}
export type KnowledgeHistoryCopy = ReturnType<typeof parseKnowledgeHistoryCopy>;
/** Requires bounded persisted identifiers, never executable paths. */
function code(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(value))
    throw new Error('Invalid execution identity');
  return value;
}
/** Accepts owner timestamps without manufacturing missing evidence. */
function date(value: unknown): string | null {
  if (value === null) return null;
  if (
    typeof value !== 'string' ||
    value.length > 64 ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error('Invalid execution date');
  return value;
}
const statuses = [
  'READY',
  'CLAIMED',
  'COMPLETED',
  'FAILED',
  'INSPECTION_REQUIRED',
] as const;
/** Drops all undeclared fields and binds every history page to its requested source. */
export function parseKnowledgeHistory(
  value: unknown,
  sourceCode: string,
  page: number,
) {
  const input = assistantRecord(value, 'Knowledge history');
  if (
    input.contractVersion !== 2 ||
    input.evidence !== 'PROCESS_ACTION_ATTEMPTS' ||
    input.sourceCode !== sourceCode ||
    input.page !== page ||
    input.limit !== 25 ||
    typeof input.hasMore !== 'boolean' ||
    !Number.isSafeInteger(input.definitionVersion) ||
    Number(input.definitionVersion) < 1 ||
    !Array.isArray(input.items) ||
    input.items.length > 25
  )
    throw new Error('Invalid knowledge history');
  const seen = new Set<string>();
  return {
    sourceCode,
    page,
    hasMore: input.hasMore,
    definitionCode: code(input.definitionCode),
    definitionVersion: Number(input.definitionVersion),
    observedAt: date(input.observedAt),
    items: input.items.map((value) => {
      const item = assistantRecord(value, 'Refresh execution');
      const executionCode = code(item.executionCode);
      const startedAt = date(item.startedAt);
      const completedAt = date(item.completedAt);
      if (
        !statuses.includes(item.status as (typeof statuses)[number]) ||
        typeof item.currentPolicy !== 'boolean' ||
        !['NONE', 'PROCESS_INSPECTION'].includes(String(item.recovery)) ||
        !Number.isSafeInteger(item.definitionVersion) ||
        Number(item.definitionVersion) < 1 ||
        seen.has(executionCode) ||
        !startedAt ||
        (['COMPLETED', 'FAILED'].includes(String(item.status)) && !completedAt) ||
        (completedAt !== null && Date.parse(completedAt) < Date.parse(startedAt)) ||
        (['FAILED', 'INSPECTION_REQUIRED'].includes(String(item.status)) &&
          item.recovery !== 'PROCESS_INSPECTION')
      )
        throw new Error('Invalid execution state');
      seen.add(executionCode);
      return {
        instanceCode: code(item.instanceCode),
        executionCode,
        definitionVersion: Number(item.definitionVersion),
        status: item.status as (typeof statuses)[number],
        currentPolicy: item.currentPolicy,
        recovery: item.recovery === 'PROCESS_INSPECTION',
        startedAt,
        completedAt,
      };
    }),
  };
}
export type KnowledgeHistory = ReturnType<typeof parseKnowledgeHistory>;
/** Reads one bounded page once; history loading never invokes refresh or recovery. */
export function createKnowledgeHistoryClient(
  configuration: AssistantTransportConfiguration,
  fetcher: typeof fetch = fetch,
) {
  const transport = createAssistantTransport(configuration, fetcher);
  return {
    load: async (sourceCode: string, page: number, signal?: AbortSignal) => {
      code(sourceCode);
      if (!Number.isSafeInteger(page) || page < 1 || page > 1000)
        throw new Error('Invalid history page');
      return parseKnowledgeHistory(
        await transport.request(
          `/knowledge/sources/${encodeURIComponent(sourceCode)}/history?page=${page}`,
          { signal },
        ),
        sourceCode,
        page,
      );
    },
  };
}
