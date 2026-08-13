import type { AxisModuleConnection } from '../../bootstrap/publicBootstrap';

export type DocumentationPublicationReadiness =
  | 'NOT_IMPORTED'
  | 'IMPORTED'
  | 'PUBLICATION_PENDING'
  | 'READY'
  | 'REJECTED'
  | 'FAILED';

export interface DocumentationPublicationStatus {
  readonly profileCode: string;
  readonly siteCode: string;
  readonly readiness: DocumentationPublicationReadiness;
  readonly releaseCode: string;
  readonly releaseVersion: string;
  readonly allowedActions: readonly 'INITIALIZE'[];
  readonly publication?: Readonly<{
    code: string;
    state: string;
    revision: number;
    correlationId?: string;
  }>;
}

interface Options {
  readonly connection: AxisModuleConnection;
  readonly enterpriseCode: string;
  readonly accessToken: string;
  readonly timeoutMs: number;
  readonly profileCode: string;
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${name} must be a non-empty string`);
  return value;
}

function parse(value: unknown): DocumentationPublicationStatus {
  const envelope = record(value, 'Documentation publication response');
  const data = record(
    envelope.data ?? envelope.result,
    'Documentation publication status',
  );
  const readiness = text(data.readiness, 'Documentation readiness');
  if (
    ![
      'NOT_IMPORTED',
      'IMPORTED',
      'PUBLICATION_PENDING',
      'READY',
      'REJECTED',
      'FAILED',
    ].includes(readiness) ||
    !Array.isArray(data.allowedActions)
  )
    throw new Error('Documentation publication status is incompatible');
  const actions = data.allowedActions.map((item) => text(item, 'Documentation action'));
  if (actions.some((item) => item !== 'INITIALIZE'))
    throw new Error('Documentation publication action is unsupported');
  const publication =
    data.publication === undefined
      ? undefined
      : record(data.publication, 'Publication');
  const result: DocumentationPublicationStatus = {
    profileCode: text(data.profileCode, 'Documentation profile'),
    siteCode: text(data.siteCode, 'Documentation site'),
    readiness: readiness as DocumentationPublicationReadiness,
    releaseCode: text(data.releaseCode, 'Documentation release'),
    releaseVersion: text(data.releaseVersion, 'Documentation release version'),
    allowedActions: Object.freeze(actions as 'INITIALIZE'[]),
    ...(publication
      ? {
          publication: Object.freeze({
            code: text(publication.code, 'Publication code'),
            state: text(publication.state, 'Publication state'),
            revision: Number(publication.revision),
            ...(typeof publication.correlationId === 'string'
              ? { correlationId: publication.correlationId }
              : {}),
          }),
        }
      : {}),
  };
  return Object.freeze(result);
}

async function invoke(
  options: Options,
  method: 'GET' | 'POST',
  fetchImplementation: typeof fetch,
) {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(options.profileCode))
    throw new Error('Documentation profile is invalid');
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), options.timeoutMs);
  const endpoint = options.connection.endpoint.replace(/\/$/, '');
  const path = `/v0/applications/${encodeURIComponent(options.profileCode)}/initialization${method === 'POST' ? '/initiate' : ''}`;
  try {
    const requestInit: RequestInit = {
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
      ...(method === 'POST'
        ? {
            body: JSON.stringify({
              reason: 'Axis administrator requested documentation publication',
            }),
          }
        : {}),
    };
    const response = await fetchImplementation(new URL(endpoint + path), requestInit);
    if (!response.ok)
      throw new Error(
        response.status === 403
          ? 'You are not authorized to publish documentation.'
          : `Documentation publication returned HTTP ${String(response.status)}`,
      );
    return parse(await response.json());
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function createDocumentationPublicationClient(
  options: Options,
  fetchImplementation: typeof fetch = fetch,
) {
  return Object.freeze({
    getStatus: () => invoke(options, 'GET', fetchImplementation),
    initiate: () => invoke(options, 'POST', fetchImplementation),
  });
}
