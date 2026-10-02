/** Read-only recovery scheduling and scope fixtures, not live runtime acceptance. */
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AuthenticatedBootstrapUnavailableError,
  type AxisAuthenticatedBootstrap,
  type AxisNavigationItem,
} from '../../src/bootstrap/publicBootstrap';
import {
  hasUnavailableNavigation,
  NavigationAvailabilityRecoveryContext,
  useNavigationAvailabilityRecovery,
} from '../../src/bootstrap/useNavigationAvailabilityRecovery';
import { ModuleWorkspacePlaceholder } from '../../src/app/ModuleWorkspacePlaceholder';

const item: AxisNavigationItem = {
  id: 'tasks',
  moduleName: 'workflow',
  route: '/process/tasks',
  label: 'Approval queue',
  order: 1,
  category: 'process',
  icon: 'workflow',
  featureState: 'DISABLED',
  availability: 'UNAVAILABLE',
};
const snapshot = (navigation = item) =>
  ({ navigation: [navigation] }) as unknown as AxisAuthenticatedBootstrap;
const options = (
  load: (signal: AbortSignal) => Promise<AxisAuthenticatedBootstrap | undefined>,
) => ({
  item,
  enabled: true,
  scopeKey: 'session-1:tenant-1:tasks',
  retryWindowMs: 300_000,
  load,
});
afterEach(() => vi.useRealTimers());

