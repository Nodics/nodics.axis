import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
} from '../../../bootstrap/publicBootstrap';

export interface LocationMapConfigurationRequest {
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly locationBaseUrl?: string | undefined;
  readonly surfaceCode: string;
  readonly timeoutMs: number;
  readonly usageCode: string;
}

export interface LocationMapReverseGeocodeRequest
  extends LocationMapConfigurationRequest {
  readonly latitude: number;
  readonly locale: string;
  readonly longitude: number;
}

export interface LocationMapReverseGeocodeResult {
  readonly status: 'RESOLVED' | 'UNAVAILABLE';
  readonly address: string;
  readonly providerCode: string;
  readonly fallbackUsed: boolean;
}

export interface SaveLocationMapConfigurationRequest extends LocationMapConfigurationRequest {
  readonly configuration: LocationMapConfigurationDraft;
}

export interface LocationMapConfigurationDraft {
  readonly code: string;
  readonly providerCode: string;
  readonly surfaceCode: string;
  readonly usageCode: string;
  readonly stylePresetCode: string;
  readonly styleUrl: string;
  readonly publicAccessToken: string;
  readonly fallbackProviderCode: string;
  readonly fallbackPolicy: string;
  readonly defaultCenterLatitude: number;
  readonly defaultCenterLongitude: number;
  readonly defaultZoom: number;
  readonly minimumZoom: number;
  readonly maximumZoom: number;
  readonly enabledControls: readonly string[];
  readonly setupStatus: string;
  readonly status: string;
}

export interface LocationMapProviderOption {
  readonly code: string;
  readonly name: Record<string, unknown>;
  readonly providerType: string;
  readonly rendererCode: string;
  readonly rendererType: string;
  readonly requiresPublicAccessToken: boolean;
  readonly frontendSafeTokenPrefix: string;
  readonly status: string;
}

export interface LocationMapRenderDescriptor {
  readonly providerCode: string;
  readonly providerType: string;
  readonly rendererCode: string;
  readonly rendererType: string;
  readonly styleUrl: string;
  readonly tileUrlTemplate: string;
  readonly attribution: string;
  readonly publicAccessToken: string;
  readonly endpointPolicy: Record<string, unknown>;
  readonly frontendSafe: boolean;
}

export interface LocationMapConfiguration {
  readonly code?: string;
  readonly providerCode: string;
  readonly surfaceCode: string;
  readonly usageCode: string;
  readonly stylePresetCode?: string;
  readonly styleUrl: string;
  readonly publicAccessToken: string;
  readonly fallbackProviderCode: string;
  readonly fallbackPolicy: string;
  readonly defaultCenter: {
    readonly latitude: number;
    readonly longitude: number;
  };
  readonly defaultZoom: number;
  readonly minimumZoom?: number;
  readonly maximumZoom?: number;
  readonly enabledControls: readonly string[];
  readonly setupStatus: string;
  readonly configured: boolean;
  readonly status: string;
  readonly rendererCode: string;
  readonly rendererType: string;
  readonly renderDescriptor?: LocationMapRenderDescriptor | undefined;
  readonly fallbackRenderer?: LocationMapRenderDescriptor | undefined;
  readonly providerOptions: readonly LocationMapProviderOption[];
}

function envelope(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Location map configuration returned an invalid response');
  }
  const body = value as Record<string, unknown>;
  return body.data ?? body.result;
}

function resolveLocationMapEndpoint(
  bootstrap: AxisAuthenticatedBootstrap,
  locationBaseUrl: string | undefined,
): URL {
  const connection = selectModuleConnection(bootstrap, 'locationMap');
  const rawEndpoint = connection?.endpoint ?? locationBaseUrl;
  if (!rawEndpoint) {
    throw new Error('Location Map backend connection is not available');
  }
  const endpoint = new URL(rawEndpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('Location Map endpoint is invalid');
  }
  return endpoint;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteNumber(value: unknown, fallback: number): number {
  const candidate = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(candidate) ? candidate : fallback;
}

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? Object.freeze(value.filter((item): item is string => typeof item === 'string'))
    : Object.freeze([]);
}

function objectRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseRenderDescriptor(
  value: unknown,
): LocationMapRenderDescriptor | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const rendererCode = text(record.rendererCode);
  const rendererType = text(record.rendererType);
  if (!rendererCode && !rendererType) return undefined;
  return Object.freeze({
    providerCode: text(record.providerCode),
    providerType: text(record.providerType),
    rendererCode,
    rendererType,
    styleUrl: text(record.styleUrl),
    tileUrlTemplate: text(record.tileUrlTemplate),
    attribution: text(record.attribution),
    publicAccessToken: text(record.publicAccessToken),
    endpointPolicy: Object.freeze(objectRecord(record.endpointPolicy)),
    frontendSafe: record.frontendSafe !== false,
  });
}

function parseProviderOptions(value: unknown): readonly LocationMapProviderOption[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value
      .filter((item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null && !Array.isArray(item),
      )
      .map((item) =>
        Object.freeze({
          code: text(item.code),
          name: Object.freeze(objectRecord(item.name)),
          providerType: text(item.providerType),
          rendererCode: text(item.rendererCode),
          rendererType: text(item.rendererType),
          requiresPublicAccessToken: item.requiresPublicAccessToken === true,
          frontendSafeTokenPrefix: text(item.frontendSafeTokenPrefix),
          status: text(item.status),
        }),
      )
      .filter((item) => item.code),
  );
}

