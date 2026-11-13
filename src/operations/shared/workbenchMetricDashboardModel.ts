import {
  workspaceComponentGap,
  workspaceContentGap,
  workspacePanelPadding,
} from '../../app/shell/workspaceLayout';
import {
  type AxisAuthenticatedBootstrap,
  type AxisModuleConnection,
  type AxisWorkbenchSchemaDiscovery,
} from '../../bootstrap/publicBootstrap';
import {
  loadGeneratedSchemaCapabilities,
  loadWorkbenchRecords,
  loadWorkbenchSchemas,
} from '../../workbench/api/workbenchClient';
import type {
  WorkbenchFilterGroup,
  WorkbenchSchema,
} from '../../workbench/api/workbenchContracts';
import {
  resolveWorkbenchRecordSort,
  schemaWithValidQueryCapabilities,
} from '../../workbench/workbenchRouteModel';

export interface WorkbenchMetricConfiguration {
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly timeoutMs: number;
}

export interface WorkbenchMetricDefinition {
  readonly id: string;
  readonly label: string;
  readonly moduleName: string;
  readonly schemaName: string;
  readonly description: string;
  readonly route: string;
  readonly icon: string;
  readonly includeSourceContext?: boolean | undefined;
  readonly schemaDiscovery?:
    | Readonly<{ moduleName: string; descriptor: AxisWorkbenchSchemaDiscovery }>
    | undefined;
  readonly ownerSelector?:
    | Readonly<{
        runtimeRoleCode: string;
        publicationRole: string;
      }>
    | undefined;
  readonly filter?: {
    readonly field: string;
    readonly value: string;
  };
}

export type WorkbenchMetricStatus = 'ready' | 'unavailable';

export interface WorkbenchMetric extends WorkbenchMetricDefinition {
  readonly detail: string;
  readonly canOpen?: boolean | undefined;
  readonly href?: string | undefined;
  readonly status: WorkbenchMetricStatus;
  readonly value: number | undefined;
}

export const dashboardComponentGap = workspaceComponentGap;
export const dashboardContentGap = workspaceContentGap;
export const dashboardCardPadding = workspacePanelPadding;

export function connectionKey(connections: readonly AxisModuleConnection[]): string {
  return connections
    .map(
      (connection) =>
        `${connection.moduleName}:${connection.instanceId}:${connection.endpoint}:${connection.state}:${connection.runtimeRole?.code ?? ''}:${connection.runtimeRole?.publication ?? ''}`,
    )
    .sort()
    .join('|');
}

export function activeConnections(
  bootstrap: AxisAuthenticatedBootstrap,
): readonly AxisModuleConnection[] {
  return Object.freeze(
    Object.values(bootstrap.moduleConnections)
      .flatMap((connections) => [...connections])
      .filter(
        (connection) => connection.state === 'UP' || connection.state === 'DEGRADED',
      ),
  );
}

function workbenchConnectionModuleName(schema: WorkbenchSchema): string {
  return schema.connectionModuleName ?? schema.moduleName;
}

/** Selects exact advertised authority; names and successful empty reads are never ownership proof. */
function findMetricSchema(
  schemas: readonly WorkbenchSchema[],
  definition: WorkbenchMetricDefinition,
  bootstrap: AxisAuthenticatedBootstrap,
): WorkbenchSchema | undefined {
  let candidates = schemas.filter(
    (schema) =>
      schema.moduleName === definition.moduleName &&
      schema.schemaName === definition.schemaName,
  );
  if (definition.ownerSelector) {
    const { runtimeRoleCode, publicationRole } = definition.ownerSelector;
    const owners = (bootstrap.moduleConnections[definition.moduleName] ?? []).filter(
      (connection) =>
        ['UP', 'DEGRADED'].includes(connection.state) &&
        connection.runtimeRole?.code === runtimeRoleCode &&
        connection.runtimeRole.publication === publicationRole,
    );
    if (owners.length !== 1) return undefined;
    const owner = owners[0]!;
    candidates = candidates.filter(
      (schema) =>
        schema.connectionModuleName === owner.moduleName &&
        schema.connectionInstanceId === owner.instanceId &&
        (schema.connectionEnvironment === undefined ||
          schema.connectionEnvironment === owner.environment) &&
        (schema.connectionServer === undefined ||
          schema.connectionServer === owner.server),
    );
  }
  return candidates.length === 1 ? candidates[0] : undefined;
}

