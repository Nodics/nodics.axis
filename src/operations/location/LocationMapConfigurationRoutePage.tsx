import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  FormControlLabel,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router';

import { ShellIcon } from '../../app/shell/ShellIcon';
import type {
  AxisAuthenticatedBootstrap,
  AxisModuleConnection,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkbenchRoutePage } from '../../workbench/WorkbenchRoutePage';
import {
  loadEditableLocationMapConfiguration,
  saveLocationMapConfiguration,
  type LocationMapConfiguration,
  type LocationMapConfigurationDraft,
  type LocationMapProviderOption,
} from './api/locationMapConfigurationClient';

interface LocationMapConfigurationRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly channel: string;
  readonly cmsBaseUrl: string;
  readonly employeeId: string;
  readonly locale: string;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
  readonly site: string;
}

const schemaGuidance: Readonly<Record<string, string>> = Object.freeze({
  locationMapProviderConfiguration:
    'Maintain one shared configuration per map usage. Provider, viewport, controls, marker appearance and zoom behavior apply to every connected application. Mapbox requires a frontend-safe public pk.* token.',
  locationMapProvider:
    'Manage map provider records that render Location maps. Create providers, open a provider to edit its renderer and token rules, or remove providers that are no longer allowed.',
  locationMapUsage:
    'Govern reusable usage codes such as collection centre maps, store locators, and customer near-me journeys.',
  locationMapStylePreset:
    'Maintain provider style presets that customer projects can reuse or override without changing frontend code.',
  locationMapControlPreset:
    'Maintain control presets for navigation, scale, geolocation, and directions behaviour.',
});

const mapSurfaceCode = 'SHARED';
const mapUsageCode = 'COLLECTION_CENTRE_MAP';
const defaultControls = Object.freeze([
  'FILTERS',
  'ZOOM',
  'SCALE',
  'GEOLOCATE',
  'DIRECTIONS',
]);
const defaultProviderOptions: readonly LocationMapProviderOption[] = Object.freeze([
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
]);
const osmHotStyleUrl = 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';

function initialDraft(): LocationMapConfigurationDraft {
  return {
    code: 'AXIS_COLLECTION_CENTRE_MAPBOX_STREETS',
    providerCode: 'MAPBOX',
    surfaceCode: mapSurfaceCode,
    usageCode: mapUsageCode,
    stylePresetCode: 'MAPBOX_STREETS',
    styleUrl: 'mapbox://styles/mapbox/streets-v12',
    publicAccessToken: '',
    fallbackProviderCode: 'OSM',
    fallbackPolicy: 'SETUP_REQUIRED',
    defaultCenterLatitude: 25.2048,
    defaultCenterLongitude: 55.2708,
    defaultZoom: 9,
    minimumZoom: 3,
    maximumZoom: 18,
    enabledControls: defaultControls,
    setupStatus: 'SETUP_REQUIRED',
    status: 'ACTIVE',
  };
}

function draftFromConfiguration(
  configuration: LocationMapConfiguration,
): LocationMapConfigurationDraft {
  const defaults = initialDraft();
  return {
    expectedRevision: configuration.revision,
    presentation: configuration.presentation,
    interaction: configuration.interaction,
    code: configuration.code || defaults.code,
    providerCode: configuration.providerCode || defaults.providerCode,
    surfaceCode: configuration.surfaceCode || defaults.surfaceCode,
    usageCode: configuration.usageCode || defaults.usageCode,
    stylePresetCode: configuration.stylePresetCode || defaults.stylePresetCode,
    styleUrl: configuration.styleUrl || defaults.styleUrl,
    publicAccessToken: configuration.publicAccessToken || '',
    fallbackProviderCode:
      configuration.fallbackProviderCode || defaults.fallbackProviderCode,
    fallbackPolicy: configuration.fallbackPolicy || defaults.fallbackPolicy,
    defaultCenterLatitude: configuration.defaultCenter.latitude,
    defaultCenterLongitude: configuration.defaultCenter.longitude,
    defaultZoom: configuration.defaultZoom,
    minimumZoom: configuration.minimumZoom ?? defaults.minimumZoom,
    maximumZoom: configuration.maximumZoom ?? defaults.maximumZoom,
    enabledControls: configuration.enabledControls,
    setupStatus: configuration.setupStatus || defaults.setupStatus,
    status: configuration.status || defaults.status,
  };
}

