import { describe, expect, it } from 'vitest';

import type {
  AssistantConversation,
  AssistantTurn,
  AssistantTurnEvent,
} from '../../../src/assistant/api/assistantContracts';
import {
  assistantPresentationReducer,
  initialAssistantPresentationState,
} from '../../../src/assistant/presentation/assistantPresentationReducer';

const scope = { enterpriseCode: 'default', employeeId: 'employee-a' };
const conversation: AssistantConversation = {
  conversationCode: 'conversation-1',
  definitionCode: 'axisAssistant',
  state: 'ACTIVE',
  lastSequence: 0,
};
const turn: AssistantTurn = {
  conversationCode: 'conversation-1',
  turnCode: 'turn-1',
  state: 'ACCEPTED',
};

function event(
  sequence: number,
  eventType: AssistantTurnEvent['eventType'],
  data: Readonly<Record<string, unknown>> = {},
): AssistantTurnEvent {
  return {
    eventCode: `turn-1-${sequence}`,
    conversationCode: 'conversation-1',
    turnCode: 'turn-1',
    eventType,
    sequence,
    createdAt: '2026-07-25T00:00:00.000Z',
    data,
  };
}

function streamingState() {
  let state = initialAssistantPresentationState(scope);
  state = assistantPresentationReducer(state, {
    type: 'CONVERSATION_RECEIVED',
    conversation,
  });
  return assistantPresentationReducer(state, {
    type: 'TURN_RECEIVED',
    conversation,
    turn,
    message: 'Hello',
  });
}

