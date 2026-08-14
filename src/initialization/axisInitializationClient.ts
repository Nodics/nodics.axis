export type AxisInitializationReadiness =
  | 'NOT_IMPORTED'
  | 'IMPORTED'
  | 'PUBLICATION_PENDING'
  | 'READY'
  | 'REJECTED'
  | 'FAILED';

export interface AxisPublicationEntitySummary {
  readonly type: string;
  readonly label: string;
  readonly total: number;
  readonly added: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly removed: number;
}

export interface AxisPublicationReview {
  readonly title: string;
  readonly summary: string;
  readonly sourceRole: string;
  readonly targetRole: string;
  readonly siteCode: string;
  readonly catalogCode: string;
  readonly impactMessage: string;
  readonly rollbackMessage: string;
  readonly releaseChecksum: string;
  readonly publicationCode: string;
  readonly workflowRef?: string;
  readonly requestedBy?: string;
  readonly requestedAt?: string;
  readonly tenant?: string;
  readonly validation: {
    readonly status: string;
    readonly warnings: readonly string[];
  };
  readonly entities: readonly AxisPublicationEntitySummary[];
  readonly postPublicationCapabilities: readonly {
    readonly title: string;
    readonly description: string;
  }[];
}

export interface AxisInitializationStatus {
  readonly baselineCode: string;
  readonly releaseCode: string;
  readonly releaseVersion: string;
  readonly releaseStatus: string;
  readonly readiness: AxisInitializationReadiness;
  readonly review?: AxisPublicationReview;
  readonly publication?: {
    readonly code: string;
    readonly state: string;
    readonly revision: number;
    readonly targetVersion?: string;
    readonly workflowRef?: string;
    readonly correlationId?: string;
  };
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new Error(`${label} is invalid`);
  return value;
}

function count(value: unknown, label: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0)
    throw new Error(`${label} is invalid`);
  return result;
}

function parseReview(value: unknown): AxisPublicationReview | undefined {
  if (value === undefined) return undefined;
  const review = record(value, 'Axis publication review');
  if (
    !Array.isArray(review.entities) ||
    !Array.isArray(review.postPublicationCapabilities)
  ) {
    throw new Error('Axis publication review is invalid');
  }
  const validation = record(review.validation, 'Axis publication validation');
  if (
    !Array.isArray(validation.warnings) ||
    validation.warnings.some((item) => typeof item !== 'string')
  ) {
    throw new Error('Axis publication validation warnings are invalid');
  }
  return Object.freeze({
    title: text(review.title, 'Axis publication review title'),
    summary: text(review.summary, 'Axis publication review summary'),
    sourceRole: text(review.sourceRole, 'Axis publication source role'),
    targetRole: text(review.targetRole, 'Axis publication target role'),
    siteCode: text(review.siteCode, 'Axis publication site'),
    catalogCode: text(review.catalogCode, 'Axis publication catalog'),
    impactMessage: text(review.impactMessage, 'Axis publication impact'),
    rollbackMessage: text(review.rollbackMessage, 'Axis publication recovery'),
    releaseChecksum: text(review.releaseChecksum, 'Axis publication release checksum'),
    publicationCode: text(review.publicationCode, 'Axis publication code'),
    ...(typeof review.workflowRef === 'string'
      ? { workflowRef: review.workflowRef }
      : {}),
    ...(typeof review.requestedBy === 'string'
      ? { requestedBy: review.requestedBy }
      : {}),
    ...(typeof review.requestedAt === 'string'
      ? { requestedAt: review.requestedAt }
      : {}),
    ...(typeof review.tenant === 'string' ? { tenant: review.tenant } : {}),
    validation: Object.freeze({
      status: text(validation.status, 'Axis publication validation status'),
      warnings: Object.freeze(validation.warnings.map((item) => String(item))),
    }),
    entities: Object.freeze(
      review.entities.map((value, index) => {
        const entity = record(value, `Axis publication entity ${String(index)}`);
        return Object.freeze({
          type: text(entity.type, 'Axis publication entity type'),
          label: text(entity.label, 'Axis publication entity label'),
          total: count(entity.total, 'Axis publication entity total'),
          added: count(entity.added, 'Axis publication entity added count'),
          updated: count(entity.updated, 'Axis publication entity updated count'),
          unchanged: count(entity.unchanged, 'Axis publication entity unchanged count'),
          removed: count(entity.removed, 'Axis publication entity removed count'),
        });
      }),
    ),
    postPublicationCapabilities: Object.freeze(
      review.postPublicationCapabilities.map((value, index) => {
        const capability = record(
          value,
          `Axis post-publication capability ${String(index)}`,
        );
        return Object.freeze({
          title: text(capability.title, 'Axis post-publication capability title'),
          description: text(
            capability.description,
            'Axis post-publication capability description',
          ),
        });
      }),
    ),
  });
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
  const review = parseReview(data.review);
  return Object.freeze({
    baselineCode: data.baselineCode,
    releaseCode: data.releaseCode,
    releaseVersion: data.releaseVersion,
    releaseStatus: data.releaseStatus,
    readiness: readiness as AxisInitializationReadiness,
    ...(review ? { review } : {}),
    ...(publication
      ? {
          publication: Object.freeze({
            code: typeof publication.code === 'string' ? publication.code : '',
            state: typeof publication.state === 'string' ? publication.state : '',
            revision: Number(publication.revision ?? 0),
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
