import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AxisAuthenticatedBootstrap,
  AxisModuleConnection,
} from '../../../src/bootstrap/publicBootstrap';
import type { WorkbenchSchema } from '../../../src/workbench/api/workbenchContracts';
import {
  loadWorkbenchMetric,
  loadWorkbenchMetrics,
} from '../../../src/operations/shared/workbenchMetricDashboardModel';

const clients = vi.hoisted(() => ({
  loadGeneratedSchemaCapabilities: vi.fn(),
  loadWorkbenchRecords: vi.fn(),
  loadWorkbenchSchemas: vi.fn(),
}));
vi.mock('../../../src/workbench/api/workbenchClient', () => clients);
const config = { accessToken: 'employee', enterpriseCode: 'default', timeoutMs: 1000 };
const definition = {
  id: 'requests',
  label: 'Requests',
  moduleName: 'publish',
  schemaName: 'publicationRequest',
  description: 'Requests',
  route: '/publishing/requests',
  icon: 'workflow',
  ownerSelector: { runtimeRoleCode: 'WCMS_STAGED', publicationRole: 'STAGED' },
};
function owner(
  instanceId: string,
  role: string,
  server: string,
  publication = 'STAGED',
): AxisModuleConnection {
  return {
    moduleName: 'publish',
    instanceId,
    endpoint: `https://${instanceId}.example.test/nodics/publish`,
    environment: 'local',
    server,
    state: 'UP',
    runtimeRole: { code: role, publication },
  };
}
function bootstrap(
  connections: readonly AxisModuleConnection[],
): AxisAuthenticatedBootstrap {
  return {
    axisPolicy: {
      contractVersion: 0,
      screenLockEnabled: true,
      idleTimeoutSeconds: 900,
      recentNavigationLimit: 12,
      revision: 0,
      source: 'DEFAULT',
    },
    navigation: [],
    environments: ['local'],
    moduleCatalog: {},
    moduleConnections: { publish: connections },
    documentationSources: [],
    tenantCode: 'default',
  };
}
function schema(connection: AxisModuleConnection): WorkbenchSchema {
  return {
    moduleName: 'publish',
    schemaName: 'publicationRequest',
    label: 'Requests',
    description: '',
    displayProperty: 'code',
    displayProperties: ['code'],
    queryCapabilities: {
      searchableFields: [],
      sortableFields: [],
      filterFields: [],
      groupOperators: ['AND'],
      textOperator: 'CONTAINS',
      allowedPageSizes: [20],
      defaultPageSize: 20,
      maximumPageSize: 20,
      defaultSort: { field: 'code', direction: 'ASC' },
    },
    mutationMode: 'READ_ONLY',
    operations: ['search', 'read'],
    fields: [],
    relationships: [],
    connectionModuleName: connection.moduleName,
    connectionInstanceId: connection.instanceId,
    connectionServer: connection.server,
    connectionEnvironment: connection.environment,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  clients.loadWorkbenchRecords.mockResolvedValue({
    records: [],
    totalCount: 64,
    pageNumber: 1,
    pageSize: 20,
  });
});
describe('metric runtime authority', () => {
  it('limits discovery to modules and advertised roles required by the visible metric selection', async () => {
    const source = owner('source', 'WCMS_STAGED', 'authoring');
    const target = owner('target', 'WCMS_ONLINE', 'delivery', 'ONLINE');
    const unrelated = { ...source, moduleName: 'profile', instanceId: 'profile' };
    clients.loadGeneratedSchemaCapabilities.mockResolvedValue(schema(source));
    const result = await loadWorkbenchMetrics(
      [target, unrelated, source],
      bootstrap([source, target]),
      config,
      [definition],
    );
    expect(clients.loadGeneratedSchemaCapabilities).toHaveBeenCalledExactlyOnceWith(
      source,
      { schemaName: definition.schemaName },
      config,
    );
    expect(clients.loadWorkbenchSchemas).not.toHaveBeenCalled();
    expect(result[0]).toMatchObject({ status: 'ready', value: 64 });
    expect(clients.loadWorkbenchRecords.mock.calls[0]?.[0]).toBe(source);
  });

  it('uses the advertised discovery and never retries a failed owner through the generic route', async () => {
    const source = owner('source', 'WCMS_STAGED', 'authoring');
    const selected = {
      ...definition,
      schemaDiscovery: {
        moduleName: 'publish',
        descriptor: { path: '/business/requests/schemas', apiVersion: 'v0' },
      },
    };
    clients.loadWorkbenchSchemas.mockResolvedValueOnce([schema(source)]);
    const result = await loadWorkbenchMetrics([source], bootstrap([source]), config, [
      selected,
    ]);
    expect(result[0]).toMatchObject({ status: 'ready', value: 64 });
    expect(clients.loadWorkbenchSchemas).toHaveBeenCalledExactlyOnceWith(
      [source],
      config,
      fetch,
      selected.schemaDiscovery,
    );
    clients.loadWorkbenchSchemas.mockClear();
    clients.loadWorkbenchRecords.mockClear();
    clients.loadWorkbenchSchemas.mockRejectedValueOnce(
      new Error('Owner refused discovery'),
    );
    const denied = await loadWorkbenchMetrics([source], bootstrap([source]), config, [
      selected,
    ]);
    expect(denied[0]).toMatchObject({ status: 'unavailable', value: undefined });
    expect(clients.loadWorkbenchSchemas).toHaveBeenCalledOnce();
    expect(clients.loadWorkbenchRecords).not.toHaveBeenCalled();
  });

  it('uses advertised authority when another Staged server sorts first or has a persuasive name', async () => {
    const decoy = owner('aaa-commerce', 'COMMERCE_STAGED', 'wcms-staged'),
      source = owner('zzz-content', 'WCMS_STAGED', 'authoring');
    const result = await loadWorkbenchMetric(
      definition,
      [schema(decoy), schema(source)],
      bootstrap([decoy, source]),
      config,
    );
    expect(result).toMatchObject({ status: 'ready', value: 64 });
    expect(clients.loadWorkbenchRecords).toHaveBeenCalledOnce();
    expect(clients.loadWorkbenchRecords.mock.calls[0]?.[0]).toBe(source);
  });
  it('selects Online separately for target evidence', async () => {
    const source = owner('source', 'WCMS_STAGED', 'authoring'),
      target = owner('target', 'WCMS_ONLINE', 'delivery', 'ONLINE');
    await loadWorkbenchMetric(
      {
        ...definition,
        ownerSelector: { runtimeRoleCode: 'WCMS_ONLINE', publicationRole: 'ONLINE' },
      },
      [schema(source), schema(target)],
      bootstrap([source, target]),
      config,
    );
    expect(clients.loadWorkbenchRecords.mock.calls[0]?.[0]).toBe(target);
  });
  it.each([
    'missing',
    'duplicate',
    'down',
    'foreign-origin',
    'wrong-environment',
    'wrong-instance',
    'unqualified-ambiguous',
  ])(
    'keeps %s evidence unavailable without querying another runtime',
    async (scenario) => {
      const source = owner('source', 'WCMS_STAGED', 'authoring'),
        other = owner('other', 'WCMS_STAGED', 'other');
      const connections =
        scenario === 'duplicate'
          ? [source, other]
          : scenario === 'missing'
            ? [owner('commerce', 'COMMERCE_STAGED', 'staged')]
            : scenario === 'down'
              ? [{ ...source, state: 'UNAVAILABLE' as const }]
              : [source];
      const original = schema(source),
        entry =
          scenario === 'foreign-origin'
            ? { ...original, connectionModuleName: 'cms' }
            : scenario === 'wrong-environment'
              ? { ...original, connectionEnvironment: 'elsewhere' }
              : scenario === 'wrong-instance'
                ? { ...original, connectionInstanceId: 'retired' }
                : original;
      const selected =
        scenario === 'unqualified-ambiguous'
          ? { ...definition, ownerSelector: undefined }
          : definition;
      const result = await loadWorkbenchMetric(
        selected,
        scenario === 'unqualified-ambiguous' ? [entry, schema(other)] : [entry],
        bootstrap(connections),
        config,
      );
      expect(result).toMatchObject({ status: 'unavailable', value: undefined });
      expect(clients.loadWorkbenchRecords).not.toHaveBeenCalled();
    },
  );
  it.each(['ACTIVE', 'PREVIEW', 'DISABLED', 'HIDDEN', 'UNAVAILABLE', 'ABSENT'])(
    'opens only admitted metric destinations (%s)',
    async (state) => {
      const source = owner('source', 'WCMS_STAGED', 'authoring');
      const context = bootstrap([source]);
      const navigation =
        state === 'ABSENT'
          ? []
          : [
              {
                id: 'requests',
                label: 'Requests',
                route: definition.route,
                order: 1,
                moduleName: 'publish',
                category: 'content',
                icon: 'workflow',
                availability:
                  state === 'UNAVAILABLE' ? ('UNAVAILABLE' as const) : ('UP' as const),
                featureState:
                  state === 'UNAVAILABLE'
                    ? ('ACTIVE' as const)
                    : (state as 'ACTIVE' | 'PREVIEW' | 'DISABLED' | 'HIDDEN'),
              },
            ];
      const result = await loadWorkbenchMetric(
        definition,
        [schema(source)],
        { ...context, navigation },
        config,
      );
      expect(result.status).toBe('ready');
      expect(result.canOpen).toBe(['ACTIVE', 'PREVIEW'].includes(state));
    },
  );
  it('passes only the selected source coordinates into an admitted publication handoff', async () => {
    const source = owner('source', 'WCMS_STAGED', 'authoring-one');
    const context = bootstrap([source]);
    const navigation = [
      {
        id: 'requests',
        label: 'Requests',
        route: definition.route,
        order: 1,
        moduleName: 'publish',
        category: 'content',
        icon: 'workflow',
        availability: 'UP' as const,
        featureState: 'ACTIVE' as const,
      },
    ];
    const result = await loadWorkbenchMetric(
      { ...definition, includeSourceContext: true },
      [schema(source)],
      { ...context, navigation },
      config,
    );
    const link = new URL(result.href ?? '', 'http://axis.example.test');
    expect(result.canOpen).toBe(true);
    expect(link.pathname).toBe('/publishing/requests');
    expect(link.searchParams.get('sourceServer')).toBe(source.server);
    expect(link.searchParams.get('sourceEnvironment')).toBe(source.environment);
    expect(result.href).not.toContain(config.accessToken);
  });
  it('retains genuine empty observations from the exact owner', async () => {
    const source = owner('source', 'WCMS_STAGED', 'authoring');
    clients.loadWorkbenchRecords.mockResolvedValue({
      records: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 20,
    });
    expect(
      await loadWorkbenchMetric(
        definition,
        [schema(source)],
        bootstrap([source]),
        config,
      ),
    ).toMatchObject({ status: 'ready', value: 0 });
  });
});

