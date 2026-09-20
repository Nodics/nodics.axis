import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

import { BundledLoginPage } from '../../src/initialization/BundledLoginPage';

it('provides accessible login controls when CMS presentation is unavailable', async () => {
  const login = vi.fn();
  const user = userEvent.setup();
  render(
    <BundledLoginPage
      error="Identity service is temporarily unavailable."
      onLogin={login}
    />,
  );
  expect(screen.getByRole('main')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('temporarily unavailable');
  const password = screen.getByLabelText(/^Password/u);
  expect(password).toHaveAttribute('type', 'password');
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  await user.type(screen.getByLabelText(/^Login ID/u), 'operator');
  await user.type(password, 'test-input');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(login).toHaveBeenCalledWith('operator', 'test-input');
});
