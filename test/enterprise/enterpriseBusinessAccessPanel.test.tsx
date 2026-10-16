/** Employee access rendering with the real client and HTTP doubles, not live runtime acceptance. */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { EnterpriseBusinessAccessPanel } from '../../src/operations/enterprise/EnterpriseBusinessAccessPanel';
import { BackendOperationsWorkspaceRoutePage } from '../../src/app/BackendOperationsWorkspaceRoutePage';
import { parseBackendWorkspace } from '../../src/bootstrap/publicBootstrap';
import type { EnterpriseBusinessAccessCommand } from '../../src/operations/enterprise/api/enterpriseBusinessAccessClient';
import {
  businessAccessConfiguration as configuration,
  businessAccessWorkspace as workspace,
  businessAccessRequestUrl,
} from './enterpriseBusinessAccessFixtures';
import { runtime } from './registrationFixtures';

const presentation = workspace.businessAccess.presentation;
afterEach(() => vi.unstubAllGlobals());

/** Records requests across inspections while controlling only the independent owner fixture. */
function fixture(
  options: {
    uncertain?: boolean;
    pending?: boolean;
    disabled?: boolean;
    changedFingerprint?: boolean;
  } = {},
) {
  let complete: ((value: Response) => void) | undefined;
  let inspections = 0;
  const request = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
    if (init?.method === 'POST') {
      if (options.pending)
        return new Promise<Response>((resolve) => {
          complete = resolve;
        });
      if (options.uncertain) return Promise.reject(new Error('Delivery unknown'));
      return Promise.resolve(
        Response.json({ data: { employeeCode: 'alex', changed: true } }),
      );
    }
    inspections++;
    return Promise.resolve(
      Response.json({
        data: {
          ...workspace,
          employees: workspace.employees.map((employee) => ({
            ...employee,
            reviewFingerprint:
              inspections > 1 && options.changedFingerprint
                ? 'b'.repeat(64)
                : employee.reviewFingerprint,
          })),
        },
      }),
    );
  });
  vi.stubGlobal('fetch', request);
  const onCommitted = vi.fn(),
    onHeldChange = vi.fn();
  const props = {
    configuration,
    presentation,
    onCommitted,
    onHeldChange,
    disabled: options.disabled || false,
  };
  const view = render(<EnterpriseBusinessAccessPanel {...props} />);
  return {
    request,
    view,
    props,
    onCommitted,
    onHeldChange,
    user: userEvent.setup(),
    mutations: () => request.mock.calls.filter(([, init]) => init?.method === 'POST'),
    complete: () => {
      if (!complete) throw new Error('No pending command');
      complete(Response.json({ employeeCode: 'alex', changed: true }));
    },
  };
}

/** Changes one visible area, leaving the other owner selections untouched. */
async function choose(
  user: ReturnType<typeof userEvent.setup>,
  area: string,
  value: string,
) {
  await user.click(screen.getByRole('combobox', { name: `${area}: Access level` }));
  await user.click(screen.getByRole('option', { name: value }));
}

it('reviews one employee and batches only changed areas while preserving advanced authority visibly', async () => {
  const task = fixture();
  expect(await screen.findByText('customReviewerGroup')).not.toBeVisible();
  await task.user.click(
    screen.getByRole('button', { name: 'alex@example.test: Access level' }),
  );
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('Advanced access')).toBeVisible();
  expect(
    within(dialog).getByText(workspace.businessAccess.presentation.advancedMessage),
  ).toBeVisible();
  expect(within(dialog).getByRole('button', { name: 'Review changes' })).toBeDisabled();
  await choose(task.user, 'Products', 'No access');
  await choose(task.user, 'Content', 'Edit');
  expect(
    screen.getByRole('combobox', { name: 'Waste: Access level' }),
  ).toHaveTextContent('Edit');
  await task.user.click(screen.getByRole('button', { name: 'Review changes' }));
  expect(task.mutations()).toHaveLength(0);
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(within(dialog).getByText('Products')).toBeVisible();
  expect(within(dialog).queryByText('Waste')).toBeNull();
  await task.user.click(screen.getByRole('button', { name: 'Confirm' }));
  await screen.findByText('Changes confirmed.');
  expect(task.mutations()).toHaveLength(1);
  const body = JSON.parse(
    task.mutations()[0]![1]!.body as string,
  ) as EnterpriseBusinessAccessCommand;
  expect(body.operationId).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
  expect(body).toEqual({
    employeeCode: 'alex',
    reviewFingerprint: 'a'.repeat(64),
    operationId: body.operationId,
    changes: [
      { businessArea: 'products', accessLevel: 'noAccess' },
      { businessArea: 'content', accessLevel: 'edit' },
    ],
  });
  await waitFor(() => expect(task.onCommitted).toHaveBeenCalledTimes(1));
  expect(screen.queryByText('products_view')).toBeNull();
});

