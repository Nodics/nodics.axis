import type { AssistantTurnEvent } from '../api/assistantContracts';
import {
  parseAssistantCitations,
  parseAssistantConfirmation,
  parseAssistantToolActivity,
  parseAssistantUsage,
  parseAssistantExportArtifact,
} from '../api/assistantContractParsers';
import type {
  AssistantConversationPresentation,
  AssistantPresentationAction,
  AssistantPresentationScope,
  AssistantPresentationState,
  AssistantPresentationStatus,
} from './assistantPresentationContracts';

export function initialAssistantPresentationState(
  scope: AssistantPresentationScope,
): AssistantPresentationState {
  return Object.freeze({
    scope: Object.freeze({ ...scope }),
    status: 'IDLE',
    availableConversations: Object.freeze([]),
    conversationPage: 0,
    conversationsHaveMore: false,
    historyLoading: false,
    conversations: Object.freeze({}),
  });
}

export function assistantPresentationReducer(
  state: AssistantPresentationState,
  action: AssistantPresentationAction,
): AssistantPresentationState {
  switch (action.type) {
    case 'RESET':
      return initialAssistantPresentationState(action.scope);
    case 'CONVERSATION_CREATING':
      return updateState(state, {
        status: 'CREATING_CONVERSATION',
        error: undefined,
      });
    case 'CONVERSATIONS_RECEIVED':
      return updateState(state, {
        availableConversations: mergeConversations(
          action.append ? state.availableConversations : [],
          action.conversations,
        ),
        conversationPage: action.page,
        conversationsHaveMore: action.conversations.length === action.limit,
      });
    case 'CONVERSATION_RECEIVED':
      return updateConversation(
        updateState(state, {
          activeConversationCode: action.conversation.conversationCode,
          status: 'READY',
          availableConversations: upsertConversation(
            state.availableConversations,
            action.conversation,
          ),
          error: undefined,
        }),
        action.conversation.conversationCode,
        createConversationPresentation(action.conversation),
      );
    case 'CONVERSATION_SELECTED':
      return state.conversations[action.conversationCode]
        ? updateState(state, {
            activeConversationCode: action.conversationCode,
            status: statusFor(state.conversations[action.conversationCode], 'READY'),
            error: undefined,
          })
        : state;
    case 'NEW_CONVERSATION':
      return updateState(state, {
        activeConversationCode: undefined,
        status: 'IDLE',
        historyLoading: false,
        error: undefined,
      });
    case 'HISTORY_LOADING':
      return updateState(state, {
        activeConversationCode: action.conversationCode,
        historyLoading: true,
        error: undefined,
      });
    case 'HISTORY_RECEIVED':
      return historyReceived(state, action.history, action.append);
    case 'TURN_SUBMITTING': {
      const current = state.conversations[action.conversationCode];
      if (!current) return state;
      return updateConversation(
        updateState(state, {
          activeConversationCode: action.conversationCode,
          status: 'SUBMITTING',
          error: undefined,
        }),
        action.conversationCode,
        Object.freeze({
          ...current,
          submittedMessage: action.message,
        }),
      );
    }
    case 'TURN_RECEIVED': {
      const current =
        state.conversations[action.conversation.conversationCode] ??
        createConversationPresentation(action.conversation);
      return updateConversation(
        updateState(state, {
          activeConversationCode: action.conversation.conversationCode,
          status: 'STREAMING',
          availableConversations: upsertConversation(
            state.availableConversations,
            action.conversation,
          ),
          error: undefined,
        }),
        action.conversation.conversationCode,
        Object.freeze({
          ...current,
          conversation: action.conversation,
          turn: action.turn,
          submittedMessage: action.message,
          events: Object.freeze([]),
          lastSequence: 0,
          streamedText: '',
          statusData: undefined,
          clarification: undefined,
          toolActivity: undefined,
          confirmation: undefined,
          citations: undefined,
          usage: undefined,
          exportArtifact: undefined,
          failure: undefined,
        }),
      );
    }
    case 'STREAM_EVENT':
      return reduceStreamEvent(state, action.event);
    case 'CONFIRMATION_UPDATED': {
      const current = state.conversations[action.conversationCode];
      return current
        ? updateConversation(
            state,
            action.conversationCode,
            Object.freeze({ ...current, confirmation: action.confirmation }),
          )
        : state;
    }
    case 'CONFIRMATION_EXECUTED': {
      const current = state.conversations[action.conversationCode];
      return current
        ? updateConversation(
            state,
            action.conversationCode,
            Object.freeze({ ...current, confirmationResult: action.result }),
          )
        : state;
    }
    case 'TURN_CANCELLING':
      return state.conversations[action.conversationCode]
        ? updateState(state, {
            activeConversationCode: action.conversationCode,
            status: 'CANCELLING',
            error: undefined,
          })
        : state;
    case 'FAILED':
      return updateState(state, { status: 'FAILED', error: action.message });
  }
}

