/** @file Strict bounded sensitive search transport; no query strings, persistent content cache or automatic replay. */
import { assistantRecord } from './assistantContractParsers';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';

const copyKeys = [
  'title',
  'term',
  'from',
  'to',
  'purpose',
  'search',
  'close',
  'empty',
  'coverage',
  'failure',
  'audit',
  'previous',
  'next',
  'page',
] as const;
/** Requires bounded plain text. */
function text(value: unknown, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum)
    throw new Error('Invalid recorded search text');
  return value;
}
/** Parses optional backend search admission and presentation. */
export function parseRecordedSearchCapability(value: unknown) {
  if (value === undefined || value === null) return null;
  const data = assistantRecord(value, 'Recorded search');
  const copy = assistantRecord(data.presentation, 'Recorded search presentation');
  if (
    !Number.isSafeInteger(data.maximumWindowDays) ||
    Number(data.maximumWindowDays) < 1 ||
    Number(data.maximumWindowDays) > 90 ||
    !Number.isSafeInteger(data.minimumTermLength) ||
    Number(data.minimumTermLength) < 3 ||
    Number(data.minimumTermLength) > 128
  )
    throw new Error('Invalid search bounds');
  return {
    maximumWindowDays: Number(data.maximumWindowDays),
    minimumTermLength: Number(data.minimumTermLength),
    presentation: Object.fromEntries(
      copyKeys.map((key) => [key, text(copy[key])]),
    ) as Record<(typeof copyKeys)[number], string>,
  };
}
export type RecordedSearchCapability = NonNullable<
  ReturnType<typeof parseRecordedSearchCapability>
>;
export interface RecordedSearchCommand {
  term: string;
  from: string;
  to: string;
  purpose: string;
  page: number;
}

/** Rechecks enterprise, window, literal match and unique bounded hits before displaying excerpts. */
export function parseRecordedSearch(
  value: unknown,
  enterpriseCode: string,
  command: RecordedSearchCommand,
) {
  const data = assistantRecord(value, 'Recorded search page');
  const context = assistantRecord(data.context, 'Recorded search context');
  if (
    data.contractVersion !== 1 ||
    data.limit !== 25 ||
    data.page !== command.page ||
    data.from !== command.from ||
    data.to !== command.to ||
    context.enterpriseCode !== enterpriseCode ||
    data.matching !== 'CASE_SENSITIVE_LITERAL' ||
    data.coverage !== 'ENTERPRISE_BOUND_RECORDED_MESSAGES_ONLY' ||
    typeof data.mayHaveMore !== 'boolean' ||
    !Array.isArray(data.items) ||
    data.items.length > 25
  )
    throw new Error('Recorded search mismatch');
  const items = data.items.map((value) => {
    const row = assistantRecord(value, 'Recorded search hit');
    const createdAt = text(row.createdAt, 32);
    const excerpt = text(row.excerpt, 320);
    if (
      !Number.isFinite(Date.parse(createdAt)) ||
      Date.parse(createdAt) < Date.parse(command.from) ||
      Date.parse(createdAt) > Date.parse(command.to) ||
      !excerpt.includes(command.term) ||
      !['user', 'assistant'].includes(String(row.role))
    )
      throw new Error('Invalid recorded hit');
    return {
      messageCode: text(row.messageCode, 128),
      conversationCode: text(row.conversationCode, 128),
      principalCode: text(row.principalCode, 128),
      role: row.role as 'user' | 'assistant',
      createdAt,
      excerpt,
    };
  });
  if (new Set(items.map((item) => item.messageCode)).size !== items.length)
    throw new Error('Duplicate recorded hits');
  return {
    page: command.page,
    mayHaveMore: data.mayHaveMore,
    accessReceipt: text(data.accessReceipt, 128),
    items,
  };
}
export type RecordedSearchResult = ReturnType<typeof parseRecordedSearch>;
/** Executes one explicit, audited POST without persisting search text in URLs. */
export async function searchRecordedContent(
  configuration: AssistantTransportConfiguration,
  command: RecordedSearchCommand,
  signal: AbortSignal,
) {
  if (!navigator.onLine) throw new Error('Offline');
  return parseRecordedSearch(
    await createAssistantTransport(configuration).request('/activity/search', {
      method: 'POST',
      body: { ...command },
      signal,
    }),
    configuration.enterpriseCode,
    command,
  );
}
