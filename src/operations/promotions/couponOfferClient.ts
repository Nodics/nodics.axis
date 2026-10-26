/** Typed Promotion commands. Axis owns presentation; persisted rules and authority stay with Promotion. */
import { selectModuleConnection } from '../../bootstrap/publicBootstrap';
import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from '../shared/operationalOwnerClient';

export const couponLabels = [
  'submittedBy',
  'submittedAt',
  'approvedBy',
  'approvedAt',
  'lastAction',
  'lastActionBy',
  'lastActionAt',
  'budgetLimit',
  'submit',
  'approve',
  'schedule',
  'suspend',
  'archive',
  'reasonCode',
  'title',
  'code',
  'name',
  'product',
  'inspect',
  'prefill',
  'create',
  'saveName',
  'benefit',
  'value',
  'item',
  'itemQuantity',
  'unlimited',
  'supply',
  'capped',
  'ownerLimit',
  'noExpiry',
  'expiry',
  'requirements',
  'price',
  'certificates',
  'category',
  'milestone',
  'brands',
  'models',
  'stores',
  'allStores',
  'terms',
  'review',
  'confirm',
  'cancel',
  'created',
  'immutable',
  'uncertain',
  'reportTitle',
  'reportOffer',
  'reportOffersUnavailable',
  'reportNoOffers',
  'reportOffersLoading',
  'channel',
  'issuer',
  'redeemer',
  'loadReport',
  'exportReport',
  'protected',
  'unknown',
  'purchases',
  'redemptions',
  'newThroughChannel',
  'returningThroughChannel',
  'dataUpdatedThrough',
  'fromDate',
  'toDate',
  'scopeType',
  'scopeCode',
  'enterpriseScope',
  'outletScope',
  'groupScope',
  'breakdown',
  'noBreakdown',
  'dayBreakdown',
  'issuances',
  'distinctOwners',
  'redemptionRate',
  'newThroughChannelRate',
  'returningThroughChannelRate',
  'unknownRate',
  'numerator',
  'denominator',
  'percent',
  'reportDimension',
] as const;
export type CouponWorkspace = {
  contractVersion: 1;
  canCreate: boolean;
  reportChannels: { code: string; name: string }[];
  labels: Record<(typeof couponLabels)[number], string>;
  benefitOptions: { value: 'PERCENT' | 'FIXED' | 'ITEM'; label: string }[];
  requirementOptions: { value: 'REWARDS' | 'CERTIFICATES' | 'BOTH'; label: string }[];
  limits: Record<
    | 'maximumCertificates'
    | 'maximumTerms'
    | 'maximumTermLength'
    | 'maximumPolicyBytes'
    | 'maximumParticipants'
    | 'maximumStores'
    | 'reservationSeconds'
    | 'maximumReservationSeconds',
    number
  >;
};
export type CouponOffer = {
  version: 1;
  supply: { mode: 'LIMITED'; quantity: number } | { mode: 'UNLIMITED' };
  ownerLimit?: number;
  expiry: { mode: 'FIXED'; at: string } | { mode: 'NONE' };
  requirements: {
    type: 'REWARDS' | 'CERTIFICATES' | 'BOTH';
    priceRef?: string;
    certificates?: {
      quantity: number;
      categoryCode: string;
      milestoneCode: string;
      brandCodes?: string[];
      modelCodes?: string[];
    };
  };
  terms: string[];
};
export type CouponContent = {
  budget?: { limit: string };
  vendorEnterpriseRef?: {
    moduleName: 'profile';
    schemaName: 'enterprise';
    code: string;
  };
  name: string;
  actions: Record<string, unknown>;
  conditions: Record<string, unknown>;
  couponOffer: CouponOffer;
};
export type CouponRecord = CouponContent & {
  lifecycleActions: CouponLifecycleAction[];
  code: string;
  status: string;
  revision: number;
  versionId: number;
};
export type CouponLifecycleAction = {
  actionCode: string;
  labelKey: 'submit' | 'approve' | 'schedule' | 'suspend' | 'archive';
  method: 'POST';
  route: string;
  expectedVersionId: number;
  expectedRevision: number;
};
export type CouponCreation = CouponContent & {
  code: string;
  vendorEnterpriseRef?: {
    moduleName: 'profile';
    schemaName: 'enterprise';
    code: string;
  };
};
export type AcquisitionReportSelection = {
  promotionCode: string;
  channelCode: string;
  view: 'ISSUER' | 'REDEEMER';
  scope: { type: 'ENTERPRISE' | 'OUTLET' | 'GROUP'; code: string };
  period: { fromDate: string | null; toDate: string | null };
  breakdown: 'NONE' | 'DAY' | 'OUTLET' | 'ENTERPRISE';
};
export type AcquisitionRate = {
  numerator: number | null;
  denominator: number | null;
  percent: string | null;
};
export type AcquisitionAggregate = {
  protected: boolean;
  counts: Record<string, number | null>;
  rates: Record<string, AcquisitionRate>;
};
export type AcquisitionReport = AcquisitionReportSelection & {
  contractVersion: 2;
  scope: AcquisitionReportSelection['scope'] & { basis: string };
  meaning: 'NEW_OR_RETURNING_THROUGH_CHANNEL';
  status: 'AVAILABLE' | 'UNKNOWN';
  dataUpdatedThrough: string | null;
  timezone: 'UTC';
  protected: boolean;
  counts: Record<string, number | null> | null;
  rates: Record<string, AcquisitionRate> | null;
  rows: (AcquisitionAggregate & { key: string })[];
};

