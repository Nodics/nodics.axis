import { AxisSearchPanel } from '../../../../app/search/AxisSearchPanel';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  Tab,
  TablePagination,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router';

import { WorkspaceHelpActions } from '../../../../app/help/WorkspaceHelp';
import { axisPresentationFeatures } from '../../../../app/axisPresentationFeatures';
import { ShellIcon } from '../../../../app/shell/ShellIcon';
import { type AxisDataListingColumn } from '../../../../app/table/AxisDataListing';
import { AxisSchemaDataListing } from '../../../../app/table/AxisSchemaDataListing';
import { EditorialArticleWorkbenchDetail } from '../../../../operations/editorial/EditorialArticleWorkbenchDetail';
import type {
  WorkbenchRecord,
  WorkbenchSchema,
} from '../../../../workbench/api/workbenchContracts';
import { isWorkbenchAuthoringSchema } from '../../../../workbench/api/workbenchContracts';
import { WorkbenchRecordDetail } from '../../../../workbench/detail/WorkbenchRecordDetail';
import { WorkbenchModelDialog } from '../../../../workbench/detail/WorkbenchModelDialog';
import { defaultRelationshipCopy } from '../../../../workbench/form/WorkbenchRelationshipRuntime';
import type { WorkbenchRelationshipCopy } from '../../../../workbench/form/WorkbenchRelationshipRuntime';
import { WorkbenchDeleteDialog } from '../../../../workbench/delete/WorkbenchDeleteDialog';
import { WorkbenchRecordForm } from '../../../../workbench/form/WorkbenchRecordForm';
import { WorkbenchSchemaDefinition } from '../../../../workbench/schema/WorkbenchSchemaDefinition';
import {
  workbenchPresentationExcludedColumns,
  workbenchPresentationForbiddenFields,
  workbenchQuickFilterGroup,
} from '../../../../workbench/workbenchRouteModel';
import { stringProperty } from '../../shared/rendererProperties';
import type { CmsComponentRendererProps } from '../../shared/rendererTypes';
import { SchemaQueryBuilderRenderer } from '../query/SchemaQueryBuilderRenderer';

function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (Array.isArray(value)) return value.map(displayValue).join(', ');
  if (typeof value === 'object') return 'Related data';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value.toString();
  }
  return '—';
}

function recordKey(record: WorkbenchRecord, index: number): string {
  const value = record._id ?? record.code;
  return typeof value === 'string' || typeof value === 'number'
    ? value.toString()
    : `record-${String(index)}`;
}

const schemaBrowserPageSize = 20;
const allSchemaModules = '__all__';
const schemaHeaderChipSx = {
  maxWidth: '100%',
  bgcolor: 'transparent',
  borderColor: 'divider',
  borderRadius: 1,
  color: 'text.secondary',
  fontWeight: 650,
  height: 24,
  '& .MuiChip-label': {
    overflow: 'hidden',
    px: 0.75,
    textOverflow: 'ellipsis',
  },
};

const operationChipSx = {
  ...schemaHeaderChipSx,
  bgcolor: 'background.default',
  color: 'text.primary',
  textTransform: 'lowercase',
};

const workbenchSectionInset = { xs: 1.5, md: 2 };

function schemaDefinitionFileName(schema: WorkbenchSchema): string {
  return `${schema.moduleName}.${schema.schemaName}.schema.json`;
}

