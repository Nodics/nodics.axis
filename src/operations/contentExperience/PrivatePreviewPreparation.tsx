/** Owner-declared private Staged preparation; an uncertain command is held for inspection and never automatically replayed. */
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import type { AxisModuleConnection } from '../../bootstrap/publicBootstrap';
import {
  privateWcmsPreviewPreparation,
  type WcmsExperienceClientConfiguration,
  type WcmsExperienceResolveRequest,
} from './api/wcmsExperienceClient';

export function PrivatePreviewPreparation({
  connection,
  configuration,
  context,
  onPrepared,
}: {
  readonly connection: AxisModuleConnection;
  readonly configuration: WcmsExperienceClientConfiguration;
  readonly context: WcmsExperienceResolveRequest;
  readonly onPrepared: () => void;
}) {
  const { format: workflowText } = useAxisLocalization();
  const { format } = useAxisLocalization();
  const [privateKey] = useState(() => crypto.randomUUID());
  const [held, setHeld] = useState(false),
    [confirm, setConfirm] = useState(false);
  const inFlight = useRef(false);
  const status = useQuery({
    queryKey: [
      'experience-private-preparation',
      privateKey,
      connection.instanceId,
      connection.endpoint,
      context,
    ],
    queryFn: () =>
      privateWcmsPreviewPreparation(connection, configuration, context, 'inspect'),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const command = useMutation({
    retry: false,
    mutationFn: (operation: 'prepare' | 'retire') =>
      privateWcmsPreviewPreparation(
        connection,
        configuration,
        context,
        operation,
        status.data,
      ),
    onSuccess: async (receipt) => {
      onPrepared();
      const current = await status.refetch();
      setHeld(
        current.isError ||
          current.data?.state === 'INSPECTION_REQUIRED' ||
          receipt.generation !== current.data?.generation ||
          receipt.revision !== current.data?.revision,
      );
      setConfirm(false);
    },
    onError: () => setHeld(true),
    onSettled: () => {
      inFlight.current = false;
    },
  });
  const execute = (operation: 'prepare' | 'retire') => {
    if (inFlight.current || !status.data || status.isFetching || status.isError) return;
    inFlight.current = true;
    setHeld(true);
    command.mutate(operation);
  };
  if (status.isPending)
    return (
      <Alert severity="info" role="status">
        {workflowText(
          'experience.ui.checking-private-preview-availability',
          'Checking private preview availability…',
        )}
      </Alert>
    );
  if (status.isError || !status.data)
    return (
      <Stack spacing={1}>
        <Alert severity="warning">
          {workflowText(
            'experience.ui.private-preview-availability-could-not-be-confirmed',
            'Private preview availability could not be confirmed.',
          )}
        </Alert>
        <Button disabled={status.isFetching} onClick={() => void status.refetch()}>
          {workflowText(
            'experience.ui.refresh-private-preview-availability',
            'Refresh private preview availability',
          )}
        </Button>
      </Stack>
    );
  const copy = status.data.presentation;
  const pending = status.data.state === 'INSPECTION_REQUIRED';
  return (
    <Stack spacing={1}>
      <Alert severity="info">{format('experience.private.notice', copy.notice)}</Alert>
      {status.data.state === 'READY' && !held ? (
        <Alert severity="success">
          {format('experience.private.ready', copy.ready)}
        </Alert>
      ) : null}
      {command.isPending ? (
        <Alert severity="info" role="status">
          {format(
            'experience.preparing',
            'Preparing the private preview. Keep this context open until the owner responds…',
          )}
        </Alert>
      ) : held || pending ? (
        <Alert severity="warning">
          {format('experience.private.uncertain', copy.uncertain)}
        </Alert>
      ) : null}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button
          variant="outlined"
          disabled={held || pending || command.isPending || status.isFetching}
          onClick={() => execute('prepare')}
        >
          {format('experience.private.prepare', copy.prepare)}
        </Button>
        <Button
          disabled={command.isPending || status.isFetching}
          onClick={() => {
            void status.refetch().then((current) => {
              if (current.data?.state === 'READY' && !current.isError) {
                setHeld(false);
                onPrepared();
              }
            });
          }}
        >
          {format('experience.private.inspect', copy.inspect)}
        </Button>
        {pending ? (
          <Button
            disabled={command.isPending || status.isFetching}
            onClick={() => setConfirm(true)}
          >
            {format('experience.private.retire', copy.retire)}
          </Button>
        ) : null}
      </Stack>
      <Dialog
        open={confirm}
        onClose={() => {
          if (!command.isPending) setConfirm(false);
        }}
      >
        <DialogTitle>
          {format('experience.private.retiretitle', copy.retireTitle)}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {format('experience.private.retiremessage', copy.retireMessage)}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={command.isPending} onClick={() => setConfirm(false)}>
            {format('experience.private.cancel', copy.cancel)}
          </Button>
          <Button
            disabled={command.isPending || status.isFetching || !pending}
            onClick={() => execute('retire')}
          >
            {format('experience.private.confirm', copy.confirm)}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
