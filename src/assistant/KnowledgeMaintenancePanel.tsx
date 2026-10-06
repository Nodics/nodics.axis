/** @file Read-only source maintenance evidence with explicit uncertainty and permission-safe pagination. */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import type {
  KnowledgeMaintenanceHistory,
  parseKnowledgeMaintenanceCopy,
} from './api/knowledgeMaintenanceClient';

/** Discards old pages before reads and aborts when source identity changes. */
export function KnowledgeMaintenancePanel({
  copy,
  load,
}: {
  readonly copy: ReturnType<typeof parseKnowledgeMaintenanceCopy>;
  readonly load: (
    page: number,
    signal?: AbortSignal,
  ) => Promise<KnowledgeMaintenanceHistory>;
}) {
  const [history, setHistory] = useState<KnowledgeMaintenanceHistory>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const active = useRef<AbortController | null>(null);
  const locked = useRef(false);
  useEffect(() => () => active.current?.abort(), []);
  const read = (page: number) => {
    if (locked.current) return;
    setHistory(undefined);
    setFailed(false);
    if (!navigator.onLine) {
      setFailed(true);
      return;
    }
    locked.current = true;
    setBusy(true);
    const abort = new AbortController();
    active.current = abort;
    void Promise.resolve()
      .then(() => load(page, abort.signal))
      .then((value) => {
        if (!abort.signal.aborted) setHistory(value);
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      })
      .finally(() => {
        locked.current = false;
        if (!abort.signal.aborted) setBusy(false);
      });
  };
  return (
    <Box sx={{ my: 3, minWidth: 0 }}>
      <Typography component="h3" variant="subtitle2">
        {copy.title}
      </Typography>
      <Button
        disabled={busy}
        onClick={() => read(history?.page || 1)}
        startIcon={<ShellIcon name="refresh" />}
      >
        {history ? copy.refresh : copy.load}
      </Button>
      {failed ? (
        <Alert severity="warning" role="status">
          {copy.unavailable}
        </Alert>
      ) : null}
      {history ? (
        <Stack spacing={2}>
          <Alert severity="info">{copy.evidence}</Alert>
          {!history.items.length ? <Typography>{copy.empty}</Typography> : null}
          {history.items.map((item) => (
            <Box
              key={item.code}
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                py: 1,
                overflowWrap: 'anywhere',
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {copy[item.stage]}
              </Typography>
              <Typography variant="body2">
                {new Date(item.occurredAt).toLocaleString()}
              </Typography>
              <Typography variant="body2">
                {copy.operation}: {item.operationCode}
              </Typography>
              <Typography variant="body2">
                {copy.actor}: {item.principalCode}
              </Typography>
              <Typography variant="body2">
                {copy.revision}: {item.revision}
              </Typography>
            </Box>
          ))}
          <Stack
            direction="row"
            sx={{ justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}
          >
            <Tooltip title={copy.previous}>
              <span>
                <IconButton
                  aria-label={copy.previous}
                  disabled={busy || history.page <= 1}
                  onClick={() => read(history.page - 1)}
                >
                  <ShellIcon name="chevron-left" />
                </IconButton>
              </span>
            </Tooltip>
            <Typography variant="body2">{history.page}</Typography>
            <Tooltip title={copy.next}>
              <span>
                <IconButton
                  aria-label={copy.next}
                  disabled={busy || !history.mayHaveMore || history.page >= 1000}
                  onClick={() => read(history.page + 1)}
                >
                  <ShellIcon name="chevron-right" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      ) : null}
    </Box>
  );
}
