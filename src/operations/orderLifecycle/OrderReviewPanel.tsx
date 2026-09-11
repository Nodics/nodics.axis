import { OrderRefundReview } from './OrderRefundReview';
import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Stack,
  Typography,
  TextField,
  MenuItem,
} from '@mui/material';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { invokeOperationalOwner } from '../shared/operationalOwnerClient';
type Case = {
  code: string;
  orderCode: string;
  status: string;
  revision: number;
  comment: string;
  requestedResolution: string;
  decision?: { reason: string };
};
/** Order owns scoped purchase reviews; a separate explicit refund approval executes the coordinated owner operations. */
export function OrderReviewPanel({
  bootstrap,
  accessToken,
  runtime,
}: {
  bootstrap: AxisAuthenticatedBootstrap;
  accessToken: string;
  runtime: AxisRuntimeConfig;
}) {
  const configuration = useMemo(
    () => ({
      bootstrap,
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [bootstrap, accessToken, runtime],
  );
  const [rows, setRows] = useState<Case[] | null>(null),
    [chosen, setChosen] = useState<Case | null>(null),
    [outcome, setOutcome] = useState('RESOLVED'),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await invokeOperationalOwner<{ cases: Case[] }>(
        configuration,
        'order',
        '/disputes',
      );
      setRows(r.cases);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cannot load order reviews');
    } finally {
      setBusy(false);
    }
  };
  if (!selectModuleConnection(bootstrap, 'order')) return null;
  return (
    <Paper sx={{ p: 2 }} data-functional-module="order">
      <Stack spacing={2}>
        <Typography variant="h6">Manual purchase reviews</Typography>
        <Button disabled={busy} onClick={() => void load()}>
          Load order reviews
        </Button>
        {error && <Alert severity="error">{error}</Alert>}
        {rows?.map((row) => (
          <Paper variant="outlined" sx={{ p: 2 }} key={row.code}>
            <Typography>
              {row.orderCode} · {row.requestedResolution} · {row.status}
            </Typography>
            <Typography>{row.comment}</Typography>
            {['REFUND', 'CANCELLATION'].includes(row.requestedResolution) &&
              ['SUBMITTED', 'REFUND_RECONCILIATION'].includes(row.status) && (
                <OrderRefundReview
                  configuration={configuration}
                  code={row.code}
                  revision={row.revision}
                  onComplete={load}
                />
              )}
            {row.status === 'REFUNDED' ? (
              <Typography>Refund and reversals completed.</Typography>
            ) : row.status === 'REFUND_RECONCILIATION' ? (
              <Typography>Resume the approved refund to finish recovery.</Typography>
            ) : row.decision ? (
              <Typography>Resolution: {row.decision.reason}</Typography>
            ) : (
              <Button
                disabled={busy}
                onClick={() => {
                  setChosen(row);
                  setReason('');
                }}
              >
                Review case
              </Button>
            )}
          </Paper>
        ))}
        {rows?.length === 0 && (
          <Typography>No order reviews in your assigned scope.</Typography>
        )}
      </Stack>
      <Dialog
        open={!!chosen}
        onClose={() => {
          if (!busy) setChosen(null);
        }}
      >
        <DialogTitle>Review purchase case</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography>{chosen?.comment}</Typography>
          <Alert severity="info">
            This records a manual outcome. No refund, reward reversal or ownership
            transfer is executed.
          </Alert>
          <TextField
            fullWidth
            select
            label="Outcome"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            sx={{ mt: 2 }}
          >
            <MenuItem value="RESOLVED">Resolved after manual review</MenuItem>
            <MenuItem value="REJECTED">Request rejected</MenuItem>
          </TextField>
          <TextField
            fullWidth
            multiline
            label="Resolution reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setChosen(null)}>
            Cancel
          </Button>
          <Button
            disabled={busy || reason.trim().length < 10}
            onClick={() => {
              void (async () => {
                if (!chosen) return;
                setBusy(true);
                setError('');
                try {
                  await invokeOperationalOwner(
                    configuration,
                    'order',
                    '/disputes/' + encodeURIComponent(chosen.code) + '/resolve',
                    {
                      confirmed: true,
                      expectedRevision: chosen.revision,
                      idempotencyKey: chosen.code + ':resolve:' + chosen.revision,
                      outcome,
                      reason,
                    },
                  );
                  setChosen(null);
                  await load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Cannot save review');
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Confirm review outcome
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
