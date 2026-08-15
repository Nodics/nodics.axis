import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { DiscoveryManagementRoutePage } from '../../src/operations/discovery/DiscoveryManagementRoutePage';

describe('Discovery Management presentation', () => {
  it('renders backend-governed Discovery tabs without owning backend records', async () => {
    const user = userEvent.setup();
    const navigation = {
      id: 'discovery-management',
      moduleName: 'discoveryConfig',
      label: 'Discovery',
      route: '/discovery/config',
      category: 'platform',
      icon: 'search',
      order: 240,
      availability: 'UP',
      featureState: 'ACTIVE',
      workbenchTarget: {
        moduleName: 'discoveryConfig',
        schemaName: 'discoveryIndexConfiguration',
      },
      requiredPermissions: ['discovery.config.read'],
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
          <DiscoveryManagementRoutePage
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

    expect(screen.getByRole('heading', { name: 'Discovery management' })).toBeVisible();
    expect(screen.getByText(/without indexing raw catalog records/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Indexes' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Product rules' }));
    expect(screen.getByRole('button', { name: 'Product rules' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByText(/Publication, schema validation, tenant security/i),
    ).toBeVisible();
  });
});
