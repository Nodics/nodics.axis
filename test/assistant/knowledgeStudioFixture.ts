/** @file Synthetic source inventory for renderer and transport tests, not live index evidence. */
import { knowledgeTextKeys } from '../../src/assistant/api/knowledgeStudioClient';

/** Returns fresh safe metadata for each test. */
export function knowledgeStudioFixture() {
  return {
    contractVersion: 1,
    observedAt: '2026-10-02T00:00:00Z',
    limit: 40,
    hasMore: false,
    context: { tenantCode: 'tenant', enterpriseCode: 'enterprise' },
    presentation: {
      ...Object.fromEntries(knowledgeTextKeys.map((key) => [key, key])),
      title: 'Knowledge Studio',
      search: 'Find a source',
      preview: 'Preview ingestion',
    },
    sources: [
      {
        code: 'framework-readmes',
        repository: 'nodics.ai',
        project: 'nodics',
        module: 'nodics.copilot',
        owner: 'nodics.copilot',
        sourceType: 'README',
        classification: 'INTERNAL',
        version: 'revision-2',
        enabled: true,
        paths: ['README.md', '**/README.md'],
        excludedPaths: ['generated'],
        allowedExtensions: ['.md'],
        secretScanRequired: true,
        canPreview: true,
        status: {
          state: 'UNKNOWN',
          evidence: 'PROCESS_LOCAL',
          indexedVersion: null,
          refreshedAt: null,
        },
      },
    ],
  };
}
