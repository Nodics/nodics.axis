import { render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
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
            'auth.invalid_credentials':
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
  browserSessionTimeoutMs: 15_000,
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
    messageKey: 'auth.invalid_credentials',
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

function Harness({ currentRuntime = runtime }: { currentRuntime?: AxisRuntimeConfig }) {
  const localization = useAxisLocalizationController(bootstrap, currentRuntime);
  return (
    <AxisLocalizationBoundary value={localization}>
      <Probe />
    </AxisLocalizationBoundary>
  );
}

describe('Axis localization context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('nodics-axis-locale-v1', 'ar');
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('switches the component theme direction without discarding an unsaved field', async () => {
    function DraftProbe() {
      const locale = useAxisLocalization();
      const theme = useTheme();
      const [draft, setDraft] = useState('');
      return (
        <>
          <output>{theme.direction}</output>
          <TextField
            label="Unsaved draft"
            placeholder="Keep drafting"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button onClick={() => locale.setLocale('en')}>Change to English</button>
        </>
      );
    }
    function DraftHarness() {
      const localization = useAxisLocalizationController(bootstrap, runtime);
      return (
        <AxisLocalizationBoundary value={localization}>
          <DraftProbe />
        </AxisLocalizationBoundary>
      );
    }
    const user = userEvent.setup();
    render(<DraftHarness />);
    expect(await screen.findByText('rtl')).toBeVisible();
    await user.type(screen.getByLabelText('Unsaved draft'), 'Keep this draft');
    await user.click(screen.getByRole('button', { name: 'Change to English' }));
    expect(await screen.findByText('ltr')).toBeVisible();
    expect(screen.getByLabelText('Unsaved draft')).toHaveValue('Keep this draft');
  });

  it('reads the live Localization owner result envelope', async () => {
    const client = await vi.importActual<
      typeof import('../../src/localization/localizationBundleClient')
    >('../../src/localization/localizationBundleClient');
    const ownerBundle = {
      contractVersion: 0,
      locale: 'ar',
      scopeCode: 'axisCmsSite',
      channel: 'web',
      releaseVersion: 'live-owner-release',
      namespaces: ['common'],
      entries: { 'common.skip-to-main-content': 'انتقل إلى المحتوى الرئيسي' },
    };
    const result = await client.loadLocalizationBundle(
      'https://localization.example.com',
      'enterprise-a',
      'ar',
      'axisCmsSite',
      'web',
      ['common'],
      1_000,
      undefined,
      () =>
        Promise.resolve(
          new Response(
            JSON.stringify({ code: 'SUC_LAPI_00000', result: { bundle: ownerBundle } }),
          ),
        ),
    );
    expect(result.bundle).toEqual(ownerBundle);
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

  it('uses the caller locale fallback for internal or unstructured errors', async () => {
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
    expect(await screen.findByText('Transport fallback')).toBeVisible();
  });

  it('does not request a remote bundle for a single-locale fallback shell without a cached bundle', async () => {
    const singleLocaleBootstrap: AxisPublicBootstrap = {
      ...bootstrap,
      uiComposition: {
        ...bootstrap.uiComposition,
        supportedLocales: ['en'],
        fallbackLocales: [],
      },
    };
    window.localStorage.setItem('nodics-axis-locale-v1', 'en');

    function SingleLocaleHarness() {
      const localization = useAxisLocalizationController(
        singleLocaleBootstrap,
        runtime,
      );
      return (
        <AxisLocalizationBoundary value={localization}>
          <output>{localization.format('auth.invalid_credentials', 'Fallback')}</output>
        </AxisLocalizationBoundary>
      );
    }

    render(<SingleLocaleHarness />);

    expect(await screen.findByText('Fallback')).toBeVisible();
    expect(loadLocalizationBundle).not.toHaveBeenCalled();
  });

  it('loads the owner bundle for the default locale of a multilingual site', async () => {
    window.localStorage.setItem('nodics-axis-locale-v1', 'en');

    function DefaultLocaleHarness() {
      const localization = useAxisLocalizationController(bootstrap, runtime);
      return (
        <AxisLocalizationBoundary value={localization}>
          <output>{localization.format('auth.invalid_credentials', 'Fallback')}</output>
        </AxisLocalizationBoundary>
      );
    }

    render(<DefaultLocaleHarness />);

    expect(
      await screen.findByText('The employee identifier or password is incorrect.'),
    ).toBeVisible();
    expect(loadLocalizationBundle).toHaveBeenCalledWith(
      expect.any(String),
      'enterprise-a',
      'en',
      expect.any(String),
      'web',
      expect.any(Array),
      expect.any(Number),
      undefined,
    );
  });

  it('does not render or revalidate another enterprise’s bundle when the owner is unavailable', async () => {
    const view = render(<Harness />);
    expect(
      await screen.findByText('معرّف الموظف أو كلمة المرور غير صحيحة.'),
    ).toBeVisible();
    vi.mocked(loadLocalizationBundle).mockRejectedValueOnce(new Error('offline'));
    view.rerender(
      <Harness currentRuntime={{ ...runtime, enterpriseCode: 'enterprise-b' }} />,
    );
    expect(await screen.findByText('Invalid authentication parameters')).toBeVisible();
    expect(loadLocalizationBundle).toHaveBeenLastCalledWith(
      expect.any(String),
      'enterprise-b',
      'ar',
      expect.any(String),
      'web',
      expect.any(Array),
      expect.any(Number),
      undefined,
    );
  });

  it('retains a last-known-good bundle during an outage and fails closed on markup-like messages', async () => {
    window.localStorage.setItem(
      'nodics-axis-localization-bundle-v3:' +
        JSON.stringify([
          'https://localization.example.com',
          'enterprise-a',
          'axisCmsSite',
          'web',
          'ar',
        ]),
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
            'auth.invalid_credentials': "'<img src=x onerror=alert(1)>'",
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
