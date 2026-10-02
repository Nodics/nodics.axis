/**
 * @module axis/auth/employeeAuthClient
 * @description Typed browser transport for Profile-owned Employee authentication, restore, logout and accepted-membership switching.
 * @owner nodics.platform
 * @customization Use the discovered same-project Profile connection and declared cookie policy; never introduce credential storage, refresh JSON or browser-owned identity authority.
 */
export interface EmployeeSession {
  readonly accessToken: string;
  readonly loginId: string;
  /** Non-secret routing context accepted by the Profile authentication request. */
  readonly enterpriseCode?: string;
  readonly generation: number;
}
let lastAdmissionGeneration = 0;
/** Monotonic in-memory admission identity, including two sign-ins in one millisecond. */
function nextAdmissionGeneration(): number {
  lastAdmissionGeneration = Math.max(Date.now(), lastAdmissionGeneration + 1);
  return lastAdmissionGeneration;
}

/** Switches one same-project accepted membership through access + HttpOnly refresh + CSRF proof. Never auto-retries. */
export async function switchEmployeeEnterprise(
  profileBaseUrl: string,
  current: EmployeeSession,
  enterpriseCode: string,
  assignment: {
    readonly code: string;
    readonly revision: number;
    readonly enterpriseCode: string;
  },
  csrfCookieName: string,
  timeoutMs: number,
  fetchImplementation: typeof fetch = fetch,
): Promise<EmployeeSession> {
  const csrfToken = csrfCookie(csrfCookieName);
  if (
    !csrfToken ||
    !assignment.code ||
    !Number.isSafeInteger(assignment.revision) ||
    assignment.revision < 1 ||
    assignment.enterpriseCode === enterpriseCode
  )
    throw new Error('Enterprise context switch is unavailable.');
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImplementation(
      new URL(
        '/nodics/profile/v0/employee/browser/switch-enterprise',
        browserScopedProfileUrl(profileBaseUrl),
      ),
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + current.accessToken,
          'X-CSRF-Token': csrfToken,
          'x-enterprise-code': enterpriseCode,
        },
        body: JSON.stringify({
          assignmentCode: assignment.code,
          revision: assignment.revision,
        }),
        cache: 'no-store',
        credentials: 'include',
        redirect: 'error',
        signal: controller.signal,
      },
    );
    if (!response.ok)
      throw new Error('Enterprise context could not be confirmed. Sign in again.');
    const envelope: unknown = await response.json();
    if (
      !envelope ||
      typeof envelope !== 'object' ||
      (envelope as { code?: unknown }).code !== 'SUC_AUTH_00000'
    )
      throw new Error('Enterprise context could not be confirmed. Sign in again.');
    const tokens = tokenEnvelope(envelope);
    const result = (envelope as { result: { enterpriseCode?: unknown } }).result;
    if (!tokens.loginId || result.enterpriseCode !== assignment.enterpriseCode)
      throw new Error('Enterprise context could not be confirmed. Sign in again.');
    return Object.freeze({
      accessToken: tokens.authToken,
      loginId: tokens.loginId,
      enterpriseCode: assignment.enterpriseCode,
      generation: nextAdmissionGeneration(),
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
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

/** Resolves the discovered Profile connection without changing the project endpoint.
 * Shared by employee authentication and registration. Credentials in URLs,
 * fragments, query strings and non-loopback plaintext connections are rejected.
 */
export function browserScopedProfileUrl(profileBaseUrl: string): URL {
  const url = new URL(profileBaseUrl);
  const hosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol === 'http:' && !hosts.has(url.hostname))
  ) {
    throw new Error('Profile connection is invalid.');
  }
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

/** Establishes a Profile PASSWORD browser session; credentials are transient request input, never persisted by this client. */
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
      generation: nextAdmissionGeneration(),
      enterpriseCode,
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

/** Asks Profile to revoke the scoped cookie session using current enterprise and CSRF proof. */
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

/** Rotates Profile's HttpOnly proof and restores only access data to memory in the same project. */
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
      generation: nextAdmissionGeneration(),
      enterpriseCode,
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
import { parseAxisApiError } from '../localization/axisApiError';
