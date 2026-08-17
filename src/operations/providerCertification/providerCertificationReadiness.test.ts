import { describe, expect, it } from 'vitest';

import { commerceProviderReadiness } from './providerCertificationReadiness';

describe('commerceProviderReadiness', () => {
  it('does not mark demo or partial provider declarations as live certified', () => {
    const readiness = commerceProviderReadiness([
      {
        domain: 'payment',
        providerCode: 'stripe-sandbox',
        state: 'OFFLINE_CONFORMANCE',
        webhookSecured: true,
        idempotencySupported: true,
        secretReference: 'vault://stripe/test',
      },
      {
        domain: 'carrier',
        providerCode: 'carrier-sandbox',
        state: 'SANDBOX_READY',
        webhookSecured: true,
        idempotencySupported: true,
        secretReference: 'vault://carrier/test',
      },
    ]);

    expect(readiness.find((item) => item.domain === 'payment')).toMatchObject({
      liveCertified: false,
      missing: [
        'liveEvidenceReference',
        'certifiedAt',
        'certifiedBy',
        'productionTrafficApproved',
      ],
    });
    expect(
      readiness.find((item) => item.domain === 'payment')?.cutoverChecklist,
    ).toContain('Webhook signature verified');
    expect(readiness.find((item) => item.domain === 'carrier')).toMatchObject({
      liveCertified: false,
      missing: [
        'liveEvidenceReference',
        'certifiedAt',
        'certifiedBy',
        'productionTrafficApproved',
      ],
    });
    expect(
      readiness.find((item) => item.domain === 'warehouse')?.cutoverChecklist,
    ).toContain('Receipt and inspection evidence mapped');
    expect(
      readiness.find((item) => item.domain === 'warehouse')?.operatorMessage,
    ).toContain('not live-certified');
    expect(readiness.find((item) => item.domain === 'pos')?.missing).toContain(
      'providerCode',
    );
  });

  it('requires live evidence, owner, timestamp and production approval before showing live certification', () => {
    const readiness = commerceProviderReadiness([
      {
        domain: 'payment',
        providerCode: 'stripe-live',
        state: 'LIVE_CERTIFIED',
        webhookSecured: true,
        idempotencySupported: true,
        secretReference: 'vault://stripe/live',
        liveEvidenceReference: 'CERT-PAY-001',
        certifiedAt: '2026-08-15T10:00:00.000Z',
        certifiedBy: 'payments-ops',
        productionTrafficApproved: true,
      },
    ]);

    expect(readiness.find((item) => item.domain === 'payment')).toMatchObject({
      liveCertified: true,
      missing: [],
      evidenceSummary:
        'Evidence CERT-PAY-001 by payments-ops on 2026-08-15T10:00:00.000Z.',
    });
  });
});
