export type WorkbenchOperation = 'search' | 'read' | 'create' | 'update' | 'delete';

export interface WorkbenchField {
  readonly name: string;
  readonly label: string;
  readonly type: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly primary: boolean;
  readonly description: string;
  readonly enum?: readonly string[] | undefined;
  readonly default?: string | number | boolean | null | undefined;
  readonly searchable: boolean;
}

export interface WorkbenchRelationship {
  readonly field: string;
  readonly label: string;
  readonly description: string;
  readonly targetModule: string;
  readonly targetSchema: string;
  readonly cardinality: 'ONE' | 'MANY';
  readonly referenceProperty: string;
  readonly resolution: 'LOCAL_OR_REMOTE';
  readonly actions: readonly (
    | 'SELECT_EXISTING'
    | 'CREATE_RELATED'
    | 'EDIT_RELATED'
    | 'UNLINK'
  )[];
  readonly required: boolean;
  readonly relationshipType?: string;
  readonly ownership?: string;
  readonly inverseField?: string;
  readonly onTargetDelete?: string;
  readonly maximumDepth?: number;
  readonly cycleHandling?: string;
  readonly deleteImpactAvailable?: boolean;
}

export interface WorkbenchBulkCapabilities {
  readonly operations: readonly 'DELETE'[];
  readonly maximumItems: number;
  readonly idempotencyRequired: boolean;
  readonly outcomeMode: string;
}

export interface WorkbenchConcurrency {
  readonly mode: 'NONE' | 'COMPARE_AND_SET';
  readonly field: string;
  readonly required: boolean;
}

export interface WorkbenchAggregateOperation {
  readonly name: string;
  readonly label: string;
  readonly purpose: string;
  readonly consistency: string;
  readonly confirmationRequired: boolean;
}

export interface WorkbenchDeleteImpact {
  readonly targetCount: number;
  readonly blocked: boolean;
  readonly relationships: readonly {
    readonly sourceModule: string;
    readonly sourceSchema: string;
    readonly field: string;
    readonly policy: string;
    readonly referenceCount: number;
  }[];
}

export interface WorkbenchQueryCapabilities {
  readonly searchableFields: readonly string[];
  readonly sortableFields: readonly string[];
  readonly filterFields: readonly WorkbenchFilterField[];
  readonly groupOperators: readonly ('AND' | 'OR')[];
  readonly textOperator: 'CONTAINS';
  readonly allowedPageSizes: readonly number[];
  readonly defaultPageSize: number;
  readonly maximumPageSize: number;
  readonly defaultSort: {
    readonly field: string;
    readonly direction: 'ASC' | 'DESC';
  };
}

export type WorkbenchFilterOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'STARTS_WITH'
  | 'GREATER_THAN'
  | 'GREATER_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_OR_EQUAL'
  | 'BEFORE'
  | 'AFTER'
  | 'BETWEEN'
  | 'IN';

export interface WorkbenchFilterField {
  readonly field: string;
  readonly label: string;
  readonly type: string;
  readonly operators: readonly WorkbenchFilterOperator[];
  readonly enum?: readonly string[] | undefined;
}

export interface WorkbenchFilterCondition {
  readonly field: string;
  readonly operator: WorkbenchFilterOperator;
  readonly value: string | number | boolean | readonly string[];
}

export interface WorkbenchFilterGroup {
  readonly operator: 'AND' | 'OR';
  readonly items: readonly (WorkbenchFilterCondition | WorkbenchFilterGroup)[];
}

