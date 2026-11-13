import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import { observeEmployeeSessionResponse } from '../../../auth/employeeSessionEvents';
import type {
  DataRelease,
  DataReleaseDryRunOperation,
  DataReleaseDryRunSummary,
  DataReleaseReadiness,
  DataReleaseOperationResult,
  DataReleaseExecution,
  DataReleaseOperationSelection,
  DataReleasePlan,
  DataReleaseStatus,
  DataReleaseType,
  ImportRunError,
  ImportRunFailure,
  ImportRunRecordSummary,
  ImportValidationReport,
  ImportValidationRow,
  MediaImportOperationResult,
  MediaUploadContext,
  MediaUploadSummary,
  ImportRunSummary,
  GenericMediaImportRequest,
  InitializationProfile,
  InitializationProfileOperationResult,
  DataExportFileFormat,
  DataExportRequest,
  DataExportResult,
  DataExportResultSummary,
  DataExportMediaSummary,
  DataExportWorkspace,
} from './dataReleaseContracts';

export interface DataReleaseClientConfiguration {
  readonly sessionGeneration?: number | undefined;
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly timeoutMs: number;
}

/** Structured transport evidence; callers never infer error meaning from English owner text. */
export class DataAdministrationRequestError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'DataAdministrationRequestError';
    this.status = status;
    this.code = code;
  }
}

