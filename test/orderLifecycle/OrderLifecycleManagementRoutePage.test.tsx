import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { OrderLifecycleManagementRoutePage } from '../../src/operations/orderLifecycle/OrderLifecycleManagementRoutePage';
import { orderLifecycleDashboardItem, orderLifecycleOperatorQueues } from '../../src/operations/orderLifecycle/orderLifecycleDashboard';
import { orderLifecycleGuidance } from '../../src/operations/orderLifecycle/orderLifecycleGuidance';

describe('Order Lifecycle Management presentation', () => {
  it('uses backend navigation to show operator queues above the Workbench', () => {
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
      workbenchPresentation: {
        fixedFilters: [{ id: 'request-type-refund', label: 'Refund requests', field: 'requestType', value: 'REFUND', order: 10 }],
      },
    } as const;
    const exchangeNavigation = {
      ...navigation,
      id: 'order-exchanges',
      label: 'Exchanges & Replacements',
      route: '/commerce/exchanges',
      workbenchPresentation: {
        fixedFilters: [
          { id: 'request-type-exchange', label: 'Exchange requests', field: 'requestType', value: 'EXCHANGE', order: 10 },
          { id: 'request-type-replacement', label: 'Replacement requests', field: 'requestType', value: 'REPLACEMENT', order: 20 },
        ],
      },
    } as const;
    const appealNavigation = {
      ...navigation,
      id: 'order-appeals',
      label: 'Lifecycle Appeals',
      route: '/commerce/appeals',
      workbenchPresentation: {
        fixedFilters: [{ id: 'request-type-appeal', label: 'Appeal requests', field: 'requestType', value: 'APPEAL', order: 10 }],
      },
    } as const;
    const bootstrap = {
      tenantCode: 'tenant1',
      navigation: [navigation, exchangeNavigation, appealNavigation],
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
    expect(screen.getByRole('heading', { name: 'Order Lifecycle Operator Queues' })).toBeInTheDocument();
    expect(screen.getByText(/Refund Cases: REFUND/)).toBeInTheDocument();
    expect(screen.getByText(/Exchanges & Replacements: EXCHANGE\/REPLACEMENT/)).toBeInTheDocument();
    expect(screen.getByText(/Lifecycle Appeals: APPEAL/)).toBeInTheDocument();
    expect(screen.getByText(/Actions still execute only through Commerce-owned/)).toBeInTheDocument();
    expect(screen.getByLabelText('Loading Axis configuration')).toBeInTheDocument();
  });

  it('explains distinct cancellation, Return, Refund, Exchange and Appeal decisions', () => {
    expect(orderLifecycleGuidance('orderCancellationRequest')).toContain(
      'settlement impact',
    );
    expect(orderLifecycleGuidance('orderReturnRequest')).toContain('Fulfillment owns');
    expect(orderLifecycleGuidance('orderRefundRequest')).toContain('maker-checker');
    expect(orderLifecycleGuidance('orderExchangeRequest')).toContain('replacement selection');
    expect(orderLifecycleGuidance('orderAppealRequest')).toContain('customer appeal evidence');
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
    expect(orderLifecycleDashboardItem({ code: 'exchange-1', requestType: 'EXCHANGE', status: 'SUBMITTED', evidence: { rmaCode: 'RMA-2' } }, actions)).toMatchObject({
      bucket: 'returnHandling',
      recommendedActionIds: ['mark-received', 'record-disposition'],
    });
  });

  it('derives cancellation return refund exchange replacement and appeal queues from backend navigation', () => {
    const base = {
      moduleName: 'order',
      category: 'commerce',
      icon: 'commerce',
      availability: 'UP',
      featureState: 'ACTIVE',
      workbenchTarget: { moduleName: 'order', schemaName: 'orderLifecycleRequest' },
      requiredPermissions: ['commerce.lifecycle.read'],
      perspectives: [],
      contexts: [],
      order: 1,
    } as const;
    const queues = orderLifecycleOperatorQueues([
      { ...base, id: 'order-cancellations', label: 'Cancellations', route: '/commerce/cancellations' },
      { ...base, id: 'order-returns', label: 'Returns', route: '/commerce/returns' },
      { ...base, id: 'order-refunds', label: 'Refunds', route: '/commerce/refunds' },
      { ...base, id: 'order-exchanges', label: 'Exchanges & Replacements', route: '/commerce/exchanges' },
      { ...base, id: 'order-appeals', label: 'Lifecycle Appeals', route: '/commerce/appeals' },
    ] as never);

    expect(queues.map((queue) => queue.code)).toEqual(['cancellations', 'returns', 'refunds', 'exchanges', 'appeals']);
    expect(queues.find((queue) => queue.code === 'exchanges')?.requestTypes).toEqual(['EXCHANGE', 'REPLACEMENT']);
    expect(queues.find((queue) => queue.code === 'appeals')?.requestTypes).toEqual(['APPEAL']);
  });
});
