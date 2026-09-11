import {
  Alert,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useState, type ReactNode } from 'react';

import { AxisMetadataPanel, type AxisMetadataField } from '../detail/AxisMetadataPanel';
import type {
  WorkbenchRecord,
  WorkbenchRelationship,
  WorkbenchSchema,
} from '../../workbench/api/workbenchContracts';
import {
  containerFieldNames,
  workbenchRecordValue,
} from '../../workbench/record/workbenchRecordPaths';
import {
  axisSchemaRecordDisplayValue,
  isLongSchemaDetailField,
} from './axisSchemaRecordValues';
import { AxisSchemaReferenceValues } from './AxisSchemaReferenceValues';
import { ShellIcon } from '../shell/ShellIcon';
import {
  axisSchemaRelationshipReferences,
  type AxisSchemaReferenceValue,
} from './axisSchemaReferenceValuesModel';

export interface AxisSchemaRecordDetailProps {
  readonly variant?: 'panel' | 'plain' | undefined;
  readonly renderReference?:
    | ((props: AxisSchemaReferenceDetailProps) => ReactNode)
    | undefined;
  readonly actions?: ReactNode | undefined;
  readonly falseLabel?: string | undefined;
  readonly notice?: string | undefined;
  readonly record: WorkbenchRecord;
  readonly forbiddenFieldNames?: readonly string[] | undefined;
  readonly referenceResolver?: AxisSchemaRecordReferenceResolver | undefined;
  readonly referenceDepth?: number | undefined;
  readonly schema: WorkbenchSchema;
  readonly title?: ReactNode | undefined;
  readonly trueLabel?: string | undefined;
}

export interface AxisSchemaReferenceDetailProps {
  readonly record: WorkbenchRecord;
  readonly schema: WorkbenchSchema;
  readonly relationship: WorkbenchRelationship;
  readonly referenceDepth: number;
  readonly onClose: () => void;
}

export interface AxisSchemaRecordReferenceResult {
  readonly record: WorkbenchRecord;
  readonly schema: WorkbenchSchema;
}

export interface AxisSchemaRecordReferenceResolver {
  readonly resolveReference: (
    relationship: WorkbenchRelationship,
    reference: string,
  ) => Promise<AxisSchemaRecordReferenceResult | undefined>;
}

interface AxisSchemaLoadedReference extends AxisSchemaReferenceValue {
  readonly record: WorkbenchRecord;
  readonly schema: WorkbenchSchema;
}

function schemaDetailFields(
  schema: WorkbenchSchema,
  record: WorkbenchRecord,
  trueLabel: string,
  falseLabel: string,
  forbiddenFieldNames: readonly string[],
  referenceResolver: AxisSchemaRecordReferenceResolver | undefined,
  referenceDepth: number,
  onReferenceOpen: (reference: AxisSchemaReferenceValue) => void,
): readonly AxisMetadataField[] {
  const containerFields = containerFieldNames(schema.fields);
  const relationships = new Map(
    schema.relationships.map((relationship) => [relationship.field, relationship]),
  );
  const forbiddenFields = new Set(forbiddenFieldNames);
  return schema.fields
    .filter(
      (field) => !containerFields.has(field.name) && !forbiddenFields.has(field.name),
    )
    .map((field) => {
      const rawValue = workbenchRecordValue(record, field.name);
      const relationship = relationships.get(field.name);
      const relationshipCanOpen =
        relationship &&
        referenceResolver &&
        referenceDepth < Math.max(0, relationship.maximumDepth ?? 3);
      const references = relationshipCanOpen
        ? axisSchemaRelationshipReferences(rawValue, relationship)
        : Object.freeze([]);
      const value =
        relationship && references.length > 0 ? (
          <AxisSchemaReferenceValues
            references={references}
            variant="outlined"
            onReferenceClick={onReferenceOpen}
          />
        ) : (
          axisSchemaRecordDisplayValue(rawValue, field, trueLabel, falseLabel)
        );
      return {
        key: field.name,
        label: field.label,
        value,
        fullWidth:
          references.length > 2 ||
          (typeof value === 'string' && isLongSchemaDetailField(field, value)),
        monospace: /checksum|token|signature/i.test(field.name),
      };
    });
}

