/** @file Validates metadata-only administrative activity; never retains transcript or arbitrary response fields. */
import { assistantRecord } from './assistantContractParsers';
import { parseTranscriptInspection } from './copilotTranscriptClient';
import { parseRecordedSearchCapability } from './copilotRecordedSearchClient';
import { parseLifecycleCapability } from './copilotLifecycleClient';
import { parseAuditRetentionCapability } from './copilotAuditRetentionClient';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';

export const activityTextKeys = [
  'updatedFrom',
  'updatedTo',
  'title',
  'principal',
  'search',
  'refresh',
  'empty',
  'conversation',
  'employee',
  'state',
  'updated',
  'previous',
  'next',
  'page',
  'metadataOnly',
] as const;

export interface ActivityFilters {
  readonly conversationCode?: string;
  readonly state?: string;
  readonly updatedFrom?: string;
  readonly updatedTo?: string;
}

/** Requires bounded inert text for metadata and configurable labels. */
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 500)
    throw new Error('Invalid Copilot activity text');
  return value;
}

/** Parses fixed-size activity windows and explicit non-transcript scope. */
export function parseCopilotActivity(value: unknown) {
  const data = assistantRecord(value, 'Copilot activity');
  const context = assistantRecord(data.context, 'Activity context');
  const copy = assistantRecord(data.presentation, 'Activity presentation');
  if (
    data.contractVersion !== 1 ||
    data.transcriptAccess !== false ||
    data.limit !== 25 ||
    !Number.isSafeInteger(data.page) ||
    Number(data.page) < 1 ||
    Number(data.page) > 1000 ||
    typeof data.mayHaveMore !== 'boolean' ||
    !Array.isArray(data.items) ||
    data.items.length > 25
  )
    throw new Error('Invalid Copilot activity contract');
  return {
    ...(data.auditRetention == null
      ? {}
      : { auditRetention: parseAuditRetentionCapability(data.auditRetention)! }),
    contentSearch: parseRecordedSearchCapability(data.contentSearch),
    lifecycle: parseLifecycleCapability(data.lifecycle),
    inspection: parseTranscriptInspection(data.inspection),
    page: Number(data.page),
    mayHaveMore: data.mayHaveMore,
    context: {
      tenantCode: text(context.tenantCode),
      enterpriseCode: text(context.enterpriseCode),
    },
    presentation: Object.fromEntries(
      activityTextKeys.map((key) => [key, text(copy[key])]),
    ) as Record<(typeof activityTextKeys)[number], string>,
    items: data.items.map((value) => {
      const item = assistantRecord(value, 'Activity record');
      const updatedAt = text(item.updatedAt);
      if (!Number.isFinite(Date.parse(updatedAt)))
        throw new Error('Invalid activity timestamp');
      return {
        conversationCode: text(item.conversationCode),
        principalCode: text(item.principalCode),
        state: text(item.state),
        updatedAt,
      };
    }),
  };
}
export type CopilotActivity = ReturnType<typeof parseCopilotActivity>;

/** Reads current enterprise metadata only; context mismatch fails before rendering. */
export function createCopilotActivityClient(
  configuration: AssistantTransportConfiguration,
  fetcher: typeof fetch = fetch,
) {
  const transport = createAssistantTransport(configuration, fetcher);
  return {
    list: async (
      page: number,
      principalCode: string,
      signal?: AbortSignal,
      filters: ActivityFilters = {},
    ) => {
      const result = parseCopilotActivity(
        await transport.request('/activity', {
          query: {
            page,
            principalCode: principalCode || undefined,
            conversationCode: filters.conversationCode || undefined,
            state: filters.state || undefined,
            updatedFrom: filters.updatedFrom || undefined,
            updatedTo: filters.updatedTo || undefined,
          },
          signal,
        }),
      );
      if (
        result.context.enterpriseCode !== configuration.enterpriseCode ||
        result.page !== page ||
        result.items.some(
          (item) =>
            (principalCode && item.principalCode !== principalCode) ||
            (filters.conversationCode &&
              item.conversationCode !== filters.conversationCode) ||
            (filters.state && item.state !== filters.state) ||
            (filters.updatedFrom &&
              Date.parse(item.updatedAt) < Date.parse(filters.updatedFrom)) ||
            (filters.updatedTo &&
              Date.parse(item.updatedAt) > Date.parse(filters.updatedTo)),
        )
      )
        throw new Error('Copilot activity context mismatch');
      return result;
    },
  };
}