export interface WorkbenchSchema {
  readonly moduleName: string;
  readonly connectionModuleName?: string | undefined;
  readonly connectionInstanceId?: string | undefined;
  readonly connectionServer?: string | undefined;
  readonly connectionEnvironment?: string | undefined;
  readonly schemaName: string;
  readonly label: string;
  readonly description: string;
  readonly displayProperty: string;
  readonly displayProperties: readonly string[];
  readonly queryCapabilities: WorkbenchQueryCapabilities;
  readonly bulkCapabilities?: WorkbenchBulkCapabilities;
  readonly concurrency?: WorkbenchConcurrency;
  readonly aggregateOperations?: readonly WorkbenchAggregateOperation[];
  readonly mutationMode: 'GENERATED_CRUD' | 'DOMAIN_OPERATION';
  readonly operations: readonly WorkbenchOperation[];
  readonly fields: readonly WorkbenchField[];
  readonly relationships: readonly WorkbenchRelationship[];
}

export type WorkbenchRecord = Readonly<Record<string, unknown>>;

export interface WorkbenchRecordQuery {
  readonly search: string;
  readonly filters?: WorkbenchFilterGroup | undefined;
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly sort: {
    readonly field: string;
    readonly direction: 'ASC' | 'DESC';
  };
}

export interface WorkbenchRecordPage {
  readonly records: readonly WorkbenchRecord[];
  readonly totalCount: number;
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly sort: WorkbenchRecordQuery['sort'];
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function stringList(value: unknown, name: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${name} must be a string list`);
  }
  return Object.freeze([...(value as string[])]);
}

function booleanValue(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean`);
  return value;
}

function positiveInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function parseSort(value: unknown, name: string): WorkbenchRecordQuery['sort'] {
  const sort = record(value, name);
  const direction = text(sort.direction, `${name} direction`);
  if (!['ASC', 'DESC'].includes(direction)) {
    throw new Error(`${name} direction is unsupported`);
  }
  return Object.freeze({
    field: text(sort.field, `${name} field`),
    direction: direction as 'ASC' | 'DESC',
  });
}

function parseQueryCapabilities(value: unknown): WorkbenchQueryCapabilities {
  const capabilities = record(value, 'Workbench query capabilities');
  const textOperator = text(capabilities.textOperator, 'Workbench text operator');
  if (textOperator !== 'CONTAINS') {
    throw new Error('Workbench text operator is unsupported');
  }
  if (
    !Array.isArray(capabilities.allowedPageSizes) ||
    capabilities.allowedPageSizes.some(
      (size) => typeof size !== 'number' || !Number.isInteger(size) || size < 1,
    )
  ) {
    throw new Error('Workbench allowed page sizes must be positive integers');
  }
  const supportedOperators = [
    'EQUALS',
    'NOT_EQUALS',
    'CONTAINS',
    'STARTS_WITH',
    'GREATER_THAN',
    'GREATER_OR_EQUAL',
    'LESS_THAN',
    'LESS_OR_EQUAL',
    'BEFORE',
    'AFTER',
    'BETWEEN',
    'IN',
  ];
  if (!Array.isArray(capabilities.filterFields)) {
    throw new Error('Workbench filter fields must be a list');
  }
  const filterFields = capabilities.filterFields.map((value) => {
    const field = record(value, 'Workbench filter field');
    const operators = stringList(field.operators, 'Workbench filter field operators');
    if (operators.some((operator) => !supportedOperators.includes(operator))) {
      throw new Error('Workbench filter operator is unsupported');
    }
    return Object.freeze({
      field: text(field.field, 'Workbench filter field name'),
      label: text(field.label, 'Workbench filter field label'),
      type: text(field.type, 'Workbench filter field type'),
      operators: operators as readonly WorkbenchFilterOperator[],
      enum:
        field.enum === undefined
          ? undefined
          : stringList(field.enum, 'Workbench filter field enum'),
    });
  });
  const groupOperators = stringList(
    capabilities.groupOperators,
    'Workbench group operators',
  );
  if (
    groupOperators.length === 0 ||
    groupOperators.some((operator) => !['AND', 'OR'].includes(operator))
  ) {
    throw new Error('Workbench group operator is unsupported');
  }
  return Object.freeze({
    searchableFields: stringList(
      capabilities.searchableFields,
      'Workbench searchable fields',
    ),
    sortableFields: stringList(
      capabilities.sortableFields,
      'Workbench sortable fields',
    ),
    filterFields: Object.freeze(filterFields),
    groupOperators: Object.freeze(groupOperators as readonly ('AND' | 'OR')[]),
    textOperator: 'CONTAINS',
    allowedPageSizes: Object.freeze([...(capabilities.allowedPageSizes as number[])]),
    defaultPageSize: positiveInteger(
      capabilities.defaultPageSize,
      'Workbench default page size',
    ),
    maximumPageSize: positiveInteger(
      capabilities.maximumPageSize,
      'Workbench maximum page size',
    ),
    defaultSort: parseSort(capabilities.defaultSort, 'Workbench default sort'),
  });
}

