import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  type ReactNode,
} from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mapFlyToMock = vi.hoisted(() => vi.fn());
const geolocationWatchPositionMock = vi.hoisted(() => vi.fn());
const geolocationClearWatchMock = vi.hoisted(() => vi.fn());
const geolocationGetCurrentPositionMock = vi.hoisted(() => vi.fn());
const reverseGeocodeFetchMock = vi.hoisted(() => vi.fn());
const mapboxSetZoomRateMock = vi.hoisted(() => vi.fn());
const mapboxSetWheelZoomRateMock = vi.hoisted(() => vi.fn());

vi.mock('react-map-gl/mapbox', () => {
  interface MockMapProps {
    readonly children?: ReactNode;
    readonly cooperativeGestures?: boolean;
    readonly onLoad?: (event: {
      readonly target: {
        readonly scrollZoom: {
          readonly setWheelZoomRate: (rate: number) => void;
          readonly setZoomRate: (rate: number) => void;
        };
      };
    }) => void;
    readonly scrollZoom?: boolean;
  }

  interface MockMarkerProps {
    readonly 'aria-label'?: string;
    readonly children?: ReactNode;
    readonly color?: string;
    readonly latitude?: number;
    readonly longitude?: number;
    readonly onClick?: (event: {
      readonly originalEvent: { readonly stopPropagation: () => void };
    }) => void;
  }

  interface MockPopupProps {
    readonly children?: ReactNode;
  }

  return {
    default: forwardRef<{ flyTo: typeof mapFlyToMock }, MockMapProps>(
      ({ children, cooperativeGestures, onLoad, scrollZoom }, ref) => {
        useImperativeHandle(ref, () => ({ flyTo: mapFlyToMock }), []);
        useEffect(() => {
          onLoad?.({
            target: {
              scrollZoom: {
                setWheelZoomRate: mapboxSetWheelZoomRateMock,
                setZoomRate: mapboxSetZoomRateMock,
              },
            },
          });
        }, [onLoad]);
        return (
          <div
            aria-label="Mapbox streets map"
            data-cooperative-gestures={String(cooperativeGestures)}
            data-scroll-zoom={String(scrollZoom)}
          >
            {children}
          </div>
        );
      },
    ),
    GeolocateControl: ({
      onGeolocate,
    }: {
      readonly onGeolocate?: (position: GeolocationPosition) => void;
    }) => (
      <button
        aria-label="Map geolocate control"
        onClick={() =>
          onGeolocate?.({
            coords: {
              latitude: 25.2048,
              longitude: 55.2708,
            },
          } as GeolocationPosition)
        }
        type="button"
      >
        geolocate
      </button>
    ),
    Marker: ({
      'aria-label': ariaLabel,
      children,
      color,
      latitude,
      longitude,
      onClick,
    }: MockMarkerProps) =>
      children ? (
        <div data-latitude={latitude} data-longitude={longitude}>
          {children}
        </div>
      ) : (
        <button
          aria-label={ariaLabel ?? 'Map marker'}
          data-color={color}
          data-latitude={latitude}
          data-longitude={longitude}
          onClick={() => onClick?.({ originalEvent: { stopPropagation: vi.fn() } })}
          type="button"
        >
          marker
        </button>
      ),
    NavigationControl: () => <div aria-label="Map navigation control" />,
    Popup: ({ children }: MockPopupProps) => (
      <div aria-label="Collection centre popup" role="dialog">
        {children}
      </div>
    ),
    ScaleControl: () => <div aria-label="Map scale control" />,
    useMap: () => ({ current: { flyTo: mapFlyToMock } }),
  };
});

vi.mock('leaflet', () => ({
  default: {
    DomEvent: {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    },
    divIcon: vi.fn((options: unknown) => options),
  },
}));