/** Rejects failed/malformed owner envelopes before exposing a record or presentation contract. */
export function couponData(value: unknown): Record<string, unknown> {
  for (let i = 0; i < 7; i++) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('The owner response is invalid.');
    const row = value as Record<string, unknown>;
    if (
      row.error ||
      row.success === false ||
      row.acknowledged === false ||
      (typeof row.code === 'string' && row.code.startsWith('ERR_'))
    )
      throw new Error('The owner request could not be confirmed.');
    if (row.data !== undefined) value = row.data;
    else if (row.result !== undefined) value = row.result;
    else return row;
  }
  throw new Error('The owner response is invalid.');
}

/** Applies shape validation only; limits and choices come from the effective backend owner. */
export function couponWorkspace(value: unknown): CouponWorkspace {
  const row = couponData(value),
    labels = couponData(row.labels),
    limits = couponData(row.limits);
  if (
    row.contractVersion !== 1 ||
    typeof row.canCreate !== 'boolean' ||
    !Array.isArray(row.reportChannels) ||
    row.reportChannels.length > Number(limits.maximumStores) ||
    row.reportChannels.some((option: unknown) => {
      const choice = couponData(option);
      return (
        typeof choice.code !== 'string' ||
        !/^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/.test(choice.code) ||
        typeof choice.name !== 'string' ||
        !choice.name.trim() ||
        choice.name.length > Number(limits.maximumTermLength)
      );
    }) ||
    new Set(row.reportChannels.map((option: { code: string }) => option.code)).size !==
      row.reportChannels.length ||
    couponLabels.some(
      (key) =>
        typeof labels[key] !== 'string' ||
        !labels[key].trim() ||
        labels[key].length > 512,
    ) ||
    [
      'maximumCertificates',
      'maximumTerms',
      'maximumTermLength',
      'maximumPolicyBytes',
      'maximumParticipants',
      'maximumStores',
      'reservationSeconds',
      'maximumReservationSeconds',
    ].some((key) => !Number.isSafeInteger(limits[key]) || Number(limits[key]) < 1)
  )
    throw new Error('The owner presentation is unavailable.');
  for (const [field, allowed] of [
    ['benefitOptions', ['PERCENT', 'FIXED', 'ITEM']],
    ['requirementOptions', ['REWARDS', 'CERTIFICATES', 'BOTH']],
  ] as const) {
    const options = row[field];
    if (!Array.isArray(options) || options.length !== allowed.length)
      throw new Error('The owner presentation is unavailable.');
    const checked = (options as unknown[]).map(couponData);
    if (
      new Set(checked.map((option) => option.value)).size !== allowed.length ||
      checked.some(
        (option) =>
          !allowed.some((value) => value === option.value) ||
          typeof option.label !== 'string' ||
          !option.label ||
          option.label.length > 256,
      )
    )
      throw new Error('The owner presentation is unavailable.');
  }
  return {
    contractVersion: 1,
    canCreate: row.canCreate,
    reportChannels: row.reportChannels.map(
      (option: { code: string; name: string }) => ({
        code: option.code,
        name: option.name,
      }),
    ),
    labels: Object.fromEntries(couponLabels.map((key) => [key, labels[key]])),
    limits,
    benefitOptions: row.benefitOptions,
    requirementOptions: row.requirementOptions,
  } as CouponWorkspace;
}

