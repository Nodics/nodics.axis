import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
} from '../../bootstrap/publicBootstrap';
export interface OperationalOwnerConfiguration {
  bootstrap: AxisAuthenticatedBootstrap;
  accessToken: string;
  enterpriseCode: string;
  timeoutMs: number;
}
function unwrap(value: unknown): unknown {
  for (
    let i = 0;
    i < 6 && value && typeof value === 'object' && !Array.isArray(value);
    i++
  ) {
    const record = value as Record<string, unknown>;
    if (record.data !== undefined) value = record.data;
    else if (record.result !== undefined) value = record.result;
    else break;
  }
  return value;
}
/** Calls the backend-discovered owner endpoint with the employee's current token. */
export async function invokeOperationalOwner<T>(
  configuration: OperationalOwnerConfiguration,
  moduleName: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const connection = selectModuleConnection(configuration.bootstrap, moduleName);
  if (!connection?.endpoint)
    throw new Error(
      'The review service is unavailable in the current BackOffice catalogue.',
    );
  const url = new URL(connection.endpoint.replace(/\/$/, '') + '/v0' + path);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('The review service endpoint is invalid.');
  const controller = new AbortController(),
    timer = globalThis.setTimeout(() => controller.abort(), configuration.timeoutMs);
  try {
    const response = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${configuration.accessToken}`,
        'Content-Type': 'application/json',
        'x-enterprise-code': configuration.enterpriseCode,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    });
    const envelope = (await response.json()) as Record<string, unknown>;
    if (!response.ok)
      throw new Error(
        typeof envelope.message === 'string'
          ? envelope.message
          : 'The review request failed.',
      );
    return unwrap(envelope) as T;
  } finally {
    globalThis.clearTimeout(timer);
  }
}
