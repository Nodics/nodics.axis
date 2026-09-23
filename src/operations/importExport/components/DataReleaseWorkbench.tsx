import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  LinearProgress,
  Paper,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import { useState } from 'react';

import { ShellIcon } from '../../../app/shell/ShellIcon';
import { ReadinessRepairMetadata } from '../../readiness/ReadinessRepairMetadata';
import type {
  DataRelease,
  DataReleaseReadiness,
  DataReleaseType,
} from '../api/dataReleaseContracts';
import {
  compareDataReleases,
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
  readonly onSelectReleases: (releases: readonly DataRelease[]) => void;
  readonly onInstallSelected: () => void;
  readonly onSelectVisible: () => void;
  readonly onToggleRelease: (release: DataRelease) => void;
  readonly onValidateSelected: () => void;
}

type ReleaseGroupTone = 'action' | 'warning' | 'success';

function releaseActionGroup(release: DataRelease): 'available' | 'current' | 'repair' {
  if (isInstallableStatus(release.status)) return 'available';
  if (release.status === 'CURRENT') return 'current';
  return 'repair';
}

function releaseGroupIcon(groupId: string): string {
  if (groupId === 'available') return 'import';
  if (groupId === 'repair') return 'info';
  return 'approve';
}

function releaseStatusChipColor(release: DataRelease) {
  if (release.status === 'CURRENT') return 'success' as const;
  if (release.status === 'INVALID_RELEASE') return 'error' as const;
  if (release.status === 'FAILED') return 'warning' as const;
  return 'default' as const;
}

function releaseGroupToneStyles(tone: ReleaseGroupTone) {
  if (tone === 'warning') {
    return {
      palette: 'warning' as const,
      severity: 'warning' as const,
    };
  }
  if (tone === 'success') {
    return {
      palette: 'success' as const,
      severity: 'success' as const,
    };
  }
  return {
    palette: 'primary' as const,
    severity: 'info' as const,
  };
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

function releaseFallbackReadiness(release: DataRelease): DataReleaseReadiness {
  const blocker =
    release.status === 'CURRENT'
      ? undefined
      : {
          code:
            release.status === 'NOT_INSTALLED'
              ? 'IMPORT_NOT_STARTED'
              : release.status === 'RUNNING'
                ? 'IMPORT_IN_PROGRESS'
                : release.status === 'FAILED'
                  ? 'IMPORT_FAILED'
                  : release.status === 'INVALID_RELEASE'
                    ? 'INVALID_MANIFEST'
                    : 'VERSION_MISMATCH',
          severity:
            release.status === 'RUNNING'
              ? 'INFO'
              : release.status === 'INVALID_RELEASE' || release.status === 'FAILED'
                ? 'BLOCKER'
                : 'ACTION',
          owner: release.releaseCode ?? release.moduleName,
          message: releaseDisabledReason(release) ?? 'Data preparation is required.',
          action:
            release.status === 'NOT_INSTALLED'
              ? 'Prepare capability'
              : release.status === 'RUNNING'
                ? 'Refresh readiness'
                : release.status === 'FAILED'
                  ? 'Retry failed import'
                  : release.status === 'INVALID_RELEASE'
                    ? 'Repair release manifest'
                  : 'Update release',
          repair:
            release.status === 'INVALID_RELEASE'
              ? {
                  available: false,
                  label: 'Repair release manifest source',
                  operation: 'source.releaseManifest.repair',
                  action: 'REPAIR_RELEASE_MANIFEST_SOURCE',
                  idempotent: false,
                  requiresConfirmation: true,
                }
              : isInstallableStatus(release.status)
                ? {
                    available: true,
                    label:
                      release.status === 'FAILED'
                        ? 'Retry failed import'
                        : release.status === 'UPDATE_AVAILABLE'
                          ? 'Update release'
                          : 'Prepare capability',
                    operation: 'dataRelease.install',
                    action:
                      release.status === 'FAILED'
                        ? 'RETRY_FAILED_IMPORT'
                        : release.status === 'UPDATE_AVAILABLE'
                          ? 'UPDATE_RELEASE'
                          : 'PREPARE_CAPABILITY',
                    idempotent: true,
                    requiresConfirmation: false,
                  }
                : undefined,
        };
  return {
    capabilityCode: release.sectionCode ?? release.releaseCode ?? release.moduleName,
    displayName: release.displayName,
    owningModule: release.moduleName,
    capabilityType:
      release.dataType === 'init'
        ? 'INITIALIZATION_DATA'
        : release.dataType === 'sample'
          ? 'SAMPLE_DATA'
          : 'CORE_DATA',
    group: release.dataType === 'sample' ? 'APPLICATION_CONTENT' : 'FOUNDATION_DATA',
    businessStatus:
      release.status === 'CURRENT'
        ? 'PREPARED_STAGED'
        : release.status === 'RUNNING'
          ? 'PREPARING'
          : release.status === 'NOT_INSTALLED'
            ? 'NOT_PREPARED'
            : 'NEEDS_ATTENTION',
    technicalStatus: release.status,
    releaseStatus: release.status,
    nextAction: blocker?.action ?? 'No import action required',
    blockers: blocker ? [blocker] : [],
  };
}

function releaseReadiness(release: DataRelease): DataReleaseReadiness {
  return release.readiness ?? releaseFallbackReadiness(release);
}

function readinessStatusLabel(status: string): string {
  return status.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/gu, (value) =>
    value.toUpperCase(),
  );
}

