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
import { useEffect, useMemo, useState } from 'react';

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
  type DataReleaseClientConfiguration,
} from '../api/dataReleaseClient';
import type { DataExportFileFormat } from '../api/dataReleaseContracts';

interface ExportWorkspaceProps {
  readonly configuration: DataReleaseClientConfiguration;
  readonly enterpriseCode: string;
  readonly exportConnections: readonly AxisModuleConnection[];
  readonly mediaConnections: readonly AxisModuleConnection[];
  readonly schemaConnections: readonly AxisModuleConnection[];
  readonly tenantCode: string;
}

const exportFormats: readonly DataExportFileFormat[] = ['csv', 'json'];

function titleCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function schemaKey(schema: WorkbenchSchema): string {
  return `${schema.moduleName}/${schema.schemaName}`;
}

function schemaOptionKey(schema: WorkbenchSchema): string {
  return `${schema.connectionModuleName ?? schema.moduleName}/${schema.connectionInstanceId ?? 'unknown'}/${schemaKey(schema)}`;
}

function schemaLabel(schema: WorkbenchSchema): string {
  return `${schema.label} - ${titleCase(schema.moduleName)}`;
}

function recordKey(record: WorkbenchRecord, index: number): string {
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

function connectionMatchesRuntime(
  candidate: AxisModuleConnection,
  target: AxisModuleConnection,
): boolean {
  return (
    candidate.environment === target.environment &&
    candidate.server === target.server &&
    candidate.runtimeRole?.code === target.runtimeRole?.code
  );
}

function connectionMatchesEnvironment(
  candidate: AxisModuleConnection,
  target: AxisModuleConnection,
): boolean {
  return candidate.environment === target.environment;
}

function selectServiceConnectionForSchemaRuntime(
  target: AxisModuleConnection | undefined,
  serviceConnections: readonly AxisModuleConnection[],
): AxisModuleConnection | undefined {
  if (!target) return undefined;
  return (
    serviceConnections.find((connection) =>
      connectionMatchesRuntime(connection, target),
    ) ??
    serviceConnections.find((connection) =>
      connectionMatchesEnvironment(connection, target),
    ) ??
    serviceConnections[0]
  );
}

function runtimeCanGenerateExport(
  schemaConnection: AxisModuleConnection,
  exportConnections: readonly AxisModuleConnection[],
  mediaConnections: readonly AxisModuleConnection[],
): boolean {
  if (schemaConnection.runtimeRole?.publication === 'ONLINE') return false;
  return (
    Boolean(selectServiceConnectionForSchemaRuntime(schemaConnection, exportConnections)) &&
    Boolean(selectServiceConnectionForSchemaRuntime(schemaConnection, mediaConnections))
  );
}

function isExportSchemaSource(connection: AxisModuleConnection): boolean {
  return !['import', 'export'].includes(connection.moduleName);
}

function schemaConnectionModuleName(schema: WorkbenchSchema): string {
  return schema.connectionModuleName ?? schema.moduleName;
}

function findSchemaConnection(
  schema: WorkbenchSchema,
  connections: readonly AxisModuleConnection[],
): AxisModuleConnection | undefined {
  return (
    connections.find(
      (connection) =>
        connection.moduleName === schemaConnectionModuleName(schema) &&
        connection.instanceId === schema.connectionInstanceId,
    ) ??
    connections.find(
      (connection) => connection.instanceId === schema.connectionInstanceId,
    )
  );
}

function exportSchemaConnectionRank(
  schema: WorkbenchSchema,
  connection: AxisModuleConnection | undefined,
): number {
  if (!connection) return 100;
  const ownerRank = connection.moduleName === schema.moduleName ? -10 : 0;
  if (connection.runtimeRole?.publication === 'STAGED') return ownerRank;
  if (connection.runtimeRole?.publication === 'PROCESS') return ownerRank + 1;
  if (connection.runtimeRole?.publication === 'OPERATIONAL') return ownerRank + 2;
  return ownerRank + 3;
}

function preferredExportSchema(
  existing: WorkbenchSchema | undefined,
  candidate: WorkbenchSchema,
  connections: readonly AxisModuleConnection[],
): WorkbenchSchema {
  if (!existing) return candidate;
  const existingConnection = connections.find(
    (connection) =>
      connection.moduleName === schemaConnectionModuleName(existing) &&
      connection.instanceId === existing.connectionInstanceId,
  );
  const candidateConnection = connections.find(
    (connection) =>
      connection.moduleName === schemaConnectionModuleName(candidate) &&
      connection.instanceId === candidate.connectionInstanceId,
  );
  return exportSchemaConnectionRank(candidate, candidateConnection) <
    exportSchemaConnectionRank(existing, existingConnection)
    ? candidate
    : existing;
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
  const [targetEnterpriseCode, setTargetEnterpriseCode] = useState(
    props.enterpriseCode.trim(),
  );
  const [schemaSelection, setSchemaSelection] = useState('');
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

  useEffect(() => {
    setTargetEnterpriseCode(workspaceEnterpriseCode);
    setSchemaSelection('');
    setSearch('');
    setFilters(undefined);
    setSort(undefined);
    setPreviewColumnKeys(Object.freeze([]));
    setPreviewResult(undefined);
  }, [workspaceEnterpriseCode]);
  const hasEnterprise = selectedEnterpriseCode.length > 0;
  const schemas = useQuery({
    queryKey: ['data-export-schemas', selectedClientConfiguration.enterpriseCode],
    queryFn: () => {
      if (props.schemaConnections.length === 0) {
        throw new Error('Schema discovery is unavailable');
      }
      return loadWorkbenchSchemas(props.schemaConnections, workbenchConfiguration);
    },
    enabled: props.schemaConnections.length > 0 && hasEnterprise,
  });
  const schemaOptions = useMemo(() => {
    const byKey = new Map<string, WorkbenchSchema>();
    for (const schema of schemas.data ?? []) {
      const schemaConnection = findSchemaConnection(schema, props.schemaConnections);
      if (
        schemaConnection &&
        isExportSchemaSource(schemaConnection) &&
        schema.operations.includes('search') &&
        runtimeCanGenerateExport(
          schemaConnection,
          props.exportConnections,
          props.mediaConnections,
        )
      ) {
        byKey.set(
          schemaKey(schema),
          preferredExportSchema(byKey.get(schemaKey(schema)), schema, props.schemaConnections),
        );
      }
    }
    return Object.freeze([...byKey.values()]);
  }, [
    props.exportConnections,
    props.mediaConnections,
    props.schemaConnections,
    schemas.data,
  ]);
  const selectedSchema = useMemo(
    () => schemaOptions.find((schema) => schemaOptionKey(schema) === schemaSelection),
    [schemaOptions, schemaSelection],
  );
  const selectedSort = sort ?? selectedSchema?.queryCapabilities.defaultSort;
  const selectedConnection = useMemo(
    () => {
      if (!selectedSchema) return undefined;
      const selectedInstance = findSchemaConnection(
        selectedSchema,
        props.schemaConnections,
      );
      if (
        selectedInstance &&
        isExportSchemaSource(selectedInstance) &&
        selectedInstance.runtimeRole?.publication !== 'ONLINE'
      ) {
        return selectedInstance;
      }
      return (
        props.schemaConnections.find(
          (connection) =>
            connection.moduleName === selectedSchema.moduleName &&
            connection.state === 'UP' &&
            connection.runtimeRole?.publication !== 'ONLINE',
        ) ?? selectedInstance
      );
    },
    [props.schemaConnections, selectedSchema],
  );
  const selectedExportConnection = useMemo(() => {
    return selectServiceConnectionForSchemaRuntime(
      selectedConnection,
      props.exportConnections,
    );
  }, [props.exportConnections, selectedConnection]);
  const selectedMediaConnection = useMemo(() => {
    return selectServiceConnectionForSchemaRuntime(
      selectedConnection,
      props.mediaConnections,
    );
  }, [props.mediaConnections, selectedConnection]);
  const columns = useMemo(() => previewColumns(selectedSchema), [selectedSchema]);
  const canChooseSchema = hasEnterprise;
  const canPreview = Boolean(hasEnterprise && selectedSchema && selectedConnection);
  const canGenerate = Boolean(
    canPreview && selectedExportConnection && selectedMediaConnection,
  );

  const preview = useMutation({
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
    onSuccess: setPreviewResult,
  });
  const generate = useMutation({
    mutationFn: async () => {
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
        format,
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
    mutationFn: async () => {
      if (!selectedMediaConnection)
        throw new Error('Media download service is unavailable');
      if (!generate.data) throw new Error('Generate an export file before downloading');
      const file = await downloadDataExportMedia(
        selectedMediaConnection,
        selectedClientConfiguration,
        generate.data.media,
      );
      const objectUrl = URL.createObjectURL(file.blob);
      try {
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = file.fileName;
        anchor.rel = 'noreferrer';
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
      return file.fileName;
    },
  });
  const busy = preview.isPending || generate.isPending || download.isPending;
  const operationError =
    preview.error?.message ?? generate.error?.message ?? download.error?.message;

  return (
    <Stack spacing={1.5}>
      <Alert severity="info">
        Export data through nExport. Axis previews records through the schema workbench
        and asks the backend to generate a governed media file.
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
                  Records will be exported for the selected enterprise. Nodics resolves
                  the tenant from enterprise configuration for technical traceability.
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
                    disabled={!workspaceEnterpriseCode}
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
                  Select the backend schema that owns the records. The dropdown is
                  grouped by owning module and only includes runtimes that can
                  generate governed export media.
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
                  disabled={!canChooseSchema}
                  getOptionKey={schemaOptionKey}
                  groupBy={(schema) => titleCase(schema.moduleName)}
                  getOptionLabel={schemaLabel}
                  isOptionEqualToValue={(option, value) =>
                    option.moduleName === value.moduleName &&
                    option.schemaName === value.schemaName &&
                    option.connectionInstanceId === value.connectionInstanceId
                  }
                  options={schemaOptions}
                  value={selectedSchema ?? null}
                  onChange={(_event, schema) => {
                    setSchemaSelection(schema ? schemaOptionKey(schema) : '');
                    setSearch('');
                    setFilters(undefined);
                    setSort(schema?.queryCapabilities.defaultSort);
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
                  renderOption={(optionProps, schema) => (
                    <Box component="li" {...optionProps} key={schemaOptionKey(schema)}>
                      <Stack spacing={0.25}>
                        <Typography component="span" sx={{ fontWeight: 700 }}>
                          {schema.label}
                        </Typography>
                        <Typography
                          color="text.secondary"
                          component="span"
                          variant="body2"
                        >
                          {schema.description ||
                            `${titleCase(schema.moduleName)} schema: ${schema.schemaName}`}
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
                  Use the same schema workbench search contract that powers business
                  data browsing. Axis does not read database tables directly.
                </Typography>
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1 }}>
                <TextField
                  fullWidth
                  disabled={!canPreview}
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
                  disabled={!canPreview}
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
                    setFilters(next);
                    setPage(0);
                    setPreviewResult(undefined);
                    preview.reset();
                    generate.reset();
                  }}
                  onSortChange={(next) => {
                    setSort(next);
                    setPage(0);
                    setPreviewResult(undefined);
                    preview.reset();
                    generate.reset();
                  }}
                />
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
                  Choose an output format. The backend generates the file and stores it
                  as a governed media record in the data export folder.
                </Typography>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1 }}>
                <TextField
                  select
                  disabled={!canGenerate}
                  label="File type"
                  sx={{ minWidth: { sm: 180 } }}
                  value={format}
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
                  disabled={!canGenerate || busy}
                  variant="contained"
                  onClick={() => generate.mutate()}
                >
                  {generate.isPending ? 'Generating…' : 'Generate export'}
                </Button>
                {generate.data ? (
                  <Button
                    disabled={download.isPending}
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
      {generate.isSuccess ? (
        <Alert severity="success">
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
            <AxisSchemaDataListing
              ariaLabel={`${selectedSchema.label} export preview`}
              columnsLabel="Columns"
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
                    setPage(nextPage);
                    setPreviewResult(undefined);
                    preview.reset();
                  }}
                  onRowsPerPageChange={(event) => {
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
              onColumnKeysChange={(columnKeys) =>
                setPreviewColumnKeys(Object.freeze([...columnKeys]))
              }
              onSortOverrideChange={(nextSort) => {
                setSort(nextSort);
                setPage(0);
                setPreviewResult(undefined);
                preview.reset();
              }}
            />
          ) : null}
        </Paper>
      ) : null}
    </Stack>
  );
}
