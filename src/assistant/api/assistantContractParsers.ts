/** @file Validates copilotApi responses and exposes only bounded, typed presentation data. */
import {
  ASSISTANT_API_CONTRACT_VERSION,
  type AssistantConfirmation,
  type AssistantActionOutcome,
  type AssistantCitation,
  type AssistantConversation,
  type AssistantConversationPage,
  type AssistantConversationHistory,
  type AssistantEventPage,
  type AssistantEventType,
  type AssistantTurn,
  type AssistantTurnEvent,
  type AssistantTurnState,
  type AssistantMessage,
  type AssistantToolActivity,
  type AssistantUsage,
  type AssistantKnowledgeStatus,
  type AssistantExportArtifact,
} from './assistantContracts';

const TURN_STATES: readonly AssistantTurnState[] = [
  'ACCEPTED',
  'PROCESSING',
  'CANCELLATION_REQUESTED',
  'CANCELLED',
  'COMPLETED',
  'FAILED',
];

const EVENT_TYPES: readonly AssistantEventType[] = [
  'TURN_ACCEPTED',
  'STATUS',
  'TEXT_DELTA',
  'CLARIFICATION',
  'TOOL_PLAN',
  'CONFIRMATION_REQUIRED',
  'TOOL_STARTED',
  'TOOL_RESULT',
  'EXPORT_READY',
  'CITATIONS',
  'USAGE',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
];

