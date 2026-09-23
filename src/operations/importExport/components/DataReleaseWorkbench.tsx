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
import { CapabilityReadinessPanel } from '../../readiness/CapabilityReadinessPanel';
import type {
  DataRelease,
  DataReleaseDryRunOperation,
  DataReleaseDryRunSummary,
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
  readonly dryRun?: DataReleaseDryRunSummary | undefined;
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
  const blockerCode =
    release.status === 'NOT_INSTALLED'
      ? 'IMPORT_NOT_STARTED'
      : release.status === 'RUNNING'
        ? 'IMPORT_IN_PROGRESS'
        : release.status === 'FAILED'
          ? 'IMPORT_FAILED'
          : release.status === 'INVALID_RELEASE'
            ? 'INVALID_MANIFEST'
            : 'VERSION_MISMATCH';
  const blocker =
    release.status === 'CURRENT'
      ? undefined
      : {
          blockerCode,
          code: blockerCode,
          severity:
            release.status === 'RUNNING'
              ? 'INFO'
              : release.status === 'INVALID_RELEASE' || release.status === 'FAILED'
                ? 'BLOCKED'
                : 'REPAIR_REQUIRED',
          owner: release.releaseCode ?? release.moduleName,
          ownerType: 'DATA_RELEASE',
          source: 'IMPORT_RELEASE_CATALOGUE',
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
          disabledReason:
            releaseDisabledReason(release) ?? 'Data release readiness requires review.',
          technicalStatus: release.status,
          repair:
            release.status === 'INVALID_RELEASE'
              ? {
                  available: false,
                  label: 'Repair release manifest source',
                  operation: 'source.releaseManifest.repair',
                  action: 'REPAIR_RELEASE_MANIFEST_SOURCE',
                  idempotent: false,
                  requiresConfirmation: true,
                  unavailableReason:
                    'Release manifest validation failed; repair the source descriptor in the owning module before importing.',
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

function dryRunOperationLabel(operation: DataReleaseDryRunOperation): string {
  return operation.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/gu, (value) =>
    value.toUpperCase(),
  );
}

function dryRunOperationColor(operation: DataReleaseDryRunOperation) {
  if (operation === 'INSTALL' || operation === 'UPDATE') return 'primary' as const;
  if (operation === 'RETRY') return 'warning' as const;
  if (operation === 'BLOCKED') return 'error' as const;
  if (operation === 'WAIT') return 'info' as const;
  return 'success' as const;
}

function DryRunSummaryPanel(props: {
  readonly dryRun: DataReleaseDryRunSummary;
}) {
  const counters = [
    ['Install', props.dryRun.summary.install, 'import'],
    ['Update', props.dryRun.summary.update, 'refresh'],
    ['Retry', props.dryRun.summary.retry, 'refresh'],
    ['Skip', props.dryRun.summary.skip, 'approve'],
    ['Blocked', props.dryRun.summary.blocked, 'info'],
    ['Wait', props.dryRun.summary.wait, 'info'],
  ] satisfies ReadonlyArray<readonly [string, number, string]>;
  return (
    <Paper
      aria-label="Data release dry-run result"
      component="section"
      variant="outlined"
      sx={(theme) => ({
        borderColor: alpha(theme.palette.primary.main, 0.2),
        overflow: 'hidden',
      })}
    >
      <Box
        sx={(theme) => ({
          bgcolor: alpha(theme.palette.primary.main, 0.055),
          borderBottom: 1,
          borderColor: alpha(theme.palette.primary.main, 0.14),
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
              Dry-run result
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Backend validation completed without importing data. Counts are
              release-level actions, not record-level inserts or updates.
            </Typography>
          </Box>
          <Chip
            color={props.dryRun.executableReleases > 0 ? 'primary' : 'success'}
            label={`${props.dryRun.executableReleases.toString()} executable`}
            size="small"
            variant="outlined"
          />
        </Stack>
      </Box>
      <Stack spacing={1.25} sx={{ p: { xs: 1.25, md: 1.5 } }}>
        {props.dryRun.messages.length > 0 ? (
          <Alert severity={props.dryRun.blockedReleases > 0 ? 'warning' : 'success'}>
            {props.dryRun.messages.join(' ')}
          </Alert>
        ) : null}
        <Box
          aria-label="Dry-run action counts"
          sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(3, minmax(0, 1fr))',
              xl: 'repeat(6, minmax(0, 1fr))',
            },
          }}
        >
          {counters.map(([label, value, icon]) => (
            <Box
              key={label}
              sx={(theme) => ({
                alignItems: 'center',
                bgcolor: alpha(theme.palette.background.default, 0.75),
                border: 1,
                borderColor: alpha(theme.palette.divider, 0.8),
                borderRadius: '8px',
                display: 'flex',
                gap: 1,
                minHeight: 58,
                px: 1,
              })}
            >
              <ShellIcon fontSize="small" name={icon} />
              <Box>
                <Typography color="text.secondary" variant="caption">
                  {label}
                </Typography>
                <Typography component="p" variant="subtitle1">
                  {value.toString()}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
        {props.dryRun.outcomes.length > 0 ? (
          <Stack spacing={0.75}>
            {props.dryRun.outcomes.slice(0, 8).map((outcome) => (
              <Box
                key={outcome.releaseCode ?? `${outcome.moduleName}:${outcome.displayName}`}
                sx={(theme) => ({
                  border: 1,
                  borderColor: alpha(theme.palette.divider, 0.82),
                  borderRadius: '8px',
                  px: { xs: 1, md: 1.25 },
                  py: 1,
                })}
              >
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  sx={{ alignItems: { md: 'center' }, gap: 1, justifyContent: 'space-between' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack
                      direction="row"
                      sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}
                    >
                      <Typography component="h3" variant="subtitle2">
                        {outcome.displayName}
                      </Typography>
                      <Chip
                        color={dryRunOperationColor(outcome.operation)}
                        label={dryRunOperationLabel(outcome.operation)}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                    <Typography color="text.secondary" variant="body2">
                      {outcome.impact}
                    </Typography>
                  </Box>
                  <Typography color="text.secondary" variant="caption">
                    {outcome.nextAction}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : null}
        {props.dryRun.publicationFollowUps.length > 0 ? (
          <Box
            sx={(theme) => ({
              bgcolor: alpha(theme.palette.warning.main, 0.055),
              border: 1,
              borderColor: alpha(theme.palette.warning.main, 0.22),
              borderRadius: '8px',
              p: { xs: 1, md: 1.25 },
            })}
          >
            <Stack spacing={0.75}>
              <Stack
                direction="row"
                sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}
              >
                <ShellIcon fontSize="small" name="workflow" />
                <Typography component="h3" variant="subtitle2">
                  Publication follow-up required
                </Typography>
                <Chip
                  color="warning"
                  label={`${props.dryRun.publicationFollowUps.length.toString()} publishable`}
                  size="small"
                  variant="outlined"
                />
              </Stack>
              {props.dryRun.publicationFollowUps.slice(0, 6).map((followUp) => (
                <Box
                  key={
                    followUp.releaseCode ??
                    `${followUp.moduleName}:${followUp.displayName}`
                  }
                  sx={(theme) => ({
                    bgcolor: alpha(theme.palette.background.paper, 0.75),
                    border: 1,
                    borderColor: alpha(theme.palette.divider, 0.82),
                    borderRadius: '8px',
                    px: 1,
                    py: 0.85,
                  })}
                >
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    sx={{ alignItems: { md: 'center' }, gap: 1, justifyContent: 'space-between' }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }} variant="body2">
                        {followUp.displayName}
                      </Typography>
                      <Typography color="text.secondary" variant="caption">
                        {followUp.impact}
                      </Typography>
                    </Box>
                    <Stack
                      direction="row"
                      sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.6 }}
                    >
                      {followUp.sourceRole ? (
                        <Chip label={`From ${followUp.sourceRole}`} size="small" />
                      ) : null}
                      {followUp.targetRole ? (
                        <Chip label={`To ${followUp.targetRole}`} size="small" />
                      ) : null}
                      {followUp.siteCode ? (
                        <Chip label={followUp.siteCode} size="small" />
                      ) : null}
                      <Chip
                        color="warning"
                        label={followUp.nextAction}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
}

function readinessGroupLabel(group: string): string {
  if (group === 'FOUNDATION_DATA') return 'Foundation data';
  if (group === 'APPLICATION_CONTENT') return 'Application content';
  if (group === 'PUBLISHING_PROFILE') return 'Publishing profile';
  if (group === 'MEDIA_LIBRARY') return 'Media library';
  if (group === 'PROJECT_ACCELERATOR') return 'Project accelerator';
  return readinessStatusLabel(group);
}

function readinessGroupHelp(group: string): string {
  if (group === 'FOUNDATION_DATA') {
    return 'Framework-owned baseline records. Repair or install these from the owning module release before dependent runtimes start relying on them.';
  }
  if (group === 'APPLICATION_CONTENT' || group === 'PROJECT_ACCELERATOR') {
    return 'Business content and accelerator data. Import into the staged runtime first, then complete publication approval before expecting customer-facing pages.';
  }
  if (group === 'PUBLISHING_PROFILE') {
    return 'Publication control data. Repair this before approving Staged-to-Online movement, documentation packs, or accelerator go-live.';
  }
  if (group === 'MEDIA_LIBRARY') {
    return 'Media-owned assets. Validate the media object, physical artifact movement, and consuming-module reference binding before publishing.';
  }
  return 'Resolve the owning module readiness blockers before selecting or importing this release group.';
}

function readinessGroupOrder(group: string): number {
  if (group === 'FOUNDATION_DATA') return 10;
  if (group === 'MEDIA_LIBRARY') return 20;
  if (group === 'PUBLISHING_PROFILE') return 30;
  if (group === 'APPLICATION_CONTENT') return 40;
  if (group === 'PROJECT_ACCELERATOR') return 50;
  return 90;
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
  const leftRelease = left.releases[0];
  const rightRelease = right.releases[0];
  if (leftRelease && rightRelease) {
    const byReleaseOrder = compareDataReleases(leftRelease, rightRelease);
    if (byReleaseOrder !== 0) return byReleaseOrder;
  }
  return left.readiness.displayName.localeCompare(right.readiness.displayName);
}

interface CapabilityReadinessGroup {
  readonly key: string;
  readonly readiness: DataReleaseReadiness;
  readonly releases: readonly DataRelease[];
  readonly actionable: readonly DataRelease[];
  readonly current: number;
}

interface BusinessReleasePack {
  readonly key: string;
  readonly label: string;
  readonly help: string;
  readonly releases: readonly DataRelease[];
  readonly actionable: readonly DataRelease[];
  readonly current: number;
  readonly blockerCount: number;
  readonly ownerModules: readonly string[];
}

function businessPackHelp(group: string): string {
  if (group === 'FOUNDATION_DATA') {
    return 'Framework and module baseline records required before dependent operations run.';
  }
  if (group === 'APPLICATION_CONTENT') {
    return 'Customer-facing staged content or sample business records that may need publication follow-up.';
  }
  if (group === 'MEDIA_LIBRARY') {
    return 'Media-owned objects and reference data used by CMS, catalog, and accelerators.';
  }
  if (group === 'PUBLISHING_PROFILE') {
    return 'Publication control records used to move staged content toward online delivery.';
  }
  if (group === 'PROJECT_ACCELERATOR') {
    return 'Accelerator-owned setup data for business journeys such as Circa, Agora, or Nexus.';
  }
  return 'Backend-owned release pack. Review blockers, then validate before installing.';
}

function buildBusinessReleasePacks(
  releases: readonly DataRelease[],
): readonly BusinessReleasePack[] {
  return Array.from(
    releases
      .reduce<Map<string, DataRelease[]>>((groups, release) => {
        const group = releaseReadiness(release).group;
        groups.set(group, [...(groups.get(group) ?? []), release]);
        return groups;
      }, new Map())
      .entries(),
  )
    .map<BusinessReleasePack>(([key, groupReleases]) => {
      const sorted = [...groupReleases].sort(compareDataReleases);
      const ownerModules = Array.from(
        new Set(sorted.map((release) => releaseReadiness(release).owningModule)),
      ).sort();
      return {
        key,
        label: readinessGroupLabel(key),
        help: businessPackHelp(key),
        releases: sorted,
        actionable: sorted.filter((release) => isInstallableStatus(release.status)),
        current: sorted.filter((release) => release.status === 'CURRENT').length,
        blockerCount: sorted.reduce(
          (total, release) => total + releaseReadiness(release).blockers.length,
          0,
        ),
        ownerModules,
      };
    })
    .sort(
      (left, right) =>
        (left.actionable.length > 0 ? 0 : 1) - (right.actionable.length > 0 ? 0 : 1) ||
        readinessGroupOrder(left.key) - readinessGroupOrder(right.key) ||
        left.label.localeCompare(right.label),
    );
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
      help: 'These releases failed manifest or runtime validation. Repair the owning module release descriptor or target runtime registration, rebuild/restart the affected runtime, then refresh this page.',
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
  const readinessSequence = Array.from(
    readinessGroups
      .reduce<Map<string, CapabilityReadinessGroup[]>>((groups, group) => {
        const key = group.readiness.group;
        groups.set(key, [...(groups.get(key) ?? []), group]);
        return groups;
      }, new Map())
      .entries(),
  )
    .map(([group, groups]) => ({
      group,
      label: readinessGroupLabel(group),
      actionable: groups.reduce((sum, item) => sum + item.actionable.length, 0),
      total: groups.reduce((sum, item) => sum + item.releases.length, 0),
      current: groups.reduce((sum, item) => sum + item.current, 0),
    }))
    .sort(
      (left, right) =>
        readinessGroupOrder(left.group) - readinessGroupOrder(right.group) ||
        left.label.localeCompare(right.label),
    );
  const businessPacks = buildBusinessReleasePacks(props.visibleReleases);
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
          {readinessSequence.length > 0 ? (
            <Box
              aria-label="Recommended preparation sequence"
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(4, minmax(0, 1fr))',
                },
              }}
            >
              {readinessSequence.map((step, index) => (
                <Box
                  key={step.group}
                  sx={(theme) => ({
                    alignItems: 'center',
                    bgcolor: alpha(theme.palette.background.paper, 0.72),
                    border: 1,
                    borderColor:
                      step.actionable > 0
                        ? alpha(theme.palette.warning.main, 0.36)
                        : alpha(theme.palette.divider, 0.9),
                    borderRadius: '8px',
                    display: 'flex',
                    gap: 1,
                    minHeight: 62,
                    px: 1.25,
                    py: 1,
                  })}
                >
                  <Chip label={`Step ${(index + 1).toString()}`} size="small" />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }} variant="body2">
                      {step.label}
                    </Typography>
                    <Typography color="text.secondary" variant="caption">
                      {step.current.toString()}/{step.total.toString()} current ·{' '}
                      {step.actionable.toString()} need action
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          ) : null}
        </Stack>
      </Paper>

      {businessPacks.length > 0 ? (
        <Paper
          aria-label="Business release packs"
          component="section"
          variant="outlined"
          sx={(theme) => ({
            borderColor: alpha(theme.palette.primary.main, 0.18),
            overflow: 'hidden',
          })}
        >
          <Box
            sx={(theme) => ({
              bgcolor: alpha(theme.palette.primary.main, 0.055),
              borderBottom: 1,
              borderColor: alpha(theme.palette.primary.main, 0.14),
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
                  Business packs
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Start from the business outcome, then expand release details only
                  when support evidence is needed.
                </Typography>
              </Box>
              <Chip
                color={businessPacks.some((pack) => pack.actionable.length > 0) ? 'primary' : 'success'}
                label={`${businessPacks.length.toString()} pack${businessPacks.length === 1 ? '' : 's'}`}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
              p: { xs: 1, md: 1.25 },
            }}
          >
            {businessPacks.map((pack) => {
              const selectedPackCount = pack.actionable.filter((release) =>
                props.selectedReleaseKeys.has(releaseKey(release)),
              ).length;
              const complete = pack.current === pack.releases.length;
              return (
                <Box
                  key={pack.key}
                  sx={(theme) => ({
                    border: 1,
                    borderColor:
                      pack.blockerCount > 0
                        ? alpha(theme.palette.warning.main, 0.28)
                        : complete
                          ? alpha(theme.palette.success.main, 0.28)
                          : alpha(theme.palette.primary.main, 0.22),
                    borderRadius: '8px',
                    p: { xs: 1.25, md: 1.5 },
                  })}
                >
                  <Stack spacing={1.25}>
                    <Stack
                      direction="row"
                      sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}
                    >
                      <Typography component="h3" variant="subtitle1">
                        {pack.label}
                      </Typography>
                      <Chip
                        color={complete ? 'success' : pack.actionable.length > 0 ? 'primary' : 'default'}
                        label={`${pack.current.toString()}/${pack.releases.length.toString()} current`}
                        size="small"
                        variant={complete ? 'filled' : 'outlined'}
                      />
                      {pack.blockerCount > 0 ? (
                        <Chip
                          color="warning"
                          label={`${pack.blockerCount.toString()} blocker${pack.blockerCount === 1 ? '' : 's'}`}
                          size="small"
                          variant="outlined"
                        />
                      ) : null}
                    </Stack>
                    <Typography color="text.secondary" variant="body2">
                      {pack.help}
                    </Typography>
                    <Stack
                      direction="row"
                      sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}
                    >
                      {pack.ownerModules.slice(0, 5).map((moduleName) => (
                        <Chip
                          key={moduleName}
                          label={moduleName}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                      {pack.ownerModules.length > 5 ? (
                        <Chip
                          label={`+${(pack.ownerModules.length - 5).toString()} owners`}
                          size="small"
                          variant="outlined"
                        />
                      ) : null}
                    </Stack>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 1 }}
                    >
                      <Typography color="text.secondary" variant="caption">
                        {pack.actionable.length > 0
                          ? `${selectedPackCount.toString()} of ${pack.actionable.length.toString()} actionable selected`
                          : 'No import action required for this pack'}
                      </Typography>
                      {pack.actionable.length > 0 ? (
                        <Button
                          size="small"
                          startIcon={<ShellIcon fontSize="small" name="tasks" />}
                          variant={selectedPackCount === pack.actionable.length ? 'contained' : 'outlined'}
                          onClick={() => props.onSelectReleases(pack.actionable)}
                        >
                          {selectedPackCount === pack.actionable.length
                            ? 'Pack selected'
                            : 'Select pack'}
                        </Button>
                      ) : null}
                    </Stack>
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </Paper>
      ) : null}

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
                      firstBlocker?.severity === 'BLOCKED' ? 'error' : 'warning'
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
                    {group.readiness.blockers.length ? (
                      <CapabilityReadinessPanel
                        caption="Readiness blocker"
                        readiness={group.readiness}
                      />
                    ) : (
                      <Typography color="text.secondary" variant="body2">
                        {group.releases[0]?.description}
                      </Typography>
                    )}
                    {group.readiness.businessOutcome ? (
                      <Typography color="text.secondary" variant="body2">
                        Outcome: {group.readiness.businessOutcome}
                      </Typography>
                    ) : null}
                    <Typography color="text.secondary" variant="body2">
                      {readinessGroupHelp(group.readiness.group)}
                    </Typography>
                    <Typography color="text.secondary" variant="caption">
                      Owner {group.readiness.owningModule} ·{' '}
                      {group.readiness.extendsCapability
                        ? `extends ${group.readiness.extendsCapability} · `
                        : ''}
                      {group.readiness.capabilityCode}
                    </Typography>
                  </Stack>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    sx={{ alignItems: { sm: 'center' }, flexShrink: 0, gap: 1 }}
                  >
                    <Chip
                      color={
                        firstBlocker?.severity === 'BLOCKED'
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

      {props.operationIsSuccess && props.dryRun ? (
        <DryRunSummaryPanel dryRun={props.dryRun} />
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