vi.mock('react-leaflet', () => {
  interface MockMapContainerProps {
    readonly children?: ReactNode;
    readonly center?: readonly [number, number];
    readonly scrollWheelZoom?: boolean;
    readonly zoom?: number;
    readonly zoomSnap?: number;
  }

  interface MockTileLayerProps {
    readonly attribution?: string;
    readonly url?: string;
  }

  interface MockMarkerProps {
    readonly children?: ReactNode;
    readonly eventHandlers?: { readonly click?: () => void };
    readonly position?: readonly [number, number];
    readonly title?: string;
  }

  interface MockPopupProps {
    readonly children?: ReactNode;
  }

  return {
    MapContainer: forwardRef<{ flyTo: typeof mapFlyToMock }, MockMapContainerProps>(
      ({ children, center, scrollWheelZoom, zoom, zoomSnap }, ref) => {
        useImperativeHandle(ref, () => ({ flyTo: mapFlyToMock }), []);
        return (
          <div
            aria-label="Leaflet street map"
            data-center={JSON.stringify(center)}
            data-scroll-wheel-zoom={String(scrollWheelZoom)}
            data-zoom={String(zoom)}
            data-zoom-snap={String(zoomSnap)}
          >
            {children}
          </div>
        );
      },
    ),
    Marker: ({ children, eventHandlers, position, title }: MockMarkerProps) => (
      <div data-latitude={position?.[0]} data-longitude={position?.[1]}>
        <button
          aria-label={title ?? 'Map marker'}
          data-latitude={position?.[0]}
          data-longitude={position?.[1]}
          onClick={() => eventHandlers?.click?.()}
          type="button"
        >
          marker
        </button>
        {children}
      </div>
    ),
    Popup: ({ children }: MockPopupProps) => (
      <div aria-label="Collection centre popup" role="dialog">
        {children}
      </div>
    ),
    ScaleControl: () => <div aria-label="Leaflet scale control" />,
    TileLayer: ({ attribution, url }: MockTileLayerProps) => (
      <div data-tile-url={url}>{attribution}</div>
    ),
    ZoomControl: () => (
      <div aria-label="Leaflet zoom control">
        <button aria-label="Zoom in" type="button">
          +
        </button>
        <button aria-label="Zoom out" type="button">
          -
        </button>
      </div>
    ),
    useMap: () => ({
      getContainer: () => ({
        addEventListener: vi.fn(),
        clientHeight: 500,
        removeEventListener: vi.fn(),
      }),
      flyTo: vi.fn(),
      getCenter: () => ({ lat: 25.2, lng: 55.3 }),
      getZoom: () => 10,
      invalidateSize: vi.fn(),
      scrollWheelZoom: {
        disable: vi.fn(),
      },
      stop: vi.fn(),
    }),
  };
});

import { CollectionCentresRoutePage } from '../../src/operations/location/CollectionCentresRoutePage';
import {
  loadCollectionCentreWorkspaceData,
  type CollectionCentreWorkspaceData,
} from '../../src/operations/location/api/collectionCentresClient';
import {
  loadLocationMapConfiguration,
  type LocationMapConfiguration,
} from '../../src/operations/location/api/locationMapConfigurationClient';
import { AxisLocalizationBoundary } from '../../src/localization/AxisLocalizationContext';

vi.mock('../../src/operations/location/api/collectionCentresClient', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/operations/location/api/collectionCentresClient')
  >('../../src/operations/location/api/collectionCentresClient');
  return {
    ...actual,
    loadCollectionCentreWorkspaceData: vi.fn(),
  };
});

vi.mock(
  '../../src/operations/location/api/locationMapConfigurationClient',
  async () => {
    const actual = await vi.importActual<
      typeof import('../../src/operations/location/api/locationMapConfigurationClient')
    >('../../src/operations/location/api/locationMapConfigurationClient');
    return {
      ...actual,
      loadLocationMapConfiguration: vi.fn(),
    };
  },
);

const mockedLoadWorkspaceData = vi.mocked(loadCollectionCentreWorkspaceData);
const mockedLoadMapConfiguration = vi.mocked(loadLocationMapConfiguration);

