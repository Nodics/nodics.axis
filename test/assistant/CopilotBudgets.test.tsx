/** @file Allocation confirmation, role visibility, offline admission and strict boundary tests. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { createAxisQueryClient } from '../../src/app/axisQueryClient';
import { CopilotBudgetView } from '../../src/assistant/CopilotBudgetPanel';
import {
  parseCopilotBudgets,
  createCopilotBudgetClient,
  type BudgetCommand,
} from '../../src/assistant/api/copilotBudgetClient';
import { allocationFixture, allocationViewFixture } from './copilotBudgetFixture';

afterEach(() => onlineManager.setOnline(true));
/** Mounts against the production no-queue mutation policy. */
function mount(options: { fail?: boolean; readOnly?: boolean } = {}) {
  const snapshot = allocationViewFixture();
  if (options.readOnly) snapshot.permissions = { enterprise: false, users: false };
  const onPreview = vi.fn((command: BudgetCommand) =>
    Promise.resolve({
      command,
      impact: {
        before: 50000,
        after: command.limit,
        committed: 4600,
        belowCommitted: command.limit < 4600,
      },
    }),
  );
  const onChange = vi.fn<(command: BudgetCommand) => Promise<void>>(() =>
    options.fail
      ? Promise.reject(new Error('lost acknowledgement'))
      : Promise.resolve(),
  );
  const onRefresh = vi.fn();
  render(
    <QueryClientProvider client={createAxisQueryClient()}>
      <CopilotBudgetView
        snapshot={snapshot}
        onPreview={onPreview}
        onChange={onChange}
        onRefresh={onRefresh}
        onBack={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return { onPreview, onChange, onRefresh };
}
/** Enters an allocation request without confirming it. */
async function draft() {
  await userEvent.click(
    screen.getByRole('button', { name: 'Edit allocation: employee' }),
  );
  await userEvent.clear(screen.getByRole('spinbutton', { name: 'Token limit' }));
  await userEvent.type(screen.getByRole('spinbutton', { name: 'Token limit' }), '3000');
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Reason' }),
    'Monthly adjustment',
  );
}
it('requires review before mutation and warns when commitments exceed the new limit', async () => {
  const f = mount();
  await draft();
  expect(f.onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Review change' }));
  await screen.findByText(
    'Usage exceeds the new limit. Further calls will be blocked.',
  );
  expect(f.onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Confirm allocation' }));
  await waitFor(() => expect(f.onChange).toHaveBeenCalledTimes(1));
  expect(f.onChange.mock.calls[0]![0]).toEqual(f.onPreview.mock.calls[0]![0]);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
it('hides management controls from read-only administrators', () => {
  mount({ readOnly: true });
  expect(screen.queryByRole('button', { name: /Edit allocation:/ })).toBeNull();
});
it('blocks invalid forms and requires refresh after an uncertain write without retrying', async () => {
  const f = mount({ fail: true });
  await userEvent.click(
    screen.getByRole('button', { name: 'Edit allocation: employee' }),
  );
  expect(screen.getByRole('button', { name: 'Review change' })).toBeDisabled();
  await userEvent.type(screen.getByRole('textbox', { name: 'Reason' }), 'Adjustment');
  await userEvent.click(screen.getByRole('button', { name: 'Review change' }));
  await userEvent.click(
    await screen.findByRole('button', { name: 'Confirm allocation' }),
  );
  await screen.findByText(
    'The outcome is uncertain. Refresh allocations before another change.',
  );
  expect(f.onChange).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Confirm allocation' })).toBeNull();
  const refresh = screen
    .getAllByRole('button', { name: 'Refresh allocations' })
    .at(-1)!;
  await userEvent.click(refresh);
  expect(f.onRefresh).toHaveBeenCalledOnce();
});
it('does not queue commands while offline', async () => {
  const f = mount();
  await draft();
  onlineManager.setOnline(false);
  await userEvent.click(screen.getByRole('button', { name: 'Review change' }));
  await screen.findByText('Review unavailable. Refresh allocations and try again.');
  onlineManager.setOnline(true);
  expect(f.onPreview).not.toHaveBeenCalled();
  expect(f.onChange).not.toHaveBeenCalled();
});
it('rejects duplicate identities, excessive audits and foreign transport scopes', async () => {
  const fixture = allocationFixture();
  expect(() =>
    parseCopilotBudgets({ ...fixture, users: [...fixture.users, ...fixture.users] }),
  ).toThrow();
  expect(() =>
    parseCopilotBudgets({ ...fixture, changes: Array(51).fill({}) }),
  ).toThrow();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(JSON.stringify({ code: 'SUC_TEST', data: fixture })),
    );
  const client = createCopilotBudgetClient(
    {
      accessToken: 'token',
      enterpriseCode: 'foreign',
      moduleBaseUrl: 'http://localhost:4300/copilotApi',
      timeoutMs: 1000,
    },
    fetcher,
  );
  await expect(client.get()).rejects.toThrow('Budget context mismatch');
});

it('rejects altered previews and submits one confirmed command with its stable identity', async () => {
  const fixture = allocationFixture();
  const command: BudgetCommand = {
    target: 'USER',
    principalCode: 'employee',
    limit: 3000,
    reason: 'Adjustment',
    changeId: 'change-one',
    periodKey: fixture.period.key,
    policyDigest: fixture.policyDigest,
    expectedRevision: fixture.revision,
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'SUC_TEST',
          data: {
            contractVersion: 1,
            context: fixture.context,
            command: { ...command, limit: 9000 },
            impact: {
              before: 50000,
              after: 9000,
              committed: 4600,
              belowCommitted: false,
            },
          },
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'SUC_TEST',
          data: {
            ...fixture,
            revision: command.changeId,
            users: fixture.users.map((item) => ({ ...item, limit: command.limit })),
            changes: [
              {
                changeId: command.changeId,
                target: command.target,
                principalCode: command.principalCode,
                actor: 'employee',
                before: 50000,
                after: command.limit,
                reason: command.reason,
                createdAt: '2026-10-03T12:00:00Z',
              },
            ],
          },
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'SUC_TEST', data: fixture })),
    );
  const client = createCopilotBudgetClient(
    {
      accessToken: 'token',
      enterpriseCode: 'enterprise',
      moduleBaseUrl: 'http://localhost:4300/copilotApi',
      timeoutMs: 1000,
    },
    fetcher,
  );
  await expect(client.preview(command)).rejects.toThrow('Budget preview mismatch');
  await client.change(command);
  const options = fetcher.mock.calls[1]![1]!;
  expect(JSON.parse(options.body as string)).toEqual({ ...command, confirmed: true });
  expect(new Headers(options.headers).get('Idempotency-Key')).toBe(command.changeId);
  expect(new Headers(options.headers).get('x-enterprise-code')).toBe('enterprise');
  expect(fetcher).toHaveBeenCalledTimes(2);
  await expect(client.change(command)).rejects.toThrow(
    'Allocation acknowledgement mismatch',
  );
  expect(fetcher).toHaveBeenCalledTimes(3);
});