const dataReleaseTypes: readonly DataReleaseType[] = Object.freeze([
  'init',
  'core',
  'sample',
]);
const types = new Set<DataReleaseType>(dataReleaseTypes);
const statuses = new Set<DataReleaseStatus>([
  'NOT_INSTALLED',
  'CURRENT',
  'UPDATE_AVAILABLE',
  'DOWNGRADE_AVAILABLE',
  'INVALID_RELEASE',
  'RUNNING',
  'FAILED',
]);
const dryRunOperations = new Set<DataReleaseDryRunOperation>([
  'INSTALL',
  'UPDATE',
  'RETRY',
  'SKIP_CURRENT',
  'BLOCKED',
  'WAIT',
]);
const exportFormats = new Set<DataExportFileFormat>(['csv', 'json']);

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${label} is invalid`);
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function boundedArray<T>(
  value: unknown,
  parser: (item: unknown) => T | undefined,
  limit = 100,
): readonly T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return Object.freeze(
    value
      .slice(0, limit)
      .map(parser)
      .filter((item): item is T => item !== undefined),
  );
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseReadinessRepairAction(
  value: unknown,
): DataReleaseReadiness['blockers'][number]['repair'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const source = value as Record<string, unknown>;
  const label = optionalText(source.label);
  const operation = optionalText(source.operation);
  const action = optionalText(source.action);
  if (!label || !operation || !action) return undefined;
  return Object.freeze({
    available: booleanValue(source.available, false),
    label,
    operation,
    action,
    idempotent: booleanValue(source.idempotent, false),
    requiresConfirmation: booleanValue(source.requiresConfirmation, true),
  });
}

function parseReleaseReadiness(value: unknown): DataReleaseReadiness | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const source = record(value, 'Data release readiness');
  const blockers = boundedArray(
    source.blockers,
    (item): DataReleaseReadiness['blockers'][number] | undefined => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return undefined;
      }
      const blocker = item as Record<string, unknown>;
      const code = optionalText(blocker.code);
      const severity = optionalText(blocker.severity);
      const owner = optionalText(blocker.owner);
      const message = optionalText(blocker.message);
      const action = optionalText(blocker.action);
      if (!code || !severity || !owner || !message || !action) return undefined;
      const repair = parseReadinessRepairAction(blocker.repair);
      return Object.freeze({
        ...(optionalText(blocker.blockerCode)
          ? { blockerCode: optionalText(blocker.blockerCode) }
          : {}),
        code,
        severity,
        owner,
        ...(optionalText(blocker.ownerType)
          ? { ownerType: optionalText(blocker.ownerType) }
          : {}),
        ...(optionalText(blocker.source)
          ? { source: optionalText(blocker.source) }
          : {}),
        message,
        action,
        ...(optionalText(blocker.disabledReason)
          ? { disabledReason: optionalText(blocker.disabledReason) }
          : {}),
        ...(optionalText(blocker.targetServer)
          ? { targetServer: optionalText(blocker.targetServer) }
          : {}),
        ...(optionalText(blocker.targetRuntimeRole)
          ? { targetRuntimeRole: optionalText(blocker.targetRuntimeRole) }
          : {}),
        ...(optionalText(blocker.technicalStatus)
          ? { technicalStatus: optionalText(blocker.technicalStatus) }
          : {}),
        ...(repair ? { repair } : {}),
      });
    },
    20,
  );
  return Object.freeze({
    capabilityCode: text(source.capabilityCode, 'Readiness capability code'),
    displayName: text(source.displayName, 'Readiness display name'),
    owningModule: text(source.owningModule, 'Readiness owner'),
    capabilityType: text(source.capabilityType, 'Readiness capability type'),
    group: text(source.group, 'Readiness group'),
    ...(optionalText(source.extendsCapability)
      ? { extendsCapability: optionalText(source.extendsCapability) }
      : {}),
    ...(optionalText(source.businessOutcome)
      ? { businessOutcome: optionalText(source.businessOutcome) }
      : {}),
    businessStatus: text(source.businessStatus, 'Readiness business status'),
    technicalStatus: text(source.technicalStatus, 'Readiness technical status'),
    ...(optionalText(source.releaseStatus)
      ? { releaseStatus: optionalText(source.releaseStatus) }
      : {}),
    nextAction: text(source.nextAction, 'Readiness next action'),
    blockers: blockers ?? Object.freeze([]),
  });
}

function parseDataActions(value: unknown): readonly ('validate' | 'install')[] {
  if (value === undefined) return Object.freeze([]);
  if (
    !Array.isArray(value) ||
    value.some((action) => !['validate', 'install'].includes(action as string)) ||
    new Set(value).size !== value.length
  )
    throw new Error('Data operation actions are incompatible');
  return Object.freeze(value as ('validate' | 'install')[]);
}

function parseRelease(value: unknown): DataRelease {
  const source = record(value, 'Data release');
  const dataType = text(source.dataType, 'Data release type') as DataReleaseType;
  const status = text(source.status, 'Data release status') as DataReleaseStatus;
  if (!types.has(dataType) || !statuses.has(status))
    throw new Error('Data release is incompatible');
  const release: DataRelease = {
    moduleName: text(source.moduleName, 'Module name'),
    displayName: text(source.displayName, 'Module display name'),
    canonicalIdentity: text(source.canonicalIdentity, 'Canonical identity'),
    dataType,
    version: text(source.version, 'Release version'),
    description: optionalText(source.description) ?? '',
    checksum: text(source.checksum, 'Release checksum'),
    status,
    readiness: parseReleaseReadiness(source.readiness),
  };
  const optionalValues = {
    continuationSupported: source.continuationSupported === true ? true : undefined,
    allowedActions: parseDataActions(source.allowedActions),
    releaseCode: optionalText(source.releaseCode),
    sectionCode: optionalText(source.sectionCode),
    moduleIndex: optionalText(source.moduleIndex),
    destinationRole: optionalText(source.destinationRole),
    invalidReason: optionalText(source.invalidReason),
    parentModule: optionalText(source.parentModule),
    installedVersion: optionalText(source.installedVersion),
    installedAt: optionalText(source.installedAt),
    lastAttemptAt: optionalText(source.lastAttemptAt),
    lastRunId: optionalText(source.lastRunId),
  };
  return Object.freeze(
    Object.assign(
      release,
      Object.fromEntries(
        Object.entries(optionalValues).filter(
          ([, optionalValue]) => optionalValue !== undefined,
        ),
      ),
    ),
  );
}

function parseDryRunSummary(value: unknown): DataReleaseDryRunSummary | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const source = record(value, 'Data release dry-run summary');
  const mode = text(source.mode, 'Data release dry-run mode');
  const dataType = text(
    source.dataType,
    'Data release dry-run type',
  ) as DataReleaseType;
  if (mode !== 'VALIDATE' || !types.has(dataType)) {
    throw new Error('Data release dry-run summary is incompatible');
  }
  const summarySource = record(source.summary, 'Data release dry-run counters');
  const publicationFollowUps = boundedArray(
    source.publicationFollowUps,
    (item): DataReleaseDryRunSummary['publicationFollowUps'][number] | undefined => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return undefined;
      }
      const followUp = item as Record<string, unknown>;
      return Object.freeze({
        ...(optionalText(followUp.releaseCode)
          ? { releaseCode: optionalText(followUp.releaseCode) }
          : {}),
        displayName: text(followUp.displayName, 'Publication follow-up display name'),
        moduleName: text(followUp.moduleName, 'Publication follow-up module'),
        publicationPolicy: text(
          followUp.publicationPolicy,
          'Publication follow-up policy',
        ),
        ...(optionalText(followUp.initialPublicationPolicy)
          ? {
              initialPublicationPolicy: optionalText(followUp.initialPublicationPolicy),
            }
          : {}),
        ...(optionalText(followUp.targetRole)
          ? { targetRole: optionalText(followUp.targetRole) }
          : {}),
        ...(optionalText(followUp.sourceRole)
          ? { sourceRole: optionalText(followUp.sourceRole) }
          : {}),
        ...(optionalText(followUp.siteCode)
          ? { siteCode: optionalText(followUp.siteCode) }
          : {}),
        ...(optionalText(followUp.catalogCode)
          ? { catalogCode: optionalText(followUp.catalogCode) }
          : {}),
        workflowRequired: followUp.workflowRequired === true,
        nextAction: text(followUp.nextAction, 'Publication follow-up next action'),
        impact: text(followUp.impact, 'Publication follow-up impact'),
      });
    },
    256,
  );
  const outcomes = boundedArray(
    source.outcomes,
    (item): DataReleaseDryRunSummary['outcomes'][number] | undefined => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return undefined;
      }
      const outcome = item as Record<string, unknown>;
      const status = text(
        outcome.status,
        'Dry-run release status',
      ) as DataReleaseStatus;
      const operation = text(
        outcome.operation,
        'Dry-run release operation',
      ) as DataReleaseDryRunOperation;
      if (!statuses.has(status) || !dryRunOperations.has(operation)) {
        return undefined;
      }
      const blockers = boundedArray(
        outcome.blockers,
        (blocker) => {
          if (
            typeof blocker !== 'object' ||
            blocker === null ||
            Array.isArray(blocker)
          ) {
            return undefined;
          }
          const parsed = parseReleaseReadiness({
            capabilityCode: 'dryRun',
            displayName: 'Dry-run',
            owningModule: 'import',
            capabilityType: 'DATA_RELEASE',
            group: 'FOUNDATION_DATA',
            businessStatus: 'NEEDS_ATTENTION',
            technicalStatus: status,
            nextAction: 'Review release readiness',
            blockers: [blocker],
          });
          return parsed?.blockers[0];
        },
        20,
      );
      return Object.freeze({
        ...(optionalText(outcome.releaseCode)
          ? { releaseCode: optionalText(outcome.releaseCode) }
          : {}),
        displayName: text(outcome.displayName, 'Dry-run release display name'),
        moduleName: text(outcome.moduleName, 'Dry-run module name'),
        status,
        operation,
        impact: text(outcome.impact, 'Dry-run impact'),
        nextAction: text(outcome.nextAction, 'Dry-run next action'),
        blockers: blockers ?? Object.freeze([]),
      });
    },
    256,
  );
  return Object.freeze({
    mode: 'VALIDATE',
    validationOnly: source.validationOnly === true,
    importExecuted: source.importExecuted === true,
    dataType,
    tenant: text(source.tenant, 'Data release dry-run tenant'),
    totalReleases: optionalNumber(source.totalReleases) ?? 0,
    executableReleases: optionalNumber(source.executableReleases) ?? 0,
    alreadyCurrent: optionalNumber(source.alreadyCurrent) ?? 0,
    blockedReleases: optionalNumber(source.blockedReleases) ?? 0,
    summary: Object.freeze({
      install: optionalNumber(summarySource.install) ?? 0,
      update: optionalNumber(summarySource.update) ?? 0,
      retry: optionalNumber(summarySource.retry) ?? 0,
      skip: optionalNumber(summarySource.skip) ?? 0,
      blocked: optionalNumber(summarySource.blocked) ?? 0,
      wait: optionalNumber(summarySource.wait) ?? 0,
    }),
    outcomes: outcomes ?? Object.freeze([]),
    publicationFollowUps: publicationFollowUps ?? Object.freeze([]),
    messages: boundedArray(source.messages, optionalText, 20) ?? Object.freeze([]),
  });
}

function parseInitializationProfile(value: unknown): InitializationProfile {
  const source = record(value, 'Initialization profile');
  const status = text(
    source.status,
    'Initialization profile status',
  ) as InitializationProfile['status'];
  if (!['ACTION_REQUIRED', 'BLOCKED', 'RUNNING', 'CURRENT'].includes(status)) {
    throw new Error('Initialization profile status is incompatible');
  }
  if (!Array.isArray(source.steps))
    throw new Error('Initialization profile steps are invalid');
  const destinationRole = optionalText(source.destinationRole);
  const moduleIndex = optionalText(source.moduleIndex);
  return Object.freeze({
    allowedActions: parseDataActions(source.allowedActions),
    profileCode: text(source.profileCode, 'Initialization profile code'),
    label: text(source.label, 'Initialization profile label'),
    description: text(source.description, 'Initialization profile description'),
    completionMessage: text(
      source.completionMessage,
      'Initialization profile completion message',
    ),
    ...(moduleIndex ? { moduleIndex } : {}),
    ...(destinationRole ? { destinationRole } : {}),
    status,
    blocked: source.blocked === true,
    steps: Object.freeze(
      source.steps.map((value, index) => {
        const step = record(value, 'Initialization profile step');
        const dataType = text(
          step.dataType,
          'Initialization profile step type',
        ) as DataReleaseType;
        if (!types.has(dataType) || !Array.isArray(step.releases))
          throw new Error('Initialization profile step is incompatible');
        return Object.freeze({
          order: optionalNumber(step.order) ?? index + 1,
          dataType,
          releases: Object.freeze(step.releases.map(parseRelease)),
        });
      }),
    ),
  });
}

function parseImportRunSummary(value: unknown): ImportRunRecordSummary | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const source = value as Record<string, unknown>;
  const optionalValues = {
    recordsRead: optionalNumber(source.recordsRead),
    recordsFinalized: optionalNumber(source.recordsFinalized),
    recordsDispatched: optionalNumber(source.recordsDispatched),
    recordsSucceeded: optionalNumber(source.recordsSucceeded),
    recordsFailed: optionalNumber(source.recordsFailed),
    recordsSkipped: optionalNumber(source.recordsSkipped),
    validationErrors: optionalNumber(source.validationErrors),
    totalRecordsHandled: optionalNumber(source.totalRecordsHandled),
  };
  if (Object.values(optionalValues).every((item) => item === undefined)) {
    return undefined;
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries(optionalValues).filter(([, item]) => item !== undefined),
    ),
  );
}

function parseImportRunError(value: unknown): ImportRunError | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const source = value as Record<string, unknown>;
  const optionalValues = {
    code: optionalText(source.code),
    message: optionalText(source.message),
    name: optionalText(source.name),
  };
  if (Object.values(optionalValues).every((item) => item === undefined)) {
    return undefined;
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries(optionalValues).filter(([, item]) => item !== undefined),
    ),
  );
}

function parseImportRunFailure(value: unknown): ImportRunFailure | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const source = value as Record<string, unknown>;
  const optionalValues = {
    tenant: optionalText(source.tenant),
    owningModule: optionalText(source.owningModule),
    targetModule: optionalText(source.targetModule),
    headerName: optionalText(source.headerName),
    fileName: optionalText(source.fileName),
    recordKey: optionalText(source.recordKey),
    schemaName: optionalText(source.schemaName),
    indexName: optionalText(source.indexName),
    operation: optionalText(source.operation),
    propertyName: optionalText(source.propertyName),
    rowNumber: optionalNumber(source.rowNumber),
    error:
      parseImportRunError(source.error) ??
      (source.code !== undefined || source.message !== undefined
        ? parseImportRunError(source)
        : undefined),
  };
  if (Object.values(optionalValues).every((item) => item === undefined)) {
    return undefined;
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries(optionalValues).filter(([, item]) => item !== undefined),
    ),
  );
}

function parseImportValidationRow(value: unknown): ImportValidationRow | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const source = value as Record<string, unknown>;
  const status = optionalText(source.status);
  if (!status) {
    return undefined;
  }
  const optionalValues = {
    rowNumber: optionalNumber(source.rowNumber),
    recordKey: optionalText(source.recordKey),
    severity: optionalText(source.severity),
    fileName: optionalText(source.fileName),
    schemaName: optionalText(source.schemaName),
    indexName: optionalText(source.indexName),
    operation: optionalText(source.operation),
    tenant: optionalText(source.tenant),
    field: optionalText(source.field),
    message: optionalText(source.message),
    howToFix: optionalText(source.howToFix),
    technicalCode: optionalText(source.technicalCode),
    errorCount: optionalNumber(source.errorCount),
  };
  return Object.freeze(
    Object.assign(
      { status },
      Object.fromEntries(
        Object.entries(optionalValues).filter(([, item]) => item !== undefined),
      ),
    ),
  );
}

function parseImportValidationReport(
  value: unknown,
): ImportValidationReport | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const source = value as Record<string, unknown>;
  return Object.freeze({
    totalRecords: optionalNumber(source.totalRecords) ?? 0,
    validRecords: optionalNumber(source.validRecords) ?? 0,
    invalidRecords: optionalNumber(source.invalidRecords) ?? 0,
    warningRecords: optionalNumber(source.warningRecords) ?? 0,
    rows: boundedArray(source.rows, parseImportValidationRow, 10000) ?? [],
  });
}

function parseImportRun(value: unknown): ImportRunSummary | undefined {
  if (typeof value === 'string' && value.trim()) {
    return Object.freeze({
      runId: value.trim(),
      status: 'UNKNOWN',
      modules: Object.freeze([]),
    });
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const source = record(value, 'Import run');
  const runId =
    optionalText(source.runId) ??
    optionalText(source.code) ??
    optionalText(source._id) ??
    'unknown';
  const summary: ImportRunSummary = {
    runId,
    status: optionalText(source.status) ?? 'UNKNOWN',
    modules: Object.freeze(
      Array.isArray(source.modules)
        ? source.modules.filter(
            (moduleName): moduleName is string =>
              typeof moduleName === 'string' && moduleName.length <= 128,
          )
        : [],
    ),
  };
  const optionalValues = {
    dataType: optionalText(source.dataType),
    requestedBy: optionalText(source.requestedBy),
    createdAt: optionalText(source.createdAt),
    summary: parseImportRunSummary(source.summary),
    failures: boundedArray(source.failures, parseImportRunFailure),
    validationErrors: boundedArray(source.validationErrors, parseImportRunFailure),
    validationOnly:
      typeof source.validationOnly === 'boolean' ? source.validationOnly : undefined,
  };
  return Object.freeze(
    Object.assign(
      summary,
      Object.fromEntries(
        Object.entries(optionalValues).filter(([, item]) => item !== undefined),
      ),
    ),
  );
}

function envelopeData(value: unknown): unknown {
  const envelope = record(value, 'Import response');
  if (
    envelope.success === false ||
    envelope.acknowledged === false ||
    envelope.error ||
    (envelope.errors !== undefined &&
      (!Array.isArray(envelope.errors) || envelope.errors.length > 0)) ||
    [envelope.code, envelope.responseCode].some(
      (code) => typeof code === 'string' && code.startsWith('ERR_'),
    )
  )
    throw new Error(
      'The owner response could not be confirmed. Inspect current owner state before another attempt.',
    );
  if ('result' in envelope) return envelope.result;
  if ('data' in envelope) return envelope.data;
  if ('code' in envelope || 'responseCode' in envelope) return envelope;
  throw new Error('Import response does not contain data');
}

interface ServiceErrorContext {
  readonly serviceName: string;
  readonly unauthorizedMessage: string;
}

const importServiceErrorContext: ServiceErrorContext = Object.freeze({
  serviceName: 'Import service',
  unauthorizedMessage: 'You are not authorized to perform this import operation.',
});

const mediaServiceErrorContext: ServiceErrorContext = Object.freeze({
  serviceName: 'Media service',
  unauthorizedMessage: 'You are not authorized to perform this media operation.',
});

const exportServiceErrorContext: ServiceErrorContext = Object.freeze({
  serviceName: 'Export service',
  unauthorizedMessage: 'You are not authorized to perform this export operation.',
});

function requestTimeoutMs(
  configuration: DataReleaseClientConfiguration,
  options: RequestInit,
): number {
  const method = String(options.method ?? 'GET').toUpperCase();
  return method === 'GET'
    ? configuration.timeoutMs
    : Math.max(configuration.timeoutMs, 180_000);
}

async function safeError(
  response: Response,
  context: ServiceErrorContext = importServiceErrorContext,
): Promise<DataAdministrationRequestError> {
  let code: string | undefined;
  const error = (message: string) =>
    new DataAdministrationRequestError(response.status, message, code);
  try {
    const value = record(await response.json(), `${context.serviceName} error`);
    const suppliedCode = optionalText(value.code) ?? optionalText(value.responseCode);
    if (suppliedCode && /^[A-Z0-9_]{1,64}$/.test(suppliedCode)) code = suppliedCode;
    const message = optionalText(value.message);
    const nested = boundedArray(value.errors, parseImportRunError, 3) ?? [];
    const nestedText = nested
      .map((item) => [item.code, item.message].filter(Boolean).join(': '))
      .filter((item) => item.length > 0)
      .join(' | ');
    if (message && nestedText && `${message}: ${nestedText}`.length <= 500) {
      return error(`${message}: ${nestedText}`);
    }
    if (message && message.length <= 500) return error(message);
  } catch {
    // Preserve the bounded HTTP fallback.
  }
  if (response.status === 403) return error(context.unauthorizedMessage);
  return error(`${context.serviceName} returned HTTP ${String(response.status)}`);
}

async function request(
  connection: AxisModuleConnection,
  path: string,
  configuration: DataReleaseClientConfiguration,
  options: RequestInit = {},
  fetchImplementation: typeof fetch = fetch,
  context: ServiceErrorContext = importServiceErrorContext,
): Promise<unknown> {
  const issuedIdentity = {
    accessToken: configuration.accessToken,
    generation: configuration.sessionGeneration,
  };
  const endpoint = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol))
    throw new Error(`${context.serviceName} endpoint is invalid`);
  const controller = new AbortController();
  const effectiveTimeoutMs = requestTimeoutMs(configuration, options);
  const timeout = globalThis.setTimeout(() => controller.abort(), effectiveTimeoutMs);
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
          Authorization: `Bearer ${issuedIdentity.accessToken}`,
          'Content-Type': 'application/json',
          'x-enterprise-code': configuration.enterpriseCode,
          ...options.headers,
        },
      },
    );
    if (
      observeEmployeeSessionResponse(
        response,
        issuedIdentity.accessToken,
        issuedIdentity.generation,
      )
    )
      throw new Error(
        'Your session has expired. Sign in again; refreshed import state has not been verified.',
      );
    if (!response.ok) throw await safeError(response, context);
    return envelopeData(await response.json());
  } catch (error: unknown) {
    if (controller.signal.aborted)
      throw new Error(`${context.serviceName} request timed out`);
    throw error instanceof Error
      ? error
      : new Error(`${context.serviceName} request failed`);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function multipartRequest(
  connection: AxisModuleConnection,
  path: string,
  configuration: DataReleaseClientConfiguration,
  body: FormData,
  fetchImplementation: typeof fetch = fetch,
): Promise<unknown> {
  const endpoint = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol))
    throw new Error('Media endpoint is invalid');
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const response = await fetchImplementation(
      new URL(`${endpoint.toString().replace(/\/$/, '')}/v0${path}`),
      {
        method: 'POST',
        body,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${configuration.accessToken}`,
          'x-enterprise-code': configuration.enterpriseCode,
        },
      },
    );
    if (!response.ok) throw await safeError(response, mediaServiceErrorContext);
    return envelopeData(await response.json());
  } catch (error: unknown) {
    if (controller.signal.aborted) throw new Error('Media upload timed out');
    throw error instanceof Error ? error : new Error('Media upload failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function loadDataReleases(
  connection: AxisModuleConnection,
  configuration: DataReleaseClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<readonly DataRelease[]> {
  const values = await Promise.all(
    dataReleaseTypes.map((dataType) =>
      request(connection, `/${dataType}`, configuration, {}, fetchImplementation),
    ),
  );
  return Object.freeze(
    values.flatMap((value) => {
      if (!Array.isArray(value)) throw new Error('Data release catalogue is invalid');
      return value.map(parseRelease);
    }),
  );
}

export async function loadInitializationProfiles(
  connection: AxisModuleConnection,
  configuration: DataReleaseClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<readonly InitializationProfile[]> {
  const value = await request(
    connection,
    '/initialization-profiles',
    configuration,
    {},
    fetchImplementation,
  );
  if (!Array.isArray(value))
    throw new Error('Initialization profile catalogue is invalid');
  return Object.freeze(value.map(parseInitializationProfile));
}

export async function runInitializationProfile(
  connection: AxisModuleConnection,
  configuration: DataReleaseClientConfiguration,
  profileCode: string,
  mode: 'validate' | 'install',
  fetchImplementation: typeof fetch = fetch,
): Promise<InitializationProfileOperationResult> {
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(profileCode))
    throw new Error('Initialization profile code is invalid');
  const value = record(
    await request(
      connection,
      `/initialization-profiles/${encodeURIComponent(profileCode)}/${mode}`,
      configuration,
      { method: 'POST', body: '{}' },
      fetchImplementation,
    ),
    'Initialization profile operation',
  );
  const operationMode = text(value.mode, 'Initialization profile operation mode');
  if (!['VALIDATE', 'INSTALL'].includes(operationMode))
    throw new Error('Initialization profile operation mode is invalid');
  return Object.freeze({
    profileCode: text(value.profileCode, 'Initialization profile operation code'),
    mode: operationMode as 'VALIDATE' | 'INSTALL',
    profile: parseInitializationProfile(value.profile),
  });
}

export async function preflightDataReleases(
  connection: AxisModuleConnection,
  configuration: DataReleaseClientConfiguration,
  plan: DataReleasePlan,
  fetchImplementation: typeof fetch = fetch,
): Promise<DataReleaseOperationResult> {
  return executeRequest(
    connection,
    `/${plan.dataType}/validate`,
    configuration,
    plan,
    fetchImplementation,
  );
}

export async function installDataReleases(
  connection: AxisModuleConnection,
  configuration: DataReleaseClientConfiguration,
  plan: DataReleasePlan,
  fetchImplementation: typeof fetch = fetch,
): Promise<DataReleaseOperationResult> {
  return executeRequest(
    connection,
    `/${plan.dataType}/install`,
    configuration,
    plan,
    fetchImplementation,
  );
}

export async function loadImportHistory(
  connection: AxisModuleConnection,
  configuration: DataReleaseClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<readonly ImportRunSummary[]> {
  const value = await request(
    connection,
    '/run/history?limit=50&skip=0',
    configuration,
    {},
    fetchImplementation,
  );
  if (!Array.isArray(value)) throw new Error('Import history is invalid');
  return Object.freeze(
    value.map((item) => {
      const importRun = parseImportRun(item);
      if (!importRun || importRun.runId === 'unknown')
        throw new Error('Import run identifier is invalid');
      return importRun;
    }),
  );
}

/** Reads one exact run from its authorized owner, independent of list paging. */
export async function loadImportRun(
  connection: AxisModuleConnection,
  configuration: DataReleaseClientConfiguration,
  runId: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<ImportRunSummary> {
  if (!/^[A-Za-z0-9_.:-]{1,192}$/.test(runId))
    throw new Error('The requested import run reference is invalid.');
  const value = await request(
    connection,
    `/run/history/${encodeURIComponent(runId)}`,
    configuration,
    {},
    fetchImplementation,
  );
  const run = parseImportRun(value);
  if (run?.runId !== runId)
    throw new Error('The exact import run is unavailable from the selected owner.');
  return run;
}

export async function loadExportHistory(
  connection: AxisModuleConnection,
  configuration: DataReleaseClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
  mediaCode?: string,
): Promise<readonly ImportRunSummary[]> {
  const value = await request(
    connection,
    `/history?limit=50&skip=0${mediaCode ? `&mediaCode=${encodeURIComponent(mediaCode)}` : ''}`,
    configuration,
    {},
    fetchImplementation,
    exportServiceErrorContext,
  );
  if (!Array.isArray(value)) throw new Error('Export history is invalid');
  return Object.freeze(
    value.map((item) => {
      const exportRun = parseImportRun(item);
      if (!exportRun || exportRun.runId === 'unknown')
        throw new Error('Export run identifier is invalid');
      const source = record(item, 'Export history entry');
      const media =
        source.media === undefined ? undefined : parseExportMedia(source.media);
      if (media && media.mediaCode !== exportRun.runId)
        throw new Error('Export history artifact identity is inconsistent');
      return Object.freeze(media ? { ...exportRun, media } : exportRun);
    }),
  );
}

export async function loadImportHistoryForMediaCode(
  connection: AxisModuleConnection,
  configuration: DataReleaseClientConfiguration,
  mediaCode: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<readonly ImportRunSummary[]> {
  const normalizedMediaCode = mediaCode.trim();
  if (!normalizedMediaCode) {
    throw new Error('Media code is required for import history lookup');
  }
  const value = await request(
    connection,
    `/run/history?limit=10&skip=0&mediaCode=${encodeURIComponent(normalizedMediaCode)}`,
    configuration,
    {},
    fetchImplementation,
  );
  if (!Array.isArray(value)) throw new Error('Import history is invalid');
  return Object.freeze(
    value.map((item) => {
      const importRun = parseImportRun(item);
      if (!importRun || importRun.runId === 'unknown')
        throw new Error('Import run identifier is invalid');
      const source = record(item, 'File import history entry');
      const media =
        source.mediaSource === undefined
          ? undefined
          : record(source.mediaSource, 'File import history source');
      if (
        (optionalText(media?.mediaCode) ??
          optionalText(media?.code) ??
          (typeof source.sourceName === 'string' &&
          source.sourceName.startsWith('media:')
            ? source.sourceName.slice('media:'.length)
            : undefined)) !== normalizedMediaCode
      )
        throw new Error('Import history returned an unrelated file attempt');
      return importRun;
    }),
  );
}

function parseMediaUpload(value: unknown): MediaUploadSummary {
  const source = record(value, 'Uploaded media');
  const media: MediaUploadSummary = {
    mediaCode: optionalText(source.mediaCode) ?? text(source.code, 'Media code'),
    name:
      optionalText(source.name) ??
      optionalText(source.originalFileName) ??
      'Uploaded file',
  };
  const optionalValues = {
    originalFileName: optionalText(source.originalFileName),
    extension: optionalText(source.extension),
    sizeBytes: optionalNumber(source.sizeBytes),
    checksum: optionalText(source.checksum),
    status: optionalText(source.status),
  };
  return Object.freeze(
    Object.assign(
      media,
      Object.fromEntries(
        Object.entries(optionalValues).filter(([, value]) => value !== undefined),
      ),
    ),
  );
}

function parseExportMedia(value: unknown): DataExportMediaSummary {
  const source = record(value, 'Export media');
  const media: DataExportMediaSummary = {
    mediaCode: optionalText(source.mediaCode) ?? text(source.code, 'Export media code'),
    name:
      optionalText(source.name) ??
      optionalText(source.originalFileName) ??
      'Generated export file',
  };
  const optionalValues = {
    originalFileName: optionalText(source.originalFileName),
    extension: optionalText(source.extension),
    sizeBytes: optionalNumber(source.sizeBytes),
    checksum: optionalText(source.checksum),
    status: optionalText(source.status),
    accessUrl: optionalText(source.accessUrl),
  };
  return Object.freeze(
    Object.assign(
      media,
      Object.fromEntries(
        Object.entries(optionalValues).filter(([, value]) => value !== undefined),
      ),
    ),
  );
}

function parseExportSummary(value: unknown): DataExportResultSummary {
  const source = record(value, 'Export summary');
  return Object.freeze({
    requestedRecords: optionalNumber(source.requestedRecords) ?? 0,
    exportedRecords: optionalNumber(source.exportedRecords) ?? 0,
    totalAvailableRecords: optionalNumber(source.totalAvailableRecords) ?? 0,
    truncated: source.truncated === true,
  });
}

function parseDataExportResult(value: unknown): DataExportResult {
  const source = record(value, 'Data export result');
  const format = text(source.format, 'Data export format') as DataExportFileFormat;
  if (!exportFormats.has(format)) throw new Error('Data export format is unsupported');
  return Object.freeze({
    moduleName: text(source.moduleName, 'Data export module'),
    schemaName: text(source.schemaName, 'Data export schema'),
    format,
    fileName: text(source.fileName, 'Data export file name'),
    media: parseExportMedia(source.media),
    summary: parseExportSummary(source.summary),
  });
}

export async function uploadImportMedia(
  connection: AxisModuleConnection,
  configuration: DataReleaseClientConfiguration,
  file: File,
  context: MediaUploadContext,
  fetchImplementation: typeof fetch = fetch,
): Promise<MediaUploadSummary> {
  const body = new FormData();
  body.append('folderCode', 'importSources');
  body.append('formatCode', 'importFile');
  body.append('enterpriseCode', context.enterpriseCode);
  body.append('tenantCode', context.tenantCode);
  body.append('moduleName', context.moduleName);
  body.append('schemaName', context.schemaName);
  body.append('name', file.name);
  body.append('file', file);
  return parseMediaUpload(
    await multipartRequest(
      connection,
      '/storage/upload',
      configuration,
      body,
      fetchImplementation,
    ),
  );
}

export async function validateMediaImport(
  connection: AxisModuleConnection,
  configuration: DataReleaseClientConfiguration,
  requestBody: GenericMediaImportRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<MediaImportOperationResult> {
  return executeMediaImport(
    connection,
    configuration,
    { ...requestBody, options: { validateOnly: true }, validationOnly: true },
    fetchImplementation,
  );
}

export async function installMediaImport(
  connection: AxisModuleConnection,
  configuration: DataReleaseClientConfiguration,
  requestBody: GenericMediaImportRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<MediaImportOperationResult> {
  return executeMediaImport(
    connection,
    configuration,
    { ...requestBody, importFinalizeData: true },
    fetchImplementation,
  );
}

/** Reads owner availability without probing or invoking a generation command. */
export async function loadDataExportWorkspace(
  connection: AxisModuleConnection,
  configuration: DataReleaseClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<DataExportWorkspace> {
  const source = record(
    await request(
      connection,
      '/workspace',
      configuration,
      { method: 'GET' },
      fetchImplementation,
      exportServiceErrorContext,
    ),
    'Export availability',
  );
  const allowedKeys = new Set([
    'contractVersion',
    'kind',
    'availability',
    'formats',
    'reason',
  ]);
  const state = source.availability;
  const formats = source.formats;
  const reason = source.reason;
  if (
    Object.keys(source).some((key) => !allowedKeys.has(key)) ||
    source.contractVersion !== 1 ||
    source.kind !== 'GOVERNED_EXPORT' ||
    typeof state !== 'string' ||
    !['AVAILABLE', 'DISABLED', 'UNAVAILABLE'].includes(state) ||
    !Array.isArray(formats) ||
    formats.length > 2 ||
    formats.some(
      (format) =>
        typeof format !== 'string' ||
        !exportFormats.has(format as DataExportFileFormat),
    ) ||
    new Set(formats).size !== formats.length ||
    (state === 'AVAILABLE'
      ? formats.length === 0 || reason !== undefined
      : typeof reason !== 'string' || !reason.trim() || reason.length > 240)
  ) {
    throw new Error('Export availability contract is incompatible');
  }
  return Object.freeze({
    contractVersion: 1,
    kind: 'GOVERNED_EXPORT',
    availability: state as DataExportWorkspace['availability'],
    formats: Object.freeze(formats as DataExportFileFormat[]),
    ...(typeof reason === 'string' ? { reason } : {}),
  });
}

export async function generateDataExport(
  connection: AxisModuleConnection,
  configuration: DataReleaseClientConfiguration,
  requestBody: DataExportRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<DataExportResult> {
  const result = parseDataExportResult(
    await request(
      connection,
      '/export',
      configuration,
      { method: 'POST', body: JSON.stringify(requestBody) },
      fetchImplementation,
      exportServiceErrorContext,
    ),
  );
  if (
    result.moduleName !== requestBody.moduleName ||
    result.schemaName !== requestBody.schemaName ||
    result.format !== requestBody.format
  ) {
    throw new Error(
      'Export response does not match the selected model and format. Inspect owner history before another export.',
    );
  }
  return result;
}

export interface DataExportDownload {
  readonly blob: Blob;
  readonly fileName: string;
}

export async function downloadDataExportMedia(
  connection: AxisModuleConnection,
  configuration: DataReleaseClientConfiguration,
  media: DataExportMediaSummary,
  fetchImplementation: typeof fetch = fetch,
): Promise<DataExportDownload> {
  const mediaCode = text(media.mediaCode, 'Export media code');
  const downloadUrl = mediaDownloadUrl(connection, mediaCode);
  if (!['http:', 'https:'].includes(downloadUrl.protocol))
    throw new Error('Media download endpoint is invalid');
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const response = await fetchImplementation(downloadUrl, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: '*/*',
        Authorization: `Bearer ${configuration.accessToken}`,
        'x-enterprise-code': configuration.enterpriseCode,
      },
    });
    if (!response.ok) throw await safeError(response, mediaServiceErrorContext);
    return Object.freeze({
      blob: await response.blob(),
      fileName:
        contentDispositionFileName(response.headers.get('content-disposition')) ??
        media.originalFileName ??
        media.name ??
        media.mediaCode,
    });
  } catch (error: unknown) {
    if (controller.signal.aborted) throw new Error('Media download timed out');
    throw error instanceof Error ? error : new Error('Media download failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function mediaDownloadUrl(connection: AxisModuleConnection, mediaCode: string): URL {
  const endpoint = new URL(connection.endpoint);
  const downloadUrl = new URL(
    `/nodics/media/v0/download/${encodeURIComponent(mediaCode)}`,
    endpoint.origin,
  );
  if (!['http:', 'https:'].includes(downloadUrl.protocol))
    throw new Error('Media download endpoint is invalid');
  return downloadUrl;
}

function contentDispositionFileName(value: string | null): string | undefined {
  if (!value) return undefined;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, ''));
    } catch {
      return utf8[1].trim().replace(/^"|"$/g, '');
    }
  }
  const ascii = /filename="?([^";]+)"?/i.exec(value);
  return ascii?.[1]?.trim();
}

/** Parses bounded canonical owner membership without resolving dependency graphs in the browser. */
function parseOperationSelection(
  value: unknown,
  dataType: DataReleaseType,
): DataReleaseOperationSelection | undefined {
  if (value === undefined) return undefined;
  const selection = record(value, 'Data release selection');
  const fail = (): never => {
    throw new Error('Data release operation selection is incompatible');
  };
  if (
    selection.contractVersion !== 1 ||
    !Array.isArray(selection.requestedReleaseCodes) ||
    !selection.requestedReleaseCodes.length ||
    !Array.isArray(selection.prerequisites) ||
    selection.requestedReleaseCodes.length + selection.prerequisites.length > 256
  )
    return fail();
  const codePattern = /^[A-Za-z][A-Za-z0-9._-]{0,127}:[A-Za-z][A-Za-z0-9_-]{0,127}$/;
  const requested = selection.requestedReleaseCodes.map((value) =>
    text(value, 'Requested release'),
  );
  if (requested.some((code) => !codePattern.test(code))) return fail();
  const seen = new Set(requested);
  if (seen.size !== requested.length) return fail();
  const prerequisites = selection.prerequisites.map((value) => {
    const item = record(value, 'Prerequisite release');
    const releaseCode = text(item.releaseCode, 'Prerequisite release code');
    const moduleName = text(item.moduleName, 'Prerequisite owner');
    const version = text(item.version, 'Prerequisite version');
    const checksum = text(item.checksum, 'Prerequisite checksum');
    if (
      !codePattern.test(releaseCode) ||
      !releaseCode.startsWith(moduleName + ':') ||
      item.dataType !== dataType ||
      !/^[a-f0-9]{64}$/.test(checksum) ||
      seen.has(releaseCode)
    )
      return fail();
    seen.add(releaseCode);
    return Object.freeze({ releaseCode, moduleName, dataType, version, checksum });
  });
  return Object.freeze({
    contractVersion: 1,
    requestedReleaseCodes: Object.freeze(requested),
    prerequisites: Object.freeze(prerequisites),
  });
}

async function executeRequest(
  connection: AxisModuleConnection,
  path: string,
  configuration: DataReleaseClientConfiguration,
  plan: DataReleasePlan,
  fetchImplementation: typeof fetch,
): Promise<DataReleaseOperationResult> {
  const value = record(
    await request(
      connection,
      path,
      configuration,
      { method: 'POST', body: JSON.stringify(plan) },
      fetchImplementation,
    ),
    'Data release operation',
  );
  const dataType = text(value.dataType, 'Data release type') as DataReleaseType;
  if (!types.has(dataType) || !Array.isArray(value.releases)) {
    throw new Error('Data release operation is incompatible');
  }
  const selection = parseOperationSelection(value.selection, dataType);
  const result: DataReleaseOperationResult = {
    ...(selection ? { selection } : {}),
    ...(value.execution
      ? { execution: parseDataReleaseExecution(value.execution) }
      : {}),
    dataType,
    tenant: text(value.tenant, 'Tenant'),
    releases: Object.freeze(value.releases.map(parseRelease)),
    dryRun: parseDryRunSummary(value.dryRun),
  };
  const importRun = optionalText(value.importRun);
  return Object.freeze(importRun ? { ...result, importRun } : result);
}

async function executeMediaImport(
  connection: AxisModuleConnection,
  configuration: DataReleaseClientConfiguration,
  body: Record<string, unknown>,
  fetchImplementation: typeof fetch,
): Promise<MediaImportOperationResult> {
  const value = record(
    await request(
      connection,
      '/media',
      configuration,
      { method: 'POST', body: JSON.stringify(body) },
      fetchImplementation,
    ),
    'Media import operation',
  );
  const mediaSource =
    value.mediaSource === undefined ? undefined : parseMediaUpload(value.mediaSource);
  const result: MediaImportOperationResult = {
    validationOnly: value.validationOnly === true,
  };
  const optionalValues = {
    validationPassed:
      typeof value.validationPassed === 'boolean' ? value.validationPassed : undefined,
    validationErrorCount: optionalNumber(value.validationErrorCount),
    validationErrors: boundedArray(value.validationErrors, parseImportRunFailure),
    validationReport: parseImportValidationReport(value.validationReport),
    importRun: parseImportRun(value.importRun),
    mediaSource,
  };
  return Object.freeze(
    Object.assign(
      result,
      Object.fromEntries(
        Object.entries(optionalValues).filter(([, item]) => item !== undefined),
      ),
    ),
  );
}

/** Parses durable, original-actor execution evidence without deriving owner authority. */
export function parseDataReleaseExecution(value: unknown): DataReleaseExecution {
  const source = record(value, 'Recorded preparation');
  const code = text(source.code, 'Preparation code');
  const planHash = text(source.planHash, 'Preparation checksum');
  const state = text(source.status, 'Preparation status');
  const dataType = text(source.dataType, 'Preparation data type') as DataReleaseType;
  const keys = source.releaseCodes;
  const versions = record(source.expectedReleases, 'Preparation versions');
  if (
    !/^releaseExecution_[a-f0-9]{64}$/.test(code) ||
    !/^[a-f0-9]{64}$/.test(planHash) ||
    !['READY', 'RUNNING', 'UNCERTAIN', 'COMPLETED'].includes(state) ||
    !types.has(dataType) ||
    !Array.isArray(keys) ||
    keys.length < 1 ||
    keys.length > 256 ||
    keys.some(
      (key) =>
        typeof key !== 'string' ||
        !/^[A-Za-z][A-Za-z0-9._-]{0,127}:[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(key),
    ) ||
    new Set(keys).size !== keys.length ||
    Object.keys(versions).length !== keys.length ||
    keys.some(
      (key: unknown) =>
        typeof key !== 'string' ||
        typeof versions[key] !== 'string' ||
        !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/.test(String(versions[key])),
    ) ||
    !Number.isSafeInteger(source.revision) ||
    Number(source.revision) < 1 ||
    !Number.isSafeInteger(source.completed) ||
    Number(source.completed) < 0 ||
    source.total !== keys.length ||
    Number(source.completed) > keys.length ||
    (state === 'COMPLETED' && source.completed !== source.total) ||
    source.automaticRetry !== false ||
    typeof source.nextAction !== 'string' ||
    source.nextAction.length > 512
  )
    throw new Error('Recorded preparation evidence is incompatible');
  return Object.freeze({
    code,
    planHash,
    status: state as DataReleaseExecution['status'],
    dataType,
    revision: Number(source.revision),
    completed: Number(source.completed),
    total: keys.length,
    nextAction: source.nextAction,
    canContinue: source.canContinue === true,
    releaseCodes: Object.freeze(keys as string[]),
    expectedReleases: Object.freeze(versions as Record<string, string>),
  });
}

/** Reloads original-actor plans from the selected Import owner, with no automatic continuation. */
export async function loadDataReleaseExecutions(
  connection: AxisModuleConnection,
  configuration: DataReleaseClientConfiguration,
  dataType: DataReleaseType,
  fetchImplementation: typeof fetch = fetch,
): Promise<readonly DataReleaseExecution[]> {
  const value = await request(
    connection,
    '/' + dataType + '/executions',
    configuration,
    {},
    fetchImplementation,
  );
  if (!Array.isArray(value) || value.length > 100)
    throw new Error('Recorded preparations are unavailable');
  return Object.freeze(value.map(parseDataReleaseExecution));
}
