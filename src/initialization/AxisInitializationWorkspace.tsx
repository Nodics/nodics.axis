import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';

import type { AxisInitializationStatus } from './axisInitializationClient';

interface AxisInitializationWorkspaceProps {
  readonly busy: boolean;
  readonly error?: string | undefined;
  readonly status?: AxisInitializationStatus | undefined;
  readonly onInitiate: () => void;
  readonly onRefresh: () => void;
  readonly onLogout: () => void;
}

/** Renders the bundled recovery workspace until the CMS-driven Axis site has an Online receipt. */
export function AxisInitializationWorkspace(props: AxisInitializationWorkspaceProps) {
  const canInitiate =
    props.status?.readiness === 'NOT_IMPORTED' ||
    props.status?.readiness === 'IMPORTED' ||
    props.status?.readiness === 'FAILED';
  return (
    <Box
      component="main"
      sx={{
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'center',
        minHeight: '100vh',
        p: 2,
      }}
    >
      <Paper sx={{ maxWidth: 720, p: 4, width: '100%' }}>
        <Stack spacing={3}>
          <Box>
            <Typography component="h1" variant="h4">
              Initialize Axis
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Axis is using its bundled recovery workspace until the managed CMS
              baseline is approved and Online.
            </Typography>
          </Box>
          {props.status ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Chip
                label={props.status.readiness}
                color={props.status.readiness === 'READY' ? 'success' : 'warning'}
              />
              <Chip
                label={`${props.status.releaseCode} ${props.status.releaseVersion}`}
                variant="outlined"
              />
              {props.status.publication ? (
                <Chip label={props.status.publication.state} variant="outlined" />
              ) : null}
            </Stack>
          ) : null}
          {props.error ? <Alert severity="error">{props.error}</Alert> : null}
          {props.status?.readiness === 'PUBLICATION_PENDING' ? (
            <Alert severity="info">
              The baseline is waiting for the normal Process approval and Online
              deployment. Refresh after completing the approval task.
            </Alert>
          ) : null}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {canInitiate ? (
              <Button
                disabled={props.busy}
                onClick={props.onInitiate}
                variant="contained"
              >
                {props.status?.readiness === 'FAILED'
                  ? 'Retry validation'
                  : 'Initialize and submit'}
              </Button>
            ) : null}
            <Button disabled={props.busy} onClick={props.onRefresh} variant="outlined">
              Refresh status
            </Button>
            <Button disabled={props.busy} onClick={props.onLogout} variant="text">
              Sign out
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
