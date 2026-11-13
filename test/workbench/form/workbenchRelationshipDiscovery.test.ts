import { describe, expect, it, vi } from 'vitest';
import type {
  AxisAuthenticatedBootstrap,
  AxisModuleConnection,
} from '../../../src/bootstrap/publicBootstrap';
import type { WorkbenchSchema } from '../../../src/workbench/api/workbenchContracts';
import {
  loadWorkbenchRelationshipTarget,
  planWorkbenchRelationshipDiscovery,
} from '../../../src/workbench/form/workbenchRelationshipDiscovery';
import { resolveWorkbenchRelationshipSchema } from '../../../src/workbench/form/workbenchRelatedDrafts';

const relation = {
  field: 'siteCodes',
  targetModule: 'cms',
  targetSchema: 'cmsSite',
} as WorkbenchSchema['relationships'][number];
const source = {
  moduleName: 'editorial',
  schemaName: 'editorialArticle',
  connectionServer: 'staged',
  connectionEnvironment: 'local',
  relationships: [relation],
} as unknown as WorkbenchSchema;
const connection = {
  moduleName: 'cms',
  instanceId: 'cms-staged',
  endpoint: 'http://localhost:4312/nodics/cms',
  server: 'staged',
  environment: 'local',
  state: 'UP',
  runtimeRole: { publication: 'STAGED' },
} as AxisModuleConnection;
const bootstrap = (connections = [connection]) =>
  ({
    moduleConnections: { cms: connections },
  }) as unknown as AxisAuthenticatedBootstrap;
const descriptor = () => ({
  moduleName: 'cms',
  schemaName: 'cmsSite',
  label: 'Website',
  description: '',
  displayProperty: 'code',
  displayProperties: ['code'],
  mutationMode: 'READ_ONLY',
  operations: ['search', 'read'],
  fields: [],
  relationships: [],
  authoring: { publishRequired: true, authoringAllowed: false, stage: 'STAGED' },
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
});
const configuration = {
  accessToken: 'original-employee',
  enterpriseCode: 'default',
  timeoutMs: 360000,
};

describe('declared foreign relationship discovery', () => {
  it('loads one missing CMS website descriptor through the canonical detail route and preserves read-only mutation authority', async () => {
    const [target] = planWorkbenchRelationshipDiscovery(source, [source], bootstrap());
    expect(target?.connection).toBe(connection);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ code: 'SUC_DBS_00000', result: descriptor() }),
      );
    const saved = await loadWorkbenchRelationshipTarget(
      target!,
      configuration,
      fetcher,
    );
    expect(saved.connectionInstanceId).toBe('cms-staged');
    expect(saved.operations).toEqual(['search', 'read']);
    expect(saved.authoring?.authoringAllowed).toBe(false);
    expect(resolveWorkbenchRelationshipSchema([saved], source, relation)).toBe(saved);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toEqual(new URL('http://localhost:4312/nodics/cms/v0/schemas/cmsSite'));
    expect(init?.method).toBeUndefined();
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer original-employee',
    );
    expect(init?.body).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('deduplicates declared targets and does not rediscover a known source-local read-only schema', () => {
    const repeated = { ...source, relationships: [relation, relation] };
    expect(planWorkbenchRelationshipDiscovery(repeated, [], bootstrap())).toHaveLength(
      1,
    );
    const known = {
      ...descriptor(),
      connectionServer: 'staged',
      connectionEnvironment: 'local',
    } as WorkbenchSchema;
    expect(planWorkbenchRelationshipDiscovery(repeated, [known], bootstrap())).toEqual(
      [],
    );
    expect(
      planWorkbenchRelationshipDiscovery(
        { ...source, relationships: [{ ...relation, targetModule: 'editorial' }] },
        [],
        bootstrap(),
      ),
    ).toEqual([]);
  });

  it('prefers the unique same-runtime owner and refuses local or remote ambiguity', () => {
    const remote = { ...connection, instanceId: 'cms-remote', server: 'other' };
    expect(
      planWorkbenchRelationshipDiscovery(source, [], bootstrap([remote, connection]))[0]
        ?.connection,
    ).toBe(connection);
    expect(
      planWorkbenchRelationshipDiscovery(
        source,
        [],
        bootstrap([connection, { ...connection, instanceId: 'duplicate' }]),
      ),
    ).toEqual([]);
    expect(
      planWorkbenchRelationshipDiscovery(
        source,
        [],
        bootstrap([remote, { ...remote, instanceId: 'remote-two', server: 'third' }]),
      ),
    ).toEqual([]);
    expect(
      planWorkbenchRelationshipDiscovery(source, [], bootstrap([remote]))[0]
        ?.connection,
    ).toBe(remote);
  });

  it.each([
    { ...connection, state: 'DOWN' },
    { ...connection, environment: 'another' },
    { ...connection, runtimeRole: { publication: 'ONLINE' } },
    { ...connection, endpoint: 'https://user:secret@localhost/nodics/cms' },
    { ...connection, moduleName: 'foreign' },
  ])('does not request unavailable, foreign or unsafe target metadata', (invalid) => {
    expect(
      planWorkbenchRelationshipDiscovery(
        source,
        [],
        bootstrap([invalid as AxisModuleConnection]),
      ),
    ).toEqual([]);
  });

  it.each([
    { moduleName: 'foreign' },
    { schemaName: 'wrong' },
    { operations: ['read'] },
    { authoring: { publishRequired: true, authoringAllowed: false, stage: 'ONLINE' } },
  ])('rejects wrong target/source evidence without fallback', async (changes) => {
    const target = planWorkbenchRelationshipDiscovery(source, [], bootstrap())[0]!;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ result: { ...descriptor(), ...changes } }));
    await expect(
      loadWorkbenchRelationshipTarget(target, configuration, fetcher),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('stops at a denied detail read without another runtime or collection fallback', async () => {
    const target = planWorkbenchRelationshipDiscovery(source, [], bootstrap())[0]!;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ message: 'Denied' }, { status: 403 }));
    await expect(
      loadWorkbenchRelationshipTarget(target, configuration, fetcher),
    ).rejects.toThrow('Denied');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
