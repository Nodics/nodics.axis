import type { AxisModuleConnection } from '../../bootstrap/publicBootstrap';

export type DocumentationPublicationReadiness =
  | 'NOT_IMPORTED'
  | 'IMPORTED'
  | 'PUBLICATION_PENDING'
  | 'READY'
  | 'REJECTED'
  | 'FAILED'
  | 'ROLLED_BACK'
  | 'RETIRED';

export type DocumentationPublicationAction = 'INITIALIZE' | 'ROLLBACK' | 'RETIRE';

export interface DocumentationPublicationStatus {
  readonly profileCode: string;
  readonly siteCode: string;
  readonly readiness: DocumentationPublicationReadiness;
  readonly releaseCode: string;
  readonly releaseVersion: string;
  readonly releaseStatus?: string;
  readonly allowedActions: readonly DocumentationPublicationAction[];
  readonly publication?: Readonly<{
    code: string;
    state: string;
    revision: number;
    requestedBy?: string;
    targetVersion?: string;
    workflowRef?: string;
    correlationId?: string;
  }>;
  readonly capability?: DocumentationCapabilityReadiness | undefined;
}

export interface DocumentationCapabilityReadiness {
  readonly capabilityCode: string;
  readonly displayName: string;
  readonly owningModule: string;
  readonly capabilityType: string;
  readonly group: string;
  readonly businessStatus: string;
  readonly technicalStatus: string;
  readonly releaseStatus?: string | undefined;
  readonly nextAction: string;
  readonly blockers: readonly DocumentationCapabilityBlocker[];
}

export interface DocumentationCapabilityBlocker {
  readonly code: string;
  readonly severity: string;
  readonly owner: string;
  readonly message: string;
  readonly action: string;
  readonly repair?: DocumentationCapabilityRepairAction | undefined;
  readonly runtimeDiagnostic?: DocumentationRuntimeDiagnostic | undefined;
}

export interface DocumentationRuntimeDiagnostic {
  readonly phase?: string | undefined;
  readonly sourceServer?: string | undefined;
  readonly sourceRuntimeRole?: string | undefined;
  readonly targetModule?: string | undefined;
  readonly targetConnection?: string | undefined;
  readonly targetServer?: string | undefined;
  readonly targetRuntimeRole?: string | undefined;
  readonly failureCode?: string | undefined;
  readonly suggestedAction?: string | undefined;
}

export interface DocumentationCapabilityRepairAction {
  readonly available: boolean;
  readonly label: string;
  readonly operation: string;
  readonly action: string;
  readonly idempotent: boolean;
  readonly requiresConfirmation: boolean;
}

interface Options {
  readonly connection: AxisModuleConnection;
  readonly enterpriseCode: string;
  readonly accessToken: string;
  readonly timeoutMs: number;
  readonly profileCode: string;
}

