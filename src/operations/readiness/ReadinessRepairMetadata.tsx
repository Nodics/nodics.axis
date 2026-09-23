import { Chip, Stack, Typography } from '@mui/material';
import type { ReactElement } from 'react';

export interface ReadinessRepairAction {
  readonly available: boolean;
  readonly label: string;
  readonly operation: string;
  readonly action: string;
  readonly idempotent: boolean;
  readonly requiresConfirmation: boolean;
  readonly eligibility?: string | undefined;
  readonly unavailableReason?: string | undefined;
}

export interface ReadinessRuntimeDiagnostic {
  readonly phase?: string | undefined;
  readonly sourceServer?: string | undefined;
  readonly sourceRuntimeRole?: string | undefined;
  readonly targetModule?: string | undefined;
  readonly targetConnection?: string | undefined;
  readonly targetServer?: string | undefined;
  readonly targetRuntimeRole?: string | undefined;
  readonly failureCode?: string | undefined;
  readonly suggestedAction?: string | undefined;
}

interface ReadinessRepairMetadataProps {
  readonly repair?: ReadinessRepairAction | undefined;
  readonly runtimeDiagnostic?: ReadinessRuntimeDiagnostic | undefined;
}

export function ReadinessRepairMetadata({
  repair,
  runtimeDiagnostic,
}: ReadinessRepairMetadataProps): ReactElement | null {
  if (!repair && !runtimeDiagnostic) return null;
  return (
    <Stack
      spacing={0.75}
      sx={{ mt: 0.75 }}
    >
      {repair ? (
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
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
            {repair.eligibility ? ` · ${repair.eligibility}` : ''}
            {repair.idempotent ? ' · idempotent' : ''}
            {repair.requiresConfirmation ? ' · confirmation required' : ''}
            {repair.unavailableReason ? ` · ${repair.unavailableReason}` : ''}
          </Typography>
        </Stack>
      ) : null}
      {runtimeDiagnostic ? (
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <Chip
            color="warning"
            label={`Runtime ${runtimeDiagnostic.phase ?? 'diagnostic'}`}
            size="small"
            variant="outlined"
          />
          <Typography
            color="text.secondary"
            sx={{ overflowWrap: 'anywhere' }}
            variant="caption"
          >
            {[
              runtimeDiagnostic.sourceServer
                ? `from ${runtimeDiagnostic.sourceServer}`
                : undefined,
              runtimeDiagnostic.sourceRuntimeRole,
              runtimeDiagnostic.targetModule
                ? `to ${runtimeDiagnostic.targetModule}`
                : undefined,
              runtimeDiagnostic.targetServer,
              runtimeDiagnostic.targetRuntimeRole,
              runtimeDiagnostic.failureCode,
            ]
              .filter(Boolean)
              .join(' · ')}
            {runtimeDiagnostic.suggestedAction
              ? ` · Fix: ${runtimeDiagnostic.suggestedAction}`
              : ''}
          </Typography>
        </Stack>
      ) : null}
    </Stack>
  );
}
