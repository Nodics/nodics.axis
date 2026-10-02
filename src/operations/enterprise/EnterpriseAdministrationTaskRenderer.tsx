/** Presentation-only administration review; Profile adapters retain DTO, authorization and command authority. */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import { ShellIcon } from '../../app/shell/ShellIcon';

/** Frontend view model only, not a published Profile DTO or executable command body. */
export interface EnterpriseAdministrationTaskCommand {
  readonly code: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly disabledMessage?: string;
  readonly summary: readonly { readonly label: string; readonly value: string }[];
}
/** Plain text mapped from a matched owner workspace by its typed adapter. */
export interface EnterpriseAdministrationTaskPresentation {
  readonly title: string;
  readonly inspectLabel: string;
  readonly emptyMessage: string;
  readonly workingLabel: string;
  readonly reviewTitle: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly uncertainMessage: string;
  readonly unavailableMessage: string;
  readonly recordedMessage: string;
}

/**
 * Reviews one immutable owner-admitted view model. Adapters must validate exact
 * owner readback before returning CONFIRMED and must never automatically replay.
 * This renderer contains no API path, permission/role rule or grant-state inference.
 */
export function EnterpriseAdministrationTaskRenderer({
  context,
  presentation,
  commands,
  inspect,
  execute,
}: {
  readonly context: object;
  readonly presentation: EnterpriseAdministrationTaskPresentation;
  readonly commands: readonly EnterpriseAdministrationTaskCommand[];
  readonly inspect: () => Promise<'INSPECTED' | 'UNCONFIRMED'>;
  readonly execute: (
    reviewed: EnterpriseAdministrationTaskCommand,
  ) => Promise<'CONFIRMED' | 'UNCONFIRMED'>;
}) {
  const [review, setReview] = useState<{
    context: object;
    commands: typeof commands;
    command: EnterpriseAdministrationTaskCommand;
  }>();
  const [busy, setBusy] = useState(false),
    [requiresInspection, setRequiresInspection] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const epoch = useRef(0),
    inFlight = useRef(false);
  const selected =
    review?.context === context && review.commands === commands
      ? review.command
      : undefined;
  useEffect(() => {
    epoch.current++;
    inFlight.current = false;
    setReview(undefined);
    setBusy(false);
    setRequiresInspection(false);
    setError('');
    setNotice('');
    const activeEpoch = epoch;
    return () => {
      activeEpoch.current++;
    };
  }, [context]);
  /** Inspection unlocks only a confirmed owner refresh; failure never restores stale commands. */
  const refresh = async () => {
    if (inFlight.current) return;
    const attempt = epoch.current;
    inFlight.current = true;
    setBusy(true);
    setReview(undefined);
    setRequiresInspection(true);
    setError('');
    setNotice('');
    try {
      const outcome = await inspect();
      if (attempt !== epoch.current) return;
      if (outcome !== 'INSPECTED') throw new Error();
      setRequiresInspection(false);
    } catch {
      if (attempt === epoch.current) setError(presentation.unavailableMessage);
    } finally {
      if (attempt === epoch.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  /** No optimistic grant update; uncertain or successful commands require fresh inspection. */
  const confirm = async () => {
    if (!selected?.enabled || requiresInspection || inFlight.current) return;
    const command = selected,
      attempt = epoch.current;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const outcome = await execute(command);
      if (attempt !== epoch.current) return;
      if (outcome !== 'CONFIRMED') throw new Error();
      setNotice(presentation.recordedMessage);
    } catch {
      if (attempt === epoch.current) setError(presentation.uncertainMessage);
    } finally {
      if (attempt === epoch.current) {
        setReview(undefined);
        setRequiresInspection(true);
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <WorkspaceContainer>
      <Stack spacing={2} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <Typography variant="h6">{presentation.title}</Typography>
        <Button
          startIcon={<ShellIcon name="refresh" />}
          disabled={busy}
          onClick={() => void refresh()}
        >
          {presentation.inspectLabel}
        </Button>
        {busy && <Typography role="status">{presentation.workingLabel}</Typography>}
        {error && <Alert severity="error">{error}</Alert>}
        {notice && <Alert severity="success">{notice}</Alert>}
        {commands.length === 0 && <Typography>{presentation.emptyMessage}</Typography>}
        {commands.map((command) => (
          <Stack key={command.code} spacing={0.5}>
            <Button
              startIcon={<ShellIcon name="approve" />}
              disabled={busy || requiresInspection || !command.enabled}
              onClick={() => setReview({ context, commands, command })}
            >
              {command.label}
            </Button>
            {!command.enabled && command.disabledMessage && (
              <Typography variant="body2" role="status">
                {command.disabledMessage}
              </Typography>
            )}
          </Stack>
        ))}
        <Dialog
          open={!!selected}
          onClose={() => {
            if (!busy) setReview(undefined);
          }}
        >
          <DialogTitle>{presentation.reviewTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={1} sx={{ overflowWrap: 'anywhere' }}>
              <Typography>{selected?.label}</Typography>
              {selected?.summary.map((field, index) => (
                <Typography key={index}>
                  {field.label}: {field.value}
                </Typography>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setReview(undefined)}>
              {presentation.cancelLabel}
            </Button>
            <Button
              startIcon={<ShellIcon name="approve" />}
              disabled={busy || requiresInspection || !selected?.enabled}
              onClick={() => void confirm()}
            >
              {presentation.confirmLabel}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </WorkspaceContainer>
  );
}
