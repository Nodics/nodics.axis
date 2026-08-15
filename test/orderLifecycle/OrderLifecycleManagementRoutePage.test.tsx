import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { OrderLifecycleManagementRoutePage } from '../../src/operations/orderLifecycle/OrderLifecycleManagementRoutePage';
import { orderLifecycleDashboardItem } from '../../src/operations/orderLifecycle/orderLifecycleDashboard';
import { orderLifecycleGuidance } from '../../src/operations/orderLifecycle/orderLifecycleGuidance';

describe('Order Lifecycle Management presentation', () => {
  it('uses the compact Workbench composition without duplicating navigation and guidance', () => {
    const navigation = {
      id: 'order-refunds',
      moduleName: 'order',
      label: 'Refund Cases',
      route: '/commerce/refunds',
      category: 'commerce',
      icon: 'receipt',
      parentId: 'checkout',
      order: 20,
      availability: 'UP',
      featureState: 'ACTIVE',
      workbenchTarget: { moduleName: 'order', schemaName: 'orderRefundRequest' },
      requiredPermissions: ['order.refund.support.read'],
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
          <OrderLifecycleManagementRoutePage
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
    expect(screen.getByLabelText('Loading Axis configuration')).toBeInTheDocument();
    expect(screen.queryByText('Backend authorized')).not.toBeInTheDocument();
    expect(screen.queryByText('Owner evidence')).not.toBeInTheDocument();
    expect(screen.queryByText('Order Lifecycle Management')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('explains distinct cancellation, Return and Refund decisions', () => {
    expect(orderLifecycleGuidance('orderCancellationRequest')).toContain(
      'settlement impact',
    );
    expect(orderLifecycleGuidance('orderReturnRequest')).toContain('Fulfillment owns');
    expect(orderLifecycleGuidance('orderRefundRequest')).toContain('maker-checker');
  });

  it('groups backend lifecycle records into operator dashboard buckets without owning actions', () => {
    const actions = [
      { id: 'approve', label: 'Approve', intent: 'APPROVE', order: 10 },
      { id: 'reject', label: 'Reject', intent: 'REJECT', order: 20 },
      { id: 'mark-received', label: 'Mark received', intent: 'OTHER', order: 30 },
      { id: 'record-disposition', label: 'Record disposition', intent: 'OTHER', order: 40 },
      { id: 'reconcile', label: 'Reconcile', intent: 'RECONCILE', order: 50 },
    ] as const;

    expect(orderLifecycleDashboardItem({ code: 'cancel-1', requestType: 'CANCELLATION', status: 'SUBMITTED' }, actions)).toMatchObject({
      bucket: 'pendingApproval',
      urgent: true,
      recommendedActionIds: ['approve', 'reject'],
    });
    expect(orderLifecycleDashboardItem({ code: 'return-1', requestType: 'RETURN', status: 'SUBMITTED', evidence: { rmaCode: 'RMA-1' } }, actions)).toMatchObject({
      bucket: 'returnHandling',
      recommendedActionIds: ['mark-received', 'record-disposition'],
    });
    expect(orderLifecycleDashboardItem({ code: 'refund-1', requestType: 'REFUND', status: 'REFUND_RECONCILIATION_REQUIRED' }, actions)).toMatchObject({
      bucket: 'refundReconciliation',
      urgent: true,
      recommendedActionIds: ['reconcile'],
    });
  });
});
