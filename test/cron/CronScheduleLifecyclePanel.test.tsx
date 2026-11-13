/** @file Reviewed lifecycle UI and original-command recovery contract tests. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { CronScheduleLifecyclePanel } from '../../src/operations/cron/CronScheduleLifecyclePanel';
import {
  parseScheduleLifecycleReceipt,
  parseScheduleLifecycleReview,
  scheduleLifecycleTextKeys,
  type ScheduleLifecycleCapability,
} from '../../src/operations/cron/api/cronScheduleDraftClient';
import { configuration, connection, envelope } from './scheduleDraftFixture';
const capability: ScheduleLifecycleCapability = {
  activationEnabled: true,
  timingPresentation: {
    expression: 'Cron expression',
    timeZone: 'Scheduler time zone',
    nextRun: 'Next eligible scheduled tick',
    noNextRun: 'No next run while inactive.',
    nextRunUnknown: 'The scheduler has not confirmed a next tick.',
    nextRunMeaning: 'A tick can be skipped if the job is already running.',
  },
  presentation: Object.fromEntries(
    scheduleLifecycleTextKeys.map((key) => [key, key]),
  ) as ScheduleLifecycleCapability['presentation'],
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it.each([true, false])(
  'a competing command holds activation but preserves inspection and explicit deactivation for active=%s',
  async (active) => {
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(typeof init?.body === 'string' ? init.body : '{}')).toEqual({
        code: 'docsJob',
      });
      return Promise.resolve(
        new Response(
          JSON.stringify(
            envelope({
              code: 'docsJob',
              revision: active ? 1 : 0,
              intent: active ? 'ACTIVATE' : null,
              reviewDigest: active ? 'a'.repeat(64) : null,
              state: active ? 'ACTIVE' : 'SAVED_INACTIVE',
              timing: {
                expression: '0 0 * * * *',
                timeZone: 'Asia/Dubai',
                nextRunAt: active ? '2027-01-01T00:00:00.000Z' : null,
              },
            }),
          ),
        ),
      );
    });
    vi.stubGlobal('fetch', fetcher);
    render(
      <CronScheduleLifecyclePanel
        connection={connection}
        configuration={configuration}
        capability={capability}
        initialCode="docsJob"
        commandsBlocked
      />,
    );
    expect(screen.getByRole('textbox', { name: 'code' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'inspect' }));
    if (active)
      expect(await screen.findByRole('button', { name: 'deactivate' })).toBeEnabled();
    else expect(await screen.findByRole('button', { name: 'activate' })).toBeDisabled();
    expect(screen.getByText(/Scheduler time zone/)).toHaveTextContent('Asia/Dubai');
    if (active)
      expect(screen.getByText('2027-01-01 00:00:00 UTC')).toHaveAttribute(
        'datetime',
        '2027-01-01T00:00:00.000Z',
      );
    else expect(screen.getByText('No next run while inactive.')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);
it('rejects foreign identities, revisions and contradictory runtime evidence', () => {
  const row = {
    code: 'docsJob',
    revision: 1,
    intent: 'ACTIVATE',
    reviewDigest: 'a'.repeat(64),
    state: 'ACTIVE',
  };
  expect(
    parseScheduleLifecycleReceipt(envelope(row), row.code, configuration.enterpriseCode)
      .state,
  ).toBe('ACTIVE');
  for (const patch of [
    { code: 'foreign' },
    { revision: -1 },
    { revision: 0 },
    { acknowledged: false },
    { intent: 'DEACTIVATE' },
    { state: 'RUNNING' },
    { reviewDigest: 'bad' },
    { enterpriseCode: 'foreign' },
  ])
    expect(() =>
      parseScheduleLifecycleReceipt(
        envelope({ ...row, ...patch }),
        row.code,
        configuration.enterpriseCode,
      ),
    ).toThrow();
  expect(() =>
    parseScheduleLifecycleReview(
      envelope({ ...row, revision: 2 }),
      { code: row.code, revision: 1, intent: 'ACTIVATE' },
      configuration.enterpriseCode,
    ),
  ).toThrow();
});
it('dispatches confirmed activation once and reconciles lost response without replay', async () => {
  const calls: string[] = [];
  let revision = 0;
  const fetcher = vi.fn((url: string | URL | Request, options?: RequestInit) => {
    const path = (url instanceof Request ? url.url : url.toString()).split('/').at(-1)!;
    calls.push(path);
    const body = JSON.parse(
      typeof options?.body === 'string' ? options.body : '{}',
    ) as Record<string, unknown>;
    if (path === 'execute') {
      revision = 1;
      return Promise.reject(new Error('lost response'));
    }
    const data =
      path === 'preview'
        ? {
            code: body.code,
            revision,
            intent: body.intent,
            reviewDigest: 'a'.repeat(64),
          }
        : {
            code: body.code,
            revision,
            intent: revision ? 'ACTIVATE' : null,
            reviewDigest: revision ? 'a'.repeat(64) : null,
            state:
              path === 'reconcile'
                ? 'ACTIVE'
                : revision
                  ? 'OUTCOME_UNKNOWN'
                  : 'SAVED_INACTIVE',
          };
    return Promise.resolve(new Response(JSON.stringify(envelope(data))));
  });
  vi.stubGlobal('fetch', fetcher);
  const user = userEvent.setup();
  render(
    <CronScheduleLifecyclePanel
      connection={connection}
      configuration={configuration}
      capability={capability}
      initialCode="docsJob"
    />,
  );
  await user.click(screen.getByRole('button', { name: 'inspect' }));
  await user.click(await screen.findByRole('button', { name: 'activate' }));
  expect(await screen.findByRole('button', { name: 'execute' })).toBeDisabled();
  await user.click(screen.getByRole('checkbox', { name: 'confirm' }));
  await user.click(screen.getByRole('button', { name: 'execute' }));
  await screen.findByText('failed');
  expect(screen.getByRole('textbox')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'execute' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'inspect' }));
  await user.click(await screen.findByRole('button', { name: 'reconcile' }));
  await screen.findByText('ACTIVE');
  expect(calls).toEqual(['inspect', 'preview', 'execute', 'inspect', 'reconcile']);
});
it('keeps inspection available with activation disabled and never queues offline commands', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  render(
    <CronScheduleLifecyclePanel
      connection={connection}
      configuration={configuration}
      capability={{ ...capability, activationEnabled: false }}
      initialCode="docsJob"
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'inspect' }));
  await screen.findByText('failed');
  expect(fetcher).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'activate' })).not.toBeInTheDocument();
});
