import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material';
import type { FormEvent } from 'react';

import { stringProperty } from '../../shared/rendererProperties';
import type { CmsComponentRendererProps } from '../../shared/rendererTypes';
import { AuthenticationField } from './AuthenticationField';

export function EmployeeLockFormRenderer({
  component,
  actions,
}: CmsComponentRendererProps) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (actions?.employeeUnlockPending) return;
    const values = new FormData(event.currentTarget);
    const password = values.get('password');
    actions?.onEmployeeUnlock?.(typeof password === 'string' ? password : '');
  };
  return (
    <Stack
      aria-busy={actions?.employeeUnlockPending === true}
      component="form"
      onSubmit={submit}
      spacing={2}
    >
      <Typography component="h2" sx={{ fontWeight: 700 }} variant="h6">
        {stringProperty(component, 'title')}
      </Typography>
      {actions?.authenticationError ? (
        <Alert severity="error">{actions.authenticationError}</Alert>
      ) : null}
      <Stack spacing={0.5}>
        <Typography color="text.secondary" sx={{ fontSize: 12 }}>
          {stringProperty(component, 'employeeLabel')}
        </Typography>
        <Typography sx={{ fontWeight: 700 }}>
          {actions?.currentEmployeeId ?? 'Authenticated employee'}
        </Typography>
      </Stack>
      <AuthenticationField
        autoComplete="current-password"
        id="axis-employee-unlock-password"
        label={stringProperty(component, 'passwordLabel')}
        name="password"
        placeholder={stringProperty(component, 'passwordPlaceholder')}
        type="password"
      />
      <Button
        disabled={!actions?.onEmployeeUnlock || actions.employeeUnlockPending}
        size="large"
        startIcon={
          actions?.employeeUnlockPending ? (
            <CircularProgress aria-hidden="true" color="inherit" size={18} />
          ) : undefined
        }
        type="submit"
        variant="contained"
      >
        {stringProperty(component, 'submitLabel')}
      </Button>
      <Button
        color="inherit"
        disabled={!actions?.onEmployeeSignOut}
        onClick={actions?.onEmployeeSignOut}
        type="button"
      >
        {stringProperty(component, 'signOutLabel')}
      </Button>
    </Stack>
  );
}
