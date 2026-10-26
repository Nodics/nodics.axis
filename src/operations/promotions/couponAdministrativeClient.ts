/** Native administrative review targets a business issuer, never a replacement authenticated identity. */
import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from '../shared/operationalOwnerClient';
import { couponContent, couponData, type CouponContent } from './couponOfferClient';

const labelKeys = [
  'administrativeReview',
  'issuerEnterpriseCode',
  'reviewOffer',
  'approve',
  'reasonCode',
  'confirmApproval',
] as const;
export type AdministrativeCapability = {
  labels: Record<(typeof labelKeys)[number], string>;
};
export type AdministrativeOffer = CouponContent & {
  code: string;
  issuerEnterpriseCode: string;
  status: string;
  versionId: number;
  revision: number;
  canApprove: boolean;
  approval: Partial<
    Record<
      | 'submittedBy'
      | 'submittedAt'
      | 'approvedBy'
      | 'approvedAt'
      | 'lastAction'
      | 'lastActionBy'
      | 'lastActionAt'
      | 'reasonCode',
      string
    >
  >;
  audit?: {
    actorCode: string;
    actorEnterpriseCode: string;
    issuerEnterpriseCode: string;
    tenant: string;
  };
};
const fail = (): never => {
  throw new Error('The administrative review response is invalid.');
};
const text = (value: unknown): string =>
  typeof value === 'string' && value.length > 0 ? value : fail();
const identifier = (value: string): string =>
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) ? value : fail();
const version = (value: unknown): number =>
  Number.isSafeInteger(value) &&
  Number(value) >= 0 &&
  Number(value) < Number.MAX_SAFE_INTEGER
    ? Number(value)
    : fail();

export async function administrativeCapabilities(
  c: OperationalOwnerConfiguration,
  signal?: AbortSignal,
): Promise<AdministrativeCapability> {
  const row = couponData(
    await invokeOperationalOwner(
      c,
      'promotion',
      '/promotions/administrative-review/capabilities',
      {},
      'POST',
      { signal },
    ),
  );
  const review = couponData(row.review),
    labels = couponData(row.labels);
  if (
    row.contractVersion !== 1 ||
    row.crossEnterpriseReview !== true ||
    review.method !== 'POST' ||
    review.route !== '/promotions/:promotionCode/administrative-review' ||
    review.targetField !== 'issuerEnterpriseCode'
  )
    fail();
  return {
    labels: Object.fromEntries(
      labelKeys.map((key) => [key, text(labels[key])]),
    ) as AdministrativeCapability['labels'],
  };
}

export function administrativeOffer(
  value: unknown,
  issuer: string,
  code: string,
  tenant: string,
): AdministrativeOffer {
  const row = couponData(value),
    revision = version(row.revision),
    versionId = version(row.versionId);
  if (
    row.code !== identifier(code) ||
    row.issuerEnterpriseCode !== identifier(issuer) ||
    !Array.isArray(row.lifecycleActions)
  )
    fail();
  if (
    row.issuerEnterpriseRef !== undefined &&
    couponData(row.issuerEnterpriseRef).code !== issuer
  )
    fail();
  const actions = row.lifecycleActions as unknown[];
  if (actions.length > 1) fail();
  for (const value of actions) {
    const action = couponData(value);
    if (
      action.actionCode !== 'APPROVE' ||
      action.labelKey !== 'approve' ||
      action.method !== 'POST' ||
      action.route !==
        `/promotions/${encodeURIComponent(code)}/administrative-approve` ||
      action.issuerEnterpriseCode !== issuer ||
      action.expectedVersionId !== versionId ||
      action.expectedRevision !== revision
    )
      fail();
  }
  const approval = couponData(row.approval),
    safe: Record<string, string> = {};
  for (const key of [
    'submittedBy',
    'submittedAt',
    'approvedBy',
    'approvedAt',
    'lastAction',
    'lastActionBy',
    'lastActionAt',
    'reasonCode',
  ])
    if (approval[key] !== undefined) safe[key] = text(approval[key]);
  let audit: AdministrativeOffer['audit'];
  if (approval.administrativeReview !== undefined) {
    const evidence = couponData(approval.administrativeReview);
    if (evidence.tenant !== tenant || evidence.issuerEnterpriseCode !== issuer) fail();
    audit = {
      actorCode: text(evidence.actorCode),
      actorEnterpriseCode: text(evidence.actorEnterpriseCode),
      issuerEnterpriseCode: issuer,
      tenant,
    };
  }
  return {
    ...couponContent(row),
    code,
    issuerEnterpriseCode: issuer,
    status: text(row.status),
    versionId,
    revision,
    canApprove: actions.length === 1,
    approval: safe,
    ...(audit ? { audit } : {}),
  };
}

export async function inspectAdministrativeOffer(
  c: OperationalOwnerConfiguration,
  issuer: string,
  code: string,
  signal?: AbortSignal,
) {
  const row = await invokeOperationalOwner(
    c,
    'promotion',
    `/promotions/${encodeURIComponent(identifier(code))}/administrative-review`,
    { issuerEnterpriseCode: identifier(issuer) },
    'POST',
    { signal },
  );
  return administrativeOffer(row, issuer, code, c.bootstrap.tenantCode);
}

export async function approveAdministrativeOffer(
  c: OperationalOwnerConfiguration,
  offer: AdministrativeOffer,
  reasonCode: string,
  signal?: AbortSignal,
) {
  if (
    !offer.canApprove ||
    !reasonCode.trim() ||
    reasonCode.length > 512 ||
    navigator.onLine === false
  )
    throw new Error('The approval cannot be submitted.');
  const result = couponData(
    await invokeOperationalOwner(
      c,
      'promotion',
      `/promotions/${encodeURIComponent(identifier(offer.code))}/administrative-approve`,
      {
        issuerEnterpriseCode: identifier(offer.issuerEnterpriseCode),
        expectedVersionId: offer.versionId,
        expectedRevision: offer.revision,
        reasonCode,
      },
      'POST',
      { signal },
    ),
  );
  const acknowledged = couponData(result.promotion);
  if (
    acknowledged.code !== offer.code ||
    version(acknowledged.versionId) <= offer.versionId ||
    version(acknowledged.revision) <= offer.revision
  )
    fail();
  const current = await inspectAdministrativeOffer(
    c,
    offer.issuerEnterpriseCode,
    offer.code,
    signal,
  );
  if (
    current.versionId < Number(acknowledged.versionId) ||
    current.revision < Number(acknowledged.revision) ||
    !current.audit
  )
    fail();
  return current;
}
