import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { WorkbenchFieldRenderer } from '../../../src/workbench/form/WorkbenchFieldRenderer';
import type { WorkbenchField } from '../../../src/workbench/api/workbenchContracts';

const field: WorkbenchField = {
  name: 'value',
  label: 'Value',
  type: 'object',
  required: false,
  readOnly: false,
  primary: false,
  searchable: false,
  description: '',
};

it('blocks invalid structured values without replacing the last valid value', async () => {
  const user = userEvent.setup();
  const change = vi.fn();
  const valid = vi.fn();
  render(
    <WorkbenchFieldRenderer
      field={field}
      value={{ amount: 2 }}
      onChange={change}
      onValidityChange={valid}
    />,
  );
  await user.clear(screen.getByRole('textbox', { name: 'Value' }));
  change.mockClear();
  await user.type(screen.getByRole('textbox', { name: 'Value' }), 'invalid');
  expect(valid).toHaveBeenLastCalledWith(false);
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByText('Enter a valid structured value.')).toBeVisible();
});

it('keeps existing numeric arrays structured instead of converting values to strings', () => {
  render(
    <WorkbenchFieldRenderer
      field={{ ...field, type: 'array' }}
      value={[1, 2]}
      onChange={vi.fn()}
    />,
  );
  expect(screen.getByRole('textbox', { name: 'Value' })).toHaveValue('[\n  1,\n  2\n]');
});

it('commits a whole array entry on blur without splitting its comma', async () => {
  const user = userEvent.setup();
  const change = vi.fn();
  function Editor() {
    const [value, setValue] = useState<unknown>([]);
    return (
      <WorkbenchFieldRenderer
        field={{ ...field, type: 'array' }}
        value={value}
        onChange={(next) => {
          change(next);
          setValue(next);
        }}
      />
    );
  }
  render(<Editor />);
  await user.type(screen.getByRole('combobox', { name: 'Value' }), 'Dubai, UAE');
  await user.tab();
  expect(change).toHaveBeenLastCalledWith(['Dubai, UAE']);
});