function parseField(value: unknown): WorkbenchField {
  const field = record(value, 'Workbench field');
  const enumValues =
    field.enum === undefined
      ? undefined
      : stringList(field.enum, 'Workbench field enum');
  return Object.freeze({
    name: text(field.name, 'Workbench field name'),
    label: text(field.label, 'Workbench field label'),
    type: text(field.type, 'Workbench field type'),
    required: booleanValue(field.required, 'Workbench field required'),
    readOnly: booleanValue(field.readOnly, 'Workbench field readOnly'),
    primary: booleanValue(field.primary, 'Workbench field primary'),
    description: typeof field.description === 'string' ? field.description : '',
    enum: enumValues,
    default:
      ['string', 'number', 'boolean'].includes(typeof field.default) ||
      field.default === null
        ? (field.default as string | number | boolean | null)
        : undefined,
    searchable: booleanValue(field.searchable, 'Workbench field searchable'),
  });
}

function parseRelationship(value: unknown): WorkbenchRelationship {
  const relationship = record(value, 'Workbench relationship');
  const cardinality = text(
    relationship.cardinality,
    'Workbench relationship cardinality',
  );
  if (!['ONE', 'MANY'].includes(cardinality)) {
    throw new Error('Workbench relationship cardinality is unsupported');
  }
  const resolution = text(relationship.resolution, 'Workbench relationship resolution');
  if (resolution !== 'LOCAL_OR_REMOTE') {
    throw new Error('Workbench relationship resolution is unsupported');
  }
  const actions = stringList(relationship.actions, 'Workbench relationship actions');
  if (
    actions.some(
      (action) =>
        !['SELECT_EXISTING', 'CREATE_RELATED', 'EDIT_RELATED', 'UNLINK'].includes(
          action,
        ),
    )
  ) {
    throw new Error('Workbench relationship action is unsupported');
  }
  return Object.freeze({
    field: text(relationship.field, 'Workbench relationship field'),
    label: text(relationship.label, 'Workbench relationship label'),
    description:
      typeof relationship.description === 'string' ? relationship.description : '',
    targetModule: text(
      relationship.targetModule,
      'Workbench relationship target module',
    ),
    targetSchema: text(
      relationship.targetSchema,
      'Workbench relationship target schema',
    ),
    cardinality: cardinality as 'ONE' | 'MANY',
    referenceProperty: text(
      relationship.referenceProperty,
      'Workbench relationship reference property',
    ),
    resolution: 'LOCAL_OR_REMOTE',
    actions: Object.freeze(
      actions as readonly (
        | 'SELECT_EXISTING'
        | 'CREATE_RELATED'
        | 'EDIT_RELATED'
        | 'UNLINK'
      )[],
    ),
    required: booleanValue(relationship.required, 'Workbench relationship required'),
    relationshipType:
      typeof relationship.relationshipType === 'string'
        ? relationship.relationshipType
        : 'ASSOCIATION',
    ownership:
      typeof relationship.ownership === 'string' ? relationship.ownership : 'SOURCE',
    inverseField:
      typeof relationship.inverseField === 'string' ? relationship.inverseField : '',
    onTargetDelete:
      typeof relationship.onTargetDelete === 'string'
        ? relationship.onTargetDelete
        : 'NONE',
    maximumDepth:
      typeof relationship.maximumDepth === 'number'
        ? positiveInteger(relationship.maximumDepth, 'Workbench relationship depth')
        : 3,
    cycleHandling:
      typeof relationship.cycleHandling === 'string'
        ? relationship.cycleHandling
        : 'SELECT_EXISTING',
    deleteImpactAvailable:
      relationship.deleteImpactAvailable === undefined
        ? false
        : booleanValue(
            relationship.deleteImpactAvailable,
            'Workbench relationship delete impact',
          ),
  });
}