function parseLocationMapConfiguration(value: unknown): LocationMapConfiguration {
  const data = envelope(value);
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Location map configuration did not return a configuration object');
  }
  const record = data as Record<string, unknown>;
  const defaultCenter =
    typeof record.defaultCenter === 'object' &&
    record.defaultCenter !== null &&
    !Array.isArray(record.defaultCenter)
      ? (record.defaultCenter as Record<string, unknown>)
      : {};
  const configuration = {
    code: text(record.code),
    providerCode: text(record.providerCode),
    surfaceCode: text(record.surfaceCode),
    usageCode: text(record.usageCode),
    stylePresetCode: text(record.stylePresetCode),
    styleUrl: text(record.styleUrl),
    publicAccessToken: text(record.publicAccessToken),
    fallbackProviderCode: text(record.fallbackProviderCode),
    fallbackPolicy: text(record.fallbackPolicy),
    defaultCenter: Object.freeze({
      latitude: finiteNumber(defaultCenter.latitude, 25.2048),
      longitude: finiteNumber(defaultCenter.longitude, 55.2708),
    }),
    defaultZoom: finiteNumber(record.defaultZoom, 9),
    enabledControls: stringList(record.enabledControls),
    setupStatus: text(record.setupStatus),
    configured: record.configured === true,
    status: text(record.status),
    rendererCode: text(record.rendererCode),
    rendererType: text(record.rendererType),
    renderDescriptor: parseRenderDescriptor(record.renderDescriptor),
    fallbackRenderer: parseRenderDescriptor(record.fallbackRenderer),
    providerOptions: parseProviderOptions(record.providerOptions),
  };
  return Object.freeze({
    ...configuration,
    ...(record.minimumZoom === undefined
      ? {}
      : { minimumZoom: finiteNumber(record.minimumZoom, 3) }),
    ...(record.maximumZoom === undefined
      ? {}
      : { maximumZoom: finiteNumber(record.maximumZoom, 18) }),
  });
}

function parseReverseGeocodeResult(value: unknown): LocationMapReverseGeocodeResult {
  const data = envelope(value);
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Location reverse geocode did not return a result object');
  }
  const record = data as Record<string, unknown>;
  const status = text(record.status) === 'RESOLVED' ? 'RESOLVED' : 'UNAVAILABLE';
  return Object.freeze({
    status,
    address: text(record.address),
    providerCode: text(record.providerCode),
    fallbackUsed: record.fallbackUsed === true,
  });
}

async function requestLocationMapConfiguration(
  bootstrap: AxisAuthenticatedBootstrap,
  request: LocationMapConfigurationRequest,
  path: string,
  fetchImplementation: typeof fetch,
): Promise<LocationMapConfiguration> {
  const endpoint = resolveLocationMapEndpoint(bootstrap, request.locationBaseUrl);
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), request.timeoutMs);
  try {
    const url = new URL(`${endpoint.toString().replace(/\/$/, '')}${path}`);
    url.searchParams.set('surfaceCode', request.surfaceCode);
    url.searchParams.set('usageCode', request.usageCode);
    const response = await fetchImplementation(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${request.accessToken}`,
        'x-enterprise-code': request.enterpriseCode,
      },
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `Location map configuration returned HTTP ${response.status.toString()}`,
      );
    }
    return parseLocationMapConfiguration(await response.json());
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function reverseGeocodeLocation(
  bootstrap: AxisAuthenticatedBootstrap,
  request: LocationMapReverseGeocodeRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<LocationMapReverseGeocodeResult> {
  const endpoint = resolveLocationMapEndpoint(bootstrap, request.locationBaseUrl);
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), request.timeoutMs);
  try {
    const url = new URL(
      `${endpoint.toString().replace(/\/$/, '')}/v0/location/maps/reverse-geocode`,
    );
    url.searchParams.set('surfaceCode', request.surfaceCode);
    url.searchParams.set('usageCode', request.usageCode);
    url.searchParams.set('latitude', request.latitude.toString());
    url.searchParams.set('locale', request.locale);
    url.searchParams.set('longitude', request.longitude.toString());
    const response = await fetchImplementation(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${request.accessToken}`,
        'x-enterprise-code': request.enterpriseCode,
      },
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `Location reverse geocode returned HTTP ${response.status.toString()}`,
      );
    }
    return parseReverseGeocodeResult(await response.json());
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function loadLocationMapConfiguration(
  bootstrap: AxisAuthenticatedBootstrap,
  request: LocationMapConfigurationRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<LocationMapConfiguration> {
  return requestLocationMapConfiguration(
    bootstrap,
    request,
    '/v0/location/maps/configurations/effective',
    fetchImplementation,
  );
}

export async function loadEditableLocationMapConfiguration(
  bootstrap: AxisAuthenticatedBootstrap,
  request: LocationMapConfigurationRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<LocationMapConfiguration> {
  return requestLocationMapConfiguration(
    bootstrap,
    request,
    '/v0/location/maps/configurations',
    fetchImplementation,
  );
}

export async function saveLocationMapConfiguration(
  bootstrap: AxisAuthenticatedBootstrap,
  request: SaveLocationMapConfigurationRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<LocationMapConfiguration> {
  const endpoint = resolveLocationMapEndpoint(bootstrap, request.locationBaseUrl);
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), request.timeoutMs);
  try {
    const response = await fetchImplementation(
      new URL(
        `${endpoint.toString().replace(/\/$/, '')}/v0/location/maps/configurations`,
      ),
      {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${request.accessToken}`,
          'Content-Type': 'application/json',
          'x-enterprise-code': request.enterpriseCode,
        },
        body: JSON.stringify(request.configuration),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw new Error(
        `Location map configuration save returned HTTP ${response.status.toString()}`,
      );
    }
    return parseLocationMapConfiguration(await response.json());
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
