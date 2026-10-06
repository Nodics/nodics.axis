/** @file Strict inactive schedule review/receipt client; Cron owns all target and persistence decisions. */
import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import { cronRequest, type CronJobClientConfiguration } from './cronJobClient';

export const scheduleDraftTextKeys = [
  'title',
  'empty',
  'code',
  'name',
  'target',
  'expression',
  'trigger',
  'node',
  'review',
  'reference',
  'confirm',
  'save',
  'inspect',
  'saved',
  'unknown',
  'reviewFailed',
  'inspectionFailed',
] as const;
export interface ScheduleDraftInput {
  readonly code: string;
  readonly name: string;
  readonly targetCode: string;
  readonly expression: string;
}
export interface ScheduleDraftTarget {
  readonly sourceBinding?: ScheduleSourceBinding;
  readonly code: string;
  readonly label: string;
  readonly triggerCode: string;
  readonly runOnNode: string;
  readonly expressions: readonly string[];
}
export interface ScheduleSourceBinding {
  readonly moduleName: string;
  readonly sourceCode: string;
  readonly policyDigest: string;
}

/** Validates source association metadata without treating it as source or execution authority. */
function sourceBinding(value: unknown): ScheduleSourceBinding | undefined {
  if (value === undefined) return undefined;
  const input = record(value);
  if (
    Object.keys(input).sort().join() !== 'moduleName,policyDigest,sourceCode' ||
    typeof input.sourceCode !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(input.sourceCode)
  )
    throw new Error('Invalid schedule source association');
  return {
    moduleName: code(input.moduleName),
    sourceCode: input.sourceCode,
    policyDigest: digest(input.policyDigest),
  };
}
/** Narrows approved targets to the already-authorized source and its current fingerprint. */
export function selectSourceScheduleTargets(
  targets: readonly ScheduleDraftTarget[],
  source?: ScheduleSourceBinding,
) {
  if (!source) return targets;
  const checked = sourceBinding(source)!;
  return targets.filter(
    (target) =>
      target.sourceBinding?.moduleName === checked.moduleName &&
      target.sourceBinding.sourceCode === checked.sourceCode &&
      target.sourceBinding.policyDigest === checked.policyDigest,
  );
}
export interface ScheduleDraftCapability {
  readonly lifecycle?: ScheduleLifecycleCapability;
  readonly targets: readonly ScheduleDraftTarget[];
  readonly presentation: Readonly<
    Record<(typeof scheduleDraftTextKeys)[number], string>
  >;
}
export interface ScheduleDraftReview extends ScheduleDraftInput {
  readonly targetLabel: string;
  readonly triggerCode: string;
  readonly runOnNode: string;
  readonly reviewDigest: string;
}

/** Rejects unsupported response shapes, including contradictory nested acknowledgements. */
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid Cron response');
  const row = value as Record<string, unknown>;
  if (
    row.error ||
    row.success === false ||
    row.acknowledged === false ||
    (row.errors !== undefined && (!Array.isArray(row.errors) || row.errors.length))
  )
    throw new Error('Invalid Cron acknowledgement');
  return row;
}
/** Validates bounded inert display text. */
function text(value: unknown, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum)
    throw new Error('Invalid Cron text');
  return value;
}
/** Validates owner identifiers without silently normalizing them. */
function code(value: unknown): string {
  const result = text(value, 128);
  if (!/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(result))
    throw new Error('Invalid Cron identity');
  return result;
}
/** Validates the fixed review digest format. */
function digest(value: unknown): string {
  const result = text(value, 64);
  if (!/^[a-f0-9]{64}$/.test(result)) throw new Error('Invalid Cron review');
  return result;
}
/** Parses only the advertised version and fixed owner envelope, without fallback transport. */
function payload(value: unknown, enterpriseCode: string): Record<string, unknown> {
  const envelope = record(value);
  if (envelope.code !== 'SUC_JOB_00000')
    throw new Error('Cron request was not acknowledged');
  const data = record(envelope.data);
  if (data.version !== 1 || data.enterpriseCode !== enterpriseCode)
    throw new Error('Unsupported Cron draft contract or scope');
  return data;
}
/** Parses bounded approved choices and strips any undeclared private fields. */
export function parseScheduleDraftCapability(
  value: unknown,
  enterpriseCode: string,
): ScheduleDraftCapability {
  const data = payload(value, enterpriseCode);
  if (!Array.isArray(data.targets) || data.targets.length > 100)
    throw new Error('Invalid Cron targets');
  const seen = new Set<string>();
  const targets = data.targets.map((value) => {
    const row = record(value);
    const identity = code(row.code);
    if (
      seen.has(identity) ||
      !Array.isArray(row.expressions) ||
      !row.expressions.length ||
      row.expressions.length > 24
    )
      throw new Error('Invalid Cron target');
    seen.add(identity);
    const expressions = row.expressions.map((value) => text(value, 120));
    if (new Set(expressions).size !== expressions.length)
      throw new Error('Invalid Cron timing');
    return {
      code: identity,
      label: text(row.label, 160),
      triggerCode: code(row.triggerCode),
      runOnNode: code(row.runOnNode),
      expressions,
      ...(row.sourceBinding === undefined
        ? {}
        : { sourceBinding: sourceBinding(row.sourceBinding)! }),
    };
  });
  const copy = record(data.presentation);
  const presentation = Object.fromEntries(
    scheduleDraftTextKeys.map((key) => [key, text(copy[key])]),
  ) as ScheduleDraftCapability['presentation'];
  return {
    targets,
    presentation,
    ...(data.lifecycle === undefined
      ? {}
      : { lifecycle: parseLifecycleCapability(data.lifecycle) }),
  };
}

