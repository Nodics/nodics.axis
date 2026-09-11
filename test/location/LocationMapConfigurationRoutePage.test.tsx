import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../src/app/AxisThemeProvider';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../src/bootstrap/publicBootstrap';
import { LocationMapConfigurationRoutePage } from '../../src/operations/location/LocationMapConfigurationRoutePage';
import {
  loadEditableLocationMapConfiguration,
  loadLocationMapConfiguration,
  saveLocationMapConfiguration,
  type LocationMapConfiguration,
} from '../../src/operations/location/api/locationMapConfigurationClient';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';

vi.mock('../../src/workbench/WorkbenchRoutePage', () => ({
  WorkbenchRoutePage: ({
    bootstrap,
    routeSchema,
  }: {
    readonly bootstrap?: AxisAuthenticatedBootstrap;
    readonly routeSchema?: { readonly moduleName: string; readonly schemaName: string };
  }) => (
    <div>
      Workbench: {routeSchema?.moduleName}.{routeSchema?.schemaName}
      <span>
        Location endpoint:{' '}
        {bootstrap?.moduleConnections.locationMap?.[0]?.endpoint ?? 'missing'}
      </span>
    </div>
  ),
}));

vi.mock(
  '../../src/operations/location/api/locationMapConfigurationClient',
  async () => {
    const actual = await vi.importActual<
      typeof import('../../src/operations/location/api/locationMapConfigurationClient')
    >('../../src/operations/location/api/locationMapConfigurationClient');
    return {
      ...actual,
      loadEditableLocationMapConfiguration: vi.fn(),
      loadLocationMapConfiguration: vi.fn(),
      saveLocationMapConfiguration: vi.fn(),
    };
  },
);

const mockedLoadLocationMapConfiguration = vi.mocked(loadLocationMapConfiguration);
const mockedLoadEditableLocationMapConfiguration = vi.mocked(
  loadEditableLocationMapConfiguration,
);
const mockedSaveLocationMapConfiguration = vi.mocked(saveLocationMapConfiguration);

const runtime: AxisRuntimeConfig = {
  backofficeBaseUrl: 'http://localhost:4300',
  locationBaseUrl: 'http://localhost:4380/nodics/locationMap',
  enterpriseCode: 'default',
  projectCode: 'nodics.kickoff',
  clientContractVersion: 1,
  requestTimeoutMs: 1_000,
  browserSessionCsrfCookieName: 'csrf',
  assistantMaximumEventBytes: 1_024,
  assistantReconnectWindowMs: 1_000,
  assistantIdleTimeoutMs: 1_000,
};

const setupRequiredConfiguration: LocationMapConfiguration = Object.freeze({
  contractVersion: 1,
  revision: 1,
  fallbackAllowed: true,
  refreshIntervalMs: 15000,
  presentation: {
    defaultCategoryCode: 'recycling',
    categories: [
      { code: 'repair', label: 'Repair', color: '#4CAF50', matchTerms: ['repair'] },
      { code: 'trade-in', label: 'Trade-in', color: '#2196F3', matchTerms: ['trade'] },
      {
        code: 'recycling',
        label: 'Recycling',
        color: '#ee9a08',
        matchTerms: ['recycling'],
      },
    ],
  },
  interaction: {
    wheelZoomMode: 'MODIFIER' as const,
    wheelStep: 1,
    wheelCooldownMs: 180,
    zoomAnimationSeconds: 0.42,
  },
  code: 'AXIS_COLLECTION_CENTRE_MAPBOX_STREETS',
  providerCode: 'MAPBOX',
  surfaceCode: 'AXIS',
  usageCode: 'COLLECTION_CENTRE_MAP',
  stylePresetCode: 'MAPBOX_STREETS',
  styleUrl: 'mapbox://styles/mapbox/streets-v12',
  publicAccessToken: '',
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
  setupStatus: 'SETUP_REQUIRED',
  configured: false,
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
  providerOptions: Object.freeze([
    Object.freeze({
      code: 'MAPBOX',
      name: Object.freeze({ en: 'Mapbox' }),
      providerType: 'MAPBOX',
      rendererCode: 'axis.location.mapbox',
      rendererType: 'MAPBOX_GL',
      requiresPublicAccessToken: true,
      frontendSafeTokenPrefix: 'pk.',
      status: 'ACTIVE',
    }),
    Object.freeze({
      code: 'OSM',
      name: Object.freeze({ en: 'OpenStreetMap' }),
      providerType: 'OSM',
      rendererCode: 'axis.location.tile',
      rendererType: 'XYZ_TILE',
      requiresPublicAccessToken: false,
      frontendSafeTokenPrefix: '',
      status: 'ACTIVE',
    }),
  ]),
});

