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
} from '@mui/material';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { invokeOperationalOwner } from '../shared/operationalOwnerClient';
type Redemption = {
  entitlementCode: string;
  productCode: string;
  claimStatus: string;
  revision: number;
  merchantLabel: string;
  mode: string;
  redemptionCode: string;
  receiptCode?: string;
  merchantReceiptReference?: string;
  eligible?: boolean;
  recoveryRequired?: boolean;
  validationCode?: string;
  validationExpiresAt?: string;
  confirmationKey?: string;
  expiresAt?: string;
  branchCode?: string;
};
/** Digital Core owns scoped merchant fulfillment; this panel submits explicitly reviewed commands only. */
export function MerchantRedemptionPanel({
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
  const [rows, setRows] = useState<Redemption[] | null>(null),
    [chosen, setChosen] = useState<Redemption | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [presentation, setPresentation] = useState(''),
    [receipt, setReceipt] = useState('');
  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await invokeOperationalOwner<{ redemptions: Redemption[] }>(
        configuration,
        'digitalCore',
        '/merchant/redemptions',
      );
      setRows(r.redemptions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cannot load merchant requests');
    } finally {
      setBusy(false);
    }
  };
  if (!selectModuleConnection(bootstrap, 'digitalCore')) return null;
  return (
    <Paper sx={{ p: 2 }} data-functional-module="digitalCore">
      <Stack spacing={2}>
        <Typography variant="h6">Merchant coupon fulfillment</Typography>
        <Typography>
          Validate the customer’s coupon for your enterprise, then confirm fulfillment
          with your transaction or receipt reference.
        </Typography>
        <TextField
          label="Customer coupon code"
          value={presentation}
          onChange={(e) => setPresentation(e.target.value.trim().toUpperCase())}
        />
        <Button
          disabled={busy || !presentation}
          onClick={() => {
            void (async () => {
              setBusy(true);
              setError('');
              try {
                const result = await invokeOperationalOwner<Redemption>(
                  configuration,
                  'digitalCore',
                  '/merchant/redemptions/validate',
                  { couponToken: presentation },
                );
                if (!result.eligible)
                  throw new Error(
                    'This coupon has already been redeemed. Receipt: ' +
                      (result.receiptCode || ''),
                  );
                setReceipt('');
                setChosen(result);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Cannot validate coupon');
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          Validate presented coupon
        </Button>
        <Button disabled={busy} onClick={() => void load()}>
          Load merchant requests
        </Button>
        {error && <Alert severity="error">{error}</Alert>}
        {rows?.map((row) => (
          <Paper variant="outlined" sx={{ p: 2 }} key={row.entitlementCode}>
            <Typography>
              {row.merchantLabel} · {row.productCode}
            </Typography>
            <Typography>
              {row.redemptionCode} · {row.claimStatus}
            </Typography>
            {row.receiptCode ? (
              <Typography>
                Merchant receipt: {row.merchantReceiptReference || row.receiptCode}
              </Typography>
            ) : (
              <Button
                disabled={
                  busy ||
                  row.claimStatus !== 'CLAIMED' ||
                  (row.mode === 'MERCHANT_SCREEN' && !row.recoveryRequired)
                }
                onClick={() => {
                  setReceipt(row.merchantReceiptReference || '');
                  setChosen(row);
                }}
              >
                {row.recoveryRequired
                  ? 'Resume fulfillment confirmation'
                  : 'Review fulfillment'}
              </Button>
            )}
          </Paper>
        ))}
        {rows?.length === 0 && (
          <Typography>No merchant requests in your assigned scope.</Typography>
        )}
      </Stack>
      <Dialog
        open={!!chosen}
        onClose={() => {
          if (!busy) setChosen(null);
        }}
      >
        <DialogTitle>Confirm merchant fulfillment</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography>{chosen?.merchantLabel}</Typography>
          <Typography>
            Confirm that this coupon benefit has been fulfilled. This completes
            redemption and creates a receipt.
          </Typography>
          {chosen?.mode === 'MERCHANT_SCREEN' && (
            <>
              <Typography>
                Enterprise: {chosen.merchantLabel}. Enter your transaction or receipt
                reference after fulfilling this benefit.
              </Typography>
              <TextField
                fullWidth
                label="Merchant transaction or receipt reference"
                value={receipt}
                onChange={(e) => setReceipt(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 120 } }}
              />
            </>
          )}
          {chosen?.mode === 'LOCAL_SAMPLE' && (
            <Alert severity="info">
              Local sample fulfillment. No external POS is contacted.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setChosen(null)}>
            Cancel
          </Button>
          <Button
            disabled={
              busy || (chosen?.mode === 'MERCHANT_SCREEN' && receipt.trim().length < 3)
            }
            onClick={() => {
              void (async () => {
                if (!chosen) return;
                setBusy(true);
                setError('');
                try {
                  await invokeOperationalOwner(
                    configuration,
                    'digitalCore',
                    '/merchant/redemptions/' +
                      encodeURIComponent(chosen.entitlementCode) +
                      '/confirm',
                    {
                      confirmed: true,
                      validationCode: chosen.validationCode,
                      validationExpiresAt: chosen.validationExpiresAt,
                      merchantReceiptReference: receipt.trim(),
                      expectedRevision: chosen.revision,
                      idempotencyKey:
                        chosen.confirmationKey || 'confirm:' + chosen.entitlementCode,
                    },
                  );
                  setChosen(null);
                  await load();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : 'Cannot confirm fulfillment',
                  );
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Confirm fulfillment
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