function findSchemaConnection(
  bootstrap: AxisAuthenticatedBootstrap,
  schema: WorkbenchSchema,
): AxisModuleConnection | undefined {
  const moduleName = workbenchConnectionModuleName(schema);
  const connections = (bootstrap.moduleConnections[moduleName] ?? []).filter(
    (connection) =>
      ['UP', 'DEGRADED'].includes(connection.state) &&
      (schema.connectionInstanceId === undefined ||
        connection.instanceId === schema.connectionInstanceId) &&
      (schema.connectionServer === undefined ||
        connection.server === schema.connectionServer) &&
      (schema.connectionEnvironment === undefined ||
        connection.environment === schema.connectionEnvironment),
  );
  return connections.length === 1 ? connections[0] : undefined;
}

function equalFilter(
  schema: WorkbenchSchema,
  field: string,
  value: string,
): WorkbenchFilterGroup | undefined {
  const filterField = schema.queryCapabilities.filterFields.find(
    (candidate) => candidate.field === field,
  );
  if (!filterField?.operators.includes('EQUALS')) return undefined;
  return Object.freeze({
    operator: 'AND',
    items: Object.freeze([
      Object.freeze({
        field,
        operator: 'EQUALS',
        value,
      }),
    ]),
  });
}

function metricPageSize(schema: WorkbenchSchema): number {
  const allowed = schema.queryCapabilities.allowedPageSizes.find(
    (size) => size <= schema.queryCapabilities.maximumPageSize,
  );
  return allowed ?? schema.queryCapabilities.defaultPageSize;
}

export async function loadWorkbenchMetric(
  definition: WorkbenchMetricDefinition,
  schemas: readonly WorkbenchSchema[],
  bootstrap: AxisAuthenticatedBootstrap,
  configuration: WorkbenchMetricConfiguration,
): Promise<WorkbenchMetric> {
  const canOpen = bootstrap.navigation.some(
    (item) =>
      item.route === definition.route &&
      !['DISABLED', 'HIDDEN'].includes(item.featureState ?? 'ACTIVE') &&
      ['UP', 'DEGRADED'].includes(item.availability),
  );
  const discoveredSchema = findMetricSchema(schemas, definition, bootstrap);
  if (!discoveredSchema) {
    return Object.freeze({
      ...definition,
      canOpen,
      detail: 'The required runtime source is unavailable or ambiguous.',
      status: 'unavailable',
      value: undefined,
    });
  }
  const schema = schemaWithValidQueryCapabilities(discoveredSchema);
  const connection = findSchemaConnection(bootstrap, schema);
  if (!connection) {
    return Object.freeze({
      ...definition,
      canOpen,
      detail: 'Owning runtime connection is not available.',
      status: 'unavailable',
      value: undefined,
    });
  }
  const filters = definition.filter
    ? equalFilter(schema, definition.filter.field, definition.filter.value)
    : undefined;
  if (definition.filter && !filters) {
    return Object.freeze({
      ...definition,
      canOpen,
      detail: `${definition.filter.field} is not available as an EQUALS filter for this schema.`,
      status: 'unavailable',
      value: undefined,
    });
  }
  try {
    const page = await loadWorkbenchRecords(connection, schema, configuration, {
      search: '',
      filters,
      pageNumber: 1,
      pageSize: metricPageSize(schema),
      sort: resolveWorkbenchRecordSort(schema, undefined),
    });
    return Object.freeze({
      ...definition,
      canOpen,
      href:
        definition.includeSourceContext && connection.server
          ? `${definition.route}?${new URLSearchParams({ sourceServer: connection.server, sourceEnvironment: connection.environment }).toString()}`
          : definition.route,
      detail: definition.description,
      status: 'ready',
      value: page.totalCount,
    });
  } catch (error: unknown) {
    return Object.freeze({
      ...definition,
      canOpen,
      detail: error instanceof Error ? error.message : 'Metric count failed.',
      status: 'unavailable',
      value: undefined,
    });
  }
}