const activeMapConfiguration: LocationMapConfiguration = Object.freeze({
  code: 'AXIS_COLLECTION_CENTRE_MAPBOX_STREETS',
  providerCode: 'MAPBOX',
  surfaceCode: 'AXIS',
  usageCode: 'COLLECTION_CENTRE_MAP',
  stylePresetCode: 'MAPBOX_STREETS',
  styleUrl: 'mapbox://styles/mapbox/streets-v12',
  publicAccessToken: 'pk.test-token',
  fallbackProviderCode: 'OSM',
  fallbackPolicy: 'SETUP_REQUIRED',
  defaultCenter: Object.freeze({ latitude: 25.2048, longitude: 55.2708 }),
  defaultZoom: 9,
  minimumZoom: 3,
  maximumZoom: 18,
  enabledControls: Object.freeze([
    'FILTERS',
    'ZOOM',
    'SCALE',
    'GEOLOCATE',
    'DIRECTIONS',
  ]),
  setupStatus: 'ACTIVE',
  configured: true,
  status: 'ACTIVE',
  rendererCode: 'axis.location.mapbox',
  rendererType: 'MAPBOX_GL',
  renderDescriptor: Object.freeze({
    providerCode: 'MAPBOX',
    providerType: 'MAPBOX',
    rendererCode: 'axis.location.mapbox',
    rendererType: 'MAPBOX_GL',
    styleUrl: 'mapbox://styles/mapbox/streets-v12',
    tileUrlTemplate: '',
    attribution: 'Mapbox, OpenStreetMap contributors',
    publicAccessToken: 'pk.test-token',
    endpointPolicy: Object.freeze({}),
    frontendSafe: true,
  }),
  fallbackRenderer: Object.freeze({
    providerCode: 'OSM',
    providerType: 'OSM',
    rendererCode: 'axis.location.tile',
    rendererType: 'XYZ_TILE',
    styleUrl: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    tileUrlTemplate: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: 'OpenStreetMap France, contributors',
    publicAccessToken: '',
    endpointPolicy: Object.freeze({}),
    frontendSafe: true,
  }),
  providerOptions: Object.freeze([]),
});

const setupRequiredMapConfiguration: LocationMapConfiguration = Object.freeze({
  ...activeMapConfiguration,
  publicAccessToken: '',
  fallbackPolicy: 'SETUP_REQUIRED',
  setupStatus: 'SETUP_REQUIRED',
  configured: false,
});

const activeOsmMapConfiguration: LocationMapConfiguration = Object.freeze({
  ...activeMapConfiguration,
  code: 'AXIS_COLLECTION_CENTRE_OSM_HOT',
  providerCode: 'OSM',
  stylePresetCode: 'OSM_HOT',
  styleUrl: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
  publicAccessToken: '',
  setupStatus: 'ACTIVE',
  configured: true,
  rendererCode: 'axis.location.tile',
  rendererType: 'XYZ_TILE',
  renderDescriptor: Object.freeze({
    providerCode: 'OSM',
    providerType: 'OSM',
    rendererCode: 'axis.location.tile',
    rendererType: 'XYZ_TILE',
    styleUrl: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    tileUrlTemplate: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: 'OpenStreetMap France, contributors',
    publicAccessToken: '',
    endpointPolicy: Object.freeze({}),
    frontendSafe: true,
  }),
  fallbackRenderer: Object.freeze({
    providerCode: 'OSM',
    providerType: 'OSM',
    rendererCode: 'axis.location.tile',
    rendererType: 'XYZ_TILE',
    styleUrl: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    tileUrlTemplate: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: 'OpenStreetMap France, contributors',
    publicAccessToken: '',
    endpointPolicy: Object.freeze({}),
    frontendSafe: true,
  }),
});

