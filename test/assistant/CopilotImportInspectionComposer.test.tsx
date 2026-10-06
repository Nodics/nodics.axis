/** @file nImport inspection parsing, scoped release selection and explicit submission regressions. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { CopilotInspectionComposer } from '../../src/assistant/CopilotInspectionComposer';
import { parseCopilotImportInspection } from '../../src/assistant/api/copilotInspectionContract';

/** Synthetic configured choices; runtime authorization remains a backend responsibility. */
function fixture() {
  return parseCopilotImportInspection({
    operations: [
      {
        code: 'import.release.core.catalogue',
        label: 'Core releases',
        codes: ['foundation:core-v001'],
        requiresCode: false,
      },
      {
        code: 'import.release.core.validate',
        label: 'Validate core release',
        codes: ['foundation:core-v001'],
      },
    ],
    presentation: {
      title: 'Inspect data releases',
      operation: 'Operation',
      code: 'Release or profile',
      submit: 'Inspect',
      cancel: 'Cancel',
      failure: 'Data-release inspection could not be submitted.',
    },
  })!;
}

it('accepts qualified release codes and rejects paths, duplicates and install operations', () => {
  const contract = fixture();
  expect(contract.operations[1]?.codes).toEqual(['foundation:core-v001']);
  for (const operations of [
    [{ ...contract.operations[0], code: 'import.release.core.install' }],
    [{ ...contract.operations[0], codes: ['../core'] }],
    [
      {
        ...contract.operations[0],
        codes: ['foundation:core-v001', 'foundation:core-v001'],
      },
    ],
  ])
    expect(() => parseCopilotImportInspection({ ...contract, operations })).toThrow();
});

it('submits a validation-only typed command after explicit release selection', async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(
    <CopilotInspectionComposer
      intent="copilot.import.inspect"
      contract={fixture()}
      disabled={false}
      onSubmit={submit}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Inspect data releases' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Operation' }));
  await userEvent.click(screen.getByRole('option', { name: 'Validate core release' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Release or profile' }));
  await userEvent.click(screen.getByRole('option', { name: 'foundation:core-v001' }));
  await userEvent.click(screen.getByRole('button', { name: 'Inspect' }));
  expect(submit).toHaveBeenCalledTimes(1);
  expect(JSON.parse(submit.mock.calls[0]![0] as string)).toEqual({
    intent: 'copilot.import.inspect',
    operation: 'import.release.core.validate',
    code: 'foundation:core-v001',
  });
});

it('submits catalogue inspection without a release selector', async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(
    <CopilotInspectionComposer
      intent="copilot.import.inspect"
      contract={fixture()}
      disabled={false}
      onSubmit={submit}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Inspect data releases' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Operation' }));
  await userEvent.click(screen.getByRole('option', { name: 'Core releases' }));
  expect(
    screen.queryByRole('combobox', { name: 'Release or profile' }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Inspect' }));
  expect(JSON.parse(submit.mock.calls[0]![0] as string)).toEqual({
    intent: 'copilot.import.inspect',
    operation: 'import.release.core.catalogue',
  });
});
