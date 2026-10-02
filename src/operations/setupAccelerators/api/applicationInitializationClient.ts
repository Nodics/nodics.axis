import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import {
  parseMediaPublicationDependency,
  type MediaPublicationDependency,
} from '../../readiness/mediaPublicationHandoff';
import {
  parseImportHistoryHandoff,
  type ImportHistoryHandoff,
} from '../../importExport/importHistoryHandoff';
import { parseApplicationVisual, type ApplicationVisual } from './applicationVisual';
import {
  parseApplicationSetupPlan,
  type ApplicationSetupPlan,
} from './applicationSetupPlan';

export type ApplicationInitializationReadiness =
  | 'NOT_IMPORTED'
  | 'IMPORTING'
  | 'IMPORTED'
  | 'PUBLICATION_PENDING'
  | 'MEDIA_DEPENDENCIES_PENDING'
  | 'BLOCKED'
  | 'READY'
  | 'REJECTED'
  | 'FAILED'
  | 'ROLLED_BACK'
  | 'RETIRED';

export type ApplicationInitializationAction = 'INITIALIZE' | 'ROLLBACK' | 'RETIRE';

export interface ApplicationInitializationProfile {
  readonly visual?: ApplicationVisual | undefined;
  readonly setupPlan?: ApplicationSetupPlan | undefined;
  readonly code: string;
  readonly title: string;
  readonly kind: string;
  readonly category: string;
  readonly summary: string;
  readonly order: number;
  readonly type: string;
  readonly owner: string;
  readonly applicationCode: string;
  readonly siteCode: string;
  readonly baselineCode: string;
  readonly contentPackCode?: string | undefined;
  readonly requiredServers: readonly string[];
  readonly requiredFunctionalModules: readonly Readonly<{
    readonly code: string;
    readonly label: string;
    readonly required: boolean;
    readonly order: number;
  }>[];
  readonly dataPackages: readonly Readonly<{
    readonly code: string;
    readonly kind: string;
    readonly required: boolean;
    readonly trigger: string;
    readonly dataType?: string | undefined;
    readonly targetServer?: string | undefined;
    readonly targetRuntimeRole?: string | undefined;
  }>[];
  readonly preparationSteps?: readonly ApplicationPreparationStep[] | undefined;
  readonly activationPolicy: Readonly<{
    readonly approvalRequiredForOnline: boolean;
    readonly requiredDataTrigger: string;
    readonly sampleDataTrigger: string;
  }>;
}

export interface ApplicationPreparationStep {
  readonly releaseReceipt?: ApplicationReleaseReceipt | undefined;
  readonly order: number;
  readonly type: string;
  readonly code: string;
  readonly kind: string;
  readonly label?: string | undefined;
  readonly required: boolean;
  readonly trigger: string;
  readonly dataType: string;
  readonly targetServer: string;
  readonly targetRuntimeRole: string;
  readonly status?: string | undefined;
  readonly version?: string | undefined;
  readonly installedVersion?: string | undefined;
  readonly description?: string | undefined;
  readonly message?: string | undefined;
  readonly manifestPath?: string | undefined;
  readonly runtimeDiagnostic?: ApplicationRuntimeDiagnostic | undefined;
}

/** Content-free owner installation evidence. lastRunId is historical, not proof of this attempt. */
export interface ApplicationReleaseReceipt {
  readonly releaseCode?: string | undefined;
  readonly status?: string | undefined;
  readonly version?: string | undefined;
  readonly installedVersion?: string | undefined;
  readonly lastRunId?: string | undefined;
}
export interface ApplicationPreparationGroupReceipt {
  readonly targetServer: string;
  readonly targetRuntimeRole: string;
  readonly dataType: string;
  readonly releaseCodes: readonly string[];
  readonly status: string;
  readonly failureCode?: string | undefined;
  readonly releases: readonly ApplicationReleaseReceipt[];
}
export interface ApplicationPreparationFailure {
  readonly historyHandoff?: ImportHistoryHandoff | undefined;
  readonly owner: 'import';
  readonly targetServer: string;
  readonly targetRuntimeRole: string;
  readonly dataType: string;
  readonly releaseCodes: readonly string[];
  readonly failureCode: string;
  readonly message: string;
  readonly automaticRetry: false;
}

export interface ApplicationInitializationStatus {
  readonly profileCode: string;
  readonly type: string;
  readonly owner: string;
  readonly applicationCode: string;
  readonly siteCode: string;
  readonly readiness: ApplicationInitializationReadiness;
  readonly releaseCode: string;
  readonly releaseVersion: string;
  readonly releaseStatus?: string | undefined;
  readonly profile?: ApplicationInitializationProfile | undefined;
  readonly allowedActions: readonly ApplicationInitializationAction[];
  readonly preparation?: Readonly<{
    readonly status: string;
    readonly steps: readonly ApplicationPreparationStep[];
    readonly groupReceipts?: readonly ApplicationPreparationGroupReceipt[] | undefined;
    readonly operationFailure?: ApplicationPreparationFailure | undefined;
  }>;
  readonly preparationOperation?: ApplicationPreparationOperationEvidence | undefined;
  readonly publication?: Readonly<{
    readonly code: string;
    readonly state: string;
    readonly revision: number;
    readonly targetVersion?: string | undefined;
    readonly workflowRef?: string | undefined;
    readonly correlationId?: string | undefined;
  }>;
  readonly repair?: ApplicationApprovalRepairEvidence | undefined;
  readonly capability?: ApplicationCapabilityReadiness | undefined;
}

export interface ApplicationPreparationOperationEvidence {
  readonly operation: string;
  readonly capabilityCode: string;
  readonly beforeStatus?: string | undefined;
  readonly afterStatus?: string | undefined;
  readonly attempted: boolean;
  readonly stepCount: number;
  readonly changed: boolean;
}

