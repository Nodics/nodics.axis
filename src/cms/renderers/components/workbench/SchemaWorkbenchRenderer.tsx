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
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  TablePagination,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { WorkspaceHelpActions } from '../../../../app/help/WorkspaceHelp';
import { axisPresentationFeatures } from '../../../../app/axisPresentationFeatures';
import { AxisSchemaRecordDetail } from '../../../../app/schema/AxisSchemaRecordDetail';
import { ShellIcon } from '../../../../app/shell/ShellIcon';
import { type AxisDataListingColumn } from '../../../../app/table/AxisDataListing';
import { AxisSchemaDataListing } from '../../../../app/table/AxisSchemaDataListing';
import type { WorkbenchRecord } from '../../../../workbench/api/workbenchContracts';
import { WorkbenchRecordDetail } from '../../../../workbench/detail/WorkbenchRecordDetail';
import { WorkbenchDeleteDialog } from '../../../../workbench/delete/WorkbenchDeleteDialog';
import { WorkbenchRecordForm } from '../../../../workbench/form/WorkbenchRecordForm';
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
  '& .MuiChip-label': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};

export function SchemaWorkbenchRenderer({
  component,
  actions,
}: CmsComponentRendererProps) {
  const controller = actions?.workbench;
  const [schemaQuery, setSchemaQuery] = useState('');
  const [schemaModuleFilter, setSchemaModuleFilter] = useState(allSchemaModules);
  const [schemaVisibleCount, setSchemaVisibleCount] = useState(schemaBrowserPageSize);
  const [advancedQueryOpen, setAdvancedQueryOpen] = useState(false);
  const [schemaPanelOpen, setSchemaPanelOpen] = useState(true);
  if (!controller) {
    throw new Error('Schema Workbench renderer requires its presentation controller');
  }
  const normalizedSchemaQuery = schemaQuery.trim().toLocaleLowerCase();
  const scopedToNavigation = controller.scope?.kind === 'navigation';
  const schemaModules = Array.from(
    new Set(controller.schemas.map((schema) => schema.moduleName)),
  ).sort((left, right) => left.localeCompare(right));
  const visibleSchemas = controller.schemas
    .filter((schema) =>
      schemaModuleFilter === allSchemaModules
        ? true
        : schema.moduleName === schemaModuleFilter,
    )
    .filter((schema) =>
      normalizedSchemaQuery
        ? `${schema.label} ${schema.moduleName} ${schema.schemaName}`
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
          gridTemplateColumns: scopedToNavigation
            ? 'minmax(0, 1fr)'
            : schemaPanelOpen
              ? { xs: '1fr', lg: 'minmax(0, 1fr) 360px' }
              : { xs: '1fr', lg: 'minmax(0, 1fr) 64px' },
          gridTemplateRows: { xs: 'auto', lg: 'minmax(0, 1fr)' },
          height: { xs: 'auto', lg: '100%' },
          minHeight: 0,
          overflow: { xs: 'visible', lg: 'hidden' },
        }}
      >
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
          <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: 2 } }}>
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
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  sx={{
                    alignItems: { sm: 'flex-start' },
                    justifyContent: 'space-between',
                    minWidth: 0,
                  }}
                >
                  <Stack spacing={0.75} sx={{ flex: '1 1 auto', minWidth: 0 }}>
                    {scopedToNavigation && controller.scope?.parentLabel ? (
                      <Typography
                        color="text.secondary"
                        sx={{
                          fontWeight: 700,
                          letterSpacing: 1.8,
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
                        variant="h5"
                        sx={{
                          fontWeight: 750,
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
                          sx={{ ...schemaHeaderChipSx, bgcolor: 'action.selected' }}
                        />
                      ))}
                    </Stack>
                  </Stack>
                  {selected.operations.includes('create') ? (
                    <Button
                      disabled={controller.createOpen}
                      startIcon={<ShellIcon name="add" />}
                      sx={{ flexShrink: 0 }}
                      variant="contained"
                      onClick={controller.beginCreate}
                    >
                      {stringProperty(component, 'createLabel')} {selected.label}
                    </Button>
                  ) : null}
                </Stack>
                <Divider />
                {controller.createOpen ? (
                  <>
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
                    <Divider />
                  </>
                ) : null}
                <Box hidden={controller.createOpen}>
                  <Stack spacing={1.25}>
                    <Box
                      sx={{
                        bgcolor: 'background.default',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 2,
                        p: 1,
                      }}
                    >
                      <Stack spacing={1.25}>
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={1}
                          sx={{ alignItems: { md: 'center' } }}
                        >
                          <TextField
                            fullWidth
                            placeholder={stringProperty(
                              component,
                              'searchRecordsPlaceholder',
                            )}
                            size="small"
                            value={controller.recordSearch}
                            disabled={
                              selected.queryCapabilities.searchableFields.length === 0
                            }
                            slotProps={{
                              htmlInput: {
                                'aria-label': stringProperty(
                                  component,
                                  'searchRecordsLabel',
                                ),
                              },
                              input: {
                                startAdornment: (
                                  <InputAdornment position="start">
                                    <ShellIcon fontSize="small" name="search" />
                                  </InputAdornment>
                                ),
                              },
                            }}
                            onChange={(event) =>
                              controller.setRecordSearch(event.target.value)
                            }
                          />
                          <Button
                            color="inherit"
                            endIcon={
                              <ShellIcon
                                fontSize="small"
                                name={advancedQueryOpen ? 'chevron-up' : 'chevron-down'}
                              />
                            }
                            sx={{ flex: { md: '0 0 auto' }, minHeight: 40 }}
                            variant="outlined"
                            onClick={() => setAdvancedQueryOpen((open) => !open)}
                          >
                            Advanced query
                          </Button>
                        </Stack>
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
                        <Collapse in={advancedQueryOpen} timeout="auto" unmountOnExit>
                          <SchemaQueryBuilderRenderer
                            actions={actions}
                            component={component}
                          />
                        </Collapse>
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
                            {controller.recordFilters ? (
                              <Button
                                color="inherit"
                                size="small"
                                onClick={() => controller.setRecordFilters(undefined)}
                              >
                                {stringProperty(
                                  component,
                                  'clearFiltersLabel',
                                  'Clear filters',
                                )}
                              </Button>
                            ) : null}
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
                    </Box>
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
                                controller.setRecordPageSize(Number(event.target.value))
                              }
                            />
                          ) : null
                        }
                        getRowKey={recordKey}
                        leadingColumns={leadingRecordColumns}
                        maxBodyHeight="100%"
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
                        <WorkbenchRecordDetail
                          closeLabel={stringProperty(component, 'closeLabel')}
                          deleteLabel={stringProperty(component, 'deleteLabel')}
                          editLabel={stringProperty(component, 'editLabel')}
                          falseLabel={stringProperty(component, 'falseLabel')}
                          forbiddenFieldNames={forbiddenFieldNames}
                          detailPanels={controller.selectedRecordDetailPanels}
                          lifecycleActionError={controller.lifecycleActionError}
                          lifecycleActionPendingId={controller.lifecycleActionPendingId}
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
                    </Box>
                  ) : null}
                  {controller.openedReferenceRecord ? (
                    <Box sx={{ mt: 2 }}>
                      <AxisSchemaRecordDetail
                        actions={
                          <Button onClick={controller.closeReferenceRecord}>
                            {stringProperty(component, 'closeLabel')}
                          </Button>
                        }
                        falseLabel={stringProperty(component, 'falseLabel')}
                        record={controller.openedReferenceRecord.record}
                        referenceResolver={
                          controller.relationshipRuntime.resolveRecord
                            ? {
                                resolveReference:
                                  controller.relationshipRuntime.resolveRecord,
                              }
                            : undefined
                        }
                        schema={controller.openedReferenceRecord.schema}
                        title={`${controller.openedReferenceRecord.schema.label}: ${controller.openedReferenceRecord.reference}`}
                        trueLabel={stringProperty(component, 'trueLabel')}
                      />
                    </Box>
                  ) : null}
                </Box>
              </Stack>
            )}
          </CardContent>
        </Card>
        {!scopedToNavigation ? (
          <Card
            component="aside"
            data-testid="workbench-schema-navigation-pane"
            variant="outlined"
            sx={{
              alignSelf: 'stretch',
              height: { xs: 'auto', lg: '100%' },
              maxHeight: { xs: '70dvh', lg: 'none' },
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <CardContent
              sx={{
                display: 'flex',
                height: '100%',
                minHeight: 0,
                overflow: 'hidden',
                p: schemaPanelOpen ? { xs: 1.5, md: 2 } : 1,
                '&:last-child': { pb: schemaPanelOpen ? 2 : 1 },
              }}
            >
              {schemaPanelOpen ? (
                <Stack spacing={1} sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
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
                        'collapseSchemasLabel',
                        'Hide data types',
                      )}
                    >
                      <IconButton
                        aria-label={stringProperty(
                          component,
                          'collapseSchemasLabel',
                          'Hide data types',
                        )}
                        size="small"
                        onClick={() => setSchemaPanelOpen(false)}
                      >
                        <ShellIcon fontSize="small" name="chevron-right" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
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
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      overscrollBehavior: 'contain',
                      pr: 0.5,
                      scrollbarGutter: 'stable',
                    }}
                  >
                    {displayedSchemas.map((schema) => {
                      const key = `${schema.moduleName}:${schema.schemaName}`;
                      const favorite = controller.favoriteSchemas.includes(key);
                      return (
                        <Stack
                          key={key}
                          direction="row"
                          sx={{ alignItems: 'center', mb: 0.5 }}
                        >
                          <ListItemButton
                            selected={
                              selected?.moduleName === schema.moduleName &&
                              selected.schemaName === schema.schemaName
                            }
                            sx={{ borderRadius: 1.5 }}
                            onClick={() => controller.selectSchema(schema)}
                          >
                            <ListItemText
                              primary={schema.label}
                              secondary={schema.moduleName}
                              slotProps={{ primary: { sx: { fontWeight: 600 } } }}
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
                  <Stack spacing={1} sx={{ alignItems: 'stretch' }}>
                    <Typography color="text.secondary" variant="caption">
                      {displayedSchemas.length} shown from {visibleSchemas.length}
                    </Typography>
                    {hasMoreSchemas ? (
                      <Button
                        size="small"
                        variant="outlined"
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
              ) : (
                <Stack sx={{ alignItems: 'center' }}>
                  <Tooltip
                    title={stringProperty(
                      component,
                      'expandSchemasLabel',
                      'Show data types',
                    )}
                  >
                    <IconButton
                      aria-label={stringProperty(
                        component,
                        'expandSchemasLabel',
                        'Show data types',
                      )}
                      onClick={() => setSchemaPanelOpen(true)}
                    >
                      <ShellIcon name="chevron-left" />
                    </IconButton>
                  </Tooltip>
                  <ShellIcon color="disabled" name="schema" sx={{ mt: 1 }} />
                </Stack>
              )}
            </CardContent>
          </Card>
        ) : null}
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
