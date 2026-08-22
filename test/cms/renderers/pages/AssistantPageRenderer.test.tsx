import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AssistantPageRenderer } from '../../../../src/cms/renderers/pages/AssistantPageRenderer';
import type { CmsPageContract } from '../../../../src/cms/cmsContract';

const page: CmsPageContract = {
  code: 'axisAssistantPage',
  name: 'Axis Assistant',
  typeCode: 'axisAssistantPageType',
  template: 'axisAssistantPageTemplate',
  renderer: 'axis.page.assistant',
  rendererContractVersion: 1,
  rendererChannels: ['web', 'mobile-webview'],
  rendererDeprecated: false,
  templateContract: {
    code: 'axisAssistantPageTemplate',
    renderer: 'axis.template.assistant',
    contractVersion: 0,
  },
  components: [
    {
      code: 'axisAssistantWorkspaceComponent',
      typeCode: 'axisAssistantWorkspaceComponentType',
      renderer: 'axis.component.assistant-workspace',
      rendererContractVersion: 1,
      rendererChannels: ['web', 'mobile-webview'],
      rendererDeprecated: false,
      properties: {
        title: 'How can I help?',
        welcomeMessage: 'Ask about authorized operations.',
        inputPlaceholder: 'Describe what you want to do',
        submitLabel: 'Send',
        stopLabel: 'Stop',
        emptyState: 'Assistant activity will appear here.',
        employeeLabel: 'You',
        assistantLabel: 'Axis Assistant',
        workingLabel: 'Working',
        cancellingLabel: 'Stopping',
        errorLabel: 'Request failed',
        historyLabel: 'Conversations',
        newConversationLabel: 'New conversation',
        noConversationsLabel: 'No conversations',
        loadMoreLabel: 'Load more',
        clarificationTitle: 'More information required',
        clarificationSubmitLabel: 'Continue',
        toolPlanTitle: 'Proposed governed action',
        confirmationTitle: 'Review and confirm',
        approveLabel: 'Approve action',
        executeLabel: 'Execute approved action',
        confirmationExpiredLabel: 'Confirmation expired',
        confirmationCompletedLabel: 'Action completed',
        toolPlannedLabel: 'Action prepared',
        toolRunningLabel: 'Action in progress',
        toolSucceededLabel: 'Action completed',
        toolFailedLabel: 'Action failed',
        citationsTitle: 'Sources',
        noCitationsLabel: 'No sources supplied',
        usageTitle: 'AI usage',
        inputTokensLabel: 'Input',
        outputTokensLabel: 'Output',
        cachedTokensLabel: 'Cached input',
        reasoningTokensLabel: 'Reasoning',
        embeddingTokensLabel: 'Embedding',
        reconciliationLabel: 'Accounting status',
      },
      slot: 'workspace',
      index: 20,
      components: [],
    },
  ],
};

describe('AssistantPageRenderer', () => {
  it('maps CMS slots through the dedicated Assistant template', async () => {
    render(<AssistantPageRenderer page={page} />);

    expect(await screen.findByRole('region', { name: 'Axis Assistant' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'How can I help?' })).toBeVisible();
  });

  it('rejects an unrelated template contract', () => {
    expect(() =>
      render(
        <AssistantPageRenderer
          page={{
            ...page,
            templateContract: {
              ...page.templateContract,
              renderer: 'axis.template.dashboard',
            },
          }}
        />,
      ),
    ).toThrow(/requires axis.template.assistant/);
  });
});
