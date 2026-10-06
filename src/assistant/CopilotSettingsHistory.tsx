/** @file Read-only enterprise-origin settings proposals; excludes snapshots, automatic commands and legacy unbound requests. */
import { useEffect, useState } from 'react';
import { Alert, IconButton, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import {
  createCopilotAdministrationClient,
  type SettingsPresentation,
} from './api/copilotAdministrationClient';

/** Clears old pages before reading and drops obsolete responses. */
export function CopilotSettingsHistory({
  client,
  copy,
}: {
  client: ReturnType<typeof createCopilotAdministrationClient>;
  copy: SettingsPresentation;
}) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    page: number;
    revision: number;
    data?: Awaited<ReturnType<typeof client.history>>;
    error?: boolean;
  }>();
  useEffect(() => {
    const guard = new AbortController();
    void client
      .history(page, guard.signal)
      .then((data) => {
        if (!guard.signal.aborted) setResult({ page, revision, data });
      })
      .catch(() => {
        if (!guard.signal.aborted) setResult({ page, revision, error: true });
      });
    return () => guard.abort();
  }, [client, page, revision]);
  const current =
    result?.page === page && result.revision === revision ? result : undefined;
  return (
    <Stack spacing={2} sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography variant="h6">{copy.history}</Typography>
        <Tooltip title={copy.historyRefresh}>
          <IconButton
            aria-label={copy.historyRefresh}
            onClick={() => setRevision((value) => value + 1)}
          >
            <ShellIcon name="refresh" />
          </IconButton>
        </Tooltip>
      </Stack>
      {!current ? (
        <Skeleton height={80} />
      ) : current.error ? (
        <Alert severity="warning">Request history unavailable.</Alert>
      ) : !current.data?.items.length ? (
        <Typography>{copy.historyEmpty}</Typography>
      ) : (
        current.data.items.map((item) => (
          <Stack
            key={item.code}
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ justifyContent: 'space-between', overflowWrap: 'anywhere' }}
          >
            <Typography>{item.code}</Typography>
            <Typography>{item.requestedBy}</Typography>
            <Typography>{item.status}</Typography>
            <Typography>{new Date(item.occurredAt).toLocaleString()}</Typography>
          </Stack>
        ))
      )}
      <Stack direction="row" sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
        <Tooltip title={copy.previous}>
          <span>
            <IconButton
              aria-label={copy.previous}
              disabled={!current || page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              <ShellIcon name="chevron-left" />
            </IconButton>
          </span>
        </Tooltip>
        <Typography>
          {copy.page} {page}
        </Typography>
        <Tooltip title={copy.next}>
          <span>
            <IconButton
              aria-label={copy.next}
              disabled={!current?.data?.mayHaveMore || page >= 1000}
              onClick={() => setPage((value) => value + 1)}
            >
              <ShellIcon name="chevron-right" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