function historyReceived(
  state: AssistantPresentationState,
  history: import('../api/assistantContracts').AssistantConversationHistory,
  append: boolean,
): AssistantPresentationState {
  const conversationCode = history.conversation.conversationCode;
  const existing = state.conversations[conversationCode];
  const combinedHistory = append
    ? [...history.items, ...(existing?.history ?? [])]
    : [...history.items];
  let presentation: AssistantConversationPresentation = Object.freeze({
    ...createConversationPresentation(history.conversation),
    history: Object.freeze(combinedHistory),
    historyPage: history.page,
    historyHasMore: history.items.length === history.limit,
  });
  try {
    for (const entry of combinedHistory) {
      for (const event of entry.interactions ?? []) {
        presentation = applyEvent(presentation, event);
      }
    }
    const latestConfirmation = history.confirmations?.[0];
    if (latestConfirmation) {
      presentation = Object.freeze({
        ...presentation,
        confirmation: latestConfirmation,
      });
    }
  } catch {
    return updateState(state, {
      historyLoading: false,
      status: 'FAILED',
      error: 'Assistant history interaction data is invalid',
    });
  }
  return updateConversation(
    updateState(state, {
      activeConversationCode: conversationCode,
      availableConversations: upsertConversation(
        state.availableConversations,
        history.conversation,
      ),
      historyLoading: false,
      status: 'READY',
      error: undefined,
    }),
    conversationCode,
    presentation,
  );
}

function reduceStreamEvent(
  state: AssistantPresentationState,
  event: AssistantTurnEvent,
): AssistantPresentationState {
  const current = state.conversations[event.conversationCode];
  if (!current || current.turn?.turnCode !== event.turnCode) return state;
  const previousEvent = current.events[current.events.length - 1];
  const previousSequence = previousEvent?.sequence ?? 0;
  if (event.sequence <= previousSequence) return state;
  if (event.sequence !== previousSequence + 1) {
    return updateState(state, {
      status: 'FAILED',
      error: 'Assistant event sequence is incomplete',
    });
  }

  let next: AssistantConversationPresentation;
  try {
    next = applyEvent(
      Object.freeze({
        ...current,
        events: Object.freeze([...current.events, event]),
        lastSequence: event.sequence,
      }),
      event,
    );
  } catch {
    return updateState(state, {
      status: 'FAILED',
      error: 'Assistant event data is invalid',
    });
  }
  const withHistory = terminalEvent(event) ? appendCurrentHistory(next) : next;
  return updateConversation(
    updateState(state, {
      status: statusForEvent(event),
      error:
        event.eventType === 'FAILED'
          ? (eventMessage(event.data) ?? 'Assistant turn failed')
          : undefined,
    }),
    event.conversationCode,
    withHistory,
  );
}

function applyEvent(
  current: AssistantConversationPresentation,
  event: AssistantTurnEvent,
): AssistantConversationPresentation {
  switch (event.eventType) {
    case 'TEXT_DELTA':
      return Object.freeze({
        ...current,
        streamedText: current.streamedText + eventText(event.data),
      });
    case 'STATUS':
      return Object.freeze({ ...current, statusData: event.data });
    case 'CLARIFICATION':
      return Object.freeze({ ...current, clarification: event.data });
    case 'TOOL_PLAN':
      return Object.freeze({
        ...current,
        toolActivity: parseAssistantToolActivity(event.data, 'PLANNED'),
      });
    case 'TOOL_STARTED':
      return Object.freeze({
        ...current,
        toolActivity: parseAssistantToolActivity(event.data, 'RUNNING'),
      });
    case 'TOOL_RESULT':
      return Object.freeze({
        ...current,
        toolActivity: parseAssistantToolActivity(
          event.data,
          toolResultState(event.data.outcome),
        ),
      });
    case 'CONFIRMATION_REQUIRED':
      return Object.freeze({
        ...current,
        confirmation: parseAssistantConfirmation(event.data.confirmation ?? event.data),
      });
    case 'CITATIONS':
      return Object.freeze({
        ...current,
        citations: parseAssistantCitations(event.data),
      });
    case 'USAGE':
      return Object.freeze({ ...current, usage: parseAssistantUsage(event.data) });
    case 'EXPORT_READY':
      return Object.freeze({
        ...current,
        exportArtifact: parseAssistantExportArtifact(event.data),
      });
    case 'FAILED':
      return Object.freeze({ ...current, failure: event.data });
    default:
      return current;
  }
}