/** Validates reusable content, never accepting a returned command, actor, counter or history. */
export function couponContent(value: unknown): CouponContent {
  const row = couponData(value),
    offer = couponData(row.couponOffer),
    supply = couponData(offer.supply),
    expiry = couponData(offer.expiry),
    requirements = couponData(offer.requirements);
  if (
    typeof row.name !== 'string' ||
    !row.name ||
    row.name.length > 256 ||
    offer.version !== 1 ||
    !['LIMITED', 'UNLIMITED'].includes(String(supply.mode)) ||
    (supply.mode === 'LIMITED' &&
      (!Number.isSafeInteger(supply.quantity) || Number(supply.quantity) < 1)) ||
    !['NONE', 'FIXED'].includes(String(expiry.mode)) ||
    (expiry.mode === 'FIXED' &&
      (typeof expiry.at !== 'string' || !Number.isFinite(Date.parse(expiry.at)))) ||
    !['REWARDS', 'CERTIFICATES', 'BOTH'].includes(String(requirements.type)) ||
    !Array.isArray(offer.terms) ||
    offer.terms.some((term) => typeof term !== 'string')
  )
    throw new Error('The offer response is invalid.');
  if (requirements.type !== 'CERTIFICATES' && typeof requirements.priceRef !== 'string')
    throw new Error('The offer response is invalid.');
  if (requirements.type !== 'REWARDS') {
    const certificates = couponData(requirements.certificates);
    if (
      !Number.isSafeInteger(certificates.quantity) ||
      Number(certificates.quantity) < 1 ||
      typeof certificates.categoryCode !== 'string' ||
      typeof certificates.milestoneCode !== 'string' ||
      ['brandCodes', 'modelCodes'].some(
        (key) =>
          certificates[key] !== undefined &&
          (!Array.isArray(certificates[key]) ||
            (certificates[key] as unknown[]).some((code) => typeof code !== 'string')),
      )
    )
      throw new Error('The offer response is invalid.');
  }
  return {
    ...couponReferences(row),
    name: row.name,
    actions: couponData(row.actions),
    conditions: couponData(row.conditions),
    couponOffer: offer as CouponOffer,
  };
}

function couponReferences(
  row: Record<string, unknown>,
): Pick<CouponContent, 'budget' | 'vendorEnterpriseRef'> {
  const result: Pick<CouponContent, 'budget' | 'vendorEnterpriseRef'> = {};
  if (row.budget !== undefined) {
    const budget = couponData(row.budget);
    if (typeof budget.limit !== 'string' || !/^\d+(?:\.\d+)?$/.test(budget.limit))
      throw new Error('The offer budget is invalid.');
    result.budget = { limit: budget.limit };
  }
  if (row.vendorEnterpriseRef !== undefined) {
    const ref = couponData(row.vendorEnterpriseRef);
    if (
      ref.moduleName !== 'profile' ||
      ref.schemaName !== 'enterprise' ||
      typeof ref.code !== 'string' ||
      !/^[A-Za-z0-9_.:-]{1,128}$/.test(ref.code)
    )
      throw new Error('The offer vendor is invalid.');
    result.vendorEnterpriseRef = {
      moduleName: 'profile',
      schemaName: 'enterprise',
      code: ref.code,
    };
  }
  return result;
}

