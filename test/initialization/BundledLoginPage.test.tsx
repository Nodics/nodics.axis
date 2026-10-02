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

it.each([
  'Failed to fetch',
  'NetworkError when attempting to fetch resource.',
  'Load failed',
  'Network request failed',
])(
  'presents %s safely without resubmitting credentials or clearing entered fields',
  async (error) => {
    const login = vi.fn();
    const user = userEvent.setup();
    const view = render(<BundledLoginPage onLogin={login} />);
    const loginId = screen.getByLabelText(/^Login ID/u);
    const password = screen.getByLabelText(/^Password/u);
    await user.type(loginId, 'operator');
    await user.type(password, 'test-input');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(login).toHaveBeenCalledTimes(1);
    view.rerender(<BundledLoginPage error={error} onLogin={login} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sign-in is temporarily unavailable.',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent(error);
    expect(loginId).toHaveValue('operator');
    expect(password).toHaveValue('test-input');
    expect(login).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(login).toHaveBeenCalledTimes(2);
    expect(login).toHaveBeenLastCalledWith('operator', 'test-input');
  },
);

it('retains a safe authentication denial without presenting it as a network outage', () => {
  render(<BundledLoginPage error="Sign-in was not accepted." onLogin={vi.fn()} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Sign-in was not accepted.');
  expect(screen.getByRole('alert')).not.toHaveTextContent('temporarily unavailable');
});