it('deduplicates exact metric schema reads and refuses foreign or denied descriptors without fallback', async () => {
  const source = owner('source', 'WCMS_STAGED', 'authoring');
  clients.loadGeneratedSchemaCapabilities.mockResolvedValueOnce(schema(source));
  const results = await loadWorkbenchMetrics([source], bootstrap([source]), config, [
    definition,
    { ...definition, id: 'same-schema' },
  ]);
  expect(results.every((item) => item.status === 'ready')).toBe(true);
  expect(clients.loadGeneratedSchemaCapabilities).toHaveBeenCalledOnce();
  clients.loadGeneratedSchemaCapabilities.mockClear();
  clients.loadWorkbenchRecords.mockClear();
  clients.loadGeneratedSchemaCapabilities.mockResolvedValueOnce({
    ...schema(source),
    moduleName: 'foreign',
  });
  const foreign = await loadWorkbenchMetrics([source], bootstrap([source]), config, [
    definition,
  ]);
  expect(foreign[0]?.status).toBe('unavailable');
  expect(clients.loadWorkbenchRecords).not.toHaveBeenCalled();
  clients.loadGeneratedSchemaCapabilities.mockRejectedValueOnce(new Error('Denied'));
  const denied = await loadWorkbenchMetrics([source], bootstrap([source]), config, [
    definition,
  ]);
  expect(denied[0]?.status).toBe('unavailable');
  expect(clients.loadWorkbenchSchemas).not.toHaveBeenCalled();
});
