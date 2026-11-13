import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TablePagination,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import {
  loadWorkbenchRecords,
  loadWorkbenchSchemas,
  type WorkbenchClientConfiguration,
} from '../../../workbench/api/workbenchClient';
import { AxisSchemaDataListing } from '../../../app/table/AxisSchemaDataListing';
import type {
  WorkbenchFilterGroup,
  WorkbenchRecord,
  WorkbenchRecordPage,
  WorkbenchRecordQuery,
  WorkbenchSchema,
} from '../../../workbench/api/workbenchContracts';
import { SchemaQueryBuilder } from '../../../schema/query/SchemaQueryBuilder';
import {
  downloadDataExportMedia,
  generateDataExport,
  loadDataExportWorkspace,
  type DataReleaseClientConfiguration,
} from '../api/dataReleaseClient';
import type { DataExportFileFormat } from '../api/dataReleaseContracts';
import { saveDataExportDownload } from '../importExportPresentation';

import {
  dataOperationTargets,
  dataOperationTargetDestination,
  requestedExportSource,
} from '../api/dataOperationTargets';

interface ExportWorkspaceProps {
  readonly sourceSearch?: string | undefined;
  readonly scope: string;
  readonly onPendingChange: (pending: boolean) => void;
  readonly onInspectHistory?: (
    connection: AxisModuleConnection,
    mediaCode?: string,
  ) => void;
  readonly configuration: DataReleaseClientConfiguration;
  readonly enterpriseCode: string;
  readonly exportConnections: readonly AxisModuleConnection[];
  readonly mediaConnections: readonly AxisModuleConnection[];
  readonly schemaConnections: readonly AxisModuleConnection[];
  readonly tenantCode: string;
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function schemaLabel(schema: WorkbenchSchema): string {
  return `${schema.label} - ${titleCase(schema.moduleName)}`;
}

function recordKey(record: WorkbenchRecord, index: number): string {
  const parts = [record.code, record.id, record._id, record.versionId, record.revision]
    .filter(
      (candidate) =>
        typeof candidate === 'string' ||
        typeof candidate === 'number' ||
        typeof candidate === 'boolean',
    )
    .map(String);
  if (parts.length > 1) return parts.join(':');
  for (const candidate of [record.code, record.id, record._id]) {
    if (
      typeof candidate === 'string' ||
      typeof candidate === 'number' ||
      typeof candidate === 'boolean'
    ) {
      return String(candidate);
    }
  }
  return `export-preview-record-${index.toString()}`;
}

function previewColumns(schema: WorkbenchSchema | undefined): readonly string[] {
  if (!schema) return Object.freeze([]);
  const primary = schema.displayProperties.length
    ? schema.displayProperties
    : [schema.displayProperty];
  const fallback = schema.fields
    .filter((field) => !field.readOnly && field.type !== 'object')
    .map((field) => field.name);
  return Object.freeze([...new Set([...primary, ...fallback])].slice(0, 6));
}

function formatBytes(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value < 1024) return `${value.toString()} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExportWorkspace(props: ExportWorkspaceProps) {
  return <ExportWorkspaceContent key={props.enterpriseCode.trim()} {...props} />;
}

function ExportWorkspaceContent(props: ExportWorkspaceProps) {
  // The parent remounts this owner on actor or exact runtime/scope retirement.
  const lifetime = useRef({ active: true });
  useEffect(() => {
    const owner = lifetime.current;
    owner.active = true;
    return () => {
      owner.active = false;
    };
  }, []);
  const [targetEnterpriseCode, setTargetEnterpriseCode] = useState(
    props.enterpriseCode.trim(),
  );
  const [schemaSelection, setSchemaSelection] = useState<string>();
  const [sourceHint] = useState(props.sourceSearch ?? '');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<WorkbenchFilterGroup | undefined>(undefined);
  const [sort, setSort] = useState<WorkbenchRecordQuery['sort'] | undefined>(undefined);
  const [previewColumnKeys, setPreviewColumnKeys] = useState<readonly string[]>(
    Object.freeze([]),
  );
  const [format, setFormat] = useState<DataExportFileFormat>('csv');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [previewResult, setPreviewResult] = useState<WorkbenchRecordPage | undefined>(
    undefined,
  );
  const workspaceEnterpriseCode = props.enterpriseCode.trim();
  const selectedEnterpriseCode = targetEnterpriseCode.trim();
  const selectedClientConfiguration = useMemo<DataReleaseClientConfiguration>(
    () => ({
      ...props.configuration,
      enterpriseCode:
        selectedEnterpriseCode || props.configuration.enterpriseCode.trim(),
    }),
    [props.configuration, selectedEnterpriseCode],
  );

  const workbenchConfiguration = useMemo<WorkbenchClientConfiguration>(
    () => ({
      accessToken: selectedClientConfiguration.accessToken,
      enterpriseCode: selectedClientConfiguration.enterpriseCode,
      timeoutMs: selectedClientConfiguration.timeoutMs,
    }),
    [
      selectedClientConfiguration.accessToken,
      selectedClientConfiguration.enterpriseCode,
      selectedClientConfiguration.timeoutMs,
    ],
  );

  const hasEnterprise = selectedEnterpriseCode.length > 0;
  const schemas = useQuery({
    queryKey: [
      'data-export-schemas',
      props.scope,
      selectedClientConfiguration.enterpriseCode,
    ],
    queryFn: () => {
      if (props.schemaConnections.length === 0) {
        throw new Error('Schema discovery is unavailable');
      }
      return loadWorkbenchSchemas(props.schemaConnections, workbenchConfiguration);
    },
    enabled: props.schemaConnections.length > 0 && hasEnterprise,
  });
  const schemaOptions = useMemo(
    () =>
      dataOperationTargets(
        schemas.data ?? [],
        props.schemaConnections,
        'export',
        props.exportConnections,
        props.mediaConnections,
      ).filter((target) => target.schema.operations.includes('search')),
    [
      schemas.data,
      props.schemaConnections,
      props.exportConnections,
      props.mediaConnections,
    ],
  );
  const selectedTarget =
    schemaSelection === undefined
      ? schemas.isSuccess
        ? requestedExportSource(sourceHint, schemaOptions)
        : undefined
      : schemaOptions.find((target) => target.key === schemaSelection);
  const selectedSchema = selectedTarget?.schema;
  const selectedConnection = selectedTarget?.source;
  const selectedExportConnection = selectedTarget?.operationConnection;
  const selectedMediaConnection = selectedTarget?.mediaConnection;
  const selectedSort = sort ?? selectedSchema?.queryCapabilities.defaultSort;
  const exportWorkspace = useQuery({
    queryKey: [
      'data-export-availability',
      props.scope,
      selectedClientConfiguration.enterpriseCode,
      selectedExportConnection?.instanceId,
      selectedExportConnection?.endpoint,
    ],
    queryFn: () => {
      if (!selectedExportConnection)
        throw new Error('Export availability is unavailable for this destination');
      return loadDataExportWorkspace(
        selectedExportConnection,
        selectedClientConfiguration,
      );
    },
    enabled: Boolean(hasEnterprise && selectedSchema && selectedExportConnection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 0,
  });
  const exportFormats = exportWorkspace.data?.formats ?? [];
  const selectedFormat = exportFormats.includes(format) ? format : exportFormats[0];
  const columns = previewColumns(selectedSchema);
  const canChooseSchema = hasEnterprise && !schemas.isError && !schemas.isFetching;
  const canPreview = Boolean(canChooseSchema && selectedSchema && selectedConnection);
  const canGenerate = Boolean(
    canPreview &&
    selectedExportConnection &&
    selectedMediaConnection &&
    exportWorkspace.isSuccess &&
    !exportWorkspace.isFetching &&
    !exportWorkspace.isError &&
    exportWorkspace.data.availability === 'AVAILABLE' &&
    selectedFormat,
  );

  const preview = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!selectedSchema || !selectedConnection) {
        throw new Error('Choose an export model before previewing records');
      }
      return loadWorkbenchRecords(
        selectedConnection,
        selectedSchema,
        workbenchConfiguration,
        {
          search,
          filters,
          pageNumber: page + 1,
          pageSize: rowsPerPage,
          sort: selectedSort ?? selectedSchema.queryCapabilities.defaultSort,
        },
      );
    },
    onMutate: () => setPreviewResult(undefined),
    onSuccess: setPreviewResult,
  });
  const generate = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!canGenerate || preview.isError || !selectedFormat)
        throw new Error(
          'Refresh current export availability and preview before generating a file',
        );
      if (!selectedExportConnection) {
        throw new Error('Export service is unavailable for the selected model runtime');
      }
      if (!selectedMediaConnection) {
        throw new Error('Media service is unavailable for the selected model runtime');
      }
      if (!hasEnterprise)
        throw new Error('Select the target enterprise before exporting');
      if (!selectedSchema) throw new Error('Choose an export model before exporting');
      return generateDataExport(selectedExportConnection, selectedClientConfiguration, {
        enterpriseCode: selectedEnterpriseCode,
        moduleName: selectedSchema.moduleName,
        schemaName: selectedSchema.schemaName,
        format: selectedFormat,
        query: {
          search,
          filters,
          pageNumber: 1,
          pageSize: selectedSchema.queryCapabilities.maximumPageSize,
          sort: selectedSort ?? selectedSchema.queryCapabilities.defaultSort,
        },
      });
    },
  });
  const download = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!selectedMediaConnection)
        throw new Error('Media download service is unavailable');
      if (!generate.data) throw new Error('Generate an export file before downloading');
      const file = await downloadDataExportMedia(
        selectedMediaConnection,
        selectedClientConfiguration,
        generate.data.media,
      );
      if (!lifetime.current.active) return undefined;
      saveDataExportDownload(file);
      return file.fileName;
    },
  });
  const busy = preview.isPending || generate.isPending || download.isPending;
  const { onPendingChange } = props;
  useEffect(() => {
    onPendingChange(busy);
    return () => onPendingChange(false);
  }, [busy, onPendingChange]);
  const operationError =
    preview.error?.message ?? generate.error?.message ?? download.error?.message;

  return (
    <Stack spacing={1.5}>
      <Alert severity="info">
        Export business records as CSV or JSON. Preview your selection, generate a file,
        then download it.
      </Alert>

      {props.exportConnections.length === 0 ? (
        <Alert severity="error">
          Export service is unavailable. Start or register the export module before
          generating files.
        </Alert>
      ) : null}

      {props.mediaConnections.length === 0 ? (
        <Alert severity="error">
          Media download service is unavailable. Generated files require the media
          module for governed delivery.
        </Alert>
      ) : null}

      <Stack spacing={1.25}>
        <Card variant="outlined" sx={{ bgcolor: 'background.paper' }}>
          <CardContent sx={{ p: { xs: 1.75, md: 2 } }}>
            <Stack spacing={1.25}>
              <Stack spacing={0.25}>
                <Typography component="h2" variant="h6">
                  1. Confirm target destination
                </Typography>
                <Typography color="text.secondary">
                  Your current enterprise determines which records you can export.
                </Typography>
              </Stack>
              <Paper
                elevation={0}
                sx={{
                  bgcolor: 'background.default',
                  border: 1,
                  borderColor: 'divider',
                  p: 1.25,
                }}
              >
                <Stack spacing={1}>
                  <TextField
                    fullWidth
                    label="Target enterprise"
                    select
                    disabled={busy || !workspaceEnterpriseCode}
                    value={targetEnterpriseCode}
                    onChange={(event) => {
                      setTargetEnterpriseCode(event.target.value);
                      setSchemaSelection('');
                      setSearch('');
                      setFilters(undefined);
                      setSort(undefined);
                      setPreviewResult(undefined);
                      preview.reset();
                      generate.reset();
                    }}
                  >
                    <MenuItem value={workspaceEnterpriseCode}>
                      {titleCase(workspaceEnterpriseCode)}
                    </MenuItem>
                  </TextField>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                    <Typography
                      color="text.secondary"
                      sx={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Technical tenant
                    </Typography>
                    <Typography sx={{ fontWeight: 700 }}>{props.tenantCode}</Typography>
                  </Stack>
                </Stack>
              </Paper>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ bgcolor: 'background.paper' }}>
          <CardContent sx={{ p: { xs: 1.75, md: 2 } }}>
            <Stack spacing={1.25}>
              <Stack spacing={0.25}>
                <Typography component="h2" variant="h6">
                  2. Choose export model
                </Typography>
                <Typography color="text.secondary">
                  Choose a model to preview its records and check file-export
                  availability.
                </Typography>
              </Stack>
              {!hasEnterprise ? (
                <Alert severity="info">Select the target enterprise first.</Alert>
              ) : null}
              {hasEnterprise && schemas.isLoading ? (
                <Box sx={{ display: 'grid', minHeight: 120, placeItems: 'center' }}>
                  <CircularProgress aria-label="Loading export models" />
                </Box>
              ) : null}
              {hasEnterprise && schemas.isError ? (
                <Alert severity="error">{schemas.error.message}</Alert>
              ) : null}
              {schemaOptions.length > 0 ? (
                <Autocomplete
                  fullWidth
                  autoHighlight
                  disablePortal
                  disabled={busy || !canChooseSchema}
                  getOptionKey={(target) => target.key}
                  groupBy={(target) => titleCase(target.schema.moduleName)}
                  getOptionLabel={(target) => schemaLabel(target.schema)}
                  isOptionEqualToValue={(option, value) => option.key === value.key}
                  options={schemaOptions}
                  value={selectedTarget ?? null}
                  onChange={(_event, target) => {
                    setSchemaSelection(target?.key ?? '');
                    setSearch('');
                    setFilters(undefined);
                    setSort(target?.schema.queryCapabilities.defaultSort);
                    setPreviewColumnKeys(Object.freeze([]));
                    setPreviewResult(undefined);
                    preview.reset();
                    generate.reset();
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Export model"
                      placeholder="Search schemas by model or module"
                    />
                  )}
                  renderOption={(optionProps, target) => (
                    <Box component="li" {...optionProps} key={target.key}>
                      <Stack spacing={0.25}>
                        <Typography component="span" sx={{ fontWeight: 700 }}>
                          {target.schema.label}
                        </Typography>
                        <Typography
                          color="text.secondary"
                          component="span"
                          variant="body2"
                        >
                          {target.schema.description ||
                            `${titleCase(target.schema.moduleName)} schema: ${target.schema.schemaName}`}
                        </Typography>
                        <Typography
                          color="text.secondary"
                          component="span"
                          variant="body2"
                        >
                          {dataOperationTargetDestination(target)}
                          {!target.operationConnection || !target.mediaConnection
                            ? ' · File generation unavailable at this destination.'
                            : ''}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                  slotProps={{
                    listbox: {
                      sx: {
                        '& .MuiAutocomplete-groupLabel': {
                          bgcolor: 'background.default',
                          color: 'text.secondary',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          letterSpacing: '0.12em',
                          lineHeight: 2.4,
                          textTransform: 'uppercase',
                        },
                      },
                    },
                  }}
                />
              ) : null}
              {selectedSchema ? (
                <Paper
                  elevation={0}
                  sx={(theme) => ({
                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                    border: 1,
                    borderColor: alpha(theme.palette.primary.main, 0.2),
                    p: 1.25,
                  })}
                >
                  <Stack spacing={0.75}>
                    <Typography component="p" sx={{ fontWeight: 700 }}>
                      {selectedSchema.label}
                    </Typography>
                    <Typography color="text.secondary">
                      {selectedSchema.description ||
                        `Export records from the ${selectedSchema.label} model.`}
                    </Typography>
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                      <Chip
                        label={`Data owner: ${titleCase(selectedSchema.moduleName)}`}
                        size="small"
                      />
                      <Chip
                        label={`Schema: ${selectedSchema.schemaName}`}
                        size="small"
                      />
                      {selectedConnection?.runtimeRole?.code ? (
                        <Chip
                          label={`Runtime: ${titleCase(selectedConnection.runtimeRole.code)}`}
                          size="small"
                        />
                      ) : null}
                      <Chip label="Operation: Search and export" size="small" />
                      {selectedSort ? (
                        <Chip
                          label={`Sort: ${titleCase(selectedSort.field)} ${selectedSort.direction}`}
                          size="small"
                        />
                      ) : null}
                    </Stack>
                  </Stack>
                </Paper>
              ) : null}
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ bgcolor: 'background.paper' }}>
          <CardContent sx={{ p: { xs: 1.75, md: 2 } }}>
            <Stack spacing={1.25}>
              <Stack spacing={0.25}>
                <Typography component="h2" variant="h6">
                  3. Build query and preview
                </Typography>
                <Typography color="text.secondary">
                  Search, filter and sort the records you need. Preview shows one page;
                  the file includes all matching records allowed by the export policy.
                  Column choices affect only the preview table.
                </Typography>
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1 }}>
                <TextField
                  fullWidth
                  disabled={busy || !canPreview}
                  label="Search records"
                  placeholder="Search using fields exposed by the selected schema"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(0);
                    setPreviewResult(undefined);
                    preview.reset();
                    generate.reset();
                  }}
                />
                <TextField
                  select
                  disabled={busy || !canPreview}
                  label="Rows to preview"
                  sx={{ minWidth: { md: 190 } }}
                  value={rowsPerPage}
                  onChange={(event) => {
                    setRowsPerPage(Number(event.target.value));
                    setPage(0);
                    setPreviewResult(undefined);
                    preview.reset();
                  }}
                >
                  {[10, 25, 50].map((size) => (
                    <MenuItem key={size} value={size}>
                      {size.toString()} records
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  disabled={!canPreview || busy}
                  variant="outlined"
                  onClick={() => preview.mutate()}
                >
                  {preview.isPending ? 'Previewing…' : 'Preview records'}
                </Button>
              </Stack>
              {selectedSchema ? (
                <Box inert={busy} aria-busy={busy}>
                  <SchemaQueryBuilder
                    capabilities={selectedSchema.queryCapabilities}
                    copy={{
                      addConditionLabel: 'Add condition',
                      addGroupLabel: 'Add group',
                      applyFiltersLabel: 'Apply conditions',
                      ascendingLabel: 'Ascending',
                      clearFiltersLabel: 'Clear conditions',
                      descendingLabel: 'Descending',
                      fieldLabel: 'Field',
                      filterBuilderLabel: 'Advanced conditions',
                      matchLabel: 'Match',
                      noFiltersSummaryLabel:
                        'No advanced conditions are applied. Text search and sort can still be used.',
                      operatorLabel: 'Operator',
                      removeLabel: 'Remove',
                      requestPreviewLabel: 'Query summary',
                      sortBuilderLabel: 'Sort results',
                      sortDirectionLabel: 'Direction',
                      sortFieldLabel: 'Sort field',
                      valueLabel: 'Value',
                    }}
                    sort={selectedSort}
                    value={filters}
                    onChange={(next) => {
                      if (busy) return;
                      setFilters(next);
                      setPage(0);
                      setPreviewResult(undefined);
                      preview.reset();
                      generate.reset();
                    }}
                    onSortChange={(next) => {
                      if (busy) return;
                      setSort(next);
                      setPage(0);
                      setPreviewResult(undefined);
                      preview.reset();
                      generate.reset();
                    }}
                  />
                </Box>
              ) : hasEnterprise ? (
                <Alert severity="info">
                  Choose an export model to build governed conditions and sort order.
                </Alert>
              ) : null}
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ bgcolor: 'background.paper' }}>
          <CardContent sx={{ p: { xs: 1.75, md: 2 } }}>
            <Stack spacing={1.25}>
              <Stack spacing={0.25}>
                <Typography component="h2" variant="h6">
                  4. Generate export file
                </Typography>
                <Typography color="text.secondary">
                  Choose a format, generate the file, then download that exact file. A
                  file is ready only after generation succeeds.
                </Typography>
              </Stack>
              {selectedSchema &&
              (!selectedExportConnection || !selectedMediaConnection) ? (
                <Alert severity="info">
                  File generation is unavailable at this model's destination.
                </Alert>
              ) : selectedSchema && exportWorkspace.isFetching ? (
                <Alert severity="info" role="status">
                  Checking export availability…
                </Alert>
              ) : selectedSchema && exportWorkspace.isError ? (
                <Alert severity="error">
                  Export availability could not be verified.{' '}
                  {exportWorkspace.error.message}
                </Alert>
              ) : selectedSchema && exportWorkspace.data ? (
                exportWorkspace.data.availability === 'AVAILABLE' ? (
                  <Chip
                    label="File generation available"
                    color="success"
                    sx={{ alignSelf: 'flex-start' }}
                  />
                ) : (
                  <Alert severity="info">{exportWorkspace.data.reason}</Alert>
                )
              ) : null}
              {selectedSchema && selectedExportConnection && selectedMediaConnection ? (
                <Button
                  variant="text"
                  sx={{ alignSelf: 'flex-start' }}
                  disabled={busy || exportWorkspace.isFetching}
                  onClick={() => {
                    void exportWorkspace.refetch();
                  }}
                >
                  Refresh export availability
                </Button>
              ) : null}
              <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1 }}>
                <TextField
                  select
                  disabled={busy || !canGenerate}
                  label="File type"
                  sx={{ minWidth: { sm: 180 } }}
                  value={selectedFormat ?? ''}
                  onChange={(event) => {
                    setFormat(event.target.value as DataExportFileFormat);
                    generate.reset();
                  }}
                >
                  {exportFormats.map((candidate) => (
                    <MenuItem key={candidate} value={candidate}>
                      {candidate.toUpperCase()}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  disabled={!canGenerate || busy || preview.isError || generate.isError}
                  variant="contained"
                  onClick={() => generate.mutate()}
                >
                  {generate.isPending ? 'Generating…' : 'Generate export'}
                </Button>
                {generate.data && canGenerate ? (
                  <Button
                    disabled={busy}
                    onClick={() => download.mutate()}
                    variant="outlined"
                  >
                    {download.isPending ? 'Downloading…' : 'Download generated file'}
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {operationError ? <Alert severity="error">{operationError}</Alert> : null}
      {generate.isError ? (
        <Alert
          severity="warning"
          action={
            selectedExportConnection && props.onInspectHistory ? (
              <Button
                onClick={() => props.onInspectHistory?.(selectedExportConnection)}
              >
                Inspect export history
              </Button>
            ) : undefined
          }
        >
          Check the original runtime’s history before starting another export.
        </Alert>
      ) : null}
      {generate.isSuccess ? (
        <Alert
          severity="success"
          action={
            selectedExportConnection && props.onInspectHistory ? (
              <Button
                onClick={() =>
                  props.onInspectHistory?.(
                    selectedExportConnection,
                    generate.data.media.mediaCode,
                  )
                }
              >
                Open export run
              </Button>
            ) : undefined
          }
        >
          Export generated as {generate.data.fileName}.{' '}
          {generate.data.summary.exportedRecords.toLocaleString()} record(s) exported
          into media {generate.data.media.mediaCode}.
        </Alert>
      ) : null}
      {generate.isSuccess ? (
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 1.5 }}>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
            <Chip label={`Media: ${generate.data.media.mediaCode}`} />
            <Chip label={`Format: ${generate.data.format.toUpperCase()}`} />
            {formatBytes(generate.data.media.sizeBytes) ? (
              <Chip label={formatBytes(generate.data.media.sizeBytes)} />
            ) : null}
            {generate.data.media.status ? (
              <Chip label={`Status: ${generate.data.media.status}`} />
            ) : null}
            {generate.data.summary.truncated ? (
              <Chip label="Truncated by policy" />
            ) : null}
          </Stack>
        </Paper>
      ) : null}

      {previewResult ? (
        <Paper
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', overflow: 'hidden' }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            sx={{
              alignItems: { md: 'center' },
              gap: 1,
              justifyContent: 'space-between',
              p: 1.5,
            }}
          >
            <Stack spacing={0.25}>
              <Typography component="h2" variant="h6">
                Preview results
              </Typography>
              <Typography color="text.secondary">
                Showing {previewResult.records.length.toLocaleString()} of{' '}
                {previewResult.totalCount.toLocaleString()} matching record(s).
              </Typography>
            </Stack>
            <Chip
              label={`${previewResult.totalCount.toLocaleString()} match${previewResult.totalCount === 1 ? '' : 'es'}`}
            />
          </Stack>
          {selectedSchema ? (
            <Box inert={busy} aria-busy={busy}>
              <AxisSchemaDataListing
                ariaLabel={`${selectedSchema.label} export preview`}
                columnsLabel="Preview columns"
                exportVisible={false}
                defaultVisibleColumnKeys={columns}
                emptyMessage="No records matched this export query."
                exportFileName={`axis-export-preview-${selectedSchema.schemaName}`}
                footer={
                  <TablePagination
                    component="div"
                    count={previewResult.totalCount}
                    page={page}
                    rowsPerPage={rowsPerPage}
                    rowsPerPageOptions={[10, 25, 50]}
                    onPageChange={(_event, nextPage) => {
                      if (busy) return;
                      setPage(nextPage);
                      setPreviewResult(undefined);
                      preview.reset();
                    }}
                    onRowsPerPageChange={(event) => {
                      if (busy) return;
                      setRowsPerPage(Number(event.target.value));
                      setPage(0);
                      setPreviewResult(undefined);
                      preview.reset();
                    }}
                  />
                }
                getRowKey={recordKey}
                maxBodyHeight={420}
                minTableWidth={900}
                records={previewResult.records}
                schema={selectedSchema}
                sortOverride={sort}
                toolbarStart={
                  <Typography color="text.secondary" variant="body2">
                    Preview is rendered from the selected backend schema fields.
                  </Typography>
                }
                visibleColumnKeys={previewColumnKeys}
                onColumnKeysChange={(columnKeys) => {
                  if (!busy) setPreviewColumnKeys(Object.freeze([...columnKeys]));
                }}
                onSortOverrideChange={(nextSort) => {
                  if (busy) return;
                  setSort(nextSort);
                  setPage(0);
                  setPreviewResult(undefined);
                  preview.reset();
                }}
              />
            </Box>
          ) : null}
        </Paper>
      ) : null}
    </Stack>
  );
}
