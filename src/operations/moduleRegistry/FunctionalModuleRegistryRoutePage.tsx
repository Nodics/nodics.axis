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
  Typography,
} from '@mui/material';
import { useMemo } from 'react';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  applyFunctionalModuleLifecycleAction,
  loadAvailableFunctionalModules,
  loadRegisteredFunctionalModules,
  type FunctionalModuleLifecycleAction,
} from './api/functionalModuleRegistryClient';
import type {
  FunctionalModuleRegistration,
  FunctionalModuleRuntimeState,
} from './api/functionalModuleRegistryContracts';

interface FunctionalModuleRegistryRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly onBootstrapRefresh?: (() => Promise<void>) | undefined;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}

function stateColor(
  state:
    | FunctionalModuleRuntimeState
    | 'REGISTERED'
    | 'AVAILABLE'
    | 'DEREGISTERED'
    | 'DISABLED',
): 'success' | 'warning' | 'error' | 'default' {
  if (state === 'ACTIVE' || state === 'REGISTERED') return 'success';
  if (state === 'AVAILABLE' || state === 'DEGRADED' || state === 'DISABLED') {
    return 'warning';
  }
  if (state === 'OFFLINE' || state === 'INCOMPATIBLE') return 'error';
  return 'default';
}

function formatTime(value: string | undefined): string {
  if (!value) return 'Not observed';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(date);
}

function sortedModules(
  modules: readonly FunctionalModuleRegistration[],
): readonly FunctionalModuleRegistration[] {
  return [...modules].sort((left, right) =>
    left.functionalModule.localeCompare(right.functionalModule),
  );
}

const registryQueryRoot = ['functional-module-registry'] as const;

function removeModule(
  modules: readonly FunctionalModuleRegistration[] | undefined,
  functionalModule: string,
): readonly FunctionalModuleRegistration[] {
  return (modules ?? []).filter(
    (module) => module.functionalModule !== functionalModule,
  );
}

function upsertModule(
  modules: readonly FunctionalModuleRegistration[] | undefined,
  nextModule: FunctionalModuleRegistration,
): readonly FunctionalModuleRegistration[] {
  return sortedModules([
    ...removeModule(modules, nextModule.functionalModule),
    nextModule,
  ]);
}

interface ModuleCardProps {
  readonly disabled?: boolean | undefined;
  readonly module: FunctionalModuleRegistration;
  readonly onAction: (
    module: FunctionalModuleRegistration,
    action: FunctionalModuleLifecycleAction,
  ) => void;
  readonly pendingAction?: FunctionalModuleLifecycleAction | undefined;
}