export interface ApplicationCapabilityReadiness {
  readonly subject?: ApplicationCapabilitySubject | undefined;
  readonly status?: string | undefined;
  readonly capabilityCode: string;
  readonly displayName: string;
  readonly owningModule: string;
  readonly capabilityType: string;
  readonly group: string;
  readonly businessStatus: string;
  readonly technicalStatus: string;
  readonly releaseStatus?: string | undefined;
  readonly lastEvaluatedAt?: string | undefined;
  readonly source?: string | undefined;
  readonly stale?: boolean | undefined;
  readonly dependencies?: readonly ApplicationCapabilityDependency[] | undefined;
  readonly dependencyGraph?: ApplicationCapabilityDependencyGraph | undefined;
  readonly repairActions?: readonly ApplicationCapabilityRepairAction[] | undefined;
  readonly publicationSummary?: ApplicationCapabilityPublicationSummary | undefined;
  readonly approvalDiagnostic?: ApplicationApprovalDiagnostic | undefined;
  readonly disabledReason?: string | undefined;
  readonly nextAction: string;
  readonly blockers: readonly ApplicationCapabilityBlocker[];
}

export interface ApplicationCapabilitySubject {
  readonly type: string;
  readonly code: string;
  readonly owner: string;
  readonly applicationCode?: string | undefined;
  readonly siteCode?: string | undefined;
}

export interface ApplicationCapabilityDependency {
  readonly kind: string;
  readonly code: string;
  readonly label: string;
  readonly required: boolean;
  readonly server?: string | undefined;
  readonly runtimeRole?: string | undefined;
  readonly trigger?: string | undefined;
  readonly dataType?: string | undefined;
  readonly classification?: string | undefined;
  readonly status: string;
  readonly evidence?: ApplicationCapabilityDependencyEvidence | undefined;
}

export interface ApplicationCapabilityDependencyEvidence {
  readonly runtimeState?: string | undefined;
  readonly registrationState?: string | undefined;
  readonly observedServers?: readonly string[] | undefined;
  readonly targetServer?: string | undefined;
  readonly targetRuntimeRole?: string | undefined;
  readonly trigger?: string | undefined;
  readonly dataType?: string | undefined;
  readonly classification?: string | undefined;
  readonly runtimeEvidence?:
    | Readonly<{
        readonly source?: string | undefined;
        readonly status?: string | undefined;
        readonly registrationState?: string | undefined;
        readonly enabled?: boolean | undefined;
        readonly stale?: boolean | undefined;
        readonly observedServers?: readonly string[] | undefined;
      }>
    | undefined;
  readonly runtimeDiagnostic?: ApplicationRuntimeDiagnostic | undefined;
  readonly approvalDiagnostic?: ApplicationApprovalDiagnostic | undefined;
}

export interface ApplicationCapabilityDependencyGraph {
  readonly nodes: readonly Readonly<{
    readonly id: string;
    readonly kind: string;
    readonly label: string;
    readonly status?: string | undefined;
    readonly evidence?: ApplicationCapabilityDependencyEvidence | undefined;
  }>[];
  readonly edges: readonly Readonly<{
    readonly from: string;
    readonly to: string;
    readonly relationship: string;
  }>[];
}

export interface ApplicationCapabilityPublicationSummary {
  readonly installed?: string | undefined;
  readonly staged?: string | undefined;
  readonly approval?: string | undefined;
  readonly online?: string | undefined;
  readonly runtime?: string | undefined;
  readonly media?: string | undefined;
}

export interface ApplicationCapabilityBlocker {
  readonly mediaDependency?: MediaPublicationDependency | undefined;
  readonly releaseReceipt?: ApplicationReleaseReceipt | undefined;
  readonly blockerCode?: string | undefined;
  readonly code: string;
  readonly severity: string;
  readonly owner: string;
  readonly ownerType?: string | undefined;
  readonly source?: string | undefined;
  readonly message: string;
  readonly action: string;
  readonly disabledReason?: string | undefined;
  readonly targetServer?: string | undefined;
  readonly targetRuntimeRole?: string | undefined;
  readonly technicalStatus?: string | undefined;
  readonly repair?: ApplicationCapabilityRepairAction | undefined;
  readonly runtimeDiagnostic?: ApplicationRuntimeDiagnostic | undefined;
  readonly approvalDiagnostic?: ApplicationApprovalDiagnostic | undefined;
}

