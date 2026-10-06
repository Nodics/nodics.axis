/** @file Exercises the usable Workspace and compact main-dashboard summary without invented data. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CopilotWorkspaceView } from '../../src/assistant/CopilotWorkspaceView';
import { parseCopilotWorkspace } from '../../src/assistant/api/copilotWorkspaceClient';
import { workspaceFixture } from './workspaceFixture';

describe('Copilot workspace view', () => {
  it('distinguishes planned operations without offering execution controls', () => {
    render(
      <CopilotWorkspaceView
        snapshot={parseCopilotWorkspace(workspaceFixture())}
        refreshing={false}
        onRefresh={vi.fn()}
        onDetails={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Operation catalogue' })).toBeVisible();
    expect(screen.getByText('Planned')).toBeVisible();
    expect(screen.getByText('Approval required')).toBeVisible();
    expect(screen.queryByRole('button', { name: /execute/i })).toBeNull();
  });
  it('retains unknown outcomes and supports keyboard refresh', async () => {
    const input = workspaceFixture();
    input.activity.turns[0]!.state = 'OUTCOME_UNKNOWN';
    const refresh = vi.fn();
    render(
      <CopilotWorkspaceView
        snapshot={parseCopilotWorkspace(input)}
        refreshing={false}
        onRefresh={refresh}
        onDetails={vi.fn()}
      />,
    );
    expect(screen.getByText('stateUnknown: 1')).toBeVisible();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'refresh' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(refresh).toHaveBeenCalledOnce();
    for (const bar of screen.getAllByRole('progressbar')) {
      expect(bar).toHaveAttribute('aria-valuenow', '0');
    }
  });
  it('opens existing conversations and starts a new one as separate actions', async () => {
    const action = vi.fn();
    render(
      <CopilotWorkspaceView
        snapshot={parseCopilotWorkspace(workspaceFixture())}
        refreshing={false}
        onRefresh={vi.fn()}
        onDetails={vi.fn()}
        onConversation={action}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Resume: Review collection centres' }),
    );
    expect(action).toHaveBeenLastCalledWith('conversation-1');
    await userEvent.click(screen.getByRole('button', { name: 'New conversation' }));
    expect(action).toHaveBeenLastCalledWith();
    expect(screen.getByText('Unavailable')).toBeVisible();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search conversations' }),
      'unmatched',
    );
    expect(screen.getByText('No conversations')).toBeVisible();
  });
  it('compact Details opens Workspace, not Conversation', async () => {
    const details = vi.fn();
    const conversation = vi.fn();
    render(
      <CopilotWorkspaceView
        snapshot={parseCopilotWorkspace(workspaceFixture())}
        compact
        refreshing={false}
        onRefresh={vi.fn()}
        onDetails={details}
        onConversation={conversation}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(details).toHaveBeenCalledOnce();
    expect(conversation).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'New conversation' })).toBeNull();
  });
  it('does not offer start without backend permission', () => {
    const input = workspaceFixture();
    input.actions.canStartConversation = false;
    render(
      <CopilotWorkspaceView
        snapshot={parseCopilotWorkspace(input)}
        refreshing={false}
        onRefresh={vi.fn()}
        onDetails={vi.fn()}
        onConversation={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'New conversation' })).toBeNull();
  });
});