export async function loadWorkbenchMetrics(
  connections: readonly AxisModuleConnection[],
  bootstrap: AxisAuthenticatedBootstrap,
  configuration: WorkbenchMetricConfiguration,
  definitions: readonly WorkbenchMetricDefinition[],
): Promise<readonly WorkbenchMetric[]> {
  const requiredConnections = connections.filter((connection) => {
    const owned = definitions.filter(
      (definition) => definition.moduleName === connection.moduleName,
    );
    return owned.some(
      (definition) =>
        !definition.ownerSelector ||
        (connection.runtimeRole?.code === definition.ownerSelector.runtimeRoleCode &&
          connection.runtimeRole.publication ===
            definition.ownerSelector.publicationRole),
    );
  });
  // Discovery is grouped by its advertised owner contract, never retried through
  // the generic route after a denial or failure. One failed owner does not hide
  // independent successful dashboard observations.
  const groups = new Map<string, Promise<readonly WorkbenchSchema[]>>();
  for (const definition of definitions) {
    const key = JSON.stringify(definition.schemaDiscovery ?? null);
    if (groups.has(key)) continue;
    const groupDefinitions = definitions.filter(
      (item) => JSON.stringify(item.schemaDiscovery ?? null) === key,
    );
    const groupConnections = requiredConnections.filter((connection) =>
      groupDefinitions.some((item) => item.moduleName === connection.moduleName),
    );
    groups.set(
      key,
      (definition.schemaDiscovery
        ? loadWorkbenchSchemas(
            groupConnections,
            configuration,
            fetch,
            definition.schemaDiscovery,
          )
        : Promise.allSettled(
            groupConnections.flatMap((connection) =>
              [
                ...new Set(
                  groupDefinitions
                    .filter((item) => item.moduleName === connection.moduleName)
                    .map((item) => item.schemaName),
                ),
              ].map(async (schemaName) => {
                const schema = await loadGeneratedSchemaCapabilities(
                  connection,
                  { schemaName },
                  configuration,
                );
                if (
                  schema.moduleName !== connection.moduleName ||
                  schema.schemaName !== schemaName
                )
                  throw new Error(
                    'Metric schema owner does not match the selected source',
                  );
                return schema;
              }),
            ),
          ).then((results) =>
            results.flatMap((result) =>
              result.status === 'fulfilled' ? [result.value] : [],
            ),
          )
      ).catch(() => []),
    );
  }
  const metrics = await Promise.all(
    definitions.map(async (definition) =>
      loadWorkbenchMetric(
        definition,
        (await groups.get(JSON.stringify(definition.schemaDiscovery ?? null))) ?? [],
        bootstrap,
        configuration,
      ),
    ),
  );
  return Object.freeze(metrics);
}

export function metricsById(
  metrics: readonly WorkbenchMetric[] | undefined,
  definitions: readonly WorkbenchMetricDefinition[],
): readonly WorkbenchMetric[] {
  const byId = new Map((metrics ?? []).map((metric) => [metric.id, metric]));
  return Object.freeze(
    definitions.map(
      (definition) =>
        byId.get(definition.id) ??
        Object.freeze({
          ...definition,
          detail: definition.description,
          status: 'unavailable' as const,
          value: undefined,
        }),
    ),
  );
}

export function totalReadyMetrics(
  metrics: readonly WorkbenchMetric[] | undefined,
): number {
  return (metrics ?? []).filter((metric) => metric.status === 'ready').length;
}

export function totalMetricValue(
  metrics: readonly WorkbenchMetric[] | undefined,
): number {
  return (metrics ?? []).reduce(
    (total, metric) =>
      metric.status === 'ready' && typeof metric.value === 'number'
        ? total + metric.value
        : total,
    0,
  );
}
