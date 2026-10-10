import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderRefundReview } from '../../src/operations/orderLifecycle/OrderRefundReview';

const configuration = {
  bootstrap: {
    moduleConnections: {
      order: [{ endpoint: 'https://commerce.test/nodics/order', state: 'UP' }],
    },
  } as never,
  accessToken: 'reviewer-test-token',
  enterpriseCode: 'default',
  timeoutMs: 1000,
};
const reason = 'Reviewed original buyer capture and reversal evidence.';
const fresh = {
  eligible: true,
  amount: '20.00',
  currency: 'AED',
  previewToken: 'preview-test',
};
const recovery = {
  ...fresh,
  recovery: true,
  approvalReason: reason,
  approvalCommandKey: 'original-client:refund:123',
};
const reply = (value: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify({ data: value }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
function setup(
  responses: (() => Promise<Response>)[],
  onComplete = vi.fn(() => Promise.resolve()),
  bootstrap = configuration.bootstrap,
) {
  const fetcher =
    vi.fn<
      (
        url: URL,
        request: { headers: Record<string, string>; body: string },
      ) => Promise<Response>
    >();
  for (const response of responses) fetcher.mockImplementationOnce(response);
  vi.stubGlobal('fetch', fetcher);
  render(
    <OrderRefundReview
      configuration={{ ...configuration, bootstrap }}
      code="case-123"
      revision={4}
      onComplete={onComplete}
    />,
  );
  const callAt = (index: number) => {
    const call = fetcher.mock.calls[index];
    if (!call) throw new Error('Expected owner request');
    return call;
  };
  return { fetcher, user: userEvent.setup(), onComplete, callAt };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Order refund approval and recovery', () => {
  it('requires an explicit reason and sends only the original command header, not financial inputs', async () => {
    const { user, fetcher, onComplete, callAt } = setup([
      () => reply(fresh),
      () => reply({ status: 'COMPLETED' }),
    ]);
    await user.click(
      screen.getByRole('button', { name: 'Preview refund and reversals' }),
    );
    const dialog = await screen.findByRole('dialog');
    const approve = within(dialog).getByRole('button', {
      name: 'Approve refund and reversals',
    });
    expect(approve).toBeDisabled();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await user.type(within(dialog).getByLabelText('Refund approval reason'), reason);
    await user.click(approve);
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, request] = callAt(1);
    expect(url.pathname).toBe('/nodics/order/v0/disputes/case-123/refund');
    expect(request.headers['Idempotency-Key']).toBe('case-123:refund');
    expect(JSON.parse(request.body)).toEqual({
      confirmed: true,
      expectedRevision: 4,
      previewToken: 'preview-test',
      reason,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('recovers another client approval using its immutable reason and command reference', async () => {
    const { user, callAt } = setup([
      () => reply(recovery),
      () => reply({ status: 'COMPLETED' }),
    ]);
    await user.click(
      screen.getByRole('button', { name: 'Preview refund and reversals' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Refund approval reason')).toBeDisabled();
    expect(within(dialog).getByLabelText('Refund approval reason')).toHaveValue(reason);
    await user.click(
      within(dialog).getByRole('button', { name: 'Retry approved refund' }),
    );
    expect(callAt(1)[1].headers['Idempotency-Key']).toBe(recovery.approvalCommandKey);
    expect((JSON.parse(callAt(1)[1].body) as Record<string, unknown>).reason).toBe(
      reason,
    );
  });

  it.each([undefined, 'invalid key', 'x'.repeat(181)])(
    'refuses a missing or invalid original recovery key: %s',
    async (approvalCommandKey) => {
      const { user, fetcher } = setup([
        () => reply({ ...recovery, approvalCommandKey }),
        () => reply(recovery),
      ]);
      await user.click(
        screen.getByRole('button', { name: 'Preview refund and reversals' }),
      );
      const dialog = await screen.findByRole('dialog');
      expect(
        within(dialog).getByText(
          'The original refund command reference is unavailable.',
        ),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole('button', { name: 'Retry approved refund' }),
      ).toBeDisabled();
      await user.click(
        within(dialog).getByRole('button', { name: 'Refresh refund plan' }),
      );
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(
        fetcher.mock.calls.every(([url]) => url.pathname.endsWith('/refund-preview')),
      ).toBe(true);
      expect(
        within(dialog).getByRole('button', { name: 'Retry approved refund' }),
      ).toBeEnabled();
    },
  );

  it('does not automatically retry an uncertain write and supports an explicit read-only refresh', async () => {
    const { user, fetcher } = setup([
      () => reply(recovery),
      () => Promise.reject(new Error('Connection lost')),
      () => reply(recovery),
    ]);
    await user.click(
      screen.getByRole('button', { name: 'Preview refund and reversals' }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Retry approved refund' }),
    );
    expect(await within(dialog).findByText('Connection lost')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
    await user.click(
      within(dialog).getByRole('button', { name: 'Refresh refund plan' }),
    );
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(
      fetcher.mock.calls.filter(([url]) => url.pathname.endsWith('/refund')),
    ).toHaveLength(1);
  });

  it('keeps reconciliation visible and rereads the owner checkpoint without a second write', async () => {
    const { user, fetcher } = setup([
      () => reply(recovery),
      () =>
        reply({ status: 'RECONCILIATION_REQUIRED', message: 'Inspection incomplete' }),
      () => reply(recovery),
    ]);
    await user.click(
      screen.getByRole('button', { name: 'Preview refund and reversals' }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Retry approved refund' }),
    );
    expect(
      await within(dialog).findByText('Inspection incomplete'),
    ).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(
      fetcher.mock.calls.filter(([url]) => url.pathname.endsWith('/refund')),
    ).toHaveLength(1);
    expect(
      within(dialog).getByRole('button', { name: 'Retry approved refund' }),
    ).toBeEnabled();
  });

  it('closes a completed approval even if refreshing its parent queue fails', async () => {
    const { user, fetcher } = setup(
      [() => reply(recovery), () => reply({ status: 'COMPLETED' })],
      vi.fn(() => Promise.reject(new Error('Queue unavailable'))),
    );
    await user.click(
      screen.getByRole('button', { name: 'Preview refund and reversals' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Retry approved refund' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Queue unavailable')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not offer approval for an ineligible case', async () => {
    const { user, fetcher } = setup([
      () => reply({ eligible: false, reason: 'REFUND_APPROVED_UNDER_ANOTHER_CASE' }),
    ]);
    await user.click(
      screen.getByRole('button', { name: 'Preview refund and reversals' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('REFUND_APPROVED_UNDER_ANOTHER_CASE'),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: /Approve|Retry/ }),
    ).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('does not open approval after owner denial', async () => {
    const { user, fetcher } = setup([
      () =>
        Promise.resolve(
          new Response(JSON.stringify({ message: 'Access denied' }), { status: 403 }),
        ),
    ]);
    await user.click(
      screen.getByRole('button', { name: 'Preview refund and reversals' }),
    );
    expect(await screen.findByText('Access denied')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('fails closed without a discovered owner and sends no request', async () => {
    const { user, fetcher } = setup([], undefined, { moduleConnections: {} } as never);
    await user.click(
      screen.getByRole('button', { name: 'Preview refund and reversals' }),
    );
    expect(
      await screen.findByText(
        'The owning service is unavailable in the current BackOffice catalogue.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('disables approval and refresh while the original write is pending', async () => {
    let complete: ((response: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      complete = resolve;
    });
    const { user, fetcher } = setup([() => reply(recovery), () => pending]);
    await user.click(
      screen.getByRole('button', { name: 'Preview refund and reversals' }),
    );
    const dialog = await screen.findByRole('dialog');
    const approve = within(dialog).getByRole('button', {
      name: 'Retry approved refund',
    });
    await user.click(approve);
    expect(approve).toBeDisabled();
    expect(
      within(dialog).getByRole('button', { name: 'Refresh refund plan' }),
    ).toBeDisabled();
    fireEvent.click(approve);
    expect(fetcher).toHaveBeenCalledTimes(2);
    complete?.(await reply({ status: 'COMPLETED' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
