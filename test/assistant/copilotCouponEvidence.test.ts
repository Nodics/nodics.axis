/** Exact read-only simulation projections; synthetic transport, no live execution. */
import { expect, it, vi } from 'vitest';
import {
  createCopilotCouponClient,
  parseCouponRedemptions,
} from '../../src/assistant/api/copilotCouponClient';
import { couponReview } from './copilotCouponFixture';

const configuration = {
  moduleBaseUrl: 'https://example.test/copilot',
  enterpriseCode: 'ACME',
  accessToken: 'employee',
  timeoutMs: 1000,
};
const markers = {
  simulated: true,
  deliveryVerified: false,
  evidenceMode: 'LOCAL_SIMULATION',
};
const row = {
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
};
const queue = (flags: Record<string, unknown>) => ({
  contractVersion: 1,
  enterpriseCode: 'ACME',
  observedAt: '2026-10-05T00:00:00.000Z',
  limitation: 'Current enterprise-scoped records.',
  redemptions: [{ ...row, ...flags }],
});
const malformed = [
  ['only simulated', { simulated: true }],
  ['only delivery flag', { deliveryVerified: false }],
  ['only mode', { evidenceMode: 'LOCAL_SIMULATION' }],
  ['missing mode', { simulated: true, deliveryVerified: false }],
  ['missing delivery flag', { simulated: true, evidenceMode: 'LOCAL_SIMULATION' }],
  [
    'missing simulated flag',
    { deliveryVerified: false, evidenceMode: 'LOCAL_SIMULATION' },
  ],
  ['false simulation', { ...markers, simulated: false }],
  ['verified delivery', { ...markers, deliveryVerified: true }],
  ['wrong mode', { ...markers, evidenceMode: 'DELIVERED' }],
  ['coerced simulation', { ...markers, simulated: 'true' }],
  ['coerced delivery', { ...markers, deliveryVerified: 'false' }],
  ['null simulation', { ...markers, simulated: null }],
  ['null delivery', { ...markers, deliveryVerified: null }],
  ['null mode', { ...markers, evidenceMode: null }],
] as const;

it('preserves the complete queue triad, not a caller-selected mode or delivery assertion', () => {
  const source = queue(markers);
  const projected = parseCouponRedemptions(source, 'ACME').redemptions[0];
  expect(projected).toMatchObject(markers);
  Object.assign(source.redemptions[0]!, { evidenceMode: 'CHANGED' });
  expect(projected?.evidenceMode).toBe('LOCAL_SIMULATION');
});
it('keeps all-absent evidence ordinary even for LOCAL_SAMPLE or a SIM reference', () => {
  const source = queue({
    mode: 'LOCAL_SAMPLE',
    merchantReceiptReference: 'SIM:merchant@outlet',
  });
  const projected = parseCouponRedemptions(source, 'ACME').redemptions[0]!;
  for (const key of Object.keys(markers))
    expect(Object.hasOwn(projected, key)).toBe(false);
});
it.each(malformed)('rejects queue evidence with %s', (_name, flags) => {
  expect(() => parseCouponRedemptions(queue(flags), 'ACME')).toThrow(
    'Invalid coupon simulation evidence',
  );
});
it('requires actual absence rather than explicit undefined queue markers', () => {
  expect(() => parseCouponRedemptions(queue({ simulated: undefined }), 'ACME')).toThrow(
    'Invalid coupon simulation evidence',
  );
});

const invalidProperties = ['simulated', 'deliveryVerified', 'evidenceMode'].flatMap(
  (key) => ['inherited', 'hidden', 'accessor'].map((kind) => [key, kind] as const),
);
/** Decorates synthetic decoded evidence without JSON erasing its property descriptors. */
function invalidProperty(value: Record<string, unknown>, key: string, kind: string) {
  Object.assign(value, markers);
  const expected = value[key];
  const getter = vi.fn(() => expected);
  if (kind === 'inherited') {
    Reflect.deleteProperty(value, key);
    Object.setPrototypeOf(value, { [key]: expected });
  } else if (kind === 'hidden') {
    Object.defineProperty(value, key, { value: expected, enumerable: false });
  } else {
    Object.defineProperty(value, key, { get: getter, enumerable: true });
  }
  return getter;
}
it.each(invalidProperties)(
  'rejects queue marker %s when %s without invoking getters',
  (key, kind) => {
    const data = queue({});
    const getter = invalidProperty(data.redemptions[0]!, key, kind);
    expect(() => parseCouponRedemptions(data, 'ACME')).toThrow(
      'Invalid coupon simulation evidence',
    );
    expect(getter).not.toHaveBeenCalled();
  },
);
it('rejects all-inherited queue markers instead of treating them as absent', () => {
  const data = queue({});
  Object.setPrototypeOf(data.redemptions[0]!, markers);
  expect(() => parseCouponRedemptions(data, 'ACME')).toThrow(
    'Invalid coupon simulation evidence',
  );
});

