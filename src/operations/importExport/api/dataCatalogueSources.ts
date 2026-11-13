import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';

/** Browser-only read provenance. API parsers never accept this annotation from an owner payload. */
export interface DataCatalogueObservation {
  readonly catalogueSource?: AxisModuleConnection | undefined;
}

/** Binds parsed owner evidence to the exact authorized API that returned it, without changing business fields. */
export function withDataCatalogueSource<T extends object>(
  items: readonly T[],
  connection: AxisModuleConnection,
): readonly (T & DataCatalogueObservation)[] {
  return Object.freeze(
    items.map((item) => Object.freeze({ ...item, catalogueSource: connection })),
  );
}

/** Separates UI identity at independent runtimes; never send this browser key as an owner release/profile code. */
export function sourceAwareCatalogueKey(
  item: DataCatalogueObservation,
  ownerKey: string,
): string {
  return item.catalogueSource
    ? JSON.stringify([dataCatalogueSourceKey(item.catalogueSource), ownerKey])
    : ownerKey;
}

/** Names the actual read/command runtime; legacy release destination labels do not select transport. */
export function dataCatalogueRuntimeLabel(
  item: DataCatalogueObservation,
): string | undefined {
  const source = item.catalogueSource;
  return source
    ? `Runtime ${source.runtimeRole?.code ?? source.environment} · ${source.server ?? source.instanceId}`
    : undefined;
}

export interface DataCatalogueSource {
  readonly key: string;
  readonly connection: AxisModuleConnection;
  readonly problem?: 'UNAVAILABLE' | 'AMBIGUOUS' | 'INVALID' | undefined;
}
export interface DataCatalogueSourceState {
  readonly source: DataCatalogueSource;
  readonly status: 'LOADING' | 'LOADED' | 'FAILED' | 'UNAVAILABLE';
  readonly message?: string | undefined;
}
export interface DataCatalogueRead<T> {
  readonly data: readonly T[];
  /** Original read provenance only; nImport still owns every status and execution decision. */
  readonly origins: ReadonlyMap<string, AxisModuleConnection>;
  readonly sources: readonly DataCatalogueSourceState[];
  readonly conflicts: readonly string[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly isSuccess: boolean;
  readonly isPartial: boolean;
  readonly error?: Error | undefined;
}
export interface DataCatalogueQuery<T> {
  readonly data?: readonly T[] | undefined;
  readonly isFetching: boolean;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly error?: unknown;
}

/** Stable authority coordinates exclude catalogue heartbeat timestamps and credentials. */
export function dataCatalogueSourceKey(connection: AxisModuleConnection): string {
  let endpoint = 'INVALID_ENDPOINT';
  try {
    const parsed = new URL(connection.endpoint);
    if (
      ['http:', 'https:'].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash
    )
      endpoint = parsed.href;
  } catch {
    /* Invalid endpoint text never enters a private query key. */
  }
  return JSON.stringify([
    connection.moduleName,
    connection.instanceId,
    endpoint,
    connection.environment,
    connection.server,
    connection.runtimeRole?.code,
    connection.runtimeRole?.publication,
    connection.state,
  ]);
}

/** Keep unavailable authorized sources visible as coverage, but never request Online, invalid or ambiguous destinations. */
export function dataCatalogueSources(
  connections: readonly AxisModuleConnection[],
  platformFallback: AxisModuleConnection,
): readonly DataCatalogueSource[] {
  const candidates = connections.filter(
    (connection) => connection.runtimeRole?.publication !== 'ONLINE',
  );
  if (!candidates.some((connection) => connection.runtimeRole?.code === 'PLATFORM'))
    candidates.push(platformFallback);
  const grouped = new Map<string, AxisModuleConnection[]>();
  for (const connection of candidates)
    grouped.set(connection.instanceId, [
      ...(grouped.get(connection.instanceId) ?? []),
      connection,
    ]);
  return Object.freeze(
    [...grouped.values()]
      .map((group) => {
        const connection = group[0]!;
        const key = JSON.stringify(group.map(dataCatalogueSourceKey).sort());
        if (group.length !== 1)
          return { key, connection, problem: 'AMBIGUOUS' as const };
        try {
          const endpoint = new URL(connection.endpoint);
          if (
            connection.moduleName !== 'import' ||
            !connection.runtimeRole?.code ||
            !connection.runtimeRole.publication ||
            !['http:', 'https:'].includes(endpoint.protocol) ||
            endpoint.username ||
            endpoint.password ||
            endpoint.search ||
            endpoint.hash
          ) {
            return { key, connection, problem: 'INVALID' as const };
          }
        } catch {
          return { key, connection, problem: 'INVALID' as const };
        }
        return {
          key,
          connection,
          ...(!['UP', 'DEGRADED'].includes(connection.state)
            ? { problem: 'UNAVAILABLE' as const }
            : {}),
        };
      })
      .sort((left, right) => left.key.localeCompare(right.key)),
  );
}

/** Query observers may finish independently; only fresh successful owner evidence becomes an actionable row. */
export function combineDataCatalogueReads<T>(
  sources: readonly DataCatalogueSource[],
  queries: readonly DataCatalogueQuery<T>[],
  itemKey: (item: T) => string,
  belongsToSource: (item: T, connection: AxisModuleConnection) => boolean,
): DataCatalogueRead<T> {
  const items = new Map<string, T>(),
    origins = new Map<string, AxisModuleConnection>();
  const conflicts = new Set<string>();
  const states: DataCatalogueSourceState[] = sources.map((source, index) => {
    if (source.problem)
      return { source, status: 'UNAVAILABLE', message: source.problem };
    const query = queries[index];
    if (!query || query.isFetching || query.isPending)
      return { source, status: 'LOADING' };
    if (query.isError || query.data === undefined)
      return {
        source,
        status: 'FAILED',
        message:
          query.error instanceof Error
            ? query.error.message.slice(0, 500)
            : 'Source read could not be verified.',
      };
    for (const item of query.data) {
      if (!belongsToSource(item, source.connection)) continue;
      const key = itemKey(item);
      if (items.has(key) || conflicts.has(key)) {
        conflicts.add(key);
        items.delete(key);
        origins.delete(key);
      } else {
        items.set(key, item);
        origins.set(key, source.connection);
      }
    }
    return { source, status: 'LOADED' };
  });
  const loaded = states.filter((state) => state.status === 'LOADED').length;
  const pending = states.filter((state) => state.status === 'LOADING').length;
  const failure = states.find(
    (state) => state.status === 'FAILED' || state.status === 'UNAVAILABLE',
  );
  return Object.freeze({
    data: Object.freeze([...items.values()]),
    origins,
    sources: Object.freeze(states),
    conflicts: Object.freeze([...conflicts]),
    isLoading: loaded === 0 && pending > 0,
    isError: loaded === 0 && pending === 0,
    isSuccess: loaded > 0,
    isPartial: states.some((state) => state.status !== 'LOADED') || conflicts.size > 0,
    ...(loaded === 0 && pending === 0
      ? { error: new Error(failure?.message ?? 'No catalogue source is available.') }
      : {}),
  });
}
