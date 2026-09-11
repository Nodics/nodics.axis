import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
} from '@mui/material';
import { invokeOperationalOwner } from '../shared/operationalOwnerClient';
type Preview = {
  eligible: boolean;
  recovery?: boolean;
  amount?: string;
  currency?: string;
  previewToken?: string;
  status?: string;
  reason?: string;
  approvalReason?: string;
  domain?: { summary: string };
};
/** Renders the Order-owned refund plan before an explicit moderator instruction. */
export function OrderRefundReview({
  configuration,
  code,
  revision,
  onComplete,
}: {
  configuration: Parameters<typeof invokeOperationalOwner>[0];
  code: string;
  revision: number;
  onComplete: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(''),
    [error, setError] = useState('');
  return (
    <>
      <Button
        disabled={busy}
        onClick={() => {
          void (async () => {
            setBusy(true);
            setError('');
            try {
              const p = await invokeOperationalOwner<Preview>(
                configuration,
                'order',
                '/disputes/' + encodeURIComponent(code) + '/refund-preview',
                {},
              );
              setPreview(p);
              setReason(p.approvalReason || '');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Cannot preview refund');
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        Preview refund and reversals
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
      <Dialog
        open={!!preview}
        onClose={() => {
          if (!busy) setPreview(null);
        }}
      >
        <DialogTitle>Review refund and reversals</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error">{error}</Alert>}
          {preview?.eligible ? (
            <>
              <Typography>
                Return {preview.amount} {preview.currency} to the original buyer
                payment.
              </Typography>
              <Typography>{preview.domain?.summary}</Typography>
              <Alert severity="info">
                Approval starts the coordinated refund. Any incomplete step remains
                available for recovery under the same reference.
              </Alert>
              <TextField
                fullWidth
                multiline
                label="Refund approval reason"
                value={reason}
                disabled={preview.recovery}
                onChange={(e) => setReason(e.target.value)}
              />
            </>
          ) : (
            <Alert severity="warning">
              {preview?.reason ||
                'This refund is unavailable or already complete. Use manual review for any unresolved issue.'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setPreview(null)}>
            Cancel
          </Button>
          {preview?.eligible && (
            <Button
              disabled={busy || reason.trim().length < 10}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  setError('');
                  try {
                    const result = await invokeOperationalOwner<{
                      status: string;
                      message: string;
                      reason?: string;
                    }>(
                      configuration,
                      'order',
                      '/disputes/' + encodeURIComponent(code) + '/refund',
                      {
                        confirmed: true,
                        expectedRevision: revision,
                        previewToken: preview.previewToken,
                        reason: reason.trim(),
                        idempotencyKey: code + ':refund',
                      },
                    );
                    await onComplete();
                    if (result.status !== 'COMPLETED') {
                      setError(result.message + ' ' + (result.reason || ''));
                      const next = await invokeOperationalOwner<Preview>(
                        configuration,
                        'order',
                        '/disputes/' + encodeURIComponent(code) + '/refund-preview',
                        {},
                      );
                      setPreview(next);
                      setReason(next.approvalReason || reason);
                    } else setPreview(null);
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : 'Refund requires recovery',
                    );
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              {preview.recovery
                ? 'Retry approved refund'
                : 'Approve refund and reversals'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
