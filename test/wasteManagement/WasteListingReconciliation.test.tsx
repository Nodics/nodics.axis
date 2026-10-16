import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { WasteListingReconciliation } from '../../src/operations/wasteManagement/WasteListingReconciliation';
import {
  inspectListingReconciliation,
  withdrawListingRequest,
  type ListingReconciliation,
} from '../../src/operations/wasteManagement/api/wasteListingReconciliationClient';
import { configuration } from './listingFixtures';
vi.mock(
  '../../src/operations/wasteManagement/api/wasteListingReconciliationClient',
  () => ({ inspectListingReconciliation: vi.fn(), withdrawListingRequest: vi.fn() }),
);
const view: ListingReconciliation = {
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
const held: ListingReconciliation = {
  ...view,
  assetRevision: 3,
  state: 'RECONCILING',
  requestDisposition: 'WITHDRAWN',
  snapshotDigest: 'b'.repeat(64),
  receiptCode: 'HOLD_1',
  canWithdraw: false,
};
const copy = {
  inspectLabel: 'Inspect original request',
  withdrawLabel: 'Withdraw request and retain hold',
  reasonLabel: 'Public reason',
  confirmLabel: 'Confirm withdrawal',
  cancelLabel: 'Cancel',
  holdMessage: 'Request withdrawn; reconciliation pending. Relisting remains blocked.',
  uncertainMessage: 'Outcome unconfirmed. Inspect before another action.',
  unavailableMessage: 'Owner unavailable.',
};
const props = {
  configuration,
  authority: {},
  assetCode: 'ASSET',
  assetRevision: 2,
  copy,
  onBusyChange: vi.fn(),
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(inspectListingReconciliation).mockResolvedValue(view);
  vi.mocked(withdrawListingRequest).mockResolvedValue(held);
});
async function confirm() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: copy.inspectLabel }));
  await user.click(await screen.findByRole('button', { name: copy.withdrawLabel }));
  expect(screen.getByRole('button', { name: copy.confirmLabel })).toBeDisabled();
  await user.type(
    screen.getByLabelText(copy.reasonLabel),
    'Preserve original evidence',
  );
  await user.click(screen.getByRole('button', { name: copy.confirmLabel }));
}
it('requires explicit inspection, reason and confirmation and reports a hold not cancellation', async () => {
  render(<WasteListingReconciliation {...props} />);
  expect(inspectListingReconciliation).not.toHaveBeenCalled();
  await confirm();
  expect(await screen.findByText('HOLD_1')).toBeVisible();
  expect(screen.getByText(copy.holdMessage)).toBeVisible();
  expect(withdrawListingRequest).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByRole('button', { name: copy.withdrawLabel }),
  ).not.toBeInTheDocument();
});
it('keeps an uncertain command held across close/reopen and read-only inspection', async () => {
  vi.mocked(withdrawListingRequest).mockRejectedValue(new Error('Lost acknowledgment'));
  const page = render(<WasteListingReconciliation {...props} />);
  await confirm();
  expect(await screen.findByText(copy.uncertainMessage)).toBeVisible();
  page.rerender(<WasteListingReconciliation {...props} assetCode={undefined} />);
  page.rerender(<WasteListingReconciliation {...props} />);
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: copy.inspectLabel }));
  expect(
    screen.queryByRole('button', { name: copy.withdrawLabel }),
  ).not.toBeInTheDocument();
  expect(withdrawListingRequest).toHaveBeenCalledTimes(1);
});
it('retires late private reads after authority changes', async () => {
  let resolve!: (value: ListingReconciliation) => void;
  vi.mocked(inspectListingReconciliation).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const page = render(<WasteListingReconciliation {...props} />);
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: copy.inspectLabel }));
  page.rerender(<WasteListingReconciliation {...props} authority={{}} />);
  await act(async () => {
    resolve(held);
    await Promise.resolve();
  });
  expect(screen.queryByText('HOLD_1')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: copy.inspectLabel })).toBeEnabled();
});
it('does not offer withdrawal when the owner denies admission', async () => {
  vi.mocked(inspectListingReconciliation).mockResolvedValue({
    ...view,
    canWithdraw: false,
  });
  render(<WasteListingReconciliation {...props} />);
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: copy.inspectLabel }));
  expect(
    screen.queryByRole('button', { name: copy.withdrawLabel }),
  ).not.toBeInTheDocument();
});
