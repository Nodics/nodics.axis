const STORAGE_KEY = 'nodics-axis-navigation-preferences-v2';
const DEFAULT_MAX_ITEMS = 12;
const MIN_ITEMS = 1;
const MAX_ITEMS = 24;

export interface NavigationPreferences {
  readonly favourites: readonly string[];
  readonly recents: readonly string[];
}

export interface NavigationPreferenceLimits {
  readonly favouriteItems?: number | undefined;
  readonly recentItems?: number | undefined;
}

/** Non-secret signed employee context; this identifies presentation state, never authority. */
export interface NavigationPreferenceScope {
  readonly employeeId: string;
  readonly tenantCode: string;
  readonly enterpriseCode: string;
  readonly environments: readonly string[];
}

/** Returns an unambiguous owner key, refusing incomplete context and unowned legacy state. */
export function navigationPreferenceStorageKey(
  scope: NavigationPreferenceScope | undefined,
): string | undefined {
  const coordinate = (value: unknown): value is string =>
    typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value);
  if (
    !scope ||
    typeof scope.employeeId !== 'string' ||
    !scope.employeeId.trim() ||
    scope.employeeId.length > 320 ||
    !coordinate(scope.tenantCode) ||
    !coordinate(scope.enterpriseCode) ||
    !Array.isArray(scope.environments) ||
    scope.environments.length === 0 ||
    !scope.environments.every(coordinate)
  )
    return undefined;
  return `${STORAGE_KEY}:${encodeURIComponent(
    JSON.stringify([
      scope.employeeId,
      scope.tenantCode,
      scope.enterpriseCode,
      [...new Set(scope.environments)].sort(),
    ]),
  )}`;
}

const emptyPreferences: NavigationPreferences = Object.freeze({
  favourites: Object.freeze([]),
  recents: Object.freeze([]),
});

function boundedLimit(value: number | undefined): number {
  if (!Number.isInteger(value)) return DEFAULT_MAX_ITEMS;
  return Math.min(Math.max(Number(value), MIN_ITEMS), MAX_ITEMS);
}

function boundedKeys(value: unknown, limit: number): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    [
      ...new Set(
        value.filter(
          (item): item is string =>
            typeof item === 'string' &&
            /^[A-Za-z][A-Za-z0-9_-]{0,127}:[A-Za-z][A-Za-z0-9_-]{0,127}$/u.test(item),
        ),
      ),
    ].slice(0, limit),
  );
}

export function navigationItemKey(moduleName: string, id: string): string {
  return `${moduleName}:${id}`;
}

export function loadNavigationPreferences(
  scope: NavigationPreferenceScope | undefined,
  storage: Pick<Storage, 'getItem'> = window.localStorage,
  limits: NavigationPreferenceLimits = {},
): NavigationPreferences {
  const key = navigationPreferenceStorageKey(scope);
  if (!key) return emptyPreferences;
  const favouriteLimit = boundedLimit(limits.favouriteItems);
  const recentLimit = boundedLimit(limits.recentItems);
  try {
    const raw = storage.getItem(key);
    if (!raw) return emptyPreferences;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return emptyPreferences;
    }
    const preferences = value as Record<string, unknown>;
    return Object.freeze({
      favourites: boundedKeys(preferences.favourites, favouriteLimit),
      recents: boundedKeys(preferences.recents, recentLimit),
    });
  } catch {
    return emptyPreferences;
  }
}

export function saveNavigationPreferences(
  preferences: NavigationPreferences,
  scope: NavigationPreferenceScope | undefined,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
  limits: NavigationPreferenceLimits = {},
): void {
  const key = navigationPreferenceStorageKey(scope);
  if (!key) return;
  const favouriteLimit = boundedLimit(limits.favouriteItems);
  const recentLimit = boundedLimit(limits.recentItems);
  try {
    storage.setItem(
      key,
      JSON.stringify({
        favourites: boundedKeys(preferences.favourites, favouriteLimit),
        recents: boundedKeys(preferences.recents, recentLimit),
      }),
    );
  } catch {
    // Unavailable preference storage must not interrupt authorized navigation.
    return;
  }
}

export function toggleNavigationFavourite(
  preferences: NavigationPreferences,
  key: string,
  limits: NavigationPreferenceLimits = {},
): NavigationPreferences {
  const favouriteLimit = boundedLimit(limits.favouriteItems);
  const favourites = preferences.favourites.includes(key)
    ? preferences.favourites.filter((item) => item !== key)
    : [key, ...preferences.favourites];
  return Object.freeze({
    favourites: boundedKeys(favourites, favouriteLimit),
    recents: preferences.recents,
  });
}

export function recordRecentNavigation(
  preferences: NavigationPreferences,
  key: string,
  limits: NavigationPreferenceLimits = {},
): NavigationPreferences {
  const recentLimit = boundedLimit(limits.recentItems);
  return Object.freeze({
    favourites: preferences.favourites,
    recents: boundedKeys(
      [key, ...preferences.recents.filter((item) => item !== key)],
      recentLimit,
    ),
  });
}
