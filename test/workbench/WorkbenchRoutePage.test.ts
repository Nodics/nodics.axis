import { describe, expect, it } from 'vitest';

import {
  combineWorkbenchFilterGroups,
  lifecycleActionsForRecord,
  resolveWorkbenchDefaultColumns,
  resolveWorkbenchRecordSort,
  resolveWorkbenchDeepLinkTarget,
  resolveWorkbenchLookupPageSize,
  resolveWorkbenchRouteTarget,
  workbenchPresentationExcludedColumns,
  workbenchPresentationForbiddenFields,
  relatedRecordPanelFilter,
  schemaWithValidQueryCapabilities,
  selectWorkbenchReferencedRecord,
  workbenchPresentationForSchema,
  workbenchQuickFilterGroup,
  workbenchFixedFilterGroup,
  workbenchReferenceLookupQuery,
  type WorkbenchDeepLinkTarget,
} from '../../src/workbench/workbenchRouteModel';
import { routePreferredServer } from '../../src/workbench/WorkbenchRoutePage';
import type { WorkbenchSchema } from '../../src/workbench/api/workbenchContracts';

function schema(
  moduleName: string,
  schemaName: string,
  operations: WorkbenchSchema['operations'],
): WorkbenchSchema {
  return {
    moduleName,
    schemaName,
    label: schemaName,
    description: '',
    displayProperty: 'code',
    displayProperties: ['code'],
    queryCapabilities: {
      searchableFields: ['code'],
      sortableFields: ['code'],
      filterFields: [],
      groupOperators: ['AND'],
      textOperator: 'CONTAINS',
      allowedPageSizes: [10],
      defaultPageSize: 10,
      maximumPageSize: 10,
      defaultSort: { field: 'code', direction: 'ASC' },
    },
    mutationMode: 'GENERATED_CRUD',
    operations,
    fields: [
      {
        name: 'code',
        label: 'Code',
        type: 'string',
        required: true,
        readOnly: false,
        primary: true,
        description: '',
        searchable: true,
      },
    ],
    relationships: [],
  };
}

function summarize(target: WorkbenchDeepLinkTarget | undefined) {
  if (!target) return undefined;
  return {
    key: target.key,
    mode: target.mode,
    moduleName: target.schema.moduleName,
    schemaName: target.schema.schemaName,
    connectionServer: target.schema.connectionServer,
  };
}

describe('resolveWorkbenchDeepLinkTarget', () => {
  it('selects the requested schema from URL parameters', () => {
    expect(
      summarize(
        resolveWorkbenchDeepLinkTarget('?module=media&schema=mediaFolder', [
          schema('media', 'mediaFolder', ['search', 'read']),
        ]),
      ),
    ).toEqual({
      key: 'media:mediaFolder:browse',
      mode: undefined,
      moduleName: 'media',
      schemaName: 'mediaFolder',
      connectionServer: undefined,
    });
  });

  it('opens create mode only when the discovered schema allows create', () => {
    expect(
      summarize(
        resolveWorkbenchDeepLinkTarget('?module=media&schema=mediaFolder&mode=create', [
          schema('media', 'mediaFolder', ['search', 'read', 'create']),
        ]),
      ),
    ).toEqual({
      key: 'media:mediaFolder:create',
      mode: 'create',
      moduleName: 'media',
      schemaName: 'mediaFolder',
      connectionServer: undefined,
    });

    expect(
      summarize(
        resolveWorkbenchDeepLinkTarget('?module=media&schema=mediaFolder&mode=create', [
          schema('media', 'mediaFolder', ['search', 'read']),
        ]),
      ),
    ).toEqual({
      key: 'media:mediaFolder:browse',
      mode: undefined,
      moduleName: 'media',
      schemaName: 'mediaFolder',
      connectionServer: undefined,
    });
  });

  it('ignores unresolved or incomplete deep links', () => {
    expect(
      resolveWorkbenchDeepLinkTarget('?module=media&schema=unknown', [
        schema('media', 'mediaFolder', ['search', 'read']),
      ]),
    ).toBeUndefined();
    expect(
      resolveWorkbenchDeepLinkTarget('?module=media', [
        schema('media', 'mediaFolder', ['search', 'read']),
      ]),
    ).toBeUndefined();
  });
});

