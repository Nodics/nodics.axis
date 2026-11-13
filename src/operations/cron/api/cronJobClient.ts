/*
 * Nodics Axis - Cron job API client.
 *
 * Copyright (c) 2026 Nodics All rights reserved.
 *
 * This software is governed by the Nodics Source-Available Commercial License.
 * You may use, copy, modify, deploy, or distribute it only as permitted by the
 * root LICENSE file or a separate written agreement with Nodics.
 */

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
  readonly startTime?: string | undefined;
  readonly endTime?: string | undefined;
  readonly lastSkippedAt?: string | undefined;
  readonly failure?: Readonly<{ code: string; target: string }> | undefined;
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

export interface CronJobLifecycleActionPolicy {
  readonly action: CronJobLifecycleAction;
  readonly disabled: boolean;
  readonly label: string;
  readonly reason: string;
  readonly variant: 'contained' | 'outlined';
}

/** Presence reserves lifecycle changes for Cron's reviewed schedule protocol, including malformed markers. It grants no authority. */
export function usesReviewedCronSchedule(job: CronJobDefinition): boolean {
  return Boolean(job.jobDetail && Object.hasOwn(job.jobDetail, 'scheduleDraft'));
}

export type CronJobExecutionEvidence =
  | Readonly<{
      kind: 'completed';
      status: 'SUCCESS' | 'ERROR';
      startedAt: string;
      finishedAt: string;
    }>
  | Readonly<{ kind: 'none' | 'unconfirmed' }>;

/** Only persisted terminal status and consistent owner timestamps confirm a completed run; request acknowledgements never do. */
export function cronJobExecutionEvidence(
  job: CronJobDefinition,
): CronJobExecutionEvidence {
  if (normalizedState(job.state) === 'RUNNING') return { kind: 'unconfirmed' };
  if (!job.startTime && !job.endTime && (!job.status || job.status === 'NEW'))
    return { kind: 'none' };
  const time = (value: string | undefined) =>
    typeof value === 'string' &&
    value.length <= 64 &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
      ? Date.parse(value)
      : NaN;
  const start = time(job.startTime),
    end = time(job.endTime);
  if (
    (job.status === 'SUCCESS' || job.status === 'ERROR') &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    end >= start
  )
    return {
      kind: 'completed',
      status: job.status,
      startedAt: new Date(start).toISOString(),
      finishedAt: new Date(end).toISOString(),
    };
  return { kind: 'unconfirmed' };
}

const cronJobLifecycleLabels: Readonly<Record<CronJobLifecycleAction, string>> =
  Object.freeze({
    create: 'Create in scheduler',
    run: 'Run now',
    start: 'Start',
    stop: 'Stop',
    pause: 'Pause',
    resume: 'Resume',
  });

