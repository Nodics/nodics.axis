/** Business-first header regressions; metadata disclosure never submits or resets the form. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackendOperationsWorkspaceRoutePage } from '../../src/app/BackendOperationsWorkspaceRoutePage';
import type { AxisBackendWorkspace } from '../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';

const runtime: AxisRuntimeConfig = {
  backofficeBaseUrl: 'https://backoffice.example.test',
  enterpriseCode: 'default',
  projectCode: 'nodics.kickoff',
  clientContractVersion: 1,
  requestTimeoutMs: 10_000,
  browserSessionCsrfCookieName: 'nodics_axis_csrf',
  assistantMaximumEventBytes: 65_536,
  assistantReconnectWindowMs: 120_000,
  assistantIdleTimeoutMs: 45_000,
};
const workspace: AxisBackendWorkspace = {
  contractVersion: 0,
  renderer: 'axis.workspace.backend-operations',
  title: 'Enterprise and User Management',
  description: 'Manage enterprises and employees.',
  defaultTab: 'enterprises',
  tabs: [
    {
      id: 'enterprises',
      label: 'Enterprises',
      sections: [
        {
          id: 'create-enterprise',
          type: 'form',
          title: 'Create Enterprise',
          submitLabel: 'Create enterprise',
          endpoint: {
            method: 'POST',
            path: '/nodics/profile/v0/enterprises',
            bodyShape: 'MODEL',
            idempotencyField: 'idempotencyKey',
          },
          fields: [
            { name: 'code', label: 'Enterprise code', type: 'TEXT', required: true },
            {
              name: 'idempotencyKey',
              label: 'Reference',
              type: 'IDEMPOTENCY',
              required: true,
            },
          ],
        },
      ],
    },
  ],
};

function renderWorkspace() {
  const fetchMock = vi.fn().mockRejectedValue(new Error('No request expected'));
  vi.stubGlobal('fetch', fetchMock);
  render(
    <MemoryRouter>
      <BackendOperationsWorkspaceRoutePage
        workspace={workspace}
        runtime={runtime}
        accessToken="test-session"
      />
    </MemoryRouter>,
  );
  return fetchMock;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('workspace metadata disclosure', () => {
  it('leads with the owner business title and keeps implementation identifiers collapsed', () => {
    renderWorkspace();
    const heading = screen.getByRole('heading', { level: 1, name: workspace.title });
    expect(heading).toBeVisible();
    expect(screen.getByText(workspace.description!)).toBeVisible();
    const summary = screen.getByText('Technical details');
    expect(summary.tagName).toBe('SUMMARY');
    const disclosure = summary.closest('details');
    expect(disclosure).not.toHaveAttribute('open');
    expect(
      heading.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const renderer = screen.getByText(workspace.renderer);
    const version = screen.getByText('v0');
    expect(disclosure).toContainElement(renderer);
    expect(disclosure).toContainElement(version);
    expect(renderer).not.toBeVisible();
    expect(version).not.toBeVisible();
  });

  it('reveals retained renderer/version only on expansion and sends no request', async () => {
    const fetchMock = renderWorkspace();
    const user = userEvent.setup();
    const summary = screen.getByText('Technical details');
    await user.click(summary);
    expect(summary.closest('details')).toHaveAttribute('open');
    expect(screen.getByText(workspace.renderer)).toBeVisible();
    expect(screen.getByText('v0')).toBeVisible();
    await user.click(summary);
    expect(summary.closest('details')).not.toHaveAttribute('open');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('provides a native keyboard-focusable summary before the workspace tabs', async () => {
    renderWorkspace();
    await userEvent.tab();
    const summary = screen.getByText('Technical details');
    expect(summary.tagName).toBe('SUMMARY');
    expect(summary).toHaveFocus();
  });

  it('does not reset entered form values or submit when toggling diagnostics', async () => {
    const fetchMock = renderWorkspace();
    const user = userEvent.setup();
    const code = screen.getByRole('textbox', { name: 'Enterprise code' });
    await user.type(code, 'pending-enterprise');
    const summary = screen.getByText('Technical details');
    await user.click(summary);
    await user.click(summary);
    expect(code).toHaveValue('pending-enterprise');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
