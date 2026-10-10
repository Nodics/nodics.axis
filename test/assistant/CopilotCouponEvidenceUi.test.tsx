/** Read-only simulation labels through the real typed client and isolated transport. */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { CopilotCouponComposer } from '../../src/assistant/CopilotCouponComposer';
import { createAssistantClient } from '../../src/assistant/api/assistantClient';
import { createCopilotCouponClient } from '../../src/assistant/api/copilotCouponClient';
import { couponContract, couponReview, couponWorkspace } from './copilotCouponFixture';

const configuration = {
  moduleBaseUrl: 'https://example.test/copilot',
  enterpriseCode: 'ACME',
  accessToken: 'employee',
  timeoutMs: 1000,
};
const notice = 'Local ITEM simulation. Goods delivery is not verified.';
const markers = {
  simulated: true,
  deliveryVerified: false,
  evidenceMode: 'LOCAL_SIMULATION',
};
const original = {
  ...couponReview,
  state: 'OUTCOME_UNKNOWN',
  revision: 4,
  impact: { summary: 'Inspect the original action.' },
};
/** Mocks only remote reads; every write remains a spy, never a runtime command. */
function mount(flags: Record<string, unknown> = {}, receiptState = 'COMPLETED') {
  const fetcher = vi.fn().mockImplementation((input: URL) => {
    let data: unknown;
    if (input.pathname.endsWith('/coupons/workspace'))
      data = {
        ...couponWorkspace,
        contractVersion: 1,
        enterpriseCode: 'ACME',
        pricedSourceRequired: false,
      };
    else if (input.pathname.endsWith('/coupons/redemptions'))
      data = {
        contractVersion: 1,
        enterpriseCode: 'ACME',
        observedAt: '2026-10-05T00:00:00Z',
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
            mode: 'LOCAL_SAMPLE',
            receiptCode: 'RECEIPT_1',
            merchantReceiptReference: 'SIM:merchant@outlet',
            recoveryRequired: false,
            ...flags,
          },
        ],
      };
    else if (input.pathname.endsWith('/coupon-receipt'))
      data = {
        confirmation: {
          ...original,
          state: receiptState === 'COMPLETED' ? 'CONSUMED' : 'OUTCOME_UNKNOWN',
          revision: 5,
        },
        receiptState,
        ...(receiptState === 'COMPLETED' ? { receiptCode: 'RECEIPT_1' } : {}),
        ...flags,
      };
    else throw new Error('Unexpected route');
    return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200 }));
  });
  const client = createCopilotCouponClient(configuration, fetcher);
  const prepare = vi.spyOn(client, 'prepare');
  const actions = {
    ...createAssistantClient(configuration, vi.fn()),
    getConfirmation: vi.fn().mockResolvedValue(original),
    approveConfirmation: vi.fn(),
    executeConfirmation: vi.fn(),
    rejectConfirmation: vi.fn(),
  };
  render(
    <CopilotCouponComposer
      contract={couponContract}
      client={client}
      actions={actions}
    />,
  );
  return { fetcher, prepare, actions };
}
/** Opens an existing owned action for inspection without preparing or executing ITEMs. */
async function inspect() {
  await userEvent.click(screen.getByRole('button', { name: 'Redeem a coupon' }));
  fireEvent.change(screen.getByLabelText('Action reference'), {
    target: { value: original.confirmationCode },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Open existing action' }));
  await userEvent.click(
    await screen.findByRole('button', { name: 'Check original receipt' }),
  );
}

it.each([
  ['ordinary queue', {}, false],
  ['simulated queue', markers, true],
] as const)(
  'renders %s without inferring evidence from LOCAL_SAMPLE or SIM handle',
  async (_name, flags, simulated) => {
    const { prepare, actions } = mount(flags);
    await userEvent.click(screen.getByRole('button', { name: 'Redeem a coupon' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Redemption activity' }));
    expect(await screen.findByText('RECEIPT_1')).toBeInTheDocument();
    const row = within(screen.getByText('PRODUCT_1').closest('tr')!);
    if (simulated) expect(row.getByRole('alert')).toHaveTextContent(notice);
    else expect(row.queryByText(notice)).not.toBeInTheDocument();
    expect(row.queryByText(/undefined|AED|LOCAL_SIMULATION/)).not.toBeInTheDocument();
    expect(prepare).not.toHaveBeenCalled();
    expect(actions.approveConfirmation).not.toHaveBeenCalled();
    expect(actions.executeConfirmation).not.toHaveBeenCalled();
  },
);

it.each(['COMPLETED', 'UNCONFIRMED'])(
  'labels a simulated %s inspection without enabling preparation or execution',
  async (state) => {
    const { prepare, actions, fetcher } = mount(markers, state);
    await inspect();
    expect(await screen.findByText(notice)).toBeInTheDocument();
    if (state === 'COMPLETED')
      expect(screen.getByText('Receipt reference: RECEIPT_1')).toBeInTheDocument();
    else
      expect(
        screen.getByText(couponContract.presentation.unconfirmed),
      ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Confirm fulfillment' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve reviewed benefit' }),
    ).not.toBeInTheDocument();
    expect(prepare).not.toHaveBeenCalled();
    expect(actions.executeConfirmation).not.toHaveBeenCalled();
    expect(
      fetcher.mock.calls.filter(([url]) => String(url).endsWith('/coupon-receipt')),
    ).toHaveLength(1);
  },
);

it('clears simulation evidence when starting another action', async () => {
  mount(markers);
  await inspect();
  expect(await screen.findByText(notice)).toBeInTheDocument();
  const dialog = within(screen.getByRole('dialog'));
  await userEvent.click(dialog.getByRole('button', { name: 'Redeem a coupon' }));
  expect(screen.queryByText(notice)).not.toBeInTheDocument();
  expect(screen.queryByText('Receipt reference: RECEIPT_1')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Action reference')).toHaveValue('');
});

it('keeps an ordinary inspected receipt unmarked without asserting delivery verification', async () => {
  mount();
  await inspect();
  expect(await screen.findByText('Receipt reference: RECEIPT_1')).toBeInTheDocument();
  expect(screen.queryByText(notice)).not.toBeInTheDocument();
  expect(screen.queryByText(/Goods delivery is verified/)).not.toBeInTheDocument();
});

it('rejects partial queue evidence rather than displaying a normal receipt', async () => {
  const { prepare, actions } = mount({ simulated: true });
  await userEvent.click(screen.getByRole('button', { name: 'Redeem a coupon' }));
  await userEvent.click(screen.getByRole('tab', { name: 'Redemption activity' }));
  expect(
    await screen.findByText(couponContract.presentation.unavailable),
  ).toBeInTheDocument();
  expect(screen.queryByText('RECEIPT_1')).not.toBeInTheDocument();
  expect(prepare).not.toHaveBeenCalled();
  expect(actions.executeConfirmation).not.toHaveBeenCalled();
});

it('refuses contradictory inspection markers without displaying success or replaying execution', async () => {
  const { prepare, actions, fetcher } = mount({ ...markers, deliveryVerified: true });
  await inspect();
  expect(
    await screen.findByText(couponContract.presentation.unavailable),
  ).toBeInTheDocument();
  expect(screen.queryByText('Receipt reference: RECEIPT_1')).not.toBeInTheDocument();
  expect(
    screen.queryByText(couponContract.presentation.completed),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(notice)).not.toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Check original receipt' }),
    ).toBeEnabled(),
  );
  expect(
    fetcher.mock.calls.filter(([url]) => String(url).endsWith('/coupon-receipt')),
  ).toHaveLength(1);
  expect(prepare).not.toHaveBeenCalled();
  expect(actions.approveConfirmation).not.toHaveBeenCalled();
  expect(actions.executeConfirmation).not.toHaveBeenCalled();
});
