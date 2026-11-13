import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';

import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisModuleAvailability,
  type AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  loadModuleHealth,
  loadModuleHealthDetail,
  refreshModuleHealth,
} from './api/moduleHealthClient';
import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { ModuleHealthTree } from './ModuleHealthTree';

interface ModuleHealthRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}

function stateColor(
  state: AxisModuleAvailability | 'UP' | 'UNAVAILABLE' | 'UNKNOWN',
): 'success' | 'warning' | 'error' | 'default' {
  if (state === 'UP') return 'success';
  if (state === 'DEGRADED') return 'warning';
  if (state === 'UNAVAILABLE') return 'error';
  return 'default';
}

function displayName(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatTime(value: string | undefined, locale: string): string {
  if (!value) return 'Not observed';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      }).format(date);
}

export function ModuleHealthRoutePage(props: ModuleHealthRoutePageProps) {
  const actor = useMemo(
    () => (props.accessToken ? crypto.randomUUID() : 'anonymous'),
    [props.accessToken],
  );
  const connection = selectModuleConnection(props.bootstrap, 'backoffice');
  const scopeKey = JSON.stringify([
    actor,
    props.bootstrap.tenantCode,
    props.runtime.enterpriseCode,
    connection?.instanceId,
    connection?.endpoint,
    connection?.environment,
    connection?.server,
  ]);
  return <ModuleHealthWorkspace key={scopeKey} {...props} scopeKey={scopeKey} />;
}