export function parseWorkbenchSchema(value: unknown): WorkbenchSchema {
  const schema = record(value, 'Workbench schema');
  const operations = stringList(schema.operations, 'Workbench operations');
  if (
    operations.some(
      (operation) =>
        !['search', 'read', 'create', 'update', 'delete'].includes(operation),
    )
  ) {
    throw new Error('Workbench operation is unsupported');
  }
  if (!Array.isArray(schema.fields) || !Array.isArray(schema.relationships)) {
    throw new Error('Workbench schema fields and relationships must be lists');
  }
  const mutationMode = text(schema.mutationMode, 'Workbench mutation mode');
  if (!['GENERATED_CRUD', 'DOMAIN_OPERATION'].includes(mutationMode)) {
    throw new Error('Workbench mutation mode is unsupported');
  }
  return Object.freeze({
    moduleName: text(schema.moduleName, 'Workbench module name'),
    schemaName: text(schema.schemaName, 'Workbench schema name'),
    label: text(schema.label, 'Workbench schema label'),
    description: typeof schema.description === 'string' ? schema.description : '',
    displayProperty: text(schema.displayProperty, 'Workbench display property'),
    displayProperties:
      schema.displayProperties === undefined
        ? Object.freeze([text(schema.displayProperty, 'Workbench display property')])
        : stringList(schema.displayProperties, 'Workbench display properties'),
    queryCapabilities: parseQueryCapabilities(schema.queryCapabilities),
    bulkCapabilities: (() => {
      const capabilities =
        schema.bulkCapabilities === undefined
          ? {
              operations: [],
              maximumItems: 100,
              idempotencyRequired: true,
              outcomeMode: 'AUTHORITATIVE_RESULT',
            }
          : record(schema.bulkCapabilities, 'Workbench bulk capabilities');
      const operations = stringList(
        capabilities.operations,
        'Workbench bulk operations',
      );
      if (operations.some((operation) => operation !== 'DELETE')) {
        throw new Error('Workbench bulk operation is unsupported');
      }
      return Object.freeze({
        operations: Object.freeze(operations as readonly 'DELETE'[]),
        maximumItems: positiveInteger(
          capabilities.maximumItems,
          'Workbench maximum bulk items',
        ),
        idempotencyRequired: booleanValue(
          capabilities.idempotencyRequired,
          'Workbench bulk idempotency',
        ),
        outcomeMode: text(capabilities.outcomeMode, 'Workbench bulk outcome mode'),
      });
    })(),
    concurrency: (() => {
      const concurrency =
        schema.concurrency === undefined
          ? { mode: 'NONE', field: '', required: false }
          : record(schema.concurrency, 'Workbench concurrency');
      const mode = text(concurrency.mode, 'Workbench concurrency mode');
      if (!['NONE', 'COMPARE_AND_SET'].includes(mode)) {
        throw new Error('Workbench concurrency mode is unsupported');
      }
      return Object.freeze({
        mode: mode as 'NONE' | 'COMPARE_AND_SET',
        field: typeof concurrency.field === 'string' ? concurrency.field : '',
        required: booleanValue(concurrency.required, 'Workbench concurrency required'),
      });
    })(),
    aggregateOperations: Object.freeze(
      (Array.isArray(schema.aggregateOperations) ? schema.aggregateOperations : []).map(
        (value) => {
          const operation = record(value, 'Workbench aggregate operation');
          return Object.freeze({
            name: text(operation.name, 'Workbench aggregate operation name'),
            label: text(operation.label, 'Workbench aggregate operation label'),
            purpose: text(operation.purpose, 'Workbench aggregate operation purpose'),
            consistency: text(
              operation.consistency,
              'Workbench aggregate operation consistency',
            ),
            confirmationRequired: booleanValue(
              operation.confirmationRequired,
              'Workbench aggregate confirmation',
            ),
          });
        },
      ),
    ),
    mutationMode: mutationMode as 'GENERATED_CRUD' | 'DOMAIN_OPERATION',
    operations: Object.freeze(operations as readonly WorkbenchOperation[]),
    fields: Object.freeze(schema.fields.map(parseField)),
    relationships: Object.freeze(schema.relationships.map(parseRelationship)),
  });
}

