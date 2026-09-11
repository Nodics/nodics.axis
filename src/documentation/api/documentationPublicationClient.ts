import type { AxisModuleConnection } from '../../bootstrap/publicBootstrap';

export type DocumentationPublicationReadiness =
  | 'NOT_IMPORTED'
  | 'IMPORTED'
  | 'PUBLICATION_PENDING'
  | 'READY'
  | 'REJECTED'
  | 'FAILED'
  | 'ROLLED_BACK'
  | 'RETIRED';

export type DocumentationPublicationAction = 'INITIALIZE' | 'ROLLBACK' | 'RETIRE';

export interface DocumentationPublicationStatus {
  readonly profileCode: string;
  readonly siteCode: string;
  readonly readiness: DocumentationPublicationReadiness;
  readonly releaseCode: string;
  readonly releaseVersion: string;
  readonly releaseStatus?: string;
  readonly allowedActions: readonly DocumentationPublicationAction[];
  readonly publication?: Readonly<{
    code: string;
    state: string;
    revision: number;
    requestedBy?: string;
    targetVersion?: string;
    workflowRef?: string;
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
      'ROLLED_BACK',
      'RETIRED',
    ].includes(readiness) ||
    !Array.isArray(data.allowedActions)
  )
    throw new Error('Documentation publication status is incompatible');
  const actions = data.allowedActions.map((item) => text(item, 'Documentation action'));
  if (actions.some((item) => !['INITIALIZE', 'ROLLBACK', 'RETIRE'].includes(item)))
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
    allowedActions: Object.freeze(actions as DocumentationPublicationAction[]),
    ...(typeof data.releaseStatus === 'string'
      ? { releaseStatus: data.releaseStatus }
      : {}),
    ...(publication
      ? {
          publication: Object.freeze({
            code: text(publication.code, 'Publication code'),
            state: text(publication.state, 'Publication state'),
            revision: Number(publication.revision),
            ...(typeof publication.requestedBy === 'string'
              ? { requestedBy: publication.requestedBy }
              : {}),
            ...(typeof publication.targetVersion === 'string'
              ? { targetVersion: publication.targetVersion }
              : {}),
            ...(typeof publication.workflowRef === 'string'
              ? { workflowRef: publication.workflowRef }
              : {}),
            ...(typeof publication.correlationId === 'string'
              ? { correlationId: publication.correlationId }
              : {}),
          }),
        }
      : {}),
  };
  return Object.freeze(result);
}

async function parseErrorMessage(response: Response): Promise<string> {
  let body = '';
  try {
    body = await response.text();
  } catch {
    body = '';
  }
  if (!body.trim())
    return `Documentation publication returned HTTP ${String(response.status)}`;
  try {
    const parsed = JSON.parse(body) as unknown;
    const envelope = record(parsed, 'Documentation publication error');
    const data =
      typeof envelope.data === 'object' &&
      envelope.data !== null &&
      !Array.isArray(envelope.data)
        ? (envelope.data as Record<string, unknown>)
        : {};
    const metadata =
      typeof envelope.metadata === 'object' &&
      envelope.metadata !== null &&
      !Array.isArray(envelope.metadata)
        ? (envelope.metadata as Record<string, unknown>)
        : {};
    const message = [
      typeof envelope.message === 'string' ? envelope.message : '',
      typeof envelope.error === 'string' ? envelope.error : '',
      typeof data.message === 'string' ? data.message : '',
      typeof metadata.targetMessage === 'string' ? metadata.targetMessage : '',
    ]
      .filter(Boolean)
      .join(' ');
    if (
      /content changed without a new release version|increment and regenerate|checksum/iu.test(
        message,
      )
    ) {
      return 'Release version update required. Increment the content-pack version, regenerate the pack, then update Staged again.';
    }
    return message.trim()
      ? message
      : `Documentation publication returned HTTP ${String(response.status)}`;
  } catch {
    return body.trim().slice(0, 500);
  }
}

async function invoke(
  options: Options,
  method: 'GET' | 'POST',
  fetchImplementation: typeof fetch,
  operation?: 'initiate' | 'rollback' | 'retire',
) {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(options.profileCode))
    throw new Error('Documentation profile is invalid');
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), options.timeoutMs);
  const endpoint = options.connection.endpoint.replace(/\/$/, '');
  const path = `/v0/applications/${encodeURIComponent(options.profileCode)}/initialization${operation ? `/${operation}` : ''}`;
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
      ...(operation === 'initiate'
        ? {
            body: JSON.stringify({
              reason: 'Axis administrator requested documentation publication',
            }),
          }
        : {}),
    };
    const response = await fetchImplementation(new URL(endpoint + path), requestInit);
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('You are not authorized to publish documentation.');
      }
      throw new Error(await parseErrorMessage(response));
    }
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
    initiate: () => invoke(options, 'POST', fetchImplementation, 'initiate'),
    rollback: () => invoke(options, 'POST', fetchImplementation, 'rollback'),
    retire: () => invoke(options, 'POST', fetchImplementation, 'retire'),
  });
}
