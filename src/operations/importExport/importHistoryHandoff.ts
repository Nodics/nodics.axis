/** Read-only Import history handoff. Navigation and connection authority stay
 * in the authenticated catalogue; URL selectors never create a connection. */
import type {
  AxisAuthenticatedBootstrap,
  AxisModuleConnection,
} from '../../bootstrap/publicBootstrap';

export interface ImportHistoryHandoff {
  readonly contractVersion: 1;
  readonly owner: 'import';
  readonly action: 'REVIEW_IMPORT_HISTORY';
  readonly available: boolean;
  readonly readOnly: true;
  readonly automaticExecution: false;
  readonly route?: string;
  readonly importInstance?: string;
  readonly targetServer?: string;
  readonly targetRuntimeRole?: string;
}

/** Admits the versioned owner projection without inventing a missing route or target. */
export function parseImportHistoryHandoff(
  value: unknown,
): ImportHistoryHandoff | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Import history handoff is incompatible');
  const source = value as Record<string, unknown>;
  if (
    source.contractVersion !== 1 ||
    source.owner !== 'import' ||
    source.action !== 'REVIEW_IMPORT_HISTORY' ||
    typeof source.available !== 'boolean' ||
    source.readOnly !== true ||
    source.automaticExecution !== false
  )
    throw new Error('Import history handoff is incompatible');
  const base = {
    contractVersion: 1,
    owner: 'import',
    action: 'REVIEW_IMPORT_HISTORY',
    available: source.available,
    readOnly: true,
    automaticExecution: false,
  } as const;
  if (!source.available) return Object.freeze(base);
  const { route, importInstance, targetServer, targetRuntimeRole } = source;
  if (
    typeof route !== 'string' ||
    route.length > 1_024 ||
    typeof importInstance !== 'string' ||
    !/^[A-Za-z0-9_.:-]{1,256}$/.test(importInstance) ||
    typeof targetServer !== 'string' ||
    !/^[A-Za-z0-9_.:-]{1,256}$/.test(targetServer) ||
    typeof targetRuntimeRole !== 'string' ||
    !/^[A-Z][A-Z0-9_]{1,63}$/.test(targetRuntimeRole)
  )
    throw new Error('Import history handoff is incompatible');
  const parts = route.split('?');
  const path = parts[0]!;
  if (
    parts.length !== 2 ||
    !/^\/(?!\/)[A-Za-z0-9_/-]{1,510}$/.test(path) ||
    path.split('/').some((part) => part === '.' || part === '..') ||
    route.includes('#')
  )
    throw new Error('Import history handoff route is incompatible');
  const query = new URLSearchParams(parts[1]);
  if (
    [...query.keys()].length !== 2 ||
    query.getAll('area').length !== 1 ||
    query.get('area') !== 'history' ||
    query.getAll('importInstance').length !== 1 ||
    query.get('importInstance') !== importInstance
  )
    throw new Error('Import history handoff selectors are incompatible');
  return Object.freeze({
    ...base,
    route,
    importInstance,
    targetServer,
    targetRuntimeRole,
  });
}

/** Rechecks the exact published selector against current navigation and connection authority. */
export function resolveImportHistoryHandoff(
  bootstrap: AxisAuthenticatedBootstrap,
  handoff: ImportHistoryHandoff | undefined,
): string | undefined {
  if (!handoff?.available || !handoff.route || !handoff.importInstance)
    return undefined;
  const connection = importHistoryConnection(bootstrap, handoff.importInstance);
  if (
    !connection ||
    connection.server !== handoff.targetServer ||
    connection.runtimeRole?.code !== handoff.targetRuntimeRole
  )
    return undefined;
  const routes = bootstrap.navigation.filter(
    (item) =>
      item.id === 'imports-exports' &&
      item.moduleName === 'backoffice' &&
      ['UP', 'DEGRADED'].includes(item.availability) &&
      (item.featureState === undefined || item.featureState === 'ACTIVE') &&
      item.route === handoff.route?.split('?')[0],
  );
  return routes.length === 1 ? handoff.route : undefined;
}

export function importHistoryConnection(
  bootstrap: AxisAuthenticatedBootstrap,
  instanceId: string,
): AxisModuleConnection | undefined {
  if (
    !instanceId ||
    instanceId.length > 256 ||
    Array.from(instanceId).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return undefined;
  const matches = (bootstrap.moduleConnections.import ?? []).filter(
    (connection) =>
      connection.instanceId === instanceId &&
      ['UP', 'DEGRADED'].includes(connection.state),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

/** Uses exact owner target evidence, never a historical run as failed-attempt proof. */
export function importHistoryRoute(
  bootstrap: AxisAuthenticatedBootstrap,
  target: { targetServer?: string | undefined; targetRuntimeRole?: string | undefined },
  runId?: string,
): string | undefined {
  const navigation = bootstrap.navigation.find(
    (item) =>
      item.id === 'imports-exports' &&
      item.moduleName === 'backoffice' &&
      ['UP', 'DEGRADED'].includes(item.availability) &&
      (item.featureState === undefined || item.featureState === 'ACTIVE') &&
      item.route.startsWith('/') &&
      !item.route.startsWith('//'),
  );
  if (!navigation || !target.targetServer || !target.targetRuntimeRole)
    return undefined;
  const matches = (bootstrap.moduleConnections.import ?? []).filter(
    (connection) =>
      connection.server === target.targetServer &&
      connection.runtimeRole?.code === target.targetRuntimeRole &&
      ['UP', 'DEGRADED'].includes(connection.state),
  );
  if (matches.length !== 1) return undefined;
  const query = new URLSearchParams({
    area: 'history',
    importInstance: matches[0]!.instanceId,
  });
  if (runId && /^[A-Za-z0-9_.:-]{1,192}$/.test(runId)) query.set('importRun', runId);
  return `${navigation.route}?${query.toString()}`;
}
