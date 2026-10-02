/** Regression coverage for command admission and no replay after reconnect. */
import { onlineManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAxisQueryClient } from '../../src/app/axisQueryClient';

afterEach(() => {
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
});

describe('Axis command connectivity policy', () => {
  it.each([
    { networkMode: 'online' as const },
    { networkMode: 'offlineFirst' as const },
    { retry: 1 },
    { retry: true },
    { scope: { id: 'serialized-command' } },
  ])('rejects a customization that restores a command queue: %j', async (options) => {
    const client = createAxisQueryClient();
    const mutationFn = vi.fn();
    const onMutate = vi.fn();
    const mutation = client.getMutationCache().build(client, {
      ...options,
      mutationFn,
      onMutate,
    });
    await expect(mutation.execute(undefined)).rejects.toThrow(
      'unsupported command queue policy',
    );
    await client.resumePausedMutations();
    expect(mutationFn).not.toHaveBeenCalled();
    expect(onMutate).not.toHaveBeenCalled();
    client.clear();
  });

  it.each(['manager', 'navigator'] as const)(
    'rejects an offline command before callbacks and never replays it (%s)',
    async (source) => {
      const client = createAxisQueryClient();
      client.mount();
      if (source === 'manager') onlineManager.setOnline(false);
      else vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      const mutationFn = vi.fn();
      const onMutate = vi.fn();
      const mutation = client
        .getMutationCache()
        .build(client, { mutationFn, onMutate });
      await expect(mutation.execute(undefined)).rejects.toThrow(
        'This action was not sent',
      );
      onlineManager.setOnline(true);
      vi.restoreAllMocks();
      await client.resumePausedMutations();
      expect(mutationFn).not.toHaveBeenCalled();
      expect(onMutate).not.toHaveBeenCalled();
      expect(mutation.state.status).toBe('error');
      expect(mutation.state.isPaused).toBe(false);
      client.unmount();
      client.clear();
    },
  );

  it('executes an online command once', async () => {
    const client = createAxisQueryClient();
    const mutationFn = vi.fn().mockResolvedValue('saved');
    const mutation = client.getMutationCache().build(client, { mutationFn });
    await expect(mutation.execute(undefined)).resolves.toBe('saved');
    expect(mutationFn).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it('does not pause or replay a command when connectivity is lost after admission', async () => {
    const client = createAxisQueryClient();
    client.mount();
    const mutationFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const mutation = client.getMutationCache().build(client, {
      mutationFn,
      onMutate: async () => {
        await Promise.resolve();
        onlineManager.setOnline(false);
      },
    });
    await expect(mutation.execute(undefined)).rejects.toThrow('Failed to fetch');
    expect(mutation.state.isPaused).toBe(false);
    onlineManager.setOnline(true);
    await client.resumePausedMutations();
    expect(mutationFn).toHaveBeenCalledTimes(1);
    client.unmount();
    client.clear();
  });
});
