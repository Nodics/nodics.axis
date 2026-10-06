/** @file Native usage admission, identity replacement and denied-load recovery tests. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopilotUsageRoutePage } from '../../src/assistant/CopilotUsageRoutePage';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';
import { usageFixture } from './governanceFixture';
import { allocationFixture } from './copilotBudgetFixture';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAxisQueryClient } from '../../src/app/axisQueryClient';

const bootstrap = {
  navigation: [
    {
      moduleName: 'copilotApi',
      availability: 'UP',
      featureState: 'ACTIVE',
      backendWorkspace: {
        renderer: 'axis.workspace.native',
        workspaceCode: 'copilot.usage',
        viewCode: 'overview',
      },
    },
  ],
  moduleConnections: {
    copilotApi: [
      {
        moduleName: 'copilotApi',
        instanceId: 'one',
        endpoint: 'http://localhost:4300/copilotApi',
        environment: 'test',
        state: 'UP',
      },
    ],
  },
} as unknown as AxisAuthenticatedBootstrap;
const runtime = {
  enterpriseCode: 'enterprise',
  requestTimeoutMs: 1000,
} as AxisRuntimeConfig;
afterEach(() => vi.unstubAllGlobals());

describe('Copilot usage route', () => {
  it('opens allocations through the authorized usage route and clears them on enterprise changes', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'SUC_TEST', data: usageFixture() })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'SUC_TEST', data: allocationFixture() })),
      )
      .mockImplementationOnce(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetcher);
    const client = createAxisQueryClient();
    const page = (enterpriseCode: string) => (
      <QueryClientProvider client={client}>
        <CopilotUsageRoutePage
          accessToken="token"
          runtime={{ ...runtime, enterpriseCode }}
          bootstrap={bootstrap}
        />
      </QueryClientProvider>
    );
    const view = render(page('enterprise'));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Manage allocations' }),
    );
    await screen.findByRole('heading', { name: 'Token allocations' });
    expect((fetcher.mock.calls[1]![0] as URL).pathname).toBe('/copilotApi/v0/budgets');
    view.rerender(page('other'));
    expect(screen.queryByRole('heading', { name: 'Token allocations' })).toBeNull();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  });
  it('does not fetch hidden, unavailable or wrong-owner navigation', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    for (const patch of [
      { featureState: 'HIDDEN' as const },
      { featureState: 'DISABLED' as const },
      { moduleName: 'other' },
      { availability: 'UNAVAILABLE' as const },
    ]) {
      const view = render(
        <CopilotUsageRoutePage
          accessToken="token"
          runtime={runtime}
          bootstrap={{
            ...bootstrap,
            navigation: [{ ...bootstrap.navigation[0]!, ...patch }],
          }}
        />,
      );
      expect(fetcher).not.toHaveBeenCalled();
      view.unmount();
    }
  });
  it('removes prior usage immediately when the enterprise changes', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'SUC_TEST', data: usageFixture() })),
      )
      .mockImplementationOnce(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetcher);
    const view = render(
      <CopilotUsageRoutePage
        accessToken="token"
        runtime={runtime}
        bootstrap={bootstrap}
      />,
    );
    await screen.findByText('Usage and budgets');
    view.rerender(
      <CopilotUsageRoutePage
        accessToken="token"
        runtime={{ ...runtime, enterpriseCode: 'other' }}
        bootstrap={bootstrap}
      />,
    );
    expect(screen.queryByText('Usage and budgets')).toBeNull();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });
  it('renders denied reads as unavailable and retries only on explicit request', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 403 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'SUC_TEST', data: usageFixture() })),
      );
    vi.stubGlobal('fetch', fetcher);
    render(
      <CopilotUsageRoutePage
        accessToken="token"
        runtime={runtime}
        bootstrap={bootstrap}
      />,
    );
    await screen.findByText('Workspace could not be loaded.');
    expect(fetcher).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('Usage and budgets');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
