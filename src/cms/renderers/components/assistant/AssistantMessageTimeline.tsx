import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useEffect, useRef } from 'react';

import type { AssistantPresentationState } from '../../../../assistant/presentation/assistantPresentationContracts';
import { AssistantMessageBubble } from './AssistantMessageBubble';
import { AssistantClarificationCard } from './AssistantClarificationCard';
import { AssistantCitationList } from './AssistantCitationList';
import { AssistantConfirmationCard } from './AssistantConfirmationCard';
import { AssistantStreamingStatus } from './AssistantStreamingStatus';
import { AssistantToolActivityCard } from './AssistantToolActivityCard';
import { AssistantUsageCard } from './AssistantUsageCard';
import { AssistantExportCard } from './AssistantExportCard';

interface AssistantMessageTimelineProps {
  readonly state: AssistantPresentationState;
  readonly emptyState: string;
  readonly employeeLabel: string;
  readonly assistantLabel: string;
  readonly workingLabel: string;
  readonly cancellingLabel: string;
  readonly errorLabel: string;
  readonly loadMoreLabel: string;
  readonly clarificationTitle: string;
  readonly clarificationSubmitLabel: string;
  readonly toolPlanTitle: string;
  readonly toolPlannedLabel: string;
  readonly toolRunningLabel: string;
  readonly toolSucceededLabel: string;
  readonly toolFailedLabel: string;
  readonly citationsTitle: string;
  readonly noCitationsLabel: string;
  readonly usageTitle: string;
  readonly inputTokensLabel: string;
  readonly outputTokensLabel: string;
  readonly cachedTokensLabel: string;
  readonly reasoningTokensLabel: string;
  readonly embeddingTokensLabel: string;
  readonly reconciliationLabel: string;
  readonly confirmationTitle: string;
  readonly approveLabel: string;
  readonly executeLabel: string;
  readonly confirmationExpiredLabel: string;
  readonly confirmationCompletedLabel: string;
  readonly confirmationRejectLabel: string;
  readonly onLoadMore: () => Promise<void>;
  readonly onSubmit: (message: string) => Promise<void>;
  readonly onApprove: () => Promise<void>;
  readonly onExecute: () => Promise<void>;
  readonly onReject: () => Promise<void>;
}