describe('resolveWorkbenchRouteTarget', () => {
  it('keeps catalog routes on Staged and order lifecycle routes on Online Commerce', () => {
    const ownerConnection = { server: 'commerceServer', environment: 'kickoffLocal' } as never;

    expect(
      routePreferredServer(
        {
          id: 'products',
          label: 'Products',
          route: '/commerce/catalog/products',
          group: { id: 'products-merchandising', label: 'Products', order: 1 },
        } as never,
        ownerConnection,
      ),
    ).toBe('commerceStagedServer');
    expect(
      routePreferredServer(
        {
          id: 'order-cancellations',
          label: 'Cancellations',
          route: '/commerce/checkout/cancellations',
          group: {
            id: 'order-lifecycle-operations',
            label: 'Order lifecycle',
            order: 1,
          },
        } as never,
        ownerConnection,
      ),
    ).toBe('commerceServer');
  });

  it('selects a schema from governed functional navigation route mapping', () => {
    expect(
      summarize(
        resolveWorkbenchRouteTarget(
          { moduleName: 'cms', schemaName: 'cmsNavigationNode' },
          [schema('cms', 'cmsNavigationNode', ['search', 'read', 'create'])],
        ),
      ),
    ).toEqual({
      key: 'cms:cmsNavigationNode:browse:route:default',
      mode: undefined,
      moduleName: 'cms',
      schemaName: 'cmsNavigationNode',
      connectionServer: undefined,
    });
  });

  it('prefers the route owner runtime when duplicate technical schemas exist', () => {
    const platformCatalog = {
      ...schema('catalog', 'catalog', ['search', 'read']),
      connectionServer: 'platformServer',
      connectionEnvironment: 'kickoffLocal',
    };
    const wcmsCatalog = {
      ...schema('catalog', 'catalog', ['search', 'read']),
      connectionServer: 'wcmsServer',
      connectionEnvironment: 'kickoffLocal',
    };

    expect(
      summarize(
        resolveWorkbenchRouteTarget(
          { moduleName: 'catalog', schemaName: 'catalog' },
          [platformCatalog, wcmsCatalog],
          { environment: 'kickoffLocal', server: 'wcmsServer' },
        ),
      ),
    ).toEqual({
      key: 'catalog:catalog:browse:route:default',
      mode: undefined,
      moduleName: 'catalog',
      schemaName: 'catalog',
      connectionServer: 'wcmsServer',
    });
  });

  it('prefers the Staged runtime when the route owner preference does not match a duplicate schema', () => {
    const stagedRequest = {
      ...schema('publish', 'publicationRequest', ['search', 'read']),
      connectionServer: 'wcmsStagedServer',
      connectionEnvironment: 'kickoffLocal',
    };
    const engagementRequest = {
      ...schema('publish', 'publicationRequest', ['search', 'read']),
      connectionServer: 'engagementServer',
      connectionEnvironment: 'kickoffLocal',
    };

    expect(
      summarize(
        resolveWorkbenchRouteTarget(
          { moduleName: 'publish', schemaName: 'publicationRequest' },
          [engagementRequest, stagedRequest],
          { environment: 'kickoffLocal', server: 'platformServer' },
        ),
      ),
    ).toEqual({
      key: 'publish:publicationRequest:browse:route:default',
      mode: undefined,
      moduleName: 'publish',
      schemaName: 'publicationRequest',
      connectionServer: 'wcmsStagedServer',
    });
  });

  it('does not open create mode unless the backend schema advertises create', () => {
    expect(
      summarize(
        resolveWorkbenchRouteTarget(
          { moduleName: 'cms', schemaName: 'cmsRestriction', mode: 'create' },
          [schema('cms', 'cmsRestriction', ['search', 'read'])],
        ),
      ),
    ).toEqual({
      key: 'cms:cmsRestriction:browse:route:default',
      mode: undefined,
      moduleName: 'cms',
      schemaName: 'cmsRestriction',
      connectionServer: undefined,
    });
  });

  it('resolves a backend-driven KYC workspace without a frontend schema catalogue', () => {
    expect(
      summarize(
        resolveWorkbenchRouteTarget(
          { moduleName: 'kycSchema', schemaName: 'kycVerificationCase' },
          [schema('kycSchema', 'kycVerificationCase', ['search', 'read'])],
        ),
      ),
    ).toEqual({
      key: 'kycSchema:kycVerificationCase:browse:route:default',
      mode: undefined,
      moduleName: 'kycSchema',
      schemaName: 'kycVerificationCase',
      connectionServer: undefined,
    });
  });
});

