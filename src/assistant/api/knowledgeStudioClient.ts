/** @file Validated inert Knowledge Studio source metadata and read-only preview transport. */
import { assistantRecord } from './assistantContractParsers';
import { parseKnowledgeHistoryCopy } from './knowledgeHistoryClient';
import { parseKnowledgeCleanupCopy } from './knowledgeCleanupClient';
import { parseKnowledgeWriterRecoveryCopy } from './knowledgeWriterRecoveryClient';
import { parseKnowledgeMaintenanceCopy } from './knowledgeMaintenanceClient';
import { parseKnowledgeManualRefreshCopy } from './knowledgeManualRefreshClient';
import { parseKnowledgeMigration } from './knowledgeMigrationClient';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';

export const knowledgeTextKeys = [
  'title',
  'subtitle',
  'search',
  'refresh',
  'preview',
  'empty',
  'source',
  'version',
  'included',
  'excluded',
  'none',
  'enabled',
  'disabled',
  'ready',
  'stale',
  'failed',
  'unknown',
  'prepared',
  'provenance',
  'classification',
  'owner',
  'repository',
  'project',
  'module',
  'extensions',
  'limited',
  'previewFailed',
  'filesRead',
  'filesAccepted',
  'filesRejected',
  'chunksPrepared',
  'previewOnly',
  'indexSource',
  'indexConfirm',
  'indexDone',
  'indexUnknown',
  'secretScan',
  'close',
  'retry',
  'unavailable',
  'collections',
  'loadCollections',
  'collectionSearch',
  'queryRecords',
  'liveData',
  'noRecords',
  'previousPage',
  'nextPage',
  'liveFailed',
  'notSelected',
  'hierarchy',
  'includedCollections',
  'excludedCollections',
] as const;