export function assistantRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function booleanValue(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean`);
  return value;
}

export function parseAssistantKnowledgeStatus(
  value: unknown,
): AssistantKnowledgeStatus {
  const status = assistantRecord(value, 'Assistant knowledge status');
  if (!Array.isArray(status.sources)) {
    throw new Error('Assistant knowledge sources must be an array');
  }
  return Object.freeze({
    enabled: booleanValue(status.enabled, 'knowledge enabled'),
    ingestionEnabled: booleanValue(
      status.ingestionEnabled,
      'knowledge ingestionEnabled',
    ),
    lastRefreshAt:
      status.lastRefreshAt === null
        ? undefined
        : optionalText(status.lastRefreshAt, 'knowledge lastRefreshAt'),
    sources: Object.freeze(
      status.sources.map((rawSource) => {
        const source = assistantRecord(rawSource, 'Assistant knowledge source');
        return Object.freeze({
          code: text(source.code, 'knowledge source code'),
          repository: text(source.repository, 'knowledge source repository'),
          sourceType: text(source.sourceType, 'knowledge source type'),
          classification: text(
            source.classification,
            'knowledge source classification',
          ),
          version: text(source.version, 'knowledge source version'),
          refreshPolicy: text(source.refreshPolicy, 'knowledge refreshPolicy'),
          state: text(source.state, 'knowledge source state'),
          filesRead: nonNegativeInteger(source.filesRead ?? 0, 'knowledge filesRead'),
          filesAccepted: nonNegativeInteger(
            source.filesAccepted ?? 0,
            'knowledge filesAccepted',
          ),
          filesRejected: nonNegativeInteger(
            source.filesRejected ?? 0,
            'knowledge filesRejected',
          ),
          chunksProjected:
            source.chunksProjected === undefined || source.chunksProjected === null
              ? undefined
              : nonNegativeInteger(source.chunksProjected, 'knowledge chunksProjected'),
          refreshedAt:
            source.refreshedAt === null
              ? undefined
              : optionalText(source.refreshedAt, 'knowledge refreshedAt'),
          failureCode: optionalText(source.failureCode, 'knowledge failureCode'),
        });
      }),
    ),
  });
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function optionalText(value: unknown, name: string): string | undefined {
  return value === undefined ? undefined : text(value, name);
}

function nonNegativeInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return Number(value);
}

function positiveInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return Number(value);
}

export function assistantEnvelopeData(value: unknown): unknown {
  const envelope = assistantRecord(value, 'Assistant response');
  if (
    (envelope.code !== undefined &&
      (typeof envelope.code !== 'string' || !/^SUC_/.test(envelope.code))) ||
    envelope.error ||
    envelope.success === false ||
    envelope.acknowledged === false ||
    (envelope.errors !== undefined &&
      (!Array.isArray(envelope.errors) || envelope.errors.length))
  )
    throw new Error('Assistant response was not acknowledged');
  const payload = envelope.data !== undefined ? envelope.data : envelope.result;
  if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
    const data = payload as Record<string, unknown>;
    if (
      data.error ||
      data.success === false ||
      data.acknowledged === false ||
      (data.errors !== undefined && (!Array.isArray(data.errors) || data.errors.length))
    )
      throw new Error('Assistant result was not acknowledged');
  }
  if (payload !== undefined) return payload;
  throw new Error('Assistant response contains no data');
}

export function parseAssistantConversation(value: unknown): AssistantConversation {
  const item = assistantRecord(value, 'Assistant conversation');
  return Object.freeze({
    conversationCode: text(item.conversationCode ?? item.code, 'conversationCode'),
    definitionCode: text(item.definitionCode, 'definitionCode'),
    state: text(item.state, 'conversation state'),
    title: optionalText(item.title, 'conversation title'),
    lastSequence: nonNegativeInteger(item.lastSequence ?? 0, 'lastSequence'),
  });
}

export function parseConversationPage(value: unknown): AssistantConversationPage {
  const page = assistantRecord(value, 'Assistant conversation page');
  if (!Array.isArray(page.items)) {
    throw new Error('Assistant conversation page items must be an array');
  }
  return Object.freeze({
    page: positiveInteger(page.page, 'conversation page'),
    limit: positiveInteger(page.limit, 'conversation limit'),
    items: Object.freeze(page.items.map(parseAssistantConversation)),
  });
}

export function parseAssistantTurn(value: unknown): AssistantTurn {
  const item = assistantRecord(value, 'Assistant turn');
  if (!TURN_STATES.includes(item.state as AssistantTurnState)) {
    throw new Error('Assistant turn state is unsupported');
  }
  const recording =
    item.recording === undefined
      ? undefined
      : assistantRecord(item.recording, 'Recording policy');
  if (
    recording &&
    (typeof recording.enabled !== 'boolean' ||
      typeof recording.notice !== 'string' ||
      !recording.notice.trim() ||
      recording.notice.length > 500 ||
      typeof recording.version !== 'string' ||
      !/^[A-Za-z0-9._-]{1,64}$/.test(recording.version))
  )
    throw new Error('Invalid recording policy');
  return Object.freeze({
    recording: recording
      ? {
          enabled: recording.enabled as boolean,
          version: recording.version as string,
          notice: recording.notice as string,
        }
      : undefined,
    turnCode: text(item.turnCode ?? item.code, 'turnCode'),
    conversationCode: text(item.conversationCode, 'turn conversationCode'),
    state: item.state as AssistantTurnState,
    idempotencyKey: optionalText(item.idempotencyKey, 'turn idempotencyKey'),
  });
}

export function parseAssistantEvent(value: unknown): AssistantTurnEvent {
  const item = assistantRecord(value, 'Assistant event');
  if (item.contractVersion !== ASSISTANT_API_CONTRACT_VERSION) {
    throw new Error('Assistant event contract version is unsupported');
  }
  if (!EVENT_TYPES.includes(item.eventType as AssistantEventType)) {
    throw new Error('Assistant event type is unsupported');
  }
  return Object.freeze({
    eventCode: text(item.eventCode ?? item.eventId, 'eventCode'),
    conversationCode: text(
      item.conversationCode ?? item.conversationId,
      'event conversationCode',
    ),
    turnCode: text(item.turnCode ?? item.turnId, 'event turnCode'),
    eventType: item.eventType as AssistantEventType,
    sequence: nonNegativeInteger(item.sequence, 'event sequence'),
    createdAt: text(item.createdAt, 'event createdAt'),
    data: Object.freeze({ ...assistantRecord(item.data ?? {}, 'event data') }),
  });
}

export function parseEventPage(value: unknown): AssistantEventPage {
  const page = assistantRecord(value, 'Assistant event page');
  if (!Array.isArray(page.items)) {
    throw new Error('Assistant event page items must be an array');
  }
  return Object.freeze({
    afterSequence: nonNegativeInteger(page.afterSequence, 'event afterSequence'),
    limit: positiveInteger(page.limit, 'event limit'),
    items: Object.freeze(
      page.items.map((event) =>
        parseAssistantEvent({
          contractVersion: ASSISTANT_API_CONTRACT_VERSION,
          ...assistantRecord(event, 'Assistant replay event'),
        }),
      ),
    ),
  });
}

function parseAssistantMessage(value: unknown): AssistantMessage {
  const item = assistantRecord(value, 'Assistant message');
  if (!['user', 'assistant'].includes(String(item.role))) {
    throw new Error('Assistant message role is unsupported');
  }
  return Object.freeze({
    role: item.role as 'user' | 'assistant',
    content: text(item.content, 'message content'),
    sequence: nonNegativeInteger(item.sequence, 'message sequence'),
    createdAt: optionalText(item.createdAt, 'message createdAt'),
  });
}

export function parseConversationHistory(value: unknown): AssistantConversationHistory {
  const history = assistantRecord(value, 'Assistant conversation history');
  if (!Array.isArray(history.items)) {
    throw new Error('Assistant conversation history items must be an array');
  }
  return Object.freeze({
    conversation: parseAssistantConversation(history.conversation),
    page: positiveInteger(history.page, 'history page'),
    limit: positiveInteger(history.limit, 'history limit'),
    items: Object.freeze(
      history.items.map((rawEntry) => {
        const entry = assistantRecord(rawEntry, 'Assistant history entry');
        if (!Array.isArray(entry.messages)) {
          throw new Error('Assistant history messages must be an array');
        }
        if (entry.interactions !== undefined && !Array.isArray(entry.interactions)) {
          throw new Error('Assistant history interactions must be an array');
        }
        return Object.freeze({
          turn: parseAssistantTurn(entry.turn),
          messages: Object.freeze(entry.messages.map(parseAssistantMessage)),
          interactions: Object.freeze(
            (entry.interactions ?? []).map((event) =>
              parseAssistantEvent({
                contractVersion: ASSISTANT_API_CONTRACT_VERSION,
                ...assistantRecord(event, 'Assistant history interaction'),
              }),
            ),
          ),
        });
      }),
    ),
    confirmations: Object.freeze(
      Array.isArray(history.confirmations)
        ? history.confirmations.map(parseAssistantConfirmation)
        : [],
    ),
  });
}

/** Projects bounded row identities and states without leaking domain response bodies. */
export function parseAssistantActionOutcomes(
  value: unknown,
): readonly AssistantActionOutcome[] {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > 200)
    throw new Error('Invalid action outcomes');
  return Object.freeze(
    value.map((raw) => {
      const row = assistantRecord(raw, 'Action outcome');
      const state = text(row.state, 'Action outcome state');
      if (!['NOT_STARTED', 'RUNNING', 'COMPLETED', 'OUTCOME_UNKNOWN'].includes(state))
        throw new Error('Unsupported action outcome state');
      return Object.freeze({
        index: nonNegativeInteger(row.index, 'Action outcome index'),
        schema: text(row.schema, 'Action outcome schema'),
        code: text(row.code, 'Action outcome code'),
        state: state as AssistantActionOutcome['state'],
      });
    }),
  );
}

export function parseAssistantConfirmation(value: unknown): AssistantConfirmation {
  const item = assistantRecord(value, 'Assistant confirmation');
  let recovery: AssistantConfirmation['recovery'];
  if (item.recovery !== undefined) {
    const raw = assistantRecord(item.recovery, 'Original result recovery');
    const label = text(raw.label, 'Recovery label');
    const continuation =
      raw.continuation == null
        ? undefined
        : text(raw.continuation, 'Continuation notice');
    if (
      label.length > 160 ||
      (continuation?.length ?? 0) > 1000 ||
      ![
        'commerce.product.create',
        'profile.enterprise.onboard',
        'profile.enterprise.invite',
        'commerce.price.create',
        'waste.collectionCentre.create',
        'process.task.claim',
        'process.task.assign',
        'process.task.complete',
        'process.task.cancel',
        'process.trigger.create',
        'process.trigger.update',
        'process.trigger.archive',
        'process.trigger.execute',
        'process.definition.create',
        'process.definition.update',
        'process.definition.prepare',
        'process.definition.validate',
        'process.definition.publish',
        'process.definition.delete',
        'process.instance.start',
        'process.instance.cancel',
        'process.instance.retry',
        'process.instance.compensate',
        'data.record.create',
        'data.record.update',
        'data.record.delete',
        'commerce.orderNotification.retry',
      ].includes(String(item.operationId))
    )
      throw new Error('Unsupported original result recovery');
    recovery = Object.freeze({ label, continuation });
  }
  return Object.freeze({
    recovery,
    confirmationCode: text(item.confirmationCode ?? item.code, 'confirmationCode'),
    conversationCode: text(item.conversationCode, 'confirmation conversationCode'),
    operationId: text(item.operationId, 'confirmation operationId'),
    state: text(item.state, 'confirmation state'),
    argumentsDigest: text(item.argumentsDigest, 'confirmation argumentsDigest'),
    revision: nonNegativeInteger(item.revision, 'confirmation revision'),
    expiresAt: text(item.expiresAt, 'confirmation expiresAt'),
    impact: Object.freeze({
      ...assistantRecord(item.impact, 'confirmation impact'),
    }),
    outcomes:
      item.outcomes === undefined
        ? undefined
        : parseAssistantActionOutcomes(item.outcomes),
    workflowCarrierCode: optionalText(item.workflowCarrierCode, 'workflowCarrierCode'),
  });
}

export function parseAssistantCitations(value: unknown): readonly AssistantCitation[] {
  const data = assistantRecord(value, 'Assistant citations');
  const raw = data.citations ?? data.items;
  if (!Array.isArray(raw)) throw new Error('Assistant citations must be an array');
  return Object.freeze(
    raw.map((value) => {
      const citation = assistantRecord(value, 'Assistant citation');
      const navigationType = citation.navigationType;
      if (
        navigationType !== undefined &&
        (typeof navigationType !== 'string' ||
          !['NONE', 'INTERNAL_ROUTE'].includes(navigationType))
      ) {
        throw new Error('Assistant citation navigation type is unsupported');
      }
      const navigationTarget = optionalText(
        citation.navigationTarget,
        'citation navigation target',
      );
      if (
        navigationType === 'INTERNAL_ROUTE' &&
        (!navigationTarget ||
          !navigationTarget.startsWith('/') ||
          navigationTarget.startsWith('//') ||
          navigationTarget.includes('\\') ||
          [...navigationTarget].some((character) => {
            const code = character.charCodeAt(0);
            return code <= 31 || code === 127;
          }))
      ) {
        throw new Error('Assistant citation navigation target is unsafe');
      }
      return Object.freeze({
        citationId: text(citation.citationId, 'citationId'),
        title: text(citation.title, 'citation title'),
        locator: optionalText(citation.locator, 'citation locator'),
        section: optionalText(citation.section, 'citation section'),
        version: optionalText(citation.version, 'citation version'),
        navigationType: navigationType as 'NONE' | 'INTERNAL_ROUTE' | undefined,
        navigationTarget,
      });
    }),
  );
}

/** Preserves unknown measurements while rejecting malformed supplied token counts. */
function measuredTokens(value: unknown, field: string): number | null {
  return value === undefined || value === null
    ? null
    : nonNegativeInteger(value, field);
}

/** Parses backend usage without inventing measurements or a reconciliation result. */
export function parseAssistantUsage(value: unknown): AssistantUsage {
  const data = assistantRecord(value, 'Assistant usage event');
  const usage = assistantRecord(data.usage, 'Assistant normalized usage');
  const reconciliation =
    data.reconciliation === undefined
      ? {}
      : assistantRecord(data.reconciliation, 'Assistant usage reconciliation');
  return Object.freeze({
    phase: optionalText(data.phase, 'usage phase'),
    inputTokens: measuredTokens(usage.inputTokens, 'inputTokens'),
    outputTokens: measuredTokens(usage.outputTokens, 'outputTokens'),
    cachedInputTokens: measuredTokens(usage.cachedInputTokens, 'cachedInputTokens'),
    reasoningTokens: measuredTokens(usage.reasoningTokens, 'reasoningTokens'),
    embeddingTokens: measuredTokens(usage.embeddingTokens, 'embeddingTokens'),
    reconciliationState: optionalText(
      reconciliation.state,
      'usage reconciliation state',
    ),
  });
}

export function parseAssistantToolActivity(
  value: unknown,
  state: AssistantToolActivity['state'],
): AssistantToolActivity {
  const data = assistantRecord(value, 'Assistant tool activity');
  return Object.freeze({
    toolId: text(data.toolId, 'toolId'),
    ownerModule: text(data.ownerModule, 'tool ownerModule'),
    operationId: text(data.operationId, 'tool operationId'),
    state,
    failureCode:
      state === 'FAILED' ? optionalText(data.code, 'tool failure code') : undefined,
  });
}

export function parseAssistantExportArtifact(value: unknown): AssistantExportArtifact {
  const wrapper = assistantRecord(value, 'Assistant export event');
  const item = assistantRecord(wrapper.export ?? wrapper, 'Assistant export artifact');
  if (
    !['csv', 'xlsx', 'text'].includes(String(item.format)) ||
    !['utf8', 'base64'].includes(String(item.encoding))
  ) {
    throw new Error('Assistant export artifact is unsupported');
  }
  return Object.freeze({
    format: item.format as AssistantExportArtifact['format'],
    fileName: text(item.fileName, 'export fileName'),
    mimeType: text(item.mimeType, 'export mimeType'),
    encoding: item.encoding as AssistantExportArtifact['encoding'],
    content: text(item.content, 'export content'),
  });
}
