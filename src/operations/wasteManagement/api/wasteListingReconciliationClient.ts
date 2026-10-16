import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from '../../shared/operationalOwnerClient';

/** Exact source-owned reconciliation view, never a claim of cancelled economic effects. */
export interface ListingReconciliation {
  readonly contractVersion: 1;
  readonly assetCode: string;
  readonly assetRevision: number;
  readonly state: 'RECONCILIATION_REQUIRED' | 'RECONCILING';
  readonly requestDisposition: 'UNRESOLVED' | 'WITHDRAWN';
  readonly economicEffects: 'UNKNOWN';
  readonly relistAllowed: false;
  readonly snapshotDigest: string;
  readonly receiptCode: string | null;
  readonly originalRevision: number;
  readonly originalSnapshotDigest: string;
  readonly canWithdraw: boolean;
}
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:@|-]{0,179}$/.test(value);
const hash = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function invalid(): never {
  throw new Error('Listing reconciliation response is incompatible.');
}
/** Validates exact identity and state without admitting returned selectors or command paths. */
export function parseListingReconciliation(
  value: unknown,
  assetCode: string,
): ListingReconciliation {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !identifier(assetCode)
  )
    return invalid();
  const row = value as Record<string, unknown>;
  if (
    row.contractVersion !== 1 ||
    row.assetCode !== assetCode ||
    typeof row.assetRevision !== 'number' ||
    !Number.isSafeInteger(row.assetRevision) ||
    row.assetRevision < 0 ||
    typeof row.originalRevision !== 'number' ||
    !Number.isSafeInteger(row.originalRevision) ||
    row.originalRevision < 0 ||
    row.economicEffects !== 'UNKNOWN' ||
    row.relistAllowed !== false ||
    typeof row.canWithdraw !== 'boolean' ||
    !hash(row.snapshotDigest) ||
    !hash(row.originalSnapshotDigest)
  )
    return invalid();
  const held =
    row.state === 'RECONCILING' &&
    row.requestDisposition === 'WITHDRAWN' &&
    row.canWithdraw === false &&
    identifier(row.receiptCode) &&
    row.originalRevision < row.assetRevision;
  const unresolved =
    row.state === 'RECONCILIATION_REQUIRED' &&
    row.requestDisposition === 'UNRESOLVED' &&
    row.receiptCode === null &&
    row.originalRevision === row.assetRevision &&
    row.originalSnapshotDigest === row.snapshotDigest;
  if (!held && !unresolved) return invalid();
  return {
    contractVersion: 1,
    assetCode,
    assetRevision: row.assetRevision,
    state: row.state as ListingReconciliation['state'],
    requestDisposition:
      row.requestDisposition as ListingReconciliation['requestDisposition'],
    economicEffects: 'UNKNOWN',
    relistAllowed: false,
    snapshotDigest: row.snapshotDigest,
    receiptCode: row.receiptCode as string | null,
    originalRevision: row.originalRevision,
    originalSnapshotDigest: row.originalSnapshotDigest,
    canWithdraw: row.canWithdraw,
  };
}
/** Reads the fixed scoped owner endpoint; no private proof or generic schema fallback. */
export async function inspectListingReconciliation(
  configuration: OperationalOwnerConfiguration,
  assetCode: string,
): Promise<ListingReconciliation> {
  if (!identifier(assetCode)) return invalid();
  return parseListingReconciliation(
    await invokeOperationalOwner(
      configuration,
      'eWaste',
      `/listing-requests/${encodeURIComponent(assetCode)}/reconciliation`,
    ),
    assetCode,
  );
}
/** Sends one explicitly confirmed frozen command. Lost acknowledgements are not retried. */
export async function withdrawListingRequest(
  configuration: OperationalOwnerConfiguration,
  view: ListingReconciliation,
  reason: string,
  idempotencyKey: string,
): Promise<ListingReconciliation> {
  const original = parseListingReconciliation(view, view.assetCode);
  if (
    !original.canWithdraw ||
    !identifier(idempotencyKey) ||
    !reason.trim() ||
    reason.length > 1000 ||
    Array.from(reason).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return invalid();
  const result = parseListingReconciliation(
    await invokeOperationalOwner(
      configuration,
      'eWaste',
      `/listing-requests/${encodeURIComponent(view.assetCode)}/reconciliation`,
      {
        contractVersion: 1,
        confirmed: true,
        expectedRevision: original.assetRevision,
        snapshotDigest: original.snapshotDigest,
        idempotencyKey,
        reason: reason.trim(),
      },
      'POST',
    ),
    view.assetCode,
  );
  if (
    result.state !== 'RECONCILING' ||
    result.originalRevision !== original.assetRevision ||
    result.originalSnapshotDigest !== original.snapshotDigest
  )
    return invalid();
  return result;
}
