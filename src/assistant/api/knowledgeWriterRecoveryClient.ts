/** @file Bounded pending-publication recovery transport; Discovery retains all writer and index authority. */
import { assistantRecord } from './assistantContractParsers';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';
import type { KnowledgeSource } from './knowledgeStudioClient';

const keys = [
  'title',
  'review',
  'confirm',
  'cancel',
  'started',
  'chunks',
  'notEligible',
  'impact',
  'done',
  'unknown',
  'unavailable',
] as const;
/** Accepts inert owner presentation only. */
export function parseKnowledgeWriterRecoveryCopy(value: unknown) {
  const input = assistantRecord(value, 'Writer recovery presentation');
  return Object.fromEntries(
    keys.map((key) => {
      if (
        typeof input[key] !== 'string' ||
        !input[key].trim() ||
        input[key].length > 2000
      )
        throw new Error('Invalid writer recovery presentation');
      return [key, input[key]];
    }),
  ) as Record<(typeof keys)[number], string>;
}
export interface KnowledgeWriterReview {
  readonly sourceCode: string;
  readonly sourcePolicyDigest: string;
  readonly revision: number;
  readonly reviewDigest: string;
  readonly startedAt: string;
  readonly expectedChunks: number;
  readonly eligible: boolean;
}
/** Discards undeclared evidence and rejects foreign, invalid or stale-shaped reviews. */
function review(value: unknown, source: KnowledgeSource): KnowledgeWriterReview {
  const input = assistantRecord(value, 'Writer recovery review');
  if (
    input.contractVersion !== 1 ||
    input.state !== 'REVIEWED' ||
    input.sourceCode !== source.code ||
    input.sourcePolicyDigest !== source.sourcePolicyDigest ||
    !Number.isSafeInteger(input.revision) ||
    Number(input.revision) < 0 ||
    typeof input.reviewDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(input.reviewDigest) ||
    typeof input.startedAt !== 'string' ||
    input.startedAt.length > 40 ||
    !Number.isFinite(Date.parse(input.startedAt)) ||
    !Number.isSafeInteger(input.expectedChunks) ||
    Number(input.expectedChunks) < 0 ||
    Number(input.expectedChunks) > 1000000 ||
    typeof input.eligible !== 'boolean'
  )
    throw new Error('Invalid writer recovery review');
  return {
    sourceCode: source.code,
    sourcePolicyDigest: String(source.sourcePolicyDigest),
    revision: Number(input.revision),
    reviewDigest: input.reviewDigest,
    startedAt: input.startedAt,
    expectedChunks: Number(input.expectedChunks),
    eligible: input.eligible,
  };
}
/** Sends one explicit retirement with no retry, worker dispatch, index predicate or browser token. */
export function createKnowledgeWriterRecoveryClient(
  configuration: AssistantTransportConfiguration,
  fetcher: typeof fetch = fetch,
) {
  const transport = createAssistantTransport(configuration, fetcher);
  const path = (source: KnowledgeSource) => {
    if (
      !source.canRetireWriter ||
      !source.enabled ||
      !/^[a-f0-9]{64}$/.test(source.sourcePolicyDigest || '') ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(source.code) ||
      !navigator.onLine
    )
      throw new Error('Writer recovery unavailable');
    return `/knowledge/sources/${encodeURIComponent(source.code)}/writer-recovery`;
  };
  return {
    preview: async (source: KnowledgeSource, signal?: AbortSignal) =>
      review(
        await transport.request(`${path(source)}/preview`, {
          method: 'POST',
          body: {},
          signal,
        }),
        source,
      ),
    execute: async (
      source: KnowledgeSource,
      selected: KnowledgeWriterReview,
      signal?: AbortSignal,
    ) => {
      const checked = review(
        { ...selected, contractVersion: 1, state: 'REVIEWED' },
        source,
      );
      if (!checked.eligible) throw new Error('Writer not eligible for recovery');
      const result = assistantRecord(
        await transport.request(path(source), {
          method: 'POST',
          body: {
            confirmed: true,
            expectedRevision: checked.revision,
            expectedPolicyDigest: checked.sourcePolicyDigest,
            reviewDigest: checked.reviewDigest,
          },
          signal,
        }),
        'Writer recovery result',
      );
      if (
        result.contractVersion !== 1 ||
        result.state !== 'RETIRED' ||
        result.sourceCode !== source.code ||
        result.sourcePolicyDigest !== source.sourcePolicyDigest ||
        result.revision !== checked.revision + 1 ||
        result.cleanupPending !== true
      )
        throw new Error('Unconfirmed writer recovery');
    },
  };
}
