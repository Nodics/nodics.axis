import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { AxisMetadataPanel } from '../../app/detail/AxisMetadataPanel';
import { AxisSchemaRecordDetail } from '../../app/schema/AxisSchemaRecordDetail';
import { axisSchemaRecordDisplayValue } from '../../app/schema/axisSchemaRecordValues';
import { AxisSchemaDataListing } from '../../app/table/AxisSchemaDataListing';
import type { AxisNavigationLifecycleAction } from '../../bootstrap/publicBootstrap';
import type {
  WorkbenchRecord,
  WorkbenchRelationship,
  WorkbenchSchema,
} from '../api/workbenchContracts';
import type { WorkbenchRelationshipRuntime } from '../form/WorkbenchRelationshipRuntime';
import { workbenchRecordValue } from '../record/workbenchRecordPaths';
import { lifecycleActionsForRecord } from '../workbenchRouteModel';
import type { WorkbenchRecordDetailPanel } from './workbenchRecordDetailPanels';

interface WorkbenchRecordDetailProps {
  readonly closeLabel: string;
  readonly editLabel: string;
  readonly deleteLabel: string;
  readonly falseLabel: string;
  readonly forbiddenFieldNames?: readonly string[] | undefined;
  readonly detailPanels?: readonly WorkbenchRecordDetailPanel[] | undefined;
  readonly lifecycleActions?: readonly AxisNavigationLifecycleAction[] | undefined;
  readonly lifecycleActionError?: string | undefined;
  readonly lifecycleActionPendingId?: string | undefined;
  readonly lifecycleActionResult?: unknown;
  readonly record: WorkbenchRecord;
  readonly relationshipRuntime?: WorkbenchRelationshipRuntime | undefined;
  readonly schema: WorkbenchSchema;
  readonly trueLabel: string;
  readonly onClose: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onLifecycleAction?:
    | ((
        action: AxisNavigationLifecycleAction,
        record: WorkbenchRecord,
        input?: Readonly<Record<string, string>>,
      ) => Promise<unknown>)
    | undefined;
}

function WorkbenchLifecycleActionPanel({
  actions,
  error,
  pendingActionId,
  record,
  result,
  onExecute,
}: {
  readonly actions: readonly AxisNavigationLifecycleAction[];
  readonly error?: string | undefined;
  readonly pendingActionId?: string | undefined;
  readonly record: WorkbenchRecord;
  readonly result?: unknown;
  readonly onExecute?:
    | ((
        action: AxisNavigationLifecycleAction,
        record: WorkbenchRecord,
        input?: Readonly<Record<string, string>>,
      ) => Promise<unknown>)
    | undefined;
}) {
  const [selectedAction, setSelectedAction] = useState<AxisNavigationLifecycleAction>();
  const [input, setInput] = useState<Readonly<Record<string, string>>>({});
  if (actions.length === 0) return null;
  const begin = (action: AxisNavigationLifecycleAction) => {
    const defaults = Object.fromEntries(
      (action.inputFields ?? []).map((field) => {
        const value = field.valueFromRecord
          ? workbenchRecordValue(record, field.valueFromRecord)
          : undefined;
        return [
          field.name,
          value === undefined || value === null
            ? (field.defaultValue ?? '')
            : typeof value === 'string' ||
                typeof value === 'number' ||
                typeof value === 'boolean'
              ? String(value)
              : JSON.stringify(value),
        ];
      }),
    );
    if ((action.inputFields ?? []).every((field) => field.type === 'HIDDEN')) {
      if (onExecute) void onExecute(action, record, defaults);
      return;
    }
    setInput(defaults);
    setSelectedAction(action);
  };
  const visibleFields =
    selectedAction?.inputFields?.filter((field) => field.type !== 'HIDDEN') ?? [];
  const inputValid = visibleFields.every(
    (field) => !field.required || String(input[field.name] ?? '').trim() !== '',
  );
  const resultText =
    result === undefined
      ? undefined
      : typeof result === 'string'
        ? result
        : JSON.stringify(result, null, 2);
  const selectedOperationRoute =
    selectedAction?.operationRoute ?? 'the declared backend operation route';
  const selectedHttpMethod = selectedAction?.httpMethod ?? 'POST';
  return (
    <AxisMetadataPanel
      fields={[]}
      notice="Lifecycle actions are declared by the owning backend module. Executable actions call only the declared backend operation route."
      title="Lifecycle actions"
    >
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        {actions.map((action) => {
          const executable =
            action.operationRoute !== undefined &&
            action.featureState !== 'DISABLED' &&
            onExecute !== undefined;
          const pending = pendingActionId === action.id;
          return (
            <Button
              key={action.id}
              disabled={!executable || pendingActionId !== undefined}
              size="small"
              variant={executable ? 'contained' : 'outlined'}
              onClick={() => {
                if (executable) begin(action);
              }}
            >
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ alignItems: 'center', minWidth: 0 }}
              >
                <span>{pending ? 'Working…' : action.label}</span>
                <Chip
                  label={action.intent}
                  size="small"
                  sx={{ height: 22, pointerEvents: 'none' }}
                />
              </Stack>
            </Button>
          );
        })}
      </Stack>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {resultText ? (
        <Alert
          severity="success"
          sx={{
            '& .MuiAlert-message': {
              minWidth: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            },
          }}
        >
          <Typography component="strong" sx={{ display: 'block', fontWeight: 700 }}>
            Backend lifecycle action completed.
          </Typography>
          {resultText}
        </Alert>
      ) : null}
      <Dialog
        open={selectedAction !== undefined}
        onClose={() => setSelectedAction(undefined)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{selectedAction?.label}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {selectedAction?.summary ? (
              <Typography color="text.secondary">{selectedAction.summary}</Typography>
            ) : null}
            <Alert severity="warning">
              Confirm backend action: Axis will execute {selectedAction?.label} only
              through {selectedHttpMethod} {selectedOperationRoute}. Review the request,
              required evidence and permissions before submitting.
            </Alert>
            {visibleFields.map((field) => (
              <TextField
                key={field.name}
                label={field.label}
                multiline={field.type === 'MULTILINE' || field.type === 'JSON'}
                minRows={
                  field.type === 'MULTILINE' || field.type === 'JSON' ? 3 : undefined
                }
                required={field.required}
                select={field.type === 'SELECT'}
                value={input[field.name] ?? ''}
                slotProps={{ htmlInput: { maxLength: field.maximumLength } }}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }))
                }
              >
                {field.options?.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedAction(undefined)}>Cancel</Button>
          <Button
            disabled={!inputValid || pendingActionId !== undefined}
            variant="contained"
            onClick={() => {
              if (!selectedAction || !onExecute) return;
              void onExecute(selectedAction, record, input).then(() =>
                setSelectedAction(undefined),
              );
            }}
          >
            {pendingActionId ? 'Working…' : selectedAction?.label}
          </Button>
        </DialogActions>
      </Dialog>
    </AxisMetadataPanel>
  );
}

