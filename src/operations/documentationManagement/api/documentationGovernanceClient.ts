import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';

export interface DocumentationGovernanceClientConfiguration {
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly timeoutMs: number;
}

export interface DocumentationGovernanceRoutes {
  readonly authoringModelRoute: string;
  readonly validationRoute: string;
  readonly renderProjectionRoute: string;
  readonly searchRoute: string;
  readonly publicationHandoffRoute: string;
  readonly migrationPlanRoute: string;
}

export interface DocumentationAuthoringPanel {
  readonly code: string;
  readonly label: string;
  readonly schemaName: string;
  readonly permission?: string | undefined;
}

export interface DocumentationAuthoringSequenceItem {
  readonly id: number;
  readonly group: string;
  readonly code: string;
  readonly label: string;
  readonly target: string;
  readonly permission?: string | undefined;
  readonly trigger?: string | undefined;
  readonly state?: string | undefined;
  readonly accessMode?: string | undefined;
}

export interface DocumentationAuthoringModel {
  readonly contract: string;
  readonly ownerModule: string;
  readonly contentAuthority: string;
  readonly rendererAuthority: string;
  readonly publicationAuthority: string;
  readonly workspace: {
    readonly route: string;
    readonly landing: string;
    readonly previewRoute: string;
    readonly searchRoute: string;
    readonly expandableNavigation: boolean;
    readonly backendDriven: boolean;
  };
  readonly panels: readonly DocumentationAuthoringPanel[];
  readonly accessModes: readonly string[];
  readonly lifecycle: {
    readonly readerStates: readonly string[];
    readonly authorStates: readonly string[];
    readonly targetTypes: readonly string[];
    readonly workflowTriggers: Readonly<Record<string, readonly string[]>>;
  };
  readonly sequence: readonly DocumentationAuthoringSequenceItem[];
  readonly sequenceByGroup: Readonly<
    Record<string, readonly DocumentationAuthoringSequenceItem[]>
  >;
}

export interface DocumentationGovernanceIssue {
  readonly code: string;
  readonly severity: 'ERROR' | 'WARNING' | 'INFO';
  readonly category: string;
  readonly target?: string | undefined;
  readonly message: string;
}

export interface DocumentationGovernanceValidationReport {
  readonly status: 'READY' | 'BLOCKED';
  readonly issueCount: number;
  readonly issues: readonly DocumentationGovernanceIssue[];
}

export interface DocumentationRenderProjection {
  readonly contract: string;
  readonly channel: string;
  readonly product?: Readonly<Record<string, unknown>> | undefined;
  readonly navigation: readonly Readonly<Record<string, unknown>>[];
  readonly pages: readonly Readonly<Record<string, unknown>>[];
  readonly dashboards: readonly Readonly<Record<string, unknown>>[];
}

export interface DocumentationSearchResult {
  readonly targetType: string;
  readonly targetCode: string;
  readonly title: string;
  readonly summary: string;
  readonly score: number;
  readonly accessMode?: string | undefined;
  readonly lifecycleState?: string | undefined;
}

export interface DocumentationSearchProjection {
  readonly contract: string;
  readonly query: string;
  readonly total: number;
  readonly results: readonly DocumentationSearchResult[];
  readonly noResultGuidance?: string | undefined;
}

export interface DocumentationPublicationHandoff {
  readonly status: 'READY_FOR_NPUBLISH' | 'BLOCKED';
  readonly publicationAuthority: string;
  readonly domain: string;
  readonly rootType: string;
  readonly targets: readonly Readonly<Record<string, unknown>>[];
  readonly validation: DocumentationGovernanceValidationReport;
}

export interface DocumentationMigrationPlan {
  readonly contract: string;
  readonly source: string;
  readonly target: string;
  readonly recordCount: number;
  readonly sourceEvidence:
    | readonly Readonly<Record<string, unknown>>[]
    | readonly string[];
  readonly actions: readonly string[];
}

export interface DocumentationRecordPack {
  readonly sourceContext?: unknown;
  readonly packCode?: unknown;
  readonly productCode?: unknown;
  readonly products?: unknown;
  readonly navigation?: unknown;
  readonly nodes?: unknown;
  readonly dashboards?: unknown;
  readonly pages?: unknown;
  readonly accessPolicies?: unknown;
  readonly publicationStates?: unknown;
  readonly searchMetadata?: unknown;
  readonly routes?: unknown;
  readonly cmsPages?: unknown;
  readonly components?: unknown;
}

class DocumentationGovernanceRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'DocumentationGovernanceRequestError';
    this.status = status;
  }
}

function routePath(value: string, label: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('://')) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function cmsUrl(connection: AxisModuleConnection, path: string): URL {
  const endpoint = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('CMS module endpoint is invalid');
  }
  return new URL(`${endpoint.toString().replace(/\/$/, '')}/v0${path}`);
}

async function responseError(response: Response): Promise<Error> {
  let message = `Documentation governance returned HTTP ${String(response.status)}`;
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
  return new DocumentationGovernanceRequestError(response.status, message);
}

function envelopeResult(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Documentation governance returned an invalid response envelope');
  }
  if ('result' in value) return (value as { readonly result: unknown }).result;
  if ('data' in value) return (value as { readonly data: unknown }).data;
  throw new Error('Documentation governance response does not contain result data');
}

function record(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function optionalRecord(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : Object.freeze({});
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function stringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(value.map(String).filter(Boolean));
}

function recordList(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.flatMap((item): readonly Readonly<Record<string, unknown>>[] =>
      typeof item === 'object' && item !== null && !Array.isArray(item)
        ? [Object.freeze({ ...(item as Record<string, unknown>) })]
        : [],
    ),
  );
}

function parseSequence(value: unknown): readonly DocumentationAuthoringSequenceItem[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.flatMap((item): readonly DocumentationAuthoringSequenceItem[] => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
      const source = item as Record<string, unknown>;
      if (typeof source.id !== 'number' || !Number.isInteger(source.id)) return [];
      return [
        Object.freeze({
          id: source.id,
          group: text(source.group, 'General'),
          code: text(source.code, `item.${String(source.id)}`),
          label: text(source.label, `Item ${String(source.id)}`),
          target: text(source.target, 'contract'),
          permission:
            typeof source.permission === 'string' ? source.permission : undefined,
          trigger: typeof source.trigger === 'string' ? source.trigger : undefined,
          state: typeof source.state === 'string' ? source.state : undefined,
          accessMode:
            typeof source.accessMode === 'string' ? source.accessMode : undefined,
        }),
      ];
    }),
  );
}

function parsePanels(value: unknown): readonly DocumentationAuthoringPanel[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.flatMap((item): readonly DocumentationAuthoringPanel[] => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
      const source = item as Record<string, unknown>;
      if (typeof source.code !== 'string' || typeof source.schemaName !== 'string') {
        return [];
      }
      return [
        Object.freeze({
          code: source.code,
          label: text(source.label, source.code),
          schemaName: source.schemaName,
          permission:
            typeof source.permission === 'string' ? source.permission : undefined,
        }),
      ];
    }),
  );
}

function parseAuthoringModel(value: unknown): DocumentationAuthoringModel {
  const source = record(value, 'Documentation authoring model');
  const workspace = record(source.workspace, 'Documentation workspace model');
  const lifecycle = record(source.lifecycle, 'Documentation lifecycle model');
  const workflowTriggers = record(
    lifecycle.workflowTriggers,
    'Documentation workflow triggers',
  );
  const sequence = parseSequence(source.sequence);
  const sequenceByGroup = sequence.reduce<
    Record<string, readonly DocumentationAuthoringSequenceItem[]>
  >((result, item) => {
    result[item.group] = Object.freeze([...(result[item.group] ?? []), item]);
    return result;
  }, {});
  return Object.freeze({
    contract: text(source.contract, 'cms.documentation.authoring/v1'),
    ownerModule: text(source.ownerModule, 'cms'),
    contentAuthority: text(source.contentAuthority, 'documentationContentCatalog'),
    rendererAuthority: text(source.rendererAuthority, 'axis-runtime-renderers'),
    publicationAuthority: text(source.publicationAuthority, 'nPublish'),
    workspace: Object.freeze({
      route: routePath(text(workspace.route, '/docs/designer'), 'workspace route'),
      landing: routePath(
        text(workspace.landing, '/docs/designer/dashboard'),
        'workspace landing',
      ),
      previewRoute: routePath(
        text(workspace.previewRoute, '/docs/designer/preview'),
        'workspace preview route',
      ),
      searchRoute: routePath(
        text(workspace.searchRoute, '/docs/designer/search'),
        'workspace search route',
      ),
      expandableNavigation: workspace.expandableNavigation === true,
      backendDriven: workspace.backendDriven === true,
    }),
    panels: parsePanels(source.panels),
    accessModes: stringList(source.accessModes),
    lifecycle: Object.freeze({
      readerStates: stringList(lifecycle.readerStates),
      authorStates: stringList(lifecycle.authorStates),
      targetTypes: stringList(lifecycle.targetTypes),
      workflowTriggers: Object.freeze(
        Object.fromEntries(
          Object.entries(workflowTriggers).map(([key, value]) => [
            key,
            stringList(value),
          ]),
        ),
      ),
    }),
    sequence,
    sequenceByGroup: Object.freeze(sequenceByGroup),
  });
}

