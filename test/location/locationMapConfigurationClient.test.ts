import { describe, expect, it, vi } from 'vitest';

import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import {
  loadLocationMapConfiguration,
  saveLocationMapConfiguration,
} from '../../src/operations/location/api/locationMapConfigurationClient';

const emptyBootstrap: AxisAuthenticatedBootstrap = {
  axisPolicy: {
    contractVersion: 1,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 1,
    source: 'DEFAULT',
  },
  navigation: [],
  environments: ['kickoffLocal'],
  moduleCatalog: {},
  moduleConnections: {},
  applicationInitializationProfiles: [],
  documentationSources: [],
  tenantCode: 'default',
};

const bootstrapWithRegistryConnection: AxisAuthenticatedBootstrap = {
  ...emptyBootstrap,
  moduleConnections: {
    locationMap: [
      {
        moduleName: 'locationMap',
        instanceId: 'kickoffLocal:locationServer:locationMap:0',
        endpoint: 'http://registry-location.example.test/nodics/locationMap',
        environment: 'kickoffLocal',
        server: 'locationServer',
        state: 'UP',
      },
    ],
  },
};

const effectiveConfiguration = {
  data: {
    code: 'AXIS_COLLECTION_CENTRE_MAPBOX_STREETS',
    providerCode: 'MAPBOX',
    surfaceCode: 'AXIS',
    usageCode: 'COLLECTION_CENTRE_MAP',
    stylePresetCode: 'MAPBOX_STREETS',
    styleUrl: 'mapbox://styles/mapbox/streets-v12',
    publicAccessToken: 'pk.sample',
    fallbackProviderCode: 'OSM',
    fallbackPolicy: 'ALLOW_BASIC_MAP',
    defaultCenter: { latitude: 25.2048, longitude: 55.2708 },
    defaultZoom: 9,
    minimumZoom: 3,
    maximumZoom: 18,
    enabledControls: ['ZOOM', 'SCALE'],
    setupStatus: 'ACTIVE',
    configured: true,
    status: 'ACTIVE',
    rendererCode: 'axis.location.mapbox',
    rendererType: 'MAPBOX_GL',
    renderDescriptor: {
      providerCode: 'MAPBOX',
      providerType: 'MAPBOX',
      rendererCode: 'axis.location.mapbox',
      rendererType: 'MAPBOX_GL',
      styleUrl: 'mapbox://styles/mapbox/streets-v12',
      tileUrlTemplate: '',
      attribution: 'Mapbox, OpenStreetMap contributors',
      publicAccessToken: 'pk.sample',
      endpointPolicy: {},
      frontendSafe: true,
    },
    fallbackRenderer: {
      providerCode: 'OSM',
      providerType: 'OSM',
      rendererCode: 'axis.location.tile',
      rendererType: 'XYZ_TILE',
      styleUrl: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      tileUrlTemplate: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      attribution: 'OpenStreetMap France, contributors',
      publicAccessToken: '',
      endpointPolicy: {},
      frontendSafe: true,
    },
    providerOptions: [
      {
        code: 'MAPBOX',
        name: { en: 'Mapbox' },
        providerType: 'MAPBOX',
        rendererCode: 'axis.location.mapbox',
        rendererType: 'MAPBOX_GL',
        requiresPublicAccessToken: true,
        frontendSafeTokenPrefix: 'pk.',
        status: 'ACTIVE',
      },
    ],
  },
};

describe('locationMapConfigurationClient', () => {
  it('loads effective configuration from runtime fallback when bootstrap has no Location Map lease', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(effectiveConfiguration)));

    const configuration = await loadLocationMapConfiguration(
      emptyBootstrap,
      {
        accessToken: 'token',
        enterpriseCode: 'default',
        locationBaseUrl: 'http://localhost:4380/nodics/locationMap',
        surfaceCode: 'AXIS',
        timeoutMs: 1000,
        usageCode: 'COLLECTION_CENTRE_MAP',
      },
      fetchImplementation,
    );

    expect(configuration.providerCode).toBe('MAPBOX');
    expect(configuration.rendererCode).toBe('axis.location.mapbox');
    expect(configuration.renderDescriptor?.rendererType).toBe('MAPBOX_GL');
    expect(configuration.fallbackRenderer?.providerCode).toBe('OSM');
    expect(configuration.providerOptions[0]?.code).toBe('MAPBOX');
    expect(fetchImplementation).toHaveBeenCalledWith(
      new URL(
        'http://localhost:4380/nodics/locationMap/v0/location/maps/configurations/effective?surfaceCode=AXIS&usageCode=COLLECTION_CENTRE_MAP',
      ),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('prefers the authenticated bootstrap Location Map lease over runtime fallback', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(effectiveConfiguration)));

    await loadLocationMapConfiguration(
      bootstrapWithRegistryConnection,
      {
        accessToken: 'token',
        enterpriseCode: 'default',
        locationBaseUrl: 'http://fallback-location.example.test/nodics/locationMap',
        surfaceCode: 'AXIS',
        timeoutMs: 1000,
        usageCode: 'COLLECTION_CENTRE_MAP',
      },
      fetchImplementation,
    );

    const calledUrl = fetchImplementation.mock.calls[0]?.[0];
    expect(calledUrl).toBeInstanceOf(URL);
    expect((calledUrl as URL).href).toContain(
      'http://registry-location.example.test/nodics/locationMap/v0/location/maps/configurations/effective',
    );
  });

  it('saves through runtime fallback without allowing secret URL material', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(effectiveConfiguration)));

    await saveLocationMapConfiguration(
      emptyBootstrap,
      {
        accessToken: 'token',
        enterpriseCode: 'default',
        locationBaseUrl: 'http://localhost:4380/nodics/locationMap',
        surfaceCode: 'AXIS',
        timeoutMs: 1000,
        usageCode: 'COLLECTION_CENTRE_MAP',
        configuration: {
          code: 'AXIS_COLLECTION_CENTRE_MAPBOX_STREETS',
          providerCode: 'MAPBOX',
          surfaceCode: 'AXIS',
          usageCode: 'COLLECTION_CENTRE_MAP',
          stylePresetCode: 'MAPBOX_STREETS',
          styleUrl: 'mapbox://styles/mapbox/streets-v12',
          publicAccessToken: 'pk.updated',
          fallbackProviderCode: 'OSM',
          fallbackPolicy: 'ALLOW_BASIC_MAP',
          defaultCenterLatitude: 25.2048,
          defaultCenterLongitude: 55.2708,
          defaultZoom: 9,
          minimumZoom: 3,
          maximumZoom: 18,
          enabledControls: ['ZOOM', 'SCALE'],
          setupStatus: 'ACTIVE',
          status: 'ACTIVE',
        },
      },
      fetchImplementation,
    );

    expect(fetchImplementation).toHaveBeenCalledWith(
      new URL(
        'http://localhost:4380/nodics/locationMap/v0/location/maps/configurations',
      ),
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});
