/** @file Explicit provider probe using the owning API; no automatic network check or credential editing. */
import { useMutation } from '@tanstack/react-query';
import { Alert, Box, Button, Typography } from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import type { AssistantTransportConfiguration } from './api/assistantTransport';
import { checkProvider } from './api/copilotProviderClient';

/** Sends one user-triggered probe under the shared no-retry, no-offline-queue command policy. */
export function CopilotProviderCheck({
  configuration,
  label,
}: {
  readonly configuration: AssistantTransportConfiguration;
  readonly label: string;
}) {
  const check = useMutation({
    mutationFn: () => checkProvider(configuration),
  });
  return (
    <Box component="section" sx={{ mt: 2 }}>
      <Button
        startIcon={<ShellIcon name="refresh" />}
        disabled={check.isPending}
        onClick={() => check.mutate()}
      >
        {label}
      </Button>
      {check.isError ? (
        <Alert severity="warning">Connection check could not be completed.</Alert>
      ) : null}
      {!check.isPending && !check.isError && check.data ? (
        <Alert
          severity={check.data.state === 'UP' ? 'success' : 'warning'}
          sx={{ mt: 1 }}
        >
          <Typography variant="subtitle2">{check.data.title}</Typography>
          <Typography variant="body2">{check.data.message}</Typography>
          <Typography variant="caption">
            {new Date(check.data.observedAt).toLocaleString()}
          </Typography>
        </Alert>
      ) : null}
    </Box>
  );
}
