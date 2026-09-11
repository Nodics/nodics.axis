import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useState } from 'react';

import { WorkbenchModelDialog } from '../detail/WorkbenchModelDialog';
import type {
  WorkbenchRecord,
  WorkbenchRelationship,
  WorkbenchSchema,
} from '../api/workbenchContracts';
import type {
  WorkbenchRelationshipCopy,
  WorkbenchRelationshipRuntime,
} from './WorkbenchRelationshipRuntime';

interface RelationshipReferenceChipsProps {
  readonly copy: WorkbenchRelationshipCopy;
  readonly disabled: boolean;
  readonly draftReferences: readonly string[];
  readonly relationship: WorkbenchRelationship;
  readonly runtime: WorkbenchRelationshipRuntime;
  readonly targetSchema: WorkbenchSchema;
  readonly onRemove: (reference: string) => void;
}

interface LoadedReference {
  readonly record: WorkbenchRecord;
  readonly reference: string;
  readonly schema: WorkbenchSchema;
}

export function RelationshipReferenceChips(props: RelationshipReferenceChipsProps) {
  const [loadingReference, setLoadingReference] = useState<string>();
  const [loadedReference, setLoadedReference] = useState<LoadedReference>();
  const [referenceError, setReferenceError] = useState<string>();
  const canOpenReference = Boolean(props.runtime.resolveRecord);

  const openReference = (reference: string) => {
    if (!props.runtime.resolveRecord) return;
    setLoadedReference(undefined);
    setReferenceError(undefined);
    setLoadingReference(reference);
    void props.runtime
      .resolveRecord(props.relationship, reference, props.targetSchema)
      .then((result) => {
        if (!result) {
          setReferenceError('Referenced record was not found or is not authorized.');
          return;
        }
        setLoadedReference({
          record: result.record,
          reference,
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
      .finally(() => setLoadingReference(undefined));
  };

  if (props.draftReferences.length === 0) return null;

  return (
    <Stack spacing={1}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={0.75}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Typography color="text.secondary" sx={{ fontWeight: 700 }} variant="body2">
          {props.copy.selectedReferencesLabel}
        </Typography>
        <Typography color="text.secondary" variant="caption">
          {props.draftReferences.length} selected
        </Typography>
      </Stack>
      <Stack spacing={0.75}>
        {props.draftReferences.map((reference) => (
          <Box
            key={reference}
            sx={{
              alignItems: 'center',
              border: 1,
              borderColor: 'divider',
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
              disabled={!canOpenReference}
              size="small"
              sx={{ justifyContent: 'flex-start', minWidth: 0, textAlign: 'left' }}
              variant={canOpenReference ? 'outlined' : 'text'}
              onClick={canOpenReference ? () => openReference(reference) : undefined}
            >
              <Typography component="span" noWrap variant="body2">
                {reference}
              </Typography>
            </Button>
            {props.disabled || !props.relationship.actions.includes('UNLINK') ? null : (
              <Button
                aria-label={`${props.copy.removeReferenceLabel} ${reference}`}
                color="error"
                size="small"
                onClick={() => props.onRemove(reference)}
              >
                {props.copy.removeReferenceLabel}
              </Button>
            )}
          </Box>
        ))}
      </Stack>
      {loadingReference ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={18} />
          <Typography color="text.secondary" variant="body2">
            Loading {loadingReference}
          </Typography>
        </Stack>
      ) : null}
      {referenceError ? <Alert severity="warning">{referenceError}</Alert> : null}
      {loadedReference ? (
        <WorkbenchModelDialog
          copy={props.copy}
          runtime={props.runtime}
          editable={
            !props.disabled && props.relationship.actions.includes('EDIT_RELATED')
          }
          onClose={() => setLoadedReference(undefined)}
          record={loadedReference.record}
          schema={loadedReference.schema}
        />
      ) : null}
    </Stack>
  );
}
