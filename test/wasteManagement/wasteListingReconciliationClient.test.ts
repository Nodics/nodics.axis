import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeOperationalOwner } from '../../src/operations/shared/operationalOwnerClient';
import {
  inspectListingReconciliation,
  parseListingReconciliation,
  withdrawListingRequest,
} from '../../src/operations/wasteManagement/api/wasteListingReconciliationClient';
import { configuration } from './listingFixtures';
vi.mock('../../src/operations/shared/operationalOwnerClient', () => ({
  invokeOperationalOwner: vi.fn(),
}));
const view = {
  contractVersion: 1,
  assetCode: 'ASSET',
  assetRevision: 2,
  state: 'RECONCILIATION_REQUIRED',
  requestDisposition: 'UNRESOLVED',
  economicEffects: 'UNKNOWN',
  relistAllowed: false,
  snapshotDigest: 'a'.repeat(64),
  originalRevision: 2,
  originalSnapshotDigest: 'a'.repeat(64),
  receiptCode: null,
  canWithdraw: true,
};
const held = {
  ...view,
  assetRevision: 3,
  state: 'RECONCILING',
  requestDisposition: 'WITHDRAWN',
  snapshotDigest: 'b'.repeat(64),
  receiptCode: 'HOLD_1',
  canWithdraw: false,
};
beforeEach(() => vi.resetAllMocks());
describe('legacy listing reconciliation owner client', () => {
  it('reads the fixed scoped endpoint and drops unknown fields', async () => {
    vi.mocked(invokeOperationalOwner).mockResolvedValue({
      ...view,
      commandUrl: '/malicious',
    });
    expect(await inspectListingReconciliation(configuration, 'ASSET')).toEqual(view);
    expect(invokeOperationalOwner).toHaveBeenCalledExactlyOnceWith(
      configuration,
      'eWaste',
      '/listing-requests/ASSET/reconciliation',
    );
  });
  it.each([
    { assetCode: 'OTHER' },
    { relistAllowed: true },
    { economicEffects: 'NONE' },
    { assetRevision: -1 },
    { state: 'CANCELLED' },
    { canWithdraw: 'true' },
    { originalSnapshotDigest: 'c'.repeat(64) },
  ])('refuses malformed or mismatched proof %o', (change) => {
    expect(() => parseListingReconciliation({ ...view, ...change }, 'ASSET')).toThrow();
  });
  it('posts exact frozen selectors once and confirms only the retained hold', async () => {
    vi.mocked(invokeOperationalOwner).mockResolvedValue(held);
    expect(
      (
        await withdrawListingRequest(
          configuration,
          parseListingReconciliation(view, 'ASSET'),
          ' Keep original evidence ',
          'hold-command-1',
        )
      ).state,
    ).toBe('RECONCILING');
    expect(invokeOperationalOwner).toHaveBeenCalledExactlyOnceWith(
      configuration,
      'eWaste',
      '/listing-requests/ASSET/reconciliation',
      {
        contractVersion: 1,
        confirmed: true,
        expectedRevision: 2,
        snapshotDigest: view.snapshotDigest,
        idempotencyKey: 'hold-command-1',
        reason: 'Keep original evidence',
      },
      'POST',
    );
  });
  it('does not retry an uncertain write or accept another original snapshot', async () => {
    vi.mocked(invokeOperationalOwner).mockResolvedValue({
      ...held,
      originalSnapshotDigest: 'c'.repeat(64),
    });
    await expect(
      withdrawListingRequest(
        configuration,
        parseListingReconciliation(view, 'ASSET'),
        'Hold',
        'hold-command-1',
      ),
    ).rejects.toThrow();
    expect(invokeOperationalOwner).toHaveBeenCalledTimes(1);
  });
  it('denies missing authority and blank reasons before transport', async () => {
    await expect(
      withdrawListingRequest(
        configuration,
        parseListingReconciliation({ ...view, canWithdraw: false }, 'ASSET'),
        'Hold',
        'hold-command-1',
      ),
    ).rejects.toThrow();
    await expect(
      withdrawListingRequest(
        configuration,
        parseListingReconciliation(view, 'ASSET'),
        ' ',
        'hold-command-1',
      ),
    ).rejects.toThrow();
    expect(invokeOperationalOwner).not.toHaveBeenCalled();
  });
});
