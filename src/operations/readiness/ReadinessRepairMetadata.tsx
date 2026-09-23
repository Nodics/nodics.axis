import { Chip, Stack, Typography } from '@mui/material';
import type { ReactElement } from 'react';

export interface ReadinessRepairAction {
  readonly available: boolean;
  readonly label: string;
  readonly operation: string;
  readonly action: string;
  readonly idempotent: boolean;
  readonly requiresConfirmation: boolean;
}

interface ReadinessRepairMetadataProps {
  readonly repair?: ReadinessRepairAction | undefined;
}

export function ReadinessRepairMetadata({
  repair,
}: ReadinessRepairMetadataProps): ReactElement | null {
  if (!repair) return null;
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ alignItems: 'center', flexWrap: 'wrap', mt: 0.75 }}
    >
      <Chip
        color={repair.available ? 'success' : 'default'}
        label={repair.available ? 'Repair available' : 'Repair unavailable'}
        size="small"
        variant="outlined"
      />
      <Typography
        color="text.secondary"
        sx={{ overflowWrap: 'anywhere' }}
        variant="caption"
      >
        {repair.action} · {repair.operation}
        {repair.idempotent ? ' · idempotent' : ''}
        {repair.requiresConfirmation ? ' · confirmation required' : ''}
      </Typography>
    </Stack>
  );
}
