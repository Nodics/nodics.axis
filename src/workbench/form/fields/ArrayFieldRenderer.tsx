import { Autocomplete, TextField } from '@mui/material';

import type { WorkbenchFieldProps } from '../WorkbenchFieldProps';

export function ArrayFieldRenderer({
  error,
  field,
  onChange,
  value,
}: WorkbenchFieldProps) {
  return (
    <Autocomplete
      multiple
      freeSolo
      autoSelect
      options={[] as string[]}
      value={Array.isArray(value) ? value.map(String) : []}
      onChange={(_event, values) => onChange(values)}
      renderInput={(params) => (
        <TextField
          {...params}
          error={Boolean(error)}
          fullWidth
          helperText={error ?? field.description}
          label={field.label}
          required={field.required && (!Array.isArray(value) || value.length === 0)}
        />
      )}
    />
  );
}
