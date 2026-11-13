import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  builderRequest,
  parseBuilderInfo,
  parseBuilderPlan,
  parseBuilderOperations,
} from '../../src/operations/applicationBuilder/api/applicationBuilderClient';
import { subscribeEmployeeSessionExpired } from '../../src/auth/employeeSessionEvents';
import { connection, configuration, info, plan, operations, envelope } from './fixture';
afterEach(() => vi.restoreAllMocks());
describe('Installer read-only transport', () => {
  it('explains a lost response without retrying or claiming a build', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(builderRequest(connection, configuration, 'plan')).rejects.toThrow(
      'The Builder response could not be confirmed. Nothing was created. Review the inputs and try again.',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('uses fixed relative reads, no-store and redirect refusal; preserves configured form presentation', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(envelope(info))));
    expect(
      parseBuilderInfo(await builderRequest(connection, configuration, 'info'))
        .presentation.plan,
    ).toBe('Review plan');
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://builder.invalid/installer/v0/info',
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      credentials: 'omit',
    });
  });
  it('rejects a foreign owner before attaching credentials', async () => {
    const f = vi.spyOn(globalThis, 'fetch');
    await expect(
      builderRequest({ ...connection, moduleName: 'profile' }, configuration, 'info'),
    ).rejects.toThrow();
    expect(f).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    'does not turn contradictory or FAILED success envelopes into evidence (%s)',
    async (contradictory) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify(
            contradictory
              ? { ...envelope(info), status: 'FAILED' }
              : { ...envelope(info), contractVersion: 'unknown' },
          ),
        ),
      );
      await expect(builderRequest(connection, configuration, 'info')).rejects.toThrow();
    },
  );
  it('never accepts an executable mutation or a plan claimed as a completed build', () => {
    expect(parseBuilderOperations({ operations })).toHaveLength(2);
    expect(() =>
      parseBuilderOperations({ operations: [{ ...operations[1], executable: true }] }),
    ).toThrow();
    expect(parseBuilderPlan(plan).plan?.dryRunOnly).toBe(true);
    expect(() =>
      parseBuilderPlan({ ...plan, plan: { ...plan.plan, dryRunOnly: false } }),
    ).toThrow();
  });
  it('signals only401 to the current App session and keeps403 local', async () => {
    const observed: number[] = [];
    const stop = subscribeEmployeeSessionExpired((x) => observed.push(x.generation));
    try {
      const f = vi.spyOn(globalThis, 'fetch');
      f.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'denied' }), { status: 403 }),
      ).mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'expired' }), { status: 401 }),
      );
      await expect(builderRequest(connection, configuration, 'info')).rejects.toThrow();
      expect(observed).toEqual([]);
      await expect(builderRequest(connection, configuration, 'info')).rejects.toThrow();
      expect(observed).toEqual([1]);
    } finally {
      stop();
    }
  });
});
