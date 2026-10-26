import { describe, it, expect, vi } from 'vitest';
import { productAdministrativeTransport } from '../../src/operations/productManagement/productAdministrativeClient';
import type { OperationalOwnerConfiguration } from '../../src/operations/shared/operationalOwnerClient';
import type { AxisModuleConnection } from '../../src/bootstrap/publicBootstrap';

const c = {
  accessToken: 'test-native-token',
  enterpriseCode: 'default',
  timeoutMs: 1000,
  bootstrap: { tenantCode: 'tenant' },
} as OperationalOwnerConfiguration;
const connection = {
  moduleName: 'product',
  instanceId: 'staged',
  endpoint: 'https://owner.test/nodics/product',
  environment: 'Local',
  server: 'commerce',
  state: 'UP',
} as AxisModuleConnection;
const headers = {
  Authorization: 'Bearer test-native-token',
  'x-enterprise-code': 'default',
};
const response = (result: unknown, target = 'RETAIL', audit = {}) =>
  new Response(
    JSON.stringify({
      data: {
        targetEnterpriseCode: target,
        result,
        audit: {
          tenant: 'tenant',
          actorCode: 'admin',
          actorEnterpriseCode: 'default',
          targetEnterpriseCode: target,
          permission: 'owner.permission',
          authVersion: 1,
          ...audit,
        },
      },
    }),
  );
const root = connection.endpoint + '/v0/business/products/';

describe('Product native administrative transport', () => {
  it('adapts discovery to target-body capabilities and retains the owner descriptor', async () => {
    const descriptor = {
      moduleName: 'product',
      schemaName: 'product',
      label: 'Products',
      displayProperty: 'code',
      operations: ['search', 'read', 'create', 'update'],
      mutationMode: 'GENERATED_CRUD',
      fields: [],
      relationships: [],
      queryCapabilities: {
        searchableFields: ['code'],
        sortableFields: ['code'],
        filterFields: [],
        groupOperators: ['AND'],
        textOperator: 'CONTAINS',
        allowedPageSizes: [25],
        defaultPageSize: 25,
        maximumPageSize: 25,
        defaultSort: { field: 'code', direction: 'ASC' },
      },
      apiOperations: Object.fromEntries(
        ['capabilities', 'search', 'create', 'update'].map((operation) => [
          operation,
          {
            method: 'POST',
            path: '/business/products/administrative/' + operation,
            apiVersion: 'v0',
            active: true,
          },
        ]),
      ),
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        crossEnterpriseManagement: true,
        descriptor,
        labels: { title: 'Owner title', targetEnterpriseCode: 'Owner Enterprise' },
      }),
    );
    const result = await productAdministrativeTransport(
      c,
      connection,
      'RETAIL',
      fetcher,
    ).fetch(root + 'schemas', { headers });
    expect(await result.json()).toMatchObject({
      data: {
        moduleName: 'product',
        schemas: [
          {
            moduleName: 'product',
            schemaName: 'product',
            apiOperations: descriptor.apiOperations,
          },
        ],
      },
    });
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string)).toEqual({
      targetEnterpriseCode: 'RETAIL',
    });
  });
  it.each(['search', 'create', 'update', 'archive'])(
    'wraps %s once without switching signed identity',
    async (operation) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(response({ code: 'p', versionId: 3 }));
      const transport = productAdministrativeTransport(
        c,
        connection,
        'RETAIL',
        fetcher,
      );
      const command = { code: 'p', versionId: 2 };
      const result = await transport.fetch(
        root + (operation === 'archive' ? 'archive' : 'administrative/' + operation),
        { method: 'POST', headers, body: JSON.stringify(command) },
      );
      expect(await result.json()).toEqual({ data: { code: 'p', versionId: 3 } });
      expect(fetcher).toHaveBeenCalledTimes(1);
      const [url, init] = fetcher.mock.calls[0]!;
      expect((url as URL).href).toBe(root + 'administrative/' + operation);
      expect(JSON.parse(init!.body as string)).toEqual({
        targetEnterpriseCode: 'RETAIL',
        command,
      });
      expect(new Headers(init!.headers).get('x-enterprise-code')).toBe('default');
      expect(new Headers(init!.headers).get('Authorization')).toBe(
        headers.Authorization,
      );
      expect(init).toMatchObject({
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
      });
    },
  );
  it.each([
    '/nodics/pricing/v0/rows',
    '/nodics/product/v0/products',
    '/nodics/product/v0/business/products/administrative/publish',
  ])('rejects foreign/unadvertised route %s', async (path) => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      productAdministrativeTransport(c, connection, 'RETAIL', fetcher).fetch(
        'https://owner.test' + path,
        { method: 'POST', headers },
      ),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { tenant: 'other' },
    { actorEnterpriseCode: 'RETAIL' },
    { targetEnterpriseCode: 'OTHER' },
    { actorCode: '' },
  ])('rejects mismatched audit %j', async (audit) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({}, 'RETAIL', audit));
    await expect(
      productAdministrativeTransport(c, connection, 'RETAIL', fetcher).fetch(
        root + 'administrative/search',
        { method: 'POST', headers, body: '{}' },
      ),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not fall back or retry a denied command', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status: 403 }));
    await expect(
      productAdministrativeTransport(c, connection, 'RETAIL', fetcher).fetch(
        root + 'administrative/create',
        { method: 'POST', headers, body: '{}' },
      ),
    ).rejects.toThrow('refused');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('separates target caches without placing the bearer in the key', () => {
    const retail = productAdministrativeTransport(c, connection, 'RETAIL');
    expect(retail.scopeKey).not.toBe(
      productAdministrativeTransport(c, connection, 'ONLINE').scopeKey,
    );
    expect(retail.scopeKey).not.toContain(c.accessToken);
  });
});