it('keeps group codes closed by default in both row and editor while retaining a visible warning and inspectable details', async () => {
  const task = fixture();
  const group = await screen.findByText('customReviewerGroup');
  expect(group).not.toBeVisible();
  expect(group.closest('details')).not.toHaveAttribute('open');
  expect(
    screen.getByText(workspace.businessAccess.presentation.advancedMessage),
  ).toBeVisible();
  await task.user.click(screen.getByText('Advanced access'));
  expect(group).toBeVisible();
  await task.user.click(
    screen.getByRole('button', { name: 'alex@example.test: Access level' }),
  );
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('customReviewerGroup')).not.toBeVisible();
  expect(
    dialog.getByText(workspace.businessAccess.presentation.advancedMessage),
  ).toBeVisible();
  await task.user.click(dialog.getByText('Advanced access'));
  expect(dialog.getByText('customReviewerGroup')).toBeVisible();
  expect(task.mutations()).toHaveLength(0);
});

it('retains uncertain changes and retries only the exact command after explicit inspection', async () => {
  const task = fixture({ uncertain: true });
  await task.user.click(
    await screen.findByRole('button', { name: 'alex@example.test: Access level' }),
  );
  await choose(task.user, 'Products', 'No access');
  await task.user.click(screen.getByRole('button', { name: 'Review changes' }));
  await task.user.click(screen.getByRole('button', { name: 'Confirm' }));
  await screen.findByText(presentation.uncertainMessage);
  expect(task.mutations()).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Retry reviewed changes' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(within(screen.getByRole('dialog')).getByText('No access')).toBeVisible();
  await task.user.click(screen.getByRole('button', { name: 'Inspect' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Retry reviewed changes' }),
    ).toBeEnabled(),
  );
  expect(task.mutations()).toHaveLength(1);
  await task.user.click(screen.getByRole('button', { name: 'Retry reviewed changes' }));
  await waitFor(() => expect(task.mutations()).toHaveLength(2));
  expect(task.mutations()[1]![1]!.body).toBe(task.mutations()[0]![1]!.body);
  expect(
    (
      JSON.parse(
        task.mutations()[1]![1]!.body as string,
      ) as EnterpriseBusinessAccessCommand
    ).reviewFingerprint,
  ).toBe('a'.repeat(64));
  expect(task.onCommitted).not.toHaveBeenCalled();
});

it('cancel and read-only Team fences produce no writes', async () => {
  const task = fixture();
  await task.user.click(
    await screen.findByRole('button', { name: 'alex@example.test: Access level' }),
  );
  await choose(task.user, 'Products', 'Full control');
  await task.user.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(task.mutations()).toHaveLength(0);
  task.view.rerender(<EnterpriseBusinessAccessPanel {...task.props} disabled />);
  expect(
    screen.getByRole('button', { name: 'alex@example.test: Access level' }),
  ).toBeDisabled();
});

it('a changed fingerprint disables replay without rebasing the held command or claiming success', async () => {
  const task = fixture({ uncertain: true, changedFingerprint: true });
  await task.user.click(
    await screen.findByRole('button', { name: 'alex@example.test: Access level' }),
  );
  await choose(task.user, 'Products', 'No access');
  await task.user.click(screen.getByRole('button', { name: 'Review changes' }));
  await task.user.click(screen.getByRole('button', { name: 'Confirm' }));
  await screen.findByText(presentation.uncertainMessage);
  await task.user.click(screen.getByRole('button', { name: 'Inspect' }));
  await screen.findByRole('button', { name: 'Cancel' });
  expect(screen.getByRole('button', { name: 'Retry reviewed changes' })).toBeDisabled();
  expect(within(screen.getByRole('dialog')).getByText('No access')).toBeVisible();
  expect(task.mutations()).toHaveLength(1);
  expect(task.onCommitted).not.toHaveBeenCalled();
  await task.user.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.queryByText('Changes confirmed.')).toBeNull();
});

