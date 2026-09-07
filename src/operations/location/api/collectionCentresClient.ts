import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisModuleConnection,
} from '../../../bootstrap/publicBootstrap';
import {
  loadWorkbenchRecords,
  loadWorkbenchSchemas,
} from '../../../workbench/api/workbenchClient';
import type {
  WorkbenchRecord,
  WorkbenchRecordPage,
  WorkbenchSchema,
} from '../../../workbench/api/workbenchContracts';
import {
  resolveWorkbenchRecordSort,
  schemaWithValidQueryCapabilities,
} from '../../../workbench/workbenchRouteModel';
import { activeConnections } from '../../shared/workbenchMetricDashboardModel';

export interface CollectionCentreWorkspaceConfiguration {
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly timeoutMs: number;
  readonly wasteApiBaseUrl?: string | undefined;
}

export interface CollectionCentreRecord {
  readonly code: string;
  readonly name: string;
  readonly collectionPointType: string;
  readonly locationCode: string;
  readonly addressCode: string;
  readonly operatorEnterpriseCode: string;
  readonly operatorEnterpriseName: string;
  readonly assetOwnerEnterpriseCode: string;
  readonly assetOwnerEnterpriseName: string;
  readonly enterpriseRelationshipCodes: readonly string[];
  readonly addressLine: string;
  readonly city: string;
  readonly countryCode: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly operatingStatus: string;
  readonly publicVisibility: string;
  readonly status: string;
  readonly serviceCapabilities: readonly string[];
  readonly point: WorkbenchRecord;
  readonly location: WorkbenchRecord | undefined;
  readonly address: WorkbenchRecord | undefined;
  readonly enterprise: WorkbenchRecord | undefined;
}

export interface CollectionCentreWorkspaceData {
  readonly records: readonly CollectionCentreRecord[];
  readonly sourceCounts: {
    readonly collectionPoints: number;
    readonly locations: number;
    readonly addresses: number;
    readonly enterprises: number;
  };
  readonly unavailableSources: readonly string[];
}

interface WasteCollectionCentrePage {
  readonly records: readonly WorkbenchRecord[];
  readonly totalCount: number;
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly sourceCounts: Partial<CollectionCentreWorkspaceData['sourceCounts']>;
  readonly unavailableSources: readonly string[];
}

function envelope(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Waste collection-centre search returned an invalid response');
  }
  const body = value as Record<string, unknown>;
  return body.data ?? body.result;
}

function parseWasteCollectionCentrePage(value: unknown): WasteCollectionCentrePage {
  const data = envelope(value);
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Waste collection-centre search did not return a page');
  }
  const page = data as Record<string, unknown>;
  const records = Array.isArray(page.records)
    ? (page.records.filter(
        (record): record is WorkbenchRecord =>
          typeof record === 'object' && record !== null && !Array.isArray(record),
      ) as readonly WorkbenchRecord[])
    : Object.freeze([]);
  return Object.freeze({
    records: Object.freeze(records),
    totalCount: Number.isInteger(page.totalCount) ? Number(page.totalCount) : records.length,
    pageNumber: Number.isInteger(page.pageNumber) ? Number(page.pageNumber) : 1,
    pageSize: Number.isInteger(page.pageSize) ? Number(page.pageSize) : records.length,
    sourceCounts:
      typeof page.sourceCounts === 'object' &&
      page.sourceCounts !== null &&
      !Array.isArray(page.sourceCounts)
        ? (page.sourceCounts as Partial<CollectionCentreWorkspaceData['sourceCounts']>)
        : Object.freeze({}),
    unavailableSources: Array.isArray(page.unavailableSources)
      ? Object.freeze(page.unavailableSources.filter((item): item is string => typeof item === 'string'))
      : Object.freeze([]),
  });
}

