export type FunctionalModuleRegistrationState =
  | 'AVAILABLE'
  | 'REGISTERED'
  | 'DEREGISTERED';

export type FunctionalModuleRuntimeState =
  | 'ACTIVE'
  | 'OFFLINE'
  | 'DEGRADED'
  | 'INCOMPATIBLE';

export interface FunctionalModuleRegistration {
  readonly project: string;
  readonly functionalModule: string;
  readonly displayName: string;
  readonly registeredVersion?: string | undefined;
  readonly registrationState: FunctionalModuleRegistrationState;
  readonly enabled: boolean;
  readonly required: boolean;
  readonly runtimeState: FunctionalModuleRuntimeState;
  readonly technicalModules: readonly string[];
  readonly observedServers: readonly string[];
  readonly catalogueRevision: number;
  readonly registeredAt?: string | undefined;
  readonly lastObservedAt?: string | undefined;
  readonly activationData?: FunctionalModuleActivationData | undefined;
}

export interface FunctionalModuleActivationPackage {
  readonly code: string;
  readonly classification: string;
  readonly owner: string;
  readonly required: boolean;
  readonly trigger: string;
  readonly targetModule: string;
  readonly targetServer: string;
  readonly targetDatabase: string;
  readonly operation: string;
  readonly dataType: string;
}

export interface FunctionalModuleActivationReceipt
  extends FunctionalModuleActivationPackage {
  readonly receiptKey: string;
  readonly status: string;
  readonly idempotent: boolean;
  readonly message: string;
  readonly executionMode?: string | undefined;
  readonly releaseStatus?: string | undefined;
  readonly importRunId?: string | undefined;
  readonly lastAttemptAt?: string | undefined;
  readonly revision?: number | undefined;
}

export interface FunctionalModuleActivationData {
  readonly action: string;
  readonly dryRun: boolean;
  readonly executionMode: string;
  readonly readiness: string;
  readonly preflight: Readonly<{
    readonly runtimeActive: boolean;
    readonly registered: boolean;
    readonly protectedModule: boolean;
    readonly dependencies: readonly string[];
    readonly blockedReasons: readonly string[];
  }>;
  readonly packages: readonly FunctionalModuleActivationPackage[];
  readonly receipts: readonly FunctionalModuleActivationReceipt[];
  readonly nextActions: readonly string[];
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

function optionalText(value: unknown, name: string): string | undefined {
  return value === undefined || value === null ? undefined : text(value, name);
}

function boolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean`);
  return value;
}

function positiveInteger(value: unknown, name: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return Number(value);
}

function stringList(value: unknown, name: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${name} must be a string list`);
  }
  return Object.freeze([...new Set(value as string[])]);
}

function optionalString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseActivationPackage(
  value: unknown,
  name: string,
): FunctionalModuleActivationPackage {
  const item = record(value, name);
  return Object.freeze({
    code: text(item.code, `${name} code`),
    classification: optionalString(item.classification),
    owner: optionalString(item.owner),
    required:
      typeof item.required === 'boolean'
        ? item.required
        : boolean(item.required, `${name} required flag`),
    trigger: optionalString(item.trigger),
    targetModule: optionalString(item.targetModule),
    targetServer: optionalString(item.targetServer),
    targetDatabase: optionalString(item.targetDatabase),
    operation: optionalString(item.operation),
    dataType: optionalString(item.dataType),
  });
}

function parseActivationReceipt(
  value: unknown,
  name: string,
): FunctionalModuleActivationReceipt {
  const item = record(value, name);
  return Object.freeze({
    ...parseActivationPackage(value, name),
    receiptKey: text(item.receiptKey, `${name} receipt key`),
    status: text(item.status, `${name} status`),
    idempotent:
      typeof item.idempotent === 'boolean'
        ? item.idempotent
        : boolean(item.idempotent, `${name} idempotent flag`),
    message: optionalString(item.message),
    executionMode: item.executionMode === undefined ? undefined : optionalString(item.executionMode),
    releaseStatus: item.releaseStatus === undefined ? undefined : optionalString(item.releaseStatus),
    importRunId: item.importRunId === undefined ? undefined : optionalString(item.importRunId),
    lastAttemptAt: item.lastAttemptAt === undefined ? undefined : optionalString(item.lastAttemptAt),
    revision: item.revision === undefined ? undefined : Number(item.revision),
  });
}

