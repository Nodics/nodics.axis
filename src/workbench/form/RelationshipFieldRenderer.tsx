import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import type {
  WorkbenchRecord,
  WorkbenchRelationship,
  WorkbenchSchema,
} from '../api/workbenchContracts';
import { workbenchRecordValue } from '../record/workbenchRecordPaths';
import { resolveWorkbenchLookupPageSize } from '../workbenchRouteModel';
import type {
  WorkbenchRelationshipCopy,
  WorkbenchRelationshipDraft,
  WorkbenchRelationshipLoadResult,
  WorkbenchRelationshipRuntime,
} from './WorkbenchRelationshipRuntime';
import { WorkbenchRecordForm } from './WorkbenchRecordForm';
import { WorkbenchFormDialog } from './WorkbenchFormDialog';
import { RelationshipPendingRecordChips } from './RelationshipPendingRecordChips';
import { RelationshipReferenceChips } from './RelationshipReferenceChips';
import {
  workbenchRelationshipDescriptionValue,
  workbenchRelationshipRecordLabel,
} from './workbenchRelationshipLabels';

interface RelationshipFieldRendererProps {
  readonly copy: WorkbenchRelationshipCopy;
  readonly disabled: boolean;
  readonly draft: WorkbenchRelationshipDraft;
  readonly error?: string | undefined;
  readonly relationship: WorkbenchRelationship;
  readonly runtime: WorkbenchRelationshipRuntime;
  readonly targetSchema: WorkbenchSchema;
  readonly depth: number;
  readonly lineage: readonly string[];
  readonly onChange: (draft: WorkbenchRelationshipDraft) => void;
}