describe('workbench presentation helpers', () => {
  it('uses backend presentation columns only when they belong to the selected schema', () => {
    const checkoutRun = {
      ...schema('order', 'checkoutReverseRun', ['search', 'read']),
      fields: [
        ...schema('order', 'checkoutReverseRun', ['search', 'read']).fields,
        {
          name: 'state',
          label: 'State',
          type: 'string',
          required: false,
          readOnly: false,
          primary: false,
          description: '',
          searchable: true,
        },
        {
          name: 'recoveryStrategy',
          label: 'Recovery Strategy',
          type: 'string',
          required: false,
          readOnly: false,
          primary: false,
          description: '',
          searchable: true,
        },
      ],
    } satisfies WorkbenchSchema;
    const presentation = workbenchPresentationForSchema(
      {
        id: 'checkout-reverse-runs',
        label: 'Checkout reverse runs',
        route: '/commerce-operations/checkout-reverse-runs',
        order: 1,
        moduleName: 'order',
        category: 'commerce',
        icon: 'workflow',
        availability: 'UP',
        workbenchTarget: {
          moduleName: 'order',
          schemaName: 'checkoutReverseRun',
        },
        workbenchPresentation: {
          defaultColumns: ['code', 'state', 'missingField', 'recoveryStrategy'],
          hiddenFields: ['recoveryStrategy'],
          forbiddenFields: ['state'],
        },
      },
      checkoutRun,
    );

    expect(resolveWorkbenchDefaultColumns(checkoutRun, presentation)).toEqual(['code']);
    expect(workbenchPresentationExcludedColumns(presentation)).toEqual([
      'recoveryStrategy',
      'state',
    ]);
    expect(workbenchPresentationForbiddenFields(presentation)).toEqual(['state']);
    expect(
      workbenchPresentationForSchema(
        {
          id: 'orders',
          label: 'Orders',
          route: '/commerce-operations/orders',
          order: 1,
          moduleName: 'order',
          category: 'commerce',
          icon: 'order',
          availability: 'UP',
          workbenchTarget: { moduleName: 'order', schemaName: 'order' },
          workbenchPresentation: { defaultColumns: ['code', 'state'] },
        },
        checkoutRun,
      ),
    ).toBeUndefined();
  });

  it('maps backend quick filters to normal workbench filter groups', () => {
    const checkoutRun = {
      ...schema('order', 'checkoutReverseRun', ['search', 'read']),
      queryCapabilities: {
        ...schema('order', 'checkoutReverseRun', ['search', 'read']).queryCapabilities,
        filterFields: [
          {
            field: 'state',
            label: 'State',
            type: 'string',
            operators: ['EQUALS', 'IN'],
          },
        ],
      },
    } satisfies WorkbenchSchema;

    expect(
      workbenchQuickFilterGroup(checkoutRun, {
        id: 'active',
        label: 'Active recovery',
        field: 'state',
        values: ['OPEN', 'RETRYING'],
        order: 0,
      }),
    ).toEqual({
      operator: 'AND',
      items: [
        {
          field: 'state',
          operator: 'IN',
          value: ['OPEN', 'RETRYING'],
        },
      ],
    });
  });

  it('keeps backend fixed filters active and exposes lifecycle actions only in declared states', () => {
    const lifecycleSchema = {
      ...schema('order', 'orderLifecycleRequest', ['search', 'read']),
      queryCapabilities: {
        ...schema('order', 'orderLifecycleRequest', ['search', 'read'])
          .queryCapabilities,
        filterFields: [
          {
            field: 'requestType',
            label: 'Type',
            type: 'string',
            operators: ['EQUALS'],
          },
          { field: 'state', label: 'State', type: 'string', operators: ['EQUALS'] },
        ],
      },
    } satisfies WorkbenchSchema;
    const fixed = workbenchFixedFilterGroup(lifecycleSchema, {
      fixedFilters: [
        {
          id: 'return-only',
          label: 'Returns',
          field: 'requestType',
          value: 'RETURN',
          order: 0,
        },
      ],
    });
    const selected = workbenchQuickFilterGroup(lifecycleSchema, {
      id: 'pending',
      label: 'Pending',
      field: 'state',
      value: 'AUTHORIZATION_PENDING',
      order: 0,
    });
    expect(combineWorkbenchFilterGroups(fixed, selected)).toEqual({
      operator: 'AND',
      items: [fixed, selected],
    });
    const actions = [
      {
        id: 'authorize',
        label: 'Authorize',
        intent: 'APPROVE' as const,
        targetStatuses: ['AUTHORIZATION_PENDING'],
        order: 0,
      },
      {
        id: 'receive',
        label: 'Receive',
        intent: 'UPDATE' as const,
        targetStatuses: ['AUTHORIZED'],
        order: 1,
      },
    ];
    expect(
      lifecycleActionsForRecord(actions, { state: 'AUTHORIZATION_PENDING' }).map(
        (action) => action.id,
      ),
    ).toEqual(['authorize']);
  });
});

