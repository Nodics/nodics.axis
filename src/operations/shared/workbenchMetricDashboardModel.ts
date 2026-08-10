import {
  workspaceComponentGap,
  workspaceContentGap,
  workspacePanelPadding,
} from '../../app/shell/workspaceLayout';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisModuleConnection,
} from '../../bootstrap/publicBootstrap';
import {
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
  readonly filter?: {
    readonly field: string;
    readonly value: string;
  };
}

export type WorkbenchMetricStatus = 'ready' | 'unavailable';

export interface WorkbenchMetric extends WorkbenchMetricDefinition {
  readonly detail: string;
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
        `${connection.moduleName}:${connection.instanceId}:${connection.endpoint}:${connection.state}`,
    )
    .sort()
    .join('|');
}

export function activeConnections(
  bootstrap: AxisAuthenticatedBootstrap,
): readonly AxisModuleConnection[] {
  return Object.freeze(
    Object.keys(bootstrap.moduleConnections)
      .map((moduleName) => selectModuleConnection(bootstrap, moduleName))
      .filter((connection) => connection !== undefined),
  );
}

function workbenchConnectionModuleName(schema: WorkbenchSchema): string {
  return schema.connectionModuleName ?? schema.moduleName;
}

function findMetricSchema(
  schemas: readonly WorkbenchSchema[],
  definition: WorkbenchMetricDefinition,
): WorkbenchSchema | undefined {
  return schemas.find(
    (schema) =>
      schema.moduleName === definition.moduleName &&
      schema.schemaName === definition.schemaName,
  );
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
  const discoveredSchema = findMetricSchema(schemas, definition);
  if (!discoveredSchema) {
    return Object.freeze({
      ...definition,
      detail: 'Schema was not discovered from live workbench contracts.',
      status: 'unavailable',
      value: undefined,
    });
  }
  const schema = schemaWithValidQueryCapabilities(discoveredSchema);
  const connection = selectModuleConnection(
    bootstrap,
    workbenchConnectionModuleName(schema),
  );
  if (!connection) {
    return Object.freeze({
      ...definition,
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
      detail: definition.description,
      status: 'ready',
      value: page.totalCount,
    });
  } catch (error: unknown) {
    return Object.freeze({
      ...definition,
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
  const schemas = await loadWorkbenchSchemas(connections, configuration);
  const metrics = await Promise.all(
    definitions.map((definition) =>
      loadWorkbenchMetric(definition, schemas, bootstrap, configuration),
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
