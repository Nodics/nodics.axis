import { describe, expect, it } from 'vitest';
import type { AxisModuleConnection } from '../../../src/bootstrap/publicBootstrap';
import type { WorkbenchSchema } from '../../../src/workbench/api/workbenchContracts';
import {
  fileImportRuntimeService,
  fileImportTargets,
} from '../../../src/operations/importExport/api/fileImportTargets';
import {
  dataOperationTargets,
  requestedExportSource,
} from '../../../src/operations/importExport/api/dataOperationTargets';

const owner: AxisModuleConnection = {
  moduleName: 'editorial',
  instanceId: 'editorial-wcms',
  endpoint: 'http://localhost:4312/nodics/editorial',
  environment: 'local',
  server: 'wcmsStagedServer',
  state: 'UP',
  runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
};
const importer: AxisModuleConnection = {
  ...owner,
  moduleName: 'import',
  instanceId: 'import-wcms',
  endpoint: 'http://localhost:4312/nodics/import',
};
const media: AxisModuleConnection = {
  ...owner,
  moduleName: 'media',
  instanceId: 'media-wcms',
  endpoint: 'http://localhost:4312/nodics/media',
};
const schema: WorkbenchSchema = {
  moduleName: 'editorial',
  schemaName: 'editorialAuthor',
  label: 'Authors',
  description: 'Author records',
  connectionModuleName: owner.moduleName,
  connectionInstanceId: owner.instanceId,
  connectionServer: owner.server,
  connectionEnvironment: owner.environment,
  displayProperty: 'code',
  displayProperties: ['code'],
  mutationMode: 'GENERATED_CRUD',
  operations: ['search', 'create'],
  fields: [],
  relationships: [],
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
};

describe('file intake runtime authority', () => {
  it('treats a Workbench model hint as exact current source selection without foreign or ambiguous fallback', () => {
    const target = {
      key: 'current',
      schema,
      source: owner,
      operationConnection: undefined,
      mediaConnection: undefined,
    };
    const search =
      '?sourceModule=editorial&sourceSchema=editorialAuthor&sourceInstance=editorial-wcms';
    expect(requestedExportSource(search, [target])).toBe(target);
    expect(requestedExportSource(search, [])).toBeUndefined();
    expect(
      requestedExportSource(search, [target, { ...target, key: 'ambiguous' }]),
    ).toBeUndefined();
    expect(
      requestedExportSource(search.replace('editorial-wcms', 'foreign'), [target]),
    ).toBeUndefined();
    expect(
      requestedExportSource('?sourceModule=editorial&sourceSchema=editorialAuthor', [
        target,
      ]),
    ).toBeUndefined();
  });
  it('uses the same exact source correlation for Export without an environment fallback', () => {
    const exporter = {
      ...importer,
      moduleName: 'export',
      instanceId: 'export-wcms',
      endpoint: 'http://localhost:4312/nodics/export',
    };
    const foreign = {
      ...exporter,
      server: 'anotherServer',
      instanceId: 'export-foreign',
      endpoint: 'http://localhost:4352/nodics/export',
    };
    expect(
      dataOperationTargets([schema], [owner], 'export', [foreign, exporter], [media])[0]
        ?.operationConnection,
    ).toBe(exporter);
    expect(
      dataOperationTargets([schema], [owner], 'export', [foreign], [media])[0]
        ?.operationConnection,
    ).toBeUndefined();
  });
  it('selects the owner among multiple Staged services regardless of catalogue order', () => {
    const commerce = {
      ...importer,
      instanceId: 'import-commerce',
      server: 'commerceStagedServer',
      endpoint: 'http://localhost:4352/nodics/import',
      runtimeRole: { code: 'COMMERCE_STAGED', publication: 'STAGED' },
    };
    expect(fileImportRuntimeService(owner, 'import', [commerce, importer])).toBe(
      importer,
    );
    expect(fileImportRuntimeService(owner, 'import', [importer, commerce])).toBe(
      importer,
    );
  });

  const unavailableCases: readonly (readonly [
    string,
    Partial<AxisModuleConnection>,
  ])[] = [
    ['server', { server: 'anotherServer' }],
    ['environment', { environment: 'anotherEnvironment' }],
    ['role', { runtimeRole: { code: 'COMMERCE_STAGED', publication: 'STAGED' } }],
    ['Online', { runtimeRole: { code: 'WCMS_STAGED', publication: 'ONLINE' } }],
    ['unavailable', { state: 'UNAVAILABLE' }],
    ['unsafe endpoint', { endpoint: 'https://user:secret@example.test/nodics/import' }],
    ['wrong service', { moduleName: 'export' }],
  ];
  it.each(unavailableCases)(
    'rejects %s without environment or first-service fallback',
    (_label, patch) => {
      expect(
        fileImportRuntimeService(owner, 'import', [{ ...importer, ...patch }]),
      ).toBeUndefined();
    },
  );

  it('rejects ambiguous matching instances and an unavailable source', () => {
    expect(
      fileImportRuntimeService(owner, 'import', [
        importer,
        { ...importer, instanceId: 'second-node' },
      ]),
    ).toBeUndefined();
    expect(
      fileImportRuntimeService({ ...owner, state: 'UNAVAILABLE' }, 'import', [
        importer,
      ]),
    ).toBeUndefined();
  });

  it('supports a unique legacy monolith only at the same origin with equally absent runtime coordinates', () => {
    const legacyOwner = { ...owner, server: undefined, runtimeRole: undefined };
    const legacyImport = { ...importer, server: undefined, runtimeRole: undefined };
    expect(fileImportRuntimeService(legacyOwner, 'import', [legacyImport])).toBe(
      legacyImport,
    );
    expect(
      fileImportRuntimeService(legacyOwner, 'import', [
        { ...legacyImport, endpoint: 'http://localhost:4352/nodics/import' },
      ]),
    ).toBeUndefined();
    expect(fileImportRuntimeService(legacyOwner, 'import', [importer])).toBeUndefined();
  });

  it('keeps an unavailable destination visible and cannot borrow another runtime Media owner', () => {
    const [target] = fileImportTargets(
      [schema],
      [owner],
      [importer],
      [{ ...media, server: 'other' }],
    );
    expect(target?.importConnection).toBe(importer);
    expect(target?.mediaConnection).toBeUndefined();
  });

  it('does not replace missing schema provenance with an arbitrary matching module', () => {
    expect(
      fileImportTargets(
        [{ ...schema, connectionInstanceId: 'retired' }],
        [owner],
        [importer],
        [media],
      ),
    ).toEqual([]);
  });

  it('prefers the canonical module alias within a runtime and preserves distinct destinations', () => {
    const alias = { ...owner, moduleName: 'database', instanceId: 'database-wcms' };
    const second = { ...owner, instanceId: 'editorial-second', server: 'secondServer' };
    const results = fileImportTargets(
      [
        {
          ...schema,
          connectionModuleName: alias.moduleName,
          connectionInstanceId: alias.instanceId,
        },
        schema,
        {
          ...schema,
          connectionInstanceId: second.instanceId,
          connectionServer: second.server,
        },
      ],
      [alias, owner, second],
      [importer],
      [media],
    );
    expect(results).toHaveLength(2);
    expect(
      results.find((target) => target.source.server === owner.server)?.source,
    ).toBe(owner);
    expect(new Set(results.map((target) => target.key)).size).toBe(2);
  });
});
