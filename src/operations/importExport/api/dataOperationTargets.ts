import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import type { WorkbenchSchema } from '../../../workbench/api/workbenchContracts';

export interface DataOperationTarget {
  readonly key: string;
  readonly schema: WorkbenchSchema;
  readonly source: AxisModuleConnection;
  readonly operationConnection: AxisModuleConnection | undefined;
  readonly mediaConnection: AxisModuleConnection | undefined;
}

/** A model-only navigation hint selects one freshly admitted exact source. It
 * carries no record query, credentials, endpoint, grant or execution authority. */
export function requestedExportSource(
  search: string,
  targets: readonly DataOperationTarget[],
): DataOperationTarget | undefined {
  const parameters = new URLSearchParams(search);
  const moduleName = parameters.get('sourceModule');
  const schemaName = parameters.get('sourceSchema');
  const instanceId = parameters.get('sourceInstance');
  if (!moduleName || !schemaName || !instanceId) return undefined;
  const matches = targets.filter(
    (target) =>
      target.schema.moduleName === moduleName &&
      target.schema.schemaName === schemaName &&
      target.source.instanceId === instanceId,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function safeOrigin(connection: AxisModuleConnection): string | undefined {
  try {
    const url = new URL(connection.endpoint);
    return ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
      ? url.origin
      : undefined;
  } catch {
    return undefined;
  }
}

function available(connection: AxisModuleConnection): boolean {
  return (
    (connection.state === 'UP' || connection.state === 'DEGRADED') &&
    connection.runtimeRole?.publication !== 'ONLINE' &&
    Boolean(safeOrigin(connection))
  );
}

/** Selects one declared colocated service; never substitutes another server or publication role. */
export function dataOperationRuntimeService(
  source: AxisModuleConnection,
  moduleName: 'import' | 'export' | 'media',
  connections: readonly AxisModuleConnection[],
): AxisModuleConnection | undefined {
  if (!available(source)) return undefined;
  const matches = connections.filter(
    (candidate) =>
      available(candidate) &&
      candidate.moduleName === moduleName &&
      candidate.environment === source.environment &&
      candidate.server === source.server &&
      candidate.runtimeRole?.code === source.runtimeRole?.code &&
      candidate.runtimeRole?.publication === source.runtimeRole?.publication &&
      // Legacy connections without runtime coordinates are confined to their
      // exact transport origin. An environment name alone cannot select a server.
      ((source.server && source.runtimeRole?.code) ||
        safeOrigin(candidate) === safeOrigin(source)),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

/** Correlates the schema read to its original currently admitted source. */
function schemaSource(
  schema: WorkbenchSchema,
  connections: readonly AxisModuleConnection[],
): AxisModuleConnection | undefined {
  const matches = connections.filter(
    (connection) =>
      available(connection) &&
      connection.moduleName === (schema.connectionModuleName ?? schema.moduleName) &&
      (schema.connectionInstanceId === undefined ||
        connection.instanceId === schema.connectionInstanceId) &&
      (schema.connectionServer === undefined ||
        connection.server === schema.connectionServer) &&
      (schema.connectionEnvironment === undefined ||
        connection.environment === schema.connectionEnvironment),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

/** Keeps distinct model destinations visible while collapsing aliases at the same declared runtime. */
export function dataOperationTargets(
  schemas: readonly WorkbenchSchema[],
  schemaConnections: readonly AxisModuleConnection[],
  operationModule: 'import' | 'export',
  operationConnections: readonly AxisModuleConnection[],
  mediaConnections: readonly AxisModuleConnection[],
): readonly DataOperationTarget[] {
  const targets = new Map<string, DataOperationTarget>();
  for (const schema of schemas) {
    const source = schemaSource(schema, schemaConnections);
    if (!source) continue;
    const key = JSON.stringify([
      schema.moduleName,
      schema.schemaName,
      source.environment,
      source.server,
      source.runtimeRole?.code,
      source.runtimeRole?.publication,
      source.server && source.runtimeRole?.code ? null : safeOrigin(source),
    ]);
    const previous = targets.get(key);
    if (
      previous &&
      (previous.source.moduleName === schema.moduleName ||
        source.moduleName !== schema.moduleName)
    )
      continue;
    targets.set(key, {
      key,
      schema,
      source,
      operationConnection: dataOperationRuntimeService(
        source,
        operationModule,
        operationConnections,
      ),
      mediaConnection: dataOperationRuntimeService(source, 'media', mediaConnections),
    });
  }
  return Object.freeze(
    [...targets.values()].sort(
      (a, b) =>
        a.schema.moduleName.localeCompare(b.schema.moduleName) ||
        a.schema.label.localeCompare(b.schema.label) ||
        a.key.localeCompare(b.key),
    ),
  );
}

export function dataOperationTargetDestination(
  target: Pick<DataOperationTarget, 'source'>,
): string {
  return [
    target.source.runtimeRole?.code,
    target.source.server ?? target.source.environment,
  ]
    .filter(Boolean)
    .join(' · ');
}
