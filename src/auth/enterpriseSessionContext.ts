/**
 * Non-secret within-project enterprise routing hints. These values never grant
 * access, choose another backend/project, or replace Profile credential/cookie
 * validation. No email, OTP, password, bearer or continuation is stored here.
 */
export function enterpriseContextCode(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)
    ? value
    : undefined;
}
function contextKey(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Invalid Axis project endpoint.');
  return 'axis:employee-enterprise:' + url.origin + url.pathname.replace(/\/+$/, '');
}
/** Reads a routing hint only for this configured project. Forged hints still fail Profile authentication. */
export function readEnterpriseContext(
  baseUrl: string,
  storage?: Pick<Storage, 'getItem'>,
): string | undefined {
  try {
    return enterpriseContextCode(
      (storage ?? window.sessionStorage).getItem(contextKey(baseUrl)),
    );
  } catch {
    return undefined;
  }
}
/** Retains only the enterprise that the normal Profile login/restore just accepted. */
export function rememberEnterpriseContext(
  baseUrl: string,
  code: string,
  storage?: Pick<Storage, 'setItem'>,
): void {
  if (!enterpriseContextCode(code))
    throw new Error('Invalid employee enterprise context.');
  try {
    (storage ?? window.sessionStorage).setItem(contextKey(baseUrl), code);
  } catch {
    /* Session works in memory; reload may need another sign-in. */
  }
}
/** Clears a routing hint after confirmed logout or an uncertain explicit context switch, not ordinary session expiry. */
export function clearEnterpriseContext(
  baseUrl: string,
  storage?: Pick<Storage, 'removeItem'>,
): void {
  try {
    (storage ?? window.sessionStorage).removeItem(contextKey(baseUrl));
  } catch {
    /* Not authentication state. */
  }
}
/** Accepts a validated non-secret handoff only on the existing sign-in route. */
export function registrationSignInContext(
  pathname: string,
  state: unknown,
): string | undefined {
  if (
    pathname !== '/login' ||
    !state ||
    typeof state !== 'object' ||
    Array.isArray(state)
  )
    return undefined;
  const hint = (state as Record<string, unknown>).registrationSignIn;
  return hint && typeof hint === 'object' && !Array.isArray(hint)
    ? enterpriseContextCode((hint as Record<string, unknown>).enterpriseCode)
    : undefined;
}
