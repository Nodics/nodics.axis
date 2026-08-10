import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ProductManagementRoutePage } from '../../src/operations/productManagement/ProductManagementRoutePage';

describe('Product Management localization presentation', () => {
  it('composes Product and locale schemas without browser-owned persistence', async () => {
    const user = userEvent.setup();
    const navigation = {
      id: 'products',
      moduleName: 'product',
      label: 'Products',
      route: '/commerce/catalog/products',
      category: 'commerce',
      icon: 'commerce',
      order: 120,
      availability: 'UP',
      featureState: 'ACTIVE',
      workbenchTarget: { moduleName: 'product', schemaName: 'product' },
      requiredPermissions: ['commerce.product.read'],
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
          <ProductManagementRoutePage
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
    expect(
      screen.getByRole('heading', { name: 'Product language management' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Products' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.type(
      screen.getByLabelText('Selected Product code'),
      'sampleRunningShoe',
    );
    await user.click(screen.getByRole('button', { name: 'Arabic' }));
    expect(screen.getByRole('button', { name: 'Arabic' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/Arabic content for sampleRunningShoe/i)).toBeVisible();
    expect(
      screen.getByText(/SKU, price, tax, and inventory stay shared/i),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Bulk import languages' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Bulk export languages' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(
      screen.getByText(/Product module is not currently available/i),
    ).toBeVisible();
  });
});
