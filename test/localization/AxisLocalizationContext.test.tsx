import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AxisPublicBootstrap } from '../../src/bootstrap/publicBootstrap';
import {
  AxisLocalizationBoundary,
  useAxisLocalization,
  useAxisLocalizationController,
} from '../../src/localization/AxisLocalizationContext';
import { AxisApiError } from '../../src/localization/axisApiError';
import { loadLocalizationBundle } from '../../src/localization/localizationBundleClient';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';

vi.mock('../../src/localization/localizationBundleClient', () => ({
  loadLocalizationBundle: vi.fn(
    (_endpoint: string, _enterprise: string, locale: string) =>
      Promise.resolve({
        notModified: false,
        etag: `"${locale}-1"`,
        bundle: {
          contractVersion: 0,
          locale,
          scopeCode: 'axisCmsSite',
          channel: 'web',
          namespaces: ['auth', 'common'],
          releaseVersion: `${locale}-1`,
          entries: {
            'auth.invalidCredentials':
              locale === 'ar'
                ? 'معرّف الموظف أو كلمة المرور غير صحيحة.'
                : 'The employee identifier or password is incorrect.',
          },
        },
      }),
  ),
}));

const runtime: AxisRuntimeConfig = {
  backofficeBaseUrl: 'https://backoffice.example.com',
  enterpriseCode: 'enterprise-a',
  projectCode: 'project-a',
  clientContractVersion: 1,
  requestTimeoutMs: 10_000,
  browserSessionCsrfCookieName: 'axis_csrf',
  assistantMaximumEventBytes: 65_536,
  assistantReconnectWindowMs: 120_000,
  assistantIdleTimeoutMs: 45_000,
};

const bootstrap: AxisPublicBootstrap = {
  contractVersion: 0,
  clientContractVersion: 1,
  endpoints: {
    profile: 'https://profile.example.com',
    cms: 'https://cms.example.com',
    localization: 'https://localization.example.com',
  },
  uiComposition: {
    site: 'axisCmsSite',
    catalog: 'axisContentCatalog',
    defaultPublicPage: '/login',
    defaultAuthenticatedPage: '/dashboard',
    locale: 'en',
    supportedLocales: ['en', 'ar'],
    fallbackLocales: ['en'],
    channel: 'web',
    fallbackMode: 'STATIC_RECOVERY_SHELL',
  },
};

function Probe() {
  const localization = useAxisLocalization();
  const error = new AxisApiError({
    code: 'ERR_AUTH_00002',
    message: 'Invalid authentication parameters',
    messageKey: 'auth.invalidCredentials',
    messageParameters: {},
    messageExposure: 'PUBLIC',
  });
  return (
    <>
      <output>{localization.formatError(error, 'Authentication failed')}</output>
      <button onClick={() => localization.setLocale('en')} type="button">
        English
      </button>
    </>
  );
}

function Harness() {
  const localization = useAxisLocalizationController(bootstrap, runtime);
  return (
    <AxisLocalizationBoundary value={localization}>
      <Probe />
    </AxisLocalizationBoundary>
  );
}

describe('Axis localization context', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('nodics-axis-locale-v1', 'ar');
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('renders a structured backend error in Arabic and applies document direction', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(
      await screen.findByText('معرّف الموظف أو كلمة المرور غير صحيحة.'),
    ).toBeVisible();
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');

    await user.click(screen.getByRole('button', { name: 'English' }));
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('lang', 'en');
      expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    });
  });

  it('does not localize internal or unstructured backend errors', async () => {
    function InternalProbe() {
      const localization = useAxisLocalization();
      return (
        <output>
          {localization.formatError(
            new AxisApiError({
              message: 'Safe existing fallback',
              messageKey: 'internal.failure',
            }),
            'Transport fallback',
          )}
        </output>
      );
    }
    function InternalHarness() {
      const localization = useAxisLocalizationController(bootstrap, runtime);
      return (
        <AxisLocalizationBoundary value={localization}>
          <InternalProbe />
        </AxisLocalizationBoundary>
      );
    }
    render(<InternalHarness />);
    expect(await screen.findByText('Safe existing fallback')).toBeVisible();
  });

  it('retains a last-known-good bundle during an outage and fails closed on markup-like messages', async () => {
    window.localStorage.setItem(
      'nodics-axis-localization-bundle-v1:ar',
      JSON.stringify({
        etag: '"ar-cached"',
        bundle: {
          contractVersion: 0,
          locale: 'ar',
          scopeCode: 'axisCmsSite',
          channel: 'web',
          namespaces: ['auth'],
          releaseVersion: '0',
          entries: {
            'auth.invalidCredentials': "'<img src=x onerror=alert(1)>'",
          },
        },
      }),
    );
    vi.mocked(loadLocalizationBundle).mockRejectedValueOnce(new Error('offline'));

    render(<Harness />);

    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeVisible();
    expect(document.querySelector('img')).toBeNull();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });
});