describe('resolveWorkbenchRecordSort', () => {
  it('uses a real sortable schema field when default sort points to a missing field', () => {
    const employee = {
      ...schema('profile', 'employee', ['search', 'read']),
      displayProperty: 'employeeId',
      displayProperties: ['employeeId'],
      queryCapabilities: {
        ...schema('profile', 'employee', ['search', 'read']).queryCapabilities,
        sortableFields: ['code', 'employeeId'],
        defaultSort: { field: 'code', direction: 'ASC' as const },
      },
      fields: [
        {
          name: 'employeeId',
          label: 'Employee Id',
          type: 'string' as const,
          required: true,
          readOnly: false,
          primary: true,
          description: '',
          searchable: true,
        },
      ],
    } satisfies WorkbenchSchema;

    expect(resolveWorkbenchRecordSort(employee, undefined)).toEqual({
      field: 'employeeId',
      direction: 'ASC',
    });
    expect(schemaWithValidQueryCapabilities(employee).queryCapabilities).toMatchObject({
      sortableFields: ['employeeId'],
      defaultSort: { field: 'employeeId', direction: 'ASC' },
    });
  });
});

describe('resolveWorkbenchLookupPageSize', () => {
  it('uses the smallest backend-advertised page size for reference lookups', () => {
    expect(
      resolveWorkbenchLookupPageSize(schema('workflow', 'workflowChannel', ['search'])),
    ).toBe(10);
  });

  it('falls back to the default page size when no allow-list is advertised', () => {
    const fallbackSchema = {
      ...schema('workflow', 'workflowChannel', ['search']),
      queryCapabilities: {
        ...schema('workflow', 'workflowChannel', ['search']).queryCapabilities,
        allowedPageSizes: [],
        defaultPageSize: 25,
      },
    };
    expect(resolveWorkbenchLookupPageSize(fallbackSchema)).toBe(25);
  });
});

describe('workbenchReferenceLookupQuery', () => {
  it('uses backend filter capabilities when the reference field supports equality', () => {
    const targetSchema = {
      ...schema('profile', 'tenant', ['search', 'read']),
      queryCapabilities: {
        ...schema('profile', 'tenant', ['search', 'read']).queryCapabilities,
        filterFields: [
          {
            field: 'code',
            label: 'Code',
            type: 'string',
            operators: ['EQUALS'],
          },
        ],
      },
    } satisfies WorkbenchSchema;

    expect(
      workbenchReferenceLookupQuery(
        targetSchema,
        {
          field: 'tenant',
          label: 'Tenant',
          description: '',
          targetModule: 'profile',
          targetSchema: 'tenant',
          cardinality: 'ONE',
          referenceProperty: 'code',
          resolution: 'LOCAL_OR_REMOTE',
          actions: ['SELECT_EXISTING'],
          required: true,
        },
        'default',
      ),
    ).toMatchObject({
      search: '',
      filters: {
        operator: 'AND',
        items: [{ field: 'code', operator: 'EQUALS', value: 'default' }],
      },
      pageNumber: 1,
      pageSize: 10,
    });
  });

  it('falls back to text search when the reference field is not a backend filter', () => {
    const query = workbenchReferenceLookupQuery(
      schema('profile', 'tenant', ['search', 'read']),
      {
        field: 'tenant',
        label: 'Tenant',
        description: '',
        targetModule: 'profile',
        targetSchema: 'tenant',
        cardinality: 'ONE',
        referenceProperty: 'code',
        resolution: 'LOCAL_OR_REMOTE',
        actions: ['SELECT_EXISTING'],
        required: true,
      },
      'default',
    );

    expect(query).toMatchObject({
      search: 'default',
      pageNumber: 1,
      pageSize: 10,
    });
    expect(query.filters).toBeUndefined();
  });
});

describe('selectWorkbenchReferencedRecord', () => {
  it('selects the exact referenced record from text-search results', () => {
    expect(
      selectWorkbenchReferencedRecord(
        [{ code: 'default-copy' }, { code: 'default' }],
        'code',
        'default',
      ),
    ).toEqual({ code: 'default' });
  });

  it('uses the only returned record when no exact reference field is projected', () => {
    expect(
      selectWorkbenchReferencedRecord([{ name: 'Default tenant' }], 'code', 'default'),
    ).toEqual({ name: 'Default tenant' });
  });
});

describe('relatedRecordPanelFilter', () => {
  it('maps backend-declared source and target fields into a generic query filter', () => {
    expect(
      relatedRecordPanelFilter(
        { itemCode: 'sku-1000' },
        {
          id: 'product-media',
          label: 'Product media',
          order: 0,
          target: { moduleName: 'product', schemaName: 'productMedia' },
          relation: {
            sourceField: 'itemCode',
            targetField: 'itemCode',
            cardinality: 'MANY',
          },
        },
      ),
    ).toEqual({
      operator: 'AND',
      items: [
        {
          field: 'itemCode',
          operator: 'EQUALS',
          value: 'sku-1000',
        },
      ],
    });
  });
});
