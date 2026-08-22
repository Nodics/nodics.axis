import type { AxisLocalizationBundle } from './localizationContracts';

const MAXIMUM_BUNDLE_KEYS = 10_000;

function parseBundle(value: unknown): AxisLocalizationBundle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Localization returned an invalid bundle');
  }
  const bundle = value as Record<string, unknown>;
  if (
    bundle.contractVersion !== 0 ||
    typeof bundle.locale !== 'string' ||
    typeof bundle.scopeCode !== 'string' ||
    typeof bundle.channel !== 'string' ||
    typeof bundle.releaseVersion !== 'string' ||
    !Array.isArray(bundle.namespaces) ||
    !bundle.entries ||
    typeof bundle.entries !== 'object' ||
    Array.isArray(bundle.entries)
  ) {
    throw new Error('Localization bundle contract is incompatible');
  }
  const entries = Object.entries(bundle.entries);
  if (
    entries.length > MAXIMUM_BUNDLE_KEYS ||
    entries.some(
      ([key, message]) =>
        !/^[a-z][a-z0-9.-]*\.[a-z][a-z0-9._-]*$/.test(key) ||
        typeof message !== 'string',
    )
  ) {
    throw new Error('Localization bundle entries are invalid');
  }
  return Object.freeze({
    contractVersion: 0,
    locale: bundle.locale,
    scopeCode: bundle.scopeCode,
    channel: bundle.channel,
    releaseVersion: bundle.releaseVersion,
    namespaces: Object.freeze(bundle.namespaces as string[]),
    entries: Object.freeze(Object.fromEntries(entries) as Record<string, string>),
  });
}

export async function loadLocalizationBundle(
  endpoint: string,
  enterpriseCode: string,
  locale: string,
  site: string,
  channel: string,
  namespaces: readonly string[],
  timeoutMs: number,
  etag?: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<{
  readonly bundle?: AxisLocalizationBundle;
  readonly etag?: string;
  readonly notModified: boolean;
}> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(
      `/nodics/localizationApi/v0/localization/bundles/${encodeURIComponent(locale)}`,
      endpoint,
    );
    url.searchParams.set('scopeCode', site);
    url.searchParams.set('channel', channel);
    url.searchParams.set('namespaces', namespaces.join(','));
    const response = await fetchImplementation(url, {
      headers: {
        Accept: 'application/json',
        'x-enterprise-code': enterpriseCode,
        ...(etag ? { 'If-None-Match': etag } : {}),
      },
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    if (response.status === 304)
      return { ...(etag ? { etag } : {}), notModified: true };
    if (!response.ok)
      throw new Error(`Localization returned HTTP ${String(response.status)}`);
    const envelope: unknown = await response.json();
    const data =
      envelope && typeof envelope === 'object' && !Array.isArray(envelope)
        ? ((envelope as Record<string, unknown>).data ?? envelope)
        : envelope;
    const record = data as Record<string, unknown>;
    const bundle = parseBundle(record.bundle ?? record);
    return {
      bundle,
      ...(response.headers.get('etag')
        ? { etag: response.headers.get('etag') ?? '' }
        : {}),
      notModified: false,
    };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
