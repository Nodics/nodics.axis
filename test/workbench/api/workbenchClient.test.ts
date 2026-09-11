import { describe, expect, it, vi } from 'vitest';

import {
  bulkDeleteWorkbenchRecords,
  createWorkbenchRecord,
  deleteWorkbenchRecord,
  executeWorkbenchLifecycleAction,
  loadGeneratedSchemaCapabilities,
  loadWorkbenchRecords,
  loadWorkbenchSchemas,
  previewWorkbenchDeleteImpact,
  updateWorkbenchRecord,
} from '../../../src/workbench/api/workbenchClient';
import type { AxisModuleConnection } from '../../../src/bootstrap/publicBootstrap';
import {
  parseWorkbenchSchema,
  isWorkbenchAuthoringSchema,
  type WorkbenchSchema,
} from '../../../src/workbench/api/workbenchContracts';

const connection: AxisModuleConnection = {
  moduleName: 'profile',
  instanceId: 'profile-1',
  endpoint: 'https://profile.example.com/nodics/profile',
  environment: 'local',
  server: 'platformServer',
  state: 'UP',
};
const configuration = {
  accessToken: 'memory-only-token',
  enterpriseCode: 'default',
  timeoutMs: 10_000,
};
const address: WorkbenchSchema = {
  moduleName: 'profile',
  schemaName: 'address',
  label: 'Address',
  description: '',
  displayProperty: 'code',
  displayProperties: ['code'],
  queryCapabilities: {
    searchableFields: ['code'],
    sortableFields: ['code'],
    filterFields: [
      {
        field: 'code',
        label: 'Code',
        type: 'string',
        operators: ['EQUALS', 'CONTAINS'],
      },
    ],
    groupOperators: ['AND', 'OR'],
    textOperator: 'CONTAINS',
    allowedPageSizes: [10, 25, 50],
    defaultPageSize: 25,
    maximumPageSize: 50,
    defaultSort: { field: 'code', direction: 'ASC' },
  },
  mutationMode: 'GENERATED_CRUD',
  operations: ['search', 'read', 'create', 'update', 'delete'],
  bulkCapabilities: {
    operations: ['DELETE'],
    maximumItems: 100,
    idempotencyRequired: true,
    outcomeMode: 'AUTHORITATIVE_RESULT',
  },
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

function json(result: unknown, status = 200): Response {
  return new Response(JSON.stringify({ result }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Schema Workbench API client', () => {
  it('uses the declared owning create command and retains its key on retry without generic fallback', async () => {
    const schema: WorkbenchSchema = {
      ...address,
      aggregateOperations: [
        {
          name: 'setup',
          label: 'Set up',
          purpose: 'CREATE',
          consistency: 'MODULE_OWNED',
          confirmationRequired: true,
        },
      ],
      form: {
        contractVersion: 1,
        sections: [],
        hiddenFields: [],
        managedCreateFields: [],
        defaultColumns: [],
        copy: {},
        createOperation: 'setup',
      },
    };
    const model = { code: 'SETUP-TEST' };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: 'Setup interrupted' }, 503))
      .mockResolvedValueOnce(json(model));
    await expect(
      createWorkbenchRecord(connection, schema, model, configuration, fetcher),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(
      createWorkbenchRecord(connection, schema, model, configuration, fetcher),
    ).resolves.toEqual(model);
    const first = fetcher.mock.calls[0]!;
    const second = fetcher.mock.calls[1]!;
    expect((first[0] as URL).pathname).toBe(
      '/nodics/profile/v0/schema/workbench/address/aggregate',
    );
    expect(parseRequestBody(first[1]?.body)).toEqual({
      operation: 'setup',
      payload: { model },
    });
    expect(new Headers(first[1]?.headers).get('Idempotency-Key')).toBeTruthy();
    expect(new Headers(first[1]?.headers).get('Idempotency-Key')).toBe(
      new Headers(second[1]?.headers).get('Idempotency-Key'),
    );
  });

  it('validates authoring metadata and never infers publication from runtime names', () => {
    const operational = { ...address, connectionServer: 'stagedServer' };
    expect(isWorkbenchAuthoringSchema(operational)).toBe(true);
    for (const stage of ['ONLINE', 'OPERATIONAL', 'UNASSIGNED']) {
      const schema = parseWorkbenchSchema({
        ...address,
        mutationMode: 'READ_ONLY',
        operations: ['search', 'read'],
        authoring: { stage, publishRequired: true, authoringAllowed: false },
      });
      expect(isWorkbenchAuthoringSchema(schema)).toBe(false);
    }
    const staged = parseWorkbenchSchema({
      ...address,
      authoring: { stage: 'STAGED', publishRequired: true, authoringAllowed: true },
    });
    expect(isWorkbenchAuthoringSchema(staged)).toBe(true);
    expect(() =>
      parseWorkbenchSchema({
        ...address,
        authoring: { stage: 'ONLINE', publishRequired: true, authoringAllowed: true },
      }),
    ).toThrow(/inconsistent/);
    expect(() =>
      parseWorkbenchSchema({
        ...address,
        authoring: { stage: 'UNKNOWN', publishRequired: true, authoringAllowed: false },
      }),
    ).toThrow(/unsupported/);
    expect(
      isWorkbenchAuthoringSchema(
        parseWorkbenchSchema({ ...address, mutationPolicy: { publishRequired: true } }),
      ),
    ).toBe(false);
  });

  it('keeps managed counters out of business payloads and uses the saved token for the next edit', async () => {
    const schema: WorkbenchSchema = {
      ...address,
      concurrency: {
        mode: 'COMPARE_AND_SET',
        field: 'revision',
        required: true,
        managed: true,
      },
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({ models: [{ code: 'DXB', revision: 8, name: 'First' }] }),
      )
      .mockResolvedValueOnce(
        json({ models: [{ code: 'DXB', revision: 9, name: 'Second' }] }),
      );
    const first = await updateWorkbenchRecord(
      connection,
      schema,
      { code: 'DXB', revision: 7 },
      { name: 'First', revision: 100 },
      configuration,
      request,
    );
    await updateWorkbenchRecord(
      connection,
      schema,
      first,
      { name: 'Second' },
      configuration,
      request,
    );
    expect(parseRequestBody(request.mock.calls[0]?.[1]?.body)).toMatchObject({
      query: { code: 'DXB', revision: 7 },
      model: { name: 'First' },
    });
    expect(parseRequestBody(request.mock.calls[0]?.[1]?.body).model).not.toHaveProperty(
      'revision',
    );
    expect(parseRequestBody(request.mock.calls[1]?.[1]?.body).query).toMatchObject({
      revision: 8,
    });
  });

  it('uses the managed legacy absence token without requiring a revision input', async () => {
    const schema: WorkbenchSchema = {
      ...address,
      concurrency: {
        mode: 'COMPARE_AND_SET',
        field: 'revision',
        required: true,
        managed: true,
      },
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ models: [{ code: 'DXB', revision: 1 }] }));
    await updateWorkbenchRecord(
      connection,
      schema,
      { code: 'DXB' },
      { name: 'Updated' },
      configuration,
      request,
    );
    expect(parseRequestBody(request.mock.calls[0]?.[1]?.body).query).toMatchObject({
      revision: 0,
    });
    expect(parseWorkbenchSchema(schema).concurrency?.managed).toBe(true);
  });
  it('parses backend-driven field components, schema origin, and mutation policy', () => {
    expect(
      parseWorkbenchSchema({
        ...address,
        origin: {
          source: 'PROJECT',
          moduleName: 'profile',
          layer: 'custom',
          status: 'OVERRIDDEN',
        },
        hierarchy: [
          {
            source: 'FRAMEWORK',
            moduleName: 'profile',
            schemaName: 'address',
            layer: 'framework',
            status: 'BASE',
          },
        ],
        mutationPolicy: {
          mode: 'GENERATED_CRUD',
          savePath: 'GENERATED_CRUD',
          lifecycle: 'DIRECT',
          createStrategy: 'TOP_LEVEL_WITH_REFERENCES',
          updateStrategy: 'DIRECT_OR_REFERENCED',
          deleteStrategy: 'TOP_LEVEL_ONLY',
          aggregateSave: true,
          publishRequired: false,
        },
        fields: [
          {
            ...address.fields[0]!,
            component: 'select',
            enum: ['UNVERIFIED', 'VERIFIED'],
            enumOptions: [
              {
                value: 'UNVERIFIED',
                label: 'Unverified',
                description: '',
                disabled: false,
              },
              {
                value: 'VERIFIED',
                label: 'Verified',
                description: '',
                disabled: false,
              },
            ],
            fixedValue: 'UNVERIFIED',
            validation: { minLength: 3 },
            origin: {
              source: 'PROJECT',
              moduleName: 'profile',
              layer: 'custom',
              status: 'ADDED',
            },
          },
          {
            name: 'tenant',
            label: 'Tenant',
            type: 'object',
            required: true,
            readOnly: false,
            primary: false,
            description: '',
            searchable: false,
            reference: {
              field: 'tenant',
              label: 'Tenant',
              description: '',
              targetModule: 'profile',
              targetSchema: 'tenant',
              cardinality: 'ONE',
              referenceProperty: 'code',
              component: 'referenceSelector',
              resolution: 'LOCAL_OR_REMOTE',
              actions: ['SELECT_EXISTING'],
              required: true,
            },
          },
        ],
        relationships: [
          {
            field: 'tenant',
            label: 'Tenant',
            description: '',
            targetModule: 'profile',
            targetSchema: 'tenant',
            cardinality: 'ONE',
            referenceProperty: 'code',
            component: 'referenceSelector',
            resolution: 'LOCAL_OR_REMOTE',
            actions: ['SELECT_EXISTING'],
            required: true,
          },
        ],
      }),
    ).toEqual(
      partial({
        origin: partial({ source: 'PROJECT' }),
        mutationPolicy: partial({
          deleteStrategy: 'TOP_LEVEL_ONLY',
          aggregateSave: true,
        }),
        fields: [
          partial({
            component: 'select',
            enumOptions: [
              partial({ label: 'Unverified' }),
              partial({ label: 'Verified' }),
            ],
            fixedValue: 'UNVERIFIED',
            validation: partial({ minLength: 3 }),
            origin: partial({ status: 'ADDED' }),
          }),
          partial({
            reference: partial({
              targetModule: 'profile',
              targetSchema: 'tenant',
              referenceProperty: 'code',
            }),
          }),
        ],
        relationships: [
          partial({
            component: 'referenceSelector',
          }),
        ],
      }),
    );
  });

  it('discovers schemas directly from owning modules with employee context', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(json({ moduleName: 'profile', schemas: [address] })),
      );

    await expect(
      loadWorkbenchSchemas([connection], configuration, request),
    ).resolves.toEqual([
      partial({
        label: 'Address',
        moduleName: 'profile',
        connectionModuleName: 'profile',
        connectionInstanceId: 'profile-1',
        connectionServer: 'platformServer',
        connectionEnvironment: 'local',
      }),
    ]);

    const firstRequestCall = request.mock.calls[0];
    expect(firstRequestCall).toBeDefined();
    const [url, options] = firstRequestCall as [URL, RequestInit?];
    expect(url.href).toBe(
      'https://profile.example.com/nodics/profile/v0/schema/workbench',
    );
    const headers = new Headers(options?.headers);
    expect(headers.get('Authorization')).toBe('Bearer memory-only-token');
    expect(headers.get('x-enterprise-code')).toBe('default');
    expect(url.href).not.toContain('memory-only-token');
  });

  it('keeps runtime-specific schema discovery for the same business schema', async () => {
    const duplicateConnection: AxisModuleConnection = {
      ...connection,
      instanceId: 'profile-duplicate',
      server: 'profileMirrorServer',
      endpoint: 'https://profile-mirror.example.com/nodics/profile',
    };
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(json({ moduleName: 'profile', schemas: [address] })),
      );

    await expect(
      loadWorkbenchSchemas([connection, duplicateConnection], configuration, request),
    ).resolves.toEqual([
      partial({
        label: 'Address',
        moduleName: 'profile',
        schemaName: 'address',
        connectionServer: 'platformServer',
        connectionEnvironment: 'local',
      }),
      partial({
        label: 'Address',
        moduleName: 'profile',
        schemaName: 'address',
        connectionServer: 'profileMirrorServer',
        connectionEnvironment: 'local',
      }),
    ]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('keeps Online and Staged schema copies available for route-level preference', async () => {
    const stagedConnection: AxisModuleConnection = {
      ...connection,
      instanceId: 'profile-staged',
      server: 'commerceStagedServer',
      endpoint: 'https://commerce-staged.example.com/nodics/profile',
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ moduleName: 'profile', schemas: [address] }))
      .mockResolvedValueOnce(json({ moduleName: 'profile', schemas: [address] }));

    await expect(
      loadWorkbenchSchemas([connection, stagedConnection], configuration, request),
    ).resolves.toEqual([
      partial({
        moduleName: 'profile',
        schemaName: 'address',
        connectionServer: 'platformServer',
        connectionEnvironment: 'local',
      }),
      partial({
        moduleName: 'profile',
        schemaName: 'address',
        connectionServer: 'commerceStagedServer',
        connectionEnvironment: 'local',
      }),
    ]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('loads a bounded record page through existing generated CRUD', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        records: [{ code: 'DXB-OFFICE', city: 'Dubai' }],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 25,
        sort: { field: 'code', direction: 'ASC' },
      }),
    );
    const schemas = await loadWorkbenchSchemas(
      [connection],
      configuration,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(json({ moduleName: 'profile', schemas: [address] })),
    );

    await expect(
      loadWorkbenchRecords(
        connection,
        schemas[0]!,
        configuration,
        {
          search: '',
          filters: {
            operator: 'AND',
            items: [{ field: 'code', operator: 'CONTAINS', value: 'DXB' }],
          },
          pageNumber: 1,
          pageSize: 25,
          sort: { field: 'code', direction: 'ASC' },
        },
        request,
      ),
    ).resolves.toEqual({
      records: [{ code: 'DXB-OFFICE', city: 'Dubai' }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 25,
      sort: { field: 'code', direction: 'ASC' },
    });

    const [url, options] = request.mock.calls[0] ?? [];
    expect((url as URL).pathname).toBe('/nodics/profile/v0/address/safe-search');
    expect(options?.method).toBe('POST');
    const body = options?.body;
    if (typeof body !== 'string') throw new Error('Expected a JSON request body');
    expect(JSON.parse(body)).toEqual({
      query: {
        search: '',
        filters: {
          operator: 'AND',
          items: [{ field: 'code', operator: 'CONTAINS', value: 'DXB' }],
        },
        pageNumber: 1,
        pageSize: 25,
        sort: { field: 'code', direction: 'ASC' },
      },
    });
  });

  it('loads schema capabilities through the generated schema utility route', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(json(address));

    const capabilities = await loadGeneratedSchemaCapabilities(
      connection,
      { schemaName: 'address' },
      configuration,
      request,
    );
    expect(capabilities).toMatchObject({
      schemaName: 'address',
      moduleName: 'profile',
      connectionModuleName: 'profile',
      connectionInstanceId: 'profile-1',
    });
    expect(capabilities.queryCapabilities.searchableFields).toEqual(['code']);

    const firstRequestCall = request.mock.calls[0];
    expect(firstRequestCall).toBeDefined();
    const [url, options] = firstRequestCall as [URL, RequestInit?];
    expect(url.pathname).toBe('/nodics/profile/v0/address/capabilities');
    expect(options?.method).toBeUndefined();
    expect(url.pathname).not.toContain('/schema/workbench');
  });

  it('creates through generated CRUD without changing module ownership', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ code: 'DXB-EMAIL', type: 'EMAIL' }));
    const schemas = await loadWorkbenchSchemas(
      [connection],
      configuration,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(json({ moduleName: 'profile', schemas: [address] })),
    );

    await expect(
      createWorkbenchRecord(
        connection,
        schemas[0]!,
        { code: 'DXB-EMAIL', type: 'EMAIL' },
        configuration,
        request,
      ),
    ).resolves.toEqual({ code: 'DXB-EMAIL', type: 'EMAIL' });

    const [url, options] = request.mock.calls[0] ?? [];
    expect((url as URL).pathname).toBe('/nodics/profile/v0/address');
    expect(options?.method).toBe('PUT');
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      'Bearer memory-only-token',
    );
  });

  it('falls back to the generic Workbench create contract when generated save is unavailable', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: 'not found' }, 404))
      .mockResolvedValueOnce(json({ code: 'STYLE-PASS', type: 'COUPON_CODE' }));

    await expect(
      createWorkbenchRecord(
        connection,
        address,
        { code: 'STYLE-PASS', type: 'COUPON_CODE' },
        configuration,
        request,
      ),
    ).resolves.toEqual({ code: 'STYLE-PASS', type: 'COUPON_CODE' });

    expect((request.mock.calls[0]?.[0] as URL).pathname).toBe(
      '/nodics/profile/v0/address',
    );
    const [fallbackUrl, fallbackOptions] = request.mock.calls[1] ?? [];
    expect((fallbackUrl as URL).pathname).toBe(
      '/nodics/profile/v0/schema/workbench/address/record',
    );
    expect(fallbackOptions?.method).toBe('POST');
    expect(parseRequestBody(fallbackOptions?.body)).toEqual({
      model: { code: 'STYLE-PASS', type: 'COUPON_CODE' },
    });
  });

  it('normalizes descriptor-declared date fields before generated create/update', async () => {
    const datedSchema: WorkbenchSchema = {
      ...address,
      fields: [
        ...address.fields,
        {
          name: 'validFrom',
          label: 'Valid from',
          type: 'date',
          required: false,
          readOnly: false,
          primary: false,
          description: '',
          searchable: false,
        },
      ],
    };
    const createRequest = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        json({ code: 'PROMO', validFrom: '2026-08-21T00:00:00.000Z' }),
      );
    await createWorkbenchRecord(
      connection,
      datedSchema,
      { code: 'PROMO', validFrom: '2026-08-21' },
      configuration,
      createRequest,
    );
    const createBody = createRequest.mock.calls[0]?.[1]?.body;
    if (typeof createBody !== 'string') throw new Error('Expected create body');
    expect(JSON.parse(createBody)).toEqual({
      code: 'PROMO',
      validFrom: '2026-08-21T00:00:00.000Z',
    });

    const updateRequest = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        json({ models: [{ code: 'PROMO', validFrom: '2026-08-22T00:00:00.000Z' }] }),
      );
    await updateWorkbenchRecord(
      connection,
      datedSchema,
      { code: 'PROMO' },
      { validFrom: '2026-08-22' },
      configuration,
      updateRequest,
    );
    const updateBody = updateRequest.mock.calls[0]?.[1]?.body;
    if (typeof updateBody !== 'string') throw new Error('Expected update body');
    expect(JSON.parse(updateBody)).toEqual({
      model: { validFrom: '2026-08-22T00:00:00.000Z' },
      options: { recursive: false, returnModified: true },
      query: { code: 'PROMO' },
    });
  });

  it('updates through the owning generated CRUD route', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ models: [{ code: 'DXB-OFFICE', city: 'Abu Dhabi' }] }));

    await expect(
      updateWorkbenchRecord(
        connection,
        address,
        { code: 'DXB-OFFICE', city: 'Dubai' },
        { code: 'DXB-OFFICE', city: 'Abu Dhabi' },
        configuration,
        request,
      ),
    ).resolves.toEqual({ code: 'DXB-OFFICE', city: 'Abu Dhabi' });

    const [url, options] = request.mock.calls[0] ?? [];
    expect((url as URL).pathname).toBe('/nodics/profile/v0/address');
    expect(options?.method).toBe('PATCH');
    const body = options?.body;
    if (typeof body !== 'string') throw new Error('Expected a JSON request body');
    expect(JSON.parse(body)).toEqual({
      model: { code: 'DXB-OFFICE', city: 'Abu Dhabi' },
      options: { recursive: false, returnModified: true },
      query: { code: 'DXB-OFFICE' },
    });
  });

  it('falls back to the generic Workbench update contract when generated update is unavailable', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: 'not found' }, 404))
      .mockResolvedValueOnce(json({ code: 'STYLE-PASS', type: 'PHYSICAL' }));

    await expect(
      updateWorkbenchRecord(
        connection,
        address,
        { code: 'STYLE-PASS', type: 'COUPON_CODE' },
        { type: 'PHYSICAL' },
        configuration,
        request,
      ),
    ).resolves.toEqual({ code: 'STYLE-PASS', type: 'PHYSICAL' });

    const [fallbackUrl, fallbackOptions] = request.mock.calls[1] ?? [];
    expect((fallbackUrl as URL).pathname).toBe(
      '/nodics/profile/v0/schema/workbench/address/record',
    );
    expect(fallbackOptions?.method).toBe('PATCH');
    expect(parseRequestBody(fallbackOptions?.body)).toEqual({
      identity: { code: 'STYLE-PASS' },
      model: { type: 'PHYSICAL' },
    });
  });

  it('deletes through the bounded Workbench selected-record contract', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ code: 'SUC_DBS_00000' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      deleteWorkbenchRecord(
        connection,
        address,
        { code: 'DXB-OFFICE' },
        configuration,
        'axis-delete-0001',
        request,
      ),
    ).resolves.toBeUndefined();

    const [url, options] = request.mock.calls[0] ?? [];
    expect((url as URL).pathname).toBe(
      '/nodics/profile/v0/schema/workbench/address/record',
    );
    expect(options?.method).toBe('DELETE');
    expect(new Headers(options?.headers).get('Idempotency-Key')).toBe(
      'axis-delete-0001',
    );
    const body = options?.body;
    if (typeof body !== 'string') throw new Error('Expected a JSON request body');
    expect(JSON.parse(body)).toEqual({
      identity: { code: 'DXB-OFFICE' },
    });
  });

  it('forwards an advertised revision for update and delete conflicts', async () => {
    const revisionAddress: WorkbenchSchema = {
      ...address,
      concurrency: {
        mode: 'COMPARE_AND_SET',
        field: 'revision',
        required: true,
      },
    };
    const updateRequest = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ models: [{ code: 'DXB', revision: 8 }] }));
    await updateWorkbenchRecord(
      connection,
      revisionAddress,
      { code: 'DXB', revision: 7 },
      { city: 'Dubai' },
      configuration,
      updateRequest,
    );
    const updateBody = updateRequest.mock.calls[0]?.[1]?.body;
    if (typeof updateBody !== 'string') throw new Error('Expected update body');
    expect(JSON.parse(updateBody)).toEqual(
      partial({ query: { code: 'DXB', revision: 7 } }),
    );

    const deleteRequest = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ code: 'SUC_DEL_00000' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await deleteWorkbenchRecord(
      connection,
      revisionAddress,
      { code: 'DXB', revision: 7 },
      configuration,
      'axis-delete-revision-0001',
      deleteRequest,
    );
    const deleteBody = deleteRequest.mock.calls[0]?.[1]?.body;
    if (typeof deleteBody !== 'string') throw new Error('Expected delete body');
    expect(JSON.parse(deleteBody)).toEqual(
      partial({
        identity: { code: 'DXB', revision: 7 },
      }),
    );
  });

  it('fails closed when an advertised revision is absent', async () => {
    const request = vi.fn<typeof fetch>();
    await expect(
      updateWorkbenchRecord(
        connection,
        {
          ...address,
          concurrency: {
            mode: 'COMPARE_AND_SET',
            field: 'revision',
            required: true,
          },
        },
        { code: 'DXB' },
        { city: 'Dubai' },
        configuration,
        request,
      ),
    ).rejects.toThrow('concurrency revision');
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects deletion without a safe identity before sending a request', async () => {
    const request = vi.fn<typeof fetch>();
    await expect(
      deleteWorkbenchRecord(
        connection,
        address,
        {},
        configuration,
        'axis-delete-invalid-0001',
        request,
      ),
    ).rejects.toThrow('safe identity');
    expect(request).not.toHaveBeenCalled();
  });

  it('surfaces a bounded backend integrity message without exposing contexts', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'ERR_DEL_00007',
          message:
            'Remove the reference from address.contacts before deleting this record',
          contexts: [{ stack: 'must-not-be-rendered' }],
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      deleteWorkbenchRecord(
        connection,
        address,
        { code: 'DXB-OFFICE' },
        configuration,
        'axis-delete-integrity-0001',
        request,
      ),
    ).rejects.toMatchObject({
      code: 'ERR_DEL_00007',
      message: 'Remove the reference from address.contacts before deleting this record',
      status: 409,
    });
  });

  it('uses an HTTP fallback for malformed backend errors', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('<html>gateway</html>', { status: 502 }));

    await expect(
      loadWorkbenchRecords(
        connection,
        address,
        configuration,
        {
          search: '',
          pageNumber: 1,
          pageSize: 25,
          sort: { field: 'code', direction: 'ASC' },
        },
        request,
      ),
    ).rejects.toThrow('Workbench request returned HTTP 502');
  });

  it('fails when every module discovery request is unavailable', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 503 }));

    await expect(
      loadWorkbenchSchemas([connection], configuration, request),
    ).rejects.toThrow('Authorized schema discovery is currently unavailable');
  });

  it('previews governed delete impact through the owning module', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        targetCount: 1,
        blocked: true,
        relationships: [
          {
            sourceModule: 'profile',
            sourceSchema: 'employee',
            field: 'address',
            policy: 'RESTRICT',
            referenceCount: 2,
          },
        ],
      }),
    );

    await expect(
      previewWorkbenchDeleteImpact(
        connection,
        address,
        { code: 'DXB-OFFICE' },
        configuration,
        request,
      ),
    ).resolves.toMatchObject({ blocked: true, targetCount: 1 });
    expect((request.mock.calls[0]?.[0] as URL).pathname).toContain(
      '/address/delete-impact',
    );
  });

  it('requires advertised bounded bulk delete and forwards idempotency', async () => {
    const bulkAddress: WorkbenchSchema = {
      ...address,
      bulkCapabilities: {
        operations: ['DELETE'],
        maximumItems: 2,
        idempotencyRequired: true,
        outcomeMode: 'AUTHORITATIVE_RESULT',
      },
    };
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ code: 'SUC_DBS_00000' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await bulkDeleteWorkbenchRecords(
      connection,
      bulkAddress,
      [{ code: 'DXB' }, { code: 'AUH' }],
      configuration,
      'axis-test-0001',
      request,
    );
    const headers = new Headers(request.mock.calls[0]?.[1]?.headers);
    expect(headers.get('Idempotency-Key')).toBe('axis-test-0001');

    await expect(
      bulkDeleteWorkbenchRecords(
        connection,
        bulkAddress,
        [{ code: '1' }, { code: '2' }, { code: '3' }],
        configuration,
        'axis-test-0002',
        request,
      ),
    ).rejects.toThrow('Bulk delete is not available for this selection');
  });

  it('executes backend-declared action forms with safe route substitution and JSON input', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ state: 'SUBMITTED' }));
    await executeWorkbenchLifecycleAction(
      connection,
      address,
      {
        id: 'create-return',
        label: 'Create Return',
        intent: 'CREATE',
        order: 0,
        operationRoute: '/operations/orders/:code/returns',
        inputFields: [
          {
            name: 'items',
            label: 'Items',
            type: 'JSON',
            required: true,
            maximumLength: 4000,
          },
        ],
      },
      { code: 'order/1' },
      configuration,
      'axis-action-0001',
      { items: '[{"orderEntryCode":"entry-1","requestedQuantity":"1"}]' },
      request,
    );
    expect((request.mock.calls[0]?.[0] as URL).pathname).toContain(
      '/operations/orders/order%2F1/returns',
    );
    const requestBody = request.mock.calls[0]?.[1]?.body;
    expect(typeof requestBody).toBe('string');
    const body = JSON.parse(requestBody as string) as {
      items: unknown[];
      idempotencyKey: string;
    };
    expect(body.items).toHaveLength(1);
    expect(body.idempotencyKey).toBe('axis-action-0001');
  });

  it('executes read-style lifecycle actions with declared GET method and no request body', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ promotionCode: 'agoraWelcome10', redemptionCount: 2 }));

    await executeWorkbenchLifecycleAction(
      {
        ...connection,
        moduleName: 'promotion',
        endpoint: 'https://commerce.example.com/nodics/promotion',
      },
      { ...address, moduleName: 'promotion', schemaName: 'promotion' },
      {
        id: 'promotion-analytics',
        label: 'Analytics',
        intent: 'VALIDATE',
        order: 110,
        httpMethod: 'GET',
        operationRoute: '/backoffice/promotions/:promotionCode/analytics',
        inputFields: [
          {
            name: 'promotionCode',
            label: 'Promotion code',
            type: 'HIDDEN',
            required: true,
            valueFromRecord: 'code',
            maximumLength: 128,
          },
        ],
      },
      { code: 'agoraWelcome10', status: 'SCHEDULED' },
      configuration,
      'axis-promotion-analytics-1',
      { promotionCode: 'agoraWelcome10' },
      request,
    );

    expect((request.mock.calls[0]?.[0] as URL).pathname).toContain(
      '/nodics/promotion/v0/backoffice/promotions/agoraWelcome10/analytics',
    );
    expect(request.mock.calls[0]?.[1]?.method).toBe('GET');
    expect(request.mock.calls[0]?.[1]?.body).toBeUndefined();
  });

  it('executes commerce order and promotion actions only through backend-declared operation routes', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ status: 'APPROVED' }))
      .mockResolvedValueOnce(json({ status: 'SCHEDULED' }));
    const orderSchema = {
      ...address,
      moduleName: 'order',
      schemaName: 'orderLifecycleRequest',
    };
    const promotionSchema = {
      ...address,
      moduleName: 'promotion',
      schemaName: 'promotion',
    };

    await executeWorkbenchLifecycleAction(
      {
        ...connection,
        moduleName: 'order',
        endpoint: 'https://commerce.example.com/nodics/order',
      },
      orderSchema,
      {
        id: 'approve',
        label: 'Approve',
        intent: 'APPROVE',
        order: 10,
        operationRoute: '/operator/order-lifecycle/:requestCode/actions/APPROVE',
        inputFields: [
          {
            name: 'requestCode',
            label: 'Request code',
            type: 'HIDDEN',
            required: true,
            valueFromRecord: 'code',
            maximumLength: 128,
          },
          {
            name: 'reason',
            label: 'Reason',
            type: 'MULTILINE',
            required: false,
            maximumLength: 512,
          },
        ],
      },
      { code: 'order-1:return:1', status: 'SUBMITTED' },
      configuration,
      'axis-order-action-1',
      { requestCode: 'order-1:return:1', reason: 'Approved by operator' },
      request,
    );

    await executeWorkbenchLifecycleAction(
      {
        ...connection,
        moduleName: 'promotion',
        endpoint: 'https://commerce.example.com/nodics/promotion',
      },
      promotionSchema,
      {
        id: 'schedule',
        label: 'Schedule',
        intent: 'ACTIVATE',
        order: 20,
        httpMethod: 'POST',
        operationRoute: '/operator/promotions/:code/actions/SCHEDULE',
        inputFields: [
          {
            name: 'validFrom',
            label: 'Valid from',
            type: 'TEXT',
            required: true,
            maximumLength: 32,
          },
          {
            name: 'validTo',
            label: 'Valid to',
            type: 'TEXT',
            required: true,
            maximumLength: 32,
          },
        ],
      },
      { code: 'agoraWelcome10', status: 'APPROVED' },
      configuration,
      'axis-promotion-action-1',
      { validFrom: '2026-08-15T00:00:00Z', validTo: '2026-09-15T00:00:00Z' },
      request,
    );

    expect((request.mock.calls[0]?.[0] as URL).pathname).toContain(
      '/nodics/order/v0/operator/order-lifecycle/order-1%3Areturn%3A1/actions/APPROVE',
    );
    expect((request.mock.calls[1]?.[0] as URL).pathname).toContain(
      '/nodics/promotion/v0/operator/promotions/agoraWelcome10/actions/SCHEDULE',
    );
    const rawPromotionBody = request.mock.calls[1]?.[1]?.body;
    expect(typeof rawPromotionBody).toBe('string');
    const promotionBody = JSON.parse(rawPromotionBody as string) as {
      actionId: string;
      validFrom: string;
      idempotencyKey: string;
    };
    expect(promotionBody).toMatchObject({
      actionId: 'schedule',
      validFrom: '2026-08-15T00:00:00Z',
      idempotencyKey: 'axis-promotion-action-1',
    });
  });
});

/** Request bodies are JSON strings at this HTTP boundary. */
function parseRequestBody(body: RequestInit['body']): Record<string, unknown> {
  expect(typeof body).toBe('string');
  return JSON.parse(body as string) as Record<string, unknown>;
}
function partial(value: Record<string, unknown>): unknown {
  return expect.objectContaining(value);
}
