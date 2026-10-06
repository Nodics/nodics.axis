/** @file Secure coupon review and explicit receipt recovery; raw tokens stay in the transient form and owning validation request only. */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import { AssistantConfirmationCard } from '../cms/renderers/components/assistant/AssistantConfirmationCard';
import type { AssistantClient } from './api/assistantClient';
import type { AssistantConfirmation } from './api/assistantContracts';
import {
  couponConfirmation,
  type CopilotCouponClient,
  type CouponContract,
  type CouponRedemptions,
  type CouponWorkspace,
} from './api/copilotCouponClient';

interface Props {
  readonly contract: CouponContract;
  readonly client: CopilotCouponClient;
  readonly actions: AssistantClient;
}
/** Keeps the original action when the dialog closes; scope remount discards all state. Existing references can be reopened after navigation. */
export function CopilotCouponComposer({ contract, client, actions }: Props) {
  const copy = contract.presentation;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'REDEEM' | 'ACTIVITY'>('REDEEM');
  const [workspace, setWorkspace] = useState<CouponWorkspace>();
  const [redemptions, setRedemptions] = useState<CouponRedemptions>();
  const [redemptionsBusy, setRedemptionsBusy] = useState(false);
  const [redemptionsFailed, setRedemptionsFailed] = useState(false);
  const [redemptionsRevision, setRedemptionsRevision] = useState(0);
  const [token, setToken] = useState('');
  const [receipt, setReceipt] = useState('');
  const [store, setStore] = useState<CouponWorkspace['stores'][number] | null>(null);
  const [reference, setReference] = useState('');
  const [confirmation, setConfirmation] = useState<AssistantConfirmation>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [receiptCode, setReceiptCode] = useState<string>();
  const flight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!open || confirmation) return;
    const abort = new AbortController();
    void Promise.resolve()
      .then(() => client.workspace(abort.signal))
      .then((value) => {
        if (!abort.signal.aborted) setWorkspace(value);
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      });
    return () => abort.abort();
  }, [open, confirmation, client]);
  useEffect(() => {
    if (!open || view !== 'ACTIVITY' || !contract.redemptionsAvailable) return;
    const abort = new AbortController();
    setRedemptionsBusy(true);
    setRedemptionsFailed(false);
    void client
      .redemptions(abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setRedemptions(value);
      })
      .catch(() => {
        if (!abort.signal.aborted) setRedemptionsFailed(true);
      })
      .finally(() => {
        if (!abort.signal.aborted) setRedemptionsBusy(false);
      });
    return () => abort.abort();
  }, [open, view, contract.redemptionsAvailable, client, redemptionsRevision]);
  const close = () => {
    if (!flight.current) {
      setToken('');
      setView('REDEEM');
      if (!confirmation) {
        setWorkspace(undefined);
        setStore(null);
      }
      setOpen(false);
    }
  };
  const perform = async (operation: () => Promise<void>, command = false) => {
    if (flight.current) return;
    if (!navigator.onLine) {
      setFailed(true);
      return;
    }
    flight.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await operation();
    } catch {
      if (mounted.current) {
        setFailed(true);
        if (command) setUncertain(true);
      }
    } finally {
      flight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const accept = (value: AssistantConfirmation) => {
    if (!mounted.current) return;
    const next = couponConfirmation(value);
    if (
      confirmation &&
      (next.confirmationCode !== confirmation.confirmationCode ||
        next.argumentsDigest !== confirmation.argumentsDigest)
    )
      throw new Error('Action mismatch');
    setConfirmation(next);
    setReference(next.confirmationCode);
    setUncertain(false);
  };
  const reload = async () =>
    accept(await actions.getConfirmation(confirmation?.confirmationCode || reference));
  const intent = confirmation
    ? {
        expectedRevision: confirmation.revision,
        argumentsDigest: confirmation.argumentsDigest,
      }
    : undefined;
  const valid =
    workspace &&
    token.trim().length >= 4 &&
    token.length <= 256 &&
    !Array.from(token).some((character) => character.charCodeAt(0) < 32) &&
    /^[A-Za-z0-9][A-Za-z0-9 ._:/-]{2,119}$/.test(receipt) &&
    (!workspace.storeRequired || store);
  return (
    <>
      <Button
        startIcon={<ShellIcon name="pricing" />}
        onClick={() => setOpen(true)}
        sx={{ mx: { xs: 2, md: 3 }, mb: 1 }}
      >
        {copy.open}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        fullWidth
        maxWidth="md"
        aria-labelledby="copilot-coupon-title"
      >
        <DialogTitle id="copilot-coupon-title">{copy.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1, minWidth: 0 }}>
            {busy ? <LinearProgress /> : null}
            {failed ? <Alert severity="warning">{copy.unavailable}</Alert> : null}
            {!confirmation && contract.redemptionsAvailable ? (
              <Tabs
                value={view}
                onChange={(_, value: 'REDEEM' | 'ACTIVITY') => setView(value)}
                aria-label={copy.title}
              >
                <Tab value="REDEEM" label={copy.redeemTab} />
                <Tab value="ACTIVITY" label={copy.redemptionsTab} />
              </Tabs>
            ) : null}
            {confirmation ? (
              <>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                  {copy.actionReference}: {confirmation.confirmationCode}
                </Typography>
                <AssistantConfirmationCard
                  key={`${confirmation.confirmationCode}:${confirmation.revision}:${uncertain}`}
                  confirmation={confirmation}
                  result={uncertain ? { state: 'OUTCOME_UNKNOWN' } : undefined}
                  title={copy.title}
                  approveLabel={copy.approve}
                  executeLabel={copy.execute}
                  rejectLabel={copy.reject}
                  expiredLabel={copy.expired}
                  completedLabel={copy.completed}
                  onApprove={() =>
                    perform(
                      async () =>
                        accept(
                          await actions.approveConfirmation(
                            confirmation.confirmationCode,
                            intent!,
                          ),
                        ),
                      true,
                    )
                  }
                  onReject={() =>
                    perform(
                      async () =>
                        accept(
                          await actions.rejectConfirmation(
                            confirmation.confirmationCode,
                            intent!,
                          ),
                        ),
                      true,
                    )
                  }
                  onExecute={() =>
                    perform(async () => {
                      setUncertain(true);
                      await actions.executeConfirmation(
                        confirmation.confirmationCode,
                        intent!,
                      );
                      await reload();
                    }, true)
                  }
                />
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Button
                    disabled={busy}
                    startIcon={<ShellIcon name="refresh" />}
                    onClick={() => void perform(reload)}
                  >
                    {copy.reload}
                  </Button>
                  {!uncertain &&
                  ['EXECUTING', 'OUTCOME_UNKNOWN'].includes(confirmation.state) ? (
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void perform(async () => {
                          const result = await client.inspect(confirmation);
                          if (!mounted.current) return;
                          accept(result.confirmation);
                          setUnconfirmed(result.receiptState === 'UNCONFIRMED');
                          setReceiptCode(result.receiptCode);
                        })
                      }
                    >
                      {copy.inspect}
                    </Button>
                  ) : null}
                </Stack>
                {unconfirmed ? (
                  <Alert severity="warning">{copy.unconfirmed}</Alert>
                ) : null}
                {receiptCode ? (
                  <Typography sx={{ overflowWrap: 'anywhere' }}>
                    {copy.receipt}: {receiptCode}
                  </Typography>
                ) : null}
              </>
            ) : view === 'ACTIVITY' && contract.redemptionsAvailable ? (
              <Stack spacing={2} sx={{ minWidth: 0 }}>
                {redemptionsBusy ? <LinearProgress /> : null}
                {redemptionsFailed ? (
                  <Alert severity="warning">{copy.unavailable}</Alert>
                ) : null}
                {!redemptionsBusy && !redemptionsFailed && redemptions ? (
                  redemptions.redemptions.length ? (
                    <TableContainer sx={{ maxHeight: 420 }}>
                      <Table stickyHeader size="small" aria-label={copy.redemptionsTab}>
                        <TableHead>
                          <TableRow>
                            <TableCell>{copy.product}</TableCell>
                            <TableCell>{copy.status}</TableCell>
                            <TableCell>{copy.receipt}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {redemptions.redemptions.map((row) => (
                            <TableRow key={`${row.entitlementCode}:${row.revision}`}>
                              <TableCell>
                                <Stack spacing={0.25}>
                                  <Typography variant="body2">
                                    {row.productCode}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ overflowWrap: 'anywhere' }}
                                  >
                                    {row.entitlementCode}
                                  </Typography>
                                </Stack>
                              </TableCell>
                              <TableCell>
                                <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
                                  <Chip size="small" label={row.claimStatus} />
                                  {row.recoveryRequired ? (
                                    <Typography variant="caption" color="warning.main">
                                      {copy.recoveryRequired}
                                    </Typography>
                                  ) : null}
                                </Stack>
                              </TableCell>
                              <TableCell sx={{ overflowWrap: 'anywhere' }}>
                                {row.receiptCode || row.merchantReceiptReference || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography color="text.secondary">
                      {copy.emptyRedemptions}
                    </Typography>
                  )
                ) : null}
                <Button
                  startIcon={<ShellIcon name="refresh" />}
                  disabled={redemptionsBusy}
                  onClick={() => {
                    setRedemptions(undefined);
                    setRedemptionsRevision((value) => value + 1);
                  }}
                >
                  {copy.refreshRedemptions}
                </Button>
              </Stack>
            ) : (
              <>
                <TextField
                  label={copy.coupon}
                  type="password"
                  autoComplete="off"
                  value={token}
                  disabled={busy || !workspace}
                  onChange={(event) => setToken(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 256, spellCheck: false } }}
                />
                <TextField
                  label={workspace?.receiptLabel || copy.receipt}
                  value={receipt}
                  disabled={busy || !workspace}
                  onChange={(event) => setReceipt(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 120 } }}
                />
                {workspace?.stores.length || workspace?.storeRequired ? (
                  <Autocomplete
                    options={workspace.stores}
                    value={store}
                    disabled={busy}
                    getOptionLabel={(item) => item.name}
                    isOptionEqualToValue={(a, b) => a.code === b.code}
                    onChange={(_, value) => setStore(value)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={workspace.storeLabel}
                        required={workspace.storeRequired}
                      />
                    )}
                  />
                ) : null}
                <Button
                  variant="contained"
                  disabled={busy || !valid}
                  onClick={() => {
                    if (!valid || flight.current || !navigator.onLine) return;
                    const input = {
                      couponToken: token,
                      merchantReceiptReference: receipt,
                      ...(store ? { storeCode: store.code } : {}),
                    };
                    setToken('');
                    void perform(async () => accept(await client.prepare(input)));
                  }}
                >
                  {copy.prepare}
                </Button>
                <TextField
                  label={copy.actionReference}
                  value={reference}
                  disabled={busy}
                  onChange={(event) => setReference(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 128 } }}
                />
                <Button
                  disabled={busy || !/^coupon-plan-[A-Za-z0-9-]+$/.test(reference)}
                  onClick={() => void perform(reload)}
                >
                  {copy.resume}
                </Button>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          {confirmation &&
          ['CONSUMED', 'REJECTED', 'EXPIRED'].includes(confirmation.state) ? (
            <Button
              disabled={busy}
              onClick={() => {
                setConfirmation(undefined);
                setReference('');
                setReceipt('');
                setStore(null);
                setToken('');
                setReceiptCode(undefined);
                setUnconfirmed(false);
                setFailed(false);
                setWorkspace(undefined);
              }}
            >
              {copy.open}
            </Button>
          ) : null}
          <Button disabled={busy} onClick={close}>
            {copy.close}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