const configurationNavigation: AxisNavigationItem = {
  id: 'location-map',
  label: 'Map Configuration',
  route: '/location/maps',
  order: 1050,
  moduleName: 'locationMap',
  category: 'operations',
  icon: 'location',
  availability: 'UP',
  featureState: 'ACTIVE',
  group: {
    id: 'system-configuration',
    label: 'System Configuration',
    order: 90,
  },
  perspectives: ['operations', 'business'],
  contexts: ['environment', 'tenant'],
  workbenchTarget: {
    moduleName: 'locationMap',
    schemaName: 'locationMapProviderConfiguration',
  },
  help: {
    summary: 'Configure reusable map providers, surfaces, usages, and setup state.',
  },
};

const providersNavigation: AxisNavigationItem = {
  ...configurationNavigation,
  id: 'location-map-providers',
  parentId: 'location-map',
  label: 'Providers',
  route: '/location/maps/providers',
  order: 1051,
  workbenchTarget: {
    moduleName: 'locationMap',
    schemaName: 'locationMapProvider',
  },
};

const stylesNavigation: AxisNavigationItem = {
  ...configurationNavigation,
  id: 'location-map-styles',
  parentId: 'location-map',
  label: 'Style Presets',
  route: '/location/maps/styles',
  order: 1053,
  workbenchTarget: {
    moduleName: 'locationMap',
    schemaName: 'locationMapStylePreset',
  },
};

const bootstrap: AxisAuthenticatedBootstrap = {
  axisPolicy: {
    contractVersion: 0,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 1,
    source: 'DEFAULT',
  },
  navigation: [configurationNavigation, providersNavigation, stylesNavigation],
  environments: ['kickoffLocal'],
  moduleCatalog: {},
  moduleConnections: {
    locationMap: [
      {
        moduleName: 'locationMap',
        instanceId: 'kickoffLocal:locationServer:locationMap:0',
        endpoint: 'http://localhost:4320/nodics/locationMap',
        environment: 'kickoffLocal',
        server: 'locationServer',
        state: 'UP',
      },
    ],
  },
  documentationSources: [],
  tenantCode: 'default',
};

function renderPage(navigation: AxisNavigationItem, route = navigation.route) {
  return render(
    <AxisThemeProvider>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[route]}>
          <LocationMapConfigurationRoutePage
            accessToken="employee-token"
            bootstrap={bootstrap}
            channel="web"
            cmsBaseUrl="/cms"
            employeeId="operator"
            locale="en-US"
            navigation={navigation}
            runtime={runtime}
            site="axis"
          />
        </MemoryRouter>
      </QueryClientProvider>
    </AxisThemeProvider>,
  );
}

