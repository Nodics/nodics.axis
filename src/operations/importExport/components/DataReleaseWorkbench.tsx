import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
  alpha,
} from '@mui/material';

import type { DataRelease, DataReleaseType } from '../api/dataReleaseContracts';
import {
  releaseDisabledReason,
  releaseKey,
  typeCopy,
} from '../importExportPresentation';

export interface DataReleaseSummary {
  readonly current: number;
  readonly installable: number;
  readonly selected: number;
  readonly total: number;
}

interface DataReleaseWorkbenchProps {
  readonly catalogueErrorMessage: string | undefined;
  readonly catalogueIsError: boolean;
  readonly catalogueIsLoading: boolean;
  readonly catalogueIsSuccess: boolean;
  readonly connectionAvailable: boolean;
  readonly executableReleaseCount: number;
  readonly hasOnlyCurrentSelection: boolean;
  readonly operationErrorMessage: string | undefined;
  readonly operationIsError: boolean;
  readonly operationIsPending: boolean;
  readonly operationIsSuccess: boolean;
  readonly releaseType: DataReleaseType;
  readonly selectedReleaseCount: number;
  readonly selectedReleaseKeys: ReadonlySet<string>;
  readonly successMessage: string;
  readonly summary: DataReleaseSummary;
  readonly visibleReleases: readonly DataRelease[];
  readonly onInstallSelected: () => void;
  readonly onToggleRelease: (release: DataRelease) => void;
  readonly onValidateSelected: () => void;
}

export function DataReleaseWorkbench(props: DataReleaseWorkbenchProps) {
  return (
    <>
      <Alert severity={props.releaseType === 'sample' ? 'warning' : 'info'}>
        <strong>{typeCopy[props.releaseType].label}.</strong>{' '}
        {typeCopy[props.releaseType].help} {typeCopy[props.releaseType].warning}
      </Alert>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ gap: 1 }}
        aria-label="Data release summary"
      >
        {(
          [
            ['Releases', props.summary.total],
            ['Current', props.summary.current],
            ['Needs action', props.summary.installable],
            ['Selected', props.summary.selected],
          ] satisfies ReadonlyArray<readonly [string, number]>
        ).map(([label, value]) => (
          <Paper
            key={label}
            elevation={0}
            sx={{
              bgcolor: 'background.default',
              border: 1,
              borderColor: 'divider',
              flex: 1,
              minWidth: { sm: 130 },
              px: 1.5,
              py: 1.1,
            }}
          >
            <Typography color="text.secondary" variant="caption">
              {label}
            </Typography>
            <Typography component="p" variant="h5">
              {value.toString()}
            </Typography>
          </Paper>
        ))}
      </Stack>

      {!props.connectionAvailable ? (
        <Alert severity="error">Import service is unavailable.</Alert>
      ) : null}
      {props.catalogueIsLoading ? (
        <Box sx={{ display: 'grid', minHeight: 240, placeItems: 'center' }}>
          <CircularProgress aria-label="Loading data releases" />
        </Box>
      ) : null}
      {props.catalogueIsError ? (
        <Alert severity="error">{props.catalogueErrorMessage}</Alert>
      ) : null}
      {props.catalogueIsSuccess && props.visibleReleases.length === 0 ? (
        <Alert severity="info">
          No active module publishes this data release type.
        </Alert>
      ) : null}

      {props.visibleReleases.length > 0 ? (
        <Paper
          variant="outlined"
          sx={{ bgcolor: 'background.paper', overflow: 'hidden' }}
        >
          {props.visibleReleases.map((release, index) => {
            const checked = props.selectedReleaseKeys.has(releaseKey(release));
            const disabledReason = releaseDisabledReason(release);
            return (
              <Box
                key={releaseKey(release)}
                sx={(theme) => ({
                  bgcolor: checked
                    ? alpha(theme.palette.primary.main, 0.06)
                    : 'background.paper',
                  transition: 'background-color 160ms ease, box-shadow 160ms ease',
                  '&:hover': {
                    bgcolor: checked
                      ? alpha(theme.palette.primary.main, 0.08)
                      : 'background.default',
                  },
                })}
              >
                {index > 0 ? <Divider /> : null}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  sx={{
                    alignItems: { sm: 'center' },
                    gap: { xs: 1, sm: 1.5 },
                    px: { xs: 1.25, md: 1.5 },
                    py: { xs: 1.2, md: 1.35 },
                  }}
                >
                  <Box sx={{ pt: { sm: 0.25 } }}>
                    <Checkbox
                      checked={checked}
                      disabled={release.status === 'RUNNING'}
                      slotProps={{
                        input: {
                          'aria-label': `Select ${release.displayName}`,
                        },
                      }}
                      sx={{ p: 0.5 }}
                      onChange={() => props.onToggleRelease(release)}
                    />
                  </Box>
                  <Stack sx={{ flex: 1 }} spacing={0.4}>
                    <Stack
                      direction="row"
                      sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
                    >
                      <Typography component="h2" variant="h6">
                        {release.displayName}
                      </Typography>
                      <Chip
                        label={release.status.replaceAll('_', ' ')}
                        size="small"
                        sx={{
                          bgcolor:
                            release.status === 'CURRENT'
                              ? 'success.light'
                              : 'background.default',
                        }}
                      />
                    </Stack>
                    <Typography color="text.secondary" sx={{ maxWidth: 900 }}>
                      {release.description}
                    </Typography>
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                      <Chip
                        label={`Available ${release.version}`}
                        size="small"
                        variant="outlined"
                      />
                      {release.installedVersion ? (
                        <Chip
                          label={`Installed ${release.installedVersion}`}
                          size="small"
                          variant="outlined"
                        />
                      ) : null}
                    </Stack>
                    {disabledReason ? (
                      <Typography color="text.secondary" variant="caption">
                        {disabledReason}
                      </Typography>
                    ) : null}
                  </Stack>
                </Stack>
              </Box>
            );
          })}
        </Paper>
      ) : null}

      <Divider sx={{ my: 0.5 }} />
      {props.hasOnlyCurrentSelection ? (
        <Alert severity="info">
          Selected releases are already current. You can validate their immutable
          manifest state, but there is nothing to install or update.
        </Alert>
      ) : null}
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
        <Button
          disabled={props.operationIsPending || props.selectedReleaseCount === 0}
          onClick={props.onValidateSelected}
          variant="outlined"
        >
          Validate selected
        </Button>
        <Button
          disabled={props.operationIsPending || props.executableReleaseCount === 0}
          onClick={props.onInstallSelected}
          variant="contained"
        >
          {props.operationIsPending ? 'Working…' : 'Install or update selected'}
        </Button>
      </Stack>
      {props.operationIsError ? (
        <Alert severity="error">{props.operationErrorMessage}</Alert>
      ) : null}
      {props.operationIsSuccess ? (
        <Alert severity="success">{props.successMessage}</Alert>
      ) : null}
    </>
  );
}
