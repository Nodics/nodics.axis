/** Managed login transport presentation only; no live authentication or automatic retry. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { EmployeeLoginFormRenderer } from '../../../../../src/cms/renderers/components/authentication/EmployeeLoginFormRenderer';
import type { CmsComponentContract } from '../../../../../src/cms/cmsContract';

const component: CmsComponentContract = {
  code: 'login-form',
  typeCode: 'employee-login',
  renderer: 'axis.component.employee-login-form',
  rendererContractVersion: 1,
  rendererChannels: ['web'],
  rendererDeprecated: false,
  slot: 'login',
  index: 0,
  properties: {
    usernameLabel: 'Employee login',
    usernamePlaceholder: 'Login',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Password',
    submitLabel: 'Sign in',
  },
  components: [],
};

it.each([
  'Failed to fetch',
  'NetworkError when attempting to fetch resource.',
  'Load failed',
  'Network request failed',
])(
  'maps %s through the shared classifier and keeps managed inputs until explicit retry',
  async (authenticationError) => {
    const onEmployeeLogin = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <EmployeeLoginFormRenderer component={component} actions={{ onEmployeeLogin }} />,
    );
    const login = screen.getByLabelText('Employee login');
    const password = screen.getByLabelText('Password');
    await user.type(login, 'operator');
    await user.type(password, 'test-input');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onEmployeeLogin).toHaveBeenCalledTimes(1);
    view.rerender(
      <EmployeeLoginFormRenderer
        component={component}
        actions={{ onEmployeeLogin, authenticationError }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sign-in is temporarily unavailable.',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent(authenticationError);
    expect(login).toHaveValue('operator');
    expect(password).toHaveValue('test-input');
    expect(onEmployeeLogin).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onEmployeeLogin).toHaveBeenCalledTimes(2);
    expect(onEmployeeLogin).toHaveBeenLastCalledWith('operator', 'test-input');
  },
);

it('does not reclassify safe authentication denial as an outage or send a request', () => {
  const onEmployeeLogin = vi.fn();
  render(
    <EmployeeLoginFormRenderer
      component={component}
      actions={{ onEmployeeLogin, authenticationError: 'Sign-in was not accepted.' }}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Sign-in was not accepted.');
  expect(screen.getByRole('alert')).not.toHaveTextContent('temporarily unavailable');
  expect(onEmployeeLogin).not.toHaveBeenCalled();
});