const sampleData: CollectionCentreWorkspaceData = Object.freeze({
  records: Object.freeze([
    Object.freeze({
      code: 'WCP_SAMPLE_COLLECTION_CENTRE_AVERDA_AL_SAFA',
      name: 'Averda Recycling Center - Al Safa',
      collectionPointType: 'SAMPLE_E_WASTE_DROP_OFF',
      locationCode: 'LOC_SAMPLE_COLLECTION_CENTRE_AVERDA_AL_SAFA',
      addressCode: 'ADDR_SAMPLE_COLLECTION_CENTRE_AVERDA_AL_SAFA',
      operatorEnterpriseCode: 'NODICS_WASTE_MANAGEMENT_CO',
      operatorEnterpriseName: 'Nodics Waste Management Co.',
      assetOwnerEnterpriseCode: 'BEAH_RECYCLING_SERVICES',
      assetOwnerEnterpriseName: 'BEAH Recycling Services',
      enterpriseRelationshipCodes: Object.freeze([
        'NODICS_WASTE_MANAGEMENT_CO',
        'BEAH_RECYCLING_SERVICES',
      ]),
      addressLine: '62 18C St - Al Safa - Dubai',
      city: 'Dubai',
      countryCode: 'AE',
      latitude: 25.1569903,
      longitude: 55.2277866,
      operatingStatus: 'ACTIVE',
      publicVisibility: 'PUBLIC',
      status: 'ACTIVE',
      serviceCapabilities: Object.freeze(['DROP_OFF']),
      point: Object.freeze({
        code: 'WCP_SAMPLE_COLLECTION_CENTRE_AVERDA_AL_SAFA',
        name: 'Averda Recycling Center - Al Safa',
        operatingStatus: 'ACTIVE',
      }),
      location: Object.freeze({
        code: 'LOC_SAMPLE_COLLECTION_CENTRE_AVERDA_AL_SAFA',
        latitude: 25.1569903,
        longitude: 55.2277866,
      }),
      address: Object.freeze({
        code: 'ADDR_SAMPLE_COLLECTION_CENTRE_AVERDA_AL_SAFA',
        addressLine1: '62 18C St - Al Safa - Dubai',
        city: 'Dubai',
        countryCode: 'AE',
      }),
      enterprise: Object.freeze({}),
    }),
    Object.freeze({
      code: 'WCP_SAMPLE_COLLECTION_CENTRE_PARTNER_BIN',
      name: 'Partner Mall Bin',
      collectionPointType: 'SAMPLE_E_WASTE_DROP_OFF',
      locationCode: 'LOC_SAMPLE_COLLECTION_CENTRE_PARTNER_BIN',
      addressCode: 'ADDR_SAMPLE_COLLECTION_CENTRE_PARTNER_BIN',
      operatorEnterpriseCode: 'BEAH',
      operatorEnterpriseName: 'BEAH',
      assetOwnerEnterpriseCode: '',
      assetOwnerEnterpriseName: '',
      enterpriseRelationshipCodes: Object.freeze(['BEAH']),
      addressLine: 'Mall entrance - Dubai',
      city: 'Dubai',
      countryCode: 'AE',
      latitude: 25.2900224,
      longitude: 55.3804174,
      operatingStatus: 'ACTIVE',
      publicVisibility: 'PUBLIC',
      status: 'ACTIVE',
      serviceCapabilities: Object.freeze(['DROP_OFF']),
      point: Object.freeze({
        code: 'WCP_SAMPLE_COLLECTION_CENTRE_PARTNER_BIN',
        name: 'Partner Mall Bin',
        operatingStatus: 'ACTIVE',
      }),
      location: Object.freeze({
        code: 'LOC_SAMPLE_COLLECTION_CENTRE_PARTNER_BIN',
        latitude: 25.2900224,
        longitude: 55.3804174,
      }),
      address: Object.freeze({
        code: 'ADDR_SAMPLE_COLLECTION_CENTRE_PARTNER_BIN',
        addressLine1: 'Mall entrance - Dubai',
        city: 'Dubai',
        countryCode: 'AE',
      }),
      enterprise: Object.freeze({}),
    }),
  ]),
  sourceCounts: Object.freeze({
    collectionPoints: 2,
    locations: 2,
    addresses: 2,
    enterprises: 2,
  }),
  unavailableSources: Object.freeze([]),
});