/** Rejects unbounded or executable payload shapes, preserving inert text only. */
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000)
    throw new Error('Invalid knowledge text');
  return value;
}
/** Requires real flags, not coercible values. */
function flag(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Invalid knowledge flag');
  return value;
}
/** Validates bounded source rule lists. */
function strings(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 1000)
    throw new Error('Invalid knowledge rules');
  return value.map(text);
}
/** Preserves nullable revision/date metadata. */
function nullable(value: unknown): string | null {
  return value === null ? null : text(value);
}
/** Projects bounded acknowledged writes only; never treats progress as publication or exposes writer handles. */
export function parseKnowledgeProgress(value: unknown) {
  if (value === undefined) return undefined;
  const data = assistantRecord(value, 'Knowledge progress');
  if (
    !['IDLE', 'WRITING', 'SEALED'].includes(String(data.phase)) ||
    !Number.isSafeInteger(data.expectedChunks) ||
    Number(data.expectedChunks) < 0 ||
    Number(data.expectedChunks) > 100000 ||
    !Number.isSafeInteger(data.acknowledgedChunks) ||
    Number(data.acknowledgedChunks) < 0 ||
    Number(data.acknowledgedChunks) > Number(data.expectedChunks) ||
    (data.phase === 'SEALED' && data.acknowledgedChunks !== data.expectedChunks)
  )
    throw new Error('Invalid knowledge progress');
  return {
    phase: data.phase as 'IDLE' | 'WRITING' | 'SEALED',
    acknowledgedChunks: Number(data.acknowledgedChunks),
    expectedChunks: Number(data.expectedChunks),
  };
}
/** Parses the backend-owned source window without retaining undeclared fields. */
export function parseKnowledgeInventory(value: unknown) {
  const input = assistantRecord(value, 'Knowledge inventory');
  const context = assistantRecord(input.context, 'Knowledge context');
  const copy = assistantRecord(input.presentation, 'Knowledge presentation');
  if (
    input.contractVersion !== 1 ||
    (input.page !== undefined &&
      (!Number.isSafeInteger(input.page) ||
        Number(input.page) < 1 ||
        Number(input.page) > 1000)) ||
    !Number.isSafeInteger(input.limit) ||
    Number(input.limit) < 1 ||
    Number(input.limit) > 100 ||
    !Array.isArray(input.sources) ||
    input.sources.length > Number(input.limit)
  )
    throw new Error('Invalid knowledge inventory');
  const presentation = {
    ...(Object.fromEntries(
      knowledgeTextKeys.map((key) => [key, text(copy[key])]),
    ) as Record<(typeof knowledgeTextKeys)[number], string>),
    durableEvidence:
      copy.durableEvidence === undefined ? undefined : text(copy.durableEvidence),
    inspectionRequired:
      copy.inspectionRequired === undefined ? undefined : text(copy.inspectionRequired),
    cleanupPending:
      copy.cleanupPending === undefined ? undefined : text(copy.cleanupPending),
    progress: copy.progress === undefined ? undefined : text(copy.progress),
    progressIdle: copy.progressIdle === undefined ? undefined : text(copy.progressIdle),
    progressWriting:
      copy.progressWriting === undefined ? undefined : text(copy.progressWriting),
    progressSealed:
      copy.progressSealed === undefined ? undefined : text(copy.progressSealed),
  };
  const cleanupPresentation =
    input.cleanupPresentation == null
      ? null
      : parseKnowledgeCleanupCopy(input.cleanupPresentation);
  const recoveryPresentation =
    input.recoveryPresentation == null
      ? null
      : parseKnowledgeWriterRecoveryCopy(input.recoveryPresentation);
  const rawGroups =
    input.groups === undefined
      ? undefined
      : assistantRecord(input.groups, 'Knowledge groups');
  const groups =
    rawGroups && flag(rawGroups.enabled)
      ? (() => {
          if (!Array.isArray(rawGroups.items) || rawGroups.items.length > 100)
            throw new Error('Invalid knowledge groups');
          return {
            title: text(copy.groups),
            all: text(copy.allGroups),
            active: text(copy.activeGroup),
            inactive: text(copy.inactiveGroup),
            items: rawGroups.items.map((value) => {
              const group = assistantRecord(value, 'Knowledge group');
              return {
                code: text(group.code),
                name: text(group.name),
                active: flag(group.active),
                sourceCodes: strings(group.sourceCodes),
              };
            }),
          };
        })()
      : undefined;
  return {
    maintenancePresentation:
      input.maintenancePresentation == null
        ? null
        : parseKnowledgeMaintenanceCopy(input.maintenancePresentation),
    cleanupPresentation,
    recoveryPresentation,
    legacyMigration:
      input.legacyMigration == null
        ? null
        : parseKnowledgeMigration(input.legacyMigration),
    context: {
      tenantCode: text(context.tenantCode),
      enterpriseCode: text(context.enterpriseCode),
    },
    presentation,
    sourceSchedules:
      input.sourceSchedules == null
        ? false
        : (() => {
            const declaration = assistantRecord(
              input.sourceSchedules,
              'Source schedules',
            );
            if (declaration.ownerModule !== 'cronjob' || declaration.enabled !== true)
              throw new Error('Invalid source schedule owner');
            return true;
          })(),
    historyPresentation:
      input.historyPresentation == null
        ? undefined
        : parseKnowledgeHistoryCopy(input.historyPresentation),
    manualRefreshPresentation:
      input.manualRefreshPresentation == null
        ? undefined
        : parseKnowledgeManualRefreshCopy(input.manualRefreshPresentation),
    groups,
    page: input.page === undefined ? 1 : Number(input.page),
    hasMore: flag(input.hasMore),
    sources: input.sources.map((value) => {
      const row = assistantRecord(value, 'Knowledge source');
      const status = assistantRecord(row.status, 'Knowledge status');
      const progress = parseKnowledgeProgress(status.progress);
      if (
        progress &&
        (status.evidence !== 'DURABLE_GENERATION' ||
          status.inspectionRequired !== true ||
          !presentation.progress ||
          !presentation.progressIdle ||
          !presentation.progressWriting ||
          !presentation.progressSealed)
      )
        throw new Error('Missing knowledge progress evidence');
      if (
        !['UNKNOWN', 'STALE', 'PROJECTED', 'FAILED'].includes(String(status.state)) ||
        !['PROCESS_LOCAL', 'DURABLE_GENERATION'].includes(String(status.evidence)) ||
        row.secretScanRequired !== true
      )
        throw new Error('Invalid knowledge status');
      const code = text(row.code);
      if (
        status.evidence === 'DURABLE_GENERATION' &&
        (!presentation.durableEvidence ||
          !presentation.inspectionRequired ||
          !presentation.cleanupPending)
      )
        throw new Error('Missing durable status presentation');
      if (
        row.sourcePolicyDigest !== undefined &&
        (typeof row.sourcePolicyDigest !== 'string' ||
          !/^[a-f0-9]{64}$/.test(row.sourcePolicyDigest))
      )
        throw new Error('Invalid source fingerprint');
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(code))
        throw new Error('Invalid knowledge source identity');
      if (
        row.canCleanup === true &&
        (!cleanupPresentation ||
          row.enabled !== true ||
          status.evidence !== 'DURABLE_GENERATION' ||
          status.cleanupPending !== true ||
          status.inspectionRequired === true)
      )
        throw new Error('Invalid cleanup availability');
      if (
        row.canRetireWriter === true &&
        (!recoveryPresentation ||
          row.enabled !== true ||
          status.evidence !== 'DURABLE_GENERATION' ||
          status.inspectionRequired !== true)
      )
        throw new Error('Invalid writer recovery availability');
      return {
        canInspectMaintenance:
          row.canInspectMaintenance === undefined
            ? false
            : flag(row.canInspectMaintenance),
        canCleanup: row.canCleanup === undefined ? false : flag(row.canCleanup),
        canRetireWriter:
          row.canRetireWriter === undefined ? false : flag(row.canRetireWriter),
        code,
        repository: text(row.repository),
        project: text(row.project),
        module: text(row.module),
        owner: text(row.owner),
        sourceType: text(row.sourceType),
        classification: text(row.classification),
        version: text(row.version),
        sourcePolicyDigest: row.sourcePolicyDigest,
        enabled: flag(row.enabled),
        paths: strings(row.paths),
        excludedPaths: strings(row.excludedPaths),
        allowedExtensions: strings(row.allowedExtensions),
        canPreview: flag(row.canPreview),
        recordedRefreshRequired:
          row.recordedRefreshRequired === undefined
            ? false
            : flag(row.recordedRefreshRequired),
        canStartRecordedRefresh:
          row.canStartRecordedRefresh === undefined
            ? false
            : flag(row.canStartRecordedRefresh),
        canInspectHistory:
          row.canInspectHistory === undefined ? false : flag(row.canInspectHistory),
        canQuery: row.canQuery === undefined ? false : flag(row.canQuery),
        runtimeBinding: row.runtimeBinding
          ? (() => {
              const binding = assistantRecord(row.runtimeBinding, 'Runtime partition');
              return {
                moduleName: text(binding.moduleName),
                loadIndex: text(binding.loadIndex),
                relativeRoot: text(binding.relativeRoot),
              };
            })()
          : null,
        status: {
          progress,
          state: text(status.state),
          evidence: text(status.evidence),
          inspectionRequired:
            status.inspectionRequired === undefined
              ? false
              : flag(status.inspectionRequired),
          cleanupPending:
            status.cleanupPending === undefined ? false : flag(status.cleanupPending),
          indexedVersion: nullable(status.indexedVersion),
          refreshedAt: nullable(status.refreshedAt),
        },
      };
    }),
  };
}
export type KnowledgeInventory = ReturnType<typeof parseKnowledgeInventory>;
export type KnowledgeSource = KnowledgeInventory['sources'][number];

