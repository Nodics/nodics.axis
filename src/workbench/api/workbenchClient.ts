import type { AxisModuleConnection } from '../../bootstrap/publicBootstrap';
import type { AxisNavigationLifecycleAction } from '../../bootstrap/publicBootstrap';
import {
  parseWorkbenchRecords,
  parseWorkbenchRecordPage,
  parseWorkbenchDeleteImpact,
  type WorkbenchDeleteImpact,
  parseWorkbenchSchemaList,
  type WorkbenchRecord,
  type WorkbenchRecordPage,
  type WorkbenchRecordQuery,
  type WorkbenchSchema,
} from './workbenchContracts';

export interface WorkbenchClientConfiguration {
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly timeoutMs: number;
}

export class WorkbenchRequestError extends Error {
  readonly code: string | undefined;
  readonly status: number;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'WorkbenchRequestError';
    this.status = status;
    this.code = code;
  }
}

async function responseError(response: Response): Promise<WorkbenchRequestError> {
  let code: string | undefined;
  let message = `Workbench request returned HTTP ${String(response.status)}`;
  try {
    const value: unknown = await response.json();
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const body = value as Record<string, unknown>;
      if (typeof body.code === 'string') code = body.code;
      if (
        typeof body.message === 'string' &&
        body.message.trim().length > 0 &&
        body.message.length <= 500
      ) {
        message = body.message;
      }
    }
  } catch {
    // Keep the bounded HTTP fallback when the backend did not return JSON.
  }
  return new WorkbenchRequestError(response.status, message, code);
}

function envelopeResult(value: unknown, allowEmptyResult = false): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Workbench returned an invalid response envelope');
  }
  if ('result' in value) return (value as { readonly result: unknown }).result;
  if ('data' in value) return (value as { readonly data: unknown }).data;
  if (
    allowEmptyResult &&
    typeof (value as { readonly code?: unknown }).code === 'string'
  ) {
    return undefined;
  }
  throw new Error('Workbench response does not contain result data');
}

function safeSegment(value: string, name: string): string {
  if (!/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(value)) {
    throw new Error(`${name} is invalid`);
  }
  return encodeURIComponent(value);
}

async function request(
  connection: AxisModuleConnection,
  path: string,
  configuration: WorkbenchClientConfiguration,
  options: RequestInit = {},
  fetchImplementation: typeof fetch = fetch,
  allowEmptyResult = false,
): Promise<unknown> {
  const endpoint = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('Workbench module endpoint is invalid');
  }
  const controller = new AbortController();
  const upstreamSignal = options.signal;
  const abortFromUpstream = () => controller.abort();
  if (upstreamSignal?.aborted) {
    controller.abort();
  } else {
    upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
  }
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const callerHeaders = new Headers(options.headers);
    const response = await fetchImplementation(
      new URL(`${endpoint.toString().replace(/\/$/, '')}/v0${path}`),
      {
        ...options,
        headers: new Headers({
          Accept: 'application/json',
          Authorization: `Bearer ${configuration.accessToken}`,
          'x-enterprise-code': configuration.enterpriseCode,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...Object.fromEntries(callerHeaders.entries()),
        }),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw await responseError(response);
    }
    return envelopeResult(await response.json(), allowEmptyResult);
  } catch (error: unknown) {
    if (upstreamSignal?.aborted) throw new Error('Workbench request cancelled');
    if (controller.signal.aborted) throw new Error('Workbench request timed out');
    throw error instanceof Error ? error : new Error('Workbench request failed');
  } finally {
    globalThis.clearTimeout(timeout);
    upstreamSignal?.removeEventListener('abort', abortFromUpstream);
  }
}

