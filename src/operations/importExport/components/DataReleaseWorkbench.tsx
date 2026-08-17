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
  isInstallableStatus,
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
  readonly onDeselectVisible: () => void;
  readonly onInstallSelected: () => void;
  readonly onSelectVisible: () => void;
  readonly onToggleRelease: (release: DataRelease) => void;
  readonly onValidateSelected: () => void;
}

function releaseActionGroup(release: DataRelease): 'available' | 'current' | 'repair' {
  if (isInstallableStatus(release.status)) return 'available';
  if (release.status === 'CURRENT') return 'current';
  return 'repair';
}

function releaseSelectionLabel(release: DataRelease): string {
  if (isInstallableStatus(release.status)) return `Select ${release.displayName}`;
  if (release.status === 'CURRENT') return `${release.displayName} is already current`;
  if (release.status === 'INVALID_RELEASE') {
    return `${release.displayName} has an invalid release manifest`;
  }
  if (release.status === 'DOWNGRADE_AVAILABLE') {
    return `${release.displayName} cannot be downgraded from Axis`;
  }
  if (release.status === 'RUNNING') return `${release.displayName} import is running`;
  return `${release.displayName} cannot be selected`;
}

export function DataReleaseWorkbench(props: DataReleaseWorkbenchProps) {
  const selectableReleaseCount = props.visibleReleases.filter((release) =>
    isInstallableStatus(release.status),
  ).length;
  const selectedVisibleCount = props.visibleReleases.filter((release) =>
    props.selectedReleaseKeys.has(releaseKey(release)),
  ).length;
  const groupedReleases = [
    {
      heading: 'Available to install or update',
      help: 'These releases need action and can be selected for validation or installation.',
      releases: props.visibleReleases.filter(
        (release) => releaseActionGroup(release) === 'available',
      ),
      tone: 'default',
    },
    {
      heading: 'Requires repair',
      help: 'These releases are blocked by their manifest or runtime contract. Repair the owning module data release, rebuild, restart, and refresh this page.',
      releases: props.visibleReleases.filter(
        (release) => releaseActionGroup(release) === 'repair',
      ),
      tone: 'warning',
    },
    {
      heading: 'Installed / already current',
      help: 'These releases are already installed at the available version and are shown for audit only.',
      releases: props.visibleReleases.filter(
        (release) => releaseActionGroup(release) === 'current',
      ),
      tone: 'default',
    },
  ].filter((group) => group.releases.length > 0);

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
          sx={{
            bgcolor: 'background.paper',
            maxHeight: { xs: '58vh', md: 'calc(100vh - 360px)' },
            overflow: 'auto',
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            sx={{
              alignItems: { sm: 'center' },
              bgcolor: 'background.default',
              gap: 1,
              justifyContent: 'space-between',
              px: { xs: 1.25, md: 1.5 },
              py: 1,
            }}
          >
            <Typography color="text.secondary" variant="body2">
              {selectedVisibleCount} of {selectableReleaseCount} actionable release(s)
              selected
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Button
                disabled={
                  props.operationIsPending ||
                  selectableReleaseCount === 0 ||
                  selectedVisibleCount === selectableReleaseCount
                }
                onClick={props.onSelectVisible}
                size="small"
                variant="outlined"
              >
                Select all visible
              </Button>
              <Button
                disabled={props.operationIsPending || selectedVisibleCount === 0}
                onClick={props.onDeselectVisible}
                size="small"
                variant="text"
              >
                Deselect all visible
              </Button>
            </Stack>
          </Stack>
          <Divider />
          {groupedReleases.map((group, groupIndex) => (
            <Box key={group.heading}>
              {groupIndex > 0 ? <Divider /> : null}
              <Box
                sx={(theme) => ({
                  bgcolor:
                    group.tone === 'warning'
                      ? alpha(theme.palette.warning.main, 0.08)
                      : 'background.default',
                  px: { xs: 1.25, md: 1.5 },
                  py: 1,
                })}
              >
                <Typography component="h2" variant="subtitle1">
                  {group.heading}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {group.help}
                </Typography>
              </Box>
              {group.releases.map((release, index) => {
                const checked = props.selectedReleaseKeys.has(releaseKey(release));
                const disabledReason = releaseDisabledReason(release);
                const installedMatchesAvailable =
                  release.installedVersion === release.version;
                const selectable = isInstallableStatus(release.status);
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
                          disabled={!selectable}
                          slotProps={{
                            input: {
                              'aria-label': releaseSelectionLabel(release),
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
                          <Typography component="h3" variant="h6">
                            {release.displayName}
                          </Typography>
                          <Chip
                            label={release.status.replaceAll('_', ' ')}
                            size="small"
                            sx={{
                              bgcolor:
                                release.status === 'CURRENT'
                                  ? 'success.light'
                                  : release.status === 'INVALID_RELEASE'
                                    ? 'error.light'
                                    : 'background.default',
                            }}
                          />
                        </Stack>
                        <Typography color="text.secondary" sx={{ maxWidth: 900 }}>
                          {release.description}
                        </Typography>
                        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                          <Chip
                            label={
                              installedMatchesAvailable
                                ? `Version ${release.version}`
                                : `Available ${release.version}`
                            }
                            size="small"
                            variant="outlined"
                          />
                          {release.installedVersion && !installedMatchesAvailable ? (
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
            </Box>
          ))}
        </Paper>
      ) : null}

      <Paper
        aria-label={`${typeCopy[props.releaseType].label} action footer`}
        component="section"
        elevation={3}
        sx={(theme) => ({
          bgcolor: alpha(theme.palette.background.paper, 0.96),
          border: 1,
          borderColor: 'divider',
          bottom: 0,
          boxShadow: theme.shadows[4],
          mt: 1,
          position: 'sticky',
          px: { xs: 1.25, md: 1.5 },
          py: 1.25,
          zIndex: theme.zIndex.appBar - 1,
        })}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          sx={{
            alignItems: { md: 'center' },
            gap: 1.5,
            justifyContent: 'space-between',
          }}
        >
          <Typography color="text.secondary" variant="body2">
            {selectedVisibleCount} of {selectableReleaseCount} actionable release(s)
            selected
          </Typography>
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
        </Stack>
      </Paper>
      {props.operationIsError ? (
        <Alert severity="error">{props.operationErrorMessage}</Alert>
      ) : null}
      {props.operationIsSuccess ? (
        <Alert severity="success">{props.successMessage}</Alert>
      ) : null}
    </>
  );
}
