import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { RuntimeConfigurationRoutePage } from '../../../src/operations/runtimeConfiguration/RuntimeConfigurationRoutePage';
const readiness = { required: true, ready: true, reason: 'READY' };
const schema = {
  code: 'identity',
  ownerModule: 'profile',
  fields: [
    {
      code: 'botToken',
      label: 'Bot credential',
      type: 'string',
      sensitive: true,
      credentialReference: 'example.identity',
    },
  ],
  secretPersistence: readiness,
};
const json = (value: unknown) =>
  new Response(JSON.stringify({ code: 'SUC_SYS_00000', data: value }), {
    headers: { 'Content-Type': 'application/json' },
  });
afterEach(() => vi.unstubAllGlobals());
it('contains malformed target metadata and permits returning to a healthy owner without exposing sensitive values', async () => {
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      requests.push(url);
      if (url.endsWith('/config/runtime/schema'))
        return Promise.resolve(
          json(
            url.includes('staged.example')
              ? [
                  {
                    code: 'identity',
                    fields: [{ credentialReference: 'example.identity' }],
                  },
                ]
              : [schema],
          ),
        );
      return Promise.resolve(
        json({
          code: 'identity',
          ownerModule: 'profile',
          status: 'CONFIGURED',
          missingRequired: [],
          secretPersistence: readiness,
          values: {
            botToken: {
              configured: true,
              sensitive: true,
              value: 'synthetic-never-display',
            },
          },
        }),
      );
    }),
  );
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cache}>
      <RuntimeConfigurationRoutePage
        accessToken="synthetic-actor"
        runtime={{ enterpriseCode: 'default', requestTimeoutMs: 1000 } as never}
        navigation={{ label: 'Runtime Configuration' } as never}
        bootstrap={
          {
            moduleConnections: {
              system: [
                {
                  moduleName: 'system',
                  instanceId: 'platform',
                  runtimeRole: { code: 'PLATFORM', publication: 'OPERATIONAL' },
                  endpoint: 'https://platform.example/nodics/system',
                  environment: 'local',
                  state: 'UP',
                },
                {
                  moduleName: 'system',
                  instanceId: 'staged',
                  runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
                  endpoint: 'https://staged.example/nodics/system',
                  environment: 'local',
                  state: 'UP',
                },
              ],
            },
          } as never
        }
      />
    </QueryClientProvider>,
  );
  expect(await screen.findByText('Current: Configured securely')).toBeVisible();
  expect(screen.queryByText('synthetic-never-display')).not.toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('Runtime target'));
  await user.click(screen.getByRole('option', { name: 'WCMS_STAGED / staged' }));
  expect(
    await screen.findByText(/Runtime configuration metadata is incompatible/),
  ).toBeVisible();
  expect(
    screen.getByRole('heading', { name: 'Runtime Configuration', level: 1 }),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: 'Refresh readiness' })).toBeEnabled();
  expect(
    requests.filter(
      (url) => url.includes('staged.example') && url.endsWith('/effective'),
    ),
  ).toHaveLength(0);
  await user.click(screen.getByLabelText('Runtime target'));
  await user.click(screen.getByRole('option', { name: 'PLATFORM / platform' }));
  await waitFor(() =>
    expect(screen.queryByText(/metadata is incompatible/)).not.toBeInTheDocument(),
  );
  expect(await screen.findByText('Current: Configured securely')).toBeVisible();
});