/** Current health evidence retires with its actor, scope and exact owner source. */
function ModuleHealthWorkspace(
  props: ModuleHealthRoutePageProps & { readonly scopeKey: string },
) {
  const { locale } = useAxisLocalization();
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>();
  const queryClient = useQueryClient();
  const connection = selectModuleConnection(props.bootstrap, 'backoffice');
  const configuration = useMemo(
    () => ({
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      timeoutMs: props.runtime.requestTimeoutMs,
    }),
    [props.accessToken, props.runtime.enterpriseCode, props.runtime.requestTimeoutMs],
  );
  const modules = useQuery({
    enabled: Boolean(connection),
    queryKey: ['module-health', props.scopeKey],
    queryFn: () => {
      if (!connection) throw new Error('BackOffice is unavailable');
      return loadModuleHealth(connection, configuration);
    },
    refetchOnWindowFocus: true,
    retry: false,
  });
  const detail = useQuery({
    enabled: Boolean(connection && selectedModule),
    queryKey: ['module-health', props.scopeKey, selectedModule],
    queryFn: () => {
      if (!connection || !selectedModule) {
        throw new Error('Select a module to inspect its runtime instances');
      }
      return loadModuleHealthDetail(connection, selectedModule, configuration);
    },
    retry: false,
  });
  const refresh = useMutation({
    mutationFn: async () => {
      if (!connection || !selectedModule) throw new Error('Select a module first');
      await refreshModuleHealth(connection, selectedModule, configuration);
    },
    // A check can update readiness before later contract discovery fails.
    // Inspect the owner snapshot after either outcome; never replay the command.
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['module-health', props.scopeKey],
      });
    },
  });
  const checking = modules.isPending || modules.isFetching || refresh.isPending;
  const currentModules = modules.isSuccess && !checking ? modules.data : undefined;
  const filteredModules = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    if (!needle) return currentModules ?? [];
    return (currentModules ?? []).filter((module) =>
      [
        module.moduleName,
        module.displayName,
        module.canonicalIdentity,
        module.version,
        ...module.environments,
        ...module.servers,
        module.availability.state,
      ].some((value) => value?.toLocaleLowerCase().includes(needle)),
    );
  }, [currentModules, search]);
  const totals = useMemo(
    () =>
      (currentModules ?? [])
        .filter((module) => module.moduleKind !== 'group')
        .reduce(
          (result, module) => ({
            total: result.total + 1,
            healthy: result.healthy + (module.availability.state === 'UP' ? 1 : 0),
            degraded:
              result.degraded + (module.availability.state === 'DEGRADED' ? 1 : 0),
            unavailable:
              result.unavailable +
              (module.availability.state === 'UNAVAILABLE' ? 1 : 0),
            unknown: result.unknown + (module.availability.state === 'UNKNOWN' ? 1 : 0),
          }),
          { total: 0, healthy: 0, degraded: 0, unavailable: 0, unknown: 0 },
        ),
    [currentModules],
  );
  const refreshable =
    !checking &&
    !modules.isError &&
    !detail.isFetching &&
    !detail.isError &&
    detail.data?.instances.some((instance) => instance.clientCallable);
  const selectedContent =
    checking || detail.isPending || detail.isFetching ? (
      <Stack sx={{ alignItems: 'center', py: 4 }}>
        <CircularProgress aria-label="Loading runtime instances" />
      </Stack>
    ) : detail.isError ? (
      <Alert severity="error">{detail.error.message}</Alert>
    ) : detail.data ? (
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ justifyContent: 'space-between' }}
        >
          <Box>
            <Typography component="h3" variant="h5">
              {displayName(
                detail.data.displayName,
                displayName(detail.data.moduleName, detail.data.moduleName),
              )}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {detail.data.availability.activeInstances} registered runtime{' '}
              {detail.data.availability.activeInstances === 1
                ? 'instance'
                : 'instances'}
            </Typography>
          </Box>
          <Button
            disabled={refresh.isPending || refreshable !== true}
            onClick={() => refresh.mutate()}
            variant="contained"
          >
            {refresh.isPending ? 'Checking…' : 'Check now'}
          </Button>
        </Stack>
        {refreshable === false ? (
          <Alert severity="info">
            This module has no client-callable runtime endpoint, so an on-demand
            readiness check is not available. Its registration heartbeat remains visible
            below.
          </Alert>
        ) : null}
        {refresh.isError ? (
          <Alert severity="error">{refresh.error.message}</Alert>
        ) : null}
        {detail.data.instances.length === 0 ? (
          <Alert severity="warning">No active runtime instances are registered.</Alert>
        ) : (
          detail.data.instances.map((instance) => (
            <Card key={instance.instanceId} variant="outlined">
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{ justifyContent: 'space-between' }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>
                        {displayName(instance.node, 'Default node')}
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        {displayName(instance.environment, 'Unknown environment')}
                        {' · '}
                        {displayName(instance.server, 'Unknown server')}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Chip
                        color={stateColor(instance.availability.state)}
                        label={instance.availability.state}
                        size="small"
                      />
                      <Chip
                        label={instance.availability.freshness}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                  </Stack>
                  <Divider />
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography color="text.secondary" variant="caption">
                        Last heartbeat
                      </Typography>
                      <Typography variant="body2">
                        {formatTime(instance.lastSeenAt, locale)}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography color="text.secondary" variant="caption">
                        Last readiness observation
                      </Typography>
                      <Typography variant="body2">
                        {formatTime(instance.availability.observedAt, locale)}
                      </Typography>
                    </Grid>
                  </Grid>
                  {instance.availability.reasonCode ? (
                    <Alert
                      severity={
                        instance.availability.state === 'UNAVAILABLE'
                          ? 'error'
                          : 'warning'
                      }
                    >
                      {displayName(
                        instance.availability.reasonCode,
                        instance.availability.reasonCode,
                      )}
                    </Alert>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          ))
        )}
      </Stack>
    ) : null;

  if (!connection) {
    return (
      <WorkspaceContainer>
        <Alert severity="error">BackOffice connection is unavailable.</Alert>
      </WorkspaceContainer>
    );
  }

  return (
    <WorkspaceContainer>
      <Stack component="section" spacing={3} aria-labelledby="module-health-title">
        <WorkspaceHeading
          description="Review registered Nodics modules and drill into their environment, server, node, heartbeat, and readiness observations."
          help={props.routeNavigation?.help}
          id="module-health-title"
          title="Module health"
        />

        <Grid
          container
          spacing={2}
          role="group"
          aria-label="Module health totals"
          aria-busy={checking}
        >
          {[
            ['Modules', totals.total, 'default'],
            ['Healthy', totals.healthy, 'success'],
            ['Degraded', totals.degraded, 'warning'],
            ['Unavailable', totals.unavailable, 'error'],
            ['Unknown', totals.unknown, 'default'],
          ].map(([label, value, color]) => (
            <Grid key={String(label)} size={{ xs: 6, sm: 4, lg: 2.4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography color="text.secondary" variant="body2">
                    {label}
                  </Typography>
                  <Typography color={`${String(color)}.main`} variant="h4">
                    {currentModules ? value : '—'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Alert severity="info">
          This view reports registered runtime instances. A fully expired or
          intentionally deregistered node is not presented as an active instance; Nodics
          does not infer expected cluster membership from this observed registry.
        </Alert>

        {currentModules && modules.dataUpdatedAt > 0 ? (
          <Typography variant="caption" color="text.secondary">
            Registry snapshot retrieved{' '}
            {formatTime(new Date(modules.dataUpdatedAt).toISOString(), locale)}.
            Instance observations have their own timestamps.
          </Typography>
        ) : null}

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ justifyContent: 'space-between' }}
              >
                <Typography component="h2" variant="h5">
                  Registered modules
                </Typography>
                <Button
                  disabled={checking || Boolean(selectedModule && detail.isFetching)}
                  onClick={() =>
                    void queryClient.invalidateQueries({
                      queryKey: ['module-health', props.scopeKey],
                    })
                  }
                  variant="outlined"
                >
                  Refresh list
                </Button>
              </Stack>
              <TextField
                fullWidth
                label="Search modules, servers, or states"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {checking ? (
                <Stack sx={{ alignItems: 'center', py: 4 }}>
                  <CircularProgress aria-label="Loading module health" />
                </Stack>
              ) : modules.isError ? (
                <Alert severity="error">
                  Current module status cannot be confirmed. Refresh the list after the
                  registry connection recovers.
                  <Typography variant="body2">{modules.error.message}</Typography>
                </Alert>
              ) : filteredModules.length === 0 ? (
                <Alert severity="info">No registered modules match this search.</Alert>
              ) : (
                <ModuleHealthTree
                  modules={currentModules ?? []}
                  onSelect={(moduleName) =>
                    setSelectedModule((current) =>
                      current === moduleName ? undefined : moduleName,
                    )
                  }
                  search={search}
                  selectedContent={selectedContent}
                  selectedModule={selectedModule}
                  stateColor={stateColor}
                />
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </WorkspaceContainer>
  );
}
