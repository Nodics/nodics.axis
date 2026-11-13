import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyCronJobAction,
  cronRequest,
  loadCronJobs,
  saveCronJob,
} from '../../src/operations/cron/api/cronJobClient';
import { configuration, connection } from './scheduleDraftFixture';

afterEach(() => vi.restoreAllMocks());
const job = { code: 'job-a', active: false, runOnInit: false, state: 'NEW' };
function respond(body: unknown, status = 200) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(body), { status })),
    );
}
describe('Cron owner evidence', () => {
  it('accepts the actual generated-owner empty shape as empty, with one GET', async () => {
    const fetcher = respond({
      code: 'SUC_FIND_00000',
      responseCode: '200',
      count: 0,
      result: [],
    });
    expect(await loadCronJobs(connection, configuration)).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[1]?.method).toBeUndefined();
  });
  it.each([
    {},
    { code: 'ERR_FIND_00000', result: [] },
    { code: 'SUC_FIND_00000', responseCode: 'ERR_FIND_00000', result: [] },
    { code: 'SUC_FIND_00000', result: {}, count: 0 },
    { code: 'SUC_FIND_00000', acknowledged: false, result: [] },
    { code: 'SUC_FIND_00000', data: { acknowledged: false, data: [] } },
    { code: 'SUC_FIND_00000', result: [{ active: true }] },
    { code: 'SUC_FIND_00000', result: [{ code: 'job-a' }] },
    { code: 'SUC_FIND_00000', result: [job, job] },
  ])(
    'never turns malformed or negative evidence into an empty inventory: %j',
    async (body) => {
      const fetcher = respond(body);
      await expect(loadCronJobs(connection, configuration)).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('preserves actual inactive identity instead of inventing active defaults', async () => {
    respond({ code: 'SUC_FIND_00000', result: [job] });
    expect(await loadCronJobs(connection, configuration)).toMatchObject([job]);
  });
  it.each([
    { code: 'ERR_JOB_00001' },
    { code: 'SUC_JOB_00000', success: false },
    { code: 'SUC_JOB_00000', responseCode: '403', data: true },
    { code: 'SUC_JOB_00000', data: false },
    { code: 'SUC_JOB_00000', data: { acknowledged: false } },
    { code: 'SUC_JOB_00000', result: { errors: ['rejected'] } },
  ])(
    'rejects a negative lifecycle acknowledgement on HTTP 200 without replay: %j',
    async (body) => {
      const fetcher = respond(body);
      await expect(
        applyCronJobAction(connection, configuration, 'job-a', 'run'),
      ).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher.mock.calls[0]?.[1]?.method).toBe('POST');
    },
  );
  it('accepts only an owner acknowledgement, not a claim that execution completed', async () => {
    respond({ code: 'SUC_JOB_00000', data: true });
    await expect(
      applyCronJobAction(connection, configuration, 'job-a', 'stop'),
    ).resolves.toBeUndefined();
  });
  it.each([
    { code: 'SUC_SAVE_00000', result: [] },
    { code: 'SUC_SAVE_00000', result: [job, job] },
    { code: 'SUC_SAVE_00000', result: { count: 1, modifiedCount: 1 } },
    { code: 'SUC_SAVE_00000', result: { ...job, code: 'other-job' } },
    { code: 'SUC_SAVE_00000', result: { ...job, active: true } },
  ])(
    'holds incompatible legacy technical save receipts without reconstructing a job: %j',
    async (body) => {
      const fetcher = respond(body);
      await expect(
        saveCronJob(connection, configuration, {
          code: 'job-a',
          name: 'A job',
          description: '',
          active: false,
          runOnNode: 'approved-node',
          runOnInit: false,
          triggerExpression: '0 0 * * * *',
        }),
      ).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    { ...connection, moduleName: 'cms' },
    {
      ...connection,
      endpoint: 'https://user:synthetic-secret@example.invalid/cronjob',
    },
    {
      ...connection,
      endpoint: 'https://example.invalid/cronjob?token=synthetic-secret',
    },
  ])(
    'rejects incompatible owner coordinates before attaching credentials',
    async (source) => {
      const fetcher = vi.spyOn(globalThis, 'fetch');
      await expect(loadCronJobs(source, configuration)).rejects.toThrow();
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it('does not render raw non-JSON or owner error text containing private transport material', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('Bearer synthetic-secret', { status: 502 }));
    await expect(cronRequest(connection, '/cronjob', configuration)).rejects.toThrow(
      'incompatible response',
    );
    fetcher.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ message: 'Bearer synthetic-secret', code: 'ERR_JOB_00001' }),
        { status: 403 },
      ),
    );
    await expect(cronRequest(connection, '/cronjob', configuration)).rejects.toThrow(
      'You do not have access',
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