/** Requires exact persisted identity and usable version/revision; an acknowledgement is never a saved record. */
export function couponRecord(value: unknown, code: string): CouponRecord {
  const row = couponData(value);
  if (
    row.code !== code ||
    typeof row.status !== 'string' ||
    !Number.isSafeInteger(row.versionId) ||
    Number(row.versionId) < 0 ||
    !Number.isSafeInteger(row.revision) ||
    Number(row.revision) < 0
  )
    throw new Error('The saved offer could not be confirmed.');
  const lifecycleActions = parseCouponLifecycleActions(
    row.lifecycleActions,
    code,
    Number(row.versionId),
    Number(row.revision),
  );
  return {
    ...couponContent(row),
    code,
    status: row.status,
    revision: Number(row.revision),
    versionId: Number(row.versionId),
    lifecycleActions,
  };
}

function parseCouponLifecycleActions(
  value: unknown,
  code: string,
  version: number,
  revision: number,
): CouponLifecycleAction[] {
  if (!Array.isArray(value)) throw new Error('The offer actions are invalid.');
  const seen = new Set<string>();
  return value.map((entry: unknown) => {
    const action = couponData(entry);
    const key =
      typeof action.actionCode === 'string' ? action.actionCode.toLowerCase() : '';
    if (
      !['submit', 'approve', 'schedule', 'suspend', 'archive'].includes(key) ||
      action.actionCode !== key.toUpperCase() ||
      action.labelKey !== key ||
      action.method !== 'POST' ||
      action.route !== `/promotions/${encodeURIComponent(code)}/${key}` ||
      action.expectedVersionId !== version ||
      action.expectedRevision !== revision ||
      seen.has(key)
    )
      throw new Error('The offer actions are invalid.');
    seen.add(key);
    return action as CouponLifecycleAction;
  });
}

/** Only exact inspected actions may execute; command acknowledgement is followed by owner readback. */
export async function transitionCoupon(
  configuration: OperationalOwnerConfiguration,
  record: CouponRecord,
  action: CouponLifecycleAction,
  reasonCode: string,
) {
  if (
    !reasonCode.trim() ||
    reasonCode.length > 512 ||
    !record.lifecycleActions.includes(action)
  )
    throw new Error('The offer action is invalid.');
  parseCouponLifecycleActions([action], record.code, record.versionId, record.revision);
  if (navigator.onLine === false) throw new Error('The browser is offline.');
  await invokeOperationalOwner(
    configuration,
    'promotion',
    action.route,
    {
      expectedVersionId: action.expectedVersionId,
      expectedRevision: action.expectedRevision,
      reasonCode,
    },
    'POST',
  );
  const current = await inspectCoupon(configuration, record.code);
  if (current.versionId <= record.versionId || current.revision <= record.revision)
    throw new Error('The offer action could not be confirmed.');
  return current;
}

/** Reads one exact offer through the authorized owner's fixed endpoint. */
export async function inspectCoupon(
  configuration: OperationalOwnerConfiguration,
  code: string,
) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(code))
    throw new Error('The offer reference is invalid.');
  return couponRecord(
    await invokeOperationalOwner(
      configuration,
      'promotion',
      `/promotions/${encodeURIComponent(code)}/coupon-offer`,
    ),
    code,
  );
}

