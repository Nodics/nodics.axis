/** Platform/Profile-owned team task. Backend actions, revisions and serialized commands remain authoritative. */
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
import { ShellIcon } from '../../app/shell/ShellIcon';
import type { AxisAuthenticatedBootstrap } from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  changeEnterpriseMembership,
  handoverEnterpriseAdministrator,
  loadEnterpriseTeamWorkspace,
  type EnterpriseTeamWorkspace,
  type TeamAction,
} from './api/enterpriseMembershipClient';

type ReviewedCommand = {
  readonly member: EnterpriseTeamWorkspace['items'][number];
  readonly action: TeamAction;
  readonly id: string;
  readonly enterpriseCode: string;
};
/** Renders one current-enterprise task; uncertain writes retain reviewed input and operation ID, never automatic retry. */
export function EnterpriseTeamRoutePage({
  bootstrap,
  accessToken,
  runtime,
}: {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly accessToken: string;
  readonly runtime: AxisRuntimeConfig;
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
    workspace: EnterpriseTeamWorkspace;
  }>();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [command, setCommand] = useState<ReviewedCommand>(),
    [uncertain, setUncertain] = useState(false),
    [notice, setNotice] = useState('');
  const version = useRef(0),
    inFlight = useRef(false);
  const workspace =
    snapshot?.configuration === configuration ? snapshot.workspace : undefined;
  const copy = workspace?.presentation;
  const invalidate = useCallback(() => {
    version.current++;
  }, []);
  const load = useCallback(async () => {
    const attempt = ++version.current;
    setBusy(true);
    setError('');
    try {
      const value = await loadEnterpriseTeamWorkspace(configuration);
      if (attempt === version.current) setSnapshot({ configuration, workspace: value });
    } catch (reason) {
      if (attempt === version.current) {
        setSnapshot(undefined);
        setError(
          reason instanceof Error ? reason.message : 'Team workspace is unavailable.',
        );
      }
    } finally {
      if (attempt === version.current) setBusy(false);
    }
  }, [configuration]);
  useEffect(() => {
    setCommand(undefined);
    setUncertain(false);
    setNotice('');
    inFlight.current = false;
    void load();
    return invalidate;
  }, [load, invalidate]);
  const confirm = async () => {
    if (!command || !workspace || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    const attempt = version.current;
    try {
      if (command.action === 'HANDOVER')
        await handoverEnterpriseAdministrator(
          configuration,
          command.enterpriseCode,
          command.member,
          command.id,
        );
      else
        await changeEnterpriseMembership(
          configuration,
          command.action,
          command.member,
          command.id,
        );
      if (attempt !== version.current) return;
      setCommand(undefined);
      setUncertain(false);
      setNotice(workspace.presentation.successMessage);
      inFlight.current = false;
      await load();
    } catch (reason) {
      if (attempt === version.current) {
        setUncertain(true);
        setError(
          reason instanceof Error
            ? reason.message
            : workspace.presentation.uncertainMessage,
        );
      }
    } finally {
      if (attempt === version.current) {
        inFlight.current = false;
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
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
            >
              <div>
                <Typography variant="h4" component="h1">
                  {copy.title}
                </Typography>
                <Typography>{workspace.enterpriseName}</Typography>
              </div>
              <Button
                startIcon={<ShellIcon name="refresh" />}
                disabled={busy}
                onClick={() => void load()}
              >
                {copy.refreshLabel}
              </Button>
            </Stack>
            {workspace.operation?.phase === 'PENDING' && (
              <Alert severity="warning">{copy.pendingMessage}</Alert>
            )}
            {notice && <Alert severity="success">{notice}</Alert>}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{copy.emailLabel}</TableCell>
                    <TableCell>{copy.responsibilityLabel}</TableCell>
                    <TableCell>{copy.statusLabel}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workspace.items.map((member) => (
                    <TableRow key={member.code}>
                      <TableCell>
                        {member.email}
                        {member.designated && (
                          <Typography variant="caption" sx={{ display: 'block' }}>
                            {copy.designatedLabel}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{member.responsibility}</TableCell>
                      <TableCell>{copy[member.status]}</TableCell>
                      <TableCell>
                        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                          {member.actions.map((action) => (
                            <Button
                              key={action}
                              disabled={
                                busy ||
                                !!command ||
                                workspace.operation?.phase === 'PENDING'
                              }
                              onClick={() => {
                                setNotice('');
                                setUncertain(false);
                                setCommand({
                                  member,
                                  action,
                                  id: crypto.randomUUID(),
                                  enterpriseCode: workspace.enterpriseCode,
                                });
                              }}
                            >
                              {copy[action]}
                            </Button>
                          ))}
                        </Stack>
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
          open={!!command && !!copy}
          onClose={() => {
            if (!busy && !uncertain) setCommand(undefined);
          }}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>{copy?.reviewTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <Typography>{command?.member.email}</Typography>
              <Typography>{command && copy?.[command.action]}</Typography>
              <Typography>{copy?.reviewMessage}</Typography>
              {uncertain && <Alert severity="warning">{copy?.uncertainMessage}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            {!uncertain && (
              <Button disabled={busy} onClick={() => setCommand(undefined)}>
                {copy?.cancelLabel}
              </Button>
            )}
            {uncertain && (
              <Button disabled={busy} onClick={() => void load()}>
                {copy?.inspectLabel}
              </Button>
            )}
            <Button disabled={busy} onClick={() => void confirm()}>
              {uncertain ? copy?.retryLabel : copy?.confirmLabel}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </WorkspaceContainer>
  );
}