function parseValidationReport(
  value: unknown,
): DocumentationGovernanceValidationReport {
  const source = record(value, 'Documentation validation report');
  const status = source.status === 'READY' ? 'READY' : 'BLOCKED';
  const issues = Array.isArray(source.issues)
    ? source.issues.flatMap((issue): readonly DocumentationGovernanceIssue[] => {
        if (typeof issue !== 'object' || issue === null || Array.isArray(issue)) {
          return [];
        }
        const item = issue as Record<string, unknown>;
        const severity =
          item.severity === 'WARNING' || item.severity === 'INFO'
            ? item.severity
            : 'ERROR';
        return [
          Object.freeze({
            code: text(item.code, 'DOC_ISSUE'),
            severity,
            category: text(item.category, 'general'),
            target: typeof item.target === 'string' ? item.target : undefined,
            message: text(item.message, 'Documentation issue requires review.'),
          }),
        ];
      })
    : [];
  return Object.freeze({
    status,
    issueCount:
      typeof source.issueCount === 'number' && Number.isInteger(source.issueCount)
        ? source.issueCount
        : issues.length,
    issues: Object.freeze(issues),
  });
}

function parseRenderProjection(value: unknown): DocumentationRenderProjection {
  const source = record(value, 'Documentation render projection');
  return Object.freeze({
    contract: text(source.contract, 'cms.documentation.render/v1'),
    channel: text(source.channel, 'AXIS'),
    product:
      typeof source.product === 'object' &&
      source.product !== null &&
      !Array.isArray(source.product)
        ? Object.freeze({ ...(source.product as Record<string, unknown>) })
        : undefined,
    navigation: recordList(source.navigation),
    pages: recordList(source.pages),
    dashboards: recordList(source.dashboards),
  });
}

function parseSearchProjection(value: unknown): DocumentationSearchProjection {
  const source = record(value, 'Documentation search projection');
  const results = Array.isArray(source.results)
    ? source.results.flatMap((result): readonly DocumentationSearchResult[] => {
        if (typeof result !== 'object' || result === null || Array.isArray(result)) {
          return [];
        }
        const item = result as Record<string, unknown>;
        return [
          Object.freeze({
            targetType: text(item.targetType, 'PAGE'),
            targetCode: text(item.targetCode, 'unknown'),
            title: text(item.title, 'Untitled'),
            summary: text(item.summary, ''),
            score: typeof item.score === 'number' ? item.score : 0,
            accessMode:
              typeof item.accessMode === 'string' ? item.accessMode : undefined,
            lifecycleState:
              typeof item.lifecycleState === 'string' ? item.lifecycleState : undefined,
          }),
        ];
      })
    : [];
  return Object.freeze({
    contract: text(source.contract, 'cms.documentation.search/v1'),
    query: text(source.query, ''),
    total:
      typeof source.total === 'number' && Number.isInteger(source.total)
        ? source.total
        : results.length,
    results: Object.freeze(results),
    noResultGuidance:
      typeof source.noResultGuidance === 'string' ? source.noResultGuidance : undefined,
  });
}

function parsePublicationHandoff(value: unknown): DocumentationPublicationHandoff {
  const source = record(value, 'Documentation publication handoff');
  const publication = optionalRecord(source.publication);
  const validationSource =
    typeof source.validation !== 'undefined' ? source.validation : source.readiness;
  return Object.freeze({
    status: source.status === 'READY_FOR_NPUBLISH' ? 'READY_FOR_NPUBLISH' : 'BLOCKED',
    publicationAuthority: text(source.publicationAuthority, 'nPublish'),
    domain: text(source.domain, text(publication.domain, 'cms.documentation')),
    rootType: text(
      source.rootType,
      text(publication.rootType, 'documentationContentCatalog'),
    ),
    targets: recordList(source.targets),
    validation: parseValidationReport(validationSource),
  });
}

