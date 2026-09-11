import { Box, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useState } from 'react';

import { ShellIcon } from '../../../app/shell/ShellIcon';
import type { WorkbenchFieldProps } from '../WorkbenchFieldProps';

/** Preserves structured values; localized fields use individual language inputs. */
export function StructuredFieldRenderer({
  field,
  value,
  error,
  onChange,
  onValidityChange,
}: WorkbenchFieldProps) {
  const [language, setLanguage] = useState('');
  const [text, setText] = useState(() =>
    value === undefined ? '' : JSON.stringify(value, null, 2),
  );
  const [invalid, setInvalid] = useState(false);
  if (field.component === 'localizedText') {
    const values =
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    return (
      <Stack spacing={1}>
        <Typography variant="subtitle2">
          {field.label}
          {field.required ? ' *' : ''}
        </Typography>
        {Object.entries(values).map(([locale, text]) => (
          <TextField
            key={locale}
            fullWidth
            label={`${field.label} (${locale})`}
            value={typeof text === 'string' ? text : JSON.stringify(text ?? '')}
            onChange={(event) => onChange({ ...values, [locale]: event.target.value })}
          />
        ))}
        <Stack direction="row" spacing={1}>
          <TextField
            label="Language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            error={Boolean(error)}
            helperText={error ?? field.description}
          />
          <Tooltip title="Add language">
            <span>
              <IconButton
                aria-label="Add language"
                disabled={
                  !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(language) ||
                  Object.hasOwn(values, language)
                }
                onClick={() => {
                  onChange({ ...values, [language]: '' });
                  setLanguage('');
                }}
              >
                <ShellIcon name="add" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
    );
  }
  return (
    <Box>
      <TextField
        fullWidth
        multiline
        minRows={3}
        maxRows={12}
        label={field.label}
        value={text}
        required={field.required}
        error={invalid || Boolean(error)}
        helperText={
          invalid ? 'Enter a valid structured value.' : (error ?? field.description)
        }
        slotProps={{
          htmlInput: { 'data-invalid-structured-value': invalid ? 'true' : undefined },
        }}
        onChange={(event) => {
          setText(event.target.value);
          if (!event.target.value.trim()) {
            setInvalid(false);
            onValidityChange?.(true);
            onChange(undefined);
            return;
          }
          try {
            const parsed: unknown = JSON.parse(event.target.value);
            if (
              typeof parsed !== 'object' ||
              parsed === null ||
              (field.type === 'array' ? !Array.isArray(parsed) : Array.isArray(parsed))
            )
              throw new Error();
            setInvalid(false);
            onValidityChange?.(true);
            onChange(parsed);
          } catch {
            setInvalid(true);
            onValidityChange?.(false);
          }
        }}
      />
    </Box>
  );
}