it.each(invalidProperties)(
  'rejects receipt marker %s when %s without invoking getters or retry',
  async (key, kind) => {
    const data = {
      confirmation: { ...couponReview, state: 'CONSUMED', revision: 5 },
      receiptState: 'COMPLETED',
      receiptCode: 'RECEIPT_1',
    };
    const getter = invalidProperty(data, key, kind);
    const response = new Response('{}', { status: 200 });
    vi.spyOn(response, 'json').mockResolvedValue({ data });
    const fetcher = vi.fn().mockResolvedValue(response);
    await expect(
      createCopilotCouponClient(configuration, fetcher).inspect(couponReview),
    ).rejects.toThrow('Invalid coupon simulation evidence');
    expect(getter).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);
it('rejects all-inherited receipt markers instead of treating them as absent', async () => {
  const data = {
    confirmation: { ...couponReview, state: 'CONSUMED', revision: 5 },
    receiptState: 'COMPLETED',
    receiptCode: 'RECEIPT_1',
  };
  Object.setPrototypeOf(data, markers);
  const response = new Response('{}', { status: 200 });
  vi.spyOn(response, 'json').mockResolvedValue({ data });
  const fetcher = vi.fn().mockResolvedValue(response);
  await expect(
    createCopilotCouponClient(configuration, fetcher).inspect(couponReview),
  ).rejects.toThrow('Invalid coupon simulation evidence');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(['COMPLETED', 'UNCONFIRMED'] as const)(
  'preserves optional exact receipt markers for %s without changing request authority',
  async (state) => {
    for (const flags of [{}, markers]) {
      const fetcher = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              confirmation: {
                ...couponReview,
                state: state === 'COMPLETED' ? 'CONSUMED' : 'OUTCOME_UNKNOWN',
                revision: 5,
              },
              receiptState: state,
              ...(state === 'COMPLETED' ? { receiptCode: 'RECEIPT_1' } : {}),
              ...flags,
            },
          }),
          { status: 200 },
        ),
      );
      const projected = await createCopilotCouponClient(configuration, fetcher).inspect(
        couponReview,
      );
      if ('simulated' in flags) expect(projected).toMatchObject(markers);
      else
        for (const key of Object.keys(markers))
          expect(Object.hasOwn(projected, key)).toBe(false);
      expect(String(fetcher.mock.calls[0]![0])).toBe(
        `https://example.test/copilot/v0/confirmations/${couponReview.confirmationCode}/coupon-receipt`,
      );
      const options = fetcher.mock.calls[0]![1] as RequestInit;
      expect(options.method).toBe('POST');
      expect(options.cache).toBe('no-store');
      if (typeof options.body !== 'string') throw new Error('Expected JSON request');
      expect(JSON.parse(options.body)).toEqual({
        expectedRevision: couponReview.revision,
        argumentsDigest: couponReview.argumentsDigest,
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  },
);
it.each(malformed)(
  'rejects inspected receipt evidence with %s without retry',
  async (_name, flags) => {
    const fetcher = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              confirmation: { ...couponReview, state: 'CONSUMED', revision: 5 },
              receiptState: 'COMPLETED',
              receiptCode: 'RECEIPT_1',
              ...flags,
            },
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      createCopilotCouponClient(configuration, fetcher).inspect(couponReview),
    ).rejects.toThrow('Invalid coupon simulation evidence');
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);
it.each([
  [
    'foreign confirmation',
    {
      confirmation: {
        ...couponReview,
        confirmationCode: 'coupon-plan-foreign',
        state: 'CONSUMED',
      },
    },
  ],
  [
    'changed digest',
    {
      confirmation: {
        ...couponReview,
        argumentsDigest: 'b'.repeat(64),
        state: 'CONSUMED',
      },
    },
  ],
  ['missing receipt', { receiptCode: undefined }],
])('does not let valid simulation markers bypass %s checks', async (_name, fields) => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        data: {
          confirmation: { ...couponReview, state: 'CONSUMED', revision: 5 },
          receiptState: 'COMPLETED',
          receiptCode: 'RECEIPT_1',
          ...markers,
          ...fields,
        },
      }),
      { status: 200 },
    ),
  );
  await expect(
    createCopilotCouponClient(configuration, fetcher).inspect(couponReview),
  ).rejects.toThrow('Invalid coupon receipt');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
