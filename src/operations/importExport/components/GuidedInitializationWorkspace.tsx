import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
  alpha,
} from '@mui/material';

import type { InitializationProfile } from '../api/dataReleaseContracts';
import {
  isInstallableStatus,
  typeCopy,
  type ImportExportArea,
} from '../importExportPresentation';

interface Props {
  readonly profiles: readonly InitializationProfile[];
  readonly isLoading: boolean;
  readonly errorMessage?: string | undefined;
  readonly operationError?:
    | { readonly profileKey: string; readonly message: string }
    | undefined;
  readonly operationPendingKey?: string | undefined;
  readonly operationPendingMode?: 'validate' | 'install' | undefined;
  readonly successMessage?:
    | { readonly profileKey: string; readonly message: string }
    | undefined;
  readonly onRun: (
    profile: InitializationProfile,
    mode: 'validate' | 'install',
  ) => void;
  readonly onOpenArea?: ((area: ImportExportArea) => void) | undefined;
}

function profileKey(profile: InitializationProfile): string {
  return `${profile.destinationRole ?? 'DEFAULT'}:${profile.profileCode}`;
}

function profileRequiresAction(profile: InitializationProfile): boolean {
  if (profile.status !== 'CURRENT') return true;
  return profile.steps
    .flatMap((step) => step.releases)
    .some((release) => isInstallableStatus(release.status));
}

function compareProfiles(
  left: InitializationProfile,
  right: InitializationProfile,
): number {
  const leftIndex = left.moduleIndex;
  const rightIndex = right.moduleIndex;
  if (leftIndex || rightIndex) {
    if (!leftIndex) return 1;
    if (!rightIndex) return -1;
    const leftParts = leftIndex.split('.').map((value) => Number(value) || 0);
    const rightParts = rightIndex.split('.').map((value) => Number(value) || 0);
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
      const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
      if (difference !== 0) return difference;
    }
  }
  return left.label.localeCompare(right.label);
}

export function GuidedInitializationWorkspace(props: Props) {
  if (props.isLoading)
    return <Alert severity="info">Loading guided initialization profiles…</Alert>;
  if (props.errorMessage) return <Alert severity="error">{props.errorMessage}</Alert>;
  if (props.profiles.length === 0)
    return (
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography component="h2" variant="h6">
              No guided setup profile is available
            </Typography>
            <Typography color="text.secondary">
              Guided setup appears only when an active import runtime publishes a
              deterministic initialization profile. You can still review and install
              available release data from the data tabs.
            </Typography>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            }}
          >
            {[
              { area: 'init' as const, label: 'Initialization data' },
              { area: 'core' as const, label: 'Core data' },
              { area: 'sample' as const, label: 'Sample data' },
            ].map((item) => (
              <Button
                key={item.area}
                disabled={!props.onOpenArea}
                onClick={() => props.onOpenArea?.(item.area)}
                variant={item.area === 'init' ? 'contained' : 'outlined'}
              >
                {item.label}
              </Button>
            ))}
          </Box>
          <Alert severity="info" variant="outlined">
            If a guided profile is expected, confirm the Staged import service is active
            and its data-release configuration contains enabled initialization profiles.
          </Alert>
        </Stack>
      </Paper>
    );
  const groupedProfiles = [
    {
      id: 'needs-action',
      title: 'Needs action',
      help: 'Validate and initialize these profiles before dependent journeys can run.',
      profiles: [...props.profiles.filter(profileRequiresAction)].sort(compareProfiles),
      tone: 'warning',
    },
    {
      id: 'current',
      title: 'Already current',
      help: 'These profiles are installed at the available release version and shown for audit.',
      profiles: [
        ...props.profiles.filter((profile) => !profileRequiresAction(profile)),
      ].sort(compareProfiles),
      tone: 'success',
    },
  ].filter((group) => group.profiles.length > 0);

  const renderProfileCard = (profile: InitializationProfile) => {
    const key = profileKey(profile);
    const isPending = props.operationPendingKey === key;
    const installable = profile.steps
      .flatMap((step) => step.releases)
      .filter((release) => isInstallableStatus(release.status)).length;
    return (
      <Paper key={key} variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
          >
            <Typography component="h3" variant="h6">
              {profile.label}
            </Typography>
            <Chip
              label={profile.status.replaceAll('_', ' ')}
              size="small"
              color={
                profile.status === 'CURRENT'
                  ? 'success'
                  : profile.blocked
                    ? 'error'
                    : 'default'
              }
            />
            {profile.destinationRole ? (
              <Chip
                label={`Target ${profile.destinationRole}`}
                size="small"
                variant="outlined"
              />
            ) : null}
          </Stack>
          <Typography color="text.secondary">{profile.description}</Typography>
          {profile.steps.map((step) => (
            <Typography key={`${profile.profileCode}:${step.order}`} variant="body2">
              {step.order}. {typeCopy[step.dataType].label}: {step.releases.length}{' '}
              release(s),{' '}
              {step.releases.filter((release) => release.status === 'CURRENT').length}{' '}
              current
            </Typography>
          ))}
          {profile.status === 'CURRENT' ? (
            <Alert severity="success">{profile.completionMessage}</Alert>
          ) : null}
          {props.successMessage?.profileKey === key ? (
            <Alert severity="success">{props.successMessage.message}</Alert>
          ) : null}
          {props.operationError?.profileKey === key ? (
            <Alert severity="error">{props.operationError.message}</Alert>
          ) : null}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              disabled={isPending || profile.blocked}
              onClick={() => props.onRun(profile, 'validate')}
              variant="outlined"
            >
              {isPending && props.operationPendingMode === 'validate'
                ? 'Validating...'
                : 'Validate plan'}
            </Button>
            <Button
              disabled={isPending || profile.blocked || installable === 0}
              onClick={() => props.onRun(profile, 'install')}
              variant="contained"
            >
              {isPending && props.operationPendingMode === 'install'
                ? 'Initializing...'
                : 'Validate and initialize'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    );
  };

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Profiles are defined by the backend. Nodics validates immutable releases and
        executes their steps in the declared order.
      </Alert>
      {groupedProfiles.map((group) => (
        <Paper
          key={group.id}
          component="section"
          variant="outlined"
          sx={(theme) => ({
            borderColor:
              group.tone === 'warning'
                ? alpha(theme.palette.warning.main, 0.35)
                : alpha(theme.palette.success.main, 0.3),
            overflow: 'hidden',
          })}
        >
          <Stack spacing={1.5} sx={{ p: { xs: 1.5, md: 2 } }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              sx={{
                alignItems: { sm: 'center' },
                gap: 1,
                justifyContent: 'space-between',
              }}
            >
              <Stack
                direction="row"
                sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
              >
                <Typography component="h2" variant="h6">
                  {group.title}
                </Typography>
                <Chip
                  label={`${group.profiles.length} profile${group.profiles.length === 1 ? '' : 's'}`}
                  size="small"
                  color={group.tone === 'success' ? 'success' : 'warning'}
                />
              </Stack>
              <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
                {group.help}
              </Typography>
            </Stack>
            <Stack spacing={1.25}>{group.profiles.map(renderProfileCard)}</Stack>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}
