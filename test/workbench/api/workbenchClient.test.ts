import { describe, expect, it, vi } from 'vitest';

import {
  bulkDeleteWorkbenchRecords,
  createWorkbenchRecord,
  deleteWorkbenchRecord,
  executeWorkbenchLifecycleAction,
  loadWorkbenchRecords,
  loadWorkbenchSchemas,
  previewWorkbenchDeleteImpact,
  updateWorkbenchRecord,
} from '../../../src/workbench/api/workbenchClient';
import type { AxisModuleConnection } from '../../../src/bootstrap/publicBootstrap';
import type { WorkbenchSchema } from '../../../src/workbench/api/workbenchContracts';

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
  it('discovers schemas directly from owning modules with employee context', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ moduleName: 'profile', schemas: [address] }));

    await expect(
      loadWorkbenchSchemas([connection], configuration, request),
    ).resolves.toEqual([
      expect.objectContaining({
        label: 'Address',
        moduleName: 'profile',
        connectionModuleName: 'profile',
        connectionInstanceId: 'profile-1',
        connectionServer: 'platformServer',
        connectionEnvironment: 'local',
      }),
    ]);

    const [url, options] = request.mock.calls[0] ?? [];
    expect((url as URL).href).toBe(
      'https://profile.example.com/nodics/profile/v0/schema/workbench',
    );
    const headers = new Headers(options?.headers);
    expect(headers.get('Authorization')).toBe('Bearer memory-only-token');
    expect(headers.get('x-enterprise-code')).toBe('default');
    expect((url as URL).href).not.toContain('memory-only-token');
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
    expect((url as URL).pathname).toBe(
      '/nodics/profile/v0/schema/workbench/address/records',
    );
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
      expect.objectContaining({ query: { code: 'DXB', revision: 7 } }),
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
      expect.objectContaining({
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
      '/schema/workbench/address/delete-impact',
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
