/** @file Draft scope, strict receipts, confirmation and no-replay browser regressions. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { CronScheduleDraftPanel } from '../../src/operations/cron/CronScheduleDraftPanel';
import {
  parseScheduleDraftCapability,
  parseScheduleDraftReceipt,
  parseScheduleDraftReview,
  scheduleDraftRequest,
  selectSourceScheduleTargets,
} from '../../src/operations/cron/api/cronScheduleDraftClient';
import {
  capability,
  configuration,
  connection,
  createDraftFixture,
  envelope,
  input,
  presentation,
  reviewed,
  target,
} from './scheduleDraftFixture';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('narrows source schedules by exact owner, identity and fingerprint and rejects changed review bindings', () => {
  const sourceBinding = {
    moduleName: 'copilotApi',
    sourceCode: 'docs',
    policyDigest: 'a'.repeat(64),
  };
  const bound = { ...target, sourceBinding };
  const other = {
    ...bound,
    code: 'other',
    sourceBinding: { ...sourceBinding, policyDigest: 'b'.repeat(64) },
  };
  expect(selectSourceScheduleTargets([target, bound, other], sourceBinding)).toEqual([
    bound,
  ]);
  expect(
    selectSourceScheduleTargets([bound], {
      ...sourceBinding,
      moduleName: 'otherOwner',
    }),
  ).toEqual([]);
  const parsed = parseScheduleDraftCapability(
    envelope({ targets: [bound], presentation }),
    configuration.enterpriseCode,
  );
  expect(parsed.targets).toEqual([bound]);
  expect(() =>
    parseScheduleDraftReview(
      envelope({ ...reviewed, sourceBinding }),
      input,
      bound,
      configuration.enterpriseCode,
    ),
  ).not.toThrow();
  expect(() =>
    parseScheduleDraftReview(
      envelope(reviewed),
      input,
      bound,
      configuration.enterpriseCode,
    ),
  ).toThrow();
  expect(() =>
    parseScheduleDraftCapability(
      envelope({
        targets: [
          { ...bound, sourceBinding: { ...sourceBinding, policyDigest: 'bad' } },
        ],
        presentation,
      }),
      configuration.enterpriseCode,
    ),
  ).toThrow();
});

it('rejects foreign, missing, duplicate, over-limit and contradictory capability data', () => {
  expect(
    parseScheduleDraftCapability(capability, configuration.enterpriseCode).targets,
  ).toEqual([target]);
  for (const data of [
    { ...capability.data, enterpriseCode: 'foreign' },
    { ...capability.data, version: 2 },
    { ...capability.data, acknowledged: false },
    { ...capability.data, targets: [target, target] },
    { ...capability.data, targets: [{ ...target, expressions: [] }] },
    { ...capability.data, presentation: {} },
  ])
    expect(() =>
      parseScheduleDraftCapability(
        { code: 'SUC_JOB_00000', data },
        configuration.enterpriseCode,
      ),
    ).toThrow();
});

it('binds review and receipt to original input, enterprise and digest', () => {
  const review = parseScheduleDraftReview(
    envelope(reviewed),
    input,
    target,
    configuration.enterpriseCode,
  );
  for (const change of [
    { code: 'other' },
    { triggerCode: 'other' },
    { runOnNode: 'other' },
    { active: true },
    { runOnInit: true },
    { reviewDigest: 'bad' },
    { enterpriseCode: 'other' },
  ]) {
    expect(() =>
      parseScheduleDraftReview(
        envelope({ ...reviewed, ...change }),
        input,
        target,
        configuration.enterpriseCode,
      ),
    ).toThrow();
  }
  expect(
    parseScheduleDraftReceipt(
      envelope({ ...reviewed, outcome: 'OUTCOME_UNKNOWN' }),
      review,
      configuration.enterpriseCode,
    ),
  ).toBe('OUTCOME_UNKNOWN');
  for (const change of [
    { code: 'other' },
    { reviewDigest: 'b'.repeat(64) },
    { acknowledged: false },
    { outcome: 'RUNNING' },
  ]) {
    expect(() =>
      parseScheduleDraftReceipt(
        envelope({ ...reviewed, outcome: 'SAVED_INACTIVE', ...change }),
        review,
        configuration.enterpriseCode,
      ),
    ).toThrow();
  }
});

/** Completes a synthetic draft through the ordinary accessible form controls. */
async function fillDraft() {
  const user = userEvent.setup();
  await user.type(
    await screen.findByRole('textbox', { name: presentation.code }),
    input.code,
  );
  await user.type(screen.getByRole('textbox', { name: presentation.name }), input.name);
  await user.click(screen.getByRole('combobox', { name: presentation.target }));
  await user.click(await screen.findByRole('option', { name: target.label }));
  await user.click(screen.getByRole('combobox', { name: presentation.expression }));
  await user.click(await screen.findByRole('option', { name: input.expression }));
  await user.click(screen.getByRole('button', { name: presentation.review }));
  await screen.findByRole('checkbox', { name: presentation.confirm });
  return user;
}

