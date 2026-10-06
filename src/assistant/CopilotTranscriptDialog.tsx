/** @file Explicit, purpose-bound transcript inspector. Content remains component-local and is discarded on close or identity change. */
import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import type { AssistantTransportConfiguration } from './api/assistantTransport';
import {
  inspectTranscript,
  type CopilotTranscript,
  type TranscriptInspection,
} from './api/copilotTranscriptClient';

/** Owns a short-lived sensitive read; neither mutation cache nor browser storage retains returned content. */
export function CopilotTranscriptDialog({
  configuration,
  conversationCode,
  principalCode,
  inspection,
  onClose,
}: {
  readonly configuration: AssistantTransportConfiguration;
  readonly conversationCode: string;
  readonly principalCode: string;
  readonly inspection: TranscriptInspection;
  readonly onClose: () => void;
}) {
  const copy = inspection.presentation;
  const [purpose, setPurpose] = useState('');
  const [content, setContent] = useState<CopilotTranscript>();
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const read = useMutation({
    gcTime: 0,
    mutationFn: async (page: number) => {
      const controller = new AbortController();
      active.current = controller;
      const result = await inspectTranscript(
        configuration,
        conversationCode,
        purpose,
        page,
        controller.signal,
      );
      if (result.principalCode !== principalCode)
        throw new Error('Transcript principal mismatch');
      if (!controller.signal.aborted) setContent(result);
      // Do not return content into the shared mutation cache.
    },
  });
  const inspect = (page: number) => {
    setContent(undefined);
    read.mutate(page);
  };
  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="md"
      aria-labelledby="transcript-title"
    >
      <DialogTitle id="transcript-title" sx={{ pr: 7, fontSize: '1.25rem' }}>
        {copy.title}
        <Tooltip title={copy.close}>
          <IconButton
            aria-label={copy.close}
            onClick={onClose}
            sx={{ position: 'absolute', right: 12, top: 12 }}
          >
            <ShellIcon name="close" />
          </IconButton>
        </Tooltip>
      </DialogTitle>
      <DialogContent dividers sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere', mb: 2 }}>
          {conversationCode}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
          <TextField
            select
            fullWidth
            size="small"
            label={copy.purpose}
            value={purpose}
            disabled={read.isPending}
            onChange={(event) => {
              setPurpose(event.target.value);
              setContent(undefined);
              read.reset();
            }}
          >
            {inspection.purposes.map((option) => (
              <MenuItem key={option.code} value={option.code}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            disabled={!purpose || read.isPending}
            onClick={() => inspect(1)}
          >
            {copy.inspect}
          </Button>
        </Stack>
        {read.isError ? <Alert severity="warning">{copy.failure}</Alert> : null}
        {read.isPending ? (
          <Box
            role="progressbar"
            aria-label={copy.inspect}
            sx={{ height: 4, bgcolor: 'action.selected' }}
          />
        ) : null}
        {content ? (
          <>
            <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
              {copy.audit}: {content.accessReceipt}
            </Typography>
            {!content.items.length ? (
              <Typography role="status">{copy.empty}</Typography>
            ) : null}
            <Stack divider={<Divider />}>
              {content.items.map((turn) => (
                <Box key={turn.turnCode} sx={{ py: 2 }}>
                  {!turn.recorded ? (
                    <Typography color="text.secondary">{copy.unrecorded}</Typography>
                  ) : null}
                  {turn.recorded && !turn.messages.length ? (
                    <Typography color="text.secondary">{copy.empty}</Typography>
                  ) : null}
                  {turn.messages.map((message, index) => (
                    <Box key={`${message.sequence}-${index}`} sx={{ mb: 2 }}>
                      <Typography
                        variant="subtitle2"
                        color={
                          message.role === 'user' ? 'text.secondary' : 'primary.main'
                        }
                      >
                        {copy[message.role]}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                      >
                        {message.content}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ))}
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              sx={{ justifyContent: 'flex-end', alignItems: 'center' }}
            >
              <Tooltip title={copy.previous}>
                <span>
                  <IconButton
                    aria-label={copy.previous}
                    disabled={content.page <= 1 || read.isPending}
                    onClick={() => inspect(content.page - 1)}
                  >
                    <ShellIcon name="chevron-left" />
                  </IconButton>
                </span>
              </Tooltip>
              <Typography variant="body2">
                {copy.page} {content.page}
              </Typography>
              <Tooltip title={copy.next}>
                <span>
                  <IconButton
                    aria-label={copy.next}
                    disabled={
                      !content.mayHaveMore || content.page >= 1000 || read.isPending
                    }
                    onClick={() => inspect(content.page + 1)}
                  >
                    <ShellIcon name="chevron-right" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{copy.close}</Button>
      </DialogActions>
    </Dialog>
  );
}
