import type { AxisLocalizationState } from '../../localization/localizationContracts';
import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import {
  useMutation,
  useQueries,
  useQueryClient,
  type Query,
} from '@tanstack/react-query';
import { createApplicationStatusQueue } from './api/applicationStatusQueue';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import {
  importHistoryRoute,
  resolveImportHistoryHandoff,
} from '../importExport/importHistoryHandoff';
import { resolveMediaPublicationHandoff } from '../readiness/mediaPublicationHandoff';
import {
  applicationReadinessInProgress,
  applicationReadinessCooldownUntil,
  applicationReadinessPollInterval,
} from './api/applicationReadinessPolling';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import { CapabilityReadinessPanel } from '../readiness/CapabilityReadinessPanel';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  createApplicationInitializationClient,
  type ApplicationCapabilityBlocker,
  type ApplicationInitializationProfile,
  type ApplicationInitializationStatus,
  type ApplicationPreparationFailure,
  type ApplicationPreparationStep,
} from './api/applicationInitializationClient';

interface SetupAcceleratorsRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly onBootstrapRefresh?: (() => void | Promise<void>) | undefined;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}

type AcceleratorOperation =
  | 'initiate'
  | 'prepare'
  | 'reconcileApproval'
  | 'rollback'
  | 'retire';

type AcceleratorFilter = string;

type DestructiveAcceleratorOperation = Extract<
  AcceleratorOperation,
  'rollback' | 'retire'
>;

interface DestructiveConfirmationState {
  readonly operation: DestructiveAcceleratorOperation;
  readonly profile: ApplicationInitializationProfile;
  readonly status: ApplicationInitializationStatus;
}

interface RepairConfirmationState {
  readonly operation: Extract<AcceleratorOperation, 'prepare' | 'reconcileApproval'>;
  readonly blocker: ApplicationCapabilityBlocker;
  readonly profile: ApplicationInitializationProfile;
  readonly status: ApplicationInitializationStatus;
}

interface PublicationRecoveryGuidance {
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly route: string;
  readonly actionLabel: string;
  readonly severity: 'success' | 'warning' | 'error' | 'info';
  readonly priority: number;
}

const queryRoot = ['setup-accelerators'] as const;

function stateColor(
  state: string,
): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (state === 'READY') return 'success';
  if (state === 'PUBLICATION_PENDING' || state === 'IMPORTED' || state === 'IMPORTING')
    return 'warning';
  if (state === 'BLOCKED' || state === 'FAILED' || state === 'REJECTED') return 'error';
  if (state === 'NOT_IMPORTED') return 'info';
  return 'default';
}

function operationLabel(
  operation: AcceleratorOperation,
  format: AxisLocalizationState['format'] = (_key, fallback) => fallback,
): string {
  if (operation === 'initiate') return format('backoffice.ui.initialize', 'Initialize');
  if (operation === 'prepare')
    return format('backoffice.ui.prepare-setup', 'Prepare setup');
  if (operation === 'reconcileApproval')
    return format('backoffice.ui.repair-approval', 'Repair approval');
  if (operation === 'rollback') return format('backoffice.ui.rollback', 'Rollback');
  return format('backoffice.ui.retire', 'Retire');
}

function canApprove(status: ApplicationInitializationStatus | undefined): boolean {
  return Boolean(
    status?.readiness === 'PUBLICATION_PENDING' &&
    status.publication?.state === 'PENDING_APPROVAL' &&
    status.capability?.approvalDiagnostic?.status === 'WAITING_REVIEWER' &&
    status.publication.workflowRef,
  );
}

function supportedRepairOperation(
  blocker: ApplicationCapabilityBlocker | undefined,
): RepairConfirmationState['operation'] | undefined {
  if (!blocker?.repair?.available) return undefined;
  if (blocker.repair.operation === 'applicationInitialization.prepareCapability') {
    return 'prepare';
  }
  if (blocker.repair.operation === 'applicationInitialization.reconcileApproval') {
    return 'reconcileApproval';
  }
  return undefined;
}

/** Binds only the owner's available, confirmation-free status descriptor to the existing GET read. */
function supportsReadinessRefresh(blocker: ApplicationCapabilityBlocker): boolean {
  return (
    blocker.repair?.available === true &&
    blocker.repair.action === 'REFRESH_READINESS' &&
    blocker.repair.operation === 'applicationInitialization.status' &&
    blocker.repair.requiresConfirmation === false
  );
}

function firstExecutableRepair(
  status: ApplicationInitializationStatus | undefined,
): ApplicationCapabilityBlocker | undefined {
  if (
    status?.preparation?.status === 'RUNNING' ||
    status?.capability?.businessStatus === 'PREPARING'
  )
    return undefined;
  return status?.capability?.blockers.find((blocker) =>
    Boolean(supportedRepairOperation(blocker)),
  );
}

/** Clears an operation error only after a newer owner read confirms its requested transition. */
function operationConfirmed(
  status: ApplicationInitializationStatus | undefined,
  previous: ApplicationInitializationStatus | undefined,
  operation: AcceleratorOperation | undefined,
): boolean {
  if (!status) return false;
  if (operation === 'prepare')
    return (
      status.preparation?.status === 'CURRENT' &&
      previous?.preparation?.status !== 'CURRENT'
    );
  if (operation === 'initiate')
    return (
      ['PUBLICATION_PENDING', 'READY'].includes(status.readiness) &&
      status.readiness !== previous?.readiness
    );
  return false;
}

function preparationNeedsAction(
  status: ApplicationInitializationStatus | undefined,
): boolean {
  return Boolean(
    status?.preparation &&
    !['CURRENT', 'RUNNING', 'BLOCKED'].includes(status.preparation.status),
  );
}

function preparationBlocked(
  status: ApplicationInitializationStatus | undefined,
): boolean {
  return status?.preparation?.status === 'BLOCKED';
}

function blockedPreparationStep(
  status: ApplicationInitializationStatus | undefined,
): ApplicationPreparationStep | undefined {
  return status?.preparation?.steps.find((step) =>
    [
      'NOT_REGISTERED',
      'NOT_ACTIVE',
      'RUNTIME_OFFLINE',
      'UNAVAILABLE',
      'FAILED',
    ].includes(step.status ?? ''),
  );
}

function blockedActionSummary(
  status: ApplicationInitializationStatus | undefined,
  format: AxisLocalizationState['format'] = (_key, fallback) => fallback,
): string {
  const step = blockedPreparationStep(status);
  if (!step)
    return format(
      'backoffice.ui.required-setup-needs-repair-before-go-live',
      'Required setup needs repair before go-live.',
    );
  const label =
    step.description || step.label || step.kind || friendlyPackageLabel(step.code);
  if (step.type === 'FUNCTIONAL_MODULE') {
    return format(
      'backoffice.ui.register-and-activate-value0-in-module-registry-before-go-live',
      'Register and activate {value0} in Module Registry before go-live.',
      { value0: label },
    );
  }
  if (step.type === 'MEDIA_ASSET_MANIFEST') {
    return format(
      'backoffice.ui.value0-needs-developer-repair-before-go-live',
      '{value0} needs developer repair before go-live.',
      { value0: step.kind || 'Media setup' },
    );
  }
  if (step.status === 'UNAVAILABLE') {
    return format(
      'backoffice.ui.value0-needs-developer-repair-before-go-live',
      '{value0} needs developer repair before go-live.',
      { value0: step.kind || 'Setup data' },
    );
  }
  return format(
    'backoffice.ui.value0-needs-attention-before-go-live',
    '{value0} needs attention before go-live.',
    { value0: step.kind || 'Setup data' },
  );
}

function setupActionLabel(
  status: ApplicationInitializationStatus | undefined,
  format: AxisLocalizationState['format'] = (_key, fallback) => fallback,
): string {
  if (!status) return format('backoffice.ui.initialize', 'Initialize');
  if (status.preparation?.selectionRequired)
    return format('backoffice.ui.initialize', 'Initialize');
  if (status.readiness === 'IMPORTED')
    return format('backoffice.ui.submit-for-review', 'Submit for review');
  if (status.readiness === 'READY' && preparationNeedsAction(status)) {
    return format('backoffice.ui.prepare-setup', 'Prepare setup');
  }
  if (status.readiness === 'READY' && status.releaseStatus === 'UPDATE_AVAILABLE') {
    return format('backoffice.ui.update-staged', 'Update staged');
  }
  return format('backoffice.ui.initialize', 'Initialize');
}

function triggerLabel(
  trigger: string,
  format: AxisLocalizationState['format'] = (_key, fallback) => fallback,
): string {
  if (trigger === 'ACTIVATION') return format('backoffice.ui.activation', 'activation');
  if (trigger === 'USER')
    return format('backoffice.ui.user-triggered', 'user triggered');
  return trigger.toLowerCase();
}

function readinessLabel(
  readiness: string,
  format: AxisLocalizationState['format'] = (_key, fallback) => fallback,
): string {
  if (readiness === 'NOT_IMPORTED')
    return format('backoffice.ui.not-initialized', 'Not initialized');
  if (readiness === 'IMPORTING')
    return format('backoffice.ui.preparing-staged', 'Preparing Staged');
  if (readiness === 'PUBLICATION_PENDING')
    return format('backoffice.ui.approval-in-progress', 'Approval in progress');
  if (readiness === 'MEDIA_DEPENDENCIES_PENDING')
    return format(
      'backoffice.ui.media-publication-required',
      'Media publication required',
    );
  if (readiness === 'PREPARATION_BLOCKED')
    return format('backoffice.ui.preparation-blocked', 'Preparation blocked');
  if (readiness === 'BLOCKED')
    return format('backoffice.ui.setup-blocked', 'Setup blocked');
  if (readiness === 'READY')
    return format('backoffice.ui.online-ready', 'Online ready');
  if (readiness === 'ROLLED_BACK')
    return format('backoffice.ui.rolled-back', 'Rolled back');
  if (readiness === 'FAILED') return format('backoffice.ui.failed', 'Failed');
  if (readiness === 'REJECTED') return format('backoffice.ui.rejected', 'Rejected');
  return readiness.replaceAll('_', ' ').toLowerCase();
}

function capabilityStatusLabel(
  status: ApplicationInitializationStatus,
  format: AxisLocalizationState['format'] = (_key, fallback) => fallback,
): string {
  const capabilityStatus = capabilityBusinessStatus(status);
  if (!capabilityStatus) return readinessLabel(status.readiness, format);
  if (capabilityStatus === 'NOT_PREPARED')
    return format('backoffice.ui.not-prepared', 'Not prepared');
  if (capabilityStatus === 'PREPARING')
    return format('backoffice.ui.preparing-cf1aa6', 'Preparing');
  if (capabilityStatus === 'PREPARED_STAGED')
    return format('backoffice.ui.prepared-staged', 'Prepared staged');
  if (capabilityStatus === 'APPROVAL_REQUIRED')
    return format('backoffice.ui.approval-required', 'Approval required');
  if (capabilityStatus === 'APPROVAL_IN_PROGRESS')
    return format('backoffice.ui.approval-in-progress', 'Approval in progress');
  if (capabilityStatus === 'APPROVED')
    return format('backoffice.ui.approved', 'Approved');
  if (capabilityStatus === 'ONLINE')
    return format('backoffice.ui.online-ready', 'Online ready');
  if (capabilityStatus === 'NEEDS_ATTENTION')
    return format('backoffice.ui.needs-attention', 'Needs attention');
  if (capabilityStatus === 'RETIRED') return format('backoffice.ui.retired', 'Retired');
  return capabilityStatus.replaceAll('_', ' ').toLowerCase();
}

function capabilityStatusColor(
  status: ApplicationInitializationStatus,
): 'success' | 'warning' | 'error' | 'info' | 'default' {
  const capabilityStatus = capabilityBusinessStatus(status);
  if (capabilityStatus === 'ONLINE') return 'success';
  if (capabilityStatus === 'NEEDS_ATTENTION') return 'error';
  if (
    capabilityStatus === 'APPROVAL_REQUIRED' ||
    capabilityStatus === 'APPROVAL_IN_PROGRESS' ||
    capabilityStatus === 'PREPARED_STAGED' ||
    capabilityStatus === 'PREPARING'
  )
    return 'warning';
  if (capabilityStatus === 'NOT_PREPARED') return 'info';
  return stateColor(status.readiness);
}

