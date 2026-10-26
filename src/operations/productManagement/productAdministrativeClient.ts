/** Adapts the existing Product Workbench to native administrative commands, never alternate identity. */
import type { AxisModuleConnection } from '../../bootstrap/publicBootstrap';
import {
  parseWorkbenchSchema,
  type WorkbenchSchema,
} from '../../workbench/api/workbenchContracts';
import type { OperationalOwnerConfiguration } from '../shared/operationalOwnerClient';

const base = '/business/products/administrative/';
const invalid = (): never => {
  throw new Error('The Product administrative response is invalid.');
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalid();
const identifier = (value: string) =>
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) ? value : invalid();
export type ProductAdministrativeCapability = {
  descriptor: WorkbenchSchema;
  labels: { title: string; targetEnterpriseCode: string };
  audit: Record<string, unknown>;
};

function parseEnvelope(
  value: unknown,
  c: OperationalOwnerConfiguration,
  target: string,
) {
  const envelope = object(value);
  if (
    envelope.error ||
    envelope.success === false ||
    (typeof envelope.code === 'string' && envelope.code.startsWith('ERR_'))
  )
    invalid();
  const data = object(envelope.data),
    audit = object(data.audit);
  if (
    data.targetEnterpriseCode !== target ||
    audit.targetEnterpriseCode !== target ||
    audit.tenant !== c.bootstrap.tenantCode ||
    audit.actorEnterpriseCode !== c.enterpriseCode ||
    typeof audit.actorCode !== 'string' ||
    !audit.actorCode
  )
    invalid();
  return { result: data.result, audit };
}
function capability(
  value: unknown,
  audit: Record<string, unknown>,
): ProductAdministrativeCapability {
  const result = object(value),
    labels = object(result.labels);
  if (
    result.crossEnterpriseManagement !== true ||
    typeof labels.title !== 'string' ||
    !labels.title ||
    typeof labels.targetEnterpriseCode !== 'string' ||
    !labels.targetEnterpriseCode
  )
    invalid();
  const descriptor = parseWorkbenchSchema(result.descriptor);
  if (
    descriptor.moduleName !== 'product' ||
    descriptor.schemaName !== 'product' ||
    descriptor.relationships.length ||
    descriptor.aggregateOperations?.length
  )
    invalid();
  for (const key of ['capabilities', 'search', 'create', 'update'] as const) {
    const route = descriptor.apiOperations?.[key];
    if (
      !route ||
      route.path !== base + key ||
      route.method !== 'POST' ||
      route.apiVersion !== 'v0'
    )
      invalid();
  }
  return {
    descriptor,
    labels: {
      title: String(labels.title),
      targetEnterpriseCode: String(labels.targetEnterpriseCode),
    },
    audit,
  };
}

async function command(
  c: OperationalOwnerConfiguration,
  connection: AxisModuleConnection,
  target: string,
  operation: string,
  body: unknown,
  options: RequestInit = {},
  fetcher: typeof fetch = fetch,
) {
  const controller = new AbortController(),
    abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = globalThis.setTimeout(abort, c.timeoutMs);
  try {
    const url = new URL(
      connection.endpoint.replace(/\/$/, '') + '/v0' + base + operation,
    );
    if (!['http:', 'https:'].includes(url.protocol)) invalid();
    const response = await fetcher(url, {
      ...options,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.accessToken}`,
        'x-enterprise-code': c.enterpriseCode,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetEnterpriseCode: identifier(target),
        ...(operation === 'capabilities' ? {} : { command: body }),
      }),
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    const value: unknown = await response.json();
    if (!response.ok) throw new Error('Product administrative request was refused.');
    return parseEnvelope(value, c, target);
  } finally {
    globalThis.clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

export async function loadProductAdministrativeCapability(
  c: OperationalOwnerConfiguration,
  connection: AxisModuleConnection,
  target: string,
  signal?: AbortSignal,
) {
  const value = await command(
    c,
    connection,
    target,
    'capabilities',
    undefined,
    signal ? { signal } : {},
  );
  return capability(value.result, value.audit);
}

/** Only exact Product owner operations may use this adapter; no fallback to ordinary or foreign routes. */
export function productAdministrativeTransport(
  c: OperationalOwnerConfiguration,
  connection: AxisModuleConnection,
  target: string,
  fetcher: typeof fetch = fetch,
) {
  const endpoint = connection.endpoint.replace(/\/$/, '') + '/v0';
  const ownerFetch: typeof fetch = async (input, init = {}) => {
    if (input instanceof Request) invalid();
    const url = new URL(
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : invalid(),
      ),
      expected = new URL(endpoint);
    if (
      url.origin !== expected.origin ||
      !url.pathname.startsWith(expected.pathname + '/') ||
      url.search ||
      url.hash
    )
      invalid();
    const path = url.pathname.slice(expected.pathname.length);
    const discovery = path === '/business/products/schemas';
    const operation = discovery
      ? 'capabilities'
      : path.startsWith(base)
        ? path.slice(base.length)
        : path === '/business/products/archive'
          ? 'archive'
          : '';
    if (!['capabilities', 'search', 'create', 'update', 'archive'].includes(operation))
      invalid();
    if (
      discovery
        ? init.method !== undefined && init.method !== 'GET'
        : init.method !== 'POST'
    )
      invalid();
    const headers = new Headers(init.headers);
    if (
      headers.get('Authorization') !== `Bearer ${c.accessToken}` ||
      headers.get('x-enterprise-code') !== c.enterpriseCode
    )
      invalid();
    const body =
      init.body === undefined
        ? undefined
        : typeof init.body === 'string'
          ? (JSON.parse(init.body) as unknown)
          : invalid();
    const value = await command(c, connection, target, operation, body, init, fetcher);
    let result = value.result;
    if (operation === 'capabilities') {
      const parsed = capability(result, value.audit);
      result = discovery
        ? { moduleName: 'product', schemas: [parsed.descriptor] }
        : parsed.descriptor;
    }
    return new Response(JSON.stringify({ data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return {
    scopeKey: JSON.stringify([
      'product-native-admin',
      c.bootstrap.tenantCode,
      c.enterpriseCode,
      target,
      connection.instanceId,
      connection.endpoint,
    ]),
    fetch: ownerFetch,
  };
}
