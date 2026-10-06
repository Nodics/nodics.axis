/** @file Employee review, confirmation and original Process inspection; no automatic execution or replay. */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import type {
  KnowledgeManualRefreshReview,
  parseKnowledgeManualRefreshCopy,
} from './api/knowledgeManualRefreshClient';
import type {
  KnowledgeHistory,
  KnowledgeHistoryCopy,
} from './api/knowledgeHistoryClient';

export interface KnowledgeManualRefreshActions {
  readonly preview: (
    requestId: string,
    signal?: AbortSignal,
  ) => Promise<KnowledgeManualRefreshReview>;
  readonly start: (
    review: KnowledgeManualRefreshReview,
    signal?: AbortSignal,
  ) => Promise<void>;
  readonly inspect: (
    review: KnowledgeManualRefreshReview,
    signal?: AbortSignal,
  ) => Promise<KnowledgeHistory>;
}
/** Retains one original reference for the mounted source; sent starts stay locked even after inspection fails or finds no record. */
export function KnowledgeManualRefreshPanel({
  copy,
  historyCopy,
  actions,
}: {
  readonly copy: ReturnType<typeof parseKnowledgeManualRefreshCopy>;
  readonly historyCopy: KnowledgeHistoryCopy;
  readonly actions: KnowledgeManualRefreshActions;
}) {
  const [review, setReview] = useState<KnowledgeManualRefreshReview>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState<
    'unavailable' | 'unknown' | 'acknowledged' | 'evidence'
  >();
  const [history, setHistory] = useState<KnowledgeHistory>();
  const pending = useRef<AbortController | null>(null);
  const command = useRef<string | null>(null);
  const locked = useRef(false);
  const dispatched = useRef(false);
  useEffect(() => () => pending.current?.abort(), []);
  const run = (operation: 'preview' | 'start' | 'inspect') => {
    if (
      locked.current ||
      (operation !== 'preview' && !review) ||
      (operation === 'start' && (!confirmed || dispatched.current))
    )
      return;
    if (!navigator.onLine) {
      setNotice('unavailable');
      return;
    }
    locked.current = true;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setNotice(undefined);
    if (operation === 'start') {
      dispatched.current = true;
      setSent(true);
    }
    void Promise.resolve()
      .then(async () => {
        if (controller.signal.aborted) return;
        if (operation === 'preview') {
          command.current ??= crypto.randomUUID();
          const value = await actions.preview(command.current, controller.signal);
          if (!controller.signal.aborted) {
            setReview(value);
            setConfirmed(false);
          }
        } else if (operation === 'start') {
          await actions.start(review!, controller.signal);
          if (!controller.signal.aborted) setNotice('acknowledged');
        } else {
          const value = await actions.inspect(review!, controller.signal);
          if (!controller.signal.aborted) {
            setHistory(value);
            setNotice(value.items.length ? 'evidence' : 'unknown');
          }
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setNotice(operation === 'start' ? 'unknown' : 'unavailable');
      })
      .finally(() => {
        locked.current = false;
        if (!controller.signal.aborted) setBusy(false);
      });
  };
  const labels = {
    READY: historyCopy.ready,
    CLAIMED: historyCopy.claimed,
    COMPLETED: historyCopy.done,
    FAILED: historyCopy.failed,
    INSPECTION_REQUIRED: historyCopy.inspection,
  };
  return (
    <Box
      component="section"
      aria-label={copy.title}
      aria-busy={busy}
      sx={{ mt: 3, minWidth: 0 }}
    >
      <Typography component="h3" variant="subtitle1">
        {copy.title}
      </Typography>
      {review ? (
        <Stack sx={{ gap: 1, my: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {copy.reference}: {review.instanceCode}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {copy.definition}: {review.definitionCode} / {copy.version}:{' '}
            {review.version}
          </Typography>
          {!sent ? (
            <FormControlLabel
              control={
                <Checkbox
                  checked={confirmed}
                  disabled={busy}
                  onChange={(_, value) => setConfirmed(value)}
                />
              }
              label={copy.confirm}
            />
          ) : null}
        </Stack>
      ) : null}
      <Stack direction="row" sx={{ gap: 1, mt: 1, flexWrap: 'wrap' }}>
        {!review ? (
          <Button
            startIcon={<ShellIcon name="search" />}
            disabled={busy}
            onClick={() => run('preview')}
          >
            {copy.review}
          </Button>
        ) : null}
        {review && !sent ? (
          <Button
            variant="contained"
            startIcon={<ShellIcon name="refresh" />}
            disabled={busy || !confirmed}
            onClick={() => run('start')}
          >
            {copy.start}
          </Button>
        ) : null}
        {review && sent ? (
          <Button
            startIcon={<ShellIcon name="search" />}
            disabled={busy}
            onClick={() => run('inspect')}
          >
            {copy.inspect}
          </Button>
        ) : null}
      </Stack>
      {notice ? (
        <Alert
          severity={
            notice === 'unavailable' || notice === 'unknown' ? 'warning' : 'info'
          }
          sx={{ mt: 2 }}
        >
          {copy[notice]}
        </Alert>
      ) : null}
      {history?.items.map((item) => (
        <Box
          key={item.executionCode}
          sx={{
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
            overflowWrap: 'anywhere',
          }}
        >
          <Typography variant="body2">{labels[item.status]}</Typography>
          <Typography variant="caption">{item.executionCode}</Typography>
          <Typography variant="body2">
            {historyCopy.started}: {new Date(item.startedAt).toLocaleString()}
          </Typography>
          <Typography variant="caption">
            {item.currentPolicy
              ? historyCopy.currentPolicy
              : historyCopy.previousPolicy}
          </Typography>
          {item.recovery ? (
            <Typography color="warning.main" variant="body2">
              {historyCopy.recovery}
            </Typography>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}
