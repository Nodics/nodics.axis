/** @module applicationBuilder/client @description Typed Installer transport for planning and scoped Local builds. */
import { observeEmployeeSessionResponse } from '../../../auth/employeeSessionEvents';
import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
export interface BuilderConfiguration {
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly timeoutMs: number;
  readonly sessionGeneration: number;
}
export const presentationKeys = [
  'introduction',
  'preview',
  'reserved',
  'prerequisite',
  'formTitle',
  'workspaceRoot',
  'applicationName',
  'companySiteName',
  'accelerator',
  'environment',
  'plan',
  'refresh',
  'planTitle',
  'vendorRepositories',
  'customerProjects',
  'firstEnvironment',
  'dryRun',
] as const;
export interface BuilderInfo {
  readonly workspaceAccessConfigured: boolean;
  readonly localBuildPresets: readonly string[];
  readonly presentation: Readonly<Record<(typeof presentationKeys)[number], string>>;
  readonly planningOptions: Readonly<{
    supportedAccelerators: readonly string[];
    defaultAccelerator: string;
    defaultEnvironment: string;
    nameMaxLength: number;
  }>;
}
export interface BuilderPlanInput {
  readonly workspaceRoot: string;
  readonly applicationName: string;
  readonly companySiteName: string;
  readonly accelerator: string;
  readonly environment: string;
}
export interface BuilderPlan {
  readonly valid: boolean;
  readonly messages: readonly string[];
  readonly plan: Readonly<{
    vendorRepositories: readonly string[];
    customerProjects: readonly string[];
    firstEnvironment: string;
    dryRunOnly: true;
  }> | null;
}
export interface BuilderOperation {
  readonly code: string;
  readonly label: string;
  readonly mutating: boolean;
  readonly executable: boolean;
  readonly state: string;
}
const incompatible = () =>
  new Error(
    'Builder evidence is incompatible. Refresh availability before continuing.',
  );
