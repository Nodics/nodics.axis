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
import {
  loadCollectionCentreWorkspaceData,
  type CollectionCentreRecord,
  type CollectionCentreWorkspaceConfiguration,
} from '../../location/api/collectionCentresClient';
import { activeConnections } from '../../shared/workbenchMetricDashboardModel';

export interface EnterpriseLinkedRecord {
  readonly source: 'collectionCentre' | 'promotion' | 'coupon';
  readonly code: string;
  readonly name: string;
  readonly relationship: string;
  readonly status: string;
  readonly route: string;
  readonly record: WorkbenchRecord;
}

interface EnterpriseRelationshipSource {
  readonly source: EnterpriseLinkedRecord['source'] | 'enterprise';
  readonly moduleName: string;
  readonly schemaName: string;
  readonly route: string;
  readonly associationFields: readonly string[];
  readonly defaultRelationship: string;
}

const enterpriseRelationshipSources: readonly EnterpriseRelationshipSource[] =
  Object.freeze([
    Object.freeze({
      source: 'enterprise',
      moduleName: 'profile',
      schemaName: 'enterprise',
      route: '/schema-workbench?module=profile&schema=enterprise',
      associationFields: Object.freeze(['code']),
      defaultRelationship: 'Enterprise authority',
    }),
    Object.freeze({
      source: 'promotion',
      moduleName: 'promotion',
      schemaName: 'promotion',
      route: '/schema-workbench?module=promotion&schema=promotion',
      associationFields: Object.freeze([
        'issuerEnterpriseRef',
        'vendorEnterpriseRef',
        'enterpriseRef',
        'enterpriseCode',
      ]),
      defaultRelationship: 'Promotion association',
    }),
    Object.freeze({
      source: 'coupon',
      moduleName: 'promotion',
      schemaName: 'coupon',
      route: '/schema-workbench?module=promotion&schema=coupon',
      associationFields: Object.freeze([
        'vendorEnterpriseRef',
        'issuerEnterpriseRef',
        'enterpriseRef',
        'enterpriseCode',
      ]),
      defaultRelationship: 'Coupon association',
    }),
  ]);

export interface EnterpriseRelationshipData {
  readonly enterprise: WorkbenchRecord | undefined;
  readonly collectionCentres: readonly CollectionCentreRecord[];
  readonly promotions: readonly EnterpriseLinkedRecord[];
  readonly coupons: readonly EnterpriseLinkedRecord[];
  readonly sourceCounts: {
    readonly enterprises: number;
    readonly collectionCentres: number;
    readonly promotions: number;
    readonly coupons: number;
  };
  readonly unavailableSources: readonly string[];
  readonly projection: {
    readonly mode: 'AXIS_AGGREGATION';
    readonly backendProjectionAvailable: false;
    readonly authoritativeSources: readonly string[];
  };
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

function refCode(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  return text(record.code) || text(record.ref) || text(record.id);
}

function associationCode(record: WorkbenchRecord, field: string): string {
  const value = record[field];
  return text(value) || refCode(value);
}

function enterpriseCodesForRecord(
  record: WorkbenchRecord,
  source: EnterpriseRelationshipSource,
): readonly string[] {
  return Object.freeze(
    source.associationFields
      .map((field) => associationCode(record, field))
      .filter((code) => code.length > 0),
  );
}

function recordMatchesEnterprise(
  record: WorkbenchRecord,
  source: EnterpriseRelationshipSource,
  enterpriseCode: string,
): boolean {
  return enterpriseCodesForRecord(record, source).includes(enterpriseCode);
}

function linkedRecord(
  source: EnterpriseRelationshipSource,
  record: WorkbenchRecord,
): EnterpriseLinkedRecord {
  return Object.freeze({
    source: source.source as EnterpriseLinkedRecord['source'],
    code: text(record.code),
    name: localizedText(record.name) || text(record.code),
    relationship:
      refCode(record.vendorEnterpriseRef) || refCode(record.sellerEnterpriseRef)
        ? 'Marketplace vendor'
        : refCode(record.issuerEnterpriseRef)
          ? 'Issuer'
          : source.defaultRelationship,
    status: text(record.status),
    route: source.route,
    record,
  });
}

export async function loadEnterpriseRelationshipData(
  bootstrap: AxisAuthenticatedBootstrap,
  configuration: CollectionCentreWorkspaceConfiguration,
  enterpriseCode: string,
): Promise<EnterpriseRelationshipData> {
  const requestedEnterpriseCode = enterpriseCode.trim();
  const connections = activeConnections(bootstrap);
  const [collectionData, schemas] = await Promise.all([
    loadCollectionCentreWorkspaceData(bootstrap, configuration),
    loadWorkbenchSchemas(connections, configuration),
  ]);
  const pages = await Promise.all(
    enterpriseRelationshipSources.map((source) =>
      loadSchemaRecords(
        bootstrap,
        configuration,
        schemas,
        source.moduleName,
        source.schemaName,
      ),
    ),
  );
  const [enterprisePage, promotionPage, couponPage] = pages;
  const promotionSource = enterpriseRelationshipSources[1]!;
  const couponSource = enterpriseRelationshipSources[2]!;
  const enterprise = (enterprisePage?.records ?? []).find(
    (record) => text(record.code) === requestedEnterpriseCode,
  );
  const collectionCentres = collectionData.records.filter((record) =>
    record.enterpriseRelationshipCodes.includes(requestedEnterpriseCode),
  );
  const promotions = (promotionPage?.records ?? [])
    .filter((record) =>
      recordMatchesEnterprise(record, promotionSource, requestedEnterpriseCode),
    )
    .map((record) => linkedRecord(promotionSource, record));
  const coupons = (couponPage?.records ?? [])
    .filter((record) =>
      recordMatchesEnterprise(record, couponSource, requestedEnterpriseCode),
    )
    .map((record) => linkedRecord(couponSource, record));
  const unavailableSources = [
    enterprisePage ? undefined : schemaKey('profile', 'enterprise'),
    ...collectionData.unavailableSources,
    promotionPage ? undefined : schemaKey('promotion', 'promotion'),
    couponPage ? undefined : schemaKey('promotion', 'coupon'),
  ].filter((item): item is string => item !== undefined);
  return Object.freeze({
    enterprise,
    collectionCentres: Object.freeze(collectionCentres),
    promotions: Object.freeze(promotions),
    coupons: Object.freeze(coupons),
    sourceCounts: Object.freeze({
      enterprises: enterprisePage?.totalCount ?? 0,
      collectionCentres: collectionCentres.length,
      promotions: promotions.length,
      coupons: coupons.length,
    }),
    unavailableSources: Object.freeze([...new Set(unavailableSources)]),
    projection: Object.freeze({
      mode: 'AXIS_AGGREGATION',
      backendProjectionAvailable: false,
      authoritativeSources: Object.freeze([
        'wasteCollection.wasteCollectionPoint.operatorEnterpriseRef',
        'wasteCollection.wasteCollectionPoint.assetOwnerEnterpriseRef',
        'promotion.promotion.enterpriseRef',
        'promotion.promotion.issuerEnterpriseRef',
        'promotion.promotion.vendorEnterpriseRef',
        'promotion.coupon.enterpriseRef',
        'promotion.coupon.issuerEnterpriseRef',
        'promotion.coupon.vendorEnterpriseRef',
      ]),
    }),
  });
}