function toolResultState(value: unknown): 'SUCCEEDED' | 'FAILED' {
  if (value === 'SUCCEEDED' || value === 'FAILED') return value;
  throw new Error('Assistant tool outcome is unsupported');
}

function createConversationPresentation(
  conversation: AssistantConversationPresentation['conversation'],
): AssistantConversationPresentation {
  return Object.freeze({
    conversation,
    history: Object.freeze([]),
    historyPage: 0,
    historyHasMore: false,
    events: Object.freeze([]),
    lastSequence: 0,
    streamedText: '',
  });
}

function appendCurrentHistory(
  current: AssistantConversationPresentation,
): AssistantConversationPresentation {
  if (!current.turn || !current.submittedMessage) return current;
  if (current.history.some((entry) => entry.turn.turnCode === current.turn?.turnCode)) {
    return current;
  }
  const messages = [
    {
      role: 'user' as const,
      content: current.submittedMessage,
      sequence: 0,
    },
    ...(current.streamedText
      ? [
          {
            role: 'assistant' as const,
            content: current.streamedText,
            sequence: 1,
          },
        ]
      : []),
  ];
  return Object.freeze({
    ...current,
    history: Object.freeze([
      ...current.history,
      Object.freeze({
        turn: current.turn,
        messages: Object.freeze(messages),
        interactions: Object.freeze([]),
      }),
    ]),
  });
}

function terminalEvent(event: AssistantTurnEvent): boolean {
  return ['COMPLETED', 'CANCELLED', 'FAILED'].includes(event.eventType);
}

function upsertConversation(
  conversations: readonly AssistantConversationPresentation['conversation'][],
  conversation: AssistantConversationPresentation['conversation'],
) {
  return Object.freeze([
    conversation,
    ...conversations.filter(
      (current) => current.conversationCode !== conversation.conversationCode,
    ),
  ]);
}

function mergeConversations(
  current: readonly AssistantConversationPresentation['conversation'][],
  incoming: readonly AssistantConversationPresentation['conversation'][],
) {
  const merged = [...current];
  incoming.forEach((conversation) => {
    const index = merged.findIndex(
      (item) => item.conversationCode === conversation.conversationCode,
    );
    if (index >= 0) merged[index] = conversation;
    else merged.push(conversation);
  });
  return Object.freeze(merged);
}

function updateConversation(
  state: AssistantPresentationState,
  conversationCode: string,
  value: AssistantConversationPresentation,
): AssistantPresentationState {
  return Object.freeze({
    ...state,
    conversations: Object.freeze({
      ...state.conversations,
      [conversationCode]: value,
    }),
  });
}

function updateState(
  state: AssistantPresentationState,
  values: Partial<AssistantPresentationState>,
): AssistantPresentationState {
  return Object.freeze({ ...state, ...values });
}

function statusFor(
  conversation: AssistantConversationPresentation | undefined,
  fallback: AssistantPresentationStatus,
): AssistantPresentationStatus {
  if (!conversation?.turn) return fallback;
  if (conversation.turn.state === 'COMPLETED') return 'COMPLETED';
  if (conversation.turn.state === 'CANCELLED') return 'CANCELLED';
  if (conversation.turn.state === 'FAILED') return 'FAILED';
  return 'READY';
}

function statusForEvent(event: AssistantTurnEvent): AssistantPresentationStatus {
  if (event.eventType === 'COMPLETED') return 'COMPLETED';
  if (event.eventType === 'CANCELLED') return 'CANCELLED';
  if (event.eventType === 'FAILED') return 'FAILED';
  return 'STREAMING';
}

function eventText(data: Readonly<Record<string, unknown>>): string {
  const value = data.delta ?? data.text;
  return typeof value === 'string' ? value : '';
}

function eventMessage(data: Readonly<Record<string, unknown>>): string | undefined {
  const value = data.message;
  return typeof value === 'string' && value.trim() ? value : undefined;
}
