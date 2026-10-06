/** @file Verifies navigation admission and snapshot isolation on enterprise changes. */
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopilotWorkspaceRoutePage } from '../../src/assistant/CopilotWorkspaceRoutePage';
import { copilotWorkspaceNavigation } from '../../src/assistant/copilotWorkspaceNavigation';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';
import { workspaceFixture } from './workspaceFixture';

const bootstrap = {
  navigation: [
    {
      id: 'copilot-workspace',
      label: 'Copilot Workspace',
      moduleName: 'copilotApi',
      route: '/copilot',
      availability: 'UP',
      featureState: 'ACTIVE',
      backendWorkspace: {
        renderer: 'axis.workspace.native',
        contractVersion: 1,
        workspaceCode: 'copilot.workspace',
        viewCode: 'overview',
        title: 'Copilot Workspace',
      },
    },
  ],
  moduleConnections: {
    copilotApi: [
      {
        moduleName: 'copilotApi',
        endpoint: 'http://localhost:4300/copilotApi',
        instanceId: 'one',
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

describe('Workspace scope and navigation', () => {
  it('rejects hidden, disabled, wrong-owner and merely matching routes', () => {
    for (const patch of [
      { featureState: 'HIDDEN' },
      { featureState: 'DISABLED' },
      { moduleName: 'other' },
      { backendWorkspace: undefined },
      { availability: 'DOWN' },
    ]) {
      expect(
        copilotWorkspaceNavigation({
          ...bootstrap,
          navigation: [{ ...bootstrap.navigation[0]!, ...patch }],
        } as AxisAuthenticatedBootstrap),
      ).toBeUndefined();
    }
  });
  it('does not fetch an unauthorized main-dashboard summary', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(
      <MemoryRouter>
        <CopilotWorkspaceRoutePage
          accessToken="token"
          bootstrap={{ ...bootstrap, navigation: [] }}
          runtime={runtime}
          compact
        />
      </MemoryRouter>,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('removes the old enterprise snapshot immediately', async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'SUC_SYS_00000', data: workspaceFixture() })),
    );
    fetcher.mockImplementationOnce(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetcher);
    const { rerender } = render(
      <MemoryRouter>
        <CopilotWorkspaceRoutePage
          accessToken="token"
          bootstrap={bootstrap}
          runtime={runtime}
        />
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: 'Resume: Review collection centres' });
    rerender(
      <MemoryRouter>
        <CopilotWorkspaceRoutePage
          accessToken="new-token"
          bootstrap={bootstrap}
          runtime={{ ...runtime, enterpriseCode: 'another-enterprise' }}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Review collection centres')).toBeNull();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });
  it('ignores a delayed response from an obsolete enterprise request', async () => {
    let completeOld!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          completeOld = resolve;
        }),
    );
    const next = workspaceFixture();
    next.context.enterpriseCode = 'another-enterprise';
    next.activity.conversations[0]!.title = 'Current enterprise conversation';
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'SUC_SYS_00000', data: next })),
    );
    vi.stubGlobal('fetch', fetcher);
    const { rerender } = render(
      <MemoryRouter>
        <CopilotWorkspaceRoutePage
          accessToken="token"
          bootstrap={bootstrap}
          runtime={runtime}
        />
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    rerender(
      <MemoryRouter>
        <CopilotWorkspaceRoutePage
          accessToken="new-token"
          bootstrap={bootstrap}
          runtime={{ ...runtime, enterpriseCode: 'another-enterprise' }}
        />
      </MemoryRouter>,
    );
    await screen.findByRole('button', {
      name: 'Resume: Current enterprise conversation',
    });
    await act(async () => {
      completeOld(
        new Response(
          JSON.stringify({ code: 'SUC_SYS_00000', data: workspaceFixture() }),
        ),
      );
      await Promise.resolve();
    });
    expect(screen.queryByText('Review collection centres')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Resume: Current enterprise conversation' }),
    ).toBeVisible();
  });
});
