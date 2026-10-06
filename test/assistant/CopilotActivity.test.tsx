/** @file Tests activity contract minimization, business filtering and native route isolation. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopilotActivityView } from '../../src/assistant/CopilotActivityView';
import { CopilotActivityRoutePage } from '../../src/assistant/CopilotActivityRoutePage';
import {
  createCopilotActivityClient,
  parseCopilotActivity,
} from '../../src/assistant/api/copilotActivityClient';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';
import { copilotActivityFixture } from './copilotActivityFixture';

const bootstrap = {
  navigation: [
    {
      moduleName: 'copilotApi',
      availability: 'UP',
      featureState: 'ACTIVE',
      backendWorkspace: {
        renderer: 'axis.workspace.native',
        workspaceCode: 'copilot.activity',
        viewCode: 'conversations',
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

describe('Copilot activity', () => {
  it('submits exact metadata and local date inputs as UTC filters', async () => {
    const filter = vi.fn();
    render(
      <CopilotActivityView
        activity={parseCopilotActivity(copilotActivityFixture())}
        principal=""
        onFilter={filter}
        onPage={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Conversation' }),
      'conversation-1',
    );
    await userEvent.type(screen.getByRole('textbox', { name: 'State' }), 'ACTIVE');
    fireEvent.change(screen.getByLabelText('Updated from'), {
      target: { value: '2026-10-02T09:30' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Apply filter' }));
    expect(filter).toHaveBeenCalledWith('', {
      conversationCode: 'conversation-1',
      state: 'ACTIVE',
      updatedFrom: new Date('2026-10-02T09:30').toISOString(),
    });
  });
  it('rejects backend rows that do not match the requested metadata filters', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ code: 'SUC_TEST', data: copilotActivityFixture() }),
          ),
        ),
      );
    const client = createCopilotActivityClient(
      {
        accessToken: 'token',
        enterpriseCode: 'enterprise',
        moduleBaseUrl: 'http://localhost:4300/copilotApi',
        timeoutMs: 1000,
      },
      fetcher,
    );
    for (const filters of [
      { conversationCode: 'other' },
      { state: 'CLOSED' },
      { updatedFrom: '2026-10-04T00:00:00Z' },
      { updatedTo: '2026-10-01T00:00:00Z' },
    ])
      await expect(client.list(1, '', undefined, filters)).rejects.toThrow(
        'context mismatch',
      );
    await expect(client.list(1, 'other')).rejects.toThrow('context mismatch');
    await expect(
      client.list(1, '', undefined, { state: 'ACTIVE' }),
    ).resolves.toHaveProperty('page', 1);
    const address = fetcher.mock.calls.at(-1)?.[0];
    expect(address instanceof URL ? address.search : address).toContain('state=ACTIVE');
  });
  it('projects only metadata and rejects oversized pages or transcript contracts', () => {
    const input = copilotActivityFixture();
    expect(
      JSON.stringify(
        parseCopilotActivity({
          ...input,
          items: [{ ...input.items[0], messages: ['secret'], title: 'private' }],
        }),
      ),
    ).not.toMatch(/secret|private/);
    expect(() => parseCopilotActivity({ ...input, transcriptAccess: true })).toThrow();
    expect(() =>
      parseCopilotActivity({ ...input, items: Array(26).fill(input.items[0]) }),
    ).toThrow();
  });
  it('supports exact employee filtering and bounded paging without transcript links', async () => {
    const filter = vi.fn();
    render(
      <CopilotActivityView
        activity={parseCopilotActivity(copilotActivityFixture())}
        principal=""
        onFilter={filter}
        onPage={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Employee identifier' }),
      'employee-two',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Apply filter' }));
    expect(filter).toHaveBeenCalledWith('employee-two', {});
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.queryByRole('link')).toBeNull();
  });
  it('does not fetch unavailable or wrong-owner activity routes', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    for (const patch of [
      { featureState: 'HIDDEN' as const },
      { moduleName: 'other' },
      { availability: 'UNAVAILABLE' as const },
    ]) {
      const view = render(
        <CopilotActivityRoutePage
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
  it('removes old enterprise activity immediately during context switching', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: 'SUC_SYS_00000', data: copilotActivityFixture() }),
        ),
      )
      .mockImplementationOnce(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetcher);
    const view = render(
      <CopilotActivityRoutePage
        accessToken="token"
        runtime={runtime}
        bootstrap={bootstrap}
      />,
    );
    await screen.findByText('employee-one');
    view.rerender(
      <CopilotActivityRoutePage
        accessToken="token"
        runtime={{ ...runtime, enterpriseCode: 'other' }}
        bootstrap={bootstrap}
      />,
    );
    expect(screen.queryByText('employee-one')).toBeNull();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });
});
