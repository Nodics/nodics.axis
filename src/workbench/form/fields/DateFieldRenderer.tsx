import { TextField } from '@mui/material';

import type { WorkbenchFieldProps } from '../WorkbenchFieldProps';

function dateInputValue(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString().slice(0, 10)
    : '';
}

export function DateFieldRenderer({
  error,
  field,
  onChange,
  value,
}: WorkbenchFieldProps) {
  return (
    <TextField
      error={Boolean(error)}
      fullWidth
      helperText={error ?? field.description}
      label={field.label}
      required={field.required}
      slotProps={{ inputLabel: { shrink: true } }}
      type="date"
      value={dateInputValue(value)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
