import { describe, expect, it, vi } from 'vitest';

import {
  authenticateEmployee,
  logoutEmployee,
  restoreEmployeeSession,
} from '../../src/auth/employeeAuthClient';
import { AxisApiError } from '../../src/localization/axisApiError';

describe('employee authentication client', () => {
  it('sends employee credentials only to Profile in the JSON body', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: { authToken: 'access-token', loginId: 'operator' },
        }),
        { status: 200 },
      ),
    );
    const session = await authenticateEmployee(
      'https://profile.example.com',
      'enterprise-a',
      'operator',
      'secret',
      10_000,
      request,
    );
    expect(session.accessToken).toBe('access-token');
    expect(session.loginId).toBe('operator');
    const [url, options] = request.mock.calls[0] ?? [];
    expect(url instanceof URL ? url.pathname : '').toBe(
      '/nodics/profile/v0/employee/browser/authenticate',
    );
    expect(options?.credentials).toBe('include');
    expect(new Headers(options?.headers).get('x-enterprise-code')).toBe('enterprise-a');
    expect(options?.body).toBe(
      JSON.stringify({ loginId: 'operator', password: 'secret' }),
    );
    expect(
      url instanceof URL ? url.href : typeof url === 'string' ? url : url?.url,
    ).not.toContain('secret');
  });

  it('revokes the HttpOnly browser session during logout', async () => {
    document.cookie = 'nodics_axis_csrf=csrf-token; Path=/';
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ result: true }), { status: 200 }),
      );
    await logoutEmployee(
      'https://profile.example.com',
      'enterprise-a',
      'nodics_axis_csrf',
      10_000,
      request,
    );
    const [, options] = request.mock.calls[0] ?? [];
    expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe('csrf-token');
    expect(new Headers(options?.headers).get('x-enterprise-code')).toBe('enterprise-a');
    expect(options?.credentials).toBe('include');
    expect(options?.body).toBe('{}');
  });

  it('does not misreport browser-session failures as invalid credentials', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'ERR_AUTH_00001',
          message: 'Invalid or expired authorization token',
        }),
        { status: 401 },
      ),
    );
    await expect(
      authenticateEmployee(
        'https://profile.example.com',
        'enterprise-a',
        'operator',
        'correct-password',
        10_000,
        request,
      ),
    ).rejects.toThrow('secure browser session');
  });

  it('preserves allow-listed structured localization metadata for the UI', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'ERR_AUTH_00002',
          message: 'Invalid authentication parameters',
          messageKey: 'auth.invalidCredentials',
          messageParameters: {},
          messageExposure: 'PUBLIC',
        }),
        { status: 401 },
      ),
    );
    const failure = await authenticateEmployee(
      'https://profile.example.com',
      'enterprise-a',
      'operator',
      'wrong-password',
      10_000,
      request,
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AxisApiError);
    expect(failure).toMatchObject({
      code: 'ERR_AUTH_00002',
      messageKey: 'auth.invalidCredentials',
      messageExposure: 'PUBLIC',
    });
  });

  it('restores an employee session without exposing the refresh credential', async () => {
    document.cookie = 'nodics_axis_csrf=restore-csrf; Path=/';
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: { authToken: 'rotated-access', loginId: 'operator' },
        }),
        { status: 200 },
      ),
    );

    const session = await restoreEmployeeSession(
      'https://profile.example.com',
      'enterprise-a',
      'nodics_axis_csrf',
      10_000,
      request,
    );

    expect(session).toMatchObject({
      accessToken: 'rotated-access',
      loginId: 'operator',
    });
    const [url, options] = request.mock.calls[0] ?? [];
    expect(url instanceof URL ? url.pathname : '').toBe(
      '/nodics/profile/v0/employee/browser/restore',
    );
    expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe('restore-csrf');
    expect(new Headers(options?.headers).get('x-enterprise-code')).toBe('enterprise-a');
    expect(options?.credentials).toBe('include');
  });

  it('rejects logout when Profile does not revoke the browser session', async () => {
    document.cookie = 'nodics_axis_csrf=csrf-token; Path=/';
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(
      logoutEmployee(
        'https://profile.example.com',
        'enterprise-a',
        'nodics_axis_csrf',
        10_000,
        request,
      ),
    ).rejects.toThrow('secure logout');
  });
});
