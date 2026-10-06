/** @file Guided owner metadata inspection; all execution and authorization stay with the framework owners. */
import { useId, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import type { CopilotInspection } from './api/copilotInspectionContract';

interface Props {
  readonly contract: CopilotInspection;
  readonly intent:
    | 'copilot.rules.inspect'
    | 'copilot.process.inspect'
    | 'copilot.import.inspect';
  readonly disabled: boolean;
  readonly onSubmit: (message: string) => Promise<void>;
}

/** Opens an explicit form without issuing any native reads on mount or choice changes. */
export function CopilotInspectionComposer(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        startIcon={<ShellIcon name="search" />}
        disabled={props.disabled || !props.contract.operations.length}
        onClick={() => setOpen(true)}
        sx={{ mx: { xs: 2, md: 3 }, mb: 1 }}
      >
        {props.contract.presentation.title}
      </Button>
      {open ? (
        <InspectionDialog
          key={JSON.stringify([props.intent, props.contract])}
          {...props}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/** Drops drafts on close or scope remount and allows one explicit submission without an offline queue. */
function InspectionDialog({
  contract,
  intent,
  disabled,
  onSubmit,
  onClose,
}: Props & { readonly onClose: () => void }) {
  const [operationCode, setOperationCode] = useState<string>();
  const titleId = useId();
  const [code, setCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const submitted = useRef(false);
  const copy = contract.presentation;
  const operation =
    contract.operations.find((item) => item.code === operationCode) ?? null;
  const valid =
    operation &&
    (!operation.requiresCode || (code !== null && operation.codes.includes(code)));
  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose} aria-labelledby={titleId}>
      <DialogTitle id={titleId}>{copy.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Autocomplete<CopilotInspection['operations'][number]>
            options={contract.operations}
            value={operation}
            disabled={disabled}
            getOptionLabel={(item) => item.label}
            isOptionEqualToValue={(a, b) => a.code === b.code}
            onChange={(_, value) => {
              setOperationCode(value?.code);
              setCode(null);
              setFailed(false);
            }}
            renderInput={(params) => <TextField {...params} label={copy.operation} />}
          />
          {operation?.requiresCode !== false ? (
            <Autocomplete
              options={operation?.codes ?? []}
              value={code}
              disabled={disabled || !operation}
              onChange={(_, value) => {
                setCode(value);
                setFailed(false);
              }}
              renderInput={(params) => <TextField {...params} label={copy.code} />}
            />
          ) : null}
          {failed ? <Alert severity="warning">{copy.failure}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{copy.cancel}</Button>
        <Button
          variant="contained"
          startIcon={<ShellIcon name="search" />}
          disabled={disabled || !valid}
          onClick={() => {
            if (disabled || !valid || submitted.current) return;
            if (!navigator.onLine) {
              setFailed(true);
              return;
            }
            submitted.current = true;
            onClose();
            // The conversation controller owns transport failures and uncertain turn delivery.
            void onSubmit(
              JSON.stringify({
                intent,
                operation: operation.code,
                ...(operation.requiresCode ? { code } : {}),
              }),
            );
          }}
        >
          {copy.submit}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
