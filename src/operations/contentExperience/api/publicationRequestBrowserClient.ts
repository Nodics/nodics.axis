import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import {
  loadWorkbenchRecords,
  loadWorkbenchSchemas,
} from '../../../workbench/api/workbenchClient';
import {
  resolveWorkbenchRecordSort,
  schemaWithValidQueryCapabilities,
} from '../../../workbench/workbenchRouteModel';
import type { ContentDesignerClientConfiguration } from './contentDesignerClient';
import { validPublicationCode } from './publicationInspectionClient';

export interface PublicationSummary {
  readonly code: string;
  readonly state: string;
  readonly domain: string;
  readonly rootCode: string;
  readonly sourceVersion: string;
  readonly revision: number;
}
export interface PublicationSummaryPage {
  readonly records: readonly PublicationSummary[];
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly totalCount: number;
}
/** Browses the selected owner's admitted read-only schema. It never selects another source or invokes lifecycle commands. */
export async function loadPublicationRequestPage(
  source: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  selection: Readonly<{ search: string; pageNumber: number }>,
): Promise<PublicationSummaryPage> {
  if (
    source.moduleName !== 'publish' ||
    !['UP', 'DEGRADED'].includes(source.state) ||
    selection.search.length > 200 ||
    !Number.isSafeInteger(selection.pageNumber) ||
    selection.pageNumber < 1
  )
    throw new Error('Publication source or page is unavailable.');
  const schemas = await loadWorkbenchSchemas([source], configuration);
  if (schemas.some((schema) => schema.moduleName !== 'publish'))
    throw new Error('Publication source returned an incompatible catalogue.');
  const matches = schemas.filter(
    (schema) =>
      schema.schemaName === 'publicationRequest' &&
      schema.connectionInstanceId === source.instanceId,
  );
  if (
    matches.length !== 1 ||
    matches[0]!.mutationMode !== 'READ_ONLY' ||
    !matches[0]!.operations.includes('search')
  )
    throw new Error(
      'This source does not offer a publication request list. Use an exact reference to inspect a request.',
    );
  const schema = schemaWithValidQueryCapabilities(matches[0]!);
  const allowed = schema.queryCapabilities.allowedPageSizes.filter(
    (size) =>
      size > 0 && size <= Math.min(25, schema.queryCapabilities.maximumPageSize),
  );
  const pageSize = allowed.includes(10) ? 10 : allowed[0];
  if (!pageSize)
    throw new Error('The publication source does not offer a bounded request page.');
  const sort = schema.queryCapabilities.sortableFields.includes('created')
    ? { field: 'created', direction: 'DESC' as const }
    : resolveWorkbenchRecordSort(schema, undefined);
  const result = await loadWorkbenchRecords(source, schema, configuration, {
    search: selection.search.trim(),
    pageNumber: selection.pageNumber,
    pageSize,
    sort,
  });
  if (
    result.pageNumber !== selection.pageNumber ||
    result.pageSize !== pageSize ||
    result.records.length > pageSize ||
    !Number.isSafeInteger(result.totalCount) ||
    result.totalCount < result.records.length
  )
    throw new Error('Publication request page could not be confirmed.');
  const scalar = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() && value.length <= 512
      ? value
      : typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
        ? String(value)
        : undefined;
  const plainText = (value: unknown) =>
    typeof value === 'string' && value.trim() && value.length <= 512
      ? value
      : undefined;
  const codes = new Set<string>();
  const records = result.records.map((record) => {
    const code = plainText(record.code),
      state = plainText(record.state),
      domain = plainText(record.domain),
      rootCode = plainText(record.rootCode),
      sourceVersion = scalar(record.sourceVersion),
      revision = record.revision;
    if (
      !code ||
      !validPublicationCode(code) ||
      codes.has(code) ||
      !state ||
      state.length > 64 ||
      !domain ||
      !rootCode ||
      sourceVersion === undefined ||
      typeof revision !== 'number' ||
      !Number.isSafeInteger(revision) ||
      revision < 0
    )
      throw new Error('Publication request rows could not be confirmed.');
    codes.add(code);
    return Object.freeze({ code, state, domain, rootCode, sourceVersion, revision });
  });
  return Object.freeze({
    records: Object.freeze(records),
    pageNumber: result.pageNumber,
    pageSize: result.pageSize,
    totalCount: result.totalCount,
  });
}
