/** @file Typed reviewed cleanup transport; the backend owns eligibility, index predicates and current authority. */
import { assistantRecord } from './assistantContractParsers';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';
import type { KnowledgeSource } from './knowledgeStudioClient';

const copyKeys = [
  'title',
  'review',
  'confirm',
  'cancel',
  'eligible',
  'operatorOnly',
  'done',
  'unknown',
  'unavailable',
] as const;
/** Keeps owner copy inert and bounded; missing presentation cannot create a usable command. */
export function parseKnowledgeCleanupCopy(value: unknown) {
  const copy = assistantRecord(value, 'Cleanup presentation');
  return Object.fromEntries(
    copyKeys.map((key) => {
      if (typeof copy[key] !== 'string' || !copy[key].trim() || copy[key].length > 2000)
        throw new Error('Invalid cleanup presentation');
      return [key, copy[key]];
    }),
  ) as Record<(typeof copyKeys)[number], string>;
}
export interface KnowledgeCleanupReview {
  readonly revision: number;
  readonly reviewDigest: string;
  readonly sourceCode: string;
  readonly sourcePolicyDigest: string;
  readonly eligibleGenerations: number;
  readonly operatorOnlyGenerations: number;
}
/** Rejects mismatched or unbounded reviews before confirmation can be rendered. */
function review(value: unknown, source: KnowledgeSource): KnowledgeCleanupReview {
  const input = assistantRecord(value, 'Cleanup review');
  if (
    input.contractVersion !== 1 ||
    input.state !== 'REVIEWED' ||
    input.sourceCode !== source.code ||
    input.sourcePolicyDigest !== source.sourcePolicyDigest ||
    !Number.isSafeInteger(input.revision) ||
    Number(input.revision) < 0 ||
    typeof input.reviewDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(input.reviewDigest) ||
    ['eligibleGenerations', 'operatorOnlyGenerations'].some(
      (key) =>
        !Number.isSafeInteger(input[key]) ||
        Number(input[key]) < 0 ||
        Number(input[key]) > 100,
    ) ||
    Number(input.eligibleGenerations) + Number(input.operatorOnlyGenerations) > 100
  )
    throw new Error('Invalid cleanup review');
  return {
    revision: Number(input.revision),
    reviewDigest: input.reviewDigest,
    sourceCode: source.code,
    sourcePolicyDigest: String(source.sourcePolicyDigest),
    eligibleGenerations: Number(input.eligibleGenerations),
    operatorOnlyGenerations: Number(input.operatorOnlyGenerations),
  };
}
/** Sends one explicit command and accepts only a source-bound acknowledgement; never retries POST. */
export function createKnowledgeCleanupClient(
  configuration: AssistantTransportConfiguration,
  fetcher: typeof fetch = fetch,
) {
  const transport = createAssistantTransport(configuration, fetcher);
  const path = (source: KnowledgeSource) => {
    if (
      !source.canCleanup ||
      !source.enabled ||
      !/^[a-f0-9]{64}$/.test(source.sourcePolicyDigest || '') ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(source.code) ||
      !navigator.onLine
    )
      throw new Error('Cleanup unavailable');
    return `/knowledge/sources/${encodeURIComponent(source.code)}/cleanup`;
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
      selected: KnowledgeCleanupReview,
      signal?: AbortSignal,
    ) => {
      const checked = review(
        { ...selected, contractVersion: 1, state: 'REVIEWED' },
        source,
      );
      if (checked.eligibleGenerations === 0) throw new Error('No eligible cleanup');
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
        'Cleanup result',
      );
      if (
        result.contractVersion !== 1 ||
        result.state !== 'CLEANED' ||
        result.sourceCode !== source.code ||
        result.sourcePolicyDigest !== source.sourcePolicyDigest ||
        !Number.isSafeInteger(result.revision) ||
        Number(result.revision) <= checked.revision ||
        typeof result.cleanupPending !== 'boolean'
      )
        throw new Error('Unconfirmed cleanup');
    },
  };
}