describe('authenticated navigation availability recovery', () => {
  it('discovers wholly absent late modules through sequential authorized reads without restarting on returned snapshots or page changes', async () => {
    vi.useFakeTimers();
    const healthy = {
      ...item,
      featureState: 'ACTIVE' as const,
      availability: 'UP' as const,
    };
    const commerce = {
      ...healthy,
      id: 'commerce',
      moduleName: 'commerce',
      route: '/commerce',
    };
    const partial = snapshot(healthy);
    const complete = { ...partial, navigation: [healthy, commerce] };
    const load = vi.fn().mockResolvedValueOnce(partial).mockResolvedValue(complete);
    const { rerender, result } = renderHook(
      ({ bootstrap, selected }) =>
        useNavigationAvailabilityRecovery({
          ...options(load),
          item: selected,
          bootstrap,
          retryWindowMs: 90_000,
        }),
      { initialProps: { bootstrap: partial, selected: healthy } },
    );
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(load).toHaveBeenCalledOnce();
    rerender({
      bootstrap: { ...partial },
      selected: { ...healthy, id: 'another-page', route: '/another' },
    });
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(load).toHaveBeenCalledTimes(2);
    expect(await load.mock.results[1]?.value).toEqual(complete);
    rerender({ bootstrap: complete, selected: commerce });
    await act(() => vi.advanceTimersByTimeAsync(600_000));
    expect(load).toHaveBeenCalledTimes(22);
    expect(result.current?.message).toBeUndefined();
    expect(complete.navigation).toHaveLength(2);
  });

  it('observes outages after a long healthy session and bounds recovery from the outage, not sign-in', async () => {
    vi.useFakeTimers();
    const healthy = snapshot({ ...item, featureState: 'ACTIVE', availability: 'UP' });
    const load = vi.fn().mockResolvedValue(healthy);
    const { result } = renderHook(() =>
      useNavigationAvailabilityRecovery({
        ...options(load),
        bootstrap: healthy,
        retryWindowMs: 5_000,
      }),
    );
    await act(() => vi.advanceTimersByTimeAsync(600_000));
    expect(load).toHaveBeenCalledTimes(20);
    load.mockRejectedValue(new AuthenticatedBootstrapUnavailableError('Unavailable'));
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(result.current?.message).toContain('temporarily unavailable');
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(load).toHaveBeenCalledTimes(22);
    expect(result.current?.message).toContain('Refresh availability');
    await act(() => vi.advanceTimersByTimeAsync(600_000));
    expect(load).toHaveBeenCalledTimes(22);
    load.mockResolvedValue(healthy);
    await act(async () => {
      result.current?.refresh();
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(23);
    expect(result.current?.message).toBeUndefined();
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(load).toHaveBeenCalledTimes(24);
  });

  it('does not observe global registration without an unlocked authenticated enabled scope', async () => {
    vi.useFakeTimers();
    const load = vi.fn();
    const { result } = renderHook(() =>
      useNavigationAvailabilityRecovery({
        ...options(load),
        bootstrap: snapshot(),
        enabled: false,
      }),
    );
    await act(() => vi.advanceTimersByTimeAsync(600_000));
    expect(load).not.toHaveBeenCalled();
    expect(result.current).toBeUndefined();
  });

  it('observes healthy global catalogues without inferring missing permissions or changing disabled navigation', async () => {
    vi.useFakeTimers();
    const healthy = {
      ...item,
      featureState: 'ACTIVE' as const,
      availability: 'UP' as const,
    };
    const load = vi.fn();
    const { result } = renderHook(() =>
      useNavigationAvailabilityRecovery({
        ...options(load),
        item: healthy,
        bootstrap: {
          ...snapshot(healthy),
          navigation: [healthy, { ...item, featureState: 'HIDDEN' }],
        },
      }),
    );
    await act(() => vi.advanceTimersByTimeAsync(29_999));
    expect(load).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(load).toHaveBeenCalledOnce();
    expect(result.current).toBeDefined();
  });

  it('continues global recovery after the current owner is healthy until other authorized navigation recovers', async () => {
    vi.useFakeTimers();
    const current = {
      ...item,
      featureState: 'ACTIVE' as const,
      availability: 'UP' as const,
    };
    const missing = {
      ...item,
      id: 'commerce',
      moduleName: 'commerce',
      route: '/commerce',
    };
    const partial = { ...snapshot(current), navigation: [current, missing] };
    const recovered = {
      ...partial,
      navigation: [
        current,
        { ...missing, featureState: 'ACTIVE' as const, availability: 'UP' as const },
      ],
    };
    const load = vi
      .fn()
      .mockResolvedValueOnce(partial)
      .mockResolvedValueOnce(recovered);
    renderHook(() =>
      useNavigationAvailabilityRecovery({
        ...options(load),
        item: current,
        bootstrap: partial,
      }),
    );
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(load).toHaveBeenCalledOnce();
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(load).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(29_999));
    expect(load).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(load).toHaveBeenCalledTimes(3);
  });

  it.each([
    { ...item, availability: 'UP' as const },
    { ...item, featureState: 'HIDDEN' as const },
    undefined,
    { ...item, availability: 'UNKNOWN' as const },
    {
      ...item,
      sourceTrace: {
        sourceType: 'MODULE',
        providerId: 'owner',
        ownerModule: 'workflow',
        stableIdentity: 'task',
        overrideApplied: false,
        editable: false,
        lifecycleState: 'DISABLED',
      },
    },
  ])(
    'does not retry healthy disabled, hidden, unauthorized or unknown navigation %j',
    async (selected) => {
      vi.useFakeTimers();
      const load = vi.fn().mockResolvedValue(snapshot());
      const { result } = renderHook(() =>
        useNavigationAvailabilityRecovery({ ...options(load), item: selected }),
      );
      expect(hasUnavailableNavigation(selected)).toBe(false);
      await act(() => vi.advanceTimersByTimeAsync(600_000));
      expect(load).not.toHaveBeenCalled();
      expect(result.current).toBeUndefined();
    },
  );
  it('backs off sequential owner reads and stops on recovered health without restoring a disabled feature', async () => {
    vi.useFakeTimers();
    const load = vi
      .fn()
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValueOnce(snapshot({ ...item, availability: 'UP' }));
    renderHook(() => useNavigationAvailabilityRecovery(options(load)));
    await act(() => vi.advanceTimersByTimeAsync(999));
    expect(load).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(load).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1_999));
    expect(load).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(load).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(600_000));
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('bounds observation, honors cooldown and retains one-shot explicit recovery after exhaustion', async () => {
    vi.useFakeTimers();
    const load = vi
      .fn()
      .mockRejectedValue(new AuthenticatedBootstrapUnavailableError('Wait', '30'));
    const { result } = renderHook(() =>
      useNavigationAvailabilityRecovery({ ...options(load), retryWindowMs: 5_000 }),
    );
    await act(() => vi.advanceTimersByTimeAsync(600_000));
    expect(load).toHaveBeenCalledOnce();
    expect(result.current?.message).toContain('Refresh availability');
    await act(async () => {
      result.current?.refresh();
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(600_000));
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('stops automatic reads on permanent denial and prevents overlapping manual reads', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockRejectedValue(new Error('Denied'));
    const { result } = renderHook(() =>
      useNavigationAvailabilityRecovery(options(load)),
    );
    await act(() => vi.advanceTimersByTimeAsync(300_000));
    expect(load).toHaveBeenCalledOnce();
    await act(async () => {
      result.current?.refresh();
      result.current?.refresh();
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('retires pending replies on session/context change, lock and unmount', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const releases: Array<(value: AxisAuthenticatedBootstrap) => void> = [];
    const load = vi.fn((signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<AxisAuthenticatedBootstrap>((resolve) =>
        releases.push(resolve),
      );
    });
    const { rerender, unmount } = renderHook(
      ({ scopeKey, enabled }) =>
        useNavigationAvailabilityRecovery({ ...options(load), scopeKey, enabled }),
      { initialProps: { scopeKey: 'original', enabled: true } },
    );
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    rerender({ scopeKey: 'new-session-target', enabled: true });
    expect(signals[0]?.aborted).toBe(true);
    await act(async () => {
      releases[0]?.(snapshot());
      await Promise.resolve();
    });
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(load).toHaveBeenCalledTimes(2);
    rerender({ scopeKey: 'new-session-target', enabled: false });
    expect(signals[1]?.aborted).toBe(true);
    await act(async () => {
      releases[1]?.(snapshot());
      await Promise.resolve();
    });
    await act(() => vi.advanceTimersByTimeAsync(300_000));
    expect(load).toHaveBeenCalledTimes(2);
    rerender({ scopeKey: 'unlocked', enabled: true });
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    unmount();
    expect(signals[2]?.aborted).toBe(true);
    await act(async () => {
      releases[2]?.(snapshot());
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(3);
  });
  it('renders explicit refresh only for the currently bound unavailable placeholder', () => {
    const refresh = vi.fn();
    render(
      <NavigationAvailabilityRecoveryContext.Provider
        value={{ itemId: item.id, route: item.route, refreshing: false, refresh }}
      >
        <ModuleWorkspacePlaceholder item={item} />
      </NavigationAvailabilityRecoveryContext.Provider>,
    );
    expect(screen.getByRole('button', { name: 'Refresh availability' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh availability' }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
