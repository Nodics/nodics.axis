/** @file Historical usage, page binding and unresolved queue boundary tests. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { CopilotUsageView } from '../../src/assistant/CopilotUsageView';
import {
  createCopilotUsageClient,
  parseCopilotUsage,
} from '../../src/assistant/api/copilotUsageClient';
import { usageHistoryFixture } from './copilotReconciliationFixture';

it('renders a bounded history selector and comparison; selection resets page', async () => {
  const onQuery = vi.fn();
  render(
    <CopilotUsageView
      usage={parseCopilotUsage(usageHistoryFixture())}
      query={{ scope: 'PERSONAL', model: '', purpose: '', principalCode: '', page: 2 }}
      onQuery={onQuery}
      onRefresh={vi.fn()}
    />,
  );
  expect(screen.getByRole('heading', { name: 'Period comparison' })).toBeVisible();
  await userEvent.click(screen.getByRole('combobox', { name: 'Accounting period' }));
  const options = screen.getAllByRole('option');
  await userEvent.click(options[1]!);
  expect(onQuery).toHaveBeenCalledWith(
    expect.objectContaining({ periodOffset: 1, page: 0 }),
  );
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
});

it('distinguishes absent history from measured zero and rejects invalid calendars and pages', () => {
  const base = usageHistoryFixture();
  const noPrior = parseCopilotUsage({
    ...base,
    history: { ...base.history, previous: { ...base.history.previous, totals: null } },
  });
  expect(noPrior.history!.previous.totals).toBeNull();
  expect(() =>
    parseCopilotUsage({ ...base, history: { ...base.history, offset: 99 } }),
  ).toThrow();
  expect(() =>
    parseCopilotUsage({
      ...base,
      history: { ...base.history, periods: [base.period, base.period] },
    }),
  ).toThrow();
  expect(() =>
    parseCopilotUsage({ ...base, history: { ...base.history, recorded: false } }),
  ).toThrow();
  expect(() =>
    parseCopilotUsage({
      ...base,
      pagination: { page: 200, pageSize: 25, calls: 'UNRESOLVED' },
    }),
  ).toThrow();
  expect(() =>
    parseCopilotUsage({
      ...base,
      queue: [{ callId: 'hidden', evidence: 'AVAILABLE' }],
    }),
  ).toThrow();
});

it('does not render an absent selected period as measured zero', () => {
  const base = usageHistoryFixture();
  const empty = { hasMore: false, items: [] };
  const usage = parseCopilotUsage({
    ...base,
    items: [],
    totals: { consumed: 0, reserved: 0, pending: 0, calls: 0 },
    insights: {
      daily: [],
      breakdowns: { model: empty, purpose: empty, principalCode: empty },
    },
    history: { ...base.history, recorded: false },
  });
  render(
    <CopilotUsageView
      usage={usage}
      query={{ scope: 'PERSONAL', principalCode: '', purpose: '', model: '' }}
      onQuery={vi.fn()}
      onRefresh={vi.fn()}
    />,
  );
  expect(screen.getByText(usage.presentation.noRecordedUsage)).toBeVisible();
  expect(screen.getByText('- / 8,000')).toBeVisible();
  expect(
    screen
      .getAllByRole('definition')
      .slice(0, 4)
      .map((row) => row.textContent),
  ).toEqual(['-', '-', '-', '-']);
});

it('binds the selected period, queue and page to the exact response', async () => {
  const base = usageHistoryFixture();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ code: 'SUC_TEST', data: base }))),
    );
  const client = createCopilotUsageClient(
    {
      enterpriseCode: 'enterprise',
      accessToken: 'token',
      moduleBaseUrl: 'http://localhost:4300/copilotApi',
      timeoutMs: 1000,
    },
    fetcher,
  );
  const query = {
    scope: 'PERSONAL' as const,
    principalCode: '',
    purpose: '',
    model: '',
  };
  for (const extra of [
    { periodOffset: 1 },
    { page: 1 },
    { calls: 'UNRESOLVED' as const },
  ])
    await expect(client.get({ ...query, ...extra })).rejects.toThrow(
      'Usage context mismatch',
    );
  await expect(client.get(query)).resolves.toHaveProperty('history.offset', 0);
});
