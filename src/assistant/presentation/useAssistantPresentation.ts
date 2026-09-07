import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import type { AssistantClient } from '../api/assistantClient';
import type {
  AssistantEventStreamConfiguration,
  StreamAssistantTurnInput,
} from '../api/assistantEventStream';
import { streamAssistantTurn } from '../api/assistantEventStream';
import type { AssistantPresentationScope } from './assistantPresentationContracts';
import {
  assistantPresentationReducer,
  initialAssistantPresentationState,
} from './assistantPresentationReducer';

type AssistantStreamStarter = (
  configuration: AssistantEventStreamConfiguration,
  input: StreamAssistantTurnInput,
) => Promise<void>;

export interface UseAssistantPresentationConfiguration {
  readonly scope: AssistantPresentationScope;
  readonly client: AssistantClient;
  readonly streamConfiguration: AssistantEventStreamConfiguration;
  readonly definitionCode: string;
  readonly stream?: AssistantStreamStarter | undefined;
}

export function useAssistantPresentation(
  configuration: UseAssistantPresentationConfiguration,
) {
  const [state, dispatch] = useReducer(
    assistantPresentationReducer,
    configuration.scope,
    initialAssistantPresentationState,
  );
  const streamAbort = useRef<AbortController | undefined>(undefined);
  const [knowledgeStatus, setKnowledgeStatus] = useState<import('../api/assistantContracts').AssistantKnowledgeStatus>();
  const [knowledgeLoading, setKnowledgeLoading] = useState(true);
  const [knowledgeError, setKnowledgeError] = useState<string>();
  const [refreshingKnowledgeSource, setRefreshingKnowledgeSource] = useState<string>();
  const enterpriseCode = configuration.scope.enterpriseCode;
  const employeeId = configuration.scope.employeeId;

  useEffect(() => {
    streamAbort.current?.abort();
    dispatch({ type: 'RESET', scope: { enterpriseCode, employeeId } });
    return () => streamAbort.current?.abort();
  }, [employeeId, enterpriseCode]);

  useEffect(() => {
    const controller = new AbortController();
    void configuration.client
      .listConversations({ page: 1, limit: 50 }, controller.signal)
      .then((result) =>
        dispatch({
          type: 'CONVERSATIONS_RECEIVED',
          conversations: result.items,
          page: result.page,
          limit: result.limit,
          append: false,
        }),
      )
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          dispatch({
            type: 'FAILED',
            message:
              error instanceof Error
                ? error.message
                : 'Assistant conversations could not be loaded',
          });
        }
      });
    return () => controller.abort();
  }, [configuration.client, employeeId, enterpriseCode]);

  useEffect(() => {
    if (!configuration.client.getKnowledgeStatus) {
      setKnowledgeLoading(false);
      return;
    }
    const controller = new AbortController();
    setKnowledgeLoading(true);
    setKnowledgeError(undefined);
    void configuration.client.getKnowledgeStatus(controller.signal)
      .then(setKnowledgeStatus)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setKnowledgeError(error instanceof Error ? error.message : 'Knowledge status could not be loaded');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setKnowledgeLoading(false);
      });
    return () => controller.abort();
  }, [configuration.client, employeeId, enterpriseCode]);

  const refreshKnowledgeSource = useCallback(async (sourceCode: string) => {
    if (!configuration.client.refreshKnowledgeSource) return;
    setRefreshingKnowledgeSource(sourceCode);
    setKnowledgeError(undefined);
    try {
      setKnowledgeStatus(await configuration.client.refreshKnowledgeSource(sourceCode));
    } catch (error: unknown) {
      setKnowledgeError(error instanceof Error ? error.message : 'Knowledge source could not be refreshed');
    } finally {
      setRefreshingKnowledgeSource(undefined);
    }
  }, [configuration.client]);

  const submit = useCallback(
    async (message: string) => {
      if (['SUBMITTING', 'STREAMING', 'CANCELLING'].includes(state.status)) return;
      const normalizedMessage = message.trim();
      if (!normalizedMessage) return;
      try {
        let conversationCode = state.activeConversationCode;
        if (!conversationCode) {
          dispatch({ type: 'CONVERSATION_CREATING' });
          const conversation = await configuration.client.createConversation({
            definitionCode: configuration.definitionCode,
          });
          conversationCode = conversation.conversationCode;
          dispatch({ type: 'CONVERSATION_RECEIVED', conversation });
        }
        dispatch({
          type: 'TURN_SUBMITTING',
          conversationCode,
          message: normalizedMessage,
        });
        const result = await configuration.client.submitTurn(conversationCode, {
          message: normalizedMessage,
          idempotencyKey: globalThis.crypto.randomUUID(),
        });
        dispatch({
          type: 'TURN_RECEIVED',
          conversation: result.conversation,
          turn: result.turn,
          message: normalizedMessage,
        });
        const controller = new AbortController();
        streamAbort.current?.abort();
        streamAbort.current = controller;
        await (configuration.stream ?? streamAssistantTurn)(
          configuration.streamConfiguration,
          {
            conversationCode,
            turnCode: result.turn.turnCode,
            signal: controller.signal,
            onEvent: (event) => dispatch({ type: 'STREAM_EVENT', event }),
          },
        );
      } catch (error: unknown) {
        dispatch({
          type: 'FAILED',
          message: error instanceof Error ? error.message : 'Assistant request failed',
        });
      }
    },
    [configuration, state.activeConversationCode, state.status],
  );

  const cancel = useCallback(async () => {
    const activeCode = state.activeConversationCode;
    const active = activeCode ? state.conversations[activeCode] : undefined;
    if (!activeCode || !active?.turn || state.status !== 'STREAMING') return;
    dispatch({ type: 'TURN_CANCELLING', conversationCode: activeCode });
    try {
      await configuration.client.cancelTurn(activeCode, active.turn.turnCode);
    } catch (error: unknown) {
      dispatch({
        type: 'FAILED',
        message: error instanceof Error ? error.message : 'Assistant cancel failed',
      });
    }
  }, [configuration.client, state]);

  const selectConversation = useCallback(
    async (conversationCode: string) => {
      streamAbort.current?.abort();
      dispatch({ type: 'HISTORY_LOADING', conversationCode });
      try {
        const history =
          await configuration.client.getConversationHistory(conversationCode);
        dispatch({ type: 'HISTORY_RECEIVED', history, append: false });
      } catch (error: unknown) {
        dispatch({
          type: 'FAILED',
          message:
            error instanceof Error
              ? error.message
              : 'Assistant history could not be loaded',
        });
      }
    },
    [configuration.client],
  );

  const newConversation = useCallback(() => {
    streamAbort.current?.abort();
    dispatch({ type: 'NEW_CONVERSATION' });
  }, []);

  const loadMoreConversations = useCallback(async () => {
    if (!state.conversationsHaveMore) return;
    try {
      const result = await configuration.client.listConversations({
        page: state.conversationPage + 1,
        limit: 50,
      });
      dispatch({
        type: 'CONVERSATIONS_RECEIVED',
        conversations: result.items,
        page: result.page,
        limit: result.limit,
        append: true,
      });
    } catch (error: unknown) {
      dispatch({
        type: 'FAILED',
        message:
          error instanceof Error
            ? error.message
            : 'Assistant conversations could not be loaded',
      });
    }
  }, [configuration.client, state.conversationPage, state.conversationsHaveMore]);

  const loadMoreHistory = useCallback(async () => {
    const code = state.activeConversationCode;
    const active = code ? state.conversations[code] : undefined;
    if (!code || !active?.historyHasMore) return;
    try {
      const history = await configuration.client.getConversationHistory(
        code,
        active.historyPage + 1,
      );
      dispatch({ type: 'HISTORY_RECEIVED', history, append: true });
    } catch (error: unknown) {
      dispatch({
        type: 'FAILED',
        message:
          error instanceof Error
            ? error.message
            : 'Assistant history could not be loaded',
      });
    }
  }, [configuration.client, state.activeConversationCode, state.conversations]);

  const approveConfirmation = useCallback(async () => {
    const code = state.activeConversationCode;
    const confirmation = code ? state.conversations[code]?.confirmation : undefined;
    if (!code || !confirmation || confirmation.state !== 'PENDING') return;
    try {
      const approved = await configuration.client.approveConfirmation(
        confirmation.confirmationCode,
        {
          expectedRevision: confirmation.revision,
          argumentsDigest: confirmation.argumentsDigest,
        },
      );
      dispatch({
        type: 'CONFIRMATION_UPDATED',
        conversationCode: code,
        confirmation: approved,
      });
    } catch (error: unknown) {
      dispatch({
        type: 'FAILED',
        message:
          error instanceof Error ? error.message : 'Assistant confirmation failed',
      });
    }
  }, [configuration.client, state.activeConversationCode, state.conversations]);

  const executeConfirmation = useCallback(async () => {
    const code = state.activeConversationCode;
    const confirmation = code ? state.conversations[code]?.confirmation : undefined;
    if (!code || !confirmation || confirmation.state !== 'APPROVED') return;
    try {
      const result = await configuration.client.executeConfirmation(
        confirmation.confirmationCode,
      );
      dispatch({
        type: 'CONFIRMATION_EXECUTED',
        conversationCode: code,
        result,
      });
    } catch (error: unknown) {
      dispatch({
        type: 'FAILED',
        message: error instanceof Error ? error.message : 'Assistant execution failed',
      });
    }
  }, [configuration.client, state.activeConversationCode, state.conversations]);

  const rejectConfirmation = useCallback(async () => {
    const code = state.activeConversationCode;
    const confirmation = code ? state.conversations[code]?.confirmation : undefined;
    if (
      !code ||
      !confirmation ||
      !['PENDING', 'APPROVED'].includes(confirmation.state)
    ) {
      return;
    }
    try {
      const rejected = await configuration.client.rejectConfirmation(
        confirmation.confirmationCode,
        {
          expectedRevision: confirmation.revision,
          argumentsDigest: confirmation.argumentsDigest,
        },
      );
      dispatch({
        type: 'CONFIRMATION_UPDATED',
        conversationCode: code,
        confirmation: rejected,
      });
    } catch (error: unknown) {
      dispatch({
        type: 'FAILED',
        message: error instanceof Error ? error.message : 'Assistant rejection failed',
      });
    }
  }, [configuration.client, state.activeConversationCode, state.conversations]);

  return {
    state,
    submit,
    cancel,
    selectConversation,
    newConversation,
    loadMoreConversations,
    loadMoreHistory,
    approveConfirmation,
    rejectConfirmation,
    executeConfirmation,
    knowledgeStatus,
    knowledgeLoading,
    knowledgeError,
    refreshingKnowledgeSource,
    refreshKnowledgeSource,
  } as const;
}
