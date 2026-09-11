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

export async function loadPublicBackendWorkspace(
  runtime: AxisRuntimeConfig,
): Promise<AxisBackendWorkspace> {
  const response = await fetch(
    new URL(
      '/nodics/profile/v0/enterprise-access/workspace',
      runtime.backofficeBaseUrl,
    ),
    {
      cache: 'no-store',
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        'x-enterprise-code': runtime.enterpriseCode,
      },
      redirect: 'error',
    },
  );
  if (!response.ok) throw new Error(await errorMessage(response));
  return parseBackendWorkspace(envelopeData(await response.json()));
}