function relatedRecordKey(record: WorkbenchRecord, index: number): string {
  const identity = record._id ?? record.code;
  return typeof identity === 'string' || typeof identity === 'number'
    ? String(identity)
    : `related-record-${String(index)}`;
}

function relatedDefaultColumns(schema: WorkbenchSchema): readonly string[] {
  const keys = [
    ...schema.displayProperties,
    ...schema.fields
      .filter((field) => field.primary || field.searchable)
      .map((field) => field.name),
  ];
  return Object.freeze([...new Set(keys)].slice(0, 5));
}

function WorkbenchRelatedDetailPanel({
  detailPanel,
  falseLabel,
  relationshipRuntime,
  trueLabel,
}: {
  readonly detailPanel: WorkbenchRecordDetailPanel;
  readonly falseLabel: string;
  readonly relationshipRuntime?: WorkbenchRelationshipRuntime | undefined;
  readonly trueLabel: string;
}) {
  const { panel, schema, page, loading, error } = detailPanel;
  const [loadingReference, setLoadingReference] = useState(false);
  const [referenceError, setReferenceError] = useState<string>();
  const [openedReference, setOpenedReference] = useState<
    | {
        readonly record: WorkbenchRecord;
        readonly reference: string;
        readonly schema: WorkbenchSchema;
      }
    | undefined
  >();
  const openReference = async (
    relationship: WorkbenchRelationship,
    reference: string,
  ) => {
    if (!relationshipRuntime?.resolveRecord) return;
    setOpenedReference(undefined);
    setReferenceError(undefined);
    setLoadingReference(true);
    try {
      const result = await relationshipRuntime.resolveRecord(relationship, reference);
      if (!result) {
        setReferenceError('Referenced record was not found or is not authorized.');
        return;
      }
      setOpenedReference({
        record: result.record,
        reference,
        schema: result.schema,
      });
    } catch (referenceLoadError: unknown) {
      setReferenceError(
        referenceLoadError instanceof Error
          ? referenceLoadError.message
          : 'Referenced record could not be loaded.',
      );
    } finally {
      setLoadingReference(false);
    }
  };

  if (!schema) {
    return (
      <AxisMetadataPanel
        fields={[
          {
            key: 'target',
            label: 'Target schema',
            value: `${panel.target.moduleName}.${panel.target.schemaName}`,
          },
        ]}
        notice="The related schema is not available in the authorized workbench catalogue."
        title={panel.label}
      />
    );
  }
  const records = page?.records ?? [];
  return (
    <AxisMetadataPanel fields={[]} notice={panel.summary} title={panel.label}>
      <Stack spacing={1}>
        <Typography color="text.secondary" variant="body2">
          {loading
            ? 'Loading'
            : `${String(page?.totalCount ?? records.length)} records`}
        </Typography>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {loading ? (
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', color: 'text.secondary' }}
          >
            <CircularProgress size={18} />
            <Typography variant="body2">Loading related records</Typography>
          </Stack>
        ) : (
          <Box>
            <AxisSchemaDataListing
              ariaLabel={`${panel.label} related records`}
              defaultVisibleColumnKeys={relatedDefaultColumns(schema)}
              emptyMessage="No related records found."
              exportEnabled={false}
              getRowKey={relatedRecordKey}
              maxBodyHeight={260}
              minTableWidth={Math.max(640, schema.fields.length * 140)}
              records={records}
              schema={schema}
              size="small"
              toolbarStart={
                <Typography color="text.secondary" variant="body2">
                  {schema.label}
                </Typography>
              }
              onReferenceClick={(relationship, reference) => {
                void openReference(relationship, reference);
              }}
            />
          </Box>
        )}
        {loadingReference ? (
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', color: 'text.secondary' }}
          >
            <CircularProgress size={18} />
            <Typography variant="body2">Loading referenced record</Typography>
          </Stack>
        ) : null}
        {referenceError ? <Alert severity="warning">{referenceError}</Alert> : null}
        {openedReference ? (
          <AxisSchemaRecordDetail
            actions={
              <Button size="small" onClick={() => setOpenedReference(undefined)}>
                Close reference
              </Button>
            }
            falseLabel={falseLabel}
            record={openedReference.record}
            referenceResolver={
              relationshipRuntime?.resolveRecord
                ? { resolveReference: relationshipRuntime.resolveRecord }
                : undefined
            }
            schema={openedReference.schema}
            title={`${openedReference.schema.label}: ${openedReference.reference}`}
            trueLabel={trueLabel}
          />
        ) : null}
      </Stack>
    </AxisMetadataPanel>
  );
}

