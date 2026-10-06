import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AssistantClient } from '../../../src/assistant/api/assistantClient';
import type {
  AssistantEventStreamConfiguration,
  StreamAssistantTurnInput,
} from '../../../src/assistant/api/assistantEventStream';
import { useAssistantPresentation } from '../../../src/assistant/presentation/useAssistantPresentation';

const conversation = {
  conversationCode: 'conversation-1',
  definitionCode: 'axisAssistant',
  state: 'ACTIVE',
  lastSequence: 0,
};
const turn = {
  turnCode: 'turn-1',
  conversationCode: 'conversation-1',
  state: 'ACCEPTED' as const,
};
const streamConfiguration: AssistantEventStreamConfiguration = {
  moduleBaseUrl: 'https://assistant.example.com/nodics/aiAssistant',
  enterpriseCode: 'default',
  accessToken: 'memory-only-token',
  timeoutMs: 10_000,
  maximumEventBytes: 4096,
  reconnectWindowMs: 120_000,
  idleTimeoutMs: 45_000,
};

function client() {
  const createConversation = vi.fn().mockResolvedValue(conversation);
  const submitTurn = vi.fn().mockResolvedValue({ conversation, turn });
  const cancelTurn = vi.fn();
  const getConversationHistory = vi.fn();
  const approveConfirmation = vi.fn();
  const getConfirmation = vi.fn();
  const rejectConfirmation = vi.fn();
  const executeConfirmation = vi.fn();
  const value: AssistantClient = {
    createConversation,
    listConversations: vi.fn().mockResolvedValue({ page: 1, limit: 50, items: [] }),
    getConversation: vi.fn(),
    getConversationHistory,
    submitTurn,
    getTurn: vi.fn(),
    replayEvents: vi.fn(),
    cancelTurn,
    approveConfirmation,
    getConfirmation,
    rejectConfirmation,
    executeConfirmation,
  };
  return {
    value,
    createConversation,
    submitTurn,
    cancelTurn,
    getConversationHistory,
    approveConfirmation,
    executeConfirmation,
  };
}

