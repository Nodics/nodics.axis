/** Native scoped Enterprise controls. Digital owns policy, Profile admission, auditing and original-command recovery. */
import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  admitsParticipation,
  inspectParticipation,
  readParticipation,
  saveParticipation,
  switches,
  type ParticipationConfiguration,
  type ParticipationCommand,
  type ParticipationCopy,
  type ParticipationSettings,
  type Selections,
} from './participationClient';

interface Props {
  bootstrap: AxisAuthenticatedBootstrap;
  navigation: AxisNavigationItem;
  accessToken: string;
  sessionGeneration: number;
  runtime: AxisRuntimeConfig;
}
/** Remounts on authority/connection changes so stale responses cannot populate another Enterprise session. */
export function DigitalParticipationRoutePage(props: Props) {
  if (!admitsParticipation(props.navigation))
    return <Alert severity="warning">{props.navigation.label}</Alert>;
  const key = JSON.stringify([
    props.accessToken,
    props.sessionGeneration,
    props.bootstrap.tenantCode,
    props.runtime.enterpriseCode,
    props.navigation,
    props.bootstrap.moduleConnections.digitalCore,
  ]);
  return <ParticipationSession key={key} {...props} />;
}
/** Retains one submitted intent while uncertain; no automatic command retry or queued mutation. */
function ParticipationSession(props: Props) {
  const [configuration] = useState<ParticipationConfiguration>(() => ({
    bootstrap: props.bootstrap,
    navigation: props.navigation,
    accessToken: props.accessToken,
    enterpriseCode: props.runtime.enterpriseCode,
    timeoutMs: props.runtime.requestTimeoutMs,
  }));
  const live = useRef(true),
    flight = useRef(false);
  const [copy, setCopy] = useState<ParticipationCopy>(),
    [current, setCurrent] = useState<ParticipationSettings>();
  const [draft, setDraft] = useState<Selections>(),
    [reason, setReason] = useState('');
  const [review, setReview] = useState<ParticipationCommand>(),
    [pending, setPending] = useState<ParticipationCommand>();
  const [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const mutation = useMutation({
    mutationFn: (command: ParticipationCommand) =>
      saveParticipation(configuration, command),
  });
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void readParticipation(configuration)
      .then((result) => {
        if (!active) return;
        setCopy(result.presentation);
        setCurrent(result);
        setDraft(result.effective);
        setError('');
        setBusy(false);
      })
      .catch(() => {
        if (active) {
          setError(props.navigation.label);
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, [configuration, attempt, props.navigation.label]);
  const confirm = async () => {
    if (!copy || !review || (pending && review !== pending) || flight.current) return;
    const command = review;
    flight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    setPending(command);
    try {
      await mutation.mutateAsync(command);
      if (!live.current) return;
      const result = await readParticipation(configuration);
      if (!live.current) return;
      setCurrent(result);
      setDraft(result.effective);
      setCopy(result.presentation);
      setPending(undefined);
      setReason('');
      setNotice(copy.saved);
    } catch {
      if (live.current) setError(copy.uncertain);
    } finally {
      if (live.current) {
        setReview(undefined);
        flight.current = false;
        setBusy(false);
      }
    }
  };
  const inspect = async () => {
    if (!copy || !pending || flight.current) return;
    flight.current = true;
    setBusy(true);
    setError('');
    try {
      const receipt = await inspectParticipation(configuration, pending);
      if (!live.current) return;
      if (!receipt) {
        setError(copy.uncertain);
        return;
      }
      const result = await readParticipation(configuration);
      if (!live.current) return;
      setCurrent(result);
      setDraft(result.effective);
      setCopy(result.presentation);
      setPending(undefined);
      setReason('');
      setNotice(copy.saved);
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
    <WorkspaceContainer>
      <Stack spacing={2} sx={{ minWidth: 0 }} data-functional-module="digitalCore">
        <Typography component="h1" variant="h5">
          {copy?.title ?? props.navigation.label}
        </Typography>
        {busy && <LinearProgress />}
        {error && (
          <Alert severity={pending ? 'warning' : 'error'}>
            {copy ? error : props.navigation.label}
          </Alert>
        )}
        {notice && <Alert severity="success">{notice}</Alert>}
        {copy && current && draft && (
          <>
            <Typography sx={{ overflowWrap: 'anywhere' }}>
              {copy.owner}: {current.ownerRef.code}
            </Typography>
            <Typography>
              {copy.revision}: {current.revision ?? copy.inherited}
            </Typography>
            {switches.map((k) => (
              <FormControlLabel
                key={k}
                label={copy[k]}
                control={
                  <Switch
                    checked={draft[k]}
                    disabled={busy || !!pending || !!review}
                    onChange={(_, checked) => setDraft({ ...draft, [k]: checked })}
                  />
                }
              />
            ))}
            <TextField
              label={copy.reason}
              value={reason}
              required
              multiline
              disabled={busy || !!pending || !!review}
              onChange={(e) => setReason(e.target.value)}
            />
            {!pending && (
              <Stack direction="row" spacing={1}>
                <Button
                  startIcon={<ShellIcon name="visible" />}
                  disabled={
                    busy ||
                    !reason.trim() ||
                    !switches.some((k) => draft[k] !== current.effective[k])
                  }
                  onClick={() =>
                    setReview({
                      ...draft,
                      expectedRevision: current.revision,
                      reason,
                      idempotencyKey: crypto.randomUUID(),
                    })
                  }
                >
                  {copy.review}
                </Button>
                <Button
                  startIcon={<ShellIcon name="refresh" />}
                  disabled={busy || !!review}
                  onClick={() => {
                    setBusy(true);
                    setNotice('');
                    setAttempt((n) => n + 1);
                  }}
                >
                  {copy.refresh}
                </Button>
              </Stack>
            )}
            {pending && (
              <Stack direction="row" spacing={1}>
                <Button
                  startIcon={<ShellIcon name="search" />}
                  disabled={busy}
                  onClick={() => void inspect()}
                >
                  {copy.inspect}
                </Button>
                <Button
                  startIcon={<ShellIcon name="refresh" />}
                  disabled={busy}
                  onClick={() => setReview(pending)}
                >
                  {copy.retry}
                </Button>
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
                <Stack spacing={1}>
                  {review && (
                    <>
                      <Typography sx={{ overflowWrap: 'anywhere' }}>
                        {copy.owner}: {current.ownerRef.code}
                      </Typography>
                      {switches.map((k) => (
                        <Typography key={k}>
                          {copy[k]}: {review[k] ? copy.enabled : copy.disabled}
                        </Typography>
                      ))}
                      <Typography sx={{ overflowWrap: 'anywhere' }}>
                        {copy.reason}: {review.reason}
                      </Typography>
                    </>
                  )}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button disabled={busy} onClick={() => setReview(undefined)}>
                  {copy.cancel}
                </Button>
                <Button
                  startIcon={<ShellIcon name="approve" />}
                  disabled={busy}
                  onClick={() => void confirm()}
                >
                  {copy.confirm}
                </Button>
              </DialogActions>
            </Dialog>
          </>
        )}
        {!copy && !busy && (
          <Button
            aria-label="Retry"
            onClick={() => {
              setBusy(true);
              setAttempt((n) => n + 1);
            }}
          >
            <ShellIcon name="refresh" />
          </Button>
        )}
      </Stack>
    </WorkspaceContainer>
  );
}
