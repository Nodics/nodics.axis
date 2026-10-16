/** Managed login transport presentation only; no live authentication or automatic retry. */
import { fireEvent, render, screen } from '@testing-library/react';
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

it('shows pending state and refuses click, Enter and direct submit until explicit retry', async () => {
  const onEmployeeLogin = vi.fn();
  const user = userEvent.setup();
  const view = render(
    <EmployeeLoginFormRenderer component={component} actions={{ onEmployeeLogin }} />,
  );
  await user.type(screen.getByLabelText('Employee login'), 'operator');
  await user.type(screen.getByLabelText('Password'), 'test-input');
  view.rerender(
    <EmployeeLoginFormRenderer
      component={component}
      actions={{ onEmployeeLogin, employeeLoginPending: true }}
    />,
  );
  const button = screen.getByRole('button', { name: 'Sign in' });
  const form = button.closest('form');
  expect(button).toBeDisabled();
  expect(form).toHaveAttribute('aria-busy', 'true');
  expect(button.querySelector('.MuiCircularProgress-root')).not.toBeNull();
  fireEvent.click(button);
  await user.type(screen.getByLabelText('Password'), '{Enter}');
  fireEvent.submit(form!);
  expect(onEmployeeLogin).not.toHaveBeenCalled();
  view.rerender(
    <EmployeeLoginFormRenderer component={component} actions={{ onEmployeeLogin }} />,
  );
  expect(form).toHaveAttribute('aria-busy', 'false');
  expect(onEmployeeLogin).not.toHaveBeenCalled();
  await user.click(button);
  expect(onEmployeeLogin).toHaveBeenCalledExactlyOnceWith('operator', 'test-input');
});
