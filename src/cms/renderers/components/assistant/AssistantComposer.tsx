import { Button, Stack, TextField } from '@mui/material';
import { useState, type FormEvent, type KeyboardEvent } from 'react';

import type { AssistantPresentationStatus } from '../../../../assistant/presentation/assistantPresentationContracts';

interface AssistantComposerProps {
  readonly inputPlaceholder: string;
  readonly submitLabel: string;
  readonly stopLabel: string;
  readonly status: AssistantPresentationStatus;
  readonly connected: boolean;
  readonly onSubmit: (message: string) => Promise<void>;
  readonly onCancel: () => Promise<void>;
}

export function AssistantComposer(props: AssistantComposerProps) {
  const [message, setMessage] = useState('');
  const active = ['CREATING_CONVERSATION', 'SUBMITTING', 'STREAMING'].includes(
    props.status,
  );
  const submit = () => {
    const value = message.trim();
    if (!value || active || !props.connected) return;
    setMessage('');
    void props.onSubmit(value);
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <Stack
      component="form"
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      sx={{
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 -10px 28px rgba(15, 23, 42, 0.04)',
        p: { xs: 1.5, md: 2.5 },
      }}
      onSubmit={onSubmit}
    >
      <TextField
        fullWidth
        multiline
        disabled={!props.connected || active}
        maxRows={6}
        minRows={2}
        placeholder={props.inputPlaceholder}
        value={message}
        slotProps={{
          htmlInput: { 'aria-label': props.inputPlaceholder },
          input: { sx: { borderRadius: 2.5 } },
        }}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <Stack direction={{ xs: 'row', sm: 'column' }} spacing={1}>
        <Button
          disabled={!props.connected || active || !message.trim()}
          type="submit"
          sx={{ borderRadius: 2, minHeight: 44 }}
          variant="contained"
        >
          {props.submitLabel}
        </Button>
        <Button
          disabled={!props.connected || props.status !== 'STREAMING'}
          sx={{ borderRadius: 2, minHeight: 44 }}
          variant="outlined"
          onClick={() => void props.onCancel()}
        >
          {props.stopLabel}
        </Button>
      </Stack>
    </Stack>
  );
}
