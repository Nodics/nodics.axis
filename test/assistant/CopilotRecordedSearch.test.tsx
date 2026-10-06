/** @file Recorded search transport, sensitive-data minimization and explicit user-command coverage. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { CopilotRecordedSearchDialog } from '../../src/assistant/CopilotRecordedSearchDialog';
import {
  parseRecordedSearch,
  parseRecordedSearchCapability,
} from '../../src/assistant/api/copilotRecordedSearchClient';
import type { TranscriptInspection } from '../../src/assistant/api/copilotTranscriptClient';

const configuration = {
  accessToken: 'token',
  enterpriseCode: 'enterprise',
  moduleBaseUrl: 'http://localhost:4300/copilotApi',
  timeoutMs: 1000,
};
const capability = parseRecordedSearchCapability({
  maximumWindowDays: 31,
  minimumTermLength: 3,
  presentation: {
    title: 'Search recorded content',
    term: 'Exact text',
    from: 'Recorded from',
    to: 'Recorded until',
    purpose: 'Search purpose',
    search: 'Search',
    close: 'Close',
    empty: 'No matching messages',
    coverage: 'Only recorded enterprise messages',
    failure: 'Search unavailable',
    audit: 'Access receipt',
    previous: 'Previous page',
    next: 'Next page',
    page: 'Page',
  },
})!;
const inspection = {
  purposes: [{ code: 'QUALITY_REVIEW', label: 'Quality review' }],
  presentation: { user: 'Employee', assistant: 'Copilot' },
} as TranscriptInspection;
const command = {
  term: 'coupon',
  from: '2026-10-01T00:00:00.000Z',
  to: '2026-10-03T00:00:00.000Z',
  purpose: 'QUALITY_REVIEW',
  page: 1,
};
const page = {
  contractVersion: 1,
  context: { tenantCode: 'tenant', enterpriseCode: 'enterprise' },
  page: 1,
  limit: 25,
  mayHaveMore: false,
  accessReceipt: 'receipt-one',
  from: command.from,
  to: command.to,
  matching: 'CASE_SENSITIVE_LITERAL',
  coverage: 'ENTERPRISE_BOUND_RECORDED_MESSAGES_ONLY',
  items: [
    {
      messageCode: 'message-one',
      conversationCode: 'conversation-one',
      principalCode: 'employee',
      role: 'user',
      createdAt: '2026-10-02T00:00:00.000Z',
      excerpt: 'The coupon was rejected <script>inert</script>',
    },
  ],
};
afterEach(() => vi.unstubAllGlobals());

it('rejects mismatched scope, windows, duplicate hits and injected extra properties', () => {
  expect(() => parseRecordedSearch(page, 'other', command)).toThrow();
  expect(() =>
    parseRecordedSearch({ ...page, from: 'other' }, 'enterprise', command),
  ).toThrow();
  expect(() =>
    parseRecordedSearch(
      { ...page, items: [page.items[0], page.items[0]] },
      'enterprise',
      command,
    ),
  ).toThrow();
  expect(
    JSON.stringify(
      parseRecordedSearch(
        { ...page, items: [{ ...page.items[0], toolArguments: 'secret' }] },
        'enterprise',
        command,
      ),
    ),
  ).not.toContain('secret');
});

it('requires a purpose and window, sends one audited POST and renders excerpts as plain text', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
    if (typeof init?.body !== 'string') throw new Error('Expected JSON body');
    const body = JSON.parse(init.body) as { from: string; to: string };
    return Promise.resolve(
      new Response(
        JSON.stringify({
          code: 'SUC_TEST',
          data: { ...page, from: body.from, to: body.to },
        }),
      ),
    );
  });
  vi.stubGlobal('fetch', fetcher);
  const view = render(
    <CopilotRecordedSearchDialog
      configuration={configuration}
      capability={capability}
      inspection={inspection}
      onClose={vi.fn()}
    />,
  );
  expect(fetcher).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
  await userEvent.type(screen.getByRole('textbox', { name: 'Exact text' }), 'coupon');
  fireEvent.change(screen.getByLabelText('Recorded from'), {
    target: { value: '2026-10-01T00:00' },
  });
  fireEvent.change(screen.getByLabelText('Recorded until'), {
    target: { value: '2026-10-03T00:00' },
  });
  await userEvent.click(screen.getByRole('combobox', { name: 'Search purpose' }));
  await userEvent.click(screen.getByRole('option', { name: 'Quality review' }));
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByText(page.items[0]!.excerpt);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0]?.[1]?.method).toBe('POST');
  expect(fetcher.mock.calls[0]?.[0]).not.toContain('coupon');
  expect(view.container.querySelector('script')).toBeNull();
  await userEvent.type(screen.getByRole('textbox', { name: 'Exact text' }), 'x');
  expect(screen.queryByText(page.items[0]!.excerpt)).toBeNull();
});

it('offline search sends nothing and never queues an automatic retry', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('navigator', { onLine: false });
  const { searchRecordedContent } =
    await import('../../src/assistant/api/copilotRecordedSearchClient');
  await expect(
    searchRecordedContent(configuration, command, new AbortController().signal),
  ).rejects.toThrow('Offline');
  await waitFor(() => expect(fetcher).not.toHaveBeenCalled());
});
