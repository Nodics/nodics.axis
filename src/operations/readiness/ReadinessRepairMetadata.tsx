import { Button, Chip, Stack, Typography } from '@mui/material';
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

export interface ReadinessApprovalDiagnostic {
  readonly source?: string | undefined;
  readonly status?: string | undefined;
  readonly publicationState?: string | undefined;
  readonly message?: string | undefined;
  readonly suggestedAction?: string | undefined;
}

interface ReadinessRepairMetadataProps {
  readonly approvalDiagnostic?: ReadinessApprovalDiagnostic | undefined;
  readonly repair?: ReadinessRepairAction | undefined;
  readonly runtimeDiagnostic?: ReadinessRuntimeDiagnostic | undefined;
}

interface RepairOwnerRoute {
  readonly label: string;
  readonly path: string;
}

function textMatches(value: string, pattern: RegExp): boolean {
  return pattern.test(value.toLowerCase());
}

function repairOwnerRoute(
  repair: ReadinessRepairAction | undefined,
  runtimeDiagnostic: ReadinessRuntimeDiagnostic | undefined,
  approvalDiagnostic: ReadinessApprovalDiagnostic | undefined,
): RepairOwnerRoute | undefined {
  const haystack = [
    repair?.operation,
    repair?.action,
    repair?.eligibility,
    repair?.unavailableReason,
    runtimeDiagnostic?.phase,
    runtimeDiagnostic?.targetModule,
    runtimeDiagnostic?.targetConnection,
    runtimeDiagnostic?.targetServer,
    runtimeDiagnostic?.targetRuntimeRole,
    runtimeDiagnostic?.failureCode,
    runtimeDiagnostic?.suggestedAction,
    approvalDiagnostic?.source,
    approvalDiagnostic?.status,
    approvalDiagnostic?.publicationState,
    approvalDiagnostic?.message,
    approvalDiagnostic?.suggestedAction,
  ]
    .filter(Boolean)
    .join(' ');

  if (!haystack) return undefined;
  if (textMatches(haystack, /applicationinitialization|publication|publish/)) {
    return { label: 'Open Publishing', path: '/publishing' };
  }
  if (textMatches(haystack, /approval|process|workflow|human task|task_reference/)) {
    return { label: 'Open Process', path: '/process' };
  }
  if (textMatches(haystack, /datarelease|import|export|manifest|catalogue/)) {
    return { label: 'Open Data Releases', path: '/operations/imports-exports' };
  }
  if (textMatches(haystack, /media|asset image|image source/)) {
    return { label: 'Open Media', path: '/media' };
  }
  if (textMatches(haystack, /configuration|credential|secret|property/)) {
    return { label: 'Open Runtime Configuration', path: '/configuration' };
  }
  if (
    textMatches(haystack, /moduleregistry|module registry|dependency|runtime|server/)
  ) {
    return { label: 'Open Module Registry', path: '/registry' };
  }
  return undefined;
}

export function ReadinessRepairMetadata({
  approvalDiagnostic,
  repair,
  runtimeDiagnostic,
}: ReadinessRepairMetadataProps): ReactElement | null {
  if (!repair && !runtimeDiagnostic && !approvalDiagnostic) return null;
  const ownerRoute = repairOwnerRoute(repair, runtimeDiagnostic, approvalDiagnostic);
  return (
    <Stack
      spacing={0.75}
      sx={{ mt: 0.75 }}
    >
      {ownerRoute ? (
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <Chip label="Owner workspace" size="small" variant="outlined" />
          <Button href={ownerRoute.path} size="small" variant="text">
            {ownerRoute.label}
          </Button>
        </Stack>
      ) : null}
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
