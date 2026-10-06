/** @file Reviewed Cron activation and original-command recovery, with no automatic replay. */
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
import type { AxisModuleConnection } from '../../bootstrap/publicBootstrap';
import { ShellIcon } from '../../app/shell/ShellIcon';
import type { CronJobClientConfiguration } from './api/cronJobClient';
import {
  parseScheduleLifecycleReceipt,
  parseScheduleLifecycleReview,
  scheduleLifecycleRequest,
  type ScheduleLifecycleCapability,
  type ScheduleLifecycleReceipt,
  type ScheduleLifecycleReview,
} from './api/cronScheduleDraftClient';

interface Props {
  readonly connection: AxisModuleConnection;
  readonly configuration: CronJobClientConfiguration;
  readonly capability: ScheduleLifecycleCapability;
  readonly initialCode?: string;
  readonly onChanged?: () => void;
}
/** The parent session remounts on scope changes; this component only acts on explicitly inspected identities. */
export function CronScheduleLifecyclePanel({
  connection,
  configuration,
  capability,
  initialCode = '',
  onChanged,
}: Props) {
  const [code, setCode] = useState(initialCode);
  const [receipt, setReceipt] = useState<ScheduleLifecycleReceipt>();
  const [review, setReview] = useState<ScheduleLifecycleReview>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const copy = capability.presentation;
  /** Freezes the original identity before dispatch; response loss only exposes inspection/reconciliation. */
  async function send(
    operation: 'inspect' | 'preview' | 'execute' | 'reconcile',
    intent?: 'ACTIVATE' | 'DEACTIVATE',
  ) {
    if (
      pending.current ||
      !code ||
      (operation === 'execute' &&
        (!confirmed || !review || (unknown && review.intent !== 'DEACTIVATE'))) ||
      ((operation === 'preview' || operation === 'reconcile') && !receipt)
    )
      return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setFailed(false);
    setConfirmed(false);
    if (operation === 'execute') setUnknown(true);
    if (operation === 'preview') setReview(undefined);
    try {
      const body =
        operation === 'inspect'
          ? { code }
          : operation === 'execute'
            ? {
                code,
                expectedRevision: review!.revision,
                intent: review!.intent,
                reviewDigest: review!.reviewDigest,
                confirmed: true,
              }
            : {
                code,
                expectedRevision: receipt!.revision,
                ...(operation === 'preview' ? { intent } : {}),
              };
      const value = await scheduleLifecycleRequest(
        connection,
        configuration,
        operation,
        body,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (operation === 'preview' && intent)
        setReview(
          parseScheduleLifecycleReview(
            value,
            { code, revision: receipt!.revision, intent },
            configuration.enterpriseCode,
          ),
        );
      else {
        const next = parseScheduleLifecycleReceipt(
          value,
          code,
          configuration.enterpriseCode,
        );
        if (
          operation === 'execute' &&
          (next.revision !== review!.revision + 1 ||
            next.reviewDigest !== review!.reviewDigest ||
            next.intent !== review!.intent)
        )
          throw new Error('Changed original command');
        setReceipt(next);
        setUnknown(next.state === 'OUTCOME_UNKNOWN');
        setReview(undefined);
        if (operation !== 'inspect') onChanged?.();
      }
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <Stack component="section" spacing={2} sx={{ py: 2, minWidth: 0 }}>
      <Typography variant="h5">{copy.title}</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField
          label={copy.code}
          value={code}
          disabled={busy || unknown}
          onChange={(event) => {
            setCode(event.target.value);
            setReceipt(undefined);
            setReview(undefined);
            setConfirmed(false);
          }}
          slotProps={{ htmlInput: { maxLength: 128 } }}
          sx={{ flex: 1 }}
        />
        <Button
          startIcon={<ShellIcon name="search" />}
          disabled={busy || !code}
          onClick={() => void send('inspect')}
        >
          {copy.inspect}
        </Button>
      </Stack>
      {receipt || unknown ? (
        <Alert severity={unknown ? 'warning' : 'info'}>
          {copy[unknown ? 'OUTCOME_UNKNOWN' : receipt!.state]}
        </Alert>
      ) : null}
      {failed ? <Alert severity="error">{copy.failed}</Alert> : null}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        {receipt &&
        !unknown &&
        receipt.state !== 'ACTIVE' &&
        capability.activationEnabled ? (
          <Button
            startIcon={<ShellIcon name="approve" />}
            disabled={busy}
            onClick={() => void send('preview', 'ACTIVATE')}
          >
            {copy.activate}
          </Button>
        ) : null}
        {receipt &&
        (receipt.state === 'ACTIVE' ||
          (receipt.state === 'OUTCOME_UNKNOWN' && receipt.intent === 'ACTIVATE')) ? (
          <Button disabled={busy} onClick={() => void send('preview', 'DEACTIVATE')}>
            {copy.deactivate}
          </Button>
        ) : null}
        {receipt?.state === 'OUTCOME_UNKNOWN' ? (
          <Button
            startIcon={<ShellIcon name="search" />}
            disabled={busy}
            onClick={() => void send('reconcile')}
          >
            {copy.reconcile}
          </Button>
        ) : null}
      </Stack>
      {review ? (
        <Stack spacing={1} sx={{ borderLeft: 3, borderColor: 'divider', pl: 2 }}>
          <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
            {review.intent === 'ACTIVATE' ? copy.activate : copy.deactivate}:{' '}
            {review.code}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {copy.reference}: {review.reviewDigest}
          </Typography>
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
          <Box>
            <Button
              variant="contained"
              startIcon={<ShellIcon name="approve" />}
              disabled={
                busy || !confirmed || (unknown && review.intent !== 'DEACTIVATE')
              }
              onClick={() => void send('execute')}
            >
              {copy.execute}
            </Button>
          </Box>
        </Stack>
      ) : null}
    </Stack>
  );
}
