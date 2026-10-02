/** Profile recovery UI with the real typed client and HTTP doubles; not live browser acceptance. */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import { EnterpriseRecoveryRoutePage } from '../../src/operations/enterprise/EnterpriseRecoveryRoutePage';
import { runtime } from './registrationFixtures';

vi.mock('../../src/bootstrap/publicBootstrap', () => ({
  selectModuleConnection: vi.fn(() => ({ endpoint: 'https://profile.example.test' })),
}));

const bootstrap = {} as AxisAuthenticatedBootstrap;
const workspace = {
  contractVersion: 1,
  owner: 'profile',
  enterpriseCode: 'business',
  operation: {
    id: 'withdraw_operation_123456',
    phase: 'PENDING',
    teamRevision: 7,
    recoverable: true,
    actor: 'private-actor',
    input: { assignmentCode: 'private-assignment' },
  },
  presentation: {
    title: 'Team operation recovery',
    inspectLabel: 'Inspect',
    reviewTitle: 'Review committed operation',
    confirmLabel: 'Reconcile committed operation',
    cancelLabel: 'Cancel',
    unavailableMessage: 'No committed operation is eligible.',
    uncertainMessage: 'Inspect again before another command.',
  },
};
const withdrawn = {
  code: 'unused-invitation',
  revision: 5,
  enterpriseCode: 'business',
  enterpriseName: 'Business',
  responsibility: 'Operator',
  status: 'REVOKED',
  accepted: false,
};

/** Resolves the standard fetch input without reading or stringifying request bodies. */
function requestUrl(input: Parameters<typeof fetch>[0]): string {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}

/** Records actual client requests while keeping authentication and persistence as explicit fixtures. */
function mount(
  options: { recoverable?: boolean; outcome?: unknown; pending?: boolean } = {},
) {
  let complete: ((value: Response) => void) | undefined;
  let inspections = 0;
  const request = vi.fn<typeof fetch>().mockImplementation((input) => {
    const url = requestUrl(input);
    if (url.endsWith('/recovery-workspace')) {
      inspections++;
      return Promise.resolve(
        Response.json({
          data: {
            ...workspace,
            operation: {
              ...workspace.operation,
              phase: inspections > 1 ? 'COMPLETE' : 'PENDING',
              recoverable: inspections > 1 ? false : (options.recoverable ?? true),
            },
          },
        }),
      );
    }
    if (url.endsWith('/reconcile-committed')) {
      if (options.pending)
        return new Promise<Response>((resolve) => {
          complete = resolve;
        });
      return Promise.resolve(Response.json({ data: options.outcome ?? withdrawn }));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
  vi.stubGlobal('fetch', request);
  const props = { bootstrap, accessToken: 'fixture-token', runtime, title: 'Recovery' };
  const view = render(<EnterpriseRecoveryRoutePage {...props} />);
  return {
    view,
    props,
    request,
    user: userEvent.setup(),
    mutations: () =>
      request.mock.calls.filter(([input]) =>
        requestUrl(input).endsWith('/reconcile-committed'),
      ),
    complete: (value: unknown) => {
      if (!complete) throw new Error('No command is pending');
      complete(Response.json({ data: value }));
    },
  };
}

/** Inspects through the rendered form and opens its explicit review dialog. */
async function review(fixture: ReturnType<typeof mount>) {
  await fixture.user.type(
    screen.getByRole('textbox', { name: 'Enterprise' }),
    'business',
  );
  await fixture.user.click(screen.getByRole('button', { name: 'Inspect' }));
  await fixture.user.click(
    await screen.findByRole('button', { name: 'Reconcile committed operation' }),
  );
  return screen.getByRole('dialog');
}

afterEach(() => vi.unstubAllGlobals());

it('reviews exact committed withdrawal evidence, submits once and reinspects without a second mutation', async () => {
  const fixture = mount();
  const dialog = await review(fixture);
  expect(fixture.mutations()).toHaveLength(0);
  expect(screen.queryByText('private-actor')).toBeNull();
  expect(screen.queryByText('private-assignment')).toBeNull();
  await fixture.user.click(
    within(dialog).getByRole('button', { name: 'Reconcile committed operation' }),
  );
  await screen.findByText(workspace.presentation.unavailableMessage);
  expect(fixture.mutations()).toHaveLength(1);
  const [url, options] = fixture.mutations()[0]!;
  expect(requestUrl(url)).toBe(
    'https://profile.example.test/v0/enterprise-team/reconcile-committed',
  );
  if (typeof options?.body !== 'string')
    throw new Error('Expected a JSON command body');
  expect(JSON.parse(options.body)).toEqual({
    enterpriseCode: 'business',
    teamRevision: 7,
    operationId: workspace.operation.id,
  });
  expect(options).toMatchObject({
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      Authorization: 'Bearer fixture-token',
      'x-enterprise-code': runtime.enterpriseCode,
    },
  });
  expect(
    fixture.request.mock.calls.filter(([input]) =>
      requestUrl(input).endsWith('/recovery-workspace'),
    ),
  ).toHaveLength(2);
});

it.each([
  { count: 1 },
  { ...withdrawn, enterpriseCode: 'another-business' },
  { code: 'ERR_PROFILE_TEAM_CONFLICT', data: withdrawn },
])(
  'clears executable review after unconfirmed acknowledgement without automatic replay',
  async (outcome) => {
    const fixture = mount({ outcome });
    const dialog = await review(fixture);
    await fixture.user.click(
      within(dialog).getByRole('button', { name: 'Reconcile committed operation' }),
    );
    await screen.findByText(workspace.presentation.uncertainMessage);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      screen.queryByRole('button', { name: 'Reconcile committed operation' }),
    ).toBeNull();
    expect(fixture.mutations()).toHaveLength(1);
    expect(fixture.request).toHaveBeenCalledTimes(2);
  },
);

it('does not offer recovery for an uncommitted or unqualified owner operation', async () => {
  const fixture = mount({ recoverable: false });
  await fixture.user.type(
    screen.getByRole('textbox', { name: 'Enterprise' }),
    'business',
  );
  await fixture.user.click(screen.getByRole('button', { name: 'Inspect' }));
  await screen.findByText(workspace.presentation.unavailableMessage);
  expect(
    screen.queryByRole('button', { name: 'Reconcile committed operation' }),
  ).toBeNull();
  expect(fixture.mutations()).toHaveLength(0);
});

it('discards a late reconciliation result after employee context changes', async () => {
  const fixture = mount({ pending: true });
  const dialog = await review(fixture);
  await fixture.user.click(
    within(dialog).getByRole('button', { name: 'Reconcile committed operation' }),
  );
  await waitFor(() => expect(fixture.mutations()).toHaveLength(1));
  fixture.view.rerender(
    <EnterpriseRecoveryRoutePage
      {...fixture.props}
      accessToken="other-fixture-token"
    />,
  );
  await act(async () => {
    fixture.complete(withdrawn);
    await Promise.resolve();
  });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.queryByText(workspace.presentation.unavailableMessage)).toBeNull();
  expect(fixture.request).toHaveBeenCalledTimes(2);
});
