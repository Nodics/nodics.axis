import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';

export type ApplicationInitializationReadiness =
  | 'NOT_IMPORTED'
  | 'IMPORTED'
  | 'PUBLICATION_PENDING'
  | 'READY'
  | 'REJECTED'
  | 'FAILED'
  | 'ROLLED_BACK'
  | 'RETIRED';

export type ApplicationInitializationAction = 'INITIALIZE' | 'ROLLBACK' | 'RETIRE';

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
  readonly allowedActions: readonly ApplicationInitializationAction[];
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
      'IMPORTED',
      'PUBLICATION_PENDING',
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
    allowedActions.some(
      (item) => !['INITIALIZE', 'ROLLBACK', 'RETIRE'].includes(item),
    )
  ) {
    throw new Error('Application initialization action is unsupported');
  }
  const publication =
    data.publication === undefined
      ? undefined
      : record(data.publication, 'Application publication');
  return Object.freeze({
    profileCode: text(data.profileCode, 'Application profile'),
    type: text(data.type, 'Application profile type'),
    owner: text(data.owner, 'Application owner'),
    applicationCode: text(data.applicationCode, 'Application code'),
    siteCode: text(data.siteCode, 'Application site'),
    readiness: readiness as ApplicationInitializationReadiness,
    releaseCode: text(data.releaseCode, 'Application release'),
    releaseVersion: text(data.releaseVersion, 'Application release version'),
    allowedActions: Object.freeze(
      allowedActions as ApplicationInitializationAction[],
    ),
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
): Promise<ApplicationInitializationStatus> {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(options.profileCode)) {
    throw new Error('Application profile is invalid');
  }
  const endpoint = options.connection.endpoint.replace(/\/$/, '');
  const path = `/v0/applications/${encodeURIComponent(
    options.profileCode,
  )}/initialization${operation ? `/${operation}` : ''}`;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), options.timeoutMs);
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
      ...(operation === 'initiate'
        ? {
            body: JSON.stringify({
              reason: 'Axis Setup & Accelerators initialization requested',
            }),
          }
        : {}),
    });
    if (!response.ok) {
      throw new Error(
        response.status === 403
          ? 'You are not authorized to initialize this accelerator.'
          : `Application initialization returned HTTP ${String(response.status)}`,
      );
    }
    return parse(await response.json());
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      throw new Error('Application initialization request timed out');
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
    initiate: () => invoke(options, 'POST', 'initiate', fetchImplementation),
    rollback: () => invoke(options, 'POST', 'rollback', fetchImplementation),
    retire: () => invoke(options, 'POST', 'retire', fetchImplementation),
  });
}
