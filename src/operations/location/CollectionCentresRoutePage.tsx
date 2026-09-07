import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  type MapRef,
  type MarkerEvent,
} from 'react-map-gl/mapbox';
import {
  MapContainer,
  Marker as LeafletMarker,
  Popup as LeafletPopup,
  ScaleControl as LeafletScaleControl,
  TileLayer,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import { Link as RouterLink } from 'react-router';
import L, {
  type Map as LeafletMap,
} from 'leaflet';
import type { RequestParameters } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'leaflet/dist/leaflet.css';

import {
  AxisDataListing,
  type AxisDataListingColumn,
} from '../../app/table/AxisDataListing';
import type {
  AxisAuthenticatedBootstrap,
  AxisModuleConnection,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import { ShellIcon } from '../../app/shell/ShellIcon';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  dashboardCardPadding,
  dashboardComponentGap,
  dashboardContentGap,
} from '../shared/workbenchMetricDashboardModel';
import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import {
  loadCollectionCentreWorkspaceData,
  type CollectionCentreRecord,
} from './api/collectionCentresClient';
import {
  loadLocationMapConfiguration,
  reverseGeocodeLocation,
  type LocationMapConfiguration,
  type LocationMapRenderDescriptor,
} from './api/locationMapConfigurationClient';
import {
  AxisLocationMapFrame,
  AxisMapboxCanvas,
} from './components/AxisLocationMap';

interface CollectionCentresRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
}

const allEnterprises = '__ALL_ENTERPRISES__';
const emptyCollectionCentreRecords: readonly CollectionCentreRecord[] = Object.freeze(
  [],
);
const defaultDubaiLocation = Object.freeze({
  longitude: 55.481747846041145,
  latitude: 25.3233379650232,
});

type CentreVisualType = 'repair' | 'trade-in' | 'recycling';

interface MapFilterState {
  readonly repairWorkshop: boolean;
  readonly tradeInStore: boolean;
  readonly recyclingContainer: boolean;
}

const defaultMapFilters: MapFilterState = Object.freeze({
  repairWorkshop: false,
  tradeInStore: false,
  recyclingContainer: false,
});
const mapboxStreetsStyle = 'mapbox://styles/mapbox/streets-v12';
const fallbackTileSize = 256;
const fallbackStreetMapAttribution = 'OpenStreetMap France, contributors';
const defaultOsmRenderDescriptor: LocationMapRenderDescriptor = Object.freeze({
  providerCode: 'OSM',
  providerType: 'OSM',
  rendererCode: 'axis.location.tile',
  rendererType: 'XYZ_TILE',
  styleUrl: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
  tileUrlTemplate: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
  attribution: fallbackStreetMapAttribution,
  publicAccessToken: '',
  endpointPolicy: Object.freeze({}),
  frontendSafe: true,
});

interface MapCoordinate {
  readonly latitude: number;
  readonly longitude: number;
}

type UserLocationStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable';

interface UserLocationState {
  readonly status: UserLocationStatus;
  readonly coordinate?: MapCoordinate | undefined;
  readonly message?: string | undefined;
}

interface UserLocationAddressState {
  readonly status: 'idle' | 'loading' | 'resolved' | 'unavailable';
  readonly address?: string | undefined;
  readonly coordinateKey?: string | undefined;
}

const initialUserLocation: UserLocationState = Object.freeze({
  status: 'idle',
});
const initialUserLocationAddress: UserLocationAddressState = Object.freeze({
  status: 'idle',
});

function coordinateFromPosition(position: GeolocationPosition): MapCoordinate {
  return Object.freeze({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });
}

function coordinateKey(coordinate: MapCoordinate): string {
  return `${coordinate.latitude.toFixed(6)},${coordinate.longitude.toFixed(6)}`;
}

function locationAddressFallback(): string {
  return 'Address lookup is not available for this point yet.';
}

async function reverseGeocodeUserLocation(
  bootstrap: AxisAuthenticatedBootstrap,
  request: {
    readonly accessToken: string;
    readonly enterpriseCode: string;
    readonly locationBaseUrl?: string | undefined;
    readonly locale: string;
    readonly timeoutMs: number;
  },
  coordinate: MapCoordinate,
): Promise<string> {
  try {
    const result = await reverseGeocodeLocation(bootstrap, {
      accessToken: request.accessToken,
      enterpriseCode: request.enterpriseCode,
      locationBaseUrl: request.locationBaseUrl,
      locale: request.locale,
      timeoutMs: request.timeoutMs,
      surfaceCode: 'AXIS',
      usageCode: 'COLLECTION_CENTRE_MAP',
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    });
    return result.status === 'RESOLVED' ? result.address : '';
  } catch {
    return '';
  }
}

function locationButtonLabel(status: UserLocationStatus): string {
  if (status === 'requesting') return 'Locating...';
  if (status === 'granted') return 'Location Shared';
  return 'Share Location';
}

function userLocationMessage(state: UserLocationState): string | undefined {
  if (
    state.message &&
    (state.status === 'denied' || state.status === 'unavailable')
  ) {
    return state.message;
  }
  return undefined;
}

function geolocationErrorMessage(error: GeolocationPositionError): string {
  const detail = error.message ? `: ${error.message}` : '';
  if (error.code === error.PERMISSION_DENIED) {
    return `Browser denied location access${detail}. Allow location for this site and click Share Location again.`;
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return `Browser could not determine your location${detail}. Check system location services and try again.`;
  }
  if (error.code === error.TIMEOUT) {
    return `Browser location request timed out${detail}. Try again after location services respond.`;
  }
  return `Browser location failed${detail}.`;
}

