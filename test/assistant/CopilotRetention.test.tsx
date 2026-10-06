/** @file Retention scope, original-operation recovery and explicit no-retry command coverage. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { CopilotRetentionPanel } from '../../src/assistant/CopilotRetentionPanel';
import {
  parseRetentionCapability,
  parseRetentionReceipt,
  parseRetentionReview,
  retentionCommand,
  retentionTextKeys,
} from '../../src/assistant/api/copilotRetentionClient';

const configuration = {
  accessToken: 'token',
  enterpriseCode: 'acme',
  moduleBaseUrl: 'http://localhost:4300/copilotApi',
  timeoutMs: 1000,
};
const capability = parseRetentionCapability({
  canDelete: true,
  presentation: Object.fromEntries(retentionTextKeys.map((key) => [key, key])),
})!;
const scope = {
  contractVersion: 1,
  context: { enterpriseCode: 'acme', tenantCode: 'tenant' },
  conversationCode: 'conversation-one',
};
const review = {
  ...scope,
  state: 'REVIEWED',
  reviewDigest: 'a'.repeat(64),
  policyRevision: 'b'.repeat(64),
  maximumBatch: 25,
  retained: [
    'CONVERSATION_TOMBSTONE',
    'TRANSCRIPT_ACCESS_AUDIT',
    'ACTION_AUDIT',
    'PROVIDER_ACCOUNTING',
  ],
};
const receipt = {
  ...scope,
  operationCode: 'retention-12345678-1234-1234-1234-123456789012',
  revision: 1,
  state: 'PREPARED',
  removed: { messages: 0, events: 0, turns: 0 },
  completedAt: null,
};
/** Wraps owner responses without a live API. */
function response(data: unknown) {
  return new Response(JSON.stringify({ code: 'SUC_TEST', data }));
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('rejects foreign, malformed and contradictory evidence and strips private fields', () => {
  expect(() => parseRetentionReview(review, 'foreign', 'conversation-one')).toThrow();
  expect(() =>
    parseRetentionReview({ ...review, maximumBatch: 101 }, 'acme', 'conversation-one'),
  ).toThrow();
  expect(() =>
    parseRetentionReceipt(
      { ...receipt, removed: { messages: -1 } },
      'acme',
      'conversation-one',
    ),
  ).toThrow();
  expect(() =>
    parseRetentionReceipt({ ...receipt, state: 'PURGED' }, 'acme', 'conversation-one'),
  ).toThrow();
  expect(() => parseRetentionReceipt(receipt, 'acme', 'other')).toThrow();
  expect(
    JSON.stringify(
      parseRetentionReceipt(
        { ...receipt, privateReason: 'secret' },
        'acme',
        'conversation-one',
      ),
    ),
  ).not.toContain('secret');
});

it('requires review and confirmation and recovers a lost begin response without replay', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(response(review))
    .mockRejectedValueOnce(Error('lost response'))
    .mockResolvedValueOnce(response(receipt))
    .mockResolvedValueOnce(
      response({
        ...receipt,
        revision: 2,
        state: 'PURGING',
        removed: { messages: 25, events: 0, turns: 0 },
      }),
    );
  vi.stubGlobal('fetch', fetcher);
  render(
    <CopilotRetentionPanel
      configuration={configuration}
      conversationCode="conversation-one"
      capability={capability}
    />,
  );
  expect(fetcher).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText('reason'), 'Approved policy');
  await userEvent.click(screen.getByRole('button', { name: 'review' }));
  expect(await screen.findByRole('button', { name: 'begin' })).toBeDisabled();
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'begin' }));
  await screen.findByText('failure');
  expect(screen.queryByRole('button', { name: 'begin' })).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(2);
  await userEvent.click(screen.getByRole('button', { name: 'inspect' }));
  await screen.findByText('PREPARED');
  expect(JSON.parse(fetcher.mock.calls[2]![1]!.body as string)).toEqual({});
  expect(screen.getByRole('button', { name: 'advance' })).toBeDisabled();
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'advance' }));
  await screen.findByText('PURGING');
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(JSON.parse(fetcher.mock.calls[3]![1]!.body as string)).toEqual({
    operationCode: receipt.operationCode,
    expectedRevision: 1,
  });
  expect(screen.getByRole('button', { name: 'advance' })).toBeDisabled();
});

