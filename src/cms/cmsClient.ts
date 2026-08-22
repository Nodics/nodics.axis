import { parseCmsResolvedPage, type CmsResolvedPageContract } from './cmsContract';

interface CmsResponseEnvelope {
  readonly result?: unknown;
}

const CMS_ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  ERR_CMS_00087:
    'The requested CMS route is not available for this Site. Install or update the owning content pack, then try again.',
  ERR_CMS_00088:
    'The requested CMS page is not available. Install or update the owning content pack, then try again.',
  ERR_CMS_00089:
    'The CMS page template is not available. Install or update the owning content pack, then try again.',
});

export interface ResolveCmsPageInput {
  readonly cmsBaseUrl: string;
  readonly enterpriseCode: string;
  readonly site: string;
  readonly path: string;
  readonly locale: string;
  readonly channel: string;
  readonly accessToken?: string;
  readonly etag?: string;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

export interface ResolveCmsPageResult {
  readonly status: 'resolved' | 'not-modified';
  readonly page?: CmsResolvedPageContract | undefined;
  readonly etag?: string | undefined;
}

function buildDeliveryUrl(input: ResolveCmsPageInput): URL {
  const baseUrl = new URL(input.cmsBaseUrl);
  const deliveryPath = input.accessToken
    ? '/nodics/cms/v0/delivery/pages/resolve/authenticated'
    : '/nodics/cms/v0/delivery/pages/resolve';
  const url = new URL(deliveryPath, baseUrl);
  url.searchParams.set('site', input.site);
  url.searchParams.set('path', input.path);
  url.searchParams.set('locale', input.locale);
  url.searchParams.set('channel', input.channel);
  url.searchParams.set('contractVersion', '0');
  return url;
}

function parseEnvelope(value: unknown): unknown {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !('result' in value)
  ) {
    throw new Error('CMS returned an invalid response envelope');
  }
  return (value as CmsResponseEnvelope).result;
}

async function cmsFailure(response: Response): Promise<Error> {
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.toLowerCase().includes('application/json')) {
    try {
      const body: unknown = await response.json();
      if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
        const code = (body as Record<string, unknown>).code;
        if (typeof code === 'string' && CMS_ERROR_MESSAGES[code]) {
          return new Error(CMS_ERROR_MESSAGES[code]);
        }
      }
    } catch {
      // Fall through to the bounded transport failure below.
    }
  }
  return new Error(`CMS page delivery returned HTTP ${String(response.status)}`);
}

export async function resolveCmsPage(
  input: ResolveCmsPageInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<ResolveCmsPageResult> {
  const timeoutController = new AbortController();
  const timeout = globalThis.setTimeout(
    () => timeoutController.abort(),
    input.timeoutMs,
  );
  const abortFromCaller = () => timeoutController.abort();
  input.signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const headers = new Headers({
      Accept: 'application/json',
      'x-enterprise-code': input.enterpriseCode,
    });
    if (input.accessToken) {
      headers.set('Authorization', `Bearer ${input.accessToken}`);
    }
    if (input.etag) {
      headers.set('If-None-Match', input.etag);
    }

    const response = await fetchImplementation(buildDeliveryUrl(input), {
      method: 'GET',
      headers,
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: timeoutController.signal,
    });

    if (response.status === 304) {
      return Object.freeze({
        status: 'not-modified' as const,
        etag: response.headers.get('ETag') ?? input.etag,
      });
    }
    if (!response.ok) {
      throw await cmsFailure(response);
    }

    let document: unknown;
    try {
      document = await response.json();
    } catch {
      throw new Error('CMS page delivery returned invalid JSON');
    }

    return Object.freeze({
      status: 'resolved' as const,
      page: parseCmsResolvedPage(parseEnvelope(document)),
      etag: response.headers.get('ETag') ?? undefined,
    });
  } catch (error: unknown) {
    if (timeoutController.signal.aborted) {
      throw new Error('CMS page delivery was cancelled or timed out');
    }
    throw error instanceof Error
      ? error
      : new Error('CMS page delivery failed unexpectedly');
  } finally {
    globalThis.clearTimeout(timeout);
    input.signal?.removeEventListener('abort', abortFromCaller);
  }
}