export function AxisSchemaRecordDetail({
  actions,
  falseLabel = 'No',
  forbiddenFieldNames = [],
  notice,
  record,
  referenceDepth = 0,
  referenceResolver,
  renderReference,
  schema,
  title,
  trueLabel = 'Yes',
  variant,
}: AxisSchemaRecordDetailProps) {
  const [loadedReference, setLoadedReference] = useState<AxisSchemaLoadedReference>();
  const [loadingReference, setLoadingReference] = useState(false);
  const [referenceError, setReferenceError] = useState<string>();
  const canOpenReferences = Boolean(referenceResolver);
  const openReference = (reference: AxisSchemaReferenceValue) => {
    const maximumReferenceDepth = Math.max(0, reference.relationship.maximumDepth ?? 3);
    if (!referenceResolver || referenceDepth >= maximumReferenceDepth) return;
    setLoadedReference(undefined);
    setReferenceError(undefined);
    setLoadingReference(true);
    void referenceResolver
      .resolveReference(reference.relationship, reference.reference)
      .then((result) => {
        if (!result) {
          setReferenceError('Referenced record was not found or is not authorized.');
          return;
        }
        setLoadedReference({
          ...reference,
          record: result.record,
          schema: result.schema,
        });
      })
      .catch((error: unknown) =>
        setReferenceError(
          error instanceof Error
            ? error.message
            : 'Referenced record could not be loaded.',
        ),
      )
      .finally(() => setLoadingReference(false));
  };
  return (
    <AxisMetadataPanel
      variant={variant}
      actions={actions}
      fields={schemaDetailFields(
        variant === 'plain'
          ? {
              ...schema,
              fields: schema.fields.filter((field) => {
                const value = workbenchRecordValue(record, field.name);
                return (
                  !field.readOnly ||
                  (value !== undefined && value !== null && value !== '')
                );
              }),
            }
          : schema,
        record,
        trueLabel,
        falseLabel,
        forbiddenFieldNames,
        canOpenReferences ? referenceResolver : undefined,
        referenceDepth,
        openReference,
      )}
      notice={notice}
      title={title ?? 'Metadata'}
    >
      {loadingReference ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={18} />
          <Typography color="text.secondary" variant="body2">
            Loading referenced record
          </Typography>
        </Stack>
      ) : null}
      {referenceError ? <Alert severity="warning">{referenceError}</Alert> : null}
      {loadedReference && renderReference ? (
        renderReference({
          record: loadedReference.record,
          schema: loadedReference.schema,
          relationship: loadedReference.relationship,
          referenceDepth: referenceDepth + 1,
          onClose: () => setLoadedReference(undefined),
        })
      ) : loadedReference ? (
        <Dialog
          open
          fullWidth
          maxWidth="md"
          onClose={() => setLoadedReference(undefined)}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography
              component="span"
              sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', fontWeight: 700 }}
            >
              {loadedReference.schema.label}
            </Typography>
            <Tooltip title="Close reference">
              <IconButton
                aria-label="Close reference"
                onClick={() => setLoadedReference(undefined)}
              >
                <ShellIcon name="close" />
              </IconButton>
            </Tooltip>
          </DialogTitle>
          <DialogContent>
            <AxisSchemaRecordDetail
              falseLabel={falseLabel}
              record={loadedReference.record}
              referenceDepth={referenceDepth + 1}
              referenceResolver={referenceResolver}
              schema={loadedReference.schema}
              title={`${loadedReference.relationship.label}: ${loadedReference.displayValue}`}
              trueLabel={trueLabel}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </AxisMetadataPanel>
  );
}
