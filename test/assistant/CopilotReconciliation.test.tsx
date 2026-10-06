/** @file Usage insights and evidence-only recovery contract, interaction and no-retry tests. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { createAxisQueryClient } from '../../src/app/axisQueryClient';
import { CopilotUsageCallView } from '../../src/assistant/CopilotUsageCallPanel';
import { CopilotUsageView } from '../../src/assistant/CopilotUsageView';
import {
  parseCopilotUsage,
  parseUsageInsights,
} from '../../src/assistant/api/copilotUsageClient';
import {
  parseUsageCall,
  createReconciliationClient,
  type ReconciliationCommand,
} from '../../src/assistant/api/copilotReconciliationClient';
import { usageCallFixture, usageInsightsFixture } from './copilotReconciliationFixture';
afterEach(() => onlineManager.setOnline(true));
/** Mounts the recovery workflow under Axis's production mutation policy. */
function mount(options: { fail?: boolean; denied?: boolean } = {}) {
  const detail = parseUsageCall(usageCallFixture());
  if (options.denied) {
    detail.canReconcile = false;
    detail.evidence = null;
  }
  const onPreview = vi.fn((command: ReconciliationCommand) =>
    Promise.resolve({ command, reserved: 600, measured: 420 }),
  );
  const onReconcile = vi.fn<(command: ReconciliationCommand) => Promise<void>>(() =>
    options.fail
      ? Promise.reject(new Error('lost acknowledgement'))
      : Promise.resolve(),
  );
  const onRefresh = vi.fn();
  render(
    <QueryClientProvider client={createAxisQueryClient()}>
      <CopilotUsageCallView
        detail={detail}
        onPreview={onPreview}
        onReconcile={onReconcile}
        onClose={vi.fn()}
        onRefresh={onRefresh}
      />
    </QueryClientProvider>,
  );
  return { onPreview, onReconcile, onRefresh };
}
it('requires a reason, read-only preview and explicit confirmation using only evidence identity', async () => {
  const f = mount();
  expect(screen.getByRole('button', { name: 'Review reconciliation' })).toBeDisabled();
  expect(screen.queryByRole('spinbutton')).toBeNull();
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Reason for reconciliation' }),
    'Recover measured call',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Review reconciliation' }));
  await screen.findByText('Apply recorded provider counts without repeating the call.');
  expect(f.onReconcile).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Confirm reconciliation' }));
  await waitFor(() => expect(f.onReconcile).toHaveBeenCalledOnce());
  expect(f.onReconcile.mock.calls[0]![0]).toEqual(f.onPreview.mock.calls[0]![0]);
  expect(f.onReconcile.mock.calls[0]![0]).not.toHaveProperty('totalTokens');
});
it('never enables recovery without evidence or backend permission', () => {
  mount({ denied: true });
  expect(
    screen.getByText('No verified measurement. Reservation remains held.'),
  ).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Review reconciliation' })).toBeNull();
});
it('uncertain writes cannot auto-retry and require refresh', async () => {
  const f = mount({ fail: true });
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Reason for reconciliation' }),
    'Recover call',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Review reconciliation' }));
  await userEvent.click(
    await screen.findByRole('button', { name: 'Confirm reconciliation' }),
  );
  await screen.findByText('Outcome uncertain. Refresh the call before another action.');
  expect(screen.queryByRole('button', { name: 'Confirm reconciliation' })).toBeNull();
  expect(f.onReconcile).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole('button', { name: 'Refresh call' }));
  expect(f.onRefresh).toHaveBeenCalledOnce();
});
it('does not queue reconciliation review offline', async () => {
  const f = mount();
  onlineManager.setOnline(false);
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Reason for reconciliation' }),
    'Recover call',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Review reconciliation' }));
  await screen.findByText('Review unavailable. Refresh the call.');
  onlineManager.setOnline(true);
  expect(f.onPreview).not.toHaveBeenCalled();
});
it('renders daily aggregates and drills a model breakdown into server-owned filters', async () => {
  const onQuery = vi.fn(),
    onCall = vi.fn();
  render(
    <CopilotUsageView
      usage={parseCopilotUsage(usageInsightsFixture())}
      query={{ scope: 'PERSONAL', model: '', principalCode: '', purpose: '' }}
      onQuery={onQuery}
      onRefresh={vi.fn()}
      onCall={onCall}
    />,
  );
  expect(screen.getByRole('heading', { name: 'Daily usage' })).toBeVisible();
  await userEvent.click(
    screen.getByRole('button', { name: 'Apply filters: qwen2.5-coder:7b' }),
  );
  expect(onQuery).toHaveBeenCalledWith(
    expect.objectContaining({ model: 'qwen2.5-coder:7b' }),
  );
  await userEvent.click(screen.getAllByRole('button', { name: 'Call details' })[1]!);
  expect(onCall).toHaveBeenCalledWith('call-2');
});
it('rejects malformed measurements, oversized or duplicate analytics and foreign call responses', async () => {
  const call = usageCallFixture(),
    insights = usageInsightsFixture().insights;
  expect(() => parseUsageCall({ ...call, evidence: null })).toThrow();
  expect(() =>
    parseUsageCall({ ...call, item: { ...call.item, consumed: 0 } }),
  ).toThrow();
  expect(() =>
    parseUsageInsights({ ...insights, daily: Array(32).fill(insights.daily[0]) }),
  ).toThrow();
  expect(() =>
    parseUsageInsights({ ...insights, daily: [...insights.daily, ...insights.daily] }),
  ).toThrow();
  expect(() =>
    parseCopilotUsage({
      ...usageInsightsFixture(),
      insights: {
        ...insights,
        breakdowns: {
          ...insights.breakdowns,
          principalCode: {
            hasMore: false,
            items: [
              { ...insights.breakdowns.principalCode.items[0], value: 'foreign' },
            ],
          },
        },
      },
    }),
  ).toThrow('Invalid scoped insights');
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ code: 'SUC_TEST', data: call })));
  const client = createReconciliationClient(
    {
      accessToken: 'token',
      enterpriseCode: 'foreign',
      moduleBaseUrl: 'http://localhost:4300/copilotApi',
      timeoutMs: 1000,
    },
    fetcher,
  );
  await expect(client.get(call.periodKey, 'call-2')).rejects.toThrow(
    'Call context mismatch',
  );
});

it('requires matching audit acknowledgement and never accepts unrelated success as reconciliation', async () => {
  const call = usageCallFixture();
  const command: ReconciliationCommand = {
    periodKey: call.periodKey,
    callId: 'call-2',
    evidenceDigest: 'a'.repeat(64),
    changeId: 'change',
    reason: 'Recover call',
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ code: 'SUC_TEST', data: call })));
  const client = createReconciliationClient(
    {
      accessToken: 'token',
      enterpriseCode: 'enterprise',
      moduleBaseUrl: 'http://localhost:4300/copilotApi',
      timeoutMs: 1000,
    },
    fetcher,
  );
  await expect(client.reconcile(command)).rejects.toThrow(
    'Reconciliation acknowledgement mismatch',
  );
  expect(fetcher).toHaveBeenCalledOnce();
  expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string)).toEqual({
    ...command,
    confirmed: true,
  });
});