it('preserves recovery when deletion is disabled and stops rather than restarting work', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(response(receipt))
    .mockResolvedValueOnce(
      response({
        ...receipt,
        revision: 2,
        state: 'STOPPED',
        completedAt: '2026-10-03T00:00:00Z',
      }),
    );
  vi.stubGlobal('fetch', fetcher);
  render(
    <CopilotRetentionPanel
      configuration={configuration}
      conversationCode="conversation-one"
      capability={{ ...capability, canDelete: false }}
      canClose
    />,
  );
  expect(screen.queryByRole('button', { name: 'review' })).toBeNull();
  expect(screen.getByRole('button', { name: 'reviewClosure' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'inspect' }));
  await screen.findByText('PREPARED');
  expect(screen.queryByRole('button', { name: 'advance' })).toBeNull();
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'stop' }));
  await screen.findByText('STOPPED');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('rejects offline commands without creating a queued fetch', async () => {
  const fetcher = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetcher);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await expect(
    retentionCommand(
      configuration,
      'conversation-one',
      'inspect',
      {},
      new AbortController().signal,
    ),
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});

it('reviews stopped progress before explicitly resuming the same operation and locks after lost acknowledgement', async () => {
  const stopped = {
    ...receipt,
    revision: 4,
    state: 'STOPPED',
    completedAt: '2026-10-03T00:00:00Z',
    removed: { messages: 25, events: 0, turns: 0 },
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(response(stopped))
    .mockResolvedValueOnce(response(review))
    .mockRejectedValueOnce(Error('lost response'))
    .mockResolvedValueOnce(
      response({ ...stopped, state: 'RESUMING', revision: 5, completedAt: null }),
    );
  vi.stubGlobal('fetch', fetcher);
  render(
    <CopilotRetentionPanel
      configuration={configuration}
      conversationCode="conversation-one"
      capability={capability}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'inspect' }));
  await screen.findByText('STOPPED');
  expect(screen.queryByRole('button', { name: 'advance' })).toBeNull();
  await userEvent.type(screen.getByLabelText('reason'), 'Fresh review');
  await userEvent.click(screen.getByRole('button', { name: 'reviewResume' }));
  expect(await screen.findByRole('button', { name: 'resume' })).toBeDisabled();
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'resume' }));
  await screen.findByText('failure');
  expect(screen.queryByRole('button', { name: 'resume' })).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(JSON.parse(fetcher.mock.calls[2]![1]!.body as string)).toEqual({
    reason: 'Fresh review',
    operationCode: receipt.operationCode,
    expectedRevision: 4,
    confirmed: true,
    reviewDigest: review.reviewDigest,
  });
  await userEvent.click(screen.getByRole('button', { name: 'inspect' }));
  await screen.findByText('RESUMING');
  expect(screen.getByRole('button', { name: 'advance' })).toBeDisabled();
  expect(fetcher).toHaveBeenCalledTimes(4);
});

it('failed reinspection locks old receipts until a fresh successful read', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(response(receipt))
    .mockRejectedValueOnce(Error('denied'));
  vi.stubGlobal('fetch', fetcher);
  render(
    <CopilotRetentionPanel
      configuration={configuration}
      conversationCode="conversation-one"
      capability={capability}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'inspect' }));
  await screen.findByText('PREPARED');
  await userEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button', { name: 'advance' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: 'inspect' }));
  await screen.findByText('failure');
  expect(screen.getByRole('button', { name: 'advance' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'stop' })).toBeDisabled();
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('closes only after explicit review and recovers closure uncertainty without unlocking purge from unrelated evidence', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      response({
        ...scope,
        state: 'REVIEWED',
        intent: 'CLOSE',
        reviewDigest: 'c'.repeat(64),
      }),
    )
    .mockRejectedValueOnce(Error('lost response'))
    .mockResolvedValueOnce(
      response({
        ...scope,
        state: 'CLOSURE_RECORDED',
        operationCode: 'closure-12345678-1234-1234-1234-123456789012',
        closedAt: '2026-10-03T00:00:00Z',
        conversationState: 'CLOSED',
      }),
    );
  vi.stubGlobal('fetch', fetcher);
  render(
    <CopilotRetentionPanel
      configuration={configuration}
      conversationCode="conversation-one"
      capability={{ ...capability, canDelete: false }}
      canClose
    />,
  );
  await userEvent.type(screen.getByLabelText('reason'), 'Finished conversation');
  await userEvent.click(screen.getByRole('button', { name: 'reviewClosure' }));
  expect(
    await screen.findByRole('button', { name: 'closeConversation' }),
  ).toBeDisabled();
  await screen.findByText('closureNotice');
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'closeConversation' }));
  await screen.findByText('failure');
  expect(screen.getByRole('button', { name: 'inspect' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'inspectClosure' }));
  await screen.findByText(/closureRecorded/);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(screen.queryByRole('button', { name: 'closeConversation' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'advance' })).toBeNull();
});
