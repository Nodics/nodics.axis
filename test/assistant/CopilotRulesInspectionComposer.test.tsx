/** @file Rules composer contract, guided selection, duplicate submission and offline regressions. */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { CopilotInspectionComposer } from '../../src/assistant/CopilotInspectionComposer';
import {
  parseCopilotRulesInspection,
  type CopilotRulesInspection,
} from '../../src/assistant/api/copilotInspectionContract';

/** Provides synthetic owner choices without native transport or execution authority. */
export function rulesInspectionFixture(): CopilotRulesInspection {
  return {
    operations: [
      {
        code: 'rules.definition.inspect',
        label: 'Rule summary',
        codes: ['rule-one'],
        requiresCode: true,
      },
      {
        code: 'rules.band.versions',
        label: 'Score-band versions',
        codes: ['band-one'],
        requiresCode: true,
      },
    ],
    presentation: {
      title: 'Inspect Rules',
      operation: 'Operation',
      code: 'Definition',
      submit: 'Inspect',
      cancel: 'Cancel',
      failure: 'Rules inspection could not be submitted.',
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

it('projects only fixed operation choices and rejects malformed identifiers, duplicates and missing copy', () => {
  const fixture = rulesInspectionFixture();
  expect(parseCopilotRulesInspection({ ...fixture, endpoint: '/private' })).toEqual(
    fixture,
  );
  expect(
    parseCopilotRulesInspection({ operations: [], presentation: {} }),
  ).toBeUndefined();
  for (const operations of [
    [...fixture.operations, fixture.operations[0]],
    [{ ...fixture.operations[0], code: 'rules.definition.publish' }],
    [{ ...fixture.operations[0], codes: ['../foreign'] }],
    [{ ...fixture.operations[0], codes: ['rule-one', 'rule-one'] }],
    [{ ...fixture.operations[0], codes: [] }],
  ])
    expect(() => parseCopilotRulesInspection({ ...fixture, operations })).toThrow();
  expect(() => parseCopilotRulesInspection({ ...fixture, presentation: {} })).toThrow();
});

it('makes no calls until an explicit operation and admitted definition are selected', async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(
    <CopilotInspectionComposer
      intent="copilot.rules.inspect"
      contract={rulesInspectionFixture()}
      disabled={false}
      onSubmit={submit}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Inspect Rules' }));
  expect(screen.getByRole('button', { name: 'Inspect' })).toBeDisabled();
  await userEvent.click(screen.getByRole('combobox', { name: 'Operation' }));
  await userEvent.click(screen.getByRole('option', { name: 'Rule summary' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Definition' }));
  expect(screen.queryByRole('option', { name: 'band-one' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('option', { name: 'rule-one' }));
  expect(submit).not.toHaveBeenCalled();
  const button = screen.getByRole('button', { name: 'Inspect' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(submit).toHaveBeenCalledTimes(1);
  expect(JSON.parse(submit.mock.calls[0]![0] as string)).toEqual({
    intent: 'copilot.rules.inspect',
    operation: 'rules.definition.inspect',
    code: 'rule-one',
  });
});

it('clears stale choices when operation changes and does not queue offline submissions', async () => {
  const submit = vi.fn();
  render(
    <CopilotInspectionComposer
      intent="copilot.rules.inspect"
      contract={rulesInspectionFixture()}
      disabled={false}
      onSubmit={submit}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Inspect Rules' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Operation' }));
  await userEvent.click(screen.getByRole('option', { name: 'Rule summary' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Definition' }));
  await userEvent.click(screen.getByRole('option', { name: 'rule-one' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Operation' }));
  await userEvent.click(screen.getByRole('option', { name: 'Score-band versions' }));
  expect(screen.getByRole('combobox', { name: 'Definition' })).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Inspect' })).toBeDisabled();
  await userEvent.click(screen.getByRole('combobox', { name: 'Definition' }));
  await userEvent.click(screen.getByRole('option', { name: 'band-one' }));
  vi.stubGlobal('navigator', { onLine: false });
  fireEvent.click(screen.getByRole('button', { name: 'Inspect' }));
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('could not be submitted');
});

it('owner context changes discard an open draft and busy state prevents opening', async () => {
  const fixture = rulesInspectionFixture();
  const view = render(
    <CopilotInspectionComposer
      intent="copilot.rules.inspect"
      contract={fixture}
      disabled={false}
      onSubmit={vi.fn()}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Inspect Rules' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Operation' }));
  await userEvent.click(screen.getByRole('option', { name: 'Rule summary' }));
  view.rerender(
    <CopilotInspectionComposer
      intent="copilot.rules.inspect"
      contract={{ ...fixture, operations: [fixture.operations[1]!] }}
      disabled={true}
      onSubmit={vi.fn()}
    />,
  );
  expect(screen.getByRole('combobox', { name: 'Operation' })).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Inspect' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('button', { name: 'Inspect Rules' })).toBeDisabled();
});
