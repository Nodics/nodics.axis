import { Alert, Button, CircularProgress, Stack } from '@mui/material';
import type { FormEvent } from 'react';
import { getSignInErrorMessage } from '../../../../app/recoveryState';

import { stringProperty } from '../../shared/rendererProperties';
import type { CmsComponentRendererProps } from '../../shared/rendererTypes';
import { AuthenticationField } from './AuthenticationField';

export function EmployeeLoginFormRenderer({
  component,
  actions,
}: CmsComponentRendererProps) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (actions?.employeeLoginPending) return;
    const values = new FormData(event.currentTarget);
    const loginId = values.get('loginId');
    const password = values.get('password');
    actions?.onEmployeeLogin?.(
      typeof loginId === 'string' ? loginId : '',
      typeof password === 'string' ? password : '',
    );
  };
  return (
    <Stack
      aria-busy={actions?.employeeLoginPending === true}
      component="form"
      onSubmit={submit}
      spacing={2}
    >
      {actions?.authenticationError ? (
        <Alert severity="error">
          {getSignInErrorMessage(actions.authenticationError)}
        </Alert>
      ) : null}
      <AuthenticationField
        autoComplete="username"
        id="axis-employee-login-id"
        label={stringProperty(component, 'usernameLabel')}
        name="loginId"
        placeholder={stringProperty(component, 'usernamePlaceholder')}
      />
      <AuthenticationField
        autoComplete="current-password"
        id="axis-employee-login-password"
        label={stringProperty(component, 'passwordLabel')}
        name="password"
        placeholder={stringProperty(component, 'passwordPlaceholder')}
        type="password"
      />
      <Button
        disabled={!actions?.onEmployeeLogin || actions.employeeLoginPending}
        size="large"
        startIcon={
          actions?.employeeLoginPending ? (
            <CircularProgress aria-hidden="true" color="inherit" size={18} />
          ) : undefined
        }
        type="submit"
        variant="contained"
      >
        {stringProperty(component, 'submitLabel')}
      </Button>
    </Stack>
  );
}
