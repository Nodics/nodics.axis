import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { EmployeeRegistrationRoutePage } from '../../src/operations/enterprise/registration/EmployeeRegistrationRoutePage';
import {
  runtime,
  profileBaseUrl,
  workspace,
  progress,
  applicationWorkspace,
} from './registrationFixtures';

/** Native React/MUI interaction checks against the real typed HTTP client.
 * HTTP responses are independent fixtures; no live backend/email acceptance is claimed.
 */
const continuation = 'a'.repeat(43);
const invitation = { code: 'invite-a', name: 'Example Repair', recovery: false };
const details = {
  ...progress,
  stage: 'DETAILS',
  codeState: 'VERIFIED',
  assignments: [invitation],
  selectedAssignment: invitation.code,
};
const completed = {
  ...progress,
  stage: 'COMPLETE',
  codeState: 'CONSUMED',
  signInEnterpriseCode: 'example-repair',
};
function LocationProbe() {
  const location = useLocation();
  return (
    <pre data-testid="destination">
      {JSON.stringify({ path: location.pathname, state: location.state as unknown })}
    </pre>
  );
}
function mount(
  reply: (action: string, body: Readonly<Record<string, string>>) => unknown,
  recovery = false,
  registrationWorkspace = workspace,
) {
  const commands: { action: string; body: Record<string, string> }[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    expect(new URL(url).origin).toBe('https://profile.example.test');
    expect(new Headers(init?.headers).has('Authorization')).toBe(false);
    let result: unknown = recovery
      ? {
          ...workspace,
          renderer: 'axis.employee-recovery',
          endpoints: {
            start: '/nodics/profile/v0/employee-recovery/start',
            verify: '/nodics/profile/v0/employee-recovery/verify',
            resend: '/nodics/profile/v0/employee-recovery/resend',
            status: '/nodics/profile/v0/employee-recovery/status',
            complete: '/nodics/profile/v0/employee-recovery/reset',
          },
        }
      : registrationWorkspace;
    if (init?.method === 'POST') {
      const action = new URL(url).pathname.split('/').at(-1) ?? '';
      if (typeof init.body !== 'string')
        throw new Error('Expected a JSON string request body');
      const body = JSON.parse(init.body) as Record<string, string>;
      commands.push({ action, body });
      result = await reply(action, body);
    }
    if (result instanceof Response) return result;
    return new Response(JSON.stringify({ code: 'SUC_PRFL_00000', data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetcher);
  const view = render(
    <MemoryRouter initialEntries={['/enterprise-access/register']}>
      <Routes>
        <Route
          path="/enterprise-access/register"
          element={
            <EmployeeRegistrationRoutePage
              runtime={runtime}
              profileBaseUrl={profileBaseUrl}
              journey={recovery ? 'recovery' : 'registration'}
            />
          }
        />
        <Route path="/login" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
  return { commands, fetcher, view, user: userEvent.setup() };
}
async function enterEmail(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('heading', { name: workspace.presentation.title });
  await user.type(screen.getByRole('textbox', { name: 'Email' }), 'alex@example.test');
  await user.click(screen.getByRole('button', { name: 'Send code' }));
  await screen.findByRole('textbox', { name: 'Code' });
}
async function verify(user: ReturnType<typeof userEvent.setup>) {
  const field = screen.getByRole('textbox', { name: 'Code' });
  expect(field).toHaveAttribute('autocomplete', 'one-time-code');
  await user.type(field, '123456');
  await user.click(screen.getByRole('button', { name: 'Verify' }));
}
async function enterDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole('textbox', { name: 'First name' }), 'Alex');
  await user.type(screen.getByRole('textbox', { name: 'Last name' }), 'Example');
  await user.type(screen.getByLabelText(/^Password/), 'Example-only-2026!');
  await user.click(screen.getByRole('button', { name: 'Complete registration' }));
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('Invited registration rendered journey', () => {
  it.each([false, true])(
    'retires delivery guidance after verified account details (recovery=%s)',
    async (recovery) => {
      const { user, commands } = mount(
        (action) =>
          action === 'start'
            ? { ...progress, continuation }
            : recovery
              ? { ...progress, stage: 'RESET_PASSWORD', codeState: 'VERIFIED' }
              : details,
        recovery,
      );
      await enterEmail(user);
      expect(screen.getByText(workspace.presentation.sentMessage)).toBeVisible();
      await verify(user);
      expect(await screen.findByLabelText(/^Password/)).toBeVisible();
      expect(
        screen.queryByText(workspace.presentation.sentMessage),
      ).not.toBeInTheDocument();
      expect(screen.getByText('alex@example.test')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Check progress' })).toBeVisible();
      expect(commands.map((command) => command.action)).toEqual(['start', 'verify']);
    },
  );

  it.each([
    'Registration progress could not be confirmed. Check progress before trying again.',
    'Owner-localized storage failure',
  ])(
    'does not promise progress inspection after START lost its continuation (%s)',
    async (message) => {
      const { user, commands } = mount(
        () =>
          new Response(
            JSON.stringify({
              code: 'ERR_PROFILE_REG_STORAGE',
              message,
            }),
            { status: 503 },
          ),
      );
      await screen.findByRole('heading', { name: workspace.presentation.title });
      await user.type(
        screen.getByRole('textbox', { name: 'Email' }),
        'alex@example.test',
      );
      await user.click(screen.getByRole('button', { name: 'Send code' }));
      expect(
        await screen.findByText(
          'The request outcome could not be confirmed. Progress cannot be checked from this page. Contact your administrator before sending another code.',
        ),
      ).toBeVisible();
      expect(screen.queryByText(message)).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Check progress' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'Code' })).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue(
        'alex@example.test',
      );
      expect(screen.getByRole('button', { name: 'Send code' })).toBeEnabled();
      expect(commands).toEqual([
        { action: 'start', body: { email: 'alex@example.test' } },
      ]);
    },
  );

  it('keeps owner validation errors after START and does not infer storage failure from wording', async () => {
    const message = 'Owner validation refused this request';
    const { user, commands } = mount(
      () =>
        new Response(
          JSON.stringify({
            code: 'ERR_PROFILE_REG_EMAIL',
            message,
          }),
          { status: 400 },
        ),
    );
    await screen.findByRole('heading', { name: workspace.presentation.title });
    await user.type(
      screen.getByRole('textbox', { name: 'Email' }),
      'alex@example.test',
    );
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText(message)).toBeVisible();
    expect(commands).toHaveLength(1);
  });

  it('retains Check progress after a later storage failure and uses only the received continuation', async () => {
    const message =
      'Registration progress could not be confirmed. Check progress before trying again.';
    const { user, commands } = mount((action) => {
      if (action === 'start') return { ...progress, continuation };
      if (action === 'status') return progress;
      return new Response(
        JSON.stringify({ code: 'ERR_PROFILE_REG_STORAGE', message }),
        { status: 503 },
      );
    });
    await enterEmail(user);
    await verify(user);
    expect(await screen.findByText(message)).toBeVisible();
    expect(commands.map((command) => command.action)).toEqual(['start', 'verify']);
    await user.click(screen.getByRole('button', { name: 'Check progress' }));
    await waitFor(() => expect(screen.queryByText(message)).not.toBeInTheDocument());
    expect(commands.at(-1)).toEqual({ action: 'status', body: { continuation } });
  });

  it('renders the retained history deadline with owner copy and no extra command', async () => {
    const deadlineAt = '2099-02-01T00:00:00Z';
    const { user, commands } = mount(
      (action) =>
        action === 'start'
          ? { ...progress, continuation }
          : {
              ...progress,
              stage: 'APPLICATION_PENDING',
              codeState: 'VERIFIED',
              applicationChoices: [],
              applications: [
                {
                  code: 'application-a',
                  enterpriseCode: 'business-a',
                  enterpriseName: 'Example Repair',
                  status: 'AWAITING_REVIEW',
                  canWithdraw: false,
                  submittedAt: '2099-01-01T00:00:00Z',
                  deadlineAt,
                  reviewStatus: 'STARTED',
                },
              ],
            },
      false,
      applicationWorkspace,
    );
    await enterEmail(user);
    await verify(user);
    const time = await screen.findByText(new Date(deadlineAt).toLocaleString());
    expect(time).toHaveAttribute('datetime', deadlineAt);
    expect(screen.getByText(/Review deadline:/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull();
    expect(commands.map((command) => command.action)).toEqual(['start', 'verify']);
  });
  it('recovers a password without registration fields or membership writes', async () => {
    const { user, commands, fetcher } = mount(
      (action) =>
        action === 'start'
          ? { ...progress, continuation }
          : action === 'verify'
            ? { ...progress, stage: 'RESET_PASSWORD', codeState: 'VERIFIED' }
            : completed,
      true,
    );
    await enterEmail(user);
    await verify(user);
    const password = await screen.findByLabelText(/^Password/);
    expect(password).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.queryByRole('textbox', { name: 'First name' })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    await user.type(password, 'Example-only-2026!');
    await user.click(screen.getByRole('button', { name: 'Complete registration' }));
    await screen.findByRole('button', { name: 'Sign in' });
    expect(commands.at(-1)?.action).toBe('reset');
    expect(commands.at(-1)?.body).toEqual({
      continuation,
      password: 'Example-only-2026!',
    });
    const requested = fetcher.mock.calls[0]?.[0];
    expect(
      requested instanceof URL
        ? requested.pathname
        : requested instanceof Request
          ? new URL(requested.url).pathname
          : requested,
    ).toContain('/employee-recovery/workspace');
  });
  it('completes one connected task and hands off only the approved enterprise', async () => {
    const { user, commands } = mount((action) =>
      action === 'start'
        ? { ...progress, continuation }
        : action === 'verify'
          ? details
          : completed,
    );
    await enterEmail(user);
    expect(
      screen.queryByRole('textbox', { name: /Enterprise code|Tenant|Role/ }),
    ).toBeNull();
    await verify(user);
    expect(await screen.findByText('Enterprise: Example Repair')).toBeVisible();
    await enterDetails(user);
    expect(await screen.findByText('Complete', { exact: true })).toBeVisible();
    expect(screen.queryByLabelText(/^Password/)).toBeNull();
    expect(commands.map((command) => command.action)).toEqual([
      'start',
      'verify',
      'register',
    ]);
    expect(commands[2]?.body).toEqual({
      continuation,
      firstName: 'Alex',
      lastName: 'Example',
      password: 'Example-only-2026!',
      assignmentCode: 'invite-a',
    });
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByTestId('destination')).toHaveTextContent(
      'example-repair',
    );
    expect(screen.getByTestId('destination')).not.toHaveTextContent(continuation);
  });
  it('shows invalid-code guidance without repeating email entry or displaying details', async () => {
    const { user, commands } = mount((action) =>
      action === 'start'
        ? { ...progress, continuation }
        : { ...progress, notice: 'INVALID_CODE' },
    );
    await enterEmail(user);
    await verify(user);
    expect(await screen.findByText('Invalid code')).toBeVisible();
    expect(screen.getByText('alex@example.test')).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'First name' })).toBeNull();
    expect(commands).toHaveLength(2);
  });
  it('retains safe details, clears the password and resumes through the same continuation after failure', async () => {
    let attempt = 0;
    const { user, commands } = mount((action) => {
      if (action === 'start') return { ...progress, continuation };
      if (action === 'verify') return details;
      if (action === 'status')
        return {
          ...details,
          stage: 'RECOVERY',
          assignments: [
            {
              ...invitation,
              recovery: true,
              profile: { firstName: 'Alex', lastName: 'Example' },
            },
          ],
        };
      if (attempt++ === 0) throw new Error('Connection interrupted');
      return completed;
    });
    await enterEmail(user);
    await verify(user);
    await enterDetails(user);
    expect(await screen.findByText('Connection interrupted')).toBeVisible();
    expect(screen.getByLabelText(/^Password/)).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'First name' })).toHaveValue('Alex');
    await user.click(screen.getByRole('button', { name: 'Check progress' }));
    const original = await screen.findByLabelText(/^Original password/);
    expect(original).toHaveAttribute('autocomplete', 'current-password');
    await user.type(original, 'Example-only-2026!');
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    expect(await screen.findByText('Complete', { exact: true })).toBeVisible();
    expect(
      commands
        .filter((command) => command.action === 'register')
        .map((command) => command.body.continuation),
    ).toEqual([continuation, continuation]);
  });
  it('does not show sending success when delivery is unavailable', async () => {
    const { user } = mount(() => ({
      ...progress,
      continuation,
      deliveryStatus: 'UNAVAILABLE',
    }));
    await enterEmail(user);
    expect(await screen.findByText('Delivery unavailable')).toBeVisible();
    expect(screen.queryByText('Sending requested')).toBeNull();
  });
  it.each(['SIGN_IN', 'NO_INVITATION'])(
    'does not create a password form for %s',
    async (stage) => {
      const { user, commands } = mount((action) =>
        action === 'start'
          ? { ...progress, continuation }
          : { ...progress, stage, codeState: 'VERIFIED' },
      );
      await enterEmail(user);
      await verify(user);
      expect(
        await screen.findByText(stage === 'SIGN_IN' ? 'Use sign in' : 'No invitation'),
      ).toBeVisible();
      expect(screen.queryByLabelText(/^Password/)).toBeNull();
      expect(commands).toHaveLength(2);
    },
  );
  it('admits only one in-flight submission even on repeated clicks', async () => {
    let release: ((value: unknown) => void) | undefined;
    const { user, commands } = mount(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    await screen.findByRole('textbox', { name: 'Email' });
    await user.type(
      screen.getByRole('textbox', { name: 'Email' }),
      'alex@example.test',
    );
    await user.dblClick(screen.getByRole('button', { name: 'Send code' }));
    expect(commands).toHaveLength(1);
    await act(async () => {
      release?.({ ...progress, continuation });
      await Promise.resolve();
    });
    expect(await screen.findByRole('textbox', { name: 'Code' })).toBeVisible();
  });
  it('locks an exhausted code and observes the server resend cooldown', async () => {
    const { user } = mount((action) =>
      action === 'start'
        ? { ...progress, continuation }
        : { ...progress, codeState: 'LOCKED' },
    );
    await enterEmail(user);
    await verify(user);
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Code' })).toBeDisabled(),
    );
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Resend' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start again' })).toBeEnabled();
  });
});
