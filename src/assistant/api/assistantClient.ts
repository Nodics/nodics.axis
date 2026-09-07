import {
  assistantRecord,
  parseAssistantConfirmation,
  parseAssistantConversation,
  parseAssistantTurn,
  parseConversationPage,
  parseConversationHistory,
  parseEventPage,
  parseAssistantKnowledgeStatus,
} from './assistantContractParsers';
import {
  type ApproveConfirmationInput,
  type AssistantConfirmation,
  type AssistantConversation,
  type AssistantConversationPage,
  type AssistantConversationHistory,
  type AssistantEventPage,
  type AssistantTurn,
  type AssistantKnowledgeStatus,
  type CreateConfirmationInput,
  type CreateConversationInput,
  type ListConversationsInput,
  type RejectConfirmationInput,
  type SubmitTurnInput,
} from './assistantContracts';
import {
  assistantPathSegment,
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';

export type AssistantClientConfiguration = AssistantTransportConfiguration;

export interface AssistantClient {
  createConversation(
    input: CreateConversationInput,
    signal?: AbortSignal,
  ): Promise<AssistantConversation>;
  listConversations(
    input?: ListConversationsInput,
    signal?: AbortSignal,
  ): Promise<AssistantConversationPage>;
  getConversation(
    conversationCode: string,
    signal?: AbortSignal,
  ): Promise<AssistantConversation>;
  getConversationHistory(
    conversationCode: string,
    page?: number,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<AssistantConversationHistory>;
  submitTurn(
    conversationCode: string,
    input: SubmitTurnInput,
    signal?: AbortSignal,
  ): Promise<{
    readonly conversation: AssistantConversation;
    readonly turn: AssistantTurn;
  }>;
  getTurn(
    conversationCode: string,
    turnCode: string,
    signal?: AbortSignal,
  ): Promise<AssistantTurn>;
  replayEvents(
    conversationCode: string,
    turnCode: string,
    afterSequence?: number,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<AssistantEventPage>;
  cancelTurn(
    conversationCode: string,
    turnCode: string,
    reason?: string,
    signal?: AbortSignal,
  ): Promise<AssistantTurn>;
  createConfirmation(
    input: CreateConfirmationInput,
    signal?: AbortSignal,
  ): Promise<AssistantConfirmation>;
  approveConfirmation(
    confirmationCode: string,
    input: ApproveConfirmationInput,
    signal?: AbortSignal,
  ): Promise<AssistantConfirmation>;
  getConfirmation(
    confirmationCode: string,
    signal?: AbortSignal,
  ): Promise<AssistantConfirmation>;
  rejectConfirmation(
    confirmationCode: string,
    input: RejectConfirmationInput,
    signal?: AbortSignal,
  ): Promise<AssistantConfirmation>;
  executeConfirmation(
    confirmationCode: string,
    signal?: AbortSignal,
  ): Promise<Readonly<Record<string, unknown>>>;
  getKnowledgeStatus?(signal?: AbortSignal): Promise<AssistantKnowledgeStatus>;
  refreshKnowledgeSource?(
    sourceCode: string,
    signal?: AbortSignal,
  ): Promise<AssistantKnowledgeStatus>;
}

function positiveBoundary(
  value: number | undefined,
  name: string,
  maximum: number,
): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} is outside the supported boundary`);
  }
  return value;
}

export function createAssistantClient(
  configuration: AssistantClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): AssistantClient {
  const transport = createAssistantTransport(configuration, fetchImplementation);

  const client: AssistantClient = {
    createConversation: async (input, signal) => {
      const data = assistantRecord(
        await transport.request('/conversations', {
          method: 'POST',
          body: { ...input },
          signal,
        }),
        'Create conversation data',
      );
      return parseAssistantConversation(data.conversation);
    },
    listConversations: async (input = {}, signal) =>
      parseConversationPage(
        await transport.request('/conversations', {
          query: {
            state: input.state,
            page: positiveBoundary(input.page, 'conversation page', 10000),
            limit: positiveBoundary(input.limit, 'conversation limit', 100),
          },
          signal,
        }),
      ),
    getConversation: async (conversationCode, signal) => {
      const data = assistantRecord(
        await transport.request(
          `/conversations/${assistantPathSegment(conversationCode, 'conversationCode')}`,
          {
            signal,
          },
        ),
        'Get conversation data',
      );
      return parseAssistantConversation(data.conversation);
    },
    getConversationHistory: async (conversationCode, page = 1, limit = 20, signal) =>
      parseConversationHistory(
        await transport.request(
          `/conversations/${assistantPathSegment(conversationCode, 'conversationCode')}/history`,
          {
            query: {
              page: positiveBoundary(page, 'history page', 10_000),
              limit: positiveBoundary(limit, 'history limit', 50),
            },
            signal,
          },
        ),
      ),
    submitTurn: async (conversationCode, input, signal) => {
      const data = assistantRecord(
        await transport.request(
          `/conversations/${assistantPathSegment(conversationCode, 'conversationCode')}/turns`,
          {
            method: 'POST',
            body: { ...input },
            idempotencyKey: input.idempotencyKey,
            signal,
          },
        ),
        'Submit turn data',
      );
      return Object.freeze({
        conversation: parseAssistantConversation(data.conversation),
        turn: parseAssistantTurn(data.turn),
      });
    },
    getTurn: async (conversationCode, turnCode, signal) => {
      const data = assistantRecord(
        await transport.request(
          `/conversations/${assistantPathSegment(conversationCode, 'conversationCode')}/turns/${assistantPathSegment(turnCode, 'turnCode')}`,
          { signal },
        ),
        'Get turn data',
      );
      return parseAssistantTurn(data.turn);
    },
    replayEvents: async (
      conversationCode,
      turnCode,
      afterSequence = 0,
      limit = 100,
      signal,
    ) =>
      parseEventPage(
        await transport.request(
          `/conversations/${assistantPathSegment(conversationCode, 'conversationCode')}/turns/${assistantPathSegment(turnCode, 'turnCode')}/events`,
          {
            query: {
              afterSequence:
                afterSequence === 0
                  ? 0
                  : positiveBoundary(
                      afterSequence,
                      'afterSequence',
                      Number.MAX_SAFE_INTEGER,
                    ),
              limit: positiveBoundary(limit, 'event limit', 500),
            },
            signal,
          },
        ),
      ),
    cancelTurn: async (conversationCode, turnCode, reason, signal) => {
      const data = assistantRecord(
        await transport.request(
          `/conversations/${assistantPathSegment(conversationCode, 'conversationCode')}/turns/${assistantPathSegment(turnCode, 'turnCode')}/cancel`,
          {
            method: 'POST',
            body: reason ? { reason } : {},
            signal,
          },
        ),
        'Cancel turn data',
      );
      return parseAssistantTurn(data.turn);
    },
    createConfirmation: async (input, signal) => {
      const data = assistantRecord(
        await transport.request('/confirmations', {
          method: 'POST',
          body: { ...input },
          idempotencyKey: input.idempotencyKey,
          signal,
        }),
        'Create confirmation data',
      );
      return parseAssistantConfirmation(data.confirmation);
    },
    approveConfirmation: async (confirmationCode, input, signal) => {
      const data = assistantRecord(
        await transport.request(
          `/confirmations/${assistantPathSegment(confirmationCode, 'confirmationCode')}/approve`,
          { method: 'POST', body: { ...input }, signal },
        ),
        'Approve confirmation data',
      );
      return parseAssistantConfirmation(data.confirmation);
    },
    getConfirmation: async (confirmationCode, signal) => {
      const data = assistantRecord(
        await transport.request(
          `/confirmations/${assistantPathSegment(confirmationCode, 'confirmationCode')}`,
          { signal },
        ),
        'Get confirmation data',
      );
      return parseAssistantConfirmation(data.confirmation);
    },
    rejectConfirmation: async (confirmationCode, input, signal) => {
      const data = assistantRecord(
        await transport.request(
          `/confirmations/${assistantPathSegment(confirmationCode, 'confirmationCode')}/reject`,
          { method: 'POST', body: { ...input }, signal },
        ),
        'Reject confirmation data',
      );
      return parseAssistantConfirmation(data.confirmation);
    },
    executeConfirmation: async (confirmationCode, signal) =>
      Object.freeze({
        ...assistantRecord(
          await transport.request(
            `/confirmations/${assistantPathSegment(confirmationCode, 'confirmationCode')}/execute`,
            { method: 'POST', body: {}, signal },
          ),
          'Execute confirmation data',
        ),
      }),
    getKnowledgeStatus: async (signal) =>
      parseAssistantKnowledgeStatus(
        await transport.request('/knowledge/status', { signal }),
      ),
    refreshKnowledgeSource: async (sourceCode, signal) => {
      await transport.request(
        `/knowledge/sources/${assistantPathSegment(sourceCode, 'sourceCode')}/refresh`,
        { method: 'POST', body: {}, signal },
      );
      return parseAssistantKnowledgeStatus(
        await transport.request('/knowledge/status', { signal }),
      );
    },
  };
  return Object.freeze(client);
}
