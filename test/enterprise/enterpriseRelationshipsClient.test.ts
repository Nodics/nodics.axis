import { describe, expect, it, vi } from 'vitest';

import { loadEnterpriseRelationshipData } from '../../src/operations/enterprise/api/enterpriseRelationshipsClient';
import { loadCollectionCentreWorkspaceData } from '../../src/operations/location/api/collectionCentresClient';
import {
  loadWorkbenchRecords,
  loadWorkbenchSchemas,
} from '../../src/workbench/api/workbenchClient';
import type {
  WorkbenchRecordPage,
  WorkbenchSchema,
} from '../../src/workbench/api/workbenchContracts';

vi.mock('../../src/operations/location/api/collectionCentresClient', () => ({
  loadCollectionCentreWorkspaceData: vi.fn(),
}));

vi.mock('../../src/workbench/api/workbenchClient', () => ({
  loadWorkbenchRecords: vi.fn(),
  loadWorkbenchSchemas: vi.fn(),
}));

const mockedLoadCollectionCentreWorkspaceData = vi.mocked(
  loadCollectionCentreWorkspaceData,
);
const mockedLoadWorkbenchSchemas = vi.mocked(loadWorkbenchSchemas);
const mockedLoadWorkbenchRecords = vi.mocked(loadWorkbenchRecords);

const queryCapabilities = Object.freeze({
  searchableFields: Object.freeze(['code']),
  sortableFields: Object.freeze(['code']),
  filterFields: Object.freeze([]),
  groupOperators: Object.freeze(['AND' as const]),
  textOperator: 'CONTAINS' as const,
  allowedPageSizes: Object.freeze([25, 50, 100]),
  defaultPageSize: 25,
  maximumPageSize: 100,
  defaultSort: Object.freeze({ field: 'code', direction: 'ASC' as const }),
});

function schema(moduleName: string, schemaName: string): WorkbenchSchema {
  return Object.freeze({
    moduleName,
    schemaName,
    label: schemaName,
    description: schemaName,
    displayProperty: 'code',
    displayProperties: Object.freeze(['code']),
    queryCapabilities,
    mutationMode: 'GENERATED_CRUD',
    operations: Object.freeze(['search' as const]),
    fields: Object.freeze([]),
    relationships: Object.freeze([]),
  });
}

function page(records: readonly Readonly<Record<string, unknown>>[]): WorkbenchRecordPage {
  return Object.freeze({
    records,
    totalCount: records.length,
    pageNumber: 1,
    pageSize: 100,
    sort: Object.freeze({ field: 'code', direction: 'ASC' }),
  });
}

