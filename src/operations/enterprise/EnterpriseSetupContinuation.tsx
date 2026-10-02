/** Profile-owned setup continuation consumer; injected discovery remains the only transport/command authority. */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../../app/shell/ShellIcon';
import {
  inspectEnterpriseSetup,
  resumeEnterpriseSetup,
  type EnterpriseSetupOwnerAdapter,
  type EnterpriseSetupSnapshot,
} from './api/enterpriseSetupClient';

/** Typed presentation supplied by the owner integration, not guessed backend metadata keys. */
export interface EnterpriseSetupPresentation {
  readonly title: string;
  readonly enterpriseLabel: string;
  readonly administratorLabel: string;
  readonly statusLabel: string;
  readonly inspectLabel: string;
  readonly resumeLabel: string;
  readonly reviewTitle: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly workingLabel: string;
  readonly unavailableMessage: string;
  readonly uncertainMessage: string;
  readonly states: Readonly<Record<EnterpriseSetupSnapshot['setup']['state'], string>>;
  readonly administratorStatuses: Readonly<Record<string, string>>;
  readonly reasons: Readonly<Record<string, string>>;
}

/** Unknown owner codes are never displayed verbatim or resolved through object prototypes. */
function mappedCopy(
  copy: Readonly<Record<string, string>>,
  code: string,
  fallback: string,
): string {
  return Object.hasOwn(copy, code) && typeof copy[code] === 'string'
    ? copy[code]
    : fallback;
}

/** Reviews a fresh public snapshot; uncertainty removes executable state until explicit reinspection. */
export function EnterpriseSetupContinuation({
  owner,
  presentation,
  initialEnterpriseCode,
  onInspection,
}: {
  readonly owner: EnterpriseSetupOwnerAdapter;
  readonly presentation: EnterpriseSetupPresentation;
  readonly initialEnterpriseCode?: string | undefined;
  readonly onInspection?: ((snapshot: EnterpriseSetupSnapshot) => void) | undefined;
}) {
  const [target, setTarget] = useState(initialEnterpriseCode ?? '');
  const targetEdited = useRef(false);
  useEffect(() => {
    if (initialEnterpriseCode && !targetEdited.current)
      setTarget(initialEnterpriseCode);
  }, [initialEnterpriseCode]);
  const [snapshot, setSnapshot] = useState<{
    owner: EnterpriseSetupOwnerAdapter;
    value: EnterpriseSetupSnapshot;
  }>();
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const [message, setMessage] = useState('');
  const epoch = useRef(0);
  const inFlight = useRef(false);
  const value = snapshot?.owner === owner ? snapshot.value : undefined;
  const eligible =
    value?.setup.canResume === true &&
    value.setup.state === 'RESUMABLE' &&
    value.setup.revision !== null &&
    (value.descriptor === undefined ||
      (value.descriptor.available &&
        value.descriptor.actions.resume?.qualified === true)) &&
    Boolean(owner.resume);
  useEffect(() => {
    epoch.current++;
    inFlight.current = false;
    setSnapshot(undefined);
    setReview(false);
    setBusy(false);
    setMessage('');
    const currentEpoch = epoch;
    return () => {
      currentEpoch.current++;
    };
  }, [owner]);

  const inspect = async () => {
    if (inFlight.current || !target.trim()) return;
    inFlight.current = true;
    const attempt = ++epoch.current;
    setBusy(true);
    setReview(false);
    setSnapshot(undefined);
    setMessage('');
    try {
      const next = await inspectEnterpriseSetup(owner, target.trim());
      if (attempt === epoch.current) {
        setSnapshot({ owner, value: next });
        onInspection?.(next);
      }
    } catch {
      if (attempt === epoch.current) setMessage(presentation.unavailableMessage);
    } finally {
      if (attempt === epoch.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };

  const confirm = async () => {
    if (!review || !eligible || !value || inFlight.current) return;
    inFlight.current = true;
    const attempt = ++epoch.current;
    setBusy(true);
    setMessage('');
    try {
      await resumeEnterpriseSetup(owner, value);
      if (attempt !== epoch.current) return;
      setReview(false);
      setSnapshot(undefined);
      const next = await inspectEnterpriseSetup(owner, value.enterprise.code);
      if (attempt === epoch.current) {
        setSnapshot({ owner, value: next });
        onInspection?.(next);
      }
    } catch {
      if (attempt === epoch.current) {
        setSnapshot(undefined);
        setReview(false);
        setMessage(presentation.uncertainMessage);
      }
    } finally {
      if (attempt === epoch.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };

  return (
    <Stack spacing={2}>
      <Typography component="h2" variant="h6">
        {presentation.title}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField
          label={presentation.enterpriseLabel}
          value={target}
          disabled={busy}
          slotProps={{ htmlInput: { maxLength: 128 } }}
          onChange={(event) => {
            targetEdited.current = true;
            epoch.current++;
            setTarget(event.target.value);
            setSnapshot(undefined);
            setReview(false);
            setMessage('');
          }}
        />
        <Button
          startIcon={<ShellIcon name="search" />}
          disabled={busy || !target.trim()}
          onClick={() => void inspect()}
        >
          {busy ? presentation.workingLabel : presentation.inspectLabel}
        </Button>
      </Stack>
      {message && <Alert severity="warning">{message}</Alert>}
      {value && (
        <>
          <Typography component="h2" variant="h6">
            {value.enterprise.name}
          </Typography>
          <Typography>
            {presentation.statusLabel}: {presentation.states[value.setup.state]}
          </Typography>
          <Typography>
            {presentation.administratorLabel}: {value.administrator.email}
          </Typography>
          {Object.hasOwn(
            presentation.administratorStatuses,
            value.administrator.status,
          ) && (
            <Typography>
              {presentation.statusLabel}:{' '}
              {mappedCopy(
                presentation.administratorStatuses,
                value.administrator.status,
                presentation.unavailableMessage,
              )}
            </Typography>
          )}
          {value.setup.reasonCodes.map((reason) => (
            <Alert key={reason} severity="info">
              {mappedCopy(
                presentation.reasons,
                reason,
                presentation.unavailableMessage,
              )}
            </Alert>
          ))}
          {eligible && (
            <Button
              disabled={busy}
              startIcon={<ShellIcon name="approve" />}
              onClick={() => setReview(true)}
            >
              {presentation.resumeLabel}
            </Button>
          )}
        </>
      )}
      <Dialog
        open={review && eligible}
        onClose={() => {
          if (!busy) setReview(false);
        }}
      >
        <DialogTitle>{presentation.reviewTitle}</DialogTitle>
        <DialogContent>
          <Typography>{value?.enterprise.name}</Typography>
          <Typography>{value?.administrator.email}</Typography>
          <Typography>{value ? presentation.states[value.setup.state] : ''}</Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setReview(false)}>
            {presentation.cancelLabel}
          </Button>
          <Button
            disabled={busy}
            startIcon={<ShellIcon name="approve" />}
            onClick={() => void confirm()}
          >
            {presentation.confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
