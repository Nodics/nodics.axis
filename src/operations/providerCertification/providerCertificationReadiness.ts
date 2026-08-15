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
}

export interface CommerceProviderReadinessItem {
  readonly domain: CommerceProviderDomain;
  readonly label: string;
  readonly state: CommerceProviderCertificationState;
  readonly liveCertified: boolean;
  readonly missing: readonly string[];
  readonly operatorMessage: string;
}

const labels: Readonly<Record<CommerceProviderDomain, string>> = Object.freeze({
  payment: 'Payment provider',
  carrier: 'Carrier provider',
  warehouse: 'Warehouse or inspection provider',
  pos: 'POS provider',
});

const requiredControls: Readonly<Record<CommerceProviderDomain, readonly string[]>> =
  Object.freeze({
    payment: ['providerCode', 'webhookSecured', 'idempotencySupported', 'secretReference', 'liveEvidenceReference'],
    carrier: ['providerCode', 'webhookSecured', 'idempotencySupported', 'secretReference', 'liveEvidenceReference'],
    warehouse: ['providerCode', 'idempotencySupported', 'secretReference', 'liveEvidenceReference'],
    pos: ['providerCode', 'idempotencySupported', 'secretReference', 'liveEvidenceReference'],
  });

function hasControl(declaration: CommerceProviderDeclaration | undefined, control: string): boolean {
  if (!declaration) return false;
  if (control === 'providerCode') return Boolean(declaration.providerCode);
  if (control === 'webhookSecured') return declaration.webhookSecured === true;
  if (control === 'idempotencySupported') return declaration.idempotencySupported === true;
  if (control === 'secretReference') return Boolean(declaration.secretReference);
  if (control === 'liveEvidenceReference') return Boolean(declaration.liveEvidenceReference);
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
      operatorMessage: liveCertified
        ? `${labels[domain]} is live certified.`
        : `${labels[domain]} is not live-certified; missing ${missing.join(', ') || 'live certification approval'}.`,
    });
  });
}