function searchRecord(record: CollectionCentreRecord, query: string): boolean {
  if (!query) return true;
  const haystack = [
    record.code,
    record.name,
    record.collectionPointType,
    record.locationCode,
    record.operatorEnterpriseCode,
    record.operatorEnterpriseName,
    record.assetOwnerEnterpriseCode,
    record.assetOwnerEnterpriseName,
    record.addressLine,
    record.city,
    record.countryCode,
    record.operatingStatus,
    record.publicVisibility,
    record.status,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function centreVisualType(record: CollectionCentreRecord): CentreVisualType {
  const text = [record.name, record.collectionPointType, ...record.serviceCapabilities]
    .join(' ')
    .toLowerCase();
  if (text.includes('repair')) return 'repair';
  if (text.includes('trade')) return 'trade-in';
  return 'recycling';
}

function centreMatchesMapFilters(
  record: CollectionCentreRecord,
  filters: MapFilterState,
): boolean {
  if (!filters.repairWorkshop && !filters.tradeInStore && !filters.recyclingContainer) {
    return true;
  }
  const visualType = centreVisualType(record);
  return (
    (filters.repairWorkshop && visualType === 'repair') ||
    (filters.tradeInStore && visualType === 'trade-in') ||
    (filters.recyclingContainer && visualType === 'recycling')
  );
}

function markerColor(record: CollectionCentreRecord): string {
  const visualType = centreVisualType(record);
  if (visualType === 'repair') return '#4CAF50';
  if (visualType === 'trade-in') return '#2196F3';
  return '#ee9a08';
}

function markerTag(record: CollectionCentreRecord): {
  readonly className: string;
  readonly label: string;
} {
  const visualType = centreVisualType(record);
  if (visualType === 'repair') {
    return { className: 'location-tag location-tag--repair', label: 'Repair' };
  }
  if (visualType === 'trade-in') {
    return { className: 'location-tag location-tag--trade-in', label: 'Trade-in' };
  }
  return { className: 'location-tag location-tag--recycling', label: 'Recycling' };
}

function customerCollectionMessage(record: CollectionCentreRecord): string {
  const visualType = centreVisualType(record);
  if (visualType === 'repair') {
    return 'Bring your device here for repair or reuse support.';
  }
  if (visualType === 'trade-in') {
    return 'Bring eligible e-waste here for trade-in support.';
  }
  return 'Drop off approved e-waste here for verified recycling.';
}

function distanceInMeters(
  from: { readonly latitude: number; readonly longitude: number },
  to: { readonly latitude: number; readonly longitude: number },
): number {
  const earthRadiusMeters = 6371000;
  const latitudeDelta = ((to.latitude - from.latitude) * Math.PI) / 180;
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
  const fromLatitude = (from.latitude * Math.PI) / 180;
  const toLatitude = (to.latitude * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);
  return (
    earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function nearestCollectionCentre(
  records: readonly CollectionCentreRecord[],
  origin: {
    readonly latitude: number;
    readonly longitude: number;
  } = defaultDubaiLocation,
): CollectionCentreRecord | undefined {
  return records.reduce<CollectionCentreRecord | undefined>((nearest, record) => {
    if (!nearest) return record;
    return distanceInMeters(origin, record) < distanceInMeters(origin, nearest)
      ? record
      : nearest;
  }, undefined);
}

function mapDefaultLocation(mapConfiguration: LocationMapConfiguration | undefined): {
  readonly latitude: number;
  readonly longitude: number;
} {
  return mapConfiguration?.defaultCenter ?? defaultDubaiLocation;
}

function activeRenderDescriptor(
  mapConfiguration: LocationMapConfiguration | undefined,
): LocationMapRenderDescriptor | undefined {
  if (mapConfiguration?.renderDescriptor) return mapConfiguration.renderDescriptor;
  if (!mapConfiguration) return undefined;
  return Object.freeze({
    providerCode: mapConfiguration.providerCode,
    providerType: mapConfiguration.providerCode,
    rendererCode:
      mapConfiguration.providerCode === 'MAPBOX'
        ? 'axis.location.mapbox'
        : 'axis.location.unsupported',
    rendererType: mapConfiguration.providerCode === 'MAPBOX' ? 'MAPBOX_GL' : '',
    styleUrl: mapConfiguration.styleUrl,
    tileUrlTemplate: '',
    attribution: '',
    publicAccessToken: mapConfiguration.publicAccessToken,
    endpointPolicy: Object.freeze({}),
    frontendSafe: true,
  });
}

function fallbackRenderDescriptor(
  mapConfiguration: LocationMapConfiguration | undefined,
): LocationMapRenderDescriptor {
  const configuredFallback = mapConfiguration?.fallbackRenderer;
  if (configuredFallback && canUseTileRenderer(configuredFallback)) {
    return configuredFallback;
  }
  return defaultOsmRenderDescriptor;
}

function canUseMapboxRenderer(
  descriptor: LocationMapRenderDescriptor | undefined,
): descriptor is LocationMapRenderDescriptor {
  return (
    descriptor?.rendererType === 'MAPBOX_GL' &&
    descriptor.publicAccessToken.startsWith('pk.') &&
    descriptor.styleUrl.trim() !== ''
  );
}

function canUseTileRenderer(
  descriptor: LocationMapRenderDescriptor | undefined,
): descriptor is LocationMapRenderDescriptor {
  return (
    descriptor?.rendererType === 'XYZ_TILE' &&
    (descriptor.tileUrlTemplate.trim() !== '' || descriptor.styleUrl.trim() !== '')
  );
}

function canUseConfiguredRenderer(
  mapConfiguration: LocationMapConfiguration | undefined,
): boolean {
  const descriptor = activeRenderDescriptor(mapConfiguration);
  return (
    mapConfiguration?.configured === true &&
    (canUseMapboxRenderer(descriptor) || canUseTileRenderer(descriptor))
  );
}

function canUseBasicFallback(
  mapConfiguration: LocationMapConfiguration | undefined,
): boolean {
  return ['ALLOW_BASIC_MAP', 'NON_PRODUCTION_ONLY', 'SETUP_REQUIRED'].includes(
    mapConfiguration?.fallbackPolicy ?? '',
  );
}

function transformMapboxRequest(url: string): RequestParameters {
  return url.includes('mapbox.com') ? { referrerPolicy: 'no-referrer', url } : { url };
}

function tileRendererTileUrl(descriptor: LocationMapRenderDescriptor): string {
  return (
    descriptor.tileUrlTemplate ||
    descriptor.styleUrl ||
    defaultOsmRenderDescriptor.tileUrlTemplate
  );
}

function tileRendererAttribution(descriptor: LocationMapRenderDescriptor): string {
  return descriptor.attribution || fallbackStreetMapAttribution;
}

function siblingModuleEndpoint(
  rawEndpoint: string | undefined,
  siblingModuleName: string,
): string | undefined {
  if (!rawEndpoint) return undefined;
  try {
    const endpoint = new URL(rawEndpoint);
    const segments = endpoint.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return undefined;
    segments[segments.length - 1] = siblingModuleName;
    endpoint.pathname = `/${segments.join('/')}`;
    endpoint.search = '';
    endpoint.hash = '';
    return endpoint.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

function withFallbackModuleConnection(
  bootstrap: AxisAuthenticatedBootstrap,
  connections: Record<string, readonly AxisModuleConnection[]>,
  moduleName: string,
  endpoint: string | undefined,
  server: string,
): void {
  if ((connections[moduleName]?.length ?? 0) > 0 || !endpoint) return;
  connections[moduleName] = Object.freeze([
    Object.freeze({
      moduleName,
      instanceId: `${moduleName}:collection-centre-workspace`,
      endpoint,
      environment: bootstrap.environments[0] ?? 'local',
      server,
      state: 'UP',
    }),
  ]);
}

function collectionCentreWorkbenchBootstrap(
  bootstrap: AxisAuthenticatedBootstrap,
  runtime: AxisRuntimeConfig,
): AxisAuthenticatedBootstrap {
  const connections: Record<string, readonly AxisModuleConnection[]> = {
    ...bootstrap.moduleConnections,
  };
  const locationCoreEndpoint = siblingModuleEndpoint(
    runtime.locationBaseUrl,
    'locationCore',
  );
  withFallbackModuleConnection(
    bootstrap,
    connections,
    'wasteCollection',
    siblingModuleEndpoint(runtime.wasteApiBaseUrl, 'wasteCollection'),
    'wasteServer',
  );
  withFallbackModuleConnection(
    bootstrap,
    connections,
    'locationCore',
    locationCoreEndpoint,
    'locationServer',
  );
  withFallbackModuleConnection(
    bootstrap,
    connections,
    'locationType',
    locationCoreEndpoint,
    'locationServer',
  );
  withFallbackModuleConnection(
    bootstrap,
    connections,
    'profile',
    siblingModuleEndpoint(runtime.backofficeBaseUrl, 'profile'),
    'platformServer',
  );
  return Object.freeze({
    ...bootstrap,
    moduleConnections: Object.freeze(connections),
  });
}

function collectionPointWorkbenchRoute(record?: CollectionCentreRecord): string {
  const parameters = new URLSearchParams({
    module: 'wasteCollection',
    schema: 'wasteCollectionPoint',
  });
  if (record?.code) parameters.set('search', record.code);
  return `/schema-workbench?${parameters.toString()}`;
}

const legacyMapStyles = {
  '.collection-centres-map .mapboxgl-map': {
    fontFamily: 'inherit',
  },
  '.leaflet-street-map': {
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  '.collection-centres-map .leaflet-container': {
    fontFamily: 'inherit',
    height: '100%',
    width: '100%',
  },
  '.leaflet-collection-marker': {
    background: 'transparent',
    border: 0,
  },
  '.leaflet-collection-marker__pin': {
    border: '1px solid rgba(0,0,0,0.24)',
    borderRadius: '50% 50% 50% 0',
    boxShadow: '0 4px 6px rgba(0,0,0,0.28)',
    display: 'block',
    height: '30px',
    left: '6px',
    position: 'absolute',
    top: '2px',
    transform: 'rotate(-45deg)',
    width: '30px',
  },
  '.leaflet-collection-marker__pin::after': {
    background: 'white',
    borderRadius: '50%',
    content: '""',
    height: '12px',
    left: '8px',
    position: 'absolute',
    top: '8px',
    width: '12px',
  },
  '.custom-popup .mapboxgl-popup-content': {
    background: 'none !important',
    border: 'none !important',
    boxShadow: 'none !important',
    padding: '0 !important',
  },
  '.collection-centres-map .leaflet-popup-content-wrapper': {
    background: 'transparent',
    boxShadow: 'none',
    padding: 0,
  },
  '.collection-centres-map .leaflet-popup-content': {
    margin: 0,
  },
  '.custom-popup .mapboxgl-popup-tip': {
    borderTopColor: 'white !important',
    filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.1))',
  },
  '.collection-centres-map .leaflet-popup-tip': {
    background: 'white',
    filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.1))',
  },
  '.map-controls': {
    alignItems: 'flex-end',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    position: 'absolute',
    right: '50px',
    top: '20px',
    zIndex: 1000,
  },
  '.collection-centres-map--with-warning .map-controls': {
    top: '94px',
  },
  '.map-controls__buttons': {
    display: 'flex',
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  '.map-controls__stack': {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  '.map-controls__message': {
    backgroundColor: 'rgba(255,255,255,0.92)',
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: '4px',
    color: '#1a1a1a',
    fontSize: '13px',
    lineHeight: 1.4,
    maxWidth: '430px',
    padding: '8px 10px',
  },
  '.filter-button': {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    cursor: 'pointer',
    display: 'flex',
    font: 'inherit',
    fontWeight: 'bold',
    gap: '5px',
    padding: '8px 12px',
    transition: 'all 0.3s ease',
  },
  '.filter-button--repair': {
    border: '2px solid #4CAF50',
    color: '#4CAF50',
  },
  '.filter-button--repair.active': {
    backgroundColor: '#4CAF50',
    color: 'white',
  },
  '.filter-button--trade-in': {
    border: '2px solid #2196F3',
    color: '#2196F3',
  },
  '.filter-button--trade-in.active': {
    backgroundColor: '#2196F3',
    color: 'white',
  },
  '.filter-button--recycling': {
    border: '2px solid #ee9a08',
    color: '#ee9a08',
  },
  '.filter-button--recycling.active': {
    backgroundColor: '#ee9a08',
    color: 'white',
  },
  '.filter-button--near-me': {
    border: '2px solid #000',
    color: '#000',
  },
  '.filter-button--near-me.active': {
    backgroundColor: '#000',
    color: 'white',
  },
  '.filter-button--share-location': {
    border: '2px solid #d11f1f',
    color: '#d11f1f',
  },
  '.filter-button--share-location.active': {
    backgroundColor: '#d11f1f',
    color: 'white',
  },
  '.filter-button:disabled': {
    cursor: 'progress',
    opacity: 0.65,
  },
  '.current-location-marker': {
    alignItems: 'center',
    background: 'transparent',
    border: 0,
    color: '#d11f1f',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    font: '700 12px Arial, sans-serif',
    gap: '2px',
    lineHeight: 1,
    padding: 0,
    transform: 'translateY(2px)',
  },
  '.current-location-marker--static': {
    position: 'absolute',
    transform: 'translate(-50%, -100%)',
    zIndex: 4,
  },
  '.current-location-marker__pin': {
    alignItems: 'center',
    background: '#d11f1f',
    border: '3px solid white',
    borderRadius: '50% 50% 50% 0',
    boxShadow: '0 0 0 4px rgba(209,31,31,0.2), 0 4px 10px rgba(0,0,0,0.28)',
    display: 'flex',
    height: '24px',
    justifyContent: 'center',
    position: 'relative',
    transform: 'rotate(-45deg)',
    width: '24px',
  },
  '.current-location-marker__pin::after': {
    background: 'white',
    borderRadius: '50%',
    content: '""',
    height: '7px',
    transform: 'rotate(45deg)',
    width: '8px',
  },
  '.current-location-marker__label': {
    background: 'white',
    border: '1px solid rgba(209,31,31,0.4)',
    borderRadius: '999px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
    color: '#d11f1f',
    padding: '3px 7px',
  },
  '.location-popup': {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    maxWidth: '320px',
    minWidth: '240px',
    padding: '16px 32px 16px 16px',
    position: 'relative',
  },
  '.location-popup__close': {
    alignItems: 'center',
    background: 'transparent',
    border: 0,
    color: '#1a1a1a',
    cursor: 'pointer',
    display: 'flex',
    fontSize: '18px',
    height: '24px',
    justifyContent: 'center',
    lineHeight: 1,
    padding: 0,
    position: 'absolute',
    right: '8px',
    top: '8px',
    width: '24px',
  },
  '.location-popup__address': {
    color: '#1a1a1a',
    fontSize: '15px',
    fontWeight: 500,
    lineHeight: 1.35,
    marginBottom: '12px',
  },
  '.location-popup__summary': {
    color: '#555',
    fontSize: '14px',
    lineHeight: 1.4,
    marginBottom: '12px',
  },
  '.location-popup__tags': {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  '.location-popup__direction': {
    alignItems: 'center',
    backgroundColor: '#3c1dea',
    border: 'none',
    borderRadius: '16px',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    font: 'inherit',
    fontSize: '14px',
    fontWeight: 500,
    gap: '4px',
    padding: '4px 10px',
    transition: 'all 0.3s ease',
  },
  '.location-popup__direction:hover': {
    backgroundColor: '#3c1dea',
    opacity: 0.8,
  },
  '.location-tag': {
    borderRadius: '16px',
    fontSize: '13px',
    padding: '4px 10px',
  },
  '.location-tag--repair': {
    backgroundColor: '#4CAF5015',
    border: '1px solid #4CAF5030',
    color: '#4CAF50',
  },
  '.location-tag--trade-in': {
    backgroundColor: '#2196F315',
    border: '1px solid #2196F330',
    color: '#2196F3',
  },
  '.location-tag--recycling': {
    backgroundColor: '#a6e41515',
    border: '1px solid #a6e41530',
    color: '#ee9a08',
  },
  '@media (max-width: 768px)': {
    '.map-controls': {
      left: '16px',
      right: '16px',
      top: '16px',
    },
    '.collection-centres-map--with-warning .map-controls': {
      top: '116px',
    },
    '.map-controls__buttons': {
      flexWrap: 'wrap',
    },
    '.filter-button': {
      padding: '6px 10px',
    },
  },
} as const;

function MapFilterControls({
  filters,
  locationMessage,
  locationStatus,
  nearMeActive,
  onNearMeClick,
  onShareLocationClick,
  setFilters,
}: {
  readonly filters: MapFilterState;
  readonly locationMessage: string | undefined;
  readonly locationStatus: UserLocationStatus;
  readonly nearMeActive: boolean;
  readonly onNearMeClick: () => void;
  readonly onShareLocationClick: () => void;
  readonly setFilters: (updater: (previous: MapFilterState) => MapFilterState) => void;
}) {
  return (
    <div className="map-controls__stack">
      <div className="map-controls__buttons">
        <button
          className={`filter-button filter-button--repair ${
            filters.repairWorkshop ? 'active' : ''
          }`}
          onClick={() =>
            setFilters((previous) => ({
              ...previous,
              repairWorkshop: !previous.repairWorkshop,
            }))
          }
          type="button"
        >
          Repair
        </button>
        <button
          className={`filter-button filter-button--trade-in ${
            filters.tradeInStore ? 'active' : ''
          }`}
          onClick={() =>
            setFilters((previous) => ({
              ...previous,
              tradeInStore: !previous.tradeInStore,
            }))
          }
          type="button"
        >
          Trade-in
        </button>
        <button
          className={`filter-button filter-button--recycling ${
            filters.recyclingContainer ? 'active' : ''
          }`}
          onClick={() =>
            setFilters((previous) => ({
              ...previous,
              recyclingContainer: !previous.recyclingContainer,
            }))
          }
          type="button"
        >
          Recycling
        </button>
        <button
          className={`filter-button filter-button--near-me ${nearMeActive ? 'active' : ''}`}
          onClick={onNearMeClick}
          type="button"
        >
          Near Me
        </button>
        {locationStatus === 'granted' ? null : (
          <button
            aria-label="Share your location"
            className="filter-button filter-button--share-location"
            disabled={locationStatus === 'requesting'}
            onClick={onShareLocationClick}
            type="button"
          >
            {locationButtonLabel(locationStatus)}
          </button>
        )}
      </div>
      {locationMessage ? (
        <div className="map-controls__message">{locationMessage}</div>
      ) : null}
    </div>
  );
}

function MapFilterButtons({
  collectionPoints,
  filters,
  fallbackOrigin,
  focusMap,
  onRequestUserLocation,
  setFilters,
  userLocation,
}: {
  readonly collectionPoints: readonly CollectionCentreRecord[];
  readonly filters: MapFilterState;
  readonly fallbackOrigin: MapCoordinate;
  readonly focusMap: (coordinate: MapCoordinate, zoom: number) => void;
  readonly onRequestUserLocation: () => Promise<MapCoordinate | undefined>;
  readonly setFilters: (updater: (previous: MapFilterState) => MapFilterState) => void;
  readonly userLocation: UserLocationState;
}) {
  const [nearMeActive, setNearMeActive] = useState(false);
  const origin = userLocation.coordinate ?? fallbackOrigin;
  const nearestPoint = useMemo(
    () => nearestCollectionCentre(collectionPoints, origin),
    [collectionPoints, origin],
  );

  const flyToNearMe = async () => {
    let effectiveOrigin = userLocation.coordinate;
    if (!effectiveOrigin) {
      effectiveOrigin = await onRequestUserLocation();
    }
    if (!effectiveOrigin) return;
    const effectiveNearestPoint =
      nearestCollectionCentre(collectionPoints, effectiveOrigin) ?? nearestPoint;
    if (!effectiveNearestPoint) return;
    if (nearMeActive) {
      focusMap(effectiveOrigin, 9);
      setNearMeActive(false);
      return;
    }
    focusMap(effectiveNearestPoint, 14);
    setNearMeActive(true);
  };
  const shareAndFocusLocation = async () => {
    const coordinate = await onRequestUserLocation();
    if (!coordinate) return;
    focusMap(coordinate, 13);
    setNearMeActive(false);
  };

  return (
    <MapFilterControls
      filters={filters}
      locationMessage={userLocationMessage(userLocation)}
      locationStatus={userLocation.status}
      nearMeActive={nearMeActive}
      onNearMeClick={() => {
        void flyToNearMe();
      }}
      onShareLocationClick={() => {
        void shareAndFocusLocation();
      }}
      setFilters={setFilters}
    />
  );
}

function LocationPopupContent({
  directionsOrigin,
  location,
  onClose,
}: {
  readonly directionsOrigin: MapCoordinate | undefined;
  readonly location: CollectionCentreRecord;
  readonly onClose: () => void;
}) {
  const tag = markerTag(location);
  const handleDirectionsClick = () => {
    const origin = directionsOrigin
      ? `&origin=${directionsOrigin.latitude.toString()},${directionsOrigin.longitude.toString()}`
      : '';
    const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${location.latitude.toString()},${location.longitude.toString()}`;
    window.open(url, '_blank');
  };

  return (
    <div className="location-popup">
      <button
        aria-label="Close collection centre popup"
        className="location-popup__close"
        onClick={onClose}
        type="button"
      >
        x
      </button>
      <div className="location-popup__address">{location.name}</div>
      <div className="location-popup__summary">
        {customerCollectionMessage(location)}
      </div>
      <div className="location-popup__tags">
        <span className={tag.className}>{tag.label}</span>
        <button
          className="location-popup__direction"
          onClick={handleDirectionsClick}
          type="button"
        >
          Directions
        </button>
      </div>
    </div>
  );
}

function LocationPopup({
  directionsOrigin,
  location,
  onClose,
}: {
  readonly directionsOrigin: MapCoordinate | undefined;
  readonly location: CollectionCentreRecord;
  readonly onClose: () => void;
}) {
  return (
    <Popup
      anchor="bottom"
      className="custom-popup"
      closeButton={false}
      closeOnClick={false}
      latitude={location.latitude}
      longitude={location.longitude}
      offset={[15, -45]}
      onClose={onClose}
    >
      <LocationPopupContent
        directionsOrigin={directionsOrigin}
        location={location}
        onClose={onClose}
      />
    </Popup>
  );
}

function UserLocationPopupContent({
  addressState,
  onClose,
}: {
  readonly addressState: UserLocationAddressState;
  readonly onClose: () => void;
}) {
  const address =
    addressState.status === 'resolved'
      ? addressState.address || locationAddressFallback()
      : addressState.status === 'loading'
        ? 'Finding your address...'
        : locationAddressFallback();

  return (
    <div
      aria-label="Your current location"
      className="location-popup location-popup--user-location"
      role="dialog"
    >
      <button
        aria-label="Close current location popup"
        className="location-popup__close"
        onClick={onClose}
        type="button"
      >
        x
      </button>
      <div className="location-popup__address">Your current location</div>
      <div className="location-popup__summary">{address}</div>
    </div>
  );
}

function UserLocationPopup({
  addressState,
  coordinate,
  onClose,
}: {
  readonly addressState: UserLocationAddressState;
  readonly coordinate: MapCoordinate;
  readonly onClose: () => void;
}) {
  return (
    <Popup
      anchor="bottom"
      className="custom-popup"
      closeButton={false}
      closeOnClick={false}
      latitude={coordinate.latitude}
      longitude={coordinate.longitude}
      offset={[15, -58]}
      onClose={onClose}
    >
      <UserLocationPopupContent addressState={addressState} onClose={onClose} />
    </Popup>
  );
}

function leafletCollectionCentreIcon(record: CollectionCentreRecord): L.DivIcon {
  const color = markerColor(record);
  return L.divIcon({
    className: 'leaflet-collection-marker',
    html: `<span class="leaflet-collection-marker__pin" style="background-color:${color}"></span>`,
    iconAnchor: [21, 42],
    iconSize: [42, 42],
    popupAnchor: [15, -45],
  });
}

function leafletUserLocationIcon(): L.DivIcon {
  return L.divIcon({
    className: 'leaflet-current-location-marker',
    html: [
      '<span class="current-location-marker">',
      '<span class="current-location-marker__label">You</span>',
      '<span class="current-location-marker__pin"></span>',
      '</span>',
    ].join(''),
    iconAnchor: [16, 40],
    iconSize: [42, 48],
    popupAnchor: [15, -58],
  });
}

function LeafletModifierWheelZoom({
  maximumZoom,
  minimumZoom,
}: {
  readonly maximumZoom: number;
  readonly minimumZoom: number;
}) {
  const lastZoomAtRef = useRef(0);

  const map = useMap();
  useEffect(() => {
    map.scrollWheelZoom.disable();
    const container = map.getContainer();
    const handleWheel = (originalEvent: WheelEvent) => {
      const isMacPlatform = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
      const hasZoomModifier = isMacPlatform
        ? originalEvent.metaKey
        : originalEvent.metaKey || originalEvent.ctrlKey;
      if (!hasZoomModifier) return;
      L.DomEvent.preventDefault(originalEvent);
      L.DomEvent.stopPropagation(originalEvent);

      if (originalEvent.deltaY === 0) return;

      const now = window.performance.now();
      if (now - lastZoomAtRef.current < 180) return;

      const direction = originalEvent.deltaY > 0 ? -1 : 1;
      const targetZoom = Math.max(
        minimumZoom,
        Math.min(maximumZoom, Math.round(map.getZoom()) + direction),
      );
      if (targetZoom === map.getZoom()) return;
      lastZoomAtRef.current = now;
      map.stop();
      map.flyTo(map.getCenter(), targetZoom, {
        animate: true,
        duration: 0.42,
        easeLinearity: 0.25,
      });
    };
    container.addEventListener('wheel', handleWheel, {
      capture: true,
      passive: false,
    });
    return () => container.removeEventListener('wheel', handleWheel, true);
  }, [map, maximumZoom, minimumZoom]);
  return null;
}

function LeafletMapSizeController() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const invalidate = () => {
      map.invalidateSize({ animate: false });
    };
    const frame = requestAnimationFrame(invalidate);
    const timeout = window.setTimeout(invalidate, 250);
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(invalidate);
    resizeObserver?.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      resizeObserver?.disconnect();
    };
  }, [map]);
  return null;
}

function CurrentLocationMarker({
  coordinate,
  onClick,
  staticPosition,
}: {
  readonly coordinate: MapCoordinate;
  readonly onClick: () => void;
  readonly staticPosition?:
    | { readonly left: number; readonly top: number }
    | undefined;
}) {
  return (
    <button
      aria-label="User location marker"
      className={`current-location-marker ${
        staticPosition ? 'current-location-marker--static' : ''
      }`}
      data-latitude={coordinate.latitude}
      data-longitude={coordinate.longitude}
      onClick={onClick}
      style={staticPosition}
      type="button"
    >
      <span className="current-location-marker__label">You</span>
      <span className="current-location-marker__pin" />
    </button>
  );
}

function MapPanel({
  accessToken,
  bootstrap,
  locale,
  mapConfiguration,
  records,
  runtime,
  selectedCode,
  onSelect,
}: {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly mapConfiguration: LocationMapConfiguration | undefined;
  readonly records: readonly CollectionCentreRecord[];
  readonly locale: string;
  readonly runtime: AxisRuntimeConfig;
  readonly selectedCode: string | undefined;
  readonly onSelect: (record: CollectionCentreRecord) => void;
}) {
  const [filters, setFilters] = useState<MapFilterState>(defaultMapFilters);
  const [popupCode, setPopupCode] = useState<string>();
  const [useFallbackStyle, setUseFallbackStyle] = useState(false);
  const [rendererFailureMessage, setRendererFailureMessage] = useState('');
  const [userLocation, setUserLocation] =
    useState<UserLocationState>(initialUserLocation);
  const [userLocationAddress, setUserLocationAddress] =
    useState<UserLocationAddressState>(initialUserLocationAddress);
  const mapRef = useRef<MapRef | null>(null);
  const leafletRef = useRef<LeafletMap | null>(null);
  const geolocationWatchIdRef = useRef<number | undefined>(undefined);
  const defaultCenter = mapDefaultLocation(mapConfiguration);
  const focusMap = useCallback((coordinate: MapCoordinate, zoom: number) => {
    mapRef.current?.flyTo({
      center: [coordinate.longitude, coordinate.latitude],
      zoom,
    });
    leafletRef.current?.flyTo([coordinate.latitude, coordinate.longitude], zoom);
  }, []);
  useEffect(
    () => () => {
      if (
        typeof navigator !== 'undefined' &&
        navigator.geolocation &&
        geolocationWatchIdRef.current !== undefined
      ) {
        navigator.geolocation.clearWatch(geolocationWatchIdRef.current);
      }
    },
    [],
  );
  const requestUserLocation = useCallback((): Promise<MapCoordinate | undefined> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setUserLocation(
        Object.freeze({
          status: 'unavailable',
          message: 'Location sharing is not available in this browser.',
        }),
      );
      return Promise.resolve(undefined);
    }
    if (geolocationWatchIdRef.current !== undefined) {
      navigator.geolocation.clearWatch(geolocationWatchIdRef.current);
      geolocationWatchIdRef.current = undefined;
    }
    setUserLocation((previous) =>
      Object.freeze({
        ...previous,
        status: 'requesting',
        message: 'Please allow location access so Axis can find centres near you.',
      }),
    );
    return new Promise((resolve) => {
      let resolved = false;
      const handleSuccess = (position: GeolocationPosition) => {
        const coordinate = coordinateFromPosition(position);
        setUserLocation(
          Object.freeze({
            status: 'granted',
            coordinate,
            message: 'Your current location is shown on the map.',
          }),
        );
        setUserLocationAddress(initialUserLocationAddress);
        focusMap(coordinate, 13);
        if (!resolved) {
          resolved = true;
          resolve(coordinate);
        }
      };
      const handleError = (error: GeolocationPositionError) => {
        setUserLocation(
          Object.freeze({
            status: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable',
            message: geolocationErrorMessage(error),
          }),
        );
        if (!resolved) {
          resolved = true;
          resolve(undefined);
        }
      };
      const options: PositionOptions = {
        enableHighAccuracy: false,
        maximumAge: 300_000,
        timeout: 20_000,
      };
      if (typeof navigator.geolocation.watchPosition === 'function') {
        geolocationWatchIdRef.current = navigator.geolocation.watchPosition(
          handleSuccess,
          handleError,
          options,
        );
        return;
      }
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        handleError,
        options,
      );
    });
  }, [focusMap]);
  const configuredDescriptor = activeRenderDescriptor(mapConfiguration);
  const fallbackDescriptor = fallbackRenderDescriptor(mapConfiguration);
  const activeRendererSupported = canUseConfiguredRenderer(mapConfiguration);
  const shouldUseFallback =
    useFallbackStyle ||
    Boolean(mapConfiguration && !activeRendererSupported && canUseBasicFallback(mapConfiguration));
  const effectiveMapboxDescriptor =
    !shouldUseFallback && canUseMapboxRenderer(configuredDescriptor)
      ? configuredDescriptor
      : undefined;
  const effectiveTileDescriptor =
    shouldUseFallback && canUseTileRenderer(fallbackDescriptor)
      ? fallbackDescriptor
      : !shouldUseFallback && canUseTileRenderer(configuredDescriptor)
        ? configuredDescriptor
        : undefined;
  const rendererReady =
    effectiveMapboxDescriptor !== undefined || effectiveTileDescriptor !== undefined;
  const rendererWarning =
    rendererFailureMessage ||
    (mapConfiguration && !activeRendererSupported && effectiveTileDescriptor
      ? 'The active map renderer is not available. Axis is showing the OSM fallback; check Map Configuration.'
      : '');
  const visibleRecords = useMemo(
    () => records.filter((record) => centreMatchesMapFilters(record, filters)),
    [filters, records],
  );
  const selectedRecord =
    visibleRecords.find((record) => record.code === selectedCode) ??
    records.find((record) => record.code === selectedCode);
  const popupRecord =
    visibleRecords.find((record) => record.code === popupCode) ??
    records.find((record) => record.code === popupCode);
  const initialViewState = useMemo(
    () => ({
      longitude: selectedRecord?.longitude ?? defaultCenter.longitude,
      latitude: selectedRecord?.latitude ?? defaultCenter.latitude,
      zoom: selectedRecord ? 10 : (mapConfiguration?.defaultZoom ?? 9),
    }),
    [
      defaultCenter.latitude,
      defaultCenter.longitude,
      mapConfiguration?.defaultZoom,
      selectedRecord,
    ],
  );

  const handleMarkerClick =
    (record: CollectionCentreRecord) => (event: MarkerEvent<MouseEvent>) => {
      event.originalEvent.stopPropagation();
      setPopupCode(record.code);
      onSelect(record);
    };
  const closeUserLocationPopup = () => {
    setUserLocationAddress(initialUserLocationAddress);
  };
  const openUserLocationPopup =
    (coordinate: MapCoordinate): void => {
      const key = coordinateKey(coordinate);
      setUserLocationAddress((current) => {
        if (
          current.coordinateKey === key &&
          (current.status === 'loading' || current.status === 'resolved')
        ) {
          return current;
        }
        return Object.freeze({ status: 'loading', coordinateKey: key });
      });
      void reverseGeocodeUserLocation(bootstrap, {
        accessToken,
        enterpriseCode: runtime.enterpriseCode,
        locationBaseUrl: runtime.locationBaseUrl,
        locale,
        timeoutMs: runtime.requestTimeoutMs,
      }, coordinate).then((address) => {
        setUserLocationAddress((current) => {
          if (current.coordinateKey !== key) return current;
          return Object.freeze({
            status: address ? 'resolved' : 'unavailable',
            address: address || undefined,
            coordinateKey: key,
          });
        });
      });
    };

  return (
    <AxisLocationMapFrame
      className={`collection-centres-map ${
        rendererWarning ? 'collection-centres-map--with-warning' : ''
      }`}
      ariaLabel="Collection centres map"
      styles={legacyMapStyles}
    >
      {rendererWarning ? (
        <Alert
          action={
            <Button component={RouterLink} size="small" to="/location/maps">
              Check configuration
            </Button>
          }
          severity="warning"
          sx={{
            left: 16,
            position: 'absolute',
            right: 16,
            top: 16,
            zIndex: 5,
          }}
        >
          {rendererWarning}
        </Alert>
      ) : null}
      {!rendererReady ? (
        <Stack
          spacing={2}
          sx={{
            alignItems: 'center',
            bgcolor: 'background.default',
            height: '100%',
            justifyContent: 'center',
            p: 4,
            textAlign: 'center',
          }}
        >
          <Typography variant="h6">Map provider setup required</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 560 }}>
            Location Map has not returned a frontend-safe renderer for the Axis
            collection-centre map.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button component={RouterLink} to="/location/maps" variant="contained">
              Configure Location Map
            </Button>
            {canUseBasicFallback(mapConfiguration) ? (
              <Button
                onClick={() => {
                  setRendererFailureMessage(
                    'Axis is showing the OSM fallback. Check Map Configuration before publishing this setup to customer-facing apps.',
                  );
                  setUseFallbackStyle(true);
                }}
                variant="outlined"
              >
                Use basic map
              </Button>
            ) : null}
          </Stack>
        </Stack>
      ) : effectiveTileDescriptor ? (
        <Box className="leaflet-street-map">
          <MapContainer
            attributionControl
            center={[initialViewState.latitude, initialViewState.longitude]}
            maxZoom={mapConfiguration?.maximumZoom ?? 18}
            minZoom={mapConfiguration?.minimumZoom ?? 3}
            ref={leafletRef}
            scrollWheelZoom={false}
            style={{ height: '100%', width: '100%' }}
            zoom={initialViewState.zoom}
            zoomControl={false}
            zoomAnimation
            zoomDelta={1}
            zoomSnap={1}
          >
            <TileLayer
              attribution={tileRendererAttribution(effectiveTileDescriptor)}
              tileSize={fallbackTileSize}
              url={tileRendererTileUrl(effectiveTileDescriptor)}
            />
            <LeafletMapSizeController />
            <LeafletModifierWheelZoom
              maximumZoom={mapConfiguration?.maximumZoom ?? 18}
              minimumZoom={mapConfiguration?.minimumZoom ?? 3}
            />
            <ZoomControl position="bottomright" />
            <LeafletScaleControl />
            {visibleRecords.map((record) => (
              <LeafletMarker
                eventHandlers={{
                  click: () => {
                    setPopupCode(record.code);
                    onSelect(record);
                  },
                }}
                icon={leafletCollectionCentreIcon(record)}
                key={record.code}
                position={[record.latitude, record.longitude]}
                title={`${record.name} marker`}
              >
                {popupRecord?.code === record.code ? (
                  <LeafletPopup
                    autoPan
                    closeButton={false}
                    closeOnClick={false}
                    offset={[15, -45]}
                  >
                    <LocationPopupContent
                      directionsOrigin={userLocation.coordinate}
                      location={record}
                      onClose={() => setPopupCode(undefined)}
                    />
                  </LeafletPopup>
                ) : null}
              </LeafletMarker>
            ))}
            {userLocation.coordinate ? (
              <LeafletMarker
                eventHandlers={{
                  click: () => {
                    if (userLocation.coordinate) {
                      openUserLocationPopup(userLocation.coordinate);
                    }
                  },
                }}
                icon={leafletUserLocationIcon()}
                position={[
                  userLocation.coordinate.latitude,
                  userLocation.coordinate.longitude,
                ]}
                title="User location marker"
                zIndexOffset={1000}
              >
                {userLocationAddress.status !== 'idle' ? (
                  <LeafletPopup
                    autoPan
                    closeButton={false}
                    closeOnClick={false}
                    offset={[15, -58]}
                  >
                    <UserLocationPopupContent
                      addressState={userLocationAddress}
                      onClose={closeUserLocationPopup}
                    />
                  </LeafletPopup>
                ) : null}
              </LeafletMarker>
            ) : null}
          </MapContainer>
          <div className="map-controls">
            <MapFilterButtons
              collectionPoints={records}
              fallbackOrigin={defaultCenter}
              focusMap={focusMap}
              filters={filters}
              onRequestUserLocation={requestUserLocation}
              setFilters={setFilters}
              userLocation={userLocation}
            />
          </div>
          {visibleRecords.length === 0 ? (
            <Box
              sx={{
                bgcolor: 'rgba(255,255,255,0.88)',
                borderRadius: 1,
                left: '50%',
                px: 2,
                py: 1,
                position: 'absolute',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 2,
              }}
            >
              <Typography align="center" color="text.secondary">
                No matching collection centres
              </Typography>
            </Box>
          ) : null}
        </Box>
      ) : effectiveMapboxDescriptor ? (
        <AxisMapboxCanvas
          accessToken={effectiveMapboxDescriptor.publicAccessToken}
          initialViewState={initialViewState}
          mapStyle={effectiveMapboxDescriptor.styleUrl || mapboxStreetsStyle}
          onError={(event) => {
            const message = event.error?.message ?? '';
            if (canUseBasicFallback(mapConfiguration)) {
              setRendererFailureMessage(
                message
                  ? 'The active map renderer reported an issue. Axis is showing the OSM fallback; check Map Configuration.'
                  : 'The active map renderer could not be reached. Axis is showing the OSM fallback; check Map Configuration.',
              );
              setUseFallbackStyle(true);
            }
          }}
          mapRef={mapRef}
          transformRequest={transformMapboxRequest}
        >
          <div className="map-controls">
            <MapFilterButtons
              collectionPoints={records}
              fallbackOrigin={defaultCenter}
              focusMap={focusMap}
              filters={filters}
              onRequestUserLocation={requestUserLocation}
              setFilters={setFilters}
              userLocation={userLocation}
            />
            <NavigationControl
              position="bottom-right"
              style={{ marginBottom: '20px', marginRight: '20px' }}
            />
            <ScaleControl />
          </div>
          {visibleRecords.map((record) => (
            <Marker
              aria-label={`${record.name} marker`}
              anchor="bottom"
              color={markerColor(record)}
              key={record.code}
              latitude={record.latitude}
              longitude={record.longitude}
              offset={[0, -10]}
              onClick={handleMarkerClick(record)}
              style={{ cursor: 'pointer' }}
            />
          ))}
          {popupRecord ? (
            <LocationPopup
              directionsOrigin={userLocation.coordinate}
              location={popupRecord}
              onClose={() => setPopupCode(undefined)}
            />
          ) : null}
          {userLocation.coordinate ? (
            <Marker
              anchor="bottom"
              latitude={userLocation.coordinate.latitude}
              longitude={userLocation.coordinate.longitude}
              offset={[0, -10]}
              style={{ cursor: 'pointer', zIndex: 5 }}
            >
              <CurrentLocationMarker
                coordinate={userLocation.coordinate}
                onClick={() => {
                  if (userLocation.coordinate) {
                    openUserLocationPopup(userLocation.coordinate);
                  }
                }}
              />
            </Marker>
          ) : null}
          {userLocation.coordinate && userLocationAddress.status !== 'idle' ? (
            <UserLocationPopup
              addressState={userLocationAddress}
              coordinate={userLocation.coordinate}
              onClose={closeUserLocationPopup}
            />
          ) : null}
          {visibleRecords.length === 0 ? (
            <Box
              sx={{
                bgcolor: 'rgba(255,255,255,0.88)',
                borderRadius: 1,
                left: '50%',
                px: 2,
                py: 1,
                position: 'absolute',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 2,
              }}
            >
              <Typography align="center" color="text.secondary">
                No matching collection centres
              </Typography>
            </Box>
          ) : null}
        </AxisMapboxCanvas>
      ) : null}
    </AxisLocationMapFrame>
  );
}

function SelectedCentrePanel({
  record,
  summaryExpanded,
  onToggleSummary,
}: {
  readonly record: CollectionCentreRecord | undefined;
  readonly summaryExpanded: boolean;
  readonly onToggleSummary: () => void;
}) {
  if (!record) {
    return (
      <Paper variant="outlined" sx={{ p: dashboardCardPadding }}>
        <Typography color="text.secondary">Select a collection centre</Typography>
      </Paper>
    );
  }
  const tag = markerTag(record);
  return (
    <Paper
      aria-label="Selected collection centre"
      variant="outlined"
      sx={{
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{
          alignItems: { md: 'center' },
          bgcolor: 'background.paper',
          justifyContent: 'space-between',
          px: { xs: 1.5, sm: 2 },
          py: 1.5,
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={{ xs: 0.75, md: 2 }}
          sx={{ alignItems: { md: 'center' }, minWidth: 0 }}
        >
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography noWrap variant="h6">
              {record.name}
            </Typography>
            <Typography color="text.secondary" noWrap variant="body2">
              {record.addressLine || record.city || record.locationCode}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Chip
              label={tag.label}
              size="small"
              sx={{
                bgcolor: `${markerColor(record)}18`,
                borderColor: `${markerColor(record)}55`,
                color: markerColor(record),
                fontWeight: 700,
              }}
              variant="outlined"
            />
            <Chip label={record.operatingStatus} size="small" />
            <Chip label={record.publicVisibility} size="small" variant="outlined" />
            <Chip
              label="Operational master data"
              size="small"
              variant="outlined"
            />
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button
            component={RouterLink}
            size="small"
            startIcon={<ShellIcon name="schema" />}
            to={collectionPointWorkbenchRoute(record)}
            variant="outlined"
          >
            Open Schema
          </Button>
          <Tooltip title={summaryExpanded ? 'Hide centre details' : 'Show centre details'}>
            <IconButton
              aria-expanded={summaryExpanded}
              aria-label={
                summaryExpanded
                  ? 'Collapse selected collection centre'
                  : 'Expand selected collection centre'
              }
              onClick={onToggleSummary}
              size="small"
            >
              <ShellIcon name={summaryExpanded ? 'chevron-up' : 'chevron-down'} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Collapse in={summaryExpanded} timeout="auto" unmountOnExit>
        <Divider />
        <Stack spacing={2} sx={{ px: { xs: 1.5, sm: 2 }, py: 2 }}>
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(4, minmax(0, 1fr))',
              },
            }}
          >
            <Stack spacing={0.25}>
              <Typography color="text.secondary" variant="caption">
                Operator
              </Typography>
              <Typography variant="body2">{record.operatorEnterpriseName}</Typography>
            </Stack>
            <Stack spacing={0.25}>
              <Typography color="text.secondary" variant="caption">
                Asset owner
              </Typography>
              <Typography variant="body2">
                {record.assetOwnerEnterpriseName || '-'}
              </Typography>
            </Stack>
            <Stack spacing={0.25}>
              <Typography color="text.secondary" variant="caption">
                Location
              </Typography>
              <Typography noWrap variant="body2">
                {record.locationCode}
              </Typography>
            </Stack>
            <Stack spacing={0.25}>
              <Typography color="text.secondary" variant="caption">
                Coordinates
              </Typography>
              <Typography variant="body2">
                {record.latitude.toFixed(5)}, {record.longitude.toFixed(5)}
              </Typography>
            </Stack>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button
              component={RouterLink}
              size="small"
              startIcon={<ShellIcon name="format" />}
              to={collectionPointWorkbenchRoute(record)}
              variant="contained"
            >
              Edit in Workbench
            </Button>
          </Stack>
        </Stack>
      </Collapse>
    </Paper>
  );
}

const columns: readonly AxisDataListingColumn<CollectionCentreRecord>[] = Object.freeze(
  [
    {
      key: 'name',
      label: 'Collection centre',
      minWidth: 280,
      render: (record) => (
        <Stack spacing={0.25}>
          <Typography sx={{ fontWeight: 700 }} variant="body2">
            {record.name}
          </Typography>
          <Typography color="text.secondary" noWrap variant="caption">
            {record.code}
          </Typography>
        </Stack>
      ),
      exportValue: (record) => record.name,
    },
    {
      key: 'type',
      label: 'Type',
      minWidth: 120,
      render: (record) => {
        const tag = markerTag(record);
        return (
          <Chip
            label={tag.label}
            size="small"
            sx={{
              bgcolor: `${markerColor(record)}18`,
              borderColor: `${markerColor(record)}55`,
              color: markerColor(record),
              fontWeight: 700,
            }}
            variant="outlined"
          />
        );
      },
      exportValue: (record) => markerTag(record).label,
    },
    {
      key: 'operator',
      label: 'Operator',
      minWidth: 210,
      render: (record) => record.operatorEnterpriseName,
      exportValue: (record) => record.operatorEnterpriseName,
    },
    {
      key: 'assetOwner',
      label: 'Asset owner',
      minWidth: 220,
      render: (record) => record.assetOwnerEnterpriseName || '-',
      exportValue: (record) => record.assetOwnerEnterpriseName,
    },
    {
      key: 'address',
      label: 'Address',
      minWidth: 320,
      render: (record) => (
        <Typography color="text.secondary" variant="body2">
          {record.addressLine || record.city || record.locationCode}
        </Typography>
      ),
      exportValue: (record) => record.addressLine,
    },
    {
      key: 'status',
      label: 'Status',
      minWidth: 130,
      render: (record) => (
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
          <Chip label={record.operatingStatus} size="small" />
          <Chip label={record.publicVisibility} size="small" variant="outlined" />
        </Stack>
      ),
      exportValue: (record) => record.operatingStatus,
    },
    {
      key: '__actions',
      label: '',
      minWidth: 120,
      exportable: false,
      render: (record) => (
        <Button
          component={RouterLink}
          size="small"
          to={collectionPointWorkbenchRoute(record)}
          variant="outlined"
        >
          Open
        </Button>
      ),
    },
  ],
);

export function CollectionCentresRoutePage(props: CollectionCentresRoutePageProps) {
  const localization = useAxisLocalization();
  const [query, setQuery] = useState('');
  const [enterpriseCode, setEnterpriseCode] = useState(allEnterprises);
  const [selectedCode, setSelectedCode] = useState<string>();
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const workbenchBootstrap = useMemo(
    () => collectionCentreWorkbenchBootstrap(props.bootstrap, props.runtime),
    [props.bootstrap, props.runtime],
  );
  const configuration = useMemo(
    () => ({
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      timeoutMs: props.runtime.requestTimeoutMs,
      wasteApiBaseUrl: props.runtime.wasteApiBaseUrl,
    }),
    [
      props.accessToken,
      props.runtime.enterpriseCode,
      props.runtime.requestTimeoutMs,
      props.runtime.wasteApiBaseUrl,
    ],
  );
  const workspace = useQuery({
    queryKey: [
      'collection-centres',
      props.runtime.enterpriseCode,
      props.navigation.route,
    ],
    queryFn: () => loadCollectionCentreWorkspaceData(workbenchBootstrap, configuration),
  });
  const mapConfiguration = useQuery({
    queryKey: [
      'location-map-configuration',
      props.runtime.enterpriseCode,
      'AXIS',
      'COLLECTION_CENTRE_MAP',
    ],
    queryFn: () =>
      loadLocationMapConfiguration(props.bootstrap, {
        accessToken: props.accessToken,
        enterpriseCode: props.runtime.enterpriseCode,
        locationBaseUrl: props.runtime.locationBaseUrl,
        surfaceCode: 'AXIS',
        timeoutMs: props.runtime.requestTimeoutMs,
        usageCode: 'COLLECTION_CENTRE_MAP',
    }),
    retry: false,
  });
  const records = workspace.data?.records ?? emptyCollectionCentreRecords;
  const enterpriseOptions = useMemo(
    () =>
      Object.freeze(
        [
          ...new Map(
            records.flatMap((record) => [
              [record.operatorEnterpriseCode, record.operatorEnterpriseName],
              [record.assetOwnerEnterpriseCode, record.assetOwnerEnterpriseName],
            ]),
          ).entries(),
        ]
          .map(([code, label]) => ({ code, label }))
          .filter((record) => record.code)
          .sort((left, right) => left.label.localeCompare(right.label)),
      ),
    [records],
  );
  const filteredRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          (enterpriseCode === allEnterprises ||
            record.enterpriseRelationshipCodes.includes(enterpriseCode)) &&
          searchRecord(record, query.trim()),
      ),
    [enterpriseCode, query, records],
  );
  const selectedRecord =
    filteredRecords.find((record) => record.code === selectedCode) ??
    filteredRecords[0];

  return (
    <Stack spacing={dashboardContentGap}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={dashboardComponentGap}
        sx={{ alignItems: { md: 'flex-end' }, justifyContent: 'space-between' }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h4">Collection centres</Typography>
          <Typography color="text.secondary">
            {records.length.toString()} centres from Waste, Location, Profile, and
            Enterprise records.
          </Typography>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            label="Search"
            onChange={(event) => setQuery(event.target.value)}
            size="small"
            value={query}
          />
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel id="collection-centre-enterprise-filter">Enterprise</InputLabel>
            <Select
              label="Enterprise"
              labelId="collection-centre-enterprise-filter"
              onChange={(event) => {
                setEnterpriseCode(event.target.value);
                setSelectedCode(undefined);
              }}
              value={enterpriseCode}
            >
              <MenuItem value={allEnterprises}>All enterprises</MenuItem>
              {enterpriseOptions.map((option) => (
                <MenuItem key={option.code} value={option.code}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button onClick={() => void workspace.refetch()} variant="outlined">
            Refresh
          </Button>
          <Button
            component={RouterLink}
            startIcon={<ShellIcon name="add" />}
            to="/schema-workbench?module=wasteCollection&schema=wasteCollectionPoint&mode=create"
            variant="contained"
          >
            Create centre
          </Button>
        </Stack>
      </Stack>
      {workspace.isLoading ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={18} />
          <Typography color="text.secondary">Loading collection centres</Typography>
        </Stack>
      ) : null}
      {workspace.error ? (
        <Alert severity="error">
          {workspace.error instanceof Error
            ? workspace.error.message
            : 'Collection centres could not be loaded.'}
        </Alert>
      ) : null}
      {mapConfiguration.error ? (
        <Alert
          action={
            <Button component={RouterLink} size="small" to="/location/maps">
              Configure
            </Button>
          }
          severity="warning"
        >
          {mapConfiguration.error instanceof Error
            ? mapConfiguration.error.message
            : 'Location map configuration could not be loaded.'}
        </Alert>
      ) : null}
      {workspace.data?.unavailableSources.length ? (
        <Alert severity="warning">
          Missing workbench sources: {workspace.data.unavailableSources.join(', ')}
        </Alert>
      ) : null}
      <MapPanel
        accessToken={props.accessToken}
        bootstrap={props.bootstrap}
        locale={localization.locale}
        mapConfiguration={mapConfiguration.data}
        records={filteredRecords}
        runtime={props.runtime}
        selectedCode={selectedRecord?.code}
        onSelect={(record) => {
          setSelectedCode(record.code);
        }}
      />
      <SelectedCentrePanel
        record={selectedRecord}
        summaryExpanded={summaryExpanded}
        onToggleSummary={() => setSummaryExpanded((current) => !current)}
      />
      <AxisDataListing
        ariaLabel="Collection centres"
        columns={columns}
        emptyMessage="No collection centres matched the current filters."
        exportFileName="collection-centres"
        getRowKey={(record) => record.code}
        maxBodyHeight={420}
        minTableWidth={1110}
        onRowClick={(record) => {
          setSelectedCode(record.code);
        }}
        records={filteredRecords}
        selectedRowKey={selectedRecord?.code}
        size="small"
        toolbarStart={
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Chip
              label={`${filteredRecords.length.toString()} visible`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`${(workspace.data?.sourceCounts.locations ?? 0).toString()} locations`}
              size="small"
              variant="outlined"
            />
            <Link
              component={RouterLink}
              to="/schema-workbench?module=profile&schema=enterprise"
              underline="hover"
              variant="body2"
            >
              Enterprise records
            </Link>
          </Stack>
        }
      />
    </Stack>
  );
}
