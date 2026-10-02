/** App-lifetime enterprise creation checkpoint. No storage, secrets or backend authority. */
import { BackendWorkspaceHttpError } from '../../app/backendWorkspaceClient';
import type {
  AxisBackendWorkspace,
  AxisBackendWorkspaceSection,
  AxisModuleConnection,
} from '../../bootstrap/publicBootstrap';

type Values = Readonly<Record<string, string | boolean | readonly string[]>>;
export interface EnterpriseCreationCheckpointValue {
  readonly values: Values;
  readonly phase: 'DRAFT' | 'SUBMITTING' | 'UNCERTAIN' | 'ACKNOWLEDGED';
}
export interface EnterpriseCreationCheckpointBinding {
  readonly compatible: boolean;
  readonly get: () => EnterpriseCreationCheckpointValue | undefined;
  readonly subscribe: (listener: () => void) => () => void;
  readonly save: (values: Values) => void;
  readonly begin: (values: Values) => object | undefined;
  readonly settle: (ticket: object, acknowledged: boolean) => void;
  readonly refuse: (ticket: object) => void;
  readonly clear: () => void;
}
export interface EnterpriseCreationCheckpointContext {
  readonly checkpoint: EnterpriseCreationCheckpoint;
  readonly scope: string;
}

const safeFields = {
  code: 'TEXT',
  name: 'TEXT',
  adminEmail: 'EMAIL',
  superEnterprise: 'TEXT',
  roleCodes: 'MULTISELECT',
  active: 'CHECKBOX',
  idempotencyKey: 'IDEMPOTENCY',
} as const;

/** One bounded checkpoint per App admission lineage, never a global cross-user draft registry. */
export class EnterpriseCreationCheckpoint {
  private epoch = 0;
  private key: string | undefined;
  private ownerKey: string | undefined;
  private value: EnterpriseCreationCheckpointValue | undefined;
  private ticket: object | undefined;
  private readonly listeners = new Set<() => void>();

