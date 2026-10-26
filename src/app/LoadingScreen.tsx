import { Box, CircularProgress, Stack, Typography } from '@mui/material';

import { AxisMark } from './shell/AxisMark';

/** Generic startup phase only; the backend retains all readiness and access decisions. */
export function LoadingScreen({
  label = 'Loading Axis configuration',
}: {
  readonly label?: string;
}) {
  return (
    <Box
      component="main"
      sx={{
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'center',
        minHeight: '100dvh',
      }}
    >
      <Stack spacing={2} sx={{ alignItems: 'center' }}>
        <AxisMark />
        <CircularProgress aria-label={label} />
        <Typography color="text.secondary" role="status">
          {label}
        </Typography>
      </Stack>
    </Box>
  );
}
