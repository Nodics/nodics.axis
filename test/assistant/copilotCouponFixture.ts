/** @file Synthetic owner metadata and immutable review for local coupon UI tests, never real fulfillment. */
import type { AssistantConfirmation } from '../../src/assistant/api/assistantContracts';
import { parseCouponContract } from '../../src/assistant/api/copilotCouponClient';
export const couponContract = parseCouponContract({
  contractVersion: 1,
  redemptionsAvailable: true,
  presentation: {
    redeemTab: 'Redeem',
    redemptionsTab: 'Redemption activity',
    refreshRedemptions: 'Refresh activity',
    emptyRedemptions: 'No redemption activity',
    recoveryRequired: 'Original receipt review required',
    product: 'Product',
    status: 'Status',
    open: 'Redeem a coupon',
    title: 'Coupon fulfillment',
    coupon: 'Customer coupon code',
    receipt: 'Receipt reference',
    prepare: 'Validate and review',
    close: 'Close',
    unavailable:
      'Coupon service unavailable. Reload the original action before continuing.',
    approve: 'Approve reviewed benefit',
    execute: 'Confirm fulfillment',
    reject: 'Reject',
    expired: 'Validation expired',
    completed: 'Commerce confirmed redemption.',
    secureMessage: 'Use secure input',
    inspect: 'Check original receipt',
    reload: 'Reload action',
    resume: 'Open existing action',
    actionReference: 'Action reference',
    unconfirmed:
      'Commerce has not confirmed the original redemption. Do not repeat fulfillment.',
  },
});
export const couponWorkspace = {
  storeRequired: true,
  storeLabel: 'Authorized outlet',
  receiptLabel: undefined,
  stores: [{ code: 'STORE_1', name: 'Downtown collection centre', revision: 1 }],
};
export const couponReview: AssistantConfirmation = {
  confirmationCode: 'coupon-plan-local-example',
  conversationCode: 'standalone',
  operationId: 'commerce.coupon.redeem',
  state: 'PENDING',
  revision: 1,
  argumentsDigest: 'a'.repeat(64),
  expiresAt: '2099-01-01T00:00:00Z',
  impact: {
    summary: 'Confirm that the reviewed coupon benefit has been fulfilled.',
    review: [
      {
        title: 'Coupon fulfillment',
        fields: [
          { label: 'Issuing enterprise', value: 'Example enterprise' },
          { label: 'Benefit', value: 'AED 10 purchase discount' },
          { label: 'Receipt reference', value: 'SALE-123' },
          { label: 'Outlet', value: 'Downtown collection centre' },
        ],
      },
    ],
  },
};
