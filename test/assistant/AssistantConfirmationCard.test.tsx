/** @file Verifies immutable execution intent and fail-closed outcome presentation. */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AssistantConfirmationCard } from '../../src/cms/renderers/components/assistant/AssistantConfirmationCard';
import {
  parseAssistantActionOutcomes,
  parseAssistantConfirmation,
} from '../../src/assistant/api/assistantContractParsers';
import { parseAssistantReview } from '../../src/assistant/api/assistantReview';

const confirmation = {
  confirmationCode: 'action-1',
  conversationCode: 'conversation-1',
  operationId: 'products.create',
  state: 'APPROVED',
  argumentsDigest: 'digest',
  revision: 2,
  expiresAt: '2030-01-01T00:00:00Z',
  impact: { summary: 'Create products' },
};
const labels = {
  title: 'Approval',
  approveLabel: 'Approve',
  executeLabel: 'Execute',
  rejectLabel: 'Reject',
  expiredLabel: 'Expired',
  completedLabel: 'Completed',
};

describe('Assistant action safety', () => {
  it.each([
    'profile.enterprise.invite',
    'commerce.price.create',
    'process.task.claim',
    'process.task.assign',
    'process.task.complete',
    'process.task.cancel',
    'process.trigger.create',
    'process.trigger.update',
    'process.trigger.archive',
    'process.trigger.execute',
    'process.definition.create',
    'process.definition.update',
    'process.definition.prepare',
    'process.definition.validate',
    'process.definition.publish',
    'process.definition.delete',
    'process.instance.start',
    'process.instance.cancel',
    'process.instance.retry',
    'process.instance.compensate',
    'data.record.create',
    'data.record.update',
    'data.record.delete',
  ])(
    'accepts native recovery for %s without adding client execution authority',
    (operationId) => {
      const parsed = parseAssistantConfirmation({
        ...confirmation,
        operationId,
        state: 'OUTCOME_UNKNOWN',
        recovery: { label: 'Inspect original results' },
        impact: {
          summary: 'Review existing owner records',
          review: [{ title: 'Record', fields: [{ label: 'Code', value: 'DEMO' }] }],
        },
      });
      render(
        <AssistantConfirmationCard
          {...labels}
          confirmation={parsed}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          onExecute={vi.fn()}
          onReconcile={vi.fn()}
        />,
      );
      expect(
        screen.getByRole('button', { name: 'Inspect original results' }),
      ).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Execute' })).not.toBeInTheDocument();
      expect(() =>
        parseAssistantConfirmation({
          ...parsed,
          operationId: 'arbitrary.schema.write',
        }),
      ).toThrow();
    },
  );
  it('inspects original results without exposing execute and locks overlapping inspection', async () => {
    let finish!: () => void;
    const inspect = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const execute = vi.fn();
    render(
      <AssistantConfirmationCard
        {...labels}
        confirmation={{
          ...confirmation,
          state: 'OUTCOME_UNKNOWN',
          recovery: { label: 'Inspect original results' },
        }}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onExecute={execute}
        onReconcile={inspect}
      />,
    );
    const button = screen.getByRole('button', { name: 'Inspect original results' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Execute' })).not.toBeInTheDocument();
    finish();
    await waitFor(() => expect(button).toBeEnabled());
    expect(execute).not.toHaveBeenCalled();
  });

  it('presents fresh continuation approval with completed original rows intact', () => {
    render(
      <AssistantConfirmationCard
        {...labels}
        confirmation={{
          ...confirmation,
          state: 'PENDING',
          recovery: {
            label: 'Inspect original results',
            continuation: 'Review remaining unstarted rows.',
          },
          outcomes: [{ index: 0, schema: 'product', code: 'one', state: 'COMPLETED' }],
        }}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onExecute={vi.fn()}
      />,
    );
    expect(screen.getByText('Review remaining unstarted rows.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Execute' })).not.toBeInTheDocument();
    expect(screen.getByText('product: one - COMPLETED')).toBeInTheDocument();
  });
  it('renders every reviewed enterprise and invitation field as inert text', () => {
    render(
      <AssistantConfirmationCard
        {...labels}
        confirmation={{
          ...confirmation,
          impact: {
            review: [
              {
                title: 'Enterprise',
                fields: [
                  { label: 'Name', value: '<script>unsafe()</script>' },
                  { label: 'Administrator', value: 'admin@example.test' },
                ],
              },
              {
                title: 'Employee invitation',
                fields: [
                  { label: 'Email', value: 'employee@example.test' },
                  { label: 'Role', value: 'VIEWER' },
                ],
              },
            ],
          },
        }}
        onApprove={vi.fn()}
        onExecute={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByRole('region', { name: 'Approval' })).toHaveAttribute(
      'tabindex',
      '0',
    );
    expect(screen.getByText('<script>unsafe()</script>')).toBeInTheDocument();
    expect(screen.getByText('admin@example.test')).toBeInTheDocument();
    expect(screen.getByText('employee@example.test')).toBeInTheDocument();
    expect(screen.getByText('VIEWER')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByRole('button', { name: 'Execute' })).toBeEnabled();
  });

  it('blocks malformed review execution while retaining rejection', async () => {
    const reject = vi.fn().mockResolvedValue(undefined);
    render(
      <AssistantConfirmationCard
        {...labels}
        confirmation={{
          ...confirmation,
          impact: {
            review: [
              {
                title: 'Enterprise',
                fields: [{ label: 'Name', value: { hidden: 'unreviewable' } }],
              },
            ],
          },
        }}
        onApprove={vi.fn()}
        onExecute={vi.fn()}
        onReject={reject}
      />,
    );
    expect(screen.getByRole('button', { name: 'Execute' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(reject).toHaveBeenCalledTimes(1));
    expect(() => parseAssistantReview(Array(201).fill({}))).toThrow();
    expect(() => parseAssistantReview([])).toThrow();
    expect(parseAssistantReview(undefined)).toEqual([]);
  });

  it('shows partial outcomes without a retry control', () => {
    render(
      <AssistantConfirmationCard
        {...labels}
        confirmation={confirmation}
        onApprove={vi.fn()}
        onExecute={vi.fn()}
        onReject={vi.fn()}
        result={{
          state: 'OUTCOME_UNKNOWN',
          rows: [
            { index: 0, schema: 'product', code: 'p1', state: 'COMPLETED' },
            { index: 1, schema: 'product', code: 'p2', state: 'OUTCOME_UNKNOWN' },
          ],
        }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Execute' })).not.toBeInTheDocument();
    expect(screen.getByText('product: p1 - COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('product: p2 - OUTCOME UNKNOWN')).toBeInTheDocument();
  });

  it('blocks duplicate clicks and fails closed if the callback loses its result', async () => {
    let reject!: (error: Error) => void;
    const execute = vi.fn(
      () =>
        new Promise<void>((_, failure) => {
          reject = failure;
        }),
    );
    render(
      <AssistantConfirmationCard
        {...labels}
        confirmation={confirmation}
        onApprove={vi.fn()}
        onExecute={execute}
        onReject={vi.fn()}
      />,
    );
    const button = screen.getByRole('button', { name: 'Execute' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    reject(new Error('Lost response'));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Execute' })).not.toBeInTheDocument(),
    );
  });

  it('rejects unbounded or malformed outcomes and strips private response fields', () => {
    const row = { index: 0, schema: 'product', code: 'p1', state: 'COMPLETED' };
    expect(parseAssistantActionOutcomes([{ ...row, secret: 'private' }])).toEqual([
      row,
    ]);
    expect(() => parseAssistantActionOutcomes(Array(201).fill(row))).toThrow();
    expect(() =>
      parseAssistantActionOutcomes([{ ...row, state: 'SUCCESS_MAYBE' }]),
    ).toThrow();
  });
});
