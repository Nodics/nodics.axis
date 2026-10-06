/** @file Reviewed legacy retirement with original-result inspection and explicit retained-data status. */
import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import type {
  createKnowledgeMigrationClient,
  KnowledgeMigrationPlan,
  KnowledgeMigrationResult,
  parseKnowledgeMigration,
} from './api/knowledgeMigrationClient';

/** Keeps one plan's command locked after dispatch, including uncertain inspection results. */
export function KnowledgeMigrationPanel({
  plan,
  copy,
  client,
  erasure = false,
}: {
  readonly plan: KnowledgeMigrationPlan;
  readonly copy: ReturnType<typeof parseKnowledgeMigration>['presentation'];
  readonly client: ReturnType<typeof createKnowledgeMigrationClient>;
  readonly erasure?: boolean;
}) {
  const [result, setResult] = useState<KnowledgeMigrationResult>();
  const [state, setState] = useState<'IDLE' | 'BUSY' | 'FAILED' | 'UNKNOWN'>('IDLE');
  const inFlight = useRef(false);
  const dispatched = useRef(false);
  const [sent, setSent] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const panel = useRef<HTMLElement | null>(null);
  const primaryControl = useRef<HTMLButtonElement | null>(null);
  const inspectControl = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useRef(false);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (state === 'BUSY' || !restoreFocus.current) return;
    restoreFocus.current = false;
    if (
      document.activeElement === document.body ||
      panel.current?.contains(document.activeElement)
    )
      (sent ? inspectControl.current : primaryControl.current)?.focus();
  }, [result, sent, state]);
  const run = (mode: 'preview' | 'execute' | 'inspect') => {
    if (
      inFlight.current ||
      (mode !== 'inspect' && dispatched.current) ||
      (mode === 'execute' && result?.state !== 'REVIEWED')
    )
      return;
    if (!navigator.onLine) {
      setState('FAILED');
      return;
    }
    inFlight.current = true;
    restoreFocus.current = panel.current?.contains(document.activeElement) === true;
    if (mode !== 'preview') {
      dispatched.current = true;
      setSent(true);
    }
    const controller = new AbortController();
    pending.current = controller;
    setState('BUSY');
    void Promise.resolve()
      .then(() =>
        mode === 'execute'
          ? client[erasure ? 'erase' : 'execute'](plan, result!, controller.signal)
          : client[
              erasure
                ? mode === 'preview'
                  ? 'previewErasure'
                  : 'inspectErasure'
                : mode
            ](plan, controller.signal),
      )
      .then((value) => {
        if (controller.signal.aborted) return;
        if (value.state !== 'REVIEWED') {
          dispatched.current = true;
          setSent(true);
        }
        setResult(value);
        setState('IDLE');
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState(mode === 'execute' ? 'UNKNOWN' : 'FAILED');
      })
      .finally(() => {
        inFlight.current = false;
      });
  };
  return (
    <Box
      component="section"
      ref={panel}
      sx={{ py: 3, borderTop: 1, borderColor: 'divider', minWidth: 0 }}
    >
      <Typography component="h2" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
        {erasure ? `${plan.label}: ${copy.eraseReview}` : plan.label}
      </Typography>
      {result?.state === 'REVIEWED' && !sent ? (
        <>
          <Typography variant="body2" sx={{ my: 1 }}>
            {copy.sources}: {result.sourceCount}
          </Typography>
          <Alert severity="warning" sx={{ my: 2 }}>
            {erasure ? copy.eraseImpact : copy.impact}
          </Alert>
        </>
      ) : null}
      <Stack direction="row" sx={{ gap: 1, my: 2, flexWrap: 'wrap' }}>
        {(erasure ? plan.canErase : plan.canExecute) && !sent ? (
          result?.state === 'REVIEWED' ? (
            <>
              <Button
                ref={primaryControl}
                color="warning"
                variant="contained"
                disabled={state === 'BUSY'}
                onClick={() => run('execute')}
              >
                {erasure ? copy.eraseConfirm : copy.confirm}
              </Button>
              <Button
                disabled={state === 'BUSY'}
                onClick={() => {
                  restoreFocus.current = true;
                  setResult(undefined);
                  setState('IDLE');
                }}
              >
                {copy.cancel}
              </Button>
            </>
          ) : (
            <Button
              ref={primaryControl}
              variant="outlined"
              disabled={state === 'BUSY'}
              onClick={() => run('preview')}
            >
              {erasure ? copy.eraseReview : copy.review}
            </Button>
          )
        ) : null}
        <Button
          ref={inspectControl}
          startIcon={<ShellIcon name="search" />}
          disabled={state === 'BUSY'}
          onClick={() => run('inspect')}
        >
          {erasure ? copy.eraseInspect : copy.inspect}
        </Button>
      </Stack>
      {state === 'FAILED' ||
      state === 'UNKNOWN' ||
      (result && result.state !== 'REVIEWED') ? (
        <Alert
          role="status"
          severity={
            state === 'IDLE' && result?.state === (erasure ? 'ERASED' : 'RETIRED')
              ? 'success'
              : 'warning'
          }
        >
          {state === 'FAILED'
            ? copy.unavailable
            : state === 'UNKNOWN' || result?.state === 'OUTCOME_UNKNOWN'
              ? erasure
                ? copy.eraseUnknown
                : copy.unknown
              : result?.state === (erasure ? 'ERASED' : 'RETIRED')
                ? erasure
                  ? copy.eraseDone
                  : copy.done
                : copy.notStarted}
        </Alert>
      ) : null}
    </Box>
  );
}
