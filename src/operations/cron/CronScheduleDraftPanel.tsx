/** @file Cron-owned inactive schedule draft rendering with explicit review, confirmation and original-save recovery. */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { AxisModuleConnection } from '../../bootstrap/publicBootstrap';
import { ShellIcon } from '../../app/shell/ShellIcon';
import type { CronJobClientConfiguration } from './api/cronJobClient';
import { CronScheduleLifecyclePanel } from './CronScheduleLifecyclePanel';
import {
  parseScheduleDraftCapability,
  parseScheduleDraftReceipt,
  parseScheduleDraftReview,
  scheduleDraftRequest,
  selectSourceScheduleTargets,
  type ScheduleSourceBinding,
  type ScheduleDraftCapability,
  type ScheduleDraftInput,
  type ScheduleDraftReview,
} from './api/cronScheduleDraftClient';

interface Props {
  readonly sourceBinding?: ScheduleSourceBinding;
  readonly connection: AxisModuleConnection;
  readonly configuration: CronJobClientConfiguration;
  readonly onSaved?: () => void;
}

/** Remounts transient reviews on any credential, enterprise or connection change. */
export function CronScheduleDraftPanel(props: Props) {
  const { connection, configuration } = props;
  return (
    <ScheduleDraftSession
      key={JSON.stringify([connection, configuration, props.sourceBinding])}
      {...props}
    />
  );
}

