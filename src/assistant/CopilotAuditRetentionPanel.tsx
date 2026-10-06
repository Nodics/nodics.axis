/** @file Independent audit-retention review, one-shot deletion and original-operation recovery. */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import type { AssistantTransportConfiguration } from './api/assistantTransport';
import {
  auditRetentionCommand,
  parseAuditRetentionReceipt,
  type AuditKind,
  type AuditRetentionCapability,
  type AuditRetentionReceipt,
} from './api/copilotAuditRetentionClient';
/** Owner capability is admission metadata only; every command is reauthorized server-side. */
export function CopilotAuditRetentionPanel({
  configuration,
  capability,
}: {
  readonly configuration: AssistantTransportConfiguration;
  readonly capability: AuditRetentionCapability;
}) {
  const copy = capability.presentation;
  const [kind, setKind] = useState<AuditKind | ''>(capability.kinds[0] || '');
  const [reason, setReason] = useState('');
  const [operationCode, setOperationCode] = useState('');
  const [receipt, setReceipt] = useState<AuditRetentionReceipt>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  /** Invalidates an unsubmitted review immediately on human input changes. */
  function invalidate() {
    setReceipt(undefined);
    setConfirmed(false);
    setFailed(false);
  }
  /** Retains the original reference before dispatch; no catch path retries deletion. */
  async function send(operation: 'preview' | 'execute' | 'inspect' | 'stop') {
    if (
      pending.current ||
      (operation === 'execute' &&
        (!confirmed || receipt?.state !== 'REVIEWED' || dispatched || !receipt.count))
    )
      return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setFailed(false);
    setConfirmed(false);
    if (operation === 'execute') setDispatched(true);
    if (operation === 'preview') setReceipt(undefined);
    try {
      const body =
        operation === 'preview'
          ? { kind, reason }
          : operation === 'execute'
            ? {
                kind,
                reason,
                operationCode: receipt!.operationCode,
                cutoff: receipt!.cutoff,
                reviewDigest: receipt!.reviewDigest,
                confirmed: true,
              }
            : { operationCode };
      const value = await auditRetentionCommand(
        configuration,
        operation,
        body,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const next = parseAuditRetentionReceipt(
        value,
        configuration.enterpriseCode,
        operation === 'preview' ? undefined : operationCode,
      );
      if (operation === 'preview' && (next.state !== 'REVIEWED' || next.kind !== kind))
        throw new Error('Changed audit review');
      if (
        operation === 'execute' &&
        (next.state !== 'COMPLETED' || next.reviewDigest !== receipt!.reviewDigest)
      )
        throw new Error('Changed original audit operation');
      setReceipt(next);
      setOperationCode(next.operationCode);
      if (operation !== 'preview') setDispatched(true);
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
    <Stack
      component="section"
      spacing={2}
      sx={{ py: 3, borderTop: 1, borderColor: 'divider', minWidth: 0 }}
    >
      <Typography variant="h5">{copy.title}</Typography>
      {capability.canDelete && !dispatched ? (
        <>
          <TextField
            select
            label={copy.kind}
            value={kind}
            disabled={busy}
            onChange={(event) => {
              setKind(event.target.value as AuditKind);
              invalidate();
            }}
          >
            {capability.kinds.map((item) => (
              <MenuItem key={item} value={item}>
                {copy[item]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={copy.reason}
            value={reason}
            disabled={busy}
            onChange={(event) => {
              setReason(event.target.value);
              invalidate();
            }}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          <Box>
            <Button
              startIcon={<ShellIcon name="search" />}
              disabled={busy || !kind || !reason.trim()}
              onClick={() => void send('preview')}
            >
              {copy.review}
            </Button>
          </Box>
        </>
      ) : null}
      {receipt?.state === 'REVIEWED' && !dispatched ? (
        <Stack spacing={1}>
          <Typography>
            {copy.count}: {receipt.count}
          </Typography>
          <Typography>
            {copy.cutoff}: {receipt.cutoff}
          </Typography>
          <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
            {copy.reference}: {receipt.reviewDigest}
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
              color="error"
              startIcon={<ShellIcon name="approve" />}
              disabled={busy || !confirmed || !receipt.count}
              onClick={() => void send('execute')}
            >
              {copy.execute}
            </Button>
          </Box>
        </Stack>
      ) : null}
      <TextField
        label={copy.operationCode}
        value={operationCode}
        disabled={busy || dispatched}
        onChange={(event) => {
          setOperationCode(event.target.value);
          invalidate();
        }}
        slotProps={{ htmlInput: { maxLength: 64 } }}
      />
      {dispatched ? (
        <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
          {copy.operationCode}: {operationCode}
        </Typography>
      ) : null}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button
          startIcon={<ShellIcon name="search" />}
          disabled={busy || !operationCode}
          onClick={() => void send('inspect')}
        >
          {copy.inspect}
        </Button>
        {receipt && ['PREPARED', 'COMPLETED', 'STOPPED'].includes(receipt.state) ? (
          <Button disabled={busy} onClick={() => void send('stop')}>
            {receipt.state === 'PREPARED' ? copy.stop : copy.release}
          </Button>
        ) : null}
      </Stack>
      {failed ? <Alert severity="warning">{copy.failed}</Alert> : null}
      {dispatched && receipt?.state === 'REVIEWED' ? (
        <Alert severity="warning">{copy.OUTCOME_UNKNOWN}</Alert>
      ) : receipt && receipt.state !== 'REVIEWED' ? (
        <Alert severity={receipt.state === 'COMPLETED' ? 'success' : 'info'}>
          {copy[receipt.state]}
        </Alert>
      ) : null}
    </Stack>
  );
}