function referenceValue(
  record: Readonly<Record<string, unknown>>,
  property: string,
): string | undefined {
  const value = workbenchRecordValue(record, property);
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : undefined;
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function isWorkbenchRecordList(
  result: WorkbenchRelationshipLoadResult,
): result is readonly WorkbenchRecord[] {
  return Array.isArray(result);
}

interface NormalizedRelationshipPage {
  readonly records: readonly WorkbenchRecord[];
  readonly totalCount: number;
  readonly pageNumber: number;
  readonly pageSize: number;
}

function normalizeRelationshipPage(
  result: WorkbenchRelationshipLoadResult,
  pageNumber: number,
  pageSize: number,
): NormalizedRelationshipPage {
  if (isWorkbenchRecordList(result)) {
    return Object.freeze({
      records: result,
      totalCount: result.length,
      pageNumber,
      pageSize,
    });
  }
  return Object.freeze({
    records: result.records,
    totalCount: result.totalCount,
    pageNumber: result.pageNumber,
    pageSize: result.pageSize,
  });
}

function relationshipResultsLabel(
  template: string,
  shown: number,
  total: number,
): string {
  return template.replace('{shown}', String(shown)).replace('{total}', String(total));
}

export function RelationshipFieldRenderer(props: RelationshipFieldRendererProps) {
  const [selectOpen, setSelectOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editRecord, setEditRecord] = useState<Readonly<Record<string, unknown>>>();
  const backendSearch = search.trim();
  const pageSize = resolveWorkbenchLookupPageSize(props.targetSchema);
  const records = useInfiniteQuery({
    enabled: selectOpen,
    queryKey: [
      'schema-workbench',
      'relationship-records',
      ...props.runtime.queryScope,
      props.targetSchema.moduleName,
      props.targetSchema.schemaName,
      props.targetSchema.connectionInstanceId ?? '',
      props.targetSchema.connectionServer ?? '',
      props.targetSchema.connectionEnvironment ?? '',
      backendSearch,
      pageSize,
    ],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      normalizeRelationshipPage(
        await props.runtime.loadRecords(props.targetSchema, {
          search: backendSearch,
          pageNumber: pageParam,
          pageSize,
        }),
        pageParam,
        pageSize,
      ),
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.records.length, 0);
      return loaded < lastPage.totalCount ? lastPage.pageNumber + 1 : undefined;
    },
  });
  const selected = new Set(props.draft.references);
  const label = props.relationship.label;
  const createLabel = `${props.targetSchema.form?.copy.createRelatedLabel ?? props.copy.createRelatedLabel} ${props.targetSchema.label}`;
  const allRecords = useMemo(
    () => records.data?.pages.flatMap((page) => [...page.records]) ?? [],
    [records.data],
  );
  const loadedCount = allRecords.length;
  const totalCount = records.data?.pages.at(-1)?.totalCount ?? loadedCount;
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleRecords = allRecords.filter((record) => {
    if (!normalizedSearch) return true;
    const reference = referenceValue(record, props.relationship.referenceProperty);
    const display = workbenchRelationshipRecordLabel(record, props.targetSchema, '');
    return `${display} ${reference ?? ''}`
      .toLocaleLowerCase()
      .includes(normalizedSearch);
  });
  const selectableRecords = (visibleRecords ?? []).flatMap((record, index) => {
    const reference = referenceValue(record, props.relationship.referenceProperty);
    if (!reference) return [];
    return [{ index, record, reference }];
  });
  const missingReferenceProperty =
    !records.isLoading &&
    !records.error &&
    (visibleRecords?.length ?? 0) > 0 &&
    selectableRecords.length === 0;
  const targetKey = `${props.targetSchema.moduleName}:${props.targetSchema.schemaName}`;
  const nestedCreateAllowed =
    props.depth < (props.relationship.maximumDepth ?? 3) &&
    !props.lineage.includes(targetKey);
  const canCreateRelated =
    props.relationship.actions.includes('CREATE_RELATED') &&
    nestedCreateAllowed &&
    props.targetSchema.operations.includes('create');
  const toggleSelectExisting = () => {
    setSelectOpen((current) => {
      if (current) setSearch('');
      return !current;
    });
  };
  const openCreate = () => {
    setSelectOpen(false);
    setSearch('');
    setCreateOpen(true);
  };

  return (
    <Box
      component="fieldset"
      sx={{
        border: 1,
        borderColor: props.error ? 'error.main' : 'divider',
        borderRadius: 1.5,
        gridColumn: '1 / -1',
        m: 0,
        minWidth: 0,
        p: 2,
      }}
    >
      <Typography component="legend" sx={{ px: 0.75, fontWeight: 700 }}>
        {label}
        {props.relationship.required ? ' *' : ''}
      </Typography>
      <Stack spacing={1.5}>
        {props.error ? <Alert severity="error">{props.error}</Alert> : null}
        <RelationshipReferenceChips
          copy={props.copy}
          disabled={props.disabled}
          draftReferences={props.draft.references}
          relationship={props.relationship}
          runtime={props.runtime}
          targetSchema={props.targetSchema}
          onRemove={(reference) =>
            props.onChange({
              ...props.draft,
              references: props.draft.references.filter(
                (candidate) => candidate !== reference,
              ),
            })
          }
        />
        <RelationshipPendingRecordChips
          copy={props.copy}
          depth={props.depth}
          disabled={props.disabled}
          lineage={props.lineage}
          pendingRecords={props.draft.pending}
          relationship={props.relationship}
          runtime={props.runtime}
          targetSchema={props.targetSchema}
          onRemove={(index) =>
            props.onChange({
              ...props.draft,
              pending: props.draft.pending.filter(
                (_, candidate) => candidate !== index,
              ),
            })
          }
          onUpdate={(index, model) =>
            props.onChange({
              ...props.draft,
              pending: props.draft.pending.map((candidate, candidateIndex) =>
                candidateIndex === index ? model : candidate,
              ),
            })
          }
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {props.relationship.actions.includes('SELECT_EXISTING') ? (
            <Button
              disabled={props.disabled}
              variant="outlined"
              onClick={toggleSelectExisting}
            >
              {props.copy.selectExistingLabel}
            </Button>
          ) : null}
          {canCreateRelated && !selectOpen ? (
            <Button disabled={props.disabled} variant="outlined" onClick={openCreate}>
              {createLabel}
            </Button>
          ) : null}
        </Stack>
        {selectOpen ? (
          <Stack aria-label={`${props.copy.selectExistingLabel} ${label}`} spacing={1}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ alignItems: { sm: 'flex-start' } }}
            >
              <TextField
                fullWidth
                label={props.copy.relatedSearchLabel}
                size="small"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {canCreateRelated ? (
                <Button
                  disabled={props.disabled}
                  sx={{ flexShrink: 0, minHeight: 40 }}
                  variant="outlined"
                  onClick={openCreate}
                >
                  {createLabel}
                </Button>
              ) : null}
            </Stack>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
            >
              <Typography color="text.secondary" variant="body2">
                {props.relationship.cardinality === 'ONE'
                  ? props.copy.singleSelectionHintLabel
                  : props.copy.manySelectionHintLabel}
              </Typography>
              {!records.isLoading && !records.error ? (
                <Typography color="text.secondary" variant="body2">
                  {relationshipResultsLabel(
                    props.copy.relatedResultsLabel,
                    selectableRecords.length,
                    totalCount,
                  )}
                </Typography>
              ) : null}
            </Stack>
            <Divider />
            {records.isLoading ? <CircularProgress size={22} /> : null}
            {records.error ? (
              <Alert severity="error">{records.error.message}</Alert>
            ) : null}
            {!records.isLoading &&
            !records.error &&
            (visibleRecords?.length ?? 0) === 0 ? (
              <Typography color="text.secondary">
                {props.copy.noRelatedRecordsLabel}
              </Typography>
            ) : null}
            {missingReferenceProperty ? (
              <Alert severity="warning">
                {props.copy.missingReferencePropertyLabel.replace(
                  '{property}',
                  props.relationship.referenceProperty,
                )}
              </Alert>
            ) : null}
            {selectableRecords.map(({ index, record, reference }) => {
              const checked = selected.has(reference);
              const description = workbenchRelationshipDescriptionValue(record);
              const hasDescription = description.length > 0;
              const optionLabel = workbenchRelationshipRecordLabel(
                record,
                props.targetSchema,
                reference ?? `${label} ${String(index + 1)}`,
              );
              return (
                <Stack
                  key={reference}
                  direction="row"
                  sx={{
                    alignItems: 'center',
                    border: 1,
                    borderColor: checked ? 'warning.light' : 'divider',
                    borderRadius: 1.25,
                    justifyContent: 'space-between',
                    px: 1,
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={checked}
                        disabled={props.disabled}
                        onChange={() => {
                          if (props.relationship.cardinality === 'ONE') {
                            props.onChange({
                              ...props.draft,
                              references: checked ? [] : [reference],
                              pending: checked ? props.draft.pending : [],
                            });
                            return;
                          }
                          const references = checked
                            ? props.draft.references.filter(
                                (candidate) => candidate !== reference,
                              )
                            : unique([...props.draft.references, reference]);
                          props.onChange({ ...props.draft, references });
                        }}
                      />
                    }
                    label={
                      <Tooltip
                        arrow
                        describeChild
                        disableFocusListener={!hasDescription}
                        disableHoverListener={!hasDescription}
                        title={hasDescription ? description : ''}
                      >
                        <Typography component="span">{optionLabel}</Typography>
                      </Tooltip>
                    }
                  />
                  {props.relationship.actions.includes('EDIT_RELATED') &&
                  props.targetSchema.operations.includes('update') &&
                  props.runtime.updateRecord ? (
                    <Button
                      disabled={props.disabled}
                      size="small"
                      onClick={() => setEditRecord(record)}
                    >
                      {props.copy.editRelatedLabel}
                    </Button>
                  ) : null}
                </Stack>
              );
            })}
            {records.hasNextPage ? (
              <Box>
                <Button
                  disabled={props.disabled || records.isFetchingNextPage}
                  size="small"
                  variant="outlined"
                  onClick={() => void records.fetchNextPage()}
                >
                  {records.isFetchingNextPage ? (
                    <CircularProgress size={16} sx={{ mr: 1 }} />
                  ) : null}
                  {props.copy.loadMoreRelatedLabel}
                </Button>
              </Box>
            ) : null}
          </Stack>
        ) : null}
        {editRecord ? (
          <WorkbenchFormDialog title={`${props.copy.editRelatedLabel} ${label}`}>
            <WorkbenchRecordForm
              cancelLabel={props.copy.cancelLabel}
              depth={props.depth + 1}
              initialModel={editRecord}
              lineage={[...props.lineage, targetKey]}
              relationshipCopy={props.copy}
              relationshipRuntime={props.runtime}
              saving={false}
              savingLabel={props.copy.editRelatedLabel}
              schema={props.targetSchema}
              submitLabel={props.copy.editRelatedLabel}
              title={`${props.copy.editRelatedLabel} ${label}`}
              onCancel={() => setEditRecord(undefined)}
              onSubmit={async (model) => {
                if (!props.runtime.updateRecord) {
                  throw new Error('Related record update is unavailable');
                }
                await props.runtime.updateRecord(props.targetSchema, editRecord, model);
                setEditRecord(undefined);
                await records.refetch();
              }}
            />
          </WorkbenchFormDialog>
        ) : null}
        {createOpen ? (
          <WorkbenchFormDialog title={createLabel}>
            <WorkbenchRecordForm
              cancelLabel={props.copy.cancelLabel}
              deferRelatedCreates
              depth={props.depth + 1}
              lineage={[...props.lineage, targetKey]}
              relationshipCopy={props.copy}
              relationshipRuntime={props.runtime}
              saving={false}
              savingLabel={props.copy.addToDraftLabel}
              schema={props.targetSchema}
              submitLabel={props.copy.addToDraftLabel}
              title={createLabel}
              onCancel={() => setCreateOpen(false)}
              onSubmit={(model) => {
                const pending =
                  props.relationship.cardinality === 'ONE'
                    ? [model]
                    : [...props.draft.pending, model];
                props.onChange({
                  pending: Object.freeze(pending),
                  references:
                    props.relationship.cardinality === 'ONE'
                      ? Object.freeze([])
                      : props.draft.references,
                });
                setCreateOpen(false);
              }}
            />
          </WorkbenchFormDialog>
        ) : null}
      </Stack>
    </Box>
  );
}
