/** Isolated owner-response fixtures; no live delivery, runtime or external POS. */
import { render, screen, waitFor, within } from '@testing-library/react';
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
  pricedSourceLabel: 'Owner benefit reference',
  stores: [{ code: 'store-1', name: 'Outlet one', revision: 2 }],
};
const source = {
  sourceReference: 'SIM:handle-1',
  sourceHash: 'a'.repeat(64),
  sourceRevision: 4,
  storeCode: 'store-1',
  storeRevision: 2,
};
const simulatedBenefit = {
  ...source,
  sourceStage: 'SIMULATED_ITEMS',
  benefitType: 'ITEM',
  items: [
    { sku: 'APPAREL-1', quantity: 2, unit: 'EACH' },
    { sku: 'APPAREL-2', quantity: 1, unit: 'EACH' },
  ],
  simulated: true,
  verified: false,
  sourceType: 'ITEM_SIMULATION',
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
};
const markers = {
  simulated: true,
  deliveryVerified: false,
  evidenceMode: 'LOCAL_SIMULATION',
};
const completed = {
  ...validated,
  claimStatus: 'REDEEMED',
  revision: 9,
  receiptCode: 'receipt-1',
  merchantReceiptReference: source.sourceReference,
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
async function validate(
  benefit: unknown,
  reference = source.sourceReference,
  flags = {},
) {
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce(workspace)
    .mockResolvedValueOnce({ ...validated, ...flags, conditions: { benefit } });
  const user = userEvent.setup();
  mount();
  await select(user);
  await user.type(
    screen.getByRole('textbox', { name: 'Owner benefit reference' }),
    reference,
  );
  await user.click(screen.getByRole('button', { name: 'Validate presented coupon' }));
  return user;
}

it.each(['SIMULATION', 'LOCAL_SIMULATION'])(
  'renders %s ITEMs as unverified through review, confirmation and queue',
  async (evidenceMode) => {
    const evidence = { ...markers, evidenceMode };
    const user = await validate(simulatedBenefit, source.sourceReference, evidence);
    const dialog = within(await screen.findByRole('dialog'));
    expect(
      dialog.getByRole('heading', { name: 'Confirm ITEM simulation' }),
    ).toBeInTheDocument();
    expect(dialog.getByRole('alert')).toHaveTextContent(
      `ITEM simulation. Goods delivery is not verified. ${evidenceMode}.`,
    );
    expect(dialog.getByText('APPAREL-1 / 2 EACH')).toBeInTheDocument();
    expect(dialog.getByText('APPAREL-2 / 1 EACH')).toBeInTheDocument();
    expect(dialog.queryByText(/undefined/)).not.toBeInTheDocument();
    expect(dialog.queryByText(/AED/)).not.toBeInTheDocument();
    expect(
      dialog.getByRole('textbox', { name: 'Owner benefit reference' }),
    ).toBeDisabled();
    expect(vi.mocked(invokeOperationalOwner).mock.calls[1]?.[3]).toEqual({
      couponToken: 'TOKEN-1',
      storeCode: 'store-1',
      merchantReceiptReference: 'SIM:handle-1',
    });
    vi.mocked(invokeOperationalOwner)
      .mockResolvedValueOnce({ ...completed, ...evidence })
      .mockResolvedValueOnce({ redemptions: [{ ...completed, ...evidence }] });
    await user.click(dialog.getByRole('button', { name: 'Confirm simulation' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(
      await screen.findByText('Merchant receipt: SIM:handle-1'),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Goods delivery is not verified',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(evidenceMode);
    expect(vi.mocked(invokeOperationalOwner).mock.calls[2]?.[3]).toEqual({
      confirmed: true,
      validationCode: 'validation-1',
      validationExpiresAt: validated.validationExpiresAt,
      merchantReceiptReference: 'SIM:handle-1',
      expectedRevision: 7,
      storeCode: 'store-1',
    });
    expect(vi.mocked(invokeOperationalOwner).mock.calls[2]?.[5]).toEqual({
      idempotencyKey: 'confirm:owned-coupon',
    });
    expect(invokeOperationalOwner).toHaveBeenCalledTimes(4);
  },
);

it('renders genuinely delivered ITEM evidence without monetary placeholders or simulation claims', async () => {
  const user = await validate(
    {
      ...source,
      sourceReference: 'DELIVERY:goods-1',
      sourceStage: 'FULFILLED_ITEMS',
      benefitType: 'ITEM',
      items: simulatedBenefit.items,
      deliveredAt: '2020-01-01T00:00:00Z',
    },
    'DELIVERY:goods-1',
  );
  const dialog = within(await screen.findByRole('dialog'));
  expect(dialog.getByText('APPAREL-1 / 2 EACH')).toBeInTheDocument();
  expect(
    dialog.queryByText(/undefined|LOCAL_SIMULATION|not verified/),
  ).not.toBeInTheDocument();
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce({
      ...completed,
      merchantReceiptReference: 'DELIVERY:goods-1',
    })
    .mockResolvedValueOnce({ redemptions: [] });
  await user.click(dialog.getByRole('button', { name: 'Confirm fulfillment' }));
  expect(
    await screen.findByText('No merchant requests in your assigned scope.'),
  ).toBeInTheDocument();
});

it('accepts canonical @ SIM handles through validation, frozen review and confirmation', async () => {
  const reference = 'SIM:merchant@outlet-1';
  const user = await validate(
    { ...simulatedBenefit, sourceReference: reference },
    reference,
  );
  const dialog = within(await screen.findByRole('dialog'));
  expect(dialog.getByRole('textbox', { name: 'Owner benefit reference' })).toHaveValue(
    reference,
  );
  expect(dialog.getByRole('button', { name: 'Confirm simulation' })).toBeEnabled();
  expect(vi.mocked(invokeOperationalOwner).mock.calls[1]?.[3]).toEqual({
    couponToken: 'TOKEN-1',
    storeCode: 'store-1',
    merchantReceiptReference: reference,
  });
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce({
      ...completed,
      ...markers,
      merchantReceiptReference: reference,
    })
    .mockResolvedValueOnce({
      redemptions: [{ ...completed, ...markers, merchantReceiptReference: reference }],
    });
  await user.click(dialog.getByRole('button', { name: 'Confirm simulation' }));
  expect(await screen.findByText(`Merchant receipt: ${reference}`)).toBeInTheDocument();
  expect(vi.mocked(invokeOperationalOwner).mock.calls[2]?.[3]).toEqual({
    confirmed: true,
    validationCode: 'validation-1',
    validationExpiresAt: validated.validationExpiresAt,
    merchantReceiptReference: reference,
    expectedRevision: 7,
    storeCode: 'store-1',
  });
});

it.each([
  ['missing markers', {}],
  ['verified goods contradiction', { ...markers, deliveryVerified: true }],
  ['wrong evidence mode', { ...markers, evidenceMode: 'DELIVERED' }],
  [
    'new mode with verified goods',
    { ...markers, evidenceMode: 'SIMULATION', deliveryVerified: true },
  ],
  [
    'new mode without simulation',
    { deliveryVerified: false, evidenceMode: 'SIMULATION' },
  ],
  ['new mode without delivery flag', { simulated: true, evidenceMode: 'SIMULATION' }],
  ['combined mode string', { ...markers, evidenceMode: 'SIMULATION|LOCAL_SIMULATION' }],
  ['multiple modes', { ...markers, evidenceMode: ['SIMULATION', 'LOCAL_SIMULATION'] }],
])(
  'treats confirmation with %s as uncertain without retrying',
  async (_name, flags) => {
    const user = await validate(simulatedBenefit);
    await screen.findByRole('dialog');
    vi.mocked(invokeOperationalOwner).mockResolvedValueOnce({ ...completed, ...flags });
    await user.click(screen.getByRole('button', { name: 'Confirm simulation' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Inspect merchant requests');
    expect(invokeOperationalOwner).toHaveBeenCalledTimes(3);
    expect(
      screen.queryByRole('button', { name: 'Confirm simulation' }),
    ).not.toBeInTheDocument();
  },
);

it.each([
  ['verified simulation', { verified: true }],
  ['missing simulation marker', { simulated: undefined }],
  ['delivery source masquerading as simulation', { sourceType: 'ITEM_DELIVERY' }],
  ['delivery time on simulation', { deliveredAt: '2020-01-01T00:00:00Z' }],
  ['unsupported source stage', { sourceStage: 'ITEMS' }],
  ['mismatched source reference', { sourceReference: 'SIM:another' }],
  ['non-simulation handle', { sourceReference: 'DELIVERY:goods-1' }],
  ['invalid source hash', { sourceHash: 'invalid' }],
  ['mismatched store revision', { storeRevision: 3 }],
  ['non-ITEM benefit', { benefitType: 'AMOUNT' }],
  ['empty items', { items: [] }],
  [
    'too many items',
    {
      items: Array.from({ length: 21 }, (_, i) => ({
        sku: `SKU-${i}`,
        quantity: 1,
        unit: 'EACH',
      })),
    },
  ],
  [
    'duplicate items',
    { items: [simulatedBenefit.items[0], simulatedBenefit.items[0]] },
  ],
  [
    'fractional quantity',
    { items: [{ sku: 'APPAREL-1', quantity: 1.5, unit: 'EACH' }] },
  ],
  [
    'excessive quantity',
    { items: [{ sku: 'APPAREL-1', quantity: 101, unit: 'EACH' }] },
  ],
  ['wrong unit', { items: [{ sku: 'APPAREL-1', quantity: 1, unit: 'BOX' }] }],
])('refuses %s before opening confirmation', async (_name, changes) => {
  await validate({ ...simulatedBenefit, ...changes });
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be confirmed');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(invokeOperationalOwner).toHaveBeenCalledTimes(2);
});

it.each([null, 'not-evidence', []])(
  'refuses non-object benefit %j',
  async (benefit) => {
    await validate(benefit);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'benefit source could not be confirmed',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  },
);

it.each([
  ['missing delivery time', {}],
  ['invalid delivery time', { deliveredAt: 'not-a-time' }],
  ['future delivery time', { deliveredAt: '2999-01-01T00:00:00Z' }],
  ['simulation marker', { deliveredAt: '2020-01-01T00:00:00Z', simulated: true }],
])('refuses genuine ITEM evidence with %s', async (_name, fields) => {
  await validate({
    ...source,
    sourceStage: 'FULFILLED_ITEMS',
    benefitType: 'ITEM',
    items: simulatedBenefit.items,
    ...fields,
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'item evidence could not be confirmed',
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('refuses monetary evidence carrying contradictory simulation markers', async () => {
  await validate(
    {
      ...source,
      sourceReference: 'CART:basket-1',
      sourceStage: 'PRICED_CART',
      currency: 'AED',
      subtotalAmount: '100',
      discountAmount: '10',
      simulated: true,
    },
    'CART:basket-1',
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'priced source could not be confirmed',
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it.each([10, '-1', '1e2', 'NaN', '0'.repeat(129)])(
  'retains exact monetary validation for invalid amount %j',
  async (amount) => {
    await validate(
      {
        ...source,
        sourceReference: 'CART:basket-1',
        sourceStage: 'PRICED_CART',
        currency: 'AED',
        subtotalAmount: amount,
        discountAmount: '10',
      },
      'CART:basket-1',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'priced source could not be confirmed',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  },
);

it.each([
  ['normal merchant mode', { ...completed }],
  ['local sample mode', { ...completed, mode: 'LOCAL_SAMPLE' }],
  ['explicit simulation markers', { ...completed, ...markers }],
  [
    'current simulation markers',
    { ...completed, ...markers, evidenceMode: 'SIMULATION' },
  ],
  ['partial simulation markers', { ...completed, simulated: true }],
])('labels queue simulation only from exact owner evidence: %s', async (_name, row) => {
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce(workspace)
    .mockResolvedValueOnce({ redemptions: [row] });
  const user = userEvent.setup();
  mount();
  await select(user);
  await user.click(screen.getByRole('button', { name: 'Load merchant requests' }));
  if ('simulated' in row && !('deliveryVerified' in row)) {
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'simulation evidence could not be confirmed',
    );
    expect(
      screen.queryByText('Merchant receipt: SIM:handle-1'),
    ).not.toBeInTheDocument();
  } else {
    expect(
      await screen.findByText('Merchant receipt: SIM:handle-1'),
    ).toBeInTheDocument();
    if ('simulated' in row)
      expect(screen.getByRole('alert')).toHaveTextContent(String(row.evidenceMode));
    else expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  }
});

it.each(
  ['SIMULATION', 'LOCAL_SIMULATION'].flatMap((evidenceMode) =>
    ['simulated', 'deliveryVerified', 'evidenceMode'].map(
      (key) => [evidenceMode, key] as const,
    ),
  ),
)(
  'rejects accessor %s evidence field %s without reading it',
  async (evidenceMode, key) => {
    const row = { ...completed, ...markers, evidenceMode };
    const getter = vi.fn(() => true);
    Object.defineProperty(row, key, { get: getter, enumerable: true });
    vi.mocked(invokeOperationalOwner)
      .mockResolvedValueOnce(workspace)
      .mockResolvedValueOnce({ redemptions: [row] });
    const user = userEvent.setup();
    mount();
    await select(user);
    await user.click(screen.getByRole('button', { name: 'Load merchant requests' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'simulation evidence could not be confirmed',
    );
    expect(getter).not.toHaveBeenCalled();
    expect(
      screen.queryByText('Merchant receipt: SIM:handle-1'),
    ).not.toBeInTheDocument();
    expect(invokeOperationalOwner).toHaveBeenCalledTimes(2);
  },
);

it.each(['SIMULATION', 'LOCAL_SIMULATION'])(
  'resumes %s evidence with its original reference and confirmation identity',
  async (evidenceMode) => {
    const evidence = { ...markers, evidenceMode };
    vi.mocked(invokeOperationalOwner)
      .mockResolvedValueOnce(workspace)
      .mockResolvedValueOnce({
        redemptions: [
          {
            ...validated,
            ...evidence,
            recoveryRequired: true,
            confirmationKey: 'original-confirmation',
            merchantReceiptReference: source.sourceReference,
          },
        ],
      });
    const user = userEvent.setup();
    mount();
    await select(user);
    await user.click(screen.getByRole('button', { name: 'Load merchant requests' }));
    await user.click(
      await screen.findByRole('button', { name: 'Resume simulation confirmation' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByRole('alert')).toHaveTextContent(
      'Goods delivery is not verified',
    );
    expect(
      dialog.getByRole('textbox', { name: 'Owner benefit reference' }),
    ).toHaveValue('SIM:handle-1');
    expect(
      dialog.getByRole('textbox', { name: 'Owner benefit reference' }),
    ).toBeDisabled();
    vi.mocked(invokeOperationalOwner)
      .mockResolvedValueOnce({ ...completed, ...evidence })
      .mockResolvedValueOnce({ redemptions: [{ ...completed, ...evidence }] });
    await user.click(dialog.getByRole('button', { name: 'Confirm simulation' }));
    expect(
      await screen.findByText('Merchant receipt: SIM:handle-1'),
    ).toBeInTheDocument();
    expect(vi.mocked(invokeOperationalOwner).mock.calls[2]?.[5]).toEqual({
      idempotencyKey: 'original-confirmation',
    });
    expect(vi.mocked(invokeOperationalOwner).mock.calls[2]?.[3]).toEqual({
      confirmed: true,
      validationCode: 'validation-1',
      validationExpiresAt: validated.validationExpiresAt,
      merchantReceiptReference: 'SIM:handle-1',
      expectedRevision: 7,
      storeCode: 'store-1',
    });
  },
);