  /** Clears on fresh login/logout/expiry/context change; a verified same-context unlock alone retains the lineage. */
  clear(): void {
    this.epoch++;
    this.key = undefined;
    this.ownerKey = undefined;
    this.value = undefined;
    this.ticket = undefined;
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  /** Binds only the declared Profile enterprise create form, including its exact owner and field contract. */
  bind(
    scope: string,
    connection: AxisModuleConnection | undefined,
    workspace: AxisBackendWorkspace,
    section: AxisBackendWorkspaceSection,
  ): EnterpriseCreationCheckpointBinding | undefined {
    const fields = section.fields ?? [];
    if (
      !scope ||
      !connection ||
      connection.moduleName !== 'profile' ||
      !['UP', 'DEGRADED'].includes(connection.state) ||
      section.id !== 'create-enterprise' ||
      section.type !== 'form'
    )
      return undefined;
    const ownerKey = JSON.stringify([
      scope,
      connection.moduleName,
      connection.instanceId,
      connection.endpoint,
      connection.environment,
      connection.server,
      connection.runtimeRole,
    ]);
    const compatible =
      workspace.setupContinuation?.type === 'enterpriseSetupContinuation' &&
      !section.public &&
      !section.readSource &&
      section.endpoint.method === 'POST' &&
      section.endpoint.bodyShape === 'MODEL' &&
      section.endpoint.idempotencyField === 'idempotencyKey' &&
      fields.length <= 7 &&
      new Set(fields.map((field) => field.name)).size === fields.length &&
      ['code', 'name', 'adminEmail', 'idempotencyKey'].every((name) =>
        fields.some((field) => field.name === name),
      ) &&
      fields.every(
        (field) =>
          Object.hasOwn(safeFields, field.name) &&
          safeFields[field.name as keyof typeof safeFields] === field.type,
      );
    const unresolved = () =>
      this.ownerKey === ownerKey &&
      this.value !== undefined &&
      this.value.phase !== 'DRAFT';
    if (!compatible && !unresolved()) return undefined;
    const key = JSON.stringify([
      ownerKey,
      workspace.renderer,
      workspace.contractVersion,
      workspace.ownerSelector,
      section.id,
      section.endpoint,
      fields,
    ]);
    const epoch = this.epoch;
    const current = () => epoch === this.epoch && this.key === key;
    const retained = () => epoch === this.epoch && (current() || unresolved());
    const project = (values: Values): Values =>
      Object.freeze(
        Object.fromEntries<string | boolean | readonly string[]>(
          fields.map<[string, string | boolean | readonly string[]]>((field) => {
            const value = values[field.name];
            if (field.type === 'CHECKBOX' && typeof value === 'boolean')
              return [field.name, value];
            const choices: readonly unknown[] = Array.isArray(value) ? value : [];
            if (
              field.type === 'MULTISELECT' &&
              Array.isArray(value) &&
              choices.length <= 25 &&
              choices.every(
                (item) =>
                  typeof item === 'string' &&
                  field.options?.some((option) => option.value === item),
              )
            )
              return [
                field.name,
                Object.freeze(
                  choices.map((item) => {
                    if (typeof item !== 'string')
                      throw new Error('Enterprise creation checkpoint is invalid.');
                    return item;
                  }),
                ),
              ];
            if (
              typeof value === 'string' &&
              value.length <= (field.maximumLength ?? 320)
            )
              return [field.name, value];
            throw new Error('Enterprise creation checkpoint is invalid.');
          }),
        ),
      );
    return {
      compatible,
      get: () => (retained() ? this.value : undefined),
      subscribe: (listener) => {
        this.listeners.add(listener);
        return () => {
          this.listeners.delete(listener);
        };
      },
      save: (values) => {
        if (!compatible || epoch !== this.epoch || unresolved()) return;
        const safe = project(values);
        this.key = key;
        this.ownerKey = ownerKey;
        this.value = Object.freeze({ values: safe, phase: 'DRAFT' });
        this.notify();
      },
      begin: (values) => {
        if (!compatible || epoch !== this.epoch || unresolved()) return undefined;
        const safe = project(values);
        this.key = key;
        this.ownerKey = ownerKey;
        this.ticket = Object.freeze({});
        this.value = Object.freeze({ values: safe, phase: 'SUBMITTING' });
        this.notify();
        return this.ticket;
      },
      settle: (ticket, acknowledged) => {
        if (!current() || ticket !== this.ticket || !this.value) return;
        this.value = Object.freeze({
          values: this.value.values,
          phase: acknowledged ? 'ACKNOWLEDGED' : 'UNCERTAIN',
        });
        this.notify();
      },
      clear: () => {
        if (!retained()) return;
        this.value = undefined;
        this.ticket = undefined;
        this.notify();
      },
      refuse: (ticket) => {
        if (!current() || ticket !== this.ticket || this.value?.phase !== 'SUBMITTING')
          return;
        this.ticket = undefined;
        this.value = Object.freeze({ values: this.value.values, phase: 'DRAFT' });
        this.notify();
      },
    };
  }
}

/** Only the registered pre-write duplicate conflict permits editing; other validation/provisioning/transport failures stay uncertain. */
export function isDefiniteEnterpriseDuplicate(error: unknown): boolean {
  return (
    error instanceof BackendWorkspaceHttpError &&
    error.status === 409 &&
    error.code === 'ERR_PROFILE_ENTERPRISE_DUPLICATE'
  );
}

/** Profile model create returns a scalar tenant reference; the public projection uses tenantCode. Neither admits counts or conflicting identities. */
export function isEnterpriseCreationAcknowledgement(
  response: unknown,
  values: Values,
): boolean {
  if (!response || typeof response !== 'object' || Array.isArray(response))
    return false;
  const record = response as Record<string, unknown>;
  const tenant = record.tenant !== undefined ? record.tenant : record.tenantCode;
  return (
    typeof values.code === 'string' &&
    typeof values.name === 'string' &&
    record.code === values.code.trim() &&
    record.name === values.name.trim() &&
    typeof tenant === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(tenant) &&
    tenant === record.code &&
    (record.tenantCode === undefined || record.tenantCode === tenant) &&
    typeof record.active === 'boolean' &&
    record.success !== false &&
    !record.error &&
    (record.errors === undefined ||
      (Array.isArray(record.errors) && record.errors.length === 0))
  );
}

/** Only the existing owner-declared tab selector survives lock; arbitrary query values and fragments never do. */
export function enterpriseCreationReturnPath(
  pathname: string,
  search: string,
  workspace: AxisBackendWorkspace | undefined,
): string {
  const tabs = new URLSearchParams(search).getAll('tab');
  const tab = tabs.length === 1 ? tabs[0] : undefined;
  return workspace?.setupContinuation?.type === 'enterpriseSetupContinuation' &&
    tab &&
    /^[A-Za-z0-9_.:-]{1,128}$/.test(tab) &&
    workspace.tabs.some((item) => item.id === tab)
    ? `${pathname}?${new URLSearchParams({ tab })}`
    : pathname;
}
