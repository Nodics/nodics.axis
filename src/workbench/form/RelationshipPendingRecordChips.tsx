import { Box, Button, Stack, Typography } from '@mui/material';
import { useState } from 'react';

import { AxisSchemaRecordDetail } from '../../app/schema/AxisSchemaRecordDetail';
import type { WorkbenchRelationship, WorkbenchSchema } from '../api/workbenchContracts';
import type {
  WorkbenchRelationshipCopy,
  WorkbenchRelationshipRuntime,
} from './WorkbenchRelationshipRuntime';
import { WorkbenchRecordForm } from './WorkbenchRecordForm';
import { WorkbenchFormDialog } from './WorkbenchFormDialog';
import {
  displayWorkbenchRelationshipValue,
  workbenchRelationshipRecordLabel,
} from './workbenchRelationshipLabels';

interface RelationshipPendingRecordChipsProps {
  readonly copy: WorkbenchRelationshipCopy;
  readonly depth: number;
  readonly disabled: boolean;
  readonly lineage: readonly string[];
  readonly pendingRecords: readonly Readonly<Record<string, unknown>>[];
  readonly relationship: WorkbenchRelationship;
  readonly runtime: WorkbenchRelationshipRuntime;
  readonly targetSchema: WorkbenchSchema;
  readonly onRemove: (index: number) => void;
  readonly onUpdate: (index: number, model: Readonly<Record<string, unknown>>) => void;
}

interface ActivePendingRecord {
  readonly index: number;
  readonly model: Readonly<Record<string, unknown>>;
}

export function RelationshipPendingRecordChips(
  props: RelationshipPendingRecordChipsProps,
) {
  const [previewRecord, setPreviewRecord] = useState<ActivePendingRecord>();
  const [editRecord, setEditRecord] = useState<ActivePendingRecord>();
  const targetKey = `${props.targetSchema.moduleName}:${props.targetSchema.schemaName}`;

  if (props.pendingRecords.length === 0) return null;

  return (
    <Stack spacing={1}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={0.75}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Typography color="text.secondary" sx={{ fontWeight: 700 }} variant="body2">
          {props.copy.pendingReferencesLabel}
        </Typography>
        <Typography color="text.secondary" variant="caption">
          {props.pendingRecords.length} pending
        </Typography>
      </Stack>
      <Stack spacing={0.75}>
        {props.pendingRecords.map((model, index) => {
          const label = displayWorkbenchRelationshipValue(
            workbenchRelationshipRecordLabel(model, props.targetSchema, ''),
            `${props.relationship.label} ${String(index + 1)}`,
          );
          return (
            <Box
              key={`pending-${String(index)}`}
              sx={{
                alignItems: 'center',
                border: 1,
                borderColor: 'warning.light',
                borderRadius: 1.5,
                display: 'flex',
                gap: 1,
                justifyContent: 'space-between',
                minWidth: 0,
                px: 1,
                py: 0.75,
              }}
            >
              <Button
                color="warning"
                size="small"
                sx={{ justifyContent: 'flex-start', minWidth: 0, textAlign: 'left' }}
                variant="outlined"
                onClick={() => setPreviewRecord({ index, model })}
              >
                <Typography component="span" noWrap variant="body2">
                  {label}
                </Typography>
              </Button>
              {props.disabled ? null : (
                <Button
                  aria-label={`${props.copy.removeReferenceLabel} ${label}`}
                  color="error"
                  size="small"
                  onClick={() => props.onRemove(index)}
                >
                  {props.copy.removeReferenceLabel}
                </Button>
              )}
            </Box>
          );
        })}
      </Stack>
      {previewRecord ? (
        <WorkbenchFormDialog title={props.relationship.label}>
          <AxisSchemaRecordDetail
            actions={
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                <Button
                  disabled={props.disabled}
                  size="small"
                  onClick={() => {
                    setEditRecord(previewRecord);
                    setPreviewRecord(undefined);
                  }}
                >
                  {props.copy.editRelatedLabel}
                </Button>
                <Button size="small" onClick={() => setPreviewRecord(undefined)}>
                  {props.copy.removeRelatedLabel}
                </Button>
              </Stack>
            }
            record={previewRecord.model}
            referenceResolver={
              props.runtime.resolveRecord
                ? {
                    resolveReference: (relationship, reference) =>
                      props.runtime.resolveRecord!(
                        relationship,
                        reference,
                        props.targetSchema,
                      ),
                  }
                : undefined
            }
            schema={props.targetSchema}
            title={`Pending ${props.relationship.label}: ${workbenchRelationshipRecordLabel(
              previewRecord.model,
              props.targetSchema,
              String(previewRecord.index + 1),
            )}`}
          />
        </WorkbenchFormDialog>
      ) : null}
      {editRecord ? (
        <WorkbenchFormDialog
          title={`${props.copy.editRelatedLabel} ${props.relationship.label}`}
        >
          <WorkbenchRecordForm
            cancelLabel={props.copy.cancelLabel}
            depth={props.depth + 1}
            deferRelatedCreates
            initialModel={editRecord.model}
            lineage={[...props.lineage, targetKey]}
            relationshipCopy={props.copy}
            relationshipRuntime={props.runtime}
            saving={false}
            savingLabel={props.copy.editRelatedLabel}
            schema={props.targetSchema}
            submitLabel={props.copy.editRelatedLabel}
            title={`${props.copy.editRelatedLabel} ${props.relationship.label}`}
            onCancel={() => setEditRecord(undefined)}
            onSubmit={(model) => {
              props.onUpdate(editRecord.index, model);
              setEditRecord(undefined);
            }}
          />
        </WorkbenchFormDialog>
      ) : null}
    </Stack>
  );
}
