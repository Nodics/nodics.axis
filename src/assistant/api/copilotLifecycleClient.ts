/** @file Typed non-destructive retention inspection; never exposes a delete command. */
import { assistantRecord } from './assistantContractParsers';
import { parseRetentionCapability } from './copilotRetentionClient';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';

export const lifecycleStates = [
  'HELD',
  'ACTIVE',
  'UNKNOWN',
  'EXPIRED_REVIEW_REQUIRED',
  'WITHIN_RETENTION',
  'PURGING',
  'PURGED',
  'RETENTION_STOPPED',
] as const;
export const lifecycleTextKeys = [
  'title',
  'inspect',
  'close',
  'previous',
  'next',
  'empty',
  'failure',
  'cutoff',
  'notice',
  ...lifecycleStates,
] as const;

/** Validates the optional owner-advertised presentation without deriving access locally. */
export function parseLifecycleCapability(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const copy = assistantRecord(
    assistantRecord(value, 'Retention').presentation,
    'Retention copy',
  );
  const presentation = Object.fromEntries(
    lifecycleTextKeys.map((key) => {
      if (typeof copy[key] !== 'string' || !copy[key].trim() || copy[key].length > 500)
        throw new Error('Invalid retention copy');
      return [key, copy[key]];
    }),
  ) as Record<(typeof lifecycleTextKeys)[number], string>;
  return {
    ...presentation,
    execution: parseRetentionCapability(assistantRecord(value, 'Retention').execution),
  };
}

/** Rejects foreign pages, destructive contracts and unbounded metadata; discards extra properties. */
export function parseLifecyclePreview(
  value: unknown,
  enterpriseCode: string,
  page: number,
) {
  const data = assistantRecord(value, 'Retention preview');
  const context = assistantRecord(data.context, 'Retention scope');
  const policy = assistantRecord(data.policy, 'Retention policy');
  if (
    data.contractVersion !== 1 ||
    context.enterpriseCode !== enterpriseCode ||
    data.page !== page ||
    data.limit !== 25 ||
    typeof data.mayHaveMore !== 'boolean' ||
    policy.destructiveExecution !== false ||
    typeof data.cutoff !== 'string' ||
    !Number.isFinite(Date.parse(data.cutoff)) ||
    !Array.isArray(data.items) ||
    data.items.length > 25
  )
    throw new Error('Invalid retention preview');
  const items = data.items.map((value) => {
    const row = assistantRecord(value, 'Retention item');
    if (
      typeof row.code !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(row.code) ||
      !lifecycleStates.includes(row.state as (typeof lifecycleStates)[number]) ||
      (row.canClose !== undefined && typeof row.canClose !== 'boolean') ||
      (row.updatedAt !== null &&
        (typeof row.updatedAt !== 'string' ||
          !Number.isFinite(Date.parse(row.updatedAt))))
    )
      throw new Error('Invalid retention item');
    return {
      code: row.code,
      canClose: row.canClose === true,
      state: row.state as (typeof lifecycleStates)[number],
      updatedAt: row.updatedAt,
    };
  });
  if (new Set(items.map((item) => item.code)).size !== items.length)
    throw new Error('Duplicate retention item');
  return { page, cutoff: data.cutoff, mayHaveMore: data.mayHaveMore, items };
}

/** Reads one explicit metadata page without carrying transcript data or a delete endpoint. */
export async function getLifecyclePreview(
  configuration: AssistantTransportConfiguration,
  page: number,
  signal?: AbortSignal,
) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000)
    throw new Error('Invalid retention page');
  return parseLifecyclePreview(
    await createAssistantTransport(configuration).request('/activity/retention', {
      query: { page },
      signal,
    }),
    configuration.enterpriseCode,
    page,
  );
}