describe('LocationMapConfigurationRoutePage', () => {
  beforeEach(() => {
    mockedLoadLocationMapConfiguration.mockReset();
    mockedLoadEditableLocationMapConfiguration.mockReset();
    mockedSaveLocationMapConfiguration.mockReset();
    mockedLoadLocationMapConfiguration.mockResolvedValue(setupRequiredConfiguration);
    mockedLoadEditableLocationMapConfiguration.mockResolvedValue(
      setupRequiredConfiguration,
    );
    mockedSaveLocationMapConfiguration.mockResolvedValue({
      ...setupRequiredConfiguration,
      publicAccessToken: 'pk.updated',
      setupStatus: 'ACTIVE',
      configured: true,
    });
  });

  it('opens map configuration with an actionable setup form', async () => {
    renderPage(configurationNavigation);

    expect(screen.getByRole('heading', { name: 'Map Configuration' })).toBeVisible();
    expect(screen.getByText('System Configuration')).toBeVisible();
    expect(screen.getByText(/select the active map provider/i)).toBeVisible();
    expect(
      await screen.findByRole('heading', { name: 'Shared collection-centre map' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Public access token')).toBeVisible();
    expect(screen.getByLabelText('Renderer')).toHaveValue('axis.location.mapbox');
    expect(screen.getByRole('button', { name: /Save configuration/i })).toBeVisible();
    expect(
      screen.queryByText('Workbench: locationMap.locationMapProviderConfiguration'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Collection Centres' })).toHaveAttribute(
      'href',
      '/waste/collection-centres',
    );
  });

  it('saves the Mapbox token and activates the configuration through Location backend', async () => {
    const user = userEvent.setup();
    renderPage(configurationNavigation);

    await user.type(await screen.findByLabelText('Public access token'), 'pk.updated');
    await user.click(screen.getByLabelText('Setup status'));
    await user.click(screen.getByRole('option', { name: 'ACTIVE' }));
    await user.click(screen.getByRole('button', { name: /Save configuration/i }));

    expect(mockedSaveLocationMapConfiguration).toHaveBeenCalledTimes(1);
    expect(
      mockedSaveLocationMapConfiguration.mock.calls[0]?.[1].configuration,
    ).toMatchObject({
      code: 'AXIS_COLLECTION_CENTRE_MAPBOX_STREETS',
      providerCode: 'MAPBOX',
      publicAccessToken: 'pk.updated',
      setupStatus: 'ACTIVE',
      styleUrl: 'mapbox://styles/mapbox/streets-v12',
    });
    expect(
      await screen.findByText(
        'Shared map configuration saved. Connected applications refresh automatically.',
      ),
    ).toBeVisible();
  });

  it('activates OSM as a tokenless tile renderer from the setup form', async () => {
    const user = userEvent.setup();
    renderPage(configurationNavigation);

    await screen.findByRole('heading', { name: 'Shared collection-centre map' });
    await user.click(screen.getByLabelText('Provider'));
    await user.click(screen.getByRole('option', { name: 'OpenStreetMap (XYZ_TILE)' }));
    expect(screen.getByLabelText('Renderer')).toHaveValue('axis.location.tile');
    expect(screen.getByLabelText('Setup status')).toHaveTextContent('ACTIVE');
    expect(screen.getByLabelText('Public access token')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Save configuration/i }));

    expect(mockedSaveLocationMapConfiguration).toHaveBeenCalledTimes(1);
    expect(
      mockedSaveLocationMapConfiguration.mock.calls[0]?.[1].configuration,
    ).toMatchObject({
      providerCode: 'OSM',
      publicAccessToken: '',
      setupStatus: 'ACTIVE',
      stylePresetCode: 'OSM_HOT',
      styleUrl: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    });
  });

  it('opens child configuration routes as focused Location Map workbench pages', () => {
    renderPage(providersNavigation, '/location/maps/providers');

    expect(screen.getByRole('heading', { name: 'Providers' })).toBeVisible();
    expect(screen.getByText(/manage map provider records/i)).toBeVisible();
    expect(screen.queryByLabelText('Public access token')).not.toBeInTheDocument();
    expect(
      screen.getByText('Workbench: locationMap.locationMapProvider'),
    ).toBeVisible();
    expect(
      screen.getByText(
        /Location endpoint: http:\/\/localhost:4320\/nodics\/locationMap/i,
      ),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Providers' })).toHaveAttribute(
      'href',
      '/location/maps/providers',
    );
  });

  it('bridges local Location Map workbench routes from runtime configuration', () => {
    render(
      <AxisThemeProvider>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter initialEntries={['/location/maps/providers']}>
            <LocationMapConfigurationRoutePage
              accessToken="employee-token"
              bootstrap={{ ...bootstrap, moduleConnections: {} }}
              channel="web"
              cmsBaseUrl="/cms"
              employeeId="operator"
              locale="en-US"
              navigation={providersNavigation}
              runtime={runtime}
              site="axis"
            />
          </MemoryRouter>
        </QueryClientProvider>
      </AxisThemeProvider>,
    );

    expect(
      screen.getByText('Workbench: locationMap.locationMapProvider'),
    ).toBeVisible();
    expect(
      screen.getByText(
        /Location endpoint: http:\/\/localhost:4380\/nodics\/locationMap/i,
      ),
    ).toBeVisible();
  });
});
