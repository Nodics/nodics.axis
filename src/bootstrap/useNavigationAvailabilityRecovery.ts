/** Authenticated navigation observation with bounded failure recovery; never a session issuer, permission grant or command retry. */
import {
  createContext,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import {
  AuthenticatedBootstrapUnavailableError,
  type AxisAuthenticatedBootstrap,
  type AxisNavigationItem,
} from './publicBootstrap';

export interface NavigationAvailabilityRecovery {
  readonly itemId: string;
  readonly route: string;
  readonly refreshing: boolean;
  readonly message?: string;
  readonly refresh: () => void;
}
export const NavigationAvailabilityRecoveryContext = createContext<
  NavigationAvailabilityRecovery | undefined
>(undefined);

/** A disabled feature with healthy health is not a transport outage or a grant to retry. */
export function hasUnavailableNavigation(
  item: AxisNavigationItem | undefined,
): boolean {
  return (
    item?.availability === 'UNAVAILABLE' &&
    item.featureState !== 'HIDDEN' &&
    !['DISABLED', 'HIDDEN'].includes(item.sourceTrace?.lifecycleState ?? '')
  );
}

/** Observes only owner-published transient navigation health, never absent permissions. */
export function hasUnavailableBootstrap(
  bootstrap: AxisAuthenticatedBootstrap | undefined,
): boolean {
  return bootstrap?.navigation.some(hasUnavailableNavigation) === true;
}

/** Healthy catalogues remain observable through sequential GETs; each outage has a bounded recovery window without inferred modules or permissions. */
export function useNavigationAvailabilityRecovery(options: {
  readonly item: AxisNavigationItem | undefined;
  readonly bootstrap?: AxisAuthenticatedBootstrap | undefined;
  readonly enabled: boolean;
  readonly scopeKey: string;
  readonly retryWindowMs: number;
  readonly load: (
    signal: AbortSignal,
  ) => Promise<AxisAuthenticatedBootstrap | undefined>;
}): NavigationAvailabilityRecovery | undefined {
  const { item, bootstrap, enabled, scopeKey, retryWindowMs, load } = options;
  const itemId = item?.id ?? '';
  const route = item?.route ?? '';
  const moduleName = item?.moduleName ?? '';
  const global = bootstrap !== undefined;
  const active = enabled && (global || hasUnavailableNavigation(item));
  // Global observation belongs to the authenticated scope, not the selected page.
  const observedItemId = global ? '' : itemId;
  const observedRoute = global ? '' : route;
  const observedModule = global ? '' : moduleName;
  const key = global
    ? `${scopeKey}:catalogue`
    : `${scopeKey}:${moduleName}:${itemId}:${route}`;
  const [state, setState] = useState<{
    key: string;
    refreshing: boolean;
    message?: string;
  }>({ key: '', refreshing: false });
  const manager = useRef<{ key: string; refresh: () => void } | undefined>(undefined);
  const refresh = useCallback(() => manager.current?.refresh(), []);
  const startsUnavailable = useEffectEvent(() => hasUnavailableBootstrap(bootstrap));
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const windowMs = Math.min(600_000, Math.max(1_000, retryWindowMs));
    let deadline = global && !startsUnavailable() ? undefined : Date.now() + windowMs;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let attempts = 0;
    let stopped = false;
    const update = (refreshing: boolean, message?: string) => {
      if (!controller.signal.aborted)
        setState({ key, refreshing, ...(message ? { message } : {}) });
    };
    const schedule = (minimumDelay = 0, healthyCatalogue = false) => {
      const delay = Math.max(
        healthyCatalogue
          ? 30_000
          : Math.min(1_000 * 2 ** Math.min(attempts, 4), 10_000),
        minimumDelay,
      );
      if (stopped || controller.signal.aborted) return;
      if (healthyCatalogue) deadline = undefined;
      else deadline ??= Date.now() + windowMs;
      if (deadline !== undefined && Date.now() + delay > deadline) {
        stopped = true;
        update(
          false,
          healthyCatalogue
            ? undefined
            : 'Availability has not recovered yet. Refresh availability to check again.',
        );
        return;
      }
      timer = setTimeout(() => {
        void read();
      }, delay);
    };
    const read = async () => {
      if (inFlight || controller.signal.aborted) return;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      inFlight = true;
      update(true, 'Checking workspace availability.');
      try {
        const next = await load(controller.signal);
        if (controller.signal.aborted) return;
        if (!next) {
          stopped = true;
          update(false);
          return;
        }
        const matches = next.navigation.filter(
          (entry) =>
            entry.id === observedItemId &&
            entry.moduleName === observedModule &&
            entry.route === observedRoute,
        );
        const stillUnavailable = global
          ? hasUnavailableBootstrap(next)
          : matches.length === 1 && hasUnavailableNavigation(matches[0]);
        if (!stillUnavailable) {
          update(false);
          if (global) {
            attempts = 0;
            stopped = false;
            schedule(0, true);
          } else stopped = true;
          return;
        }
        update(false, 'The workspace is temporarily unavailable.');
        attempts++;
        schedule();
      } catch (error) {
        if (controller.signal.aborted) return;
        if (!(error instanceof AuthenticatedBootstrapUnavailableError)) {
          stopped = true;
          update(
            false,
            'Availability could not be refreshed. Refresh availability to check again.',
          );
          return;
        }
        update(false, 'The service is temporarily unavailable.');
        attempts++;
        schedule(error.retryAfterMs);
      } finally {
        inFlight = false;
      }
    };
    manager.current = {
      key,
      refresh: () => {
        void read();
      },
    };
    schedule(0, global && !startsUnavailable());
    return () => {
      controller.abort();
      if (timer !== undefined) clearTimeout(timer);
      if (manager.current?.key === key) manager.current = undefined;
    };
  }, [
    active,
    global,
    observedItemId,
    observedRoute,
    observedModule,
    key,
    retryWindowMs,
    load,
  ]);
  if (!active) return undefined;
  return {
    itemId,
    route,
    refreshing: state.key === key && state.refreshing,
    ...(state.key === key && state.message ? { message: state.message } : {}),
    refresh,
  };
}
