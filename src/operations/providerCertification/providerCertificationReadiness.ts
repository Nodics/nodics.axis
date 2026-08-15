export type CommerceProviderDomain = 'payment' | 'carrier' | 'warehouse' | 'pos';
export type CommerceProviderCertificationState =
  | 'NOT_DECLARED'
  | 'OFFLINE_CONFORMANCE'
  | 'SANDBOX_READY'
  | 'LIVE_CERTIFIED';

export interface CommerceProviderDeclaration {
  readonly domain: CommerceProviderDomain;
  readonly providerCode?: string | undefined;
  readonly state?: CommerceProviderCertificationState | undefined;
  readonly webhookSecured?: boolean | undefined;
  readonly idempotencySupported?: boolean | undefined;
  readonly secretReference?: string | undefined;
  readonly liveEvidenceReference?: string | undefined;
  readonly certifiedAt?: string | undefined;
  readonly certifiedBy?: string | undefined;
  readonly productionTrafficApproved?: boolean | undefined;
}

export interface CommerceProviderReadinessItem {
  readonly domain: CommerceProviderDomain;
  readonly label: string;
  readonly state: CommerceProviderCertificationState;
  readonly liveCertified: boolean;
  readonly missing: readonly string[];
  readonly evidenceSummary: string;
  readonly operatorMessage: string;
  readonly cutoverChecklist: readonly string[];
}

const labels: Readonly<Record<CommerceProviderDomain, string>> = Object.freeze({
  payment: 'Payment provider',
  carrier: 'Carrier provider',
  warehouse: 'Warehouse or inspection provider',
  pos: 'POS provider',
});

const requiredControls: Readonly<Record<CommerceProviderDomain, readonly string[]>> =
  Object.freeze({
    payment: [
      'providerCode',
      'webhookSecured',
      'idempotencySupported',
      'secretReference',
      'liveEvidenceReference',
      'certifiedAt',
      'certifiedBy',
      'productionTrafficApproved',
    ],
    carrier: [
      'providerCode',
      'webhookSecured',
      'idempotencySupported',
      'secretReference',
      'liveEvidenceReference',
      'certifiedAt',
      'certifiedBy',
      'productionTrafficApproved',
    ],
    warehouse: [
      'providerCode',
      'idempotencySupported',
      'secretReference',
      'liveEvidenceReference',
      'certifiedAt',
      'certifiedBy',
      'productionTrafficApproved',
    ],
    pos: [
      'providerCode',
      'idempotencySupported',
      'secretReference',
      'liveEvidenceReference',
      'certifiedAt',
      'certifiedBy',
      'productionTrafficApproved',
    ],
  });

const cutoverChecklists: Readonly<Record<CommerceProviderDomain, readonly string[]>> = Object.freeze({
  payment: ['Webhook signature verified', 'Idempotent authorization/capture/refund', 'Reconciliation runbook approved'],
  carrier: ['Rate and label sandbox certified', 'Tracking webhook verified', 'Return pickup/drop-off SLA approved'],
  warehouse: ['Reservation and release contract verified', 'Receipt and inspection evidence mapped', 'Disposition codes approved'],
  pos: ['Store inventory sync verified', 'In-store return/exchange identity proof checked', 'Till reconciliation runbook approved'],
});

function hasControl(declaration: CommerceProviderDeclaration | undefined, control: string): boolean {
  if (!declaration) return false;
  if (control === 'providerCode') return Boolean(declaration.providerCode);
  if (control === 'webhookSecured') return declaration.webhookSecured === true;
  if (control === 'idempotencySupported') return declaration.idempotencySupported === true;
  if (control === 'secretReference') return Boolean(declaration.secretReference);
  if (control === 'liveEvidenceReference') return Boolean(declaration.liveEvidenceReference);
  if (control === 'certifiedAt') return Boolean(declaration.certifiedAt);
  if (control === 'certifiedBy') return Boolean(declaration.certifiedBy);
  if (control === 'productionTrafficApproved') return declaration.productionTrafficApproved === true;
  return false;
}

/**
 * Converts backend/provider declarations into an operator-safe certification
 * summary. Axis may show readiness, but live certification requires explicit
 * backend evidence and must never be inferred from a demo adapter.
 */
export function commerceProviderReadiness(
  declarations: readonly CommerceProviderDeclaration[],
): readonly CommerceProviderReadinessItem[] {
  return (Object.keys(labels) as CommerceProviderDomain[]).map((domain) => {
    const declaration = declarations.find((item) => item.domain === domain);
    const missing = requiredControls[domain].filter((control) => !hasControl(declaration, control));
    const declaredState = declaration?.state ?? 'NOT_DECLARED';
    const liveCertified = declaredState === 'LIVE_CERTIFIED' && missing.length === 0;
    const state = liveCertified ? 'LIVE_CERTIFIED' : declaredState === 'NOT_DECLARED' ? 'NOT_DECLARED' : declaredState;
    return Object.freeze({
      domain,
      label: labels[domain],
      state,
      liveCertified,
      missing,
      evidenceSummary: declaration?.liveEvidenceReference
        ? `Evidence ${declaration.liveEvidenceReference}${declaration.certifiedBy ? ` by ${declaration.certifiedBy}` : ''}${declaration.certifiedAt ? ` on ${declaration.certifiedAt}` : ''}.`
        : 'No live certification evidence reference has been recorded.',
      operatorMessage: liveCertified
        ? `${labels[domain]} is live certified.`
        : `${labels[domain]} is not live-certified; missing ${missing.join(', ') || 'live certification approval'}.`,
      cutoverChecklist: cutoverChecklists[domain],
    });
  });
}
