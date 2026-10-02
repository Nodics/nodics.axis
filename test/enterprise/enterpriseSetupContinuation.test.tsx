/** Injected owner contract/UI regressions; no routes, credentials, runtime or live creation. */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  EnterpriseSetupContinuation,
  type EnterpriseSetupPresentation,
} from '../../src/operations/enterprise/EnterpriseSetupContinuation';
import {
  inspectEnterpriseSetup,
  parseEnterpriseSetupSnapshot,
  resumeEnterpriseSetup,
  type EnterpriseSetupSnapshot,
} from '../../src/operations/enterprise/api/enterpriseSetupClient';

const snapshot: EnterpriseSetupSnapshot = {
  contractVersion: 1,
  enterprise: {
    code: 'business',
    name: 'Example Repair',
    tenantCode: 'private-tenant',
  },
  administrator: { email: 'admin@axis-onboarding-acceptance.test', status: 'PENDING' },
  setup: {
    revision: 4,
    state: 'RESUMABLE',
    canResume: true,
    reasonCodes: ['ADMIN_PENDING'],
  },
};
const complete: EnterpriseSetupSnapshot = {
  ...snapshot,
  setup: { revision: 5, state: 'COMPLETE', canResume: false, reasonCodes: [] },
};
const presentation: EnterpriseSetupPresentation = {
  title: 'Enterprise setup',
  enterpriseLabel: 'Enterprise',
  administratorLabel: 'Administrator',
  statusLabel: 'Status',
  inspectLabel: 'Inspect setup',
  resumeLabel: 'Resume setup',
  reviewTitle: 'Review continuation',
  confirmLabel: 'Confirm continuation',
  cancelLabel: 'Cancel',
  workingLabel: 'Working',
  unavailableMessage: 'Setup details are unavailable.',
  uncertainMessage: 'Outcome unconfirmed. Inspect again.',
  states: {
    HELD: 'Needs attention',
    RESUMABLE: 'Ready to continue',
    COMPLETE: 'Setup complete',
  },
  administratorStatuses: { PENDING: 'Administrator setup pending' },
  reasons: { ADMIN_PENDING: 'Administrator setup needs completion.' },
};

async function inspected(value = snapshot) {
  const owner = {
    inspect: vi.fn().mockResolvedValue(value),
    resume: vi.fn().mockResolvedValue(complete),
  };
  const view = render(
    <EnterpriseSetupContinuation owner={owner} presentation={presentation} />,
  );
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: 'Enterprise' }), 'business');
  await user.click(screen.getByRole('button', { name: 'Inspect setup' }));
  await screen.findByRole('heading', { name: 'Example Repair' });
  return { owner, user, view };
}

describe('Profile setup snapshot consumer', () => {
  it('projects only public fields and drops private original command material', () => {
    const value = parseEnterpriseSetupSnapshot({
      ...snapshot,
      originalRequestKey: 'secret',
      actor: 'private',
      setup: { ...snapshot.setup, request: { password: 'secret' } },
    });
    expect(value).toEqual(snapshot);
    expect(JSON.stringify(value)).not.toContain('secret');
  });

  it.each([
    { ...snapshot, contractVersion: 2 },
    { ...snapshot, setup: { ...snapshot.setup, state: 'UNKNOWN' } },
    { ...snapshot, setup: { ...snapshot.setup, state: 'HELD' } },
    { ...snapshot, setup: { ...snapshot.setup, state: 'COMPLETE' } },
    { ...snapshot, setup: { ...snapshot.setup, revision: '4' } },
    { ...snapshot, setup: { ...snapshot.setup, revision: -1 } },
    { ...snapshot, setup: { ...snapshot.setup, canResume: 'true' } },
    { ...snapshot, setup: { ...snapshot.setup, reasonCodes: ['DUP', 'DUP'] } },
    { ...snapshot, administrator: { ...snapshot.administrator, email: null } },
  ])('rejects malformed or contradictory owner projections %#', (value) => {
    expect(() => parseEnterpriseSetupSnapshot(value)).toThrow();
  });

  it('rejects a different target and does not invent a missing resume command', async () => {
    const owner = { inspect: vi.fn().mockResolvedValue(snapshot) };
    await expect(inspectEnterpriseSetup(owner, 'other')).rejects.toThrow('target');
    await expect(resumeEnterpriseSetup(owner, snapshot)).rejects.toThrow('unavailable');
  });
});

