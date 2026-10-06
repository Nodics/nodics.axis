/** @file Protects the distinction between unknown and explicitly measured chunks. */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AssistantKnowledgeStatus } from '../../../../../src/cms/renderers/components/assistant/AssistantKnowledgeStatus';

describe('AssistantKnowledgeStatus', () => {
  it('omits an unknown aggregate while retaining explicit zero and measured totals', () => {
    const source = {
      code: 'framework',
      repository: 'framework',
      sourceType: 'DOCUMENTATION',
      classification: 'INTERNAL',
      version: '1',
      refreshPolicy: 'MANUAL',
      state: 'READY',
      filesRead: 1,
      filesAccepted: 1,
      filesRejected: 0,
    };
    const props = {
      loading: false,
      title: 'Knowledge',
      sourcesLabel: 'Sources',
      chunksLabel: 'Indexed chunks',
      lastRefreshLabel: 'Last refresh',
      refreshLabel: 'Refresh',
      refreshingLabel: 'Refreshing',
      unavailableLabel: 'Unavailable',
      onRefresh: async () => {},
    };
    const status = { enabled: true, ingestionEnabled: true, sources: [source] };
    const { rerender } = render(
      <AssistantKnowledgeStatus {...props} status={status} />,
    );
    expect(screen.queryByText(/Indexed chunks:/)).not.toBeInTheDocument();
    for (const chunksProjected of [0, 42]) {
      rerender(
        <AssistantKnowledgeStatus
          {...props}
          status={{ ...status, sources: [{ ...source, chunksProjected }] }}
        />,
      );
      expect(
        screen.getByText(`Indexed chunks: ${chunksProjected}`),
      ).toBeInTheDocument();
    }
    rerender(
      <AssistantKnowledgeStatus
        {...props}
        status={{
          ...status,
          sources: [source, { ...source, code: 'project', chunksProjected: 42 }],
        }}
      />,
    );
    expect(screen.queryByText(/Indexed chunks:/)).not.toBeInTheDocument();
  });
});
