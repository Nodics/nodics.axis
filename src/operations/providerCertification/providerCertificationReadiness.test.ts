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
      missing: ['liveEvidenceReference'],
    });
    expect(readiness.find((item) => item.domain === 'carrier')).toMatchObject({
      liveCertified: false,
      missing: ['liveEvidenceReference'],
    });
    expect(readiness.find((item) => item.domain === 'warehouse')?.operatorMessage).toContain('not live-certified');
    expect(readiness.find((item) => item.domain === 'pos')?.missing).toContain('providerCode');
  });

  it('requires live evidence before showing live certification', () => {
    const readiness = commerceProviderReadiness([
      {
        domain: 'payment',
        providerCode: 'stripe-live',
        state: 'LIVE_CERTIFIED',
        webhookSecured: true,
        idempotencySupported: true,
        secretReference: 'vault://stripe/live',
        liveEvidenceReference: 'CERT-PAY-001',
      },
    ]);

    expect(readiness.find((item) => item.domain === 'payment')).toMatchObject({
      liveCertified: true,
      missing: [],
    });
  });
});