export function WorkbenchRecordDetail(props: WorkbenchRecordDetailProps) {
  const titleField = props.schema.fields.find(
    (field) => field.name === props.schema.displayProperty,
  );
  const title = axisSchemaRecordDisplayValue(
    workbenchRecordValue(props.record, props.schema.displayProperty) ??
      props.schema.label,
    titleField,
    props.trueLabel,
    props.falseLabel,
  );
  return (
    <Stack spacing={1.5}>
      <AxisSchemaRecordDetail
        actions={
          <>
            <Button onClick={props.onClose}>{props.closeLabel}</Button>
            {props.schema.operations.includes('update') ? (
              <Button variant="contained" onClick={props.onEdit}>
                {props.editLabel}
              </Button>
            ) : null}
            {props.schema.operations.includes('delete') ? (
              <Button color="error" onClick={props.onDelete}>
                {props.deleteLabel}
              </Button>
            ) : null}
          </>
        }
        falseLabel={props.falseLabel}
        forbiddenFieldNames={props.forbiddenFieldNames}
        record={props.record}
        referenceResolver={
          props.relationshipRuntime?.resolveRecord
            ? { resolveReference: props.relationshipRuntime.resolveRecord }
            : undefined
        }
        schema={props.schema}
        title={title}
        trueLabel={props.trueLabel}
      />
      <WorkbenchLifecycleActionPanel
        actions={lifecycleActionsForRecord(props.lifecycleActions ?? [], props.record)}
        error={props.lifecycleActionError}
        pendingActionId={props.lifecycleActionPendingId}
        record={props.record}
        result={props.lifecycleActionResult}
        onExecute={props.onLifecycleAction}
      />
      {props.detailPanels?.map((detailPanel) => (
        <WorkbenchRelatedDetailPanel
          key={detailPanel.panel.id}
          detailPanel={detailPanel}
          falseLabel={props.falseLabel}
          relationshipRuntime={props.relationshipRuntime}
          trueLabel={props.trueLabel}
        />
      ))}
    </Stack>
  );
}
