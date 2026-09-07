import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadCollectionCentreWorkspaceData,
  type CollectionCentreWorkspaceConfiguration,
} from '../../src/operations/location/api/collectionCentresClient';
import {
  loadWorkbenchRecords,
  loadWorkbenchSchemas,
} from '../../src/workbench/api/workbenchClient';
import type {
  WorkbenchRecordPage,
  WorkbenchSchema,
} from '../../src/workbench/api/workbenchContracts';

vi.mock('../../src/workbench/api/workbenchClient', () => ({
  loadWorkbenchRecords: vi.fn(),
  loadWorkbenchSchemas: vi.fn(),
}));

const mockedLoadWorkbenchSchemas = vi.mocked(loadWorkbenchSchemas);
const mockedLoadWorkbenchRecords = vi.mocked(loadWorkbenchRecords);

const configuration: CollectionCentreWorkspaceConfiguration = Object.freeze({
  accessToken: 'access-token',
  enterpriseCode: 'default',
  timeoutMs: 1000,
});

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

describe('collectionCentresClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the Waste domain API as the composed collection-centre source', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            records: [
              {
                code: 'WCP_1',
                name: { en: 'Business Bay Drop-Off' },
                collectionPointType: 'DROP_OFF',
                locationRef: { code: 'LOC_1' },
                location: {
                  code: 'LOC_1',
                  addressRef: { code: 'ADDR_1' },
                  latitude: 25.2,
                  longitude: 55.3,
                },
                address: {
                  code: 'ADDR_1',
                  addressLine1: 'Business Bay',
                  city: 'Dubai',
                  countryCode: 'AE',
                },
                operatorEnterpriseRef: { code: 'NODICS_WASTE_MANAGEMENT_CO' },
                assetOwnerEnterpriseRef: { code: 'BEAH_RECYCLING_SERVICES' },
                operatorEnterpriseName: 'Nodics Waste Management Co.',
                assetOwnerEnterpriseName: 'BEAH Recycling Services',
                operatingStatus: 'ACTIVE',
                publicVisibility: 'PUBLIC',
                status: 'ACTIVE',
                serviceCapabilities: ['DROP_OFF'],
              },
            ],
            totalCount: 1,
            pageNumber: 1,
            pageSize: 100,
            sourceCounts: {
              collectionPoints: 1,
              locations: 1,
              addresses: 1,
              enterprises: 2,
            },
            unavailableSources: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const data = await loadCollectionCentreWorkspaceData(
      {
        moduleConnections: {
          wasteApi: [
            {
              moduleName: 'wasteApi',
              instanceId: 'wasteApi-main',
              endpoint: 'http://127.0.0.1:4370/nodics/wasteApi',
              state: 'UP',
            },
          ],
          wasteCollection: [
            {
              moduleName: 'wasteCollection',
              instanceId: 'wasteCollection-main',
              endpoint: 'http://127.0.0.1:4370/nodics/wasteCollection',
              state: 'UP',
            },
          ],
          locationCore: [
            {
              moduleName: 'locationCore',
              instanceId: 'locationCore-main',
              endpoint: 'http://127.0.0.1:4380/nodics/locationCore',
              state: 'UP',
            },
          ],
          profile: [
            {
              moduleName: 'profile',
              instanceId: 'profile-main',
              endpoint: 'http://127.0.0.1:4320/nodics/profile',
              state: 'UP',
            },
          ],
        },
      } as never,
      configuration,
      fetchImplementation,
    );

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const requestUrl = fetchImplementation.mock.calls[0]?.[0];
    expect(requestUrl).toBeInstanceOf(URL);
    expect(requestUrl instanceof URL ? requestUrl.href : '').toBe(
      'http://127.0.0.1:4370/nodics/wasteApi/v0/waste/collection-centres/search',
    );
    expect(mockedLoadWorkbenchSchemas).not.toHaveBeenCalled();
    expect(mockedLoadWorkbenchRecords).not.toHaveBeenCalled();
    expect(data.records[0]?.code).toBe('WCP_1');
    expect(data.records[0]?.operatorEnterpriseName).toBe(
      'Nodics Waste Management Co.',
    );
    expect(data.records[0]?.assetOwnerEnterpriseName).toBe(
      'BEAH Recycling Services',
    );
    expect(data.records[0]?.enterpriseRelationshipCodes).toEqual([
      'NODICS_WASTE_MANAGEMENT_CO',
      'BEAH_RECYCLING_SERVICES',
    ]);
    expect(data.records[0]?.addressLine).toBe('Business Bay');
    expect(data.records[0]?.latitude).toBe(25.2);
    expect(data.records[0]?.longitude).toBe(55.3);
    expect(data.sourceCounts).toEqual({
      collectionPoints: 1,
      locations: 1,
      addresses: 1,
      enterprises: 2,
    });
    expect(data.unavailableSources).toEqual([]);
  });

  it('uses the configured Waste API base URL when bootstrap does not expose wasteApi', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            records: [
              {
                code: 'WCP_2',
                name: { en: 'Configured Waste API Centre' },
                collectionPointType: 'DROP_OFF',
                latitude: 25.25,
                longitude: 55.35,
                operatorEnterpriseRef: { code: 'NODICS_WASTE_MANAGEMENT_CO' },
                assetOwnerEnterpriseRef: { code: 'BEAH_RECYCLING_SERVICES' },
                operatingStatus: 'ACTIVE',
                publicVisibility: 'PUBLIC',
                status: 'ACTIVE',
              },
            ],
            totalCount: 1,
            sourceCounts: {
              collectionPoints: 1,
              locations: 0,
              addresses: 0,
              enterprises: 0,
            },
            unavailableSources: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const data = await loadCollectionCentreWorkspaceData(
      {
        moduleConnections: {},
      } as never,
      {
        ...configuration,
        wasteApiBaseUrl: 'http://configured.example.test/nodics/wasteApi',
      },
      fetchImplementation,
    );

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const requestUrl = fetchImplementation.mock.calls[0]?.[0];
    expect(requestUrl instanceof URL ? requestUrl.href : '').toBe(
      'http://configured.example.test/nodics/wasteApi/v0/waste/collection-centres/search',
    );
    expect(mockedLoadWorkbenchSchemas).not.toHaveBeenCalled();
    expect(data.records[0]?.code).toBe('WCP_2');
  });

  it('falls back to workbench sources when the Waste domain API is unavailable', async () => {
    mockedLoadWorkbenchSchemas.mockResolvedValue(
      Object.freeze([
        schema('locationCore', 'location'),
        schema('profile', 'address'),
        schema('profile', 'enterprise'),
        schema('wasteCollection', 'wasteCollectionPoint'),
      ]),
    );
    mockedLoadWorkbenchRecords.mockImplementation((_connection, workbenchSchema) => {
      if (workbenchSchema.moduleName === 'wasteCollection') {
        return Promise.resolve(page([
          Object.freeze({
            code: 'WCP_1',
            name: { en: 'Business Bay Drop-Off' },
            collectionPointType: 'DROP_OFF',
            locationRef: { code: 'LOC_1' },
            operatorEnterpriseRef: { code: 'NODICS_WASTE_MANAGEMENT_CO' },
            assetOwnerEnterpriseRef: { code: 'BEAH_RECYCLING_SERVICES' },
            operatingStatus: 'ACTIVE',
            publicVisibility: 'PUBLIC',
            status: 'ACTIVE',
          }),
        ]));
      }
      if (workbenchSchema.moduleName === 'locationCore') {
        return Promise.resolve(page([
          Object.freeze({
            code: 'LOC_1',
            addressRef: Object.freeze({ code: 'ADDR_1' }),
            latitude: 25.2,
            longitude: 55.3,
          }),
        ]));
      }
      if (workbenchSchema.moduleName === 'profile' && workbenchSchema.schemaName === 'address') {
        return Promise.resolve(page([
          Object.freeze({
            code: 'ADDR_1',
            addressLine1: 'Business Bay',
            city: 'Dubai',
            countryCode: 'AE',
          }),
        ]));
      }
      if (workbenchSchema.moduleName === 'profile' && workbenchSchema.schemaName === 'enterprise') {
        return Promise.resolve(page([
          Object.freeze({
            code: 'NODICS_WASTE_MANAGEMENT_CO',
            name: 'Nodics Waste Management Co.',
          }),
          Object.freeze({
            code: 'BEAH_RECYCLING_SERVICES',
            name: 'BEAH Recycling Services',
          }),
        ]));
      }
      return Promise.resolve(page([]));
    });
    const fetchImplementation = vi.fn<typeof fetch>().mockRejectedValue(
      new Error('Waste API unavailable'),
    );

    const data = await loadCollectionCentreWorkspaceData(
      {
        moduleConnections: {
          wasteApi: [
            {
              moduleName: 'wasteApi',
              instanceId: 'wasteApi-main',
              endpoint: 'http://127.0.0.1:4370/nodics/wasteApi',
              state: 'UP',
            },
          ],
          wasteCollection: [
            {
              moduleName: 'wasteCollection',
              instanceId: 'wasteCollection-main',
              endpoint: 'http://127.0.0.1:4370/nodics/wasteCollection',
              state: 'UP',
            },
          ],
          locationCore: [
            {
              moduleName: 'locationCore',
              instanceId: 'locationCore-main',
              endpoint: 'http://127.0.0.1:4380/nodics/locationCore',
              state: 'UP',
            },
          ],
          profile: [
            {
              moduleName: 'profile',
              instanceId: 'profile-main',
              endpoint: 'http://127.0.0.1:4320/nodics/profile',
              state: 'UP',
            },
          ],
        },
      } as never,
      configuration,
      fetchImplementation,
    );

    expect(mockedLoadWorkbenchSchemas).toHaveBeenCalledTimes(1);
    expect(mockedLoadWorkbenchRecords).toHaveBeenCalledTimes(4);
    expect(data.records[0]?.operatorEnterpriseName).toBe(
      'Nodics Waste Management Co.',
    );
    expect(data.records[0]?.addressLine).toBe('Business Bay');
    expect(data.records[0]?.latitude).toBe(25.2);
    expect(data.records[0]?.longitude).toBe(55.3);
    expect(data.unavailableSources).toEqual(['wasteApi:wasteCollectionCentreSearch']);
  });
});
