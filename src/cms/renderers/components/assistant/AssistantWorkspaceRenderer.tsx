import { Box, Paper, Stack } from '@mui/material';

import { WorkspaceHeading } from '../../../../app/help/WorkspaceHelp';
import { helpProperty, stringProperty } from '../../shared/rendererProperties';
import type { CmsComponentRendererProps } from '../../shared/rendererTypes';
import { AssistantComposer } from './AssistantComposer';
import { AssistantConversationHistory } from './AssistantConversationHistory';
import { AssistantMessageTimeline } from './AssistantMessageTimeline';
import { AssistantKnowledgeStatus } from './AssistantKnowledgeStatus';

export function AssistantWorkspaceRenderer({
  actions,
  component,
}: CmsComponentRendererProps) {
  const title = stringProperty(component, 'title');
  const welcomeMessage = stringProperty(component, 'welcomeMessage');
  const inputPlaceholder = stringProperty(component, 'inputPlaceholder');
  const submitLabel = stringProperty(component, 'submitLabel');
  const stopLabel = stringProperty(component, 'stopLabel');
  const emptyState = stringProperty(component, 'emptyState');
  const employeeLabel = stringProperty(component, 'employeeLabel');
  const assistantLabel = stringProperty(component, 'assistantLabel');
  const workingLabel = stringProperty(component, 'workingLabel');
  const cancellingLabel = stringProperty(component, 'cancellingLabel');
  const errorLabel = stringProperty(component, 'errorLabel');
  const historyLabel = stringProperty(component, 'historyLabel');
  const newConversationLabel = stringProperty(component, 'newConversationLabel');
  const noConversationsLabel = stringProperty(component, 'noConversationsLabel');
  const loadMoreLabel = stringProperty(component, 'loadMoreLabel');
  const clarificationTitle = stringProperty(component, 'clarificationTitle');
  const clarificationSubmitLabel = stringProperty(
    component,
    'clarificationSubmitLabel',
  );
  const toolPlanTitle = stringProperty(component, 'toolPlanTitle');
  const toolPlannedLabel = stringProperty(component, 'toolPlannedLabel');
  const toolRunningLabel = stringProperty(component, 'toolRunningLabel');
  const toolSucceededLabel = stringProperty(component, 'toolSucceededLabel');
  const toolFailedLabel = stringProperty(component, 'toolFailedLabel');
  const citationsTitle = stringProperty(component, 'citationsTitle');
  const noCitationsLabel = stringProperty(component, 'noCitationsLabel');
  const usageTitle = stringProperty(component, 'usageTitle');
  const inputTokensLabel = stringProperty(component, 'inputTokensLabel');
  const outputTokensLabel = stringProperty(component, 'outputTokensLabel');
  const cachedTokensLabel = stringProperty(component, 'cachedTokensLabel');
  const reasoningTokensLabel = stringProperty(component, 'reasoningTokensLabel');
  const embeddingTokensLabel = stringProperty(component, 'embeddingTokensLabel');
  const reconciliationLabel = stringProperty(component, 'reconciliationLabel');
  const knowledgeTitle = stringProperty(component, 'knowledgeTitle', '');
  const knowledgeSourcesLabel = stringProperty(component, 'knowledgeSourcesLabel', '');
  const knowledgeChunksLabel = stringProperty(component, 'knowledgeChunksLabel', '');
  const knowledgeLastRefreshLabel = stringProperty(component, 'knowledgeLastRefreshLabel', '');
  const knowledgeRefreshLabel = stringProperty(component, 'knowledgeRefreshLabel', '');
  const knowledgeRefreshingLabel = stringProperty(component, 'knowledgeRefreshingLabel', '');
  const knowledgeUnavailableLabel = stringProperty(component, 'knowledgeUnavailableLabel', '');
  const confirmationTitle = stringProperty(component, 'confirmationTitle');
  const approveLabel = stringProperty(component, 'approveLabel');
  const executeLabel = stringProperty(component, 'executeLabel');
  const confirmationExpiredLabel = stringProperty(
    component,
    'confirmationExpiredLabel',
  );
  const confirmationCompletedLabel = stringProperty(
    component,
    'confirmationCompletedLabel',
  );
  const confirmationRejectLabel = stringProperty(component, 'rejectLabel');
  const controller = actions?.assistant;
  const disconnectedState = {
    scope: { enterpriseCode: '', employeeId: '' },
    status: 'IDLE' as const,
    availableConversations: [],
    conversationPage: 0,
    conversationsHaveMore: false,
    historyLoading: false,
    conversations: {},
  };
  const state = controller?.state ?? disconnectedState;

  return (
    <Paper
      component="section"
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        boxShadow: '0 18px 50px rgba(15, 23, 42, 0.08)',
        minHeight: { xs: 480, md: 600 },
        overflow: 'hidden',
      }}
    >
      <Stack sx={{ minHeight: 'inherit' }}>
        <Stack
          spacing={0.75}
          sx={{
            background:
              'linear-gradient(120deg, rgba(255, 193, 7, 0.14), rgba(255, 255, 255, 0) 58%)',
            borderBottom: '1px solid',
            borderColor: 'divider',
            px: { xs: 2.5, md: 4 },
            py: { xs: 2.5, md: 3.5 },
          }}
        >
          <WorkspaceHeading
            description={welcomeMessage}
            headingVariant="h4"
            help={helpProperty(component)}
            title={title}
          />
        </Stack>
        {knowledgeTitle && controller ? (
          <AssistantKnowledgeStatus
            chunksLabel={knowledgeChunksLabel}
            error={controller.knowledgeError}
            lastRefreshLabel={knowledgeLastRefreshLabel}
            loading={Boolean(controller.knowledgeLoading)}
            refreshingLabel={knowledgeRefreshingLabel}
            refreshingSource={controller.refreshingKnowledgeSource}
            refreshLabel={knowledgeRefreshLabel}
            sourcesLabel={knowledgeSourcesLabel}
            status={controller.knowledgeStatus}
            title={knowledgeTitle}
            unavailableLabel={knowledgeUnavailableLabel}
            onRefresh={controller.refreshKnowledgeSource ?? (() => Promise.resolve())}
          />
        ) : null}
        <Box
          sx={{
            display: 'grid',
            flexGrow: 1,
            gridTemplateColumns: { xs: '1fr', md: 'auto minmax(0, 1fr)' },
            minHeight: 0,
          }}
        >
          <AssistantConversationHistory
            historyLabel={historyLabel}
            loadMoreLabel={loadMoreLabel}
            newConversationLabel={newConversationLabel}
            noConversationsLabel={noConversationsLabel}
            state={state}
            onNew={controller?.newConversation ?? (() => undefined)}
            onLoadMore={controller?.loadMoreConversations ?? (() => Promise.resolve())}
            onSelect={controller?.selectConversation ?? (() => Promise.resolve())}
          />
          <Stack sx={{ minHeight: 0, minWidth: 0 }}>
            <AssistantMessageTimeline
              assistantLabel={assistantLabel}
              approveLabel={approveLabel}
              cancellingLabel={cancellingLabel}
              cachedTokensLabel={cachedTokensLabel}
              citationsTitle={citationsTitle}
              clarificationSubmitLabel={clarificationSubmitLabel}
              clarificationTitle={clarificationTitle}
              confirmationCompletedLabel={confirmationCompletedLabel}
              confirmationExpiredLabel={confirmationExpiredLabel}
              confirmationRejectLabel={confirmationRejectLabel}
              confirmationTitle={confirmationTitle}
              employeeLabel={employeeLabel}
              embeddingTokensLabel={embeddingTokensLabel}
              emptyState={emptyState}
              errorLabel={errorLabel}
              loadMoreLabel={loadMoreLabel}
              noCitationsLabel={noCitationsLabel}
              inputTokensLabel={inputTokensLabel}
              outputTokensLabel={outputTokensLabel}
              reasoningTokensLabel={reasoningTokensLabel}
              reconciliationLabel={reconciliationLabel}
              state={state}
              executeLabel={executeLabel}
              toolPlanTitle={toolPlanTitle}
              toolFailedLabel={toolFailedLabel}
              toolPlannedLabel={toolPlannedLabel}
              toolRunningLabel={toolRunningLabel}
              toolSucceededLabel={toolSucceededLabel}
              usageTitle={usageTitle}
              workingLabel={workingLabel}
              onApprove={controller?.approveConfirmation ?? (() => Promise.resolve())}
              onExecute={controller?.executeConfirmation ?? (() => Promise.resolve())}
              onReject={controller?.rejectConfirmation ?? (() => Promise.resolve())}
              onLoadMore={controller?.loadMoreHistory ?? (() => Promise.resolve())}
              onSubmit={controller?.submit ?? (() => Promise.resolve())}
            />
            <AssistantComposer
              connected={Boolean(controller)}
              inputPlaceholder={inputPlaceholder}
              status={state.status}
              stopLabel={stopLabel}
              submitLabel={submitLabel}
              onCancel={controller?.cancel ?? (() => Promise.resolve())}
              onSubmit={controller?.submit ?? (() => Promise.resolve())}
            />
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
