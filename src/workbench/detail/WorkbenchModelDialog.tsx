import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { AxisSchemaRecordDetail } from '../../app/schema/AxisSchemaRecordDetail';
import { ShellIcon } from '../../app/shell/ShellIcon';
import type { WorkbenchRecord, WorkbenchSchema } from '../api/workbenchContracts';
import { WorkbenchRecordForm } from '../form/WorkbenchRecordForm';
import type {
  WorkbenchRelationshipCopy,
  WorkbenchRelationshipRuntime,
} from '../form/WorkbenchRelationshipRuntime';
import { workbenchRelationshipRecordLabel } from '../form/workbenchRelationshipLabels';

import { defaultRelationshipCopy } from '../form/WorkbenchRelationshipRuntime';

interface WorkbenchModelDialogProps {
  readonly record: WorkbenchRecord;
  readonly schema: WorkbenchSchema;
  readonly runtime: WorkbenchRelationshipRuntime;
  readonly copy?: WorkbenchRelationshipCopy | undefined;
  readonly editable?: boolean | undefined;
  readonly depth?: number | undefined;
  readonly path?: readonly string[] | undefined;
  readonly closeLabel?: string | undefined;
  readonly saveLabel?: string | undefined;
  readonly savingLabel?: string | undefined;
  readonly onClose: () => void;
}

/** Each reference keeps its own edit state; closing restores the previous level.
 * No delete callback exists here: deletion belongs to the selected root model. */
export function WorkbenchModelDialog(props: WorkbenchModelDialogProps) {
  const [record, setRecord] = useState(props.record);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const copy = props.copy ?? defaultRelationshipCopy;
  const depth = props.depth ?? 0;
  const path = [...(props.path ?? []), props.schema.label];
  const closeLabel = props.closeLabel ?? 'Close reference';
  const label = workbenchRelationshipRecordLabel(
    record,
    props.schema,
    props.schema.label,
  );
  const canEdit =
    props.editable !== false &&
    props.schema.operations.includes('update') &&
    Boolean(props.runtime.updateRecord);
  return (
    <Dialog
      open
      fullWidth
      maxWidth="md"
      aria-label={`${props.schema.label}: ${label}`}
      onClose={() => {
        if (!editing && !saving) props.onClose();
      }}
      slotProps={{
        paper: {
          sx: {
            borderRadius: 1,
            m: { xs: 1, sm: 3 },
            width: { xs: 'calc(100% - 16px)', sm: '100%' },
            maxHeight: 'calc(100% - 32px)',
          },
        },
      }}
    >
      <DialogTitle
        component="div"
        sx={{ borderBottom: 1, borderColor: 'divider', px: 3, py: 2 }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr) auto',
              sm: 'minmax(0, 1fr) auto auto',
            },
            gap: 1.5,
            alignItems: 'center',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {path.join(' / ')}
            </Typography>
            <Typography component="h2" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
              {label}
            </Typography>
          </Box>
          {!editing && canEdit ? (
            <Button
              variant="outlined"
              sx={{
                gridRow: { xs: 2, sm: 1 },
                gridColumn: { xs: 1, sm: 2 },
                justifySelf: 'start',
              }}
              onClick={() => setEditing(true)}
            >
              {copy.editRelatedLabel}
            </Button>
          ) : null}
          <Tooltip title={closeLabel}>
            <Box component="span" sx={{ gridColumn: { xs: 2, sm: 3 }, gridRow: 1 }}>
              <IconButton
                aria-label={closeLabel}
                disabled={editing || saving}
                onClick={props.onClose}
              >
                <ShellIcon name="close" />
              </IconButton>
            </Box>
          </Tooltip>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
        {editing ? (
          <WorkbenchRecordForm
            cancelLabel={copy.cancelLabel}
            initialModel={record}
            schema={props.schema}
            relationshipCopy={copy}
            relationshipRuntime={props.runtime}
            depth={depth}
            saving={saving}
            savingLabel={props.savingLabel ?? 'Saving'}
            submitLabel={props.saveLabel ?? 'Save'}
            onCancel={() => setEditing(false)}
            onSubmit={async (model) => {
              if (!props.runtime.updateRecord) return;
              setSaving(true);
              try {
                const saved = await props.runtime.updateRecord(
                  props.schema,
                  record,
                  model,
                );
                setRecord({ ...record, ...model, ...saved });
                setEditing(false);
              } finally {
                setSaving(false);
              }
            }}
          />
        ) : (
          <AxisSchemaRecordDetail
            variant="plain"
            record={record}
            schema={props.schema}
            title={props.schema.label}
            referenceDepth={depth}
            referenceResolver={
              props.runtime.resolveRecord
                ? {
                    resolveReference: (relationship, reference) =>
                      props.runtime.resolveRecord!(
                        relationship,
                        reference,
                        props.schema,
                      ),
                  }
                : undefined
            }
            renderReference={(reference) => (
              <WorkbenchModelDialog
                {...reference}
                runtime={props.runtime}
                copy={copy}
                editable={reference.relationship.actions.includes('EDIT_RELATED')}
                depth={reference.referenceDepth}
                path={path}
                closeLabel={closeLabel}
                saveLabel={props.saveLabel}
                savingLabel={props.savingLabel}
              />
            )}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