function renderPage(locale = 'en') {
  const navigation = {
    id: 'waste-collection-centres',
    moduleName: 'wasteCollection',
    label: 'Collection Centres',
    route: '/waste/collection-centres',
    category: 'sustainability',
    icon: 'waste',
    order: 1420.5,
    availability: 'UP',
    featureState: 'ACTIVE',
    workbenchTarget: {
      moduleName: 'wasteCollection',
      schemaName: 'wasteCollectionPoint',
    },
  } as const;
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AxisLocalizationBoundary
        value={{
          locale,
          direction: locale === 'ar' ? 'rtl' : 'ltr',
          supportedLocales: Object.freeze(['en', 'ar']),
          stale: false,
          setLocale: vi.fn(),
          format: (_key: string, fallback: string) => fallback,
          formatError: (error: unknown, fallback: string) =>
            error instanceof Error ? error.message : fallback,
        }}
      >
        <MemoryRouter>
          <CollectionCentresRoutePage
            accessToken="token"
            bootstrap={
              {
                moduleConnections: {
                  locationMap: [
                    {
                      endpoint: 'http://localhost:4380/nodics/locationMap',
                      instanceId: 'locationServer',
                      moduleName: 'locationMap',
                      state: 'UP',
                    },
                  ],
                  wasteCollection: [
                    {
                      endpoint: 'http://localhost:4370/nodics/wasteCollection',
                      instanceId: 'wasteServer',
                      moduleName: 'wasteCollection',
                      state: 'UP',
                    },
                  ],
                  locationCore: [
                    {
                      endpoint: 'http://localhost:4380/nodics/locationCore',
                      instanceId: 'locationServer',
                      moduleName: 'locationCore',
                      state: 'UP',
                    },
                  ],
                  locationType: [
                    {
                      endpoint: 'http://localhost:4380/nodics/locationType',
                      instanceId: 'locationServer',
                      moduleName: 'locationType',
                      state: 'UP',
                    },
                  ],
                  profile: [
                    {
                      endpoint: 'http://localhost:4320/nodics/profile',
                      instanceId: 'profileServer',
                      moduleName: 'profile',
                      state: 'UP',
                    },
                  ],
                },
                navigation: [navigation],
              } as never
            }
            navigation={navigation}
            runtime={
              {
                enterpriseCode: 'default',
                requestTimeoutMs: 1000,
              } as never
            }
          />
        </MemoryRouter>
      </AxisLocalizationBoundary>
    </QueryClientProvider>,
  );
}

