import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProviderCertificationReadinessPanel } from './ProviderCertificationReadinessPanel';

describe('ProviderCertificationReadinessPanel', () => {
  it('shows payment carrier warehouse and POS readiness without granting certification in Axis', () => {
    render(
      <ProviderCertificationReadinessPanel
        declarations={[
          {
            domain: 'payment',
            providerCode: 'stripe-sandbox',
            state: 'OFFLINE_CONFORMANCE',
            webhookSecured: true,
            idempotencySupported: true,
            secretReference: 'vault://stripe/test',
          },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Commerce Provider Certification' })).toBeTruthy();
    expect(screen.getByText('Payment provider')).toBeTruthy();
    expect(screen.getByText('Carrier provider')).toBeTruthy();
    expect(screen.getByText('Warehouse or inspection provider')).toBeTruthy();
    expect(screen.getByText('POS provider')).toBeTruthy();
    expect(screen.getByText('OFFLINE_CONFORMANCE')).toBeTruthy();
    expect(screen.getAllByText(/not live-certified/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No live certification evidence reference/).length).toBeGreaterThan(0);
    expect(screen.getByText(/production-traffic approval remain authoritative/)).toBeTruthy();
    expect(screen.getByText(/Sandbox or offline conformance is not live certification/)).toBeTruthy();
  });
});
