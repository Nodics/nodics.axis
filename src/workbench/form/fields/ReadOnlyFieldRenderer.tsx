import { TextField } from '@mui/material';

import type { WorkbenchFieldProps } from '../WorkbenchFieldProps';

export function ReadOnlyFieldRenderer({ field, value }: WorkbenchFieldProps) {
  const displayValue = value ?? field.fixedValue ?? '';
  return (
    <TextField
      disabled
      fullWidth
      helperText={field.description}
      label={field.label}
      value={
        typeof displayValue === 'string' ||
        typeof displayValue === 'number' ||
        typeof displayValue === 'boolean'
          ? String(displayValue)
          : ''
      }
    />
  );
}