describe('explicit setup continuation UI', () => {
  it('renders business copy without tenant identity, operation IDs or raw reason codes', async () => {
    await inspected();
    expect(screen.getByText('Administrator setup needs completion.')).toBeVisible();
    expect(screen.getByText(/Administrator setup pending/)).toBeVisible();
    expect(screen.queryByText('ADMIN_PENDING')).not.toBeInTheDocument();
    expect(screen.queryByText('private-tenant')).not.toBeInTheDocument();
  });

  it.each(['HELD', 'COMPLETE'] as const)(
    'keeps %s non-actionable and unknown reasons content-free',
    async (state) => {
      await inspected({
        ...snapshot,
        setup: {
          ...snapshot.setup,
          state,
          canResume: false,
          reasonCodes: ['PRIVATE_REASON'],
        },
      });
      expect(
        screen.queryByRole('button', { name: 'Resume setup' }),
      ).not.toBeInTheDocument();
      expect(screen.getByText('Setup details are unavailable.')).toBeVisible();
      expect(screen.queryByText('PRIVATE_REASON')).not.toBeInTheDocument();
    },
  );

  it('requires review, supports cancellation, sends only reviewed revision and reinspects after success', async () => {
    const { owner, user } = await inspected();
    await user.click(screen.getByRole('button', { name: 'Resume setup' }));
    expect(owner.resume).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(owner.resume).not.toHaveBeenCalled();
    owner.inspect.mockResolvedValue(complete);
    await user.click(await screen.findByRole('button', { name: 'Resume setup' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Confirm continuation',
      }),
    );
    await screen.findByText('Status: Setup complete');
    expect(owner.resume).toHaveBeenCalledExactlyOnceWith('business', {
      expectedRevision: 4,
    });
    expect(owner.inspect).toHaveBeenCalledTimes(2);
  });

  it('does not duplicate a pending command and requires explicit reinspection after uncertainty', async () => {
    const { owner, user } = await inspected();
    let reject!: (reason: Error) => void;
    owner.resume.mockReturnValue(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Resume setup' }));
    const confirm = within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Confirm continuation',
    });
    await user.dblClick(confirm);
    expect(owner.resume).toHaveBeenCalledTimes(1);
    reject(new Error('private provider detail'));
    await screen.findByText('Outcome unconfirmed. Inspect again.');
    expect(
      screen.queryByRole('button', { name: 'Resume setup' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('private provider detail')).not.toBeInTheDocument();
    expect(owner.inspect).toHaveBeenCalledTimes(1);
    await user.click(await screen.findByRole('button', { name: 'Inspect setup' }));
    await screen.findByRole('button', { name: 'Resume setup' });
    expect(owner.resume).toHaveBeenCalledTimes(1);
    expect(owner.inspect).toHaveBeenCalledTimes(2);
  });

  it('never interprets prototype names as configured reason copy', async () => {
    await inspected({
      ...snapshot,
      setup: {
        ...snapshot.setup,
        state: 'HELD',
        canResume: false,
        reasonCodes: ['toString'],
      },
    });
    expect(screen.getByText('Setup details are unavailable.')).toBeVisible();
  });

  it('does not offer continuation without a discovered command despite an eligible snapshot', async () => {
    const owner = { inspect: vi.fn().mockResolvedValue(snapshot) };
    render(<EnterpriseSetupContinuation owner={owner} presentation={presentation} />);
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Enterprise' }),
      'business',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Inspect setup' }));
    await screen.findByRole('heading', { name: 'Example Repair' });
    expect(
      screen.queryByRole('button', { name: 'Resume setup' }),
    ).not.toBeInTheDocument();
  });

  it('discards late inspection from a replaced authorized adapter', async () => {
    let resolve!: (value: EnterpriseSetupSnapshot) => void;
    const original = {
      inspect: vi.fn().mockReturnValue(
        new Promise((done) => {
          resolve = done;
        }),
      ),
    };
    const replacement = { inspect: vi.fn().mockResolvedValue(complete) };
    const view = render(
      <EnterpriseSetupContinuation owner={original} presentation={presentation} />,
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Enterprise' }),
      'business',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Inspect setup' }));
    view.rerender(
      <EnterpriseSetupContinuation owner={replacement} presentation={presentation} />,
    );
    resolve(snapshot);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Inspect setup' })).toBeEnabled(),
    );
    expect(
      screen.queryByRole('heading', { name: 'Example Repair' }),
    ).not.toBeInTheDocument();
    expect(replacement.inspect).not.toHaveBeenCalled();
  });
});