function capabilityBusinessStatus(
  status: ApplicationInitializationStatus | undefined,
): string | undefined {
  const businessStatus = status?.capability?.businessStatus;
  if (
    businessStatus === 'ONLINE' &&
    (status?.readiness !== 'READY' ||
      status.capability?.blockers.some((blocker) =>
        ['ERROR', 'BLOCKED', 'REPAIR_REQUIRED'].includes(blocker.severity),
      ))
  )
    return 'NEEDS_ATTENTION';
  return businessStatus;
}

function capabilityIsOnline(
  status: ApplicationInitializationStatus | undefined,
): boolean {
  const businessStatus = capabilityBusinessStatus(status);
  return businessStatus ? businessStatus === 'ONLINE' : status?.readiness === 'READY';
}

function capabilityNeedsApproval(
  status: ApplicationInitializationStatus | undefined,
): boolean {
  const businessStatus = capabilityBusinessStatus(status);
  return (
    businessStatus === 'APPROVAL_IN_PROGRESS' ||
    status?.readiness === 'PUBLICATION_PENDING'
  );
}

function capabilityNeedsAction(
  profile: ApplicationInitializationProfile,
  status: ApplicationInitializationStatus | undefined,
): boolean {
  if (!status) return false;
  const businessStatus = capabilityBusinessStatus(status);
  if (businessStatus) {
    return !['ONLINE', 'RETIRED'].includes(businessStatus);
  }
  return (
    !isCustomizationProfile(profile) &&
    (status?.readiness !== 'READY' || status?.releaseStatus === 'UPDATE_AVAILABLE')
  );
}

function preparationStatusLabel(
  status: string | undefined,
  trigger: string,
  format: AxisLocalizationState['format'] = (_key, fallback) => fallback,
): string {
  if (!status) return triggerLabel(trigger, format);
  if (status === 'SOURCE_READY')
    return format('backoffice.ui.source-ready', 'Source ready');
  if (status === 'AUTHORITY_PENDING')
    return format('backoffice.ui.authority-pending', 'Authority pending');
  if (status === 'CURRENT') return format('backoffice.ui.current', 'Current');
  if (status === 'NOT_INSTALLED')
    return format('backoffice.ui.not-installed', 'Not installed');
  if (status === 'NOT_REGISTERED')
    return format('backoffice.ui.register-required', 'Register required');
  if (status === 'NOT_ACTIVE')
    return format('backoffice.ui.activate-required', 'Activate required');
  if (status === 'RUNTIME_OFFLINE')
    return format('backoffice.ui.runtime-offline', 'Runtime offline');
  if (status === 'UPDATE_AVAILABLE')
    return format('backoffice.ui.update-available', 'Update available');
  if (status === 'UNAVAILABLE')
    return format('backoffice.ui.unavailable', 'Unavailable');
  if (status === 'OPTIONAL') return format('backoffice.ui.optional', 'Optional');
  if (status === 'FAILED') return format('backoffice.ui.failed', 'Failed');
  return status.replaceAll('_', ' ').toLowerCase();
}

function releaseStatusLabel(
  status: string | undefined,
  format: AxisLocalizationState['format'] = (_key, fallback) => fallback,
): string {
  if (status === 'CURRENT')
    return format('backoffice.ui.staged-current', 'Staged current');
  if (status === 'UPDATE_AVAILABLE')
    return format('backoffice.ui.staged-update-available', 'Staged update available');
  if (status === 'DOWNGRADE_AVAILABLE')
    return format(
      'backoffice.ui.staged-source-older',
      'Selected source is older than installed',
    );
  if (status === 'NOT_INSTALLED')
    return format('backoffice.ui.staged-not-installed', 'Staged not installed');
  if (status === 'IMPORTING')
    return format('backoffice.ui.staged-importing', 'Staged importing');
  if (status === 'INVALID_RELEASE')
    return format('backoffice.ui.staged-invalid-release', 'Staged invalid release');
  return status
    ? format('backoffice.ui.staged-value0', 'Staged {value0}', {
        value0: status.replaceAll('_', ' ').toLowerCase(),
      })
    : format('backoffice.ui.staged-checking', 'Staged checking');
}

function releaseStatusColor(
  status: string | undefined,
): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'CURRENT') return 'success';
  if (status === 'INVALID_RELEASE') return 'error';
  if (status === 'UPDATE_AVAILABLE' || status === 'IMPORTING') return 'warning';
  return 'default';
}

function preparationStatusColor(
  status: string | undefined,
): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'CURRENT' || status === 'SOURCE_READY') return 'success';
  if (
    status === 'UNAVAILABLE' ||
    status === 'FAILED' ||
    status === 'NOT_REGISTERED' ||
    status === 'NOT_ACTIVE' ||
    status === 'RUNTIME_OFFLINE'
  )
    return 'error';
  if (status === 'OPTIONAL') return 'default';
  return 'warning';
}

function friendlyPackageLabel(code: string): string {
  return code
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[:._-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/\b\w/gu, (value) => value.toUpperCase());
}

function conciseReleaseLabel(
  profile: ApplicationInitializationProfile,
  status: ApplicationInitializationStatus,
): string {
  const label = friendlyPackageLabel(status.releaseCode);
  const version = status.releaseVersion;
  const family = acceleratorFamily(profile);
  if (family.startsWith('Agora')) {
    if (/content catalog/iu.test(label)) return `Content catalog ${version}`;
    if (/commerce catalog/iu.test(label)) return `Commerce catalog ${version}`;
    return `Storefront release ${version}`;
  }
  if (family.startsWith('Nexus')) {
    if (/partner/iu.test(label)) return `Partner customization ${version}`;
    return `Corporate site ${version}`;
  }
  if (profile.kind !== 'PROJECT') return `Documentation pack ${version}`;
  return `${label} ${version}`;
}

function displayProfileTitle(profile: ApplicationInitializationProfile): string {
  const family = acceleratorFamily(profile);
  if (family.startsWith('Nexus')) return 'Nexus corporate site';
  if (family.startsWith('Agora')) return family;
  if (profile.kind !== 'PROJECT') {
    return profile.title.replace(/\s+documentation$/iu, ' docs');
  }
  return profile.title;
}

function profileErrorMessage(
  profile: ApplicationInitializationProfile,
  message: string,
): string {
  if (/Application initialization target is unavailable/i.test(message)) {
    return `${profile.title} cannot read baseline ${profile.baselineCode}. Check WCMS Staged baseline configuration, release qualification, and required runtime availability.`;
  }
  return message;
}

function acceleratorFamily(profile: ApplicationInitializationProfile): string {
  const code =
    `${profile.code} ${profile.applicationCode} ${profile.siteCode} ${profile.title}`.toLowerCase();
  if (code.includes('nexus')) return 'Nexus corporate site';
  if (code.includes('apparel')) return 'Agora Apparel';
  if (code.includes('electronics')) return 'Agora Electronics';
  if (code.includes('telco')) return 'Agora Telco';
  if (profile.kind === 'PROJECT') return 'Project accelerator';
  return 'Documentation pack';
}

function profilePublishChannel(profile: ApplicationInitializationProfile): string {
  if (profile.kind !== 'PROJECT') return 'Axis Documentation';
  if (isCustomizationProfile(profile)) return 'Customer customization';
  const family = acceleratorFamily(profile);
  if (family.startsWith('Nexus')) return 'Nexus public channel';
  if (family.startsWith('Agora')) return 'Agora storefront channel';
  return 'Customer-facing channel';
}

function isCustomizationProfile(profile: ApplicationInitializationProfile): boolean {
  return (
    profile.category === 'customization' ||
    profile.type.toLocaleLowerCase().includes('customization')
  );
}

function nextActionText(
  status: ApplicationInitializationStatus | undefined,
  format: AxisLocalizationState['format'] = (_key, fallback) => fallback,
): string {
  if (!status) return format('backoffice.ui.status-unavailable', 'Status unavailable');
  if (status.capability?.nextAction) return status.capability.nextAction;
  if (status.preparation?.selectionRequired)
    return format(
      'backoffice.ui.required-setup-stages-remain-pending',
      'Required setup stages remain pending.',
    );
  if (preparationBlocked(status)) {
    return blockedActionSummary(status, format);
  }
  if (preparationNeedsAction(status)) {
    return format(
      'backoffice.ui.required-setup-data-needs-preparation',
      'Required setup data needs preparation.',
    );
  }
  if (status.readiness === 'READY' && status.releaseStatus === 'UPDATE_AVAILABLE') {
    return format(
      'backoffice.ui.staged-has-a-newer-package-available',
      'Staged has a newer package available.',
    );
  }
  if (status.releaseStatus === 'INVALID_RELEASE') {
    return format(
      'backoffice.ui.release-version-update-required-before-this-can-be-initialized',
      'Release version update required before this can be initialized.',
    );
  }
  if (status.readiness === 'READY')
    return format(
      'backoffice.ui.online-channel-is-available',
      'Online channel is available.',
    );
  if (status.readiness === 'PUBLICATION_PENDING') {
    return format(
      'backoffice.ui.waiting-for-reviewer-decision',
      'Waiting for reviewer decision.',
    );
  }
  if (status.readiness === 'IMPORTING') {
    return format(
      'backoffice.ui.staged-setup-is-running-status-refreshes-automatically',
      'Staged setup is running; status refreshes automatically.',
    );
  }
  if (status.readiness === 'FAILED')
    return format(
      'backoffice.ui.last-attempt-failed-retry-after-fix',
      'Last attempt failed; retry after fix.',
    );
  return format('backoffice.ui.ready-to-initialize', 'Ready to initialize.');
}

