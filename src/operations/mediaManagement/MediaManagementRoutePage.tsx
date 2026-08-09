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
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { type AxisDataListingColumn } from '../../app/table/AxisDataListing';
import {
  AxisSchemaDataListing,
  type AxisSchemaFieldRenderer,
} from '../../app/table/AxisSchemaDataListing';
import type { AxisSort } from '../../app/table/axisTableSorting';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  createWorkbenchRecord,
  deleteWorkbenchRecord,
  loadWorkbenchRecords,
  loadWorkbenchSchemas,
  updateWorkbenchRecord,
  type WorkbenchClientConfiguration,
} from '../../workbench/api/workbenchClient';
import type {
  WorkbenchFilterCondition,
  WorkbenchFilterGroup,
  WorkbenchRecord,
  WorkbenchRecordQuery,
  WorkbenchSchema,
} from '../../workbench/api/workbenchContracts';
import { WorkbenchRecordForm } from '../../workbench/form/WorkbenchRecordForm';
import {
  loadMediaSourceContexts,
  loadMediaFolderUploadPolicies,
  loadMediaStorageProviderSummary,
  removeMediaSetEntry,
  reorderMediaSetEntries,
  setPrimaryMediaSetEntry,
  type MediaFolderUploadPolicy,
  type MediaStorageProviderSummary,
  type MediaSourceContext,
  type MediaUploadResult,
} from './api/mediaStoragePolicyClient';
import { loadImportHistoryForMediaCode } from '../importExport/api/dataReleaseClient';
import type { ImportRunSummary } from '../importExport/api/dataReleaseContracts';
import { MediaFolderPolicyActionsPanel } from './components/folders/MediaFolderPolicyActionsPanel';
import { MediaFolderPolicyImpactPanel } from './components/folders/MediaFolderPolicyImpactPanel';
import { formatRetentionDays } from './components/folders/mediaFolderDetails';
import {
  MediaMetadataViewer,
  type MediaMetadataField,
} from './components/MediaMetadataViewer';
import { MediaPreview } from './components/MediaPreview';
import { MediaUploadWizard } from './components/MediaUploadWizard';
import {
  formatBytes,
  humanize,
  numberValue,
  recordNameOrCodeSummary,
  textValue,
} from './mediaRecordValues';
import {
  folderCodesForSourceType,
  folderUploadPoliciesFromContexts,
  governedMediaSourceTypes,
  mediaFormatLabel,
  mediaSourceTypesForContexts,
  mediaSourceType,
} from './mediaSourceContextPolicy';
import {
  mediaLifecycleActionPolicies,
  mediaLifecycleStatusTone,
  normalizeMediaLifecycleStatus,
} from './mediaLifecyclePolicy';

export interface MediaManagementRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly mediaDetailPresentation?: MediaDetailPresentation | undefined;
  readonly runtime: AxisRuntimeConfig;
}

export type MediaDetailSection =
  | 'actions'
  | 'preview'
  | 'usage'
  | 'importExport'
  | 'metadata';

export interface MediaDetailPresentation {
  readonly detailSections?: readonly MediaDetailSection[] | undefined;
  readonly metadataFields?: readonly MediaMetadataField[] | undefined;
}

type MediaRecordCrudMode = 'create' | 'delete' | 'edit' | 'none';

const defaultMediaDetailSections: readonly MediaDetailSection[] = Object.freeze([
  'actions',
  'preview',
  'usage',
  'importExport',
  'metadata',
]);

interface MediaRecordColumn {
  readonly label: string;
  readonly field: string;
  readonly minWidth?: number | undefined;
  readonly render: (
    record: WorkbenchRecord,
    contexts?: readonly MediaSourceContext[],
  ) => ReactNode;
  readonly exportValue?: (
    record: WorkbenchRecord,
    contexts?: readonly MediaSourceContext[],
  ) => string;
}

interface MediaRecordWorkspaceConfiguration {
  readonly schemaName: string;
  readonly title: string;
  readonly description: string;
  readonly recordCountLabel: string;
  readonly searchPlaceholder: string;
  readonly emptyMessage: string;
  readonly detailEmptyMessage: string;
  readonly hiddenPathNotice?: string;
  readonly searchKeys: readonly string[];
  readonly columns: readonly MediaRecordColumn[];
  readonly details: readonly MediaMetadataField[];
  readonly summary: (record: WorkbenchRecord) => string;
}

interface MediaRecordFacetFilter {
  readonly allLabel: string;
  readonly key: string;
  readonly label: string;
  readonly optionLabel?: (value: string) => string;
  readonly staticOptions?: readonly string[];
  readonly value: (
    record: WorkbenchRecord,
    contexts?: readonly MediaSourceContext[],
  ) => string;
}

const sectionSummaries: Readonly<Record<string, string>> = Object.freeze({
  'media-management':
    'Governed entry point for media files, folders, formats, usage, and storage delivery policy.',
  media:
    'Search, inspect, and govern uploaded media records without exposing raw storage paths to the browser.',
  'media-folders':
    'Manage purpose-based media folders such as imports, content assets, product assets, and utilities.',
  'media-sets':
    'Group related media variants, such as product galleries or responsive CMS image sets.',
  'media-formats':
    'Define reusable presentation formats such as thumbnail, desktop, mobile, zoom, or import file.',
  'media-usage':
    'Review which product, content, import, or business records are using a media item.',
  'storage-delivery':
    'Inspect backend-published folder upload policy and delivery behavior for the active runtime.',
});

function validEnterpriseCode(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(value.trim());
}

function findCurrentItem(
  items: readonly AxisNavigationItem[],
  pathname: string,
): AxisNavigationItem | undefined {
  return (
    [...items]
      .sort((left, right) => right.route.length - left.route.length)
      .find(
        (item) => pathname === item.route || pathname.startsWith(`${item.route}/`),
      ) ?? items[0]
  );
}

function resolveDeliveryUrl(
  connection: ReturnType<typeof selectModuleConnection>,
  record: WorkbenchRecord,
): string | undefined {
  const accessUrl = record.accessUrl ?? record.url;
  if (typeof accessUrl === 'string' && accessUrl.trim()) {
    if (/^https?:\/\//i.test(accessUrl)) return accessUrl;
    if (connection) {
      const endpoint = new URL(connection.endpoint);
      return new URL(accessUrl, endpoint.origin).toString();
    }
    return accessUrl;
  }
  const code = record.code;
  if (typeof code !== 'string' || !code.trim() || !connection) return undefined;
  return `${connection.endpoint.replace(/\/$/, '')}/v0/content/${encodeURIComponent(code)}`;
}

function resolveDownloadUrl(
  connection: ReturnType<typeof selectModuleConnection>,
  record: WorkbenchRecord,
): string | undefined {
  const code = record.code;
  if (typeof code !== 'string' || !code.trim() || !connection) return undefined;
  return `${connection.endpoint.replace(/\/$/, '')}/v0/download/${encodeURIComponent(code)}`;
}

function contentDispositionFileName(value: string | null): string | undefined {
  if (!value) return undefined;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, ''));
    } catch {
      return utf8[1].trim().replace(/^"|"$/g, '');
    }
  }
  return /filename="?([^";]+)"?/i.exec(value)?.[1]?.trim();
}

function saveBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.rel = 'noreferrer';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function downloadMediaRecord(
  connection: ReturnType<typeof selectModuleConnection>,
  configuration: WorkbenchClientConfiguration,
  record: WorkbenchRecord,
): Promise<string> {
  const downloadUrl = resolveDownloadUrl(connection, record);
  if (!downloadUrl) throw new Error('Media download service is unavailable');
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const response = await fetch(downloadUrl, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: '*/*',
        Authorization: `Bearer ${configuration.accessToken}`,
        'x-enterprise-code': configuration.enterpriseCode,
      },
    });
    if (!response.ok) throw new Error('Media download is unavailable currently');
    const fileName =
      contentDispositionFileName(response.headers.get('content-disposition')) ??
      mediaSummary(record);
    saveBlob(await response.blob(), fileName);
    return fileName;
  } catch (error: unknown) {
    if (controller.signal.aborted) throw new Error('Media download timed out');
    throw error instanceof Error ? error : new Error('Media download failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function buildRecordQuery(
  schema: WorkbenchSchema,
  search: string,
  filters?: WorkbenchFilterGroup,
  pageNumber = 1,
  pageSize = schema.queryCapabilities.defaultPageSize,
  sort: WorkbenchRecordQuery['sort'] = schema.queryCapabilities.defaultSort,
): WorkbenchRecordQuery {
  const normalizedPageSize = Math.min(
    Math.max(1, pageSize),
    schema.queryCapabilities.maximumPageSize,
  );
  return Object.freeze({
    search,
    ...(filters ? { filters } : {}),
    pageNumber: Math.max(1, pageNumber),
    pageSize: normalizedPageSize,
    sort,
  });
}

function buildEqualsFilter(field: string, value: string): WorkbenchFilterGroup {
  return Object.freeze({
    operator: 'AND',
    items: Object.freeze([
      Object.freeze({
        field,
        operator: 'EQUALS',
        value,
      }),
    ]),
  });
}

function supportedFilterOperator(
  schema: WorkbenchSchema,
  field: string,
  operator: WorkbenchFilterCondition['operator'],
): boolean {
  return Boolean(
    schema.queryCapabilities.filterFields
      .find((filterField) => filterField.field === field)
      ?.operators.includes(operator),
  );
}

function conditionFilter(condition: WorkbenchFilterCondition): WorkbenchFilterGroup {
  return Object.freeze({
    operator: 'AND',
    items: Object.freeze([Object.freeze(condition)]),
  });
}

function buildInOrEqualsFilter(
  schema: WorkbenchSchema,
  field: string,
  values: readonly string[],
): WorkbenchFilterGroup | undefined {
  const normalizedValues = uniqueSorted(
    values.map((value) => value.trim()).filter(Boolean),
  );
  if (normalizedValues.length === 0) return undefined;
  if (normalizedValues.length > 1 && supportedFilterOperator(schema, field, 'IN')) {
    return conditionFilter({
      field,
      operator: 'IN',
      value: normalizedValues,
    });
  }
  if (supportedFilterOperator(schema, field, 'EQUALS')) {
    if (
      normalizedValues.length > 1 &&
      schema.queryCapabilities.groupOperators.includes('OR')
    ) {
      return Object.freeze({
        operator: 'OR',
        items: Object.freeze(
          normalizedValues.map((value) =>
            Object.freeze({
              field,
              operator: 'EQUALS',
              value,
            }),
          ),
        ),
      });
    }
    return conditionFilter({
      field,
      operator: 'EQUALS',
      value: normalizedValues[0]!,
    });
  }
  return undefined;
}

function isFieldFilterable(schema: WorkbenchSchema, field: string): boolean {
  return (
    supportedFilterOperator(schema, field, 'EQUALS') ||
    supportedFilterOperator(schema, field, 'IN')
  );
}

function facetBackendField(
  itemId: string | undefined,
  filter: MediaRecordFacetFilter,
): string {
  if (itemId === 'media' && filter.key === 'sourceType') return 'folderCode';
  return filter.key;
}

function isFacetFilterQueryable(
  schema: WorkbenchSchema,
  itemId: string | undefined,
  filter: MediaRecordFacetFilter,
): boolean {
  return isFieldFilterable(schema, facetBackendField(itemId, filter));
}

function combineFilters(
  filters: readonly (WorkbenchFilterGroup | undefined)[],
): WorkbenchFilterGroup | undefined {
  const activeFilters = filters.filter((filter): filter is WorkbenchFilterGroup =>
    Boolean(filter && filter.items.length > 0),
  );
  if (activeFilters.length === 0) return undefined;
  if (activeFilters.length === 1) return activeFilters[0];
  return Object.freeze({
    operator: 'AND',
    items: Object.freeze(activeFilters),
  });
}

function buildFacetRecordFilter(
  schema: WorkbenchSchema,
  itemId: string | undefined,
  facetFilters: readonly MediaRecordFacetFilter[],
  selections: Readonly<Record<string, string>>,
  contexts?: readonly MediaSourceContext[],
): WorkbenchFilterGroup | undefined {
  const statePrefix = `${itemId ?? 'none'}:`;
  return combineFilters(
    facetFilters.map((filter) => {
      const selectedValue = selections[`${statePrefix}${filter.key}`] ?? 'ALL';
      if (!selectedValue || selectedValue === 'ALL') return undefined;
      if (itemId === 'media' && filter.key === 'sourceType') {
        return buildInOrEqualsFilter(
          schema,
          'folderCode',
          folderCodesForSourceType(selectedValue, contexts),
        );
      }
      return buildInOrEqualsFilter(schema, filter.key, [selectedValue]);
    }),
  );
}

function recordPageSizeOptions(schema: WorkbenchSchema | undefined): readonly number[] {
  const allowedPageSizes = schema?.queryCapabilities.allowedPageSizes ?? [10, 25, 50];
  const maximumPageSize =
    schema?.queryCapabilities.maximumPageSize ?? Number.MAX_SAFE_INTEGER;
  const boundedPageSizes = allowedPageSizes.filter((size) => size <= maximumPageSize);
  return boundedPageSizes.length ? boundedPageSizes : [10];
}

function mediaSummary(record: WorkbenchRecord): string {
  const original = textValue(record, 'originalFileName');
  if (original !== '—') return original;
  const name = textValue(record, 'name');
  if (name !== '—') return name;
  return textValue(record, 'code');
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() && value !== '—'))].sort(
    (left, right) => left.localeCompare(right),
  );
}