function stylePresetForProvider(
  provider: LocationMapProviderOption | undefined,
): string {
  if (provider?.rendererType === 'XYZ_TILE') return 'OSM_HOT';
  if (provider?.providerType === 'MAPBOX') return 'MAPBOX_STREETS';
  return '';
}

function styleUrlForProvider(
  provider: LocationMapProviderOption | undefined,
  currentStyleUrl: string,
): string {
  if (provider?.rendererType === 'XYZ_TILE') return osmHotStyleUrl;
  if (provider?.providerType === 'MAPBOX') {
    return currentStyleUrl || 'mapbox://styles/mapbox/streets-v12';
  }
  return currentStyleUrl;
}

function setupStatusForProvider(
  provider: LocationMapProviderOption | undefined,
  currentSetupStatus: string,
): string {
  if (!providerRequiresToken(provider)) return 'ACTIVE';
  return currentSetupStatus === 'ACTIVE' ? 'SETUP_REQUIRED' : currentSetupStatus;
}

function providerName(provider: LocationMapProviderOption): string {
  const english = provider.name.en;
  return typeof english === 'string' && english.trim() ? english : provider.code;
}

function providerRequiresToken(
  provider: LocationMapProviderOption | undefined,
): boolean {
  return provider?.requiresPublicAccessToken === true || provider?.code === 'MAPBOX';
}

function tokenPrefix(provider: LocationMapProviderOption | undefined): string {
  return (
    provider?.frontendSafeTokenPrefix || (provider?.code === 'MAPBOX' ? 'pk.' : '')
  );
}

function setupStatusColor(status: string): 'success' | 'warning' | 'default' | 'error' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'SETUP_REQUIRED') return 'warning';
  if (status === 'INVALID') return 'error';
  return 'default';
}

function locationMapWorkspaces(
  bootstrap: AxisAuthenticatedBootstrap,
): readonly AxisNavigationItem[] {
  return bootstrap.navigation
    .filter(
      (item) =>
        item.route === '/location/maps' || item.route.startsWith('/location/maps/'),
    )
    .sort(
      (left, right) =>
        left.order - right.order || left.label.localeCompare(right.label),
    );
}

function activeSchemaLabel(navigation: AxisNavigationItem): string {
  return navigation.workbenchTarget?.schemaName
    ? navigation.workbenchTarget.schemaName.replace(/([a-z])([A-Z])/g, '$1 $2')
    : 'Location Map';
}

function locationMapWorkbenchBootstrap(
  bootstrap: AxisAuthenticatedBootstrap,
  runtime: AxisRuntimeConfig,
): AxisAuthenticatedBootstrap {
  if ((bootstrap.moduleConnections.locationMap?.length ?? 0) > 0) return bootstrap;
  if (!runtime.locationBaseUrl) return bootstrap;
  const fallbackConnection: AxisModuleConnection = Object.freeze({
    moduleName: 'locationMap',
    instanceId: `${runtime.projectCode}:locationServer:locationMap:axis-runtime`,
    endpoint: runtime.locationBaseUrl,
    environment: bootstrap.environments[0] ?? 'local',
    server: 'locationServer',
    state: 'UP',
  });
  return Object.freeze({
    ...bootstrap,
    moduleConnections: Object.freeze({
      ...bootstrap.moduleConnections,
      locationMap: Object.freeze([fallbackConnection]),
    }),
  });
}

interface LocationMapSetupFormProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly initialConfiguration: LocationMapConfigurationDraft;
  readonly loadError: unknown;
  readonly providerOptions: readonly LocationMapProviderOption[];
  readonly runtime: AxisRuntimeConfig;
}

