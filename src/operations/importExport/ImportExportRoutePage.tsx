import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, MenuItem, Paper, Stack, Tab, Tabs, TextField } from '@mui/material';
import { useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import type { AxisNavigationItem } from '../../bootstrap/publicBootstrap';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisModuleConnection,
  type AxisAuthenticatedBootstrap,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { Alert } from '@mui/material';
import { importHistoryConnection } from './importHistoryHandoff';
import {
  installDataReleases,
  loadExportHistory,
  loadInitializationProfiles,
  loadDataReleases,
  loadImportHistory,
  preflightDataReleases,
  runInitializationProfile,
  type DataReleaseClientConfiguration,
} from './api/dataReleaseClient';
import type {
  DataRelease,
  DataReleaseDryRunSummary,
  DataReleaseOperationResult,
  DataReleasePlan,
  DataReleaseType,
  InitializationProfile,
} from './api/dataReleaseContracts';
import { DataReleaseWorkbench } from './components/DataReleaseWorkbench';
import { GuidedInitializationWorkspace } from './components/GuidedInitializationWorkspace';
import { ExportWorkspace } from './components/ExportWorkspace';
import { FileImportWorkspace } from './components/FileImportWorkspace';
import { ImportExportHistoryPanel } from './components/ImportExportHistoryPanel';
import {
  areaCopy,
  compareModuleIndex,
  historySearchText,
  importExportAreas,
  isInstallableStatus,
  operationSucceededWithCurrentOnly,
  releaseKey,
  releaseTypes,
  type ImportExportArea,
  type HistoryFilter,
  typeCopy,
} from './importExportPresentation';

interface ImportExportRoutePageProps {
  readonly sessionGeneration?: number | undefined;
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}

function isDataReleaseArea(area: ImportExportArea): area is DataReleaseType {
  return releaseTypes.includes(area as DataReleaseType);
}

/** Resolves only known inert area identifiers from the current router query. */
function selectedArea(search: string): ImportExportArea {
  const candidate = new URLSearchParams(search).get('area');
  return importExportAreas.includes(candidate as ImportExportArea)
    ? (candidate as ImportExportArea)
    : 'guided';
}

function createPlan(
  type: DataReleaseType,
  releases: readonly DataRelease[],
): DataReleasePlan {
  const releaseCodes = releases
    .map((release) => release.releaseCode)
    .filter((releaseCode): releaseCode is string => Boolean(releaseCode));
  if (releaseCodes.length === releases.length) {
    return Object.freeze({
      dataType: type,
      releaseCodes: Object.freeze(releaseCodes),
      expectedReleases: Object.freeze(
        Object.fromEntries(
          releases.map((release) => [release.releaseCode as string, release.version]),
        ),
      ),
    });
  }
  return Object.freeze({
    dataType: type,
    modules: Object.freeze(releases.map((release) => release.moduleName)),
    expectedReleases: Object.freeze(
      Object.fromEntries(
        releases.map((release) => [release.moduleName, release.version]),
      ),
    ),
  });
}

function selectDataAdministrationConnection(
  bootstrap: AxisAuthenticatedBootstrap,
  moduleName: string,
) {
  return (
    selectModuleConnection(bootstrap, moduleName, {
      publicationRole: 'STAGED',
    }) ?? selectModuleConnection(bootstrap, moduleName)
  );
}

function createPlatformImportConnection(
  bootstrap: AxisAuthenticatedBootstrap,
  runtime: AxisRuntimeConfig,
): AxisModuleConnection {
  return Object.freeze({
    moduleName: 'import',
    instanceId: `${runtime.enterpriseCode}:platformServer:import:fallback`,
    endpoint: new URL('/nodics/import', runtime.backofficeBaseUrl).toString(),
    environment: bootstrap.environments[0] ?? runtime.enterpriseCode,
    server: 'platformServer',
    runtimeRole: Object.freeze({
      code: 'PLATFORM',
      publication: 'OPERATIONAL',
    }),
    state: 'UP',
  });
}

function selectReleaseOperationConnection(
  bootstrap: AxisAuthenticatedBootstrap,
  runtime: AxisRuntimeConfig,
  moduleName: string,
  destinationRole: string | undefined,
) {
  if (destinationRole) {
    const destinationConnection = selectModuleConnection(bootstrap, moduleName, {
      runtimeRoleCode: destinationRole,
    });
    if (
      !destinationConnection &&
      moduleName === 'import' &&
      destinationRole === 'PLATFORM'
    ) {
      return createPlatformImportConnection(bootstrap, runtime);
    }
    if (!destinationConnection) {
      throw new Error(
        `Import service is unavailable for runtime destination ${destinationRole}`,
      );
    }
    return destinationConnection;
  }
  return selectDataAdministrationConnection(bootstrap, moduleName);
}

function selectReleaseCatalogueConnections(
  bootstrap: AxisAuthenticatedBootstrap,
  runtime: AxisRuntimeConfig,
): readonly AxisModuleConnection[] {
  const connections = (bootstrap.moduleConnections.import ?? []).filter(
    (connection) =>
      (connection.state === 'UP' || connection.state === 'DEGRADED') &&
      connection.runtimeRole?.publication !== 'ONLINE',
  );
  const values = [...connections];
  if (!values.some((connection) => connection.runtimeRole?.code === 'PLATFORM')) {
    values.push(createPlatformImportConnection(bootstrap, runtime));
  }
  return Object.freeze(
    Array.from(
      new Map(values.map((connection) => [connection.instanceId, connection])).values(),
    ),
  );
}

function isAuthoringSchemaConnection(connection: AxisModuleConnection): boolean {
  return (
    connection.state === 'UP' &&
    connection.runtimeRole?.publication !== 'ONLINE' &&
    !['import', 'export', 'localizationApi'].includes(connection.moduleName)
  );
}

function groupReleasesByDestination(
  releases: readonly DataRelease[],
): ReadonlyMap<string, readonly DataRelease[]> {
  const groups = new Map<string, DataRelease[]>();
  releases.forEach((release) => {
    const key = release.destinationRole ?? '';
    groups.set(key, [...(groups.get(key) ?? []), release]);
  });
  return groups;
}

function releaseBelongsToConnection(
  release: DataRelease,
  connection: AxisModuleConnection,
): boolean {
  const runtimeRoleCode = connection.runtimeRole?.code;
  return !release.destinationRole || !runtimeRoleCode
    ? true
    : release.destinationRole === runtimeRoleCode;
}

function mergeDataReleaseCatalogue(
  releases: readonly DataRelease[],
): readonly DataRelease[] {
  return Object.freeze(
    Array.from(
      new Map(releases.map((release) => [releaseKey(release), release])).values(),
    ),
  );
}

function isDisabledDataImportCategory(error: unknown): boolean {
  return (
    error instanceof Error &&
    /API category is disabled for this runtime:\s*dataImport/iu.test(error.message)
  );
}

function mergeDataReleaseDryRuns(
  releaseType: DataReleaseType,
  fallbackTenant: string,
  results: readonly DataReleaseOperationResult[],
): DataReleaseDryRunSummary | undefined {
  const dryRuns = results
    .map((result) => result.dryRun)
    .filter((dryRun): dryRun is DataReleaseDryRunSummary => Boolean(dryRun));
  if (dryRuns.length === 0) return undefined;
  return Object.freeze({
    mode: 'VALIDATE',
    validationOnly: dryRuns.every((dryRun) => dryRun.validationOnly),
    importExecuted: dryRuns.some((dryRun) => dryRun.importExecuted),
    dataType: releaseType,
    tenant: dryRuns[0]?.tenant ?? fallbackTenant,
    totalReleases: dryRuns.reduce((total, dryRun) => total + dryRun.totalReleases, 0),
    executableReleases: dryRuns.reduce(
      (total, dryRun) => total + dryRun.executableReleases,
      0,
    ),
    alreadyCurrent: dryRuns.reduce((total, dryRun) => total + dryRun.alreadyCurrent, 0),
    blockedReleases: dryRuns.reduce(
      (total, dryRun) => total + dryRun.blockedReleases,
      0,
    ),
    summary: Object.freeze({
      install: dryRuns.reduce((total, dryRun) => total + dryRun.summary.install, 0),
      update: dryRuns.reduce((total, dryRun) => total + dryRun.summary.update, 0),
      retry: dryRuns.reduce((total, dryRun) => total + dryRun.summary.retry, 0),
      skip: dryRuns.reduce((total, dryRun) => total + dryRun.summary.skip, 0),
      blocked: dryRuns.reduce((total, dryRun) => total + dryRun.summary.blocked, 0),
      wait: dryRuns.reduce((total, dryRun) => total + dryRun.summary.wait, 0),
    }),
    outcomes: Object.freeze(dryRuns.flatMap((dryRun) => dryRun.outcomes)),
    publicationFollowUps: Object.freeze(
      dryRuns.flatMap((dryRun) => dryRun.publicationFollowUps),
    ),
    messages: Object.freeze(
      Array.from(new Set(dryRuns.flatMap((dryRun) => dryRun.messages))),
    ),
  });
}

async function loadDataReleasesByDestination(
  connections: readonly AxisModuleConnection[],
  configuration: DataReleaseClientConfiguration,
): Promise<readonly DataRelease[]> {
  const values = await Promise.allSettled(
    connections.map(async (connection) =>
      (await loadDataReleases(connection, configuration)).filter((release) =>
        releaseBelongsToConnection(release, connection),
      ),
    ),
  );
  const fulfilledValues = values.reduce<DataRelease[][]>((items, value) => {
    if (value.status === 'fulfilled') items.push([...value.value]);
    return items;
  }, []);
  if (fulfilledValues.length > 0) {
    return mergeDataReleaseCatalogue(fulfilledValues.flat());
  }
  const firstActionableRejection = values.find(
    (value): value is PromiseRejectedResult =>
      value.status === 'rejected' && !isDisabledDataImportCategory(value.reason),
  );
  if (firstActionableRejection?.reason) {
    throw firstActionableRejection.reason instanceof Error
      ? firstActionableRejection.reason
      : new Error('Import service returned an unreadable catalogue error');
  }
  return Object.freeze([]);
}

function initializationProfileKey(profile: InitializationProfile): string {
  return `${profile.destinationRole ?? 'DEFAULT'}:${profile.profileCode}`;
}

function compareInitializationProfiles(
  left: InitializationProfile,
  right: InitializationProfile,
): number {
  const byModuleIndex = compareModuleIndex(left.moduleIndex, right.moduleIndex);
  if (byModuleIndex !== 0) return byModuleIndex;
  const byLabel = left.label.localeCompare(right.label);
  if (byLabel !== 0) return byLabel;
  return initializationProfileKey(left).localeCompare(initializationProfileKey(right));
}

interface InitializationProfileOperationRequest {
  readonly profileKey: string;
  readonly profileCode: string;
  readonly destinationRole?: string | undefined;
  readonly mode: 'validate' | 'install';
}

function profileOperationErrorMessage(
  error: unknown,
  profile: InitializationProfile | undefined,
  request: InitializationProfileOperationRequest,
): string {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : 'Initialization profile operation failed';
  const label = profile?.label ?? request.profileCode;
  const target = request.destinationRole
    ? ` on ${request.destinationRole} runtime`
    : '';
  if (/Initialization profile is unavailable|Operation not found/iu.test(message)) {
    return `${label} cannot be started${target} because the backend profile is no longer available. Refresh guided setup; if it remains unavailable, check the target import runtime initialization profile configuration.`;
  }
  return message;
}

async function loadInitializationProfilesByDestination(
  connections: readonly AxisModuleConnection[],
  configuration: DataReleaseClientConfiguration,
): Promise<readonly InitializationProfile[]> {
  const values = await Promise.allSettled(
    connections.map((connection) =>
      loadInitializationProfiles(connection, configuration),
    ),
  );
  const fulfilledValues = values.reduce<InitializationProfile[][]>((items, value) => {
    if (value.status === 'fulfilled') items.push([...value.value]);
    return items;
  }, []);
  if (fulfilledValues.length > 0) {
    return Object.freeze(
      Array.from(
        new Map(
          fulfilledValues
            .flat()
            .map((profile) => [initializationProfileKey(profile), profile]),
        ).values(),
      ).sort(compareInitializationProfiles),
    );
  }
  const firstActionableRejection = values.find(
    (value): value is PromiseRejectedResult =>
      value.status === 'rejected' && !isDisabledDataImportCategory(value.reason),
  );
  if (firstActionableRejection?.reason) {
    throw firstActionableRejection.reason instanceof Error
      ? firstActionableRejection.reason
      : new Error('Initialization profiles are unavailable');
  }
  return Object.freeze([]);
}

async function executeDataReleaseOperationByDestination(
  bootstrap: AxisAuthenticatedBootstrap,
  runtime: AxisRuntimeConfig,
  configuration: DataReleaseClientConfiguration,
  releaseType: DataReleaseType,
  releases: readonly DataRelease[],
  mode: 'validate' | 'install',
): Promise<DataReleaseOperationResult> {
  const results: DataReleaseOperationResult[] = [];
  for (const [destinationRole, destinationReleases] of groupReleasesByDestination(
    releases,
  )) {
    const operationConnection = selectReleaseOperationConnection(
      bootstrap,
      runtime,
      'import',
      destinationRole || undefined,
    );
    if (!operationConnection) throw new Error('Import service is unavailable');
    const plan = createPlan(releaseType, destinationReleases);
    results.push(
      mode === 'validate'
        ? await preflightDataReleases(operationConnection, configuration, plan)
        : await installDataReleases(operationConnection, configuration, plan),
    );
  }
  return Object.freeze({
    dataType: releaseType,
    tenant: results[0]?.tenant ?? configuration.enterpriseCode,
    releases: Object.freeze(results.flatMap((result) => result.releases)),
    dryRun: mergeDataReleaseDryRuns(releaseType, configuration.enterpriseCode, results),
  });
}

export function ImportExportRoutePage(props: ImportExportRoutePageProps) {
  const [historyParameters, setHistoryParameters] = useSearchParams();
  const location = useLocation();
  const area = useMemo(() => selectedArea(location.search), [location.search]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const historyInstance =
    historyParameters.getAll('importInstance').length > 1
      ? ''
      : historyParameters.get('importInstance');
  const selectedRun =
    historyParameters.getAll('importRun').length > 1
      ? ''
      : historyParameters.get('importRun');
  const [historySearch, setHistorySearch] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [lastOperationMode, setLastOperationMode] = useState<
    'validate' | 'install' | undefined
  >(undefined);
  const queryClient = useQueryClient();
  const connection = selectDataAdministrationConnection(props.bootstrap, 'import');
  const historyConnection =
    historyInstance !== null
      ? importHistoryConnection(props.bootstrap, historyInstance)
      : connection;
  const historyConnections = (props.bootstrap.moduleConnections.import ?? []).filter(
    (candidate) =>
      importHistoryConnection(props.bootstrap, candidate.instanceId) === candidate,
  );
  const catalogueConnections = useMemo(
    () => selectReleaseCatalogueConnections(props.bootstrap, props.runtime),
    [props.bootstrap, props.runtime],
  );
  const exportConnections = useMemo(
    () =>
      Object.freeze(
        (props.bootstrap.moduleConnections.export ?? []).filter(
          (connection) => connection.state === 'UP' || connection.state === 'DEGRADED',
        ),
      ),
    [props.bootstrap.moduleConnections],
  );
  const mediaConnection = selectDataAdministrationConnection(props.bootstrap, 'media');
  const mediaConnections = useMemo(
    () =>
      Object.freeze(
        (props.bootstrap.moduleConnections.media ?? []).filter(
          (connection) => connection.state === 'UP' || connection.state === 'DEGRADED',
        ),
      ),
    [props.bootstrap.moduleConnections],
  );
  const schemaConnections = useMemo(
    () =>
      Object.freeze(
        Object.values(props.bootstrap.moduleConnections)
          .flat()
          .filter(isAuthoringSchemaConnection),
      ),
    [props.bootstrap.moduleConnections],
  );
  const configuration = useMemo<DataReleaseClientConfiguration>(
    () => ({
      accessToken: props.accessToken,
      sessionGeneration: props.sessionGeneration,
      enterpriseCode: props.runtime.enterpriseCode,
      timeoutMs: props.runtime.requestTimeoutMs,
    }),
    [
      props.accessToken,
      props.sessionGeneration,
      props.runtime.enterpriseCode,
      props.runtime.requestTimeoutMs,
    ],
  );
  const catalogue = useQuery({
    queryKey: [
      'import-catalogue',
      props.runtime.enterpriseCode,
      props.sessionGeneration,
    ],
    retry: false,
    queryFn: () => {
      if (catalogueConnections.length === 0)
        throw new Error('Import service is unavailable');
      return loadDataReleasesByDestination(catalogueConnections, configuration);
    },
    enabled: catalogueConnections.length > 0,
  });
  const profiles = useQuery({
    queryKey: [
      'initialization-profiles',
      props.runtime.enterpriseCode,
      props.sessionGeneration,
    ],
    retry: false,
    queryFn: () => {
      if (catalogueConnections.length === 0)
        throw new Error('Import service is unavailable');
      return loadInitializationProfilesByDestination(
        catalogueConnections,
        configuration,
      );
    },
    enabled: catalogueConnections.length > 0,
  });
  const history = useQuery({
    queryKey: [
      'import-export-history',
      props.runtime.enterpriseCode,
      props.sessionGeneration,
      historyConnection?.instanceId,
      historyConnection?.endpoint,
      selectedRun,
      historyFilter,
    ],
    queryFn: async () => {
      if (!historyConnection)
        throw new Error(
          'The requested Import runtime is unavailable in the authorized catalogue.',
        );
      if (selectedRun !== null && !/^[A-Za-z0-9_.:-]{1,192}$/.test(selectedRun))
        throw new Error('The requested import run reference is invalid.');
      const importRuns = await loadImportHistory(historyConnection, configuration);
      if (selectedRun !== null) {
        const matching = importRuns.filter((run) => run.runId === selectedRun);
        if (matching.length !== 1)
          throw new Error(
            'The referenced run is not present in this runtime history window. Inspect the owner report; no import was retried.',
          );
        return Object.freeze(matching);
      }
      if (historyFilter !== 'exports') return Object.freeze([...importRuns]);
      const exportRunResults = await Promise.allSettled(
        exportConnections
          .filter(
            (exportConnection) =>
              Boolean(
                historyConnection.server && historyConnection.runtimeRole?.code,
              ) &&
              exportConnection.server === historyConnection.server &&
              exportConnection.runtimeRole?.code ===
                historyConnection.runtimeRole?.code,
          )
          .map((exportConnection) =>
            loadExportHistory(exportConnection, configuration),
          ),
      );
      const exportRuns = exportRunResults.flatMap((result) =>
        result.status === 'fulfilled' ? [...result.value] : [],
      );
      return Object.freeze([...exportRuns]);
    },
    enabled:
      area === 'history' &&
      (historyFilter !== 'exports' || exportConnections.length > 0),
  });
  const releaseType = isDataReleaseArea(area) ? area : 'init';
  const visible = useMemo(
    () =>
      isDataReleaseArea(area) && !catalogue.isError
        ? (catalogue.data ?? []).filter((release) => release.dataType === area)
        : [],
    [area, catalogue.data, catalogue.isError],
  );
  const effectiveSelected = useMemo(() => {
    const executableKeys = new Set(
      visible.filter((release) => isInstallableStatus(release.status)).map(releaseKey),
    );
    return new Set([...selected].filter((key) => executableKeys.has(key)));
  }, [selected, visible]);
  const chosen = visible.filter((release) =>
    effectiveSelected.has(releaseKey(release)),
  );
  const executableChosen = chosen.filter((release) =>
    isInstallableStatus(release.status),
  );
  const releaseSummary = useMemo(
    () => ({
      total: visible.length,
      current: visible.filter((release) => release.status === 'CURRENT').length,
      installable: visible.filter((release) => isInstallableStatus(release.status))
        .length,
      selected: executableChosen.length,
    }),
    [executableChosen.length, visible],
  );
  const filteredHistory = useMemo(() => {
    const normalizedSearch = historySearch.trim().toLowerCase();
    const runs = (history.data ?? []).filter((run) => {
      if (historyFilter === 'imports') return run.dataType !== 'export';
      if (historyFilter === 'exports') return run.dataType === 'export';
      return true;
    });
    if (!normalizedSearch) return runs;
    return runs.filter((run) => historySearchText(run).includes(normalizedSearch));
  }, [history.data, historyFilter, historySearch]);
  const operation = useMutation({
    retry: false,
    mutationFn: async (mode: 'validate' | 'install') => {
      if (!isDataReleaseArea(area) || executableChosen.length === 0) {
        throw new Error('Select at least one available data release');
      }
      return executeDataReleaseOperationByDestination(
        props.bootstrap,
        props.runtime,
        configuration,
        releaseType,
        executableChosen,
        mode,
      );
    },
    onSuccess: async (_data, mode) => {
      if (mode === 'install') {
        setSelected(new Set());
      }
      await queryClient.invalidateQueries({
        queryKey: ['import-catalogue', props.runtime.enterpriseCode],
      });
    },
  });
  const profileOperation = useMutation({
    retry: false,
    mutationFn: async (request: InitializationProfileOperationRequest) => {
      const profile = (profiles.data ?? []).find(
        (item) => initializationProfileKey(item) === request.profileKey,
      );
      const destinationRole = request.destinationRole ?? profile?.destinationRole;
      const profileConnection = destinationRole
        ? selectReleaseOperationConnection(
            props.bootstrap,
            props.runtime,
            'import',
            destinationRole,
          )
        : connection;
      if (!profileConnection) throw new Error('Import service is unavailable');
      try {
        return await runInitializationProfile(
          profileConnection,
          configuration,
          request.profileCode,
          request.mode,
        );
      } catch (error) {
        throw new Error(profileOperationErrorMessage(error, profile, request));
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['initialization-profiles', props.runtime.enterpriseCode],
        }),
        queryClient.invalidateQueries({
          queryKey: ['import-catalogue', props.runtime.enterpriseCode],
        }),
      ]);
    },
  });
  const operationTypeLabel = operation.data
    ? typeCopy[operation.data.dataType].label.toLowerCase()
    : 'data';
  const successMessage = operationSucceededWithCurrentOnly(
    lastOperationMode,
    operation.data?.releases,
  )
    ? `${operation.data?.releases.length ?? 0} ${operationTypeLabel} release(s) validated. Everything is already current; no import or update was required.`
    : lastOperationMode === 'validate'
      ? `${operation.data?.releases.length ?? 0} ${operationTypeLabel} release(s) validated by the backend.`
      : `${operation.data?.releases.length ?? 0} ${operationTypeLabel} release(s) installed or updated.`;
  const verifiedSuccessMessage =
    catalogue.isError && operation.data && lastOperationMode === 'install'
      ? `${operation.data.releases.length} release(s) acknowledged by the Import owner. Refreshed installation state is unverified; sign in again if required, then inspect the owner catalogue or receipt. Do not repeat the import.`
      : successMessage;

  const changeArea = (next: ImportExportArea) => {
    const parameters = new URLSearchParams(historyParameters);
    if (next === 'guided') parameters.delete('area');
    else parameters.set('area', next);
    setHistoryParameters(parameters, { replace: true });
    setSelected(new Set());
    operation.reset();
    profileOperation.reset();
  };

  return (
    <WorkspaceContainer>
      <Paper
        component="section"
        aria-labelledby="imports-exports-title"
        elevation={0}
        sx={{
          border: 1,
          borderColor: 'divider',
          overflow: 'visible',
        }}
      >
        <Stack
          spacing={2}
          sx={{
            p: { xs: 2, md: 3 },
          }}
        >
          <WorkspaceHeading
            description="Review immutable module releases, governed file intake, export readiness, and secured run history through backend-owned Nodics contracts."
            eyebrow="Governed data operations"
            help={props.routeNavigation?.help}
            id="imports-exports-title"
            title="Imports and exports"
          />

          <Box
            sx={{
              bgcolor: 'background.default',
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              px: 1,
            }}
          >
            <Tabs
              aria-label="Import and export areas"
              onChange={(_, value: ImportExportArea) => changeArea(value)}
              value={area}
              variant="scrollable"
              sx={{
                minHeight: 44,
                '& .MuiTab-root': {
                  minHeight: 44,
                  px: { xs: 1.5, md: 2.25 },
                  textTransform: 'none',
                },
              }}
            >
              {importExportAreas.map((tabArea) => (
                <Tab
                  key={tabArea}
                  label={
                    isDataReleaseArea(tabArea)
                      ? typeCopy[tabArea].label
                      : areaCopy[tabArea].label
                  }
                  value={tabArea}
                />
              ))}
            </Tabs>
          </Box>

          {area === 'guided' ? (
            <GuidedInitializationWorkspace
              errorMessage={profiles.error?.message}
              isLoading={profiles.isLoading}
              operationError={
                profileOperation.isError && profileOperation.variables
                  ? {
                      profileKey: profileOperation.variables.profileKey,
                      message:
                        profileOperation.error?.message ??
                        'Initialization profile operation failed',
                    }
                  : undefined
              }
              operationPendingKey={
                profileOperation.isPending
                  ? profileOperation.variables?.profileKey
                  : undefined
              }
              operationPendingMode={
                profileOperation.isPending
                  ? profileOperation.variables?.mode
                  : undefined
              }
              profiles={profiles.data ?? []}
              successMessage={
                profileOperation.isSuccess && profileOperation.variables
                  ? {
                      profileKey: profileOperation.variables.profileKey,
                      message:
                        profileOperation.data?.mode === 'INSTALL'
                          ? profileOperation.data.profile.completionMessage
                          : 'The backend validated the immutable initialization plan. No data was changed.',
                    }
                  : undefined
              }
              onRun={(profile, mode) =>
                profileOperation.mutate({
                  profileKey: initializationProfileKey(profile),
                  profileCode: profile.profileCode,
                  destinationRole: profile.destinationRole,
                  mode,
                })
              }
              onOpenArea={changeArea}
            />
          ) : area === 'exports' ? (
            <ExportWorkspace
              configuration={configuration}
              enterpriseCode={props.runtime.enterpriseCode}
              exportConnections={exportConnections}
              mediaConnections={mediaConnections}
              schemaConnections={schemaConnections}
              tenantCode={props.bootstrap.tenantCode}
            />
          ) : area === 'file-imports' ? (
            <FileImportWorkspace
              configuration={configuration}
              enterpriseCode={props.runtime.enterpriseCode}
              importConnection={connection}
              mediaConnection={mediaConnection}
              schemaConnections={schemaConnections}
              tenantCode={props.bootstrap.tenantCode}
            />
          ) : area === 'history' ? (
            <Stack spacing={2}>
              <TextField
                select
                label="Import runtime"
                value={historyConnection?.instanceId ?? ''}
                disabled={historyConnections.length === 0}
                onChange={(event) => {
                  const instanceId = event.target.value;
                  if (!importHistoryConnection(props.bootstrap, instanceId)) return;
                  setHistorySearch('');
                  const next = new URLSearchParams(historyParameters);
                  next.set('area', 'history');
                  next.set('importInstance', instanceId);
                  next.delete('importRun');
                  setHistoryParameters(next, { replace: true });
                }}
              >
                <MenuItem value="" disabled>
                  Unavailable
                </MenuItem>
                {historyConnections.map((candidate) => (
                  <MenuItem key={candidate.instanceId} value={candidate.instanceId}>
                    {candidate.server ?? candidate.moduleName} ·{' '}
                    {candidate.runtimeRole?.code ?? candidate.environment}
                  </MenuItem>
                ))}
              </TextField>
              {historyInstance !== null ? (
                <Alert severity="info">
                  Import runtime: {historyConnection?.server ?? 'Unavailable'} ·{' '}
                  {historyConnection?.runtimeRole?.code ?? 'Unavailable'}
                  {selectedRun
                    ? ` · Run reference: ${selectedRun}`
                    : ' · Showing selected runtime history.'}
                </Alert>
              ) : null}
              <ImportExportHistoryPanel
                errorMessage={history.error?.message}
                filter={historyFilter}
                filteredRuns={filteredHistory}
                isError={history.isError}
                isLoading={history.isLoading}
                isSuccess={history.isSuccess}
                onFilterChange={setHistoryFilter}
                onSearchChange={setHistorySearch}
                runs={history.data ?? []}
                search={historySearch}
              />
            </Stack>
          ) : isDataReleaseArea(area) ? (
            <DataReleaseWorkbench
              catalogueErrorMessage={catalogue.error?.message}
              catalogueIsError={catalogue.isError}
              catalogueIsLoading={catalogue.isLoading}
              catalogueIsSuccess={catalogue.isSuccess}
              connectionAvailable={catalogueConnections.length > 0}
              executableReleaseCount={executableChosen.length}
              operationErrorMessage={operation.error?.message}
              operationIsError={operation.isError}
              operationIsPending={operation.isPending}
              operationIsSuccess={operation.isSuccess}
              dryRun={operation.data?.dryRun}
              releaseType={releaseType}
              selectedReleaseCount={executableChosen.length}
              selectedReleaseKeys={effectiveSelected}
              successMessage={verifiedSuccessMessage}
              summary={releaseSummary}
              visibleReleases={visible}
              onDeselectVisible={() => {
                const visibleKeys = new Set(visible.map(releaseKey));
                setSelected(
                  new Set([...selected].filter((key) => !visibleKeys.has(key))),
                );
                operation.reset();
              }}
              onInstallSelected={() => {
                setLastOperationMode('install');
                operation.mutate('install');
              }}
              onSelectVisible={() => {
                setSelected(
                  new Set([
                    ...selected,
                    ...visible
                      .filter((release) => isInstallableStatus(release.status))
                      .map(releaseKey),
                  ]),
                );
                operation.reset();
              }}
              onSelectReleases={(releases) => {
                setSelected(
                  new Set([
                    ...selected,
                    ...releases
                      .filter((release) => isInstallableStatus(release.status))
                      .map(releaseKey),
                  ]),
                );
                operation.reset();
              }}
              onToggleRelease={(release) => {
                if (!isInstallableStatus(release.status)) return;
                const next = new Set(selected);
                if (selected.has(releaseKey(release))) next.delete(releaseKey(release));
                else next.add(releaseKey(release));
                setSelected(next);
                operation.reset();
              }}
              onValidateSelected={() => {
                setLastOperationMode('validate');
                operation.mutate('validate');
              }}
            />
          ) : null}
        </Stack>
      </Paper>
    </WorkspaceContainer>
  );
}
