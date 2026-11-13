import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import userEvent from '@testing-library/user-event';
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
    fetchMock.mockResolvedValueOnce(await fetchMock()).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              namespace: 'common',
              key: 'customer.code-123',
              locale: 'ar',
              state: 'MISSING',
            },
          ],
        }),
        { status: 200 },
      ),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: [{ namespace: 'common', key: 'account', defaultMessage: 'Account' }],
        }),
      ),
    );
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: [
              {
                version: 'a123',
                locale: 'en',
                createdAt: '2026-01-01T10:00:00Z',
                active: true,
              },
              {
                version: 'b123',
                locale: 'ar',
                createdAt: '2026-01-01T09:00:00Z',
                active: false,
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              enabled: true,
              entries: [
                {
                  namespace: 'common',
                  key: 'account',
                  source: 'Account',
                  locale: 'ar',
                  translation: 'الحساب',
                  scope: 'TENANT',
                },
              ],
            },
          }),
        ),
      );
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    const navigation = {
      id: 'localization-operations',
      moduleName: 'localizationCore',
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
    const queue = {
      ...navigation,
      id: 'localization-values',
      parentId: navigation.id,
      route: '/localization/queue',
      label: 'Translation Queue',
    } as const;
    const keys = {
      ...navigation,
      id: 'localization-keys',
      parentId: navigation.id,
      route: '/localization/keys',
      label: 'Translation Keys',
    } as const;
    const releases = {
      ...keys,
      id: 'localization-releases',
      route: '/localization/releases',
      label: 'Translation Releases',
    } as const;
    const memory = {
      ...keys,
      id: 'localization-memory',
      route: '/localization/memory',
      label: 'Translation Memory',
    } as const;
    const destinations = [navigation, queue, keys, releases, memory];
    function ActivePage() {
      const { pathname } = useLocation();
      const selected =
        destinations.find((item) => item.route === pathname) ?? navigation;
      return (
        <LocalizationOperationsRoutePage
          accessToken="token"
          bootstrap={
            {
              tenantCode: 'tenant-a',
              navigation: destinations,
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
          fallbackLocales={['en']}
          navigation={selected}
          runtime={{ enterpriseCode: 'enterprise-a', requestTimeoutMs: 1000 } as never}
          site="axis"
          supportedLocales={['en', 'ar']}
        />
      );
    }
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={['/localization']}>
          <ActivePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('100%')).toBeVisible();
    expect(screen.getByText('75%')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Coverage' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Translation Queue' })).toHaveAttribute(
      'href',
      '/localization/queue',
    );
    expect(
      screen.queryByRole('link', { name: 'Unauthorized translations' }),
    ).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        'http://localhost:4300/nodics/localizationApi/v0/localization/operations/coverage',
      ),
      expect.objectContaining({ method: 'POST', credentials: 'omit' }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    if (typeof request.body !== 'string') throw new Error('Expected JSON request');
    const payload: unknown = JSON.parse(request.body);
    expect(payload).toMatchObject({
      scopeCode: 'axis',
      channel: 'axis',
      locales: ['en', 'ar'],
      fallbackLocales: ['en'],
    });
    await userEvent.click(screen.getByRole('link', { name: 'Translation Queue' }));
    expect(await screen.findByText('common.customer.code-123')).toHaveProperty(
      'tagName',
      'BDI',
    );
    expect(screen.getByRole('table', { name: 'Translation Queue' })).toBeVisible();
    expect(fetchMock).toHaveBeenLastCalledWith(
      new URL(
        'http://localhost:4300/nodics/localizationApi/v0/localization/operations/queue',
      ),
      expect.objectContaining({ method: 'POST' }),
    );
    await userEvent.click(screen.getByRole('link', { name: 'Translation Keys' }));
    expect(
      await screen.findByRole('rowheader', { name: 'common.account' }),
    ).toBeVisible();
    expect(screen.getByRole('cell', { name: 'Account' })).toBeVisible();
    expect(fetchMock).toHaveBeenLastCalledWith(
      new URL(
        'http://localhost:4300/nodics/localizationApi/v0/localization/operations/side-by-side',
      ),
      expect.objectContaining({ method: 'POST' }),
    );
    await userEvent.click(screen.getByRole('link', { name: 'Translation Releases' }));
    expect(await screen.findByRole('rowheader', { name: 'a123' })).toBeVisible();
    expect(screen.getByRole('cell', { name: 'Online' })).toBeVisible();
    expect(screen.getByRole('cell', { name: 'Not active' })).toBeVisible();
    await userEvent.click(screen.getByRole('link', { name: 'Translation Memory' }));
    expect(await screen.findByRole('cell', { name: 'الحساب' })).toBeVisible();
    expect(screen.getByRole('cell', { name: 'Tenant' })).toBeVisible();
  });
});
