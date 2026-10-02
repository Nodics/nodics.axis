import { browserScopedProfileUrl } from '../auth/employeeAuthClient';
import {
  parseBackendWorkspace,
  type AxisBackendWorkspace,
} from '../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';

/** Transport helpers for the backend-owned enterprise workspace contract. */
export function envelopeData(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Backend workspace response is invalid');
  }
  const envelope = value as Record<string, unknown>;
  if (
    envelope.success === false ||
    envelope.error ||
    (envelope.code !== undefined &&
      (typeof envelope.code !== 'string' || envelope.code.startsWith('ERR_'))) ||
    (Array.isArray(envelope.errors) && envelope.errors.length)
  ) {
    throw new Error('Backend workspace response could not be confirmed');
  }
  if ('data' in value) return (value as { readonly data: unknown }).data;
  if ('result' in value) return (value as { readonly result: unknown }).result;
  return value;
}

export async function errorMessage(response: Response): Promise<string> {
  try {
    const value: unknown = await response.json();
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const message = (value as Record<string, unknown>).message;
      if (typeof message === 'string' && message.trim() && message.length < 500) {
        return message;
      }
    }
  } catch {
    // Preserve HTTP fallback.
  }
  return `Backend workspace request returned HTTP ${String(response.status)}`;
}

/** Carries only actual HTTP status and bounded owner error code; messages/body flags never prove a pre-write refusal. */
export class BackendWorkspaceHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'BackendWorkspaceHttpError';
  }
}

/** Preserves typed owner evidence without exposing an entire failed response. */
export async function backendWorkspaceResponseError(
  response: Response,
): Promise<BackendWorkspaceHttpError> {
  let code: string | undefined;
  try {
    const body: unknown = await response.clone().json();
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const candidate = (body as Record<string, unknown>).code;
      if (typeof candidate === 'string' && /^ERR_[A-Z0-9_]{1,120}$/.test(candidate))
        code = candidate;
    }
  } catch {
    /* Missing typed evidence remains an uncertain outcome. */
  }
  return new BackendWorkspaceHttpError(
    await errorMessage(response),
    response.status,
    code,
  );
}

/** Loads Profile's public contract from the already discovered Profile endpoint.
 * BackOffice remains the project/bootstrap owner, not a fallback identity proxy.
 * Cancelling discovery never cancels a submitted business operation.
 */
export async function loadPublicBackendWorkspacePayload(
  runtime: AxisRuntimeConfig,
  profileBaseUrl: string,
  signal?: AbortSignal,
  journey: 'registration' | 'recovery' = 'registration',
): Promise<unknown> {
  const base = browserScopedProfileUrl(profileBaseUrl);
  if (
    !Number.isSafeInteger(runtime.requestTimeoutMs) ||
    runtime.requestTimeoutMs < 1 ||
    runtime.requestTimeoutMs > 120000
  ) {
    throw new Error('Backend workspace timeout is invalid');
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = globalThis.setTimeout(abort, runtime.requestTimeoutMs);
  try {
    const response = await fetch(
      new URL(
        journey === 'recovery'
          ? '/nodics/profile/v0/employee-recovery/workspace'
          : '/nodics/profile/v0/enterprise-access/workspace',
        base,
      ),
      {
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'x-enterprise-code': runtime.enterpriseCode,
        },
      },
    );
    if (!response.ok) throw new Error(await errorMessage(response));
    return envelopeData(await response.json());
  } finally {
    globalThis.clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

/** Parses the established generic renderer only when its Profile contract is returned. */
export async function loadPublicBackendWorkspace(
  runtime: AxisRuntimeConfig,
  profileBaseUrl: string,
): Promise<AxisBackendWorkspace> {
  return parseBackendWorkspace(
    await loadPublicBackendWorkspacePayload(runtime, profileBaseUrl),
  );
}
