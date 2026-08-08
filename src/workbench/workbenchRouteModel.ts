import type { AxisSort } from '../app/table/axisTableSorting';
import type {
  AxisNavigationLifecycleAction,
  AxisNavigationItem,
  AxisWorkbenchPresentation,
  AxisWorkbenchPresentationQuickFilter,
} from '../bootstrap/publicBootstrap';
import type {
  WorkbenchFilterGroup,
  WorkbenchRecord,
  WorkbenchRecordQuery,
  WorkbenchRelationship,
  WorkbenchSchema,
} from './api/workbenchContracts';

export interface WorkbenchRouteSchemaSelection {
  readonly moduleName: string;
  readonly schemaName: string;
  readonly mode?: 'create' | undefined;
}

export interface WorkbenchDeepLinkTarget {
  readonly key: string;
  readonly mode?: 'create' | undefined;
  readonly schema: WorkbenchSchema;
}

export interface WorkbenchRouteConnectionPreference {
  readonly environment?: string | undefined;
  readonly server?: string | undefined;
}

export function resolveWorkbenchDeepLinkTarget(
  search: string,
  schemas: readonly WorkbenchSchema[],
): WorkbenchDeepLinkTarget | undefined {
  const parameters = new URLSearchParams(search);
  const moduleName = parameters.get('module')?.trim();
  const schemaName = parameters.get('schema')?.trim();
  if (!moduleName || !schemaName) return undefined;
  const schema = schemas.find(
    (candidate) =>
      candidate.moduleName === moduleName && candidate.schemaName === schemaName,
  );
  if (!schema) return undefined;
  const requestedMode = parameters.get('mode')?.trim();
  const mode =
    requestedMode === 'create' && schema.operations.includes('create')
      ? 'create'
      : undefined;
  return Object.freeze({
    key: `${schema.moduleName}:${schema.schemaName}:${mode ?? 'browse'}`,
    ...(mode ? { mode } : {}),
    schema,
  });
}

export function resolveWorkbenchRouteTarget(
  routeSchema: WorkbenchRouteSchemaSelection | undefined,
  schemas: readonly WorkbenchSchema[],
  connectionPreference?: WorkbenchRouteConnectionPreference,
): WorkbenchDeepLinkTarget | undefined {
  if (!routeSchema) return undefined;
  const candidates = schemas.filter(
    (candidate) =>
      candidate.moduleName === routeSchema.moduleName &&
      candidate.schemaName === routeSchema.schemaName,
  );
  const schema = selectPreferredRouteSchema(candidates, connectionPreference);
  if (!schema) return undefined;
  const mode =
    routeSchema.mode === 'create' && schema.operations.includes('create')
      ? 'create'
      : undefined;
  return Object.freeze({
    key: `${schema.moduleName}:${schema.schemaName}:${mode ?? 'browse'}:route`,
    ...(mode ? { mode } : {}),
    schema,
  });
}

function selectPreferredRouteSchema(
  schemas: readonly WorkbenchSchema[],
  connectionPreference?: WorkbenchRouteConnectionPreference,
): WorkbenchSchema | undefined {
  if (schemas.length === 0) return undefined;
  if (!connectionPreference) return schemas[0];
  return (
    schemas.find(
      (schema) =>
        connectionPreference.server !== undefined &&
        schema.connectionServer === connectionPreference.server &&
        schema.connectionEnvironment === connectionPreference.environment,
    ) ??
    schemas.find(
      (schema) =>
        connectionPreference.server !== undefined &&
        schema.connectionServer === connectionPreference.server,
    ) ??
    schemas.find(
      (schema) =>
        connectionPreference.environment !== undefined &&
        schema.connectionEnvironment === connectionPreference.environment,
    ) ??
    schemas[0]
  );
}

export function schemaFieldNames(schema: WorkbenchSchema): ReadonlySet<string> {
  return new Set(schema.fields.map((field) => field.name));
}

export function workbenchPresentationForSchema(
  navigation: AxisNavigationItem | undefined,
  schema: WorkbenchSchema,
): AxisWorkbenchPresentation | undefined {
  return navigation?.workbenchTarget?.moduleName === schema.moduleName &&
    navigation.workbenchTarget.schemaName === schema.schemaName
    ? navigation.workbenchPresentation
    : undefined;
}

