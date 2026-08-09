/*
 * Axis media lifecycle presentation policy.
 *
 * Copyright (c) 2026 Nodics All rights reserved.
 *
 * This software is governed by the Nodics Source-Available Commercial License.
 * You may use, copy, modify, deploy, or distribute it only as permitted by the
 * root LICENSE file or a separate written agreement with Nodics.
 */

export type MediaLifecycleAction = 'retire' | 'restore';

export type MediaLifecycleStatusTone =
  | 'default'
  | 'error'
  | 'info'
  | 'success'
  | 'warning';

export interface MediaLifecyclePolicyInput {
  readonly activeUsageCount: number;
  readonly canUpdate: boolean;
  readonly pending?: boolean;
  readonly status?: string | undefined;
}

export interface MediaLifecycleActionPolicy {
  readonly action: MediaLifecycleAction;
  readonly color: 'warning' | 'primary';
  readonly disabled: boolean;
  readonly label: string;
  readonly nextStatus: 'RETIRED' | 'READY';
  readonly reason: string | undefined;
  readonly variant: 'contained' | 'outlined';
}

const terminalRestoreStatuses = Object.freeze(['RETIRED', 'EXPIRED', 'FAILED']);
const retireBlockedStatuses = Object.freeze([
  ...terminalRestoreStatuses,
  'ARCHIVED',
  'DELETED',
]);

/**
 * Normalizes a backend media lifecycle status before Axis applies display-only
 * guidance. The backend still owns the final transition decision.
 */
export function normalizeMediaLifecycleStatus(status?: string): string {
  return String(status ?? 'UNKNOWN')
    .trim()
    .toUpperCase();
}

/**
 * Provides the status chip tone used by Axis media workspaces.
 */
export function mediaLifecycleStatusTone(status?: string): MediaLifecycleStatusTone {
  const normalizedStatus = normalizeMediaLifecycleStatus(status);
  if (['READY', 'ACTIVE', 'CONSUMED'].includes(normalizedStatus)) return 'success';
  if (['DRAFT', 'UPLOADED', 'VALIDATING', 'PROCESSING'].includes(normalizedStatus)) {
    return 'info';
  }
  if (['RETIRED', 'EXPIRED', 'ARCHIVED'].includes(normalizedStatus)) {
    return 'warning';
  }
  if (['FAILED', 'DELETED'].includes(normalizedStatus)) return 'error';
  return 'default';
}

/**
 * Builds the visible Axis action policy for media lifecycle buttons.
 */
export function mediaLifecycleActionPolicies(
  input: MediaLifecyclePolicyInput,
): readonly MediaLifecycleActionPolicy[] {
  const normalizedStatus = normalizeMediaLifecycleStatus(input.status);
  const pendingReason = input.pending
    ? 'Another media lifecycle update is already running.'
    : undefined;
  const updateReason = !input.canUpdate
    ? 'Lifecycle updates are unavailable for this media schema.'
    : undefined;

  const retireReason =
    updateReason ??
    pendingReason ??
    (input.activeUsageCount > 0
      ? `Retire is blocked because ${String(
          input.activeUsageCount,
        )} active reference${input.activeUsageCount === 1 ? '' : 's'} still use this media.`
      : undefined) ??
    (retireBlockedStatuses.includes(normalizedStatus)
      ? `Media in ${normalizedStatus} status cannot be retired again.`
      : undefined);

  const restoreReason =
    updateReason ??
    pendingReason ??
    (!terminalRestoreStatuses.includes(normalizedStatus)
      ? `Restore is available only for ${terminalRestoreStatuses.join(', ')} media.`
      : undefined);

  return Object.freeze([
    Object.freeze({
      action: 'retire',
      color: 'warning',
      disabled: Boolean(retireReason),
      label: 'Retire',
      nextStatus: 'RETIRED',
      reason: retireReason,
      variant: 'outlined',
    }),
    Object.freeze({
      action: 'restore',
      color: 'primary',
      disabled: Boolean(restoreReason),
      label: 'Restore',
      nextStatus: 'READY',
      reason: restoreReason,
      variant: 'outlined',
    }),
  ]);
}