describe('Assistant presentation reducer', () => {
  it('refreshes the conversation list with the backend-owned title after the first turn', () => {
    let state = initialAssistantPresentationState(scope);
    state = assistantPresentationReducer(state, {
      type: 'CONVERSATION_RECEIVED',
      conversation,
    });
    state = assistantPresentationReducer(state, {
      type: 'TURN_RECEIVED',
      conversation: { ...conversation, title: 'What is Nodics framework?' },
      turn,
      message: 'What is Nodics framework?',
    });
    expect(state.availableConversations[0]?.title).toBe('What is Nodics framework?');
  });

  it('projects ordered deltas and terminal metadata without losing raw events', () => {
    let state = streamingState();
    state = assistantPresentationReducer(state, {
      type: 'STREAM_EVENT',
      event: event(1, 'TEXT_DELTA', { delta: 'Hello ' }),
    });
    state = assistantPresentationReducer(state, {
      type: 'STREAM_EVENT',
      event: event(2, 'TEXT_DELTA', { delta: 'world' }),
    });
    state = assistantPresentationReducer(state, {
      type: 'STREAM_EVENT',
      event: event(3, 'CITATIONS', {
        citations: [{ citationId: 'guide-1', title: 'Guide' }],
      }),
    });
    state = assistantPresentationReducer(state, {
      type: 'STREAM_EVENT',
      event: event(4, 'COMPLETED'),
    });

    const active = state.conversations['conversation-1'];
    expect(active?.streamedText).toBe('Hello world');
    expect(active?.citations).toEqual([{ citationId: 'guide-1', title: 'Guide' }]);
    expect(active?.events).toHaveLength(4);
    expect(state.status).toBe('COMPLETED');
  });

  it('ignores duplicates and rejects gaps, stale turns, and cross-conversation events', () => {
    const first = event(1, 'STATUS', { state: 'thinking' });
    let state = assistantPresentationReducer(streamingState(), {
      type: 'STREAM_EVENT',
      event: first,
    });
    const unchanged = assistantPresentationReducer(state, {
      type: 'STREAM_EVENT',
      event: first,
    });
    expect(unchanged).toBe(state);

    state = assistantPresentationReducer(state, {
      type: 'STREAM_EVENT',
      event: event(3, 'COMPLETED'),
    });
    expect(state.status).toBe('FAILED');
    expect(state.error).toMatch(/sequence/);

    const foreign = { ...event(2, 'COMPLETED'), conversationCode: 'another' };
    expect(
      assistantPresentationReducer(streamingState(), {
        type: 'STREAM_EVENT',
        event: foreign,
      }),
    ).toEqual(streamingState());
  });

  it('fully clears employee-scoped state on reset', () => {
    const state = assistantPresentationReducer(streamingState(), {
      type: 'RESET',
      scope: { enterpriseCode: 'other', employeeId: 'employee-b' },
    });
    expect(state.scope).toEqual({
      enterpriseCode: 'other',
      employeeId: 'employee-b',
    });
    expect(state.conversations).toEqual({});
    expect(state.status).toBe('IDLE');
  });

  it('fails closed when confirmation event data does not match the contract', () => {
    const state = assistantPresentationReducer(streamingState(), {
      type: 'STREAM_EVENT',
      event: event(1, 'CONFIRMATION_REQUIRED', { state: 'PENDING' }),
    });
    expect(state.status).toBe('FAILED');
    expect(state.error).toBe('Assistant event data is invalid');
  });

  it('projects safe tool lifecycle and normalized usage without raw tool results', () => {
    let state = streamingState();
    const identity = {
      toolId: 'profile.employee.read',
      ownerModule: 'profile',
      operationId: 'profile_employee_get',
    };
    state = assistantPresentationReducer(state, {
      type: 'STREAM_EVENT',
      event: event(1, 'TOOL_PLAN', identity),
    });
    state = assistantPresentationReducer(state, {
      type: 'STREAM_EVENT',
      event: event(2, 'TOOL_STARTED', identity),
    });
    state = assistantPresentationReducer(state, {
      type: 'STREAM_EVENT',
      event: event(3, 'TOOL_RESULT', {
        ...identity,
        outcome: 'SUCCEEDED',
        resultKeys: ['employeeCode'],
      }),
    });
    state = assistantPresentationReducer(state, {
      type: 'STREAM_EVENT',
      event: event(4, 'USAGE', {
        phase: 'ANSWER',
        usage: { inputTokens: 12, outputTokens: 4 },
        reconciliation: { state: 'RECONCILED', reservationId: 'private-id' },
      }),
    });

    const active = state.conversations['conversation-1'];
    expect(active?.toolActivity).toEqual({ ...identity, state: 'SUCCEEDED' });
    expect(active?.usage).toEqual({
      phase: 'ANSWER',
      inputTokens: 12,
      outputTokens: 4,
      cachedInputTokens: 0,
      reasoningTokens: 0,
      embeddingTokens: 0,
      reconciliationState: 'RECONCILED',
    });
    expect(JSON.stringify(active?.usage)).not.toContain('private-id');
  });

  it('rejects malformed citations, usage, and tool outcomes', () => {
    for (const invalid of [
      event(1, 'CITATIONS', { citations: [{ title: 'Missing identity' }] }),
      event(1, 'USAGE', { usage: { inputTokens: -1 } }),
      event(1, 'TOOL_RESULT', {
        toolId: 'tool',
        ownerModule: 'profile',
        operationId: 'operation',
        outcome: 'UNKNOWN',
      }),
    ]) {
      const state = assistantPresentationReducer(streamingState(), {
        type: 'STREAM_EVENT',
        event: invalid,
      });
      expect(state.status).toBe('FAILED');
      expect(state.error).toBe('Assistant event data is invalid');
    }
  });

  it('loads persisted history and prepends older pages without mixing conversations', () => {
    let state = initialAssistantPresentationState(scope);
    state = assistantPresentationReducer(state, {
      type: 'CONVERSATIONS_RECEIVED',
      conversations: [conversation],
      page: 1,
      limit: 50,
      append: false,
    });
    state = assistantPresentationReducer(state, {
      type: 'HISTORY_RECEIVED',
      append: false,
      history: {
        conversation,
        page: 1,
        limit: 1,
        items: [
          {
            turn,
            messages: [
              { role: 'user', content: 'Recent question', sequence: 3 },
              { role: 'assistant', content: 'Recent answer', sequence: 4 },
            ],
          },
        ],
      },
    });
    state = assistantPresentationReducer(state, {
      type: 'HISTORY_RECEIVED',
      append: true,
      history: {
        conversation,
        page: 2,
        limit: 1,
        items: [
          {
            turn: { ...turn, turnCode: 'turn-older' },
            messages: [
              { role: 'user', content: 'Older question', sequence: 1 },
              { role: 'assistant', content: 'Older answer', sequence: 2 },
            ],
          },
        ],
      },
    });

    expect(
      state.conversations['conversation-1']?.history.flatMap((entry) =>
        entry.messages.map((message) => message.content),
      ),
    ).toEqual(['Older question', 'Older answer', 'Recent question', 'Recent answer']);
    expect(state.availableConversations).toHaveLength(1);
  });

  it('restores safe structured interactions and confirmation state after reload', () => {
    const confirmation = {
      confirmationCode: 'confirmation-1',
      conversationCode: 'conversation-1',
      operationId: 'profile_createenterprise',
      state: 'APPROVED',
      argumentsDigest: 'a'.repeat(64),
      revision: 1,
      expiresAt: '2099-01-01T00:00:00.000Z',
      impact: { summary: 'Create enterprise Acme' },
    };
    const state = assistantPresentationReducer(
      initialAssistantPresentationState(scope),
      {
        type: 'HISTORY_RECEIVED',
        append: false,
        history: {
          conversation,
          page: 1,
          limit: 20,
          confirmations: [confirmation],
          items: [
            {
              turn,
              messages: [{ role: 'user', content: 'Create Acme', sequence: 1 }],
              interactions: [
                event(2, 'TOOL_RESULT', {
                  toolId: 'profile.enterprise.create',
                  ownerModule: 'profile',
                  operationId: 'profile_createenterprise',
                  outcome: 'SUCCEEDED',
                }),
                event(3, 'CITATIONS', {
                  citations: [
                    {
                      citationId: 'guide-1',
                      title: 'Enterprise guide',
                      navigationType: 'INTERNAL_ROUTE',
                      navigationTarget: '/guides/enterprise',
                    },
                  ],
                }),
                event(4, 'USAGE', {
                  usage: { inputTokens: 8, outputTokens: 3 },
                  reconciliation: { state: 'RECONCILED' },
                }),
              ],
            },
          ],
        },
      },
    );

    const active = state.conversations['conversation-1'];
    expect(active?.confirmation).toEqual(confirmation);
    expect(active?.toolActivity?.state).toBe('SUCCEEDED');
    expect(active?.citations?.[0]?.navigationTarget).toBe('/guides/enterprise');
    expect(active?.usage?.inputTokens).toBe(8);
  });
});
