import type { AxisModuleConnection } from '../../bootstrap/publicBootstrap';

export type DocumentationContentPackState =
  | 'DISABLED'
  | 'SOURCE_UNAVAILABLE'
  | 'NOT_INSTALLED'
  | 'IMPORTING'
  | 'CURRENT'
  | 'UPDATE_AVAILABLE'
  | 'INVALID_RELEASE';

export interface DocumentationContentPackPresentation {
  readonly title: string;
  readonly unavailableMessage: string;
  readonly disabledMessage: string;
  readonly importAction: string;
  readonly updateAction: string;
  readonly retryAction: string;
}

export interface DocumentationContentPackStatus {
  readonly code: string;
  readonly enabled: boolean;
  readonly state: DocumentationContentPackState;
  readonly available: boolean;
  readonly installedVersion?: string | null;
  readonly availableVersion?: string | null;
  readonly runId?: string | null;
  readonly allowedOperations: readonly ('IMPORT' | 'UPDATE')[];
  readonly presentation: DocumentationContentPackPresentation;
}

interface DocumentationContentPackClientOptions {
  readonly connection: AxisModuleConnection;
  readonly enterpriseCode: string;
  readonly accessToken: string;
  readonly timeoutMs: number;
  readonly profileCode: string;
}

const immutableReleaseConflictMessage =
  'The documentation content changed without a new release version. Ask the release owner to increment and regenerate the content pack, then try again.';
const importAlreadyRunningMessage =
  'Documentation update is already running. Axis will refresh status automatically.';

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

function optionalText(value: unknown, name: string): string | null {
  return value === null || value === undefined ? null : text(value, name);
}

function parseStatus(value: unknown): DocumentationContentPackStatus {
  const envelope = record(value, 'Content-pack response');
  const data = record(envelope.data, 'Content-pack status');
  const state = text(data.state, 'Content-pack state');
  if (
    ![
      'DISABLED',
      'SOURCE_UNAVAILABLE',
      'NOT_INSTALLED',
      'IMPORTING',
      'CURRENT',
      'UPDATE_AVAILABLE',
      'INVALID_RELEASE',
    ].includes(state) ||
    typeof data.enabled !== 'boolean' ||
    typeof data.available !== 'boolean' ||
    !Array.isArray(data.allowedOperations)
  ) {
    throw new Error('Content-pack status contract is incompatible');
  }
  const operations = data.allowedOperations.map((operation) =>
    text(operation, 'Content-pack operation'),
  );
  if (operations.some((operation) => !['IMPORT', 'UPDATE'].includes(operation))) {
    throw new Error('Content-pack operation is unsupported');
  }
  const presentation = record(data.presentation, 'Content-pack presentation');
  return Object.freeze({
    code: text(data.code, 'Content-pack code'),
    enabled: data.enabled,
    state: state as DocumentationContentPackState,
    available: data.available,
    installedVersion: optionalText(
      data.installedVersion,
      'Installed content-pack version',
    ),
    availableVersion: optionalText(
      data.availableVersion,
      'Available content-pack version',
    ),
    runId: optionalText(data.runId, 'Content-pack run id'),
    allowedOperations: Object.freeze(operations as ('IMPORT' | 'UPDATE')[]),
    presentation: Object.freeze({
      title: text(presentation.title, 'Content-pack title'),
      unavailableMessage: text(
        presentation.unavailableMessage,
        'Content-pack unavailable message',
      ),
      disabledMessage: text(
        presentation.disabledMessage,
        'Content-pack disabled message',
      ),
      importAction: text(presentation.importAction, 'Content-pack import action'),
      updateAction: text(presentation.updateAction, 'Content-pack update action'),
      retryAction: text(presentation.retryAction, 'Content-pack retry action'),
    }),
  });
}

async function responseFailure(response: Response): Promise<Error> {
  if (response.status === 403) {
    return new Error('You are not authorized to manage documentation.');
  }
  let bodyText = '';
  try {
    bodyText = await response.text();
  } catch {
    bodyText = '';
  }
  if (bodyText.trim()) {
    try {
      const body = record(JSON.parse(bodyText), 'Documentation error response');
      const data =
        typeof body.data === 'object' && body.data !== null
          ? (body.data as Record<string, unknown>)
          : {};
      const metadata =
        typeof body.metadata === 'object' && body.metadata !== null
          ? (body.metadata as Record<string, unknown>)
          : {};
      const code = typeof body.code === 'string' ? body.code : '';
      const targetCode =
        typeof metadata.targetCode === 'string' ? metadata.targetCode : '';
      const message = [
        typeof body.message === 'string' ? body.message : '',
        typeof body.error === 'string' ? body.error : '',
        typeof data.message === 'string' ? data.message : '',
        typeof metadata.targetMessage === 'string' ? metadata.targetMessage : '',
      ].join(' ');
      if (/already running/iu.test(message)) {
        return new Error(importAlreadyRunningMessage);
      }
      if (
        (code === 'ERR_IMP_00003' ||
          targetCode === 'ERR_IMP_00003' ||
          response.status === 409) &&
        /version change|new release version|checksum|content changed/iu.test(message)
      ) {
        return new Error(immutableReleaseConflictMessage);
      }
    } catch {
      const bounded = bodyText.trim().slice(0, 500);
      if (/already running/iu.test(bounded)) {
        return new Error(importAlreadyRunningMessage);
      }
      if (
        /version change|new release version|checksum|content changed/iu.test(bounded)
      ) {
        return new Error(immutableReleaseConflictMessage);
      }
    }
  }
  return new Error(`Documentation service returned HTTP ${String(response.status)}`);
}

function createRequest(
  options: DocumentationContentPackClientOptions,
  method: 'GET' | 'POST',
  fetchImplementation: typeof fetch,
): Promise<DocumentationContentPackStatus> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    method === 'POST' ? Math.max(options.timeoutMs, 180_000) : options.timeoutMs,
  );
  const profileCode = encodeURIComponent(options.profileCode);
  const suffix = method === 'POST' ? '/install' : '';
  const endpoint = options.connection.endpoint.replace(/\/$/, '');
  const url = new URL(
    `${endpoint}/v0/applications/${profileCode}/initialization/content-pack${suffix}`,
  );
  return fetchImplementation(url, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${options.accessToken}`,
      'x-enterprise-code': options.enterpriseCode,
    },
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw await responseFailure(response);
      }
      return parseStatus(await response.json());
    })
    .catch((error: unknown) => {
      if (controller.signal.aborted) {
        throw new Error(
          method === 'POST'
            ? 'Documentation update is still running. Axis will refresh status automatically.'
            : 'Documentation service request timed out',
        );
      }
      throw error instanceof Error
        ? error
        : new Error('Documentation service request failed');
    })
    .finally(() => globalThis.clearTimeout(timeout));
}

export function createDocumentationContentPackClient(
  options: DocumentationContentPackClientOptions,
  fetchImplementation: typeof fetch = fetch,
) {
  return Object.freeze({
    getStatus: () => createRequest(options, 'GET', fetchImplementation),
    importOrUpdate: () => createRequest(options, 'POST', fetchImplementation),
  });
}
