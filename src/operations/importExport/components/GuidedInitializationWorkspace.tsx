import { Alert, Button, Chip, Paper, Stack, Typography } from '@mui/material';

import type { InitializationProfile } from '../api/dataReleaseContracts';
import { isInstallableStatus, typeCopy } from '../importExportPresentation';

interface Props {
  readonly profiles: readonly InitializationProfile[];
  readonly isLoading: boolean;
  readonly errorMessage?: string | undefined;
  readonly operationError?: string | undefined;
  readonly operationPending: boolean;
  readonly successMessage?: string | undefined;
  readonly onRun: (profileCode: string, mode: 'validate' | 'install') => void;
}

export function GuidedInitializationWorkspace(props: Props) {
  if (props.isLoading) return <Alert severity="info">Loading guided initialization profiles…</Alert>;
  if (props.errorMessage) return <Alert severity="error">{props.errorMessage}</Alert>;
  if (props.profiles.length === 0) return <Alert severity="info">No initialization profile is configured for this runtime.</Alert>;
  return (
    <Stack spacing={2}>
      <Alert severity="info">Profiles are defined by the backend. Nodics validates immutable releases and executes their steps in the declared order.</Alert>
      {props.successMessage ? <Alert severity="success">{props.successMessage}</Alert> : null}
      {props.operationError ? <Alert severity="error">{props.operationError}</Alert> : null}
      {props.profiles.map((profile) => {
        const installable = profile.steps.flatMap((step) => step.releases).filter((release) => isInstallableStatus(release.status)).length;
        return (
          <Paper key={profile.profileCode} variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography component="h2" variant="h6">{profile.label}</Typography>
                <Chip label={profile.status.replaceAll('_', ' ')} size="small" color={profile.status === 'CURRENT' ? 'success' : profile.blocked ? 'error' : 'default'} />
                {profile.destinationRole ? <Chip label={`Target ${profile.destinationRole}`} size="small" variant="outlined" /> : null}
              </Stack>
              <Typography color="text.secondary">{profile.description}</Typography>
              {profile.steps.map((step) => (
                <Typography key={`${profile.profileCode}:${step.order}`} variant="body2">
                  {step.order}. {typeCopy[step.dataType].label}: {step.releases.length} release(s), {step.releases.filter((release) => release.status === 'CURRENT').length} current
                </Typography>
              ))}
              {profile.status === 'CURRENT' ? <Alert severity="success">{profile.completionMessage}</Alert> : null}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button disabled={props.operationPending || profile.blocked} onClick={() => props.onRun(profile.profileCode, 'validate')} variant="outlined">Validate plan</Button>
                <Button disabled={props.operationPending || profile.blocked || installable === 0} onClick={() => props.onRun(profile.profileCode, 'install')} variant="contained">{props.operationPending ? 'Working…' : 'Validate and initialize'}</Button>
              </Stack>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
