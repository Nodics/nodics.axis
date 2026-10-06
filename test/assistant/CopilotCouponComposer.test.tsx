/** @file Sensitive coupon UI, strict evidence, explicit execution and uncertain-recovery coverage. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { CopilotCouponComposer } from '../../src/assistant/CopilotCouponComposer';
import { createAssistantClient } from '../../src/assistant/api/assistantClient';
import {
  createCopilotCouponClient,
  parseCouponContract,
  parseCouponRedemptions,
  parseCouponWorkspace,
} from '../../src/assistant/api/copilotCouponClient';
import { couponContract, couponReview, couponWorkspace } from './copilotCouponFixture';
const configuration = {
  moduleBaseUrl: 'https://example.test/copilot',
  enterpriseCode: 'ACME',
  accessToken: 'employee',
  timeoutMs: 1000,
};
afterEach(() => vi.unstubAllGlobals());
/** Installs inert clients; all writes are spies. */
function setup() {
  const client = {
    workspace: vi.fn().mockResolvedValue(couponWorkspace),
    redemptions: vi.fn().mockResolvedValue({
      observedAt: '2026-10-05T00:00:00.000Z',
      limitation: 'Current enterprise-scoped records.',
      redemptions: [
        {
          entitlementCode: 'ENTITLEMENT_1',
          productCode: 'PRODUCT_1',
          claimStatus: 'REDEEMED',
          status: 'ACTIVE',
          revision: 2,
          merchantCode: 'ISSUER',
          merchantLabel: 'Authorized issuer',
          mode: 'MERCHANT_SCREEN',
          receiptCode: 'RECEIPT_1',
          recoveryRequired: false,
        },
      ],
    }),
    prepare: vi.fn().mockResolvedValue(couponReview),
    inspect: vi.fn().mockResolvedValue({
      confirmation: { ...couponReview, state: 'CONSUMED', revision: 5 },
      receiptState: 'COMPLETED',
      receiptCode: 'RECEIPT_1',
    }),
  };
  const actions = {
    ...createAssistantClient(configuration, vi.fn()),
    approveConfirmation: vi
      .fn()
      .mockResolvedValue({ ...couponReview, state: 'APPROVED', revision: 2 }),
    executeConfirmation: vi
      .fn()
      .mockRejectedValue(new Error('private transport failure')),
    getConfirmation: vi
      .fn()
      .mockResolvedValue({ ...couponReview, state: 'OUTCOME_UNKNOWN', revision: 4 }),
  };
  return { client, actions };
}
/** Fills a synthetic secret and selects an owner-provided outlet. */
async function fill() {
  await userEvent.click(screen.getByRole('button', { name: 'Redeem a coupon' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Customer coupon code')).not.toBeDisabled(),
  );
  fireEvent.change(screen.getByLabelText('Customer coupon code'), {
    target: { value: 'PRIVATE-1234' },
  });
  fireEvent.change(screen.getByLabelText('Receipt reference'), {
    target: { value: 'SALE-123' },
  });
  await userEvent.click(screen.getByRole('combobox', { name: /Authorized outlet/ }));
  await userEvent.click(
    screen.getByRole('option', { name: 'Downtown collection centre' }),
  );
}
it('requires strict owner copy and rejects foreign, malformed and duplicate outlets', () => {
  expect(() =>
    parseCouponContract({
      contractVersion: 2,
      presentation: couponContract.presentation,
    }),
  ).toThrow();
  const base = {
    contractVersion: 1,
    enterpriseCode: 'ACME',
    storeRequired: true,
    storeLabel: 'Outlet',
    pricedSourceRequired: false,
    stores: couponWorkspace.stores,
  };
  expect(parseCouponWorkspace(base, 'ACME').stores).toEqual(couponWorkspace.stores);
  for (const patch of [
    { enterpriseCode: 'OTHER' },
    { stores: [...base.stores, ...base.stores] },
    { pricedSourceRequired: true },
    { storeRequired: 'true' },
  ])
    expect(() => parseCouponWorkspace({ ...base, ...patch }, 'ACME')).toThrow();
});
it('validates and displays bounded redemption activity without private owner fields', async () => {
  const parsed = parseCouponRedemptions(
    {
      contractVersion: 1,
      enterpriseCode: 'ACME',
      observedAt: '2026-10-05T00:00:00.000Z',
      limitation: 'Current enterprise-scoped records.',
      redemptions: [
        {
          entitlementCode: 'ENTITLEMENT_1',
          productCode: 'PRODUCT_1',
          claimStatus: 'REDEEMED',
          status: 'ACTIVE',
          revision: 2,
          merchantCode: 'ISSUER',
          merchantLabel: 'Authorized issuer',
          mode: 'MERCHANT_SCREEN',
          receiptCode: 'RECEIPT_1',
          recoveryRequired: false,
        },
      ],
    },
    'ACME',
  );
  expect(parsed.redemptions).toHaveLength(1);
  expect(() =>
    parseCouponRedemptions(
      {
        contractVersion: 1,
        enterpriseCode: 'ACME',
        observedAt: '2026-10-05T00:00:00.000Z',
        limitation: 'Current enterprise-scoped records.',
        redemptions: [
          {
            ...parsed.redemptions[0],
            confirmationKey: 'private-command',
          },
        ],
      },
      'ACME',
    ),
  ).toThrow();
  const { client, actions } = setup();
  render(
    <CopilotCouponComposer
      contract={couponContract}
      client={client}
      actions={actions}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Redeem a coupon' }));
  await userEvent.click(screen.getByRole('tab', { name: 'Redemption activity' }));
  expect(await screen.findByText('PRODUCT_1')).toBeInTheDocument();
  expect(screen.getByText('RECEIPT_1')).toBeInTheDocument();
  expect(client.redemptions).toHaveBeenCalledTimes(1);
});
it('masks input and separates validate, approve, execute and receipt recovery without retry', async () => {
  const { client, actions } = setup();
  render(
    <CopilotCouponComposer
      contract={couponContract}
      client={client}
      actions={actions}
    />,
  );
  expect(client.workspace).not.toHaveBeenCalled();
  await fill();
  expect(screen.getByLabelText('Customer coupon code')).toHaveAttribute(
    'type',
    'password',
  );
  expect(client.prepare).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Validate and review' }));
  expect(client.prepare).toHaveBeenCalledExactlyOnceWith({
    couponToken: 'PRIVATE-1234',
    merchantReceiptReference: 'SALE-123',
    storeCode: 'STORE_1',
  });
  expect(await screen.findByText('AED 10 purchase discount')).toBeInTheDocument();
  expect(screen.queryByDisplayValue('PRIVATE-1234')).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'Approve reviewed benefit' }),
  );
  expect(actions.executeConfirmation).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Confirm fulfillment' }));
  expect(await screen.findByText('OUTCOME_UNKNOWN')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Confirm fulfillment' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('private transport failure')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Reload action' }));
  await userEvent.click(screen.getByRole('button', { name: 'Check original receipt' }));
  expect(await screen.findByText('Commerce confirmed redemption.')).toBeInTheDocument();
  expect(actions.executeConfirmation).toHaveBeenCalledTimes(1);
  expect(client.inspect).toHaveBeenCalledTimes(1);
});
it('offline never submits and closing clears the raw coupon draft', async () => {
  const { client, actions } = setup();
  render(
    <CopilotCouponComposer
      contract={couponContract}
      client={client}
      actions={actions}
    />,
  );
  await fill();
  vi.stubGlobal('navigator', { onLine: false });
  fireEvent.click(screen.getByRole('button', { name: 'Validate and review' }));
  expect(client.prepare).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Redeem a coupon' }));
  expect(screen.getByLabelText('Customer coupon code')).toHaveValue('');
});
it('reopens an owned action by reference and uncertain evidence never enables fulfillment', async () => {
  const { client, actions } = setup();
  client.inspect.mockResolvedValue({
    confirmation: { ...couponReview, state: 'OUTCOME_UNKNOWN', revision: 4 },
    receiptState: 'UNCONFIRMED',
  });
  render(
    <CopilotCouponComposer
      contract={couponContract}
      client={client}
      actions={actions}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Redeem a coupon' }));
  fireEvent.change(screen.getByLabelText('Action reference'), {
    target: { value: couponReview.confirmationCode },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Open existing action' }));
  await userEvent.click(
    await screen.findByRole('button', { name: 'Check original receipt' }),
  );
  expect(
    await screen.findByText(couponContract.presentation.unconfirmed),
  ).toBeInTheDocument();
  expect(actions.executeConfirmation).not.toHaveBeenCalled();
});
it('aborts closed metadata and does not restore late outlet choices', async () => {
  const { client, actions } = setup();
  let signal: AbortSignal | undefined;
  client.workspace.mockImplementation((input: AbortSignal) => {
    signal = input;
    return new Promise(() => {});
  });
  const view = render(
    <CopilotCouponComposer
      contract={couponContract}
      client={client}
      actions={actions}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Redeem a coupon' }));
  await waitFor(() => expect(signal).toBeDefined());
  view.unmount();
  expect(signal?.aborted).toBe(true);
});
it('sends the token only to fixed sensitive preparation with original employee headers and no cache', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data: { confirmation: couponReview } }), {
      status: 200,
    }),
  );
  await createCopilotCouponClient(configuration, fetcher).prepare({
    couponToken: 'PRIVATE-1234',
    merchantReceiptReference: 'SALE-123',
  });
  expect(String(fetcher.mock.calls[0]![0])).toBe(
    'https://example.test/copilot/v0/coupons/prepare',
  );
  const options = fetcher.mock.calls[0]![1] as RequestInit;
  expect(new Headers(options.headers).get('Authorization')).toBe('Bearer employee');
  expect(new Headers(options.headers).get('x-enterprise-code')).toBe('ACME');
  expect(options.cache).toBe('no-store');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('loads redemption activity only through the fixed uncached read route', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        data: {
          contractVersion: 1,
          enterpriseCode: 'ACME',
          observedAt: '2026-10-05T00:00:00.000Z',
          limitation: 'Current enterprise-scoped records.',
          redemptions: [],
        },
      }),
      { status: 200 },
    ),
  );
  await createCopilotCouponClient(configuration, fetcher).redemptions();
  expect(String(fetcher.mock.calls[0]![0])).toBe(
    'https://example.test/copilot/v0/coupons/redemptions',
  );
  const options = fetcher.mock.calls[0]![1] as RequestInit;
  expect(options.method).toBe('GET');
  expect(options.cache).toBe('no-store');
});
