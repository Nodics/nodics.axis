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
  readonly localeCode?: string | undefined;
  readonly position?: number | undefined;
  readonly role?: string | undefined;
  readonly slot?: string | undefined;
}

export interface ContentDesignerDraftLocalization {
  readonly locale: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly seo?: Readonly<Record<string, unknown>> | undefined;
  readonly status?: string | undefined;
}

export interface ContentDesignerDraftComponent {
  readonly accessMode?: string | undefined;
  readonly code: string;
  readonly media?: readonly ContentDesignerDraftComponentMedia[] | undefined;
  readonly localizations?: readonly ContentDesignerDraftLocalization[] | undefined;
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

export interface ContentDesignerComponentKind {
  readonly label: string;
  readonly renderer: string;
  readonly typeCode: string;
}

export interface ContentDesignerDraftDefaults {
  readonly catalogCode?: string | undefined;
  readonly pageRenderer?: string | undefined;
  readonly pageTypeCode?: string | undefined;
  readonly routePath?: string | undefined;
  readonly siteCode?: string | undefined;
  readonly slots?: readonly string[] | undefined;
  readonly templateCode?: string | undefined;
}

export interface ContentDesignerReference {
  readonly access?: string | undefined;
  readonly allowedComponentTypeGroups?: readonly string[] | undefined;
  readonly allowedComponentTypes?: readonly string[] | undefined;
  readonly catalogCode?: string | undefined;
  readonly catalogType?: string | undefined;
  readonly code: string;
  readonly componentTypeCodes?: readonly string[] | undefined;
  readonly height?: number | undefined;
  readonly kind?: string | undefined;
  readonly maxItems?: number | undefined;
  readonly minItems?: number | undefined;
  readonly name: string;
  readonly nodeType?: string | undefined;
  readonly parentCode?: string | undefined;
  readonly propertySchema?: Readonly<Record<string, unknown>> | undefined;
  readonly renderer?: string | undefined;
  readonly reusable?: boolean | undefined;
  readonly siteCode?: string | undefined;
  readonly templateCode?: string | undefined;
  readonly typeCode?: string | undefined;
  readonly width?: number | undefined;
}

export interface ContentDesignerLocalizationPolicy {
  readonly defaultLocale: string;
  readonly fallbackLocales: readonly string[];
  readonly supportedLocales: readonly string[];
}

export interface ContentDesignerPublicationReadiness {
  readonly requiredDraftParts: readonly string[];
  readonly requireNavigationForPublish: boolean;
}

export interface ContentDesignerAuthoringMetadata {
  readonly componentTypeGroups: readonly ContentDesignerReference[];
  readonly componentTypes: readonly ContentDesignerReference[];
  readonly contentCatalogs: readonly ContentDesignerReference[];
  readonly mediaFolders: readonly ContentDesignerReference[];
  readonly mediaFormats: readonly ContentDesignerReference[];
  readonly mediaTypes: readonly string[];
  readonly localization: ContentDesignerLocalizationPolicy;
  readonly navigationNodes: readonly ContentDesignerReference[];
  readonly pageTemplates: readonly ContentDesignerReference[];
  readonly pageTypes: readonly ContentDesignerReference[];
  readonly publicationReadiness: ContentDesignerPublicationReadiness;
  readonly sites: readonly ContentDesignerReference[];
  readonly slotDefinitions: readonly ContentDesignerReference[];
}

export interface ContentDesignerAuthoringModel {
  readonly defaults: {
    readonly componentKinds: readonly ContentDesignerComponentKind[];
    readonly draftDefaults: ContentDesignerDraftDefaults;
    readonly maximumReferenceLookupItems?: number | undefined;
    readonly requireNavigationForPublish: boolean;
  };
  readonly hierarchy: readonly string[];
  readonly metadata: ContentDesignerAuthoringMetadata;
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

function stringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return Object.freeze(value.map(String).filter(Boolean));
}

function numericValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseReferenceArray(value: unknown): readonly ContentDesignerReference[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.flatMap((item): readonly ContentDesignerReference[] => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return [];
      }
      const source = item as Record<string, unknown>;
      if (typeof source.code !== 'string') return [];
      return [
        Object.freeze({
          access: typeof source.access === 'string' ? source.access : undefined,
          allowedComponentTypeGroups: stringArray(source.allowedComponentTypeGroups),
          allowedComponentTypes: stringArray(source.allowedComponentTypes),
          catalogCode:
            typeof source.catalogCode === 'string' ? source.catalogCode : undefined,
          catalogType:
            typeof source.catalogType === 'string' ? source.catalogType : undefined,
          code: source.code,
          componentTypeCodes: stringArray(source.componentTypeCodes),
          height: numericValue(source.height),
          kind: typeof source.kind === 'string' ? source.kind : undefined,
          maxItems: numericValue(source.maxItems),
          minItems: numericValue(source.minItems),
          name: typeof source.name === 'string' ? source.name : source.code,
          nodeType: typeof source.nodeType === 'string' ? source.nodeType : undefined,
          parentCode:
            typeof source.parentCode === 'string' ? source.parentCode : undefined,
          propertySchema:
            typeof source.propertySchema === 'object' &&
            source.propertySchema !== null &&
            !Array.isArray(source.propertySchema)
              ? (source.propertySchema as Readonly<Record<string, unknown>>)
              : undefined,
          renderer: typeof source.renderer === 'string' ? source.renderer : undefined,
          reusable: typeof source.reusable === 'boolean' ? source.reusable : undefined,
          siteCode: typeof source.siteCode === 'string' ? source.siteCode : undefined,
          templateCode:
            typeof source.templateCode === 'string' ? source.templateCode : undefined,
          typeCode: typeof source.typeCode === 'string' ? source.typeCode : undefined,
          width: numericValue(source.width),
        }),
      ];
    }),
  );
}

