import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AssistantCitationList } from '../../../../../src/cms/renderers/components/assistant/AssistantCitationList';
import { AssistantToolActivityCard } from '../../../../../src/cms/renderers/components/assistant/AssistantToolActivityCard';
import { AssistantUsageCard } from '../../../../../src/cms/renderers/components/assistant/AssistantUsageCard';

describe('Assistant evidence and operational cards', () => {
  it('distinguishes unknown token measurements from measured zero', () => {
    render(
      <AssistantUsageCard
        cachedLabel="Cached input"
        embeddingLabel="Embedding"
        inputLabel="Input"
        outputLabel="Output"
        reasoningLabel="Reasoning"
        reconciliationLabel="Accounting status"
        title="AI usage"
        usage={{
          inputTokens: null,
          outputTokens: 0,
          cachedInputTokens: null,
          reasoningTokens: null,
          embeddingTokens: null,
        }}
      />,
    );
    expect(screen.getByText('Input: -')).toBeVisible();
    expect(screen.getByText('Output: 0')).toBeVisible();
    expect(screen.queryByText('Input: 0')).not.toBeInTheDocument();
  });
  it('renders citation metadata as text without inventing navigation links', () => {
    render(
      <AssistantCitationList
        citations={[
          {
            citationId: 'guide-1',
            title: 'Enterprise guide',
            locator: 'https://unapproved.example/guide',
            section: 'Creation',
            version: 'v3',
          },
        ]}
        emptyLabel="No sources supplied"
        title="Sources"
      />,
    );

    expect(screen.getByText('Enterprise guide')).toBeVisible();
    expect(
      screen.getByText(/Creation.*https:\/\/unapproved\.example\/guide.*v3/),
    ).toBeVisible();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('navigates only when Knowledge supplies a validated internal route', () => {
    render(
      <AssistantCitationList
        citations={[
          {
            citationId: 'guide-2',
            title: 'Internal enterprise guide',
            locator: '/guides/enterprise',
            navigationType: 'INTERNAL_ROUTE',
            navigationTarget: '/guides/enterprise',
          },
        ]}
        emptyLabel="No sources supplied"
        title="Sources"
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Internal enterprise guide' }),
    ).toHaveAttribute('href', '/guides/enterprise');
  });

  it('renders only normalized usage and reconciliation fields', () => {
    render(
      <AssistantUsageCard
        cachedLabel="Cached input"
        embeddingLabel="Embedding"
        inputLabel="Input"
        outputLabel="Output"
        reasoningLabel="Reasoning"
        reconciliationLabel="Accounting status"
        title="AI usage"
        usage={{
          inputTokens: 12,
          outputTokens: 4,
          cachedInputTokens: 2,
          reasoningTokens: 1,
          embeddingTokens: 0,
          reconciliationState: 'RECONCILED',
        }}
      />,
    );

    expect(screen.getByText('Input: 12')).toBeVisible();
    expect(screen.getByText('Output: 4')).toBeVisible();
    expect(screen.getByText('Accounting status: RECONCILED')).toBeVisible();
    expect(screen.queryByText(/cost/i)).not.toBeInTheDocument();
  });

  it('renders safe tool identity, lifecycle, and stable failure code', () => {
    render(
      <AssistantToolActivityCard
        activity={{
          toolId: 'profile.employee.read',
          ownerModule: 'profile',
          operationId: 'profile_employee_get',
          state: 'FAILED',
          failureCode: 'PROFILE_NOT_AVAILABLE',
        }}
        failedLabel="Action failed"
        plannedLabel="Action prepared"
        runningLabel="Action in progress"
        succeededLabel="Action completed"
        title="Governed action"
      />,
    );

    expect(screen.getByText('Action failed')).toBeVisible();
    expect(screen.getByText('profile')).toBeVisible();
    expect(screen.getByText('profile_employee_get')).toBeVisible();
    expect(screen.getByText('PROFILE_NOT_AVAILABLE')).toBeVisible();
  });
});
