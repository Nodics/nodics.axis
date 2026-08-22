import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProductLocalizationPreview } from '../../src/operations/productManagement/ProductLocalizationPreview';
import {
  loadWorkbenchRecords,
  loadWorkbenchSchemas,
} from '../../src/workbench/api/workbenchClient';

vi.mock('../../src/workbench/api/workbenchClient', () => ({
  loadWorkbenchRecords: vi.fn(),
  loadWorkbenchSchemas: vi.fn(),
}));

describe('Product localization preview', () => {
  it('renders backend-owned English and Arabic READY records side by side', async () => {
    vi.mocked(loadWorkbenchSchemas).mockResolvedValue([
      {
        moduleName: 'product',
        schemaName: 'productLocalization',
        queryCapabilities: {
          allowedPageSizes: [10, 25, 50],
          defaultPageSize: 25,
          maximumPageSize: 50,
          defaultSort: { field: 'code', direction: 'ASC' },
          sortableFields: ['code', 'locale'],
        },
      } as never,
    ]);
    vi.mocked(loadWorkbenchRecords).mockResolvedValue({
      records: [
        {
          productCode: 'sampleRunningShoe',
          locale: 'en',
          name: 'Nodics Running Shoe',
          description: 'Lightweight running shoe',
          slug: 'nodics-running-shoe',
          status: 'READY',
        },
        {
          productCode: 'sampleRunningShoe',
          locale: 'ar',
          name: 'حذاء نوديكس للجري',
          description: 'حذاء جري خفيف الوزن',
          slug: 'nodics-running-shoe-ar',
          status: 'READY',
        },
      ],
      pageNumber: 1,
      pageSize: 25,
      totalCount: 2,
      sort: { field: 'locale', direction: 'ASC' },
    });

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ProductLocalizationPreview
          accessToken="token"
          bootstrap={
            {
              moduleConnections: {
                product: [
                  {
                    moduleName: 'product',
                    instanceId: 'product-1',
                    endpoint: 'http://localhost:4300',
                    state: 'UP',
                  },
                ],
              },
            } as never
          }
          productCode="sampleRunningShoe"
          runtime={{ enterpriseCode: 'enterprise1', requestTimeoutMs: 1000 } as never}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Nodics Running Shoe')).toBeVisible();
    expect(screen.getByText('حذاء نوديكس للجري')).toBeVisible();
    expect(screen.getByText(/English and Arabic records are READY/i)).toBeVisible();
    expect(
      screen.getByText('Nodics Running Shoe').closest('[lang="en"]'),
    ).toHaveAttribute('dir', 'ltr');
    expect(
      screen.getByText('حذاء نوديكس للجري').closest('[lang="ar"]'),
    ).toHaveAttribute('dir', 'rtl');
    expect(loadWorkbenchRecords).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        moduleName: 'product',
        schemaName: 'productLocalization',
      }),
      expect.anything(),
      expect.objectContaining({
        pageNumber: 1,
        pageSize: 25,
        sort: { field: 'locale', direction: 'ASC' },
      }),
      expect.anything(),
      expect.anything(),
    );
  });
});
