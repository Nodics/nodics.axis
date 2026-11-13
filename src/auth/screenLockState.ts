const SCREEN_LOCK_STORAGE_KEY = 'nodics-axis-screen-lock-v1';
const DEFAULT_RETURN_PATH = '/dashboard';
const EXCLUDED_RETURN_PATHS = new Set(['/login', '/forgot-password', '/lock-screen']);

interface PersistedScreenLock {
  readonly locked: true;
  readonly returnPath: string;
}

function isApplicationLocation(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !EXCLUDED_RETURN_PATHS.has(value.split(/[?#]/, 1)[0]!) &&
    ![...value].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  );
}

function safeReturnPath(value: unknown): string {
  return isApplicationLocation(value) && value.length <= 512
    ? value
    : DEFAULT_RETURN_PATH;
}

/** Volatile same-application detail location for a verified same-context unlock. Never persist its query or fragment. */
export function screenLockReturnLocation(
  pathname: string,
  search = '',
  hash = '',
): string {
  if (
    !isApplicationLocation(pathname) ||
    pathname.includes('?') ||
    pathname.includes('#')
  )
    return DEFAULT_RETURN_PATH;
  if ((search && !search.startsWith('?')) || (hash && !hash.startsWith('#')))
    return pathname;
  const value = `${pathname}${search}${hash}`;
  return isApplicationLocation(value) ? value : pathname;
}

/**
 * Persists only the browser presentation gate. Credentials, access tokens,
 * refresh tokens, employee data, and backend payloads must never be stored
 * here.
 */
export function persistScreenLock(
  returnPath: string,
  storage: Pick<Storage, 'setItem'> = window.sessionStorage,
): void {
  const state: PersistedScreenLock = {
    locked: true,
    returnPath: safeReturnPath(returnPath),
  };
  storage.setItem(SCREEN_LOCK_STORAGE_KEY, JSON.stringify(state));
}

export function restoreScreenLock(
  storage: Pick<Storage, 'getItem' | 'removeItem'> = window.sessionStorage,
): PersistedScreenLock | undefined {
  const encoded = storage.getItem(SCREEN_LOCK_STORAGE_KEY);
  if (!encoded) return undefined;
  try {
    const value = JSON.parse(encoded) as Record<string, unknown>;
    if (value.locked !== true) throw new Error('Screen lock marker is invalid');
    return { locked: true, returnPath: safeReturnPath(value.returnPath) };
  } catch {
    storage.removeItem(SCREEN_LOCK_STORAGE_KEY);
    return undefined;
  }
}

export function clearScreenLock(
  storage: Pick<Storage, 'removeItem'> = window.sessionStorage,
): void {
  storage.removeItem(SCREEN_LOCK_STORAGE_KEY);
}
