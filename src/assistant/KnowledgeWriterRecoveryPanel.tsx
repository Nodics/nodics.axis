/** @file Explicit pending-writer review and confirmation with no automatic retirement or uncertain replay. */
import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type {
  KnowledgeWriterReview,
  parseKnowledgeWriterRecoveryCopy,
} from './api/knowledgeWriterRecoveryClient';

export interface KnowledgeWriterRecoveryActions {
  readonly preview: (signal?: AbortSignal) => Promise<KnowledgeWriterReview>;
  readonly execute: (
    review: KnowledgeWriterReview,
    signal?: AbortSignal,
  ) => Promise<void>;
}
/** Keeps review local to one selected source and locks every sent retirement until a fresh inventory is loaded. */
export function KnowledgeWriterRecoveryPanel({
  copy,
  actions,
}: {
  readonly copy: ReturnType<typeof parseKnowledgeWriterRecoveryCopy>;
  readonly actions: KnowledgeWriterRecoveryActions;
}) {
  const [review, setReview] = useState<KnowledgeWriterReview>();
  const [state, setState] = useState<'IDLE' | 'BUSY' | 'FAILED' | 'DONE' | 'UNKNOWN'>(
    'IDLE',
  );
  const pending = useRef<AbortController | null>(null);
  const locked = useRef(false);
  useEffect(() => () => pending.current?.abort(), []);
  const run = (execute: boolean) => {
    if (locked.current || (execute && !review?.eligible)) return;
    if (!navigator.onLine) {
      setState('FAILED');
      return;
    }
    locked.current = true;
    const controller = new AbortController();
    pending.current = controller;
    setState('BUSY');
    const task = execute
      ? Promise.resolve()
          .then(() => actions.execute(review!, controller.signal))
          .then(() => {
            if (!controller.signal.aborted) setState('DONE');
          })
      : Promise.resolve()
          .then(() => actions.preview(controller.signal))
          .then((value) => {
            if (!controller.signal.aborted) {
              setReview(value);
              setState('IDLE');
            }
          });
    void task
      .catch(() => {
        if (!controller.signal.aborted) setState(execute ? 'UNKNOWN' : 'FAILED');
      })
      .finally(() => {
        if (!execute) locked.current = false;
      });
  };
  const terminal = state === 'DONE' || state === 'UNKNOWN';
  return (
    <Box sx={{ my: 3, minWidth: 0 }}>
      <Typography component="h3" variant="subtitle2">
        {copy.title}
      </Typography>
      {review ? (
        <>
          <Box
            component="dl"
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'minmax(0, 1fr) minmax(0, 1fr)',
              },
              gap: 1,
              my: 2,
              '& dd': { m: 0, overflowWrap: 'anywhere' },
            }}
          >
            <Typography component="dt" variant="body2">
              {copy.started}
            </Typography>
            <Typography component="dd" variant="body2">
              {new Date(review.startedAt).toLocaleString()}
            </Typography>
            <Typography component="dt" variant="body2">
              {copy.chunks}
            </Typography>
            <Typography component="dd" variant="body2">
              {review.expectedChunks}
            </Typography>
          </Box>
          {!terminal ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {review.eligible ? copy.impact : copy.notEligible}
            </Alert>
          ) : null}
        </>
      ) : null}
      <Stack direction="row" sx={{ gap: 1, mt: 1, flexWrap: 'wrap' }}>
        {review ? (
          <>
            <Button
              variant="contained"
              color="warning"
              disabled={state === 'BUSY' || terminal || !review.eligible}
              onClick={() => run(true)}
            >
              {copy.confirm}
            </Button>
            <Button
              disabled={state === 'BUSY' || terminal}
              onClick={() => {
                setReview(undefined);
                setState('IDLE');
              }}
            >
              {copy.cancel}
            </Button>
          </>
        ) : (
          <Button
            variant="outlined"
            disabled={state === 'BUSY'}
            onClick={() => run(false)}
          >
            {copy.review}
          </Button>
        )}
      </Stack>
      {state === 'FAILED' || terminal ? (
        <Alert
          role="status"
          severity={state === 'DONE' ? 'success' : 'warning'}
          sx={{ mt: 2 }}
        >
          {state === 'DONE'
            ? copy.done
            : state === 'UNKNOWN'
              ? copy.unknown
              : copy.unavailable}
        </Alert>
      ) : null}
    </Box>
  );
}
