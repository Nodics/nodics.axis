/** @file Owner-admitted retention review, explicit single-page execution and no-replay recovery. */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { AssistantTransportConfiguration } from './api/assistantTransport';
import {
  parseRetentionReceipt,
  parseRetentionReview,
  parseClosureReview,
  parseClosureReceipt,
  retentionCommand,
  type parseRetentionCapability,
  type RetentionReceipt,
} from './api/copilotRetentionClient';

/** Keeps uncertain commands locked until explicit original-operation inspection. */
export function CopilotRetentionPanel({
  configuration,
  conversationCode,
  capability,
  canClose = false,
  canBegin = true,
}: {
  readonly configuration: AssistantTransportConfiguration;
  readonly conversationCode: string;
  readonly canClose?: boolean;
  readonly canBegin?: boolean;
  readonly capability: NonNullable<ReturnType<typeof parseRetentionCapability>>;
}) {
  const copy = capability.presentation;
  const [reason, setReason] = useState('');
  const [review, setReview] = useState<{
    reviewDigest: string;
    maximumBatch?: number;
    intent: 'DELETE' | 'CLOSE';
  }>();
  const [closure, setClosure] = useState<ReturnType<typeof parseClosureReceipt>>();
  const [recoveryMode, setRecoveryMode] = useState<'retention' | 'closure'>(
    'retention',
  );
  const [receipt, setReceipt] = useState<RetentionReceipt>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  /** Invalidates confirmation at dispatch and never resubmits after an unknown outcome. */
  async function send(command: Parameters<typeof retentionCommand>[2]) {
    if (pending.current) return;
    const isReview = ['preview', 'resume-preview', 'close-preview'].includes(command);
    const mode = command.startsWith('close') ? 'closure' : 'retention';
    if (uncertain && (isReview || mode !== recoveryMode)) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setFailed(false);
    setConfirmed(false);
    if (!isReview) {
      setUncertain(true);
      setRecoveryMode(mode);
    }
    const body =
      command === 'preview' || command === 'close-preview'
        ? { reason }
        : command === 'resume-preview' || command === 'resume'
          ? {
              reason,
              operationCode: receipt?.operationCode,
              expectedRevision: receipt?.revision,
              ...(command === 'resume'
                ? { confirmed: true, reviewDigest: review?.reviewDigest }
                : {}),
            }
          : command === 'begin' || command === 'close'
            ? { reason, reviewDigest: review?.reviewDigest, confirmed: true }
            : command === 'inspect' || command === 'close-inspect'
              ? {}
              : {
                  operationCode: receipt?.operationCode,
                  expectedRevision: receipt?.revision,
                };
    try {
      const value = await retentionCommand(
        configuration,
        conversationCode,
        command,
        body,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (isReview)
        setReview(
          command === 'close-preview'
            ? {
                ...parseClosureReview(
                  value,
                  configuration.enterpriseCode,
                  conversationCode,
                ),
                intent: 'CLOSE',
              }
            : {
                ...parseRetentionReview(
                  value,
                  configuration.enterpriseCode,
                  conversationCode,
                ),
                intent: 'DELETE',
              },
        );
      else if (mode === 'closure') {
        setClosure(
          parseClosureReceipt(value, configuration.enterpriseCode, conversationCode),
        );
        setReview(undefined);
        setUncertain(false);
      } else {
        const next = parseRetentionReceipt(
          value,
          configuration.enterpriseCode,
          conversationCode,
        );
        if (
          command !== 'begin' &&
          receipt &&
          (next.operationCode !== receipt.operationCode ||
            next.revision < receipt.revision)
        )
          throw new Error('Changed retention operation');
        setReceipt(next);
        setReview(undefined);
        setUncertain(false);
      }
    } catch {
      if (!controller.signal.aborted) {
        setFailed(true);
        setReview(undefined);
      }
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <Box
      component="section"
      sx={{
        mt: 2,
        borderTop: 1,
        borderColor: 'divider',
        pt: 2,
        overflowWrap: 'anywhere',
      }}
    >
      <Typography variant="h6">{copy.title}</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        {conversationCode}
      </Typography>
      <Alert severity="warning" sx={{ mb: 2 }}>
        {copy.notice}
      </Alert>
      {(!receipt || receipt.state === 'STOPPED') && !uncertain ? (
        <>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label={copy.reason}
            value={reason}
            disabled={busy}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            onChange={(event) => {
              setReason(event.target.value);
              setReview(undefined);
              setConfirmed(false);
            }}
          />
          {capability.canDelete && (receipt || canBegin) ? (
            <Button
              disabled={busy || !reason.trim()}
              onClick={() => void send(receipt ? 'resume-preview' : 'preview')}
            >
              {receipt ? copy.reviewResume : copy.review}
            </Button>
          ) : null}
          {canClose && !receipt && !closure ? (
            <Button
              disabled={busy || !reason.trim()}
              onClick={() => void send('close-preview')}
            >
              {copy.reviewClosure}
            </Button>
          ) : null}
        </>
      ) : null}
      {review ? (
        <Box sx={{ my: 2 }}>
          {review.intent === 'CLOSE' ? (
            <Alert severity="info">{copy.closureNotice}</Alert>
          ) : null}
          <Typography variant="body2">
            {copy.digest}: {review.reviewDigest}
          </Typography>
          {review.maximumBatch !== undefined ? (
            <Typography variant="body2">
              {copy.batch}: {review.maximumBatch}
            </Typography>
          ) : null}
        </Box>
      ) : null}
      {closure ? (
        <Alert severity="success" sx={{ my: 2 }}>
          {copy.closureRecorded}: {closure.closedAt}
        </Alert>
      ) : null}
      {receipt ? (
        <Box sx={{ my: 2 }}>
          <Typography>{copy[receipt.state]}</Typography>
          <Typography variant="body2">{receipt.operationCode}</Typography>
          <Typography variant="body2">
            {copy.removed}:{' '}
            {receipt.removed.messages + receipt.removed.events + receipt.removed.turns}
          </Typography>
        </Box>
      ) : null}
      {(review || receipt) && !uncertain ? (
        <FormControlLabel
          control={
            <Checkbox
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
          }
          label={copy.confirm}
        />
      ) : null}
      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button
          disabled={busy || (uncertain && recoveryMode !== 'retention')}
          onClick={() => void send('inspect')}
        >
          {copy.inspect}
        </Button>
        <Button
          disabled={busy || (uncertain && recoveryMode !== 'closure')}
          onClick={() => void send('close-inspect')}
        >
          {copy.inspectClosure}
        </Button>
        {review && (review.intent === 'CLOSE' || capability.canDelete) ? (
          <Button
            color="error"
            disabled={busy || uncertain || !confirmed}
            onClick={() =>
              void send(
                review.intent === 'CLOSE' ? 'close' : receipt ? 'resume' : 'begin',
              )
            }
          >
            {review.intent === 'CLOSE'
              ? copy.closeConversation
              : receipt
                ? copy.resume
                : copy.begin}
          </Button>
        ) : null}
        {receipt &&
        !['STOPPED', 'PURGED'].includes(receipt.state) &&
        capability.canDelete ? (
          <Button
            color="error"
            disabled={busy || uncertain || !confirmed}
            onClick={() => void send('advance')}
          >
            {copy.advance}
          </Button>
        ) : null}
        {receipt ? (
          <Button
            disabled={busy || uncertain || !confirmed}
            onClick={() => void send('stop')}
          >
            {copy.stop}
          </Button>
        ) : null}
      </Stack>
      {failed ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {copy.failure}
        </Alert>
      ) : null}
    </Box>
  );
}
