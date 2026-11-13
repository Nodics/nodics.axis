import { AxisApiError, parseAxisApiError } from '../../../localization/axisApiError';
import type { AxisLocalizedErrorContract } from '../../../localization/localizationContracts';
import { observeEmployeeSessionResponse } from '../../../auth/employeeSessionEvents';
import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';

export interface WcmsExperienceClientConfiguration {
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly timeoutMs: number;
  readonly sessionGeneration?: number;
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

export interface WcmsExperiencePreviewNode {
  readonly componentCode: string;
  readonly rendererKey: string;
  readonly contractVersion: number;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly components?: readonly WcmsExperiencePreviewNode[];
}

export interface WcmsExperienceResolvedComponent {
  readonly components?: readonly WcmsExperiencePreviewNode[];
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
  readonly publication?: string | undefined;
  readonly observationLimit?: number | undefined;
  readonly resolvedPlacementCount?: number | undefined;
}

export class WcmsExperienceRequestError extends AxisApiError {
  readonly status: number;

  constructor(status: number, message: string | AxisLocalizedErrorContract) {
    super(typeof message === 'string' ? { message } : message);
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
  const error = await parseAxisApiError(
    response,
    'The experience request could not be confirmed. Inspect the saved state before another change.',
  );
  return new WcmsExperienceRequestError(response.status, error);
}

function envelopeResult(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('WCMS Experience returned an invalid response envelope');
  }
  const envelope = value as Record<string, unknown>;
  if (
    envelope.error ||
    envelope.success === false ||
    envelope.acknowledged === false ||
    (typeof envelope.code === 'string' && envelope.code.startsWith('ERR_')) ||
    ['FAILED', 'UNAVAILABLE'].includes(String(envelope.status)) ||
    (envelope.errors !== undefined &&
      (!Array.isArray(envelope.errors) || envelope.errors.length > 0))
  )
    throw new Error('WCMS Experience owner acknowledgement could not be confirmed');
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
    components: parsePreviewChildren(source.components, 0, { count: 0 }),
    componentCode,
    rendererKey,
    contractVersion:
      typeof source.contractVersion === 'number' &&
      Number.isFinite(source.contractVersion)
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
    typeof source.slots === 'object' &&
    source.slots !== null &&
    !Array.isArray(source.slots)
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
    publication: optionalString(source.publication),
    observationLimit:
      typeof source.observationLimit === 'number' ? source.observationLimit : undefined,
    resolvedPlacementCount:
      typeof source.resolvedPlacementCount === 'number'
        ? source.resolvedPlacementCount
        : undefined,
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
    observeEmployeeSessionResponse(
      response,
      configuration.accessToken,
      configuration.sessionGeneration,
    );
    if (!response.ok) throw await responseError(response);
    return envelopeResult(await response.json());
  } catch (error: unknown) {
    if (error instanceof WcmsExperienceRequestError) throw error;
    throw new WcmsExperienceRequestError(controller.signal.aborted ? 408 : 0, {
      message:
        'The request could not be confirmed. Inspect the current state before another change.',
      messageKey: 'common.request-unconfirmed',
      messageExposure: 'PUBLIC',
    });
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
  context?: WcmsExperienceResolveRequest,
): Promise<WcmsExperienceIndexStatus> {
  return parseWcmsExperienceIndexStatus(
    await wcmsExperienceRequest(
      connection,
      configuration,
      `/authoring/index-status${context ? `?${new URLSearchParams(Object.entries(context).filter((entry): entry is [string, string] => typeof entry[1] === 'string')).toString()}` : ''}`,
      { method: 'GET' },
      fetchImplementation,
    ),
  );
}

export const privatePreviewCopyKeys = [
  'prepare',
  'inspect',
  'notice',
  'uncertain',
  'ready',
  'retire',
  'retireTitle',
  'retireMessage',
  'confirm',
  'cancel',
] as const;
export interface WcmsPrivatePreviewPreparation {
  readonly state: 'NOT_PREPARED' | 'READY' | 'INSPECTION_REQUIRED';
  readonly generation?: string;
  readonly documentCount?: number;
  readonly revision?: number;
  readonly pendingGeneration?: string;
  readonly presentation: Readonly<
    Record<(typeof privatePreviewCopyKeys)[number], string>
  >;
}

/** Exact scope and fixed private endpoints; returned metadata is never an executable route. */
export async function privateWcmsPreviewPreparation(
  connection: AxisModuleConnection,
  configuration: WcmsExperienceClientConfiguration,
  context: WcmsExperienceResolveRequest,
  operation: 'inspect' | 'prepare' | 'retire',
  inspected?: WcmsPrivatePreviewPreparation,
  fetchImplementation: typeof fetch = fetch,
): Promise<WcmsPrivatePreviewPreparation> {
  const endpoint = new URL(connection.endpoint);
  if (
    connection.moduleName !== 'wcmsExperience' ||
    connection.runtimeRole?.publication !== 'STAGED' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw new Error('Private preview requires the authorized Staged owner.');
  if (
    operation === 'retire' &&
    (inspected?.state !== 'INSPECTION_REQUIRED' ||
      !inspected.pendingGeneration ||
      inspected.revision === undefined)
  )
    throw new Error('Inspect the exact pending preparation before retiring it.');
  const path =
    '/authoring/preparation' +
    (operation === 'retire' ? '/abandon' : '') +
    (operation === 'inspect'
      ? `?${new URLSearchParams(Object.entries(context).filter((entry): entry is [string, string] => typeof entry[1] === 'string')).toString()}`
      : '');
  const body =
    operation === 'retire'
      ? {
          ...context,
          revision: inspected!.revision,
          pendingGeneration: inspected!.pendingGeneration,
        }
      : context;
  const source = asRecord(
    await wcmsExperienceRequest(
      connection,
      configuration,
      path,
      operation === 'inspect'
        ? { method: 'GET' }
        : { method: 'POST', body: JSON.stringify(body) },
      fetchImplementation,
    ),
    'Private preview preparation',
  );
  const scope = asRecord(source.scope, 'Private preview scope'),
    copy = asRecord(source.presentation, 'Private preview guidance');
  if (
    source.contractVersion !== 1 ||
    source.publication !== 'STAGED' ||
    !['NOT_PREPARED', 'READY', 'INSPECTION_REQUIRED'].includes(String(source.state)) ||
    [
      'site',
      'pageType',
      'targetType',
      'targetCode',
      'locale',
      'channel',
      'device',
      'region',
    ].some(
      (key) =>
        scope[key] !== (context[key as keyof WcmsExperienceResolveRequest] ?? ''),
    ) ||
    (operation !== 'inspect' && source.onlineChanged !== false) ||
    (operation === 'retire' &&
      source.retiredPendingGeneration !== inspected?.pendingGeneration) ||
    (source.revision !== undefined &&
      (!Number.isSafeInteger(source.revision) || Number(source.revision) < 0))
  )
    throw new Error(
      'Private preview acknowledgement does not match the current journey. Inspect before continuing.',
    );
  const uuid = (value: unknown) =>
    typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
  if (
    (source.state === 'READY' &&
      (!uuid(source.generation) ||
        !Number.isSafeInteger(source.documentCount) ||
        Number(source.documentCount) < 0)) ||
    (source.state === 'INSPECTION_REQUIRED' &&
      (!uuid(source.pendingGeneration) || source.revision === undefined))
  )
    throw new Error('Private preview generation evidence is incomplete.');
  const presentation = Object.fromEntries(
    privatePreviewCopyKeys.map((key) => {
      if (typeof copy[key] !== 'string' || !copy[key].trim() || copy[key].length > 2000)
        throw new Error('Private preview guidance is incompatible.');
      return [key, copy[key]];
    }),
  ) as WcmsPrivatePreviewPreparation['presentation'];
  return Object.freeze({
    state: source.state as WcmsPrivatePreviewPreparation['state'],
    presentation,
    ...(typeof source.generation === 'string' ? { generation: source.generation } : {}),
    ...(typeof source.pendingGeneration === 'string'
      ? { pendingGeneration: source.pendingGeneration }
      : {}),
    ...(typeof source.documentCount === 'number'
      ? { documentCount: source.documentCount }
      : {}),
    ...(typeof source.revision === 'number' ? { revision: source.revision } : {}),
  });
}

export interface GuidedExperienceSelection {
  readonly catalogCode: string;
  readonly siteCode: string;
  readonly pageCode: string;
}
export interface GuidedExperiencePlacement {
  readonly code: string;
  readonly site: string;
  readonly pageType: string;
  readonly slot: string;
  readonly targetType: string;
  readonly targetCode: string;
  readonly component: string;
  readonly rendererKey: string;
  readonly contractVersion: number;
  readonly priority: number;
  readonly revision: number;
  readonly locale?: string;
  readonly channel?: string;
}
export interface GuidedExperienceInspection extends GuidedExperienceSelection {
  readonly sourceVersion: string;
  readonly pageSourceVersion: string;
  readonly pageName: string;
  readonly canEdit: boolean;
  readonly maximumAbsolutePriority: number;
  readonly pageTypes: readonly string[];
  readonly slots: readonly string[];
  readonly targets: readonly {
    readonly targetType: string;
    readonly targetCode: string;
    readonly label: string;
  }[];
  readonly components: readonly { readonly code: string; readonly label: string }[];
  readonly placements: readonly GuidedExperiencePlacement[];
  readonly competingPlacements: readonly GuidedExperiencePlacement[];
  readonly presentation: { readonly targetHelp: string };
}
/** Strict owner choices: a partial or wrong-scope result never becomes an empty editable form. */
export async function inspectGuidedExperience(
  connection: AxisModuleConnection,
  configuration: WcmsExperienceClientConfiguration,
  selection: GuidedExperienceSelection,
): Promise<GuidedExperienceInspection> {
  const row = asRecord(
    await wcmsExperienceRequest(
      connection,
      configuration,
      '/authoring/placements?' + new URLSearchParams({ ...selection }).toString(),
    ),
    'Experience authoring',
  );
  const list = (value: unknown, maximum = 100): unknown[] => {
    if (!Array.isArray(value) || value.length > maximum)
      throw new Error('Experience choices are incomplete');
    return value;
  };
  const strings = (value: unknown) =>
    list(value).map((item) => {
      if (typeof item !== 'string' || !item.trim() || item.length > 256)
        throw new Error('Experience choice is invalid');
      return item;
    });
  if (
    row.contractVersion !== 1 ||
    Object.entries(selection).some(([key, value]) => row[key] !== value) ||
    !/^[a-f0-9]{64}$/.test(String(row.sourceVersion)) ||
    !/^[a-f0-9]{64}$/.test(String(row.pageSourceVersion)) ||
    typeof row.pageName !== 'string' ||
    typeof row.canEdit !== 'boolean' ||
    !Number.isSafeInteger(row.maximumAbsolutePriority) ||
    Number(row.maximumAbsolutePriority) < 1
  )
    throw new Error('Experience authoring selection could not be confirmed');
  const placements = (value: unknown) => {
    const seen = new Set<string>();
    return list(value).map((value) => {
      const item = asRecord(value, 'Experience placement');
      for (const key of [
        'code',
        'pageType',
        'slot',
        'targetType',
        'targetCode',
        'component',
        'rendererKey',
      ])
        if (
          typeof item[key] !== 'string' ||
          !String(item[key]).trim() ||
          String(item[key]).length > 256
        )
          throw new Error('Experience placement is invalid');
      if (
        seen.has(String(item.code)) ||
        item.site !== selection.siteCode ||
        !Number.isSafeInteger(item.revision) ||
        Number(item.revision) < 0 ||
        !Number.isSafeInteger(item.priority) ||
        !Number.isSafeInteger(item.contractVersion) ||
        Number(item.contractVersion) < 0
      )
        throw new Error('Experience placement revision is invalid');
      seen.add(String(item.code));
      return item as unknown as GuidedExperiencePlacement;
    });
  };
  const targets = list(row.targets, 101).map((value) => {
    const item = asRecord(value, 'Experience target');
    strings([item.targetType, item.targetCode, item.label]);
    return item as unknown as GuidedExperienceInspection['targets'][number];
  });
  const components = list(row.components).map((value) => {
    const item = asRecord(value, 'Experience block');
    strings([item.code, item.label]);
    return item as unknown as GuidedExperienceInspection['components'][number];
  });
  const presentation = asRecord(row.presentation, 'Experience guidance');
  strings([presentation.targetHelp]);
  return {
    ...selection,
    sourceVersion: String(row.sourceVersion),
    pageSourceVersion: String(row.pageSourceVersion),
    pageName: row.pageName,
    canEdit: row.canEdit,
    maximumAbsolutePriority: Number(row.maximumAbsolutePriority),
    pageTypes: strings(row.pageTypes),
    slots: strings(row.slots),
    targets,
    components,
    placements: placements(row.placements),
    competingPlacements: placements(row.competingPlacements),
    presentation: { targetHelp: String(presentation.targetHelp) },
  };
}
/** Sends exactly one owner command; a failed acknowledgement must be inspected, never replayed automatically. */
export async function saveGuidedExperience(
  connection: AxisModuleConnection,
  configuration: WcmsExperienceClientConfiguration,
  inspection: GuidedExperienceInspection,
  selected: GuidedExperiencePlacement,
  changes: Pick<
    GuidedExperiencePlacement,
    'slot' | 'targetType' | 'targetCode' | 'priority'
  >,
) {
  const row = asRecord(
    await wcmsExperienceRequest(connection, configuration, '/authoring/placements', {
      method: 'PUT',
      body: JSON.stringify({
        catalogCode: inspection.catalogCode,
        siteCode: inspection.siteCode,
        pageCode: inspection.pageCode,
        sourceVersion: inspection.sourceVersion,
        code: selected.code,
        expectedRevision: selected.revision,
        ...changes,
      }),
    }),
    'Experience save',
  );
  if (
    row.status !== 'SAVED' ||
    row.code !== selected.code ||
    row.revision !== selected.revision + 1 ||
    row.onlineChanged !== false ||
    !/^[a-f0-9]{64}$/.test(String(row.sourceVersion))
  )
    throw new Error(
      'The placement save could not be confirmed. Inspect the saved state before another change.',
    );
  return { code: selected.code, revision: Number(row.revision) };
}

/** Child graphs stay inert and bounded; they never select executable code in Axis. */
function parsePreviewChildren(
  value: unknown,
  depth: number,
  state: { count: number },
): readonly WcmsExperiencePreviewNode[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || depth > 12 || value.length > 200)
    throw new Error('Experience preview tree exceeds its bounds');
  return value.map((value) => {
    const item = asRecord(value, 'Experience preview block');
    if (
      ++state.count > 200 ||
      !optionalString(item.componentCode) ||
      !optionalString(item.rendererKey) ||
      !Number.isSafeInteger(item.contractVersion) ||
      Number(item.contractVersion) < 0
    )
      throw new Error('Experience preview block is invalid');
    return {
      componentCode: String(item.componentCode),
      rendererKey: String(item.rendererKey),
      contractVersion: Number(item.contractVersion),
      properties: asRecord(item.properties, 'Experience preview content'),
      components: parsePreviewChildren(item.components, depth + 1, state),
    };
  });
}
