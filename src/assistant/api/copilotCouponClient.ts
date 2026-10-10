/** @file Sensitive coupon transport; no model input, persisted browser draft, generic mutation or automatic command retry. */
import {
  assistantRecord,
  parseAssistantConfirmation,
} from './assistantContractParsers';
import type { AssistantConfirmation } from './assistantContracts';
import {
  assistantPathSegment,
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';

const copyKeys = [
  'redeemTab',
  'redemptionsTab',
  'refreshRedemptions',
  'emptyRedemptions',
  'recoveryRequired',
  'product',
  'status',
  'open',
  'title',
  'coupon',
  'receipt',
  'prepare',
  'close',
  'unavailable',
  'approve',
  'execute',
  'reject',
  'expired',
  'completed',
  'secureMessage',
  'inspect',
  'reload',
  'resume',
  'actionReference',
  'unconfirmed',
] as const;
/** Accepts inert owner labels only. */
export function parseCouponContract(value: unknown) {
  const root = assistantRecord(value, 'Coupon contract');
  const copy = assistantRecord(root.presentation, 'Coupon presentation');
  if (
    root.contractVersion !== 1 ||
    typeof root.redemptionsAvailable !== 'boolean' ||
    copyKeys.some(
      (key) =>
        typeof copy[key] !== 'string' || !copy[key].trim() || copy[key].length > 1000,
    )
  )
    throw new Error('Invalid coupon contract');
  return {
    redemptionsAvailable: root.redemptionsAvailable,
    presentation: Object.fromEntries(copyKeys.map((key) => [key, copy[key]])) as Record<
      (typeof copyKeys)[number],
      string
    >,
  };
}
export type CouponContract = ReturnType<typeof parseCouponContract>;
/** Requires the owned coupon operation before displaying an action or invoking its controls. */
export function couponConfirmation(value: unknown): AssistantConfirmation {
  const result = parseAssistantConfirmation(value);
  if (
    result.operationId !== 'commerce.coupon.redeem' ||
    !/^coupon-plan-[A-Za-z0-9-]{1,100}$/.test(result.confirmationCode) ||
    !/^[a-f0-9]{64}$/.test(result.argumentsDigest) ||
    result.revision < 1 ||
    !Number.isFinite(Date.parse(result.expiresAt)) ||
    ![
      'PENDING',
      'APPROVED',
      'EXECUTING',
      'OUTCOME_UNKNOWN',
      'CONSUMED',
      'REJECTED',
      'EXPIRED',
    ].includes(result.state)
  )
    throw new Error('Invalid coupon action');
  return result;
}
/** Projects exact enterprise metadata; outlet selection never grants domain permission. */
export function parseCouponWorkspace(value: unknown, enterpriseCode: string) {
  const root = assistantRecord(value, 'Coupon workspace');
  if (
    root.contractVersion !== 1 ||
    root.enterpriseCode !== enterpriseCode ||
    typeof root.storeRequired !== 'boolean' ||
    typeof root.pricedSourceRequired !== 'boolean' ||
    typeof root.storeLabel !== 'string' ||
    !root.storeLabel.trim() ||
    root.storeLabel.length > 192 ||
    (root.pricedSourceRequired &&
      (typeof root.pricedSourceLabel !== 'string' ||
        !root.pricedSourceLabel.trim() ||
        root.pricedSourceLabel.length > 192)) ||
    !Array.isArray(root.stores) ||
    root.stores.length > 100
  )
    throw new Error('Invalid coupon workspace');
  const stores = root.stores.map((value) => {
    const row = assistantRecord(value, 'Coupon outlet');
    if (
      typeof row.code !== 'string' ||
      !/^[A-Za-z0-9_.:-]{1,128}$/.test(row.code) ||
      typeof row.name !== 'string' ||
      !row.name.trim() ||
      row.name.length > 256 ||
      !Number.isSafeInteger(row.revision) ||
      Number(row.revision) < 1
    )
      throw new Error('Invalid coupon outlet');
    return { code: row.code, name: row.name, revision: Number(row.revision) };
  });
  if (new Set(stores.map((row) => row.code)).size !== stores.length)
    throw new Error('Duplicate coupon outlet');
  return {
    storeRequired: root.storeRequired,
    storeLabel: root.storeLabel,
    stores,
    receiptLabel: root.pricedSourceRequired
      ? (root.pricedSourceLabel as string)
      : undefined,
  };
}
export type CouponWorkspace = ReturnType<typeof parseCouponWorkspace>;
type CouponEvidence =
  | {
      simulated: true;
      deliveryVerified: false;
      evidenceMode: 'LOCAL_SIMULATION';
    }
  | { simulated?: never; deliveryVerified?: never; evidenceMode?: never };
/** Preserves only the owner's complete simulation marker; absence never asserts verified goods. */
function couponEvidence(value: Record<string, unknown>): CouponEvidence {
  const keys = ['simulated', 'deliveryVerified', 'evidenceMode'] as const;
  if (!keys.some((key) => key in value)) return {};
  const descriptors = keys.map((key) => Object.getOwnPropertyDescriptor(value, key));
  if (
    descriptors.some(
      (descriptor) =>
        !descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'),
    ) ||
    descriptors[0]?.value !== true ||
    descriptors[1]?.value !== false ||
    descriptors[2]?.value !== 'LOCAL_SIMULATION'
  )
    throw new Error('Invalid coupon simulation evidence');
  return {
    simulated: true,
    deliveryVerified: false,
    evidenceMode: 'LOCAL_SIMULATION',
  };
}
/** Accepts only bounded, minimized Digital Core queue evidence for the current enterprise. */
export function parseCouponRedemptions(value: unknown, enterpriseCode: string) {
  const root = assistantRecord(value, 'Coupon redemptions');
  if (
    root.contractVersion !== 1 ||
    root.enterpriseCode !== enterpriseCode ||
    typeof root.observedAt !== 'string' ||
    !Number.isFinite(Date.parse(root.observedAt)) ||
    typeof root.limitation !== 'string' ||
    !root.limitation.trim() ||
    root.limitation.length > 1000 ||
    !Array.isArray(root.redemptions) ||
    root.redemptions.length > 100
  )
    throw new Error('Invalid coupon redemptions');
  const optionalText = (value: unknown, maximum = 256) =>
    value === undefined ||
    (typeof value === 'string' &&
      value.length > 0 &&
      value.length <= maximum &&
      Array.from(value).every((character) => character.charCodeAt(0) >= 32));
  const rows = root.redemptions.map((value) => {
    const row = assistantRecord(value, 'Coupon redemption');
    const allowed = [
      'entitlementCode',
      'productCode',
      'claimStatus',
      'status',
      'revision',
      'merchantCode',
      'merchantLabel',
      'mode',
      'redemptionCode',
      'requestedAt',
      'receiptCode',
      'merchantReceiptReference',
      'confirmedAt',
      'recoveryRequired',
      'storeCode',
      'storeRevision',
      'simulated',
      'deliveryVerified',
      'evidenceMode',
    ];
    if (
      Object.keys(row).some((key) => !allowed.includes(key)) ||
      ![
        'entitlementCode',
        'productCode',
        'claimStatus',
        'status',
        'merchantCode',
        'merchantLabel',
        'mode',
      ].every((key) => optionalText(row[key]) && row[key] !== undefined) ||
      !Number.isSafeInteger(row.revision) ||
      Number(row.revision) < 0 ||
      ![
        'redemptionCode',
        'requestedAt',
        'receiptCode',
        'merchantReceiptReference',
        'confirmedAt',
        'storeCode',
      ].every((key) => optionalText(row[key])) ||
      (row.storeRevision !== undefined &&
        (!Number.isSafeInteger(row.storeRevision) || Number(row.storeRevision) < 0)) ||
      typeof row.recoveryRequired !== 'boolean'
    )
      throw new Error('Invalid coupon redemption');
    return {
      ...couponEvidence(row),
      entitlementCode: row.entitlementCode as string,
      productCode: row.productCode as string,
      claimStatus: row.claimStatus as string,
      status: row.status as string,
      revision: Number(row.revision),
      merchantCode: row.merchantCode as string,
      merchantLabel: row.merchantLabel as string,
      mode: row.mode as string,
      redemptionCode: row.redemptionCode as string | undefined,
      requestedAt: row.requestedAt as string | undefined,
      receiptCode: row.receiptCode as string | undefined,
      merchantReceiptReference: row.merchantReceiptReference as string | undefined,
      confirmedAt: row.confirmedAt as string | undefined,
      recoveryRequired: row.recoveryRequired,
      storeCode: row.storeCode as string | undefined,
      storeRevision:
        row.storeRevision === undefined ? undefined : Number(row.storeRevision),
    };
  });
  return {
    observedAt: root.observedAt,
    limitation: root.limitation,
    redemptions: rows,
  };
}
export type CouponRedemptions = ReturnType<typeof parseCouponRedemptions>;
/** Uses fixed Copilot routes and the original employee-scoped transport. */
export function createCopilotCouponClient(
  configuration: AssistantTransportConfiguration,
  implementation: typeof fetch = fetch,
) {
  const transport = createAssistantTransport(configuration, implementation);
  return {
    workspace: async (signal?: AbortSignal) =>
      parseCouponWorkspace(
        await transport.request('/coupons/workspace', { signal }),
        configuration.enterpriseCode,
      ),
    redemptions: async (signal?: AbortSignal) =>
      parseCouponRedemptions(
        await transport.request('/coupons/redemptions', { signal }),
        configuration.enterpriseCode,
      ),
    prepare: async (
      input: {
        couponToken: string;
        merchantReceiptReference: string;
        storeCode?: string;
      },
      signal?: AbortSignal,
    ) => {
      const data = assistantRecord(
        await transport.request('/coupons/prepare', {
          method: 'POST',
          body: input,
          signal,
        }),
        'Prepared coupon',
      );
      return couponConfirmation(data.confirmation);
    },
    inspect: async (confirmation: AssistantConfirmation, signal?: AbortSignal) => {
      const data = assistantRecord(
        await transport.request(
          `/confirmations/${assistantPathSegment(confirmation.confirmationCode, 'confirmation')}/coupon-receipt`,
          {
            method: 'POST',
            body: {
              expectedRevision: confirmation.revision,
              argumentsDigest: confirmation.argumentsDigest,
            },
            signal,
          },
        ),
        'Coupon receipt',
      );
      const next = couponConfirmation(data.confirmation);
      if (
        next.confirmationCode !== confirmation.confirmationCode ||
        next.argumentsDigest !== confirmation.argumentsDigest ||
        !['UNCONFIRMED', 'COMPLETED'].includes(String(data.receiptState)) ||
        (data.receiptState === 'COMPLETED' &&
          (next.state !== 'CONSUMED' ||
            typeof data.receiptCode !== 'string' ||
            !/^[A-Za-z0-9_.:-]{1,192}$/.test(data.receiptCode))) ||
        (data.receiptState === 'UNCONFIRMED' &&
          !['EXECUTING', 'OUTCOME_UNKNOWN'].includes(next.state))
      )
        throw new Error('Invalid coupon receipt');
      return {
        ...couponEvidence(data),
        confirmation: next,
        receiptState: data.receiptState as 'UNCONFIRMED' | 'COMPLETED',
        receiptCode:
          data.receiptState === 'COMPLETED' ? (data.receiptCode as string) : undefined,
      };
    },
  };
}
export type CopilotCouponClient = ReturnType<typeof createCopilotCouponClient>;
