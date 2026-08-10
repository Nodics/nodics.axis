import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocalizationOperationsRoutePage } from '../../src/operations/localization/LocalizationOperationsRoutePage';

describe('Localization Operations', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders backend coverage and exposes governed lifecycle workspaces', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            locales: [
              {
                locale: 'en',
                total: 20,
                approved: 20,
                review: 0,
                draft: 0,
                fallback: 0,
                missing: 0,
                coveragePercent: 100,
              },
              {
                locale: 'ar',
                total: 20,
                approved: 15,
                review: 2,
                draft: 1,
                fallback: 1,
                missing: 1,
                coveragePercent: 75,
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const navigation = {
      id: 'localization-operations',
      moduleName: 'nodics.localization',
      label: 'Localization Operations',
      route: '/localization',
      category: 'platform',
      icon: 'language',
      order: 240,
      availability: 'UP',
      featureState: 'ACTIVE',
      workbenchTarget: {
        moduleName: 'localizationCore',
        schemaName: 'localizationValue',
      },
      requiredPermissions: ['localization.operations.read'],
      perspectives: [],
      contexts: [],
    } as const;
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <LocalizationOperationsRoutePage
            accessToken="token"
            bootstrap={
              {
                tenantCode: 'tenant-a',
                navigation: [navigation],
                moduleConnections: {
                  localizationApi: [
                    {
                      moduleName: 'localizationApi',
                      instanceId: 'localization-1',
                      endpoint: 'http://localhost:4300',
                      state: 'UP',
                    },
                  ],
                },
              } as never
            }
            channel="axis"
            cmsBaseUrl="/cms"
            employeeId="operator"
            locale="en"
            navigation={navigation}
            runtime={
              { enterpriseCode: 'enterprise-a', requestTimeoutMs: 1000 } as never
            }
            site="axis"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('100%')).toBeVisible();
    expect(screen.getByText('75%')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Translation Queue' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Translation Releases' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Translation Memory' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Translation Queue' }));
    expect(screen.getByRole('button', { name: 'Translation Queue' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('http://localhost:4300/v0/localization/operations/coverage'),
      expect.objectContaining({ method: 'POST', credentials: 'omit' }),
    );
  });
});
