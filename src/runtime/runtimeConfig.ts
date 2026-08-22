export interface AxisRuntimeConfig {
  readonly backofficeBaseUrl: string;
  readonly enterpriseCode: string;
  readonly projectCode: string;
  readonly clientContractVersion: number;
  readonly requestTimeoutMs: number;
  readonly browserSessionCsrfCookieName: string;
  readonly assistantMaximumEventBytes: number;
  readonly assistantReconnectWindowMs: number;
  readonly assistantIdleTimeoutMs: number;
}

const MINIMUM_TIMEOUT_MS = 1_000;
const MAXIMUM_TIMEOUT_MS = 120_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBaseUrl(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} must be a non-empty URL`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${fieldName} must be an absolute URL`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${fieldName} must use HTTP or HTTPS`);
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      `${fieldName} must not contain credentials, query, or fragment data`,
    );
  }

  return url.toString().replace(/\/$/, '');
}

function parsePositiveInteger(value: unknown, fieldName: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return Number(value);
}

function parseNonNegativeInteger(value: unknown, fieldName: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
  return Number(value);
}

function parseBoundedInteger(
  value: unknown,
  fieldName: string,
  minimum: number,
  maximum: number,
): number {
  const parsed = parsePositiveInteger(value, fieldName);
  if (parsed < minimum || parsed > maximum) {
    throw new Error(
      `${fieldName} must be between ${String(minimum)} and ${String(maximum)}`,
    );
  }
  return parsed;
}

function parseIdentifier(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(value)) {
    throw new Error(`${fieldName} must be a valid identifier`);
  }
  return value;
}

export function parseRuntimeConfig(value: unknown): AxisRuntimeConfig {
  if (!isRecord(value)) {
    throw new Error('Axis runtime configuration must be a JSON object');
  }

  const allowedKeys = new Set([
    'backofficeBaseUrl',
    'enterpriseCode',
    'projectCode',
    'clientContractVersion',
    'requestTimeoutMs',
    'browserSessionCsrfCookieName',
    'assistantMaximumEventBytes',
    'assistantReconnectWindowMs',
    'assistantIdleTimeoutMs',
  ]);
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(
      `Axis runtime configuration contains unsupported fields: ${unknownKeys.join(', ')}`,
    );
  }

  const requestTimeoutMs = parsePositiveInteger(
    value.requestTimeoutMs,
    'requestTimeoutMs',
  );
  if (requestTimeoutMs < MINIMUM_TIMEOUT_MS || requestTimeoutMs > MAXIMUM_TIMEOUT_MS) {
    throw new Error(
      `requestTimeoutMs must be between ${MINIMUM_TIMEOUT_MS} and ${MAXIMUM_TIMEOUT_MS}`,
    );
  }

  return Object.freeze({
    backofficeBaseUrl: parseBaseUrl(value.backofficeBaseUrl, 'backofficeBaseUrl'),
    enterpriseCode: parseIdentifier(value.enterpriseCode, 'enterpriseCode'),
    projectCode: parseIdentifier(value.projectCode, 'projectCode'),
    clientContractVersion: parseNonNegativeInteger(
      value.clientContractVersion,
      'clientContractVersion',
    ),
    requestTimeoutMs,
    browserSessionCsrfCookieName:
      typeof value.browserSessionCsrfCookieName === 'string' &&
      /^[A-Za-z0-9_-]{1,64}$/.test(value.browserSessionCsrfCookieName)
        ? value.browserSessionCsrfCookieName
        : (() => {
            throw new Error('browserSessionCsrfCookieName must be a valid cookie name');
          })(),
    assistantMaximumEventBytes: parseBoundedInteger(
      value.assistantMaximumEventBytes,
      'assistantMaximumEventBytes',
      1_024,
      1_048_576,
    ),
    assistantReconnectWindowMs: parseBoundedInteger(
      value.assistantReconnectWindowMs,
      'assistantReconnectWindowMs',
      1_000,
      600_000,
    ),
    assistantIdleTimeoutMs: parseBoundedInteger(
      value.assistantIdleTimeoutMs,
      'assistantIdleTimeoutMs',
      5_000,
      300_000,
    ),
  });
}