export function parseWorkbenchSchemaList(value: unknown): readonly WorkbenchSchema[] {
  const data = record(value, 'Workbench schema response');
  if (!Array.isArray(data.schemas)) {
    throw new Error('Workbench schemas must be a list');
  }
  return Object.freeze(data.schemas.map(parseWorkbenchSchema));
}

export function parseWorkbenchRecords(value: unknown): readonly WorkbenchRecord[] {
  const records: unknown[] = Array.isArray(value)
    ? (value as unknown[])
    : (() => {
        const data = record(value, 'Workbench record response');
        return Array.isArray(data.models) ? (data.models as unknown[]) : [];
      })();
  return Object.freeze(
    records.map((item) => Object.freeze({ ...record(item, 'Workbench record') })),
  );
}

export function parseWorkbenchRecordPage(value: unknown): WorkbenchRecordPage {
  const page = record(value, 'Workbench record page');
  if (!Array.isArray(page.records)) {
    throw new Error('Workbench page records must be a list');
  }
  const totalCount = page.totalCount;
  if (
    typeof totalCount !== 'number' ||
    !Number.isInteger(totalCount) ||
    totalCount < 0
  ) {
    throw new Error('Workbench total count must be a non-negative integer');
  }
  return Object.freeze({
    records: parseWorkbenchRecords(page.records),
    totalCount,
    pageNumber: positiveInteger(page.pageNumber, 'Workbench page number'),
    pageSize: positiveInteger(page.pageSize, 'Workbench page size'),
    sort: parseSort(page.sort, 'Workbench page sort'),
  });
}

export function parseWorkbenchDeleteImpact(value: unknown): WorkbenchDeleteImpact {
  const impact = record(value, 'Workbench delete impact');
  if (!Array.isArray(impact.relationships)) {
    throw new Error('Workbench delete impact relationships must be a list');
  }
  const nonNegativeInteger = (candidate: unknown, name: string) => {
    if (
      typeof candidate !== 'number' ||
      !Number.isInteger(candidate) ||
      candidate < 0
    ) {
      throw new Error(`${name} must be a non-negative integer`);
    }
    return candidate;
  };
  return Object.freeze({
    targetCount: nonNegativeInteger(
      impact.targetCount,
      'Workbench delete target count',
    ),
    blocked: booleanValue(impact.blocked, 'Workbench delete blocked'),
    relationships: Object.freeze(
      impact.relationships.map((value) => {
        const relationship = record(value, 'Workbench delete relationship');
        return Object.freeze({
          sourceModule: text(
            relationship.sourceModule,
            'Workbench delete source module',
          ),
          sourceSchema: text(
            relationship.sourceSchema,
            'Workbench delete source schema',
          ),
          field: text(relationship.field, 'Workbench delete source field'),
          policy: text(relationship.policy, 'Workbench delete policy'),
          referenceCount: nonNegativeInteger(
            relationship.referenceCount,
            'Workbench delete reference count',
          ),
        });
      }),
    ),
  });
}
