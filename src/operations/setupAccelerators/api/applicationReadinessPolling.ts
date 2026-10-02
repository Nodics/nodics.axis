/** Bounded browser GET scheduling. Owner states describe progress; this module never authorizes or retries writes. */
import {
  ApplicationReadinessThrottleError,
  type ApplicationInitializationStatus,
} from './applicationInitializationClient';

/** Human review, stable imports and completed work do not need background status reads. */
export function applicationReadinessInProgress(
  status: ApplicationInitializationStatus | undefined,
): boolean {
  return (
    status?.readiness === 'IMPORTING' ||
    status?.releaseStatus === 'IMPORTING' ||
    status?.preparation?.status === 'RUNNING' ||
    status?.capability?.businessStatus === 'PREPARING' ||
    status?.publication?.state === 'ACTIVATING'
  );
}

/** HTTP throttles retain bounded Retry-After evidence; owner-projected throttles use a conservative browser cooldown. */
export function applicationReadinessCooldownUntil(
  status: ApplicationInitializationStatus | undefined,
  error: Error | null,
  updatedAt: number,
): number {
  if (error instanceof ApplicationReadinessThrottleError) return error.retryAt;
  return status?.capability?.blockers.some(
    (blocker) => blocker.code === 'READINESS_RATE_LIMITED',
  )
    ? updatedAt + 30_000
    : 0;
}

/** Automatic observation stops after five minutes or a permanent read error, with backoff capped at thirty seconds. */
export function applicationReadinessPollInterval(
  status: ApplicationInitializationStatus | undefined,
  error: Error | null,
  readCount: number,
  startedAt: number,
  now = Date.now(),
  updatedAt = now,
): number | false {
  if (
    !applicationReadinessInProgress(status) ||
    (error && !(error instanceof ApplicationReadinessThrottleError))
  )
    return false;
  const backoff = Math.min(
    30_000,
    2_000 * 2 ** Math.min(Math.max(0, readCount - 1), 4),
  );
  const delay = Math.max(
    backoff,
    applicationReadinessCooldownUntil(status, error, updatedAt) - now,
  );
  return now + delay <= startedAt + 300_000 ? delay : false;
}
