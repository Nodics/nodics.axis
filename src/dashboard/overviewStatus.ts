import type { AxisAuthenticatedBootstrap } from '../bootstrap/publicBootstrap';
import type { ApplicationInitializationStatus } from '../operations/setupAccelerators/api/applicationInitializationClient';
export interface Entry {
  readonly profile: NonNullable<
    AxisAuthenticatedBootstrap['applicationInitializationProfiles']
  >[number];
  readonly query:
    | {
        readonly data?: ApplicationInitializationStatus | undefined;
        readonly isPending: boolean;
        readonly isError: boolean;
      }
    | undefined;
}
/** Readiness is a current snapshot, not a fabricated business-activity series. */
export function overviewState(entry: Entry) {
  if (!entry.query?.data || entry.query.isError || entry.query.data.capability?.stale)
    return 'unknown';
  const state = entry.query.data.readiness;
  if (state === 'READY') return 'published';
  if (state === 'PUBLICATION_PENDING') return 'approval';
  if (state === 'NOT_IMPORTED') return 'available';
  if (['BLOCKED', 'REJECTED', 'ROLLED_BACK', 'RETIRED', 'FAILED'].includes(state))
    return 'blocked';
  return 'preparing';
}

export function isDocumentation(entry: Entry): boolean {
  return (
    entry.profile.kind === 'DOCUMENTATION' ||
    entry.profile.type === 'DOCUMENTATION_BUNDLE'
  );
}
