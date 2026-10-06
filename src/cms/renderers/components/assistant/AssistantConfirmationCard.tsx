/** @file Renders immutable confirmation state; uncertain execution never leaves a retry control. */
import { useRef, useState } from 'react';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';

import type { AssistantConfirmation } from '../../../../assistant/api/assistantContracts';
import { parseAssistantActionOutcomes } from '../../../../assistant/api/assistantContractParsers';
import { parseAssistantReview } from '../../../../assistant/api/assistantReview';
import { ShellIcon } from '../../../../app/shell/ShellIcon';

interface AssistantConfirmationCardProps {
  readonly confirmation: AssistantConfirmation;
  readonly result?: Readonly<Record<string, unknown>> | undefined;
  readonly title: string;
  readonly approveLabel: string;
  readonly executeLabel: string;
  readonly rejectLabel: string;
  readonly expiredLabel: string;
  readonly completedLabel: string;
  readonly onApprove: () => Promise<void>;
  readonly onExecute: () => Promise<void>;
  readonly onReject: () => Promise<void>;
  readonly onReconcile?: (() => Promise<void>) | undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Presents reviewed scalar fields and prevents further execution after an uncertain result. */
export function AssistantConfirmationCard(props: AssistantConfirmationCardProps) {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const perform = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await action();
    } catch {
      setUncertain(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const expired = props.confirmation.state === 'EXPIRED';
  const completed =
    props.confirmation.state === 'CONSUMED' || props.result?.state === 'CONSUMED';
  const displayState = uncertain
    ? 'OUTCOME_UNKNOWN'
    : typeof props.result?.state === 'string'
      ? props.result.state
      : props.confirmation.state;
  const summary =
    text(props.confirmation.impact.summary) ?? props.confirmation.operationId;
  let outcomes = props.confirmation.outcomes ?? [];
  let review: ReturnType<typeof parseAssistantReview> = [];
  let invalidReview = false;
  try {
    review = parseAssistantReview(props.confirmation.impact.review);
  } catch {
    invalidReview = true;
  }
  try {
    if (props.result?.rows !== undefined)
      outcomes = parseAssistantActionOutcomes(props.result.rows);
  } catch {
    outcomes = [];
  }

  return (
    <Alert
      severity={
        expired || displayState === 'OUTCOME_UNKNOWN'
          ? 'warning'
          : completed
            ? 'success'
            : 'info'
      }
      variant="outlined"
    >
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            justifyContent: 'space-between',
          }}
        >
          <Typography component="h3" sx={{ fontWeight: 700 }}>
            {props.title}
          </Typography>
          <Chip label={displayState} size="small" />
        </Stack>
        <Typography>{summary}</Typography>
        {props.confirmation.recovery ? (
          <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
            {props.confirmation.confirmationCode}
          </Typography>
        ) : null}
        {props.confirmation.recovery?.continuation &&
        ['PENDING', 'APPROVED'].includes(displayState) ? (
          <Alert severity="info">{props.confirmation.recovery.continuation}</Alert>
        ) : null}
        {props.confirmation.recovery &&
        props.onReconcile &&
        ['EXECUTING', 'OUTCOME_UNKNOWN'].includes(displayState) ? (
          <Button
            disabled={busy}
            variant="outlined"
            startIcon={<ShellIcon name="search" />}
            onClick={() => {
              const inspect = props.onReconcile;
              if (inspect) void perform(inspect);
            }}
          >
            {props.confirmation.recovery.label}
          </Button>
        ) : null}
        {invalidReview ? <Alert severity="warning">Review unavailable.</Alert> : null}
        {review.length ? (
          <Box
            role="region"
            aria-label={props.title}
            tabIndex={0}
            sx={{ maxHeight: 420, overflow: 'auto', minWidth: 0 }}
          >
            {review.map((section, index) => (
              <Box key={index} sx={{ py: 1, borderTop: 1, borderColor: 'divider' }}>
                <Typography component="h4" variant="subtitle2">
                  {section.title}
                </Typography>
                <Box
                  component="dl"
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'minmax(70px, 1fr) minmax(0, 2fr)',
                      sm: 'minmax(120px, 1fr) minmax(0, 3fr)',
                    },
                    gap: 1,
                    '& dd': { m: 0 },
                    overflowWrap: 'anywhere',
                  }}
                >
                  {section.fields.map((field, fieldIndex) => (
                    <Box key={fieldIndex} sx={{ display: 'contents' }}>
                      <Typography component="dt" variant="body2" color="text.secondary">
                        {field.label}
                      </Typography>
                      <Typography component="dd" variant="body2">
                        {field.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        ) : null}
        {expired ? <Typography>{props.expiredLabel}</Typography> : null}
        {completed ? <Typography>{props.completedLabel}</Typography> : null}
        {outcomes.length ? (
          <Stack
            component="ul"
            spacing={0.5}
            sx={{ m: 0, pl: 2.5, maxHeight: 240, overflow: 'auto' }}
          >
            {outcomes.map((row) => (
              <Typography
                component="li"
                key={`${row.index}:${row.schema}:${row.code}`}
                variant="body2"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {row.schema}: {row.code} - {row.state.replaceAll('_', ' ')}
              </Typography>
            ))}
          </Stack>
        ) : null}
        {!expired && !completed && ['PENDING', 'APPROVED'].includes(displayState) ? (
          <Stack
            direction="row"
            sx={{ alignSelf: 'flex-start', flexWrap: 'wrap', gap: 1 }}
          >
            {props.confirmation.state === 'PENDING' ? (
              <Button
                disabled={busy || invalidReview}
                variant="contained"
                onClick={() => void perform(props.onApprove)}
              >
                {props.approveLabel}
              </Button>
            ) : (
              <Button
                color="warning"
                variant="contained"
                disabled={busy || invalidReview}
                onClick={() => void perform(props.onExecute)}
              >
                {props.executeLabel}
              </Button>
            )}
            <Button
              disabled={busy}
              variant="outlined"
              onClick={() => void perform(props.onReject)}
            >
              {props.rejectLabel}
            </Button>
          </Stack>
        ) : null}
      </Stack>
    </Alert>
  );
}
