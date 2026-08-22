export interface EmployeeSession {
  readonly accessToken: string;
  readonly loginId: string;
  readonly generation: number;
}

function tokenEnvelope(value: unknown): { authToken: string; loginId?: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Profile returned an invalid authentication response');
  }
  const result = (value as { result?: unknown }).result;
  if (typeof result !== 'object' || result === null || Array.isArray(result)) {
    throw new Error('Profile returned an invalid authentication result');
  }
  const { authToken, loginId } = result as Record<string, unknown>;
  if (typeof authToken !== 'string' || authToken === '') {
    throw new Error('Profile did not return the required employee access token');
  }
  return {
    authToken,
    ...(typeof loginId === 'string' && loginId ? { loginId } : {}),
  };
}

function csrfCookie(cookieName: string): string {
  const prefix = `${cookieName}=`;
  const value = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length);
  return value ? decodeURIComponent(value) : '';
}

function browserScopedProfileUrl(profileBaseUrl: string): URL {
  const url = new URL(profileBaseUrl);
  const browserHost = window.location.hostname;
  const profileHost = url.hostname;
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  if (
    loopbackHosts.has(browserHost) &&
    loopbackHosts.has(profileHost) &&
    url.protocol === window.location.protocol
  ) {
    url.hostname = browserHost;
  }
  return url;
}

export async function authenticateEmployee(
  profileBaseUrl: string,
  enterpriseCode: string,
  loginId: string,
  password: string,
  timeoutMs: number,
  fetchImplementation: typeof fetch = fetch,
): Promise<EmployeeSession> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImplementation(
      new URL(
        '/nodics/profile/v0/employee/browser/authenticate',
        browserScopedProfileUrl(profileBaseUrl),
      ),
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-enterprise-code': enterpriseCode,
        },
        body: JSON.stringify({ loginId, password }),
        cache: 'no-store',
        credentials: 'include',
        redirect: 'error',
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw await parseAxisApiError(
        response,
        response.status === 401
          ? 'Profile could not establish a secure browser session.'
          : `Profile authentication returned HTTP ${String(response.status)}`,
      );
    }
    const tokens = tokenEnvelope(await response.json());
    return Object.freeze({
      accessToken: tokens.authToken,
      loginId,
      generation: Date.now(),
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function logoutEmployee(
  profileBaseUrl: string,
  enterpriseCode: string,
  csrfCookieName: string,
  timeoutMs: number,
  fetchImplementation: typeof fetch = fetch,
): Promise<void> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImplementation(
      new URL(
        '/nodics/profile/v0/employee/browser/logout',
        browserScopedProfileUrl(profileBaseUrl),
      ),
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfCookie(csrfCookieName),
          'x-enterprise-code': enterpriseCode,
        },
        body: '{}',
        cache: 'no-store',
        credentials: 'include',
        redirect: 'error',
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw new Error('Profile could not complete secure logout');
    }
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function restoreEmployeeSession(
  profileBaseUrl: string,
  enterpriseCode: string,
  csrfCookieName: string,
  timeoutMs: number,
  fetchImplementation: typeof fetch = fetch,
): Promise<EmployeeSession> {
  const csrfToken = csrfCookie(csrfCookieName);
  if (!csrfToken) throw new Error('No browser session is available');
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImplementation(
      new URL(
        '/nodics/profile/v0/employee/browser/restore',
        browserScopedProfileUrl(profileBaseUrl),
      ),
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'x-enterprise-code': enterpriseCode,
        },
        body: '{}',
        cache: 'no-store',
        credentials: 'include',
        redirect: 'error',
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error('The browser session is no longer valid');
    const tokens = tokenEnvelope(await response.json());
    if (!tokens.loginId)
      throw new Error('Profile did not restore the employee identity');
    return Object.freeze({
      accessToken: tokens.authToken,
      loginId: tokens.loginId,
      generation: Date.now(),
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
import { parseAxisApiError } from '../localization/axisApiError';
