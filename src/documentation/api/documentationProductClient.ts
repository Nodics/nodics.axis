import type {
  AxisApplicationInitializationProfile,
  AxisDocumentationSource,
  AxisModuleConnection,
} from '../../bootstrap/publicBootstrap';
import {
  loadGeneratedSchemaCapabilities,
  loadWorkbenchRecords,
  type WorkbenchClientConfiguration,
} from '../../workbench/api/workbenchClient';
import type { WorkbenchRecord } from '../../workbench/api/workbenchContracts';

/** Reads a bounded identity from the owning CMS record, never from a URL guess. */
function text(value: unknown, label: string, maximum = 128): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error(`CMS documentation ${label} is invalid`);
  }
  return value;
}

/** Renders canonical product metadata with the existing profile's publication binding. */
export function projectDocumentationProducts(
  records: readonly WorkbenchRecord[],
  profiles: readonly AxisApplicationInitializationProfile[],
): readonly AxisDocumentationSource[] {
  const sources: AxisDocumentationSource[] = [];
  const ids = new Set<string>();
  const routes = new Set<string>();
  for (const product of records) {
    // Metadata eligibility does not prove publication; the reader separately checks Online readiness.
    if (
      (product.lifecycleState !== 'STAGED' &&
        product.lifecycleState !== 'APPROVED' &&
        product.lifecycleState !== 'ONLINE') ||
      product.accessMode !== 'PUBLIC' ||
      product.active === false ||
      product.status === 'INACTIVE'
    )
      continue;
    const site = text(product.site, 'Site');
    const matches = profiles.filter(
      (profile) =>
        profile.type === 'DOCUMENTATION_BUNDLE' &&
        profile.siteCode === site &&
        profile.contentPackCode,
    );
    if (!matches.length) continue;
    if (matches.length !== 1)
      throw new Error('CMS documentation publication binding is ambiguous');
    const profile = matches[0]!;
    const route = text(product.publicRootPath, 'route', 512);
    if (!/^\/docs\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(route)) {
      throw new Error('CMS documentation route is invalid');
    }
    const id = text(product.code, 'product code');
    if (ids.has(id) || routes.has(route))
      throw new Error('CMS documentation product identity is ambiguous');
    ids.add(id);
    routes.add(route);
    sources.push(
      Object.freeze({
        id,
        label: text(product.name, 'name', 256),
        type: 'CMS',
        route,
        order: profile.order,
        ownerModule: 'cms',
        connectionModule: 'cms',
        site,
        catalog: text(product.contentCatalog, 'catalog'),
        defaultPage: route,
        packCode: profile.contentPackCode!,
        initializationProfile: profile.code,
        dashboard: {
          summary: text(product.description, 'description', 320),
          audiences: Array.isArray(product.audience)
            ? product.audience
                .filter((item): item is string => typeof item === 'string')
                .slice(0, 12)
            : [],
        },
      }),
    );
  }
  return sources.sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id),
  );
}

/** Reads canonical authoring metadata on Staged; publication readiness and page delivery remain separately Online. */
export async function loadDocumentationProductSources(
  connection: AxisModuleConnection,
  configuration: WorkbenchClientConfiguration,
  profiles: readonly AxisApplicationInitializationProfile[],
  fetchImplementation: typeof fetch = fetch,
): Promise<readonly AxisDocumentationSource[]> {
  if (
    connection.moduleName !== 'cms' ||
    connection.runtimeRole?.publication !== 'STAGED'
  ) {
    throw new Error('Staged CMS documentation metadata discovery is unavailable');
  }
  const sites = [...new Set(profiles.map((profile) => profile.siteCode))];
  if (!sites.length) return [];
  if (sites.length > 32)
    throw new Error('CMS documentation discovery exceeds its bounded scope');
  const schema = await loadGeneratedSchemaCapabilities(
    connection,
    { schemaName: 'cmsDocumentationProduct' },
    configuration,
    fetchImplementation,
  );
  if (
    schema.moduleName !== 'cms' ||
    schema.schemaName !== 'cmsDocumentationProduct' ||
    !schema.operations.includes('search') ||
    !schema.queryCapabilities.filterFields.some(
      (field) => field.field === 'site' && field.operators.includes('EQUALS'),
    ) ||
    !schema.queryCapabilities.groupOperators.includes('OR')
  ) {
    throw new Error('CMS documentation product search is unavailable');
  }
  const records: WorkbenchRecord[] = [];
  for (let pageNumber = 1; ; pageNumber += 1) {
    const page = await loadWorkbenchRecords(
      connection,
      schema,
      configuration,
      {
        search: '',
        pageNumber,
        pageSize: schema.queryCapabilities.defaultPageSize,
        sort: schema.queryCapabilities.defaultSort,
        filters: {
          operator: 'OR',
          items: sites.map((site) => ({
            field: 'site',
            operator: 'EQUALS',
            value: site,
          })),
        },
      },
      fetchImplementation,
    );
    records.push(...page.records);
    if (
      page.totalCount > 128 ||
      records.length > 128 ||
      page.pageNumber !== pageNumber
    ) {
      throw new Error('CMS documentation discovery exceeds its bounded scope');
    }
    if (records.length >= page.totalCount) break;
    if (!page.records.length)
      throw new Error('CMS documentation discovery returned an incomplete page');
  }
  return projectDocumentationProducts(records, profiles);
}