it('requires explicit confirmation, saves once, renders inactive receipt and freezes the saved form', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const fixture = createDraftFixture();
  vi.stubGlobal('fetch', vi.fn(fixture.fetcher));
  const saved = vi.fn();
  render(
    <CronScheduleDraftPanel
      connection={connection}
      configuration={configuration}
      onSaved={saved}
    />,
  );
  const user = await fillDraft();
  expect(screen.getByRole('button', { name: presentation.save })).toBeDisabled();
  await user.click(screen.getByRole('checkbox', { name: presentation.confirm }));
  await user.click(screen.getByRole('button', { name: presentation.save }));
  await screen.findByText(presentation.saved);
  expect(saved).toHaveBeenCalledOnce();
  expect(fixture.calls.filter((call) => call.path.endsWith('/drafts'))).toHaveLength(1);
  expect(screen.getByRole('textbox', { name: presentation.code })).toBeDisabled();
  expect(
    screen.getByRole('checkbox', { name: presentation.confirm }),
  ).not.toBeChecked();
  expect(errors).not.toHaveBeenCalled();
});

it('locks uncertain save and inspects the original identity without resubmitting', async () => {
  const fixture = createDraftFixture(true);
  vi.stubGlobal('fetch', vi.fn(fixture.fetcher));
  render(
    <CronScheduleDraftPanel connection={connection} configuration={configuration} />,
  );
  const user = await fillDraft();
  await user.click(screen.getByRole('checkbox', { name: presentation.confirm }));
  await user.click(screen.getByRole('button', { name: presentation.save }));
  await screen.findByText(presentation.unknown);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: presentation.inspect })).toBeEnabled(),
  );
  expect(screen.getByRole('button', { name: presentation.review })).toBeDisabled();
  expect(screen.getByRole('button', { name: presentation.save })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: presentation.inspect }));
  await screen.findByText(presentation.saved);
  expect(fixture.calls.at(-1)?.body).toEqual({
    code: input.code,
    reviewDigest: reviewed.reviewDigest,
  });
  expect(fixture.calls.filter((call) => call.path.endsWith('/drafts'))).toHaveLength(1);
});

it('invalidates reviews on editing and drops credentials-scoped transient state on session change', async () => {
  const fixture = createDraftFixture();
  vi.stubGlobal('fetch', vi.fn(fixture.fetcher));
  const view = render(
    <CronScheduleDraftPanel connection={connection} configuration={configuration} />,
  );
  const user = await fillDraft();
  await user.click(screen.getByRole('checkbox', { name: presentation.confirm }));
  await user.type(screen.getByRole('textbox', { name: presentation.name }), ' changed');
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  view.rerender(
    <CronScheduleDraftPanel
      connection={connection}
      configuration={{ ...configuration, accessToken: 'different-session' }}
    />,
  );
  expect(await screen.findByRole('textbox', { name: presentation.code })).toHaveValue(
    '',
  );
  expect(fixture.calls.filter((call) => call.path.endsWith('/drafts'))).toHaveLength(0);
});

it('offline commands never dispatch or queue; missing owner contract has no fallback', async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error('Unavailable'));
  vi.stubGlobal('fetch', fetcher);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await expect(
    scheduleDraftRequest(connection, configuration, 'create', {}),
  ).rejects.toThrow('offline');
  expect(fetcher).not.toHaveBeenCalled();
  render(
    <CronScheduleDraftPanel connection={connection} configuration={configuration} />,
  );
  await screen.findByText('Schedule service unavailable.');
  expect(fetcher).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