function LocationMapSetupForm(props: LocationMapSetupFormProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<LocationMapConfigurationDraft>(
    props.initialConfiguration,
  );
  const [successMessage, setSuccessMessage] = useState('');
  const providerOptions =
    props.providerOptions.length > 0 ? props.providerOptions : defaultProviderOptions;
  const selectedProvider = providerOptions.find(
    (provider) => provider.code === draft.providerCode,
  );
  const selectedFallbackProvider = providerOptions.find(
    (provider) => provider.code === draft.fallbackProviderCode,
  );
  const selectedTokenPrefix = tokenPrefix(selectedProvider);
  const saveMutation = useMutation({
    mutationFn: (configuration: LocationMapConfigurationDraft) =>
      saveLocationMapConfiguration(props.bootstrap, {
        accessToken: props.accessToken,
        configuration,
        enterpriseCode: props.runtime.enterpriseCode,
        locationBaseUrl: props.runtime.locationBaseUrl,
        surfaceCode: configuration.surfaceCode,
        timeoutMs: props.runtime.requestTimeoutMs,
        usageCode: configuration.usageCode,
      }),
    onSuccess: (configuration) => {
      setDraft(draftFromConfiguration(configuration));
      setSuccessMessage(
        'Shared map configuration saved. Connected applications refresh automatically.',
      );
      void queryClient.invalidateQueries({ queryKey: ['location-map-configuration'] });
    },
  });

  const tokenInvalid =
    selectedTokenPrefix !== '' &&
    draft.publicAccessToken.trim() !== '' &&
    !draft.publicAccessToken.trim().startsWith(selectedTokenPrefix);
  const activeRequiresToken =
    providerRequiresToken(selectedProvider) &&
    draft.setupStatus === 'ACTIVE' &&
    !draft.publicAccessToken.trim().startsWith(selectedTokenPrefix);
  const zoomInvalid = draft.minimumZoom > draft.maximumZoom;
  const saveDisabled =
    tokenInvalid ||
    activeRequiresToken ||
    zoomInvalid ||
    saveMutation.isPending ||
    !draft.code.trim() ||
    !draft.styleUrl.trim();

  const updateText = (field: keyof LocationMapConfigurationDraft, value: string) => {
    setSuccessMessage('');
    setDraft((current) => ({ ...current, [field]: value }));
  };
  const updateNumber = (field: keyof LocationMapConfigurationDraft, value: string) => {
    setSuccessMessage('');
    const parsed = Number(value);
    setDraft((current) => ({
      ...current,
      [field]: Number.isFinite(parsed) ? parsed : 0,
    }));
  };

  return (
    <Paper component="section" sx={{ p: 2 }} variant="outlined">
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!saveDisabled) saveMutation.mutate(draft);
        }}
      >
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            sx={{ justifyContent: 'space-between' }}
          >
            <Box>
              <Typography variant="overline">Map provider setup</Typography>
              <Typography variant="h5">Shared collection-centre map</Typography>
              <Typography color="text.secondary">
                Changes apply to Axis, Circa and every application using this map.
                Location owns the provider, viewport, controls, pins and zoom behavior.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Chip
                color={setupStatusColor(draft.setupStatus)}
                label={draft.setupStatus}
                size="small"
              />
              <Chip label={draft.providerCode || 'Provider'} size="small" />
              <Chip label={draft.surfaceCode} size="small" />
            </Stack>
          </Stack>

          {props.loadError ? (
            <Alert severity="warning">
              Current configuration could not be loaded from Location backend. You can
              still prepare the values here; save requires the Location Map
              configuration API to be running.
            </Alert>
          ) : null}
          {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
          {saveMutation.error ? (
            <Alert severity="error">
              {saveMutation.error instanceof Error
                ? saveMutation.error.message
                : 'Map configuration could not be saved.'}
            </Alert>
          ) : null}
          {tokenInvalid ? (
            <Alert severity="error">
              This provider requires a frontend-safe public token starting with{' '}
              {selectedTokenPrefix}. Do not paste secret tokens into Axis.
            </Alert>
          ) : null}
          {activeRequiresToken ? (
            <Alert severity="warning">
              Add a public provider token before marking this configuration ACTIVE.
            </Alert>
          ) : null}
          {zoomInvalid ? (
            <Alert severity="error">
              Minimum zoom must be less than or equal to maximum zoom.
            </Alert>
          ) : null}

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            <TextField
              label="Configuration code"
              required
              value={draft.code}
              onChange={(event) => updateText('code', event.target.value)}
            />
            <TextField
              label="Provider"
              select
              value={draft.providerCode}
              onChange={(event) => {
                const provider = providerOptions.find(
                  (option) => option.code === event.target.value,
                );
                setSuccessMessage('');
                setDraft((current) => ({
                  ...current,
                  providerCode: event.target.value,
                  publicAccessToken: providerRequiresToken(provider)
                    ? current.publicAccessToken
                    : '',
                  setupStatus: setupStatusForProvider(provider, current.setupStatus),
                  stylePresetCode:
                    stylePresetForProvider(provider) || current.stylePresetCode,
                  styleUrl: styleUrlForProvider(provider, current.styleUrl),
                }));
              }}
            >
              {providerOptions.map((provider) => (
                <MenuItem key={provider.code} value={provider.code}>
                  {providerName(provider)} ({provider.rendererType})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Renderer"
              slotProps={{ input: { readOnly: true } }}
              value={selectedProvider?.rendererCode ?? draft.providerCode}
            />
            <TextField
              label="Setup status"
              select
              value={draft.setupStatus}
              onChange={(event) => updateText('setupStatus', event.target.value)}
            >
              <MenuItem value="SETUP_REQUIRED">SETUP_REQUIRED</MenuItem>
              <MenuItem value="ACTIVE">ACTIVE</MenuItem>
              <MenuItem value="INACTIVE">INACTIVE</MenuItem>
              <MenuItem value="INVALID">INVALID</MenuItem>
            </TextField>
            <TextField
              label="Applies to"
              value="All connected applications"
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              label="Usage code"
              value={draft.usageCode}
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              label="Record status"
              select
              value={draft.status}
              onChange={(event) => updateText('status', event.target.value)}
            >
              <MenuItem value="ACTIVE">ACTIVE</MenuItem>
              <MenuItem value="DRAFT">DRAFT</MenuItem>
              <MenuItem value="INACTIVE">INACTIVE</MenuItem>
            </TextField>
            <TextField
              disabled={!providerRequiresToken(selectedProvider)}
              label="Public access token"
              placeholder={selectedTokenPrefix || 'Not required'}
              value={draft.publicAccessToken}
              onChange={(event) => updateText('publicAccessToken', event.target.value)}
            />
            <TextField
              label="Style preset"
              value={draft.stylePresetCode}
              onChange={(event) => updateText('stylePresetCode', event.target.value)}
            />
            <TextField
              label="Style URL"
              required
              value={draft.styleUrl}
              onChange={(event) => updateText('styleUrl', event.target.value)}
            />
            <TextField
              label="Fallback provider"
              select
              value={draft.fallbackProviderCode}
              onChange={(event) =>
                updateText('fallbackProviderCode', event.target.value)
              }
            >
              {providerOptions.map((provider) => (
                <MenuItem key={provider.code} value={provider.code}>
                  {providerName(provider)} ({provider.rendererType})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Fallback renderer"
              slotProps={{ input: { readOnly: true } }}
              value={
                selectedFallbackProvider?.rendererCode ||
                draft.fallbackProviderCode ||
                'OSM'
              }
            />
            <TextField
              label="Fallback policy"
              select
              value={draft.fallbackPolicy}
              onChange={(event) => updateText('fallbackPolicy', event.target.value)}
            >
              <MenuItem value="SETUP_REQUIRED">SETUP_REQUIRED</MenuItem>
              <MenuItem value="ALLOW_BASIC_MAP">ALLOW_BASIC_MAP</MenuItem>
              <MenuItem value="NON_PRODUCTION_ONLY">NON_PRODUCTION_ONLY</MenuItem>
            </TextField>
            <TextField
              label="Default latitude"
              type="number"
              value={draft.defaultCenterLatitude}
              onChange={(event) =>
                updateNumber('defaultCenterLatitude', event.target.value)
              }
            />
            <TextField
              label="Default longitude"
              type="number"
              value={draft.defaultCenterLongitude}
              onChange={(event) =>
                updateNumber('defaultCenterLongitude', event.target.value)
              }
            />
            <TextField
              label="Default zoom"
              type="number"
              value={draft.defaultZoom}
              onChange={(event) => updateNumber('defaultZoom', event.target.value)}
            />
            <TextField
              label="Minimum zoom"
              type="number"
              value={draft.minimumZoom}
              onChange={(event) => updateNumber('minimumZoom', event.target.value)}
            />
            <TextField
              label="Maximum zoom"
              type="number"
              value={draft.maximumZoom}
              onChange={(event) => updateNumber('maximumZoom', event.target.value)}
            />
          </Box>

          <Divider />

          <Divider />
          <Typography variant="h6">Map controls</Typography>
          <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap' }}>
            {(
              [
                ['FILTERS', 'Centre type filters'],
                ['ZOOM', 'Zoom buttons'],
                ['SCALE', 'Distance scale'],
                ['GEOLOCATE', 'Find near me'],
                ['DIRECTIONS', 'Directions'],
              ] as const
            ).map(([code, label]) => (
              <FormControlLabel
                key={code}
                label={label}
                control={
                  <Checkbox
                    checked={draft.enabledControls.includes(code)}
                    onChange={(_event, checked) =>
                      setDraft((current) => ({
                        ...current,
                        enabledControls: checked
                          ? [...current.enabledControls, code]
                          : current.enabledControls.filter((value) => value !== code),
                      }))
                    }
                  />
                }
              />
            ))}
          </Stack>
          {draft.interaction ? (
            <>
              <Typography variant="h6">Scroll and zoom</Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                }}
              >
                <TextField
                  select
                  label="Wheel zoom"
                  value={draft.interaction.wheelZoomMode}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      interaction: {
                        ...current.interaction!,
                        wheelZoomMode: event.target.value as
                          | 'MODIFIER'
                          | 'FREE'
                          | 'DISABLED',
                      },
                    }))
                  }
                >
                  <MenuItem value="MODIFIER">Command / Control + scroll</MenuItem>
                  <MenuItem value="FREE">Scroll without a modifier key</MenuItem>
                  <MenuItem value="DISABLED">Disabled</MenuItem>
                </TextField>
                {(
                  [
                    ['wheelStep', 'Zoom step'],
                    ['wheelCooldownMs', 'Gesture spacing (milliseconds)'],
                    ['zoomAnimationSeconds', 'Zoom animation (seconds)'],
                  ] as const
                ).map(([key, label]) => (
                  <TextField
                    key={key}
                    label={label}
                    type="number"
                    value={draft.interaction![key]}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        interaction: {
                          ...current.interaction!,
                          [key]: Number(event.target.value),
                        },
                      }))
                    }
                  />
                ))}
              </Box>
            </>
          ) : null}
          {draft.presentation ? (
            <>
              <Typography variant="h6">Centre types and pins</Typography>
              <Typography color="text.secondary">
                Colours and labels apply to pins and filter buttons in every
                application. Matching terms use centre type, capabilities and legacy
                centre names.
              </Typography>
              {draft.presentation.categories.map((category, index) => (
                <Box
                  key={category.code}
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 2fr' },
                  }}
                >
                  <TextField
                    label={`${category.code} label`}
                    value={category.label}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        presentation: {
                          ...current.presentation!,
                          categories: current.presentation!.categories.map(
                            (value, i) =>
                              i === index
                                ? { ...value, label: event.target.value }
                                : value,
                          ),
                        },
                      }))
                    }
                  />
                  <TextField
                    label={`${category.code} pin colour`}
                    type="color"
                    value={category.color}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        presentation: {
                          ...current.presentation!,
                          categories: current.presentation!.categories.map(
                            (value, i) =>
                              i === index
                                ? { ...value, color: event.target.value }
                                : value,
                          ),
                        },
                      }))
                    }
                  />
                  <TextField
                    label={`${category.code} matching terms`}
                    value={category.matchTerms.join(', ')}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        presentation: {
                          ...current.presentation!,
                          categories: current.presentation!.categories.map(
                            (value, i) =>
                              i === index
                                ? {
                                    ...value,
                                    matchTerms: event.target.value
                                      .split(',')
                                      .map((term) => term.trim())
                                      .filter(Boolean),
                                  }
                                : value,
                          ),
                        },
                      }))
                    }
                  />
                </Box>
              ))}
            </>
          ) : null}
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button
              component={RouterLink}
              startIcon={<ShellIcon fontSize="small" name="location" />}
              to="/waste/collection-centres"
              variant="outlined"
            >
              Open map
            </Button>
            <Button
              disabled={saveDisabled}
              startIcon={<ShellIcon fontSize="small" name="settings" />}
              type="submit"
              variant="contained"
            >
              {saveMutation.isPending ? 'Saving' : 'Save configuration'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Paper>
  );
}

