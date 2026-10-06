/** @file Inert, revision-bound live collection transport; domain APIs retain all record authorization. */
import { assistantRecord } from './assistantContractParsers';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';
import type { KnowledgeSource } from './knowledgeStudioClient';

export interface CopilotCollection {
  readonly schemaName: string;
  readonly label: string;
  readonly selected: boolean;
}
export interface CopilotCollectionResult {
  readonly records: readonly Readonly<
    Record<string, string | number | boolean | null>
  >[];
  readonly page: number;
  readonly mayHaveMore: boolean;
  readonly observedAt: string;
}

/** Binds each live response to the selected source policy, not a stale browser entitlement. */
export type CopilotCollectionSource = Pick<
  KnowledgeSource,
  'code' | 'sourceType' | 'sourcePolicyDigest' | 'enabled' | 'canQuery'
>;
function bound(value: unknown, source: CopilotCollectionSource) {
  const result = assistantRecord(value, 'Live collections');
  if (
    result.contractVersion !== 1 ||
    result.sourceCode !== source.code ||
    result.sourcePolicyDigest !== source.sourcePolicyDigest
  )
    throw new Error('Collection source changed');
  return result;
}

/** Uses one canonical request per explicit action, with no mutation retries or offline queue. */
export function createCopilotCollectionsClient(
  configuration: AssistantTransportConfiguration,
  fetcher: typeof fetch = fetch,
) {
  const transport = createAssistantTransport(configuration, fetcher);
  /** Rejects non-database or stale sources before attaching credentials. */
  function path(source: CopilotCollectionSource) {
    if (
      !source.enabled ||
      !source.canQuery ||
      source.sourceType !== 'DATABASE' ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(source.code) ||
      !/^[a-f0-9]{64}$/.test(source.sourcePolicyDigest ?? '')
    )
      throw new Error('Collections unavailable');
    return `/knowledge/sources/${encodeURIComponent(source.code)}`;
  }
  return {
    inventory: async (
      source: CopilotCollectionSource,
      signal?: AbortSignal,
    ): Promise<readonly CopilotCollection[]> => {
      const result = bound(
        await transport.request(`${path(source)}/collections`, { signal }),
        source,
      );
      if (!Array.isArray(result.items) || result.items.length > 1000)
        throw new Error('Invalid collections');
      const items = result.items.map((value) => {
        const row = assistantRecord(value, 'Collection');
        if (
          typeof row.schemaName !== 'string' ||
          !/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(row.schemaName) ||
          typeof row.label !== 'string' ||
          !row.label.trim() ||
          row.label.length > 200 ||
          typeof row.selected !== 'boolean'
        )
          throw new Error('Invalid collection');
        return { schemaName: row.schemaName, label: row.label, selected: row.selected };
      });
      if (new Set(items.map((row) => row.schemaName)).size !== items.length)
        throw new Error('Duplicate collection');
      return items;
    },
    query: async (
      source: CopilotCollectionSource,
      schemaName: string,
      search: string,
      page: number,
      signal?: AbortSignal,
    ): Promise<CopilotCollectionResult> => {
      if (
        !navigator.onLine ||
        !/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(schemaName) ||
        !search.trim() ||
        search.length > 100 ||
        !Number.isSafeInteger(page) ||
        page < 1 ||
        page > 1000
      )
        throw new Error('Invalid collection query');
      const result = bound(
        await transport.request(`${path(source)}/query`, {
          method: 'POST',
          body: { schemaName, search, page },
          signal,
        }),
        source,
      );
      if (
        result.schemaName !== schemaName ||
        result.page !== page ||
        !Number.isSafeInteger(result.limit) ||
        Number(result.limit) < 1 ||
        Number(result.limit) > 25 ||
        typeof result.mayHaveMore !== 'boolean' ||
        typeof result.observedAt !== 'string' ||
        !Number.isFinite(Date.parse(result.observedAt)) ||
        !Array.isArray(result.records) ||
        result.records.length > Number(result.limit) ||
        JSON.stringify(result.records).length > 262144
      )
        throw new Error('Invalid collection result');
      const records = result.records.map((value) => {
        const row = assistantRecord(value, 'Record');
        if (
          Object.keys(row).length > 500 ||
          Object.entries(row).some(
            ([key, item]) =>
              key.length > 200 ||
              (!['string', 'number', 'boolean'].includes(typeof item) &&
                item !== null) ||
              (typeof item === 'number' && !Number.isFinite(item)),
          )
        )
          throw new Error('Invalid record fields');
        return row as Record<string, string | number | boolean | null>;
      });
      return {
        records,
        page,
        mayHaveMore: result.mayHaveMore,
        observedAt: result.observedAt,
      };
    },
  };
}
