import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';

export interface CronJobClientConfiguration {
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly timeoutMs: number;
}

export interface CronJobDefinition {
  readonly code: string;
  readonly name: string | undefined;
  readonly description: string | undefined;
  readonly active: boolean;
  readonly runOnNode: string | undefined;
  readonly runOnInit: boolean;
  readonly trigger: Record<string, unknown> | undefined;
  readonly start: string | undefined;
  readonly state: string | undefined;
  readonly status: string | undefined;
  readonly jobDetail: Record<string, unknown> | undefined;
}

export interface CronJobUpsertInput {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly active: boolean;
  readonly runOnNode: string;
  readonly runOnInit: boolean;
  readonly triggerExpression: string;
  readonly processTriggerCode?: string | undefined;
  readonly processInstanceCode?: string | undefined;
}

export type CronJobLifecycleAction =
  | 'create'
  | 'run'
  | 'start'
  | 'stop'
  | 'pause'
  | 'resume';

function endpoint(connection: AxisModuleConnection, path: string): string {
  const base = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(base.protocol)) {
    throw new Error('Cron module endpoint is invalid');
  }
  return new URL(`${base.toString().replace(/\/$/, '')}/v0${path}`).toString();
}

function safeSegment(value: string, label: string): string {
  if (!/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  return encodeURIComponent(value);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function envelopeData(value: unknown): unknown {
  const envelope = record(value, 'Cron response');
  if ('result' in envelope) return envelope.result;
  if ('data' in envelope) return envelope.data;
  return envelope;
}

function listPayload(value: unknown): readonly unknown[] {
  const data = envelopeData(value);
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const nested = data as Record<string, unknown>;
    if (Array.isArray(nested.result)) return nested.result;
    if (Array.isArray(nested.data)) return nested.data;
  }
  return Object.freeze([]);
}

function parseCronJob(value: unknown): CronJobDefinition {
  const data = record(value, 'Cron job');
  const trigger =
    typeof data.trigger === 'object' &&
    data.trigger !== null &&
    !Array.isArray(data.trigger)
      ? (data.trigger as Record<string, unknown>)
      : undefined;
  const jobDetail =
    typeof data.jobDetail === 'object' &&
    data.jobDetail !== null &&
    !Array.isArray(data.jobDetail)
      ? (data.jobDetail as Record<string, unknown>)
      : undefined;
  return Object.freeze({
    code: optionalText(data.code) ?? 'cronJob',
    name: optionalText(data.name),
    description: optionalText(data.description),
    active: bool(data.active, true),
    runOnNode: optionalText(data.runOnNode),
    runOnInit: bool(data.runOnInit, false),
    trigger: trigger ? Object.freeze({ ...trigger }) : undefined,
    start: optionalText(data.start),
    state: optionalText(data.state),
    status: optionalText(data.status),
    jobDetail: jobDetail ? Object.freeze({ ...jobDetail }) : undefined,
  });
}

async function cronRequest(
  connection: AxisModuleConnection,
  path: string,
  configuration: CronJobClientConfiguration,
  options: RequestInit = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const response = await fetch(endpoint(connection, path), {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${configuration.accessToken}`,
        'x-enterprise-code': configuration.enterpriseCode,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      throw new Error(`Cron returned non-JSON response: ${text.slice(0, 160)}`);
    }
    if (!response.ok) {
      const errorBody =
        typeof body === 'object' && body !== null && !Array.isArray(body)
          ? (body as Record<string, unknown>)
          : {};
      throw new Error(
        typeof errorBody.message === 'string'
          ? errorBody.message
          : `Cron request returned HTTP ${String(response.status)}`,
      );
    }
    return body;
  } catch (error: unknown) {
    if (controller.signal.aborted) throw new Error('Cron request timed out');
    throw error instanceof Error ? error : new Error('Cron request failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function loadCronJobs(
  connection: AxisModuleConnection,
  configuration: CronJobClientConfiguration,
): Promise<readonly CronJobDefinition[]> {
  return Object.freeze(
    listPayload(await cronRequest(connection, '/cronjob', configuration)).map(
      parseCronJob,
    ),
  );
}

export async function saveCronJob(
  connection: AxisModuleConnection,
  configuration: CronJobClientConfiguration,
  input: CronJobUpsertInput,
): Promise<CronJobDefinition> {
  const model: Record<string, unknown> = {
    code: input.code,
    active: input.active,
    name: input.name,
    description: input.description,
    runOnNode: input.runOnNode,
    runOnInit: input.runOnInit,
    trigger: { expression: input.triggerExpression },
    start: new Date(Date.now() - 1000).toISOString(),
    priority: 0,
    jobDetail: input.processTriggerCode
      ? {
          processTrigger: {
            triggerCode: input.processTriggerCode,
            ...(input.processInstanceCode
              ? { instanceCode: input.processInstanceCode }
              : {}),
            context: { source: 'axis-cron-console' },
          },
        }
      : {},
  };
  const body = await cronRequest(connection, '/cronjob', configuration, {
    method: 'PUT',
    body: JSON.stringify(model),
  });
  const data = envelopeData(body);
  return parseCronJob(Array.isArray(data) ? data[0] : data);
}

export async function applyCronJobAction(
  connection: AxisModuleConnection,
  configuration: CronJobClientConfiguration,
  jobCode: string,
  action: CronJobLifecycleAction,
): Promise<void> {
  await cronRequest(
    connection,
    `/job/${action}/${safeSegment(jobCode, 'Cron job code')}`,
    configuration,
    { method: 'POST' },
  );
}