function readinessStatusColor(status: string) {
  if (status === 'PREPARED_STAGED' || status === 'ONLINE') return 'success' as const;
  if (status === 'PREPARING') return 'info' as const;
  if (status === 'NEEDS_ATTENTION') return 'warning' as const;
  return 'default' as const;
}

function readinessGroupLabel(group: string): string {
  if (group === 'FOUNDATION_DATA') return 'Foundation data';
  if (group === 'APPLICATION_CONTENT') return 'Application content';
  if (group === 'PUBLISHING_PROFILE') return 'Publishing profile';
  if (group === 'MEDIA_LIBRARY') return 'Media library';
  return readinessStatusLabel(group);
}

function readinessGroupKey(release: DataRelease): string {
  const readiness = releaseReadiness(release);
  return [
    readiness.group,
    readiness.capabilityCode,
    release.destinationRole ?? 'default',
  ].join(':');
}

function readinessGroupSort(
  left: CapabilityReadinessGroup,
  right: CapabilityReadinessGroup,
): number {
  const leftNeedsAction = left.actionable.length > 0 ? 0 : 1;
  const rightNeedsAction = right.actionable.length > 0 ? 0 : 1;
  if (leftNeedsAction !== rightNeedsAction) return leftNeedsAction - rightNeedsAction;
  const byGroup = left.readiness.group.localeCompare(right.readiness.group);
  if (byGroup !== 0) return byGroup;
  return left.readiness.displayName.localeCompare(right.readiness.displayName);
}

interface CapabilityReadinessGroup {
  readonly key: string;
  readonly readiness: DataReleaseReadiness;
  readonly releases: readonly DataRelease[];
  readonly actionable: readonly DataRelease[];
  readonly current: number;
}

