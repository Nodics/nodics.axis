/** @file Synthetic Workspace contract fixture, not a live acceptance record. */
import { workspaceTextKeys } from '../../src/assistant/api/copilotWorkspaceClient';

/** Creates independent display-safe fixture data. */
export function workspaceFixture() {
  return {
    contractVersion: 1,
    observedAt: '2026-10-02T12:00:00.000Z',
    scope: 'PERSONAL',
    context: {
      tenantCode: 'tenant',
      enterpriseCode: 'enterprise',
      principalCode: 'user',
    },
    presentation: {
      ...Object.fromEntries(workspaceTextKeys.map((key) => [key, key])),
      title: 'Copilot Workspace',
      newConversation: 'New conversation',
      details: 'Details',
      resume: 'Resume',
      search: 'Search conversations',
      emptyConversations: 'No conversations',
      unavailable: 'Unavailable',
      conversations: 'Recent conversations',
      operations: 'Operation catalogue',
      operationImplemented: 'Implemented',
      operationAdapterRequired: 'Adapter required',
      operationFuture: 'Planned',
      operationEmpty: 'No accessible operations',
      operationApproval: 'Approval required',
    },
    activity: {
      limit: 12,
      hasMoreConversations: false,
      hasMoreTurns: false,
      conversations: [
        {
          conversationCode: 'conversation-1',
          title: 'Review collection centres',
          state: 'ACTIVE',
          updatedAt: '2026-10-02T12:00:00.000Z',
        },
      ],
      turns: [
        {
          turnCode: 'turn-1',
          conversationCode: 'conversation-1',
          state: 'COMPLETED',
          acceptedAt: '2026-10-02T12:00:00.000Z',
          completedAt: '2026-10-02T12:01:00.000Z',
        },
      ],
    },
    knowledge: {
      state: 'AVAILABLE',
      hasMore: false,
      sources: [
        {
          code: 'framework',
          state: 'PROJECTED',
          version: 'v1',
          refreshedAt: '2026-10-02T12:00:00.000Z',
        },
      ],
    },
    provider: { state: 'CONFIGURED', health: 'NOT_CHECKED', model: 'local-model' },
    operations: {
      state: 'AVAILABLE',
      hasMore: false,
      items: [
        {
          code: 'framework.modules.list',
          owner: 'backoffice',
          riskClass: 'INTERNAL_READ',
          mutates: false,
          maturity: 'IMPLEMENTED',
        },
        {
          code: 'commerce.checkout.execute',
          owner: 'commerceCopilot',
          riskClass: 'CREATE',
          mutates: true,
          maturity: 'FUTURE',
        },
      ],
    },
    budget: {
      state: 'UNAVAILABLE',
      allowance: null,
      consumed: null,
      reserved: null,
      available: null,
    },
    recording: { state: 'ENABLED', retentionDays: null },
    actions: { canStartConversation: true },
  };
}
