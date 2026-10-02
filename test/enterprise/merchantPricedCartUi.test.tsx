/** Authored native priced-cart reference fixtures; no behavioral execution or external POS. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import { MerchantRedemptionPanel } from '../../src/operations/promotions/MerchantRedemptionPanel';
import { invokeOperationalOwner } from '../../src/operations/shared/operationalOwnerClient';
import { runtime } from './registrationFixtures';
vi.mock('../../src/operations/shared/operationalOwnerClient', () => ({
  invokeOperationalOwner: vi.fn(),
}));
vi.mock('../../src/bootstrap/publicBootstrap', () => ({
  selectModuleConnection: () => ({ endpoint: 'https://fixture.example.test' }),
}));
afterEach(() => vi.resetAllMocks());
const workspace = {
  storeRequired: true,
  storeLabel: 'Outlet',
  pricedSourceRequired: true,
  pricedSourceLabel: 'Owner basket reference',
  stores: [{ code: 'store-1', name: 'Outlet one', revision: 2 }],
};
const benefit = {
  sourceReference: 'CART:basket-1',
  currency: 'AED',
  subtotalAmount: '100',
  discountAmount: '10',
  sourceStage: 'PRICED_CART',
  sourceHash: 'a'.repeat(64),
  sourceRevision: 4,
  storeCode: 'store-1',
  storeRevision: 2,
};
const validated = {
  entitlementCode: 'owned-coupon',
  productCode: 'offer',
  claimStatus: 'UNCLAIMED',
  revision: 7,
  merchantLabel: 'Merchant',
  mode: 'MERCHANT_SCREEN',
  eligible: true,
  validationCode: 'validation-1',
  validationExpiresAt: '2099-01-01T00:00:00Z',
  storeCode: 'store-1',
  storeRevision: 2,
  conditions: { benefit },
};
const mount = () =>
  render(
    <MerchantRedemptionPanel
      bootstrap={{} as AxisAuthenticatedBootstrap}
      accessToken="fixture-token"
      runtime={runtime}
    />,
  );
async function select(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByRole('textbox', { name: 'Customer coupon code' }),
    'TOKEN-1',
  );
  await user.click(await screen.findByRole('combobox', { name: 'Outlet' }));
  await user.click(screen.getByRole('option', { name: 'Outlet one' }));
}
it('requires the existing basket before validation and freezes exact source evidence through confirmation', async () => {
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce(workspace)
    .mockResolvedValueOnce(validated)
    .mockResolvedValueOnce({
      ...validated,
      claimStatus: 'REDEEMED',
      revision: 9,
      receiptCode: 'receipt-1',
      merchantReceiptReference: benefit.sourceReference,
    })
    .mockResolvedValueOnce({ redemptions: [] });
  const user = userEvent.setup();
  mount();
  await select(user);
  expect(
    screen.getByRole('button', { name: 'Validate presented coupon' }),
  ).toBeDisabled();
  await user.type(
    screen.getByRole('textbox', { name: 'Owner basket reference' }),
    benefit.sourceReference,
  );
  await user.click(screen.getByRole('button', { name: 'Validate presented coupon' }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(
    screen.getByRole('textbox', { name: 'Owner basket reference' }),
  ).toBeDisabled();
  expect(vi.mocked(invokeOperationalOwner).mock.calls[1]?.[3]).toEqual({
    couponToken: 'TOKEN-1',
    storeCode: 'store-1',
    merchantReceiptReference: benefit.sourceReference,
  });
  await user.click(screen.getByRole('button', { name: 'Confirm fulfillment' }));
  expect(vi.mocked(invokeOperationalOwner).mock.calls[2]?.[3]).toEqual({
    confirmed: true,
    validationCode: 'validation-1',
    validationExpiresAt: validated.validationExpiresAt,
    merchantReceiptReference: benefit.sourceReference,
    expectedRevision: 7,
    storeCode: 'store-1',
  });
  expect(vi.mocked(invokeOperationalOwner).mock.calls[2]?.[5]).toEqual({
    idempotencyKey: 'confirm:owned-coupon',
  });
});
it('rejects a mismatched source rather than fabricating monetary evidence', async () => {
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce(workspace)
    .mockResolvedValueOnce({
      ...validated,
      conditions: { benefit: { ...benefit, sourceReference: 'CART:other' } },
    });
  const user = userEvent.setup();
  mount();
  await select(user);
  await user.type(
    screen.getByRole('textbox', { name: 'Owner basket reference' }),
    benefit.sourceReference,
  );
  await user.click(screen.getByRole('button', { name: 'Validate presented coupon' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'priced source could not be confirmed',
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(invokeOperationalOwner).toHaveBeenCalledTimes(2);
});
