/** @file Scoped call inspection and explicit evidence-backed reconciliation with no queued or repeated writes. */
import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  createReconciliationClient,
  type UsageCall,
  type ReconciliationCommand,
  type ReconciliationPreview,
} from './api/copilotReconciliationClient';
import type { AssistantTransportConfiguration } from './api/assistantTransport';
/** Loads exact call metadata; identity changes unmount the parent session. */
export function CopilotUsageCallPanel({
  configuration,
  callId,
  periodKey,
  onClose,
}: {
  readonly configuration: AssistantTransportConfiguration;
  readonly callId: string;
  readonly periodKey: string;
  readonly onClose: () => void;
}) {
  const client = useMemo(
    () => createReconciliationClient(configuration),
    [configuration],
  );
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{
    client: typeof client;
    key: string;
    detail?: UsageCall;
    failed?: boolean;
  }>();
  const key = JSON.stringify([callId, periodKey, version]);
  useEffect(() => {
    const abort = new AbortController();
    void client
      .get(periodKey, callId, abort.signal)
      .then((detail) => {
        if (!abort.signal.aborted) setResult({ client, key, detail });
      })
      .catch(() => {
        if (!abort.signal.aborted) setResult({ client, key, failed: true });
      });
    return () => abort.abort();
  }, [client, key, callId, periodKey]);
  const current = result?.client === client && result.key === key ? result : undefined;
  if (!current?.detail)
    return (
      <Dialog open onClose={onClose} fullWidth maxWidth="sm">
        <DialogContent>
          {current?.failed ? (
            <Alert severity="warning">Workspace could not be loaded.</Alert>
          ) : (
            <Skeleton variant="rectangular" height={220} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
          {current?.failed ? (
            <Button onClick={() => setVersion((value) => value + 1)}>Retry</Button>
          ) : null}
        </DialogActions>
      </Dialog>
    );
  return (
    <CopilotUsageCallView
      key={key}
      detail={current.detail}
      onClose={onClose}
      onRefresh={() => setVersion((value) => value + 1)}
      onPreview={client.preview}
      onReconcile={async (command) => {
        const detail = await client.reconcile(command);
        setResult({ client, key, detail });
      }}
    />
  );
}
/** Requires reason, server preview and explicit confirmation; uncertain outcomes only offer a fresh read. */
export function CopilotUsageCallView({
  detail,
  onClose,
  onRefresh,
  onPreview,
  onReconcile,
}: {
  readonly detail: UsageCall;
  readonly onClose: () => void;
  readonly onRefresh: () => void;
  readonly onPreview: (
    command: ReconciliationCommand,
  ) => Promise<ReconciliationPreview>;
  readonly onReconcile: (command: ReconciliationCommand) => Promise<void>;
}) {
  const copy = detail.presentation,
    item = detail.item;
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<ReconciliationPreview>();
  const [failure, setFailure] = useState<'REVIEW' | 'SAVE'>();
  const reviewMutation = useMutation({ mutationFn: onPreview }),
    saveMutation = useMutation({ mutationFn: onReconcile });
  const busy = reviewMutation.isPending || saveMutation.isPending;
  const review = async () => {
    if (busy || !reason.trim() || !detail.evidence) return;
    setFailure(undefined);
    try {
      const value = await reviewMutation.mutateAsync({
        periodKey: detail.periodKey,
        callId: item.callId,
        evidenceDigest: detail.evidence.digest,
        changeId: crypto.randomUUID(),
        reason: reason.trim(),
      });
      if (value.measured !== detail.evidence.totalTokens)
        throw new Error('Measurement changed');
      setPreview(value);
    } catch {
      setFailure('REVIEW');
    }
  };
  const save = async () => {
    if (!preview || busy || failure === 'SAVE') return;
    try {
      await saveMutation.mutateAsync(preview.command);
      setPreview(undefined);
      setReason('');
    } catch {
      setFailure('SAVE');
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{preview ? copy.review : copy.details}</DialogTitle>
      <DialogContent>
        {failure ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {failure === 'SAVE' ? copy.uncertain : copy.reviewFailed}
          </Alert>
        ) : null}
        {preview ? (
          <>
            <Alert severity="info">{copy.reviewNotice}</Alert>
            <Stack spacing={2} sx={{ my: 2 }}>
              <Typography>
                {copy.reserved}: {preview.reserved.toLocaleString()}
              </Typography>
              <Typography>
                {copy.measured}: {preview.measured.toLocaleString()}
              </Typography>
              <Typography sx={{ overflowWrap: 'anywhere' }}>
                {preview.command.reason}
              </Typography>
            </Stack>
          </>
        ) : (
          <>
            <Box
              component="dl"
              sx={{
                m: 0,
                display: 'grid',
                gridTemplateColumns: 'minmax(100px,1fr) minmax(0,2fr)',
                gap: 2,
              }}
            >
              {(
                [
                  [copy.callId, item.callId],
                  [copy.principal, item.principalCode],
                  [copy.model, item.model],
                  [copy.adapter, item.adapter],
                  [copy.profile, item.profile],
                  [copy.purpose, item.purpose],
                  [copy.period, detail.periodKey],
                  [
                    copy.state,
                    item.state === 'MEASURED'
                      ? copy.measured
                      : item.state === 'PENDING'
                        ? copy.reconciliation
                        : copy.inProgress,
                  ],
                  [copy.consumed, item.consumed?.toLocaleString() ?? '-'],
                  [copy.reserved, item.reserved.toLocaleString()],
                  [copy.created, new Date(item.createdAt).toLocaleString()],
                  [
                    copy.completed,
                    item.completedAt
                      ? new Date(item.completedAt).toLocaleString()
                      : '-',
                  ],
                ] as const
              ).map(([label, value]) => (
                <Box key={label} sx={{ display: 'contents' }}>
                  <Typography component="dt" color="text.secondary" variant="body2">
                    {label}
                  </Typography>
                  <Typography
                    component="dd"
                    variant="body2"
                    sx={{ m: 0, overflowWrap: 'anywhere' }}
                  >
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
            {detail.evidence ? (
              <Alert severity="info" sx={{ mt: 3 }}>
                {copy.evidence}: {detail.evidence.totalTokens.toLocaleString()}
              </Alert>
            ) : item.state !== 'MEASURED' ? (
              <Alert severity="warning" sx={{ mt: 3 }}>
                {copy.noEvidence}
              </Alert>
            ) : null}
            {detail.reconciliation ? (
              <Box sx={{ mt: 2 }}>
                <Typography>
                  {copy.reconciled}: {detail.reconciliation.actor}
                </Typography>
                <Typography sx={{ overflowWrap: 'anywhere' }}>
                  {detail.reconciliation.reason}
                </Typography>
              </Box>
            ) : null}
            {detail.canReconcile ? (
              <TextField
                label={copy.reason}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={busy}
                multiline
                minRows={2}
                fullWidth
                sx={{ mt: 3 }}
                slotProps={{ htmlInput: { maxLength: 500 } }}
              />
            ) : null}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap' }}>
        <Button onClick={onClose} disabled={busy}>
          {copy.close}
        </Button>
        <Button onClick={onRefresh} disabled={busy}>
          {copy.refreshCall}
        </Button>
        {detail.canReconcile && failure !== 'SAVE' ? (
          <Button
            variant="contained"
            disabled={busy || !reason.trim() || reason.length > 500}
            onClick={() => void (preview ? save() : review())}
          >
            {preview ? copy.confirm : copy.review}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
