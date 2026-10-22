/** Native presentation only. Owner responses select policy; original credentials authorize every request. */
import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import { selectModuleConnection } from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { resolveCmsPage } from '../../cms/cmsClient';
import { LoadingScreen } from '../../app/LoadingScreen';
import { RecoveryScreen } from '../../app/RecoveryScreen';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  loyaltyView,
  stable,
  parseLoyaltyCopy,
  readWallet,
  readSettings,
  saveSettings,
  credit,
  decimal,
  parseSelections,
  counters,
  type LoyaltyCopy,
  type LoyaltyConfiguration,
  type TransferSettings,
  type Selections,
  type SettingsCommand,
  type CreditCommand,
  type CreditReceipt,
  type ParticipantWallet,
} from './loyaltyClient';

interface Props {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly navigation: AxisNavigationItem;
  readonly accessToken: string;
  readonly sessionGeneration: number;
  readonly runtime: AxisRuntimeConfig;
  readonly cmsBaseUrl: string;
  readonly site: string;
  readonly locale: string;
  readonly channel: string;
}
export function LoyaltyParticipationRoutePage(props: Props) {
  if (!loyaltyView(props.navigation))
    return <Alert severity="warning">{props.navigation.label}</Alert>;
  const key = stable({
    token: props.accessToken,
    generation: props.sessionGeneration,
    tenant: props.bootstrap.tenantCode,
    enterprise: props.runtime.enterpriseCode,
    navigation: props.navigation,
    connection: selectModuleConnection(
      props.bootstrap,
      'loyaltyApi',
      props.navigation.backendWorkspace?.ownerSelector,
    ),
    cms: props.cmsBaseUrl,
    site: props.site,
    locale: props.locale,
    channel: props.channel,
  });
  return <LoyaltySession key={key} {...props} />;
}
function LoyaltySession(props: Props) {
  const [configuration] = useState<LoyaltyConfiguration>(() => ({
    bootstrap: props.bootstrap,
    navigation: props.navigation,
    accessToken: props.accessToken,
    sessionGeneration: props.sessionGeneration,
    enterpriseCode: props.runtime.enterpriseCode,
    timeoutMs: props.runtime.requestTimeoutMs,
  }));
  const [copy, setCopy] = useState<LoyaltyCopy>(),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void resolveCmsPage({
      cmsBaseUrl: props.cmsBaseUrl,
      enterpriseCode: configuration.enterpriseCode,
      accessToken: configuration.accessToken,
      timeoutMs: configuration.timeoutMs,
      site: props.site,
      path: props.navigation.route,
      locale: props.locale,
      channel: props.channel,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (
          !result.page ||
          result.page.path !== props.navigation.route ||
          result.page.site !== props.site
        )
          throw new Error('CMS returned no matching page.');
        setCopy(parseLoyaltyCopy(result.page));
        setError('');
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'CMS delivery failed.');
      });
    return () => controller.abort();
  }, [
    attempt,
    configuration,
    props.cmsBaseUrl,
    props.site,
    props.navigation.route,
    props.locale,
    props.channel,
  ]);
  if (error)
    return (
      <RecoveryScreen
        state={{ kind: 'cms', detail: error, retryable: true }}
        onRetry={() => {
          setError('');
          setAttempt((n) => n + 1);
        }}
      />
    );
  if (!copy) return <LoadingScreen />;
  const view = loyaltyView(props.navigation);
  return (
    <WorkspaceContainer>
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <Typography variant="h5" component="h1">
          {view === 'wallet'
            ? copy.walletTitle
            : view === 'transferSettings'
              ? copy.settingsTitle
              : copy.creditTitle}
        </Typography>
        {view === 'wallet' ? (
          <WalletPanel configuration={configuration} copy={copy} />
        ) : view === 'transferSettings' ? (
          <SettingsPanel configuration={configuration} copy={copy} />
        ) : (
          <CreditPanel configuration={configuration} copy={copy} />
        )}
      </Stack>
    </WorkspaceContainer>
  );
}
type PanelProps = { configuration: LoyaltyConfiguration; copy: LoyaltyCopy };
function useLive() {
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  return live;
}
function Evidence({
  values,
  copy,
}: {
  values: Record<string, string | number | boolean | null | undefined>;
  copy: LoyaltyCopy;
}) {
  return (
    <Box
      component="dl"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)',
        gap: 1,
        m: 0,
      }}
    >
      {Object.entries(values).map(([key, value]) => (
        <Box key={key} sx={{ display: 'contents' }}>
          <Typography component="dt" variant="body2">
            {copy[key as keyof LoyaltyCopy] || key}
          </Typography>
          <Typography
            component="dd"
            variant="body2"
            sx={{ m: 0, overflowWrap: 'anywhere' }}
          >
            {value === null
              ? copy.noLimit
              : value === undefined
                ? copy.inherited
                : typeof value === 'boolean'
                  ? value
                    ? copy.enabled
                    : copy.disabled
                  : String(value)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
function WalletPanel({ configuration, copy }: PanelProps) {
  const live = useLive(),
    flight = useRef(false);
  const [wallet, setWallet] = useState<ParticipantWallet>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const load = async () => {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setWallet(undefined);
    setError('');
    try {
      const result = await readWallet(configuration);
      if (live.current) setWallet(result);
    } catch {
      if (live.current) setError(copy.unavailable);
    } finally {
      if (live.current) {
        flight.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Button
        startIcon={<ShellIcon name="refresh" />}
        disabled={busy}
        onClick={() => void load()}
        sx={{ alignSelf: 'flex-start' }}
      >
        {copy.refresh}
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
      {wallet && (
        <>
          <Evidence
            values={{
              owner: wallet.owner.ownerCode,
              actor: wallet.owner.actorCode,
              walletCode: wallet.wallet?.code,
              status: wallet.wallet?.status,
            }}
            copy={copy}
          />
          {!wallet.wallet && <Alert severity="info">{copy.emptyWallet}</Alert>}
          {wallet.wallet && !wallet.balances.length && (
            <Typography>{copy.emptyBalances}</Typography>
          )}
          {!!wallet.balances.length && (
            <TableContainer>
              <Table size="small" aria-label={copy.walletTitle}>
                <TableHead>
                  <TableRow>
                    {[
                      'name',
                      'programCode',
                      'rewardTypeCode',
                      'precision',
                      ...counters,
                      'transferEligible',
                      'transferFeeAmount',
                    ].map((key) => (
                      <TableCell key={key}>{copy[key as keyof LoyaltyCopy]}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {wallet.balances.map((balance) => (
                    <TableRow key={balance.code}>
                      {[
                        'name',
                        'programCode',
                        'rewardTypeCode',
                        'precision',
                        ...counters,
                        'transferEligible',
                        'transferFeeAmount',
                      ].map((key) => (
                        <TableCell key={key} sx={{ overflowWrap: 'anywhere' }}>
                          {typeof balance[key as keyof typeof balance] === 'boolean'
                            ? balance.transferEligible
                              ? copy.enabled
                              : copy.disabled
                            : String(balance[key as keyof typeof balance])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Typography component="h2" variant="subtitle1">
            {copy.ledger}
          </Typography>
          {!wallet.entries.length ? (
            <Typography>{copy.emptyEntries}</Typography>
          ) : (
            <TableContainer>
              <Table size="small" aria-label={copy.ledger}>
                <TableHead>
                  <TableRow>
                    {[
                      'code',
                      'programCode',
                      'rewardTypeCode',
                      'entryType',
                      'amount',
                      'sourceType',
                      'sourceCode',
                      'postedAt',
                    ].map((key) => (
                      <TableCell key={key}>{copy[key as keyof LoyaltyCopy]}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {wallet.entries.map((entry) => (
                    <TableRow key={entry.code}>
                      {Object.values(entry).map((value, index) => (
                        <TableCell key={index} sx={{ overflowWrap: 'anywhere' }}>
                          {value}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </Stack>
  );
}
function SettingsPanel({ configuration, copy }: PanelProps) {
  const live = useLive(),
    flight = useRef(false);
  const [programCode, setProgram] = useState(''),
    [rewardTypeCode, setType] = useState('');
  const [current, setCurrent] = useState<TransferSettings>(),
    [selections, setSelections] = useState<Selections>({});
  const [review, setReview] = useState<SettingsCommand>(),
    [pending, setPending] = useState<SettingsCommand>(),
    [retry, setRetry] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const mutation = useMutation({
    mutationFn: (command: SettingsCommand) => saveSettings(configuration, command),
  });
  const selectors = { programCode, rewardTypeCode };
  const load = async () => {
    if (flight.current || pending) return;
    flight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    setCurrent(undefined);
    try {
      const result = await readSettings(configuration, selectors);
      if (live.current) {
        setCurrent(result);
        setSelections(result.selections);
      }
    } catch {
      if (live.current) setError(copy.unavailable);
    } finally {
      if (live.current) {
        flight.current = false;
        setBusy(false);
      }
    }
  };
  const inspect = async () => {
    if (!pending || flight.current) return;
    flight.current = true;
    setBusy(true);
    setError('');
    setRetry(false);
    try {
      const result = await readSettings(configuration, pending);
      if (!live.current) return;
      setCurrent(result);
      if (
        result.revision === (pending.expectedRevision ?? -1) + 1 &&
        stable(result.selections) === stable(pending.selections)
      ) {
        setSelections(result.selections);
        setPending(undefined);
        setRetry(false);
        setNotice(copy.saved);
      } else if (result.revision === pending.expectedRevision) {
        setRetry(true);
        setError(copy.uncertain);
      } else {
        setSelections(result.selections);
        setPending(undefined);
        setRetry(false);
        setError(copy.conflict);
      }
    } catch {
      if (live.current) setError(copy.unavailable);
    } finally {
      if (live.current) {
        flight.current = false;
        setBusy(false);
      }
    }
  };
  const confirm = async () => {
    if (!review || flight.current) return;
    const command = review;
    flight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    setPending(command);
    setRetry(false);
    try {
      await mutation.mutateAsync(command);
      if (!live.current) return;
      const result = await readSettings(configuration, command);
      if (!live.current) return;
      if (
        result.revision !== (command.expectedRevision ?? -1) + 1 ||
        stable(result.selections) !== stable(command.selections)
      )
        throw new Error();
      setCurrent(result);
      setSelections(result.selections);
      setPending(undefined);
      setNotice(copy.saved);
    } catch {
      if (live.current) setError(copy.uncertain);
    } finally {
      if (live.current) {
        flight.current = false;
        setBusy(false);
        setReview(undefined);
      }
    }
  };
  const prepare = () => {
    if (!current) return;
    try {
      setReview({
        programCode: current.programCode,
        rewardTypeCode: current.rewardTypeCode,
        expectedRevision: current.revision,
        selections: parseSelections(selections),
      });
      setError('');
    } catch {
      setError(copy.invalid);
    }
  };
  const choose = (key: keyof Selections, inherit: boolean) => {
    const next = { ...selections };
    if (inherit) delete next[key];
    else Object.assign(next, { [key]: current?.effective[key] });
    setSelections(next);
  };
  const changeSelector = (set: (v: string) => void, value: string) => {
    set(value);
    setCurrent(undefined);
    setSelections({});
    setNotice('');
    setError('');
  };
  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(2,minmax(0,1fr))' },
          gap: 2,
        }}
      >
        <TextField
          size="small"
          label={copy.programCode}
          value={programCode}
          disabled={busy || !!pending}
          onChange={(e) => changeSelector(setProgram, e.target.value)}
        />
        <TextField
          size="small"
          label={copy.rewardTypeCode}
          value={rewardTypeCode}
          disabled={busy || !!pending}
          onChange={(e) => changeSelector(setType, e.target.value)}
        />
      </Box>
      <Button
        startIcon={<ShellIcon name="search" />}
        disabled={busy || !!pending || !programCode.trim() || !rewardTypeCode.trim()}
        onClick={() => void load()}
        sx={{ alignSelf: 'flex-start' }}
      >
        {copy.load}
      </Button>
      {error && <Alert severity={pending ? 'warning' : 'error'}>{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      {current && (
        <>
          <Typography component="h2" variant="subtitle1">
            {copy.effective}
          </Typography>
          <Evidence
            values={{
              owner: current.ownerCode,
              revision: current.revision,
              ...current.effective,
            }}
            copy={copy}
          />
          <Typography component="h2" variant="subtitle1">
            {copy.selections}
          </Typography>
          {(['incomingEnabled', 'outgoingEnabled'] as const).map((key) => (
            <Stack key={key} direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControlLabel
                label={copy[key]}
                control={
                  <Switch
                    checked={selections[key] ?? current.effective[key]}
                    disabled={busy || !!pending || selections[key] === undefined}
                    onChange={(_, checked) =>
                      setSelections({ ...selections, [key]: checked })
                    }
                  />
                }
              />
              <FormControlLabel
                label={copy.inherit + ' - ' + copy[key]}
                control={
                  <Checkbox
                    checked={selections[key] === undefined}
                    disabled={busy || !!pending}
                    onChange={(_, checked) => choose(key, checked)}
                  />
                }
              />
            </Stack>
          ))}
          {(['maximumAmount', 'maximumDailyAmount', 'maximumDailyCount'] as const).map(
            (key) => (
              <Box
                key={key}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0,1fr)',
                    md: 'repeat(2,minmax(0,1fr))',
                  },
                  gap: 2,
                }}
              >
                <TextField
                  size="small"
                  label={copy[key]}
                  value={selections[key] ?? ''}
                  disabled={busy || !!pending || selections[key] === undefined}
                  placeholder={copy.noLimit}
                  slotProps={{
                    htmlInput: {
                      inputMode: key === 'maximumDailyCount' ? 'numeric' : 'decimal',
                    },
                  }}
                  onChange={(e) =>
                    setSelections({
                      ...selections,
                      [key]:
                        e.target.value === ''
                          ? null
                          : key === 'maximumDailyCount'
                            ? Number(e.target.value)
                            : e.target.value,
                    })
                  }
                />
                <FormControlLabel
                  label={copy.inherit + ' - ' + copy[key]}
                  control={
                    <Checkbox
                      checked={selections[key] === undefined}
                      disabled={busy || !!pending}
                      onChange={(_, checked) => choose(key, checked)}
                    />
                  }
                />
              </Box>
            ),
          )}
          {!pending && (
            <Button
              startIcon={<ShellIcon name="visible" />}
              disabled={busy || stable(current.selections) === stable(selections)}
              onClick={prepare}
              sx={{ alignSelf: 'flex-start' }}
            >
              {copy.review}
            </Button>
          )}
        </>
      )}
      {pending && (
        <Stack direction="row" spacing={2}>
          <Button
            startIcon={<ShellIcon name="search" />}
            disabled={busy}
            onClick={() => void inspect()}
          >
            {copy.inspect}
          </Button>
          {retry && (
            <Button
              startIcon={<ShellIcon name="refresh" />}
              disabled={busy}
              onClick={() => setReview(pending)}
            >
              {copy.retry}
            </Button>
          )}
        </Stack>
      )}
      <Dialog
        open={!!review}
        onClose={() => {
          if (!busy) setReview(undefined);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{copy.review}</DialogTitle>
        <DialogContent>
          {review && (
            <Evidence
              copy={copy}
              values={{
                programCode: review.programCode,
                rewardTypeCode: review.rewardTypeCode,
                revision: review.expectedRevision,
                incomingEnabled: review.selections.incomingEnabled,
                outgoingEnabled: review.selections.outgoingEnabled,
                maximumAmount: review.selections.maximumAmount,
                maximumDailyAmount: review.selections.maximumDailyAmount,
                maximumDailyCount: review.selections.maximumDailyCount,
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setReview(undefined)}>
            {copy.cancel}
          </Button>
          <Button
            disabled={busy}
            startIcon={<ShellIcon name="approve" />}
            onClick={() => void confirm()}
          >
            {copy.confirm}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
function CreditPanel({ configuration, copy }: PanelProps) {
  const live = useLive(),
    flight = useRef(false);
  const [draft, setDraft] = useState({
    walletCode: '',
    programCode: '',
    rewardTypeCode: '',
    amount: '',
    reason: '',
  });
  const [review, setReview] = useState<CreditCommand>(),
    [pending, setPending] = useState<CreditCommand>(),
    [receipt, setReceipt] = useState<CreditReceipt>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [recovery, setRecovery] = useState(false),
    [recoveryKey, setRecoveryKey] = useState('');
  const mutation = useMutation({
    mutationFn: (command: CreditCommand) => credit(configuration, command),
  });
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);
  const prepare = () => {
    try {
      for (const value of Object.values(draft)) if (!value.trim()) throw new Error();
      decimal(draft.amount);
      if (recovery && !recoveryKey.trim()) throw new Error();
      setReview({
        ...draft,
        idempotencyKey: recovery ? recoveryKey : crypto.randomUUID(),
        confirmed: true,
      });
      setError('');
    } catch {
      setError(copy.invalid);
    }
  };
  const confirm = async () => {
    if (!review || flight.current) return;
    const command = review;
    flight.current = true;
    setBusy(true);
    setPending(command);
    setError('');
    try {
      const result = await mutation.mutateAsync(command);
      if (live.current) {
        setReceipt(result);
        setPending(undefined);
      }
    } catch {
      if (live.current) setError(copy.uncertain);
    } finally {
      if (live.current) {
        flight.current = false;
        setBusy(false);
        setReview(undefined);
      }
    }
  };
  return (
    <Stack spacing={2}>
      <Alert severity="warning">{copy.testOnly}</Alert>
      {error && <Alert severity="warning">{error}</Alert>}
      {!receipt && (
        <>
          <FormControlLabel
            label={copy.recoverOriginal}
            control={
              <Checkbox
                checked={recovery}
                disabled={busy || !!pending}
                onChange={(_, checked) => setRecovery(checked)}
              />
            }
          />
          {recovery && (
            <TextField
              size="small"
              required
              label={copy.idempotencyKey}
              value={recoveryKey}
              disabled={busy || !!pending}
              onChange={(event) => setRecoveryKey(event.target.value)}
            />
          )}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0,1fr)',
                md: 'repeat(2,minmax(0,1fr))',
              },
              gap: 2,
            }}
          >
            {(
              [
                'walletCode',
                'programCode',
                'rewardTypeCode',
                'amount',
                'reason',
              ] as const
            ).map((key) => (
              <TextField
                key={key}
                size="small"
                required
                fullWidth
                label={copy[key]}
                value={draft[key]}
                disabled={busy || !!pending}
                multiline={key === 'reason'}
                slotProps={{
                  htmlInput: { ...(key === 'amount' ? { inputMode: 'decimal' } : {}) },
                }}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            ))}
          </Box>
          {pending ? (
            <>
              <Evidence
                copy={copy}
                values={{ idempotencyKey: pending.idempotencyKey }}
              />
              <Button
                startIcon={<ShellIcon name="refresh" />}
                disabled={busy}
                onClick={() => setReview(pending)}
                sx={{ alignSelf: 'flex-start' }}
              >
                {copy.retry}
              </Button>
            </>
          ) : (
            <Button
              startIcon={<ShellIcon name="visible" />}
              disabled={busy}
              onClick={prepare}
              sx={{ alignSelf: 'flex-start' }}
            >
              {copy.review}
            </Button>
          )}
        </>
      )}
      {receipt && (
        <>
          <Alert severity="success">{copy.creditConfirmed}</Alert>
          <Evidence
            copy={copy}
            values={{
              status: receipt.status,
              testOnly: receipt.testOnly,
              operationCode: receipt.operationCode,
              walletCode: receipt.walletCode,
              owner: receipt.ownerCode,
              programCode: receipt.programCode,
              rewardTypeCode: receipt.rewardTypeCode,
              amount: receipt.amount,
              ledgerEntryCode: receipt.ledgerEntryCode,
              actor: receipt.actorCode,
              creditedAt: receipt.creditedAt,
            }}
          />
          <Button
            startIcon={<ShellIcon name="add" />}
            onClick={() => {
              setReceipt(undefined);
              setRecovery(false);
              setRecoveryKey('');
              setDraft({
                walletCode: '',
                programCode: '',
                rewardTypeCode: '',
                amount: '',
                reason: '',
              });
            }}
            sx={{ alignSelf: 'flex-start' }}
          >
            {copy.newCredit}
          </Button>
        </>
      )}
      <Dialog
        open={!!review}
        onClose={() => {
          if (!busy) setReview(undefined);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{copy.creditTitle}</DialogTitle>
        <DialogContent>
          {review && (
            <Evidence
              copy={copy}
              values={{
                walletCode: review.walletCode,
                programCode: review.programCode,
                rewardTypeCode: review.rewardTypeCode,
                amount: review.amount,
                reason: review.reason,
                idempotencyKey: review.idempotencyKey,
                testOnly: true,
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setReview(undefined)}>
            {copy.cancel}
          </Button>
          <Button
            disabled={busy}
            startIcon={<ShellIcon name="approve" />}
            onClick={() => void confirm()}
          >
            {copy.confirm}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
