import { describe, expect, it } from 'vitest';
import type { AxisModuleConnection } from '../../../src/bootstrap/publicBootstrap';
import {
  combineDataCatalogueReads,
  dataCatalogueSourceKey,
  dataCatalogueSources,
  type DataCatalogueQuery,
} from '../../../src/operations/importExport/api/dataCatalogueSources';

const staged: AxisModuleConnection = {
  moduleName: 'import',
  instanceId: 'staged',
  endpoint: 'http://localhost:4312/nodics/import',
  environment: 'local',
  server: 'content',
  runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
  state: 'UP',
};
const platform: AxisModuleConnection = {
  ...staged,
  instanceId: 'platform',
  endpoint: 'http://localhost:4300/nodics/import',
  server: 'platform',
  runtimeRole: { code: 'PLATFORM', publication: 'OPERATIONAL' },
};
type Row = { code: string; destinationRole: string; state: string };
const row: Row = {
  code: 'editorial:init-v001',
  destinationRole: 'WCMS_STAGED',
  state: 'CURRENT',
};
const fresh = (data: readonly Row[]): DataCatalogueQuery<Row> => ({
  data,
  isFetching: false,
  isPending: false,
  isError: false,
});
const belongs = (item: Row, source: AxisModuleConnection) =>
  item.destinationRole === source.runtimeRole?.code;
const key = (item: Row) => item.code;