function normalizedState(value: string | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

/**
 * @description Builds Axis presentation policy for Cron lifecycle buttons without
 * taking scheduler ownership away from the Cron backend. The backend remains the
 * final authority and may reject a request even when the browser considers the
 * action likely valid.
 */
export function cronJobLifecycleActionPolicies(
  job: CronJobDefinition,
): readonly CronJobLifecycleActionPolicy[] {
  const state = normalizedState(job.state ?? job.status);
  const running = ['RUNNING', 'STARTED', 'ACTIVE'].includes(state);
  const paused = ['PAUSED', 'SUSPENDED'].includes(state);
  const inactive = job.active === false;
  const started = Date.parse(job.startTime ?? ''),
    finished = Date.parse(job.endTime ?? '');
  const executionPending =
    state === 'RUNNING' ||
    normalizedState(job.status) === 'RUNNING' ||
    (Number.isFinite(started) && (!Number.isFinite(finished) || finished < started));
  const schedulerMissing = ['NEW', 'CREATED', 'SAVED', ''].includes(state);
  const policy = (
    action: CronJobLifecycleAction,
    disabled: boolean,
    reason: string,
    variant: CronJobLifecycleActionPolicy['variant'] = 'outlined',
  ): CronJobLifecycleActionPolicy =>
    Object.freeze({
      action,
      disabled,
      label: cronJobLifecycleLabels[action],
      reason,
      variant,
    });

  return Object.freeze([
    policy(
      'create',
      false,
      schedulerMissing
        ? 'Create or refresh this persisted definition in the in-memory scheduler.'
        : 'Recreate or refresh this job in the scheduler when configuration changed.',
    ),
    policy(
      'run',
      inactive || executionPending,
      inactive
        ? 'Inactive Cron jobs must be enabled before they can run.'
        : executionPending
          ? 'The current run must finish before another run is requested.'
          : 'Run this job once through the Cron scheduler authority.',
      'contained',
    ),
    policy(
      'start',
      inactive || running,
      inactive
        ? 'Inactive Cron jobs must be enabled before they can start.'
        : running
          ? 'This job already appears to be running.'
          : 'Start scheduler execution for this job.',
    ),
    policy(
      'stop',
      !running,
      running
        ? 'Stop scheduler execution for this job.'
        : 'Stop is available after the scheduler reports a running job.',
    ),
    policy(
      'pause',
      !running,
      running
        ? 'Pause scheduler execution without deleting the job definition.'
        : 'Pause is available after the scheduler reports a running job.',
    ),
    policy(
      'resume',
      !paused,
      paused
        ? 'Resume scheduler execution for a paused job.'
        : 'Resume is available only for paused jobs.',
    ),
  ]);
}

function endpoint(connection: AxisModuleConnection, path: string): string {
  const base = new URL(connection.endpoint);
  if (
    connection.moduleName !== 'cronjob' ||
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  ) {
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

/** A transport acknowledgement is not execution evidence. Reject negative owner envelopes even on HTTP 200. */
function positiveEnvelope(value: unknown): Record<string, unknown> {
  const envelope = record(value, 'Cron response');
  const ownerCode = envelope.code;
  const httpCode = envelope.responseCode;
  // Nodics returns a domain success code plus a separate HTTP responseCode (normally "200").
  const compatibleResponseCode =
    httpCode === undefined ||
    ((typeof httpCode === 'string' || typeof httpCode === 'number') &&
      /^2[0-9]{2}$/.test(String(httpCode))) ||
    httpCode === ownerCode;
  if (
    typeof ownerCode !== 'string' ||
    !/^SUC_[A-Za-z0-9_]+$/.test(ownerCode) ||
    !compatibleResponseCode ||
    ['success', 'acknowledged'].some(
      (key) => envelope[key] !== undefined && envelope[key] !== true,
    ) ||
    (envelope.error !== undefined &&
      envelope.error !== null &&
      envelope.error !== false) ||
    (envelope.errors !== undefined &&
      (!Array.isArray(envelope.errors) || envelope.errors.length > 0))
  )
    throw new Error(
      'Cron owner acknowledgement is unverified. Inspect current owner evidence before another operation.',
    );
  for (const payload of [envelope.result, envelope.data]) {
    if (payload === false)
      throw new Error(
        'Cron owner result is unverified. Inspect its current evidence before another operation.',
      );
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const nested = payload as Record<string, unknown>;
      if (
        ['success', 'acknowledged'].some(
          (key) => nested[key] !== undefined && nested[key] !== true,
        ) ||
        (nested.error !== undefined &&
          nested.error !== null &&
          nested.error !== false) ||
        (nested.errors !== undefined &&
          (!Array.isArray(nested.errors) || nested.errors.length > 0))
      )
        throw new Error(
          'Cron owner result is unverified. Inspect its current evidence before another operation.',
        );
    }
  }
  return envelope;
}
function envelopeData(value: unknown): unknown {
  const envelope = positiveEnvelope(value);
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
  throw new Error(
    'Cron job list is incompatible. No empty inventory has been confirmed.',
  );
}

function parseCronJob(value: unknown): CronJobDefinition {
  const data = record(value, 'Cron job');
  const code = optionalText(data.code);
  if (
    !code ||
    !/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(code) ||
    typeof data.active !== 'boolean'
  )
    throw new Error('Cron job identity or active state is unverified');
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
  const entry =
    Array.isArray(data.log) && data.log.length === 1
      ? (data.log[0] as Record<string, unknown>)
      : undefined;
  const failure =
    entry &&
    typeof entry.code === 'string' &&
    /^ERR_[A-Z0-9_]{1,64}$/.test(entry.code) &&
    typeof entry.target === 'string' &&
    ['processTrigger', 'startNode', 'internal', 'external', 'unknown'].includes(
      entry.target,
    )
      ? Object.freeze({ code: entry.code, target: entry.target })
      : undefined;
  const startTime = optionalText(data.startTime),
    endTime = optionalText(data.endTime);
  return Object.freeze({
    code,
    name: optionalText(data.name),
    description: optionalText(data.description),
    active: data.active,
    runOnNode: optionalText(data.runOnNode),
    runOnInit: bool(data.runOnInit, false),
    trigger: trigger ? Object.freeze({ ...trigger }) : undefined,
    start: optionalText(data.start),
    state: optionalText(data.state),
    status: optionalText(data.status),
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
    lastSkippedAt: optionalText(data.lastSkippedAt),
    failure,
    jobDetail: jobDetail ? Object.freeze({ ...jobDetail }) : undefined,
  });
}

/** Sends a single Cron-owner request without retries or redirect credential forwarding. */
export async function cronRequest(
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
      signal: options.signal
        ? AbortSignal.any([controller.signal, options.signal])
        : controller.signal,
    });
    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      throw new Error(
        'Cron returned an incompatible response. Inspect the owner before retrying an operation.',
      );
    }
    if (!response.ok) {
      const errorBody =
        typeof body === 'object' && body !== null && !Array.isArray(body)
          ? (body as Record<string, unknown>)
          : {};
      throw new Error(
        response.status === 401 || response.status === 403
          ? 'You do not have access to this Cron operation.'
          : `Cron request returned HTTP ${String(response.status)}${typeof errorBody.code === 'string' && /^ERR_[A-Za-z0-9_]+$/.test(errorBody.code) ? `. Support code: ${errorBody.code}` : ''}`,
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
  const rows = listPayload(await cronRequest(connection, '/cronjob', configuration));
  if (rows.length > 500)
    throw new Error('Cron job list exceeds the supported inspection limit');
  const jobs = rows.map(parseCronJob);
  if (new Set(jobs.map((job) => job.code)).size !== jobs.length)
    throw new Error('Cron job identities are ambiguous');
  return Object.freeze(jobs);
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
  if (Array.isArray(data) && data.length !== 1)
    throw new Error(
      'Cron save did not confirm exactly one persisted job. Inspect the original code before another save.',
    );
  const saved = parseCronJob(Array.isArray(data) ? data[0] : data);
  if (saved.code !== input.code || saved.active !== input.active)
    throw new Error(
      'Cron save identity or active state does not match. Inspect the original code before another save.',
    );
  return saved;
}

export async function applyCronJobAction(
  connection: AxisModuleConnection,
  configuration: CronJobClientConfiguration,
  jobCode: string,
  action: CronJobLifecycleAction,
): Promise<void> {
  positiveEnvelope(
    await cronRequest(
      connection,
      `/job/${action}/${safeSegment(jobCode, 'Cron job code')}`,
      configuration,
      { method: 'POST' },
    ),
  );
}
