/** @file Explicit review/confirm cleanup UI; index selection and authority remain backend-owned. */
import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type {
  KnowledgeCleanupReview,
  parseKnowledgeCleanupCopy,
} from './api/knowledgeCleanupClient';

export interface KnowledgeCleanupActions {
  readonly preview: (signal?: AbortSignal) => Promise<KnowledgeCleanupReview>;
  readonly execute: (
    review: KnowledgeCleanupReview,
    signal?: AbortSignal,
  ) => Promise<void>;
}
/** Requires a fresh owner review and blocks repeat execution after every sent command, including uncertain responses. */
export function KnowledgeCleanupPanel({
  copy,
  actions,
}: {
  readonly copy: ReturnType<typeof parseKnowledgeCleanupCopy>;
  readonly actions: KnowledgeCleanupActions;
}) {
  const [review, setReview] = useState<KnowledgeCleanupReview>();
  const [state, setState] = useState<'IDLE' | 'BUSY' | 'FAILED' | 'DONE' | 'UNKNOWN'>(
    'IDLE',
  );
  const pending = useRef<AbortController | null>(null);
  const locked = useRef(false);
  useEffect(() => () => pending.current?.abort(), []);
  const run = (execute: boolean) => {
    if (locked.current || (execute && !review)) return;
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
  return (
    <Box sx={{ mt: 2, mb: 3, minWidth: 0 }}>
      <Typography component="h3" variant="subtitle2">
        {copy.title}
      </Typography>
      {review ? (
        <Box
          component="dl"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 1,
            my: 2,
            '& dd': { m: 0 },
          }}
        >
          <Typography component="dt" variant="body2">
            {copy.eligible}
          </Typography>
          <Typography component="dd" variant="body2">
            {review.eligibleGenerations}
          </Typography>
          <Typography component="dt" variant="body2">
            {copy.operatorOnly}
          </Typography>
          <Typography component="dd" variant="body2">
            {review.operatorOnlyGenerations}
          </Typography>
        </Box>
      ) : null}
      <Stack direction="row" sx={{ gap: 1, mt: 1, flexWrap: 'wrap' }}>
        {review ? (
          <>
            <Button
              variant="contained"
              disabled={
                state === 'BUSY' ||
                state === 'DONE' ||
                state === 'UNKNOWN' ||
                !review.eligibleGenerations
              }
              onClick={() => run(true)}
            >
              {copy.confirm}
            </Button>
            <Button
              disabled={state === 'BUSY' || state === 'DONE' || state === 'UNKNOWN'}
              onClick={() => setReview(undefined)}
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
      {state === 'FAILED' || state === 'UNKNOWN' || state === 'DONE' ? (
        <Alert severity={state === 'DONE' ? 'success' : 'warning'} sx={{ mt: 2 }}>
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
