/** Authored merchant recovery fixtures; no live coupon consumption or fulfillment occurs. */
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
const bootstrap = {} as AxisAuthenticatedBootstrap;
const workspace = {
  storeRequired: false,
  storeLabel: 'Outlet',
  pricedSourceRequired: false,
  stores: [],
};
const validated = {
  entitlementCode: 'owned-coupon',
  productCode: 'offer',
  claimStatus: 'UNCLAIMED',
  revision: 1,
  merchantLabel: 'Merchant',
  mode: 'MERCHANT_SCREEN',
  eligible: true,
  validationCode: 'fixture-validation',
  validationExpiresAt: '2099-01-01T00:00:00Z',
};
afterEach(() => vi.resetAllMocks());
it('requires an explicit receipt reference for local sample fulfillment too', async () => {
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce(workspace)
    .mockResolvedValueOnce({ ...validated, mode: 'LOCAL_SAMPLE' });
  const user = userEvent.setup();
  render(
    <MerchantRedemptionPanel
      bootstrap={bootstrap}
      accessToken="fixture-token"
      runtime={runtime}
    />,
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Customer coupon code' }),
    'COUPON-1',
  );
  await user.click(screen.getByRole('button', { name: 'Validate presented coupon' }));
  expect(
    await screen.findByRole('textbox', {
      name: 'Merchant transaction or receipt reference',
    }),
  ).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Confirm fulfillment' })).toBeDisabled();
});
it('supports initial validation without inventing an already-recorded redemption reference', async () => {
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce(workspace)
    .mockResolvedValueOnce(validated);
  const user = userEvent.setup();
  render(
    <MerchantRedemptionPanel
      bootstrap={bootstrap}
      accessToken="fixture-token"
      runtime={runtime}
    />,
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Customer coupon code' }),
    'COUPON-1',
  );
  await user.click(screen.getByRole('button', { name: 'Validate presented coupon' }));
  await screen.findByRole('dialog');
  expect(screen.getByRole('button', { name: 'Confirm fulfillment' })).toBeDisabled();
  expect(vi.mocked(invokeOperationalOwner)).toHaveBeenCalledTimes(2);
});
it('clears actionable state after an uncertain confirmation instead of repeating consumption', async () => {
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce(workspace)
    .mockResolvedValueOnce(validated)
    .mockRejectedValueOnce(new Error('Timeout'));
  const user = userEvent.setup();
  render(
    <MerchantRedemptionPanel
      bootstrap={bootstrap}
      accessToken="fixture-token"
      runtime={runtime}
    />,
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Customer coupon code' }),
    'COUPON-1',
  );
  await user.click(screen.getByRole('button', { name: 'Validate presented coupon' }));
  await user.type(
    await screen.findByRole('textbox', {
      name: 'Merchant transaction or receipt reference',
    }),
    'receipt-1',
  );
  await user.click(screen.getByRole('button', { name: 'Confirm fulfillment' }));
  await screen.findByText(/Fulfillment outcome is unconfirmed/);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(vi.mocked(invokeOperationalOwner)).toHaveBeenCalledTimes(3);
});
it('rejects malformed merchant queue data instead of showing selectable rows', async () => {
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce(workspace)
    .mockResolvedValueOnce({ redemptions: [{ ...validated, revision: '1' }] });
  const user = userEvent.setup();
  render(
    <MerchantRedemptionPanel
      bootstrap={bootstrap}
      accessToken="fixture-token"
      runtime={runtime}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Load merchant requests' }));
  await screen.findByText('Merchant request could not be confirmed.');
  expect(screen.queryByRole('button', { name: 'Review fulfillment' })).toBeNull();
});
