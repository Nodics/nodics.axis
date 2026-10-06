/** @file Synthetic transcript evidence for component and responsive checks; never live customer content. */
export const transcriptInspectionFixture = {
  purposes: [{ code: 'QUALITY_REVIEW', label: 'Quality review' }],
  presentation: {
    title: 'Recorded conversation',
    open: 'Inspect recorded conversation',
    purpose: 'Inspection purpose',
    inspect: 'Inspect',
    close: 'Close',
    previous: 'Previous page',
    next: 'Next page',
    page: 'Page',
    unrecorded: 'Content not recorded',
    empty: 'No recorded messages in this page',
    audit: 'Access receipt',
    user: 'Employee',
    assistant: 'Copilot',
    failure: 'Inspection unavailable. No content is displayed.',
  },
};
/** Returns a bounded synthetic transcript with no hidden content. */
export function copilotTranscriptFixture() {
  return {
    contractVersion: 1,
    context: { tenantCode: 'tenant', enterpriseCode: 'enterprise' },
    conversationCode: 'conversation-1',
    principalCode: 'employee-one',
    page: 1,
    limit: 25,
    mayHaveMore: false,
    accessReceipt: 'cta-synthetic-receipt',
    items: [
      {
        turnCode: 'turn-one',
        recorded: true,
        messages: [
          {
            role: 'user',
            sequence: 1,
            content: 'Which knowledge groups are available for this enterprise?',
          },
          {
            role: 'assistant',
            sequence: 2,
            content:
              'Your currently active groups are framework documentation and the project operations guide.',
          },
        ],
      },
      { turnCode: 'turn-two', recorded: false, messages: [] },
    ],
  };
}
