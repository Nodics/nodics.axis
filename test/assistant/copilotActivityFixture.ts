/** @file Synthetic activity metadata, never a live administrative acceptance record. */
import { activityTextKeys } from '../../src/assistant/api/copilotActivityClient';

/** Returns an independent bounded metadata response. */
export function copilotActivityFixture() {
  return {
    contractVersion: 1,
    page: 1,
    limit: 25,
    mayHaveMore: false,
    transcriptAccess: false,
    context: { tenantCode: 'tenant', enterpriseCode: 'enterprise' },
    presentation: {
      ...Object.fromEntries(activityTextKeys.map((key) => [key, key])),
      title: 'Copilot Activity',
      updatedFrom: 'Updated from',
      updatedTo: 'Updated until',
      conversation: 'Conversation',
      employee: 'Employee',
      state: 'State',
      updated: 'Updated',
      page: 'Page',
      empty: 'No activity in this page',
      principal: 'Employee identifier',
      search: 'Apply filter',
      previous: 'Previous page',
      next: 'Next page',
      refresh: 'Refresh activity',
      metadataOnly: 'Activity metadata only. Conversation content is not included.',
    },
    items: [
      {
        conversationCode: 'conversation-1',
        principalCode: 'employee-one',
        state: 'ACTIVE',
        updatedAt: '2026-10-03T00:00:00Z',
      },
    ],
  };
}
