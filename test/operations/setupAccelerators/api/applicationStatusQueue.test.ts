import { describe, expect, it } from 'vitest';
import {
  createApplicationStatusQueue,
  parseApplicationReadinessScheduling,
} from '../../../../src/operations/setupAccelerators/api/applicationStatusQueue';

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const policy = { contractVersion: 1 as const, concurrency: 1, priorityBurst: 1 };

describe('framework-owned status scheduling', () => {
  it('rejects invalid policy and never supplies a frontend default', async () => {
    expect(parseApplicationReadinessScheduling(undefined)).toBeUndefined();
    for (const value of [
      null,
      {},
      { ...policy, contractVersion: 2 },
      ...[0, 17, 1.5, '4', null].map((concurrency) => ({ ...policy, concurrency })),
    ])
      expect(() => parseApplicationReadinessScheduling(value)).toThrow();
    let calls = 0;
    await expect(
      createApplicationStatusQueue(undefined).run('a', () => Promise.resolve(calls++)),
    ).rejects.toThrow('unavailable');
    expect(calls).toBe(0);
  });

  it('settles all 74 initial reads at the projected limit and prioritizes expanded without starvation', async () => {
    for (const concurrency of [1, 2, 4]) {
      const queue = createApplicationStatusQueue({ ...policy, concurrency });
      queue.prefer('73');
      const calls: string[] = [],
        releases: (() => void)[] = [];
      let active = 0,
        peak = 0;
      const results = Array.from({ length: 74 }, (_, i) =>
        queue.run(String(i), async () => {
          calls.push(String(i));
          active++;
          peak = Math.max(peak, active);
          await new Promise<void>((resolve) => releases.push(resolve));
          active--;
          return i;
        }),
      );
      await flush();
      expect(calls[0]).toBe('73');
      while (releases.length) {
        releases.splice(0).forEach((release) => release());
        await flush();
      }
      expect(await Promise.all(results)).toEqual(
        Array.from({ length: 74 }, (_, i) => i),
      );
      expect(peak).toBe(concurrency);
      expect(new Set(calls).size).toBe(74);
    }
  });

  it('shares initial, poll and manual lanes and alternates priority with oldest pending work', async () => {
    const queue = createApplicationStatusQueue(policy);
    const calls: string[] = [],
      releases: (() => void)[] = [];
    const read = (key: string) =>
      queue.run(key, async () => {
        calls.push(key);
        await new Promise<void>((resolve) => releases.push(resolve));
        return key;
      });
    const results = [read('initial-running')];
    await flush();
    results.push(read('initial-oldest'), read('poll'), read('manual'));
    queue.prefer('poll');
    queue.prioritize('manual');
    releases.shift()!();
    await flush();
    expect(calls[1]).toBe('manual');
    releases.shift()!();
    await flush();
    expect(calls[2]).toBe('initial-oldest');
    releases.shift()!();
    await flush();
    expect(calls[3]).toBe('poll');
    releases.shift()!();
    await Promise.all(results);
  });

  it('cancellation suppresses stale evidence, failures release capacity, later requests read again', async () => {
    const queue = createApplicationStatusQueue(policy);
    const controller = new AbortController();
    let release!: () => void,
      calls = 0;
    const active = queue.run(
      'a',
      async () => {
        calls++;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return 'old';
      },
      controller.signal,
    );
    const rejected = expect(active).rejects.toMatchObject({ name: 'AbortError' });
    await flush();
    controller.abort();
    const pendingController = new AbortController();
    const pending = queue.run(
      'b',
      () => {
        calls++;
        return Promise.resolve('never');
      },
      pendingController.signal,
    );
    const pendingRejected = expect(pending).rejects.toMatchObject({
      name: 'AbortError',
    });
    pendingController.abort();
    release();
    await flush();
    await rejected;
    await pendingRejected;
    await expect(
      queue.run('a', () => {
        throw new Error('denied');
      }),
    ).rejects.toThrow('denied');
    await expect(
      queue.run('a', () => {
        calls++;
        return Promise.resolve('fresh');
      }),
    ).resolves.toBe('fresh');
    expect(calls).toBe(2);
  });

  it('unmount or principal replacement cancels queued work and cannot publish active old authority after reactivation', async () => {
    const queue = createApplicationStatusQueue(policy);
    let release!: () => void;
    const active = queue.run(
      'a',
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const old = expect(active).rejects.toMatchObject({ name: 'AbortError' });
    await flush();
    const pending = expect(
      queue.run('b', () => Promise.resolve('never')),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
    queue.deactivate();
    queue.activate();
    release();
    await old;
    await pending;
    await expect(queue.run('a', () => Promise.resolve('new'))).resolves.toBe('new');
  });
});
