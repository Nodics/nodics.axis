import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { OrderReviewPanel } from '../../src/operations/orderLifecycle/OrderReviewPanel';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('offers refund review for pending cancellations, returns and refunds, not other or completed cases', async () => {
  const cases = ['CANCELLATION', 'RETURN', 'REFUND', 'DISPUTE'].map(
    (requestedResolution, index) => ({
      code: 'review-' + index,
      orderCode: 'order-' + index,
      revision: 1,
      status: index === 1 ? 'REFUND_RECONCILIATION' : 'SUBMITTED',
      requestedResolution,
      comment: 'Buyer review',
    }),
  );
  const fetcher = vi.fn(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          data: {
            cases: [
              ...cases,
              { ...cases[0], code: 'finished-case', status: 'REFUNDED' },
            ],
          },
        }),
        { status: 200 },
      ),
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  render(
    <OrderReviewPanel
      bootstrap={
        {
          moduleConnections: {
            order: [{ endpoint: 'https://commerce.test/nodics/order', state: 'UP' }],
          },
        } as never
      }
      accessToken="reviewer-test-token"
      runtime={{ enterpriseCode: 'default', requestTimeoutMs: 1000 } as never}
    />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Load order reviews' }));
  expect(
    await screen.findAllByRole('button', { name: 'Preview refund and reversals' }),
  ).toHaveLength(3);
  expect(screen.getByText('Refund and reversals completed.')).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledOnce();
});
