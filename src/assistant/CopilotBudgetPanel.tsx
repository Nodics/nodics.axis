/** @file Current-period allocation workflow with explicit review, atomic-owner writes and no mutation retries. */
import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';

import {
  createCopilotBudgetClient,
  type BudgetCommand,
  type BudgetPreview,
  type CopilotBudgets,
} from './api/copilotBudgetClient';
import type { AssistantTransportConfiguration } from './api/assistantTransport';

/** Loads only within its parent identity-bound native usage session. */
export function CopilotBudgetPanel({
  configuration,
  onBack,
}: {
  readonly configuration: AssistantTransportConfiguration;
  readonly onBack: () => void;
}) {
  const client = useMemo(
    () => createCopilotBudgetClient(configuration),
    [configuration],
  );
  const [result, setResult] = useState<{
    client: typeof client;
    refresh: number;
    snapshot?: CopilotBudgets;
    failed?: boolean;
  }>();
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void client
      .get(abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setResult({ client, refresh, snapshot: value });
      })
      .catch(() => {
        if (!abort.signal.aborted) setResult({ client, refresh, failed: true });
      });
    return () => abort.abort();
  }, [client, refresh]);
  if (result?.client !== client || result.refresh !== refresh)
    return <Skeleton variant="rectangular" height={280} />;
  if (result.failed)
    return (
      <Alert
        severity="warning"
        action={
          <>
            <Button onClick={onBack}>Back</Button>
            <Button onClick={() => setRefresh((value) => value + 1)}>Retry</Button>
          </>
        }
      >
        Workspace could not be loaded.
      </Alert>
    );
  const snapshot = result.snapshot;
  if (!snapshot) return <Skeleton variant="rectangular" height={280} />;
  return (
    <CopilotBudgetView
      key={`${snapshot.revision}:${refresh}`}
      snapshot={snapshot}
      onBack={onBack}
      onRefresh={() => setRefresh((value) => value + 1)}
      onPreview={client.preview}
      onChange={async (command) => {
        setResult({ client, refresh, snapshot: await client.change(command) });
      }}
    />
  );
}