export interface ApplicationRuntimeDiagnostic {
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

export interface ApplicationCapabilityRepairAction {
  readonly handoff?: ImportHistoryHandoff;
  readonly available: boolean;
  readonly label: string;
  readonly operation: string;
  readonly action: string;
  readonly idempotent: boolean;
  readonly requiresConfirmation: boolean;
  readonly owner?: string | undefined;
  readonly targetServer?: string | undefined;
  readonly targetRuntimeRole?: string | undefined;
  readonly eligibility?: string | undefined;
  readonly unavailableReason?: string | undefined;
}

export interface ApplicationApprovalRepairEvidence {
  readonly action?: string | undefined;
  readonly status?: string | undefined;
  readonly idempotent?: boolean | undefined;
  readonly previousWorkflowRef?: string | undefined;
  readonly workflowRef?: string | undefined;
  readonly publicationCode?: string | undefined;
  readonly message?: string | undefined;
}

export interface ApplicationApprovalDiagnostic {
  readonly source?: string | undefined;
  readonly status?: string | undefined;
  readonly publicationCode?: string | undefined;
  readonly publicationState?: string | undefined;
  readonly workflowRef?: string | undefined;
  readonly taskCode?: string | undefined;
  readonly taskStatus?: string | undefined;
  readonly assignee?: string | undefined;
  readonly queue?: string | undefined;
  readonly message?: string | undefined;
  readonly suggestedAction?: string | undefined;
  readonly disabledReason?: string | undefined;
}

interface ApplicationInitializationClientOptions {
  readonly connection: AxisModuleConnection;
  readonly enterpriseCode: string;
  readonly accessToken: string;
  readonly timeoutMs: number;
  readonly profileCode: string;
}

interface ApplicationInitializationOperationInput {
  readonly reason?: string | undefined;
  readonly forceRefresh?: boolean | undefined;
}

function requestTimeoutMs(
  options: ApplicationInitializationClientOptions,
  operation:
    | 'initiate'
    | 'prepare'
    | 'rollback'
    | 'retire'
    | 'reconcile-approval'
    | undefined,
): number {
  if (!operation) return Math.max(options.timeoutMs, 60_000);
  return Math.max(options.timeoutMs, 180_000);
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Accepts only safe scalar receipt evidence; never carries raw errors or import records. */
function receiptIdentifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.:-]{1,192}$/.test(value))
    throw new Error('Application import receipt is incompatible');
  return value;
}
function receiptCodes(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 256)
    throw new Error('Application import receipt is incompatible');
  return Object.freeze(value.map(receiptIdentifier));
}
function parseReleaseReceipt(value: unknown): ApplicationReleaseReceipt | undefined {
  if (value === undefined) return undefined;
  const source = record(value, 'Application release receipt');
  return Object.freeze(
    Object.fromEntries(
      ['releaseCode', 'status', 'version', 'installedVersion', 'lastRunId']
        .filter((key) => source[key] !== undefined)
        .map((key) => [key, receiptIdentifier(source[key])]),
    ),
  );
}
function parseGroupReceipts(
  value: unknown,
): readonly ApplicationPreparationGroupReceipt[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 256)
    throw new Error('Application import receipt is incompatible');
  return Object.freeze(
    value.map((item) => {
      const source = record(item, 'Application import group receipt');
      if (
        !['COMPLETE', 'UNCONFIRMED', 'FAILED', 'NOT_ATTEMPTED'].includes(
          String(source.status),
        ) ||
        !Array.isArray(source.releases) ||
        source.releases.length > 256
      )
        throw new Error('Application import receipt is incompatible');
      return Object.freeze({
        targetServer: receiptIdentifier(source.targetServer),
        targetRuntimeRole: receiptIdentifier(source.targetRuntimeRole),
        dataType: receiptIdentifier(source.dataType),
        releaseCodes: receiptCodes(source.releaseCodes),
        status: String(source.status),
        ...(source.failureCode !== undefined
          ? { failureCode: receiptIdentifier(source.failureCode) }
          : {}),
        releases: Object.freeze(
          source.releases.map((item) => parseReleaseReceipt(item)!),
        ),
      });
    }),
  );
}
function parsePreparationFailure(
  value: unknown,
): ApplicationPreparationFailure | undefined {
  if (value === undefined) return undefined;
  const source = record(value, 'Application import failure');
  if (
    source.owner !== 'import' ||
    source.automaticRetry !== false ||
    typeof source.message !== 'string' ||
    !source.message.trim() ||
    source.message.length > 512 ||
    Array.from(source.message).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw new Error('Application import failure is incompatible');
  return Object.freeze({
    owner: 'import',
    targetServer: receiptIdentifier(source.targetServer),
    targetRuntimeRole: receiptIdentifier(source.targetRuntimeRole),
    dataType: receiptIdentifier(source.dataType),
    releaseCodes: receiptCodes(source.releaseCodes),
    failureCode: receiptIdentifier(source.failureCode),
    message: source.message,
    automaticRetry: false,
    ...(source.historyHandoff !== undefined
      ? { historyHandoff: parseImportHistoryHandoff(source.historyHandoff) }
      : {}),
  });
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseRuntimeDiagnostic(
  value: unknown,
): ApplicationRuntimeDiagnostic | undefined {
  const diagnostic = optionalRecord(value);
  if (!diagnostic) return undefined;
  return Object.freeze({
    ...(optionalText(diagnostic.phase)
      ? { phase: optionalText(diagnostic.phase) }
      : {}),
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
): ApplicationCapabilityRepairAction | undefined {
  if (value === undefined) return undefined;
  const repair = record(value, 'Capability blocker repair');
  const handoff =
    repair.action === 'REVIEW_IMPORT_HISTORY'
      ? parseImportHistoryHandoff(repair.handoff)
      : undefined;
  if (handoff?.available && repair.route !== handoff.route)
    throw new Error('Import history repair route is incompatible');
  // Unavailable owner diagnostics need no command. Empty here represents absence,
  // as for the existing read-only history handoff; never invent an operation.
  const diagnosticOnly = repair.available === false && repair.operation === undefined;
  return Object.freeze({
    available: booleanValue(repair.available, false),
    label: text(repair.label, 'Capability blocker repair label'),
    operation:
      diagnosticOnly ||
      (repair.action === 'REVIEW_IMPORT_HISTORY' && repair.operation === undefined)
        ? ''
        : text(repair.operation, 'Capability blocker repair operation'),
    action: text(repair.action, 'Capability blocker repair action'),
    idempotent: booleanValue(repair.idempotent, false),
    requiresConfirmation: booleanValue(repair.requiresConfirmation, true),
    ...(handoff ? { handoff } : {}),
    ...(optionalText(repair.owner) ? { owner: optionalText(repair.owner) } : {}),
    ...(optionalText(repair.targetServer)
      ? { targetServer: optionalText(repair.targetServer) }
      : {}),
    ...(optionalText(repair.targetRuntimeRole)
      ? { targetRuntimeRole: optionalText(repair.targetRuntimeRole) }
      : {}),
    ...(optionalText(repair.eligibility)
      ? { eligibility: optionalText(repair.eligibility) }
      : {}),
    ...(optionalText(repair.unavailableReason)
      ? { unavailableReason: optionalText(repair.unavailableReason) }
      : {}),
  });
}

function parseApprovalRepairEvidence(
  value: unknown,
): ApplicationApprovalRepairEvidence | undefined {
  if (value === undefined) return undefined;
  const repair = record(value, 'Application approval repair');
  return Object.freeze({
    ...(optionalText(repair.action) ? { action: optionalText(repair.action) } : {}),
    ...(optionalText(repair.status) ? { status: optionalText(repair.status) } : {}),
    ...(typeof repair.idempotent === 'boolean'
      ? { idempotent: repair.idempotent }
      : {}),
    ...(optionalText(repair.previousWorkflowRef)
      ? { previousWorkflowRef: optionalText(repair.previousWorkflowRef) }
      : {}),
    ...(optionalText(repair.workflowRef)
      ? { workflowRef: optionalText(repair.workflowRef) }
      : {}),
    ...(optionalText(repair.publicationCode)
      ? { publicationCode: optionalText(repair.publicationCode) }
      : {}),
    ...(optionalText(repair.message) ? { message: optionalText(repair.message) } : {}),
  });
}

function parseApprovalDiagnostic(
  value: unknown,
): ApplicationApprovalDiagnostic | undefined {
  const diagnostic = optionalRecord(value);
  if (!diagnostic) return undefined;
  return Object.freeze({
    ...(optionalText(diagnostic.source)
      ? { source: optionalText(diagnostic.source) }
      : {}),
    ...(optionalText(diagnostic.status)
      ? { status: optionalText(diagnostic.status) }
      : {}),
    ...(optionalText(diagnostic.publicationCode)
      ? { publicationCode: optionalText(diagnostic.publicationCode) }
      : {}),
    ...(optionalText(diagnostic.publicationState)
      ? { publicationState: optionalText(diagnostic.publicationState) }
      : {}),
    ...(optionalText(diagnostic.workflowRef)
      ? { workflowRef: optionalText(diagnostic.workflowRef) }
      : {}),
    ...(optionalText(diagnostic.taskCode)
      ? { taskCode: optionalText(diagnostic.taskCode) }
      : {}),
    ...(optionalText(diagnostic.taskStatus)
      ? { taskStatus: optionalText(diagnostic.taskStatus) }
      : {}),
    ...(optionalText(diagnostic.assignee)
      ? { assignee: optionalText(diagnostic.assignee) }
      : {}),
    ...(optionalText(diagnostic.queue)
      ? { queue: optionalText(diagnostic.queue) }
      : {}),
    ...(optionalText(diagnostic.message)
      ? { message: optionalText(diagnostic.message) }
      : {}),
    ...(optionalText(diagnostic.suggestedAction)
      ? { suggestedAction: optionalText(diagnostic.suggestedAction) }
      : {}),
    ...(optionalText(diagnostic.disabledReason)
      ? { disabledReason: optionalText(diagnostic.disabledReason) }
      : {}),
  });
}

function parseCapabilitySubject(
  value: unknown,
): ApplicationCapabilitySubject | undefined {
  const subject = optionalRecord(value);
  if (!subject) return undefined;
  return Object.freeze({
    type: text(subject.type, 'Capability subject type'),
    code: text(subject.code, 'Capability subject code'),
    owner: text(subject.owner, 'Capability subject owner'),
    ...(optionalText(subject.applicationCode)
      ? { applicationCode: optionalText(subject.applicationCode) }
      : {}),
    ...(optionalText(subject.siteCode)
      ? { siteCode: optionalText(subject.siteCode) }
      : {}),
  });
}

function stringList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => (typeof item === 'string' && item.trim() ? item : undefined))
    .filter((item): item is string => Boolean(item));
  return items.length ? Object.freeze(items) : undefined;
}

function parseDependencyRuntimeEvidence(
  value: unknown,
): ApplicationCapabilityDependencyEvidence['runtimeEvidence'] {
  const evidence = optionalRecord(value);
  if (!evidence) return undefined;
  return Object.freeze({
    ...(optionalText(evidence.source) ? { source: optionalText(evidence.source) } : {}),
    ...(optionalText(evidence.status) ? { status: optionalText(evidence.status) } : {}),
    ...(optionalText(evidence.registrationState)
      ? { registrationState: optionalText(evidence.registrationState) }
      : {}),
    ...(typeof evidence.enabled === 'boolean' ? { enabled: evidence.enabled } : {}),
    ...(typeof evidence.stale === 'boolean' ? { stale: evidence.stale } : {}),
    ...(stringList(evidence.observedServers)
      ? { observedServers: stringList(evidence.observedServers) }
      : {}),
  });
}

function parseCapabilityDependencyEvidence(
  value: unknown,
): ApplicationCapabilityDependencyEvidence | undefined {
  const evidence = optionalRecord(value);
  if (!evidence) return undefined;
  return Object.freeze({
    ...(optionalText(evidence.runtimeState)
      ? { runtimeState: optionalText(evidence.runtimeState) }
      : {}),
    ...(optionalText(evidence.registrationState)
      ? { registrationState: optionalText(evidence.registrationState) }
      : {}),
    ...(stringList(evidence.observedServers)
      ? { observedServers: stringList(evidence.observedServers) }
      : {}),
    ...(optionalText(evidence.targetServer)
      ? { targetServer: optionalText(evidence.targetServer) }
      : {}),
    ...(optionalText(evidence.targetRuntimeRole)
      ? { targetRuntimeRole: optionalText(evidence.targetRuntimeRole) }
      : {}),
    ...(optionalText(evidence.trigger)
      ? { trigger: optionalText(evidence.trigger) }
      : {}),
    ...(optionalText(evidence.dataType)
      ? { dataType: optionalText(evidence.dataType) }
      : {}),
    ...(optionalText(evidence.classification)
      ? { classification: optionalText(evidence.classification) }
      : {}),
    ...(parseDependencyRuntimeEvidence(evidence.runtimeEvidence)
      ? { runtimeEvidence: parseDependencyRuntimeEvidence(evidence.runtimeEvidence) }
      : {}),
    ...(parseRuntimeDiagnostic(evidence.runtimeDiagnostic)
      ? { runtimeDiagnostic: parseRuntimeDiagnostic(evidence.runtimeDiagnostic) }
      : {}),
    ...(parseApprovalDiagnostic(evidence.approvalDiagnostic)
      ? { approvalDiagnostic: parseApprovalDiagnostic(evidence.approvalDiagnostic) }
      : {}),
  });
}

function parseCapabilityDependency(value: unknown): ApplicationCapabilityDependency {
  const dependency = record(value, 'Capability dependency');
  return Object.freeze({
    kind: text(dependency.kind, 'Capability dependency kind'),
    code: text(dependency.code, 'Capability dependency code'),
    label: text(dependency.label, 'Capability dependency label'),
    required: booleanValue(dependency.required, true),
    ...(optionalText(dependency.server)
      ? { server: optionalText(dependency.server) }
      : {}),
    ...(optionalText(dependency.runtimeRole)
      ? { runtimeRole: optionalText(dependency.runtimeRole) }
      : {}),
    ...(optionalText(dependency.trigger)
      ? { trigger: optionalText(dependency.trigger) }
      : {}),
    ...(optionalText(dependency.dataType)
      ? { dataType: optionalText(dependency.dataType) }
      : {}),
    ...(optionalText(dependency.classification)
      ? { classification: optionalText(dependency.classification) }
      : {}),
    status: text(dependency.status, 'Capability dependency status'),
    ...(parseCapabilityDependencyEvidence(dependency.evidence)
      ? { evidence: parseCapabilityDependencyEvidence(dependency.evidence) }
      : {}),
  });
}

function parseCapabilityDependencyGraph(
  value: unknown,
): ApplicationCapabilityDependencyGraph | undefined {
  const graph = optionalRecord(value);
  if (!graph) return undefined;
  return Object.freeze({
    nodes: Object.freeze(
      Array.isArray(graph.nodes)
        ? graph.nodes.map((item) => {
            const node = record(item, 'Capability dependency graph node');
            return Object.freeze({
              id: text(node.id, 'Capability dependency graph node'),
              kind: text(node.kind, 'Capability dependency graph node kind'),
              label: text(node.label, 'Capability dependency graph node label'),
              ...(optionalText(node.status)
                ? { status: optionalText(node.status) }
                : {}),
              ...(parseCapabilityDependencyEvidence(node.evidence)
                ? { evidence: parseCapabilityDependencyEvidence(node.evidence) }
                : {}),
            });
          })
        : [],
    ),
    edges: Object.freeze(
      Array.isArray(graph.edges)
        ? graph.edges.map((item) => {
            const edge = record(item, 'Capability dependency graph edge');
            return Object.freeze({
              from: text(edge.from, 'Capability dependency graph edge source'),
              to: text(edge.to, 'Capability dependency graph edge target'),
              relationship: text(
                edge.relationship,
                'Capability dependency graph edge relationship',
              ),
            });
          })
        : [],
    ),
  });
}

function parsePublicationSummary(
  value: unknown,
): ApplicationCapabilityPublicationSummary | undefined {
  const summary = optionalRecord(value);
  if (!summary) return undefined;
  return Object.freeze({
    ...(optionalText(summary.installed)
      ? { installed: optionalText(summary.installed) }
      : {}),
    ...(optionalText(summary.staged) ? { staged: optionalText(summary.staged) } : {}),
    ...(optionalText(summary.approval)
      ? { approval: optionalText(summary.approval) }
      : {}),
    ...(optionalText(summary.online) ? { online: optionalText(summary.online) } : {}),
    ...(optionalText(summary.runtime)
      ? { runtime: optionalText(summary.runtime) }
      : {}),
    ...(optionalText(summary.media) ? { media: optionalText(summary.media) } : {}),
  });
}

async function safeError(response: Response): Promise<string> {
  try {
    const value: unknown = await response.json();
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const message = (value as Record<string, unknown>).message;
      if (typeof message === 'string' && message.trim() && message.length <= 500) {
        return message;
      }
    }
  } catch {
    // Keep the bounded status fallback when the server response is not JSON.
  }
  if (response.status === 403) {
    return 'You are not authorized to initialize this accelerator.';
  }
  return `Application initialization returned HTTP ${String(response.status)}`;
}

/** A status GET throttle carries scheduling evidence only, never mutation retry authority. */
export class ApplicationReadinessThrottleError extends Error {
  readonly retryAt: number;

  constructor(message: string, retryAfter: string | null, now = Date.now()) {
    super(message);
    const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : NaN;
    const parsedDate = retryAfter ? Date.parse(retryAfter) : NaN;
    const delay = Number.isFinite(seconds) ? seconds * 1_000 : parsedDate - now;
    this.retryAt =
      now + Math.min(300_000, Math.max(5_000, Number.isFinite(delay) ? delay : 30_000));
  }
}

function parseProfile(value: unknown): ApplicationInitializationProfile {
  const data = record(value, 'Application initialization profile');
  const parseStep = (item: unknown): ApplicationPreparationStep => {
    const step = record(item, 'Application preparation step');
    return Object.freeze({
      order: Number(step.order ?? 1000),
      type: text(step.type, 'Application preparation step type'),
      code: text(step.code, 'Application preparation step code'),
      kind: text(step.kind, 'Application preparation step kind'),
      ...(optionalText(step.label) ? { label: optionalText(step.label) } : {}),
      required: booleanValue(step.required, true),
      trigger: text(step.trigger, 'Application preparation step trigger'),
      dataType: text(step.dataType, 'Application preparation step data type'),
      targetServer: text(step.targetServer, 'Application preparation target'),
      targetRuntimeRole: text(
        step.targetRuntimeRole,
        'Application preparation runtime role',
      ),
      ...(optionalText(step.status) ? { status: optionalText(step.status) } : {}),
      ...(optionalText(step.version) ? { version: optionalText(step.version) } : {}),
      ...(optionalText(step.installedVersion)
        ? { installedVersion: optionalText(step.installedVersion) }
        : {}),
      ...(optionalText(step.description)
        ? { description: optionalText(step.description) }
        : {}),
      ...(optionalText(step.message) ? { message: optionalText(step.message) } : {}),
      ...(optionalText(step.manifestPath)
        ? { manifestPath: optionalText(step.manifestPath) }
        : {}),
      ...(parseRuntimeDiagnostic(step.runtimeDiagnostic)
        ? { runtimeDiagnostic: parseRuntimeDiagnostic(step.runtimeDiagnostic) }
        : {}),
    });
  };
  const dataPackages = Array.isArray(data.dataPackages)
    ? data.dataPackages.map((item) => {
        const pack = record(item, 'Application initialization data package');
        return Object.freeze({
          code: text(pack.code, 'Application data package'),
          kind: text(pack.kind, 'Application data package kind'),
          required: booleanValue(pack.required, true),
          trigger: text(pack.trigger, 'Application data package trigger'),
          ...(optionalText(pack.dataType)
            ? { dataType: optionalText(pack.dataType) }
            : {}),
          ...(optionalText(pack.targetServer)
            ? { targetServer: optionalText(pack.targetServer) }
            : {}),
          ...(optionalText(pack.targetRuntimeRole)
            ? { targetRuntimeRole: optionalText(pack.targetRuntimeRole) }
            : {}),
        });
      })
    : [];
  const requiredFunctionalModules = Array.isArray(data.requiredFunctionalModules)
    ? data.requiredFunctionalModules.map((item) => {
        const requirement = record(item, 'Application required capability');
        return Object.freeze({
          code: text(requirement.code, 'Application required capability code'),
          label: text(requirement.label, 'Application required capability label'),
          required: booleanValue(requirement.required, true),
          order: Number(requirement.order ?? 1000),
        });
      })
    : [];
  const activationPolicy = record(
    data.activationPolicy ?? {},
    'Application activation policy',
  );
  return Object.freeze({
    code: text(data.code, 'Application profile'),
    setupPlan: parseApplicationSetupPlan(data.setupPlan),
    visual: parseApplicationVisual(data.visual),
    title: text(data.title, 'Application profile title'),
    kind: text(data.kind, 'Application profile kind'),
    category: text(data.category, 'Application profile category'),
    summary: typeof data.summary === 'string' ? data.summary : '',
    order: Number(data.order ?? 1000),
    type: text(data.type, 'Application profile type'),
    owner: text(data.owner, 'Application owner'),
    applicationCode: text(data.applicationCode, 'Application code'),
    siteCode: text(data.siteCode, 'Application site'),
    baselineCode: text(data.baselineCode, 'Application baseline'),
    ...(optionalText(data.contentPackCode)
      ? { contentPackCode: optionalText(data.contentPackCode) }
      : {}),
    requiredServers: Object.freeze(
      Array.isArray(data.requiredServers)
        ? data.requiredServers.map((item) => text(item, 'Application required server'))
        : [],
    ),
    requiredFunctionalModules: Object.freeze(requiredFunctionalModules),
    dataPackages: Object.freeze(dataPackages),
    ...(Array.isArray(data.preparationSteps)
      ? { preparationSteps: Object.freeze(data.preparationSteps.map(parseStep)) }
      : {}),
    activationPolicy: Object.freeze({
      approvalRequiredForOnline: booleanValue(
        activationPolicy.approvalRequiredForOnline,
        true,
      ),
      requiredDataTrigger:
        typeof activationPolicy.requiredDataTrigger === 'string'
          ? activationPolicy.requiredDataTrigger
          : 'ACTIVATION',
      sampleDataTrigger:
        typeof activationPolicy.sampleDataTrigger === 'string'
          ? activationPolicy.sampleDataTrigger
          : 'USER',
    }),
  });
}

function parse(value: unknown): ApplicationInitializationStatus {
  const envelope = record(value, 'Application initialization response');
  const data = record(
    envelope.data ?? envelope.result,
    'Application initialization status',
  );
  const readiness = text(data.readiness, 'Application readiness');
  if (
    ![
      'NOT_IMPORTED',
      'IMPORTING',
      'IMPORTED',
      'PUBLICATION_PENDING',
      'MEDIA_DEPENDENCIES_PENDING',
      'BLOCKED',
      'READY',
      'REJECTED',
      'FAILED',
      'ROLLED_BACK',
      'RETIRED',
    ].includes(readiness) ||
    !Array.isArray(data.allowedActions)
  ) {
    throw new Error('Application initialization status is incompatible');
  }
  const allowedActions = data.allowedActions.map((item) =>
    text(item, 'Application action'),
  );
  if (
    allowedActions.some((item) => !['INITIALIZE', 'ROLLBACK', 'RETIRE'].includes(item))
  ) {
    throw new Error('Application initialization action is unsupported');
  }
  const publication =
    data.publication === undefined
      ? undefined
      : record(data.publication, 'Application publication');
  const preparation =
    data.preparation === undefined
      ? undefined
      : record(data.preparation, 'Application preparation');
  const capability =
    data.capability === undefined
      ? undefined
      : record(data.capability, 'Application capability readiness');
  const preparationOperation =
    data.preparationOperation === undefined
      ? undefined
      : record(data.preparationOperation, 'Application preparation operation');
  const preparationSteps =
    preparation && Array.isArray(preparation.steps)
      ? preparation.steps.map((item) => {
          const step = record(item, 'Application preparation step');
          return Object.freeze({
            order: Number(step.order ?? 1000),
            ...(step.releaseReceipt !== undefined
              ? { releaseReceipt: parseReleaseReceipt(step.releaseReceipt) }
              : {}),
            type: text(step.type, 'Application preparation step type'),
            code: text(step.code, 'Application preparation step code'),
            kind: text(step.kind, 'Application preparation step kind'),
            ...(optionalText(step.label) ? { label: optionalText(step.label) } : {}),
            required: booleanValue(step.required, true),
            trigger: text(step.trigger, 'Application preparation step trigger'),
            dataType: text(step.dataType, 'Application preparation step data type'),
            targetServer: text(step.targetServer, 'Application preparation target'),
            targetRuntimeRole: text(
              step.targetRuntimeRole,
              'Application preparation runtime role',
            ),
            ...(optionalText(step.status) ? { status: optionalText(step.status) } : {}),
            ...(optionalText(step.version)
              ? { version: optionalText(step.version) }
              : {}),
            ...(optionalText(step.installedVersion)
              ? { installedVersion: optionalText(step.installedVersion) }
              : {}),
            ...(optionalText(step.description)
              ? { description: optionalText(step.description) }
              : {}),
            ...(optionalText(step.message)
              ? { message: optionalText(step.message) }
              : {}),
            ...(optionalText(step.manifestPath)
              ? { manifestPath: optionalText(step.manifestPath) }
              : {}),
            ...(parseRuntimeDiagnostic(step.runtimeDiagnostic)
              ? { runtimeDiagnostic: parseRuntimeDiagnostic(step.runtimeDiagnostic) }
              : {}),
          });
        })
      : [];
  return Object.freeze({
    profileCode: text(data.profileCode, 'Application profile'),
    type: text(data.type, 'Application profile type'),
    owner: text(data.owner, 'Application owner'),
    applicationCode: text(data.applicationCode, 'Application code'),
    siteCode: text(data.siteCode, 'Application site'),
    readiness: readiness as ApplicationInitializationReadiness,
    releaseCode: text(data.releaseCode, 'Application release'),
    releaseVersion: text(data.releaseVersion, 'Application release version'),
    ...(data.profile ? { profile: parseProfile(data.profile) } : {}),
    allowedActions: Object.freeze(allowedActions as ApplicationInitializationAction[]),
    ...(preparation
      ? {
          preparation: Object.freeze({
            status: text(preparation.status, 'Application preparation status'),
            steps: Object.freeze(preparationSteps),
            ...(preparation.groupReceipts !== undefined
              ? { groupReceipts: parseGroupReceipts(preparation.groupReceipts) }
              : {}),
            ...(preparation.operationFailure !== undefined
              ? {
                  operationFailure: parsePreparationFailure(
                    preparation.operationFailure,
                  ),
                }
              : {}),
          }),
        }
      : {}),
    ...(optionalText(data.releaseStatus)
      ? { releaseStatus: optionalText(data.releaseStatus) }
      : {}),
    ...(publication
      ? {
          publication: Object.freeze({
            code: text(publication.code, 'Publication code'),
            state: text(publication.state, 'Publication state'),
            revision: Number(publication.revision ?? 0),
            ...(optionalText(publication.targetVersion)
              ? { targetVersion: optionalText(publication.targetVersion) }
              : {}),
            ...(optionalText(publication.workflowRef)
              ? { workflowRef: optionalText(publication.workflowRef) }
              : {}),
            ...(optionalText(publication.correlationId)
              ? { correlationId: optionalText(publication.correlationId) }
              : {}),
          }),
        }
      : {}),
    ...(preparationOperation
      ? {
          preparationOperation: Object.freeze({
            operation: text(
              preparationOperation.operation,
              'Application preparation operation name',
            ),
            capabilityCode: text(
              preparationOperation.capabilityCode,
              'Application preparation operation capability',
            ),
            ...(optionalText(preparationOperation.beforeStatus)
              ? { beforeStatus: optionalText(preparationOperation.beforeStatus) }
              : {}),
            ...(optionalText(preparationOperation.afterStatus)
              ? { afterStatus: optionalText(preparationOperation.afterStatus) }
              : {}),
            attempted: booleanValue(preparationOperation.attempted, false),
            stepCount: Number(preparationOperation.stepCount ?? 0),
            changed: booleanValue(preparationOperation.changed, false),
          }),
        }
      : {}),
    ...(capability
      ? {
          capability: Object.freeze({
            ...(parseCapabilitySubject(capability.subject)
              ? { subject: parseCapabilitySubject(capability.subject) }
              : {}),
            ...(optionalText(capability.status)
              ? { status: optionalText(capability.status) }
              : {}),
            capabilityCode: text(capability.capabilityCode, 'Capability code'),
            displayName: text(capability.displayName, 'Capability display name'),
            owningModule: text(capability.owningModule, 'Capability owner'),
            capabilityType: text(capability.capabilityType, 'Capability type'),
            group: text(capability.group, 'Capability group'),
            businessStatus: text(
              capability.businessStatus,
              'Capability business status',
            ),
            technicalStatus: text(
              capability.technicalStatus,
              'Capability technical status',
            ),
            ...(optionalText(capability.releaseStatus)
              ? { releaseStatus: optionalText(capability.releaseStatus) }
              : {}),
            ...(optionalText(capability.lastEvaluatedAt)
              ? { lastEvaluatedAt: optionalText(capability.lastEvaluatedAt) }
              : {}),
            ...(optionalText(capability.source)
              ? { source: optionalText(capability.source) }
              : {}),
            ...(typeof capability.stale === 'boolean'
              ? { stale: capability.stale }
              : {}),
            ...(Array.isArray(capability.dependencies)
              ? {
                  dependencies: Object.freeze(
                    capability.dependencies.map(parseCapabilityDependency),
                  ),
                }
              : {}),
            ...(parseCapabilityDependencyGraph(capability.dependencyGraph)
              ? {
                  dependencyGraph: parseCapabilityDependencyGraph(
                    capability.dependencyGraph,
                  ),
                }
              : {}),
            ...(Array.isArray(capability.repairActions)
              ? {
                  repairActions: Object.freeze(
                    capability.repairActions
                      .map(parseCapabilityRepairAction)
                      .filter((item): item is ApplicationCapabilityRepairAction =>
                        Boolean(item),
                      ),
                  ),
                }
              : {}),
            ...(parsePublicationSummary(capability.publicationSummary)
              ? {
                  publicationSummary: parsePublicationSummary(
                    capability.publicationSummary,
                  ),
                }
              : {}),
            ...(parseApprovalDiagnostic(capability.approvalDiagnostic)
              ? {
                  approvalDiagnostic: parseApprovalDiagnostic(
                    capability.approvalDiagnostic,
                  ),
                }
              : {}),
            ...(optionalText(capability.disabledReason)
              ? { disabledReason: optionalText(capability.disabledReason) }
              : {}),
            nextAction: text(capability.nextAction, 'Capability next action'),
            blockers: Object.freeze(
              Array.isArray(capability.blockers)
                ? capability.blockers.map((item) => {
                    const blocker = record(item, 'Capability blocker');
                    const mediaDependency = parseMediaPublicationDependency(
                      blocker.mediaDependency,
                    );
                    if (mediaDependency && blocker.repair !== undefined) {
                      const repair = record(blocker.repair, 'Media dependency repair');
                      if (
                        repair.action === 'REVIEW_MEDIA_PUBLICATION' &&
                        repair.available === true &&
                        (repair.route !== mediaDependency.handoff?.route ||
                          JSON.stringify(
                            parseMediaPublicationDependency({
                              ...mediaDependency,
                              owner: 'media',
                              handoff: repair.handoff,
                            }),
                          ) !== JSON.stringify(mediaDependency))
                      )
                        throw new Error(
                          'Media dependency repair handoff is incompatible',
                        );
                    }
                    return Object.freeze({
                      ...(mediaDependency ? { mediaDependency } : {}),
                      ...(blocker.releaseReceipt !== undefined
                        ? {
                            releaseReceipt: parseReleaseReceipt(blocker.releaseReceipt),
                          }
                        : {}),
                      ...(optionalText(blocker.blockerCode)
                        ? { blockerCode: optionalText(blocker.blockerCode) }
                        : {}),
                      code: text(blocker.code, 'Capability blocker code'),
                      severity: text(blocker.severity, 'Capability blocker severity'),
                      owner: text(blocker.owner, 'Capability blocker owner'),
                      ...(optionalText(blocker.ownerType)
                        ? { ownerType: optionalText(blocker.ownerType) }
                        : {}),
                      ...(optionalText(blocker.source)
                        ? { source: optionalText(blocker.source) }
                        : {}),
                      message: text(blocker.message, 'Capability blocker message'),
                      action: text(blocker.action, 'Capability blocker action'),
                      ...(optionalText(blocker.disabledReason)
                        ? { disabledReason: optionalText(blocker.disabledReason) }
                        : {}),
                      ...(optionalText(blocker.targetServer)
                        ? { targetServer: optionalText(blocker.targetServer) }
                        : {}),
                      ...(optionalText(blocker.targetRuntimeRole)
                        ? {
                            targetRuntimeRole: optionalText(blocker.targetRuntimeRole),
                          }
                        : {}),
                      ...(optionalText(blocker.technicalStatus)
                        ? { technicalStatus: optionalText(blocker.technicalStatus) }
                        : {}),
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
                      ...(parseApprovalDiagnostic(blocker.approvalDiagnostic)
                        ? {
                            approvalDiagnostic: parseApprovalDiagnostic(
                              blocker.approvalDiagnostic,
                            ),
                          }
                        : {}),
                    });
                  })
                : [],
            ),
          }),
        }
      : {}),
    ...(data.repair !== undefined
      ? { repair: parseApprovalRepairEvidence(data.repair) }
      : {}),
  });
}

async function invoke(
  options: ApplicationInitializationClientOptions,
  method: 'GET' | 'POST',
  operation:
    | 'initiate'
    | 'prepare'
    | 'rollback'
    | 'retire'
    | 'reconcile-approval'
    | undefined,
  fetchImplementation: typeof fetch,
  input: ApplicationInitializationOperationInput = {},
): Promise<ApplicationInitializationStatus> {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(options.profileCode)) {
    throw new Error('Application profile is invalid');
  }
  const endpoint = options.connection.endpoint.replace(/\/$/, '');
  const path = `/v0/applications/${encodeURIComponent(
    options.profileCode,
  )}/initialization${operation ? `/${operation}` : ''}`;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    requestTimeoutMs(options, operation),
  );
  try {
    const response = await fetchImplementation(new URL(endpoint + path), {
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
                  ? 'Axis Setup & Accelerators initialization requested'
                  : operation === 'reconcile-approval'
                    ? 'Axis Setup & Accelerators approval reconciliation requested'
                    : `Axis Setup & Accelerators ${operation} requested`),
              forceRefresh: input.forceRefresh === true ? true : undefined,
            }),
          }
        : {}),
    });
    if (!response.ok) {
      if (method === 'GET' && response.status === 429)
        throw new ApplicationReadinessThrottleError(
          await safeError(response),
          response.headers.get('Retry-After'),
        );
      throw new Error(await safeError(response));
    }
    return parse(await response.json());
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      throw new Error(
        operation
          ? 'Application initialization is still running. Refresh status in a moment to continue from the latest backend state.'
          : 'Setup status is taking longer than expected. Refresh status in a moment to continue from the latest backend state.',
      );
    }
    throw error instanceof Error
      ? error
      : new Error('Application initialization request failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function createApplicationInitializationClient(
  options: ApplicationInitializationClientOptions,
  fetchImplementation: typeof fetch = fetch,
) {
  return Object.freeze({
    getStatus: () => invoke(options, 'GET', undefined, fetchImplementation),
    initiate: (input?: ApplicationInitializationOperationInput) =>
      invoke(options, 'POST', 'initiate', fetchImplementation, input),
    prepare: (input?: ApplicationInitializationOperationInput) =>
      invoke(options, 'POST', 'prepare', fetchImplementation, input),
    rollback: (input?: ApplicationInitializationOperationInput) =>
      invoke(options, 'POST', 'rollback', fetchImplementation, input),
    retire: (input?: ApplicationInitializationOperationInput) =>
      invoke(options, 'POST', 'retire', fetchImplementation, input),
    reconcileApproval: (input?: ApplicationInitializationOperationInput) =>
      invoke(options, 'POST', 'reconcile-approval', fetchImplementation, input),
  });
}