function parseActivationData(value: unknown): FunctionalModuleActivationData {
  const item = record(value, 'Functional-module activation data');
  const preflight = record(item.preflight, 'Functional-module activation preflight');
  return Object.freeze({
    action: text(item.action, 'Activation action'),
    dryRun: boolean(item.dryRun, 'Activation dry-run flag'),
    executionMode: text(item.executionMode, 'Activation execution mode'),
    readiness: text(item.readiness, 'Activation readiness'),
    preflight: Object.freeze({
      runtimeActive: boolean(preflight.runtimeActive, 'Activation runtime active'),
      registered: boolean(preflight.registered, 'Activation registered flag'),
      protectedModule: boolean(
        preflight.protectedModule,
        'Activation protected-module flag',
      ),
      dependencies: stringList(preflight.dependencies, 'Activation dependencies'),
      blockedReasons: stringList(
        preflight.blockedReasons,
        'Activation blocked reasons',
      ),
    }),
    packages: Object.freeze(
      Array.isArray(item.packages)
        ? item.packages.map((pack, index) =>
            parseActivationPackage(pack, `Activation package ${String(index)}`),
          )
        : [],
    ),
    receipts: Object.freeze(
      Array.isArray(item.receipts)
        ? item.receipts.map((receipt, index) =>
            parseActivationReceipt(receipt, `Activation receipt ${String(index)}`),
          )
        : [],
    ),
    nextActions: stringList(item.nextActions, 'Activation next actions'),
  });
}

function registrationState(value: unknown): FunctionalModuleRegistrationState {
  if (!['AVAILABLE', 'REGISTERED', 'DEREGISTERED'].includes(String(value))) {
    throw new Error('Functional-module registration state is unsupported');
  }
  return value as FunctionalModuleRegistrationState;
}

function runtimeState(value: unknown): FunctionalModuleRuntimeState {
  if (!['ACTIVE', 'OFFLINE', 'DEGRADED', 'INCOMPATIBLE'].includes(String(value))) {
    throw new Error('Functional-module runtime state is unsupported');
  }
  return value as FunctionalModuleRuntimeState;
}

export function parseFunctionalModuleRegistration(
  value: unknown,
  name = 'Functional-module registration',
): FunctionalModuleRegistration {
  const item = record(value, name);
  const functionalModule = text(item.functionalModule, `${name} module identity`);
  return Object.freeze({
    project: text(item.project, `${functionalModule} project`),
    functionalModule,
    displayName: text(item.displayName, `${functionalModule} display name`),
    registeredVersion: optionalText(
      item.registeredVersion,
      `${functionalModule} version`,
    ),
    registrationState: registrationState(item.registrationState),
    enabled: boolean(item.enabled, `${functionalModule} enabled flag`),
    required: boolean(item.required, `${functionalModule} required flag`),
    runtimeState: runtimeState(item.runtimeState),
    technicalModules: stringList(
      item.technicalModules,
      `${functionalModule} technical modules`,
    ),
    observedServers: stringList(
      item.observedServers,
      `${functionalModule} observed servers`,
    ),
    catalogueRevision: positiveInteger(
      item.catalogueRevision,
      `${functionalModule} catalogue revision`,
    ),
    registeredAt: optionalText(item.registeredAt, `${functionalModule} registered at`),
    lastObservedAt: optionalText(
      item.lastObservedAt,
      `${functionalModule} last observed at`,
    ),
    activationData:
      item.activationData === undefined
        ? undefined
        : parseActivationData(item.activationData),
  });
}

export function parseFunctionalModuleCatalogue(
  value: unknown,
): readonly FunctionalModuleRegistration[] {
  const data = record(value, 'Functional-module catalogue');
  if (!Array.isArray(data.items)) {
    throw new Error('Functional-module catalogue items must be a list');
  }
  return Object.freeze(
    data.items.map((item, index) =>
      parseFunctionalModuleRegistration(
        item,
        `Functional-module item ${String(index)}`,
      ),
    ),
  );
}