/** Presents owner-provided ceilings and immutable review data; never invents authority or successful writes. */
export function CopilotBudgetView({
  snapshot,
  onBack,
  onRefresh,
  onPreview,
  onChange,
}: {
  readonly snapshot: CopilotBudgets;
  readonly onBack: () => void;
  readonly onRefresh: () => void;
  readonly onPreview: (command: BudgetCommand) => Promise<BudgetPreview>;
  readonly onChange: (command: BudgetCommand) => Promise<void>;
}) {
  const copy = snapshot.presentation;
  const [draft, setDraft] = useState<{
    target: 'ENTERPRISE' | 'USER';
    principalCode: string | null;
    limit: string;
    ceiling: number;
  }>();
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<BudgetPreview>();
  const [failure, setFailure] = useState<'PREVIEW' | 'SAVE'>();
  const previewMutation = useMutation({ mutationFn: onPreview });
  const saveMutation = useMutation({ mutationFn: onChange });
  const busy = previewMutation.isPending || saveMutation.isPending;
  const amount = draft && /^\d+$/.test(draft.limit) ? Number(draft.limit) : NaN;
  const valid =
    draft &&
    Number.isSafeInteger(amount) &&
    amount >= 0 &&
    amount <= draft.ceiling &&
    reason.trim().length > 0 &&
    reason.length <= 500;
  const close = () => {
    if (!busy && failure !== 'SAVE') {
      setDraft(undefined);
      setPreview(undefined);
      setReason('');
      setFailure(undefined);
    }
  };
  const review = async () => {
    if (!valid || !draft || busy) return;
    setFailure(undefined);
    try {
      setPreview(
        await previewMutation.mutateAsync({
          target: draft.target,
          principalCode: draft.principalCode,
          limit: amount,
          reason: reason.trim(),
          changeId: crypto.randomUUID(),
          periodKey: snapshot.period.key,
          policyDigest: snapshot.policyDigest,
          expectedRevision: snapshot.revision,
        }),
      );
    } catch {
      setFailure('PREVIEW');
    }
  };
  const save = async () => {
    if (!preview || busy || failure === 'SAVE') return;
    try {
      await saveMutation.mutateAsync(preview.command);
      close();
    } catch {
      setFailure('SAVE');
    }
  };
  const row = (
    principalCode: string | null,
    values: CopilotBudgets['enterprise'],
    allowed: boolean,
  ) => (
    <Box
      key={principalCode ?? 'enterprise'}
      component="li"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2,minmax(0,1fr))',
          md: 'minmax(160px,2fr) repeat(4,minmax(0,1fr)) 40px',
        },
        py: 2,
        gap: 2,
        borderBottom: 1,
        borderColor: 'divider',
        alignItems: 'center',
      }}
    >
      <Typography sx={{ overflowWrap: 'anywhere' }}>
        {principalCode ?? copy.enterprise}
      </Typography>
      <Box sx={{ gridColumn: { xs: 2, md: 6 }, gridRow: 1 }}>
        {allowed ? (
          <Tooltip title={copy.edit}>
            <IconButton
              aria-label={`${copy.edit}: ${principalCode ?? copy.enterprise}`}
              disabled={busy}
              onClick={() => {
                setDraft({
                  target: principalCode === null ? 'ENTERPRISE' : 'USER',
                  principalCode,
                  limit: String(values.limit),
                  ceiling: values.ceiling,
                });
                setReason('');
                setFailure(undefined);
              }}
            >
              <ShellIcon name="settings" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
      {(['limit', 'ceiling', 'consumed', 'reserved'] as const).map((key) => (
        <Box key={key} sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            {copy[key]}
          </Typography>
          <Typography sx={{ overflowWrap: 'anywhere' }}>
            {values[key].toLocaleString()}
          </Typography>
        </Box>
      ))}
    </Box>
  );
  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'start', justifyContent: 'space-between', gap: 2 }}
      >
        <Box>
          <Button
            startIcon={<ShellIcon name="chevron-left" />}
            onClick={onBack}
            disabled={busy}
          >
            {copy.back}
          </Button>
          <Typography component="h1" variant="h5">
            {copy.title}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {snapshot.context.enterpriseCode} /{' '}
            {new Date(snapshot.period.resetsAt).toLocaleString(undefined, {
              timeZone: snapshot.period.timezone,
            })}{' '}
            ({snapshot.period.timezone})
          </Typography>
        </Box>
        <Tooltip title={copy.refresh}>
          <IconButton aria-label={copy.refresh} onClick={onRefresh} disabled={busy}>
            <ShellIcon name="refresh" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Alert severity="info" sx={{ my: 2 }}>
        {copy.periodOnly}
      </Alert>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {row(null, snapshot.enterprise, snapshot.permissions.enterprise)}
        {snapshot.users.map((item) =>
          row(item.principalCode, item, snapshot.permissions.users),
        )}
      </Box>
      {!snapshot.users.length ? (
        <Typography sx={{ my: 2 }}>{copy.noUsers}</Typography>
      ) : null}
      <Typography component="h2" variant="h6" sx={{ mt: 4 }}>
        {copy.history}
      </Typography>
      {snapshot.hasMoreChanges ? (
        <Typography variant="caption">{copy.historyLimited}</Typography>
      ) : null}
      {!snapshot.changes.length ? (
        <Typography color="text.secondary" sx={{ my: 2 }}>
          {copy.noChanges}
        </Typography>
      ) : (
        snapshot.changes.map((change) => (
          <Box
            key={change.changeId}
            sx={{
              py: 2,
              borderBottom: 1,
              borderColor: 'divider',
              overflowWrap: 'anywhere',
            }}
          >
            <Typography>
              {change.principalCode ?? copy.enterprise}:{' '}
              {change.before.toLocaleString()} &rarr; {change.after.toLocaleString()}
            </Typography>
            <Typography variant="body2">
              {copy.actor}: {change.actor} &middot;{' '}
              {new Date(change.createdAt).toLocaleString(undefined, {
                timeZone: snapshot.period.timezone,
              })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {change.reason}
            </Typography>
          </Box>
        ))
      )}
      <Dialog open={!!draft} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle>{preview ? copy.review : copy.edit}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            {draft?.principalCode ?? copy.enterprise}
          </Typography>
          {failure ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {failure === 'SAVE' ? copy.saveUnknown : copy.previewFailed}
            </Alert>
          ) : null}
          {preview ? (
            <Box component="dl" sx={{ m: 0 }}>
              {(['before', 'after', 'committed'] as const).map((key) => (
                <Stack
                  key={key}
                  direction="row"
                  sx={{ justifyContent: 'space-between', gap: 2, py: 1 }}
                >
                  <Typography component="dt">{copy[key]}</Typography>
                  <Typography component="dd" sx={{ m: 0 }}>
                    {preview.impact[key].toLocaleString()}
                  </Typography>
                </Stack>
              ))}
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere', my: 2 }}>
                {preview.command.reason}
              </Typography>
              {preview.impact.belowCommitted ? (
                <Alert severity="warning">{copy.belowCommitted}</Alert>
              ) : null}
            </Box>
          ) : (
            <Stack spacing={3} sx={{ pt: 1 }}>
              <TextField
                label={copy.limit}
                type="number"
                value={draft?.limit ?? ''}
                disabled={busy}
                slotProps={{ htmlInput: { min: 0, max: draft?.ceiling, step: 1 } }}
                onChange={(event) => {
                  if (draft) setDraft({ ...draft, limit: event.target.value });
                }}
                helperText={`${copy.ceiling}: ${draft?.ceiling.toLocaleString() ?? ''}`}
              />
              <TextField
                label={copy.reason}
                value={reason}
                multiline
                minRows={2}
                disabled={busy}
                slotProps={{ htmlInput: { maxLength: 500 } }}
                onChange={(event) => setReason(event.target.value)}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {failure === 'SAVE' ? (
            <Button onClick={onRefresh}>{copy.refresh}</Button>
          ) : (
            <>
              <Button onClick={close} disabled={busy}>
                {copy.cancel}
              </Button>
              <Button
                variant="contained"
                disabled={busy || (!preview && !valid)}
                onClick={() => void (preview ? save() : review())}
              >
                {preview ? copy.confirm : copy.preview}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