it('discards late acknowledgements and held drafts when the authenticated context changes', async () => {
  const task = fixture({ pending: true });
  await task.user.click(
    await screen.findByRole('button', { name: 'alex@example.test: Access level' }),
  );
  await choose(task.user, 'Products', 'Edit');
  await task.user.click(screen.getByRole('button', { name: 'Review changes' }));
  await task.user.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(task.mutations()).toHaveLength(1);
  task.view.rerender(
    <EnterpriseBusinessAccessPanel
      {...task.props}
      configuration={{ ...configuration, accessToken: 'new-employee-token' }}
    />,
  );
  await act(async () => {
    task.complete();
    await Promise.resolve();
  });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.queryByText('Changes confirmed.')).toBeNull();
  expect(task.onCommitted).not.toHaveBeenCalled();
  expect(task.mutations()).toHaveLength(1);
});

it('mounts in ordinary administration and edits native employees without Team or membership qualification', async () => {
  const employee = { ...workspace.employees[0]!, assignmentCode: undefined };
  const request = vi.fn<typeof fetch>().mockImplementation((url, init) => {
    expect(businessAccessRequestUrl(url)).toBe(
      'https://profile.example.test/nodics/profile/v0/enterprise-team/business-access',
    );
    return Promise.resolve(
      Response.json({
        data:
          init?.method === 'POST'
            ? { employeeCode: 'alex', changed: true }
            : { ...workspace, employees: [employee] },
      }),
    );
  });
  vi.stubGlobal('fetch', request);
  const user = userEvent.setup();
  render(
    <BackendOperationsWorkspaceRoutePage
      bootstrap={configuration.bootstrap}
      accessToken={configuration.accessToken}
      runtime={{ ...runtime, enterpriseCode: 'business' }}
      connection={configuration.bootstrap.moduleConnections.profile![0]}
      workspace={parseBackendWorkspace({
        contractVersion: 1,
        renderer: 'axis.workspace.backend-operations',
        title: 'Enterprise administration',
        businessAccess: workspace.businessAccess,
        tabs: [],
      })}
    />,
  );
  await user.click(
    await screen.findByRole('button', { name: 'alex@example.test: Access level' }),
  );
  expect(
    screen.queryByText('Backend workspace has no renderable sections.'),
  ).toBeNull();
  await choose(user, 'Products', 'No access');
  await user.click(screen.getByRole('button', { name: 'Review changes' }));
  await user.click(screen.getByRole('button', { name: 'Confirm' }));
  await screen.findByText('Changes confirmed.');
  expect(request.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(
    1,
  );
  expect(
    request.mock.calls.some(([url]) =>
      businessAccessRequestUrl(url).endsWith('/enterprise-team/workspace'),
    ),
  ).toBe(false);
});

it('does not mount the employee editor in public mode or without an admitted Profile connection', () => {
  const request = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', request);
  const value = parseBackendWorkspace({
    contractVersion: 1,
    renderer: 'axis.workspace.backend-operations',
    title: 'Enterprise administration',
    businessAccess: workspace.businessAccess,
    tabs: [],
  });
  const props = {
    bootstrap: configuration.bootstrap,
    accessToken: configuration.accessToken,
    runtime,
    workspace: value,
  };
  const view = render(
    <BackendOperationsWorkspaceRoutePage
      {...props}
      mode="public"
      connection={configuration.bootstrap.moduleConnections.profile![0]}
    />,
  );
  expect(request).not.toHaveBeenCalled();
  view.rerender(<BackendOperationsWorkspaceRoutePage {...props} />);
  expect(request).not.toHaveBeenCalled();
});
