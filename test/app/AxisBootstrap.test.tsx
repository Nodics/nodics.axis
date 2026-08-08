import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AxisBootstrap } from '../../src/app/AxisBootstrap';
import { validResolvedPage } from '../cms/fixtures/resolvedPage';

const validConfig = {
  backofficeBaseUrl: 'http://localhost:3000',
  enterpriseCode: 'default',
  projectCode: 'kickoff',
  clientContractVersion: 1,
  requestTimeoutMs: 10_000,
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
});
