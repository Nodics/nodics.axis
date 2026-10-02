import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/app/App';
import { AppProviders } from '../../src/app/AppProviders';
import { readEnterpriseContext } from '../../src/auth/enterpriseSessionContext';
import { validResolvedPage } from '../cms/fixtures/resolvedPage';
import {
  profileBaseUrl,
  progress,
  runtime,
  workspace,
} from '../enterprise/registrationFixtures';

const registrationPath = '/enterprise-access/register';
const browserPath = '/nodics/profile/v0/employee/browser/';
const registrationApiPath = '/nodics/profile/v0/enterprise-access/';
const newEnterprise = 'example-repair';
const oldEmployee = 'platform-admin';
const csrf = 'fixture-platform-csrf';
const continuation = 'a'.repeat(43);

const publicBootstrap = {
  data: {
    contractVersion: 1,
    clientContractVersion: 1,
    endpoints: { profile: profileBaseUrl, cms: 'https://cms.example.test' },
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
    axisPolicy: {
      contractVersion: 0,
      screenLockEnabled: true,
      idleTimeoutSeconds: 900,
      recentNavigationLimit: 12,
      revision: 0,
      source: 'DEFAULT',
    },
    documentationSources: [],
    tenantCode: 'default',
    startupValidation: {
      state: 'READY',
      checkedAt: '2026-10-02T00:00:00.000Z',
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

function authenticationPage(locked: boolean) {
  return {
    ...validResolvedPage,
    path: locked ? '/lock-screen' : '/login',
    page: {
      ...validResolvedPage.page,
      components: [
        {
          code: locked
            ? 'axisEmployeeLockFormComponent'
            : 'axisEmployeeLoginFormComponent',
          typeCode: locked
            ? 'axisEmployeeLockFormComponentType'
            : 'axisEmployeeLoginFormComponentType',
          renderer: locked
            ? 'axis.component.employee-lock-form'
            : 'axis.component.employee-login-form',
          rendererContractVersion: 1,
          rendererChannels: ['web'],
          rendererDeprecated: false,
          properties: locked
            ? {
                title: 'Locked session',
                employeeLabel: 'Employee',
                passwordLabel: 'Password',
                passwordPlaceholder: 'Enter your password',
                submitLabel: 'Unlock',
                signOutLabel: 'Sign out',
              }
            : {
                title: 'Employee sign in',
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
}

/** Real App, registration and CMS renderers; only the HTTP owners are fixtures. */
function mount(existingSession: boolean) {
  window.history.replaceState({}, '', registrationPath);
  if (existingSession) document.cookie = `test_csrf=${csrf}; Path=/`;
  let finishLogout: ((response: Response) => void) | undefined;
  const requests: { url: URL; init: RequestInit | undefined }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      requests.push({ url, init });
      if (url.pathname.endsWith('/bootstrap/public'))
        return Response.json(publicBootstrap);
      if (url.pathname === `${browserPath}restore`)
        return Response.json({
          result: { authToken: 'fixture-old-platform-access', loginId: oldEmployee },
        });
      if (url.pathname === `${browserPath}logout`)
        return new Promise<Response>((resolve) => {
          finishLogout = resolve;
        });
      if (url.pathname === `${browserPath}authenticate`)
        return Response.json({ message: 'Fixture sign-in denied' }, { status: 401 });
      if (url.pathname.endsWith('/bootstrap'))
        return Response.json(authenticatedBootstrap);
      if (url.pathname.endsWith('/axis/initialization'))
        return Response.json({
          code: 'SUC_BOF_00017',
          data: {
            baselineCode: 'axis',
            releaseCode: 'axis:axisBaseline',
            releaseVersion: '0.0.0',
            releaseStatus: 'CURRENT',
            readiness: 'READY',
            publication: {
              code: 'cmsBaseline_axis_1_0_0',
              state: 'ONLINE',
              revision: 4,
            },
          },
        });
      if (url.pathname === `${registrationApiPath}workspace`)
        return Response.json({ data: workspace });
      if (url.pathname === `${registrationApiPath}start`)
        return Response.json({ data: { ...progress, continuation } });
      if (url.pathname === `${registrationApiPath}verify`)
        return Response.json({
          data: {
            ...progress,
            stage: 'DETAILS',
            codeState: 'VERIFIED',
            assignments: [
              { code: 'invite-a', name: 'Example Repair', recovery: false },
            ],
            selectedAssignment: 'invite-a',
          },
        });
      if (url.pathname === `${registrationApiPath}register`)
        return Response.json({
          data: {
            ...progress,
            stage: 'COMPLETE',
            codeState: 'CONSUMED',
            signInEnterpriseCode: newEnterprise,
          },
        });
      if (
        url.pathname.endsWith('/pages/resolve') ||
        url.pathname.endsWith('/pages/resolve/authenticated')
      ) {
        const path = url.searchParams.get('path');
        if (path === '/login' || path === '/lock-screen')
          return Response.json({ result: authenticationPage(path === '/lock-screen') });
      }
      return new Response(null, { status: 404 });
    }),
  );
  render(
    <AppProviders runtimeConfig={runtime}>
      <App />
    </AppProviders>,
  );
  return {
    user: userEvent.setup(),
    requests,
    calls: (path: string) =>
      requests.filter((request) => request.url.pathname === path),
    resolveLogout: async (status: number) => {
      if (!finishLogout) throw new Error('No secure logout is pending');
      await act(async () => {
        finishLogout?.(new Response(null, { status }));
        await Promise.resolve();
      });
    },
  };
}

async function completeRegistration(journey: ReturnType<typeof mount>) {
  const { user, calls } = journey;
  await screen.findByRole('heading', { name: workspace.presentation.title });
  expect(calls(`${browserPath}logout`)).toHaveLength(0);
  await user.type(screen.getByRole('textbox', { name: 'Email' }), progress.email);
  await user.click(screen.getByRole('button', { name: 'Send code' }));
  await user.type(await screen.findByRole('textbox', { name: 'Code' }), '123456');
  await user.click(screen.getByRole('button', { name: 'Verify' }));
  await user.type(await screen.findByRole('textbox', { name: 'First name' }), 'Alex');
  await user.type(screen.getByRole('textbox', { name: 'Last name' }), 'Example');
  await user.type(screen.getByLabelText(/^Password/), 'Example-only-2026!');
  await user.click(screen.getByRole('button', { name: 'Complete registration' }));
  await screen.findByRole('button', { name: 'Sign in' });
  expect(window.location.pathname).toBe(registrationPath);
  expect(calls(`${browserPath}logout`)).toHaveLength(0);
  expect(calls(`${browserPath}authenticate`)).toHaveLength(0);
  expect(calls(`${registrationApiPath}register`)).toHaveLength(1);
}

function expectOldSessionLogout(journey: ReturnType<typeof mount>) {
  const logouts = journey.calls(`${browserPath}logout`);
  expect(logouts).toHaveLength(1);
  expect(logouts[0]?.url.origin).toBe(new URL(profileBaseUrl).origin);
  expect(logouts[0]?.init).toMatchObject({
    method: 'POST',
    credentials: 'include',
    redirect: 'error',
    cache: 'no-store',
    body: '{}',
  });
  const headers = new Headers(logouts[0]?.init?.headers);
  expect(headers.get('X-CSRF-Token')).toBe(csrf);
  expect(headers.get('x-enterprise-code')).toBe(runtime.enterpriseCode);
  expect(headers.has('Authorization')).toBe(false);
}

beforeEach(() => {
  window.sessionStorage.clear();
  document.cookie = 'test_csrf=; Max-Age=0; Path=/';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  document.cookie = 'test_csrf=; Max-Age=0; Path=/';
});

describe('App completed registration session handoff', () => {
  it.each([true, false])(
    'requires explicit Sign in and uses the completed enterprise (existing session=%s)',
    async (existingSession) => {
      const journey = mount(existingSession);
      await completeRegistration(journey);
      if (existingSession)
        expect(readEnterpriseContext(runtime.backofficeBaseUrl)).toBe(
          runtime.enterpriseCode,
        );
      await journey.user.click(screen.getByRole('button', { name: 'Sign in' }));
      if (existingSession) {
        expectOldSessionLogout(journey);
        expect(window.location.pathname).toBe(registrationPath);
        expect(readEnterpriseContext(runtime.backofficeBaseUrl)).toBe(
          runtime.enterpriseCode,
        );
        expect(journey.calls(`${browserPath}authenticate`)).toHaveLength(0);
        await journey.resolveLogout(200);
      }
      await screen.findByRole('textbox', { name: 'Employee ID' });
      expect(window.location.pathname).toBe('/login');
      expect(window.history.state).toMatchObject({
        usr: { registrationSignIn: { enterpriseCode: newEnterprise } },
      });
      expect(readEnterpriseContext(runtime.backofficeBaseUrl)).toBeUndefined();
      const publicPages = journey.requests.filter(({ url }) =>
        url.pathname.endsWith('/pages/resolve'),
      );
      expect(publicPages.length).toBeGreaterThan(0);
      for (const request of publicPages) {
        expect(new Headers(request.init?.headers).get('x-enterprise-code')).toBe(
          runtime.enterpriseCode,
        );
        expect(new Headers(request.init?.headers).has('Authorization')).toBe(false);
      }
      expect(journey.calls(`${browserPath}authenticate`)).toHaveLength(0);
      await journey.user.type(
        screen.getByRole('textbox', { name: 'Employee ID' }),
        progress.email,
      );
      await journey.user.type(screen.getByLabelText(/^Password/), 'Example-only-2026!');
      await journey.user.click(screen.getByRole('button', { name: 'Sign in' }));
      await waitFor(() =>
        expect(journey.calls(`${browserPath}authenticate`)).toHaveLength(1),
      );
      const login = journey.calls(`${browserPath}authenticate`)[0];
      expect(new Headers(login?.init?.headers).get('x-enterprise-code')).toBe(
        newEnterprise,
      );
      expect(new Headers(login?.init?.headers).has('Authorization')).toBe(false);
      expect(journey.calls(`${browserPath}logout`)).toHaveLength(
        existingSession ? 1 : 0,
      );
      expect(journey.calls(`${browserPath}restore`)).toHaveLength(
        existingSession ? 1 : 0,
      );
    },
  );

  it('locks the old session on logout failure without authenticating the new enterprise', async () => {
    const journey = mount(true);
    await completeRegistration(journey);
    await journey.user.click(screen.getByRole('button', { name: 'Sign in' }));
    expectOldSessionLogout(journey);
    await journey.resolveLogout(503);
    await screen.findByRole('heading', { name: 'Locked session' });
    expect(window.location.pathname).toBe('/lock-screen');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Secure logout could not be completed. Please retry before leaving this device.',
    );
    expect(screen.getByText(oldEmployee)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeVisible();
    expect(
      screen.queryByRole('textbox', { name: 'Employee ID' }),
    ).not.toBeInTheDocument();
    expect(readEnterpriseContext(runtime.backofficeBaseUrl)).toBe(
      runtime.enterpriseCode,
    );
    expect(journey.calls(`${browserPath}authenticate`)).toHaveLength(0);
    expectOldSessionLogout(journey);
    expect(
      journey.requests.some(
        ({ init }) =>
          new Headers(init?.headers).get('x-enterprise-code') === newEnterprise,
      ),
    ).toBe(false);
  });
});