/** Runs the existing PUT draft command once; uncertain acknowledgement must be inspected, never retried. */
export async function createCoupon(
  configuration: OperationalOwnerConfiguration,
  input: CouponCreation,
) {
  if (navigator.onLine === false) throw new Error('The browser is offline.');
  const connection = selectModuleConnection(
    configuration.bootstrap,
    'promotion',
    configuration.ownerSelector,
  );
  if (!connection?.endpoint) throw new Error('The owning service is unavailable.');
  const url = new URL(connection.endpoint.replace(/\/$/, '') + '/v0/promotions/drafts');
  if (!['https:', 'http:'].includes(url.protocol))
    throw new Error('The owner endpoint is invalid.');
  const controller = new AbortController(),
    timeout = globalThis.setTimeout(() => controller.abort(), configuration.timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${configuration.accessToken}`,
        'Content-Type': 'application/json',
        'x-enterprise-code': configuration.enterpriseCode,
      },
      body: JSON.stringify({
        code: input.code,
        name: input.name,
        actions: input.actions,
        conditions: input.conditions,
        couponOffer: input.couponOffer,
        ...(input.budget ? { budget: { limit: input.budget.limit } } : {}),
        ...(input.vendorEnterpriseRef
          ? {
              vendorEnterpriseRef: {
                moduleName: 'profile',
                schemaName: 'enterprise',
                code: input.vendorEnterpriseRef.code,
              },
            }
          : {}),
      }),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    });
    const row = couponData(await response.json());
    if (
      !response.ok ||
      row.code !== input.code ||
      row.status !== 'DRAFT' ||
      !Number.isSafeInteger(row.versionId) ||
      !Number.isSafeInteger(row.revision)
    )
      throw new Error('The saved offer could not be confirmed.');
    return inspectCoupon(configuration, input.code);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

/** Preserves protected nulls and an authoritative UTC watermark, rejecting row-level or malformed data. */
export function acquisitionReport(
  value: unknown,
  selection: AcquisitionReportSelection,
): AcquisitionReport {
  const row = couponData(value);
  const fail = (): never => {
    throw new Error('The aggregate response is invalid.');
  };
  const scope = couponData(row.scope),
    period = couponData(row.period);
  const reportedRows = Array.isArray(row.rows) ? row.rows : fail();
  if (
    row.contractVersion !== 2 ||
    row.timezone !== 'UTC' ||
    row.meaning !== 'NEW_OR_RETURNING_THROUGH_CHANNEL' ||
    row.promotionCode !== selection.promotionCode ||
    row.view !== selection.view ||
    row.channelCode !== selection.channelCode ||
    scope.type !== selection.scope.type ||
    scope.code !== selection.scope.code ||
    !['SIGNED_ENTERPRISE', 'CURRENT_AUTHORIZED_HIERARCHY', 'CANONICAL_OUTLET'].includes(
      String(scope.basis),
    ) ||
    period.fromDate !== selection.period.fromDate ||
    period.toDate !== selection.period.toDate ||
    row.breakdown !== selection.breakdown
  )
    fail();
  const base = {
    ...selection,
    contractVersion: 2 as const,
    timezone: 'UTC' as const,
    meaning: 'NEW_OR_RETURNING_THROUGH_CHANNEL' as const,
    scope: { ...selection.scope, basis: String(scope.basis) },
  };
  if (row.status === 'UNKNOWN') {
    if (
      row.counts !== null ||
      row.rates !== null ||
      row.dataUpdatedThrough !== null ||
      row.protected !== true ||
      reportedRows.length
    )
      fail();
    return {
      ...base,
      status: 'UNKNOWN',
      protected: true,
      counts: null,
      rates: null,
      rows: [],
      dataUpdatedThrough: null,
    };
  }
  const aggregate = (value: unknown): AcquisitionAggregate => {
    const r = couponData(value),
      counts = couponData(r.counts),
      rates = couponData(r.rates);
    const fields = [
      'issuances',
      'purchases',
      'redemptions',
      'distinctOwners',
      'newThroughChannel',
      'returningThroughChannel',
      'unknown',
    ];
    const rateFields = [
      'redemptionRate',
      'newThroughChannelRate',
      'returningThroughChannelRate',
      'unknownRate',
    ];
    if (
      typeof r.protected !== 'boolean' ||
      Object.keys(counts).sort().join() !== fields.sort().join() ||
      Object.keys(rates).sort().join() !== rateFields.sort().join() ||
      Object.values(counts).some((n) =>
        r.protected
          ? n !== null
          : n !== null && (!Number.isSafeInteger(n) || Number(n) < 0),
      )
    )
      fail();
    const projectedRates: Record<string, AcquisitionRate> = {};
    for (const key of rateFields) {
      const rate = couponData(rates[key]),
        n = rate.numerator,
        d = rate.denominator,
        percent = rate.percent;
      if (n === null && d === null && percent === null) {
        projectedRates[key] = { numerator: null, denominator: null, percent: null };
        continue;
      }
      if (
        r.protected ||
        !Number.isSafeInteger(n) ||
        !Number.isSafeInteger(d) ||
        Number(n) < 0 ||
        Number(d) < Number(n) ||
        (d === 0
          ? percent !== null
          : typeof percent !== 'string' || !/^(0|[1-9]\d*)(\.\d{1,12})?$/.test(percent))
      )
        fail();
      if (d !== 0) {
        const decimal = String(percent),
          digits = decimal.split('.')[1]?.length || 0;
        if (
          BigInt(decimal.replace('.', '')) !==
          (BigInt(Number(n)) * 100n * 10n ** BigInt(digits)) / BigInt(Number(d))
        )
          fail();
      }
      projectedRates[key] = {
        numerator: Number(n),
        denominator: Number(d),
        percent: percent as string | null,
      };
    }
    if (
      !r.protected &&
      [
        'distinctOwners',
        'newThroughChannel',
        'returningThroughChannel',
        'unknown',
      ].some((k) => counts[k] === null)
    )
      fail();
    if (
      !r.protected &&
      Number(counts.newThroughChannel) +
        Number(counts.returningThroughChannel) +
        Number(counts.unknown) !==
        counts.distinctOwners
    )
      fail();
    const cohortRatePairs: ReadonlyArray<
      readonly [keyof AcquisitionAggregate['rates'], string]
    > = [
      ['newThroughChannelRate', 'newThroughChannel'],
      ['returningThroughChannelRate', 'returningThroughChannel'],
      ['unknownRate', 'unknown'],
    ];
    for (const [rateKey, countKey] of cohortRatePairs) {
      const rate = projectedRates[rateKey];
      if (
        !rate ||
        rate.numerator !== counts[countKey] ||
        rate.denominator !== counts.distinctOwners
      )
        fail();
    }
    return {
      protected: r.protected as boolean,
      counts: counts as Record<string, number | null>,
      rates: projectedRates,
    };
  };
  if (
    row.status !== 'AVAILABLE' ||
    typeof row.dataUpdatedThrough !== 'string' ||
    !Number.isFinite(Date.parse(row.dataUpdatedThrough)) ||
    new Date(row.dataUpdatedThrough).toISOString() !== row.dataUpdatedThrough
  )
    fail();
  if (!Array.isArray(row.rows)) fail();
  const sourceRows = row.rows as unknown[];
  const total = aggregate(row),
    seen = new Set<string>();
  const detailRows = sourceRows.map((value) => {
    const r = couponData(value);
    if (
      typeof r.key !== 'string' ||
      !/^[A-Za-z0-9_.:@-]{1,128}$/.test(r.key) ||
      seen.has(r.key)
    )
      fail();
    seen.add(String(r.key));
    const result = aggregate(r);
    if (result.protected) fail();
    return { key: String(r.key), ...result };
  });
  if ((total.protected || selection.breakdown === 'NONE') && detailRows.length) fail();
  return {
    ...base,
    status: 'AVAILABLE',
    ...total,
    rows: detailRows,
    dataUpdatedThrough: row.dataUpdatedThrough as string,
  };
}
