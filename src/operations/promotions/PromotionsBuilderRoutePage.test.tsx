import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { PromotionsBuilderRoutePage } from './PromotionsBuilderRoutePage';

describe('Promotions Builder presentation', () => {
  it('renders a Promotion-owned builder workbench without owning promotion rules', () => {
    const navigation = {
      id: 'promotions-builder',
      moduleName: 'promotion',
      label: 'Promotions Builder',
      route: '/commerce/promotions',
      category: 'commerce',
      icon: 'commerce',
      order: 35,
      availability: 'UP',
      featureState: 'ACTIVE',
      workbenchTarget: {
        moduleName: 'promotion',
        schemaName: 'promotion',
      },
      requiredPermissions: ['commerce.promotion.manage'],
      perspectives: [],
      contexts: [],
    } as const;
    const bootstrap = {
      tenantCode: 'tenant1',
      navigation: [navigation],
      moduleConnections: {},
      axisPolicy: { recentNavigationLimit: 10 },
    } as never;

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <PromotionsBuilderRoutePage
            accessToken="token"
            bootstrap={bootstrap}
            channel="axis"
            cmsBaseUrl="/cms"
            employeeId="operator"
            locale="en"
            navigation={navigation}
            runtime={{ enterpriseCode: 'enterprise1', requestTimeoutMs: 1000 } as never}
            site="axis"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Promotions Builder' })).toBeTruthy();
    expect(screen.getByText(/does not calculate eligibility/i)).toBeTruthy();
    expect(screen.getAllByText('Eligibility').length).toBeGreaterThan(0);
    expect(screen.getByText('Coupon and budget')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Business-user flow' })).toBeTruthy();
    expect(screen.getByText('Create or edit draft')).toBeTruthy();
    expect(screen.getByText('Preview eligibility')).toBeTruthy();
    expect(screen.getByText('Submit and approve')).toBeTruthy();
    expect(screen.getByText('Schedule, suspend or archive')).toBeTruthy();
    expect(screen.getByText('Audit redemption')).toBeTruthy();
    expect(screen.getByText('backend:approve')).toBeTruthy();
    expect(screen.getByText('backend:coupon-batch')).toBeTruthy();
    expect(screen.getByText('backend:budget-ledger')).toBeTruthy();
    expect(screen.getByText('backend:analytics')).toBeTruthy();
    expect(screen.getByText('backend:suspend')).toBeTruthy();
    expect(screen.getByText('backend:archive')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Builder form model' })).toBeTruthy();
    expect(screen.getByText('Eligibility conditions')).toBeTruthy();
    expect(screen.getAllByText('Customer segment').length).toBeGreaterThan(0);
    expect(screen.getByText('Coupon inventory')).toBeTruthy();
    expect(screen.getByText('Token hash policy')).toBeTruthy();
    expect(screen.getByText('Budget controls')).toBeTruthy();
    expect(screen.getByText('Reversal compensation')).toBeTruthy();
    expect(screen.getByText('Schedule and approval')).toBeTruthy();
    expect(screen.getByText('Maker-checker status')).toBeTruthy();
    expect(screen.getByText('Redemption audit')).toBeTruthy();
    expect(screen.getByText('Redemption code')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Second-slice workspaces' })).toBeTruthy();
    expect(screen.getByText('Editable draft sections')).toBeTruthy();
    expect(screen.getByText('Coupon inventory table')).toBeTruthy();
    expect(screen.getByText('Budget usage display')).toBeTruthy();
    expect(screen.getByText('Preview simulation panel')).toBeTruthy();
    expect(screen.getByText('Redemption and reversal audit')).toBeTruthy();
    expect(screen.getByText('remaining')).toBeTruthy();
    expect(screen.getByText('expected discount')).toBeTruthy();
    expect(screen.getByText('reversalReasonCode')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Production preview guardrails' })).toBeTruthy();
    expect(screen.getByText(/does not reserve coupons/)).toBeTruthy();
    expect(screen.getByText('Applied coupon token')).toBeTruthy();
    expect(screen.getByText('Rejected rule explanations')).toBeTruthy();
    expect(screen.getByText('Coupon safety')).toBeTruthy();
    expect(screen.getByText('Budget simulation')).toBeTruthy();
    expect(screen.getByText('Approval audit trail')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Production workflow depth' })).toBeTruthy();
    expect(screen.getByText('Condition editor')).toBeTruthy();
    expect(screen.getByText('Approval workflow')).toBeTruthy();
    expect(screen.getByText('Scheduling calendar')).toBeTruthy();
    expect(screen.getByText('Analytics and exposure')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Local builder completion' })).toBeTruthy();
    expect(screen.getByText(/excludes live payment, carrier, warehouse and POS certification/i)).toBeTruthy();
    expect(screen.getByText('Visual rule composer')).toBeTruthy();
    expect(screen.getByText('Coupon allocation workspace')).toBeTruthy();
    expect(screen.getByText('Conflict-aware calendar')).toBeTruthy();
    expect(screen.getByText('Customer exposure preview')).toBeTruthy();
    expect(screen.getByText('Redemption analytics')).toBeTruthy();
    expect(screen.getAllByText('LOCAL_COMPLETE').length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByText('NEXT_IMPLEMENTATION')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Promotion Builder operation contract' })).toBeTruthy();
    expect(screen.getByText('Save draft')).toBeTruthy();
    expect(screen.getByText('Submit promotion')).toBeTruthy();
    expect(screen.getByText('Approve promotion')).toBeTruthy();
    expect(screen.getByText('Schedule promotion')).toBeTruthy();
    expect(screen.getByText('Create coupon batch')).toBeTruthy();
    expect(screen.getByText('Reserve or release batch')).toBeTruthy();
    expect(screen.getByText('Budget ledger')).toBeTruthy();
    expect(screen.getByText('Analytics')).toBeTruthy();
    expect(screen.getByText(/PUT \/nodics\/promotion\/v0\/backoffice\/promotions\/drafts/)).toBeTruthy();
    expect(screen.getAllByText('commerce.promotion.manage').length).toBeGreaterThan(0);
    expect(screen.getByText('commerce.promotion.approve')).toBeTruthy();
    expect(screen.getByText(/Customer checkout receives only the approved/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Coupon and budget mutation controls' })).toBeTruthy();
    expect(screen.getByText('Coupon batch operation')).toBeTruthy();
    expect(screen.getByText('Budget mutation ledger')).toBeTruthy();
    expect(screen.getByText('Redemption reversal')).toBeTruthy();
    expect(screen.getByText('Approval checklist')).toBeTruthy();
    expect(screen.getByText('idempotency key')).toBeTruthy();
    expect(screen.getByText('Owner: Promotion API')).toBeTruthy();
    expect(screen.getByLabelText('Loading Axis configuration')).toBeTruthy();
  });
});