export const scheduleLifecycleTextKeys = [
  'title',
  'code',
  'inspect',
  'activate',
  'deactivate',
  'confirm',
  'execute',
  'reconcile',
  'reference',
  'ACTIVE',
  'INACTIVE',
  'SAVED_INACTIVE',
  'OUTCOME_UNKNOWN',
  'failed',
] as const;
export interface ScheduleLifecycleCapability {
  readonly activationEnabled: boolean;
  readonly presentation: Readonly<
    Record<(typeof scheduleLifecycleTextKeys)[number], string>
  >;
}
export interface ScheduleLifecycleReceipt {
  readonly code: string;
  readonly revision: number;
  readonly intent: 'ACTIVATE' | 'DEACTIVATE' | null;
  readonly reviewDigest: string | null;
  readonly state: 'ACTIVE' | 'INACTIVE' | 'SAVED_INACTIVE' | 'OUTCOME_UNKNOWN';
}
export interface ScheduleLifecycleReview {
  readonly code: string;
  readonly revision: number;
  readonly intent: 'ACTIVATE' | 'DEACTIVATE';
  readonly reviewDigest: string;
}
/** Requires complete owner copy and an explicit activation gate. */
function parseLifecycleCapability(value: unknown): ScheduleLifecycleCapability {
  const row = record(value);
  if (typeof row.activationEnabled !== 'boolean')
    throw new Error('Invalid lifecycle gate');
  const copy = record(row.presentation);
  return {
    activationEnabled: row.activationEnabled,
    presentation: Object.fromEntries(
      scheduleLifecycleTextKeys.map((key) => [key, text(copy[key])]),
    ) as ScheduleLifecycleCapability['presentation'],
  };
}
/** Binds lifecycle review to the inspected original revision and selected intent. */
export function parseScheduleLifecycleReview(
  value: unknown,
  original: Pick<ScheduleLifecycleReview, 'code' | 'revision' | 'intent'>,
  enterpriseCode: string,
): ScheduleLifecycleReview {
  const row = payload(value, enterpriseCode);
  if (
    row.code !== original.code ||
    row.revision !== original.revision ||
    row.intent !== original.intent
  )
    throw new Error('Changed lifecycle review');
  return { ...original, reviewDigest: digest(row.reviewDigest) };
}
/** Never interprets an unrecognized or contradictory runtime acknowledgement as activation. */
export function parseScheduleLifecycleReceipt(
  value: unknown,
  expectedCode: string,
  enterpriseCode: string,
): ScheduleLifecycleReceipt {
  const row = payload(value, enterpriseCode);
  if (
    code(row.code) !== expectedCode ||
    !Number.isSafeInteger(row.revision) ||
    Number(row.revision) < 0 ||
    !['ACTIVE', 'INACTIVE', 'SAVED_INACTIVE', 'OUTCOME_UNKNOWN'].includes(
      String(row.state),
    ) ||
    (row.revision === 0
      ? row.intent !== null ||
        row.reviewDigest !== null ||
        row.state !== 'SAVED_INACTIVE'
      : !['ACTIVATE', 'DEACTIVATE'].includes(String(row.intent)) ||
        row.state === 'SAVED_INACTIVE') ||
    (row.state === 'ACTIVE' && row.intent !== 'ACTIVATE') ||
    (row.state === 'INACTIVE' && row.intent !== 'DEACTIVATE')
  )
    throw new Error('Invalid lifecycle receipt');
  return {
    code: expectedCode,
    revision: Number(row.revision),
    intent: row.intent as ScheduleLifecycleReceipt['intent'],
    reviewDigest: row.reviewDigest === null ? null : digest(row.reviewDigest),
    state: row.state as ScheduleLifecycleReceipt['state'],
  };
}
/** Dispatches one fixed owner operation, without retry or offline queuing. */
export function scheduleLifecycleRequest(
  connection: AxisModuleConnection,
  configuration: CronJobClientConfiguration,
  operation: 'preview' | 'execute' | 'inspect' | 'reconcile',
  body: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  if (typeof navigator !== 'undefined' && !navigator.onLine)
    return Promise.reject(new Error('Unavailable while offline'));
  return cronRequest(connection, `/schedules/lifecycle/${operation}`, configuration, {
    method: 'POST',
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
}
/** Binds returned review fields to the employee's exact input and approved target. */
export function parseScheduleDraftReview(
  value: unknown,
  input: ScheduleDraftInput,
  target: ScheduleDraftTarget,
  enterpriseCode: string,
): ScheduleDraftReview {
  const data = payload(value, enterpriseCode);
  if (
    data.code !== input.code ||
    data.name !== input.name.trim() ||
    data.targetCode !== input.targetCode ||
    target.code !== input.targetCode ||
    data.expression !== input.expression ||
    !target.expressions.includes(input.expression) ||
    data.triggerCode !== target.triggerCode ||
    data.runOnNode !== target.runOnNode ||
    data.targetLabel !== target.label ||
    data.active !== false ||
    data.runOnInit !== false ||
    JSON.stringify(sourceBinding(data.sourceBinding)) !==
      JSON.stringify(target.sourceBinding)
  )
    throw new Error('Cron review does not match the draft');
  return {
    code: code(data.code),
    name: text(data.name, 160),
    targetCode: code(data.targetCode),
    expression: text(data.expression, 120),
    targetLabel: target.label,
    triggerCode: target.triggerCode,
    runOnNode: target.runOnNode,
    reviewDigest: digest(data.reviewDigest),
  };
}
/** Accepts only a scoped original-operation receipt; absence stays uncertain. */
export function parseScheduleDraftReceipt(
  value: unknown,
  original: Pick<ScheduleDraftReview, 'code' | 'reviewDigest'>,
  enterpriseCode: string,
): 'SAVED_INACTIVE' | 'OUTCOME_UNKNOWN' {
  const data = payload(value, enterpriseCode);
  if (
    code(data.code) !== original.code ||
    digest(data.reviewDigest) !== original.reviewDigest ||
    !['SAVED_INACTIVE', 'OUTCOME_UNKNOWN'].includes(String(data.outcome))
  )
    throw new Error('Cron receipt does not match the original save');
  return data.outcome as 'SAVED_INACTIVE' | 'OUTCOME_UNKNOWN';
}
/** Calls fixed Cron draft routes once; offline commands are rejected before dispatch. */
export async function scheduleDraftRequest(
  connection: AxisModuleConnection,
  configuration: CronJobClientConfiguration,
  operation: 'capabilities' | 'preview' | 'create' | 'inspect',
  body?: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  if (
    operation !== 'capabilities' &&
    typeof navigator !== 'undefined' &&
    navigator.onLine === false
  )
    throw new Error('Unavailable while offline');
  const suffix = operation === 'create' ? '' : `/${operation}`;
  return cronRequest(connection, `/schedules/drafts${suffix}`, configuration, {
    method: operation === 'capabilities' ? 'GET' : 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(signal ? { signal } : {}),
  });
}