function publicationRecoveryGuidance(
  profile: ApplicationInitializationProfile,
  status: ApplicationInitializationStatus | undefined,
  bootstrap: AxisAuthenticatedBootstrap,
  observedFailure?: ApplicationPreparationFailure,
  format: AxisLocalizationState['format'] = (_key, fallback) => fallback,
): PublicationRecoveryGuidance {
  const title = displayProfileTitle(profile);
  const importFailure =
    status?.preparation?.operationFailure ??
    observedFailure ??
    status?.capability?.blockers.find(
      (blocker) =>
        blocker.code === 'IMPORT_FAILED' &&
        (blocker.owner === 'import' || blocker.ownerType === 'DATA_RELEASE'),
    );
  const historyBlocker = status?.capability?.blockers.find(
    (blocker) =>
      blocker.code === 'IMPORT_FAILED' &&
      blocker.repair?.action === 'REVIEW_IMPORT_HISTORY' &&
      blocker.targetServer === importFailure?.targetServer &&
      blocker.targetRuntimeRole === importFailure?.targetRuntimeRole,
  );
  const historyAllowed =
    !historyBlocker ||
    (historyBlocker.repair?.available === true &&
      historyBlocker.repair.operation === '' &&
      historyBlocker.repair.requiresConfirmation === false);
  const handoff =
    historyBlocker?.repair?.handoff ??
    (importFailure && 'historyHandoff' in importFailure
      ? importFailure.historyHandoff
      : undefined);
  if (importFailure)
    return {
      key: `${profile.code}:import-failed`,
      title: format(
        'backoffice.ui.value0-import-needs-review',
        '{value0}: import needs review',
        { value0: title },
      ),
      body: importFailure.message,
      route: historyAllowed
        ? (resolveImportHistoryHandoff(bootstrap, handoff) ?? '')
        : '',
      actionLabel: format(
        'backoffice.ui.review-import-history',
        'Review import history',
      ),
      severity: 'error',
      priority: 10,
    };
  if (!status) {
    return {
      key: `${profile.code}:status-unavailable`,
      title: format(
        'backoffice.ui.value0-status-unavailable',
        '{value0}: status unavailable',
        { value0: title },
      ),
      body: format(
        'backoffice.ui.refresh-setup-status-before-taking-publication-action',
        'Refresh setup status before taking publication action.',
      ),
      route: '/publishing',
      actionLabel: format('backoffice.ui.open-publishing', 'Open Publishing'),
      severity: 'warning',
      priority: 60,
    };
  }
  if (status.releaseStatus === 'INVALID_RELEASE') {
    return {
      key: `${profile.code}:invalid-release`,
      title: format(
        'backoffice.ui.value0-release-needs-repair',
        '{value0}: release needs repair',
        { value0: title },
      ),
      body:
        status.capability?.disabledReason ??
        format(
          'backoffice.ui.the-source-release-manifest-or-descriptor-is-invalid-repair-the-owning-m',
          'The source release manifest or descriptor is invalid. Repair the owning module release, rebuild, and refresh before installing.',
        ),
      route: '/operations/imports-exports',
      actionLabel: format('backoffice.ui.open-data-releases', 'Open Data Releases'),
      severity: 'error',
      priority: 10,
    };
  }
  const prerequisiteBlocker = status.capability?.blockers.find(
    (blocker) =>
      blocker.code === 'READINESS_VALIDATION_BLOCKED' &&
      blocker.repair?.action === 'REVIEW_SETUP_PREREQUISITES' &&
      blocker.repair.available === false &&
      blocker.repair.operation === '',
  );
  const prerequisiteRepair = prerequisiteBlocker?.repair;
  if (
    prerequisiteBlocker &&
    prerequisiteRepair &&
    !status.capability?.blockers.some((blocker) =>
      ['MODULE_INACTIVE', 'RUNTIME_UNAVAILABLE', 'MISSING_DEPENDENCY'].includes(
        blocker.code,
      ),
    )
  ) {
    const targetServer =
      prerequisiteBlocker.targetServer ?? prerequisiteRepair.targetServer;
    const targetRuntimeRole =
      prerequisiteBlocker.targetRuntimeRole ?? prerequisiteRepair.targetRuntimeRole;
    const compatibleTarget =
      (!prerequisiteBlocker.targetServer ||
        !prerequisiteRepair.targetServer ||
        prerequisiteBlocker.targetServer === prerequisiteRepair.targetServer) &&
      (!prerequisiteBlocker.targetRuntimeRole ||
        !prerequisiteRepair.targetRuntimeRole ||
        prerequisiteBlocker.targetRuntimeRole === prerequisiteRepair.targetRuntimeRole);
    const importNavigation = bootstrap.navigation.filter(
      (item) => item.id === 'imports-exports' && item.moduleName === 'backoffice',
    );
    return {
      key: `${profile.code}:prerequisites-held`,
      title: format(
        'backoffice.ui.value0-setup-prerequisites-need-review',
        '{value0}: setup prerequisites need review',
        { value0: title },
      ),
      body: prerequisiteBlocker.disabledReason ?? prerequisiteBlocker.message,
      route:
        compatibleTarget && importNavigation.length === 1
          ? (importHistoryRoute(bootstrap, { targetServer, targetRuntimeRole }) ?? '')
          : '',
      actionLabel: prerequisiteRepair.label,
      severity: 'error',
      priority: 20,
    };
  }
  if (status.preparation?.selectionRequired) {
    return {
      key: `${profile.code}:operator-stages`,
      title: format(
        'backoffice.ui.value0-required-setup-stages',
        '{value0}: required setup stages',
        { value0: title },
      ),
      body:
        status.capability?.nextAction ??
        format(
          'backoffice.ui.required-setup-stages-remain-pending',
          'Required setup stages remain pending.',
        ),
      route: '',
      actionLabel: format('backoffice.ui.review-setup-stages', 'Review setup stages'),
      severity: 'warning',
      priority: 20,
    };
  }
  if (
    status.allowedActions.includes('INITIALIZE') &&
    !preparationBlocked(status) &&
    status.releaseStatus !== 'INVALID_RELEASE'
  ) {
    return {
      key: `${profile.code}:initialize-available`,
      title: format('backoffice.ui.value0-value1', '{value0}: {value1}', {
        value0: title,
        value1:
          status.readiness === 'IMPORTED'
            ? format('backoffice.ui.ready-to-submit', 'ready to submit')
            : format('backoffice.ui.ready-to-prepare', 'ready to prepare'),
      }),
      body:
        status.readiness === 'IMPORTED'
          ? format(
              'backoffice.ui.staged-setup-is-current-submit-its-publication-for-normal-review-before-',
              'Staged setup is current. Submit its publication for normal review before Online delivery.',
            )
          : format(
              'backoffice.ui.use-the-profile-action-to-install-the-governed-setup-data-before-publica',
              'Use the profile action to install the governed setup data before publication.',
            ),
      route: '',
      actionLabel: setupActionLabel(status, format),
      severity: 'success',
      priority: 50,
    };
  }
  if (preparationBlocked(status)) {
    return {
      key: `${profile.code}:preparation-blocked`,
      title: format('backoffice.ui.value0-setup-blocked', '{value0}: setup blocked', {
        value0: title,
      }),
      body: blockedActionSummary(status, format),
      route: '/registry',
      actionLabel: format('backoffice.ui.open-module-registry', 'Open Module Registry'),
      severity: 'error',
      priority: 20,
    };
  }
  if (status.capability?.businessStatus === 'NEEDS_ATTENTION') {
    const blocker = status.capability.blockers[0];
    return {
      key: `${profile.code}:needs-attention`,
      title: format(
        'backoffice.ui.value0-needs-attention',
        '{value0}: needs attention',
        { value0: title },
      ),
      body:
        blocker?.message ??
        status.capability.nextAction ??
        format(
          'backoffice.ui.resolve-the-backend-owned-readiness-blocker-before-continuing-publicatio',
          'Resolve the backend-owned readiness blocker before continuing publication.',
        ),
      route:
        blocker?.owner?.toLowerCase().includes('process') ||
        blocker?.source?.toLowerCase().includes('process')
          ? '/process/tasks'
          : '/publishing',
      actionLabel:
        blocker?.owner?.toLowerCase().includes('process') ||
        blocker?.source?.toLowerCase().includes('process')
          ? format('backoffice.ui.open-process-tasks', 'Open Process Tasks')
          : format('backoffice.ui.open-publishing', 'Open Publishing'),
      severity: 'error',
      priority: 25,
    };
  }
  if (preparationNeedsAction(status)) {
    return {
      key: `${profile.code}:prepare-setup`,
      title: format(
        'backoffice.ui.value0-prepare-staged-setup',
        '{value0}: prepare staged setup',
        { value0: title },
      ),
      body: format(
        'backoffice.ui.install-or-update-required-staged-setup-data-before-requesting-online-ap',
        'Install or update required staged setup data before requesting Online approval.',
      ),
      route: '/operations/imports-exports',
      actionLabel: format('backoffice.ui.open-data-releases', 'Open Data Releases'),
      severity: 'warning',
      priority: 30,
    };
  }
  if (status.capability?.businessStatus === 'APPROVAL_REQUIRED') {
    return {
      key: `${profile.code}:approval-required`,
      title: format(
        'backoffice.ui.value0-approval-required',
        '{value0}: approval required',
        { value0: title },
      ),
      body: format(
        'backoffice.ui.staged-content-is-prepared-request-or-reconcile-the-governed-publication',
        'Staged content is prepared. Request or reconcile the governed publication approval before Online publication.',
      ),
      route: '/publishing',
      actionLabel: format('backoffice.ui.open-publishing', 'Open Publishing'),
      severity: 'warning',
      priority: 35,
    };
  }
  if (
    status.capability?.businessStatus === 'APPROVAL_IN_PROGRESS' ||
    status.readiness === 'PUBLICATION_PENDING'
  ) {
    const diagnostic = status.capability?.approvalDiagnostic;
    return {
      key: `${profile.code}:approval-in-progress`,
      title: format(
        'backoffice.ui.value0-review-approval-task',
        '{value0}: review approval task',
        { value0: title },
      ),
      body:
        diagnostic?.message ??
        format(
          'backoffice.ui.publication-approval-is-in-progress-review-the-actionable-process-task-a',
          'Publication approval is in progress. Review the actionable Process task, assignee, queue, and permissions.',
        ),
      route: '/process/tasks',
      actionLabel: format('backoffice.ui.open-approval-queue', 'Open Approval Queue'),
      severity: 'warning',
      priority: 40,
    };
  }
  if (status.capability?.businessStatus === 'APPROVED') {
    return {
      key: `${profile.code}:approved`,
      title: format('backoffice.ui.value0-publish-online', '{value0}: publish Online', {
        value0: title,
      }),
      body: format(
        'backoffice.ui.publication-approval-is-complete-continue-through-governed-publishing-to',
        'Publication approval is complete. Continue through governed publishing to make the channel Online.',
      ),
      route: '/publishing',
      actionLabel: format('backoffice.ui.open-publishing', 'Open Publishing'),
      severity: 'info',
      priority: 45,
    };
  }
  if (capabilityIsOnline(status)) {
    return {
      key: `${profile.code}:online`,
      title: format('backoffice.ui.value0-online-ready', '{value0}: Online ready', {
        value0: title,
      }),
      body: format(
        'backoffice.ui.online-channel-is-available-use-browser-validation-or-the-public-applica',
        'Online channel is available. Use browser validation or the public application to verify the published experience.',
      ),
      route: '/publishing',
      actionLabel: format('backoffice.ui.open-publishing', 'Open Publishing'),
      severity: 'success',
      priority: 90,
    };
  }
  return {
    key: `${profile.code}:initialize`,
    title: format(
      'backoffice.ui.value0-initialize-staged-baseline',
      '{value0}: initialize staged baseline',
      { value0: title },
    ),
    body: format(
      'backoffice.ui.initialize-the-governed-baseline-then-follow-staged-setup-approval-and-o',
      'Initialize the governed baseline, then follow staged setup, approval, and Online publication.',
    ),
    route: '/publishing',
    actionLabel: format('backoffice.ui.open-publishing', 'Open Publishing'),
    severity: 'info',
    priority: 50,
  };
}

function rowGuidanceLabel(
  guidance: PublicationRecoveryGuidance,
  format: AxisLocalizationState['format'] = (_key, fallback) => fallback,
): string {
  if (guidance.priority <= 25) return format('backoffice.ui.fix-first', 'Fix first');
  if (guidance.priority <= 35) return format('backoffice.ui.prepare', 'Prepare');
  if (guidance.priority <= 45) return format('backoffice.ui.approval', 'Approval');
  if (guidance.priority >= 90) return format('backoffice.ui.verify', 'Verify');
  return format('backoffice.ui.next', 'Next');
}

function SetupMetric({
  color = 'default',
  label,
  value,
}: {
  readonly color?: 'default' | 'success' | 'warning' | 'info';
  readonly label: string;
  readonly value: number;
}) {
  const { locale } = useAxisLocalization();
  return (
    <Box
      sx={{
        alignItems: 'center',
        bgcolor: 'action.hover',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        display: 'flex',
        gap: 0.75,
        minHeight: 40,
        px: 1,
        py: 0.5,
      }}
    >
      <Typography
        sx={{
          color:
            color === 'success'
              ? 'success.main'
              : color === 'warning'
                ? 'warning.main'
                : color === 'info'
                  ? 'info.main'
                  : 'text.primary',
          fontWeight: 800,
          lineHeight: 1,
        }}
        variant="subtitle2"
        component="p"
      >
        {new Intl.NumberFormat(locale).format(value)}
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ fontWeight: 700, lineHeight: 1.1 }}
        variant="caption"
      >
        {label}
      </Typography>
    </Box>
  );
}

