import { useLayoutEffect, useRef, useState } from 'react';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import type { OperationalOwnerConfiguration } from '../shared/operationalOwnerClient';
import type { WasteListingPresentation } from './api/wasteListingClient';
import {
  inspectListingReconciliation,
  withdrawListingRequest,
  type ListingReconciliation,
} from './api/wasteListingReconciliationClient';

/** Scoped legacy-request hold, not publication cancellation. Owner copy and admission remain authoritative. */
export function WasteListingReconciliation({
  configuration,
  authority,
  assetCode,
  assetRevision,
  copy,
  unresolvedMessage,
  onBusyChange,
}: {
  configuration: OperationalOwnerConfiguration;
  authority: object;
  assetCode?: string | undefined;
  assetRevision?: number | undefined;
  copy: NonNullable<WasteListingPresentation['reconciliation']>;
  unresolvedMessage?: string;
  onBusyChange: (busy: boolean) => void;
}) {
  const generation = useRef(0);
  const [attempts, setAttempts] = useState<
    readonly { authority: object; code: string }[]
  >([]);
  const flight = useRef(false);
  const [read, setRead] = useState<{
    authority: object;
    code: string;
    revision: number | undefined;
    value?: ListingReconciliation;
    failed?: boolean;
  }>();
  const [review, setReview] = useState<{
    authority: object;
    value: ListingReconciliation;
  }>();
  const [reason, setReason] = useState('');
  const [task, setTask] = useState<{ authority: object; code: string }>();
  const busy = task?.authority === authority && task.code === assetCode;
  useLayoutEffect(() => {
    const sequence = generation;
    sequence.current++;
    return () => {
      sequence.current++;
      flight.current = false;
      onBusyChange(false);
    };
  }, [authority, assetCode, assetRevision, onBusyChange]);
  const current =
    read?.authority === authority &&
    read.code === assetCode &&
    read.revision === assetRevision
      ? read
      : undefined;
  const value = current?.value;
  const confirmation =
    review?.authority === authority && review.value === value ? review : undefined;
  const attempted = attempts.some(
    (item) => item.authority === authority && item.code === assetCode,
  );
  const run = async (command: boolean) => {
    if (
      !assetCode ||
      flight.current ||
      (command && (!confirmation || !value?.canWithdraw || attempted || !reason.trim()))
    )
      return;
    const ticket = generation.current,
      selected = assetCode;
    flight.current = true;
    setTask({ authority, code: selected });
    onBusyChange(true);
    setReview(undefined);
    if (command) {
      setAttempts((items) => [...items, { authority, code: selected }]);
    }
    try {
      const result = command
        ? await withdrawListingRequest(
            configuration,
            value!,
            reason,
            `listing-hold-${crypto.randomUUID()}`,
          )
        : await inspectListingReconciliation(configuration, selected);
      if (generation.current === ticket)
        setRead({ authority, code: selected, revision: assetRevision, value: result });
    } catch {
      if (generation.current === ticket)
        setRead({ authority, code: selected, revision: assetRevision, failed: true });
    } finally {
      if (generation.current === ticket) {
        flight.current = false;
        setTask(undefined);
        onBusyChange(false);
      }
    }
  };
  if (!assetCode) return null;
  return (
    <Stack spacing={1} sx={{ minWidth: 0 }}>
      <Button disabled={busy} onClick={() => void run(false)}>
        {copy.inspectLabel}
      </Button>
      {current?.failed && (
        <Alert severity="warning">
          {attempted ? copy.uncertainMessage : copy.unavailableMessage}
        </Alert>
      )}
      {value?.state === 'RECONCILING' && (
        <Alert severity="warning">{copy.holdMessage}</Alert>
      )}
      {value?.state === 'RECONCILIATION_REQUIRED' && unresolvedMessage && (
        <Alert severity="warning">{unresolvedMessage}</Alert>
      )}
      {attempted && value?.state !== 'RECONCILING' && !current?.failed && (
        <Alert severity="warning">{copy.uncertainMessage}</Alert>
      )}
      {value?.receiptCode && (
        <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
          {value.receiptCode}
        </Typography>
      )}
      {value?.canWithdraw && !attempted && !confirmation && (
        <Button
          disabled={busy}
          onClick={() => {
            setReason('');
            setReview({ authority, value });
          }}
        >
          {copy.withdrawLabel}
        </Button>
      )}
      {confirmation && (
        <Stack spacing={1}>
          <Typography>{copy.withdrawLabel}</Typography>
          <TextField
            label={copy.reasonLabel}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            fullWidth
          />
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button disabled={busy} onClick={() => setReview(undefined)}>
              {copy.cancelLabel}
            </Button>
            <Button disabled={busy || !reason.trim()} onClick={() => void run(true)}>
              {copy.confirmLabel}
            </Button>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