function parseMigrationPlan(value: unknown): DocumentationMigrationPlan {
  const source = record(value, 'Documentation migration plan');
  const rawEvidence =
    typeof source.sourceEvidence !== 'undefined' ? source.sourceEvidence : source.pages;
  const evidence =
    Array.isArray(rawEvidence) &&
    rawEvidence.every(
      (item) => typeof item === 'object' && item !== null && !Array.isArray(item),
    )
      ? recordList(rawEvidence)
      : stringList(rawEvidence);
  const recordCount =
    typeof source.recordCount === 'number' && Number.isInteger(source.recordCount)
      ? source.recordCount
      : typeof source.pageCount === 'number' && Number.isInteger(source.pageCount)
        ? source.pageCount
        : evidence.length;
  return Object.freeze({
    contract: text(source.contract, 'cms.documentation.migration/v1'),
    source: text(source.source, 'generated/bootstrap'),
    target: text(source.target, 'axis-managed-content-catalog'),
    recordCount,
    sourceEvidence: evidence,
    actions:
      stringList(source.actions).length > 0
        ? stringList(source.actions)
        : Object.freeze([
            'preserveSourceEvidence',
            'importGeneratedRecords',
            'enableAxisManagement',
          ]),
  });
}

async function request(
  connection: AxisModuleConnection,
  configuration: DocumentationGovernanceClientConfiguration,
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
    const response = await fetchImplementation(cmsUrl(connection, path), {
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
    if (controller.signal.aborted) {
      throw new Error('Documentation governance request timed out');
    }
    throw error instanceof Error
      ? error
      : new Error('Documentation governance request failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function defaultDocumentationGovernanceRoutes(): DocumentationGovernanceRoutes {
  return Object.freeze({
    authoringModelRoute: '/documentation/governance/model',
    validationRoute: '/documentation/governance/validate',
    renderProjectionRoute: '/documentation/governance/render-projection',
    searchRoute: '/documentation/governance/search',
    publicationHandoffRoute: '/documentation/governance/publication-handoff',
    migrationPlanRoute: '/documentation/governance/migration-plan',
  });
}

export function createDocumentationGovernanceClient(
  connection: AxisModuleConnection,
  configuration: DocumentationGovernanceClientConfiguration,
  routes: Partial<DocumentationGovernanceRoutes> = {},
  fetchImplementation: typeof fetch = fetch,
) {
  const resolvedRoutes = Object.freeze({
    ...defaultDocumentationGovernanceRoutes(),
    ...routes,
  });
  return Object.freeze({
    routes: resolvedRoutes,
    loadAuthoringModel: async () =>
      parseAuthoringModel(
        await request(
          connection,
          configuration,
          routePath(resolvedRoutes.authoringModelRoute, 'authoring model route'),
          { method: 'GET' },
          fetchImplementation,
        ),
      ),
    validateAuthoringRecords: async (records: DocumentationRecordPack = {}) =>
      parseValidationReport(
        await request(
          connection,
          configuration,
          routePath(resolvedRoutes.validationRoute, 'validation route'),
          { method: 'POST', body: JSON.stringify(records) },
          fetchImplementation,
        ),
      ),
    renderProjection: async (
      records: DocumentationRecordPack = {},
      channel: 'AXIS' | 'NEXUS' = 'AXIS',
    ) =>
      parseRenderProjection(
        await request(
          connection,
          configuration,
          routePath(resolvedRoutes.renderProjectionRoute, 'render projection route'),
          { method: 'POST', body: JSON.stringify({ ...records, channel }) },
          fetchImplementation,
        ),
      ),
    search: async (
      query: string,
      records: DocumentationRecordPack = {},
      channel: 'AXIS' | 'NEXUS' = 'AXIS',
    ) =>
      parseSearchProjection(
        await request(
          connection,
          configuration,
          routePath(resolvedRoutes.searchRoute, 'search route'),
          {
            method: 'POST',
            body: JSON.stringify({ ...records, channel, query }),
          },
          fetchImplementation,
        ),
      ),
    publicationHandoff: async (records: DocumentationRecordPack = {}) =>
      parsePublicationHandoff(
        await request(
          connection,
          configuration,
          routePath(
            resolvedRoutes.publicationHandoffRoute,
            'publication handoff route',
          ),
          { method: 'POST', body: JSON.stringify(records) },
          fetchImplementation,
        ),
      ),
    migrationPlan: async (records: DocumentationRecordPack = {}) =>
      parseMigrationPlan(
        await request(
          connection,
          configuration,
          routePath(resolvedRoutes.migrationPlanRoute, 'migration plan route'),
          { method: 'POST', body: JSON.stringify(records) },
          fetchImplementation,
        ),
      ),
  });
}
