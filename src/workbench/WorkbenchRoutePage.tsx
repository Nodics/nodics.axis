import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';

import { CmsRoutePage } from '../app/CmsRoutePage';
import type { AxisSort } from '../app/table/axisTableSorting';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisModuleConnection,
  type AxisNavigationLifecycleAction,
  type AxisNavigationItem,
} from '../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import {
  createWorkbenchRecord,
  bulkDeleteWorkbenchRecords,
  deleteWorkbenchRecord,
  executeWorkbenchLifecycleAction,
  loadWorkbenchRecords,
  loadWorkbenchSchemas,
  previewWorkbenchDeleteImpact,
  updateWorkbenchRecord,
} from './api/workbenchClient';
import type {
  WorkbenchFilterGroup,
  WorkbenchRecord,
  WorkbenchRelationship,
  WorkbenchSchema,
} from './api/workbenchContracts';
import type { WorkbenchRecordDetailPanel } from './detail/workbenchRecordDetailPanels';
import type { WorkbenchRelationshipLoadOptions } from './form/WorkbenchRelationshipRuntime';
import {
  loadWorkbenchPreferences,
  saveWorkbenchPreferences,
  schemaPreferenceKey,
  type WorkbenchPreferences,
  type WorkbenchSavedView,
} from './preferences/workbenchPreferences';
import {
  combineWorkbenchFilterGroups,
  relatedRecordPanelFilter,
  resolveWorkbenchDefaultColumns,
  resolveWorkbenchDeepLinkTarget,
  resolveWorkbenchLookupPageSize,
  resolveWorkbenchRecordSort,
  resolveWorkbenchRouteTarget,
  schemaWithValidQueryCapabilities,
  selectWorkbenchReferencedRecord,
  workbenchPresentationForbiddenFields,
  workbenchPresentationForSchema,
  workbenchFixedFilterGroup,
  workbenchReferenceLookupQuery,
  type WorkbenchRouteSchemaSelection,
} from './workbenchRouteModel';

interface WorkbenchRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly channel: string;
  readonly cmsBaseUrl: string;
  readonly employeeId: string;
  readonly locale: string;
  readonly runtime: AxisRuntimeConfig;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly routeSchema?: WorkbenchRouteSchemaSelection | undefined;
  readonly site: string;
}

function workbenchRecordKey(
  record: Readonly<Record<string, unknown>>,
  index: number,
): string {
  const identity = record._id ?? record.code;
  return typeof identity === 'string' || typeof identity === 'number'
    ? String(identity)
    : `record-${String(index)}`;
}

function recordWithoutForbiddenFields(
  record: WorkbenchRecord,
  forbiddenFields: readonly string[],
): WorkbenchRecord {
  if (forbiddenFields.length === 0) return record;
  const forbidden = new Set(forbiddenFields);
  return Object.fromEntries(
    Object.entries(record).filter(([fieldName]) => !forbidden.has(fieldName)),
  );
}

function workbenchConnectionModuleName(schema: WorkbenchSchema): string {
  return schema.connectionModuleName ?? schema.moduleName;
}

function selectWorkbenchSchemaConnection(
  bootstrap: AxisAuthenticatedBootstrap,
  schema: WorkbenchSchema,
): AxisModuleConnection | undefined {
  const moduleName = workbenchConnectionModuleName(schema);
  const connections = bootstrap.moduleConnections[moduleName] ?? [];
  return (
    connections.find(
      (connection) =>
        schema.connectionInstanceId !== undefined &&
        connection.instanceId === schema.connectionInstanceId,
    ) ?? selectModuleConnection(bootstrap, moduleName)
  );
}

interface OpenedReferenceRecord {
  readonly record: WorkbenchRecord;
  readonly reference: string;
  readonly relationship: WorkbenchRelationship;
  readonly schema: WorkbenchSchema;
}