function downloadSchemaDefinition(schema: WorkbenchSchema) {
  const payload = JSON.stringify(schema, null, 2);
  const url = URL.createObjectURL(
    new Blob([payload], { type: 'application/json;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = schemaDefinitionFileName(schema);
  anchor.click();
  URL.revokeObjectURL(url);
}

function schemaInstanceKey(schema: WorkbenchSchema): string {
  return [
    schema.connectionModuleName ?? schema.moduleName,
    schema.connectionInstanceId ??
      schema.connectionServer ??
      schema.connectionEnvironment ??
      'default',
    schema.moduleName,
    schema.schemaName,
  ].join(':');
}

// Separate data runtimes remain selectable; their backend coordinates distinguish
// otherwise identical business labels without changing the connection used for CRUD.
function schemaRuntimeLabel(
  schema: WorkbenchSchema,
  schemas: readonly WorkbenchSchema[],
): string | undefined {
  const peers = schemas.filter(
    (candidate) =>
      candidate.moduleName === schema.moduleName &&
      candidate.schemaName === schema.schemaName,
  );
  if (peers.length < 2) return undefined;
  const sameRuntime = peers.filter(
    (candidate) =>
      candidate.connectionServer === schema.connectionServer &&
      candidate.connectionEnvironment === schema.connectionEnvironment,
  );
  return (
    [
      ...new Set(
        [
          schema.connectionServer,
          schema.connectionEnvironment,
          ...(sameRuntime.length > 1 || !schema.connectionServer
            ? [schema.connectionInstanceId]
            : []),
        ].filter(Boolean),
      ),
    ].join(' / ') || undefined
  );
}

function isEditorialArticleAuthoringDetail(
  navigationId: string | undefined,
  schemaName: string | undefined,
): boolean {
  return (
    schemaName === 'editorialArticle' &&
    (navigationId === 'editorial-news' || navigationId === 'editorial-blogs')
  );
}

export function SchemaWorkbenchRenderer({
  component,
  actions,
}: CmsComponentRendererProps) {
  const controller = actions?.workbench;
  const [schemaQuery, setSchemaQuery] = useState('');
  const [schemaModuleFilter, setSchemaModuleFilter] = useState(allSchemaModules);
  const [schemaVisibleCount, setSchemaVisibleCount] = useState(schemaBrowserPageSize);
  const [schemaPanelOpen, setSchemaPanelOpen] = useState(true);
  const [recordListOpen, setRecordListOpen] = useState(true);
  const [activeContentTab, setActiveContentTab] = useState<'schema' | 'model'>('model');
  const [previousSelection, setPreviousSelection] = useState<{
    schemaKey: string;
    record: WorkbenchRecord | undefined;
    create: boolean;
    edit: boolean;
  }>({ schemaKey: '', record: undefined, create: false, edit: false });
  if (!controller) {
    throw new Error('Schema Workbench renderer requires its presentation controller');
  }
  const normalizedSchemaQuery = schemaQuery.trim().toLocaleLowerCase();
  const scopedToNavigation = controller.scope?.kind === 'navigation';
  const schemaModules = Array.from(
    new Set(
      controller.schemas
        .filter(isWorkbenchAuthoringSchema)
        .map((schema) => schema.moduleName),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const visibleSchemas = controller.schemas
    .filter(isWorkbenchAuthoringSchema)
    .filter((schema) =>
      schemaModuleFilter === allSchemaModules
        ? true
        : schema.moduleName === schemaModuleFilter,
    )
    .filter((schema) =>
      normalizedSchemaQuery
        ? `${schema.label} ${schema.moduleName} ${schema.schemaName} ${schemaRuntimeLabel(schema, controller.schemas) ?? ''}`
            .toLocaleLowerCase()
            .includes(normalizedSchemaQuery)
        : true,
    )
    .sort((left, right) => {
      const leftKey = `${left.moduleName}:${left.schemaName}`;
      const rightKey = `${right.moduleName}:${right.schemaName}`;
      const leftRecent = controller.recentSchemas.indexOf(leftKey);
      const rightRecent = controller.recentSchemas.indexOf(rightKey);
      return (
        (axisPresentationFeatures.favourites
          ? Number(controller.favoriteSchemas.includes(rightKey)) -
            Number(controller.favoriteSchemas.includes(leftKey))
          : 0) ||
        (leftRecent < 0 ? Number.MAX_SAFE_INTEGER : leftRecent) -
          (rightRecent < 0 ? Number.MAX_SAFE_INTEGER : rightRecent) ||
        left.label.localeCompare(right.label)
      );
    });
  const displayedSchemas = visibleSchemas.slice(0, schemaVisibleCount);
  const hasMoreSchemas = displayedSchemas.length < visibleSchemas.length;
  const selected = controller.selectedSchema;
  const relationshipCopy = Object.fromEntries(
    (
      Object.entries(defaultRelationshipCopy) as [
        keyof WorkbenchRelationshipCopy,
        string,
      ][]
    ).map(([key, fallback]) => [key, stringProperty(component, key, fallback)]),
  ) as unknown as WorkbenchRelationshipCopy;
  const selectedSchemaKey = selected
    ? `${selected.moduleName}:${selected.schemaName}`
    : '';
  const workbenchPresentation = controller.scope?.workbenchPresentation;
  const fixedFilters = workbenchPresentation?.fixedFilters ?? [];
  const quickFilters = selected
    ? (workbenchPresentation?.quickFilters ?? [])
        .map((quickFilter) => ({
          quickFilter,
          filters: workbenchQuickFilterGroup(selected, quickFilter),
        }))
        .filter((entry) => entry.filters !== undefined)
    : [];
  const recoveryActions = workbenchPresentation?.recoveryActions ?? [];
  const excludedColumnKeys =
    workbenchPresentationExcludedColumns(workbenchPresentation);
  const forbiddenFieldNames =
    workbenchPresentationForbiddenFields(workbenchPresentation);
  const workspaceLabel =
    controller.scope?.label ??
    selected?.label ??
    stringProperty(component, 'selectSchemaLabel');
  const workspaceHelp = controller.scope?.help;
  const excludedColumnKeySet = new Set(excludedColumnKeys);
  const columns =
    selected?.fields.filter(
      (field) =>
        controller.visibleColumns.includes(field.name) &&
        !excludedColumnKeySet.has(field.name),
    ) ?? [];
  const records = controller.records;
  const leadingRecordColumns: readonly AxisDataListingColumn<WorkbenchRecord>[] =
    selected
      ? [
          {
            key: '__select',
            label: (
              <Checkbox
                slotProps={{
                  input: {
                    'aria-label': stringProperty(
                      component,
                      'selectVisibleRecordsLabel',
                    ),
                  },
                }}
                checked={
                  records.length > 0 &&
                  records.every((record, index) =>
                    controller.selectedRecordKeys.includes(recordKey(record, index)),
                  )
                }
                indeterminate={
                  records.some((record, index) =>
                    controller.selectedRecordKeys.includes(recordKey(record, index)),
                  ) &&
                  !records.every((record, index) =>
                    controller.selectedRecordKeys.includes(recordKey(record, index)),
                  )
                }
                onChange={() => {
                  const pageKeys = records.map(recordKey);
                  const allSelected = pageKeys.every((key) =>
                    controller.selectedRecordKeys.includes(key),
                  );
                  controller.setSelectedRecordKeys(
                    allSelected
                      ? controller.selectedRecordKeys.filter(
                          (key) => !pageKeys.includes(key),
                        )
                      : [...new Set([...controller.selectedRecordKeys, ...pageKeys])],
                  );
                }}
              />
            ),
            width: 52,
            minWidth: 52,
            exportable: false,
            render: (record, index) => {
              const key = recordKey(record, index);
              return (
                <Checkbox
                  slotProps={{
                    input: {
                      'aria-label': `${stringProperty(component, 'selectRecordLabel')} ${key}`,
                    },
                  }}
                  checked={controller.selectedRecordKeys.includes(key)}
                  onChange={(event) => {
                    event.stopPropagation();
                    controller.setSelectedRecordKeys(
                      controller.selectedRecordKeys.includes(key)
                        ? controller.selectedRecordKeys.filter(
                            (candidate) => candidate !== key,
                          )
                        : [...controller.selectedRecordKeys, key],
                    );
                  }}
                />
              );
            },
          },
        ]
      : [];
  const pageCount = Math.max(
    1,
    Math.ceil(controller.recordTotalCount / controller.recordPageSize),
  );

  if (
    previousSelection.schemaKey !== selectedSchemaKey ||
    previousSelection.record !== controller.selectedRecord ||
    previousSelection.create !== controller.createOpen ||
    previousSelection.edit !== controller.editOpen
  ) {
    setPreviousSelection({
      schemaKey: selectedSchemaKey,
      record: controller.selectedRecord,
      create: controller.createOpen,
      edit: controller.editOpen,
    });
    if (previousSelection.schemaKey !== selectedSchemaKey) {
      setActiveContentTab('model');
      setRecordListOpen(true);
    } else if (
      controller.createOpen ||
      controller.editOpen ||
      controller.selectedRecord
    ) {
      setActiveContentTab('model');
    }
  }

  return (
    <Stack
      spacing={1}
      sx={{
        height: { xs: 'auto', lg: '100%' },
        inset: { lg: 0 },
        minHeight: 0,
        overflow: { xs: 'visible', lg: 'hidden' },
        position: { xs: 'static', lg: 'absolute' },
      }}
    >
      <Box
        data-testid="workbench-pane-grid"
        sx={{
          display: 'grid',
          flex: { lg: 1 },
          gap: 1,
          gridTemplateColumns: 'minmax(0, 1fr)',
          gridTemplateRows: {
            xs: 'auto',
            lg: scopedToNavigation ? 'minmax(0, 1fr)' : 'auto minmax(0, 1fr)',
          },
          height: { xs: 'auto', lg: '100%' },
          minHeight: 0,
          overflow: { xs: 'visible', lg: 'hidden' },
        }}
      >
        {!scopedToNavigation ? (
          <Box
            component="section"
            aria-label={stringProperty(component, 'schemasLabel')}
            data-testid="workbench-schema-navigation-pane"
            sx={{
              bgcolor: 'background.paper',
              borderBottom: 1,
              borderColor: 'divider',
              minHeight: 0,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: schemaPanelOpen ? 1 : 0,
                minHeight: 0,
                overflow: 'hidden',
                p: { xs: 1.5, md: 2 },
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minWidth: 0,
                }}
              >
                <Typography
                  component="h2"
                  variant="h6"
                  sx={{ fontWeight: 750, minWidth: 0 }}
                >
                  {stringProperty(component, 'schemasLabel')}
                </Typography>
                <Tooltip
                  title={stringProperty(
                    component,
                    schemaPanelOpen ? 'collapseSchemasLabel' : 'expandSchemasLabel',
                    schemaPanelOpen ? 'Hide data types' : 'Show data types',
                  )}
                >
                  <IconButton
                    aria-label={stringProperty(
                      component,
                      schemaPanelOpen ? 'collapseSchemasLabel' : 'expandSchemasLabel',
                      schemaPanelOpen ? 'Hide data types' : 'Show data types',
                    )}
                    size="small"
                    aria-expanded={schemaPanelOpen}
                    onClick={() => setSchemaPanelOpen((open) => !open)}
                  >
                    <ShellIcon
                      fontSize="small"
                      name={schemaPanelOpen ? 'chevron-up' : 'chevron-down'}
                    />
                  </IconButton>
                </Tooltip>
              </Stack>
              {schemaPanelOpen ? (
                <Stack spacing={1} sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 1.5,
                      gridTemplateColumns: {
                        xs: 'minmax(0, 1fr)',
                        sm: 'minmax(0, 1fr) minmax(200px, 280px)',
                      },
                      pt: 0.5,
                    }}
                  >
                    <TextField
                      fullWidth
                      label={stringProperty(component, 'schemaSearchLabel')}
                      placeholder={stringProperty(component, 'schemaSearchPlaceholder')}
                      size="small"
                      sx={{
                        '& .MuiInputBase-input': {
                          minWidth: 0,
                          textOverflow: 'ellipsis',
                        },
                      }}
                      value={schemaQuery}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <ShellIcon fontSize="small" name="search" />
                            </InputAdornment>
                          ),
                        },
                      }}
                      onChange={(event) => {
                        setSchemaQuery(event.target.value);
                        setSchemaVisibleCount(schemaBrowserPageSize);
                      }}
                    />
                    <TextField
                      fullWidth
                      label={stringProperty(
                        component,
                        'schemaModuleFilterLabel',
                        'Module',
                      )}
                      select
                      size="small"
                      value={schemaModuleFilter}
                      onChange={(event) => {
                        setSchemaModuleFilter(event.target.value);
                        setSchemaVisibleCount(schemaBrowserPageSize);
                      }}
                    >
                      <MenuItem value={allSchemaModules}>
                        {stringProperty(component, 'allModulesLabel', 'All modules')}
                      </MenuItem>
                      {schemaModules.map((moduleName) => (
                        <MenuItem key={moduleName} value={moduleName}>
                          {moduleName}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                  {controller.schemasLoading ? (
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{ alignItems: 'center', py: 3 }}
                    >
                      <CircularProgress size={22} />
                      <Typography>
                        {stringProperty(component, 'loadingLabel')}
                      </Typography>
                    </Stack>
                  ) : null}
                  {controller.schemasError ? (
                    <Alert
                      action={
                        <Button
                          color="inherit"
                          size="small"
                          onClick={controller.retrySchemas}
                        >
                          {stringProperty(component, 'retryLabel')}
                        </Button>
                      }
                      severity="error"
                    >
                      {controller.schemasError}
                    </Alert>
                  ) : null}
                  {!controller.schemasLoading &&
                  !controller.schemasError &&
                  visibleSchemas.length === 0 ? (
                    <Typography color="text.secondary">
                      {stringProperty(component, 'noSchemasLabel')}
                    </Typography>
                  ) : null}
                  <List
                    disablePadding
                    aria-label={stringProperty(component, 'schemasLabel')}
                    data-testid="workbench-schema-list-scroll-region"
                    sx={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fill, minmax(min(210px, 100%), 1fr))',
                      gap: 0.5,
                      maxHeight: 144,
                      minHeight: 0,
                      overflowY: 'auto',
                      overscrollBehavior: 'contain',
                      pr: 0.5,
                      scrollbarGutter: 'stable',
                    }}
                  >
                    {displayedSchemas.map((schema) => {
                      const key = `${schema.moduleName}:${schema.schemaName}`;
                      const instanceKey = schemaInstanceKey(schema);
                      const runtimeLabel = schemaRuntimeLabel(
                        schema,
                        controller.schemas,
                      );
                      const favorite = controller.favoriteSchemas.includes(key);
                      return (
                        <Stack
                          key={instanceKey}
                          direction="row"
                          sx={{ alignItems: 'stretch', minWidth: 0 }}
                        >
                          <ListItemButton
                            disabled={controller.createOpen || controller.editOpen}
                            selected={
                              selected?.moduleName === schema.moduleName &&
                              selected.schemaName === schema.schemaName &&
                              schemaInstanceKey(selected) === instanceKey
                            }
                            sx={{ borderRadius: 1, minWidth: 0, py: 0.5, px: 1.5 }}
                            onClick={() => controller.selectSchema(schema)}
                          >
                            <ListItemText
                              primary={schema.label}
                              secondary={
                                runtimeLabel
                                  ? `${schema.moduleName} / ${runtimeLabel}`
                                  : schema.moduleName
                              }
                              slotProps={{
                                primary: {
                                  sx: {
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
                                    overflowWrap: 'anywhere',
                                  },
                                },
                                secondary: {
                                  sx: { fontSize: '0.75rem', overflowWrap: 'anywhere' },
                                },
                              }}
                            />
                          </ListItemButton>
                          {axisPresentationFeatures.favourites ? (
                            <Button
                              aria-label={`${stringProperty(
                                component,
                                favorite ? 'removeFavouriteLabel' : 'addFavouriteLabel',
                              )} ${schema.label}`}
                              color={favorite ? 'primary' : 'inherit'}
                              sx={{ minWidth: 36, px: 0.5 }}
                              onClick={() => controller.toggleFavoriteSchema(schema)}
                            >
                              {favorite ? '★' : '☆'}
                            </Button>
                          ) : null}
                        </Stack>
                      );
                    })}
                  </List>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Typography color="text.secondary" variant="caption">
                      {displayedSchemas.length} shown from {visibleSchemas.length}
                    </Typography>
                    {hasMoreSchemas ? (
                      <Button
                        size="small"
                        variant="text"
                        onClick={() =>
                          setSchemaVisibleCount((count) =>
                            Math.min(
                              count + schemaBrowserPageSize,
                              visibleSchemas.length,
                            ),
                          )
                        }
                      >
                        {stringProperty(component, 'loadMoreSchemasLabel', 'Load more')}
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              ) : null}
            </Box>
          </Box>
        ) : null}
        <Card
          component="section"
          data-testid="workbench-record-pane"
          variant="outlined"
          sx={{
            height: { xs: 'auto', lg: '100%' },
            maxHeight: { lg: '100%' },
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            scrollbarGutter: 'stable',
          }}
        >
          <CardContent
            sx={{
              p: 0,
              '&:last-child': { pb: 0 },
            }}
          >
            {!selected ? (
              <Stack
                sx={{ alignItems: 'center', minHeight: 320, justifyContent: 'center' }}
              >
                <ShellIcon color="disabled" name="schema" sx={{ fontSize: 48 }} />
                <Typography color="text.secondary" sx={{ mt: 1.5 }}>
                  {stringProperty(component, 'selectSchemaLabel')}
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={0}>
                <Stack
                  spacing={1}
                  sx={{
                    bgcolor: 'background.paper',
                    borderBottom: 1,
                    borderColor: 'divider',
                    minWidth: 0,
                    position: 'relative',
                    overflow: 'hidden',
                    px: workbenchSectionInset,
                    py: { xs: 1.5, md: 1.75 },
                    '&::before': {
                      bgcolor: 'primary.main',
                      bottom: 0,
                      content: '""',
                      left: 0,
                      position: 'absolute',
                      top: 0,
                      width: 3,
                    },
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    sx={{
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      justifyContent: 'space-between',
                      minWidth: 0,
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1.25}
                      sx={{ alignItems: 'flex-start', flex: '1 1 auto', minWidth: 0 }}
                    >
                      <Box
                        aria-hidden="true"
                        sx={{
                          alignItems: 'center',
                          bgcolor: 'primary.main',
                          borderRadius: 1,
                          color: 'primary.contrastText',
                          display: 'flex',
                          flexShrink: 0,
                          height: 38,
                          justifyContent: 'center',
                          width: 38,
                        }}
                      >
                        <ShellIcon fontSize="small" name="schema" />
                      </Box>
                      <Stack
                        spacing={0.85}
                        sx={{ flex: '1 1 auto', minWidth: 0, pt: 0.15 }}
                      >
                        {scopedToNavigation && controller.scope?.parentLabel ? (
                          <Typography
                            color="text.secondary"
                            sx={{
                              fontWeight: 700,
                              letterSpacing: 1.8,
                              lineHeight: 1,
                              textTransform: 'uppercase',
                            }}
                            variant="caption"
                          >
                            {controller.scope.parentLabel}
                          </Typography>
                        ) : null}
                        <Stack
                          direction="row"
                          spacing={0.5}
                          sx={{ alignItems: 'center', minWidth: 0 }}
                        >
                          <Typography
                            component="h2"
                            variant="h6"
                            sx={{
                              fontWeight: 750,
                              lineHeight: 1.18,
                              minWidth: 0,
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {workspaceLabel}
                          </Typography>
                          <WorkspaceHelpActions
                            help={workspaceHelp}
                            label={workspaceLabel}
                          />
                        </Stack>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          sx={{
                            display: activeContentTab === 'schema' ? 'flex' : 'none',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            maxWidth: '100%',
                            minWidth: 0,
                          }}
                          useFlexGap
                        >
                          <Chip
                            label={`${stringProperty(component, 'moduleLabel')}: ${selected.moduleName}`}
                            size="small"
                            sx={schemaHeaderChipSx}
                            variant="outlined"
                          />
                          <Chip
                            label={`${stringProperty(component, 'schemaLabel', 'Schema')}: ${selected.schemaName}`}
                            size="small"
                            sx={schemaHeaderChipSx}
                            variant="outlined"
                          />
                          {selected.operations.map((operation) => (
                            <Chip
                              key={operation}
                              label={operation}
                              size="small"
                              sx={operationChipSx}
                            />
                          ))}
                        </Stack>
                      </Stack>
                    </Stack>
                    {activeContentTab === 'schema' ? (
                      <Tooltip title="Export schema definition">
                        <span>
                          <IconButton
                            aria-label="Export schema definition"
                            size="small"
                            sx={{
                              bgcolor: 'background.default',
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 1,
                              color: 'text.primary',
                              flexShrink: 0,
                              height: 40,
                              width: 40,
                              '&:hover': {
                                bgcolor: 'action.hover',
                                borderColor: 'primary.main',
                                color: 'primary.main',
                              },
                            }}
                            onClick={() => downloadSchemaDefinition(selected)}
                          >
                            <ShellIcon name="download" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    ) : null}
                    {activeContentTab === 'model' &&
                    selected.operations.includes('create') ? (
                      <Tooltip
                        title={selected.form?.copy.createLabel ?? 'Create new model'}
                      >
                        <span>
                          <IconButton
                            aria-label={
                              selected.form?.copy.createLabel ?? 'Create new model'
                            }
                            color="primary"
                            disabled={controller.createOpen}
                            size="small"
                            sx={{
                              bgcolor: 'primary.main',
                              borderRadius: 1,
                              color: 'primary.contrastText',
                              flexShrink: 0,
                              height: 40,
                              width: 40,
                              '&:hover': {
                                bgcolor: 'primary.dark',
                              },
                              '&.Mui-disabled': {
                                bgcolor: 'action.disabledBackground',
                                color: 'action.disabled',
                              },
                            }}
                            onClick={controller.beginCreate}
                          >
                            <ShellIcon name="add" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    ) : null}
                  </Stack>
                </Stack>
                <Tabs
                  aria-label={`${selected.label} workbench sections`}
                  value={activeContentTab}
                  onChange={(_event, value: 'schema' | 'model') =>
                    setActiveContentTab(value)
                  }
                  sx={{
                    borderBottom: 1,
                    borderColor: 'divider',
                    minHeight: 38,
                    px: workbenchSectionInset,
                    '& .MuiTabs-flexContainer': {
                      columnGap: 1.5,
                    },
                    '& .MuiTab-root': {
                      alignItems: 'center',
                      display: 'inline-flex',
                      flexDirection: 'row',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      gap: 0.75,
                      lineHeight: 1,
                      minHeight: 38,
                      minWidth: 'auto',
                      px: 0.5,
                      py: 0,
                    },
                    '& .MuiTab-iconWrapper': {
                      mb: 0,
                      mr: 0,
                    },
                  }}
                >
                  <Tab
                    icon={<ShellIcon fontSize="small" name="schema" />}
                    disabled={controller.createOpen || controller.editOpen}
                    iconPosition="start"
                    label={selected.form?.copy.schemaLabel ?? 'Schema'}
                    value="schema"
                  />
                  <Tab
                    icon={<ShellIcon fontSize="small" name="format-table" />}
                    iconPosition="start"
                    label={selected.form?.copy.recordsLabel ?? 'Model'}
                    value="model"
                  />
                </Tabs>
                {activeContentTab === 'schema' ? (
                  <Box sx={{ px: workbenchSectionInset, py: { xs: 1.5, md: 2 } }}>
                    <WorkbenchSchemaDefinition
                      schema={selected}
                      schemas={controller.schemas}
                    />
                  </Box>
                ) : null}
                {activeContentTab === 'model' &&
                controller.selectedRecord &&
                !controller.editOpen &&
                !controller.createOpen &&
                selected.form?.completionAction ? (
                  <Box sx={{ px: workbenchSectionInset, pt: 2 }}>
                    <Button
                      component={RouterLink}
                      variant="outlined"
                      to={selected.form.completionAction.path.replace(
                        /\{([A-Za-z][A-Za-z0-9_]*)\}/g,
                        (_match, field: string) => {
                          const value = controller.selectedRecord?.[field];
                          return encodeURIComponent(
                            typeof value === 'string' ||
                              typeof value === 'number' ||
                              typeof value === 'boolean'
                              ? String(value)
                              : '',
                          );
                        },
                      )}
                    >
                      {selected.form.completionAction.label}
                    </Button>
                  </Box>
                ) : null}
                {activeContentTab === 'model' && controller.createOpen ? (
                  <Box sx={{ px: workbenchSectionInset, py: { xs: 1.5, md: 2 } }}>
                    <WorkbenchRecordForm
                      cancelLabel={stringProperty(component, 'cancelLabel')}
                      error={controller.createError}
                      relationshipCopy={{
                        addToDraftLabel: stringProperty(component, 'addToDraftLabel'),
                        cancelLabel: stringProperty(component, 'cancelLabel'),
                        createRelatedLabel: stringProperty(
                          component,
                          'createRelatedLabel',
                        ),
                        editRelatedLabel: stringProperty(component, 'editRelatedLabel'),
                        loadMoreRelatedLabel: stringProperty(
                          component,
                          'loadMoreRelatedLabel',
                          'Load more',
                        ),
                        manySelectionHintLabel: stringProperty(
                          component,
                          'manySelectionHintLabel',
                          'Select one or more related records.',
                        ),
                        missingReferencePropertyLabel: stringProperty(
                          component,
                          'missingReferencePropertyLabel',
                          'Related records were found, but none expose the required reference property: {property}.',
                        ),
                        noRelatedRecordsLabel: stringProperty(
                          component,
                          'noRelatedRecordsLabel',
                        ),
                        pendingReferencesLabel: stringProperty(
                          component,
                          'pendingReferencesLabel',
                          'Pending create',
                        ),
                        relatedSearchLabel: stringProperty(
                          component,
                          'relatedSearchLabel',
                        ),
                        relatedResultsLabel: stringProperty(
                          component,
                          'relatedResultsLabel',
                          '{shown} shown from {total}',
                        ),
                        removeReferenceLabel: stringProperty(
                          component,
                          'removeReferenceLabel',
                          'Remove',
                        ),
                        removeRelatedLabel: stringProperty(
                          component,
                          'removeRelatedLabel',
                        ),
                        selectedReferencesLabel: stringProperty(
                          component,
                          'selectedReferencesLabel',
                          'Selected existing',
                        ),
                        selectExistingLabel: stringProperty(
                          component,
                          'selectExistingLabel',
                        ),
                        singleSelectionHintLabel: stringProperty(
                          component,
                          'singleSelectionHintLabel',
                          'Selecting a record replaces the current reference.',
                        ),
                      }}
                      relationshipRuntime={controller.relationshipRuntime}
                      saving={controller.creating}
                      savingLabel={stringProperty(component, 'savingLabel')}
                      schema={selected}
                      submitLabel={stringProperty(component, 'createLabel')}
                      workbenchPresentation={workbenchPresentation}
                      onCancel={controller.cancelCreate}
                      onSubmit={controller.createRecord}
                    />
                  </Box>
                ) : null}
                <Box
                  hidden={activeContentTab !== 'model' || controller.createOpen}
                  sx={{ px: workbenchSectionInset, py: { xs: 1.5, md: 2 } }}
                >
                  <Stack spacing={1.25}>
                    <AxisSearchPanel
                      key={`${selected.moduleName}:${selected.schemaName}`}
                      ownerModule={selected.moduleName}
                      search={{
                        value: controller.recordSearch,
                        label: stringProperty(component, 'searchRecordsLabel'),
                        placeholder: stringProperty(
                          component,
                          'searchRecordsPlaceholder',
                        ),
                        disabled:
                          selected.queryCapabilities.searchableFields.length === 0,
                        onChange: controller.setRecordSearch,
                      }}
                      advancedLabel={stringProperty(
                        component,
                        'advancedSearchLabel',
                        'Advanced search',
                      )}
                      advanced={
                        <SchemaQueryBuilderRenderer
                          actions={actions}
                          component={component}
                        />
                      }
                      filters={
                        controller.recordFilters
                          ? [
                              {
                                id: 'workbench-conditions',
                                label: stringProperty(
                                  component,
                                  'appliedConditionsLabel',
                                  'Advanced conditions applied',
                                ),
                                onRemove: () => controller.setRecordFilters(undefined),
                              },
                            ]
                          : []
                      }
                      clearLabel={stringProperty(
                        component,
                        'clearSearchLabel',
                        'Clear all',
                      )}
                      onClear={
                        controller.recordSearch || controller.recordFilters
                          ? () => {
                              controller.setRecordSearch('');
                              controller.setRecordFilters(undefined);
                            }
                          : undefined
                      }
                      summary={
                        <Stack spacing={1}>
                          {fixedFilters.length > 0 ? (
                            <Stack
                              direction="row"
                              spacing={0.75}
                              sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                              useFlexGap
                            >
                              <Typography
                                color="text.secondary"
                                sx={{
                                  fontWeight: 700,
                                  letterSpacing: 1.2,
                                  textTransform: 'uppercase',
                                }}
                                variant="caption"
                              >
                                Scope
                              </Typography>
                              {fixedFilters.map((filter) => (
                                <Chip
                                  key={filter.id}
                                  label={`${filter.label}: ${filter.values?.join(', ') ?? filter.value ?? 'Applied'}`}
                                  size="small"
                                  variant="outlined"
                                />
                              ))}
                            </Stack>
                          ) : null}
                          {quickFilters.length > 0 ? (
                            <Stack
                              direction="row"
                              spacing={0.75}
                              sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                              useFlexGap
                            >
                              <Typography
                                color="text.secondary"
                                sx={{
                                  fontWeight: 700,
                                  letterSpacing: 1.2,
                                  textTransform: 'uppercase',
                                }}
                                variant="caption"
                              >
                                {stringProperty(
                                  component,
                                  'quickFiltersLabel',
                                  'Quick filters',
                                )}
                              </Typography>
                              {quickFilters.map(({ quickFilter, filters }) => (
                                <Button
                                  key={quickFilter.id}
                                  size="small"
                                  variant="outlined"
                                  onClick={() => controller.setRecordFilters(filters)}
                                >
                                  {quickFilter.label}
                                </Button>
                              ))}
                            </Stack>
                          ) : null}
                          {recoveryActions.length > 0 ? (
                            <Stack
                              direction="row"
                              spacing={0.75}
                              sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                              useFlexGap
                            >
                              <Typography
                                color="text.secondary"
                                sx={{
                                  fontWeight: 700,
                                  letterSpacing: 1.2,
                                  textTransform: 'uppercase',
                                }}
                                variant="caption"
                              >
                                {stringProperty(
                                  component,
                                  'guidedActionsLabel',
                                  'Guided actions',
                                )}
                              </Typography>
                              {recoveryActions.map((action) => (
                                <Tooltip
                                  key={action.id}
                                  title={
                                    action.summary ??
                                    `${action.ownerModule}: ${action.handlerAction}`
                                  }
                                >
                                  <Chip
                                    label={action.label}
                                    size="small"
                                    sx={{ bgcolor: 'action.selected' }}
                                  />
                                </Tooltip>
                              ))}
                            </Stack>
                          ) : null}
                        </Stack>
                      }
                    />
                  </Stack>
                  {controller.recordsLoading ? (
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{ alignItems: 'center', py: 4 }}
                    >
                      <CircularProgress size={22} />
                      <Typography>
                        {stringProperty(component, 'loadingLabel')}
                      </Typography>
                    </Stack>
                  ) : null}
                  {controller.recordsError ? (
                    <Alert
                      action={
                        <Button
                          color="inherit"
                          size="small"
                          onClick={controller.retryRecords}
                        >
                          {stringProperty(component, 'retryLabel')}
                        </Button>
                      }
                      severity="error"
                      sx={{ mt: 1.25 }}
                    >
                      {controller.recordsError}
                    </Alert>
                  ) : null}
                  {!controller.recordsLoading && !controller.recordsError ? (
                    <Box sx={{ mt: 1.5 }}>
                      <Stack
                        direction="row"
                        sx={{
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: 1,
                          borderColor: 'divider',
                          py: 0.75,
                        }}
                      >
                        <Typography variant="subtitle2">
                          {stringProperty(component, 'recordsLabel', 'Records')}{' '}
                          <Typography
                            component="span"
                            variant="body2"
                            color="text.secondary"
                          >
                            ({controller.recordTotalCount})
                          </Typography>
                        </Typography>
                        <Tooltip
                          title={stringProperty(
                            component,
                            recordListOpen
                              ? 'collapseRecordsLabel'
                              : 'expandRecordsLabel',
                            recordListOpen ? 'Collapse records' : 'Expand records',
                          )}
                        >
                          <IconButton
                            aria-label={stringProperty(
                              component,
                              recordListOpen
                                ? 'collapseRecordsLabel'
                                : 'expandRecordsLabel',
                              recordListOpen ? 'Collapse records' : 'Expand records',
                            )}
                            aria-expanded={recordListOpen}
                            onClick={() => setRecordListOpen(!recordListOpen)}
                          >
                            <ShellIcon
                              name={recordListOpen ? 'chevron-up' : 'chevron-down'}
                            />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                      <Collapse in={recordListOpen}>
                        <AxisSchemaDataListing
                          ariaLabel={`${selected.label} ${stringProperty(component, 'recordsLabel')}`}
                          columnsLabel={stringProperty(
                            component,
                            'gridSettingsLabel',
                            'Columns',
                          )}
                          defaultVisibleColumnKeys={columns.map((field) => field.name)}
                          emptyMessage={stringProperty(component, 'noRecordsLabel')}
                          excludedColumnKeys={excludedColumnKeys}
                          exportFileName={`axis-${selected.moduleName}-${selected.schemaName}`}
                          footer={
                            controller.recordTotalCount > 0 ? (
                              <TablePagination
                                component="div"
                                count={controller.recordTotalCount}
                                page={
                                  Math.min(controller.recordPageNumber, pageCount) - 1
                                }
                                rowsPerPage={controller.recordPageSize}
                                rowsPerPageOptions={
                                  selected.queryCapabilities.allowedPageSizes
                                }
                                sx={{
                                  border: 0,
                                  bgcolor: 'background.paper',
                                  '& .MuiToolbar-root': {
                                    minHeight: 52,
                                    px: 1.5,
                                  },
                                }}
                                onPageChange={(_event, page) =>
                                  controller.setRecordPageNumber(page + 1)
                                }
                                onRowsPerPageChange={(event) =>
                                  controller.setRecordPageSize(
                                    Number(event.target.value),
                                  )
                                }
                              />
                            ) : null
                          }
                          getRowKey={recordKey}
                          leadingColumns={leadingRecordColumns}
                          maxBodyHeight={360}
                          minTableWidth={Math.max(720, 220 + columns.length * 160)}
                          records={records}
                          selectedRowKey={
                            controller.selectedRecord
                              ? recordKey(controller.selectedRecord, 0)
                              : undefined
                          }
                          schema={selected}
                          sortOverride={controller.recordSortOverride}
                          toolbarStart={
                            <Typography color="text.secondary" variant="body2">
                              {controller.recordTotalCount}{' '}
                              {stringProperty(component, 'resultsLabel')}
                            </Typography>
                          }
                          onColumnKeysChange={(columnKeys) =>
                            controller.setVisibleColumns(columnKeys)
                          }
                          onReferenceClick={(relationship, reference, record) => {
                            controller.selectRecord(record);
                            void controller.openReferenceRecord?.(
                              relationship,
                              reference,
                            );
                          }}
                          onRowClick={(record) => controller.selectRecord(record)}
                          onSortOverrideChange={controller.setRecordSortOverride}
                          visibleColumnKeys={controller.visibleColumns}
                        />
                      </Collapse>
                    </Box>
                  ) : null}
                  {controller.selectedRecordKeys.length > 0 ? (
                    <Alert
                      action={
                        selected.bulkCapabilities?.operations.includes('DELETE') &&
                        controller.bulkDeleteSelected ? (
                          <Button
                            color="inherit"
                            disabled={controller.bulkDeleting}
                            size="small"
                            onClick={() => void controller.bulkDeleteSelected?.()}
                          >
                            {controller.bulkDeleting
                              ? stringProperty(component, 'bulkDeletingLabel')
                              : stringProperty(component, 'bulkDeleteLabel')}
                          </Button>
                        ) : undefined
                      }
                      severity={controller.bulkDeleteError ? 'error' : 'info'}
                    >
                      {controller.bulkDeleteError ??
                        `${String(controller.selectedRecordKeys.length)} ${stringProperty(
                          component,
                          'selectedRecordsLabel',
                        )}`}
                    </Alert>
                  ) : null}
                  {controller.selectedRecord ? (
                    <Box
                      sx={{
                        mt: 2,
                      }}
                    >
                      {controller.editOpen ? (
                        <WorkbenchRecordForm
                          key={recordKey(controller.selectedRecord, 0)}
                          cancelLabel={stringProperty(component, 'cancelLabel')}
                          error={controller.updateError}
                          initialModel={controller.selectedRecord}
                          relationshipCopy={{
                            addToDraftLabel: stringProperty(
                              component,
                              'addToDraftLabel',
                            ),
                            cancelLabel: stringProperty(component, 'cancelLabel'),
                            createRelatedLabel: stringProperty(
                              component,
                              'createRelatedLabel',
                            ),
                            editRelatedLabel: stringProperty(
                              component,
                              'editRelatedLabel',
                            ),
                            loadMoreRelatedLabel: stringProperty(
                              component,
                              'loadMoreRelatedLabel',
                              'Load more',
                            ),
                            manySelectionHintLabel: stringProperty(
                              component,
                              'manySelectionHintLabel',
                              'Select one or more related records.',
                            ),
                            missingReferencePropertyLabel: stringProperty(
                              component,
                              'missingReferencePropertyLabel',
                              'Related records were found, but none expose the required reference property: {property}.',
                            ),
                            noRelatedRecordsLabel: stringProperty(
                              component,
                              'noRelatedRecordsLabel',
                            ),
                            pendingReferencesLabel: stringProperty(
                              component,
                              'pendingReferencesLabel',
                              'Pending create',
                            ),
                            relatedSearchLabel: stringProperty(
                              component,
                              'relatedSearchLabel',
                            ),
                            relatedResultsLabel: stringProperty(
                              component,
                              'relatedResultsLabel',
                              '{shown} shown from {total}',
                            ),
                            removeReferenceLabel: stringProperty(
                              component,
                              'removeReferenceLabel',
                              'Remove',
                            ),
                            removeRelatedLabel: stringProperty(
                              component,
                              'removeRelatedLabel',
                            ),
                            selectedReferencesLabel: stringProperty(
                              component,
                              'selectedReferencesLabel',
                              'Selected existing',
                            ),
                            selectExistingLabel: stringProperty(
                              component,
                              'selectExistingLabel',
                            ),
                            singleSelectionHintLabel: stringProperty(
                              component,
                              'singleSelectionHintLabel',
                              'Selecting a record replaces the current reference.',
                            ),
                          }}
                          relationshipRuntime={controller.relationshipRuntime}
                          saving={controller.updating}
                          savingLabel={stringProperty(component, 'updatingLabel')}
                          schema={selected}
                          submitLabel={stringProperty(component, 'updateLabel')}
                          workbenchPresentation={workbenchPresentation}
                          onCancel={controller.cancelEdit}
                          onSubmit={controller.updateRecord}
                        />
                      ) : (
                        <>
                          {isEditorialArticleAuthoringDetail(
                            controller.scope?.navigationId,
                            selected.schemaName,
                          ) ? (
                            <EditorialArticleWorkbenchDetail
                              controller={controller}
                              record={controller.selectedRecord}
                              schema={selected}
                            />
                          ) : (
                            <WorkbenchRecordDetail
                              relationshipCopy={relationshipCopy}
                              closeLabel={stringProperty(component, 'closeLabel')}
                              deleteLabel={stringProperty(component, 'deleteLabel')}
                              editLabel={stringProperty(component, 'editLabel')}
                              falseLabel={stringProperty(component, 'falseLabel')}
                              forbiddenFieldNames={forbiddenFieldNames}
                              detailPanels={controller.selectedRecordDetailPanels}
                              lifecycleActionError={controller.lifecycleActionError}
                              lifecycleActionPendingId={
                                controller.lifecycleActionPendingId
                              }
                              lifecycleActionResult={controller.lifecycleActionResult}
                              lifecycleActions={controller.scope?.lifecycleActions}
                              record={controller.selectedRecord}
                              relationshipRuntime={controller.relationshipRuntime}
                              schema={selected}
                              trueLabel={stringProperty(component, 'trueLabel')}
                              onClose={controller.closeRecord}
                              onDelete={controller.beginDelete}
                              onEdit={controller.beginEdit}
                              onLifecycleAction={controller.executeLifecycleAction}
                            />
                          )}
                        </>
                      )}
                    </Box>
                  ) : null}
                  {controller.openedReferenceRecord ? (
                    <WorkbenchModelDialog
                      copy={relationshipCopy}
                      runtime={controller.relationshipRuntime}
                      onClose={() => controller.closeReferenceRecord?.()}
                      editable={controller.openedReferenceRecord.relationship.actions.includes(
                        'EDIT_RELATED',
                      )}
                      record={controller.openedReferenceRecord.record}
                      schema={controller.openedReferenceRecord.schema}
                      path={[selected.label]}
                    />
                  ) : null}
                </Box>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>
      {controller.selectedRecord ? (
        <WorkbenchDeleteDialog
          cancelLabel={stringProperty(component, 'cancelLabel')}
          confirmLabel={stringProperty(component, 'confirmDeleteLabel')}
          deleting={controller.deleting}
          deletingLabel={stringProperty(component, 'deletingLabel')}
          enterpriseCode={controller.enterpriseCode}
          enterpriseLabel={stringProperty(component, 'enterpriseLabel')}
          error={controller.deleteError}
          impact={controller.deleteImpact}
          impactBlockedLabel={stringProperty(component, 'deleteImpactBlockedLabel')}
          impactClearLabel={stringProperty(component, 'deleteImpactClearLabel')}
          impactLoading={controller.deleteImpactLoading ?? false}
          impactLoadingLabel={stringProperty(component, 'deleteImpactLoadingLabel')}
          identity={displayValue(
            controller.selectedRecord[selected?.displayProperty ?? 'code'],
          )}
          open={controller.deleteOpen}
          schemaLabel={selected?.label ?? ''}
          tenantCode={controller.tenantCode}
          tenantLabel={stringProperty(component, 'tenantLabel')}
          title={stringProperty(component, 'deleteTitle')}
          warning={stringProperty(component, 'deleteWarning')}
          onCancel={controller.cancelDelete}
          onConfirm={controller.confirmDelete}
        />
      ) : null}
    </Stack>
  );
}
