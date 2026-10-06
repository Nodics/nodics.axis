/** @file Synthetic manual refresh contracts shared by unit and responsive renderer checks; no deployed identities. */
import { parseKnowledgeManualRefreshCopy } from '../../src/assistant/api/knowledgeManualRefreshClient';
import {
  parseKnowledgeHistory,
  parseKnowledgeHistoryCopy,
} from '../../src/assistant/api/knowledgeHistoryClient';
import type { KnowledgeSource } from '../../src/assistant/api/knowledgeStudioClient';

export const copy = parseKnowledgeManualRefreshCopy({
  title: 'Recorded source refresh',
  review: 'Review refresh',
  confirm: 'Confirm source refresh',
  start: 'Start refresh',
  inspect: 'Inspect original refresh',
  reference: 'Process reference',
  definition: 'Process definition',
  version: 'Published version',
  acknowledged:
    'Refresh start acknowledged. Check execution history and current index readiness for completion.',
  unknown:
    'Refresh outcome is unconfirmed. Inspect the original reference before starting any further work.',
  evidence: 'Original execution evidence is available in refresh history.',
  unavailable: 'Refresh review or inspection is unavailable.',
});
export const historyCopy = parseKnowledgeHistoryCopy({
  title: 'Refresh executions',
  load: 'Load execution history',
  refresh: 'Reload history',
  empty: 'No recorded attempts',
  unavailable: 'History unavailable',
  definition: 'Process definition',
  version: 'Published version',
  instance: 'Execution',
  started: 'Started',
  completed: 'Completed',
  currentPolicy: 'Current source policy',
  previousPolicy: 'Previous source policy',
  previous: 'Previous page',
  next: 'Next page',
  ready: 'Awaiting claim',
  claimed: 'In progress',
  done: 'Completed',
  failed: 'Failed',
  inspection: 'Outcome requires inspection',
  recovery: 'Process operator review required',
  evidence: 'Persisted Process attempts',
});
export const source = {
  code: 'framework-docs',
  enabled: true,
  sourcePolicyDigest: 'a'.repeat(64),
  canStartRecordedRefresh: true,
} as KnowledgeSource;
export const requestId = '11111111-1111-4111-8111-111111111111';
export const review = {
  requestId,
  sourceCode: source.code,
  sourcePolicyDigest: source.sourcePolicyDigest!,
  reviewDigest: 'b'.repeat(64),
  instanceCode: 'knowledge-manual-' + 'c'.repeat(64),
  definitionCode: 'copilotKnowledgeRefresh',
  version: 2,
};
/** Creates a bounded uncertain original attempt, not fabricated successful ingestion. */
export function historyResponse() {
  return {
    contractVersion: 2,
    evidence: 'PROCESS_ACTION_ATTEMPTS',
    sourceCode: source.code,
    page: 1,
    limit: 25,
    hasMore: false,
    definitionCode: review.definitionCode,
    definitionVersion: 2,
    observedAt: '2026-10-04T08:00:00Z',
    items: [
      {
        instanceCode: review.instanceCode,
        executionCode: '12345678-1234-4234-8234-123456789012',
        status: 'INSPECTION_REQUIRED',
        definitionVersion: 2,
        currentPolicy: true,
        recovery: 'PROCESS_INSPECTION',
        startedAt: '2026-10-04T07:00:00Z',
        completedAt: null,
      },
    ],
  };
}
/** Projects fixture data through the real history parser. */
export function history() {
  return parseKnowledgeHistory(historyResponse(), source.code, 1);
}
