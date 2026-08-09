import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';

export interface ContentDesignerClientConfiguration {
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly timeoutMs: number;
}

export interface ContentDesignerDraftComponentMedia {
  readonly altText?: string | undefined;
  readonly caption?: string | undefined;
  readonly componentMediaCode?: string | undefined;
  readonly mediaCode?: string | undefined;
  readonly mediaSetCode?: string | undefined;
  readonly mediaType?: string | undefined;
  readonly position?: number | undefined;
  readonly role?: string | undefined;
  readonly slot?: string | undefined;
}

export interface ContentDesignerDraftComponent {
  readonly accessMode?: string | undefined;
  readonly code: string;
  readonly media?: readonly ContentDesignerDraftComponentMedia[] | undefined;
  readonly properties?: Readonly<Record<string, unknown>> | undefined;
  readonly renderer?: string | undefined;
  readonly typeCode: string;
}

export interface ContentDesignerDraftSection {
  readonly code?: string | undefined;
  readonly components: readonly ContentDesignerDraftComponent[];
  readonly index?: number | undefined;
  readonly slot: string;
}

export interface ContentDesignerDraft {
  readonly catalogCode: string;
  readonly navigation?: Readonly<Record<string, unknown>> | undefined;
  readonly page: {
    readonly code: string;
    readonly name: string;
    readonly renderer?: string | undefined;
    readonly typeCode: string;
  };
  readonly route?: Readonly<Record<string, unknown>> | undefined;
  readonly sections: readonly ContentDesignerDraftSection[];
  readonly siteCode: string;
  readonly templateCode: string;
}

export interface ContentDesignerAuthoringModel {
  readonly hierarchy: readonly string[];
  readonly operations: readonly string[];
  readonly rules: {
    readonly arbitrarySlots: boolean;
    readonly catalogFirst: boolean;
    readonly frontendPersistence: boolean;
    readonly pixelPerfectRendering: boolean;
  };
}

export interface ContentDesignerOperationResult {
  readonly evidence?: unknown;
  readonly saved?: unknown;
  readonly status?: string | undefined;
  readonly valid?: boolean | undefined;
}

class ContentDesignerRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ContentDesignerRequestError';
    this.status = status;
  }
}

function cmsEndpoint(connection: AxisModuleConnection, path: string): URL {
  const endpoint = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('CMS module endpoint is invalid');
  }
  return new URL(`${endpoint.toString().replace(/\/$/, '')}/v0${path}`);
}

async function responseError(response: Response): Promise<Error> {
  let message = `CMS Designer request returned HTTP ${String(response.status)}`;
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
  return new ContentDesignerRequestError(response.status, message);
}

function envelopeResult(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('CMS Designer returned an invalid response envelope');
  }
  if ('result' in value) return (value as { readonly result: unknown }).result;
  if ('data' in value) return (value as { readonly data: unknown }).data;
  throw new Error('CMS Designer response does not contain result data');
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function parseAuthoringModel(value: unknown): ContentDesignerAuthoringModel {
  const source = asRecord(value, 'CMS Designer authoring model');
  const rules = asRecord(source.rules, 'CMS Designer rules');
  return Object.freeze({
    hierarchy: Object.freeze(
      Array.isArray(source.hierarchy) ? source.hierarchy.map(String) : [],
    ),
    operations: Object.freeze(
      Array.isArray(source.operations) ? source.operations.map(String) : [],
    ),
    rules: Object.freeze({
      arbitrarySlots: rules.arbitrarySlots === true,
      catalogFirst: rules.catalogFirst === true,
      frontendPersistence: rules.frontendPersistence === true,
      pixelPerfectRendering: rules.pixelPerfectRendering === true,
    }),
  });
}

function parseOperationResult(value: unknown): ContentDesignerOperationResult {
  const source = asRecord(value, 'CMS Designer operation result');
  return Object.freeze({
    evidence: source.evidence,
    saved: source.saved,
    status: typeof source.status === 'string' ? source.status : undefined,
    valid: typeof source.valid === 'boolean' ? source.valid : undefined,
  });
}

async function designerRequest(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
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
    const response = await fetchImplementation(cmsEndpoint(connection, path), {
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
    });
    if (!response.ok) throw await responseError(response);
    return envelopeResult(await response.json());
  } catch (error: unknown) {
    if (controller.signal.aborted) throw new Error('CMS Designer request timed out');
    throw error instanceof Error ? error : new Error('CMS Designer request failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function loadContentDesignerAuthoringModel(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<ContentDesignerAuthoringModel> {
  return parseAuthoringModel(
    await designerRequest(
      connection,
      configuration,
      '/designer/composition/model',
      { method: 'GET' },
      fetchImplementation,
    ),
  );
}

export async function validateContentDesignerDraft(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  draft: ContentDesignerDraft,
  fetchImplementation: typeof fetch = fetch,
): Promise<ContentDesignerOperationResult> {
  return parseOperationResult(
    await designerRequest(
      connection,
      configuration,
      '/designer/composition/validate',
      { method: 'POST', body: JSON.stringify(draft) },
      fetchImplementation,
    ),
  );
}

export async function saveContentDesignerDraft(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  draft: ContentDesignerDraft,
  fetchImplementation: typeof fetch = fetch,
): Promise<ContentDesignerOperationResult> {
  return parseOperationResult(
    await designerRequest(
      connection,
      configuration,
      '/designer/composition/draft',
      { method: 'PUT', body: JSON.stringify(draft) },
      fetchImplementation,
    ),
  );
}
