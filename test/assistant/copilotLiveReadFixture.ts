/** @file Synthetic contract for live-evidence composer tests; no credentials or real customer data. */
import { parseCopilotLiveReads } from '../../src/assistant/api/copilotLiveReadContract';

/** Supplies backend-shaped inert choices and copy. */
export function copilotLiveReadFixture() {
  return parseCopilotLiveReads({
    sources: [
      {
        code: 'business-data',
        sourceType: 'DATABASE',
        sourcePolicyDigest: 'a'.repeat(64),
        groupCodes: ['business'],
      },
      {
        code: 'journey-events',
        sourceType: 'EXTERNAL_LOG',
        sourcePolicyDigest: 'b'.repeat(64),
        groupCodes: ['operations'],
      },
    ],
    presentation: {
      open: 'Read live evidence',
      title: 'Live evidence',
      source: 'Source',
      collection: 'Collection',
      inspectCollections: 'List collections',
      inspectSchema: 'View fields',
      inspectCapabilities: 'View capabilities',
      search: 'Search',
      page: 'Page',
      correlation: 'Journey correlation ID',
      from: 'From (local time)',
      to: 'To (local time)',
      submit: 'Read in conversation',
      cancel: 'Cancel',
      failed: 'The source is unavailable.',
      database: 'Business data',
      logs: 'Incident logs',
    },
  });
}
