/** @file Typed reviewed manual refresh and exact original-attempt inspection; Process owns execution and persistence. */
import { assistantRecord } from './assistantContractParsers';
import { parseKnowledgeHistory } from './knowledgeHistoryClient';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';
import type { KnowledgeSource } from './knowledgeStudioClient';

const copyKeys = [
  'title',
  'review',
  'confirm',
  'start',
  'inspect',
  'reference',
  'definition',
  'version',
  'acknowledged',
  'unknown',
  'evidence',
  'unavailable',
] as const;
/** Validates inert owner copy before showing any refresh control. */
export function parseKnowledgeManualRefreshCopy(value: unknown) {
  const copy = assistantRecord(value, 'Recorded refresh presentation');
  return Object.fromEntries(
    copyKeys.map((key) => {
      if (typeof copy[key] !== 'string' || !copy[key].trim() || copy[key].length > 2000)
        throw new Error('Invalid recorded refresh presentation');
      return [key, copy[key]];
    }),
  ) as Record<(typeof copyKeys)[number], string>;
}

/** Binds the owner review or receipt to this source and original client command identity. */
function parseReview(
  value: unknown,
  source: KnowledgeSource,
  requestId: string,
  state: 'REVIEW' | 'START_ACKNOWLEDGED',
) {
  const input = assistantRecord(value, 'Recorded refresh review');
  if (
    input.contractVersion !== 1 ||
    input.state !== state ||
    input.sourceCode !== source.code ||
    input.sourcePolicyDigest !== source.sourcePolicyDigest ||
    input.requestId !== requestId ||
    typeof input.reviewDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(input.reviewDigest) ||
    typeof input.instanceCode !== 'string' ||
    !/^knowledge-manual-[a-f0-9]{64}$/.test(input.instanceCode) ||
    typeof input.definitionCode !== 'string' ||
    !/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(input.definitionCode) ||
    !Number.isSafeInteger(input.version) ||
    Number(input.version) < 1 ||
    (state === 'START_ACKNOWLEDGED' && input.evidence !== 'PROCESS_INSTANCE')
  )
    throw new Error('Invalid recorded refresh review');
  return {
    requestId,
    sourceCode: source.code,
    sourcePolicyDigest: String(source.sourcePolicyDigest),
    reviewDigest: input.reviewDigest,
    instanceCode: input.instanceCode,
    definitionCode: input.definitionCode,
    version: Number(input.version),
  };
}
export type KnowledgeManualRefreshReview = ReturnType<typeof parseReview>;

/** Issues one explicit command; offline calls and pre-aborted requests never enter transport. */
export function createKnowledgeManualRefreshClient(
  configuration: AssistantTransportConfiguration,
  fetcher: typeof fetch = fetch,
) {
  const transport = createAssistantTransport(configuration, fetcher);
  const path = (source: KnowledgeSource, requestId: string, inspection = false) => {
    if (
      !navigator.onLine ||
      !source.enabled ||
      (!inspection && !source.canStartRecordedRefresh) ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(source.code) ||
      !/^[a-f0-9]{64}$/.test(source.sourcePolicyDigest || '') ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
        requestId,
      )
    )
      throw new Error('Recorded refresh unavailable');
    return `/knowledge/sources/${encodeURIComponent(source.code)}/refresh`;
  };
  return {
    preview: async (source: KnowledgeSource, requestId: string, signal?: AbortSignal) =>
      parseReview(
        await transport.request(`${path(source, requestId)}/preview`, {
          method: 'POST',
          body: { requestId, expectedPolicyDigest: source.sourcePolicyDigest },
          signal,
        }),
        source,
        requestId,
        'REVIEW',
      ),
    start: async (
      source: KnowledgeSource,
      review: KnowledgeManualRefreshReview,
      signal?: AbortSignal,
    ) => {
      const checked = parseReview(
        { ...review, contractVersion: 1, state: 'REVIEW' },
        source,
        review.requestId,
        'REVIEW',
      );
      const receipt = parseReview(
        await transport.request(`${path(source, checked.requestId)}/start`, {
          method: 'POST',
          body: {
            requestId: checked.requestId,
            expectedPolicyDigest: checked.sourcePolicyDigest,
            reviewDigest: checked.reviewDigest,
            confirmed: true,
          },
          signal,
        }),
        source,
        checked.requestId,
        'START_ACKNOWLEDGED',
      );
      if (JSON.stringify(receipt) !== JSON.stringify(checked))
        throw new Error('Unconfirmed refresh start');
    },
    inspect: async (
      source: KnowledgeSource,
      review: KnowledgeManualRefreshReview,
      signal?: AbortSignal,
    ) => {
      const input = assistantRecord(
        await transport.request(`${path(source, review.requestId, true)}/inspect`, {
          method: 'POST',
          body: { requestId: review.requestId },
          signal,
        }),
        'Original refresh inspection',
      );
      if (
        input.contractVersion !== 1 ||
        !['ATTEMPTS_AVAILABLE', 'OUTCOME_UNKNOWN'].includes(String(input.state)) ||
        input.sourceCode !== source.code ||
        input.requestId !== review.requestId ||
        input.instanceCode !== review.instanceCode
      )
        throw new Error('Invalid original refresh inspection');
      const history = parseKnowledgeHistory(input.history, source.code, 1);
      if (
        history.items.some((item) => item.instanceCode !== review.instanceCode) ||
        (input.state === 'ATTEMPTS_AVAILABLE') !== history.items.length > 0
      )
        throw new Error('Foreign refresh evidence');
      return history;
    },
  };
}
