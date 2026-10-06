/** @file Validates accounting, context selection and permission-specific dashboard rendering. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { parseCopilotUsage } from '../../src/assistant/api/copilotUsageClient';
import { parseCopilotWorkspace } from '../../src/assistant/api/copilotWorkspaceClient';
import { parseCopilotContext } from '../../src/assistant/api/copilotContextClient';
import { CopilotWorkspaceView } from '../../src/assistant/CopilotWorkspaceView';
import { CopilotUsageView } from '../../src/assistant/CopilotUsageView';
import { CopilotContextView } from '../../src/assistant/CopilotContextView';
import {
  budgetWorkspaceFixture,
  contextFixture,
  usageFixture,
} from './governanceFixture';

it('renders measured allowance, pending reservations and explicit reset timezone', () => {
  render(
    <CopilotWorkspaceView
      snapshot={parseCopilotWorkspace(budgetWorkspaceFixture())}
      refreshing={false}
      onRefresh={vi.fn()}
      onDetails={vi.fn()}
    />,
  );
  expect(screen.getByText('100,000')).toBeVisible();
  expect(screen.getByText('40,000')).toBeVisible();
  expect(screen.getByText('Pending reconciliation')).toBeVisible();
  expect(screen.getByRole('progressbar', { name: 'Token allowance' })).toHaveAttribute(
    'aria-valuenow',
    '50',
  );
  expect(screen.getByText(/Asia\/Dubai/)).toBeVisible();
});
it('rejects invented balances, foreign personal rows and unsafe accounting shapes', () => {
  const base = budgetWorkspaceFixture();
  expect(() =>
    parseCopilotWorkspace({ ...base, budget: { ...base.budget, available: 90000 } }),
  ).toThrow();
  expect(() =>
    parseCopilotWorkspace({
      ...base,
      budget: { ...base.budget, state: 'UNAVAILABLE' },
    }),
  ).toThrow();
  const raw = usageFixture();
  expect(() =>
    parseCopilotUsage({
      ...raw,
      items: [{ ...raw.items[0], principalCode: 'foreign' }],
    }),
  ).toThrow();
  expect(() =>
    parseCopilotUsage({ ...raw, scope: 'ENTERPRISE', canViewEnterprise: false }),
  ).toThrow();
  expect(() =>
    parseCopilotUsage({ ...raw, items: Array(101).fill(raw.items[0]) }),
  ).toThrow();
  expect(parseCopilotUsage({ ...raw, secretRef: 'secret' })).not.toHaveProperty(
    'secretRef',
  );
});
it('switches enterprise view only when granted and preserves explicit filter submission', async () => {
  const onQuery = vi.fn();
  render(
    <CopilotUsageView
      usage={parseCopilotUsage(usageFixture())}
      query={{ scope: 'PERSONAL', principalCode: '', model: '', purpose: '' }}
      onQuery={onQuery}
      onRefresh={vi.fn()}
    />,
  );
  await userEvent.type(screen.getByRole('textbox', { name: 'Model' }), 'qwen');
  expect(onQuery).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(onQuery).toHaveBeenCalledWith(expect.objectContaining({ model: 'qwen' }));
  await userEvent.click(screen.getByRole('tab', { name: 'Enterprise' }));
  expect(onQuery).toHaveBeenLastCalledWith(
    expect.objectContaining({ scope: 'ENTERPRISE', principalCode: '' }),
  );
});
it('ordinary users have no enterprise usage tab', () => {
  render(
    <CopilotUsageView
      usage={parseCopilotUsage({ ...usageFixture(), canViewEnterprise: false })}
      query={{ scope: 'PERSONAL', principalCode: '', model: '', purpose: '' }}
      onQuery={vi.fn()}
      onRefresh={vi.fn()}
    />,
  );
  expect(screen.queryByRole('tab', { name: 'Enterprise' })).toBeNull();
});
it('knowledge context offers only backend choices and supports explicit narrowing', async () => {
  const onChange = vi.fn();
  render(
    <CopilotContextView
      context={parseCopilotContext(contextFixture())}
      selected={undefined}
      disabled={false}
      onChange={onChange}
    />,
  );
  await userEvent.click(screen.getByRole('combobox', { name: 'Knowledge context' }));
  await userEvent.click(screen.getByRole('option', { name: 'Project guides' }));
  expect(onChange).toHaveBeenCalledWith(['framework']);
  expect(() =>
    parseCopilotContext({
      ...contextFixture(),
      groups: {
        enabled: true,
        items: [
          { code: 'same', name: 'One' },
          { code: 'same', name: 'Two' },
        ],
      },
    }),
  ).toThrow();
});
