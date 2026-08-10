import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { CustomerEngagementRoutePage } from '../../src/operations/customerEngagement/CustomerEngagementRoutePage';
import { engagementDomains } from '../../src/operations/customerEngagement/engagementDomains';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';

describe('Customer Engagement presentation', () => {
  it('groups backend-published workspaces into a concise business landing page', () => {
    const parent = {
      id: 'customer-engagement',
      moduleName: 'nodics.engagement',
      label: 'Customer Engagement',
      route: '/engagement',
      category: 'customer-experience',
      icon: 'feedback',
      order: 500,
      availability: 'UP',
      featureState: 'ACTIVE',
      perspectives: ['operations'],
      contexts: ['tenant'],
    } as const;
    const contacts = {
      ...parent,
      id: 'contact-submissions',
      label: 'Contact Submissions',
      route: '/engagement/contact-submissions',
      parentId: 'customer-engagement',
      order: 510,
      workbenchTarget: {
        moduleName: 'contactSubmission',
        schemaName: 'contactRequest',
      },
    } as const;
    const unrelated = {
      ...parent,
      id: 'orders',
      label: 'Orders',
      route: '/commerce/orders',
      order: 1,
    } as const;
    const handoffs = {
      ...parent,
      id: 'contact-handoffs',
      label: 'Process Handoffs',
      route: '/engagement/contact-handoffs',
      parentId: 'customer-engagement',
      order: 520,
      workbenchTarget: {
        moduleName: 'contactSubmission',
        schemaName: 'contactHandoff',
      },
      lifecycleActions: [
        {
          id: 'retry',
          label: 'Retry',
          intent: 'UPDATE',
          order: 10,
          ownerModule: 'engagementApi',
          operationRoute: '/operator/handoffs/:code/retry',
          targetStatuses: ['DEAD_LETTER'],
        },
      ],
    } as const;
    const testimonialWorkspaces = [
      ['testimonial-candidates', 'Testimonial Candidates', 'testimonialCandidate', 530],
      ['testimonial-editorial', 'Editorial Versions', 'testimonialVersion', 540],
      ['testimonial-consents', 'Consent & Rights', 'testimonialConsent', 550],
      [
        'testimonial-publications',
        'Publication Calendar',
        'testimonialProjection',
        560,
      ],
    ].map(([id, label, schemaName, order]) => ({
      ...parent,
      id,
      label,
      route: `/engagement/${id}`,
      parentId: 'customer-engagement',
      order,
      workbenchTarget: { moduleName: 'testimonial', schemaName },
    }));
    const reviewWorkspaces = [
      ['customer-reviews', 'Customer Reviews', 'customerReview', 570],
      ['review-moderation', 'Review Moderation', 'customerReviewModeration', 580],
      ['review-responses', 'Business Responses', 'customerReviewResponse', 590],
      ['review-abuse', 'Review Abuse & Appeals', 'customerReviewAbuseReport', 600],
      ['review-publications', 'Published Reviews', 'customerReviewProjection', 610],
      ['review-aggregates', 'Rating Aggregates', 'customerReviewAggregate', 620],
      ['review-requests', 'Review Requests', 'customerReviewRequest', 630],
      ['review-syndication', 'Review Syndication', 'customerReviewSyndication', 640],
      ['customer-feedback', 'Customer Feedback', 'customerFeedback', 650],
      ['feedback-complaints', 'Complaints', 'customerFeedback', 660],
      ['feedback-follow-up', 'Feedback Follow-up', 'customerFeedbackFollowUp', 670],
      ['feedback-surveys', 'Feedback Surveys', 'engagementFormDefinition', 680],
      ['feedback-insights', 'Feedback Insights', 'customerFeedbackInsight', 690],
      ['engagement-unified-queue', 'Unified Queue', 'engagementUnifiedQueueItem', 700],
      [
        'engagement-dashboards',
        'Engagement Dashboards',
        'engagementDashboardSnapshot',
        710,
      ],
      ['engagement-repairs', 'Repair Console', 'engagementRepairCase', 720],
      ['engagement-exports', 'Engagement Exports', 'engagementExportEvidence', 730],
      [
        'engagement-automation-decisions',
        'Automation Decisions',
        'engagementAutomationDecision',
        740,
      ],
      [
        'engagement-automation-evaluations',
        'Automation Evaluations',
        'engagementAutomationEvaluation',
        750,
      ],
      [
        'engagement-delivery-attempts',
        'Provider Deliveries',
        'engagementDeliveryAttempt',
        760,
      ],
      [
        'engagement-recovery-checkpoints',
        'Recovery Checkpoints',
        'engagementRecoveryCheckpoint',
        770,
      ],
      [
        'engagement-compatibility',
        'Contract Compatibility',
        'engagementCompatibilityRecord',
        780,
      ],
    ].map(([id, label, schemaName, order]) => ({
      ...parent,
      id,
      label,
      route: `/engagement/${id}`,
      parentId: 'customer-engagement',
      order,
      workbenchTarget: {
        moduleName: String(schemaName).startsWith('customerReview')
          ? 'customerReview'
          : String(schemaName).startsWith('engagement')
            ? 'engagementCore'
            : 'customerFeedback',
        schemaName,
      },
    }));
    const bootstrap = {
      tenantCode: 'tenant1',
      navigation: [
        parent,
        contacts,
        handoffs,
        ...testimonialWorkspaces,
        ...reviewWorkspaces,
        unrelated,
      ],
      moduleConnections: {},
      axisPolicy: { recentNavigationLimit: 10 },
    } as unknown as AxisAuthenticatedBootstrap;

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <CustomerEngagementRoutePage
            accessToken="token"
            bootstrap={bootstrap}
            channel="axis"
            cmsBaseUrl="/cms"
            employeeId="operator"
            locale="en"
            navigation={parent}
            runtime={{ enterpriseCode: 'enterprise1', requestTimeoutMs: 1000 } as never}
            site="axis"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Customer Experience')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Contact' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open Testimonials' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open Reviews & ratings' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Feedback' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open Work management' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open Governance & automation' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Start with Contact Submissions')).toBeInTheDocument();
    expect(screen.queryByText('Process Handoffs')).not.toBeInTheDocument();
    expect(screen.queryByText('Review Moderation')).not.toBeInTheDocument();
    expect(screen.queryByText('Unified Queue')).not.toBeInTheDocument();
    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
    expect(screen.getByText('Backend governed')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(engagementDomains(bootstrap.navigation)).toHaveLength(6);
  });
});
