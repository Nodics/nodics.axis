import { Box, Stack, Switch, Typography } from '@mui/material';
import { useId } from 'react';

import type { WorkbenchFieldProps } from '../WorkbenchFieldProps';

export function BooleanFieldRenderer({
  error,
  field,
  onChange,
  value,
}: WorkbenchFieldProps) {
  const id = useId();
  return (
    <Box>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          border: 1,
          borderColor: error ? 'error.main' : 'divider',
          borderRadius: 1,
          justifyContent: 'space-between',
          minHeight: 56,
          px: 1.75,
        }}
      >
        <Typography component="label" htmlFor={id}>
          {field.label}
          {field.required ? ' *' : ''}
        </Typography>
        <Switch
          checked={value === true}
          id={id}
          onChange={(_, checked) => onChange(checked)}
        />
      </Stack>
      <Typography
        color={error ? 'error.main' : 'text.secondary'}
        sx={{ mx: 1.75, mt: 0.4, minHeight: '1.25em' }}
        variant="caption"
      >
        {error ?? field.description}
      </Typography>
    </Box>
  );
}
