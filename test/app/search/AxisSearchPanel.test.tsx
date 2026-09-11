import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AxisSearchPanel } from '../../../src/app/search/AxisSearchPanel';

function DraftField() {
  const [value, setValue] = useState('');
  return (
    <input
      aria-label="Draft condition"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}
it('preserves advanced slot drafts across folding and exposes its expanded state', async () => {
  const user = userEvent.setup();
  render(
    <AxisSearchPanel
      ownerModule="exampleOwner"
      search={{ value: '', label: 'Find items', onChange: vi.fn() }}
      clearLabel="Clear all"
      onClear={vi.fn()}
      advancedLabel="More filters"
      advanced={<DraftField />}
    />,
  );
  const toggle = screen.getByRole('button', { name: 'More filters' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(
    screen.queryByRole('textbox', { name: 'Draft condition' }),
  ).not.toBeInTheDocument();
  await user.click(toggle);
  await user.type(
    screen.getByRole('textbox', { name: 'Draft condition' }),
    'Unapplied draft',
  );
  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await user.click(toggle);
  expect(screen.getByRole('textbox', { name: 'Draft condition' })).toHaveValue(
    'Unapplied draft',
  );
  await user.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(screen.getByRole('textbox', { name: 'Draft condition' })).toHaveValue('');
});
it('retains fixed scope and delegates removable chips and clear to the caller', async () => {
  const remove = vi.fn(),
    clear = vi.fn();
  const user = userEvent.setup();
  const props = {
    ownerModule: 'owner',
    advancedLabel: 'Advanced search',
    advanced: <DraftField />,
    clearLabel: 'Reset search',
    onClear: clear,
    filters: [
      { id: 'scope', label: 'Family: Clothing' },
      { id: 'channel', label: 'Channel: Web', onRemove: remove },
    ],
  };
  const { rerender } = render(<AxisSearchPanel {...props} />);
  expect(
    screen.queryByRole('button', { name: 'Family: Clothing' }),
  ).not.toBeInTheDocument();
  screen.getByRole('button', { name: 'Channel: Web' }).focus();
  await user.keyboard('{Delete}');
  expect(remove).toHaveBeenCalledOnce();
  await user.click(screen.getByRole('button', { name: 'Reset search' }));
  expect(clear).toHaveBeenCalledOnce();
  rerender(<AxisSearchPanel {...props} disabled />);
  expect(screen.getByRole('button', { name: 'Reset search' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Advanced search' })).toBeDisabled();
  expect(
    screen.queryByRole('button', { name: 'Channel: Web' }),
  ).not.toBeInTheDocument();
});
