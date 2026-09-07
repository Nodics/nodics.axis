import type {
  AssistantConfirmation,
  AssistantCitation,
  AssistantConversation,
  AssistantConversationHistory,
  AssistantHistoryEntry,
  AssistantTurn,
  AssistantTurnEvent,
  AssistantToolActivity,
  AssistantUsage,
  AssistantExportArtifact,
} from '../api/assistantContracts';

export interface AssistantPresentationScope {
  readonly enterpriseCode: string;
  readonly employeeId: string;
}

export type AssistantPresentationStatus =
  | 'IDLE'
  | 'CREATING_CONVERSATION'
  | 'READY'
  | 'SUBMITTING'
  | 'STREAMING'
  | 'CANCELLING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export interface AssistantConversationPresentation {
  readonly conversation: AssistantConversation;
  readonly history: readonly AssistantHistoryEntry[];
  readonly historyPage: number;
  readonly historyHasMore: boolean;
  readonly turn?: AssistantTurn | undefined;
  readonly events: readonly AssistantTurnEvent[];
  readonly lastSequence: number;
  readonly submittedMessage?: string | undefined;
  readonly streamedText: string;
  readonly statusData?: Readonly<Record<string, unknown>> | undefined;
  readonly clarification?: Readonly<Record<string, unknown>> | undefined;
  readonly toolActivity?: AssistantToolActivity | undefined;
  readonly confirmation?: AssistantConfirmation | undefined;
  readonly confirmationResult?: Readonly<Record<string, unknown>> | undefined;
  readonly citations?: readonly AssistantCitation[] | undefined;
  readonly usage?: AssistantUsage | undefined;
  readonly exportArtifact?: AssistantExportArtifact | undefined;
  readonly failure?: Readonly<Record<string, unknown>> | undefined;
}

export interface AssistantPresentationState {
  readonly scope: AssistantPresentationScope;
  readonly status: AssistantPresentationStatus;
  readonly activeConversationCode?: string | undefined;
  readonly availableConversations: readonly AssistantConversation[];
  readonly conversationPage: number;
  readonly conversationsHaveMore: boolean;
  readonly historyLoading: boolean;
  readonly conversations: Readonly<Record<string, AssistantConversationPresentation>>;
  readonly error?: string | undefined;
}

export type AssistantPresentationAction =
  | { readonly type: 'RESET'; readonly scope: AssistantPresentationScope }
  | { readonly type: 'CONVERSATION_CREATING' }
  | {
      readonly type: 'CONVERSATIONS_RECEIVED';
      readonly conversations: readonly AssistantConversation[];
      readonly page: number;
      readonly limit: number;
      readonly append: boolean;
    }
  | {
      readonly type: 'CONVERSATION_RECEIVED';
      readonly conversation: AssistantConversation;
    }
  | { readonly type: 'CONVERSATION_SELECTED'; readonly conversationCode: string }
  | { readonly type: 'NEW_CONVERSATION' }
  | { readonly type: 'HISTORY_LOADING'; readonly conversationCode: string }
  | {
      readonly type: 'HISTORY_RECEIVED';
      readonly history: AssistantConversationHistory;
      readonly append: boolean;
    }
  | {
      readonly type: 'TURN_SUBMITTING';
      readonly conversationCode: string;
      readonly message: string;
    }
  | {
      readonly type: 'TURN_RECEIVED';
      readonly conversation: AssistantConversation;
      readonly turn: AssistantTurn;
      readonly message: string;
    }
  | { readonly type: 'STREAM_EVENT'; readonly event: AssistantTurnEvent }
  | {
      readonly type: 'CONFIRMATION_UPDATED';
      readonly conversationCode: string;
      readonly confirmation: AssistantConfirmation;
    }
  | {
      readonly type: 'CONFIRMATION_EXECUTED';
      readonly conversationCode: string;
      readonly result: Readonly<Record<string, unknown>>;
    }
  | { readonly type: 'TURN_CANCELLING'; readonly conversationCode: string }
  | { readonly type: 'FAILED'; readonly message: string };