export function AssistantMessageTimeline(props: AssistantMessageTimelineProps) {
  const activeCode = props.state.activeConversationCode;
  const active = activeCode ? props.state.conversations[activeCode] : undefined;
  const activeAlreadyInHistory =
    active?.turn &&
    active.history.some((entry) => entry.turn.turnCode === active.turn?.turnCode);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reducedMotion = globalThis.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    endRef.current?.scrollIntoView?.({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
    });
  }, [active?.lastSequence, props.state.status]);

  if (!active?.history.length && !active?.submittedMessage) {
    return (
      <Box
        sx={{
          display: 'grid',
          flexGrow: 1,
          minHeight: 280,
          p: 3,
          placeItems: 'center',
          textAlign: 'center',
        }}
      >
        {props.state.status === 'FAILED' ? (
          <Alert severity="error">
            <Typography component="span" sx={{ fontWeight: 'bold' }}>
              {props.errorLabel}
            </Typography>
            {props.state.error ? `: ${props.state.error}` : null}
          </Alert>
        ) : (
          <Typography color="text.secondary" sx={{ maxWidth: 600 }}>
            {props.emptyState}
          </Typography>
        )}
      </Box>
    );
  }

  const working = ['CREATING_CONVERSATION', 'SUBMITTING', 'STREAMING'].includes(
    props.state.status,
  );
  return (
    <Stack
      aria-live="polite"
      aria-relevant="additions text"
      spacing={2.5}
      sx={{
        background:
          'linear-gradient(180deg, rgba(248, 250, 252, 0.42), rgba(255, 255, 255, 0.96) 24%)',
        flexGrow: 1,
        minHeight: 280,
        overflowAnchor: 'none',
        overflowY: 'auto',
        p: { xs: 2, md: 4 },
        scrollBehavior: 'smooth',
      }}
    >
      {active.historyHasMore ? (
        <Button
          size="small"
          sx={{ alignSelf: 'center' }}
          onClick={() => void props.onLoadMore()}
        >
          {props.loadMoreLabel}
        </Button>
      ) : null}
      {active.history.flatMap((entry) =>
        entry.messages.map((message) => (
          <AssistantMessageBubble
            key={`${entry.turn.turnCode}:${String(message.sequence)}:${message.role}`}
            label={message.role === 'user' ? props.employeeLabel : props.assistantLabel}
            message={message.content}
            speaker={message.role === 'user' ? 'employee' : 'assistant'}
          />
        )),
      )}
      {!activeAlreadyInHistory && active.submittedMessage ? (
        <AssistantMessageBubble
          label={props.employeeLabel}
          message={active.submittedMessage}
          speaker="employee"
        />
      ) : null}
      {!activeAlreadyInHistory && active.streamedText ? (
        <AssistantMessageBubble
          label={props.assistantLabel}
          message={active.streamedText}
          speaker="assistant"
          streaming={props.state.status === 'STREAMING'}
        />
      ) : null}
      {active.clarification ? (
        <AssistantClarificationCard
          clarification={active.clarification}
          submitLabel={props.clarificationSubmitLabel}
          title={props.clarificationTitle}
          onSubmit={props.onSubmit}
        />
      ) : null}
      {active.toolActivity ? (
        <AssistantToolActivityCard
          activity={active.toolActivity}
          failedLabel={props.toolFailedLabel}
          plannedLabel={props.toolPlannedLabel}
          runningLabel={props.toolRunningLabel}
          succeededLabel={props.toolSucceededLabel}
          title={props.toolPlanTitle}
        />
      ) : null}
      {active.confirmation ? (
        <AssistantConfirmationCard
          approveLabel={props.approveLabel}
          completedLabel={props.confirmationCompletedLabel}
          confirmation={active.confirmation}
          executeLabel={props.executeLabel}
          rejectLabel={props.confirmationRejectLabel}
          expiredLabel={props.confirmationExpiredLabel}
          result={active.confirmationResult}
          title={props.confirmationTitle}
          onApprove={props.onApprove}
          onExecute={props.onExecute}
          onReject={props.onReject}
        />
      ) : null}
      {active.citations ? (
        <AssistantCitationList
          citations={active.citations}
          emptyLabel={props.noCitationsLabel}
          title={props.citationsTitle}
        />
      ) : null}
      {active.usage ? (
        <AssistantUsageCard
          cachedLabel={props.cachedTokensLabel}
          embeddingLabel={props.embeddingTokensLabel}
          inputLabel={props.inputTokensLabel}
          outputLabel={props.outputTokensLabel}
          reasoningLabel={props.reasoningTokensLabel}
          reconciliationLabel={props.reconciliationLabel}
          title={props.usageTitle}
          usage={active.usage}
        />
      ) : null}
      {active.exportArtifact ? (
        <AssistantExportCard artifact={active.exportArtifact} />
      ) : null}
      {working && !active.streamedText ? (
        <AssistantStreamingStatus label={props.workingLabel} />
      ) : null}
      {props.state.status === 'CANCELLING' ? (
        <AssistantStreamingStatus label={props.cancellingLabel} />
      ) : null}
      {props.state.status === 'FAILED' ? (
        <Alert severity="error">
          <Typography component="span" sx={{ fontWeight: 'bold' }}>
            {props.errorLabel}
          </Typography>
          {props.state.error ? `: ${props.state.error}` : null}
        </Alert>
      ) : null}
      <Box ref={endRef} sx={{ height: 1, overflowAnchor: 'auto' }} />
    </Stack>
  );
}