function parseAuthoringMetadata(value: unknown): ContentDesignerAuthoringMetadata {
  const source =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const publicationReadiness =
    typeof source.publicationReadiness === 'object' &&
    source.publicationReadiness !== null &&
    !Array.isArray(source.publicationReadiness)
      ? (source.publicationReadiness as Record<string, unknown>)
      : {};
  const localization =
    typeof source.localization === 'object' &&
    source.localization !== null &&
    !Array.isArray(source.localization)
      ? (source.localization as Record<string, unknown>)
      : {};
  return Object.freeze({
    componentTypeGroups: parseReferenceArray(source.componentTypeGroups),
    componentTypes: parseReferenceArray(source.componentTypes),
    contentCatalogs: parseReferenceArray(source.contentCatalogs),
    mediaFolders: parseReferenceArray(source.mediaFolders),
    mediaFormats: parseReferenceArray(source.mediaFormats),
    mediaTypes: Array.isArray(source.mediaTypes)
      ? Object.freeze(source.mediaTypes.map(String).filter(Boolean))
      : Object.freeze([]),
    localization: Object.freeze({
      defaultLocale:
        typeof localization.defaultLocale === 'string'
          ? localization.defaultLocale
          : 'en',
      fallbackLocales: stringArray(localization.fallbackLocales) ?? Object.freeze([]),
      supportedLocales:
        stringArray(localization.supportedLocales) ?? Object.freeze(['en']),
    }),
    navigationNodes: parseReferenceArray(source.navigationNodes),
    pageTemplates: parseReferenceArray(source.pageTemplates),
    pageTypes: parseReferenceArray(source.pageTypes),
    publicationReadiness: Object.freeze({
      requiredDraftParts: Array.isArray(publicationReadiness.requiredDraftParts)
        ? Object.freeze(
            publicationReadiness.requiredDraftParts.map(String).filter(Boolean),
          )
        : Object.freeze([]),
      requireNavigationForPublish:
        publicationReadiness.requireNavigationForPublish === true,
    }),
    sites: parseReferenceArray(source.sites),
    slotDefinitions: parseReferenceArray(source.slotDefinitions),
  });
}

function parseAuthoringModel(value: unknown): ContentDesignerAuthoringModel {
  const source = asRecord(value, 'CMS Designer authoring model');
  const rules = asRecord(source.rules, 'CMS Designer rules');
  const defaults =
    typeof source.defaults === 'object' &&
    source.defaults !== null &&
    !Array.isArray(source.defaults)
      ? (source.defaults as Record<string, unknown>)
      : {};
  const draftDefaults =
    typeof defaults.draftDefaults === 'object' &&
    defaults.draftDefaults !== null &&
    !Array.isArray(defaults.draftDefaults)
      ? (defaults.draftDefaults as Record<string, unknown>)
      : {};
  return Object.freeze({
    defaults: Object.freeze({
      componentKinds: Object.freeze(
        Array.isArray(defaults.componentKinds)
          ? defaults.componentKinds.flatMap(
              (item): readonly ContentDesignerComponentKind[] => {
                if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                  return [];
                }
                const candidate = item as Record<string, unknown>;
                if (
                  typeof candidate.label !== 'string' ||
                  typeof candidate.renderer !== 'string' ||
                  typeof candidate.typeCode !== 'string'
                ) {
                  return [];
                }
                return [
                  Object.freeze({
                    label: candidate.label,
                    renderer: candidate.renderer,
                    typeCode: candidate.typeCode,
                  }),
                ];
              },
            )
          : [],
      ),
      draftDefaults: Object.freeze({
        catalogCode:
          typeof draftDefaults.catalogCode === 'string'
            ? draftDefaults.catalogCode
            : undefined,
        pageRenderer:
          typeof draftDefaults.pageRenderer === 'string'
            ? draftDefaults.pageRenderer
            : undefined,
        pageTypeCode:
          typeof draftDefaults.pageTypeCode === 'string'
            ? draftDefaults.pageTypeCode
            : undefined,
        routePath:
          typeof draftDefaults.routePath === 'string'
            ? draftDefaults.routePath
            : undefined,
        siteCode:
          typeof draftDefaults.siteCode === 'string'
            ? draftDefaults.siteCode
            : undefined,
        slots: Array.isArray(draftDefaults.slots)
          ? Object.freeze(draftDefaults.slots.map(String).filter(Boolean))
          : undefined,
        templateCode:
          typeof draftDefaults.templateCode === 'string'
            ? draftDefaults.templateCode
            : undefined,
      }),
      maximumReferenceLookupItems:
        typeof defaults.maximumReferenceLookupItems === 'number'
          ? defaults.maximumReferenceLookupItems
          : undefined,
      requireNavigationForPublish: defaults.requireNavigationForPublish === true,
    }),
    hierarchy: Object.freeze(
      Array.isArray(source.hierarchy) ? source.hierarchy.map(String) : [],
    ),
    metadata: parseAuthoringMetadata(source.metadata),
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
