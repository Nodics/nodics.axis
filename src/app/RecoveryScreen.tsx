import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';

import { AxisMark } from './shell/AxisMark';
import {
  getRecoveryContent,
  getRecoveryDetailContent,
  type RecoveryState,
} from './recoveryState';

interface RecoveryScreenProps {
  readonly embedded?: boolean;
  readonly state: RecoveryState;
  readonly onRetry: () => void;
  readonly onSignOut?: (() => void) | undefined;
  readonly authenticationError?: string | undefined;
}

/** Generic unavailable-backend presentation; domain copy remains CMS-owned. */
export function RecoveryScreen({
  state,
  embedded = false,
  onRetry,
  onSignOut,
  authenticationError,
}: RecoveryScreenProps) {
  const content = getRecoveryContent(state.kind);
  const detail = getRecoveryDetailContent(state.kind, state.detail);

  return (
    <Box
      component={embedded ? 'div' : 'main'}
      sx={{
        alignItems: 'center',
        display: 'flex',
        minHeight: embedded ? '12rem' : '100dvh',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', p: 4 }}>
          <Stack spacing={3}>
            <AxisMark />
            <Stack direction="row" spacing={1}>
              <Chip
                color={state.reconnecting ? 'info' : 'warning'}
                label={state.reconnecting ? 'Connecting' : 'Recovery mode'}
                size="small"
              />
              <Chip label={content.eyebrow} size="small" variant="outlined" />
            </Stack>
            <Stack spacing={1.5}>
              <Typography component={embedded ? 'h2' : 'h1'} variant="h3">
                {state.reconnecting ? 'Connecting to your workspace' : content.title}
              </Typography>
              <Typography
                color="text.secondary"
                role={state.reconnecting ? 'status' : undefined}
              >
                {state.reconnecting
                  ? 'The server may still be starting. Axis will continue automatically when it is available.'
                  : content.description}
              </Typography>
              {state.reconnecting ? (
                <LinearProgress aria-label="Connecting to Axis" />
              ) : null}
            </Stack>
            {detail && !state.reconnecting ? (
              <Alert severity={state.kind === 'unauthorized' ? 'warning' : 'error'}>
                <Stack spacing={0.75}>
                  <Typography component="span">{detail.message}</Typography>
                  {detail.technicalDetail ? (
                    <Box component="details">
                      <Typography component="summary" variant="body2">
                        Technical details
                      </Typography>
                      <Typography
                        color="text.secondary"
                        component="span"
                        variant="body2"
                      >
                        {detail.technicalDetail}
                      </Typography>
                    </Box>
                  ) : null}
                </Stack>
              </Alert>
            ) : null}
            {state.correlationId ? (
              <Typography color="text.secondary" variant="body2">
                Support reference: <strong>{state.correlationId}</strong>
              </Typography>
            ) : null}
            {authenticationError ? (
              <Alert severity="warning">{authenticationError}</Alert>
            ) : null}
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={onRetry}>
                {state.retryable ? content.action : 'Return to workspace'}
              </Button>
              {onSignOut ? (
                <Button variant="outlined" onClick={onSignOut}>
                  Retry secure sign-out
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
