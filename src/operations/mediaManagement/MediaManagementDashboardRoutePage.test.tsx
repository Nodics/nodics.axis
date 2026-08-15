import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AxisAuthenticatedBootstrap } from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { MediaManagementDashboardRoutePage } from './MediaManagementDashboardRoutePage';

const runtime: AxisRuntimeConfig = {
  backofficeBaseUrl: 'http://localhost:3000',
  enterpriseCode: 'default',
  projectCode: 'nodics.kickoff',
  clientContractVersion: 1,
  requestTimeoutMs: 1000,
  browserSessionCsrfCookieName: 'csrf',
  assistantMaximumEventBytes: 1024,
  assistantReconnectWindowMs: 1000,
  assistantIdleTimeoutMs: 1000,
};

const bootstrap: AxisAuthenticatedBootstrap = {
  axisPolicy: {
    contractVersion: 1,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 1,
    source: 'DEFAULT',
  },
  documentationSources: [],
  environments: ['kickoffLocal'],
  moduleCatalog: {},
  moduleConnections: {},
  navigation: [],
  tenantCode: 'default',
};

describe('MediaManagementDashboardRoutePage', () => {
  it('shows the production media approval and activation workflow', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MediaManagementDashboardRoutePage
          accessToken="employee-token"
          bootstrap={bootstrap}
          runtime={runtime}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Approved media activation flow' })).toBeTruthy();
    expect(screen.getByText('Upload or select Nodics-owned asset')).toBeTruthy();
    expect(screen.getByText('Capture checksum and source evidence')).toBeTruthy();
    expect(screen.getByText('Reviewer approves rights and target usage')).toBeTruthy();
    expect(screen.getByText('Activate media reference for content or product')).toBeTruthy();
    expect(screen.getByText('RIGHTS_APPROVED')).toBeTruthy();
    expect(screen.getByText('REFERENCE_ACTIVATED')).toBeTruthy();
    expect(screen.getByText('Rights policy check')).toBeTruthy();
    expect(screen.getByText('Checksum and source proof')).toBeTruthy();
    expect(screen.getByText('Target usage approval')).toBeTruthy();
    expect(screen.getByText('Emergency deactivation')).toBeTruthy();
    expect(screen.getByText(/Sample or reference-site media remains inactive/)).toBeTruthy();
  });
});
