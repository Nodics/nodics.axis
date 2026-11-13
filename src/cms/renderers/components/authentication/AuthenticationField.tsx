import { useState } from 'react';
import { useAxisLocalization } from '../../../../localization/AxisLocalizationContext';

import {
  Box,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { ShellIcon } from '../../../../app/shell/ShellIcon';

interface AuthenticationFieldProps {
  readonly autoComplete: string;
  readonly id: string;
  readonly label: string;
  readonly name: string;
  readonly placeholder: string;
  readonly type?: 'password' | 'text';
}

export function AuthenticationField({
  autoComplete,
  id,
  label,
  name,
  placeholder,
  type = 'text',
}: AuthenticationFieldProps) {
  const { format } = useAxisLocalization();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword && passwordVisible ? 'text' : type;
  const passwordToggleLabel = passwordVisible
    ? format('common.authentication.hide-field', 'Hide {label}', {
        label: label.toLowerCase(),
      })
    : format('common.authentication.show-field', 'Show {label}', {
        label: label.toLowerCase(),
      });
  const slotProps = {
    htmlInput: {
      'aria-label': label,
    },
    ...(isPassword
      ? {
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={passwordToggleLabel}
                  edge="end"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  onMouseDown={(event) => event.preventDefault()}
                  size="small"
                  sx={{
                    color: 'text.secondary',
                    '&:hover': {
                      color: 'text.primary',
                    },
                  }}
                  type="button"
                >
                  <ShellIcon
                    aria-hidden="true"
                    fontSize="small"
                    name={passwordVisible ? 'hidden' : 'visible'}
                  />
                </IconButton>
              </InputAdornment>
            ),
          },
        }
      : {}),
  };

  return (
    <Stack spacing={0.75}>
      <Typography
        component="label"
        htmlFor={id}
        sx={{ alignItems: 'center', display: 'flex', gap: 0.5 }}
        variant="subtitle2"
      >
        {label}
        <Box component="span" sx={{ color: 'error.main' }}>
          *
        </Box>
      </Typography>
      <TextField
        autoComplete={autoComplete}
        fullWidth
        id={id}
        name={name}
        placeholder={placeholder}
        required
        slotProps={slotProps}
        type={effectiveType}
        sx={{
          '& .MuiInputBase-root': {
            minHeight: 48,
          },
          '& .MuiInputBase-input': {
            py: 1.375,
          },
        }}
      />
    </Stack>
  );
}