interface DocumentationPublicationOperationInput {
  readonly reason?: string | undefined;
  readonly forceRefresh?: boolean | undefined;
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${name} must be a non-empty string`);
  return value;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseRuntimeDiagnostic(value: unknown): DocumentationRuntimeDiagnostic | undefined {
  const diagnostic = optionalRecord(value);
  if (!diagnostic) return undefined;
  return Object.freeze({
    ...(optionalText(diagnostic.phase) ? { phase: optionalText(diagnostic.phase) } : {}),
    ...(optionalText(diagnostic.sourceServer)
      ? { sourceServer: optionalText(diagnostic.sourceServer) }
      : {}),
    ...(optionalText(diagnostic.sourceRuntimeRole)
      ? { sourceRuntimeRole: optionalText(diagnostic.sourceRuntimeRole) }
      : {}),
    ...(optionalText(diagnostic.targetModule)
      ? { targetModule: optionalText(diagnostic.targetModule) }
      : {}),
    ...(optionalText(diagnostic.targetConnection)
      ? { targetConnection: optionalText(diagnostic.targetConnection) }
      : {}),
    ...(optionalText(diagnostic.targetServer)
      ? { targetServer: optionalText(diagnostic.targetServer) }
      : {}),
    ...(optionalText(diagnostic.targetRuntimeRole)
      ? { targetRuntimeRole: optionalText(diagnostic.targetRuntimeRole) }
      : {}),
    ...(optionalText(diagnostic.failureCode)
      ? { failureCode: optionalText(diagnostic.failureCode) }
      : {}),
    ...(optionalText(diagnostic.suggestedAction)
      ? { suggestedAction: optionalText(diagnostic.suggestedAction) }
      : {}),
  });
}

function parseCapabilityRepairAction(
  value: unknown,
): DocumentationCapabilityRepairAction | undefined {
  if (value === undefined) return undefined;
  const repair = record(value, 'Documentation capability blocker repair');
  return Object.freeze({
    available: booleanValue(repair.available, false),
    label: text(repair.label, 'Documentation capability blocker repair label'),
    operation: text(repair.operation, 'Documentation capability blocker repair operation'),
    action: text(repair.action, 'Documentation capability blocker repair action'),
    idempotent: booleanValue(repair.idempotent, false),
    requiresConfirmation: booleanValue(repair.requiresConfirmation, true),
  });
}

function parseCapabilityReadiness(
  value: unknown,
): DocumentationCapabilityReadiness | undefined {
  if (value === undefined) return undefined;
  const capability = record(value, 'Documentation capability readiness');
  return Object.freeze({
    capabilityCode: text(capability.capabilityCode, 'Documentation capability code'),
    displayName: text(capability.displayName, 'Documentation capability display name'),
    owningModule: text(capability.owningModule, 'Documentation capability owner'),
    capabilityType: text(capability.capabilityType, 'Documentation capability type'),
    group: text(capability.group, 'Documentation capability group'),
    businessStatus: text(
      capability.businessStatus,
      'Documentation capability business status',
    ),
    technicalStatus: text(
      capability.technicalStatus,
      'Documentation capability technical status',
    ),
    ...(optionalText(capability.releaseStatus)
      ? { releaseStatus: optionalText(capability.releaseStatus) }
      : {}),
    nextAction: text(capability.nextAction, 'Documentation capability next action'),
    blockers: Object.freeze(
      Array.isArray(capability.blockers)
        ? capability.blockers.map((item) => {
            const blocker = record(item, 'Documentation capability blocker');
            return Object.freeze({
              code: text(blocker.code, 'Documentation capability blocker code'),
              severity: text(
                blocker.severity,
                'Documentation capability blocker severity',
              ),
              owner: text(blocker.owner, 'Documentation capability blocker owner'),
              message: text(
                blocker.message,
                'Documentation capability blocker message',
              ),
              action: text(blocker.action, 'Documentation capability blocker action'),
              ...(blocker.repair !== undefined
                ? { repair: parseCapabilityRepairAction(blocker.repair) }
                : {}),
              ...(parseRuntimeDiagnostic(blocker.runtimeDiagnostic)
                ? {
                    runtimeDiagnostic: parseRuntimeDiagnostic(
                      blocker.runtimeDiagnostic,
                    ),
                  }
                : {}),
            });
          })
        : [],
    ),
  });
}

function parse(value: unknown): DocumentationPublicationStatus {
  const envelope = record(value, 'Documentation publication response');
  const data = record(
    envelope.data ?? envelope.result,
    'Documentation publication status',
  );
  const readiness = text(data.readiness, 'Documentation readiness');
  if (
    ![
      'NOT_IMPORTED',
      'IMPORTED',
      'PUBLICATION_PENDING',
      'READY',
      'REJECTED',
      'FAILED',
      'ROLLED_BACK',
      'RETIRED',
    ].includes(readiness) ||
    !Array.isArray(data.allowedActions)
  )
    throw new Error('Documentation publication status is incompatible');
  const actions = data.allowedActions.map((item) => text(item, 'Documentation action'));
  if (actions.some((item) => !['INITIALIZE', 'ROLLBACK', 'RETIRE'].includes(item)))
    throw new Error('Documentation publication action is unsupported');
  const publication =
    data.publication === undefined
      ? undefined
      : record(data.publication, 'Publication');
  const result: DocumentationPublicationStatus = {
    profileCode: text(data.profileCode, 'Documentation profile'),
    siteCode: text(data.siteCode, 'Documentation site'),
    readiness: readiness as DocumentationPublicationReadiness,
    releaseCode: text(data.releaseCode, 'Documentation release'),
    releaseVersion: text(data.releaseVersion, 'Documentation release version'),
    allowedActions: Object.freeze(actions as DocumentationPublicationAction[]),
    ...(typeof data.releaseStatus === 'string'
      ? { releaseStatus: data.releaseStatus }
      : {}),
    ...(publication
      ? {
          publication: Object.freeze({
            code: text(publication.code, 'Publication code'),
            state: text(publication.state, 'Publication state'),
            revision: Number(publication.revision),
            ...(typeof publication.requestedBy === 'string'
              ? { requestedBy: publication.requestedBy }
              : {}),
            ...(typeof publication.targetVersion === 'string'
              ? { targetVersion: publication.targetVersion }
              : {}),
            ...(typeof publication.workflowRef === 'string'
              ? { workflowRef: publication.workflowRef }
              : {}),
            ...(typeof publication.correlationId === 'string'
              ? { correlationId: publication.correlationId }
              : {}),
          }),
        }
      : {}),
    ...(data.capability !== undefined
      ? { capability: parseCapabilityReadiness(data.capability) }
      : {}),
  };
  return Object.freeze(result);
}

async function parseErrorMessage(response: Response): Promise<string> {
  let body = '';
  try {
    body = await response.text();
  } catch {
    body = '';
  }
  if (!body.trim())
    return `Documentation publication returned HTTP ${String(response.status)}`;
  try {
    const parsed = JSON.parse(body) as unknown;
    const envelope = record(parsed, 'Documentation publication error');
    const data =
      typeof envelope.data === 'object' &&
      envelope.data !== null &&
      !Array.isArray(envelope.data)
        ? (envelope.data as Record<string, unknown>)
        : {};
    const metadata =
      typeof envelope.metadata === 'object' &&
      envelope.metadata !== null &&
      !Array.isArray(envelope.metadata)
        ? (envelope.metadata as Record<string, unknown>)
        : {};
    const message = [
      typeof envelope.message === 'string' ? envelope.message : '',
      typeof envelope.error === 'string' ? envelope.error : '',
      typeof data.message === 'string' ? data.message : '',
      typeof metadata.targetMessage === 'string' ? metadata.targetMessage : '',
    ]
      .filter(Boolean)
      .join(' ');
    if (
      /content changed without a new release version|increment and regenerate|checksum/iu.test(
        message,
      )
    ) {
      return 'Release version update required. Increment the content-pack version, regenerate the pack, then update Staged again.';
    }
    return message.trim()
      ? message
      : `Documentation publication returned HTTP ${String(response.status)}`;
  } catch {
    return body.trim().slice(0, 500);
  }
}

async function invoke(
  options: Options,
  method: 'GET' | 'POST',
  fetchImplementation: typeof fetch,
  operation?: 'initiate' | 'rollback' | 'retire' | 'reconcile-approval',
  input: DocumentationPublicationOperationInput = {},
) {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(options.profileCode))
    throw new Error('Documentation profile is invalid');
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), options.timeoutMs);
  const endpoint = options.connection.endpoint.replace(/\/$/, '');
  const path = `/v0/applications/${encodeURIComponent(options.profileCode)}/initialization${operation ? `/${operation}` : ''}`;
  try {
    const requestInit: RequestInit = {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${options.accessToken}`,
        'Content-Type': 'application/json',
        'x-enterprise-code': options.enterpriseCode,
      },
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
      ...(operation
        ? {
            body: JSON.stringify({
              reason:
                input.reason ??
                (operation === 'initiate'
                  ? 'Axis administrator requested documentation publication'
                  : operation === 'reconcile-approval'
                    ? 'Axis administrator requested documentation approval reconciliation'
                    : `Axis administrator requested documentation ${operation}`),
              forceRefresh: input.forceRefresh === true ? true : undefined,
            }),
          }
        : {}),
    };
    const response = await fetchImplementation(new URL(endpoint + path), requestInit);
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('You are not authorized to publish documentation.');
      }
      throw new Error(await parseErrorMessage(response));
    }
    return parse(await response.json());
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function createDocumentationPublicationClient(
  options: Options,
  fetchImplementation: typeof fetch = fetch,
) {
  return Object.freeze({
    getStatus: () => invoke(options, 'GET', fetchImplementation),
    initiate: (input?: DocumentationPublicationOperationInput) =>
      invoke(options, 'POST', fetchImplementation, 'initiate', input),
    reconcileApproval: (input?: DocumentationPublicationOperationInput) =>
      invoke(options, 'POST', fetchImplementation, 'reconcile-approval', input),
    rollback: () => invoke(options, 'POST', fetchImplementation, 'rollback'),
    retire: () => invoke(options, 'POST', fetchImplementation, 'retire'),
  });
}
