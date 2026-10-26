/** Lock presentation retains Profile authority and never retries an unlock automatically. */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { EmployeeLockFormRenderer } from '../../../../../src/cms/renderers/components/authentication/EmployeeLockFormRenderer';
import type { CmsComponentContract } from '../../../../../src/cms/cmsContract';

const component: CmsComponentContract = {
  code: 'lock-form',
  typeCode: 'employee-lock',
  renderer: 'axis.component.employee-lock-form',
  rendererContractVersion: 1,
  rendererChannels: ['web'],
  rendererDeprecated: false,
  slot: 'lock',
  index: 0,
  components: [],
  properties: {
    title: 'Unlock',
    employeeLabel: 'Employee',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Password',
    submitLabel: 'Unlock',
    signOutLabel: 'Sign out',
  },
};

it('shows progress, rejects duplicate submits, and retains explicit retry after failure', async () => {
  const onEmployeeUnlock = vi.fn();
  const user = userEvent.setup();
  const view = render(
    <EmployeeLockFormRenderer component={component} actions={{ onEmployeeUnlock }} />,
  );
  await user.type(screen.getByLabelText('Password'), 'fixture-password');
  view.rerender(
    <EmployeeLockFormRenderer
      component={component}
      actions={{ onEmployeeUnlock, employeeUnlockPending: true }}
    />,
  );
  const button = screen.getByRole('button', { name: 'Unlock' });
  const form = button.closest('form')!;
  expect(button).toBeDisabled();
  expect(form).toHaveAttribute('aria-busy', 'true');
  expect(button.querySelector('.MuiCircularProgress-root')).not.toBeNull();
  fireEvent.click(button);
  fireEvent.submit(form);
  await user.type(screen.getByLabelText('Password'), '{Enter}');
  expect(onEmployeeUnlock).not.toHaveBeenCalled();
  view.rerender(
    <EmployeeLockFormRenderer
      component={component}
      actions={{ onEmployeeUnlock, authenticationError: 'Unlock denied' }}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Unlock denied');
  expect(form).toHaveAttribute('aria-busy', 'false');
  expect(onEmployeeUnlock).not.toHaveBeenCalled();
  await user.click(button);
  expect(onEmployeeUnlock).toHaveBeenCalledExactlyOnceWith('fixture-password');
});
