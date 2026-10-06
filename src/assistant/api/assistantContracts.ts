/** @file Typed Axis projections of copilotApi; authorization and accounting remain backend owned. */
export type AssistantTurnState =
  | 'ACCEPTED'
  | 'PROCESSING'
  | 'CANCELLATION_REQUESTED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'FAILED';

export type AssistantEventType =
  | 'TURN_ACCEPTED'
  | 'STATUS'
  | 'TEXT_DELTA'
  | 'CLARIFICATION'
  | 'TOOL_PLAN'
  | 'CONFIRMATION_REQUIRED'
  | 'TOOL_STARTED'
  | 'TOOL_RESULT'
  | 'EXPORT_READY'
  | 'CITATIONS'
  | 'USAGE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export interface AssistantConversation {
  readonly conversationCode: string;
  readonly definitionCode: string;
  readonly state: string;
  readonly title?: string | undefined;
  readonly lastSequence: number;
}

export interface AssistantConversationPage {
  readonly page: number;
  readonly limit: number;
  readonly items: readonly AssistantConversation[];
}

export interface AssistantTurn {
  readonly recording?:
    | { readonly enabled: boolean; readonly version: string; readonly notice: string }
    | undefined;
  readonly turnCode: string;
  readonly conversationCode: string;
  readonly state: AssistantTurnState;
  readonly idempotencyKey?: string | undefined;
}

export interface AssistantTurnEvent {
  readonly eventCode: string;
  readonly conversationCode: string;
  readonly turnCode: string;
  readonly eventType: AssistantEventType;
  readonly sequence: number;
  readonly createdAt: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface AssistantEventPage {
  readonly afterSequence: number;
  readonly limit: number;
  readonly items: readonly AssistantTurnEvent[];
}

export interface AssistantMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly sequence: number;
  readonly createdAt?: string | undefined;
}

export interface AssistantHistoryEntry {
  readonly turn: AssistantTurn;
  readonly messages: readonly AssistantMessage[];
  readonly interactions?: readonly AssistantTurnEvent[] | undefined;
}

export interface AssistantConversationHistory {
  readonly conversation: AssistantConversation;
  readonly page: number;
  readonly limit: number;
  readonly items: readonly AssistantHistoryEntry[];
  readonly confirmations?: readonly AssistantConfirmation[] | undefined;
}

export interface AssistantActionOutcome {
  readonly index: number;
  readonly schema: string;
  readonly code: string;
  readonly state: 'NOT_STARTED' | 'RUNNING' | 'COMPLETED' | 'OUTCOME_UNKNOWN';
}

export interface AssistantConfirmation {
  readonly recovery?:
    | { readonly label: string; readonly continuation?: string | undefined }
    | undefined;
  readonly confirmationCode: string;
  readonly conversationCode: string;
  readonly operationId: string;
  readonly state: string;
  readonly argumentsDigest: string;
  readonly revision: number;
  readonly expiresAt: string;
  readonly impact: Readonly<Record<string, unknown>>;
  readonly outcomes?: readonly AssistantActionOutcome[] | undefined;
  readonly workflowCarrierCode?: string | undefined;
}

export interface AssistantCitation {
  readonly citationId: string;
  readonly title: string;
  readonly locator?: string | undefined;
  readonly section?: string | undefined;
  readonly version?: string | undefined;
  readonly navigationType?: 'NONE' | 'INTERNAL_ROUTE' | undefined;
  readonly navigationTarget?: string | undefined;
}

export interface AssistantUsage {
  readonly phase?: string | undefined;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cachedInputTokens: number | null;
  readonly reasoningTokens: number | null;
  readonly embeddingTokens: number | null;
  readonly reconciliationState?: string | undefined;
}

export interface AssistantKnowledgeSourceStatus {
  readonly code: string;
  readonly repository: string;
  readonly sourceType: string;
  readonly classification: string;
  readonly version: string;
  readonly refreshPolicy: string;
  readonly state: string;
  readonly filesRead: number;
  readonly filesAccepted: number;
  readonly filesRejected: number;
  readonly chunksProjected?: number | undefined;
  readonly refreshedAt?: string | undefined;
  readonly failureCode?: string | undefined;
}

export interface AssistantKnowledgeStatus {
  readonly enabled: boolean;
  readonly ingestionEnabled: boolean;
  readonly lastRefreshAt?: string | undefined;
  readonly sources: readonly AssistantKnowledgeSourceStatus[];
}

export interface AssistantToolActivity {
  readonly toolId: string;
  readonly ownerModule: string;
  readonly operationId: string;
  readonly state: 'PLANNED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  readonly failureCode?: string | undefined;
}

export interface AssistantExportArtifact {
  readonly format: 'csv' | 'xlsx' | 'text';
  readonly fileName: string;
  readonly mimeType: string;
  readonly encoding: 'utf8' | 'base64';
  readonly content: string;
}

export interface CreateConversationInput {
  readonly definitionCode: string;
  readonly title?: string | undefined;
}

export interface ListConversationsInput {
  readonly state?: string | undefined;
  readonly page?: number | undefined;
  readonly limit?: number | undefined;
}

export interface AssistantKnowledgeInput {
  readonly corpusCode: string;
  readonly audience: string;
  readonly allowedClassifications: readonly string[];
  readonly query: string;
  readonly mode?: 'INDEXED' | 'LIVE' | 'HYBRID' | undefined;
  readonly searchMode?: 'LEXICAL' | 'VECTOR' | 'HYBRID' | undefined;
  readonly locale?: string | undefined;
  readonly maximumResults?: number | undefined;
}

export interface SubmitTurnInput {
  readonly knowledgeGroupCodes?: readonly string[] | undefined;
  readonly message: string;
  readonly idempotencyKey: string;
  readonly maximumOutputTokens?: number | undefined;
  readonly knowledge?: AssistantKnowledgeInput | undefined;
}

export interface ApproveConfirmationInput {
  readonly expectedRevision: number;
  readonly argumentsDigest: string;
}

export interface RejectConfirmationInput extends ApproveConfirmationInput {
  readonly reason?: string | undefined;
}

export const ASSISTANT_API_CONTRACT_VERSION = 1;