async function loadWasteCollectionCentrePage(
  bootstrap: AxisAuthenticatedBootstrap,
  configuration: CollectionCentreWorkspaceConfiguration,
  fetchImplementation: typeof fetch,
): Promise<WasteCollectionCentrePage | undefined> {
  const connection = selectModuleConnection(bootstrap, 'wasteApi');
  const rawEndpoint = connection?.endpoint ?? configuration.wasteApiBaseUrl;
  if (!rawEndpoint) return undefined;
  const endpoint = new URL(rawEndpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('Waste API endpoint is invalid');
  }
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const response = await fetchImplementation(
      new URL(
        `${endpoint.toString().replace(/\/$/, '')}/v0/waste/collection-centres/search`,
      ),
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${configuration.accessToken}`,
          'Content-Type': 'application/json',
          'x-enterprise-code': configuration.enterpriseCode,
        },
        body: JSON.stringify({ filters: {}, pageNumber: 1, pageSize: 100 }),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw new Error(
        `Waste collection-centre search returned HTTP ${String(response.status)}`,
      );
    }
    return parseWasteCollectionCentrePage(await response.json());
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function workbenchConnectionModuleName(schema: WorkbenchSchema): string {
  return schema.connectionModuleName ?? schema.moduleName;
}

function schemaKey(moduleName: string, schemaName: string): string {
  return `${moduleName}:${schemaName}`;
}

function findSchema(
  schemas: readonly WorkbenchSchema[],
  moduleName: string,
  schemaName: string,
): WorkbenchSchema | undefined {
  return schemas.find(
    (schema) => schema.moduleName === moduleName && schema.schemaName === schemaName,
  );
}

function findSchemaConnection(
  bootstrap: AxisAuthenticatedBootstrap,
  schema: WorkbenchSchema,
): AxisModuleConnection | undefined {
  const moduleName = workbenchConnectionModuleName(schema);
  const connections = bootstrap.moduleConnections[moduleName] ?? [];
  return (
    connections.find(
      (connection) =>
        connection.instanceId === schema.connectionInstanceId &&
        ['UP', 'DEGRADED'].includes(connection.state),
    ) ?? selectModuleConnection(bootstrap, moduleName)
  );
}

function pageSizeForSchema(schema: WorkbenchSchema): number {
  const maximum = schema.queryCapabilities.maximumPageSize;
  const defaultSize = schema.queryCapabilities.defaultPageSize;
  return Math.min(Math.max(defaultSize, 25), maximum, 100);
}

async function loadSchemaRecords(
  bootstrap: AxisAuthenticatedBootstrap,
  configuration: CollectionCentreWorkspaceConfiguration,
  schemas: readonly WorkbenchSchema[],
  moduleName: string,
  schemaName: string,
): Promise<WorkbenchRecordPage | undefined> {
  const discovered = findSchema(schemas, moduleName, schemaName);
  if (!discovered) return undefined;
  const schema = schemaWithValidQueryCapabilities(discovered);
  const connection = findSchemaConnection(bootstrap, schema);
  if (!connection) return undefined;
  return loadWorkbenchRecords(connection, schema, configuration, {
    search: '',
    pageNumber: 1,
    pageSize: pageSizeForSchema(schema),
    sort: resolveWorkbenchRecordSort(schema, undefined),
  });
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function localizedText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  return text(record.en) || text(Object.values(record).find((item) => text(item)));
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? Object.freeze(value.filter((item): item is string => typeof item === 'string'))
    : Object.freeze([]);
}

function recordValue(value: unknown): WorkbenchRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as WorkbenchRecord)
    : undefined;
}

function refCode(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  return text(record.code) || text(record.ref) || text(record.id);
}

function byCode(records: readonly WorkbenchRecord[] | undefined): Map<string, WorkbenchRecord> {
  const result = new Map<string, WorkbenchRecord>();
  (records ?? []).forEach((record) => {
    const code = text(record.code);
    if (code) result.set(code, record);
  });
  return result;
}

function enterpriseNameFor(
  enterprises: ReadonlyMap<string, WorkbenchRecord>,
  enterpriseCode: string,
): string {
  const enterprise = enterprises.get(enterpriseCode);
  return localizedText(enterprise?.name) || enterpriseCode;
}

function collectionCentreRecord(
  point: WorkbenchRecord,
  locations: ReadonlyMap<string, WorkbenchRecord>,
  addresses: ReadonlyMap<string, WorkbenchRecord>,
  enterprises: ReadonlyMap<string, WorkbenchRecord>,
): CollectionCentreRecord | undefined {
  const locationCode = refCode(point.locationRef);
  const operatorEnterpriseCode = refCode(point.operatorEnterpriseRef);
  const assetOwnerEnterpriseCode = refCode(point.assetOwnerEnterpriseRef);
  const location = recordValue(point.location) ?? locations.get(locationCode);
  const addressCode = text(point.addressCode) || refCode(location?.addressRef);
  const address = recordValue(point.address) ?? addresses.get(addressCode);
  const enterprise =
    recordValue(point.operatorEnterprise) ?? enterprises.get(operatorEnterpriseCode);
  const latitude = numberValue(point.latitude ?? location?.latitude ?? address?.latitude);
  const longitude = numberValue(point.longitude ?? location?.longitude ?? address?.longitude);
  if (latitude === undefined || longitude === undefined) return undefined;
  const enterpriseRelationshipCodes = Object.freeze([
    ...new Set([operatorEnterpriseCode, assetOwnerEnterpriseCode].filter(Boolean)),
  ]);
  const assetOwnerEnterprise =
    recordValue(point.assetOwnerEnterprise) ?? enterprises.get(assetOwnerEnterpriseCode);
  return Object.freeze({
    code: text(point.code),
    name: localizedText(point.name) || localizedText(location?.name) || text(point.code),
    collectionPointType: text(point.collectionPointType),
    locationCode,
    addressCode,
    operatorEnterpriseCode,
    operatorEnterpriseName:
      text(point.operatorEnterpriseName) ||
      localizedText(enterprise?.name) ||
      operatorEnterpriseCode ||
      'Unassigned',
    assetOwnerEnterpriseCode,
    assetOwnerEnterpriseName:
      text(point.assetOwnerEnterpriseName) ||
      localizedText(assetOwnerEnterprise?.name) ||
      (assetOwnerEnterpriseCode
        ? enterpriseNameFor(enterprises, assetOwnerEnterpriseCode)
        : ''),
    enterpriseRelationshipCodes,
    addressLine:
      text(point.addressLine) || text(address?.addressLine1) || text(address?.addressLine2),
    city: text(point.city) || text(address?.city),
    countryCode: text(point.countryCode) || text(address?.countryCode),
    latitude,
    longitude,
    operatingStatus: text(point.operatingStatus),
    publicVisibility: text(point.publicVisibility),
    status: text(point.status),
    serviceCapabilities: stringList(point.serviceCapabilities),
    point,
    location,
    address,
    enterprise,
  });
}

export async function loadCollectionCentreWorkspaceData(
  bootstrap: AxisAuthenticatedBootstrap,
  configuration: CollectionCentreWorkspaceConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<CollectionCentreWorkspaceData> {
  const connections = activeConnections(bootstrap);
  const domainPageResult = await loadWasteCollectionCentrePage(
    bootstrap,
    configuration,
    fetchImplementation,
  ).then(
    (page) => ({ status: 'fulfilled' as const, page }),
    (error: unknown) => ({ status: 'rejected' as const, error }),
  );
  if (domainPageResult.status === 'fulfilled' && domainPageResult.page) {
    const page = domainPageResult.page;
    const records = page.records
      .map((point) => collectionCentreRecord(point, new Map(), new Map(), new Map()))
      .filter((record): record is CollectionCentreRecord => record !== undefined);
    return Object.freeze({
      records: Object.freeze(records),
      sourceCounts: Object.freeze({
        collectionPoints: page.totalCount,
        locations: page.sourceCounts.locations ?? 0,
        addresses: page.sourceCounts.addresses ?? 0,
        enterprises: page.sourceCounts.enterprises ?? 0,
      }),
      unavailableSources: Object.freeze(page.unavailableSources),
    });
  }

  const schemas = await loadWorkbenchSchemas(connections, configuration);
  const [locationPage, addressPage, enterprisePage] = await Promise.all(
    [
      ['locationCore', 'location'],
      ['profile', 'address'],
      ['profile', 'enterprise'],
    ].map(([moduleName, schemaName]) =>
      loadSchemaRecords(bootstrap, configuration, schemas, moduleName!, schemaName!),
    ),
  );
  const fallbackPointPage = await loadSchemaRecords(
        bootstrap,
        configuration,
        schemas,
        'wasteCollection',
        'wasteCollectionPoint',
      );
  const pointRecords = fallbackPointPage?.records ?? [];
  const unavailableSources = [
    'wasteApi:wasteCollectionCentreSearch',
    fallbackPointPage
      ? undefined
      : schemaKey('wasteCollection', 'wasteCollectionPoint'),
    locationPage ? undefined : schemaKey('locationCore', 'location'),
    addressPage ? undefined : schemaKey('profile', 'address'),
    enterprisePage ? undefined : schemaKey('profile', 'enterprise'),
  ].filter((item): item is string => item !== undefined);
  const locations = byCode(locationPage?.records);
  const addresses = byCode(addressPage?.records);
  const enterprises = byCode(enterprisePage?.records);
  const records = pointRecords
    .map((point) => collectionCentreRecord(point, locations, addresses, enterprises))
    .filter((record): record is CollectionCentreRecord => record !== undefined);
  return Object.freeze({
    records: Object.freeze(records),
    sourceCounts: Object.freeze({
      collectionPoints: fallbackPointPage?.totalCount ?? 0,
      locations: locationPage?.totalCount ?? 0,
      addresses: addressPage?.totalCount ?? 0,
      enterprises: enterprisePage?.totalCount ?? 0,
    }),
    unavailableSources: Object.freeze(unavailableSources),
  });
}
