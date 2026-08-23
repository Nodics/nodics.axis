import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';

export interface NavigationCompositionClientConfiguration {
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly projectCode: string;
  readonly timeoutMs: number;
}

export type NavigationCompositionAction =
  | 'preview'
  | 'export'
  | 'createDraft'
  | 'submit'
  | 'approve'
  | 'publish'
  | 'rollback';

function envelopeData(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Navigation composition returned an invalid response');
  }
  if ('result' in value) return (value as { readonly result: unknown }).result;
  if ('data' in value) return (value as { readonly data: unknown }).data;
  throw new Error('Navigation composition response does not contain data');
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const value: unknown = await response.json();
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const message = (value as Record<string, unknown>).message;
      if (typeof message === 'string' && message.trim() && message.length <= 500) {
        return message;
      }
    }
  } catch {
    // Preserve bounded HTTP fallback.
  }
  return `Navigation composition request returned HTTP ${String(response.status)}`;
}

function navigationPath(
  path: string,
  configuration: NavigationCompositionClientConfiguration,
): string {
  return `${path}${path.includes('?') ? '&' : '?'}project=${encodeURIComponent(
    configuration.projectCode,
  )}`;
}

async function request(
  connection: AxisModuleConnection,
  path: string,
  configuration: NavigationCompositionClientConfiguration,
  options: RequestInit = {},
  fetchImplementation: typeof fetch = fetch,
): Promise<unknown> {
  const endpoint = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('BackOffice endpoint is invalid');
  }
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const response = await fetchImplementation(
      new URL(`${endpoint.toString().replace(/\/$/, '')}/v0${path}`),
      {
        ...options,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${configuration.accessToken}`,
          'Content-Type': 'application/json',
          'x-enterprise-code': configuration.enterpriseCode,
          ...options.headers,
        },
      },
    );
    if (!response.ok) throw new Error(await errorMessage(response));
    return envelopeData(await response.json());
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      throw new Error('Navigation composition request timed out');
    }
    throw error instanceof Error
      ? error
      : new Error('Navigation composition request failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function executeNavigationCompositionAction(
  connection: AxisModuleConnection,
  configuration: NavigationCompositionClientConfiguration,
  action: NavigationCompositionAction,
  candidate?: unknown,
  fetchImplementation: typeof fetch = fetch,
): Promise<unknown> {
  const body = candidate === undefined
    ? undefined
    : JSON.stringify({
        candidate,
        reason: 'Axis Navigation Composition governed lifecycle action.',
      });
  const routes: Record<NavigationCompositionAction, Readonly<{ method: 'GET' | 'POST'; path: string }>> = {
    preview: { method: 'POST', path: '/navigation/composition/preview' },
    export: { method: 'GET', path: '/navigation/composition/export' },
    createDraft: { method: 'POST', path: '/navigation/composition/draft' },
    submit: { method: 'POST', path: '/navigation/composition/draft/submit' },
    approve: { method: 'POST', path: '/navigation/composition/draft/approve' },
    publish: { method: 'POST', path: '/navigation/composition/draft/publish' },
    rollback: { method: 'POST', path: '/navigation/composition/rollback' },
  };
  const route = routes[action];
  return request(
    connection,
    navigationPath(route.path, configuration),
    configuration,
    {
      method: route.method,
      ...(body && route.method === 'POST' ? { body } : {}),
    },
    fetchImplementation,
  );
}
