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