describe('Assistant presentation controller', () => {
  it('consumes request-only delivery without opening a durable event stream', async () => {
    const assistantClient = client(),
      stream = vi.fn();
    assistantClient.submitTurn.mockResolvedValue({
      conversation,
      turn: {
        ...turn,
        recording: { enabled: false, version: '2', notice: 'Content not recorded' },
      },
      delivery: [
        {
          eventCode: 'one',
          conversationCode: conversation.conversationCode,
          turnCode: turn.turnCode,
          sequence: 1,
          eventType: 'TEXT_DELTA',
          data: { text: 'Transient answer' },
        },
        {
          eventCode: 'two',
          conversationCode: conversation.conversationCode,
          turnCode: turn.turnCode,
          sequence: 2,
          eventType: 'COMPLETED',
          data: {},
        },
      ],
    });
    const { result } = renderHook(() =>
      useAssistantPresentation({
        scope: { enterpriseCode: 'default', employeeId: 'employee' },
        client: assistantClient.value,
        streamConfiguration,
        definitionCode: 'axisAssistant',
        stream,
      }),
    );
    await act(() => result.current.submit('Question'));
    expect(stream).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe('COMPLETED');
    expect(result.current.state.conversations['conversation-1']?.streamedText).toBe(
      'Transient answer',
    );
  });
  it('creates a conversation, submits a turn, and reduces the streamed result', async () => {
    const assistantClient = client();
    const stream = vi.fn(
      (
        _configuration: AssistantEventStreamConfiguration,
        input: StreamAssistantTurnInput,
      ) => {
        input.onEvent({
          eventCode: 'turn-1-1',
          conversationCode: 'conversation-1',
          turnCode: 'turn-1',
          eventType: 'TEXT_DELTA',
          sequence: 1,
          createdAt: '2026-07-25T00:00:00.000Z',
          data: { delta: 'Done' },
        });
        input.onEvent({
          eventCode: 'turn-1-2',
          conversationCode: 'conversation-1',
          turnCode: 'turn-1',
          eventType: 'COMPLETED',
          sequence: 2,
          createdAt: '2026-07-25T00:00:01.000Z',
          data: {},
        });
        return Promise.resolve();
      },
    );
    const { result } = renderHook(() =>
      useAssistantPresentation({
        scope: { enterpriseCode: 'default', employeeId: 'employee-a' },
        client: assistantClient.value,
        streamConfiguration,
        definitionCode: 'axisAssistant',
        knowledgeGroupCodes: ['framework'],
        stream,
      }),
    );

    await act(() => result.current.submit('Create an enterprise'));

    expect(assistantClient.createConversation).toHaveBeenCalledWith({
      definitionCode: 'axisAssistant',
    });
    expect(assistantClient.submitTurn).toHaveBeenCalledWith(
      'conversation-1',
      expect.objectContaining({
        message: 'Create an enterprise',
        knowledgeGroupCodes: ['framework'],
      }),
    );
    expect(stream).toHaveBeenCalledOnce();
    expect(result.current.state.status).toBe('COMPLETED');
    expect(result.current.state.conversations['conversation-1']?.streamedText).toBe(
      'Done',
    );
  });

  it('does not submit blank input or overlap an active turn', async () => {
    const assistantClient = client();
    let release: (() => void) | undefined;
    const stream = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useAssistantPresentation({
        scope: { enterpriseCode: 'default', employeeId: 'employee-a' },
        client: assistantClient.value,
        streamConfiguration,
        definitionCode: 'axisAssistant',
        stream,
      }),
    );

    await act(() => result.current.submit('  '));
    expect(assistantClient.createConversation).not.toHaveBeenCalled();

    let first!: Promise<void>;
    act(() => {
      first = result.current.submit('First');
    });
    await act(async () => Promise.resolve());
    await act(() => result.current.submit('Second'));
    expect(assistantClient.submitTurn).toHaveBeenCalledTimes(1);
    await act(async () => {
      release?.();
      await first;
    });
  });

  it('loads a selected persisted conversation without using SSE events as history', async () => {
    const assistantClient = client();
    assistantClient.getConversationHistory.mockResolvedValue({
      conversation,
      page: 1,
      limit: 20,
      items: [
        {
          turn: { ...turn, state: 'COMPLETED' },
          messages: [
            { role: 'user', content: 'Persisted question', sequence: 1 },
            { role: 'assistant', content: 'Persisted answer', sequence: 2 },
          ],
        },
      ],
    });
    const { result } = renderHook(() =>
      useAssistantPresentation({
        scope: { enterpriseCode: 'default', employeeId: 'employee-a' },
        client: assistantClient.value,
        streamConfiguration,
        definitionCode: 'axisAssistant',
      }),
    );

    await act(() => result.current.selectConversation('conversation-1'));

    expect(assistantClient.getConversationHistory).toHaveBeenCalledWith(
      'conversation-1',
    );
    expect(
      result.current.state.conversations['conversation-1']?.history[0]?.messages[1]
        ?.content,
    ).toBe('Persisted answer');
  });

  it('approves and executes only the backend-bound active confirmation', async () => {
    const assistantClient = client();
    const pending = {
      confirmationCode: 'confirmation-1',
      conversationCode: 'conversation-1',
      operationId: 'profile_createenterprise',
      state: 'PENDING',
      argumentsDigest: 'digest-1',
      revision: 0,
      expiresAt: '2099-01-01T00:00:00.000Z',
      impact: { summary: 'Create enterprise acme' },
    };
    const approved = { ...pending, state: 'APPROVED', revision: 1 };
    assistantClient.approveConfirmation.mockResolvedValue(approved);
    assistantClient.executeConfirmation.mockResolvedValue({
      confirmationCode: 'confirmation-1',
      state: 'CONSUMED',
    });
    const stream = vi.fn(
      (
        _configuration: AssistantEventStreamConfiguration,
        input: StreamAssistantTurnInput,
      ) => {
        input.onEvent({
          eventCode: 'turn-1-1',
          conversationCode: 'conversation-1',
          turnCode: 'turn-1',
          eventType: 'CONFIRMATION_REQUIRED',
          sequence: 1,
          createdAt: '2026-07-25T00:00:00.000Z',
          data: { confirmation: pending },
        });
        input.onEvent({
          eventCode: 'turn-1-2',
          conversationCode: 'conversation-1',
          turnCode: 'turn-1',
          eventType: 'COMPLETED',
          sequence: 2,
          createdAt: '2026-07-25T00:00:01.000Z',
          data: {},
        });
        return Promise.resolve();
      },
    );
    const { result } = renderHook(() =>
      useAssistantPresentation({
        scope: { enterpriseCode: 'default', employeeId: 'employee-a' },
        client: assistantClient.value,
        streamConfiguration,
        definitionCode: 'axisAssistant',
        stream,
      }),
    );

    await act(() => result.current.submit('Create enterprise acme'));
    await act(() => result.current.approveConfirmation());
    expect(assistantClient.approveConfirmation).toHaveBeenCalledWith('confirmation-1', {
      expectedRevision: 0,
      argumentsDigest: 'digest-1',
    });

    await act(() => result.current.executeConfirmation());
    expect(assistantClient.executeConfirmation).toHaveBeenCalledWith('confirmation-1', {
      expectedRevision: approved.revision,
      argumentsDigest: approved.argumentsDigest,
    });
    expect(
      result.current.state.conversations['conversation-1']?.confirmationResult,
    ).toEqual({ confirmationCode: 'confirmation-1', state: 'CONSUMED' });
  });
});