/** Keeps input frozen after dispatch; inspection never starts, retries or activates a job. */
function ScheduleDraftSession({
  connection,
  configuration,
  onSaved,
  sourceBinding,
}: Props) {
  const [transport] = useState(() => ({ connection, configuration, sourceBinding }));
  const [capability, setCapability] = useState<ScheduleDraftCapability>();
  const [unavailable, setUnavailable] = useState(false);
  const [input, setInput] = useState<ScheduleDraftInput>({
    code: '',
    name: '',
    targetCode: '',
    expression: '',
  });
  const [review, setReview] = useState<ScheduleDraftReview>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<'SAVED_INACTIVE' | 'OUTCOME_UNKNOWN'>();
  const [failure, setFailure] = useState<'reviewFailed' | 'inspectionFailed'>();
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void scheduleDraftRequest(
      transport.connection,
      transport.configuration,
      'capabilities',
      undefined,
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          const selected = parseScheduleDraftCapability(
            value,
            transport.configuration.enterpriseCode,
          );
          setCapability({
            ...selected,
            targets: selectSourceScheduleTargets(
              selected.targets,
              transport.sourceBinding,
            ),
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setUnavailable(true);
      });
    return () => {
      controller.abort();
      pending.current?.abort();
    };
  }, [transport]);
  const copy = capability?.presentation;
  const target = capability?.targets.find((item) => item.code === input.targetCode);
  const locked = busy || outcome !== undefined;

  /** Invalidates the previous confirmation whenever any draft value changes. */
  function change(next: ScheduleDraftInput) {
    if (locked) return;
    setInput(next);
    setReview(undefined);
    setConfirmed(false);
    setFailure(undefined);
  }
  /** Sends one explicit request and preserves original review evidence after uncertainty. */
  async function send(operation: 'preview' | 'create' | 'inspect') {
    if (
      pending.current ||
      !target ||
      (operation === 'preview' && outcome) ||
      (operation === 'create' && (!review || !confirmed || outcome)) ||
      (operation === 'inspect' && (!review || outcome !== 'OUTCOME_UNKNOWN'))
    )
      return;
    if (!navigator.onLine) {
      setFailure(operation === 'inspect' ? 'inspectionFailed' : 'reviewFailed');
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setConfirmed(false);
    setFailure(undefined);
    if (operation === 'create') setOutcome('OUTCOME_UNKNOWN');
    if (operation === 'preview') setReview(undefined);
    try {
      const body =
        operation === 'preview'
          ? input
          : operation === 'create'
            ? { ...input, confirmed: true, reviewDigest: review?.reviewDigest }
            : { code: review?.code, reviewDigest: review?.reviewDigest };
      const value = await scheduleDraftRequest(
        connection,
        configuration,
        operation,
        body,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (operation === 'preview')
        setReview(
          parseScheduleDraftReview(value, input, target, configuration.enterpriseCode),
        );
      else if (review) {
        if (operation === 'create') {
          const saved = parseScheduleDraftReview(
            value,
            input,
            target,
            configuration.enterpriseCode,
          );
          if (saved.reviewDigest !== review.reviewDigest)
            throw new Error('Review changed');
        }
        const next = parseScheduleDraftReceipt(
          value,
          review,
          configuration.enterpriseCode,
        );
        setOutcome(next);
        if (next === 'SAVED_INACTIVE') onSaved?.();
      }
    } catch {
      if (!controller.signal.aborted && operation !== 'create')
        setFailure(operation === 'inspect' ? 'inspectionFailed' : 'reviewFailed');
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setBusy(false);
      }
    }
  }

  if (unavailable)
    return <Alert severity="warning">Schedule service unavailable.</Alert>;
  if (!copy || !capability) return null;
  return (
    <Stack component="section" spacing={2} sx={{ py: 2, minWidth: 0 }}>
      <Typography variant="h5">{copy.title}</Typography>
      {capability.targets.length === 0 ? (
        <Alert severity="info">{copy.empty}</Alert>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                md: 'repeat(2, minmax(0, 1fr))',
              },
              gap: 2,
            }}
          >
            <TextField
              label={copy.code}
              value={input.code}
              disabled={locked}
              onChange={(event) => change({ ...input, code: event.target.value })}
              slotProps={{ htmlInput: { maxLength: 128 } }}
            />
            <TextField
              label={copy.name}
              value={input.name}
              disabled={locked}
              onChange={(event) => change({ ...input, name: event.target.value })}
              slotProps={{ htmlInput: { maxLength: 160 } }}
            />
            <TextField
              select
              label={copy.target}
              value={input.targetCode}
              disabled={locked}
              onChange={(event) =>
                change({ ...input, targetCode: event.target.value, expression: '' })
              }
            >
              {capability.targets.map((item) => (
                <MenuItem
                  key={item.code}
                  value={item.code}
                  sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}
                >
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={copy.expression}
              value={input.expression}
              disabled={locked || !target}
              onChange={(event) => change({ ...input, expression: event.target.value })}
            >
              {(target?.expressions ?? []).map((expression) => (
                <MenuItem key={expression} value={expression}>
                  {expression}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Box>
            <Button
              startIcon={<ShellIcon name="search" />}
              disabled={
                locked || !input.code || !input.name.trim() || !input.expression
              }
              onClick={() => void send('preview')}
            >
              {copy.review}
            </Button>
          </Box>
          {review ? (
            <Stack
              spacing={1}
              sx={{
                borderLeft: 3,
                borderColor: 'divider',
                pl: 2,
                overflowWrap: 'anywhere',
              }}
            >
              <Typography variant="subtitle1">{review.name}</Typography>
              <Typography variant="body2">
                {copy.trigger}: {review.triggerCode}
              </Typography>
              <Typography variant="body2">
                {copy.node}: {review.runOnNode}
              </Typography>
              <Typography variant="body2">
                {copy.expression}: {review.expression}
              </Typography>
              <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                {copy.reference}: {review.reviewDigest}
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={confirmed}
                    disabled={locked}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                }
                label={copy.confirm}
              />
              <Box>
                <Button
                  variant="contained"
                  startIcon={<ShellIcon name="approve" />}
                  disabled={locked || !confirmed}
                  onClick={() => void send('create')}
                >
                  {copy.save}
                </Button>
              </Box>
            </Stack>
          ) : null}
        </>
      )}
      {failure ? <Alert severity="error">{copy[failure]}</Alert> : null}
      {outcome ? (
        <Alert severity={outcome === 'SAVED_INACTIVE' ? 'success' : 'warning'}>
          {outcome === 'SAVED_INACTIVE' ? copy.saved : copy.unknown}
        </Alert>
      ) : null}
      {outcome === 'OUTCOME_UNKNOWN' ? (
        <Box>
          <Button
            disabled={busy}
            startIcon={<ShellIcon name="search" />}
            onClick={() => void send('inspect')}
          >
            {copy.inspect}
          </Button>
        </Box>
      ) : null}
      {capability.lifecycle ? (
        <CronScheduleLifecyclePanel
          key={outcome === 'SAVED_INACTIVE' ? input.code : 'existing'}
          connection={connection}
          configuration={configuration}
          capability={capability.lifecycle}
          initialCode={outcome === 'SAVED_INACTIVE' ? input.code : ''}
          {...(onSaved ? { onChanged: onSaved } : {})}
        />
      ) : null}
    </Stack>
  );
}