describe('private source-aware catalogue observation', () => {
  it('adds only the existing primary fallback and never queries Online or unavailable sources', () => {
    const offline = {
      ...staged,
      instanceId: 'offline',
      state: 'UNAVAILABLE',
    } as AxisModuleConnection;
    const online = {
      ...staged,
      instanceId: 'online',
      runtimeRole: { code: 'WCMS_ONLINE', publication: 'ONLINE' },
    };
    const sources = dataCatalogueSources([staged, offline, online], platform);
    expect(sources.map((source) => source.connection.instanceId).sort()).toEqual([
      'offline',
      'platform',
      'staged',
    ]);
    expect(
      sources.find((source) => source.connection.instanceId === 'offline')?.problem,
    ).toBe('UNAVAILABLE');
    expect(dataCatalogueSources([platform], platform)).toHaveLength(1);
  });

  it('preserves a known unavailable Platform instead of replacing it with a different fallback', () => {
    const down = { ...platform, state: 'UNAVAILABLE' } as AxisModuleConnection;
    const sources = dataCatalogueSources([down], platform);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.connection).toBe(down);
    expect(sources[0]?.problem).toBe('UNAVAILABLE');
  });

  it('keeps missing runtime authority visible but never requests that source', () => {
    const { runtimeRole: _role, ...missingRole } = staged;
    expect(_role?.code).toBe('WCMS_STAGED');
    const sources = dataCatalogueSources([missingRole], platform);
    expect(
      sources.find((source) => source.connection.instanceId === 'staged')?.problem,
    ).toBe('INVALID');
  });

  it('rejects duplicate instance authority and excludes unsafe endpoint content from keys', () => {
    const sources = dataCatalogueSources(
      [staged, { ...staged, endpoint: 'http://localhost:9999/nodics/import' }],
      platform,
    );
    expect(
      sources.find((source) => source.connection.instanceId === 'staged')?.problem,
    ).toBe('AMBIGUOUS');
    const unsafe = {
      ...staged,
      endpoint: 'https://private-user:private-secret@localhost/nodics/import',
    };
    const rejected = dataCatalogueSources([unsafe], platform).find(
      (source) => source.connection.instanceId === 'staged',
    );
    expect(rejected?.problem).toBe('INVALID');
    expect(rejected?.key).not.toContain('private-secret');
    expect(dataCatalogueSourceKey(unsafe)).not.toContain('private-user');
  });

  it('shows a healthy source while another read is still pending and never claims complete coverage', () => {
    const sources = dataCatalogueSources([staged, platform], platform);
    const queries = sources.map((source) =>
      source.connection.instanceId === 'staged'
        ? fresh([row])
        : { isFetching: true, isPending: true, isError: false },
    );
    const result = combineDataCatalogueReads(sources, queries, key, belongs);
    expect(result.data).toEqual([row]);
    expect(result.origins.get(row.code)).toBe(staged);
    expect(result.isSuccess).toBe(true);
    expect(result.isPartial).toBe(true);
    expect(result.sources.map((source) => source.status).sort()).toEqual([
      'LOADED',
      'LOADING',
    ]);
  });

  it('surfaces a failed source even when another returns an empty successful catalogue', () => {
    const sources = dataCatalogueSources([staged, platform], platform);
    const queries = sources.map((source) =>
      source.connection.instanceId === 'staged'
        ? {
            isFetching: false,
            isPending: false,
            isError: true,
            error: new Error('Denied'),
          }
        : fresh([]),
    );
    const result = combineDataCatalogueReads(sources, queries, key, belongs);
    expect(result.data).toEqual([]);
    expect(result.isPartial).toBe(true);
    expect(
      result.sources.some(
        (source) => source.status === 'FAILED' && source.message === 'Denied',
      ),
    ).toBe(true);
  });

  it('hides retained rows during refresh and after failure rather than treating them as fresh', () => {
    const sources = dataCatalogueSources([staged], platform);
    for (const state of [
      { isFetching: true, isError: false },
      { isFetching: false, isError: true },
    ]) {
      const result = combineDataCatalogueReads(
        sources,
        sources.map((source) =>
          source.connection === staged ? { ...fresh([row]), ...state } : fresh([]),
        ),
        key,
        belongs,
      );
      expect(result.data).toEqual([]);
      expect(result.origins.has(row.code)).toBe(false);
      expect(result.isPartial).toBe(true);
    }
  });

  it('keeps destination-qualified owner truth and refuses conflicting or duplicated release identities', () => {
    const sources = dataCatalogueSources([staged, platform], platform);
    const result = combineDataCatalogueReads(
      sources,
      sources.map((source) =>
        source.connection === staged
          ? fresh([row])
          : fresh([{ ...row, state: 'NOT_INSTALLED' }]),
      ),
      key,
      belongs,
    );
    expect(result.data).toEqual([row]);
    expect(result.origins.get(row.code)).toBe(staged);
    const conflict = combineDataCatalogueReads(
      sources,
      sources.map((source) =>
        fresh([{ ...row, destinationRole: source.connection.runtimeRole!.code }]),
      ),
      key,
      belongs,
    );
    expect(conflict.data).toEqual([]);
    expect(conflict.conflicts).toEqual([row.code]);
    expect(conflict.origins.has(row.code)).toBe(false);
    expect(conflict.isPartial).toBe(true);
    const duplicate = combineDataCatalogueReads(
      sources,
      sources.map((source) =>
        source.connection === staged ? fresh([row, row]) : fresh([]),
      ),
      key,
      belongs,
    );
    expect(duplicate.data).toEqual([]);
    expect(duplicate.conflicts).toEqual([row.code]);
  });

  it('keeps failed-only observation distinct from a complete empty owner catalogue', () => {
    const sources = dataCatalogueSources([platform], platform);
    const failed = combineDataCatalogueReads(
      sources,
      [
        {
          isFetching: false,
          isPending: false,
          isError: true,
          error: new Error('Unavailable'),
        },
      ],
      key,
      belongs,
    );
    expect(failed.isError).toBe(true);
    expect(failed.error?.message).toBe('Unavailable');
    expect(failed.isSuccess).toBe(false);
    const empty = combineDataCatalogueReads(sources, [fresh([])], key, belongs);
    expect(empty.isSuccess).toBe(true);
    expect(empty.isPartial).toBe(false);
    expect(empty.isError).toBe(false);
  });
});
