/** Real App/login renderers with deferred synthetic owner responses; no live services or stored credentials. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { AppProviders } from '../../src/app/AppProviders';
import { validResolvedPage } from '../cms/fixtures/resolvedPage';

// Isolate registration itself while retaining its actual App-owned logout callback.
vi.mock(
  '../../src/operations/enterprise/registration/EmployeeRegistrationRoutePage',
  () => ({
    EmployeeRegistrationRoutePage: ({ onSignIn }: { onSignIn?: () => void }) => (
      <button onClick={() => onSignIn?.()}>Return to sign in</button>
    ),
  }),
);

const runtime = {
  backofficeBaseUrl: 'https://backoffice.example.com',
  enterpriseCode: 'enterprise-a',
  projectCode: 'nodics.kickoff',
  clientContractVersion: 1,
  requestTimeoutMs: 10_000,
  browserSessionTimeoutMs: 15_000,
  browserSessionCsrfCookieName: 'nodics_axis_csrf',
  assistantMaximumEventBytes: 65_536,
  assistantReconnectWindowMs: 120_000,
  assistantIdleTimeoutMs: 45_000,
};
const publicBootstrap = {
  data: {
    contractVersion: 1,
    clientContractVersion: 1,
    endpoints: {
      profile: 'https://profile.example.com',
      cms: 'https://cms.example.com',
    },
    uiComposition: {
      site: 'axisCmsSite',
      catalog: 'axisContentCatalog',
      defaultPublicPage: '/login',
      defaultAuthenticatedPage: '/dashboard',
      locale: 'en',
      channel: 'web',
      fallbackMode: 'STATIC_RECOVERY_SHELL',
    },
  },
};
const authenticatedBootstrap = {
  data: {
    modules: {},
    catalogue: {},
    availability: {},
    documentationSources: [],
    tenantCode: 'default',
    axisInitializationAdmission: 'READY',
    axisPolicy: {
      contractVersion: 0,
      screenLockEnabled: false,
      idleTimeoutSeconds: 900,
      recentNavigationLimit: 12,
      revision: 0,
      source: 'DEFAULT',
    },
    startupValidation: {
      state: 'READY',
      checkedAt: '2026-10-12T00:00:00.000Z',
      source: 'backoffice.startupValidation',
      summary: {
        total: 0,
        errors: 0,
        warnings: 0,
        info: 0,
        dismissible: 0,
        acknowledged: 0,
      },
      findings: [],
    },
  },
};
const loginPage = {
  ...validResolvedPage,
  page: {
    ...validResolvedPage.page,
    components: [
      ...validResolvedPage.page.components,
      {
        code: 'login',
        typeCode: 'employee-login',
        renderer: 'axis.component.employee-login-form',
        rendererContractVersion: 1,
        rendererChannels: ['web'],
        rendererDeprecated: false,
        properties: {
          usernameLabel: 'Employee ID',
          passwordLabel: 'Password',
          submitLabel: 'Sign in',
        },
        slot: 'authentication',
        index: 30,
        components: [],
      },
    ],
  },
};
const dashboardPage = {
  ...validResolvedPage,
  path: '/dashboard',
  page: {
    ...validResolvedPage.page,
    code: 'dashboard',
    renderer: 'axis.page.dashboard',
    template: 'axisDashboardPageTemplate',
    templateContract: {
      code: 'axisDashboardPageTemplate',
      renderer: 'axis.template.dashboard',
      contractVersion: 0,
    },
    components: [
      {
        code: 'welcome',
        typeCode: 'message',
        renderer: 'axis.component.message',
        rendererContractVersion: 1,
        rendererChannels: ['web'],
        rendererDeprecated: false,
        properties: {
          title: 'Authenticated workspace',
          message: 'Synthetic owner response',
        },
        slot: 'welcome',
        index: 10,
        components: [],
      },
    ],
  },
};

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status });
}
function authResponse(): Response {
  return response({ result: { authToken: 'old-access', loginId: 'operator' } });
}
function NavigationProbe() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => void navigate('/forgot-password')}>Open recovery</button>
      <button onClick={() => void navigate('/login?returnTo=%2Fmedia%2Flibrary')}>
        Change sign-in return path
      </button>
      <button
        onClick={() =>
          void navigate('/login', {
            state: { registrationSignIn: { enterpriseCode: 'enterprise-a' } },
          })
        }
      >
        Change sign-in state
      </button>
    </>
  );
}

function fixture(phase: 'authentication' | 'bootstrap', bundled = false) {
  let complete!: (value: Response) => void;
  const deferred = new Promise<Response>((resolve) => {
    complete = resolve;
  });
  let authenticationCalls = 0,
    bootstrapCalls = 0;
  const request = vi.fn<typeof fetch>().mockImplementation((input, options) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.pathname.endsWith('/bootstrap/public'))
      return Promise.resolve(response(publicBootstrap));
    if (url.pathname.endsWith('/employee/browser/authenticate')) {
      authenticationCalls++;
      if (authenticationCalls === 1)
        return phase === 'authentication' ? deferred : Promise.resolve(authResponse());
      return Promise.resolve(
        response({ result: { authToken: 'new-access', loginId: 'operator' } }),
      );
    }
    if (url.pathname.endsWith('/employee/browser/logout'))
      return Promise.resolve(response({ result: true }));
    if (url.pathname.endsWith('/bootstrap')) {
      bootstrapCalls++;
      if (
        phase === 'bootstrap' &&
        new Headers(options?.headers).get('Authorization') === 'Bearer old-access'
      )
        return deferred;
      return Promise.resolve(response(authenticatedBootstrap));
    }
    if (url.pathname.includes('/delivery/')) {
      if (bundled) return Promise.resolve(response({}, 503));
      return Promise.resolve(
        response({
          result:
            url.searchParams.get('path') === '/dashboard' ? dashboardPage : loginPage,
        }),
      );
    }
    return Promise.resolve(response({}, 404));
  });
  vi.stubGlobal('fetch', request);
  const view = render(
    <AppProviders runtimeConfig={runtime}>
      <App />
      <NavigationProbe />
    </AppProviders>,
  );
  const user = userEvent.setup();
  return {
    view,
    user,
    request,
    authenticationCalls: () => authenticationCalls,
    bootstrapCalls: () => bootstrapCalls,
    async submit(rapid = false) {
      const login = await screen.findByLabelText(
        bundled ? /^Login ID/u : 'Employee ID',
      );
      await user.type(login, 'operator');
      await user.type(screen.getByLabelText(/^Password/u), 'synthetic-password');
      const button = screen.getByRole('button', { name: 'Sign in' });
      if (rapid) {
        act(() => {
          fireEvent.submit(button.closest('form')!);
          fireEvent.submit(button.closest('form')!);
        });
      } else await user.click(button);
      await waitFor(() =>
        expect(
          phase === 'authentication' ? authenticationCalls : bootstrapCalls,
        ).toBeGreaterThan(0),
      );
    },
    async logout() {
      await user.click(screen.getByRole('button', { name: 'Open recovery' }));
      await user.click(
        await screen.findByRole('button', { name: 'Return to sign in' }),
      );
      await screen.findByRole('button', { name: 'Sign in' });
    },
    async settle(success: boolean) {
      await act(async () => {
        complete(
          success
            ? phase === 'authentication'
              ? authResponse()
              : response(authenticatedBootstrap)
            : response({}, 401),
        );
        await deferred;
      });
    },
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
  document.cookie = 'nodics_axis_csrf=; Max-Age=0; Path=/';
  window.history.replaceState({}, '', '/login');
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it.each(
  (['authentication', 'bootstrap'] as const).flatMap((phase) => [
    { phase, bundled: false },
    { phase, bundled: true },
  ]),
)(
  'single-flights rapid submit during $phase (bundled=$bundled)',
  async ({ phase, bundled }) => {
    const f = fixture(phase, bundled);
    await f.submit(true);
    const button = screen.getByRole('button', { name: 'Sign in' });
    expect(button).toBeDisabled();
    expect(button.closest('form')).toHaveAttribute('aria-busy', 'true');
    act(() => {
      fireEvent.submit(button.closest('form')!);
      fireEvent.submit(button.closest('form')!);
    });
    await f.user.type(screen.getByLabelText(/^Password/u), '{Enter}');
    expect(f.authenticationCalls()).toBe(1);
    expect(f.bootstrapCalls()).toBe(phase === 'bootstrap' ? 1 : 0);
    await f.settle(true);
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
    await f.user.click(screen.getByRole('button', { name: 'Open recovery' }));
    expect(window.location.pathname).toBe('/forgot-password');
    expect(f.authenticationCalls()).toBe(1);
    expect(f.bootstrapCalls()).toBe(1);
  },
);

const cases = (['authentication', 'bootstrap'] as const).flatMap((phase) => [
  { phase, success: true },
  { phase, success: false },
]);
it.each(
  cases.flatMap((entry) => [
    { ...entry, departure: 'path', button: 'Open recovery', bundled: false },
    { ...entry, departure: 'path', button: 'Open recovery', bundled: true },
    {
      ...entry,
      departure: 'search',
      button: 'Change sign-in return path',
      bundled: false,
    },
    {
      ...entry,
      departure: 'state',
      button: 'Change sign-in state',
      bundled: false,
    },
  ]),
)(
  'retires $phase success=$success on $departure route departure (bundled=$bundled)',
  async ({ phase, success, departure, button, bundled }) => {
    const f = fixture(phase, bundled);
    await f.submit();
    await f.user.click(screen.getByRole('button', { name: button }));
    const destination = window.location.pathname + window.location.search;
    await f.settle(success);
    expect(window.location.pathname + window.location.search).toBe(destination);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open employee menu' }),
    ).not.toBeInTheDocument();
    expect(f.authenticationCalls()).toBe(1);
    expect(f.bootstrapCalls()).toBe(phase === 'bootstrap' ? 1 : 0);
    expect(window.sessionStorage.length).toBe(0);
    if (departure === 'path') {
      await f.user.click(screen.getByRole('button', { name: 'Return to sign in' }));
    }
    const signIn = await screen.findByRole('button', { name: 'Sign in' });
    expect(signIn.closest('form')).toHaveAttribute('aria-busy', 'false');
    if (!bundled) expect(signIn).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  },
);

it.each(cases)(
  'retires $phase success=$success after explicit logout without automatic retry',
  async ({ phase, success }) => {
    const f = fixture(phase);
    await f.submit();
    await f.logout();
    await f.settle(success);
    expect(window.location.pathname).toBe('/login');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(f.authenticationCalls()).toBe(1);
    expect(f.bootstrapCalls()).toBe(phase === 'bootstrap' ? 1 : 0);
    expect(window.sessionStorage.length).toBe(0);
  },
);

it.each(cases)(
  'cannot overwrite newer authority with retired $phase success=$success',
  async ({ phase, success }) => {
    const f = fixture(phase);
    await f.submit();
    await f.logout();
    await f.submit();
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
    await screen.findByRole('button', { name: 'Open employee menu' });
    await f.user.click(screen.getByRole('button', { name: 'Open recovery' }));
    await f.settle(success);
    expect(window.location.pathname).toBe('/forgot-password');
    // Real logout must still see the newer session and call its canonical owner.
    await f.user.click(screen.getByRole('button', { name: 'Return to sign in' }));
    await waitFor(() =>
      expect(
        f.request.mock.calls.some(([input]) =>
          (typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url
          ).includes('/employee/browser/logout'),
        ),
      ).toBe(true),
    );
    expect(f.authenticationCalls()).toBe(2);
    expect(
      screen.queryByText('Employee authentication failed'),
    ).not.toBeInTheDocument();
  },
);

it.each(['authentication', 'bootstrap'] as const)(
  'releases a current %s failure for explicit retry only',
  async (phase) => {
    const f = fixture(phase);
    await f.submit();
    await f.settle(false);
    expect(await screen.findByRole('alert')).toBeVisible();
    const button = screen.getByRole('button', { name: 'Sign in' });
    expect(button).toBeEnabled();
    expect(button.closest('form')).toHaveAttribute('aria-busy', 'false');
    expect(f.authenticationCalls()).toBe(1);
    await f.user.click(button);
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
    expect(f.authenticationCalls()).toBe(2);
  },
);

it.each(cases)(
  'cannot act after unmount on $phase success=$success',
  async ({ phase, success }) => {
    const f = fixture(phase);
    await f.submit();
    f.view.unmount();
    window.history.replaceState({}, '', '/untouched');
    await f.settle(success);
    expect(window.location.pathname).toBe('/untouched');
    expect(window.sessionStorage.length).toBe(0);
    expect(f.authenticationCalls()).toBe(1);
    expect(f.bootstrapCalls()).toBe(phase === 'bootstrap' ? 1 : 0);
  },
);
