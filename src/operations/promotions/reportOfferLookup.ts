import { selectModuleConnection } from '../../bootstrap/publicBootstrap';
import {
  loadWorkbenchRecords,
  loadWorkbenchSchemas,
} from '../../workbench/api/workbenchClient';
import {
  resolveWorkbenchLookupPageSize,
  resolveWorkbenchRecordSort,
  schemaWithValidQueryCapabilities,
} from '../../workbench/workbenchRouteModel';
import type { OperationalOwnerConfiguration } from '../shared/operationalOwnerClient';

export type ReportOfferOption = { code: string; name: string };

/** Reuses Promotion's advertised ordinary campaign search; names are choices, never report permission. */
export async function searchReportOffers(
  configuration: OperationalOwnerConfiguration,
  search: string,
  signal?: AbortSignal,
): Promise<ReportOfferOption[]> {
  const authoring = configuration.bootstrap.navigation.find(
    (item) =>
      item.moduleName === 'promotion' &&
      item.backendWorkspace?.workspaceCode === 'promotion.couponOffers' &&
      item.backendWorkspace.viewCode === 'authoring',
  );
  if (
    !authoring ||
    !['ACTIVE', 'PREVIEW'].includes(authoring.featureState || '') ||
    !['UP', 'DEGRADED'].includes(authoring.availability) ||
    authoring.backendWorkspace?.ownerSelector?.runtimeRoleCode !== 'COMMERCE_STAGED' ||
    authoring.backendWorkspace.ownerSelector.publicationRole !== 'STAGED'
  )
    throw new Error('Offer lookup is unavailable.');
  const connection = selectModuleConnection(
    configuration.bootstrap,
    'promotion',
    authoring.backendWorkspace.ownerSelector,
  );
  const discovery = configuration.bootstrap.navigation.find(
    (item) =>
      item.moduleName === 'promotion' &&
      item.workbenchTarget?.schemaName === 'promotion',
  )?.workbenchPresentation?.schemaDiscovery;
  if (!connection || !discovery) throw new Error('Offer lookup is unavailable.');
  const schemas = await loadWorkbenchSchemas([connection], configuration, fetch, {
    moduleName: 'promotion',
    descriptor: discovery,
  });
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const selected = schemas.find(
    (schema) => schema.moduleName === 'promotion' && schema.schemaName === 'promotion',
  );
  if (!selected) throw new Error('Offer lookup is unavailable.');
  const schema = schemaWithValidQueryCapabilities(selected);
  const page = await loadWorkbenchRecords(
    connection,
    schema,
    configuration,
    {
      search,
      pageNumber: 1,
      pageSize: resolveWorkbenchLookupPageSize(schema),
      sort: resolveWorkbenchRecordSort(schema, undefined),
    },
    fetch,
    signal,
  );
  const rows = page.records.map((row) => {
    if (
      typeof row.code !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/.test(row.code) ||
      typeof row.name !== 'string' ||
      !row.name.trim() ||
      Array.from(row.name).some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127;
      })
    )
      throw new Error('Offer lookup is invalid.');
    return { code: row.code, name: row.name };
  });
  if (new Set(rows.map((row) => row.code)).size !== rows.length)
    throw new Error('Offer lookup is ambiguous.');
  return rows;
}
