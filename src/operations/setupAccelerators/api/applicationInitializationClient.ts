import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';

export type ApplicationInitializationReadiness =
  | 'NOT_IMPORTED'
  | 'IMPORTING'
  | 'IMPORTED'
  | 'PUBLICATION_PENDING'
  | 'BLOCKED'
  | 'READY'
  | 'REJECTED'
  | 'FAILED'
  | 'ROLLED_BACK'
  | 'RETIRED';

export type ApplicationInitializationAction = 'INITIALIZE' | 'ROLLBACK' | 'RETIRE';

export interface ApplicationInitializationProfile {
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
  }>;
  readonly publication?: Readonly<{
    readonly code: string;
    readonly state: string;
    readonly revision: number;
    readonly targetVersion?: string | undefined;
    readonly workflowRef?: string | undefined;
    readonly correlationId?: string | undefined;
  }>;
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
}

function requestTimeoutMs(
  options: ApplicationInitializationClientOptions,
  operation: 'initiate' | 'rollback' | 'retire' | undefined,
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

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
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
  const preparationSteps =
    preparation && Array.isArray(preparation.steps)
      ? preparation.steps.map((item) => {
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
  });
}

async function invoke(
  options: ApplicationInitializationClientOptions,
  method: 'GET' | 'POST',
  operation: 'initiate' | 'rollback' | 'retire' | undefined,
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
                  : `Axis Setup & Accelerators ${operation} requested`),
            }),
          }
        : {}),
    });
    if (!response.ok) {
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
    rollback: (input?: ApplicationInitializationOperationInput) =>
      invoke(options, 'POST', 'rollback', fetchImplementation, input),
    retire: (input?: ApplicationInitializationOperationInput) =>
      invoke(options, 'POST', 'retire', fetchImplementation, input),
  });
}
