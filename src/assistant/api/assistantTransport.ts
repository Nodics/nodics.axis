import { assistantEnvelopeData } from './assistantContractParsers';
import { assistantApiError } from './assistantError';

export interface AssistantTransportConfiguration {
  readonly moduleBaseUrl: string;
  readonly enterpriseCode: string;
  readonly accessToken: string;
  readonly timeoutMs: number;
}

export interface AssistantRequestOptions {
  readonly method?: 'GET' | 'POST';
  readonly body?: Readonly<Record<string, unknown>> | undefined;
  readonly idempotencyKey?: string | undefined;
  readonly query?: Readonly<Record<string, string | number | undefined>> | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface AssistantTransport {
  readonly moduleBaseUrl: string;
  readonly configuration: AssistantTransportConfiguration;
  request(path: string, options?: AssistantRequestOptions): Promise<unknown>;
}

export function safeAssistantBaseUrl(value: string): string {
  const parsed = new URL(value);
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('Assistant module endpoint is invalid');
  }
  return parsed.toString().replace(/\/$/, '');
}

export function assistantPathSegment(value: string, name: string): string {
  if (!/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(value)) {
    throw new Error(`${name} is invalid`);
  }
  return encodeURIComponent(value);
}

export function createAssistantTransport(
  configuration: AssistantTransportConfiguration,
  fetchImplementation: typeof fetch = fetch,
): AssistantTransport {
  const moduleBaseUrl = safeAssistantBaseUrl(configuration.moduleBaseUrl);
  if (!configuration.accessToken) {
    throw new Error('Assistant client requires an employee access token');
  }
  if (!configuration.enterpriseCode) {
    throw new Error('Assistant client requires an enterprise context');
  }
  if (!Number.isSafeInteger(configuration.timeoutMs) || configuration.timeoutMs < 1) {
    throw new Error('Assistant client timeout is invalid');
  }

  const request = async (
    path: string,
    options: AssistantRequestOptions = {},
  ): Promise<unknown> => {
    options.signal?.throwIfAborted();
    const url = new URL(`${moduleBaseUrl}/v0${path}`);
    Object.entries(options.query ?? {}).forEach(([name, value]) => {
      if (value !== undefined) url.searchParams.set(name, String(value));
    });
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', abort, { once: true });
    const timeout = globalThis.setTimeout(
      () => controller.abort(),
      configuration.timeoutMs,
    );
    const headers = new Headers({
      Accept: 'application/json',
      Authorization: `Bearer ${configuration.accessToken}`,
      'x-enterprise-code': configuration.enterpriseCode,
    });
    if (options.body) headers.set('Content-Type', 'application/json');
    if (options.idempotencyKey) {
      headers.set('Idempotency-Key', options.idempotencyKey);
    }
    try {
      const response = await fetchImplementation(url, {
        method: options.method ?? 'GET',
        headers,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      });
      if (!response.ok) throw await assistantApiError(response);
      return assistantEnvelopeData(await response.json());
    } catch (error: unknown) {
      if (controller.signal.aborted && !options.signal?.aborted) {
        throw new Error('Assistant request timed out');
      }
      throw error;
    } finally {
      globalThis.clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
    }
  };

  return Object.freeze({ configuration, moduleBaseUrl, request });
}
