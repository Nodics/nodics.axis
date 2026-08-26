import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { ProductSellabilityWorkspace } from '../../src/operations/productManagement/ProductSellabilityWorkspace';
import {
  loadWorkbenchRecords,
  loadWorkbenchSchemas,
} from '../../src/workbench/api/workbenchClient';

vi.mock('../../src/workbench/api/workbenchClient', () => ({
  loadWorkbenchRecords: vi.fn(),
  loadWorkbenchSchemas: vi.fn(),
}));

const queryCapabilities = {
  allowedPageSizes: [10, 25],
  defaultPageSize: 10,
  maximumPageSize: 25,
  defaultSort: { field: 'code', direction: 'ASC' },
  sortableFields: ['code'],
};

function schema(moduleName: string, schemaName: string) {
  return {
    moduleName,
    schemaName,
    connectionServer: 'commerceStagedServer',
    connectionEnvironment: 'local',
    queryCapabilities,
  };
}

describe('Product sellability workspace', () => {
  it('renders guided readiness checks from backend-owned schema evidence', async () => {
    vi.mocked(loadWorkbenchSchemas).mockResolvedValue([
      schema('product', 'product'),
      schema('product', 'productVariant'),
      schema('product', 'productLocalization'),
      schema('pricing', 'priceRow'),
      schema('product', 'productSearchProjection'),
    ] as never);
    vi.mocked(loadWorkbenchRecords).mockImplementation((_connection, target) => {
      const schemaName = target.schemaName;
      const recordsBySchema: Record<string, readonly Record<string, unknown>[]> = {
        product: [
          {
            code: 'agoraLinenWrapDress',
            name: 'Linen Wrap Dress',
            status: 'ACTIVE',
            catalogVersion: 'agoraStaged',
            categoryCode: 'agoraWomenDresses',
            classificationCode: 'apparelStyleClassification',
            primaryImageCode: 'agoraLinenWrapDressFront',
          },
        ],
        productVariant: [
          {
            productCode: 'agoraLinenWrapDress',
            sku: 'AGORA-DRESS-S',
            status: 'ACTIVE',
            imageCode: 'agoraLinenWrapDressFront',
          },
        ],
        productLocalization: [
          { productCode: 'agoraLinenWrapDress', locale: 'en', status: 'READY' },
          { productCode: 'agoraLinenWrapDress', locale: 'ar', status: 'READY' },
        ],
        priceRow: [
          {
            productCode: 'agoraLinenWrapDress',
            unitAmount: '129.00',
            currency: 'USD',
          },
        ],
        productSearchProjection: [
          {
            productCode: 'agoraLinenWrapDress',
            locale: 'en',
            status: 'CURRENT',
          },
        ],
      };
      return Promise.resolve({
        records: recordsBySchema[schemaName] ?? [],
        pageNumber: 1,
        pageSize: 10,
        totalCount: recordsBySchema[schemaName]?.length ?? 0,
        sort: queryCapabilities.defaultSort,
      } as never);
    });

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <ProductSellabilityWorkspace
            accessToken="token"
            bootstrap={
              {
                moduleConnections: {
                  product: [
                    {
                      moduleName: 'product',
                      instanceId: 'product-1',
                      endpoint: 'http://localhost:4352',
                      server: 'commerceStagedServer',
                      environment: 'local',
                      state: 'UP',
                    },
                  ],
                  pricing: [
                    {
                      moduleName: 'pricing',
                      instanceId: 'pricing-1',
                      endpoint: 'http://localhost:4352',
                      server: 'commerceStagedServer',
                      environment: 'local',
                      state: 'UP',
                    },
                  ],
                },
              } as never
            }
            navigation={{ label: 'Make Product Sellable' } as never}
            runtime={{ enterpriseCode: 'enterprise1', requestTimeoutMs: 1000 } as never}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Make Product Sellable' }),
    ).toBeVisible();
    expect(await screen.findByText('11 of 11 readiness checks passing')).toBeVisible();
    expect(screen.getByText('Product identity')).toBeVisible();
    expect(screen.getByText('Mandatory languages')).toBeVisible();
    expect(screen.getByText('Stock authority')).toBeVisible();
    expect(screen.getByText('SKU: AGORA-DRESS-S')).toBeVisible();
    expect(loadWorkbenchRecords).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ schemaName: 'product' }),
      expect.anything(),
      expect.objectContaining({ pageSize: 10 }),
      expect.anything(),
      expect.anything(),
    );
  });
});
