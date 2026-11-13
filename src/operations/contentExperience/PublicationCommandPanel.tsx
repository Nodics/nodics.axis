import { usePublishingGuidanceCopy } from './publishingGuidanceCopy';
import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import type {
  AxisModuleConnection,
  AxisNavigationLifecycleAction,
} from '../../bootstrap/publicBootstrap';
import type { ContentDesignerClientConfiguration } from './api/contentDesignerClient';
import {
  inspectPublication,
  type PublicationInspection,
} from './api/publicationInspectionClient';
import {
  executePublicationCommand,
  publicationCommandAvailable,
  qualifiedPublicationActions,
  samePublicationSource,
} from './api/publicationCommandClient';

interface Props {
  readonly source: AxisModuleConnection;
  readonly configuration: ContentDesignerClientConfiguration;
  readonly snapshot: PublicationInspection;
  readonly actions: readonly AxisNavigationLifecycleAction[];
  readonly readAvailable: boolean;
  readonly observationEpoch: number;
  readonly onBusy: (busy: boolean) => void;
  readonly onCompleted: (receipt: PublicationInspection) => void;
}
/** Explicit original-operation preparation and confirmation. The owner retains every permission, state, approval and target decision. */
export function PublicationCommandPanel(props: Props) {
  const { format: workflowText } = useAxisLocalization();
  const publicationText = usePublishingGuidanceCopy();
  const latest = useRef(props);
  latest.current = props;
  const active = useRef(true),
    inFlight = useRef(false);
  const [phase, setPhase] = useState<
    'idle' | 'reading' | 'prepared' | 'sending' | 'held' | 'completed'
  >('idle');
  const [prepared, setPrepared] = useState<{
    action: AxisNavigationLifecycleAction;
    snapshot: PublicationInspection;
  }>();
  const heldAt = useRef(props.observationEpoch);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string>();
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      latest.current.onBusy(false);
    };
  }, []);
  const available = qualifiedPublicationActions(props.actions, props.snapshot);
  const stillPrepared = Boolean(
    prepared &&
    props.readAvailable &&
    props.snapshot.revision === prepared.snapshot.revision &&
    props.snapshot.state === prepared.snapshot.state &&
    samePublicationSource(props.snapshot, prepared.snapshot) &&
    available.some(
      (action) =>
        action.id === prepared.action.id &&
        publicationCommandAvailable(action, props.snapshot),
    ),
  );
  const prepare = async (action: AxisNavigationLifecycleAction) => {
    if (
      inFlight.current ||
      !latest.current.readAvailable ||
      !qualifiedPublicationActions(
        latest.current.actions,
        latest.current.snapshot,
      ).some((candidate) => candidate.id === action.id)
    )
      return;
    inFlight.current = true;
    props.onBusy(true);
    setPhase('reading');
    setMessage(undefined);
    setPrepared(undefined);
    const original = props.snapshot;
    try {
      const read = await inspectPublication(
        props.source,
        props.configuration,
        original.code,
      );
      if (!active.current) return;
      const current = latest.current;
      if (
        !current.readAvailable ||
        !samePublicationSource(original, read) ||
        original.revision !== read.revision ||
        original.state !== read.state ||
        current.snapshot.revision !== original.revision ||
        current.snapshot.state !== original.state ||
        !samePublicationSource(current.snapshot, original) ||
        !qualifiedPublicationActions(current.actions, read).some(
          (candidate) =>
            candidate.id === action.id && publicationCommandAvailable(candidate, read),
        )
      )
        throw new Error(
          'The request or its permitted operation changed. Refresh request evidence before preparing again.',
        );
      setPrepared({ action, snapshot: read });
      setPhase('prepared');
    } catch (error) {
      if (active.current) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Preparation is unavailable. Refresh request evidence.',
        );
        heldAt.current = latest.current.observationEpoch;
        setPhase('held');
      }
    } finally {
      inFlight.current = false;
      if (active.current) latest.current.onBusy(false);
    }
  };
  const confirm = async () => {
    if (inFlight.current || phase !== 'prepared' || !prepared || !stillPrepared) return;
    const current = latest.current;
    const action = qualifiedPublicationActions(current.actions, current.snapshot).find(
      (candidate) =>
        candidate.id === prepared.action.id &&
        publicationCommandAvailable(candidate, prepared.snapshot),
    );
    if (!action || !current.readAvailable) return;
    inFlight.current = true;
    current.onBusy(true);
    setPhase('sending');
    setMessage(undefined);
    try {
      const receipt = await executePublicationCommand(
        current.source,
        current.configuration,
        action,
        prepared.snapshot,
        reason,
      );
      if (!active.current) return;
      if (
        !latest.current.readAvailable ||
        !samePublicationSource(latest.current.snapshot, prepared.snapshot) ||
        !qualifiedPublicationActions(latest.current.actions, prepared.snapshot).some(
          (candidate) => candidate.id === action.id,
        )
      ) {
        throw new Error(
          'Access or request evidence changed while the operation was pending. Inspect the original request before continuing.',
        );
      }
      setPhase('completed');
      setMessage(
        receipt.state === 'VALIDATED'
          ? 'The original request was revalidated. Continue normal review and publishing from its source workspace.'
          : `The owner acknowledged ${receipt.state.replaceAll('_', ' ').toLowerCase()}. Verify current delivery from the source workspace and website.`,
      );
      latest.current.onCompleted(receipt);
    } catch (error) {
      if (active.current) {
        heldAt.current = latest.current.observationEpoch;
        setPhase('held');
        setMessage(
          error instanceof Error
            ? error.message
            : 'The response is unverified. Inspect the original request before another operation.',
        );
      }
    } finally {
      inFlight.current = false;
      if (active.current) latest.current.onBusy(false);
    }
  };
  return (
    <Stack spacing={1.5}>
      {props.snapshot.operatorGuidance &&
      phase !== 'prepared' &&
      phase !== 'sending' ? (
        <Typography color="text.secondary">
          {publicationText(props.snapshot.operatorGuidance)}
        </Typography>
      ) : null}
      {message ? (
        <Alert severity={phase === 'completed' ? 'success' : 'warning'}>
          {message}
        </Alert>
      ) : null}
      {phase === 'held' ? (
        <Alert severity="info">
          {workflowText(
            'publishing.ui.no-operation-will-be-replayed-refresh-request-evidence-inspect-the-recor',
            'No operation will be replayed. Refresh request evidence, inspect the recorded outcome, then explicitly prepare a permitted operation.',
          )}
        </Alert>
      ) : null}
      {phase === 'prepared' || phase === 'sending' ? (
        <Paper component="section" variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Typography component="h3" variant="h6">
              {prepared?.action.label}
            </Typography>
            <Typography sx={{ overflowWrap: 'anywhere' }}>
              {prepared?.snapshot.code}
            </Typography>
            <Typography variant="body2">
              {prepared?.snapshot.state}{' '}
              {workflowText(
                'publishing.ui.publication-revision',
                '· Publication revision',
              )}{' '}
              {prepared?.snapshot.revision}{' '}
              {workflowText('publishing.ui.source-version', '· Source version')}{' '}
              {prepared?.snapshot.sourceVersion}
            </Typography>
            <Typography>{prepared?.snapshot.operatorGuidance}</Typography>
            {prepared?.action.id === 'rollback' ? (
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" color="text.secondary">
                  {workflowText(
                    'publishing.ui.retained-predecessor-to-restore',
                    'Retained predecessor to restore',
                  )}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ overflowWrap: 'anywhere', maxHeight: 120, overflow: 'auto' }}
                >
                  {prepared.snapshot.previousOnlineVersion}
                </Typography>
              </Box>
            ) : null}
            <TextField
              label={workflowText('publishing.ui.reason-optional', 'Reason (optional)')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={phase === 'sending'}
              multiline
              maxRows={4}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />
            {!stillPrepared && phase !== 'sending' ? (
              <Alert severity="warning">
                {workflowText(
                  'publishing.ui.request-evidence-or-access-changed-cancel-and-refresh-before-continuing',
                  'Request evidence or access changed. Cancel and refresh before continuing.',
                )}
              </Alert>
            ) : null}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color={prepared?.action.id === 'rollback' ? 'warning' : 'primary'}
                disabled={phase === 'sending' || !stillPrepared}
                onClick={() => void confirm()}
              >
                {phase === 'sending'
                  ? workflowText(
                      'publishing.ui.waiting-for-owner-confirmation',
                      'Waiting for owner confirmation…',
                    )
                  : prepared?.action.id === 'rollback'
                    ? workflowText(
                        'publishing.ui.confirm-restoration',
                        'Confirm restoration',
                      )
                    : prepared?.action.id === 'withdraw'
                      ? workflowText(
                          'publishing.ui.confirm-withdrawal',
                          'Confirm withdrawal',
                        )
                      : workflowText('publishing.ui.confirm-retry', 'Confirm retry')}
              </Button>
              <Button
                disabled={phase === 'sending'}
                onClick={() => {
                  setPrepared(undefined);
                  setPhase('idle');
                  setMessage(undefined);
                }}
              >
                {workflowText('publishing.ui.cancel-preparation', 'Cancel preparation')}
              </Button>
            </Box>
          </Stack>
        </Paper>
      ) : phase !== 'completed' && phase !== 'held' ? (
        <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap' }}>
          {available.map((action) => (
            <Button
              key={action.id}
              variant="outlined"
              disabled={phase === 'reading' || !props.readAvailable}
              onClick={() => void prepare(action)}
            >
              {phase === 'reading'
                ? workflowText(
                    'publishing.ui.inspecting-original-request',
                    'Inspecting original request…',
                  )
                : action.label}
            </Button>
          ))}
        </Stack>
      ) : null}
      {phase === 'held' ? (
        <Button
          disabled={!props.readAvailable || props.observationEpoch <= heldAt.current}
          onClick={() => {
            if (
              !latest.current.readAvailable ||
              latest.current.observationEpoch <= heldAt.current
            )
              return;
            setPhase('idle');
            setPrepared(undefined);
            setMessage(undefined);
          }}
        >
          {workflowText(
            'publishing.ui.prepare-from-refreshed-evidence',
            'Prepare from refreshed evidence',
          )}
        </Button>
      ) : null}
    </Stack>
  );
}
