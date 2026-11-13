import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cronJobExecutionEvidence,
  cronJobLifecycleActionPolicies,
  loadCronJobs,
  usesReviewedCronSchedule,
  type CronJobDefinition,
} from '../../src/operations/cron/api/cronJobClient';
import { configuration, connection } from './scheduleDraftFixture';

const job: CronJobDefinition = {
  code: 'review-job',
  name: 'Scheduled review',
  description: undefined,
  active: false,
  runOnNode: 'node0',
  runOnInit: false,
  trigger: undefined,
  start: undefined,
  state: 'STOPED',
  status: 'SUCCESS',
  startTime: '2026-11-04T08:00:00.004Z',
  endTime: '2026-11-04T08:00:00.123Z',
  jobDetail: { scheduleDraft: { version: 1 } },
};
afterEach(() => vi.restoreAllMocks());

describe('Cron persisted execution presentation', () => {
  it.each(['SUCCESS', 'ERROR'] as const)(
    'requires owner times for terminal %s evidence independently of timer state',
    (status) => {
      expect(cronJobExecutionEvidence({ ...job, status })).toEqual({
        kind: 'completed',
        status,
        startedAt: job.startTime,
        finishedAt: job.endTime,
      });
    },
  );
  it.each([
    { startTime: undefined },
    { endTime: undefined },
    { startTime: 'not a date' },
    { endTime: '2026-11-04T07:59:00.000Z' },
    { status: 'RUNNING' },
    { state: 'RUNNING' },
    { status: 'accepted' },
    { startTime: '1' },
    { endTime: ' ' },
  ])(
    'does not turn incomplete, contradictory or nonterminal evidence into completed work',
    (change) => {
      expect(cronJobExecutionEvidence({ ...job, ...change })).toEqual({
        kind: 'unconfirmed',
      });
    },
  );
  it('distinguishes no recorded run from an unconfirmed terminal result', () => {
    expect(
      cronJobExecutionEvidence({
        ...job,
        startTime: undefined,
        endTime: undefined,
        status: 'NEW',
      }),
    ).toEqual({ kind: 'none' });
    expect(
      cronJobExecutionEvidence({ ...job, startTime: undefined, endTime: undefined }),
    ).toEqual({ kind: 'unconfirmed' });
  });
  it('keeps malformed reviewed markers on the governed path without granting execution authority', () => {
    expect(usesReviewedCronSchedule(job)).toBe(true);
    expect(
      usesReviewedCronSchedule({ ...job, jobDetail: { scheduleDraft: null } }),
    ).toBe(true);
    expect(
      usesReviewedCronSchedule({ ...job, jobDetail: { processTrigger: {} } }),
    ).toBe(false);
  });
  it('holds another manual run while the current owner status is RUNNING', () => {
    expect(
      cronJobLifecycleActionPolicies({
        ...job,
        active: true,
        state: 'ACTIVE',
        status: 'RUNNING',
      }).find((item) => item.action === 'run')?.disabled,
    ).toBe(true);
  });
  it('holds manual runs for owner RUNNING state even with a stale terminal status', () => {
    expect(
      cronJobLifecycleActionPolicies({ ...job, active: true, state: 'RUNNING' }).find(
        (x) => x.action === 'run',
      )?.disabled,
    ).toBe(true);
  });
  it('holds an unpaired current start while a stopped timer still has admitted work', () => {
    expect(
      cronJobLifecycleActionPolicies({
        ...job,
        active: true,
        state: 'STOPED',
        startTime: '2026-11-04T09:00:00.000Z',
      }).find((x) => x.action === 'run')?.disabled,
    ).toBe(true);
  });
  it('projects the actual generated-owner timestamps without sending work', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ code: 'SUC_FIND_00000', result: [job], count: 1 }),
        ),
      );
    const rows = await loadCronJobs(connection, configuration);
    expect(cronJobExecutionEvidence(rows[0]!)).toMatchObject({
      kind: 'completed',
      status: 'SUCCESS',
    });
    expect(rows[0]).toMatchObject({
      startTime: job.startTime,
      endTime: job.endTime,
      active: false,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[1]?.method).toBeUndefined();
  });
});