export function WorkbenchRoutePage(props: WorkbenchRoutePageProps) {
  const location = useLocation();
  const [selectedSchema, setSelectedSchema] = useState<WorkbenchSchema>();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<Readonly<Record<string, unknown>>>();
  const [openedReferenceRecord, setOpenedReferenceRecord] =
    useState<OpenedReferenceRecord>();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [recordSearchInput, setRecordSearchInput] = useState('');
  const [recordSearch, setRecordSearch] = useState('');
  const [recordFilters, setRecordFilters] = useState<WorkbenchFilterGroup>();
  const [recordPageNumber, setRecordPageNumber] = useState(1);
  const [recordPageSize, setRecordPageSize] = useState(25);
  const [recordSortOverride, setRecordSortOverride] = useState<AxisSort>();
  const preferenceScope = useMemo(
    () => ({
      employeeId: props.employeeId,
      tenantCode: props.bootstrap.tenantCode,
      enterpriseCode: props.runtime.enterpriseCode,
    }),
    [props.bootstrap.tenantCode, props.employeeId, props.runtime.enterpriseCode],
  );
  const [preferences, setPreferences] = useState<WorkbenchPreferences>(() =>
    loadWorkbenchPreferences(preferenceScope),
  );
  const [visibleColumns, setVisibleColumns] = useState<readonly string[]>([]);
  const [selectedRecordKeys, setSelectedRecordKeys] = useState<readonly string[]>([]);
  const consumedDeepLinkKey = useRef<string | undefined>(undefined);
  const queryClient = useQueryClient();
  const updatePreferences = useCallback(
    (next: WorkbenchPreferences) => {
      setPreferences(next);
      saveWorkbenchPreferences(preferenceScope, next);
    },
    [preferenceScope],
  );
  const configuration = useMemo(
    () => ({
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      timeoutMs: props.runtime.requestTimeoutMs,
    }),
    [props.accessToken, props.runtime.enterpriseCode, props.runtime.requestTimeoutMs],
  );
  const connections = useMemo(() => {
    const allConnections = Object.values(props.bootstrap.moduleConnections).flatMap(
      (moduleConnections) => [...moduleConnections],
    );
    if (!props.routeSchema) return allConnections;
    const ownerConnections =
      props.bootstrap.moduleConnections[props.routeSchema.moduleName] ?? [];
    return ownerConnections.length > 0 ? [...ownerConnections] : allConnections;
  }, [props.bootstrap, props.routeSchema]);
  const connectionKey = useMemo(
    () =>
      connections
        .map(
          (connection) =>
            `${connection.moduleName}:${connection.instanceId}:${connection.endpoint}:${connection.state}`,
        )
        .sort()
        .join('|'),
    [connections],
  );
  const schemas = useQuery({
    queryKey: [
      'schema-workbench',
      'schemas',
      props.runtime.enterpriseCode,
      connectionKey,
    ],
    queryFn: () => loadWorkbenchSchemas(connections, configuration),
  });
  const normalizedSelectedSchema = selectedSchema
    ? schemaWithValidQueryCapabilities(selectedSchema)
    : undefined;
  const fixedRecordFilters = normalizedSelectedSchema
    ? workbenchFixedFilterGroup(
        normalizedSelectedSchema,
        workbenchPresentationForSchema(props.routeNavigation, normalizedSelectedSchema),
      )
    : undefined;
  const effectiveRecordFilters = combineWorkbenchFilterGroups(
    fixedRecordFilters,
    recordFilters,
  );
  const recordConnection = normalizedSelectedSchema
    ? selectWorkbenchSchemaConnection(props.bootstrap, normalizedSelectedSchema)
    : undefined;
  const routeOwnerConnection = props.routeNavigation
    ? selectModuleConnection(
        props.bootstrap,
        props.routeSchema?.moduleName ?? props.routeNavigation.moduleName,
      )
    : undefined;
  const routeParentLabel =
    props.routeNavigation?.parentId !== undefined
      ? props.bootstrap.navigation.find(
          (item) =>
            item.moduleName ===
              (props.routeNavigation?.parentModuleName ??
                props.routeNavigation?.moduleName) &&
            item.id === props.routeNavigation?.parentId,
        )?.label
      : undefined;
  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      setRecordSearch(recordSearchInput.trim());
      setRecordPageNumber(1);
    }, 300);
    return () => globalThis.clearTimeout(timeout);
  }, [recordSearchInput]);
  const effectiveRecordSort = resolveWorkbenchRecordSort(
    normalizedSelectedSchema,
    recordSortOverride,
  );
  const records = useQuery({
    enabled: Boolean(
      normalizedSelectedSchema && recordConnection && !createOpen && !editOpen,
    ),
    queryKey: [
      'schema-workbench',
      'records',
      props.runtime.enterpriseCode,
      recordConnection?.instanceId,
      recordConnection?.endpoint,
      normalizedSelectedSchema?.moduleName,
      normalizedSelectedSchema?.schemaName,
      recordSearch,
      JSON.stringify(effectiveRecordFilters ?? null),
      recordPageNumber,
      recordPageSize,
      effectiveRecordSort.field,
      effectiveRecordSort.direction,
    ],
    queryFn: ({ signal }) => {
      if (!normalizedSelectedSchema || !recordConnection) {
        throw new Error('The selected schema module is unavailable');
      }
      return loadWorkbenchRecords(
        recordConnection,
        normalizedSelectedSchema,
        configuration,
        {
          search: recordSearch,
          ...(effectiveRecordFilters ? { filters: effectiveRecordFilters } : {}),
          pageNumber: recordPageNumber,
          pageSize: recordPageSize,
          sort: effectiveRecordSort,
        },
        fetch,
        signal,
      );
    },
  });
  const detailPanelQueryInputs = useMemo(
    () =>
      (props.routeNavigation?.detailPanels ?? []).map((panel) => {
        const schema = (schemas.data ?? []).find(
          (candidate) =>
            candidate.moduleName === panel.target.moduleName &&
            candidate.schemaName === panel.target.schemaName,
        );
        const normalizedSchema = schema
          ? schemaWithValidQueryCapabilities(schema)
          : undefined;
        const connection = normalizedSchema
          ? selectWorkbenchSchemaConnection(props.bootstrap, normalizedSchema)
          : undefined;
        const filters = relatedRecordPanelFilter(selectedRecord, panel);
        const enabled = Boolean(
          selectedRecord &&
          normalizedSchema &&
          connection &&
          (!panel.relation || filters),
        );
        return Object.freeze({
          panel,
          schema: normalizedSchema,
          connection,
          filters,
          enabled,
        });
      }),
    [
      props.bootstrap,
      props.routeNavigation?.detailPanels,
      schemas.data,
      selectedRecord,
    ],
  );
  const detailPanelQueries = useQueries({
    queries: detailPanelQueryInputs.map((input) => ({
      enabled: input.enabled,
      queryKey: [
        'schema-workbench',
        'related-records',
        props.runtime.enterpriseCode,
        input.panel.id,
        input.connection?.instanceId,
        input.connection?.endpoint,
        input.schema?.moduleName,
        input.schema?.schemaName,
        JSON.stringify(input.filters ?? null),
      ],
      queryFn: ({ signal }) => {
        if (!input.schema || !input.connection) {
          throw new Error('The related schema module is unavailable');
        }
        return loadWorkbenchRecords(
          input.connection,
          input.schema,
          configuration,
          {
            search: '',
            ...(input.filters ? { filters: input.filters } : {}),
            pageNumber: 1,
            pageSize: Math.min(input.schema.queryCapabilities.defaultPageSize, 10),
            sort: resolveWorkbenchRecordSort(input.schema, undefined),
          },
          fetch,
          signal,
        );
      },
    })),
  });
  const selectedRecordDetailPanels: readonly WorkbenchRecordDetailPanel[] = useMemo(
    () =>
      detailPanelQueryInputs.map((input, index) => {
        const query = detailPanelQueries[index];
        return Object.freeze({
          panel: input.panel,
          schema: input.schema,
          page: query?.data,
          loading: Boolean(query?.isLoading || query?.isFetching),
          error:
            query?.error instanceof Error
              ? query.error.message
              : input.enabled
                ? undefined
                : input.schema
                  ? undefined
                  : 'The related schema is not available',
        });
      }),
    [detailPanelQueries, detailPanelQueryInputs],
  );
  const createRecord = useMutation({
    mutationFn: (model: Readonly<Record<string, unknown>>) => {
      if (!normalizedSelectedSchema || !recordConnection) {
        throw new Error('The selected schema module is unavailable');
      }
      return createWorkbenchRecord(
        recordConnection,
        normalizedSelectedSchema,
        model,
        configuration,
      );
    },
    onSuccess: async () => {
      setCreateOpen(false);
      await queryClient.invalidateQueries({
        queryKey: [
          'schema-workbench',
          'records',
          props.runtime.enterpriseCode,
          normalizedSelectedSchema?.moduleName,
          normalizedSelectedSchema?.schemaName,
        ],
      });
    },
  });
  const updateRecord = useMutation({
    mutationFn: (model: Readonly<Record<string, unknown>>) => {
      if (!normalizedSelectedSchema || !recordConnection || !selectedRecord) {
        throw new Error('The selected schema module is unavailable');
      }
      return updateWorkbenchRecord(
        recordConnection,
        normalizedSelectedSchema,
        selectedRecord,
        model,
        configuration,
      );
    },
    onSuccess: async (updated) => {
      setSelectedRecord(updated);
      setEditOpen(false);
      await queryClient.invalidateQueries({
        queryKey: [
          'schema-workbench',
          'records',
          props.runtime.enterpriseCode,
          normalizedSelectedSchema?.moduleName,
          normalizedSelectedSchema?.schemaName,
        ],
      });
    },
  });
  const deleteRecord = useMutation({
    mutationFn: () => {
      if (!normalizedSelectedSchema || !recordConnection || !selectedRecord) {
        throw new Error('The selected schema module is unavailable');
      }
      return deleteWorkbenchRecord(
        recordConnection,
        normalizedSelectedSchema,
        selectedRecord,
        configuration,
        `axis-${crypto.randomUUID()}`,
      );
    },
    onSuccess: async () => {
      setDeleteOpen(false);
      setEditOpen(false);
      setSelectedRecord(undefined);
      await queryClient.invalidateQueries({
        queryKey: [
          'schema-workbench',
          'records',
          props.runtime.enterpriseCode,
          normalizedSelectedSchema?.moduleName,
          normalizedSelectedSchema?.schemaName,
        ],
      });
    },
  });
  const deleteImpact = useMutation({
    mutationFn: () => {
      if (!normalizedSelectedSchema || !recordConnection || !selectedRecord) {
        throw new Error('The selected schema module is unavailable');
      }
      return previewWorkbenchDeleteImpact(
        recordConnection,
        normalizedSelectedSchema,
        selectedRecord,
        configuration,
      );
    },
    onSuccess: () => setDeleteOpen(true),
  });
  const bulkDelete = useMutation({
    mutationFn: () => {
      if (!normalizedSelectedSchema || !recordConnection) {
        throw new Error('The selected schema module is unavailable');
      }
      const selected = (records.data?.records ?? []).filter((record, index) =>
        selectedRecordKeys.includes(workbenchRecordKey(record, index)),
      );
      return bulkDeleteWorkbenchRecords(
        recordConnection,
        normalizedSelectedSchema,
        selected,
        configuration,
        `axis-${crypto.randomUUID()}`,
      );
    },
    onSuccess: async () => {
      setSelectedRecordKeys([]);
      await queryClient.invalidateQueries({
        queryKey: [
          'schema-workbench',
          'records',
          props.runtime.enterpriseCode,
          normalizedSelectedSchema?.moduleName,
          normalizedSelectedSchema?.schemaName,
        ],
      });
    },
  });
  const lifecycleAction = useMutation({
    mutationFn: async ({
      action,
      record,
      input,
    }: {
      readonly action: AxisNavigationLifecycleAction;
      readonly record: WorkbenchRecord;
      readonly input?: Readonly<Record<string, string>> | undefined;
    }) => {
      if (!normalizedSelectedSchema || !recordConnection) {
        throw new Error('Select a schema before executing a lifecycle action');
      }
      const presentation = workbenchPresentationForSchema(
        props.routeNavigation,
        normalizedSelectedSchema,
      );
      const actionConnection = action.ownerModule
        ? selectModuleConnection(props.bootstrap, action.ownerModule)
        : recordConnection;
      if (!actionConnection) {
        throw new Error('Lifecycle action owner module is unavailable');
      }
      return executeWorkbenchLifecycleAction(
        actionConnection,
        normalizedSelectedSchema,
        action,
        recordWithoutForbiddenFields(
          record,
          workbenchPresentationForbiddenFields(presentation),
        ),
        configuration,
        `${props.employeeId}:${normalizedSelectedSchema.moduleName}:${normalizedSelectedSchema.schemaName}:${action.id}:${crypto.randomUUID()}`,
        input,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [
          'workbench-records',
          recordConnection?.endpoint,
          normalizedSelectedSchema?.moduleName,
          normalizedSelectedSchema?.schemaName,
        ],
      });
    },
  });
  const selectWorkbenchSchema = useCallback(
    (schema: WorkbenchSchema, options: { readonly openCreate?: boolean } = {}) => {
      const normalizedSchema = schemaWithValidQueryCapabilities(schema);
      createRecord.reset();
      updateRecord.reset();
      deleteRecord.reset();
      deleteImpact.reset();
      bulkDelete.reset();
      lifecycleAction.reset();
      setCreateOpen(Boolean(options.openCreate));
      setEditOpen(false);
      setSelectedRecord(undefined);
      setOpenedReferenceRecord(undefined);
      setDeleteOpen(false);
      setRecordSearchInput('');
      setRecordSearch('');
      setRecordFilters(undefined);
      setRecordPageNumber(1);
      setRecordPageSize(normalizedSchema.queryCapabilities.defaultPageSize);
      setRecordSortOverride(undefined);
      const key = schemaPreferenceKey(
        normalizedSchema.moduleName,
        normalizedSchema.schemaName,
      );
      const schemaPreference = preferences.schemaPreferences[key];
      const defaultColumns = resolveWorkbenchDefaultColumns(
        normalizedSchema,
        workbenchPresentationForSchema(props.routeNavigation, normalizedSchema),
      );
      setVisibleColumns(
        schemaPreference?.visibleColumns.length
          ? schemaPreference.visibleColumns
          : defaultColumns,
      );
      setSelectedRecordKeys([]);
      updatePreferences({
        ...preferences,
        recentSchemas: Object.freeze(
          [key, ...preferences.recentSchemas.filter((item) => item !== key)].slice(
            0,
            10,
          ),
        ),
      });
      setSelectedSchema(normalizedSchema);
    },
    [
      bulkDelete,
      createRecord,
      deleteImpact,
      deleteRecord,
      preferences,
      props.routeNavigation,
      updatePreferences,
      updateRecord,
      lifecycleAction,
    ],
  );
  const deepLinkTarget = useMemo(() => {
    const routeScopeKey = props.routeNavigation
      ? JSON.stringify({
          id: props.routeNavigation.id,
          route: props.routeNavigation.route,
          moduleName: props.routeNavigation.moduleName,
          target: props.routeNavigation.workbenchTarget,
          fixedFilters: props.routeNavigation.workbenchPresentation?.fixedFilters ?? [],
        })
      : undefined;
    return (
      resolveWorkbenchDeepLinkTarget(location.search, schemas.data ?? []) ??
      resolveWorkbenchRouteTarget(
        props.routeSchema,
        schemas.data ?? [],
        {
          environment: routeOwnerConnection?.environment,
          server: routeOwnerConnection?.server,
        },
        routeScopeKey,
      )
    );
  }, [
    location.search,
    props.routeNavigation,
    props.routeSchema,
    routeOwnerConnection?.environment,
    routeOwnerConnection?.server,
    schemas.data,
  ]);
  useEffect(() => {
    if (!deepLinkTarget || consumedDeepLinkKey.current === deepLinkTarget.key) return;
    const timeout = globalThis.setTimeout(() => {
      consumedDeepLinkKey.current = deepLinkTarget.key;
      selectWorkbenchSchema(deepLinkTarget.schema, {
        openCreate: deepLinkTarget.mode === 'create',
      });
    }, 0);
    return () => globalThis.clearTimeout(timeout);
  }, [deepLinkTarget, selectWorkbenchSchema]);
  useEffect(() => {
    if (!props.routeSchema || schemas.isLoading || deepLinkTarget) return;
    const timeout = globalThis.setTimeout(() => {
      consumedDeepLinkKey.current = undefined;
      setSelectedSchema(undefined);
      setSelectedRecordKeys(Object.freeze([]));
    }, 0);
    return () => globalThis.clearTimeout(timeout);
  }, [deepLinkTarget, props.routeSchema, schemas.isLoading]);
  const relationshipRuntime = useMemo(
    () => ({
      schemas: schemas.data ?? [],
      queryScope: [props.runtime.enterpriseCode],
      createRecord: (
        schema: WorkbenchSchema,
        model: Readonly<Record<string, unknown>>,
      ) => {
        const normalizedSchema = schemaWithValidQueryCapabilities(schema);
        const connection = selectWorkbenchSchemaConnection(
          props.bootstrap,
          normalizedSchema,
        );
        if (!connection) {
          return Promise.reject(new Error('The related schema module is unavailable'));
        }
        return createWorkbenchRecord(
          connection,
          normalizedSchema,
          model,
          configuration,
        );
      },
      loadRecords: (
        schema: WorkbenchSchema,
        options?: WorkbenchRelationshipLoadOptions,
      ) => {
        const normalizedSchema = schemaWithValidQueryCapabilities(schema);
        const connection = selectWorkbenchSchemaConnection(
          props.bootstrap,
          normalizedSchema,
        );
        if (!connection) {
          return Promise.reject(new Error('The related schema module is unavailable'));
        }
        return loadWorkbenchRecords(connection, normalizedSchema, configuration, {
          search: options?.search ?? '',
          filters: options?.filters,
          pageNumber: options?.pageNumber ?? 1,
          pageSize:
            options?.pageSize ?? resolveWorkbenchLookupPageSize(normalizedSchema),
          sort: resolveWorkbenchRecordSort(normalizedSchema, undefined),
        });
      },
      resolveRecord: async (relationship: WorkbenchRelationship, reference: string) => {
        const schema = (schemas.data ?? []).find(
          (candidate) =>
            candidate.moduleName === relationship.targetModule &&
            candidate.schemaName === relationship.targetSchema,
        );
        if (!schema) return undefined;
        const normalizedSchema = schemaWithValidQueryCapabilities(schema);
        const connection = selectWorkbenchSchemaConnection(
          props.bootstrap,
          normalizedSchema,
        );
        if (!connection) {
          throw new Error('The related schema module is unavailable');
        }
        const page = await loadWorkbenchRecords(
          connection,
          normalizedSchema,
          configuration,
          workbenchReferenceLookupQuery(normalizedSchema, relationship, reference),
        );
        const record = selectWorkbenchReferencedRecord(
          page.records,
          relationship.referenceProperty,
          reference,
        );
        return record ? { record, schema: normalizedSchema } : undefined;
      },
      updateRecord: (
        schema: WorkbenchSchema,
        original: Readonly<Record<string, unknown>>,
        model: Readonly<Record<string, unknown>>,
      ) => {
        const normalizedSchema = schemaWithValidQueryCapabilities(schema);
        const connection = selectWorkbenchSchemaConnection(
          props.bootstrap,
          normalizedSchema,
        );
        if (!connection) {
          return Promise.reject(new Error('The related schema module is unavailable'));
        }
        return updateWorkbenchRecord(
          connection,
          normalizedSchema,
          original,
          model,
          configuration,
        );
      },
    }),
    [configuration, props.bootstrap, props.runtime.enterpriseCode, schemas.data],
  );
  const openReferenceRecord = useCallback(
    async (relationship: WorkbenchRelationship, reference: string) => {
      if (!relationshipRuntime.resolveRecord) {
        throw new Error('Referenced records are not available');
      }
      const result = await relationshipRuntime.resolveRecord(relationship, reference);
      if (!result) {
        throw new Error('Referenced record was not found or is not authorized');
      }
      updateRecord.reset();
      deleteRecord.reset();
      deleteImpact.reset();
      lifecycleAction.reset();
      setEditOpen(false);
      setDeleteOpen(false);
      setOpenedReferenceRecord({
        record: result.record,
        reference,
        relationship,
        schema: result.schema,
      });
    },
    [deleteImpact, deleteRecord, lifecycleAction, relationshipRuntime, updateRecord],
  );

  return (
    <CmsRoutePage
      accessToken={props.accessToken}
      actions={{
        workbench: {
          accessToken: props.accessToken,
          bootstrap: props.bootstrap,
          runtime: props.runtime,
          scope: props.routeSchema
            ? {
                kind: 'navigation',
                navigationId: props.routeNavigation?.id,
                label: props.routeNavigation?.label,
                parentLabel: routeParentLabel,
                help: props.routeNavigation?.help,
                detailPanels: props.routeNavigation?.detailPanels,
                lifecycleActions: props.routeNavigation?.lifecycleActions,
                workbenchPresentation: normalizedSelectedSchema
                  ? workbenchPresentationForSchema(
                      props.routeNavigation,
                      normalizedSelectedSchema,
                    )
                  : undefined,
              }
            : { kind: 'global' },
          schemas: schemas.data ?? [],
          schemasError: schemas.error?.message,
          schemasLoading: schemas.isLoading,
          selectedSchema: normalizedSelectedSchema,
          records: records.data?.records ?? [],
          recordSearch: recordSearchInput,
          recordFilters,
          recordPageNumber,
          recordPageSize,
          recordTotalCount: records.data?.totalCount ?? 0,
          recordSort: effectiveRecordSort,
          recordSortOverride,
          visibleColumns,
          favoriteSchemas: preferences.favoriteSchemas,
          recentSchemas: preferences.recentSchemas,
          selectedRecordKeys,
          savedViews: selectedSchema
            ? (preferences.schemaPreferences[
                schemaPreferenceKey(
                  selectedSchema.moduleName,
                  selectedSchema.schemaName,
                )
              ]?.savedViews ?? [])
            : [],
          recordsError: records.error?.message,
          recordsLoading: records.isLoading,
          createError: createRecord.error?.message,
          creating: createRecord.isPending,
          createOpen,
          relationshipRuntime,
          openedReferenceRecord,
          selectedRecord,
          selectedRecordDetailPanels,
          editOpen,
          updateError: updateRecord.error?.message,
          updating: updateRecord.isPending,
          deleteOpen,
          deleteError: deleteRecord.error?.message ?? deleteImpact.error?.message,
          deleting: deleteRecord.isPending,
          deleteImpact: deleteImpact.data,
          deleteImpactLoading: deleteImpact.isPending,
          bulkDeleteError: bulkDelete.error?.message,
          bulkDeleting: bulkDelete.isPending,
          lifecycleActionError: lifecycleAction.error?.message,
          lifecycleActionPendingId: lifecycleAction.variables?.action.id,
          lifecycleActionResult: lifecycleAction.data,
          tenantCode: props.bootstrap.tenantCode,
          enterpriseCode: props.runtime.enterpriseCode,
          locale: props.locale,
          selectSchema: selectWorkbenchSchema,
          setRecordSearch: setRecordSearchInput,
          setRecordFilters: (filters) => {
            setRecordPageNumber(1);
            setRecordFilters(filters);
          },
          setRecordPageNumber,
          setRecordPageSize: (pageSize) => {
            setRecordPageNumber(1);
            setRecordPageSize(pageSize);
          },
          setRecordSort: (sort) => {
            setRecordPageNumber(1);
            setRecordSortOverride(sort);
          },
          setRecordSortOverride: (sort) => {
            setRecordPageNumber(1);
            setRecordSortOverride(sort);
          },
          setVisibleColumns: (columns) => {
            if (!selectedSchema) return;
            const key = schemaPreferenceKey(
              selectedSchema.moduleName,
              selectedSchema.schemaName,
            );
            setVisibleColumns(Object.freeze([...columns]));
            updatePreferences({
              ...preferences,
              schemaPreferences: {
                ...preferences.schemaPreferences,
                [key]: {
                  visibleColumns: Object.freeze([...columns]),
                  savedViews:
                    preferences.schemaPreferences[key]?.savedViews ?? Object.freeze([]),
                },
              },
            });
          },
          toggleFavoriteSchema: (schema) => {
            const key = schemaPreferenceKey(schema.moduleName, schema.schemaName);
            const exists = preferences.favoriteSchemas.includes(key);
            updatePreferences({
              ...preferences,
              favoriteSchemas: Object.freeze(
                exists
                  ? preferences.favoriteSchemas.filter((item) => item !== key)
                  : [key, ...preferences.favoriteSchemas].slice(0, 50),
              ),
            });
          },
          setSelectedRecordKeys: (keys) =>
            setSelectedRecordKeys(Object.freeze([...new Set(keys)])),
          saveView: (view) => {
            if (!selectedSchema) return;
            const key = schemaPreferenceKey(
              selectedSchema.moduleName,
              selectedSchema.schemaName,
            );
            const current = preferences.schemaPreferences[key];
            updatePreferences({
              ...preferences,
              schemaPreferences: {
                ...preferences.schemaPreferences,
                [key]: {
                  visibleColumns,
                  savedViews: Object.freeze(
                    [
                      view,
                      ...(current?.savedViews ?? []).filter(
                        (candidate) => candidate.name !== view.name,
                      ),
                    ].slice(0, 10),
                  ),
                },
              },
            });
          },
          deleteView: (name) => {
            if (!selectedSchema) return;
            const key = schemaPreferenceKey(
              selectedSchema.moduleName,
              selectedSchema.schemaName,
            );
            const current = preferences.schemaPreferences[key];
            updatePreferences({
              ...preferences,
              schemaPreferences: {
                ...preferences.schemaPreferences,
                [key]: {
                  visibleColumns,
                  savedViews: Object.freeze(
                    (current?.savedViews ?? []).filter(
                      (candidate) => candidate.name !== name,
                    ),
                  ),
                },
              },
            });
          },
          applyView: (view: WorkbenchSavedView) => {
            setRecordSearchInput(view.search);
            setRecordSearch(view.search);
            setRecordFilters(view.filters);
            setRecordPageNumber(1);
            setRecordPageSize(view.pageSize);
            setRecordSortOverride(view.sort);
            setVisibleColumns(view.visibleColumns);
            setSelectedRecordKeys([]);
          },
          beginCreate: () => {
            createRecord.reset();
            setCreateOpen(true);
          },
          cancelCreate: () => {
            createRecord.reset();
            setCreateOpen(false);
          },
          createRecord: (model) =>
            createRecord.mutateAsync(model).then(() => undefined),
          openReferenceRecord,
          closeReferenceRecord: () => setOpenedReferenceRecord(undefined),
          selectRecord: (record) => {
            updateRecord.reset();
            deleteRecord.reset();
            lifecycleAction.reset();
            setEditOpen(false);
            setOpenedReferenceRecord(undefined);
            setSelectedRecord(record);
            setDeleteOpen(false);
          },
          closeRecord: () => {
            updateRecord.reset();
            deleteRecord.reset();
            lifecycleAction.reset();
            setEditOpen(false);
            setSelectedRecord(undefined);
            setOpenedReferenceRecord(undefined);
            setDeleteOpen(false);
          },
          beginEdit: () => {
            updateRecord.reset();
            lifecycleAction.reset();
            setEditOpen(true);
          },
          cancelEdit: () => {
            updateRecord.reset();
            setEditOpen(false);
          },
          updateRecord: (model) =>
            updateRecord.mutateAsync(model).then(() => undefined),
          beginDelete: () => {
            deleteRecord.reset();
            deleteImpact.reset();
            setDeleteOpen(true);
            deleteImpact.mutate();
          },
          cancelDelete: () => {
            deleteRecord.reset();
            setDeleteOpen(false);
          },
          confirmDelete: () => deleteRecord.mutateAsync().then(() => undefined),
          bulkDeleteSelected: () => bulkDelete.mutateAsync().then(() => undefined),
          executeLifecycleAction: (action, record, input) =>
            lifecycleAction.mutateAsync({ action, record, input }),
          retryRecords: () => void records.refetch(),
          retrySchemas: () => void schemas.refetch(),
        },
      }}
      channel={props.channel}
      cmsBaseUrl={props.cmsBaseUrl}
      enterpriseCode={props.runtime.enterpriseCode}
      locale={props.locale}
      path="/schema-workbench"
      site={props.site}
      timeoutMs={props.runtime.requestTimeoutMs}
    />
  );
}
