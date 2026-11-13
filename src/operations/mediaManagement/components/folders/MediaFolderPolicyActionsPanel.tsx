import {
  Alert,
  Button,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router';

import { selectModuleConnection } from '../../../../bootstrap/publicBootstrap';
import {
  createWorkbenchRecord,
  deleteWorkbenchRecord,
  updateWorkbenchRecord,
  type WorkbenchClientConfiguration,
} from '../../../../workbench/api/workbenchClient';
import type {
  WorkbenchRecord,
  WorkbenchSchema,
} from '../../../../workbench/api/workbenchContracts';
import { WorkbenchRecordForm } from '../../../../workbench/form/WorkbenchRecordForm';
import {
  updateMediaFolderPolicy,
  type MediaSourceContextFolderPolicy,
} from '../../api/mediaStoragePolicyClient';
import { humanize, numberValue, textValue } from '../../mediaRecordValues';

type ModuleConnection = ReturnType<typeof selectModuleConnection>;

export interface MediaFolderPolicyActionsPanelProps {
  readonly configuration: WorkbenchClientConfiguration;
  readonly connection: ModuleConnection;
  readonly folderSchema: WorkbenchSchema;
  readonly mode: 'create' | 'delete' | 'edit' | 'none';
  readonly onChanged: (record?: WorkbenchRecord) => void;
  readonly onModeChange: (mode: 'create' | 'delete' | 'edit' | 'none') => void;
  readonly record?: WorkbenchRecord | undefined;
  readonly policyStatus: 'loading' | 'unavailable' | 'not-configured' | 'available';
  readonly effectivePolicy?: MediaSourceContextFolderPolicy | undefined;
}

function numericInputValue(record: WorkbenchRecord | undefined, key: string): string {
  const value = numberValue(record, key);
  return value === undefined ? '' : String(value);
}

function parseOptionalNonNegativeInteger(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 && String(parsed) === trimmed
    ? parsed
    : undefined;
}

export function MediaFolderPolicyActionsPanel(
  props: MediaFolderPolicyActionsPanelProps,
) {
  return (
    <MediaFolderPolicyActionsPanelBody
      key={JSON.stringify([textValue(props.record, 'code'), props.effectivePolicy])}
      {...props}
    />
  );
}

function MediaFolderPolicyActionsPanelBody(props: MediaFolderPolicyActionsPanelProps) {
  const policyRecord = props.effectivePolicy
    ? {
        access: props.effectivePolicy.access,
        maximumFileSizeBytes: props.effectivePolicy.maxFileSizeBytes,
        retentionDays: props.effectivePolicy.retentionDays,
      }
    : props.record;
  const [access, setAccess] = useState(textValue(policyRecord, 'access'));
  const [maximumFileSizeBytes, setMaximumFileSizeBytes] = useState(
    numericInputValue(policyRecord, 'maximumFileSizeBytes'),
  );
  const [retentionDays, setRetentionDays] = useState(
    numericInputValue(policyRecord, 'retentionDays'),
  );

  const mutation = useMutation({
    mutationFn: (model: {
      readonly access: string;
      readonly maximumFileSizeBytes?: number | undefined;
      readonly retentionDays?: number | undefined;
    }) =>
      updateMediaFolderPolicy(props.connection!, props.configuration, {
        folderCode: textValue(props.record, 'code'),
        ...model,
      }),
    onSuccess: () => props.onChanged(props.record),
  });
  const createMutation = useMutation({
    mutationFn: (model: Readonly<Record<string, unknown>>) =>
      createWorkbenchRecord(
        props.connection!,
        props.folderSchema,
        model,
        props.configuration,
      ),
    onSuccess: (created) => {
      props.onModeChange('none');
      props.onChanged(created);
    },
  });
  const updateMutation = useMutation({
    mutationFn: (model: Readonly<Record<string, unknown>>) =>
      updateWorkbenchRecord(
        props.connection!,
        props.folderSchema,
        props.record!,
        model,
        props.configuration,
      ),
    onSuccess: (updated) => {
      props.onModeChange('none');
      props.onChanged(updated);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteWorkbenchRecord(
        props.connection!,
        props.folderSchema,
        props.record!,
        props.configuration,
        `axis-${crypto.randomUUID()}`,
      ),
    onSuccess: () => {
      props.onModeChange('none');
      props.onChanged(undefined);
    },
  });
  const canCrud =
    Boolean(props.connection) && props.folderSchema.mutationMode === 'GENERATED_CRUD';
  const canUpdate =
    canCrud &&
    Boolean(props.record) &&
    props.folderSchema.operations.includes('update');
  const canCreate = canCrud && props.folderSchema.operations.includes('create');
  const canDelete =
    canCrud &&
    Boolean(props.record) &&
    props.folderSchema.operations.includes('delete');
  const parsedMaximumFileSizeBytes =
    parseOptionalNonNegativeInteger(maximumFileSizeBytes);
  const parsedRetentionDays = parseOptionalNonNegativeInteger(retentionDays);
  const maximumFileSizeInvalid =
    maximumFileSizeBytes.trim().length > 0 && parsedMaximumFileSizeBytes === undefined;
  const retentionInvalid =
    retentionDays.trim().length > 0 && parsedRetentionDays === undefined;
  const model: {
    readonly access: string;
    readonly maximumFileSizeBytes?: number | undefined;
    readonly retentionDays?: number | undefined;
  } = {
    access,
    maximumFileSizeBytes: parsedMaximumFileSizeBytes,
    retentionDays: parsedRetentionDays,
  };
  const unchanged =
    access === textValue(policyRecord, 'access') &&
    maximumFileSizeBytes === numericInputValue(policyRecord, 'maximumFileSizeBytes') &&
    retentionDays === numericInputValue(policyRecord, 'retentionDays');
  const canEditPolicy = canUpdate && props.policyStatus === 'available';
  const saveDisabled =
    !canEditPolicy ||
    unchanged ||
    mutation.isPending ||
    maximumFileSizeInvalid ||
    retentionInvalid;

  return (
    <Stack spacing={1.5}>
      <Divider />
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { xs: 'stretch', md: 'center' } }}
      >
        <Typography component="h4" sx={{ flex: 1, fontWeight: 700 }} variant="h6">
          Folder management
        </Typography>
        {canCreate ? (
          <Button
            variant={props.mode === 'create' ? 'contained' : 'outlined'}
            onClick={() =>
              props.onModeChange(props.mode === 'create' ? 'none' : 'create')
            }
          >
            Create folder
          </Button>
        ) : null}
        {canUpdate ? (
          <Button
            variant={props.mode === 'edit' ? 'contained' : 'outlined'}
            onClick={() => props.onModeChange(props.mode === 'edit' ? 'none' : 'edit')}
          >
            Edit folder
          </Button>
        ) : null}
        {canDelete ? (
          <Button
            color="error"
            variant={props.mode === 'delete' ? 'contained' : 'outlined'}
            onClick={() =>
              props.onModeChange(props.mode === 'delete' ? 'none' : 'delete')
            }
          >
            Delete folder
          </Button>
        ) : null}
        <Button
          component={RouterLink}
          to="/schema-workbench?module=media&schema=mediaFolder"
          variant="text"
        >
          Open in Schema Workbench
        </Button>
      </Stack>
      {props.mode === 'create' && canCreate ? (
        <WorkbenchRecordForm
          embedded
          cancelLabel="Cancel"
          error={createMutation.error?.message}
          saving={createMutation.isPending}
          savingLabel="Creating folder…"
          schema={props.folderSchema}
          submitLabel="Create folder"
          title="Create media folder"
          onCancel={() => props.onModeChange('none')}
          onSubmit={(model) => createMutation.mutate(model)}
        />
      ) : null}
      {props.mode === 'edit' && props.record && canUpdate ? (
        <WorkbenchRecordForm
          embedded
          cancelLabel="Cancel"
          error={updateMutation.error?.message}
          initialModel={props.record}
          saving={updateMutation.isPending}
          savingLabel="Saving folder…"
          schema={props.folderSchema}
          submitLabel="Save folder"
          title={`Edit ${textValue(props.record, 'code')}`}
          onCancel={() => props.onModeChange('none')}
          onSubmit={(model) => updateMutation.mutate(model)}
        />
      ) : null}
      {props.mode === 'delete' && props.record && canDelete ? (
        <Alert
          action={
            <Stack direction="row" spacing={1}>
              <Button
                color="inherit"
                disabled={deleteMutation.isPending}
                onClick={() => props.onModeChange('none')}
              >
                Cancel
              </Button>
              <Button
                color="error"
                disabled={deleteMutation.isPending}
                variant="contained"
                onClick={() => deleteMutation.mutate()}
              >
                Delete
              </Button>
            </Stack>
          }
          severity="warning"
        >
          Delete media folder {textValue(props.record, 'code')}? nMedia will remain
          responsible for rejecting deletion if active media or policy dependencies make
          it unsafe.
        </Alert>
      ) : null}
      {deleteMutation.error ? (
        <Alert severity="error">
          {deleteMutation.error instanceof Error
            ? deleteMutation.error.message
            : 'Folder deletion failed.'}
        </Alert>
      ) : null}
      {!props.record ? (
        <Alert severity="info">
          Select an existing folder to edit policy details, or create a new folder when
          the backend grants create permission.
        </Alert>
      ) : null}
      {props.record ? (
        <>
          <Divider />
          <Typography component="h4" sx={{ fontWeight: 700 }} variant="h6">
            Intake policy
          </Typography>
          {props.policyStatus !== 'available' ? (
            <Alert severity={props.policyStatus === 'loading' ? 'info' : 'warning'}>
              {props.policyStatus === 'loading'
                ? 'Checking the configured intake policy…'
                : props.policyStatus === 'not-configured'
                  ? 'This folder record has no configured intake policy. A storage administrator must configure its source context before it can be used for uploads. Review Storage & Delivery for the current runtime policies.'
                  : 'The configured intake policy could not be verified. Refresh this workspace before changing upload limits.'}
            </Alert>
          ) : null}
          {!canUpdate ? (
            <Alert severity="info">
              Editing is unavailable until nMedia exposes mediaFolder update permission
              for this employee session. Use backend configuration approved for this
              deployment.
            </Alert>
          ) : (
            <Alert severity="info">
              Review visibility, upload size and retention before saving this runtime’s
              intake policy.
            </Alert>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              fullWidth
              disabled={!canEditPolicy || mutation.isPending}
              label="Visibility"
              select
              size="small"
              value={access === '—' ? 'PRIVATE' : access}
              onChange={(event) => setAccess(event.target.value)}
            >
              {['PRIVATE', 'PUBLIC', 'SIGNED'].map((option) => (
                <MenuItem key={option} value={option}>
                  {humanize(option)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              disabled={!canEditPolicy || mutation.isPending}
              error={maximumFileSizeInvalid}
              helperText={
                maximumFileSizeInvalid
                  ? 'Enter a whole number of bytes or leave blank.'
                  : 'Maximum upload size in bytes.'
              }
              label="Maximum file size"
              size="small"
              slotProps={{ htmlInput: { min: 0 } }}
              type="number"
              value={maximumFileSizeBytes}
              onChange={(event) => setMaximumFileSizeBytes(event.target.value)}
            />
            <TextField
              fullWidth
              disabled={!canEditPolicy || mutation.isPending}
              error={retentionInvalid}
              helperText={
                retentionInvalid
                  ? 'Enter whole retention days or leave blank.'
                  : 'Use 0 for no automatic retention expiry.'
              }
              label="Retention days"
              size="small"
              slotProps={{ htmlInput: { min: 0 } }}
              type="number"
              value={retentionDays}
              onChange={(event) => setRetentionDays(event.target.value)}
            />
          </Stack>
          <Button
            disabled={saveDisabled}
            onClick={() => mutation.mutate(model)}
            variant="outlined"
          >
            Save folder policy
          </Button>
          {mutation.error ? (
            <Alert severity="error">
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'Folder policy update failed.'}
            </Alert>
          ) : null}
          {mutation.data ? (
            <Alert severity="success">
              Folder policy was submitted to nMedia and will affect future upload
              policy.
            </Alert>
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