function formatDimensions(record: WorkbenchRecord): string {
  const width = numberValue(record, 'width');
  const height = numberValue(record, 'height');
  if (width === undefined && height === undefined) return '—';
  if (width !== undefined && height !== undefined) return `${width} × ${height} px`;
  if (width !== undefined) return `${width} px wide`;
  return `${height} px high`;
}

function formatContextUsage(context: MediaSourceContext, formatCode: string): string {
  const usage: string[] = [];
  if (context.defaultFormatCode === formatCode) usage.push('default');
  if (context.allowedFormatCodes.includes(formatCode)) usage.push('allowed');
  return usage.length ? usage.join(' + ') : 'referenced';
}

function MediaFormatUsagePanel(props: {
  readonly contexts: readonly MediaSourceContext[] | undefined;
  readonly error: unknown;
  readonly loading: boolean;
  readonly record: WorkbenchRecord;
}) {
  const formatCode = textValue(props.record, 'code');
  const usageContexts = useMemo(
    () =>
      (props.contexts ?? []).filter(
        (context) =>
          context.defaultFormatCode === formatCode ||
          context.allowedFormatCodes.includes(formatCode),
      ),
    [formatCode, props.contexts],
  );

  return (
    <Stack spacing={1.5}>
      <Divider />
      <Typography component="h4" variant="h6">
        Format usage
      </Typography>
      {props.loading ? (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <CircularProgress size={20} />
          <Typography color="text.secondary" variant="body2">
            Loading source contexts for {formatCode}…
          </Typography>
        </Stack>
      ) : props.error ? (
        <Alert severity="warning">
          {props.error instanceof Error
            ? props.error.message
            : 'Media source contexts are unavailable.'}
        </Alert>
      ) : usageContexts.length === 0 ? (
        <Alert severity="info">
          No backend source context currently advertises {formatCode}. The format can
          still be enabled by customer configuration when a context opts into it.
        </Alert>
      ) : (
        <Stack spacing={1}>
          {usageContexts.map((context) => (
            <Box
              key={context.code}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                p: 1.5,
              }}
            >
              <Stack spacing={0.75}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <Typography sx={{ fontWeight: 700 }}>{context.label}</Typography>
                  <Chip label={formatContextUsage(context, formatCode)} size="small" />
                </Stack>
                <Typography color="text.secondary" variant="body2">
                  Folders: {folderList(context.folderCodes)}
                </Typography>
                {context.description ? (
                  <Typography color="text.secondary" variant="body2">
                    {context.description}
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function MediaSetEntriesPanel(props: {
  readonly configuration: WorkbenchClientConfiguration;
  readonly connection: ReturnType<typeof selectModuleConnection>;
  readonly entries: readonly WorkbenchRecord[];
  readonly error: unknown;
  readonly loading: boolean;
  readonly onChanged: () => void;
  readonly schema: WorkbenchSchema | undefined;
  readonly setCode: string;
}) {
  const [entryColumnKeys, setEntryColumnKeys] = useState<readonly string[]>(
    Object.freeze([]),
  );
  const sortedEntries = useMemo(
    () =>
      [...props.entries].sort((left, right) => {
        const leftPosition = numberValue(left, 'position') ?? Number.MAX_SAFE_INTEGER;
        const rightPosition = numberValue(right, 'position') ?? Number.MAX_SAFE_INTEGER;
        return (
          leftPosition - rightPosition ||
          textValue(left, 'variantRole').localeCompare(
            textValue(right, 'variantRole'),
          ) ||
          textValue(left, 'mediaCode').localeCompare(textValue(right, 'mediaCode'))
        );
      }),
    [props.entries],
  );
  const reorderMutation = useMutation({
    mutationFn: (entryCodes: readonly string[]) =>
      reorderMediaSetEntries(
        props.connection!,
        props.configuration,
        props.setCode,
        entryCodes,
      ),
    onSuccess: () => props.onChanged(),
  });
  const primaryMutation = useMutation({
    mutationFn: (entryCode: string) =>
      setPrimaryMediaSetEntry(props.connection!, props.configuration, {
        mediaSetCode: props.setCode,
        entryCode,
      }),
    onSuccess: () => props.onChanged(),
  });
  const removeMutation = useMutation({
    mutationFn: (entryCode: string) =>
      removeMediaSetEntry(props.connection!, props.configuration, {
        mediaSetCode: props.setCode,
        entryCode,
      }),
    onSuccess: () => props.onChanged(),
  });
  const canOperate =
    Boolean(props.connection) && Boolean(props.schema) && props.setCode !== '—';
  const busy =
    reorderMutation.isPending || primaryMutation.isPending || removeMutation.isPending;
  const operationError =
    reorderMutation.error ?? primaryMutation.error ?? removeMutation.error;
  const moveEntry = useCallback(
    (entryCode: string, direction: -1 | 1) => {
      const index = sortedEntries.findIndex(
        (entry) => textValue(entry, 'code') === entryCode,
      );
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= sortedEntries.length) return;
      const entryCodes = sortedEntries.map((entry) => textValue(entry, 'code'));
      const [entry] = entryCodes.splice(index, 1);
      if (!entry || entry === '—') return;
      entryCodes.splice(nextIndex, 0, entry);
      reorderMutation.mutate(entryCodes);
    },
    [reorderMutation, sortedEntries],
  );
  const entryFieldRenderers = useMemo<
    Readonly<Record<string, AxisSchemaFieldRenderer>>
  >(
    () =>
      Object.freeze({
        deviceCode: Object.freeze({
          label: 'Device',
          render: (entry: WorkbenchRecord) => (
            <>
              {textValue(entry, 'deviceCode')}
              {textValue(entry, 'breakpointCode') !== '—'
                ? ` / ${textValue(entry, 'breakpointCode')}`
                : ''}
            </>
          ),
          exportValue: (entry: WorkbenchRecord) => {
            const device = textValue(entry, 'deviceCode');
            const breakpoint = textValue(entry, 'breakpointCode');
            return breakpoint === '—' ? device : `${device} / ${breakpoint}`;
          },
        }),
        status: Object.freeze({
          render: (entry: WorkbenchRecord) => (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
              <Chip
                color={textValue(entry, 'status') === 'ACTIVE' ? 'success' : 'default'}
                label={textValue(entry, 'status')}
                size="small"
              />
              {entry.primary === true ? (
                <Chip color="primary" label="Primary" size="small" />
              ) : null}
            </Stack>
          ),
          exportValue: (entry: WorkbenchRecord) =>
            entry.primary === true
              ? `${textValue(entry, 'status')} Primary`
              : textValue(entry, 'status'),
        }),
      }),
    [],
  );
  const entryActionColumns = useMemo<readonly AxisDataListingColumn<WorkbenchRecord>[]>(
    () =>
      Object.freeze([
        {
          key: '__actions',
          label: 'Actions',
          exportable: false,
          minWidth: 260,
          render: (entry, index) => {
            const code = textValue(entry, 'code');
            return (
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                <Button
                  disabled={!canOperate || busy || index === 0}
                  size="small"
                  onClick={() => moveEntry(code, -1)}
                >
                  Up
                </Button>
                <Button
                  disabled={!canOperate || busy || index === sortedEntries.length - 1}
                  size="small"
                  onClick={() => moveEntry(code, 1)}
                >
                  Down
                </Button>
                <Button
                  disabled={!canOperate || busy || entry.primary === true}
                  size="small"
                  onClick={() => primaryMutation.mutate(code)}
                >
                  Set primary
                </Button>
                <Button
                  color="warning"
                  disabled={!canOperate || busy}
                  size="small"
                  onClick={() => removeMutation.mutate(code)}
                >
                  Remove
                </Button>
              </Stack>
            );
          },
        },
      ]),
    [
      busy,
      canOperate,
      moveEntry,
      primaryMutation,
      removeMutation,
      sortedEntries.length,
    ],
  );
  const defaultEntryColumnKeys = useMemo(
    () =>
      Object.freeze([
        'position',
        'mediaCode',
        'formatCode',
        'variantRole',
        'localeCode',
        'channelCode',
        'deviceCode',
        'fallbackEntryCode',
        'status',
      ]),
    [],
  );

  return (
    <Stack spacing={1.5}>
      <Divider />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Box>
          <Typography component="h4" variant="h6">
            Set variants
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Media files linked to this set through governed set entries.
          </Typography>
        </Box>
        <Chip label={`${sortedEntries.length} entries`} size="small" />
      </Stack>
      <Alert severity="info">
        nMedia owns variant membership, ordering, primary selection, and fallback
        metadata. Product and CMS modules decide where a media set is used.
      </Alert>

      {!props.schema ? (
        <Alert severity="warning">
          The authorized media set-entry schema is not available for this employee
          session.
        </Alert>
      ) : props.loading ? (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <CircularProgress size={20} />
          <Typography color="text.secondary" variant="body2">
            Loading variants for {props.setCode}…
          </Typography>
        </Stack>
      ) : props.error ? (
        <Alert severity="error">
          {props.error instanceof Error
            ? props.error.message
            : 'Media set variants are unavailable.'}
        </Alert>
      ) : (
        <AxisSchemaDataListing
          ariaLabel="Media set variants"
          columnsLabel="Columns"
          defaultVisibleColumnKeys={defaultEntryColumnKeys}
          emptyMessage="No variants are currently linked to this media set."
          exportFileName={`axis-media-set-${props.setCode}-variants`}
          fieldRenderers={entryFieldRenderers}
          getRowKey={(entry, index) => {
            const code = textValue(entry, 'code');
            return code === '—' ? `media-set-entry-${String(index)}` : code;
          }}
          maxBodyHeight={420}
          minTableWidth={1100}
          records={sortedEntries}
          schema={props.schema}
          size="small"
          toolbarStart={
            <Typography color="text.secondary" variant="body2">
              Variant fields come from the media set-entry backend schema.
            </Typography>
          }
          trailingColumns={entryActionColumns}
          visibleColumnKeys={entryColumnKeys}
          onColumnKeysChange={(columnKeys) =>
            setEntryColumnKeys(Object.freeze([...columnKeys]))
          }
        />
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button
          component={RouterLink}
          to="/schema-workbench?module=media&schema=mediaSetEntry&mode=create"
          variant="outlined"
        >
          Add entry in Schema Workbench
        </Button>
        <Button
          component={RouterLink}
          to="/schema-workbench?module=media&schema=mediaSetEntry"
          variant="text"
        >
          Open all set entries
        </Button>
      </Stack>
      {operationError ? (
        <Alert severity="error">
          {operationError instanceof Error
            ? operationError.message
            : 'Media set entry operation failed.'}
        </Alert>
      ) : null}
    </Stack>
  );
}

function folderList(values: readonly string[]): string {
  return values.length > 0 ? values.join(', ') : 'Any allowed by backend policy';
}

function StorageDeliveryPolicyPanel(props: {
  readonly connectionAvailable: boolean;
  readonly deliveryBaseUrl: string | undefined;
  readonly error: unknown;
  readonly loading: boolean;
  readonly policies: readonly MediaFolderUploadPolicy[];
  readonly providerSummary: MediaStorageProviderSummary | undefined;
  readonly providerSummaryError: unknown;
  readonly providerSummaryLoading: boolean;
}) {
  const providerSummary = props.providerSummary;
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
          >
            <Box>
              <Typography component="h2" variant="h4">
                Storage and delivery policy
              </Typography>
              <Typography color="text.secondary">
                Review upload limits, providers, and delivery endpoint.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip
                color={props.connectionAvailable ? 'success' : 'default'}
                label={
                  props.connectionAvailable
                    ? 'Media service connected'
                    : 'Media service unavailable'
                }
              />
            </Stack>
          </Stack>

          {props.providerSummaryLoading ? (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <CircularProgress size={20} />
              <Typography color="text.secondary" variant="body2">
                Loading provider summary…
              </Typography>
            </Stack>
          ) : props.providerSummaryError ? (
            <Alert severity="warning">
              {props.providerSummaryError instanceof Error
                ? props.providerSummaryError.message
                : 'Media storage provider summary is unavailable.'}
            </Alert>
          ) : providerSummary ? (
            <Box
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                p: 2,
              }}
            >
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
                >
                  <Box>
                    <Typography component="h3" variant="h6">
                      Providers
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Chip
                      color="primary"
                      label={`Active: ${providerSummary.activeProviderCode}`}
                      size="small"
                    />
                    <Chip
                      label={`Key strategy: ${providerSummary.keyStrategyName}`}
                      size="small"
                    />
                    <Chip
                      color={providerSummary.delivery.enabled ? 'success' : 'default'}
                      label={
                        providerSummary.delivery.enabled
                          ? 'Delivery enabled'
                          : 'Delivery disabled'
                      }
                      size="small"
                    />
                  </Stack>
                </Stack>
                <Grid container spacing={1.5}>
                  {providerSummary.providers.map((provider) => (
                    <Grid key={provider.providerCode} size={{ xs: 12, md: 6, xl: 4 }}>
                      <Box
                        sx={{
                          border: 1,
                          borderColor: provider.active ? 'primary.main' : 'divider',
                          borderRadius: 2,
                          height: '100%',
                          p: 1.5,
                        }}
                      >
                        <Stack spacing={1}>
                          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                            <Chip
                              color={provider.active ? 'primary' : 'default'}
                              label={provider.providerCode}
                              size="small"
                            />
                            <Chip
                              color={provider.enabled ? 'success' : 'default'}
                              label={provider.enabled ? 'Enabled' : 'Disabled'}
                              size="small"
                            />
                          </Stack>
                          <Typography sx={{ fontWeight: 700 }}>
                            {humanize(provider.providerType.toLowerCase())}
                          </Typography>
                          <Typography color="text.secondary" variant="body2">
                            Health: {humanize(provider.health.status.toLowerCase())}
                          </Typography>
                          <Typography color="text.secondary" variant="body2">
                            Delivery: {humanize(provider.deliveryMode.toLowerCase())}
                          </Typography>
                          {provider.health.rootMode ? (
                            <Typography color="text.secondary" variant="body2">
                              Root mode:{' '}
                              {humanize(provider.health.rootMode.toLowerCase())}
                            </Typography>
                          ) : null}
                          {provider.health.message ? (
                            <Typography color="text.secondary" variant="caption">
                              {provider.health.message}
                            </Typography>
                          ) : null}
                        </Stack>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Stack>
            </Box>
          ) : null}

          {props.loading ? (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <CircularProgress size={24} />
              <Typography color="text.secondary">
                Loading media folder policy…
              </Typography>
            </Stack>
          ) : props.error ? (
            <Alert severity="error">
              {props.error instanceof Error
                ? props.error.message
                : 'Media storage policy is unavailable.'}
            </Alert>
          ) : !props.connectionAvailable ? (
            <Alert severity="warning">
              The media service is not available in the current BackOffice registry
              response.
            </Alert>
          ) : (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, xl: 8 }}>
                <Box
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Folder</TableCell>
                        <TableCell>Visibility</TableCell>
                        <TableCell>Extensions</TableCell>
                        <TableCell>MIME types</TableCell>
                        <TableCell>Max size</TableCell>
                        <TableCell>Checksum</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {props.policies.map((policy) => (
                        <TableRow key={policy.folderCode}>
                          <TableCell>
                            <Typography sx={{ fontWeight: 700 }}>
                              {policy.label}
                            </Typography>
                            <Typography color="text.secondary" variant="body2">
                              {policy.folderCode}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={humanize(policy.access)} size="small" />
                          </TableCell>
                          <TableCell>{folderList(policy.allowedExtensions)}</TableCell>
                          <TableCell>{folderList(policy.allowedMimeTypes)}</TableCell>
                          <TableCell>{formatBytes(policy.maxFileSizeBytes)}</TableCell>
                          <TableCell>{policy.checksumAlgorithm}</TableCell>
                        </TableRow>
                      ))}
                      {props.policies.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <Typography
                              color="text.secondary"
                              sx={{ py: 3, textAlign: 'center' }}
                            >
                              No folder policy was returned by the media service.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, xl: 4 }}>
                <Box
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    height: '100%',
                    p: 2,
                  }}
                >
                  <Stack spacing={2}>
                    <Box>
                      <Typography
                        color="text.secondary"
                        sx={{
                          fontWeight: 800,
                          letterSpacing: 1.5,
                          textTransform: 'uppercase',
                        }}
                        variant="caption"
                      >
                        Delivery endpoint
                      </Typography>
                      <Typography sx={{ overflowWrap: 'anywhere' }}>
                        {props.deliveryBaseUrl
                          ? `${props.deliveryBaseUrl.replace(/\/$/, '')}/v0/content/{mediaCode}`
                          : '/nodics/media/v0/content/{mediaCode}'}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography
                        color="text.secondary"
                        sx={{
                          fontWeight: 800,
                          letterSpacing: 1.5,
                          textTransform: 'uppercase',
                        }}
                        variant="caption"
                      >
                        Backend controlled
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        nMedia owns storage paths, provider credentials, key generation,
                        and delivery authorization.
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function MediaDeliveryPreviewPanel(props: {
  readonly accessToken: string;
  readonly connection: ReturnType<typeof selectModuleConnection>;
  readonly record: WorkbenchRecord;
}) {
  const deliveryUrl = resolveDeliveryUrl(props.connection, props.record);
  const downloadUrl = resolveDownloadUrl(props.connection, props.record);
  const originalFileName = mediaSummary(props.record);

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        p: 2,
      }}
    >
      <MediaPreview
        access={textValue(props.record, 'access')}
        accessToken={props.accessToken}
        deliveryUrl={deliveryUrl}
        downloadUrl={downloadUrl}
        extension={textValue(props.record, 'extension')}
        fileName={
          originalFileName === '—' ? textValue(props.record, 'code') : originalFileName
        }
        formatBytes={formatBytes}
        mimeType={textValue(props.record, 'mimeType')}
        sizeBytes={numberValue(props.record, 'sizeBytes')}
        source="record"
        status={textValue(props.record, 'status')}
      />
    </Box>
  );
}

function MediaUsageSummaryPanel(props: {
  readonly error: unknown;
  readonly loading: boolean;
  readonly mediaCode: string;
  readonly records: readonly WorkbenchRecord[];
}) {
  const activeCount = props.records.filter(
    (record) => textValue(record, 'status') === 'ACTIVE',
  ).length;
  return (
    <Stack spacing={1.25}>
      <Divider />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Box>
          <Typography component="h4" variant="h6">
            Usage
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          size="small"
          to={`/media/usage?mediaCode=${encodeURIComponent(props.mediaCode)}`}
          variant="outlined"
        >
          Open usage
        </Button>
      </Stack>
      {props.loading ? (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <CircularProgress size={20} />
          <Typography color="text.secondary" variant="body2">
            Checking active references…
          </Typography>
        </Stack>
      ) : props.error ? (
        <Alert severity="warning">
          {props.error instanceof Error
            ? props.error.message
            : 'Media usage references are unavailable.'}
        </Alert>
      ) : activeCount > 0 ? (
        <Alert severity="warning">
          This media item has {activeCount} active usage reference
          {activeCount === 1 ? '' : 's'}. Review usage before retiring or replacing it.
        </Alert>
      ) : (
        <Stack
          direction="row"
          spacing={1.25}
          sx={{
            alignItems: 'center',
            bgcolor: 'rgba(20, 121, 75, 0.08)',
            borderRadius: 1.5,
            color: 'success.dark',
            px: 1.5,
            py: 1.25,
          }}
        >
          <ShellIcon color="success" name="health" />
          <Typography variant="body2">No active usage references found.</Typography>
        </Stack>
      )}
    </Stack>
  );
}

function MediaImportExportLinkagePanel(props: {
  readonly error: unknown;
  readonly importConnectionAvailable: boolean;
  readonly importHistory: readonly ImportRunSummary[];
  readonly loading: boolean;
  readonly mediaCode: string;
  readonly record: WorkbenchRecord;
  readonly usageRecords: readonly WorkbenchRecord[];
}) {
  const importExportReferences = props.usageRecords.filter((record) =>
    ['import', 'export', 'nImport', 'nExport'].includes(
      textValue(record, 'ownerModule'),
    ),
  );
  const hasImportHistory = props.importHistory.length > 0;
  const hasReferences = importExportReferences.length > 0;
  const shouldShow =
    hasImportHistory || hasReferences || props.loading || Boolean(props.error);
  if (!shouldShow) return null;
  return (
    <Stack spacing={1.5}>
      <Divider />
      <Typography component="h4" variant="h6">
        Import/export linkage
      </Typography>
      {!props.importConnectionAvailable ? (
        hasImportHistory || hasReferences ? (
          <Typography color="text.secondary" variant="body2">
            Import history is not available from the current BackOffice registry.
          </Typography>
        ) : null
      ) : props.loading ? (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <CircularProgress size={20} />
          <Typography color="text.secondary" variant="body2">
            Checking nImport history…
          </Typography>
        </Stack>
      ) : props.error ? (
        <Alert severity="warning">
          {props.error instanceof Error
            ? props.error.message
            : 'Import history is unavailable for this media item.'}
        </Alert>
      ) : props.importHistory.length > 0 ? (
        <Stack spacing={1}>
          {props.importHistory.map((run) => (
            <Box
              key={run.runId}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5 }}
            >
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip color="primary" label="nImport" size="small" />
                <Chip label={run.status} size="small" />
                {run.dataType ? <Chip label={run.dataType} size="small" /> : null}
              </Stack>
              <Typography sx={{ mt: 1, overflowWrap: 'anywhere', fontWeight: 700 }}>
                {run.runId}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                Modules: {run.modules.length > 0 ? run.modules.join(', ') : '—'}
              </Typography>
              {run.summary ? (
                <Typography color="text.secondary" variant="body2">
                  Records: {run.summary.recordsRead ?? '—'} read,{' '}
                  {run.summary.recordsSucceeded ?? '—'} succeeded,{' '}
                  {run.summary.recordsFailed ?? '—'} failed
                </Typography>
              ) : null}
            </Box>
          ))}
        </Stack>
      ) : null}
      {importExportReferences.length > 0 ? (
        <Box>
          <Typography sx={{ fontWeight: 700 }} variant="body2">
            Import/export reference traces
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
            {importExportReferences.map((reference) => (
              <Typography
                key={textValue(reference, 'code')}
                color="text.secondary"
                variant="body2"
              >
                {textValue(reference, 'ownerModule')} /{' '}
                {textValue(reference, 'ownerSchema')} /{' '}
                {textValue(reference, 'ownerCode')} —{' '}
                {textValue(reference, 'relationType')}
              </Typography>
            ))}
          </Stack>
        </Box>
      ) : !hasImportHistory && !props.loading && !props.error ? (
        <Typography color="text.secondary" variant="body2">
          No import/export linkage found for this media item.
        </Typography>
      ) : null}
    </Stack>
  );
}

function SelectedMediaHeaderActions(props: {
  readonly configuration: WorkbenchClientConfiguration;
  readonly connection: ReturnType<typeof selectModuleConnection>;
  readonly importHistory: readonly ImportRunSummary[];
  readonly importHistoryLoading: boolean;
  readonly mediaSchema: WorkbenchSchema;
  readonly onChanged: () => void;
  readonly record: WorkbenchRecord;
  readonly usageRecords: readonly WorkbenchRecord[];
}) {
  const status = normalizeMediaLifecycleStatus(textValue(props.record, 'status'));
  const activeUsageCount = props.usageRecords.filter(
    (record) => textValue(record, 'status') === 'ACTIVE',
  ).length;
  const lifecycleMutation = useMutation({
    mutationFn: (nextStatus: string) =>
      updateWorkbenchRecord(
        props.connection!,
        props.mediaSchema,
        props.record,
        { status: nextStatus },
        props.configuration,
      ),
    onSuccess: () => props.onChanged(),
  });
  const download = useMutation({
    mutationFn: () =>
      downloadMediaRecord(props.connection, props.configuration, props.record),
  });
  const canUpdate =
    Boolean(props.connection) &&
    props.mediaSchema.mutationMode === 'GENERATED_CRUD' &&
    props.mediaSchema.operations.includes('update');
  const isExportFile = textValue(props.record, 'folderCode') === 'exportFiles';
  const hasImportExportHistory = props.importHistory.length > 0;
  const showHistory =
    isExportFile || hasImportExportHistory || props.importHistoryLoading;
  const lifecyclePolicies = mediaLifecycleActionPolicies({
    activeUsageCount,
    canUpdate,
    pending: lifecycleMutation.isPending,
    status,
  });
  const retirePolicy = lifecyclePolicies.find((policy) => policy.action === 'retire');
  const restorePolicy = lifecyclePolicies.find((policy) => policy.action === 'restore');

  return (
    <Stack spacing={1}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}
      >
        <Button
          disabled={download.isPending}
          onClick={() => download.mutate()}
          size="small"
          variant="contained"
        >
          {download.isPending ? 'Downloading…' : 'Download'}
        </Button>
        {showHistory ? (
          <Button
            component={RouterLink}
            size="small"
            to="/operations/imports-exports?area=history"
            variant="outlined"
          >
            History
          </Button>
        ) : null}
        {retirePolicy ? (
          <Button
            color={retirePolicy.color}
            disabled={retirePolicy.disabled}
            onClick={() => lifecycleMutation.mutate(retirePolicy.nextStatus)}
            size="small"
            title={retirePolicy.reason}
            variant={retirePolicy.variant}
          >
            {retirePolicy.label}
          </Button>
        ) : null}
        {restorePolicy && status !== 'READY' ? (
          <Button
            color={restorePolicy.color}
            disabled={restorePolicy.disabled}
            onClick={() => lifecycleMutation.mutate(restorePolicy.nextStatus)}
            size="small"
            title={restorePolicy.reason}
            variant={restorePolicy.variant}
          >
            {restorePolicy.label}
          </Button>
        ) : null}
      </Stack>
      {download.error ? (
        <Alert severity="warning">
          {download.error instanceof Error
            ? download.error.message
            : 'Media download is unavailable currently'}
        </Alert>
      ) : null}
      {lifecycleMutation.error ? (
        <Alert severity="error">
          {lifecycleMutation.error instanceof Error
            ? lifecycleMutation.error.message
            : 'Media lifecycle update failed.'}
        </Alert>
      ) : null}
      {activeUsageCount > 0 && canUpdate ? (
        <Typography color="text.secondary" variant="caption">
          {retirePolicy?.reason ??
            'Retire is disabled while this media is actively referenced.'}
        </Typography>
      ) : null}
      {lifecycleMutation.data ? (
        <Alert severity="success">Media lifecycle status was updated.</Alert>
      ) : null}
    </Stack>
  );
}

function schemaRecordLabel(configuration: MediaRecordWorkspaceConfiguration): string {
  return configuration.title.replace(/^Media\s+/i, '').replace(/s$/i, '');
}

function SchemaRecordManagementPanel(props: {
  readonly configuration: WorkbenchClientConfiguration;
  readonly connection: ReturnType<typeof selectModuleConnection>;
  readonly mode: MediaRecordCrudMode;
  readonly onChanged: (record?: WorkbenchRecord) => void;
  readonly onModeChange: (mode: MediaRecordCrudMode) => void;
  readonly record?: WorkbenchRecord | undefined;
  readonly schema: WorkbenchSchema;
  readonly workspaceConfiguration: MediaRecordWorkspaceConfiguration;
}) {
  const label = schemaRecordLabel(props.workspaceConfiguration);
  const createMutation = useMutation({
    mutationFn: (model: Readonly<Record<string, unknown>>) =>
      createWorkbenchRecord(
        props.connection!,
        props.schema,
        model,
        props.configuration,
      ),
    onSuccess: (created) => {
      props.onModeChange('none');
      props.onChanged(created);
    },
  });
  const updateMutation = useMutation({
    mutationFn: (model: Readonly<Record<string, unknown>>) =>
      updateWorkbenchRecord(
        props.connection!,
        props.schema,
        props.record!,
        model,
        props.configuration,
      ),
    onSuccess: (updated) => {
      props.onModeChange('none');
      props.onChanged(updated);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteWorkbenchRecord(
        props.connection!,
        props.schema,
        props.record!,
        props.configuration,
        `axis-${crypto.randomUUID()}`,
      ),
    onSuccess: () => {
      props.onModeChange('none');
      props.onChanged(undefined);
    },
  });
  const canCrud =
    Boolean(props.connection) && props.schema.mutationMode === 'GENERATED_CRUD';
  const canCreate = canCrud && props.schema.operations.includes('create');
  const canUpdate =
    canCrud && Boolean(props.record) && props.schema.operations.includes('update');
  const canDelete =
    canCrud && Boolean(props.record) && props.schema.operations.includes('delete');
  const hasActions = canCreate || canUpdate || canDelete;

  if (!hasActions) return null;

  return (
    <Stack spacing={1.5}>
      <Divider />
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
      >
        <Typography component="h4" sx={{ flex: 1, fontWeight: 700 }} variant="h6">
          {props.workspaceConfiguration.title} management
        </Typography>
        {canCreate ? (
          <Button
            variant={props.mode === 'create' ? 'contained' : 'outlined'}
            onClick={() =>
              props.onModeChange(props.mode === 'create' ? 'none' : 'create')
            }
          >
            Create {label}
          </Button>
        ) : null}
        {canUpdate ? (
          <Button
            variant={props.mode === 'edit' ? 'contained' : 'outlined'}
            onClick={() => props.onModeChange(props.mode === 'edit' ? 'none' : 'edit')}
          >
            Edit {label}
          </Button>
        ) : null}
        {canDelete ? (
          <Button
            color="error"
            variant={props.mode === 'delete' ? 'contained' : 'outlined'}
            onClick={() =>
              props.onModeChange(props.mode === 'delete' ? 'none' : 'delete')
            }
          >
            Delete {label}
          </Button>
        ) : null}
      </Stack>
      {props.mode === 'create' && canCreate ? (
        <WorkbenchRecordForm
          embedded
          cancelLabel="Cancel"
          error={createMutation.error?.message}
          saving={createMutation.isPending}
          savingLabel={`Creating ${label}…`}
          schema={props.schema}
          submitLabel={`Create ${label}`}
          title={`Create ${props.workspaceConfiguration.title.toLowerCase()}`}
          onCancel={() => props.onModeChange('none')}
          onSubmit={(model) => createMutation.mutate(model)}
        />
      ) : null}
      {props.mode === 'edit' && props.record && canUpdate ? (
        <WorkbenchRecordForm
          embedded
          cancelLabel="Cancel"
          error={updateMutation.error?.message}
          initialModel={props.record}
          saving={updateMutation.isPending}
          savingLabel={`Saving ${label}…`}
          schema={props.schema}
          submitLabel={`Save ${label}`}
          title={`Edit ${textValue(props.record, 'code')}`}
          onCancel={() => props.onModeChange('none')}
          onSubmit={(model) => updateMutation.mutate(model)}
        />
      ) : null}
      {props.mode === 'delete' && props.record && canDelete ? (
        <Alert
          action={
            <Stack direction="row" spacing={1}>
              <Button
                color="inherit"
                disabled={deleteMutation.isPending}
                onClick={() => props.onModeChange('none')}
              >
                Cancel
              </Button>
              <Button
                color="error"
                disabled={deleteMutation.isPending}
                variant="contained"
                onClick={() => deleteMutation.mutate()}
              >
                Delete
              </Button>
            </Stack>
          }
          severity="warning"
        >
          Delete {label} {textValue(props.record, 'code')}? The backend remains
          responsible for rejecting unsafe deletes.
        </Alert>
      ) : null}
      {deleteMutation.error ? (
        <Alert severity="error">
          {deleteMutation.error instanceof Error
            ? deleteMutation.error.message
            : `${label} deletion failed.`}
        </Alert>
      ) : null}
    </Stack>
  );
}

const recordWorkspaceConfigurations: Readonly<
  Record<string, MediaRecordWorkspaceConfiguration>
> = Object.freeze({
  media: {
    schemaName: 'media',
    title: 'Media records',
    description:
      'Search uploaded and generated media metadata through the authorized media schema contract. Raw storage paths stay hidden from Axis.',
    recordCountLabel: 'records',
    searchPlaceholder: 'Search by code, filename, folder, status, MIME type, or format',
    emptyMessage: 'No media records match the current search.',
    detailEmptyMessage: 'Select a media record to review governed metadata.',
    hiddenPathNotice:
      'Internal full paths are intentionally not displayed. Use media delivery or backend-governed processing APIs for file access.',
    searchKeys: [
      'code',
      'name',
      'originalFileName',
      'folderCode',
      'formatCode',
      'providerCode',
      'access',
      'status',
      'mimeType',
      'extension',
    ],
    summary: mediaSummary,
    columns: [
      {
        label: 'Media',
        field: 'code',
        minWidth: 280,
        render: (record) => (
          <Box>
            <Typography sx={{ fontWeight: 700 }}>{mediaSummary(record)}</Typography>
            <Typography color="text.secondary" variant="body2">
              {textValue(record, 'code')}
            </Typography>
          </Box>
        ),
      },
      {
        label: 'Source type',
        field: 'folderCode',
        render: (record, contexts) =>
          mediaSourceType(textValue(record, 'folderCode'), contexts),
      },
      {
        label: 'Format',
        field: 'formatCode',
        render: (record) => mediaFormatLabel(textValue(record, 'formatCode')),
      },
      {
        label: 'Visibility',
        field: 'access',
        render: (record) => (
          <Chip label={humanize(textValue(record, 'access'))} size="small" />
        ),
      },
      {
        label: 'Status',
        field: 'status',
        render: (record) => (
          <Chip
            color={mediaLifecycleStatusTone(textValue(record, 'status'))}
            label={textValue(record, 'status')}
            size="small"
          />
        ),
      },
      {
        label: 'Size',
        field: 'sizeBytes',
        render: (record) => formatBytes(numberValue(record, 'sizeBytes')),
      },
    ],
    details: [
      { label: 'Folder', key: 'folderCode' },
      { label: 'Format', key: 'formatCode' },
      { label: 'Provider', key: 'providerCode' },
      { label: 'MIME type', key: 'mimeType' },
      { label: 'Extension', key: 'extension' },
      { label: 'Checksum', key: 'checksum' },
      { label: 'Checksum algorithm', key: 'checksumAlgorithm' },
    ],
  },
  'media-folders': {
    schemaName: 'mediaFolder',
    title: 'Media folders',
    description: 'Create and manage purpose-based folders for governed media.',
    recordCountLabel: 'folders',
    searchPlaceholder: 'Search folders',
    emptyMessage: 'No folders found.',
    detailEmptyMessage: 'Select a folder or create a new one.',
    hiddenPathNotice:
      'Folder storage policy remains backend-owned. Axis shows configured rules, not resolved absolute file locations.',
    searchKeys: [
      'code',
      'name',
      'description',
      'storagePrefix',
      'access',
      'allowedExtensions',
      'allowedMimeTypes',
    ],
    summary: recordNameOrCodeSummary,
    columns: [
      {
        label: 'Folder',
        field: 'code',
        render: (record) => (
          <Box>
            <Typography sx={{ fontWeight: 700 }}>
              {recordNameOrCodeSummary(record)}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {textValue(record, 'code')}
            </Typography>
          </Box>
        ),
      },
      {
        label: 'Storage prefix',
        field: 'storagePrefix',
        render: (record) => textValue(record, 'storagePrefix'),
      },
      {
        label: 'Visibility',
        field: 'access',
        render: (record) => (
          <Chip label={humanize(textValue(record, 'access'))} size="small" />
        ),
      },
      {
        label: 'Max size',
        field: 'maximumFileSizeBytes',
        render: (record) => formatBytes(numberValue(record, 'maximumFileSizeBytes')),
      },
      { label: 'Retention', field: 'retentionDays', render: formatRetentionDays },
    ],
    details: [
      { label: 'Code', key: 'code' },
      { label: 'Name', key: 'name' },
      { label: 'Description', key: 'description' },
      { label: 'Storage prefix', key: 'storagePrefix' },
      {
        label: 'Visibility',
        key: 'access',
        render: (record) => humanize(textValue(record, 'access')),
      },
      { label: 'Allowed extensions', key: 'allowedExtensions' },
      { label: 'Allowed MIME types', key: 'allowedMimeTypes' },
      {
        label: 'Maximum file size',
        key: 'maximumFileSizeBytes',
        render: (record) => formatBytes(numberValue(record, 'maximumFileSizeBytes')),
      },
      { label: 'Retention', key: 'retentionDays', render: formatRetentionDays },
    ],
  },
  'media-formats': {
    schemaName: 'mediaFormat',
    title: 'Media formats',
    description: 'Manage reusable media formats and presentation variants.',
    recordCountLabel: 'formats',
    searchPlaceholder: 'Search formats',
    emptyMessage: 'No formats found.',
    detailEmptyMessage: 'Select a format to review details.',
    hiddenPathNotice:
      'Formats describe how media may be presented or processed. They do not store files and do not replace frontend rendering rules.',
    searchKeys: [
      'code',
      'name',
      'description',
      'purpose',
      'formatFamily',
      'status',
      'width',
      'height',
    ],
    summary: recordNameOrCodeSummary,
    columns: [
      {
        label: 'Format',
        field: 'code',
        render: (record) => (
          <Box>
            <Typography sx={{ fontWeight: 700 }}>
              {recordNameOrCodeSummary(record)}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {textValue(record, 'code')}
            </Typography>
          </Box>
        ),
      },
      {
        label: 'Purpose',
        field: 'purpose',
        render: (record) => textValue(record, 'purpose'),
      },
      {
        label: 'Family',
        field: 'formatFamily',
        render: (record) => (
          <Chip label={humanize(textValue(record, 'formatFamily'))} size="small" />
        ),
      },
      { label: 'Dimensions', field: 'width', render: formatDimensions },
      {
        label: 'Status',
        field: 'status',
        render: (record) => (
          <Chip
            color={textValue(record, 'status') === 'ACTIVE' ? 'success' : 'default'}
            label={textValue(record, 'status')}
            size="small"
          />
        ),
      },
    ],
    details: [
      { label: 'Code', key: 'code' },
      { label: 'Name', key: 'name' },
      { label: 'Purpose', key: 'purpose' },
      {
        label: 'Family',
        key: 'formatFamily',
        render: (record) => humanize(textValue(record, 'formatFamily')),
      },
      { label: 'Status', key: 'status' },
      { label: 'Description', key: 'description' },
      { label: 'Dimensions', key: 'dimensions', render: formatDimensions },
      { label: 'Width', key: 'width' },
      { label: 'Height', key: 'height' },
    ],
  },
  'media-sets': {
    schemaName: 'mediaSet',
    title: 'Media sets',
    description: 'Manage logical groups such as galleries and responsive image sets.',
    recordCountLabel: 'sets',
    searchPlaceholder: 'Search media sets',
    emptyMessage: 'No media sets found.',
    detailEmptyMessage: 'Select a media set to review details.',
    hiddenPathNotice:
      'A media set is a logical grouping record. Variant files are owned by mediaSetEntry records and media items, not by Axis.',
    searchKeys: [
      'code',
      'name',
      'description',
      'mediaType',
      'businessPurpose',
      'status',
    ],
    summary: recordNameOrCodeSummary,
    columns: [
      {
        label: 'Media set',
        field: 'code',
        render: (record) => (
          <Box>
            <Typography sx={{ fontWeight: 700 }}>
              {recordNameOrCodeSummary(record)}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {textValue(record, 'code')}
            </Typography>
          </Box>
        ),
      },
      {
        label: 'Type',
        field: 'mediaType',
        render: (record) => textValue(record, 'mediaType'),
      },
      {
        label: 'Business purpose',
        field: 'businessPurpose',
        render: (record) => textValue(record, 'businessPurpose'),
      },
      {
        label: 'Status',
        field: 'status',
        render: (record) => (
          <Chip
            color={textValue(record, 'status') === 'ACTIVE' ? 'success' : 'default'}
            label={textValue(record, 'status')}
            size="small"
          />
        ),
      },
    ],
    details: [
      { label: 'Code', key: 'code' },
      { label: 'Name', key: 'name' },
      { label: 'Description', key: 'description' },
      { label: 'Media type', key: 'mediaType' },
      { label: 'Business purpose', key: 'businessPurpose' },
      { label: 'Status', key: 'status' },
    ],
  },
  'media-usage': {
    schemaName: 'mediaReference',
    title: 'Media usage references',
    description: 'Review where media items and sets are used.',
    recordCountLabel: 'references',
    searchPlaceholder: 'Search usage',
    emptyMessage: 'No usage references found.',
    detailEmptyMessage: 'Select a usage reference to review details.',
    hiddenPathNotice:
      'Usage references are trace records, not ownership transfer. Product, CMS, import, and partner modules remain authoritative for their own records.',
    searchKeys: [
      'code',
      'ownerModule',
      'ownerSchema',
      'ownerCode',
      'mediaCode',
      'mediaSetCode',
      'relationType',
      'status',
    ],
    summary: (record) => {
      const ownerModule = textValue(record, 'ownerModule');
      const ownerSchema = textValue(record, 'ownerSchema');
      const ownerCode = textValue(record, 'ownerCode');
      if (ownerModule !== '—' || ownerSchema !== '—' || ownerCode !== '—') {
        return `${ownerModule}.${ownerSchema} ${ownerCode}`.replace(/\s+—$/, '');
      }
      return textValue(record, 'code');
    },
    columns: [
      {
        label: 'Owner',
        field: 'ownerCode',
        render: (record) => (
          <Box>
            <Typography sx={{ fontWeight: 700 }}>
              {textValue(record, 'ownerCode')}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {textValue(record, 'ownerModule')} / {textValue(record, 'ownerSchema')}
            </Typography>
          </Box>
        ),
      },
      {
        label: 'Relation',
        field: 'relationType',
        render: (record) => textValue(record, 'relationType'),
      },
      {
        label: 'Media',
        field: 'mediaCode',
        render: (record) => {
          const mediaCode = textValue(record, 'mediaCode');
          return mediaCode === '—' ? textValue(record, 'mediaSetCode') : mediaCode;
        },
      },
      {
        label: 'Position',
        field: 'position',
        render: (record) => textValue(record, 'position'),
      },
      {
        label: 'Status',
        field: 'status',
        render: (record) => (
          <Chip
            color={textValue(record, 'status') === 'ACTIVE' ? 'success' : 'default'}
            label={textValue(record, 'status')}
            size="small"
          />
        ),
      },
    ],
    details: [
      { label: 'Reference code', key: 'code' },
      { label: 'Owner module', key: 'ownerModule' },
      { label: 'Owner schema', key: 'ownerSchema' },
      { label: 'Owner record', key: 'ownerCode' },
      { label: 'Media item', key: 'mediaCode' },
      { label: 'Media set', key: 'mediaSetCode' },
      { label: 'Relation type', key: 'relationType' },
      { label: 'Position', key: 'position' },
      { label: 'Status', key: 'status' },
    ],
  },
});

const emptyFacetFilters: readonly MediaRecordFacetFilter[] = Object.freeze([]);

const recordWorkspaceFacetFilters: Readonly<
  Record<string, readonly MediaRecordFacetFilter[]>
> = Object.freeze({
  media: [
    {
      allLabel: 'All source types',
      key: 'sourceType',
      label: 'Source type',
      staticOptions: governedMediaSourceTypes,
      value: (record, contexts) =>
        mediaSourceType(textValue(record, 'folderCode'), contexts),
    },
  ],
  'media-folders': [
    {
      allLabel: 'All source types',
      key: 'sourceType',
      label: 'Source type',
      value: (record, contexts) => mediaSourceType(textValue(record, 'code'), contexts),
    },
    {
      allLabel: 'All visibility rules',
      key: 'access',
      label: 'Visibility',
      optionLabel: humanize,
      value: (record) => textValue(record, 'access'),
    },
    {
      allLabel: 'All storage prefixes',
      key: 'storagePrefix',
      label: 'Storage prefix',
      optionLabel: humanize,
      value: (record) => textValue(record, 'storagePrefix'),
    },
  ],
  'media-formats': [
    {
      allLabel: 'All families',
      key: 'formatFamily',
      label: 'Family',
      optionLabel: humanize,
      value: (record) => textValue(record, 'formatFamily'),
    },
    {
      allLabel: 'All purposes',
      key: 'purpose',
      label: 'Purpose',
      optionLabel: humanize,
      value: (record) => textValue(record, 'purpose'),
    },
    {
      allLabel: 'All dimensions',
      key: 'dimensions',
      label: 'Dimensions',
      value: formatDimensions,
    },
    {
      allLabel: 'All statuses',
      key: 'status',
      label: 'Status',
      optionLabel: humanize,
      value: (record) => textValue(record, 'status'),
    },
  ],
  'media-sets': [
    {
      allLabel: 'All media types',
      key: 'mediaType',
      label: 'Media type',
      optionLabel: humanize,
      value: (record) => textValue(record, 'mediaType'),
    },
    {
      allLabel: 'All business purposes',
      key: 'businessPurpose',
      label: 'Business purpose',
      optionLabel: humanize,
      value: (record) => textValue(record, 'businessPurpose'),
    },
    {
      allLabel: 'All statuses',
      key: 'status',
      label: 'Status',
      optionLabel: humanize,
      value: (record) => textValue(record, 'status'),
    },
  ],
  'media-usage': [
    {
      allLabel: 'All owner modules',
      key: 'ownerModule',
      label: 'Owner module',
      optionLabel: humanize,
      value: (record) => textValue(record, 'ownerModule'),
    },
    {
      allLabel: 'All owner schemas',
      key: 'ownerSchema',
      label: 'Owner schema',
      optionLabel: humanize,
      value: (record) => textValue(record, 'ownerSchema'),
    },
    {
      allLabel: 'All owner records',
      key: 'ownerCode',
      label: 'Owner record',
      value: (record) => textValue(record, 'ownerCode'),
    },
    {
      allLabel: 'All relations',
      key: 'relationType',
      label: 'Relation',
      optionLabel: humanize,
      value: (record) => textValue(record, 'relationType'),
    },
    {
      allLabel: 'All statuses',
      key: 'status',
      label: 'Status',
      optionLabel: humanize,
      value: (record) => textValue(record, 'status'),
    },
  ],
});

export function MediaManagementRoutePage(props: MediaManagementRoutePageProps) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [recordSearch, setRecordSearch] = useState('');
  const [recordFacetFilters, setRecordFacetFilters] = useState<Record<string, string>>(
    {},
  );
  const [recordPage, setRecordPage] = useState(0);
  const [recordRowsPerPage, setRecordRowsPerPage] = useState(10);
  const [recordSortOverrides, setRecordSortOverrides] = useState<
    Record<string, AxisSort | undefined>
  >({});
  const [recordColumnKeysByWorkspace, setRecordColumnKeysByWorkspace] = useState<
    Record<string, readonly string[]>
  >({});
  const [selectedRecordCode, setSelectedRecordCode] = useState<string>();
  const [mediaFolderCrudModes, setMediaFolderCrudModes] = useState<
    Record<string, MediaRecordCrudMode | undefined>
  >({});
  const [schemaRecordCrudModes, setSchemaRecordCrudModes] = useState<
    Record<string, MediaRecordCrudMode | undefined>
  >({});
  const [mediaWorkspaceSection, setMediaWorkspaceSection] = useState<
    'upload' | 'records'
  >('records');
  const [mediaEnterpriseCode, setMediaEnterpriseCode] = useState(
    props.runtime.enterpriseCode,
  );
  const connection = selectModuleConnection(props.bootstrap, 'media');
  const importConnection = selectModuleConnection(props.bootstrap, 'import');
  const usageMediaCode =
    new URLSearchParams(location.search).get('mediaCode')?.trim() ?? '';
  const mediaNavigation = useMemo(
    () =>
      props.bootstrap.navigation
        .filter((item) => item.moduleName === 'media')
        .filter((item) => item.route.startsWith('/media'))
        .sort((left, right) => left.order - right.order),
    [props.bootstrap.navigation],
  );
  const currentItem = findCurrentItem(mediaNavigation, location.pathname);
  const currentItemId = currentItem?.id ?? 'media';
  const mediaFolderCrudMode = mediaFolderCrudModes[currentItemId] ?? 'none';
  const schemaRecordCrudMode = schemaRecordCrudModes[currentItemId] ?? 'none';
  const recordSortOverride = recordSortOverrides[currentItemId];
  const setMediaFolderCrudMode = (mode: MediaRecordCrudMode) =>
    setMediaFolderCrudModes((current) => ({
      ...current,
      [currentItemId]: mode,
    }));
  const setSchemaRecordCrudMode = (mode: MediaRecordCrudMode) =>
    setSchemaRecordCrudModes((current) => ({
      ...current,
      [currentItemId]: mode,
    }));
  const setRecordSortOverride = (sort: AxisSort | undefined) =>
    setRecordSortOverrides((current) => ({
      ...current,
      [currentItemId]: sort,
    }));
  const configuration: WorkbenchClientConfiguration = {
    accessToken: props.accessToken,
    enterpriseCode:
      currentItemId === 'media' && validEnterpriseCode(mediaEnterpriseCode)
        ? mediaEnterpriseCode.trim() || props.runtime.enterpriseCode
        : props.runtime.enterpriseCode,
    timeoutMs: props.runtime.requestTimeoutMs,
  };
  const childItems = mediaNavigation.filter(
    (item) => item.parentId === 'media-management',
  );
  const recordWorkspaceConfiguration = currentItem
    ? recordWorkspaceConfigurations[currentItem.id]
    : undefined;
  const mediaRecordWorkspaceConfiguration = recordWorkspaceConfigurations.media;
  if (!mediaRecordWorkspaceConfiguration) {
    throw new Error('Media Management requires the media record workspace');
  }
  const currentFacetFilters = currentItem
    ? (recordWorkspaceFacetFilters[currentItem.id] ?? emptyFacetFilters)
    : emptyFacetFilters;
  const mediaDetailSections = props.mediaDetailPresentation?.detailSections?.length
    ? props.mediaDetailPresentation.detailSections
    : defaultMediaDetailSections;
  const mediaMetadataFields = props.mediaDetailPresentation?.metadataFields?.length
    ? props.mediaDetailPresentation.metadataFields
    : mediaRecordWorkspaceConfiguration.details;
  const mediaDetailSectionEnabled = (section: MediaDetailSection): boolean =>
    mediaDetailSections.includes(section);
  const facetStateKey = (key: string) => `${currentItem?.id ?? 'none'}:${key}`;
  const schemas = useQuery({
    enabled: Boolean(recordWorkspaceConfiguration && connection),
    queryKey: [
      'media-management',
      'schemas',
      connection?.endpoint,
      configuration.enterpriseCode,
    ],
    queryFn: () => loadWorkbenchSchemas(connection ? [connection] : [], configuration),
  });
  const currentSchema = useMemo(
    () =>
      schemas.data?.find(
        (schema) =>
          schema.moduleName === 'media' &&
          schema.schemaName === recordWorkspaceConfiguration?.schemaName,
      ),
    [recordWorkspaceConfiguration?.schemaName, schemas.data],
  );
  const mediaSetEntrySchema = useMemo(
    () =>
      schemas.data?.find(
        (schema) =>
          schema.moduleName === 'media' && schema.schemaName === 'mediaSetEntry',
      ),
    [schemas.data],
  );
  const mediaReferenceSchema = useMemo(
    () =>
      schemas.data?.find(
        (schema) =>
          schema.moduleName === 'media' && schema.schemaName === 'mediaReference',
      ),
    [schemas.data],
  );
  const mediaContexts = useQuery({
    enabled: Boolean(
      (currentItem?.id === 'storage-delivery' ||
        currentItem?.id === 'media-formats' ||
        currentFacetFilters.some((filter) => filter.key === 'sourceType')) &&
      connection,
    ),
    queryKey: [
      'media-management',
      'media-contexts',
      connection?.endpoint,
      configuration.enterpriseCode,
    ],
    queryFn: () => loadMediaSourceContexts(connection!, configuration),
  });
  const currentRecordFilter =
    currentItem?.id === 'media-usage' && usageMediaCode
      ? buildEqualsFilter('mediaCode', usageMediaCode)
      : undefined;
  const queryableFacetFilters = currentSchema
    ? currentFacetFilters.filter((filter) =>
        isFacetFilterQueryable(currentSchema, currentItem?.id, filter),
      )
    : emptyFacetFilters;
  const currentFacetRecordFilter = currentSchema
    ? buildFacetRecordFilter(
        currentSchema,
        currentItem?.id,
        queryableFacetFilters,
        recordFacetFilters,
        mediaContexts.data,
      )
    : undefined;
  const activeRecordFilter = combineFilters([
    currentRecordFilter,
    currentFacetRecordFilter,
  ]);
  const recordRowsPerPageOptions = recordPageSizeOptions(currentSchema);
  const effectiveRecordRowsPerPage = recordRowsPerPageOptions.includes(
    recordRowsPerPage,
  )
    ? recordRowsPerPage
    : (recordRowsPerPageOptions[0] ?? 10);
  const effectiveRecordSort =
    recordSortOverride ?? currentSchema?.queryCapabilities.defaultSort;
  const records = useQuery({
    enabled: Boolean(recordWorkspaceConfiguration && connection && currentSchema),
    queryKey: [
      'media-management',
      recordWorkspaceConfiguration?.schemaName,
      connection?.endpoint,
      currentSchema?.schemaName,
      configuration.enterpriseCode,
      recordSearch.trim(),
      recordPage,
      effectiveRecordRowsPerPage,
      effectiveRecordSort?.field,
      effectiveRecordSort?.direction,
      recordFacetFilters,
      mediaContexts.data?.map((context) => context.folderCodes.join(',')).join('|'),
      usageMediaCode,
    ],
    queryFn: () =>
      loadWorkbenchRecords(
        connection!,
        currentSchema!,
        configuration,
        buildRecordQuery(
          currentSchema!,
          recordSearch.trim(),
          activeRecordFilter,
          recordPage + 1,
          effectiveRecordRowsPerPage,
          effectiveRecordSort,
        ),
      ),
  });
  const loadedRecords = useMemo(
    () => records.data?.records ?? [],
    [records.data?.records],
  );
  const facetFilterOptions = queryableFacetFilters
    .map((filter) => {
      const dynamicOptions = uniqueSorted(
        loadedRecords
          .map((record) => filter.value(record, mediaContexts.data))
          .filter((value) => value && value !== '—'),
      );
      const backendSourceOptions =
        filter.key === 'sourceType'
          ? mediaSourceTypesForContexts(mediaContexts.data)
          : [];
      const options = uniqueSorted([
        ...(filter.staticOptions ?? []),
        ...backendSourceOptions,
        ...dynamicOptions,
      ]);
      return {
        filter,
        options,
      };
    })
    .filter(({ options }) => options.length > 0);
  const mediaSourceFacetOption =
    currentItem?.id === 'media'
      ? facetFilterOptions.find(({ filter }) => filter.key === 'sourceType')
      : undefined;
  const hasActiveFacetFilters = queryableFacetFilters.some((filter) => {
    const value = recordFacetFilters[`${currentItem?.id ?? 'none'}:${filter.key}`];
    return Boolean(value && value !== 'ALL');
  });
  const visibleRecords = loadedRecords;
  const totalRecordCount = records.data?.totalCount ?? visibleRecords.length;
  const effectiveRecordPage = recordPage;
  const pagedRecords = visibleRecords;
  const selectedRecord =
    currentItemId === 'media' && !selectedRecordCode
      ? undefined
      : (visibleRecords.find(
          (record) =>
            typeof record.code === 'string' && record.code === selectedRecordCode,
        ) ?? (currentItemId === 'media' ? undefined : visibleRecords[0]));
  const recordColumnStateKey = currentItemId ?? 'none';
  const defaultRecordColumnKeys =
    recordWorkspaceConfiguration?.columns.map((column) => column.field) ?? [];
  const recordFieldRenderers = useMemo<
    Readonly<Record<string, AxisSchemaFieldRenderer>>
  >(
    () =>
      Object.freeze(
        Object.fromEntries(
          (recordWorkspaceConfiguration?.columns ?? []).map((column) => [
            column.field,
            {
              label: column.label,
              minWidth: column.minWidth,
              render: (record: WorkbenchRecord) =>
                column.render(record, mediaContexts.data),
              exportValue: (record: WorkbenchRecord) =>
                column.exportValue
                  ? column.exportValue(record, mediaContexts.data)
                  : textValue(record, column.field),
            } satisfies AxisSchemaFieldRenderer,
          ]),
        ),
      ),
    [mediaContexts.data, recordWorkspaceConfiguration],
  );
  const configuredRecordColumnKeys = recordColumnKeysByWorkspace[recordColumnStateKey];
  const selectedMediaSetCode =
    currentItem?.id === 'media-sets' ? textValue(selectedRecord, 'code') : '—';
  const selectedMediaCode =
    currentItem?.id === 'media' ? textValue(selectedRecord, 'code') : '—';
  const selectedMediaUsage = useQuery({
    enabled: Boolean(
      currentItem?.id === 'media' &&
      connection &&
      mediaReferenceSchema &&
      selectedMediaCode !== '—',
    ),
    queryKey: [
      'media-management',
      'selected-media-usage',
      connection?.endpoint,
      configuration.enterpriseCode,
      selectedMediaCode,
    ],
    queryFn: () =>
      loadWorkbenchRecords(
        connection!,
        mediaReferenceSchema!,
        configuration,
        buildRecordQuery(
          mediaReferenceSchema!,
          '',
          buildEqualsFilter('mediaCode', selectedMediaCode),
        ),
      ),
  });
  const selectedMediaImportHistory = useQuery({
    enabled: Boolean(
      currentItem?.id === 'media' && importConnection && selectedMediaCode !== '—',
    ),
    queryKey: [
      'media-management',
      'selected-media-import-history',
      importConnection?.endpoint,
      configuration.enterpriseCode,
      selectedMediaCode,
    ],
    queryFn: () =>
      loadImportHistoryForMediaCode(
        importConnection!,
        configuration,
        selectedMediaCode,
      ),
  });
  const mediaSetEntries = useQuery({
    enabled: Boolean(
      currentItem?.id === 'media-sets' &&
      connection &&
      mediaSetEntrySchema &&
      selectedMediaSetCode !== '—',
    ),
    queryKey: [
      'media-management',
      'media-set-entries',
      connection?.endpoint,
      configuration.enterpriseCode,
      selectedMediaSetCode,
    ],
    queryFn: () =>
      loadWorkbenchRecords(
        connection!,
        mediaSetEntrySchema!,
        configuration,
        buildRecordQuery(
          mediaSetEntrySchema!,
          '',
          buildEqualsFilter('mediaSetCode', selectedMediaSetCode),
        ),
      ),
  });
  const storagePolicies = useQuery({
    enabled: Boolean(
      (currentItem?.id === 'storage-delivery' || currentItem?.id === 'media') &&
      connection &&
      mediaContexts.isError,
    ),
    queryKey: [
      'media-management',
      'storage-delivery-fallback',
      connection?.endpoint,
      configuration.enterpriseCode,
    ],
    queryFn: () => loadMediaFolderUploadPolicies(connection!, configuration),
  });
  const storageProviderSummary = useQuery({
    enabled: Boolean(currentItem?.id === 'storage-delivery' && connection),
    queryKey: [
      'media-management',
      'storage-provider-summary',
      connection?.endpoint,
      configuration.enterpriseCode,
    ],
    queryFn: () => loadMediaStorageProviderSummary(connection!, configuration),
  });
  const effectiveStoragePolicies = useMemo(
    () =>
      mediaContexts.data
        ? folderUploadPoliciesFromContexts(mediaContexts.data)
        : (storagePolicies.data ?? []),
    [mediaContexts.data, storagePolicies.data],
  );
  const storagePolicyLoading =
    mediaContexts.isLoading || (mediaContexts.isError && storagePolicies.isLoading);
  const storagePolicyError =
    mediaContexts.isError && storagePolicies.isError
      ? (storagePolicies.error ?? mediaContexts.error)
      : undefined;
  const refreshMediaRecords = (uploaded?: MediaUploadResult) => {
    if (uploaded) setSelectedRecordCode(uploaded.code);
    void queryClient.invalidateQueries({ queryKey: ['media-management'] });
  };

  if (!currentItem) {
    return (
      <WorkspaceContainer>
        <Alert severity="warning">
          Media Management navigation is not available for this employee session.
        </Alert>
      </WorkspaceContainer>
    );
  }

  return (
    <WorkspaceContainer>
      <Stack spacing={3}>
        <Box>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ alignItems: { md: 'flex-end' }, justifyContent: 'space-between' }}
          >
            <WorkspaceHeading
              description="Govern media lifecycle, folders, usage, and delivery."
              eyebrow="Governed media operations"
              help={currentItem.help}
              title="Media Management"
            />
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip
                color={connection ? 'success' : 'default'}
                label={connection ? connection.state : 'Unavailable'}
              />
              <Chip label={`Enterprise: ${humanize(configuration.enterpriseCode)}`} />
            </Stack>
          </Stack>
        </Box>

        {currentItem.id === 'media-management' ? (
          <Grid container spacing={2}>
            {childItems.map((item) => {
              const workspace = recordWorkspaceConfigurations[item.id];
              return (
                <Grid key={item.id} size={{ xs: 12, md: 6, xl: 4 }}>
                  <Card
                    component={RouterLink}
                    to={item.route}
                    variant="outlined"
                    sx={{
                      color: 'inherit',
                      display: 'block',
                      height: '100%',
                      textDecoration: 'none',
                      transition:
                        'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: 3,
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          sx={{ alignItems: 'flex-start' }}
                        >
                          <ShellIcon color="primary" name={item.icon} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography component="h2" variant="h5">
                              {item.label}
                            </Typography>
                            <Typography color="text.secondary" variant="body2">
                              {sectionSummaries[item.id] ??
                                'Manage this governed media capability.'}
                            </Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                          {workspace?.schemaName ? (
                            <Chip
                              label={`Schema: ${humanize(workspace.schemaName)}`}
                              size="small"
                            />
                          ) : (
                            <Chip label="Storage policy" size="small" />
                          )}
                          <Chip label="Backend governed" size="small" />
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        ) : null}

        {currentItem.id === 'media' ? (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  sx={{
                    alignItems: { md: 'center' },
                    justifyContent: 'space-between',
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography component="h2" variant="h4">
                      Upload media
                    </Typography>
                    <Typography color="text.secondary">
                      Add governed media through nMedia upload policies before reviewing
                      or selecting media records.
                    </Typography>
                  </Box>
                  <IconButton
                    aria-label={
                      mediaWorkspaceSection === 'upload'
                        ? 'Collapse upload media'
                        : 'Expand upload media'
                    }
                    aria-expanded={mediaWorkspaceSection === 'upload'}
                    onClick={() => {
                      setMediaWorkspaceSection(
                        mediaWorkspaceSection === 'upload' ? 'records' : 'upload',
                      );
                    }}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      bgcolor:
                        mediaWorkspaceSection === 'upload'
                          ? 'primary.main'
                          : 'background.paper',
                      color:
                        mediaWorkspaceSection === 'upload'
                          ? 'primary.contrastText'
                          : 'text.primary',
                      '&:hover': {
                        bgcolor:
                          mediaWorkspaceSection === 'upload'
                            ? 'primary.dark'
                            : 'action.hover',
                      },
                    }}
                  >
                    <ShellIcon
                      fontSize="small"
                      name={
                        mediaWorkspaceSection === 'upload'
                          ? 'chevron-up'
                          : 'chevron-down'
                      }
                    />
                  </IconButton>
                </Stack>
                {mediaWorkspaceSection === 'upload' ? (
                  <MediaUploadWizard
                    connection={connection}
                    configuration={configuration}
                    enterpriseCode={mediaEnterpriseCode}
                    error={storagePolicyError}
                    formatBytes={formatBytes}
                    loading={storagePolicyLoading}
                    tenantCode={props.bootstrap.tenantCode}
                    policies={effectiveStoragePolicies}
                    sourceContexts={mediaContexts.data}
                    onEnterpriseCodeChange={(enterpriseCode) => {
                      setMediaEnterpriseCode(enterpriseCode);
                      setSelectedRecordCode(undefined);
                      setRecordPage(0);
                    }}
                    onUploaded={(uploaded) => {
                      setMediaWorkspaceSection('records');
                      refreshMediaRecords(uploaded);
                    }}
                  />
                ) : (
                  <Typography color="text.secondary" variant="body2">
                    Upload media is collapsed. Expand it when you want to add a new
                    media file.
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {recordWorkspaceConfiguration ? (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2.5}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography component="h2" variant="h4">
                      {recordWorkspaceConfiguration.title}
                    </Typography>
                    <Typography color="text.secondary">
                      {currentItem.id === 'media'
                        ? 'Search, select, and inspect governed media metadata.'
                        : recordWorkspaceConfiguration.description}
                    </Typography>
                  </Box>
                  {currentItem.id === 'media' ? (
                    <IconButton
                      aria-label={
                        mediaWorkspaceSection === 'records'
                          ? 'Collapse media records'
                          : 'Expand media records'
                      }
                      aria-expanded={mediaWorkspaceSection === 'records'}
                      onClick={() => {
                        setMediaWorkspaceSection(
                          mediaWorkspaceSection === 'records' ? 'upload' : 'records',
                        );
                      }}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        bgcolor:
                          mediaWorkspaceSection === 'records'
                            ? 'primary.main'
                            : 'background.paper',
                        color:
                          mediaWorkspaceSection === 'records'
                            ? 'primary.contrastText'
                            : 'text.primary',
                        '&:hover': {
                          bgcolor:
                            mediaWorkspaceSection === 'records'
                              ? 'primary.dark'
                              : 'action.hover',
                        },
                      }}
                    >
                      <ShellIcon
                        fontSize="small"
                        name={
                          mediaWorkspaceSection === 'records'
                            ? 'chevron-up'
                            : 'chevron-down'
                        }
                      />
                    </IconButton>
                  ) : (
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        alignItems: 'center',
                        flexShrink: 0,
                        flexWrap: 'wrap',
                        justifyContent: { xs: 'flex-start', md: 'flex-end' },
                      }}
                    >
                      {currentItem.id === 'media-folders' &&
                      currentSchema?.mutationMode === 'GENERATED_CRUD' &&
                      currentSchema.operations.includes('create') ? (
                        <Button
                          variant={
                            mediaFolderCrudMode === 'create' ? 'contained' : 'outlined'
                          }
                          onClick={() => {
                            setSelectedRecordCode(undefined);
                            setMediaFolderCrudMode(
                              mediaFolderCrudMode === 'create' ? 'none' : 'create',
                            );
                          }}
                        >
                          Create folder
                        </Button>
                      ) : null}
                      {currentItem.id !== 'media' &&
                      currentItem.id !== 'media-folders' &&
                      currentItem.id !== 'storage-delivery' &&
                      currentSchema?.mutationMode === 'GENERATED_CRUD' &&
                      currentSchema.operations.includes('create') ? (
                        <Button
                          variant={
                            schemaRecordCrudMode === 'create' ? 'contained' : 'outlined'
                          }
                          onClick={() => {
                            setSelectedRecordCode(undefined);
                            setSchemaRecordCrudMode(
                              schemaRecordCrudMode === 'create' ? 'none' : 'create',
                            );
                          }}
                        >
                          Create {schemaRecordLabel(recordWorkspaceConfiguration)}
                        </Button>
                      ) : null}
                      <Chip
                        label={`${records.data?.totalCount ?? 0} ${recordWorkspaceConfiguration.recordCountLabel}`}
                      />
                      {connection ? null : (
                        <Chip color="default" label="Media service unavailable" />
                      )}
                    </Stack>
                  )}
                </Stack>

                {currentItem.id !== 'media' || mediaWorkspaceSection === 'records' ? (
                  <>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1.5}
                      sx={{ alignItems: { md: 'center' } }}
                    >
                      <TextField
                        fullWidth
                        placeholder={recordWorkspaceConfiguration.searchPlaceholder}
                        value={recordSearch}
                        onChange={(event) => {
                          setSelectedRecordCode(undefined);
                          setRecordPage(0);
                          setRecordSearch(event.target.value);
                        }}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <ShellIcon color="action" name="search" />
                              </InputAdornment>
                            ),
                            endAdornment: recordSearch ? (
                              <InputAdornment position="end">
                                <IconButton
                                  aria-label={`Clear ${recordWorkspaceConfiguration.title.toLowerCase()} search`}
                                  edge="end"
                                  onClick={() => {
                                    setSelectedRecordCode(undefined);
                                    setRecordPage(0);
                                    setRecordSearch('');
                                  }}
                                >
                                  ×
                                </IconButton>
                              </InputAdornment>
                            ) : undefined,
                          },
                        }}
                      />
                      {mediaSourceFacetOption ? (
                        <TextField
                          label={mediaSourceFacetOption.filter.label}
                          select
                          sx={{ minWidth: { xs: '100%', md: 280 } }}
                          value={
                            recordFacetFilters[
                              facetStateKey(mediaSourceFacetOption.filter.key)
                            ] ?? 'ALL'
                          }
                          onChange={(event) => {
                            setSelectedRecordCode(undefined);
                            setRecordPage(0);
                            setRecordFacetFilters((current) => ({
                              ...current,
                              [facetStateKey(mediaSourceFacetOption.filter.key)]:
                                event.target.value,
                            }));
                          }}
                        >
                          <MenuItem value="ALL">
                            {mediaSourceFacetOption.filter.allLabel}
                          </MenuItem>
                          {mediaSourceFacetOption.options.map((option) => (
                            <MenuItem key={option} value={option}>
                              {mediaSourceFacetOption.filter.optionLabel
                                ? mediaSourceFacetOption.filter.optionLabel(option)
                                : option}
                            </MenuItem>
                          ))}
                        </TextField>
                      ) : null}
                    </Stack>

                    {currentFacetFilters.length > 0 &&
                    !mediaSourceFacetOption &&
                    facetFilterOptions.length > 0 ? (
                      <Box
                        sx={{
                          backgroundColor: 'background.default',
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 2,
                          p: 2,
                        }}
                      >
                        <Stack spacing={1.5}>
                          <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={1.5}
                            sx={{
                              alignItems: { md: 'center' },
                              justifyContent: 'space-between',
                            }}
                          >
                            <Box>
                              <Typography component="h3" variant="h6">
                                Filter{' '}
                                {recordWorkspaceConfiguration.title.toLowerCase()}
                              </Typography>
                            </Box>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                            >
                              <Chip
                                label={`${visibleRecords.length} shown from ${totalRecordCount}`}
                                size="small"
                              />
                              <Button
                                disabled={
                                  !recordSearch.trim() && !hasActiveFacetFilters
                                }
                                size="small"
                                variant="text"
                                onClick={() => {
                                  setSelectedRecordCode(undefined);
                                  setRecordPage(0);
                                  setRecordSearch('');
                                  setRecordFacetFilters({});
                                }}
                              >
                                Reset filters
                              </Button>
                            </Stack>
                          </Stack>
                          <Grid container spacing={1.5}>
                            {facetFilterOptions.map(({ filter, options }) => (
                              <Grid
                                key={filter.key}
                                size={{
                                  xs: 12,
                                  md: 4,
                                  lg: facetFilterOptions.length > 4 ? 2.4 : 3,
                                }}
                              >
                                <TextField
                                  fullWidth
                                  label={filter.label}
                                  select
                                  size="small"
                                  value={
                                    recordFacetFilters[facetStateKey(filter.key)] ??
                                    'ALL'
                                  }
                                  onChange={(event) => {
                                    setSelectedRecordCode(undefined);
                                    setRecordPage(0);
                                    setRecordFacetFilters((current) => ({
                                      ...current,
                                      [facetStateKey(filter.key)]: event.target.value,
                                    }));
                                  }}
                                >
                                  <MenuItem value="ALL">{filter.allLabel}</MenuItem>
                                  {options.map((option) => (
                                    <MenuItem key={option} value={option}>
                                      {filter.optionLabel
                                        ? filter.optionLabel(option)
                                        : option}
                                    </MenuItem>
                                  ))}
                                </TextField>
                              </Grid>
                            ))}
                          </Grid>
                        </Stack>
                      </Box>
                    ) : null}

                    {currentItem.id === 'media-usage' && usageMediaCode ? (
                      <Alert
                        action={
                          <Button
                            component={RouterLink}
                            size="small"
                            to="/media/usage"
                            variant="text"
                          >
                            Clear usage filter
                          </Button>
                        }
                        severity="info"
                      >
                        Showing references for media code {usageMediaCode}. Search can
                        still narrow this filtered result set.
                      </Alert>
                    ) : null}

                    {schemas.isLoading || records.isLoading ? (
                      <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{ alignItems: 'center' }}
                      >
                        <CircularProgress size={24} />
                        <Typography color="text.secondary">
                          Loading {recordWorkspaceConfiguration.title.toLowerCase()}…
                        </Typography>
                      </Stack>
                    ) : schemas.error || records.error ? (
                      <Alert severity="error">
                        {schemas.error instanceof Error
                          ? schemas.error.message
                          : records.error instanceof Error
                            ? records.error.message
                            : `${recordWorkspaceConfiguration.title} are unavailable.`}
                      </Alert>
                    ) : !currentSchema ? (
                      <Alert severity="warning">
                        The authorized {recordWorkspaceConfiguration.schemaName} media
                        schema is not available for this employee session.
                      </Alert>
                    ) : (
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, xl: 8 }}>
                          <AxisSchemaDataListing
                            ariaLabel={recordWorkspaceConfiguration.title}
                            columnsLabel="Columns"
                            defaultVisibleColumnKeys={defaultRecordColumnKeys}
                            emptyMessage={recordWorkspaceConfiguration.emptyMessage}
                            exportFileName={`axis-${recordWorkspaceConfiguration.schemaName}`}
                            fieldRenderers={recordFieldRenderers}
                            footer={
                              <TablePagination
                                component="div"
                                count={totalRecordCount}
                                page={effectiveRecordPage}
                                rowsPerPage={effectiveRecordRowsPerPage}
                                rowsPerPageOptions={recordRowsPerPageOptions}
                                onPageChange={(_event, page) => {
                                  setRecordPage(page);
                                }}
                                onRowsPerPageChange={(event) => {
                                  setRecordRowsPerPage(
                                    Number.parseInt(event.target.value, 10),
                                  );
                                  setRecordPage(0);
                                }}
                              />
                            }
                            getRowKey={(record, index) => {
                              const code = textValue(record, 'code');
                              return code === '—' ? `record-${String(index)}` : code;
                            }}
                            maxBodyHeight="100%"
                            minTableWidth={900}
                            records={pagedRecords}
                            schema={currentSchema}
                            selectedRowKey={textValue(selectedRecord, 'code')}
                            sortOverride={recordSortOverride}
                            toolbarStart={
                              <Typography color="text.secondary" variant="body2">
                                {visibleRecords.length} shown from {totalRecordCount}
                              </Typography>
                            }
                            visibleColumnKeys={configuredRecordColumnKeys}
                            onColumnKeysChange={(columnKeys) =>
                              setRecordColumnKeysByWorkspace((current) => ({
                                ...current,
                                [recordColumnStateKey]: Object.freeze([...columnKeys]),
                              }))
                            }
                            onRowClick={(record) => {
                              const code = textValue(record, 'code');
                              setMediaFolderCrudMode('none');
                              setSchemaRecordCrudMode('none');
                              setSelectedRecordCode(code === '—' ? undefined : code);
                            }}
                            onSortOverrideChange={(sort) => {
                              setSelectedRecordCode(undefined);
                              setRecordPage(0);
                              setRecordSortOverride(sort);
                            }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, xl: 4 }}>
                          <Box
                            sx={{
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 2,
                              height: '100%',
                              p: 2,
                            }}
                          >
                            {selectedRecord ||
                            mediaFolderCrudMode === 'create' ||
                            schemaRecordCrudMode === 'create' ? (
                              <Stack spacing={2}>
                                {selectedRecord ? (
                                  <>
                                    <Stack
                                      direction={{ xs: 'column', sm: 'row' }}
                                      spacing={1}
                                      sx={{
                                        alignItems: { sm: 'flex-start' },
                                        justifyContent: 'space-between',
                                      }}
                                    >
                                      <Box sx={{ minWidth: 0 }}>
                                        <Typography
                                          component="h3"
                                          sx={{ overflowWrap: 'anywhere' }}
                                          variant="h5"
                                        >
                                          {recordWorkspaceConfiguration.summary(
                                            selectedRecord,
                                          )}
                                        </Typography>
                                        <Typography
                                          color="text.secondary"
                                          sx={{ overflowWrap: 'anywhere' }}
                                        >
                                          {textValue(selectedRecord, 'code')}
                                        </Typography>
                                      </Box>
                                      {currentItem.id === 'media' &&
                                      currentSchema &&
                                      mediaDetailSectionEnabled('actions') ? (
                                        <SelectedMediaHeaderActions
                                          configuration={configuration}
                                          connection={connection}
                                          importHistory={
                                            selectedMediaImportHistory.data ?? []
                                          }
                                          importHistoryLoading={
                                            selectedMediaImportHistory.isLoading
                                          }
                                          mediaSchema={currentSchema}
                                          record={selectedRecord}
                                          usageRecords={
                                            selectedMediaUsage.data?.records ?? []
                                          }
                                          onChanged={() => {
                                            void records.refetch();
                                            void selectedMediaUsage.refetch();
                                          }}
                                        />
                                      ) : null}
                                    </Stack>
                                    <Divider />
                                  </>
                                ) : null}
                                {selectedRecord &&
                                currentItem.id === 'media' &&
                                mediaDetailSectionEnabled('preview') ? (
                                  <MediaDeliveryPreviewPanel
                                    accessToken={props.accessToken}
                                    connection={connection}
                                    record={selectedRecord}
                                  />
                                ) : null}
                                {selectedRecord &&
                                currentItem.id === 'media' &&
                                mediaDetailSectionEnabled('usage') &&
                                selectedMediaCode !== '—' ? (
                                  <MediaUsageSummaryPanel
                                    error={selectedMediaUsage.error}
                                    loading={selectedMediaUsage.isLoading}
                                    mediaCode={selectedMediaCode}
                                    records={selectedMediaUsage.data?.records ?? []}
                                  />
                                ) : null}
                                {selectedRecord &&
                                currentItem.id === 'media' &&
                                mediaDetailSectionEnabled('importExport') &&
                                selectedMediaCode !== '—' ? (
                                  <MediaImportExportLinkagePanel
                                    error={selectedMediaImportHistory.error}
                                    importConnectionAvailable={Boolean(
                                      importConnection,
                                    )}
                                    importHistory={
                                      selectedMediaImportHistory.data ?? []
                                    }
                                    loading={selectedMediaImportHistory.isLoading}
                                    mediaCode={selectedMediaCode}
                                    record={selectedRecord}
                                    usageRecords={
                                      selectedMediaUsage.data?.records ?? []
                                    }
                                  />
                                ) : null}
                                {selectedRecord &&
                                currentItem.id === 'media-folders' ? (
                                  <MediaFolderPolicyImpactPanel
                                    record={selectedRecord}
                                  />
                                ) : null}
                                {currentItem.id === 'media-folders' && currentSchema ? (
                                  <MediaFolderPolicyActionsPanel
                                    configuration={configuration}
                                    connection={connection}
                                    folderSchema={currentSchema}
                                    mode={mediaFolderCrudMode}
                                    record={selectedRecord}
                                    onChanged={(changedRecord) => {
                                      setSelectedRecordCode(
                                        changedRecord
                                          ? textValue(changedRecord, 'code')
                                          : undefined,
                                      );
                                      void records.refetch();
                                    }}
                                    onModeChange={setMediaFolderCrudMode}
                                  />
                                ) : null}
                                {currentItem.id !== 'media' &&
                                currentItem.id !== 'media-folders' &&
                                currentItem.id !== 'storage-delivery' &&
                                currentSchema ? (
                                  <SchemaRecordManagementPanel
                                    configuration={configuration}
                                    connection={connection}
                                    mode={schemaRecordCrudMode}
                                    record={selectedRecord}
                                    schema={currentSchema}
                                    workspaceConfiguration={
                                      recordWorkspaceConfiguration
                                    }
                                    onChanged={(changedRecord) => {
                                      setSelectedRecordCode(
                                        changedRecord
                                          ? textValue(changedRecord, 'code')
                                          : undefined,
                                      );
                                      void records.refetch();
                                    }}
                                    onModeChange={setSchemaRecordCrudMode}
                                  />
                                ) : null}
                                {selectedRecord &&
                                currentItem.id === 'media-formats' ? (
                                  <MediaFormatUsagePanel
                                    contexts={mediaContexts.data}
                                    error={mediaContexts.error}
                                    loading={mediaContexts.isLoading}
                                    record={selectedRecord}
                                  />
                                ) : null}
                                {selectedRecord &&
                                (currentItem.id !== 'media' ||
                                  mediaDetailSectionEnabled('metadata')) ? (
                                  <MediaMetadataViewer
                                    fields={
                                      currentItem.id === 'media'
                                        ? mediaMetadataFields
                                        : recordWorkspaceConfiguration.details
                                    }
                                    hiddenPathNotice={
                                      recordWorkspaceConfiguration.hiddenPathNotice
                                    }
                                    record={selectedRecord}
                                  />
                                ) : null}
                                {selectedRecord && currentItem.id === 'media-sets' ? (
                                  <MediaSetEntriesPanel
                                    configuration={configuration}
                                    connection={connection}
                                    entries={mediaSetEntries.data?.records ?? []}
                                    error={mediaSetEntries.error}
                                    loading={mediaSetEntries.isLoading}
                                    onChanged={() => {
                                      void mediaSetEntries.refetch();
                                    }}
                                    schema={mediaSetEntrySchema}
                                    setCode={selectedMediaSetCode}
                                  />
                                ) : null}
                              </Stack>
                            ) : (
                              <Stack spacing={2}>
                                <Typography color="text.secondary">
                                  {recordWorkspaceConfiguration.detailEmptyMessage}
                                </Typography>
                                {currentItem.id === 'media-folders' && currentSchema ? (
                                  <MediaFolderPolicyActionsPanel
                                    configuration={configuration}
                                    connection={connection}
                                    folderSchema={currentSchema}
                                    mode={mediaFolderCrudMode}
                                    record={undefined}
                                    onChanged={(changedRecord) => {
                                      setSelectedRecordCode(
                                        changedRecord
                                          ? textValue(changedRecord, 'code')
                                          : undefined,
                                      );
                                      void records.refetch();
                                    }}
                                    onModeChange={setMediaFolderCrudMode}
                                  />
                                ) : null}
                                {currentItem.id !== 'media' &&
                                currentItem.id !== 'media-folders' &&
                                currentItem.id !== 'storage-delivery' &&
                                currentSchema ? (
                                  <SchemaRecordManagementPanel
                                    configuration={configuration}
                                    connection={connection}
                                    mode={schemaRecordCrudMode}
                                    record={undefined}
                                    schema={currentSchema}
                                    workspaceConfiguration={
                                      recordWorkspaceConfiguration
                                    }
                                    onChanged={(changedRecord) => {
                                      setSelectedRecordCode(
                                        changedRecord
                                          ? textValue(changedRecord, 'code')
                                          : undefined,
                                      );
                                      void records.refetch();
                                    }}
                                    onModeChange={setSchemaRecordCrudMode}
                                  />
                                ) : null}
                              </Stack>
                            )}
                          </Box>
                        </Grid>
                      </Grid>
                    )}
                  </>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {currentItem.id === 'storage-delivery' ? (
          <StorageDeliveryPolicyPanel
            connectionAvailable={Boolean(connection)}
            deliveryBaseUrl={connection?.endpoint}
            error={storagePolicyError}
            loading={storagePolicyLoading}
            policies={effectiveStoragePolicies}
            providerSummary={storageProviderSummary.data}
            providerSummaryError={storageProviderSummary.error}
            providerSummaryLoading={storageProviderSummary.isLoading}
          />
        ) : null}
      </Stack>
    </WorkspaceContainer>
  );
}
