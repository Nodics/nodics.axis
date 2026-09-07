import {
  ASSISTANT_API_CONTRACT_VERSION,
  type AssistantConfirmation,
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
          chunksProjected: nonNegativeInteger(
            source.chunksProjected ?? 0,
            'knowledge chunksProjected',
          ),
          refreshedAt: optionalText(source.refreshedAt, 'knowledge refreshedAt'),
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
  if (envelope.data !== undefined) return envelope.data;
  if (envelope.result !== undefined) return envelope.result;
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
  return Object.freeze({
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

export function parseAssistantConfirmation(value: unknown): AssistantConfirmation {
  const item = assistantRecord(value, 'Assistant confirmation');
  return Object.freeze({
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

export function parseAssistantUsage(value: unknown): AssistantUsage {
  const data = assistantRecord(value, 'Assistant usage event');
  const usage = assistantRecord(data.usage, 'Assistant normalized usage');
  const reconciliation =
    data.reconciliation === undefined
      ? {}
      : assistantRecord(data.reconciliation, 'Assistant usage reconciliation');
  return Object.freeze({
    phase: optionalText(data.phase, 'usage phase'),
    inputTokens: nonNegativeInteger(usage.inputTokens ?? 0, 'inputTokens'),
    outputTokens: nonNegativeInteger(usage.outputTokens ?? 0, 'outputTokens'),
    cachedInputTokens: nonNegativeInteger(
      usage.cachedInputTokens ?? 0,
      'cachedInputTokens',
    ),
    reasoningTokens: nonNegativeInteger(usage.reasoningTokens ?? 0, 'reasoningTokens'),
    embeddingTokens: nonNegativeInteger(usage.embeddingTokens ?? 0, 'embeddingTokens'),
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
