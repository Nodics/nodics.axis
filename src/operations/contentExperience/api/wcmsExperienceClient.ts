import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';

export interface WcmsExperienceClientConfiguration {
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly timeoutMs: number;
}

export interface WcmsExperienceResolveRequest {
  readonly site: string;
  readonly pageType: string;
  readonly targetType: string;
  readonly targetCode: string;
  readonly locale: string;
  readonly channel: string;
  readonly device: string;
  readonly region?: string | undefined;
}

export interface WcmsExperienceResolvedComponent {
  readonly placementCode: string;
  readonly componentCode: string;
  readonly rendererKey: string;
  readonly contractVersion: number;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly media: readonly Readonly<Record<string, unknown>>[];
}

export interface WcmsExperienceResolveDiagnostics {
  readonly matched: boolean;
  readonly fallbackUsed: boolean;
  readonly placementCount: number;
}

export interface WcmsExperienceResolveResult {
  readonly site: string;
  readonly pageType: string;
  readonly release?: string | undefined;
  readonly indexVersion?: string | undefined;
  readonly slots: Readonly<Record<string, readonly WcmsExperienceResolvedComponent[]>>;
  readonly diagnostics: WcmsExperienceResolveDiagnostics;
}

export interface WcmsExperienceIndexStatus {
  readonly status: string;
  readonly indexingMode: string;
  readonly stagedAliasTemplate?: string | undefined;
  readonly onlineAliasTemplate?: string | undefined;
  readonly message?: string | undefined;
  readonly currentIndexVersion?: string | undefined;
  readonly lastIndexedAt?: string | undefined;
  readonly documentCount?: number | undefined;
}

export class WcmsExperienceRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'WcmsExperienceRequestError';
    this.status = status;
  }
}

function wcmsExperienceEndpoint(connection: AxisModuleConnection, path: string): URL {
  const endpoint = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('WCMS Experience module endpoint is invalid');
  }
  return new URL(`${endpoint.toString().replace(/\/$/, '')}/v0${path}`);
}

async function responseError(response: Response): Promise<Error> {
  let message = `WCMS Experience request returned HTTP ${String(response.status)}`;
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      !Array.isArray(body) &&
      typeof (body as Record<string, unknown>).message === 'string'
    ) {
      message = (body as { readonly message: string }).message;
    }
  } catch {
    // Keep the bounded HTTP fallback when the backend did not return JSON.
  }
  return new WcmsExperienceRequestError(response.status, message);
}

function envelopeResult(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('WCMS Experience returned an invalid response envelope');
  }
  if ('result' in value) return (value as { readonly result: unknown }).result;
  if ('data' in value) return (value as { readonly data: unknown }).data;
  throw new Error('WCMS Experience response does not contain result data');
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function parseResolvedComponent(value: unknown): WcmsExperienceResolvedComponent {
  const source = asRecord(value, 'WCMS Experience resolved component');
  const placementCode = optionalString(source.placementCode);
  const componentCode = optionalString(source.componentCode);
  const rendererKey = optionalString(source.rendererKey);
  if (!placementCode || !componentCode || !rendererKey) {
    throw new Error('WCMS Experience resolved component is missing renderer identity');
  }
  return Object.freeze({
    placementCode,
    componentCode,
    rendererKey,
    contractVersion:
      typeof source.contractVersion === 'number' && Number.isFinite(source.contractVersion)
        ? source.contractVersion
        : 1,
    properties:
      typeof source.properties === 'object' &&
      source.properties !== null &&
      !Array.isArray(source.properties)
        ? Object.freeze({ ...(source.properties as Record<string, unknown>) })
        : Object.freeze({}),
    media: Array.isArray(source.media)
      ? Object.freeze(
          source.media.flatMap((item): readonly Readonly<Record<string, unknown>>[] =>
            typeof item === 'object' && item !== null && !Array.isArray(item)
              ? [Object.freeze({ ...(item as Record<string, unknown>) })]
              : [],
          ),
        )
      : Object.freeze([]),
  });
}