/** Accepts only nonnegative measured counts and the selected source identity. */
export function parseKnowledgePreview(value: unknown, source: KnowledgeSource) {
  const input = assistantRecord(value, 'Knowledge preview');
  if (
    input.sourceCode !== source.code ||
    input.sourceVersion !== source.version ||
    input.state !== 'PREPARED'
  )
    throw new Error('Knowledge preview revision changed');
  const counts = Object.fromEntries(
    ['filesRead', 'filesAccepted', 'filesRejected', 'chunksPrepared'].map((key) => {
      if (!Number.isSafeInteger(input[key]) || Number(input[key]) < 0)
        throw new Error('Invalid knowledge count');
      return [key, Number(input[key])];
    }),
  ) as Record<
    'filesRead' | 'filesAccepted' | 'filesRejected' | 'chunksPrepared',
    number
  >;
  if (counts.filesRead !== counts.filesAccepted + counts.filesRejected)
    throw new Error('Invalid knowledge totals');
  return counts;
}
export type KnowledgePreview = ReturnType<typeof parseKnowledgePreview>;

/** Uses canonical API paths once; no model calls, refresh mutation, or automatic POST retry. */
export function createKnowledgeStudioClient(
  configuration: AssistantTransportConfiguration,
  fetcher: typeof fetch = fetch,
) {
  const transport = createAssistantTransport(configuration, fetcher);
  return {
    refresh: async (source: KnowledgeSource, signal?: AbortSignal) => {
      if (
        !source.canPreview ||
        !source.enabled ||
        !source.sourcePolicyDigest ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(source.code) ||
        !navigator.onLine
      )
        throw new Error('Source refresh unavailable');
      const result = assistantRecord(
        await transport.request(
          `/knowledge/sources/${encodeURIComponent(source.code)}/refresh`,
          {
            method: 'POST',
            body: { expectedPolicyDigest: source.sourcePolicyDigest },
            signal,
          },
        ),
        'Source refresh',
      );
      if (
        result.sourceCode !== source.code ||
        result.sourceVersion !== source.version ||
        result.sourcePolicyDigest !== source.sourcePolicyDigest ||
        result.state !== 'PROJECTED'
      )
        throw new Error('Unconfirmed source refresh');
    },
    inventory: async (signal?: AbortSignal, page = 1) => {
      if (!Number.isSafeInteger(page) || page < 1 || page > 1000)
        throw new Error('Invalid inventory page');
      const result = parseKnowledgeInventory(
        await transport.request(
          page === 1 ? '/knowledge/sources' : `/knowledge/sources?page=${page}`,
          { signal },
        ),
      );
      if (
        result.context.enterpriseCode !== configuration.enterpriseCode ||
        result.page !== page
      )
        throw new Error('Knowledge context mismatch');
      return result;
    },
    preview: async (source: KnowledgeSource, signal?: AbortSignal) => {
      if (
        !source.canPreview ||
        !source.enabled ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(source.code)
      )
        throw new Error('Knowledge preview unavailable');
      return parseKnowledgePreview(
        await transport.request(
          `/knowledge/sources/${encodeURIComponent(source.code)}/preview`,
          { method: 'POST', body: {}, signal },
        ),
        source,
      );
    },
  };
}
