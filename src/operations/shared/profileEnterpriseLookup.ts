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
import type { OperationalOwnerConfiguration } from './operationalOwnerClient';

export type ProfileEnterpriseOption = { code: string; label: string };

/** Uses the same discovered Profile schema and bounded safe search as Enterprise workbenches. */
export async function searchProfileEnterprises(
  configuration: OperationalOwnerConfiguration,
  search: string,
  signal?: AbortSignal,
): Promise<ProfileEnterpriseOption[]> {
  const connection = selectModuleConnection(configuration.bootstrap, 'profile');
  if (!connection) throw new Error('Enterprise lookup is unavailable.');
  const schemas = await loadWorkbenchSchemas([connection], configuration);
  const discovered = schemas.find(
    (schema) => schema.moduleName === 'profile' && schema.schemaName === 'enterprise',
  );
  if (!discovered) throw new Error('Enterprise lookup is unavailable.');
  const schema = schemaWithValidQueryCapabilities(discovered);
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
  const choices = page.records
    .filter((row) => row.active === true)
    .map((row) => {
      if (typeof row.code !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(row.code))
        throw new Error('Enterprise lookup is invalid.');
      const name = typeof row.name === 'string' ? row.name : row.code;
      return {
        code: row.code,
        label: name === row.code ? name : `${name} (${row.code})`,
      };
    });
  if (new Set(choices.map((row) => row.code)).size !== choices.length)
    throw new Error('Enterprise lookup is ambiguous.');
  return choices;
}
