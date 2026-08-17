import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Paper, Stack, Tab, Tabs } from '@mui/material';
import { useMemo, useState } from 'react';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import type { AxisNavigationItem } from '../../bootstrap/publicBootstrap';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisModuleConnection,
  type AxisAuthenticatedBootstrap,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  installDataReleases,
  loadInitializationProfiles,
  loadDataReleases,
  loadImportHistory,
  preflightDataReleases,
  runInitializationProfile,
  type DataReleaseClientConfiguration,
} from './api/dataReleaseClient';
import type {
  DataRelease,
  DataReleaseOperationResult,
  DataReleasePlan,
  DataReleaseType,
} from './api/dataReleaseContracts';
import { DataReleaseWorkbench } from './components/DataReleaseWorkbench';
import { GuidedInitializationWorkspace } from './components/GuidedInitializationWorkspace';
import { ExportWorkspace } from './components/ExportWorkspace';
import { FileImportWorkspace } from './components/FileImportWorkspace';
import { ImportExportHistoryPanel } from './components/ImportExportHistoryPanel';
import {
  areaCopy,
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
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}

function isDataReleaseArea(area: ImportExportArea): area is DataReleaseType {
  return releaseTypes.includes(area as DataReleaseType);
}

function initialAreaFromLocation(): ImportExportArea {
  if (typeof window === 'undefined') return 'init';
  const candidate = new URLSearchParams(window.location.search).get('area');
  return importExportAreas.includes(candidate as ImportExportArea)
    ? (candidate as ImportExportArea)
    : 'guided';
}

function replaceAreaInLocation(area: ImportExportArea): void {
  if (typeof window === 'undefined') return;
  const next = new URL(window.location.href);
  if (area === 'guided') next.searchParams.delete('area');
  else next.searchParams.set('area', area);
  window.history.replaceState(
    window.history.state,
    '',
    `${next.pathname}${next.search}${next.hash}`,
  );
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
    (connection) => connection.state === 'UP' || connection.state === 'DEGRADED',
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
  });
}

export function ImportExportRoutePage(props: ImportExportRoutePageProps) {
  const [area, setArea] = useState<ImportExportArea>(() => initialAreaFromLocation());
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [lastOperationMode, setLastOperationMode] = useState<
    'validate' | 'install' | undefined
  >(undefined);
  const queryClient = useQueryClient();
  const connection = selectDataAdministrationConnection(props.bootstrap, 'import');
  const catalogueConnections = useMemo(
    () => selectReleaseCatalogueConnections(props.bootstrap, props.runtime),
    [props.bootstrap, props.runtime],
  );
  const exportConnection = selectDataAdministrationConnection(
    props.bootstrap,
    'export',
  );
  const mediaConnection = selectDataAdministrationConnection(props.bootstrap, 'media');
  const schemaConnections = useMemo(
    () =>
      Object.freeze(
        Object.values(props.bootstrap.moduleConnections)
          .flat()
          .filter((connection) => connection.state === 'UP'),
      ),
    [props.bootstrap.moduleConnections],
  );
  const configuration = useMemo<DataReleaseClientConfiguration>(
    () => ({
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      timeoutMs: props.runtime.requestTimeoutMs,
    }),
    [props.accessToken, props.runtime.enterpriseCode, props.runtime.requestTimeoutMs],
  );
  const catalogue = useQuery({
    queryKey: ['import-catalogue', props.runtime.enterpriseCode],
    queryFn: () => {
      if (catalogueConnections.length === 0)
        throw new Error('Import service is unavailable');
      return loadDataReleasesByDestination(catalogueConnections, configuration);
    },
    enabled: catalogueConnections.length > 0,
  });
  const profiles = useQuery({
    queryKey: ['initialization-profiles', props.runtime.enterpriseCode],
    queryFn: () => {
      if (!connection) throw new Error('Import service is unavailable');
      return loadInitializationProfiles(connection, configuration);
    },
    enabled: Boolean(connection),
  });
  const history = useQuery({
    queryKey: ['import-history', props.runtime.enterpriseCode],
    queryFn: () => {
      if (!connection) throw new Error('Import service is unavailable');
      return loadImportHistory(connection, configuration);
    },
    enabled: Boolean(connection) && area === 'history',
  });
  const releaseType = isDataReleaseArea(area) ? area : 'init';
  const visible = useMemo(
    () =>
      isDataReleaseArea(area)
        ? (catalogue.data ?? []).filter((release) => release.dataType === area)
        : [],
    [area, catalogue.data],
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
    if (historyFilter === 'exports') return [];
    const normalizedSearch = historySearch.trim().toLowerCase();
    const runs = history.data ?? [];
    if (!normalizedSearch) return runs;
    return runs.filter((run) => historySearchText(run).includes(normalizedSearch));
  }, [history.data, historyFilter, historySearch]);
  const operation = useMutation({
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
      if (mode === 'install') setSelected(new Set());
      await queryClient.invalidateQueries({
        queryKey: ['import-catalogue', props.runtime.enterpriseCode],
      });
    },
  });
  const profileOperation = useMutation({
    mutationFn: (request: { profileCode: string; mode: 'validate' | 'install' }) => {
      if (!connection) throw new Error('Import service is unavailable');
      return runInitializationProfile(
        connection,
        configuration,
        request.profileCode,
        request.mode,
      );
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

  const changeArea = (next: ImportExportArea) => {
    setArea(next);
    replaceAreaInLocation(next);
    setSelected(new Set());
    operation.reset();
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
              operationError={profileOperation.error?.message}
              operationPending={profileOperation.isPending}
              profiles={profiles.data ?? []}
              successMessage={
                profileOperation.data?.mode === 'INSTALL'
                  ? profileOperation.data.profile.completionMessage
                  : profileOperation.data
                    ? 'The backend validated the immutable initialization plan. No data was changed.'
                    : undefined
              }
              onRun={(profileCode, mode) =>
                profileOperation.mutate({ profileCode, mode })
              }
            />
          ) : area === 'exports' ? (
            <ExportWorkspace
              configuration={configuration}
              enterpriseCode={props.runtime.enterpriseCode}
              exportConnection={exportConnection}
              mediaConnection={mediaConnection}
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
              releaseType={releaseType}
              selectedReleaseCount={executableChosen.length}
              selectedReleaseKeys={effectiveSelected}
              successMessage={successMessage}
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
