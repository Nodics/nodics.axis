/** @file Business-user live-read form, inert contracts, offline and obsolete-response coverage. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { CopilotLiveReadComposer } from '../../src/assistant/CopilotLiveReadComposer';
import { parseCopilotLiveReads } from '../../src/assistant/api/copilotLiveReadContract';
import { copilotLiveReadFixture } from './copilotLiveReadFixture';

afterEach(() => vi.unstubAllGlobals());

it('rejects malformed, duplicate and executable-looking source contracts', () => {
  const fixture = copilotLiveReadFixture();
  expect(parseCopilotLiveReads(fixture)).toEqual(fixture);
  for (const sources of [
    [...fixture.sources, fixture.sources[0]],
    [{ ...fixture.sources[0], code: '../foreign' }],
    [{ ...fixture.sources[0], sourceType: 'HTTP' }],
    [{ ...fixture.sources[0], sourcePolicyDigest: 'old' }],
  ])
    expect(() => parseCopilotLiveReads({ ...fixture, sources })).toThrow();
});

it('loads authorized collection choices and submits only after explicit action', async () => {
  const load = vi.fn().mockResolvedValue([
    { schemaName: 'employee', label: 'Employees', selected: true },
    { schemaName: 'policy', label: 'Policies', selected: false },
  ]);
  const submit = vi.fn().mockResolvedValue(undefined);
  render(
    <CopilotLiveReadComposer
      contract={copilotLiveReadFixture()}
      disabled={false}
      loadCollections={load}
      onSubmit={submit}
    />,
  );
  expect(load).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Read live evidence' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Source' }));
  await userEvent.click(
    screen.getByRole('option', { name: 'business-data (Business data)' }),
  );
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Collection' })).not.toBeDisabled(),
  );
  await userEvent.click(screen.getByRole('combobox', { name: 'Collection' }));
  expect(screen.queryByRole('option', { name: 'Policies' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('option', { name: 'Employees' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'Alice');
  expect(submit).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Read in conversation' }));
  expect(submit).toHaveBeenCalledTimes(1);
  expect(JSON.parse(submit.mock.calls[0]![0] as string)).toEqual({
    intent: 'copilot.data.query',
    sourceCode: 'business-data',
    input: { schemaName: 'employee', search: 'Alice', page: 1 },
  });
});

it('requires an exact correlation and bounded interval, and never submits while offline', async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(
    <CopilotLiveReadComposer
      contract={copilotLiveReadFixture()}
      disabled={false}
      loadCollections={vi.fn()}
      onSubmit={submit}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Read live evidence' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Source' }));
  await userEvent.click(
    screen.getByRole('option', { name: 'journey-events (Incident logs)' }),
  );
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Journey correlation ID' }),
    'journey-1',
  );
  fireEvent.change(screen.getByLabelText('From (local time)'), {
    target: { value: '2026-10-03T10:00' },
  });
  fireEvent.change(screen.getByLabelText('To (local time)'), {
    target: { value: '2026-10-05T11:00' },
  });
  expect(screen.getByRole('button', { name: 'Read in conversation' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('To (local time)'), {
    target: { value: '2026-10-03T11:00' },
  });
  vi.stubGlobal('navigator', { onLine: false });
  fireEvent.click(screen.getByRole('button', { name: 'Read in conversation' }));
  expect(submit).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  fireEvent.click(screen.getByRole('button', { name: 'Read in conversation' }));
  const command: unknown = JSON.parse(submit.mock.calls[0]![0] as string);
  expect(command).toMatchObject({
    intent: 'copilot.logs.query',
    input: {
      from: new Date('2026-10-03T10:00').toISOString(),
      correlationId: 'journey-1',
    },
  });
});

it('closing aborts source metadata and empty source selections remain disabled', async () => {
  let signal: AbortSignal | undefined;
  const load = vi.fn((_source, input: AbortSignal) => {
    signal = input;
    return new Promise<never>(() => {});
  });
  const view = render(
    <CopilotLiveReadComposer
      contract={copilotLiveReadFixture()}
      disabled={false}
      loadCollections={load}
      onSubmit={vi.fn()}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Read live evidence' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Source' }));
  await userEvent.click(
    screen.getByRole('option', { name: 'business-data (Business data)' }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(signal?.aborted).toBe(true);
  view.rerender(
    <CopilotLiveReadComposer
      contract={{ ...copilotLiveReadFixture(), sources: [] }}
      disabled={false}
      loadCollections={load}
      onSubmit={vi.fn()}
    />,
  );
  expect(screen.getByRole('button', { name: 'Read live evidence' })).toBeDisabled();
});

it('lists metadata explicitly without a record query or offline queue', async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(
    <CopilotLiveReadComposer
      contract={copilotLiveReadFixture()}
      disabled={false}
      loadCollections={vi.fn().mockResolvedValue([])}
      onSubmit={submit}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Read live evidence' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Source' }));
  await userEvent.click(
    screen.getByRole('option', { name: 'business-data (Business data)' }),
  );
  const list = await screen.findByRole('button', { name: 'List collections' });
  await waitFor(() => expect(list).not.toBeDisabled());
  expect(screen.getByRole('button', { name: 'Read in conversation' })).toBeDisabled();
  expect(submit).not.toHaveBeenCalled();
  vi.stubGlobal('navigator', { onLine: false });
  fireEvent.click(list);
  expect(submit).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  await userEvent.click(list);
  expect(submit).toHaveBeenCalledTimes(1);
  expect(JSON.parse(submit.mock.calls[0]![0] as string)).toEqual({
    intent: 'copilot.data.collections',
    sourceCode: 'business-data',
    input: {},
  });
});

it('hides catalogue submission with an older owner contract and rejects malformed optional copy', async () => {
  const old = copilotLiveReadFixture();
  old.presentation.inspectCollections = undefined;
  const contract = parseCopilotLiveReads(old);
  render(
    <CopilotLiveReadComposer
      contract={contract}
      disabled={false}
      loadCollections={vi.fn().mockResolvedValue([])}
      onSubmit={vi.fn()}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Read live evidence' }));
  await userEvent.click(screen.getByRole('combobox', { name: 'Source' }));
  await userEvent.click(
    screen.getByRole('option', { name: 'business-data (Business data)' }),
  );
  expect(
    screen.queryByRole('button', { name: 'List collections' }),
  ).not.toBeInTheDocument();
  for (const inspectCollections of ['', 5, 'x'.repeat(501)])
    expect(() =>
      parseCopilotLiveReads({
        ...old,
        presentation: { ...old.presentation, inspectCollections },
      }),
    ).toThrow();
});

for (const [label, intent] of [
  ['View fields', 'copilot.data.schema'],
  ['View capabilities', 'copilot.data.capabilities'],
] as const) {
  it(
    'submits only the selected collection for ' +
      label +
      ', without search input or offline queue',
    async () => {
      const submit = vi.fn().mockResolvedValue(undefined);
      render(
        <CopilotLiveReadComposer
          contract={copilotLiveReadFixture()}
          disabled={false}
          loadCollections={vi
            .fn()
            .mockResolvedValue([
              { schemaName: 'employee', label: 'Employees', selected: true },
            ])}
          onSubmit={submit}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Read live evidence' }));
      await userEvent.click(screen.getByRole('combobox', { name: 'Source' }));
      await userEvent.click(
        screen.getByRole('option', { name: 'business-data (Business data)' }),
      );
      expect(screen.getByRole('button', { name: label })).toBeDisabled();
      await waitFor(() =>
        expect(screen.getByRole('combobox', { name: 'Collection' })).not.toBeDisabled(),
      );
      await userEvent.click(screen.getByRole('combobox', { name: 'Collection' }));
      await userEvent.click(screen.getByRole('option', { name: 'Employees' }));
      expect(
        screen.getByRole('button', { name: 'Read in conversation' }),
      ).toBeDisabled();
      vi.stubGlobal('navigator', { onLine: false });
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(submit).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
      await userEvent.click(screen.getByRole('button', { name: label }));
      expect(submit).toHaveBeenCalledTimes(1);
      expect(JSON.parse(submit.mock.calls[0]![0] as string)).toEqual({
        intent,
        sourceCode: 'business-data',
        input: { schemaName: 'employee' },
      });
    },
  );
}

it('optional inspection copy remains backward compatible and rejects malformed values', () => {
  const fixture = copilotLiveReadFixture();
  for (const key of ['inspectSchema', 'inspectCapabilities'] as const) {
    expect(
      parseCopilotLiveReads({
        ...fixture,
        presentation: { ...fixture.presentation, [key]: undefined },
      }).presentation[key],
    ).toBeUndefined();
    for (const value of ['', 42, 'x'.repeat(501)])
      expect(() =>
        parseCopilotLiveReads({
          ...fixture,
          presentation: { ...fixture.presentation, [key]: value },
        }),
      ).toThrow();
  }
});
