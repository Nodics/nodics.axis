/** BackOffice owns all scheduling defaults. This queue retains work, never status evidence. */
export interface ApplicationReadinessScheduling {
  readonly contractVersion: 1;
  readonly concurrency: number;
  readonly priorityBurst: number;
}

export function parseApplicationReadinessScheduling(
  value: unknown,
): ApplicationReadinessScheduling | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object')
    throw new Error('BackOffice readiness scheduling is invalid');
  const item = value as Record<string, unknown>;
  if (
    item.contractVersion !== 1 ||
    ![item.concurrency, item.priorityBurst].every(
      (count) =>
        typeof count === 'number' &&
        Number.isSafeInteger(count) &&
        count >= 1 &&
        count <= 16,
    )
  )
    throw new Error('BackOffice readiness scheduling is invalid');
  return Object.freeze({
    contractVersion: 1,
    concurrency: item.concurrency as number,
    priorityBurst: item.priorityBurst as number,
  });
}

export function createApplicationStatusQueue(
  policy: ApplicationReadinessScheduling | undefined,
) {
  const pending: { key: string; start: () => void; cancel: () => void }[] = [];
  let active = 0;
  let priorityRuns = 0;
  let preferred: string | undefined;
  let enabled = true;
  let generation = 0;
  const urgent = new Set<string>();
  const aborted = () => new DOMException('Status read canceled', 'AbortError');
  const drain = () => {
    if (!enabled || !policy) return;
    while (active < policy.concurrency && pending.length) {
      const manual = pending.findIndex((item) => urgent.has(item.key));
      const priority =
        manual >= 0 ? manual : pending.findIndex((item) => item.key === preferred);
      const index = priority >= 0 && priorityRuns < policy.priorityBurst ? priority : 0;
      priorityRuns = priority >= 0 && index === priority ? priorityRuns + 1 : 0;
      const item = pending.splice(index, 1)[0]!;
      urgent.delete(item.key);
      item.start();
    }
  };
  return {
    prefer(key: string | undefined) {
      preferred = key;
      queueMicrotask(drain);
    },
    prioritize(key: string) {
      urgent.add(key);
      queueMicrotask(drain);
    },
    activate() {
      enabled = true;
      queueMicrotask(drain);
    },
    deactivate() {
      enabled = false;
      generation++;
      for (const item of pending.splice(0)) item.cancel();
      urgent.clear();
    },
    run<T>(key: string, read: () => Promise<T>, signal?: AbortSignal): Promise<T> {
      if (!policy)
        return Promise.reject(
          new Error('BackOffice readiness scheduling is unavailable'),
        );
      if (!enabled || signal?.aborted) return Promise.reject(aborted());
      return new Promise<T>((resolve, reject) => {
        const startedGeneration = generation;
        const cancel = () => {
          reject(aborted());
          signal?.removeEventListener('abort', cancel);
        };
        const item = {
          key,
          cancel,
          start: () => {
            if (signal?.aborted) {
              cancel();
              return;
            }
            active++;
            Promise.resolve()
              .then(() => {
                if (signal?.aborted || !enabled || startedGeneration !== generation)
                  throw aborted();
                return read();
              })
              .then(
                (value) =>
                  signal?.aborted || !enabled || startedGeneration !== generation
                    ? cancel()
                    : resolve(value),
                reject,
              )
              .finally(() => {
                signal?.removeEventListener('abort', cancel);
                active--;
                drain();
              });
          },
        };
        signal?.addEventListener('abort', cancel, { once: true });
        pending.push(item);
        queueMicrotask(drain);
      });
    },
  };
}
