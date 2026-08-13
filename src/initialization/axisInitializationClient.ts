export type AxisInitializationReadiness =
  | 'NOT_IMPORTED'
  | 'IMPORTED'
  | 'PUBLICATION_PENDING'
  | 'READY'
  | 'REJECTED'
  | 'FAILED';

export interface AxisInitializationStatus {
  readonly baselineCode: string;
  readonly releaseCode: string;
  readonly releaseVersion: string;
  readonly releaseStatus: string;
  readonly readiness: AxisInitializationReadiness;
  readonly publication?: {
    readonly code: string;
    readonly state: string;
    readonly revision: number;
    readonly targetVersion?: string;
    readonly correlationId?: string;
  };
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function parseStatus(value: unknown): AxisInitializationStatus {
  const envelope = record(value, 'Axis initialization response');
  const data = record(envelope.data, 'Axis initialization data');
  const readiness = typeof data.readiness === 'string' ? data.readiness : '';
  if (
    ![
      'NOT_IMPORTED',
      'IMPORTED',
      'PUBLICATION_PENDING',
      'READY',
      'REJECTED',
      'FAILED',
    ].includes(readiness) ||
    typeof data.baselineCode !== 'string' ||
    typeof data.releaseCode !== 'string' ||
    typeof data.releaseVersion !== 'string' ||
    typeof data.releaseStatus !== 'string'
  ) {
    throw new Error('Axis initialization contract is incompatible');
  }
  const publication = data.publication
    ? record(data.publication, 'Axis initialization publication')
    : undefined;
  return Object.freeze({
    baselineCode: data.baselineCode,
    releaseCode: data.releaseCode,
    releaseVersion: data.releaseVersion,
    releaseStatus: data.releaseStatus,
    readiness: readiness as AxisInitializationReadiness,
    ...(publication
      ? {
          publication: Object.freeze({
            code: typeof publication.code === 'string' ? publication.code : '',
            state: typeof publication.state === 'string' ? publication.state : '',
            revision: Number(publication.revision ?? 0),
            ...(typeof publication.targetVersion === 'string'
              ? { targetVersion: publication.targetVersion }
              : {}),
            ...(typeof publication.correlationId === 'string'
              ? { correlationId: publication.correlationId }
              : {}),
          }),
        }
      : {}),
  });
}

async function requestInitialization(
  backofficeBaseUrl: string,
  accessToken: string,
  timeoutMs: number,
  operation: 'status' | 'initiate',
  fetchImplementation: typeof fetch,
): Promise<AxisInitializationStatus> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImplementation(
      new URL(
        operation === 'initiate'
          ? '/nodics/backoffice/v0/axis/initialization/initiate'
          : '/nodics/backoffice/v0/axis/initialization',
        backofficeBaseUrl,
      ),
      {
        method: operation === 'initiate' ? 'POST' : 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...(operation === 'initiate' ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(operation === 'initiate'
          ? { body: JSON.stringify({ reason: 'Initialize the Axis CMS baseline' }) }
          : {}),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw new Error(`Axis initialization returned HTTP ${String(response.status)}`);
    }
    return parseStatus(await response.json());
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function loadAxisInitializationStatus(
  backofficeBaseUrl: string,
  accessToken: string,
  timeoutMs: number,
  fetchImplementation: typeof fetch = fetch,
) {
  return requestInitialization(
    backofficeBaseUrl,
    accessToken,
    timeoutMs,
    'status',
    fetchImplementation,
  );
}

export function initiateAxisInitialization(
  backofficeBaseUrl: string,
  accessToken: string,
  timeoutMs: number,
  fetchImplementation: typeof fetch = fetch,
) {
  return requestInitialization(
    backofficeBaseUrl,
    accessToken,
    timeoutMs,
    'initiate',
    fetchImplementation,
  );
}
