/** @file Responsive persisted execution inspection, with abortable reads and no retry-action authority. */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import type {
  KnowledgeHistory,
  KnowledgeHistoryCopy,
} from './api/knowledgeHistoryClient';

interface Props {
  readonly copy: KnowledgeHistoryCopy;
  readonly load: (page: number, signal?: AbortSignal) => Promise<KnowledgeHistory>;
}
/** Keeps returned history local to its source component and clears old pages before each read. */
export function KnowledgeHistoryPanel({ copy, load }: Props) {
  const [result, setResult] = useState<KnowledgeHistory>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const read = (page: number) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setResult(undefined);
    setFailed(false);
    setBusy(true);
    void Promise.resolve()
      .then(() => load(page, controller.signal))
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
  };
  const names = {
    READY: copy.ready,
    CLAIMED: copy.claimed,
    COMPLETED: copy.done,
    FAILED: copy.failed,
    INSPECTION_REQUIRED: copy.inspection,
  };
  return (
    <Box
      component="section"
      sx={{ mt: 3, minWidth: 0 }}
      aria-label={copy.title}
      aria-busy={busy}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}
      >
        <Typography component="h3" variant="subtitle1">
          {copy.title}
        </Typography>
        <Tooltip title={copy.refresh}>
          <span>
            <IconButton
              aria-label={copy.refresh}
              disabled={busy}
              onClick={() => read(result?.page ?? 1)}
            >
              <ShellIcon name="refresh" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      {!result && !busy ? (
        <Button disabled={busy} onClick={() => read(1)}>
          {copy.load}
        </Button>
      ) : null}
      {failed ? <Alert severity="warning">{copy.unavailable}</Alert> : null}
      {result ? (
        <>
          <Typography variant="caption" color="text.secondary">
            {copy.evidence}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere', my: 1 }}>
            {copy.definition}: {result.definitionCode} / {copy.version}:{' '}
            {result.definitionVersion}
          </Typography>
          {!result.items.length ? (
            <Typography color="text.secondary">{copy.empty}</Typography>
          ) : null}
          <Stack component="ol" sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {result.items.map((item) => (
              <Box
                component="li"
                key={item.executionCode}
                sx={{ py: 2, borderBottom: 1, borderColor: 'divider', minWidth: 0 }}
              >
                <Stack
                  direction="row"
                  sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}
                >
                  <Typography
                    variant="body2"
                    sx={{ overflowWrap: 'anywhere', minWidth: 0 }}
                  >
                    {item.instanceCode}
                  </Typography>
                  <Typography variant="caption">
                    {copy.version}: {item.definitionVersion}
                  </Typography>
                  <Chip
                    size="small"
                    label={names[item.status]}
                    color={
                      item.status === 'COMPLETED'
                        ? 'success'
                        : item.recovery
                          ? 'warning'
                          : 'default'
                    }
                    sx={{
                      height: 'auto',
                      minHeight: 24,
                      maxWidth: '100%',
                      '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 },
                    }}
                  />
                </Stack>
                <Typography
                  component="p"
                  variant="caption"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere', my: 0.5 }}
                >
                  {copy.instance}: {item.executionCode}
                </Typography>
                <Typography
                  variant="caption"
                  color={item.currentPolicy ? 'text.secondary' : 'warning.main'}
                >
                  {item.currentPolicy ? copy.currentPolicy : copy.previousPolicy}
                </Typography>
                {item.startedAt ? (
                  <Typography variant="body2">
                    {copy.started}: {new Date(item.startedAt).toLocaleString()}
                  </Typography>
                ) : null}
                {item.completedAt ? (
                  <Typography variant="body2">
                    {copy.completed}: {new Date(item.completedAt).toLocaleString()}
                  </Typography>
                ) : null}
                {item.recovery ? (
                  <Typography variant="body2" color="warning.main">
                    {copy.recovery}
                  </Typography>
                ) : null}
              </Box>
            ))}
          </Stack>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mt: 1 }}>
            <Tooltip title={copy.previous}>
              <span>
                <IconButton
                  aria-label={copy.previous}
                  disabled={busy || result.page <= 1}
                  onClick={() => read(result.page - 1)}
                >
                  <ShellIcon name="chevron-left" />
                </IconButton>
              </span>
            </Tooltip>
            <Typography variant="body2">{result.page}</Typography>
            <Tooltip title={copy.next}>
              <span>
                <IconButton
                  aria-label={copy.next}
                  disabled={busy || !result.hasMore || result.page >= 1000}
                  onClick={() => read(result.page + 1)}
                >
                  <ShellIcon name="chevron-right" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </>
      ) : null}
    </Box>
  );
}
