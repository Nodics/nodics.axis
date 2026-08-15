import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { PromotionsBuilderRoutePage } from '../../src/operations/promotions/PromotionsBuilderRoutePage';

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

    expect(screen.getByRole('heading', { name: 'Promotions Builder' })).toBeVisible();
    expect(screen.getByText(/does not calculate eligibility/i)).toBeVisible();
    expect(screen.getByText('Eligibility')).toBeVisible();
    expect(screen.getByText('Coupon and budget')).toBeVisible();
    expect(screen.getByText(/Customer checkout receives only the approved/i)).toBeVisible();
    expect(screen.getByLabelText('Loading Axis configuration')).toBeInTheDocument();
  });
});
