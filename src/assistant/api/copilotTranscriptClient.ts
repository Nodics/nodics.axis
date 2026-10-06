/** @file Validates separately audited transcript commands; never accepts tool payloads or executable presentation. */
import { assistantRecord } from './assistantContractParsers';
import {
  assistantPathSegment,
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';

const textKeys = [
  'title',
  'open',
  'purpose',
  'inspect',
  'close',
  'previous',
  'next',
  'page',
  'unrecorded',
  'empty',
  'audit',
  'user',
  'assistant',
  'failure',
] as const;
/** Validates bounded inert owner text. */
function text(value: unknown, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum)
    throw new Error('Invalid transcript text');
  return value;
}
/** Parses optional, explicitly authorized inspection capability. Absence never grants access. */
export function parseTranscriptInspection(value: unknown) {
  if (value === undefined || value === null) return null;
  const data = assistantRecord(value, 'Transcript inspection');
  const copy = assistantRecord(data.presentation, 'Transcript presentation');
  if (
    !Array.isArray(data.purposes) ||
    !data.purposes.length ||
    data.purposes.length > 20
  )
    throw new Error('Invalid inspection purposes');
  const purposes = data.purposes.map((value) => {
    const row = assistantRecord(value, 'Inspection purpose');
    const code = text(row.code, 64);
    if (!/^[A-Z][A-Z0-9_]*$/.test(code)) throw new Error('Invalid inspection purpose');
    return { code, label: text(row.label) };
  });
  if (new Set(purposes.map((value) => value.code)).size !== purposes.length)
    throw new Error('Duplicate inspection purpose');
  return {
    purposes,
    presentation: Object.fromEntries(
      textKeys.map((key) => [key, text(copy[key])]),
    ) as Record<(typeof textKeys)[number], string>,
  };
}
export type TranscriptInspection = NonNullable<
  ReturnType<typeof parseTranscriptInspection>
>;

/** Parses bounded plain text only, keeping no extra backend fields. */
export function parseTranscript(value: unknown) {
  const data = assistantRecord(value, 'Transcript');
  const context = assistantRecord(data.context, 'Transcript context');
  if (
    data.contractVersion !== 1 ||
    data.limit !== 25 ||
    !Number.isSafeInteger(data.page) ||
    Number(data.page) < 1 ||
    Number(data.page) > 1000 ||
    typeof data.mayHaveMore !== 'boolean' ||
    !Array.isArray(data.items) ||
    data.items.length > 25
  )
    throw new Error('Invalid transcript page');
  let count = 0;
  const items = data.items.map((value) => {
    const row = assistantRecord(value, 'Transcript turn');
    if (
      typeof row.recorded !== 'boolean' ||
      !Array.isArray(row.messages) ||
      (!row.recorded && row.messages.length)
    )
      throw new Error('Invalid recorded turn');
    return {
      turnCode: text(row.turnCode, 128),
      recorded: row.recorded,
      messages: row.messages.map((value) => {
        const message = assistantRecord(value, 'Transcript message');
        if (
          ++count > 100 ||
          !['user', 'assistant'].includes(String(message.role)) ||
          typeof message.content !== 'string' ||
          !Number.isSafeInteger(message.sequence) ||
          Number(message.sequence) < 0
        )
          throw new Error('Invalid transcript message');
        return {
          role: message.role as 'user' | 'assistant',
          content: message.content,
          sequence: Number(message.sequence),
        };
      }),
    };
  });
  if (
    new TextEncoder().encode(JSON.stringify(items)).length > 262144 ||
    new Set(items.map((row) => row.turnCode)).size !== items.length
  )
    throw new Error('Invalid transcript bounds');
  return {
    context: {
      tenantCode: text(context.tenantCode, 128),
      enterpriseCode: text(context.enterpriseCode, 128),
    },
    conversationCode: text(data.conversationCode, 128),
    principalCode: text(data.principalCode, 128),
    page: Number(data.page),
    mayHaveMore: data.mayHaveMore,
    accessReceipt: text(data.accessReceipt, 128),
    items,
  };
}
export type CopilotTranscript = ReturnType<typeof parseTranscript>;

/** Sends one explicit audited POST; no automatic retry or history reconstruction. */
export async function inspectTranscript(
  configuration: AssistantTransportConfiguration,
  conversationCode: string,
  purpose: string,
  page: number,
  signal: AbortSignal,
) {
  const data = parseTranscript(
    await createAssistantTransport(configuration).request(
      `/activity/${assistantPathSegment(conversationCode, 'Conversation')}/transcript`,
      { method: 'POST', body: { purpose, page }, signal },
    ),
  );
  if (
    data.context.enterpriseCode !== configuration.enterpriseCode ||
    data.conversationCode !== conversationCode ||
    data.page !== page
  )
    throw new Error('Transcript scope mismatch');
  return data;
}
