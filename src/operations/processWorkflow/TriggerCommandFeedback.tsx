import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import type {
  ProcessTriggerCommandAcknowledgement,
  ProcessTriggerCommandIntent,
} from './api/processTriggerCommandClient';
import { requestedProcessTriggerInstanceCode } from './api/processTriggerCommandClient';

/** Private request lifetime belongs to the current Process workspace, never storage or a cross-employee queue. */
export type TriggerCommandOutcome = Readonly<{
  state: 'PENDING' | 'UNKNOWN' | 'ACKNOWLEDGED';
  intent: ProcessTriggerCommandIntent;
  versionPin: boolean;
  acknowledgement?: ProcessTriggerCommandAcknowledgement;
  receiptUnknown?: boolean;
}>;

/** Presents transport/acknowledgement state without inferring business completion or replaying a request. Customize copy/layout here while retaining explicit receipt inspection and the owner-bound instance link. */
export function TriggerCommandFeedback({
  outcome,
  canInspect,
  inspecting,
  inspectionError,
  onInspect,
}: {
  readonly outcome: TriggerCommandOutcome | undefined;
  readonly canInspect: boolean;
  readonly inspecting: boolean;
  readonly inspectionError: unknown;
  readonly onInspect: () => void;
}) {
  const { format: workflowText } = useAxisLocalization();
  if (!outcome) return null;
  if (outcome.state === 'PENDING')
    return (
      <Alert severity="info">
        {workflowText(
          'process.ui.submitting-the-trigger-request',
          'Submitting the trigger request.',
        )}
      </Alert>
    );
  if (outcome.state === 'ACKNOWLEDGED')
    return (
      <Alert
        severity="success"
        sx={{
          flexWrap: 'wrap',
          '& .MuiAlert-message': { minWidth: 0 },
          '& .MuiAlert-action': { ml: 0, pl: 0, maxWidth: '100%' },
        }}
        action={
          outcome.acknowledgement?.instanceCode ? (
            <Button
              component={RouterLink}
              to={`/process/tasks?instanceCode=${encodeURIComponent(outcome.acknowledgement.instanceCode)}`}
            >
              {workflowText(
                'process.ui.open-triggered-workflow',
                'Open triggered workflow',
              )}
            </Button>
          ) : undefined
        }
      >
        {outcome.versionPin
          ? workflowText(
              'process.ui.published-version-update-acknowledged-by-process',
              'Published version update acknowledged by Process.',
            )
          : workflowText(
              'process.ui.trigger-request-acknowledged-by-process',
              'Trigger request acknowledged by Process.',
            )}
        {outcome.acknowledgement?.instanceCode
          ? workflowText(
              'process.ui.workflow-completion-is-shown-in-its-timeline',
              ' Workflow completion is shown in its timeline.',
            )
          : ''}
      </Alert>
    );
  const requestedInstance = requestedProcessTriggerInstanceCode(outcome.intent);
  return (
    <Stack spacing={1}>
      <Alert severity="warning">
        {outcome.versionPin
          ? workflowText(
              'process.ui.the-version-update-is-unconfirmed',
              'The version update is unconfirmed.',
            )
          : workflowText(
              'process.ui.the-trigger-request-is-unconfirmed',
              'The trigger request is unconfirmed.',
            )}{' '}
        {workflowText(
          'process.ui.further-trigger-commands-are-held-refresh-relationships-inspects-current',
          'Further trigger commands are held. Refresh relationships inspects current evidence and does not repeat the request or confirm its original acknowledgement.',
        )}
      </Alert>
      {requestedInstance ? (
        <Button
          component={RouterLink}
          sx={{ alignSelf: 'flex-start' }}
          to={`/process/tasks?instanceCode=${encodeURIComponent(requestedInstance)}`}
        >
          {workflowText(
            'process.ui.inspect-requested-workflow',
            'Inspect requested workflow',
          )}
        </Button>
      ) : null}
      {outcome.intent.idempotencyKey ? (
        <Button
          disabled={!canInspect || inspecting}
          onClick={onInspect}
          sx={{ alignSelf: 'flex-start' }}
        >
          {inspecting
            ? workflowText(
                'process.ui.inspecting-original-receipt',
                'Inspecting original receipt',
              )
            : workflowText(
                'process.ui.inspect-original-receipt',
                'Inspect original receipt',
              )}
        </Button>
      ) : (
        <Typography color="text.secondary">
          {workflowText(
            'process.ui.an-original-receipt-is-unavailable-for-this-request-its-outcome-remains-',
            'An original receipt is unavailable for this request. Its outcome remains unconfirmed.',
          )}
        </Typography>
      )}
      {outcome.receiptUnknown ? (
        <Typography color="text.secondary">
          {workflowText(
            'process.ui.the-original-receipt-does-not-confirm-completion-the-request-remains-hel',
            'The original receipt does not confirm completion. The request remains held.',
          )}
        </Typography>
      ) : null}
      {inspectionError instanceof Error ? (
        <Alert severity="warning">{inspectionError.message}</Alert>
      ) : null}
    </Stack>
  );
}