export async function loadWorkbenchSchemas(
  connections: readonly AxisModuleConnection[],
  configuration: WorkbenchClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<readonly WorkbenchSchema[]> {
  const results = await Promise.allSettled(
    connections.map(async (connection) => {
      const schemas = parseWorkbenchSchemaList(
        await request(
          connection,
          '/schema/workbench',
          configuration,
          {},
          fetchImplementation,
        ),
      );
      return schemas.map((schema) =>
        Object.freeze({
          ...schema,
          connectionModuleName: connection.moduleName,
          connectionInstanceId: connection.instanceId,
          connectionServer: connection.server,
          connectionEnvironment: connection.environment,
        }),
      );
    }),
  );
  const schemas = results.flatMap((result) =>
    result.status === 'fulfilled' ? [...result.value] : [],
  );
  if (schemas.length === 0 && results.some((result) => result.status === 'rejected')) {
    throw new Error('Authorized schema discovery is currently unavailable');
  }
  return Object.freeze(
    schemas.sort(
      (left, right) =>
        left.label.localeCompare(right.label) ||
        left.moduleName.localeCompare(right.moduleName),
    ),
  );
}

export async function loadWorkbenchRecords(
  connection: AxisModuleConnection,
  schema: WorkbenchSchema,
  configuration: WorkbenchClientConfiguration,
  query: WorkbenchRecordQuery,
  fetchImplementation: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<WorkbenchRecordPage> {
  return parseWorkbenchRecordPage(
    await request(
      connection,
      `/schema/workbench/${safeSegment(schema.schemaName, 'Workbench schema name')}/records`,
      configuration,
      {
        method: 'POST',
        body: JSON.stringify({ query }),
        ...(signal ? { signal } : {}),
      },
      fetchImplementation,
    ),
  );
}

export async function createWorkbenchRecord(
  connection: AxisModuleConnection,
  schema: WorkbenchSchema,
  model: Readonly<Record<string, unknown>>,
  configuration: WorkbenchClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<WorkbenchRecord> {
  if (
    schema.mutationMode !== 'GENERATED_CRUD' ||
    !schema.operations.includes('create')
  ) {
    throw new Error('This schema does not allow generated record creation');
  }
  const result = await request(
    connection,
    `/${safeSegment(schema.schemaName, 'Workbench schema name')}`,
    configuration,
    { method: 'PUT', body: JSON.stringify(model) },
    fetchImplementation,
  );
  if (Array.isArray(result)) {
    if (result.length !== 1) throw new Error('Workbench create result is invalid');
    return parseWorkbenchRecords(result)[0]!;
  }
  return Object.freeze({
    ...(typeof result === 'object' && result !== null
      ? (result as Record<string, unknown>)
      : (() => {
          throw new Error('Workbench create result is invalid');
        })()),
  });
}

export async function updateWorkbenchRecord(
  connection: AxisModuleConnection,
  schema: WorkbenchSchema,
  original: WorkbenchRecord,
  model: Readonly<Record<string, unknown>>,
  configuration: WorkbenchClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<WorkbenchRecord> {
  if (
    schema.mutationMode !== 'GENERATED_CRUD' ||
    !schema.operations.includes('update')
  ) {
    throw new Error('This schema does not allow generated record updates');
  }
  const identity = recordIdentity(schema, original);
  const result = await request(
    connection,
    `/${safeSegment(schema.schemaName, 'Workbench schema name')}`,
    configuration,
    {
      method: 'PATCH',
      body: JSON.stringify({
        model,
        options: { recursive: false, returnModified: true },
        query: identity,
      }),
    },
    fetchImplementation,
  );
  if (Array.isArray(result)) {
    if (result.length !== 1) throw new Error('Workbench update result is invalid');
    return parseWorkbenchRecords(result)[0]!;
  }
  if (typeof result !== 'object' || result === null) {
    throw new Error('Workbench update result is invalid');
  }
  const updateResult = result as Record<string, unknown>;
  if (Array.isArray(updateResult.models) && updateResult.models.length === 1) {
    return parseWorkbenchRecords(updateResult.models)[0]!;
  }
  throw new Error('Workbench update did not return one modified record');
}

export async function deleteWorkbenchRecord(
  connection: AxisModuleConnection,
  schema: WorkbenchSchema,
  original: WorkbenchRecord,
  configuration: WorkbenchClientConfiguration,
  idempotencyKey: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<void> {
  if (
    schema.mutationMode !== 'GENERATED_CRUD' ||
    !schema.operations.includes('delete')
  ) {
    throw new Error('This schema does not allow generated record deletion');
  }
  await request(
    connection,
    `/schema/workbench/${safeSegment(schema.schemaName, 'Workbench schema name')}/record`,
    configuration,
    {
      method: 'DELETE',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        identity: recordIdentity(schema, original),
      }),
    },
    fetchImplementation,
    true,
  );
}

function recordIdentity(
  schema: WorkbenchSchema,
  original: WorkbenchRecord,
): Readonly<Record<string, string | number | boolean>> {
  const identityField =
    schema.fields.find((field) => field.primary)?.name ?? schema.displayProperty;
  const identity = original[identityField];
  if (
    typeof identity !== 'string' &&
    typeof identity !== 'number' &&
    typeof identity !== 'boolean'
  ) {
    throw new Error('This record does not expose a safe identity');
  }
  const result: Record<string, string | number | boolean> = {
    [identityField]: identity,
  };
  if (schema.concurrency?.mode === 'COMPARE_AND_SET') {
    const revision = original[schema.concurrency.field];
    if (typeof revision !== 'string' && typeof revision !== 'number') {
      throw new Error('This record does not expose its concurrency revision');
    }
    result[schema.concurrency.field] = revision;
  }
  return Object.freeze(result);
}

export async function previewWorkbenchDeleteImpact(
  connection: AxisModuleConnection,
  schema: WorkbenchSchema,
  original: WorkbenchRecord,
  configuration: WorkbenchClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<WorkbenchDeleteImpact> {
  return parseWorkbenchDeleteImpact(
    await request(
      connection,
      `/schema/workbench/${safeSegment(schema.schemaName, 'Workbench schema name')}/delete-impact`,
      configuration,
      {
        method: 'POST',
        body: JSON.stringify({ identity: recordIdentity(schema, original) }),
      },
      fetchImplementation,
    ),
  );
}

export async function bulkDeleteWorkbenchRecords(
  connection: AxisModuleConnection,
  schema: WorkbenchSchema,
  records: readonly WorkbenchRecord[],
  configuration: WorkbenchClientConfiguration,
  idempotencyKey: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<void> {
  if (
    !schema.bulkCapabilities?.operations.includes('DELETE') ||
    records.length === 0 ||
    records.length > schema.bulkCapabilities.maximumItems
  ) {
    throw new Error('Bulk delete is not available for this selection');
  }
  await request(
    connection,
    `/schema/workbench/${safeSegment(schema.schemaName, 'Workbench schema name')}/bulk`,
    configuration,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        operation: 'DELETE',
        identities: records.map((record) => recordIdentity(schema, record)),
      }),
    },
    fetchImplementation,
    true,
  );
}

export async function executeWorkbenchLifecycleAction(
  connection: AxisModuleConnection,
  schema: WorkbenchSchema,
  action: AxisNavigationLifecycleAction,
  record: WorkbenchRecord,
  configuration: WorkbenchClientConfiguration,
  idempotencyKey: string,
  input: Readonly<Record<string, string>> = {},
  fetchImplementation: typeof fetch = fetch,
): Promise<unknown> {
  if (!action.operationRoute) {
    throw new Error('Lifecycle action does not declare a backend operation route');
  }
  const operationRoute = action.operationRoute.replace(
    /:([A-Za-z][A-Za-z0-9._-]*)/g,
    (_match, name: string) => {
      const value = input[name] ?? record[name];
      if (typeof value !== 'string' && typeof value !== 'number') {
        throw new Error(`Lifecycle action route value ${name} is unavailable`);
      }
      return encodeURIComponent(String(value));
    },
  );
  const payloadInput = Object.fromEntries(
    Object.entries(input).map(([name, value]) => {
      const descriptor = action.inputFields?.find((field) => field.name === name);
      if (descriptor?.type !== 'JSON') return [name, value];
      try {
        return [name, JSON.parse(value) as unknown];
      } catch {
        throw new Error(`Lifecycle action input ${name} must be valid JSON`);
      }
    }),
  );
  const method = action.httpMethod ?? 'POST';
  const body =
    method === 'GET'
      ? undefined
      : JSON.stringify({
          actionId: action.id,
          identity: recordIdentity(schema, record),
          model: record,
          idempotencyKey,
          ...payloadInput,
        });
  return request(
    connection,
    operationRoute,
    configuration,
    {
      method,
      headers: { 'Idempotency-Key': idempotencyKey },
      ...(body === undefined ? {} : { body }),
    },
    fetchImplementation,
  );
}

export async function executeWorkbenchAggregate(
  connection: AxisModuleConnection,
  schema: WorkbenchSchema,
  operation: string,
  payload: Readonly<Record<string, unknown>>,
  configuration: WorkbenchClientConfiguration,
  idempotencyKey: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<unknown> {
  if (!schema.aggregateOperations?.some((candidate) => candidate.name === operation)) {
    throw new Error('Aggregate operation is not available');
  }
  return request(
    connection,
    `/schema/workbench/${safeSegment(schema.schemaName, 'Workbench schema name')}/aggregate`,
    configuration,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ operation, payload }),
    },
    fetchImplementation,
  );
}