function SetupStatusChip({
  color = 'default',
  label,
  variant = 'filled',
}: {
  readonly color?: 'success' | 'warning' | 'error' | 'info' | 'default';
  readonly label: string;
  readonly variant?: 'filled' | 'outlined';
}) {
  return (
    <Chip
      color={color}
      label={label}
      size="small"
      sx={{
        borderRadius: 1,
        fontWeight: 700,
        justifyContent: 'flex-start',
        maxWidth: '100%',
        minWidth: { md: 148 },
        '& .MuiChip-label': {
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      }}
      variant={variant}
    />
  );
}

function RowIconAction({
  disabled = false,
  label,
  name,
  onClick,
}: {
  readonly disabled?: boolean;
  readonly label: string;
  readonly name: string;
  readonly onClick: () => void;
}) {
  return (
    <Tooltip arrow title={label}>
      <span>
        <IconButton
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          size="small"
          sx={{
            border: 1,
            borderColor: 'divider',
            height: 36,
            width: 36,
          }}
        >
          <ShellIcon fontSize="small" name={name} />
        </IconButton>
      </span>
    </Tooltip>
  );
}

export function SetupAcceleratorsRoutePage(props: SetupAcceleratorsRoutePageProps) {
  const { format: workflowText } = useAxisLocalization();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusedProfile = searchParams.get('profile');
  const canOpenRoute = (route: string) =>
    props.bootstrap.navigation.some(
      (item) =>
        item.route === route.split('?')[0] &&
        ['ACTIVE', 'PREVIEW'].includes(item.featureState ?? 'ACTIVE') &&
        ['UP', 'DEGRADED'].includes(item.availability),
    );
  const [filter, setFilter] = useState<AcceleratorFilter>('ALL');
  const [setupSearch, setSetupSearch] = useState('');
  const expandedProfile = searchParams.get('expanded') ?? undefined;
  const setExpandedProfile = (value: string | undefined) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('expanded', value ?? '');
        return next;
      },
      { replace: true },
    );
  };
  const [destructiveConfirmation, setDestructiveConfirmation] =
    useState<DestructiveConfirmationState>();
  const [destructiveReason, setDestructiveReason] = useState('');
  const [repairConfirmation, setRepairConfirmation] =
    useState<RepairConfirmationState>();
  const backofficeConnection = selectModuleConnection(props.bootstrap, 'backoffice');
  const reviewNavigation = props.bootstrap.navigation.find(
    (item) =>
      item.moduleName === 'workflow' &&
      item.id === 'process-tasks' &&
      canOpenRoute(item.route),
  );
  const profiles = useMemo(
    () =>
      (props.bootstrap.applicationInitializationProfiles ?? [])
        .filter((profile) => !focusedProfile || profile.code === focusedProfile)
        .slice()
        .sort((left, right) => left.order - right.order),
    [props.bootstrap.applicationInitializationProfiles, focusedProfile],
  );
  const readinessPolicy = props.bootstrap.applicationReadinessScheduling;
  const contractVersion = readinessPolicy?.contractVersion;
  const concurrency = readinessPolicy?.concurrency;
  const priorityBurst = readinessPolicy?.priorityBurst;
  // Bootstrap replaces DTO objects during registry refresh; only effective owner values retire work.
  const readinessOwnerKey = JSON.stringify(
    backofficeConnection
      ? [
          backofficeConnection.moduleName,
          backofficeConnection.instanceId,
          backofficeConnection.endpoint,
          backofficeConnection.environment,
          backofficeConnection.server,
          backofficeConnection.runtimeRole?.code,
          backofficeConnection.runtimeRole?.publication,
          backofficeConnection.state,
        ]
      : null,
  );
  const statusQueue = useMemo(() => {
    // A new authenticated owner scope gets a queue, never another scope's evidence.
    void props.accessToken;
    void props.runtime.enterpriseCode;
    void readinessOwnerKey;
    return createApplicationStatusQueue(
      contractVersion === undefined ||
        concurrency === undefined ||
        priorityBurst === undefined
        ? undefined
        : { contractVersion, concurrency, priorityBurst },
    );
  }, [
    props.accessToken,
    props.runtime.enterpriseCode,
    readinessOwnerKey,
    contractVersion,
    concurrency,
    priorityBurst,
  ]);
  useEffect(() => {
    statusQueue.activate();
    return () => statusQueue.deactivate();
  }, [statusQueue]);
  useEffect(() => statusQueue.prefer(expandedProfile), [statusQueue, expandedProfile]);
  const clients = useMemo(() => {
    if (!backofficeConnection)
      return new Map<
        string,
        ReturnType<typeof createApplicationInitializationClient>
      >();
    return new Map(
      profiles.map((profile) => [
        profile.code,
        createApplicationInitializationClient({
          connection: backofficeConnection,
          enterpriseCode: props.runtime.enterpriseCode,
          accessToken: props.accessToken,
          timeoutMs: props.runtime.requestTimeoutMs,
          profileCode: profile.code,
          statusQueue,
        }),
      ]),
    );
  }, [
    props.accessToken,
    props.runtime.enterpriseCode,
    props.runtime.requestTimeoutMs,
    backofficeConnection,
    profiles,
    statusQueue,
  ]);
  const polling = useMemo(
    () => ({ clients, started: new Map<string, number>() }),
    [clients],
  );
  // A choice belongs to one session/client set and one fresh owner status, never a remembered grant.
  const [stageSelections, setStageSelections] = useState<{
    clients: typeof clients;
    choices: Record<string, { code: string; status: ApplicationInitializationStatus }>;
  }>();
  const [cooldownTick, setCooldownTick] = useState(() => Date.now());
  const queries = useQueries({
    queries: profiles.map((profile) => ({
      enabled: Boolean(backofficeConnection),
      queryKey: [...queryRoot, profile.code],
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      queryFn: ({ signal }) => {
        const client = polling.clients.get(profile.code);
        if (!client)
          throw new Error('BackOffice application initialization is unavailable');
        return client.getStatus(signal);
      },
      refetchInterval: (
        query: Query<
          ApplicationInitializationStatus,
          Error,
          ApplicationInitializationStatus,
          readonly unknown[]
        >,
      ) => {
        if (!applicationReadinessInProgress(query.state.data)) {
          polling.started.delete(profile.code);
          return false;
        }
        const startedAt = polling.started.get(profile.code) ?? Date.now();
        polling.started.set(profile.code, startedAt);
        return applicationReadinessPollInterval(
          query.state.data,
          query.state.error,
          query.state.dataUpdateCount,
          startedAt,
          Date.now(),
          query.state.dataUpdatedAt,
        );
      },
    })),
  });
  useEffect(() => {
    const now = Date.now();
    const deadlines = queries
      .map((query) =>
        applicationReadinessCooldownUntil(query.data, query.error, query.dataUpdatedAt),
      )
      .filter((deadline) => deadline > now);
    if (!deadlines.length) return;
    const timer = window.setTimeout(
      () => setCooldownTick(Date.now()),
      Math.min(...deadlines) - now,
    );
    return () => window.clearTimeout(timer);
  }, [queries, cooldownTick]);
  const mutation = useMutation({
    retry: false,
    onMutate: (variables) => ({
      statusUpdatedAt:
        queryClient.getQueryState([...queryRoot, variables.profile.code])
          ?.dataUpdatedAt ?? 0,
    }),
    mutationFn: async ({
      profile,
      status,
      operation,
      reason,
      afterPublicationStepCode,
    }: {
      readonly profile: ApplicationInitializationProfile;
      readonly status?: ApplicationInitializationStatus | undefined;
      readonly operation: AcceleratorOperation;
      readonly reason?: string | undefined;
      readonly afterPublicationStepCode?: string | undefined;
    }) => {
      const client = clients.get(profile.code);
      if (!client)
        throw new Error('BackOffice application initialization is unavailable');
      statusQueue.prioritize(profile.code);
      const current = queryClient.getQueryState<ApplicationInitializationStatus>([
        ...queryRoot,
        profile.code,
      ]);
      if (
        !current?.data ||
        current.status === 'error' ||
        current.fetchStatus === 'fetching'
      )
        throw new Error('Refresh setup status before taking action.');
      if (
        operation === 'initiate' &&
        !current.data.allowedActions.includes('INITIALIZE')
      )
        throw new Error('Initialization is not available in the current setup state.');
      if (
        (operation === 'prepare' || operation === 'reconcileApproval') &&
        (current.data !== status ||
          !current.data.capability?.blockers.some(
            (blocker) => supportedRepairOperation(blocker) === operation,
          ))
      )
        throw new Error(
          'Refresh setup status. This repair is not available to the current operator.',
        );
      if (
        (operation === 'rollback' || operation === 'retire') &&
        (current.data !== status ||
          !current.data.allowedActions.includes(
            operation === 'rollback' ? 'ROLLBACK' : 'RETIRE',
          ))
      )
        throw new Error(
          'Refresh setup status. This lifecycle action is not available to the current operator.',
        );
      if (operation === 'initiate') {
        const preparation = current.data.preparation;
        if (
          preparation?.selectionRequired &&
          (current.data !== status ||
            !afterPublicationStepCode ||
            !preparation.selectableStepCodes?.includes(afterPublicationStepCode))
        )
          throw new Error(
            'Select an available setup stage from the current owner status.',
          );
        if (afterPublicationStepCode && !preparation?.selectionRequired)
          throw new Error(
            'Setup stage selection is not available in the current owner status.',
          );
      }
      if (operation === 'prepare') {
        return client.prepare({
          forceRefresh: true,
          reason:
            reason ??
            `${profile.title} setup preparation repair requested from Setup & Accelerators`,
        });
      }
      if (operation === 'reconcileApproval') {
        return client.reconcileApproval({
          forceRefresh: true,
          reason:
            reason ??
            `${profile.title} approval reconciliation repair requested from Setup & Accelerators`,
        });
      }
      if (operation === 'rollback') return client.rollback({ reason });
      if (operation === 'retire') return client.retire({ reason });
      return client.initiate({ afterPublicationStepCode });
    },
    onSuccess: async (status, variables) => {
      if (variables.operation === 'rollback' || variables.operation === 'retire') {
        setDestructiveConfirmation(undefined);
        setDestructiveReason('');
      }
      if (
        variables.operation === 'prepare' ||
        variables.operation === 'reconcileApproval'
      ) {
        setRepairConfirmation(undefined);
      }
      queryClient.setQueryData([...queryRoot, variables.profile.code], status);
      statusQueue.prioritize(variables.profile.code);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [...queryRoot, variables.profile.code],
          exact: true,
        }),
        props.onBootstrapRefresh?.(),
      ]);
    },
    onError: async (_error, variables) => {
      statusQueue.prioritize(variables.profile.code);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [...queryRoot, variables.profile.code],
          exact: true,
        }),
        props.onBootstrapRefresh?.(),
      ]);
    },
  });
  // An operation receipt may not be persisted by the subsequent status GET.
  // Keep it diagnostic-only; fresh query data remains every mutation's authority.
  const observedImportFailure = (
    profileCode: string,
    status: ApplicationInitializationStatus | undefined,
  ) => {
    if (mutation.variables?.profile.code !== profileCode) return undefined;
    const failure = mutation.data?.preparation?.operationFailure;
    if (!failure) return undefined;
    const steps = status?.preparation?.steps ?? [];
    const confirmed =
      failure.releaseCodes.length > 0 &&
      failure.releaseCodes.every((code) =>
        steps.some(
          (step) =>
            step.code === code &&
            step.targetServer === failure.targetServer &&
            step.targetRuntimeRole === failure.targetRuntimeRole &&
            step.status === 'CURRENT',
        ),
      );
    return confirmed ? undefined : failure;
  };
  type AcceleratorStatusQuery = (typeof queries)[number];
  const statuses = profiles
    .map((profile, index) => {
      const query = queries[index];
      if (!query) return undefined;
      return { profile, query };
    })
    .filter(
      (
        item,
      ): item is {
        readonly profile: ApplicationInitializationProfile;
        readonly query: AcceleratorStatusQuery;
      } => Boolean(item),
    );
  // Query availability is not business readiness, including during cached refresh.
  const settledStatuses = statuses.filter(
    (item) => item.query.isSuccess && !item.query.isFetching,
  );
  const loadingCount = statuses.filter(
    (item) => item.query.isPending || item.query.isFetching,
  ).length;
  const unavailableCount = statuses.filter(
    (item) => item.query.isError && !item.query.isFetching,
  ).length;
  const readyCount = settledStatuses.filter((item) =>
    capabilityIsOnline(item.query.data),
  ).length;
  const pendingCount = settledStatuses.filter((item) =>
    capabilityNeedsApproval(item.query.data),
  ).length;
  const actionCount = settledStatuses.filter((item) =>
    capabilityNeedsAction(item.profile, item.query.data),
  ).length;
  const matchesSetupSearch = (profile: ApplicationInitializationProfile) => {
    const term = setupSearch.trim().toLocaleLowerCase();
    return (
      !term ||
      [profile.title, profile.code, profile.summary, profile.category, profile.owner]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(term)
    );
  };
  const recoveryGuidance = statuses
    .filter(
      (item) =>
        matchesSetupSearch(item.profile) && !item.query.isPending && !item.query.error,
    )
    .map((item) =>
      publicationRecoveryGuidance(
        item.profile,
        item.query.data,
        props.bootstrap,
        observedImportFailure(item.profile.code, item.query.data),
        workflowText,
      ),
    )
    .filter((item) => item.severity !== 'success')
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 4);
  const filteredStatuses = statuses.filter((item) => {
    if (!matchesSetupSearch(item.profile)) return false;
    if (filter === 'ALL') return true;
    if (filter === 'NEEDS_ACTION')
      return (
        item.query.isSuccess &&
        !item.query.isFetching &&
        capabilityNeedsAction(item.profile, item.query.data)
      );
    return `category:${item.profile.category}` === filter;
  });
  const destructiveReasonIsValid = destructiveReason.trim().length >= 12;
  const categories = Array.from(new Set(profiles.map((profile) => profile.category)));
  const statusGroups = categories
    .map((category) => ({
      key: category,
      title: category,
      description: '',
      items: filteredStatuses.filter((item) => item.profile.category === category),
    }))
    .filter((group) => group.items.length > 0);

  if (!backofficeConnection) {
    return (
      <WorkspaceContainer>
        <Alert severity="error">
          {workflowText(
            'backoffice.ui.backoffice-connection-is-unavailable',
            'BackOffice connection is unavailable.',
          )}
        </Alert>
      </WorkspaceContainer>
    );
  }

  return (
    <WorkspaceContainer>
      <WorkspaceHeading
        description={workflowText(
          'backoffice.ui.initialize-governed-documentation-and-project-accelerators-then-publish-',
          'Initialize governed documentation and project accelerators, then publish Staged packages to Online with approval.',
        )}
        help={props.routeNavigation?.help}
        title={workflowText('backoffice.ui.setup-accelerators', 'Setup & Accelerators')}
      />
      {focusedProfile ? (
        <Button
          startIcon={<ShellIcon name="chevron-left" />}
          onClick={() => {
            setSearchParams({});
          }}
        >
          {workflowText('backoffice.ui.all-applications', 'All applications')}
        </Button>
      ) : null}
      <Stack spacing={2}>
        {profiles.length === 0 ? (
          <Alert severity="warning">
            {workflowText(
              'backoffice.ui.authenticated-bootstrap-did-not-include-any-application-initialization-p',
              'Authenticated bootstrap did not include any application-initialization profiles. Setup & Accelerators is backend-published, so project or environment configuration must contribute profiles before Axis can initialize Nexus, Agora, documentation, or future accelerators.',
            )}
          </Alert>
        ) : null}
        <Card variant="outlined">
          <CardContent
            sx={{
              bgcolor: 'background.paper',
              p: { xs: 1.5, md: 2 },
              '&:last-child': { pb: { xs: 1.5, md: 2 } },
            }}
          >
            <Box
              sx={{
                alignItems: { md: 'center' },
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  lg: 'minmax(0, 1fr) auto',
                },
                justifyContent: 'space-between',
                minWidth: 0,
              }}
            >
              <Box
                aria-label={workflowText(
                  'backoffice.ui.setup-profile-summary',
                  'Setup profile summary',
                )}
                sx={{
                  display: 'grid',
                  gap: 0.75,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, max-content))',
                  minWidth: 0,
                  width: '100%',
                }}
              >
                <SetupMetric
                  color="success"
                  label={workflowText('backoffice.ui.online', 'Online')}
                  value={readyCount}
                />
                <SetupMetric
                  color="warning"
                  label={workflowText(
                    'backoffice.ui.pending-approval',
                    'Pending approval',
                  )}
                  value={pendingCount}
                />
                <SetupMetric
                  color="info"
                  label={workflowText('backoffice.ui.setup-options', 'Setup options')}
                  value={actionCount}
                />
                {loadingCount > 0 ? (
                  <SetupMetric
                    color="info"
                    label={workflowText(
                      'backoffice.ui.loading-status',
                      'Loading status',
                    )}
                    value={loadingCount}
                  />
                ) : null}
                {unavailableCount > 0 ? (
                  <SetupMetric
                    color="warning"
                    label={workflowText(
                      'backoffice.ui.status-unavailable',
                      'Status unavailable',
                    )}
                    value={unavailableCount}
                  />
                ) : null}
              </Box>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{
                  alignItems: { sm: 'center' },
                  flex: '0 0 auto',
                  justifyContent: { xs: 'flex-start', md: 'flex-end' },
                }}
              >
                <TextField
                  label={workflowText('backoffice.ui.find-a-setup', 'Find a setup')}
                  value={setupSearch}
                  onChange={(event) => setSetupSearch(event.target.value)}
                  placeholder={workflowText(
                    'backoffice.ui.application-or-documentation',
                    'Application or documentation',
                  )}
                  size="small"
                  type="search"
                  sx={{ minWidth: { xs: '100%', sm: 240 } }}
                />
                <TextField
                  label={workflowText('backoffice.ui.view', 'View')}
                  onChange={(event) => setFilter(event.target.value)}
                  select
                  size="small"
                  sx={{ minWidth: { xs: '100%', sm: 220 } }}
                  value={filter}
                >
                  <MenuItem value="NEEDS_ACTION">
                    {workflowText('backoffice.ui.needs-action', 'Needs action')}
                  </MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category} value={`category:${category}`}>
                      {workflowText(`backoffice.category.${category}`, category)}
                    </MenuItem>
                  ))}
                  <MenuItem value="ALL">
                    {workflowText('backoffice.ui.all-profiles', 'All profiles')}
                  </MenuItem>
                </TextField>
                {props.bootstrap.navigation.some(
                  (item) => item.route === '/process/tasks',
                ) ? (
                  <Button
                    onClick={() => {
                      void navigate('/process/tasks');
                    }}
                    size="small"
                    startIcon={<ShellIcon fontSize="small" name="tasks" />}
                    sx={{ minHeight: 38 }}
                    variant="outlined"
                  >
                    {workflowText('backoffice.ui.approval-queue', 'Approval Queue')}
                  </Button>
                ) : null}
                {props.bootstrap.navigation.some(
                  (item) =>
                    (item.route === '/publishing' && item.group?.id === 'publishing') ||
                    (item.id === 'cms' && item.moduleName === 'cms'),
                ) ? (
                  <Button
                    onClick={() => {
                      void navigate('/publishing');
                    }}
                    size="small"
                    sx={{ minHeight: 38 }}
                    variant="outlined"
                  >
                    {workflowText('backoffice.ui.open-publishing', 'Open Publishing')}
                  </Button>
                ) : null}
              </Stack>
            </Box>
          </CardContent>
        </Card>
        {setupSearch.trim() ? (
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Typography role="status" color="text.secondary">
              {workflowText(
                'backoffice.ui.matching-setups',
                '{count, plural, one {# matching setup} other {# matching setups}}',
                { count: filteredStatuses.length },
              )}
            </Typography>
            <Button onClick={() => setSetupSearch('')} size="small">
              {workflowText('backoffice.ui.clear-search', 'Clear search')}
            </Button>
          </Stack>
        ) : null}
        {recoveryGuidance.length > 0 ? (
          <Card variant="outlined">
            <CardContent
              sx={{
                bgcolor: 'background.paper',
                p: { xs: 1.5, md: 2 },
                '&:last-child': { pb: { xs: 1.5, md: 2 } },
              }}
            >
              <Stack spacing={1.5}>
                <Box
                  sx={{
                    alignItems: { xs: 'stretch', md: 'center' },
                    display: 'grid',
                    gap: 0.75,
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                  }}
                >
                  <Box>
                    <Typography component="h2" sx={{ fontWeight: 800 }}>
                      {workflowText(
                        'backoffice.ui.publishing-recovery-path',
                        'Publishing recovery path',
                      )}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      {workflowText(
                        'backoffice.ui.follow-these-backend-owned-blockers-in-order-before-expecting-online-pag',
                        'Follow these backend-owned blockers in order before expecting Online pages, documentation, or storefront content to appear.',
                      )}
                    </Typography>
                  </Box>
                  <Chip
                    color="warning"
                    label={workflowText(
                      'backoffice.ui.active-steps',
                      '{count, plural, one {# active step} other {# active steps}}',
                      { count: recoveryGuidance.length },
                    )}
                    sx={{ justifySelf: { md: 'end' } }}
                    variant="outlined"
                  />
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1,
                    gridTemplateColumns: {
                      xs: '1fr',
                      lg: 'repeat(2, minmax(0, 1fr))',
                    },
                  }}
                >
                  {recoveryGuidance.map((guidance) => (
                    <Box
                      key={guidance.key}
                      sx={{
                        border: 1,
                        borderColor:
                          guidance.severity === 'error'
                            ? 'error.light'
                            : guidance.severity === 'warning'
                              ? 'warning.light'
                              : 'divider',
                        borderRadius: 1,
                        display: 'grid',
                        gap: 1,
                        gridTemplateColumns: {
                          xs: '1fr',
                          sm: 'minmax(0, 1fr) auto',
                        },
                        p: 1.25,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          sx={{
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            mb: 0.5,
                          }}
                        >
                          <Chip
                            color={guidance.severity}
                            label={rowGuidanceLabel(guidance, workflowText)}
                            size="small"
                            sx={{ fontWeight: 800 }}
                          />
                          <Typography sx={{ fontWeight: 800 }}>
                            {guidance.title}
                          </Typography>
                        </Stack>
                        <Typography color="text.secondary" variant="body2">
                          {guidance.body}
                        </Typography>
                      </Box>
                      <Button
                        color={guidance.severity === 'error' ? 'warning' : 'primary'}
                        onClick={() => void navigate(guidance.route)}
                        disabled={!guidance.route || !canOpenRoute(guidance.route)}
                        size="small"
                        sx={{
                          alignSelf: { sm: 'center' },
                          minHeight: 38,
                          whiteSpace: 'nowrap',
                        }}
                        variant="outlined"
                      >
                        {guidance.actionLabel}
                      </Button>
                    </Box>
                  ))}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ) : null}
        <Card variant="outlined">
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            <Stack divider={<Divider flexItem />} spacing={0}>
              {statusGroups.map((group) => (
                <Box key={group.key}>
                  <Box
                    sx={{
                      alignItems: { xs: 'stretch', sm: 'center' },
                      bgcolor: 'action.hover',
                      display: 'grid',
                      gap: 0.5,
                      gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                      px: 2,
                      py: 1,
                    }}
                  >
                    <Typography
                      component="h2"
                      sx={{ fontWeight: 800 }}
                      variant="subtitle1"
                    >
                      {workflowText(`backoffice.category.${group.key}`, group.title)}
                    </Typography>
                    <Typography
                      color="text.secondary"
                      sx={{ justifySelf: { sm: 'end' }, maxWidth: 760 }}
                      variant="body2"
                    >
                      {group.description}
                    </Typography>
                  </Box>
                  <Stack divider={<Divider flexItem />} spacing={0}>
                    {group.items.map(({ profile, query }) => {
                      const status = query.data;
                      const guidance = publicationRecoveryGuidance(
                        profile,
                        status,
                        props.bootstrap,
                        observedImportFailure(profile.code, status),
                        workflowText,
                      );
                      const pending =
                        mutation.isPending &&
                        mutation.variables?.profile.code === profile.code;
                      const commandsDisabled =
                        mutation.isPending ||
                        query.isPending ||
                        query.isFetching ||
                        query.isError;
                      const refreshDisabled =
                        mutation.isPending ||
                        query.isFetching ||
                        Date.now() <
                          applicationReadinessCooldownUntil(
                            query.data,
                            query.error,
                            query.dataUpdatedAt,
                          );
                      const expanded = expandedProfile === profile.code;
                      const selectionRequired =
                        status?.preparation?.selectionRequired === true;
                      const selectableSteps =
                        status?.preparation?.steps.filter((step) =>
                          status.preparation?.selectableStepCodes?.includes(step.code),
                        ) ?? [];
                      const choice =
                        stageSelections?.clients === clients
                          ? stageSelections.choices[profile.code]
                          : undefined;
                      const selectedStepCode =
                        choice &&
                        choice.status === status &&
                        selectableSteps.some((step) => step.code === choice.code)
                          ? choice.code
                          : '';
                      const canInitialize =
                        Boolean(status?.allowedActions.includes('INITIALIZE')) &&
                        (!preparationBlocked(status) || selectionRequired) &&
                        status?.releaseStatus !== 'INVALID_RELEASE' &&
                        status?.readiness !== 'IMPORTING' &&
                        status?.preparation?.status !== 'RUNNING' &&
                        status?.capability?.businessStatus !== 'PREPARING' &&
                        status?.readiness !== 'PUBLICATION_PENDING';
                      const rowMutationError =
                        mutation.error instanceof Error &&
                        mutation.variables?.profile.code === profile.code &&
                        !(
                          query.dataUpdatedAt >
                            (mutation.context?.statusUpdatedAt ?? Infinity) &&
                          operationConfirmed(
                            status,
                            mutation.variables?.status,
                            mutation.variables?.operation,
                          )
                        )
                          ? mutation.error.message
                          : undefined;
                      const assetApprovalsPending =
                        status?.readiness === 'MEDIA_DEPENDENCIES_PENDING';
                      const approvalActionsVisible = Boolean(
                        canApprove(status) ||
                        (assetApprovalsPending &&
                          status?.mediaDependencies?.dependencies.length),
                      );
                      const executableRepair = firstExecutableRepair(status);
                      const readinessRefresh = status?.capability?.blockers.find(
                        supportsReadinessRefresh,
                      );
                      const executableRepairOperation =
                        supportedRepairOperation(executableRepair);
                      const lifecycleActionCount = [
                        status?.allowedActions.includes('ROLLBACK'),
                        status?.allowedActions.includes('RETIRE'),
                      ].filter(Boolean).length;
                      const actionColumns = approvalActionsVisible
                        ? '148px 180px 40px 40px'
                        : lifecycleActionCount > 1
                          ? '148px 112px 112px 40px 40px'
                          : lifecycleActionCount > 0
                            ? '148px 112px 40px 40px'
                            : '148px 40px 40px';
                      return (
                        <Box key={profile.code} sx={{ px: 2, py: 1.5 }}>
                          <Box
                            sx={{
                              alignItems: { xs: 'stretch', md: 'center' },
                              display: 'grid',
                              gap: { xs: 1.25, md: 2 },
                              gridTemplateColumns: {
                                xs: '1fr',
                                md: 'minmax(260px, 0.9fr) minmax(300px, 1fr) minmax(460px, auto)',
                                xl: 'minmax(340px, 1fr) minmax(360px, 0.95fr) minmax(480px, auto)',
                              },
                              minHeight: 72,
                            }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              {query.isFetching && status ? (
                                <CircularProgress
                                  aria-label={workflowText(
                                    'backoffice.ui.refreshing-profile-status',
                                    'Refreshing {profile} status',
                                    { profile: profile.title },
                                  )}
                                  size={16}
                                />
                              ) : null}
                              <Typography
                                component="h3"
                                noWrap
                                sx={{ lineHeight: 1.15 }}
                                title={displayProfileTitle(profile)}
                                variant="h6"
                              >
                                {displayProfileTitle(profile)}
                              </Typography>
                              <Typography
                                color="text.secondary"
                                sx={{
                                  display: '-webkit-box',
                                  maxWidth: 520,
                                  overflow: 'hidden',
                                  WebkitBoxOrient: 'vertical',
                                  WebkitLineClamp: 2,
                                }}
                                title={profile.summary}
                                variant="body2"
                              >
                                {profile.summary}
                              </Typography>
                            </Box>
                            {query.isPending ? (
                              <Stack
                                direction="row"
                                spacing={1}
                                sx={{ alignItems: 'center' }}
                              >
                                <CircularProgress
                                  aria-label={workflowText(
                                    'backoffice.ui.loading-profile-status',
                                    'Loading {profile} status',
                                    { profile: profile.title },
                                  )}
                                  size={20}
                                />
                                <Typography color="text.secondary" variant="body2">
                                  {workflowText(
                                    'backoffice.ui.loading-status-dbb3a4',
                                    'Loading status...',
                                  )}
                                </Typography>
                              </Stack>
                            ) : query.error instanceof Error ? (
                              <Alert severity="error">
                                {profileErrorMessage(profile, query.error.message)}
                              </Alert>
                            ) : status ? (
                              <Stack
                                spacing={0.75}
                                sx={{ alignItems: 'stretch', minWidth: 0 }}
                              >
                                <Box
                                  sx={{
                                    alignItems: 'center',
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 0.75,
                                    minWidth: 0,
                                  }}
                                >
                                  <SetupStatusChip
                                    color={capabilityStatusColor(status)}
                                    label={capabilityStatusLabel(status, workflowText)}
                                  />
                                  <SetupStatusChip
                                    color={releaseStatusColor(status.releaseStatus)}
                                    label={releaseStatusLabel(
                                      status.releaseStatus,
                                      workflowText,
                                    )}
                                    variant="outlined"
                                  />
                                </Box>
                                <Typography
                                  color={
                                    status.readiness === 'FAILED' ||
                                    status.readiness === 'REJECTED' ||
                                    status.capability?.businessStatus ===
                                      'NEEDS_ATTENTION' ||
                                    status.releaseStatus === 'INVALID_RELEASE'
                                      ? 'error'
                                      : 'text.secondary'
                                  }
                                  sx={{ maxWidth: 480 }}
                                  variant="body2"
                                >
                                  {guidance.key.endsWith(':import-failed')
                                    ? workflowText(
                                        'backoffice.ui.review-import-history',
                                        'Review import history',
                                      )
                                    : nextActionText(status, workflowText)}
                                </Typography>
                                <Stack
                                  direction="row"
                                  spacing={0.75}
                                  sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                                >
                                  <Chip
                                    color={guidance.severity}
                                    label={rowGuidanceLabel(guidance, workflowText)}
                                    size="small"
                                    variant="outlined"
                                  />
                                  <Typography
                                    color="text.secondary"
                                    sx={{
                                      maxWidth: 480,
                                      overflowWrap: 'anywhere',
                                    }}
                                    variant="caption"
                                  >
                                    {guidance.actionLabel}: {guidance.body}
                                  </Typography>
                                </Stack>
                                {selectionRequired ? (
                                  <TextField
                                    disabled={
                                      commandsDisabled ||
                                      !canInitialize ||
                                      !selectableSteps.length
                                    }
                                    label={workflowText(
                                      'backoffice.ui.setup-stage',
                                      'Setup stage',
                                    )}
                                    onChange={(event) =>
                                      setStageSelections((previous) => ({
                                        clients,
                                        choices: {
                                          ...(previous?.clients === clients
                                            ? previous.choices
                                            : {}),
                                          [profile.code]: {
                                            code: event.target.value,
                                            status,
                                          },
                                        },
                                      }))
                                    }
                                    select
                                    size="small"
                                    sx={{ maxWidth: 480, width: '100%' }}
                                    value={selectedStepCode}
                                  >
                                    <MenuItem value="">
                                      {workflowText(
                                        'backoffice.ui.select-setup-stage',
                                        'Select setup stage',
                                      )}
                                    </MenuItem>
                                    {selectableSteps.map((step) => (
                                      <MenuItem
                                        key={step.code}
                                        value={step.code}
                                        sx={{
                                          whiteSpace: 'normal',
                                          overflowWrap: 'anywhere',
                                        }}
                                      >
                                        {step.label || step.description || step.kind} (
                                        {step.code})
                                      </MenuItem>
                                    ))}
                                  </TextField>
                                ) : null}
                              </Stack>
                            ) : (
                              <Alert severity="warning">
                                {workflowText(
                                  'backoffice.ui.profile-status-is-unavailable',
                                  'Profile status is unavailable.',
                                )}
                              </Alert>
                            )}
                            <Box
                              sx={{
                                alignItems: 'center',
                                alignSelf: 'center',
                                display: { xs: 'flex', md: 'grid' },
                                flexWrap: { xs: 'wrap', md: 'nowrap' },
                                gap: 1,
                                gridTemplateColumns: {
                                  md: actionColumns,
                                },
                                justifyContent: { xs: 'flex-start', md: 'flex-end' },
                                justifySelf: { md: 'end' },
                                minWidth: 0,
                                pb: { xs: 0.25, md: 0 },
                                pt: 0.25,
                                width: { xs: '100%', md: 'auto' },
                              }}
                            >
                              {guidance.key.endsWith(':import-failed') ? (
                                <Button
                                  disabled={
                                    !guidance.route || !canOpenRoute(guidance.route)
                                  }
                                  onClick={() => void navigate(guidance.route)}
                                  startIcon={<ShellIcon name="history" />}
                                  variant="contained"
                                >
                                  {workflowText(
                                    'backoffice.ui.review-import-history',
                                    'Review import history',
                                  )}
                                </Button>
                              ) : status &&
                                executableRepair &&
                                executableRepairOperation ? (
                                <Button
                                  color="warning"
                                  disabled={commandsDisabled}
                                  onClick={() =>
                                    executableRepair.repair?.requiresConfirmation
                                      ? setRepairConfirmation({
                                          blocker: executableRepair,
                                          operation: executableRepairOperation,
                                          profile,
                                          status,
                                        })
                                      : mutation.mutate({
                                          operation: executableRepairOperation,
                                          profile,
                                          status,
                                        })
                                  }
                                  size="small"
                                  startIcon={
                                    <ShellIcon fontSize="small" name="operations" />
                                  }
                                  sx={{
                                    minHeight: 40,
                                    minWidth: 148,
                                    whiteSpace: 'nowrap',
                                    width: '100%',
                                  }}
                                  variant="contained"
                                >
                                  {pending &&
                                  mutation.variables?.operation ===
                                    executableRepairOperation
                                    ? executableRepairOperation === 'prepare'
                                      ? workflowText(
                                          'backoffice.ui.preparing',
                                          'Preparing...',
                                        )
                                      : workflowText(
                                          'backoffice.ui.repairing',
                                          'Repairing...',
                                        )
                                    : (executableRepair.repair?.label ??
                                      operationLabel(
                                        executableRepairOperation,
                                        workflowText,
                                      ))}
                                </Button>
                              ) : status && canInitialize ? (
                                <Button
                                  disabled={
                                    commandsDisabled ||
                                    (selectionRequired && !selectedStepCode)
                                  }
                                  onClick={() =>
                                    mutation.mutate({
                                      operation: 'initiate',
                                      profile,
                                      status,
                                      afterPublicationStepCode: selectionRequired
                                        ? selectedStepCode
                                        : undefined,
                                    })
                                  }
                                  size="small"
                                  sx={{
                                    minHeight: 40,
                                    minWidth: 132,
                                    whiteSpace: 'nowrap',
                                    width: '100%',
                                  }}
                                  variant="contained"
                                >
                                  {pending &&
                                  mutation.variables?.operation === 'initiate'
                                    ? workflowText(
                                        'backoffice.ui.working',
                                        'Working...',
                                      )
                                    : setupActionLabel(status, workflowText)}
                                </Button>
                              ) : readinessRefresh ? (
                                <Button
                                  disabled={refreshDisabled}
                                  onClick={() => {
                                    statusQueue.prioritize(profile.code);
                                    void query.refetch();
                                  }}
                                  startIcon={<ShellIcon name="refresh" />}
                                  variant="contained"
                                >
                                  {readinessRefresh.repair?.label ===
                                  'Refresh readiness'
                                    ? workflowText(
                                        'backoffice.ui.refresh-readiness',
                                        'Refresh readiness',
                                      )
                                    : readinessRefresh.repair?.label}
                                </Button>
                              ) : status &&
                                preparationBlocked(status) &&
                                !selectionRequired ? (
                                <Button
                                  disabled={
                                    commandsDisabled || !canOpenRoute('/registry')
                                  }
                                  onClick={() => void navigate('/registry')}
                                  size="small"
                                  sx={{
                                    minHeight: 40,
                                    minWidth: 148,
                                    whiteSpace: 'nowrap',
                                    width: '100%',
                                  }}
                                  variant="outlined"
                                >
                                  {workflowText(
                                    'backoffice.ui.module-registry',
                                    'Module Registry',
                                  )}
                                </Button>
                              ) : (
                                <Box
                                  aria-hidden="true"
                                  sx={{
                                    display: { xs: 'none', md: 'block' },
                                    visibility: 'hidden',
                                    width: 148,
                                  }}
                                />
                              )}
                              {approvalActionsVisible && status ? (
                                <Button
                                  disabled={
                                    commandsDisabled ||
                                    (!assetApprovalsPending && !reviewNavigation)
                                  }
                                  onClick={() => {
                                    if (assetApprovalsPending)
                                      setExpandedProfile(profile.code);
                                    else if (
                                      reviewNavigation &&
                                      status.publication?.workflowRef
                                    )
                                      void navigate(
                                        reviewNavigation.route +
                                          '?' +
                                          new URLSearchParams({
                                            instanceCode:
                                              status.publication.workflowRef,
                                          }).toString(),
                                      );
                                  }}
                                  size="small"
                                  startIcon={
                                    <ShellIcon fontSize="small" name="approve" />
                                  }
                                  sx={{
                                    minHeight: 40,
                                    whiteSpace: 'normal',
                                    width: '100%',
                                  }}
                                  variant="outlined"
                                >
                                  {assetApprovalsPending
                                    ? workflowText(
                                        'backoffice.ui.review-media-prerequisites',
                                        'Review Media prerequisites',
                                      )
                                    : workflowText(
                                        'backoffice.ui.review-publication',
                                        'Review publication',
                                      )}
                                </Button>
                              ) : null}
                              {status?.allowedActions.includes('ROLLBACK') ? (
                                <Button
                                  color="warning"
                                  disabled={commandsDisabled}
                                  onClick={() => {
                                    setDestructiveReason(
                                      `${profile.title} rollback requested after Online evidence review.`,
                                    );
                                    setDestructiveConfirmation({
                                      operation: 'rollback',
                                      profile,
                                      status,
                                    });
                                  }}
                                  size="small"
                                  sx={{
                                    minHeight: 40,
                                    minWidth: 96,
                                    whiteSpace: 'nowrap',
                                    width: '100%',
                                  }}
                                  variant="outlined"
                                >
                                  {operationLabel('rollback', workflowText)}
                                </Button>
                              ) : null}
                              {status?.allowedActions.includes('RETIRE') ? (
                                <Button
                                  color="warning"
                                  disabled={commandsDisabled}
                                  onClick={() => {
                                    setDestructiveReason(
                                      `${profile.title} retirement requested after Online evidence review.`,
                                    );
                                    setDestructiveConfirmation({
                                      operation: 'retire',
                                      profile,
                                      status,
                                    });
                                  }}
                                  size="small"
                                  sx={{
                                    minHeight: 40,
                                    minWidth: 96,
                                    whiteSpace: 'nowrap',
                                    width: '100%',
                                  }}
                                  variant="outlined"
                                >
                                  {operationLabel('retire', workflowText)}
                                </Button>
                              ) : null}
                              <RowIconAction
                                disabled={refreshDisabled}
                                label={workflowText(
                                  'backoffice.ui.refresh-profile-status',
                                  'Refresh {profile} status',
                                  { profile: profile.title },
                                )}
                                name="refresh"
                                onClick={() => {
                                  statusQueue.prioritize(profile.code);
                                  void query.refetch();
                                }}
                              />
                              <Tooltip
                                arrow
                                title={workflowText(
                                  expanded
                                    ? 'backoffice.ui.hide-profile-details'
                                    : 'backoffice.ui.show-profile-details',
                                  expanded
                                    ? 'Hide {profile} details'
                                    : 'Show {profile} details',
                                  { profile: profile.title },
                                )}
                              >
                                <span>
                                  <IconButton
                                    aria-expanded={expanded}
                                    aria-label={workflowText(
                                      expanded
                                        ? 'backoffice.ui.hide-profile-details'
                                        : 'backoffice.ui.show-profile-details',
                                      expanded
                                        ? 'Hide {profile} details'
                                        : 'Show {profile} details',
                                      { profile: profile.title },
                                    )}
                                    onClick={() =>
                                      setExpandedProfile(
                                        expanded ? undefined : profile.code,
                                      )
                                    }
                                    size="small"
                                    sx={{
                                      border: 1,
                                      borderColor: 'divider',
                                      height: 36,
                                      width: 36,
                                    }}
                                  >
                                    <ShellIcon
                                      fontSize="small"
                                      name={expanded ? 'chevron-up' : 'chevron-down'}
                                    />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Box>
                          </Box>
                          {rowMutationError ? (
                            <Alert severity="error" sx={{ mt: 1.5 }}>
                              {profileErrorMessage(profile, rowMutationError)}
                            </Alert>
                          ) : null}
                          {expanded && !status ? (
                            <Alert
                              severity={query.isError ? 'error' : 'info'}
                              sx={{ mt: 1.5 }}
                            >
                              {query.isError
                                ? workflowText(
                                    'backoffice.ui.dependency-details-are-unavailable-because-the-owning-status-read-failed',
                                    'Dependency details are unavailable because the owning status read failed. Refresh status to inspect the prerequisites.',
                                  )
                                : workflowText(
                                    'backoffice.ui.dependency-details-are-loading',
                                    'Dependency details are loading.',
                                  )}
                            </Alert>
                          ) : null}
                          {expanded && status ? (
                            <Box
                              sx={{
                                bgcolor: 'action.hover',
                                borderRadius: 1,
                                mt: 1.5,
                                p: 1.5,
                              }}
                            >
                              <Stack spacing={1.25}>
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  sx={{ flexWrap: 'wrap' }}
                                >
                                  <Chip
                                    label={conciseReleaseLabel(profile, status)}
                                    size="small"
                                    variant="outlined"
                                  />
                                  <Chip
                                    label={profilePublishChannel(profile)}
                                    size="small"
                                    variant="outlined"
                                  />
                                  <Chip
                                    label={`${status.applicationCode} · ${status.siteCode}`}
                                    size="small"
                                    variant="outlined"
                                  />
                                  <Chip
                                    label={status.owner}
                                    size="small"
                                    variant="outlined"
                                  />
                                  {status.capability ? (
                                    <Chip
                                      label={`${status.capability.group} · ${status.capability.capabilityType}`}
                                      size="small"
                                      variant="outlined"
                                    />
                                  ) : null}
                                  <Chip
                                    label={
                                      profile.activationPolicy.approvalRequiredForOnline
                                        ? workflowText(
                                            'backoffice.ui.online-approval-required',
                                            'Online approval required',
                                          )
                                        : workflowText(
                                            'backoffice.ui.online-approval-not-required',
                                            'Online approval not required',
                                          )
                                    }
                                    size="small"
                                    variant="outlined"
                                  />
                                </Stack>
                                <Box>
                                  <Typography color="text.secondary" variant="caption">
                                    {workflowText(
                                      'backoffice.ui.required-runtime',
                                      'Required runtime',
                                    )}
                                  </Typography>
                                  <Stack
                                    direction="row"
                                    spacing={0.75}
                                    sx={{ flexWrap: 'wrap' }}
                                  >
                                    {profile.requiredServers.map((server) => (
                                      <Chip
                                        key={server}
                                        label={server}
                                        size="small"
                                        variant="outlined"
                                      />
                                    ))}
                                  </Stack>
                                </Box>
                                {status.preparation?.executions?.map((execution) => (
                                  <Alert
                                    key={execution.code}
                                    severity={
                                      execution.status === 'UNCERTAIN'
                                        ? 'warning'
                                        : 'info'
                                    }
                                    role="status"
                                  >
                                    {execution.completed}{' '}
                                    {workflowText('backoffice.ui.of', 'of')}{' '}
                                    {execution.total}{' '}
                                    {workflowText(
                                      'backoffice.ui.release-stages-prepared-on',
                                      'release stages prepared on',
                                    )}{' '}
                                    {execution.targetServer}. {execution.nextAction}
                                    <Typography
                                      variant="caption"
                                      component="p"
                                      sx={{ overflowWrap: 'anywhere' }}
                                    >
                                      {workflowText(
                                        'backoffice.ui.receipt',
                                        'Receipt:',
                                      )}{' '}
                                      {execution.code}
                                    </Typography>
                                  </Alert>
                                ))}
                                {status.preparation?.operationFailure ? (
                                  <Alert severity="error">
                                    {status.preparation.operationFailure.message} (
                                    {status.preparation.operationFailure.failureCode}) ·{' '}
                                    {status.preparation.operationFailure.targetServer} /{' '}
                                    {
                                      status.preparation.operationFailure
                                        .targetRuntimeRole
                                    }
                                  </Alert>
                                ) : null}
                                {status.preparation?.groupReceipts?.map(
                                  (group, index) => (
                                    <Box
                                      key={`${group.targetServer}:${group.dataType}:${index}`}
                                    >
                                      <Typography variant="body2">
                                        {group.targetServer} / {group.targetRuntimeRole}{' '}
                                        · {group.dataType} · {group.status}
                                      </Typography>
                                      {group.releases.map((receipt, index) => (
                                        <Typography
                                          key={index}
                                          variant="caption"
                                          sx={{ display: 'block' }}
                                        >
                                          {receipt.releaseCode} · {receipt.status}{' '}
                                          {workflowText(
                                            'backoffice.ui.version',
                                            '· Version',
                                          )}{' '}
                                          {receipt.version ?? 'Unavailable'}{' '}
                                          {workflowText(
                                            'backoffice.ui.installed',
                                            '· Installed',
                                          )}{' '}
                                          {receipt.installedVersion ?? 'Unavailable'}
                                          {receipt.lastRunId
                                            ? ` · Historical run reference: ${receipt.lastRunId} (not proof of this attempt)`
                                            : workflowText(
                                                'backoffice.ui.current-run-evidence-unavailable',
                                                ' · Current run evidence unavailable',
                                              )}
                                        </Typography>
                                      ))}
                                    </Box>
                                  ),
                                )}
                                {status.preparation?.steps.length ? (
                                  <Box>
                                    <Typography variant="body2" color="text.secondary">
                                      {workflowText(
                                        'backoffice.ui.source-history-not-delivery',
                                        'This history belongs to the selected source package. An Online receipt can be historical; inspect Publishing and the delivered page to verify the current Online revision.',
                                      )}
                                    </Typography>
                                    <Typography
                                      color="text.secondary"
                                      variant="caption"
                                    >
                                      {workflowText(
                                        'backoffice.ui.preparation-evidence',
                                        'Preparation evidence',
                                      )}
                                    </Typography>
                                    <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                                      {status.preparation.steps.map((step) => (
                                        <Box
                                          key={`${step.code}:${step.targetServer}`}
                                          sx={{
                                            alignItems: 'center',
                                            display: 'grid',
                                            gap: 1,
                                            gridTemplateColumns: {
                                              xs: '1fr',
                                              md: 'minmax(220px, 1fr) minmax(130px, auto) minmax(130px, auto)',
                                            },
                                          }}
                                        >
                                          <Typography
                                            sx={{ overflowWrap: 'anywhere' }}
                                            variant="body2"
                                          >
                                            {step.label ||
                                              step.kind ||
                                              friendlyPackageLabel(step.code)}
                                            {step.operatorEnterpriseCode
                                              ? ` · ${step.code} · ${step.operatorEnterpriseCode}`
                                              : ''}
                                          </Typography>
                                          <Chip
                                            label={`${step.targetRuntimeRole} · ${step.dataType}`}
                                            size="small"
                                            variant="outlined"
                                          />
                                          <Chip
                                            color={preparationStatusColor(step.status)}
                                            label={preparationStatusLabel(
                                              step.status,
                                              step.trigger,
                                              workflowText,
                                            )}
                                            size="small"
                                            variant={
                                              step.status === 'CURRENT' ||
                                              step.status === 'SOURCE_READY'
                                                ? 'filled'
                                                : 'outlined'
                                            }
                                          />
                                          {step.message ? (
                                            <Typography
                                              color="text.secondary"
                                              sx={{
                                                gridColumn: { md: '1 / -1' },
                                                overflowWrap: 'anywhere',
                                              }}
                                              variant="caption"
                                            >
                                              {step.message}
                                            </Typography>
                                          ) : null}
                                        </Box>
                                      ))}
                                    </Stack>
                                  </Box>
                                ) : null}
                                {status.preparationOperation ? (
                                  <Box>
                                    <Typography
                                      color="text.secondary"
                                      variant="caption"
                                    >
                                      {workflowText(
                                        'backoffice.ui.last-preparation-operation',
                                        'Last preparation operation',
                                      )}
                                    </Typography>
                                    <Stack
                                      direction="row"
                                      spacing={0.75}
                                      sx={{ flexWrap: 'wrap', mt: 0.5 }}
                                    >
                                      <Chip
                                        label={status.preparationOperation.operation}
                                        size="small"
                                        variant="outlined"
                                      />
                                      <Chip
                                        color={
                                          status.preparationOperation.changed
                                            ? 'success'
                                            : 'default'
                                        }
                                        label={
                                          status.preparationOperation.changed
                                            ? workflowText(
                                                'backoffice.ui.changed-readiness',
                                                'Changed readiness',
                                              )
                                            : workflowText(
                                                'backoffice.ui.no-readiness-change',
                                                'No readiness change',
                                              )
                                        }
                                        size="small"
                                        variant="outlined"
                                      />
                                      <Chip
                                        label={`${String(
                                          status.preparationOperation.stepCount,
                                        )} step(s)`}
                                        size="small"
                                        variant="outlined"
                                      />
                                      <Chip
                                        label={`${status.preparationOperation.beforeStatus ?? 'UNKNOWN'} -> ${
                                          status.preparationOperation.afterStatus ??
                                          'UNKNOWN'
                                        }`}
                                        size="small"
                                        variant="outlined"
                                      />
                                    </Stack>
                                  </Box>
                                ) : null}
                                {status.capability?.blockers.length ? (
                                  <CapabilityReadinessPanel
                                    canOpenRoute={canOpenRoute}
                                    readiness={status.capability}
                                    actionSlot={(blocker) =>
                                      supportsReadinessRefresh(blocker) ? (
                                        <Button
                                          disabled={refreshDisabled}
                                          onClick={() => {
                                            statusQueue.prioritize(profile.code);
                                            void query.refetch();
                                          }}
                                          startIcon={<ShellIcon name="refresh" />}
                                          size="small"
                                        >
                                          {blocker.repair?.label}
                                        </Button>
                                      ) : blocker.repair?.action ===
                                        'REVIEW_MEDIA_PUBLICATION' ? (
                                        blocker.repair.available &&
                                        resolveMediaPublicationHandoff(
                                          props.bootstrap,
                                          blocker.mediaDependency,
                                        ) ? (
                                          <Button
                                            size="small"
                                            startIcon={<ShellIcon name="media" />}
                                            onClick={() => {
                                              const route =
                                                resolveMediaPublicationHandoff(
                                                  props.bootstrap,
                                                  blocker.mediaDependency,
                                                );
                                              if (route) void navigate(route);
                                            }}
                                          >
                                            {blocker.mediaDependency?.handoff?.label}
                                          </Button>
                                        ) : (
                                          <Button size="small" disabled>
                                            {blocker.repair.unavailableReason ??
                                              blocker.repair.label}
                                          </Button>
                                        )
                                      ) : supportedRepairOperation(blocker) ? (
                                        <Box sx={{ mt: 1 }}>
                                          <Button
                                            color="warning"
                                            disabled={commandsDisabled}
                                            onClick={() => {
                                              const operation =
                                                supportedRepairOperation(blocker);
                                              if (!operation) return;
                                              if (
                                                blocker.repair?.requiresConfirmation
                                              ) {
                                                setRepairConfirmation({
                                                  blocker,
                                                  operation,
                                                  profile,
                                                  status,
                                                });
                                                return;
                                              }
                                              mutation.mutate({
                                                operation,
                                                profile,
                                                status,
                                              });
                                            }}
                                            size="small"
                                            startIcon={
                                              <ShellIcon
                                                fontSize="small"
                                                name="operations"
                                              />
                                            }
                                            variant="outlined"
                                          >
                                            {blocker.repair?.label ?? blocker.action}
                                          </Button>
                                        </Box>
                                      ) : null
                                    }
                                  />
                                ) : null}
                                {status.publication ? (
                                  <Box>
                                    <Typography variant="body2" color="text.secondary">
                                      {workflowText(
                                        'backoffice.ui.source-history-not-delivery',
                                        'This history belongs to the selected source package. An Online receipt can be historical; inspect Publishing and the delivered page to verify the current Online revision.',
                                      )}
                                    </Typography>
                                    <Typography
                                      color="text.secondary"
                                      variant="caption"
                                    >
                                      {workflowText(
                                        'backoffice.ui.selected-source-publication-history',
                                        'Selected source publication history',
                                      )}
                                    </Typography>
                                    <Typography sx={{ overflowWrap: 'anywhere' }}>
                                      {status.publication.code} ·{' '}
                                      {status.publication.state}
                                    </Typography>
                                    {status.publication.workflowRef ? (
                                      <Typography
                                        color="text.secondary"
                                        sx={{ overflowWrap: 'anywhere' }}
                                        variant="caption"
                                      >
                                        {workflowText(
                                          'backoffice.ui.workflow',
                                          'Workflow',
                                        )}{' '}
                                        {' · '}
                                        {status.publication.workflowRef}
                                      </Typography>
                                    ) : null}
                                  </Box>
                                ) : null}
                              </Stack>
                            </Box>
                          ) : null}
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
      <Dialog
        fullWidth
        maxWidth="sm"
        onClose={() => {
          if (!mutation.isPending) {
            setDestructiveConfirmation(undefined);
            setDestructiveReason('');
          }
        }}
        open={Boolean(destructiveConfirmation)}
      >
        <DialogTitle>
          {workflowText('backoffice.ui.confirm', 'Confirm')}{' '}
          {destructiveConfirmation
            ? operationLabel(
                destructiveConfirmation.operation,
                workflowText,
              ).toLowerCase()
            : workflowText('backoffice.ui.operation', 'operation')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              {workflowText(
                'backoffice.ui.this-can-change-the-online-accelerator-state-confirm-only-after-checking',
                'This can change the Online accelerator state. Confirm only after checking the current Online version, rollback candidate, audit evidence, and expected browser verification path.',
              )}
            </Alert>
            {destructiveConfirmation ? (
              <Box>
                <Typography variant="subtitle2">
                  {destructiveConfirmation.profile.title}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {destructiveConfirmation.status.publication?.code ??
                    destructiveConfirmation.profile.baselineCode}{' '}
                  · {destructiveConfirmation.status.readiness}
                </Typography>
              </Box>
            ) : null}
            <Stack spacing={0.75}>
              {[
                'Current Online state has been reviewed.',
                'Publication history and audit evidence identify the target.',
                'Business reason and browser verification path are recorded.',
              ].map((item) => (
                <Chip color="warning" key={item} label={item} variant="outlined" />
              ))}
            </Stack>
            <TextField
              autoFocus
              disabled={mutation.isPending}
              fullWidth
              helperText={workflowText(
                'backoffice.ui.required-this-reason-is-sent-to-the-backend-publication-authority-and-sh',
                'Required. This reason is sent to the backend publication authority and should explain the evidence and business intent.',
              )}
              label={workflowText('backoffice.ui.operator-reason', 'Operator reason')}
              minRows={3}
              multiline
              onChange={(event) => setDestructiveReason(event.target.value)}
              value={destructiveReason}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={mutation.isPending}
            onClick={() => {
              setDestructiveConfirmation(undefined);
              setDestructiveReason('');
            }}
          >
            {workflowText('backoffice.ui.cancel', 'Cancel')}
          </Button>
          <Button
            color="warning"
            disabled={
              !destructiveConfirmation ||
              !destructiveReasonIsValid ||
              mutation.isPending
            }
            onClick={() => {
              if (!destructiveConfirmation) return;
              mutation.mutate({
                operation: destructiveConfirmation.operation,
                profile: destructiveConfirmation.profile,
                reason: destructiveReason.trim(),
                status: destructiveConfirmation.status,
              });
            }}
            variant="contained"
          >
            {mutation.isPending
              ? workflowText('backoffice.ui.submitting', 'Submitting...')
              : `Confirm ${
                  destructiveConfirmation
                    ? operationLabel(
                        destructiveConfirmation.operation,
                        workflowText,
                      ).toLowerCase()
                    : 'operation'
                }`}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        fullWidth
        maxWidth="sm"
        onClose={() => {
          if (!mutation.isPending) setRepairConfirmation(undefined);
        }}
        open={Boolean(repairConfirmation)}
      >
        <DialogTitle>
          {workflowText('backoffice.ui.confirm', 'Confirm')}{' '}
          {repairConfirmation
            ? operationLabel(repairConfirmation.operation, workflowText).toLowerCase()
            : workflowText('backoffice.ui.repair', 'repair')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              {workflowText(
                'backoffice.ui.axis-will-invoke-the-governed-backend-repair-operation-declared-by-readi',
                'Axis will invoke the governed backend repair operation declared by readiness. Source, runtime, and publishing-only repairs remain guidance until their owning backend exposes an executable operation.',
              )}
            </Alert>
            {repairConfirmation ? (
              <Box>
                <Typography variant="subtitle2">
                  {repairConfirmation.profile.title}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {repairConfirmation.blocker.repair?.label ??
                    repairConfirmation.blocker.action}
                </Typography>
                <Typography
                  color="text.secondary"
                  sx={{ mt: 0.75, overflowWrap: 'anywhere' }}
                  variant="caption"
                >
                  {repairConfirmation.blocker.message}
                </Typography>
              </Box>
            ) : null}
            {repairConfirmation ? (
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                <Chip
                  label={repairConfirmation.blocker.code}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={repairConfirmation.blocker.owner}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={repairConfirmation.blocker.repair?.operation}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={mutation.isPending}
            onClick={() => setRepairConfirmation(undefined)}
          >
            {workflowText('backoffice.ui.cancel', 'Cancel')}
          </Button>
          <Button
            color="warning"
            disabled={!repairConfirmation || mutation.isPending}
            onClick={() => {
              if (!repairConfirmation) return;
              mutation.mutate({
                operation: repairConfirmation.operation,
                profile: repairConfirmation.profile,
                reason: `${repairConfirmation.profile.title} ${operationLabel(
                  repairConfirmation.operation,
                  workflowText,
                ).toLowerCase()} requested for ${repairConfirmation.blocker.code}`,
                status: repairConfirmation.status,
              });
            }}
            variant="contained"
          >
            {mutation.isPending
              ? workflowText('backoffice.ui.submitting', 'Submitting...')
              : workflowText('backoffice.ui.confirm-repair', 'Confirm repair')}
          </Button>
        </DialogActions>
      </Dialog>
    </WorkspaceContainer>
  );
}
