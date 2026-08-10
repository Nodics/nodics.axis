import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { CustomerEngagementRoutePage } from '../../src/operations/customerEngagement/CustomerEngagementRoutePage';

describe('Customer Engagement presentation', () => {
  it('renders only backend-published engagement workspaces and the data boundary', () => {
    const parent = {
      id: 'customer-engagement',
      moduleName: 'engagement',
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
    } as never;

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
    expect(screen.getByText('Contact Submissions')).toBeInTheDocument();
    expect(screen.getByText('Process Handoffs')).toBeInTheDocument();
    expect(screen.getByText('Testimonial Candidates')).toBeInTheDocument();
    expect(screen.getByText('Editorial Versions')).toBeInTheDocument();
    expect(screen.getByText('Consent & Rights')).toBeInTheDocument();
    expect(screen.getByText('Publication Calendar')).toBeInTheDocument();
    expect(screen.getByText('Customer Reviews')).toBeInTheDocument();
    expect(screen.getByText('Review Moderation')).toBeInTheDocument();
    expect(screen.getByText('Business Responses')).toBeInTheDocument();
    expect(screen.getByText('Review Abuse & Appeals')).toBeInTheDocument();
    expect(screen.getByText('Published Reviews')).toBeInTheDocument();
    expect(screen.getByText('Rating Aggregates')).toBeInTheDocument();
    expect(screen.getByText('Review Requests')).toBeInTheDocument();
    expect(screen.getByText('Review Syndication')).toBeInTheDocument();
    expect(screen.getByText('Customer Feedback')).toBeInTheDocument();
    expect(screen.getByText('Complaints')).toBeInTheDocument();
    expect(screen.getByText('Feedback Follow-up')).toBeInTheDocument();
    expect(screen.getByText('Feedback Surveys')).toBeInTheDocument();
    expect(screen.getByText('Feedback Insights')).toBeInTheDocument();
    expect(screen.getByText('Unified Queue')).toBeInTheDocument();
    expect(screen.getByText('Engagement Dashboards')).toBeInTheDocument();
    expect(screen.getByText('Repair Console')).toBeInTheDocument();
    expect(screen.getByText('Engagement Exports')).toBeInTheDocument();
    expect(screen.getByText('Automation Decisions')).toBeInTheDocument();
    expect(screen.getByText('Automation Evaluations')).toBeInTheDocument();
    expect(screen.getByText('Provider Deliveries')).toBeInTheDocument();
    expect(screen.getByText('Recovery Checkpoints')).toBeInTheDocument();
    expect(screen.getByText('Contract Compatibility')).toBeInTheDocument();
    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
    expect(screen.getByText('Backend governed')).toBeInTheDocument();
    expect(
      screen.getByText(/browser-side customer engagement store/),
    ).toBeInTheDocument();
  });
});
