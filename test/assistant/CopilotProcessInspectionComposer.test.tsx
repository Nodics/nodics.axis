/** @file Process inspection parsing, family isolation, explicit submission and offline regressions. */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { CopilotInspectionComposer } from '../../src/assistant/CopilotInspectionComposer';
import {
  parseCopilotProcessInspection,
  parseCopilotRulesInspection,
} from '../../src/assistant/api/copilotInspectionContract';

/** Synthetic backend choices; this fixture is not native runtime admission evidence. */
function fixture() {
  return parseCopilotProcessInspection({
    operations: [
      {
        code: 'process.definition.list',
        label: 'Definitions',
        codes: ['definition-one'],
        requiresCode: false,
      },
      {
        code: 'process.instance.tasks',
        label: 'Instance tasks',
        codes: ['instance-one'],
      },
      {
        code: 'process.definition.versions',
        label: 'Definition versions',
        codes: ['definition-one'],
      },
    ],
    presentation: {
      title: 'Inspect Process',
      operation: 'Operation',
      code: 'Record',
      submit: 'Inspect',
      cancel: 'Cancel',
      failure: 'Process inspection could not be submitted.',
    },
  })!;
}

afterEach(() => vi.unstubAllGlobals());

it('rejects foreign families, mutation operations, duplicate codes and malformed copy', () => {
  const data = fixture();
  expect(() => parseCopilotRulesInspection(data)).toThrow();
  expect(
    parseCopilotProcessInspection({ operations: [], presentation: {} }),
  ).toBeUndefined();
  for (const operations of [
    [{ ...data.operations[0], code: 'process.task.complete' }],
    [{ ...data.operations[0], code: 'rules.definition.inspect' }],
    [{ ...data.operations[0], codes: ['../foreign'] }],
    [{ ...data.operations[0], codes: ['instance-one', 'instance-one'] }],
    [...data.operations, data.operations[0]],
  ])
    expect(() => parseCopilotProcessInspection({ ...data, operations })).toThrow();
  expect(() => parseCopilotProcessInspection({ ...data, presentation: {} })).toThrow();
});

it('submits a fixed list operation without inventing a record selector', async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(
    <CopilotInspectionComposer
      intent="copilot.process.inspect"
      contract={fixture()}
      disabled={false}
      onSubmit={submit}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Inspect Process' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Operation' }));
  await userEvent.click(screen.getByRole('option', { name: 'Definitions' }));
  expect(screen.queryByRole('combobox', { name: 'Record' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Inspect' }));
  expect(JSON.parse(submit.mock.calls[0]![0] as string)).toEqual({
    intent: 'copilot.process.inspect',
    operation: 'process.definition.list',
  });
});

it('submits exactly one typed Process command only after explicit selection', async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(
    <CopilotInspectionComposer
      intent="copilot.process.inspect"
      contract={fixture()}
      disabled={false}
      onSubmit={submit}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Inspect Process' }));
  expect(screen.getByRole('button', { name: 'Inspect' })).toBeDisabled();
  await userEvent.click(screen.getByRole('combobox', { name: 'Operation' }));
  await userEvent.click(screen.getByRole('option', { name: 'Instance tasks' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Record' }));
  await userEvent.click(screen.getByRole('option', { name: 'instance-one' }));
  expect(submit).not.toHaveBeenCalled();
  const button = screen.getByRole('button', { name: 'Inspect' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(submit).toHaveBeenCalledTimes(1);
  expect(JSON.parse(submit.mock.calls[0]![0] as string)).toEqual({
    intent: 'copilot.process.inspect',
    operation: 'process.instance.tasks',
    code: 'instance-one',
  });
});

it('changing operation clears the selected record and offline reads are never queued', async () => {
  const submit = vi.fn();
  render(
    <CopilotInspectionComposer
      intent="copilot.process.inspect"
      contract={fixture()}
      disabled={false}
      onSubmit={submit}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Inspect Process' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Operation' }));
  await userEvent.click(screen.getByRole('option', { name: 'Instance tasks' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Record' }));
  await userEvent.click(screen.getByRole('option', { name: 'instance-one' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Operation' }));
  await userEvent.click(screen.getByRole('option', { name: 'Definition versions' }));
  expect(screen.getByRole('combobox', { name: 'Record' })).toHaveValue('');
  await userEvent.click(screen.getByRole('combobox', { name: 'Record' }));
  await userEvent.click(screen.getByRole('option', { name: 'definition-one' }));
  vi.stubGlobal('navigator', { onLine: false });
  fireEvent.click(screen.getByRole('button', { name: 'Inspect' }));
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('could not be submitted');
});