describe('enterpriseRelationshipsClient', () => {
  it('matches any declared enterprise association field for reverse traversal', async () => {
    mockedLoadCollectionCentreWorkspaceData.mockResolvedValue(
      Object.freeze({
        records: Object.freeze([]),
        sourceCounts: Object.freeze({
          collectionPoints: 0,
          locations: 0,
          addresses: 0,
          enterprises: 0,
        }),
        unavailableSources: Object.freeze([]),
      }),
    );
    mockedLoadWorkbenchSchemas.mockResolvedValue(
      Object.freeze([
        schema('profile', 'enterprise'),
        schema('promotion', 'promotion'),
        schema('promotion', 'coupon'),
      ]),
    );
    mockedLoadWorkbenchRecords.mockImplementation((_connection, workbenchSchema) => {
      if (workbenchSchema.moduleName === 'profile') {
        return Promise.resolve(page([
          Object.freeze({
            code: 'NODICS_REWARDS_MARKETPLACE_CO',
            name: 'Nodics Rewards Marketplace Co.',
          }),
        ]));
      }
      if (workbenchSchema.schemaName === 'promotion') {
        return Promise.resolve(page([
          Object.freeze({
            code: 'PROMO_REWARDS_001',
            name: 'Marketplace Campaign',
            issuerEnterpriseRef: Object.freeze({ code: 'default' }),
            vendorEnterpriseRef: Object.freeze({
              code: 'NODICS_REWARDS_MARKETPLACE_CO',
            }),
            status: 'ACTIVE',
          }),
        ]));
      }
      return Promise.resolve(page([
        Object.freeze({
          code: 'COUPON_REWARDS_001',
          issuerEnterpriseRef: Object.freeze({ code: 'default' }),
          vendorEnterpriseRef: Object.freeze({
            code: 'NODICS_REWARDS_MARKETPLACE_CO',
          }),
          status: 'AVAILABLE',
        }),
      ]));
    });

    const data = await loadEnterpriseRelationshipData(
      {
        moduleConnections: {
          profile: [
            {
              moduleName: 'profile',
              instanceId: 'profile-main',
              endpoint: 'http://127.0.0.1:4320/nodics/profile',
              environment: 'kickoffLocal',
              state: 'UP',
            },
          ],
          promotion: [
            {
              moduleName: 'promotion',
              instanceId: 'promotion-main',
              endpoint: 'http://127.0.0.1:4350/nodics/promotion',
              environment: 'kickoffLocal',
              state: 'UP',
            },
          ],
        },
      } as never,
      {
        accessToken: 'access-token',
        enterpriseCode: 'default',
        timeoutMs: 1000,
      },
      'NODICS_REWARDS_MARKETPLACE_CO',
    );

    expect(data.enterprise?.code).toBe('NODICS_REWARDS_MARKETPLACE_CO');
    expect(data.promotions.map((record) => record.code)).toEqual([
      'PROMO_REWARDS_001',
    ]);
    expect(data.coupons.map((record) => record.code)).toEqual([
      'COUPON_REWARDS_001',
    ]);
    expect(data.promotions[0]?.relationship).toBe('Marketplace vendor');
    expect(data.projection.mode).toBe('AXIS_AGGREGATION');
    expect(data.projection.authoritativeSources).toContain(
      'wasteCollection.wasteCollectionPoint.assetOwnerEnterpriseRef',
    );
  });

  it('includes collection centres where the enterprise is the asset owner', async () => {
    mockedLoadCollectionCentreWorkspaceData.mockResolvedValue(
      Object.freeze({
        records: Object.freeze([
          Object.freeze({
            code: 'WCP_OWNED_BIN',
            name: 'Owned Bin',
            collectionPointType: 'SAMPLE_E_WASTE_DROP_OFF',
            locationCode: 'LOC_OWNED_BIN',
            addressCode: 'ADDR_OWNED_BIN',
            operatorEnterpriseCode: 'NODICS_WASTE_MANAGEMENT_CO',
            operatorEnterpriseName: 'Nodics Waste Management Co.',
            assetOwnerEnterpriseCode: 'BEAH_RECYCLING_SERVICES',
            assetOwnerEnterpriseName: 'BEAH Recycling Services',
            enterpriseRelationshipCodes: Object.freeze([
              'NODICS_WASTE_MANAGEMENT_CO',
              'BEAH_RECYCLING_SERVICES',
            ]),
            addressLine: 'Dubai',
            city: 'Dubai',
            countryCode: 'AE',
            latitude: 25.2,
            longitude: 55.3,
            operatingStatus: 'ACTIVE',
            publicVisibility: 'PUBLIC',
            status: 'ACTIVE',
            serviceCapabilities: Object.freeze(['DROP_OFF']),
            point: Object.freeze({}),
            location: Object.freeze({}),
            address: Object.freeze({}),
            enterprise: Object.freeze({}),
          }),
        ]),
        sourceCounts: Object.freeze({
          collectionPoints: 1,
          locations: 1,
          addresses: 1,
          enterprises: 2,
        }),
        unavailableSources: Object.freeze([]),
      }),
    );
    mockedLoadWorkbenchSchemas.mockResolvedValue(
      Object.freeze([
        schema('profile', 'enterprise'),
        schema('promotion', 'promotion'),
        schema('promotion', 'coupon'),
      ]),
    );
    mockedLoadWorkbenchRecords.mockImplementation((_connection, workbenchSchema) => {
      if (workbenchSchema.moduleName === 'profile') {
        return Promise.resolve(page([
          Object.freeze({
            code: 'BEAH_RECYCLING_SERVICES',
            name: 'BEAH Recycling Services',
          }),
        ]));
      }
      return Promise.resolve(page([]));
    });

    const data = await loadEnterpriseRelationshipData(
      { moduleConnections: { profile: [] } } as never,
      {
        accessToken: 'access-token',
        enterpriseCode: 'default',
        timeoutMs: 1000,
      },
      'BEAH_RECYCLING_SERVICES',
    );

    expect(data.collectionCentres.map((record) => record.code)).toEqual([
      'WCP_OWNED_BIN',
    ]);
  });
});
