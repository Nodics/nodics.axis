import type {
  AxisAuthenticatedBootstrap,
  AxisModuleConnection,
} from '../../bootstrap/publicBootstrap';
import {
  loadGeneratedSchemaCapabilities,
  type WorkbenchClientConfiguration,
} from '../api/workbenchClient';
import {
  isWorkbenchAuthoringSchema,
  type WorkbenchSchema,
} from '../api/workbenchContracts';
import { resolveWorkbenchRelationshipSchema } from './workbenchRelatedDrafts';

export interface WorkbenchRelationshipTarget {
  readonly moduleName: string;
  readonly schemaName: string;
  readonly connection: AxisModuleConnection;
}

/** Discover only declared foreign targets, preserving exact local authority and refusing ambiguous remote copies. */
export function planWorkbenchRelationshipDiscovery(
  source: WorkbenchSchema | undefined,
  known: readonly WorkbenchSchema[],
  bootstrap: AxisAuthenticatedBootstrap,
): readonly WorkbenchRelationshipTarget[] {
  if (!source?.connectionEnvironment || !source.connectionServer) return [];
  const targets = new Map<string, WorkbenchRelationshipTarget>();
  for (const relation of source.relationships) {
    if (
      relation.targetModule === source.moduleName ||
      resolveWorkbenchRelationshipSchema(known, source, relation)
    )
      continue;
    if (
      ![relation.targetModule, relation.targetSchema].every((value) =>
        /^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(value),
      )
    )
      continue;
    const candidates = (
      bootstrap.moduleConnections[relation.targetModule] ?? []
    ).filter(
      (connection) =>
        connection.moduleName === relation.targetModule &&
        connection.state === 'UP' &&
        connection.environment === source.connectionEnvironment &&
        connection.runtimeRole?.publication !== 'ONLINE',
    );
    const local = candidates.filter(
      (connection) => connection.server === source.connectionServer,
    );
    const admitted = local.length ? local : candidates;
    if (admitted.length !== 1) continue;
    const connection = admitted[0]!;
    let endpoint: URL;
    try {
      endpoint = new URL(connection.endpoint);
    } catch {
      continue;
    }
    if (
      !['http:', 'https:'].includes(endpoint.protocol) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    )
      continue;
    targets.set(`${relation.targetModule}:${relation.targetSchema}`, {
      moduleName: relation.targetModule,
      schemaName: relation.targetSchema,
      connection,
    });
  }
  if (targets.size > 32)
    throw new Error('The related schema request exceeds the supported boundary');
  return Object.freeze([...targets.values()]);
}

/** Read one canonical target descriptor; denied, wrong-owner and Online evidence never falls back to another route/runtime. */
export async function loadWorkbenchRelationshipTarget(
  target: WorkbenchRelationshipTarget,
  configuration: WorkbenchClientConfiguration,
  fetcher: typeof fetch = fetch,
): Promise<WorkbenchSchema> {
  const schema = await loadGeneratedSchemaCapabilities(
    target.connection,
    { schemaName: target.schemaName },
    configuration,
    fetcher,
  );
  if (
    schema.moduleName !== target.moduleName ||
    schema.schemaName !== target.schemaName ||
    !isWorkbenchAuthoringSchema(schema) ||
    !schema.operations.includes('search') ||
    !schema.operations.includes('read')
  ) {
    throw new Error('The related schema owner or readable source is incompatible');
  }
  return schema;
}

/** Hide retained metadata after a failed refresh; TanStack shares this combined projection when evidence is unchanged. */
export function combineWorkbenchRelationshipQueries(
  results: readonly {
    readonly isError: boolean;
    readonly data?: WorkbenchSchema | undefined;
  }[],
): readonly WorkbenchSchema[] {
  return results.flatMap((result) =>
    !result.isError && result.data ? [result.data] : [],
  );
}
