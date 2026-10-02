/** Profile-owned personal membership task. Axis reviews explicit actions; identity, permission and session proof remain backend-owned. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { AxisAuthenticatedBootstrap } from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import { ShellIcon } from '../../app/shell/ShellIcon';
import {
  acceptEnterpriseMembership,
  loadEnterpriseMembershipWorkspace,
  type EnterpriseMembership,
  type EnterpriseMembershipWorkspace,
  type MembershipAction,
} from './api/enterpriseMembershipClient';

/** Review and acceptance UI; uncertain acceptance permits inspection only, and switch never retries automatically. */
export function EnterpriseMembershipRoutePage({
  bootstrap,
  accessToken,
  runtime,
  onSwitch,
}: {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly accessToken: string;
  readonly runtime: AxisRuntimeConfig;
  readonly onSwitch: (membership: EnterpriseMembership) => Promise<void>;
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
  const [snapshot, setSnapshot] = useState<{
    configuration: typeof configuration;
    value: EnterpriseMembershipWorkspace;
  }>();
  const [review, setReview] = useState<{
    member: EnterpriseMembership;
    action: MembershipAction;
  }>();
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const epoch = useRef(0),
    writing = useRef(false);
  const workspace =
    snapshot?.configuration === configuration ? snapshot.value : undefined;
  const copy = workspace?.presentation;
  const invalidate = useCallback(() => {
    epoch.current++;
  }, []);
  const load = useCallback(async () => {
    const version = ++epoch.current;
    setBusy(true);
    setError('');
    try {
      const value = await loadEnterpriseMembershipWorkspace(configuration);
      if (version === epoch.current) {
        setSnapshot({ configuration, value });
        setReview(undefined);
        setUncertain(false);
      }
    } catch (reason) {
      if (version === epoch.current) {
        setSnapshot(undefined);
        setError(
          reason instanceof Error ? reason.message : 'Membership task is unavailable.',
        );
      }
    } finally {
      if (version === epoch.current) setBusy(false);
    }
  }, [configuration]);
  useEffect(() => {
    setReview(undefined);
    setUncertain(false);
    setNotice('');
    writing.current = false;
    void load();
    return invalidate;
  }, [load, invalidate]);
  const confirm = async () => {
    if (!review || !copy || writing.current) return;
    writing.current = true;
    setBusy(true);
    setError('');
    const version = epoch.current;
    try {
      if (review.action === 'SWITCH') {
        await onSwitch(review.member);
        if (version === epoch.current) setReview(undefined);
        return;
      }
      const result = await acceptEnterpriseMembership(configuration, review.member);
      if (!result.accepted || result.enterpriseCode !== review.member.enterpriseCode)
        throw new Error('Membership acceptance could not be confirmed.');
      if (version !== epoch.current) return;
      setNotice(copy.successMessage);
      writing.current = false;
      await load();
    } catch (reason) {
      if (version === epoch.current) {
        setUncertain(true);
        setError(reason instanceof Error ? reason.message : copy.uncertainMessage);
      }
    } finally {
      if (version === epoch.current) {
        writing.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <WorkspaceContainer>
      <Stack spacing={2} data-functional-module="profile" aria-busy={busy}>
        {workspace && copy ? (
          <>
            <Stack
              direction="row"
              sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}
            >
              <Typography variant="h4" component="h1">
                {copy.title}
              </Typography>
              <Button
                startIcon={<ShellIcon name="refresh" />}
                disabled={busy}
                onClick={() => void load()}
              >
                {copy.refreshLabel}
              </Button>
            </Stack>
            {notice && <Alert severity="success">{notice}</Alert>}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{copy.enterpriseLabel}</TableCell>
                    <TableCell>{copy.responsibilityLabel}</TableCell>
                    <TableCell>{copy.statusLabel}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workspace.items.map((member) => (
                    <TableRow key={member.code}>
                      <TableCell>{member.enterpriseName}</TableCell>
                      <TableCell>{member.responsibility}</TableCell>
                      <TableCell>{copy[member.status]}</TableCell>
                      <TableCell>
                        {member.actions.map((action) => (
                          <Button
                            key={action}
                            disabled={busy || !!review}
                            onClick={() => {
                              setNotice('');
                              setReview({ member, action });
                            }}
                          >
                            {copy[action]}
                          </Button>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {!workspace.items.length && <Typography>{copy.emptyMessage}</Typography>}
          </>
        ) : busy ? (
          <CircularProgress aria-label="Loading" />
        ) : (
          <Button onClick={() => void load()}>Retry</Button>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        <Dialog
          open={!!review && !!copy}
          onClose={() => {
            if (!busy && !uncertain) setReview(undefined);
          }}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>{copy?.reviewTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <Typography>{review?.member.enterpriseName}</Typography>
              <Typography>{review?.member.responsibility}</Typography>
              <Typography>{review && copy?.[review.action]}</Typography>
              <Typography>{copy?.reviewMessage}</Typography>
              {uncertain && <Alert severity="warning">{copy?.uncertainMessage}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            {uncertain ? (
              <Button disabled={busy} onClick={() => void load()}>
                {copy?.inspectLabel}
              </Button>
            ) : (
              <>
                <Button disabled={busy} onClick={() => setReview(undefined)}>
                  {copy?.cancelLabel}
                </Button>
                <Button disabled={busy} onClick={() => void confirm()}>
                  {copy?.confirmLabel}
                </Button>
              </>
            )}
          </DialogActions>
        </Dialog>
      </Stack>
    </WorkspaceContainer>
  );
}
