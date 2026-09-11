import { Autocomplete, MenuItem, TextField } from '@mui/material';

import type { WorkbenchFieldProps } from '../WorkbenchFieldProps';

export function EnumFieldRenderer({
  error,
  field,
  onChange,
  value,
}: WorkbenchFieldProps) {
  const options =
    field.enumOptions ??
    field.enum?.map((option) => ({
      value: option,
      label: option,
      description: '',
      disabled: false,
    })) ??
    [];
  if (field.type === 'array' || field.component === 'multiselect') {
    const values = Array.isArray(value) ? value : [];
    const available = [
      ...options,
      ...values
        .filter((value) => !options.some((option) => option.value === value))
        .map((value) => ({
          value: value as string,
          label: String(value),
          description: '',
          disabled: true,
        })),
    ];
    return (
      <Autocomplete
        multiple
        options={available}
        value={available.filter((option) => values.includes(option.value))}
        getOptionLabel={(option) => option.label}
        getOptionDisabled={(option) => option.disabled}
        isOptionEqualToValue={(left, right) => left.value === right.value}
        onChange={(_event, selected) =>
          onChange(selected.map((option) => option.value))
        }
        renderInput={(params) => (
          <TextField
            {...params}
            error={Boolean(error)}
            helperText={error ?? field.description}
            label={field.label}
            required={field.required && values.length === 0}
          />
        )}
      />
    );
  }
  const selectedIndex = options.findIndex((option) => option.value === value);
  return (
    <TextField
      error={Boolean(error)}
      fullWidth
      helperText={error ?? field.description}
      label={field.label}
      required={field.required}
      select
      value={selectedIndex >= 0 ? String(selectedIndex) : ''}
      onChange={(event) =>
        onChange(
          event.target.value === ''
            ? undefined
            : options[Number(event.target.value)]?.value,
        )
      }
    >
      <MenuItem value="">Select {field.label}</MenuItem>
      {options.map((option, index) => (
        <MenuItem
          key={String(option.value)}
          disabled={option.disabled}
          value={String(index)}
        >
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
