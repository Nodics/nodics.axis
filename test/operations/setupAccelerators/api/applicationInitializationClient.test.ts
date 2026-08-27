import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplicationInitializationClient } from '../../../../src/operations/setupAccelerators/api/applicationInitializationClient';

const connection = {
  moduleName: 'backoffice',
  instanceId: 'platformServer/backoffice',
  endpoint: 'http://localhost:3000/nodics/backoffice',
  environment: 'kickoffLocal',
  state: 'UP' as const,
};

function hangingFetch(): typeof fetch {
  return vi.fn<typeof fetch>().mockImplementation((_url, init) => {
    const signal = init?.signal;
    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  });
}

describe('application initialization client', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives setup status checks enough time for backend aggregation', async () => {
    vi.useFakeTimers();
    const client = createApplicationInitializationClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 1_000,
        profileCode: 'frameworkdocs',
      },
      hangingFetch(),
    );

    const request = client.getStatus();

    await vi.advanceTimersByTimeAsync(59_999);
    await expect(Promise.race([request, Promise.resolve('still waiting')])).resolves.toBe(
      'still waiting',
    );

    await vi.advanceTimersByTimeAsync(1);
    await expect(request).rejects.toThrow(
      'Setup status is taking longer than expected. Refresh status in a moment to continue from the latest backend state.',
    );
  });

  it('allows managed initialization operations to outlive the standard UI timeout', async () => {
    vi.useFakeTimers();
    const client = createApplicationInitializationClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 1_000,
        profileCode: 'frameworkdocs',
      },
      hangingFetch(),
    );

    const request = client.initiate();

    await vi.advanceTimersByTimeAsync(179_999);
    await expect(Promise.race([request, Promise.resolve('still waiting')])).resolves.toBe(
      'still waiting',
    );

    await vi.advanceTimersByTimeAsync(1);
    await expect(request).rejects.toThrow(
      'Application initialization is still running. Refresh status in a moment to continue from the latest backend state.',
    );
  });
});