export function DataReleaseWorkbench(props: DataReleaseWorkbenchProps) {
  const selectableReleaseCount = props.visibleReleases.filter((release) =>
    isInstallableStatus(release.status),
  ).length;
  const selectedVisibleCount = props.visibleReleases.filter(
    (release) =>
      isInstallableStatus(release.status) &&
      props.selectedReleaseKeys.has(releaseKey(release)),
  ).length;
  const allVisibleSelected =
    selectableReleaseCount > 0 && selectedVisibleCount === selectableReleaseCount;
  const someVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < selectableReleaseCount;
  const groupedReleases = [
    {
      id: 'available',
      heading: 'Needs action',
      help: 'Install or update these releases before dependent business journeys run.',
      releases: props.visibleReleases
        .filter((release) => releaseActionGroup(release) === 'available')
        .sort(compareDataReleases),
      tone: 'action' as const,
    },
    {
      id: 'repair',
      heading: 'Requires repair',
      help: 'These releases are blocked by their manifest or runtime contract. Repair the owning module data release, rebuild, restart, and refresh this page.',
      releases: props.visibleReleases
        .filter((release) => releaseActionGroup(release) === 'repair')
        .sort(compareDataReleases),
      tone: 'warning' as const,
    },
    {
      id: 'current',
      heading: 'Already current',
      help: 'These releases are already installed at the available version and are shown for audit only.',
      releases: props.visibleReleases
        .filter((release) => releaseActionGroup(release) === 'current')
        .sort(compareDataReleases),
      tone: 'success' as const,
    },
  ].filter((group) => group.releases.length > 0);
  const readinessGroups = Array.from(
    props.visibleReleases
      .reduce<Map<string, DataRelease[]>>((groups, release) => {
        const key = readinessGroupKey(release);
        groups.set(key, [...(groups.get(key) ?? []), release]);
        return groups;
      }, new Map())
      .entries(),
  )
    .map<CapabilityReadinessGroup>(([key, releases]) => {
      const sortedReleases = releases.sort(compareDataReleases);
      return {
        key,
        readiness: releaseReadiness(sortedReleases[0]!),
        releases: sortedReleases,
        actionable: sortedReleases.filter((release) =>
          isInstallableStatus(release.status),
        ),
        current: sortedReleases.filter((release) => release.status === 'CURRENT')
          .length,
      };
    })
    .filter((group) =>
      group.releases.some(
        (release) => releaseReadiness(release).businessStatus !== 'PREPARED_STAGED',
      ),
    )
    .sort(readinessGroupSort);
  const readinessPercent =
    props.summary.total > 0
      ? Math.round((props.summary.current / props.summary.total) * 100)
      : 0;
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((previousGroups) => {
      const nextGroups = new Set(previousGroups);
      if (nextGroups.has(groupKey)) {
        nextGroups.delete(groupKey);
      } else {
        nextGroups.add(groupKey);
      }
      return nextGroups;
    });
  };

  return (
    <>
      <Paper
        variant="outlined"
        sx={(theme) => ({
          bgcolor:
            props.releaseType === 'sample'
              ? alpha(theme.palette.warning.main, 0.06)
              : alpha(theme.palette.primary.main, 0.045),
          borderColor:
            props.releaseType === 'sample'
              ? alpha(theme.palette.warning.main, 0.28)
              : alpha(theme.palette.primary.main, 0.16),
          p: { xs: 1.5, md: 2 },
        })}
      >
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            sx={{
              alignItems: { md: 'center' },
              gap: 1.5,
              justifyContent: 'space-between',
            }}
          >
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
              <Box
                aria-hidden="true"
                sx={(theme) => ({
                  alignItems: 'center',
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                  border: 1,
                  borderColor: alpha(theme.palette.primary.main, 0.22),
                  borderRadius: '8px',
                  color: 'primary.main',
                  display: 'inline-flex',
                  flexShrink: 0,
                  height: 44,
                  justifyContent: 'center',
                  width: 44,
                })}
              >
                <ShellIcon name="import" />
              </Box>
              <Box>
                <Typography component="h2" variant="h6">
                  {typeCopy[props.releaseType].label}
                </Typography>
                <Typography color="text.secondary" sx={{ maxWidth: 980 }}>
                  {typeCopy[props.releaseType].help}{' '}
                  {typeCopy[props.releaseType].warning}
                </Typography>
              </Box>
            </Stack>
            <Chip
              label={`${readinessPercent.toString()}% current`}
              color={readinessPercent === 100 ? 'success' : 'default'}
              variant={readinessPercent === 100 ? 'filled' : 'outlined'}
            />
          </Stack>
          <LinearProgress
            aria-label={`${typeCopy[props.releaseType].label} readiness`}
            value={readinessPercent}
            variant="determinate"
            sx={(theme) => ({
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              borderRadius: 999,
              height: 6,
            })}
          />
          <Box
            aria-label="Data release summary"
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(4, minmax(0, 1fr))',
              },
            }}
          >
            {(
              [
                ['Releases', props.summary.total, 'folder'],
                ['Current', props.summary.current, 'approve'],
                ['Needs action', props.summary.installable, 'import'],
                ['Selected', props.summary.selected, 'tasks'],
              ] satisfies ReadonlyArray<readonly [string, number, string]>
            ).map(([label, value, icon]) => (
              <Box
                key={label}
                sx={(theme) => ({
                  alignItems: 'center',
                  bgcolor: alpha(theme.palette.background.paper, 0.72),
                  border: 1,
                  borderColor: alpha(theme.palette.divider, 0.9),
                  borderRadius: '8px',
                  display: 'flex',
                  gap: 1,
                  minHeight: 74,
                  px: 1.25,
                  py: 1,
                })}
              >
                <Box
                  aria-hidden="true"
                  sx={(theme) => ({
                    alignItems: 'center',
                    bgcolor: alpha(theme.palette.primary.main, 0.09),
                    borderRadius: '8px',
                    color: 'primary.main',
                    display: 'inline-flex',
                    height: 38,
                    justifyContent: 'center',
                    width: 38,
                  })}
                >
                  <ShellIcon fontSize="small" name={icon} />
                </Box>
                <Box>
                  <Typography color="text.secondary" variant="caption">
                    {label}
                  </Typography>
                  <Typography component="p" variant="h5">
                    {value.toString()}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Stack>
      </Paper>

      {readinessGroups.length > 0 ? (
        <Paper
          aria-label="Capability preparation readiness"
          component="section"
          variant="outlined"
          sx={(theme) => ({
            borderColor: alpha(theme.palette.warning.main, 0.28),
            overflow: 'hidden',
          })}
        >
          <Box
            sx={(theme) => ({
              bgcolor: alpha(theme.palette.warning.main, 0.075),
              borderBottom: 1,
              borderColor: alpha(theme.palette.warning.main, 0.22),
              px: { xs: 1.25, md: 1.75 },
              py: 1.25,
            })}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              sx={{ alignItems: { md: 'center' }, gap: 1, justifyContent: 'space-between' }}
            >
              <Box>
                <Typography component="h2" variant="subtitle1">
                  Preparation readiness
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Resolve these capability blockers before relying on this data set.
                </Typography>
              </Box>
              <Chip
                color="warning"
                label={`${readinessGroups.length.toString()} capability group(s)`}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Box>
          <Stack spacing={1} sx={{ p: { xs: 1, md: 1.25 } }}>
            {readinessGroups.map((group) => {
              const firstBlocker = group.releases
                .map((release) => releaseReadiness(release).blockers[0])
                .find(Boolean);
              const allActionableSelected =
                group.actionable.length > 0 &&
                group.actionable.every((release) =>
                  props.selectedReleaseKeys.has(releaseKey(release)),
                );
              return (
              <Box
                key={`readiness:${group.key}`}
                sx={(theme) => ({
                  border: 1,
                  borderColor: alpha(
                    theme.palette[
                      firstBlocker?.severity === 'BLOCKER' ? 'error' : 'warning'
                    ].main,
                    0.24,
                  ),
                  borderRadius: '8px',
                  p: { xs: 1.25, md: 1.5 },
                })}
              >
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  sx={{ alignItems: { md: 'center' }, gap: 1.25, justifyContent: 'space-between' }}
                >
                  <Stack spacing={0.55} sx={{ minWidth: 0 }}>
                    <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
                      <Typography component="h3" variant="subtitle1">
                        {group.readiness.displayName}
                      </Typography>
                      <Chip
                        color={readinessStatusColor(group.readiness.businessStatus)}
                        label={readinessStatusLabel(group.readiness.businessStatus)}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={readinessGroupLabel(group.readiness.group)}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={`${group.current.toString()}/${group.releases.length.toString()} current`}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                    <Typography color="text.secondary" variant="body2">
                      {firstBlocker?.message ?? group.releases[0]?.description}
                    </Typography>
                    <ReadinessRepairMetadata repair={firstBlocker?.repair} />
                    <Typography color="text.secondary" variant="caption">
                      Owner {group.readiness.owningModule} · {group.readiness.capabilityCode}
                    </Typography>
                  </Stack>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    sx={{ alignItems: { sm: 'center' }, flexShrink: 0, gap: 1 }}
                  >
                    <Chip
                      color={
                        firstBlocker?.severity === 'BLOCKER'
                          ? 'error'
                          : firstBlocker?.severity === 'INFO'
                            ? 'info'
                            : 'warning'
                      }
                      label={firstBlocker?.action ?? group.readiness.nextAction}
                      variant="filled"
                    />
                    {group.actionable.length > 0 ? (
                      <Button
                        size="small"
                        startIcon={<ShellIcon fontSize="small" name="tasks" />}
                        variant={allActionableSelected ? 'contained' : 'outlined'}
                        onClick={() => props.onSelectReleases(group.actionable)}
                      >
                        {allActionableSelected
                          ? 'Selected'
                          : `Select ${group.actionable.length.toString()}`}
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              </Box>
              );
            })}
          </Stack>
        </Paper>
      ) : null}

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
        <Stack spacing={1.5}>
          {groupedReleases.map((group, groupIndex) => {
            const groupKey = `${props.releaseType}:${group.id}`;
            const groupPanelId = `${props.releaseType}-${group.id}-releases`;
            const collapsed = collapsedGroups.has(groupKey);
            const toneStyles = releaseGroupToneStyles(group.tone);
            return (
              <Paper
                key={group.heading}
                component="section"
                variant="outlined"
                sx={(theme) => ({
                  bgcolor: 'background.paper',
                  borderColor: alpha(theme.palette[toneStyles.palette].main, 0.28),
                  boxShadow:
                    groupIndex === 0
                      ? `0 12px 34px ${alpha(theme.palette.common.black, 0.06)}`
                      : `0 8px 24px ${alpha(theme.palette.common.black, 0.035)}`,
                  overflow: 'hidden',
                })}
              >
                <Box
                  aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${group.heading}`}
                  aria-controls={groupPanelId}
                  aria-expanded={!collapsed}
                  component="button"
                  type="button"
                  sx={(theme) => ({
                    bgcolor: alpha(theme.palette[toneStyles.palette].main, 0.055),
                    border: 0,
                    borderLeft: 4,
                    borderLeftColor: theme.palette[toneStyles.palette].main,
                    color: 'text.primary',
                    cursor: 'pointer',
                    display: 'block',
                    font: 'inherit',
                    px: { xs: 1.25, md: 1.75 },
                    py: { xs: 1.25, md: 1.5 },
                    textAlign: 'left',
                    width: '100%',
                    '&:focus-visible': {
                      outline: `3px solid ${alpha(theme.palette[toneStyles.palette].main, 0.32)}`,
                      outlineOffset: -3,
                    },
                    '&:hover': {
                      bgcolor: alpha(theme.palette[toneStyles.palette].main, 0.085),
                    },
                  })}
                  onClick={() => toggleGroup(groupKey)}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    sx={{
                      alignItems: { sm: 'center' },
                      gap: 1,
                      justifyContent: 'space-between',
                    }}
                  >
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
                      <Box
                        aria-hidden="true"
                        sx={(theme) => ({
                          alignItems: 'center',
                          bgcolor: alpha(theme.palette[toneStyles.palette].main, 0.12),
                          border: 1,
                          borderColor: alpha(
                            theme.palette[toneStyles.palette].main,
                            0.3,
                          ),
                          borderRadius: '8px',
                          color: theme.palette[toneStyles.palette].main,
                          display: 'inline-flex',
                          flexShrink: 0,
                          height: 44,
                          justifyContent: 'center',
                          width: 44,
                        })}
                      >
                        <ShellIcon name={releaseGroupIcon(group.id)} />
                      </Box>
                      <Box>
                        <Stack
                          direction="row"
                          sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}
                        >
                          <Typography component="h2" variant="subtitle1">
                            {group.heading}
                          </Typography>
                          <Chip
                            color={toneStyles.severity}
                            label={`${group.releases.length} release(s)`}
                            size="small"
                            variant={group.tone === 'action' ? 'filled' : 'outlined'}
                          />
                        </Stack>
                        <Typography color="text.secondary" variant="body2">
                          {group.help}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack
                      direction="row"
                      sx={{
                        alignItems: 'center',
                        flexShrink: 0,
                        gap: 0.75,
                      }}
                    >
                      <Box
                        aria-hidden="true"
                        component="span"
                        sx={(theme) => ({
                          alignItems: 'center',
                          bgcolor: alpha(theme.palette.background.paper, 0.86),
                          border: 1,
                          borderColor: alpha(
                            theme.palette[toneStyles.palette].main,
                            0.2,
                          ),
                          borderRadius: '999px',
                          color: theme.palette[toneStyles.palette].main,
                          display: 'inline-flex',
                          height: 36,
                          justifyContent: 'center',
                          width: 36,
                        })}
                      >
                        <ShellIcon
                          fontSize="small"
                          name={collapsed ? 'chevron-down' : 'chevron-up'}
                        />
                      </Box>
                    </Stack>
                  </Stack>
                </Box>
                {!collapsed ? (
                  <Stack id={groupPanelId} spacing={1} sx={{ p: { xs: 1, md: 1.25 } }}>
                    {group.releases.map((release) => {
                      const disabledReason = releaseDisabledReason(release);
                      const installedMatchesAvailable =
                        release.installedVersion === release.version;
                      const selectable = isInstallableStatus(release.status);
                      const checked =
                        selectable &&
                        props.selectedReleaseKeys.has(releaseKey(release));
                      return (
                        <Box
                          key={releaseKey(release)}
                          sx={(theme) => ({
                            border: 1,
                            borderColor: checked
                              ? alpha(theme.palette.primary.main, 0.28)
                              : alpha(theme.palette.divider, 0.82),
                            borderRadius: '8px',
                            bgcolor: checked
                              ? alpha(theme.palette.primary.main, 0.06)
                              : 'background.paper',
                            boxShadow: checked
                              ? `0 10px 24px ${alpha(theme.palette.primary.main, 0.08)}`
                              : 'none',
                            transition:
                              'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
                            '&:hover': {
                              borderColor: checked
                                ? alpha(theme.palette.primary.main, 0.38)
                                : alpha(theme.palette.primary.main, 0.18),
                              bgcolor: checked
                                ? alpha(theme.palette.primary.main, 0.08)
                                : 'background.default',
                            },
                          })}
                        >
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            sx={{
                              alignItems: { sm: 'center' },
                              gap: { xs: 1, sm: 1.5 },
                              px: { xs: 1.25, md: 1.5 },
                              py: { xs: 1.2, md: 1.35 },
                            }}
                          >
                            <Box sx={{ flexShrink: 0 }}>
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
                                  color={releaseStatusChipColor(release)}
                                  variant={
                                    release.status === 'CURRENT' ? 'filled' : 'outlined'
                                  }
                                />
                              </Stack>
                              <Typography color="text.secondary" sx={{ maxWidth: 900 }}>
                                {release.description}
                              </Typography>
                              <Stack
                                direction="row"
                                sx={{ flexWrap: 'wrap', gap: 0.75 }}
                              >
                                <Chip
                                  label={
                                    installedMatchesAvailable
                                      ? `Version ${release.version}`
                                      : `Available ${release.version}`
                                  }
                                  size="small"
                                  variant="outlined"
                                />
                                {release.destinationRole ? (
                                  <Chip
                                    label={`Target ${release.destinationRole}`}
                                    size="small"
                                    variant="outlined"
                                  />
                                ) : null}
                                <Chip
                                  label={release.moduleName}
                                  size="small"
                                  variant="outlined"
                                />
                                {release.installedVersion &&
                                !installedMatchesAvailable ? (
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
                  </Stack>
                ) : null}
              </Paper>
            );
          })}
        </Stack>
      ) : null}

      <Paper
        aria-label={`${typeCopy[props.releaseType].label} action footer`}
        component="section"
        elevation={3}
        sx={(theme) => ({
          bgcolor: alpha(theme.palette.background.paper, 0.96),
          border: 1,
          borderColor: alpha(theme.palette.primary.main, 0.18),
          bottom: 0,
          boxShadow: `0 -10px 32px ${alpha(theme.palette.common.black, 0.08)}`,
          mt: 2,
          position: 'sticky',
          px: { xs: 1.25, md: 1.75 },
          py: 1.35,
          zIndex: theme.zIndex.appBar - 1,
        })}
      >
        <Stack spacing={1.25}>
          {props.operationIsError ? (
            <Alert severity="error">{props.operationErrorMessage}</Alert>
          ) : null}
          {props.operationIsSuccess ? (
            <Alert severity="success">{props.successMessage}</Alert>
          ) : null}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            sx={{
              alignItems: { md: 'center' },
              gap: 1.5,
              justifyContent: 'space-between',
            }}
          >
            <Stack
              direction="row"
              sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={allVisibleSelected}
                    disabled={props.operationIsPending || selectableReleaseCount === 0}
                    indeterminate={someVisibleSelected}
                    slotProps={{
                      input: {
                        'aria-label': 'Select all actionable releases',
                      },
                    }}
                    onChange={() => {
                      if (allVisibleSelected || someVisibleSelected) {
                        props.onDeselectVisible();
                      } else {
                        props.onSelectVisible();
                      }
                    }}
                  />
                }
                label={`${selectedVisibleCount} of ${selectableReleaseCount} actionable release(s) selected`}
              />
              <Chip
                label={
                  selectableReleaseCount === 0
                    ? 'No action required'
                    : `${selectableReleaseCount.toString()} actionable`
                }
                color={selectableReleaseCount === 0 ? 'success' : 'default'}
                variant="outlined"
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5 }}>
              <Button
                disabled={props.operationIsPending || props.selectedReleaseCount === 0}
                startIcon={<ShellIcon fontSize="small" name="visible" />}
                onClick={props.onValidateSelected}
                variant="outlined"
              >
                Validate selected
              </Button>
              <Button
                disabled={
                  props.operationIsPending || props.executableReleaseCount === 0
                }
                startIcon={<ShellIcon fontSize="small" name="download" />}
                onClick={props.onInstallSelected}
                variant="contained"
              >
                {props.operationIsPending ? 'Working…' : 'Install or update selected'}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>
    </>
  );
}