export function parseWcmsExperienceResolveResult(
  value: unknown,
): WcmsExperienceResolveResult {
  const source = asRecord(value, 'WCMS Experience resolve result');
  const diagnostics =
    typeof source.diagnostics === 'object' &&
    source.diagnostics !== null &&
    !Array.isArray(source.diagnostics)
      ? (source.diagnostics as Record<string, unknown>)
      : {};
  const rawSlots =
    typeof source.slots === 'object' && source.slots !== null && !Array.isArray(source.slots)
      ? (source.slots as Record<string, unknown>)
      : {};
  const slots = Object.fromEntries(
    Object.entries(rawSlots).map(([slot, components]) => [
      slot,
      Array.isArray(components)
        ? Object.freeze(components.map(parseResolvedComponent))
        : Object.freeze([]),
    ]),
  );
  return Object.freeze({
    site: optionalString(source.site) ?? '',
    pageType: optionalString(source.pageType) ?? '',
    release: optionalString(source.release),
    indexVersion: optionalString(source.indexVersion),
    slots: Object.freeze(slots),
    diagnostics: Object.freeze({
      matched: diagnostics.matched === true,
      fallbackUsed: diagnostics.fallbackUsed === true,
      placementCount:
        typeof diagnostics.placementCount === 'number' &&
        Number.isFinite(diagnostics.placementCount)
          ? diagnostics.placementCount
          : 0,
    }),
  });
}

export function parseWcmsExperienceIndexStatus(
  value: unknown,
): WcmsExperienceIndexStatus {
  const source = asRecord(value, 'WCMS Experience index status');
  return Object.freeze({
    status: optionalString(source.status) ?? 'UNKNOWN',
    indexingMode: optionalString(source.indexingMode) ?? 'OUTBOX_EVENTUAL',
    stagedAliasTemplate: optionalString(source.stagedAliasTemplate),
    onlineAliasTemplate: optionalString(source.onlineAliasTemplate),
    message: optionalString(source.message),
    currentIndexVersion: optionalString(source.currentIndexVersion),
    lastIndexedAt: optionalString(source.lastIndexedAt),
    documentCount:
      typeof source.documentCount === 'number' && Number.isFinite(source.documentCount)
        ? source.documentCount
        : undefined,
  });
}

async function wcmsExperienceRequest(
  connection: AxisModuleConnection,
  configuration: WcmsExperienceClientConfiguration,
  path: string,
  options: RequestInit = {},
  fetchImplementation: typeof fetch = fetch,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const response = await fetchImplementation(
      wcmsExperienceEndpoint(connection, path),
      {
        ...options,
        cache: 'no-store',
        credentials: 'omit',
        headers: new Headers({
          Accept: 'application/json',
          Authorization: `Bearer ${configuration.accessToken}`,
          'Content-Type': 'application/json',
          'x-enterprise-code': configuration.enterpriseCode,
        }),
        redirect: 'error',
        signal: controller.signal,
      },
    );
    if (!response.ok) throw await responseError(response);
    return envelopeResult(await response.json());
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      throw new Error('WCMS Experience request timed out');
    }
    throw error instanceof Error
      ? error
      : new Error('WCMS Experience request failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function previewWcmsExperience(
  connection: AxisModuleConnection,
  configuration: WcmsExperienceClientConfiguration,
  request: WcmsExperienceResolveRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<WcmsExperienceResolveResult> {
  return parseWcmsExperienceResolveResult(
    await wcmsExperienceRequest(
      connection,
      configuration,
      '/authoring/preview',
      { method: 'POST', body: JSON.stringify(request) },
      fetchImplementation,
    ),
  );
}

export async function loadWcmsExperienceIndexStatus(
  connection: AxisModuleConnection,
  configuration: WcmsExperienceClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<WcmsExperienceIndexStatus> {
  return parseWcmsExperienceIndexStatus(
    await wcmsExperienceRequest(
      connection,
      configuration,
      '/authoring/index-status',
      { method: 'GET' },
      fetchImplementation,
    ),
  );
}