export function workbenchPresentationExcludedColumns(
  presentation: AxisWorkbenchPresentation | undefined,
): readonly string[] {
  return Object.freeze([
    ...(presentation?.hiddenFields ?? []),
    ...(presentation?.forbiddenFields ?? []),
  ]);
}

export function workbenchPresentationForbiddenFields(
  presentation: AxisWorkbenchPresentation | undefined,
): readonly string[] {
  return Object.freeze([...(presentation?.forbiddenFields ?? [])]);
}

export function resolveWorkbenchDefaultColumns(
  schema: WorkbenchSchema,
  presentation: AxisWorkbenchPresentation | undefined,
): readonly string[] {
  const fieldNames = schemaFieldNames(schema);
  const excludedFields = new Set(workbenchPresentationExcludedColumns(presentation));
  const presented = (presentation?.defaultColumns ?? []).filter(
    (field) => fieldNames.has(field) && !excludedFields.has(field),
  );
  if (presented.length > 0) return Object.freeze(presented);
  const semanticDefaults = schema.fields
    .filter(
      (field) => (field.primary || field.searchable) && !excludedFields.has(field.name),
    )
    .slice(0, 5)
    .map((field) => field.name);
  return Object.freeze(
    semanticDefaults.length > 0
      ? semanticDefaults
      : schema.fields
          .filter((field) => !excludedFields.has(field.name))
          .slice(0, 5)
          .map((field) => field.name),
  );
}

export function workbenchQuickFilterGroup(
  schema: WorkbenchSchema,
  quickFilter: AxisWorkbenchPresentationQuickFilter,
): WorkbenchFilterGroup | undefined {
  const filterField = schema.queryCapabilities.filterFields.find(
    (candidate) => candidate.field === quickFilter.field,
  );
  if (!filterField) return undefined;
  const values = [
    ...(quickFilter.value === undefined ? [] : [quickFilter.value]),
    ...(quickFilter.values ?? []),
  ];
  if (values.length === 0) return undefined;
  if (values.length > 1 && filterField.operators.includes('IN')) {
    return Object.freeze({
      operator: 'AND',
      items: Object.freeze([
        Object.freeze({
          field: quickFilter.field,
          operator: 'IN',
          value: Object.freeze([...new Set(values)]),
        }),
      ]),
    });
  }
  if (!filterField.operators.includes('EQUALS')) return undefined;
  const conditions = [...new Set(values)].map((value) =>
    Object.freeze({
      field: quickFilter.field,
      operator: 'EQUALS' as const,
      value,
    }),
  );
  return Object.freeze({
    operator: values.length > 1 ? 'OR' : 'AND',
    items: Object.freeze(conditions),
  });
}

export function combineWorkbenchFilterGroups(
  fixed: WorkbenchFilterGroup | undefined,
  selected: WorkbenchFilterGroup | undefined,
): WorkbenchFilterGroup | undefined {
  if (!fixed) return selected;
  if (!selected) return fixed;
  return Object.freeze({
    operator: 'AND',
    items: Object.freeze([fixed, selected]),
  });
}

export function workbenchFixedFilterGroup(
  schema: WorkbenchSchema,
  presentation: AxisWorkbenchPresentation | undefined,
): WorkbenchFilterGroup | undefined {
  const groups = (presentation?.fixedFilters ?? [])
    .map((filter) => workbenchQuickFilterGroup(schema, filter))
    .filter((group): group is WorkbenchFilterGroup => group !== undefined);
  if (groups.length === 0) return undefined;
  if (groups.length === 1) return groups[0];
  return Object.freeze({ operator: 'AND', items: Object.freeze(groups) });
}

export function lifecycleActionsForRecord(
  actions: readonly AxisNavigationLifecycleAction[],
  record: WorkbenchRecord,
): readonly AxisNavigationLifecycleAction[] {
  const status =
    typeof record.state === 'string'
      ? record.state
      : typeof record.status === 'string'
        ? record.status
        : undefined;
  return Object.freeze(
    actions.filter(
      (action) =>
        action.featureState !== 'HIDDEN' &&
        (action.targetStatuses === undefined ||
          (status !== undefined && action.targetStatuses.includes(status))),
    ),
  );
}

