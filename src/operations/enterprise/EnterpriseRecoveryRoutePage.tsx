/** Profile-owned committed-operation recovery consumer; it never unlocks or replays ambiguous mutations. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { AxisAuthenticatedBootstrap } from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  loadEnterpriseRecoveryWorkspace,
  reconcileEnterpriseOperation,
  type EnterpriseRecoveryWorkspace,
} from './api/enterpriseMembershipClient';
/** Retains inspected enterprise/revision and requires explicit review; late context responses are discarded. */
export function EnterpriseRecoveryRoutePage({
  bootstrap,
  accessToken,
  runtime,
  title,
}: {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly accessToken: string;
  readonly runtime: AxisRuntimeConfig;
  readonly title: string;
}) {
  const configuration = useMemo(
    () => ({
      bootstrap,
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [bootstrap, accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs],
  );
  const [target, setTarget] = useState(''),
    [snapshot, setSnapshot] = useState<{
      configuration: typeof configuration;
      workspace: EnterpriseRecoveryWorkspace;
    }>();
  const [busy, setBusy] = useState(false),
    [review, setReview] = useState(false),
    [error, setError] = useState('');
  const version = useRef(0),
    inFlight = useRef(false);
  const workspace =
    snapshot?.configuration === configuration ? snapshot.workspace : undefined;
  const inspect = useCallback(
    async (code: string) => {
      const attempt = ++version.current;
      setBusy(true);
      setError('');
      setReview(false);
      setSnapshot(undefined);
      try {
        const value = await loadEnterpriseRecoveryWorkspace(configuration, code);
        if (attempt === version.current)
          setSnapshot({ configuration, workspace: value });
      } catch (reason) {
        if (attempt === version.current)
          setError(
            reason instanceof Error ? reason.message : 'Recovery is unavailable.',
          );
      } finally {
        if (attempt === version.current) setBusy(false);
      }
    },
    [configuration],
  );
  useEffect(() => {
    version.current++;
    setSnapshot(undefined);
    setReview(false);
    setError('');
    setBusy(false);
    inFlight.current = false;
    const epoch = version;
    return () => {
      epoch.current++;
    };
  }, [configuration]);
  const confirm = async () => {
    if (!workspace?.operation?.recoverable || inFlight.current) return;
    const attempt = version.current;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await reconcileEnterpriseOperation(configuration, workspace);
      if (attempt === version.current) {
        inFlight.current = false;
        await inspect(workspace.enterpriseCode);
      }
    } catch {
      if (attempt === version.current) {
        setReview(false);
        setSnapshot(undefined);
        setError(workspace.presentation.uncertainMessage);
      }
    } finally {
      if (attempt === version.current) {
        setBusy(false);
        inFlight.current = false;
      }
    }
  };
  return (
    <WorkspaceContainer>
      <Stack spacing={2}>
        <Typography variant="h6">{workspace?.presentation.title || title}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            label="Enterprise"
            value={target}
            disabled={busy}
            onChange={(event) => {
              setTarget(event.target.value);
              setSnapshot(undefined);
              setReview(false);
            }}
            slotProps={{ htmlInput: { maxLength: 128 } }}
          />
          <Button
            startIcon={<ShellIcon name="search" />}
            disabled={busy || !target.trim()}
            onClick={() => void inspect(target.trim())}
          >
            {workspace?.presentation.inspectLabel || 'Inspect'}
          </Button>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {workspace && (
          <>
            <Typography>
              {workspace.enterpriseCode}
              {workspace.operation
                ? ': ' + workspace.operation.id + ' / ' + workspace.operation.phase
                : ''}
            </Typography>
            {workspace.operation?.recoverable ? (
              <Button
                startIcon={<ShellIcon name="approve" />}
                disabled={busy}
                onClick={() => setReview(true)}
              >
                {workspace.presentation.confirmLabel}
              </Button>
            ) : (
              <Alert severity="info">{workspace.presentation.unavailableMessage}</Alert>
            )}
          </>
        )}
        <Dialog
          open={review && !!workspace}
          onClose={() => {
            if (!busy) setReview(false);
          }}
        >
          <DialogTitle>{workspace?.presentation.reviewTitle}</DialogTitle>
          <DialogContent>
            <Typography>
              {workspace?.enterpriseCode} / {workspace?.operation?.id}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setReview(false)}>
              {workspace?.presentation.cancelLabel}
            </Button>
            <Button
              disabled={busy}
              startIcon={<ShellIcon name="approve" />}
              onClick={() => void confirm()}
            >
              {workspace?.presentation.confirmLabel}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </WorkspaceContainer>
  );
}