describe('Collection Centres route', () => {
  beforeEach(() => {
    mapFlyToMock.mockClear();
    mapboxSetZoomRateMock.mockClear();
    mapboxSetWheelZoomRateMock.mockClear();
    geolocationWatchPositionMock.mockReset();
    geolocationClearWatchMock.mockReset();
    geolocationGetCurrentPositionMock.mockReset();
    mockedLoadWorkspaceData.mockResolvedValue(sampleData);
    mockedLoadMapConfiguration.mockResolvedValue(activeMapConfiguration);
    reverseGeocodeFetchMock.mockReset();
    reverseGeocodeFetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            status: 'RESOLVED',
            address: 'Palm Jumeirah, Dubai, United Arab Emirates',
            providerCode: 'OSM',
            fallbackUsed: false,
          },
        }),
    });
    vi.stubGlobal('fetch', reverseGeocodeFetchMock);
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        clearWatch: geolocationClearWatchMock,
        getCurrentPosition: geolocationGetCurrentPositionMock,
        watchPosition: geolocationWatchPositionMock.mockImplementation(
          (success: PositionCallback) => {
          success({
            coords: {
              latitude: 25.286,
              longitude: 55.379,
            },
          } as GeolocationPosition);
          return 7;
        },
        ),
      },
    });
  });

  it('renders collection-centre list, map markers, and a compact selected summary', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Collection centres' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Collection centres map')).toBeVisible();
    expect(await screen.findByLabelText('Mapbox streets map')).toHaveAttribute(
      'data-scroll-zoom',
      'true',
    );
    expect(await screen.findByLabelText('Mapbox streets map')).toHaveAttribute(
      'data-cooperative-gestures',
      'true',
    );
    expect(mapboxSetZoomRateMock).toHaveBeenCalledWith(1 / 260);
    expect(mapboxSetWheelZoomRateMock).toHaveBeenCalledWith(1 / 900);
    expect(
      await screen.findByRole('button', {
        name: 'Averda Recycling Center - Al Safa marker',
      }),
    ).toBeVisible();
    expect(screen.getByLabelText('Selected collection centre')).toBeVisible();
    expect(screen.getByText('Operational master data')).toBeVisible();
    expect(screen.queryByText('25.15699, 55.22779')).toBeNull();
    expect(screen.getByRole('link', { name: 'Open Schema' })).toHaveAttribute(
      'href',
      '/schema-workbench?module=wasteCollection&schema=wasteCollectionPoint&search=WCP_SAMPLE_COLLECTION_CENTRE_AVERDA_AL_SAFA',
    );
    expect(screen.queryByText(/Current location not shared/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'User location marker' })).toBeNull();
  });

  it('asks for browser location before placing the user marker', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('button', {
      name: 'Averda Recycling Center - Al Safa marker',
    });
    await user.click(screen.getByRole('button', { name: 'Share your location' }));

    expect(geolocationWatchPositionMock).toHaveBeenCalledTimes(1);
    const userMarker = await screen.findByRole('button', {
      name: 'User location marker',
    });
    expect(userMarker.firstElementChild).toHaveClass(
      'current-location-marker__label',
    );
    expect(userMarker).toHaveAttribute('data-latitude', '25.286');
    expect(screen.queryByText('Location Shared')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Share your location' })).toBeNull();
    expect(screen.queryByText('Your current location is shown on the map.')).toBeNull();
    expect(screen.queryByText(/Your location:/)).toBeNull();
    expect(mapFlyToMock).toHaveBeenCalledWith({
      center: [55.379, 25.286],
      zoom: 13,
    });
  });

  it('uses shared browser location for near-me map movement', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('button', {
      name: 'Averda Recycling Center - Al Safa marker',
    });
    await user.click(screen.getByRole('button', { name: 'Near Me' }));

    expect(geolocationWatchPositionMock).toHaveBeenCalledTimes(1);
    expect(mapFlyToMock).toHaveBeenCalledWith({
      center: [55.3804174, 25.2900224],
      zoom: 14,
    });
  });

  it('shows setup guidance when Location Map has no active Mapbox token', async () => {
    mockedLoadMapConfiguration.mockResolvedValueOnce(setupRequiredMapConfiguration);
    renderPage();

    expect(
      await screen.findByText(/active map renderer is not available/i),
    ).toBeVisible();
    expect(screen.getByLabelText('Collection centres map')).toHaveClass(
      'collection-centres-map--with-warning',
    );
    expect(
      screen.getByRole('link', { name: 'Check configuration' }),
    ).toHaveAttribute('href', '/location/maps');
    expect(screen.getByText('OpenStreetMap France, contributors')).toBeVisible();
  });

  it('keeps map filters and location sharing controls visible for active OSM maps', async () => {
    mockedLoadMapConfiguration.mockResolvedValueOnce(activeOsmMapConfiguration);
    renderPage();

    const osmMap = await screen.findByLabelText('Leaflet street map');
    expect(osmMap).toHaveAttribute('data-scroll-wheel-zoom', 'false');
    expect(osmMap).toHaveAttribute('data-zoom-snap', '1');
    expect(
      screen.getByText('OpenStreetMap France, contributors'),
    ).toHaveAttribute(
      'data-tile-url',
      'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    );
    expect(screen.queryByText(/active map renderer is not available/i)).toBeNull();
    expect(screen.getByLabelText('Collection centres map')).not.toHaveClass(
      'collection-centres-map--with-warning',
    );
    expect(screen.getByRole('button', { name: 'Repair' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Trade-in' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Recycling' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Near Me' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Share your location' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeVisible();
  });

  it('places the shared browser location as a projected OSM map overlay', async () => {
    const user = userEvent.setup();
    mockedLoadMapConfiguration.mockResolvedValueOnce(activeOsmMapConfiguration);
    renderPage('ar');

    await screen.findByText('OpenStreetMap France, contributors');
    await user.click(screen.getByRole('button', { name: 'Share your location' }));

    const userMarker = await screen.findByRole('button', {
      name: 'User location marker',
    });
    expect(userMarker).not.toHaveClass('current-location-marker--static');
    expect(userMarker).toHaveAttribute('data-latitude', '25.286');
    expect(userMarker).toHaveAttribute('data-longitude', '55.379');
  });

  it('shows the resolved address when the user clicks their current location marker', async () => {
    const user = userEvent.setup();
    mockedLoadMapConfiguration.mockResolvedValueOnce(activeOsmMapConfiguration);
    renderPage('ar');

    await screen.findByText('OpenStreetMap France, contributors');
    await user.click(screen.getByRole('button', { name: 'Share your location' }));
    await user.click(
      await screen.findByRole('button', { name: 'User location marker' }),
    );

    const reverseGeocodeCall = reverseGeocodeFetchMock.mock.calls.find(
      (call): call is [URL, RequestInit] =>
        call[0] instanceof URL &&
        call[0].href.includes('/v0/location/maps/reverse-geocode'),
    );
    expect(reverseGeocodeCall?.[0].href).toContain(
      'http://localhost:4380/nodics/locationMap/v0/location/maps/reverse-geocode',
    );
    expect(reverseGeocodeCall?.[0].searchParams.get('latitude')).toBe('25.286');
    expect(reverseGeocodeCall?.[0].searchParams.get('locale')).toBe('ar');
    expect(reverseGeocodeCall?.[0].searchParams.get('longitude')).toBe('55.379');
    expect(reverseGeocodeCall?.[1].headers).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer token',
      'x-enterprise-code': 'default',
    });
    expect(
      await screen.findByRole('dialog', { name: 'Your current location' }),
    ).toBeVisible();
    expect(
      screen.getByText('Palm Jumeirah, Dubai, United Arab Emirates'),
    ).toBeVisible();
    expect(screen.queryByText(/25\.286/)).toBeNull();
  });

  it('filters from enterprise to linked collection centres', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findAllByText('Averda Recycling Center - Al Safa');
    await user.click(screen.getByRole('combobox', { name: 'Enterprise' }));
    await user.click(screen.getByRole('option', { name: 'BEAH Recycling Services' }));

    expect(
      screen.getAllByText('Averda Recycling Center - Al Safa').length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Partner Mall Bin')).toBeNull();
    expect(screen.getByText('1 visible')).toBeVisible();
  });

  it('selects a centre from a map marker and exposes compact related context', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole('button', { name: 'Partner Mall Bin marker' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Expand selected collection centre' }),
    );
    expect(screen.getByText('LOC_SAMPLE_COLLECTION_CENTRE_PARTNER_BIN')).toBeVisible();
    expect(
      screen.getByText('Drop off approved e-waste here for verified recycling.'),
    ).toBeVisible();
    expect(screen.queryByText('SAMPLE_E_WASTE_DROP_OFF')).toBeNull();
    expect(screen.getByRole('button', { name: 'Directions' })).toBeVisible();
    expect(screen.getAllByText('BEAH').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Enterprise' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Asset owner' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit location' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit address' })).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Edit in Workbench' }),
    ).toHaveAttribute(
      'href',
      '/schema-workbench?module=wasteCollection&schema=wasteCollectionPoint&search=WCP_SAMPLE_COLLECTION_CENTRE_PARTNER_BIN',
    );
  });

  it('shows asset-owner context without noisy traversal shortcuts', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole('button', {
        name: 'Averda Recycling Center - Al Safa marker',
      }),
    );

    await user.click(
      screen.getByRole('button', { name: 'Expand selected collection centre' }),
    );
    expect(screen.getAllByText('BEAH Recycling Services').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Asset owner' })).toBeNull();
  });

  it('routes collection-centre creation to Schema Workbench create mode', async () => {
    renderPage();

    expect(
      await screen.findByRole('link', { name: 'Create centre' }),
    ).toHaveAttribute(
      'href',
      '/schema-workbench?module=wasteCollection&schema=wasteCollectionPoint&mode=create',
    );
  });
});