function record(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== 'object' || Array.isArray(x)) throw incompatible();
  return x as Record<string, unknown>;
}
function text(x: unknown, max = 512): string {
  if (typeof x !== 'string' || !x.trim() || x.length > max) throw incompatible();
  return x;
}
function strings(x: unknown): readonly string[] {
  if (!Array.isArray(x) || x.length > 100) throw incompatible();
  return x.map((v) => text(v, 128));
}
/** Uses only fixed, owner-defined read endpoints; never executes a returned route or retries a POST. */
export async function builderRequest(
  connection: AxisModuleConnection,
  configuration: BuilderConfiguration,
  operation:
    | 'info'
    | 'operations'
    | 'plan'
    | 'prepareBuild'
    | 'generateBuild'
    | 'readBuild'
    | 'rollbackBuild',
  body?: BuilderPlanInput | Readonly<Record<string, unknown>>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const base = new URL(connection.endpoint);
  if (
    connection.moduleName !== 'installer' ||
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw incompatible();
  const paths = {
    info: '/info',
    operations: '/operations',
    plan: '/setup/plan',
    prepareBuild: '/builds/prepare',
    generateBuild: '/builds/generate',
    readBuild: '/builds/read',
    rollbackBuild: '/builds/rollback',
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), configuration.timeoutMs);
  try {
    const response = await fetch(
      `${base.toString().replace(/\/$/, '')}/v0${paths[operation]}`,
      {
        method: body ? 'POST' : 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${configuration.accessToken}`,
          'x-enterprise-code': configuration.enterpriseCode,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        signal: signal
          ? AbortSignal.any([signal, controller.signal])
          : controller.signal,
      },
    ).catch(() => {
      throw new Error(
        operation.endsWith('Build')
          ? 'The build outcome could not be confirmed. Read the receipt before taking another action.'
          : 'The Builder response could not be confirmed. Nothing was created. Review the inputs and try again.',
      );
    });
    observeEmployeeSessionResponse(
      response,
      configuration.accessToken,
      configuration.sessionGeneration,
    );
    const value: unknown = await response.json();
    const envelope = record(value);
    if (
      !response.ok ||
      envelope.status === 'FAILED' ||
      envelope.status === 'UNAVAILABLE'
    )
      throw new Error(
        typeof envelope.message === 'string'
          ? text(envelope.message)
          : 'Builder availability could not be confirmed. Refresh or contact your administrator.',
      );
    if (
      envelope.contractVersion !== 'installer-api-scope/v0' ||
      !['SUCCESS', 'WARNING'].includes(String(envelope.status)) ||
      !String(envelope.code).startsWith('SUC_')
    )
      throw incompatible();
    return record(envelope.data);
  } finally {
    clearTimeout(timeout);
  }
}
/** Validates non-executable presentation and the actual read-only capability boundary. */
export function parseBuilderInfo(data: Record<string, unknown>): BuilderInfo {
  if (
    data.mutatingOperationsEnabled !== false ||
    data.apiOperationsEnabled !== true ||
    typeof data.workspaceAccessConfigured !== 'boolean'
  )
    throw incompatible();
  const p = record(data.presentation);
  const presentation = Object.fromEntries(
    presentationKeys.map((k) => [k, text(p[k], 1024)]),
  ) as Record<(typeof presentationKeys)[number], string>;
  const o = record(data.planningOptions),
    supportedAccelerators = strings(o.supportedAccelerators),
    defaultAccelerator = text(o.defaultAccelerator, 128),
    defaultEnvironment = text(o.defaultEnvironment, 128);
  if (
    !supportedAccelerators.length ||
    !supportedAccelerators.includes(defaultAccelerator) ||
    !Number.isSafeInteger(o.nameMaxLength) ||
    Number(o.nameMaxLength) < 1 ||
    Number(o.nameMaxLength) > 512
  )
    throw incompatible();
  return {
    workspaceAccessConfigured: data.workspaceAccessConfigured,
    localBuildPresets:
      data.localBuildPresets === undefined ? [] : strings(data.localBuildPresets),
    presentation,
    planningOptions: {
      supportedAccelerators,
      defaultAccelerator,
      defaultEnvironment,
      nameMaxLength: Number(o.nameMaxLength),
    },
  };
}

export interface LocalBuildReceipt {
  readonly runId: string;
  readonly state:
    | 'REVIEWED'
    | 'GENERATING'
    | 'GENERATED'
    | 'ROLLING_BACK'
    | 'ROLLED_BACK';
  readonly applicationName: string;
  readonly reviewDigest: string;
  readonly capabilities: readonly string[];
  readonly plannedFiles: number;
  readonly artifactCount: number;
}

export function parseLocalBuildReceipt(
  data: Record<string, unknown>,
  expectedRun: string,
): LocalBuildReceipt {
  const state = data.state;
  if (
    data.runId !== expectedRun ||
    !/^sha256:[a-f0-9]{64}$/.test(String(data.reviewDigest)) ||
    !['REVIEWED', 'GENERATING', 'GENERATED', 'ROLLING_BACK', 'ROLLED_BACK'].includes(
      String(state),
    ) ||
    !Number.isSafeInteger(data.plannedFiles) ||
    Number(data.plannedFiles) < 1 ||
    !Number.isSafeInteger(data.artifactCount) ||
    Number(data.artifactCount) < 0
  )
    throw incompatible();
  return {
    runId: expectedRun,
    state: state as LocalBuildReceipt['state'],
    applicationName: text(data.applicationName, 128),
    reviewDigest: String(data.reviewDigest),
    capabilities: strings(data.capabilities),
    plannedFiles: Number(data.plannedFiles),
    artifactCount: Number(data.artifactCount),
  };
}
/** A successful HTTP request never becomes a completed build or execution receipt. */
export function parseBuilderPlan(data: Record<string, unknown>): BuilderPlan {
  if (typeof data.valid !== 'boolean' || !Array.isArray(data.messages))
    throw incompatible();
  const messages = data.messages.map((v) => text(record(v).message));
  if (!data.valid) {
    if (data.plan !== null) throw incompatible();
    return { valid: false, messages, plan: null };
  }
  const p = record(data.plan);
  if (p.dryRunOnly !== true) throw incompatible();
  return {
    valid: true,
    messages,
    plan: {
      vendorRepositories: strings(p.vendorRepositories),
      customerProjects: strings(p.customerProjects),
      firstEnvironment: text(p.firstEnvironment, 128),
      dryRunOnly: true,
    },
  };
}
/** Mutation metadata remains inert, regardless of state or a deployment flag. */
export function parseBuilderOperations(
  data: Record<string, unknown>,
): readonly BuilderOperation[] {
  if (!Array.isArray(data.operations) || data.operations.length > 100)
    throw incompatible();
  return data.operations.map((x) => {
    const o = record(x);
    if (
      typeof o.mutating !== 'boolean' ||
      typeof o.executable !== 'boolean' ||
      (o.mutating && o.executable)
    )
      throw incompatible();
    return {
      code: text(o.code, 128),
      label: text(o.label, 128),
      state: text(o.state, 32),
      mutating: o.mutating,
      executable: o.executable,
    };
  });
}
