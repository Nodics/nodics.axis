import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxisModuleConnection } from '../../../src/bootstrap/publicBootstrap';
import type { WorkbenchSchema } from '../../../src/workbench/api/workbenchContracts';
import { loadPublicationRequestPage } from '../../../src/operations/contentExperience/api/publicationRequestBrowserClient';
const readers = vi.hoisted(() => ({
  loadWorkbenchSchemas: vi.fn(),
  loadWorkbenchRecords: vi.fn(),
}));
vi.mock('../../../src/workbench/api/workbenchClient', () => readers);
const source: AxisModuleConnection = {
  moduleName: 'publish',
  instanceId: 'source',
  endpoint: 'https://source.example.test/nodics/publish',
  environment: 'local',
  server: 'authoring',
  state: 'UP',
};
const config = { accessToken: 'employee', enterpriseCode: 'default', timeoutMs: 1000 };
const schema: WorkbenchSchema = {
  moduleName: 'publish',
  schemaName: 'publicationRequest',
  label: 'Requests',
  description: '',
  displayProperty: 'code',
  displayProperties: ['code'],
  mutationMode: 'READ_ONLY',
  operations: ['search', 'read'],
  connectionInstanceId: 'source',
  fields: [
    {
      name: 'code',
      label: 'Code',
      type: 'string',
      required: true,
      primary: true,
      readOnly: true,
      searchable: true,
      description: '',
    },
  ],
  relationships: [],
  queryCapabilities: {
    searchableFields: ['code'],
    sortableFields: ['code'],
    filterFields: [],
    groupOperators: ['AND'],
    textOperator: 'CONTAINS',
    allowedPageSizes: [10, 25],
    defaultPageSize: 25,
    maximumPageSize: 25,
    defaultSort: { field: 'code', direction: 'ASC' },
  },
};
const record = {
  code: 'publication-one',
  state: 'ONLINE',
  domain: 'cms',
  rootCode: 'page-one',
  sourceVersion: 0,
  revision: 6,
  auditTrail: [{ private: 'not a summary field' }],
};
beforeEach(() => {
  vi.clearAllMocks();
  readers.loadWorkbenchSchemas.mockResolvedValue([schema]);
  readers.loadWorkbenchRecords.mockResolvedValue({
    records: [record],
    totalCount: 1,
    pageNumber: 1,
    pageSize: 10,
  });
});
describe('bounded publication request browsing', () => {
  it('reads only the selected source and retains version zero without returning internal record fields', async () => {
    const result = await loadPublicationRequestPage(source, config, {
      search: ' publication-one ',
      pageNumber: 1,
    });
    expect(readers.loadWorkbenchSchemas).toHaveBeenCalledExactlyOnceWith(
      [source],
      config,
    );
    expect(readers.loadWorkbenchRecords.mock.calls[0]?.[0]).toBe(source);
    expect(readers.loadWorkbenchRecords.mock.calls[0]?.[3]).toMatchObject({
      search: 'publication-one',
      pageNumber: 1,
      pageSize: 10,
    });
    expect(result.records).toEqual([
      {
        code: 'publication-one',
        state: 'ONLINE',
        domain: 'cms',
        rootCode: 'page-one',
        sourceVersion: '0',
        revision: 6,
      },
    ]);
  });
  it.each(['absent', 'duplicate', 'foreign', 'writable', 'unsearchable', 'unbounded'])(
    'does not read records for %s schema evidence',
    async (scenario) => {
      readers.loadWorkbenchSchemas.mockResolvedValue(
        scenario === 'absent'
          ? []
          : scenario === 'duplicate'
            ? [schema, schema]
            : [
                {
                  ...schema,
                  ...(scenario === 'foreign'
                    ? { moduleName: 'cms' }
                    : scenario === 'writable'
                      ? { mutationMode: 'GENERATED_CRUD' }
                      : scenario === 'unsearchable'
                        ? { operations: ['read'] }
                        : scenario === 'unbounded'
                          ? {
                              queryCapabilities: {
                                ...schema.queryCapabilities,
                                allowedPageSizes: [100],
                                maximumPageSize: 100,
                              },
                            }
                          : {}),
                },
              ],
      );
      await expect(
        loadPublicationRequestPage(source, config, { search: '', pageNumber: 1 }),
      ).rejects.toThrow();
      expect(readers.loadWorkbenchRecords).not.toHaveBeenCalled();
    },
  );
  it.each([
    'duplicate-code',
    'bad-state',
    'bad-revision',
    'missing-version',
    'wrong-page',
    'wrong-size',
    'contradictory-count',
  ])(
    'refuses %s without presenting partial or false-zero evidence',
    async (scenario) => {
      readers.loadWorkbenchRecords.mockResolvedValue({
        records:
          scenario === 'duplicate-code'
            ? [record, record]
            : [
                {
                  ...record,
                  ...(scenario === 'bad-state'
                    ? { state: 0 }
                    : scenario === 'bad-revision'
                      ? { revision: 1.5 }
                      : scenario === 'missing-version'
                        ? { sourceVersion: undefined }
                        : {}),
                },
              ],
        totalCount: scenario === 'contradictory-count' ? 0 : 2,
        pageNumber: scenario === 'wrong-page' ? 2 : 1,
        pageSize: scenario === 'wrong-size' ? 25 : 10,
      });
      await expect(
        loadPublicationRequestPage(source, config, { search: '', pageNumber: 1 }),
      ).rejects.toThrow();
    },
  );
  it('does not fall back after an owner denial', async () => {
    readers.loadWorkbenchSchemas.mockRejectedValue(new Error('Owner denied'));
    await expect(
      loadPublicationRequestPage(source, config, { search: '', pageNumber: 1 }),
    ).rejects.toThrow('Owner denied');
    expect(readers.loadWorkbenchSchemas).toHaveBeenCalledOnce();
    expect(readers.loadWorkbenchRecords).not.toHaveBeenCalled();
  });
  it('does not perform discovery for an unavailable source', async () => {
    await expect(
      loadPublicationRequestPage({ ...source, state: 'UNAVAILABLE' }, config, {
        search: '',
        pageNumber: 1,
      }),
    ).rejects.toThrow();
    expect(readers.loadWorkbenchSchemas).not.toHaveBeenCalled();
  });
});