function ModuleCard({ disabled, module, onAction, pendingAction }: ModuleCardProps) {
  const isRegistered = module.registrationState === 'REGISTERED';
  const canRegister = module.registrationState === 'AVAILABLE';
  const canActivate =
    isRegistered && !module.enabled && module.runtimeState === 'ACTIVE';
  const canDeactivate = isRegistered && module.enabled && !module.required;
  const canDeregister = isRegistered && !module.required;
  const pending = Boolean(pendingAction);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ justifyContent: 'space-between' }}
          >
            <Box>
              <Typography component="h3" variant="h6">
                {module.displayName}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {module.functionalModule}
                {module.registeredVersion ? ` · v${module.registeredVersion}` : ''}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip
                color={stateColor(module.registrationState)}
                label={module.registrationState}
                size="small"
              />
              <Chip
                color={stateColor(module.runtimeState)}
                label={module.runtimeState}
                size="small"
                variant="outlined"
              />
              <Chip
                color={module.enabled ? 'success' : stateColor('DISABLED')}
                label={module.enabled ? 'Enabled' : 'Disabled'}
                size="small"
              />
              {module.required ? (
                <Chip color="default" label="Required" size="small" />
              ) : null}
            </Stack>
          </Stack>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography color="text.secondary" variant="caption">
                Catalogue revision
              </Typography>
              <Typography>{module.catalogueRevision}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography color="text.secondary" variant="caption">
                Last observed
              </Typography>
              <Typography>{formatTime(module.lastObservedAt)}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography color="text.secondary" variant="caption">
                Observed servers
              </Typography>
              <Typography>
                {module.observedServers.length > 0
                  ? module.observedServers.join(', ')
                  : 'No runtime server observed'}
              </Typography>
            </Grid>
          </Grid>

          <Box>
            <Typography color="text.secondary" sx={{ mb: 1 }} variant="caption">
              Technical modules
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              {module.technicalModules.map((technicalModule) => (
                <Chip
                  key={technicalModule}
                  label={technicalModule}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>

          <Divider />

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {canRegister ? (
              <Button
                disabled={disabled || pending}
                onClick={() => onAction(module, 'register')}
                variant="contained"
              >
                {pendingAction === 'register' ? 'Registering…' : 'Register'}
              </Button>
            ) : null}
            {canActivate ? (
              <Button
                disabled={disabled || pending}
                onClick={() => onAction(module, 'activate')}
                variant="contained"
              >
                {pendingAction === 'activate' ? 'Activating…' : 'Activate'}
              </Button>
            ) : null}
            {canDeactivate ? (
              <Button
                color="warning"
                disabled={disabled || pending}
                onClick={() => onAction(module, 'deactivate')}
                variant="outlined"
              >
                {pendingAction === 'deactivate' ? 'Deactivating…' : 'Deactivate'}
              </Button>
            ) : null}
            {canDeregister ? (
              <Button
                color="error"
                disabled={disabled || pending}
                onClick={() => onAction(module, 'deregister')}
                variant="outlined"
              >
                {pendingAction === 'deregister' ? 'Deregistering…' : 'Deregister'}
              </Button>
            ) : null}
            {module.required ? (
              <Alert severity="info" sx={{ flex: 1, py: 0 }}>
                Required framework modules cannot be deactivated or deregistered.
              </Alert>
            ) : null}
            {isRegistered && !module.enabled && module.runtimeState !== 'ACTIVE' ? (
              <Alert severity="warning" sx={{ flex: 1, py: 0 }}>
                Activation is blocked until a compatible runtime server is active.
              </Alert>
            ) : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function FunctionalModuleRegistryRoutePage(
  props: FunctionalModuleRegistryRoutePageProps,
) {
  const queryClient = useQueryClient();
  const connection = selectModuleConnection(props.bootstrap, 'backoffice');
  const configuration = useMemo(
    () => ({
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      projectCode: props.runtime.projectCode,
      timeoutMs: props.runtime.requestTimeoutMs,
    }),
    [
      props.accessToken,
      props.runtime.enterpriseCode,
      props.runtime.projectCode,
      props.runtime.requestTimeoutMs,
    ],
  );
  const registeredModules = useQuery({
    enabled: Boolean(connection),
    queryKey: [...registryQueryRoot, 'registered', configuration.projectCode],
    queryFn: () => {
      if (!connection) throw new Error('BackOffice is unavailable');
      return loadRegisteredFunctionalModules(connection, configuration);
    },
    refetchOnWindowFocus: true,
  });
  const availableModules = useQuery({
    enabled: Boolean(connection),
    queryKey: [...registryQueryRoot, 'available', configuration.projectCode],
    queryFn: () => {
      if (!connection) throw new Error('BackOffice is unavailable');
      return loadAvailableFunctionalModules(connection, configuration);
    },
    refetchOnWindowFocus: true,
  });
  const lifecycle = useMutation({
    mutationFn: async ({
      module,
      action,
    }: {
      readonly module: FunctionalModuleRegistration;
      readonly action: FunctionalModuleLifecycleAction;
    }) => {
      if (!connection) throw new Error('BackOffice is unavailable');
      return applyFunctionalModuleLifecycleAction(
        connection,
        module,
        action,
        configuration,
      );
    },
    onSuccess: (updatedModule, variables) => {
      const registeredQueryKey = [
        ...registryQueryRoot,
        'registered',
        configuration.projectCode,
      ];
      const availableQueryKey = [
        ...registryQueryRoot,
        'available',
        configuration.projectCode,
      ];
      if (variables.action === 'deregister') {
        queryClient.setQueryData<readonly FunctionalModuleRegistration[]>(
          registeredQueryKey,
          (modules) => removeModule(modules, updatedModule.functionalModule),
        );
        queryClient.setQueryData<readonly FunctionalModuleRegistration[]>(
          availableQueryKey,
          (modules) =>
            updatedModule.runtimeState === 'ACTIVE'
              ? upsertModule(modules, {
                  ...updatedModule,
                  enabled: false,
                  registrationState: 'AVAILABLE',
                })
              : removeModule(modules, updatedModule.functionalModule),
        );
      } else {
        queryClient.setQueryData<readonly FunctionalModuleRegistration[]>(
          registeredQueryKey,
          (modules) => upsertModule(modules, updatedModule),
        );
        queryClient.setQueryData<readonly FunctionalModuleRegistration[]>(
          availableQueryKey,
          (modules) => removeModule(modules, updatedModule.functionalModule),
        );
      }
      void Promise.all([
        queryClient.refetchQueries({
          queryKey: registeredQueryKey,
          type: 'active',
        }),
        queryClient.refetchQueries({
          queryKey: availableQueryKey,
          type: 'active',
        }),
      ]).then(() => props.onBootstrapRefresh?.());
    },
  });
  const registered = useMemo(
    () => sortedModules(registeredModules.data ?? []),
    [registeredModules.data],
  );
  const required = useMemo(
    () => registered.filter((module) => module.required),
    [registered],
  );
  const optional = useMemo(
    () => registered.filter((module) => !module.required),
    [registered],
  );
  const available = useMemo(
    () => sortedModules(availableModules.data ?? []),
    [availableModules.data],
  );
  const pendingModule = lifecycle.isPending
    ? lifecycle.variables?.module.functionalModule
    : undefined;
  const pendingAction = lifecycle.isPending ? lifecycle.variables?.action : undefined;
  const requiredRegistered = required.length;
  const optionalRegistered = optional.length;
  const enabledRegistered = registered.filter((module) => module.enabled).length;

  if (!connection) {
    return (
      <WorkspaceContainer>
        <Alert severity="error">BackOffice connection is unavailable.</Alert>
      </WorkspaceContainer>
    );
  }

  const loading = registeredModules.isPending || availableModules.isPending;
  const loadError =
    registeredModules.error instanceof Error
      ? registeredModules.error
      : availableModules.error instanceof Error
        ? availableModules.error
        : undefined;

  return (
    <WorkspaceContainer>
      <WorkspaceHeading
        description={`Project ${configuration.projectCode} functional-module lifecycle is governed by BackOffice.`}
        help={props.routeNavigation?.help}
        title="Module Registry"
      />

      <Stack spacing={3}>
        <Alert severity="info">
          Axis only shows modules reported by BackOffice for this project. Runtime
          availability comes from live module registration; registration state is
          persisted by BackOffice.
        </Alert>
        {lifecycle.isError ? (
          <Alert severity="error">{lifecycle.error.message}</Alert>
        ) : null}
        {loading ? (
          <Stack sx={{ alignItems: 'center', py: 4 }}>
            <CircularProgress aria-label="Loading functional-module registry" />
          </Stack>
        ) : loadError ? (
          <Alert severity="error">{loadError.message}</Alert>
        ) : (
          <Stack spacing={4}>
            <Card variant="outlined">
              <CardContent>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  sx={{
                    alignItems: { md: 'center' },
                    justifyContent: 'space-between',
                  }}
                >
                  <Box>
                    <Typography component="h2" variant="h5">
                      Project module lifecycle
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      Register makes an observed optional module part of the project
                      catalogue. Activate enables its Axis capabilities. Deactivate
                      hides optional capabilities without removing runtime code.
                      Deregister returns an optional module to the available list.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Chip
                      color="success"
                      label={`${String(enabledRegistered)} enabled`}
                    />
                    <Chip
                      label={`${String(requiredRegistered)} required`}
                      variant="outlined"
                    />
                    <Chip
                      label={`${String(optionalRegistered)} optional`}
                      variant="outlined"
                    />
                    <Chip
                      color="warning"
                      label={`${String(available.length)} waiting`}
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Box>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography component="h2" variant="h5">
                    Required modules
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Framework prerequisites that are automatically registered and cannot
                    be deactivated or deregistered.
                  </Typography>
                </Box>
                <Chip label={`${String(required.length)} required`} />
              </Stack>
              <Stack spacing={2} sx={{ mt: 2 }}>
                {required.length === 0 ? (
                  <Alert severity="warning">
                    No required functional modules were returned for this project.
                  </Alert>
                ) : (
                  required.map((module) => (
                    <ModuleCard
                      key={module.functionalModule}
                      disabled={
                        lifecycle.isPending && pendingModule === module.functionalModule
                      }
                      module={module}
                      pendingAction={
                        pendingModule === module.functionalModule
                          ? pendingAction
                          : undefined
                      }
                      onAction={(nextModule, action) =>
                        lifecycle.mutate({ action, module: nextModule })
                      }
                    />
                  ))
                )}
              </Stack>
            </Box>

            <Box>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography component="h2" variant="h5">
                    Optional registered modules
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Modules selected for this project. Activation controls whether Axis
                    presents their business capabilities.
                  </Typography>
                </Box>
                <Chip label={`${String(optional.length)} optional registered`} />
              </Stack>
              <Stack spacing={2} sx={{ mt: 2 }}>
                {optional.length === 0 ? (
                  <Alert severity="info">
                    No optional functional modules are registered yet.
                  </Alert>
                ) : (
                  optional.map((module) => (
                    <ModuleCard
                      key={module.functionalModule}
                      disabled={
                        lifecycle.isPending && pendingModule === module.functionalModule
                      }
                      module={module}
                      pendingAction={
                        pendingModule === module.functionalModule
                          ? pendingAction
                          : undefined
                      }
                      onAction={(nextModule, action) =>
                        lifecycle.mutate({ action, module: nextModule })
                      }
                    />
                  ))
                )}
              </Stack>
            </Box>

            <Box>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography component="h2" variant="h5">
                    Available to register
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Live optional functional modules observed by runtime servers but not
                    yet registered into the project.
                  </Typography>
                </Box>
                <Chip label={`${available.length} available`} />
              </Stack>
              <Stack spacing={2} sx={{ mt: 2 }}>
                {available.length === 0 ? (
                  <Alert severity="success">
                    No unregistered functional modules are waiting for registration.
                  </Alert>
                ) : (
                  available.map((module) => (
                    <ModuleCard
                      key={module.functionalModule}
                      disabled={
                        lifecycle.isPending && pendingModule === module.functionalModule
                      }
                      module={module}
                      pendingAction={
                        pendingModule === module.functionalModule
                          ? pendingAction
                          : undefined
                      }
                      onAction={(nextModule, action) =>
                        lifecycle.mutate({ action, module: nextModule })
                      }
                    />
                  ))
                )}
              </Stack>
            </Box>
          </Stack>
        )}
      </Stack>
    </WorkspaceContainer>
  );
}