export function validWorkbenchSortFields(schema: WorkbenchSchema): readonly string[] {
  const fieldNames = schemaFieldNames(schema);
  return Object.freeze(
    schema.queryCapabilities.sortableFields.filter((field) => fieldNames.has(field)),
  );
}

export function resolveWorkbenchRecordSort(
  schema: WorkbenchSchema | undefined,
  preferred: AxisSort | undefined,
): AxisSort {
  if (!schema) return Object.freeze({ field: 'code', direction: 'ASC' });
  const fieldNames = schemaFieldNames(schema);
  const sortableFields = validWorkbenchSortFields(schema);
  if (
    preferred &&
    fieldNames.has(preferred.field) &&
    sortableFields.includes(preferred.field)
  ) {
    return preferred;
  }
  const defaultSort = schema.queryCapabilities.defaultSort;
  if (fieldNames.has(defaultSort.field) && sortableFields.includes(defaultSort.field)) {
    return defaultSort;
  }
  const fallback =
    sortableFields[0] ??
    schema.displayProperties.find((field) => fieldNames.has(field)) ??
    (fieldNames.has(schema.displayProperty) ? schema.displayProperty : undefined) ??
    schema.fields.find((field) => field.primary)?.name ??
    schema.fields[0]?.name ??
    defaultSort.field;
  return Object.freeze({ field: fallback, direction: defaultSort.direction });
}

export function resolveWorkbenchLookupPageSize(schema: WorkbenchSchema): number {
  const firstAllowed = schema.queryCapabilities.allowedPageSizes[0];
  return typeof firstAllowed === 'number'
    ? firstAllowed
    : schema.queryCapabilities.defaultPageSize;
}

export function schemaWithValidQueryCapabilities(
  schema: WorkbenchSchema,
): WorkbenchSchema {
  const sortableFields = validWorkbenchSortFields(schema);
  const defaultSort = resolveWorkbenchRecordSort(schema, undefined);
  return Object.freeze({
    ...schema,
    queryCapabilities: Object.freeze({
      ...schema.queryCapabilities,
      sortableFields,
      defaultSort,
    }),
  });
}

function workbenchFilterValue(value: unknown): string | number | boolean | undefined {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? value
    : undefined;
}

export function workbenchReferenceLookupQuery(
  schema: WorkbenchSchema,
  relationship: WorkbenchRelationship,
  reference: string,
): WorkbenchRecordQuery {
  const field = schema.queryCapabilities.filterFields.find(
    (candidate) => candidate.field === relationship.referenceProperty,
  );
  const baseQuery = {
    pageNumber: 1,
    pageSize: resolveWorkbenchLookupPageSize(schema),
    sort: resolveWorkbenchRecordSort(schema, undefined),
  };
  if (field?.operators.includes('EQUALS')) {
    return Object.freeze({
      ...baseQuery,
      search: '',
      filters: Object.freeze({
        operator: 'AND',
        items: Object.freeze([
          Object.freeze({
            field: relationship.referenceProperty,
            operator: 'EQUALS',
            value: reference,
          }),
        ]),
      }),
    });
  }
  return Object.freeze({
    ...baseQuery,
    search: reference,
  });
}

export function selectWorkbenchReferencedRecord(
  records: readonly WorkbenchRecord[],
  referenceProperty: string,
  reference: string,
): WorkbenchRecord | undefined {
  const exact = records.find((record) => {
    const value = workbenchFilterValue(record[referenceProperty]);
    return value !== undefined && String(value) === reference;
  });
  if (exact) return exact;
  return records.length === 1 ? records[0] : undefined;
}

export function relatedRecordPanelFilter(
  record: WorkbenchRecord | undefined,
  panel: NonNullable<AxisNavigationItem['detailPanels']>[number],
): WorkbenchFilterGroup | undefined {
  if (!record || !panel.relation) return undefined;
  const value = workbenchFilterValue(record[panel.relation.sourceField]);
  if (value === undefined) return undefined;
  return Object.freeze({
    operator: 'AND',
    items: Object.freeze([
      Object.freeze({
        field: panel.relation.targetField,
        operator: 'EQUALS',
        value,
      }),
    ]),
  });
}
