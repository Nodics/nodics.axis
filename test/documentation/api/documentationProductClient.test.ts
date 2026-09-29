import { describe, expect, it, vi } from 'vitest';
import type {
  AxisApplicationInitializationProfile,
  AxisModuleConnection,
} from '../../../src/bootstrap/publicBootstrap';
import {
  loadDocumentationProductSources,
  projectDocumentationProducts,
} from '../../../src/documentation/api/documentationProductClient';

const requestUrl = (request: RequestInfo | URL) =>
  request instanceof Request ? request.url : request.toString();

const profile: AxisApplicationInitializationProfile = {
  code: 'acmedocs',
  title: 'Not the canonical product label',
  kind: 'DOCUMENTATION',
  category: 'documentation',
  summary: '',
  order: 400,
  type: 'DOCUMENTATION_BUNDLE',
  owner: 'acme',
  applicationCode: 'acme',
  siteCode: 'acmeSite',
  baselineCode: 'acme',
  contentPackCode: 'acmePack',
  requiredServers: [],
  dataPackages: [],
  activationPolicy: {
    approvalRequiredForOnline: true,
    requiredDataTrigger: 'USER',
    sampleDataTrigger: 'USER',
  },
};
const product = {
  code: 'acmeDocsProduct',
  name: 'Canonical Handbook',
  publicRootPath: '/docs/handbook',
  site: 'acmeSite',
  contentCatalog: 'acmeCatalog',
  description: 'Canonical summary',
  audience: ['developer'],
  lifecycleState: 'ONLINE',
  accessMode: 'PUBLIC',
  active: true,
};
const connection: AxisModuleConnection = {
  moduleName: 'cms',
  instanceId: 'cms-staged',
  endpoint: 'https://cms.example.com/nodics/cms',
  environment: 'test',
  state: 'UP',
  runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
};
const configuration = {
  accessToken: 'human-token',
  enterpriseCode: 'customer',
  timeoutMs: 1000,
};
const schema = {
  moduleName: 'cms',
  schemaName: 'cmsDocumentationProduct',
  label: 'Documentation products',
  mutationMode: 'READ_ONLY',
  operations: ['search', 'read'],
  fields: [],
  relationships: [],
  displayProperty: 'code',
  apiOperations: {
    search: {
      method: 'POST',
      path: '/cmsdocumentationproduct/safe-search',
      apiVersion: 'v0',
      active: true,
    },
  },
  queryCapabilities: {
    searchableFields: ['code'],
    sortableFields: ['code'],
    filterFields: [
      { field: 'site', label: 'Site', type: 'string', operators: ['EQUALS'] },
    ],
    groupOperators: ['AND', 'OR'],
    textOperator: 'CONTAINS',
    allowedPageSizes: [1],
    defaultPageSize: 1,
    maximumPageSize: 1,
    defaultSort: { field: 'code', direction: 'ASC' },
  },
};
const json = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
const page = (records: unknown[], pageNumber = 1, totalCount = records.length) => ({
  records,
  totalCount,
  pageNumber,
  pageSize: 1,
  sort: { field: 'code', direction: 'ASC' },
});

describe('canonical documentation products', () => {
  it('uses record identities and only joins pack/profile/order from bootstrap', () => {
    expect(projectDocumentationProducts([product], [profile])).toEqual([
      expect.objectContaining({
        id: product.code,
        label: product.name,
        route: product.publicRootPath,
        site: product.site,
        catalog: product.contentCatalog,
        packCode: profile.contentPackCode,
        initializationProfile: profile.code,
        order: profile.order,
      }),
    ]);
    expect(
      projectDocumentationProducts(
        [{ ...product, publicRootPath: '/docs/revised', name: 'Revised' }],
        [profile],
      )[0],
    ).toMatchObject({ route: '/docs/revised', label: 'Revised' });
  });
  it.each([
    { lifecycleState: 'DRAFT' },
    { lifecycleState: 'RETIRED' },
    { active: false },
    { accessMode: 'RESTRICTED' },
    { accessMode: 'AUTHENTICATED' },
    { site: 'unselectedSite' },
  ])('does not promote unavailable/non-public/unselected content %j', (difference) => {
    expect(
      projectDocumentationProducts([{ ...product, ...difference }], [profile]),
    ).toEqual([]);
  });
  it.each([
    'https://outside.example/docs',
    '//outside.example',
    '/docs',
    '/docs/../admin',
    '/docs/%2e%2e/admin',
  ])('rejects unsafe or catch-all root %s', (publicRootPath) => {
    expect(() =>
      projectDocumentationProducts([{ ...product, publicRootPath }], [profile]),
    ).toThrow(/route/);
  });
  it('rejects ambiguous profile bindings and duplicate routes', () => {
    expect(() =>
      projectDocumentationProducts(
        [product],
        [profile, { ...profile, code: 'another' }],
      ),
    ).toThrow(/ambiguous/);
    expect(() =>
      projectDocumentationProducts(
        [product, { ...product, code: 'another' }],
        [profile],
      ),
    ).toThrow(/ambiguous/);
    expect(projectDocumentationProducts([product], [])).toEqual([]);
  });
  it('uses schema-advertised read transport and completes bounded paging with human credentials', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(schema))
      .mockResolvedValueOnce(json(page([product], 1, 2)))
      .mockResolvedValueOnce(
        json(
          page([{ ...product, code: 'second', publicRootPath: '/docs/second' }], 2, 2),
        ),
      );
    expect(
      await loadDocumentationProductSources(
        connection,
        configuration,
        [profile],
        fetcher,
      ),
    ).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(requestUrl(fetcher.mock.calls[0]![0])).toContain(
      '/v0/schemas/cmsDocumentationProduct',
    );
    expect(requestUrl(fetcher.mock.calls[1]![0])).toContain(
      '/v0/cmsdocumentationproduct/safe-search',
    );
    const options = fetcher.mock.calls[1]![1]!;
    expect(new Headers(options.headers).get('Authorization')).toBe(
      'Bearer human-token',
    );
    expect(JSON.parse(options.body as string) as unknown).toMatchObject({
      query: {
        pageNumber: 1,
        filters: {
          operator: 'OR',
          items: [{ field: 'site', operator: 'EQUALS', value: 'acmeSite' }],
        },
      },
    });
    expect(
      JSON.parse(fetcher.mock.calls[2]![1]!.body as string) as unknown,
    ).toMatchObject({ query: { pageNumber: 2 } });
  });
  it('rejects denied reads without retry or fallback', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status: 403 }));
    await expect(
      loadDocumentationProductSources(connection, configuration, [profile], fetcher),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects Online authoring discovery and disabled search before sending a search request', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        ...schema,
        apiOperations: {
          search: { ...schema.apiOperations.search, active: false },
        },
      }),
    );
    await expect(
      loadDocumentationProductSources(
        { ...connection, runtimeRole: { code: 'WCMS_ONLINE', publication: 'ONLINE' } },
        configuration,
        [profile],
        fetcher,
      ),
    ).rejects.toThrow(/Staged/);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(
      loadDocumentationProductSources(connection, configuration, [profile], fetcher),
    ).rejects.toThrow(/unavailable/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([page([], 1, 1), page([product], 1, 129)])(
    'fails incomplete/oversized discovery rather than presenting a truncated catalogue',
    async (result) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json(schema))
        .mockResolvedValueOnce(json(result));
      await expect(
        loadDocumentationProductSources(connection, configuration, [profile], fetcher),
      ).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );
});
