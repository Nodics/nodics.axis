/** Compact employee limit control; Checkout owns policy and Profile owns fresh human scope. */
import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { selectModuleConnection } from '../../bootstrap/publicBootstrap';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { resolveCmsPage } from '../../cms/cmsClient';
import type { OperationalOwnerConfiguration } from '../shared/operationalOwnerClient';
import {
  readSpend,
  updateSpend,
  parseSpendCopy,
  type EnterpriseSpendCmsContext,
  type SpendCopy,
  type SpendSelection,
  type SpendCommand,
} from './api/enterpriseSpendClient';
interface Props {
  configuration: OperationalOwnerConfiguration;
  actorCode: string;
  cms: EnterpriseSpendCmsContext;
  disabled?: boolean;
  onHeldChange: (held: boolean) => void;
}
export function EnterpriseSpendControl(props: Props) {
  const connection = selectModuleConnection(
    props.configuration.bootstrap,
    'checkoutCore',
  );
  if (!connection) return null;
  const key = JSON.stringify([
    props.configuration.accessToken,
    props.configuration.bootstrap.tenantCode,
    props.configuration.enterpriseCode,
    props.actorCode,
    connection,
    props.cms,
  ]);
  return <SpendSession key={key} {...props} />;
}
function SpendSession({
  configuration,
  actorCode,
  cms,
  disabled = false,
  onHeldChange,
}: Props) {
  const live = useRef(true),
    flight = useRef(false);
  const [copy, setCopy] = useState<SpendCopy>(),
    [cmsError, setCmsError] = useState(''),
    [cmsAttempt, setCmsAttempt] = useState(0);
  const [currency, setCurrency] = useState(''),
    [snapshot, setSnapshot] = useState<SpendSelection>(),
    [limit, setLimit] = useState<string | null>();
  const [review, setReview] = useState<SpendCommand>(),
    [pending, setPending] = useState<SpendCommand>(),
    [retry, setRetry] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const mutation = useMutation({
    mutationFn: (command: SpendCommand) => updateSpend(configuration, command),
  });
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    onHeldChange(busy || !!review || !!pending);
    return () => onHeldChange(false);
  }, [busy, review, pending, onHeldChange]);
  useEffect(() => {
    const controller = new AbortController();
    void resolveCmsPage({
      cmsBaseUrl: cms.baseUrl,
      site: cms.site,
      locale: cms.locale,
      channel: cms.channel,
      path: '/commerce/enterprise-spending',
      accessToken: configuration.accessToken,
      enterpriseCode: configuration.enterpriseCode,
      timeoutMs: configuration.timeoutMs,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (
          !result.page ||
          result.page.path !== '/commerce/enterprise-spending' ||
          result.page.site !== cms.site
        )
          throw new Error('CMS returned no matching page.');
        setCopy(parseSpendCopy(result.page));
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setCmsError(reason instanceof Error ? reason.message : 'CMS unavailable.');
      });
    return () => controller.abort();
  }, [cms.baseUrl, cms.site, cms.locale, cms.channel, configuration, cmsAttempt]);
  const load = async () => {
    if (!copy || flight.current || disabled) return;
    flight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    setRetry(false);
    const target = pending?.currency ?? currency;
    try {
      const result = await readSpend(configuration, actorCode, target);
      if (!live.current) return;
      if (pending) {
        if (
          result.perPurchaseLimit === pending.perPurchaseLimit &&
          result.revision === (pending.expectedRevision ?? -1) + 1
        ) {
          setPending(undefined);
          setReview(undefined);
          setSnapshot(result);
          setLimit(result.perPurchaseLimit);
          setNotice(copy.saved);
        } else if (result.revision === pending.expectedRevision) {
          setRetry(true);
          setError(copy.uncertain);
        } else {
          setPending(undefined);
          setReview(undefined);
          setSnapshot(result);
          setLimit(result.perPurchaseLimit);
          setError(copy.conflict);
        }
      } else {
        setSnapshot(result);
        setLimit(result.perPurchaseLimit);
      }
    } catch {
      if (live.current) {
        if (!pending) setSnapshot(undefined);
        setError(copy.unavailable);
      }
    } finally {
      if (live.current) {
        flight.current = false;
        setBusy(false);
      }
    }
  };
  const confirm = async () => {
    if (!copy || !review || flight.current || disabled || (pending && !retry)) return;
    const command = review;
    flight.current = true;
    setBusy(true);
    setPending(command);
    setRetry(false);
    setError('');
    setNotice('');
    try {
      const saved = await mutation.mutateAsync(command);
      if (!live.current) return;
      const result = await readSpend(configuration, actorCode, command.currency);
      if (!live.current) return;
      if (
        result.perPurchaseLimit !== command.perPurchaseLimit ||
        result.revision !== saved.revision
      )
        throw new Error();
      setSnapshot(result);
      setLimit(result.perPurchaseLimit);
      setPending(undefined);
      setReview(undefined);
      setNotice(copy.saved);
    } catch {
      if (live.current) setError(copy.uncertain);
    } finally {
      if (live.current) {
        flight.current = false;
        setBusy(false);
      }
    }
  };
  if (!copy)
    return cmsError ? (
      <Alert
        severity="warning"
        action={
          <Button
            onClick={() => {
              setCmsError('');
              setCmsAttempt((n) => n + 1);
            }}
          >
            <ShellIcon name="refresh" />
          </Button>
        }
      >
        {cmsError}
      </Alert>
    ) : (
      <LinearProgress />
    );
  const prepare = () => {
    if (!snapshot || limit === undefined) return;
    if (limit !== null && !/^\d+(?:\.\d+)?$/.test(limit)) {
      setError(copy.invalid);
      return;
    }
    setReview({
      actorCode,
      currency: snapshot.currency,
      perPurchaseLimit: limit,
      expectedRevision: snapshot.revision,
    });
    setError('');
  };
  return (
    <Stack
      spacing={1.5}
      sx={{ borderTop: 1, borderColor: 'divider', pt: 2, minWidth: 0 }}
      data-functional-module="checkoutCore"
    >
      <Typography component="h3" variant="subtitle1">
        {copy.title}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'minmax(0,1fr) auto' },
          gap: 1,
        }}
      >
        <TextField
          size="small"
          label={copy.currency}
          value={currency}
          disabled={disabled || busy || !!review || !!pending}
          onChange={(e) => {
            setCurrency(e.target.value);
            setSnapshot(undefined);
            setLimit(undefined);
            setError('');
            setNotice('');
          }}
        />
        {!pending && (
          <Button
            startIcon={<ShellIcon name="search" />}
            disabled={disabled || busy || !!review || !currency.trim()}
            onClick={() => void load()}
          >
            {copy.load}
          </Button>
        )}
      </Box>
      {snapshot && !review && (
        <>
          <TextField
            size="small"
            label={copy.perPurchaseLimit}
            value={limit ?? ''}
            disabled={disabled || busy || limit === null}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            onChange={(e) => setLimit(e.target.value)}
          />
          <FormControlLabel
            label={copy.noLimit}
            control={
              <Checkbox
                checked={limit === null}
                disabled={disabled || busy}
                onChange={(_, checked) => setLimit(checked ? null : '')}
              />
            }
          />
          <Button
            startIcon={<ShellIcon name="visible" />}
            disabled={disabled || busy || limit === snapshot.perPurchaseLimit}
            onClick={prepare}
            sx={{ alignSelf: 'flex-start' }}
          >
            {copy.review}
          </Button>
        </>
      )}
      {review && (
        <Stack spacing={1}>
          <Typography sx={{ overflowWrap: 'anywhere' }}>
            {copy.actor}: {review.actorCode}
          </Typography>
          <Typography>
            {copy.currency}: {review.currency}
          </Typography>
          <Typography>
            {copy.perPurchaseLimit}: {review.perPurchaseLimit ?? copy.noLimit}
          </Typography>
          <Typography>
            {copy.revision}: {review.expectedRevision ?? ''}
          </Typography>
          <Stack direction="row" spacing={1}>
            {!pending && (
              <Button disabled={busy} onClick={() => setReview(undefined)}>
                {copy.cancel}
              </Button>
            )}
            {pending && (
              <Button
                startIcon={<ShellIcon name="search" />}
                disabled={disabled || busy}
                onClick={() => void load()}
              >
                {copy.inspect}
              </Button>
            )}
            <Button
              startIcon={<ShellIcon name="approve" />}
              disabled={disabled || busy || (!!pending && !retry)}
              onClick={() => void confirm()}
            >
              {pending ? copy.retry : copy.confirm}
            </Button>
          </Stack>
        </Stack>
      )}
      {error && <Alert severity={pending ? 'warning' : 'error'}>{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
    </Stack>
  );
}
