import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';

import { RecordedPreparations } from './components/RecordedPreparations';
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
import { dataOperationRuntimeService } from './api/dataOperationTargets';
import {
  combineDataCatalogueReads,
  dataCatalogueSources,
  withDataCatalogueSource,
  type DataCatalogueQuery,
} from './api/dataCatalogueSources';
import {
  DataAdministrationRequestError,
  downloadDataExportMedia,
  installDataReleases,
  loadExportHistory,
  loadInitializationProfiles,
  loadDataReleases,
  loadImportHistory,
  loadImportHistoryForMediaCode,
  loadImportRun,
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
  ImportRunSummary,
} from './api/dataReleaseContracts';
import { DataReleaseWorkbench } from './components/DataReleaseWorkbench';
import { GuidedInitializationWorkspace } from './components/GuidedInitializationWorkspace';
import { DataCatalogueCoverage } from './components/DataCatalogueCoverage';
import {
  captureDataCatalogueSelection,
  currentDataCatalogueSelection,
  dataCatalogueCommandBatches,
  dataReleaseResponseMatchesSelection,
  type DataCatalogueSelection,
} from './api/dataCatalogueSelection';
import { dataCatalogueSourceKey } from './api/dataCatalogueSources';
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
  initializationProfileKey,
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

function isAuthoringSchemaConnection(connection: AxisModuleConnection): boolean {
  return (
    connection.state === 'UP' &&
    connection.runtimeRole?.publication !== 'ONLINE' &&
    !['import', 'export', 'localizationApi'].includes(connection.moduleName)
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
  readonly scope: string;
  readonly connection: AxisModuleConnection;
  readonly profilesSnapshot: readonly InitializationProfile[];
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
  if (
    error instanceof DataAdministrationRequestError &&
    (error.code === 'ERR_IMP_00004' || error.status === 404)
  ) {
    return `${label} cannot be started${target} because the backend profile is no longer available. Refresh guided setup; if it remains unavailable, check the target import runtime initialization profile configuration.`;
  }
  return message;
}

interface DataReleaseOperationRequest {
  readonly mode: 'validate' | 'install';
  readonly scope: string;
  readonly releaseType: DataReleaseType;
  readonly tenantCode: string;
  readonly batches: ReturnType<typeof dataCatalogueCommandBatches>;
}

interface AcknowledgedImportBatch {
  readonly connection: AxisModuleConnection;
  readonly result: DataReleaseOperationResult;
}
class ImportBatchOperationError extends Error {
  readonly acknowledged: readonly AcknowledgedImportBatch[];
  readonly failedConnection: AxisModuleConnection;
  constructor(
    error: unknown,
    acknowledged: readonly AcknowledgedImportBatch[],
    connection: AxisModuleConnection,
  ) {
    super(
      error instanceof Error
        ? error.message
        : 'The import owner response could not be verified.',
    );
    this.name = 'ImportBatchOperationError';
    this.acknowledged = [...acknowledged];
    this.failedConnection = connection;
  }
}

async function executeDataReleaseOperationBySource(
  configuration: DataReleaseClientConfiguration,
  request: DataReleaseOperationRequest,
  isCurrent: () => boolean,
): Promise<DataReleaseOperationResult> {
  const results: DataReleaseOperationResult[] = [],
    acknowledged: AcknowledgedImportBatch[] = [];
  const releaseType = request.releaseType;
  for (const batch of request.batches) {
    if (
      batch.releases.some((release) => !release.allowedActions?.includes(request.mode))
    )
      throw new Error('Your current access does not allow this release action.');
    const plan = {
      ...createPlan(releaseType, batch.releases),
      ...(request.mode === 'install' &&
      batch.releases.every((release) => release.continuationSupported)
        ? { continuation: true }
        : {}),
    };
    try {
      if (!isCurrent())
        throw new Error(
          'Connection information changed. Remaining batches were not sent. Inspect acknowledged owner responses before another attempt.',
        );
      const result =
        request.mode === 'validate'
          ? await preflightDataReleases(batch.connection, configuration, plan)
          : await installDataReleases(batch.connection, configuration, plan);
      if (
        !dataReleaseResponseMatchesSelection(
          result,
          batch.releases,
          releaseType,
          request.tenantCode,
          request.mode,
        )
      )
        throw new Error(
          'The release response does not match the original owner request. Inspect owner history before another attempt.',
        );
      if (
        plan.continuation &&
        (!result.execution ||
          result.execution.dataType !== releaseType ||
          result.execution.releaseCodes.length !== result.releases.length ||
          result.releases.some(
            (release) =>
              !release.releaseCode ||
              !result.execution?.releaseCodes.includes(release.releaseCode) ||
              result.execution.expectedReleases[release.releaseCode] !==
                release.version,
          ))
      )
        throw new Error(
          'The preparation receipt does not match the reviewed releases. Inspect the recorded receipt before another action.',
        );
      results.push(result);
      acknowledged.push({ connection: batch.connection, result });
    } catch (error) {
      throw new ImportBatchOperationError(error, acknowledged, batch.connection);
    }
  }
  return Object.freeze({
    executions: Object.freeze(
      results.flatMap((result) => (result.execution ? [result.execution] : [])),
    ),
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
  const selectedMedia =
    historyParameters.getAll('importMedia').length > 1
      ? ''
      : historyParameters.get('importMedia');
  const selectedExport =
    historyParameters.getAll('exportMedia').length > 1
      ? ''
      : historyParameters.get('exportMedia');
  const [historySearch, setHistorySearch] = useState('');
  const [releaseSearch, setReleaseSearch] = useState('');
  const [selection, setSelection] = useState<DataCatalogueSelection>({
    scope: '',
    proofs: new Map(),
  });
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
  const catalogueSources = useMemo(
    () =>
      dataCatalogueSources(
        props.bootstrap.moduleConnections.import ?? [],
        createPlatformImportConnection(props.bootstrap, props.runtime),
      ),
    [props.bootstrap, props.runtime],
  );
  const catalogueConnections = catalogueSources
    .filter((source) => !source.problem)
    .map((source) => source.connection);
  const readActor = useMemo(
    () => ({ token: props.accessToken, id: crypto.randomUUID() }),
    [props.accessToken],
  );
  const sourceGraphKey = JSON.stringify(
    catalogueSources.map((source) => source.key).sort(),
  );
  const readScope = useMemo(
    () => ({
      graph: sourceGraphKey,
      actor: readActor.id,
      id: crypto.randomUUID(),
      tenant: props.bootstrap.tenantCode,
      project: props.runtime.projectCode,
      enterprise: props.runtime.enterpriseCode,
      generation: props.sessionGeneration,
    }),
    [
      sourceGraphKey,
      readActor.id,
      props.bootstrap.tenantCode,
      props.runtime.projectCode,
      props.runtime.enterpriseCode,
      props.sessionGeneration,
    ],
  );
  const currentReadScope = useRef(readScope.id);
  currentReadScope.current = readScope.id;
  const exportConnections = useMemo(
    () =>
      Object.freeze(
        (props.bootstrap.moduleConnections.export ?? []).filter(
          (connection) => connection.state === 'UP' || connection.state === 'DEGRADED',
        ),
      ),
    [props.bootstrap.moduleConnections],
  );
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
  const fileSourceGraph = JSON.stringify([
    catalogueConnections.map(dataCatalogueSourceKey).sort(),
    mediaConnections.map(dataCatalogueSourceKey).sort(),
    schemaConnections.map(dataCatalogueSourceKey).sort(),
  ]);
  const fileScope = useMemo(
    () => ({
      id: crypto.randomUUID(),
      source: fileSourceGraph,
      admission: readScope.id,
    }),
    [fileSourceGraph, readScope.id],
  );
  const [fileCommand, setFileCommand] = useState({ scope: '', pending: false });
  const fileCommandPending = fileCommand.scope === fileScope.id && fileCommand.pending;
  const filePendingChanged = useCallback(
    (pending: boolean) => setFileCommand({ scope: fileScope.id, pending }),
    [fileScope.id],
  );
  const exportSourceGraph = JSON.stringify([
    exportConnections.map(dataCatalogueSourceKey).sort(),
    mediaConnections.map(dataCatalogueSourceKey).sort(),
    schemaConnections.map(dataCatalogueSourceKey).sort(),
  ]);
  const exportScope = useMemo(
    () => ({
      id: crypto.randomUUID(),
      source: exportSourceGraph,
      actor: readActor.id,
      tenant: props.bootstrap.tenantCode,
      enterprise: props.runtime.enterpriseCode,
      project: props.runtime.projectCode,
      generation: props.sessionGeneration,
    }),
    [
      exportSourceGraph,
      readActor.id,
      props.bootstrap.tenantCode,
      props.runtime.enterpriseCode,
      props.runtime.projectCode,
      props.sessionGeneration,
    ],
  );
  const [exportCommand, setExportCommand] = useState({ scope: '', pending: false });
  const exportCommandPending =
    exportCommand.scope === exportScope.id && exportCommand.pending;
  const exportPendingChanged = useCallback(
    (pending: boolean) => setExportCommand({ scope: exportScope.id, pending }),
    [exportScope.id],
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
  const combineReleases = useCallback(
    (queries: readonly DataCatalogueQuery<DataRelease>[]) =>
      combineDataCatalogueReads(
        catalogueSources,
        queries,
        releaseKey,
        () => true, // The secured owner catalogue already qualifies actual schema/service destination admission.
      ),
    [catalogueSources],
  );
  const combineProfiles = useCallback(
    (queries: readonly DataCatalogueQuery<InitializationProfile>[]) => {
      const result = combineDataCatalogueReads(
        catalogueSources,
        queries,
        initializationProfileKey,
        () => true,
      );
      return {
        ...result,
        data: Object.freeze([...result.data].sort(compareInitializationProfiles)),
      };
    },
    [catalogueSources],
  );
  const observingSetup = isDataReleaseArea(area) || area === 'guided';
  const catalogue = useQueries({
    queries: catalogueSources.map((source) => ({
      queryKey: [
        'import-catalogue',
        props.runtime.enterpriseCode,
        props.sessionGeneration,
        readActor.id,
        props.bootstrap.tenantCode,
        props.runtime.projectCode,
        source.key,
      ],
      queryFn: async () =>
        withDataCatalogueSource(
          await loadDataReleases(source.connection, configuration),
          source.connection,
        ),
      enabled: !source.problem && observingSetup,
      retry: false,
      refetchOnMount: 'always' as const,
    })),
    combine: combineReleases,
  });
  const profiles = useQueries({
    queries: catalogueSources.map((source) => ({
      queryKey: [
        'initialization-profiles',
        props.runtime.enterpriseCode,
        props.sessionGeneration,
        readActor.id,
        props.bootstrap.tenantCode,
        props.runtime.projectCode,
        source.key,
      ],
      queryFn: async () =>
        withDataCatalogueSource(
          await loadInitializationProfiles(source.connection, configuration),
          source.connection,
        ),
      enabled: !source.problem && observingSetup,
      retry: false,
      refetchOnMount: 'always' as const,
    })),
    combine: combineProfiles,
  });
  const selected = useMemo(
    () =>
      currentDataCatalogueSelection(
        selection,
        readScope.id,
        catalogue.data,
        catalogue.origins,
      ),
    [selection, readScope.id, catalogue.data, catalogue.origins],
  );
  const setSelected = (keys: ReadonlySet<string>) =>
    setSelection(
      captureDataCatalogueSelection(
        readScope.id,
        keys,
        catalogue.data,
        catalogue.origins,
      ),
    );
  const historyExportConnection = historyConnection
    ? dataOperationRuntimeService(historyConnection, 'export', exportConnections)
    : undefined;
  const historyMediaConnection = historyExportConnection
    ? dataOperationRuntimeService(historyExportConnection, 'media', mediaConnections)
    : undefined;
  const history = useQuery<{
    readonly runs: readonly ImportRunSummary[];
    readonly exportDenied?: boolean;
  }>({
    queryKey: [
      'import-export-history',
      props.runtime.enterpriseCode,
      props.sessionGeneration,
      historyConnection?.instanceId,
      historyConnection?.endpoint,
      selectedRun,
      selectedMedia,
      selectedExport,
      readScope.id,
      exportConnections.map(dataCatalogueSourceKey).sort().join('|'),
      historyFilter,
    ],
    queryFn: async () => {
      if (!historyConnection)
        throw new Error(
          'The requested Import runtime is unavailable in the authorized catalogue.',
        );
      if (selectedRun !== null && !/^[A-Za-z0-9_.:-]{1,192}$/.test(selectedRun))
        throw new Error('The requested import run reference is invalid.');
      if (selectedMedia !== null && !/^[A-Za-z0-9_.:-]{1,192}$/.test(selectedMedia))
        throw new Error('The requested import file reference is invalid.');
      if (
        [selectedRun, selectedMedia, selectedExport].filter((value) => value !== null)
          .length > 1
      )
        throw new Error('Select one exact run or file reference.');
      const exportOwner = historyExportConnection;
      if (selectedExport !== null) {
        if (!/^[A-Za-z0-9_.:-]{1,192}$/.test(selectedExport) || !exportOwner)
          throw new Error(
            'The requested export runtime or artifact reference is unavailable.',
          );
        const runs = await loadExportHistory(
          exportOwner,
          configuration,
          fetch,
          selectedExport,
        );
        if (runs.length !== 1 || runs[0]?.media?.mediaCode !== selectedExport)
          throw new Error('The exact export artifact was not returned by its owner.');
        return { runs };
      }
      if (selectedMedia !== null) {
        return {
          runs: await loadImportHistoryForMediaCode(
            historyConnection,
            configuration,
            selectedMedia,
          ),
        };
      }
      if (selectedRun !== null) {
        return {
          runs: [await loadImportRun(historyConnection, configuration, selectedRun)],
        };
      }
      if (historyFilter === 'exports') {
        return {
          runs: exportOwner ? await loadExportHistory(exportOwner, configuration) : [],
        };
      }
      if (historyFilter === 'all' && exportOwner) {
        const [imports, exports] = await Promise.all([
          loadImportHistory(historyConnection, configuration),
          loadExportHistory(exportOwner, configuration).catch((error: unknown) => {
            // An Export denial does not revoke the separately authorized Import read.
            if (error instanceof DataAdministrationRequestError && error.status === 403)
              return undefined;
            throw error;
          }),
        ]);
        if (!exports) return { runs: imports, exportDenied: true };
        return {
          runs: [...imports, ...exports].sort((left, right) =>
            (right.createdAt ?? '').localeCompare(left.createdAt ?? ''),
          ),
        };
      }
      return { runs: await loadImportHistory(historyConnection, configuration) };
    },
    enabled: area === 'history',
  });
  const releaseType = isDataReleaseArea(area) ? area : 'init';
  const visible = useMemo(
    () =>
      isDataReleaseArea(area) && !catalogue.isError
        ? (catalogue.data ?? []).filter((release) => {
            if (release.dataType !== area) return false;
            // Keep every executable selected member visible while finding the
            // next release, so a batch never contains hidden search selections.
            if (
              selected.has(releaseKey(release)) &&
              isInstallableStatus(release.status)
            )
              return true;
            const term = releaseSearch.trim().toLocaleLowerCase();
            return (
              !term ||
              [
                release.displayName,
                release.moduleName,
                release.releaseCode,
                release.description,
              ]
                .filter(Boolean)
                .join(' ')
                .toLocaleLowerCase()
                .includes(term)
            );
          })
        : [],
    [area, catalogue.data, catalogue.isError, releaseSearch, selected],
  );
  const effectiveSelected = useMemo(() => {
    const executableKeys = new Set(
      visible
        .filter(
          (release) =>
            isInstallableStatus(release.status) && release.allowedActions?.length,
        )
        .map(releaseKey),
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
    const runs = (
      history.isError || history.isFetching ? [] : (history.data?.runs ?? [])
    ).filter((run) => {
      if (selectedExport !== null) return run.dataType === 'export';
      if (selectedRun !== null || selectedMedia !== null)
        return run.dataType !== 'export';
      if (historyFilter === 'imports') return run.dataType !== 'export';
      if (historyFilter === 'exports') return run.dataType === 'export';
      return true;
    });
    if (!normalizedSearch) return runs;
    return runs.filter((run) => historySearchText(run).includes(normalizedSearch));
  }, [
    history.data,
    history.isError,
    history.isFetching,
    historyFilter,
    historySearch,
    selectedExport,
    selectedMedia,
    selectedRun,
  ]);
  const operation = useMutation({
    retry: false,
    mutationFn: async (request: DataReleaseOperationRequest) => {
      if (request.scope !== currentReadScope.current || request.batches.length === 0)
        throw new Error(
          'Source information changed. Refresh data and review the selection before another command.',
        );
      return executeDataReleaseOperationBySource(
        configuration,
        request,
        () => request.scope === currentReadScope.current,
      );
    },
    onSettled: async (_data, _error, request) => {
      if (request.mode === 'install' && request.scope === currentReadScope.current) {
        setSelected(new Set());
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['import-catalogue', props.runtime.enterpriseCode],
        }),
        queryClient.invalidateQueries({
          queryKey: ['import-executions', request.scope],
        }),
      ]);
    },
  });
  const profileOperation = useMutation({
    retry: false,
    mutationFn: async (request: InitializationProfileOperationRequest) => {
      const profile =
        profiles.data.find(
          (item) => initializationProfileKey(item) === request.profileKey,
        ) ??
        request.profilesSnapshot.find(
          (item) => initializationProfileKey(item) === request.profileKey,
        );
      if (request.scope !== currentReadScope.current)
        throw new Error(
          'Source information changed. Refresh data and review this profile before another command.',
        );
      if (!profile?.allowedActions?.includes(request.mode))
        throw new Error('Your current access does not allow this setup action.');
      const profileConnection = request.connection;
      try {
        const result = await runInitializationProfile(
          profileConnection,
          configuration,
          request.profileCode,
          request.mode,
        );
        if (
          result.profileCode !== request.profileCode ||
          result.mode !== request.mode.toUpperCase() ||
          initializationProfileKey({
            ...result.profile,
            catalogueSource: request.connection,
          }) !== request.profileKey
        )
          throw new Error(
            'The setup response does not match the original owner request. Inspect current owner state before another attempt.',
          );
        return {
          ...result,
          profile: { ...result.profile, catalogueSource: request.connection },
        };
      } catch (error) {
        throw new Error(profileOperationErrorMessage(error, profile, request));
      }
    },
    onSettled: async () => {
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
  const operationIsCurrent = operation.variables?.scope === readScope.id;
  const profileOperationIsCurrent = profileOperation.variables?.scope === readScope.id;
  const operationReadVerified =
    operationIsCurrent &&
    operation.data?.releases.every((release) => release.status === 'CURRENT') ===
      true &&
    Boolean(
      operation.variables?.batches.every(
        (batch) =>
          catalogue.sources.some(
            (source) =>
              source.status === 'LOADED' &&
              dataCatalogueSourceKey(source.source.connection) ===
                dataCatalogueSourceKey(batch.connection),
          ) &&
          batch.releases.every((expected) =>
            catalogue.data.some(
              (current) =>
                releaseKey(current) === releaseKey(expected) &&
                current.version === expected.version &&
                current.checksum === expected.checksum &&
                current.status === 'CURRENT',
            ),
          ) &&
          batch.releases.every((expected) => {
            const origin = catalogue.origins.get(releaseKey(expected));
            return (
              origin &&
              dataCatalogueSourceKey(origin) ===
                dataCatalogueSourceKey(batch.connection)
            );
          }),
      ),
    );
  const profileRequest = profileOperation.variables;
  const profileOrigin = profileRequest
    ? profiles.origins.get(profileRequest.profileKey)
    : undefined;
  const profileReadVerified =
    profileOperationIsCurrent &&
    profileOperation.data?.profile.status === 'CURRENT' &&
    Boolean(
      profileRequest &&
      profileOrigin &&
      dataCatalogueSourceKey(profileOrigin) ===
        dataCatalogueSourceKey(profileRequest.connection) &&
      profiles.sources.some(
        (source) =>
          source.status === 'LOADED' &&
          dataCatalogueSourceKey(source.source.connection) ===
            dataCatalogueSourceKey(profileRequest.connection),
      ) &&
      profiles.data.some(
        (profile) =>
          initializationProfileKey(profile) === profileRequest.profileKey &&
          profile.status === 'CURRENT' &&
          !profile.blocked,
      ),
    );
  const priorCommand =
    !operationIsCurrent && operation.variables
      ? {
          connections: operation.variables.batches.map((batch) => batch.connection),
          pending: operation.isPending,
          error: operation.error?.message,
          acknowledged: operation.data?.releases.length,
        }
      : !profileOperationIsCurrent && profileOperation.variables
        ? {
            connections: [profileOperation.variables.connection],
            pending: profileOperation.isPending,
            error: profileOperation.error?.message,
            acknowledged: profileOperation.data ? 1 : undefined,
          }
        : undefined;
  const operationTypeLabel = operation.data
    ? typeCopy[operation.data.dataType].label.toLowerCase()
    : 'data';
  const successMessage =
    lastOperationMode === 'install' && operation.data?.executions?.length
      ? 'Preparation progress saved. Inspect Recorded preparations below to continue from the owner receipt.'
      : operationSucceededWithCurrentOnly(lastOperationMode, operation.data?.releases)
        ? `${operation.data?.releases.length ?? 0} ${operationTypeLabel} release(s) validated. Everything is already current; no import or update was required.`
        : lastOperationMode === 'validate'
          ? `${operation.data?.releases.length ?? 0} ${operationTypeLabel} release(s) validated by the backend.`
          : `${operation.data?.releases.length ?? 0} ${operationTypeLabel} release(s) installed or updated.`;
  const verifiedSuccessMessage =
    !operation.data?.executions?.length &&
    !operationReadVerified &&
    operation.data &&
    lastOperationMode === 'install'
      ? `${operation.data.releases.length} release(s) acknowledged by the Import owner. Refreshed installation state is unverified; sign in again if required, then inspect the owner catalogue or receipt. Do not repeat the import.`
      : successMessage;

  const refreshSourceReads = () => {
    if (operation.isPending || profileOperation.isPending) return;
    setSelected(new Set());
    void Promise.allSettled([
      queryClient.refetchQueries({
        queryKey: [
          'import-catalogue',
          props.runtime.enterpriseCode,
          props.sessionGeneration,
          readActor.id,
        ],
        type: 'active',
      }),
      queryClient.refetchQueries({
        queryKey: [
          'initialization-profiles',
          props.runtime.enterpriseCode,
          props.sessionGeneration,
          readActor.id,
        ],
        type: 'active',
      }),
    ]);
  };

  const changeArea = (next: ImportExportArea) => {
    if (
      operation.isPending ||
      profileOperation.isPending ||
      fileCommandPending ||
      exportCommandPending
    )
      return;
    const parameters = new URLSearchParams(historyParameters);
    if (next === 'guided') parameters.delete('area');
    else parameters.set('area', next);
    setHistoryParameters(parameters, { replace: true });
    setSelected(new Set());
    operation.reset();
    profileOperation.reset();
  };

  const inspectOriginalOwner = (
    original: AxisModuleConnection,
    reference?: { runId?: string; mediaCode?: string },
  ) => {
    if (operation.isPending || profileOperation.isPending) return;
    const current = importHistoryConnection(props.bootstrap, original.instanceId);
    if (
      !current ||
      dataCatalogueSourceKey(current) !== dataCatalogueSourceKey(original)
    )
      return;
    const parameters = new URLSearchParams(historyParameters);
    parameters.set('area', 'history');
    parameters.set('importInstance', original.instanceId);
    parameters.delete('importRun');
    parameters.delete('importMedia');
    parameters.delete('exportMedia');
    if (reference?.runId) parameters.set('importRun', reference.runId);
    else if (reference?.mediaCode) parameters.set('importMedia', reference.mediaCode);
    setHistoryFilter(reference ? 'imports' : 'all');
    setHistorySearch('');
    setHistoryParameters(parameters, { replace: true });
    setSelected(new Set());
  };

  const inspectOriginalExport = (
    original: AxisModuleConnection,
    mediaCode?: string,
  ) => {
    const target = dataOperationRuntimeService(original, 'import', historyConnections);
    if (
      !target ||
      dataOperationRuntimeService(target, 'export', exportConnections) !== original
    )
      return;
    const parameters = new URLSearchParams(historyParameters);
    parameters.set('area', 'history');
    parameters.set('importInstance', target.instanceId);
    if (mediaCode) parameters.set('exportMedia', mediaCode);
    else parameters.delete('exportMedia');
    parameters.delete('importRun');
    parameters.delete('importMedia');
    setHistoryFilter('exports');
    setHistorySearch('');
    setHistoryParameters(parameters, { replace: true });
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
                  disabled={
                    operation.isPending ||
                    profileOperation.isPending ||
                    fileCommandPending ||
                    exportCommandPending
                  }
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

          {priorCommand ? (
            <Alert severity="warning">
              An operation used earlier connection information. Its result does not
              verify the current catalogue. No operation was repeated.
              {priorCommand.pending ? ' The original response is still pending.' : null}
              {priorCommand.error ? <Box>{priorCommand.error}</Box> : null}
              {priorCommand.acknowledged !== undefined ? (
                <Box>
                  {priorCommand.acknowledged} original owner response(s) acknowledged.
                </Box>
              ) : null}
              <Box component="ul">
                {priorCommand.connections.map((original) => {
                  const current = importHistoryConnection(
                    props.bootstrap,
                    original.instanceId,
                  );
                  return (
                    <Box component="li" key={dataCatalogueSourceKey(original)}>
                      {original.server ?? original.moduleName} ·{' '}
                      {original.runtimeRole?.code ?? original.environment}
                      <Button
                        disabled={
                          priorCommand.pending ||
                          !current ||
                          dataCatalogueSourceKey(current) !==
                            dataCatalogueSourceKey(original)
                        }
                        onClick={() => inspectOriginalOwner(original)}
                      >
                        Inspect original owner history
                      </Button>
                    </Box>
                  );
                })}
              </Box>
            </Alert>
          ) : null}
          {operation.error instanceof ImportBatchOperationError &&
          operation.error.acknowledged.length > 0 ? (
            <Alert severity="warning">
              Some earlier owner responses were acknowledged before the remaining
              response could be verified. No command was replayed.
              <Box component="ul">
                {operation.error.acknowledged.map((batch) => (
                  <Box component="li" key={dataCatalogueSourceKey(batch.connection)}>
                    {batch.connection.server ?? batch.connection.moduleName}:{' '}
                    {batch.result.releases.length} release response(s) acknowledged.
                    Inspect owner history and current state.
                  </Box>
                ))}
              </Box>
            </Alert>
          ) : null}
          {profileOperation.isSuccess &&
          profileOperationIsCurrent &&
          profileOperation.data?.mode === 'INSTALL' &&
          !profileReadVerified ? (
            <Alert severity="warning">
              The setup owner acknowledged the operation. Refreshed setup status is
              unverified; inspect current owner state before another attempt.
            </Alert>
          ) : null}
          {observingSetup ? (
            <DataCatalogueCoverage
              read={area === 'guided' ? profiles : catalogue}
              commandPending={operation.isPending || profileOperation.isPending}
              onRefresh={refreshSourceReads}
            />
          ) : null}
          {area === 'guided' ? (
            profiles.isPartial &&
            profiles.data.length === 0 &&
            !profiles.isError &&
            !profileOperation.isPending ? null : (
              <GuidedInitializationWorkspace
                operationIsPending={operation.isPending || profileOperation.isPending}
                errorMessage={profiles.error?.message}
                isLoading={
                  profiles.isLoading &&
                  !(profileOperation.isPending && profileOperationIsCurrent)
                }
                operationError={
                  profileOperation.isError &&
                  profileOperationIsCurrent &&
                  profileOperation.variables
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
                profiles={
                  profileOperation.isPending && profileOperationIsCurrent
                    ? (profileOperation.variables?.profilesSnapshot ?? [])
                    : profiles.data
                }
                successMessage={
                  profileOperation.isSuccess &&
                  profileOperationIsCurrent &&
                  profileOperation.variables &&
                  (profileOperation.data?.mode !== 'INSTALL' || profileReadVerified)
                    ? {
                        profileKey: profileOperation.variables.profileKey,
                        message:
                          profileOperation.data?.mode === 'INSTALL'
                            ? profileOperation.data.profile.completionMessage
                            : 'The backend validated the immutable initialization plan. No data was changed.',
                      }
                    : undefined
                }
                onRun={(profile, mode) => {
                  if (operation.isPending || profileOperation.isPending) return;
                  const source = profiles.origins.get(
                    initializationProfileKey(profile),
                  );
                  if (!source) return;
                  profileOperation.mutate({
                    scope: readScope.id,
                    connection: source,
                    profilesSnapshot: profiles.data,
                    profileKey: initializationProfileKey(profile),
                    profileCode: profile.profileCode,
                    destinationRole: profile.destinationRole,
                    mode,
                  });
                }}
                onOpenArea={changeArea}
              />
            )
          ) : area === 'exports' ? (
            <ExportWorkspace
              key={exportScope.id}
              sourceSearch={location.search}
              scope={exportScope.id}
              onPendingChange={exportPendingChanged}
              onInspectHistory={inspectOriginalExport}
              configuration={configuration}
              enterpriseCode={props.runtime.enterpriseCode}
              exportConnections={exportConnections}
              mediaConnections={mediaConnections}
              schemaConnections={schemaConnections}
              tenantCode={props.bootstrap.tenantCode}
            />
          ) : area === 'file-imports' ? (
            <FileImportWorkspace
              key={fileScope.id}
              scope={fileScope.id}
              onPendingChange={filePendingChanged}
              onInspectHistory={inspectOriginalOwner}
              configuration={configuration}
              enterpriseCode={props.runtime.enterpriseCode}
              importConnections={catalogueConnections}
              mediaConnections={mediaConnections}
              schemaConnections={schemaConnections}
              tenantCode={props.bootstrap.tenantCode}
            />
          ) : area === 'history' ? (
            <Stack spacing={2}>
              <TextField
                select
                label="History runtime"
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
                  next.delete('importMedia');
                  next.delete('exportMedia');
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
                  History runtime: {historyConnection?.server ?? 'Unavailable'} ·{' '}
                  {historyConnection?.runtimeRole?.code ?? 'Unavailable'}
                  {selectedRun
                    ? ` · Run reference: ${selectedRun}`
                    : selectedExport
                      ? ` · Artifact reference: ${selectedExport}`
                      : selectedMedia
                        ? ' · Showing attempts for the original uploaded file.'
                        : ' · Showing selected runtime history.'}
                </Alert>
              ) : null}
              <ImportExportHistoryPanel
                key={`${exportScope.id}:${historyConnection?.instanceId ?? ''}:${selectedExport ?? ''}`}
                onDownloadArtifact={
                  historyMediaConnection
                    ? (media) =>
                        downloadDataExportMedia(
                          historyMediaConnection,
                          configuration,
                          media,
                        )
                    : undefined
                }
                errorMessage={history.error?.message}
                exportDenied={
                  history.isSuccess &&
                  !history.isFetching &&
                  history.data.exportDenied === true
                }
                filter={historyFilter}
                filteredRuns={filteredHistory}
                isError={history.isError}
                isLoading={history.isFetching}
                isSuccess={history.isSuccess && !history.isFetching}
                onRefresh={() => void history.refetch()}
                onFilterChange={setHistoryFilter}
                onSearchChange={setHistorySearch}
                runs={history.data?.runs ?? []}
                search={historySearch}
              />
            </Stack>
          ) : isDataReleaseArea(area) ? (
            <>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { sm: 'center' } }}
              >
                <TextField
                  label="Find releases"
                  type="search"
                  value={releaseSearch}
                  onChange={(event) => setReleaseSearch(event.target.value)}
                  helperText="Search names, owners, or descriptions. Selected releases stay visible."
                  size="small"
                  sx={{ flex: 1 }}
                />
                {releaseSearch.trim() ? (
                  <>
                    <Typography role="status" color="text.secondary">
                      {visible.length} releases shown
                    </Typography>
                    <Button onClick={() => setReleaseSearch('')}>
                      Clear release search
                    </Button>
                  </>
                ) : null}
              </Stack>
              {catalogue.isPartial &&
              catalogue.data.length === 0 &&
              !catalogue.isError &&
              !operation.isPending &&
              !operation.data &&
              !operation.error ? null : (
                <DataReleaseWorkbench
                  catalogueErrorMessage={catalogue.error?.message}
                  catalogueIsError={catalogue.isError}
                  catalogueIsLoading={catalogue.isLoading}
                  catalogueIsSuccess={catalogue.isSuccess}
                  catalogueIsPartial={catalogue.isPartial}
                  connectionAvailable={catalogueConnections.length > 0}
                  executableReleaseCount={executableChosen.length}
                  operationErrorMessage={
                    operationIsCurrent ? operation.error?.message : undefined
                  }
                  operationIsError={operation.isError && operationIsCurrent}
                  operationIsPending={operation.isPending}
                  operationIsSuccess={operation.isSuccess && operationIsCurrent}
                  operationSuccessSeverity={
                    lastOperationMode === 'install' &&
                    (operation.data?.executions?.length
                      ? operation.data.executions.some((execution) =>
                          ['RUNNING', 'UNCERTAIN'].includes(execution.status),
                        )
                      : !operationReadVerified)
                      ? 'warning'
                      : 'success'
                  }
                  dryRun={operationIsCurrent ? operation.data?.dryRun : undefined}
                  releaseType={releaseType}
                  selectedReleaseCount={executableChosen.length}
                  canValidateSelected={
                    executableChosen.length > 0 &&
                    executableChosen.every((release) =>
                      release.allowedActions?.includes('validate'),
                    )
                  }
                  canInstallSelected={
                    executableChosen.length > 0 &&
                    executableChosen.every((release) =>
                      release.allowedActions?.includes('install'),
                    )
                  }
                  selectedReleaseKeys={effectiveSelected}
                  successMessage={verifiedSuccessMessage}
                  summary={releaseSummary}
                  filterActive={releaseSearch.trim().length > 0}
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
                    operation.mutate({
                      mode: 'install',
                      scope: readScope.id,
                      releaseType,
                      tenantCode: props.bootstrap.tenantCode,
                      batches: dataCatalogueCommandBatches(
                        executableChosen,
                        catalogue.origins,
                      ),
                    });
                  }}
                  onSelectVisible={() => {
                    setSelected(
                      new Set([
                        ...selected,
                        ...visible
                          .filter(
                            (release) =>
                              isInstallableStatus(release.status) &&
                              release.allowedActions?.length,
                          )
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
                          .filter(
                            (release) =>
                              isInstallableStatus(release.status) &&
                              release.allowedActions?.length,
                          )
                          .map(releaseKey),
                      ]),
                    );
                    operation.reset();
                  }}
                  onToggleRelease={(release) => {
                    if (
                      !isInstallableStatus(release.status) ||
                      !release.allowedActions?.length
                    )
                      return;
                    const next = new Set(selected);
                    if (selected.has(releaseKey(release)))
                      next.delete(releaseKey(release));
                    else next.add(releaseKey(release));
                    setSelected(next);
                    operation.reset();
                  }}
                  onValidateSelected={() => {
                    setLastOperationMode('validate');
                    operation.mutate({
                      mode: 'validate',
                      scope: readScope.id,
                      releaseType,
                      tenantCode: props.bootstrap.tenantCode,
                      batches: dataCatalogueCommandBatches(
                        executableChosen,
                        catalogue.origins,
                      ),
                    });
                  }}
                />
              )}
              <RecordedPreparations
                key={readScope.id + releaseType}
                scopeId={readScope.id}
                configuration={configuration}
                dataType={releaseType}
                connections={catalogueConnections.filter((connection) =>
                  catalogue.data.some(
                    (release) =>
                      release.continuationSupported &&
                      release.catalogueSource?.instanceId === connection.instanceId,
                  ),
                )}
              />
            </>
          ) : null}
        </Stack>
      </Paper>
    </WorkspaceContainer>
  );
}
