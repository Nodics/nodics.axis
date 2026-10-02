import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AxisBootstrap } from '../../src/app/AxisBootstrap';
import { validResolvedPage } from '../cms/fixtures/resolvedPage';

const validConfig = {
  backofficeBaseUrl: 'http://localhost:3000',
  enterpriseCode: 'default',
  projectCode: 'nodics.kickoff',
  clientContractVersion: 1,
  requestTimeoutMs: 10_000,
  publicDiscoveryRetryWindowMs: 7_500,
  browserSessionCsrfCookieName: 'nodics_axis_csrf',
  assistantMaximumEventBytes: 65_536,
  assistantReconnectWindowMs: 120_000,
  assistantIdleTimeoutMs: 45_000,
};
const publicBootstrap = {
  code: 'SUC_BOF_00014',
  data: {
    contractVersion: 1,
    clientContractVersion: 1,
    endpoints: {
      profile: 'http://localhost:3000',
      cms: 'http://localhost:3000',
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

function successfulResponse(input: RequestInfo | URL): Response {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.endsWith('/axis-config.json')) {
    return new Response(JSON.stringify(validConfig), { status: 200 });
  }
  if (url.includes('/bootstrap/public')) {
    return new Response(JSON.stringify(publicBootstrap), { status: 200 });
  }
  return new Response(JSON.stringify({ result: validResolvedPage }), {
    status: 200,
  });
}

describe('AxisBootstrap', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders the application only after configuration succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockImplementation((input) => Promise.resolve(successfulResponse(input))),
    );

    render(<AxisBootstrap />);

    expect(screen.getByLabelText('Loading Axis configuration')).toBeInTheDocument();
    expect(await screen.findByText('Welcome back')).toBeInTheDocument();
  });

  it('fails safely and retries configuration', async () => {
    let configurationAttempts = 0;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.endsWith('/axis-config.json')) {
        configurationAttempts += 1;
        if (configurationAttempts === 1) {
          return Promise.resolve(new Response(null, { status: 503 }));
        }
      }
      return Promise.resolve(successfulResponse(input));
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<AxisBootstrap />);

    expect(
      await screen.findByRole('heading', { name: 'Axis cannot start safely' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry configuration' }));

    await waitFor(() => {
      expect(screen.getByText('Welcome back')).toBeInTheDocument();
    });
    expect(configurationAttempts).toBe(2);
  });
  it('recovers public discovery after one offline failure using GET only', async () => {
    let discoveryAttempts = 0;
    const request = vi.fn<typeof fetch>().mockImplementation((input, init) => {
      const url =
        input instanceof URL
          ? input.href
          : typeof input === 'string'
            ? input
            : input.url;
      if (url.includes('/bootstrap/public')) {
        expect(init?.method).toBe('GET');
        discoveryAttempts += 1;
        if (discoveryAttempts === 1)
          return Promise.resolve(new Response(null, { status: 503 }));
      }
      return Promise.resolve(successfulResponse(input));
    });
    vi.stubGlobal('fetch', request);
    render(<AxisBootstrap />);
    expect(
      await screen.findByRole('button', { name: 'Retry discovery' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('heading', { name: 'Connecting to your workspace' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Welcome back', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(discoveryAttempts).toBe(2);
    expect(request.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });
  it('recovers automatically beyond the previous seven-second startup limit', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation((input) => {
        const url = String(input instanceof Request ? input.url : input);
        if (url.endsWith('/axis-config.json'))
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ...validConfig,
                publicDiscoveryRetryWindowMs: 30_000,
              }),
            ),
          );
        if (url.includes('/bootstrap/public') && ++attempts <= 4)
          return Promise.resolve(new Response(null, { status: 503 }));
        return Promise.resolve(successfulResponse(input));
      }),
    );
    render(<AxisBootstrap />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_100);
    });
    expect(attempts).toBe(4);
    expect(
      screen.getByRole('heading', { name: 'Connecting to your workspace' }),
    ).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
    });
    expect(attempts).toBe(5);
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });

  it('does not retry a permanent public discovery denial', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation((input) => {
        if (
          String(input instanceof Request ? input.url : input).includes(
            '/bootstrap/public',
          )
        ) {
          attempts += 1;
          return Promise.resolve(new Response(null, { status: 403 }));
        }
        return Promise.resolve(successfulResponse(input));
      }),
    );
    render(<AxisBootstrap />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(attempts).toBe(1);
    expect(
      screen.getByRole('heading', { name: 'BackOffice registry is unavailable' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('keeps manual discovery recovery available after the bounded retry budget', async () => {
    let attempts = 0;
    let available = false;
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation((input) => {
        const url =
          input instanceof URL
            ? input.href
            : typeof input === 'string'
              ? input
              : input.url;
        if (url.includes('/bootstrap/public')) {
          attempts += 1;
          if (!available) return Promise.resolve(new Response(null, { status: 503 }));
        }
        return Promise.resolve(successfulResponse(input));
      }),
    );
    render(<AxisBootstrap />);
    await screen.findByRole('button', { name: 'Retry discovery' });
    await waitFor(() => expect(attempts).toBe(4), { timeout: 8500 });
    expect(
      screen.getByRole('heading', { name: 'BackOffice registry is unavailable' }),
    ).toBeInTheDocument();
    available = true;
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Retry discovery' }));
    expect(await screen.findByText('Welcome back')).toBeInTheDocument();
    expect(attempts).toBe(5);
  }, 12000);
});