export function LocationMapConfigurationRoutePage(
  props: LocationMapConfigurationRoutePageProps,
) {
  const workbenchBootstrap = locationMapWorkbenchBootstrap(
    props.bootstrap,
    props.runtime,
  );
  const workspaces = locationMapWorkspaces(props.bootstrap);
  const activeSchema = props.navigation.workbenchTarget?.schemaName;
  const isConfigurationRoot = props.navigation.route === '/location/maps';
  const guidance =
    (activeSchema ? schemaGuidance[activeSchema] : undefined) ??
    props.navigation.help?.summary ??
    'Maintain backend-owned Location Map configuration records.';
  const setupQuery = useQuery({
    queryKey: [
      'location-map-configuration',
      props.bootstrap.tenantCode,
      props.runtime.enterpriseCode,
      mapSurfaceCode,
      mapUsageCode,
    ],
    queryFn: () =>
      loadEditableLocationMapConfiguration(props.bootstrap, {
        accessToken: props.accessToken,
        enterpriseCode: props.runtime.enterpriseCode,
        locationBaseUrl: props.runtime.locationBaseUrl,
        surfaceCode: mapSurfaceCode,
        timeoutMs: props.runtime.requestTimeoutMs,
        usageCode: mapUsageCode,
      }),
    enabled: isConfigurationRoot,
  });
  const setupConfiguration = setupQuery.data
    ? draftFromConfiguration(setupQuery.data)
    : initialDraft();

  return (
    <Stack spacing={2}>
      <Paper component="section" sx={{ p: 2 }} variant="outlined">
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            sx={{ justifyContent: 'space-between' }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline">
                {props.navigation.group?.label ?? 'System Configuration'}
              </Typography>
              <Typography variant="h4">{props.navigation.label}</Typography>
              <Typography color="text.secondary">{guidance}</Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Chip color="success" label="Backend driven" size="small" />
              <Chip label={props.navigation.availability} size="small" />
              <Chip label={activeSchemaLabel(props.navigation)} size="small" />
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {workspaces.map((item) => (
              <Button
                key={`${item.moduleName}:${item.id}`}
                component={RouterLink}
                size="small"
                startIcon={<ShellIcon fontSize="small" name={item.icon} />}
                to={item.route}
                variant={item.id === props.navigation.id ? 'contained' : 'outlined'}
              >
                {item.label}
              </Button>
            ))}
            <Button
              component={RouterLink}
              size="small"
              startIcon={<ShellIcon fontSize="small" name="location" />}
              to="/waste/collection-centres"
              variant="outlined"
            >
              Collection Centres
            </Button>
          </Stack>

          <Alert severity="info">
            {isConfigurationRoot
              ? 'Select the active map provider for this surface and usage. Provider records, styles, usages, and controls are maintained from their focused workbench links.'
              : 'This workspace is limited to the selected Location Map data type. Use Map Configuration when you want to choose the active provider used by the map renderer.'}
          </Alert>
        </Stack>
      </Paper>

      {isConfigurationRoot && setupQuery.isPending ? (
        <Alert severity="info">Loading shared map configuration…</Alert>
      ) : isConfigurationRoot ? (
        <LocationMapSetupForm
          key={setupConfiguration.code}
          accessToken={props.accessToken}
          bootstrap={props.bootstrap}
          initialConfiguration={setupConfiguration}
          loadError={setupQuery.error}
          providerOptions={setupQuery.data?.providerOptions ?? defaultProviderOptions}
          runtime={props.runtime}
        />
      ) : props.navigation.workbenchTarget ? (
        <WorkbenchRoutePage
          accessToken={props.accessToken}
          bootstrap={workbenchBootstrap}
          channel={props.channel}
          cmsBaseUrl={props.cmsBaseUrl}
          employeeId={props.employeeId}
          locale={props.locale}
          routeNavigation={props.navigation}
          routeSchema={props.navigation.workbenchTarget}
          runtime={props.runtime}
          site={props.site}
        />
      ) : (
        <Alert severity="warning">
          Location Map configuration is registered in navigation, but no editable
          workbench target was published for this route.
        </Alert>
      )}
    </Stack>
  );
}
