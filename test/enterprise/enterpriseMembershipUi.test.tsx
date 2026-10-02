/** Rendered own-person review and uncertain acceptance fixtures. Owner transport is mocked; execution is deferred. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import { EnterpriseMembershipRoutePage } from '../../src/operations/enterprise/EnterpriseMembershipRoutePage';
import {
  acceptEnterpriseMembership,
  loadEnterpriseMembershipWorkspace,
  parseEnterpriseMembershipWorkspace,
} from '../../src/operations/enterprise/api/enterpriseMembershipClient';
import { runtime } from './registrationFixtures';
vi.mock(
  '../../src/operations/enterprise/api/enterpriseMembershipClient',
  async (original) => ({
    ...(await original<
      typeof import('../../src/operations/enterprise/api/enterpriseMembershipClient')
    >()),
    acceptEnterpriseMembership: vi.fn(),
    loadEnterpriseMembershipWorkspace: vi.fn(),
  }),
);
const bootstrap: AxisAuthenticatedBootstrap = {
  axisPolicy: {
    contractVersion: 0,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 1,
    source: 'DEFAULT',
  },
  navigation: [],
  environments: [],
  moduleCatalog: {},
  moduleConnections: {},
  documentationSources: [],
  tenantCode: 'currentTenant',
};
const presentation = Object.fromEntries(
  [
    'title',
    'refreshLabel',
    'enterpriseLabel',
    'responsibilityLabel',
    'statusLabel',
    'ACCEPT',
    'SWITCH',
    'reviewTitle',
    'reviewMessage',
    'confirmLabel',
    'cancelLabel',
    'inspectLabel',
    'uncertainMessage',
    'successMessage',
    'emptyMessage',
    'PENDING',
    'ACTIVE',
    'REGISTERED',
    'SUSPENDED',
    'REVOKED',
  ].map((key) => [key, key]),
);
const invitation = {
  code: 'membership',
  revision: 1,
  enterpriseCode: 'target',
  enterpriseName: 'Target Enterprise',
  responsibility: 'Operator',
  status: 'ACTIVE',
  accepted: false,
  actions: ['ACCEPT'],
};
const workspace = parseEnterpriseMembershipWorkspace({
  contractVersion: 1,
  owner: 'profile',
  renderer: 'axis.enterprise-memberships',
  enterpriseCode: 'current',
  presentation,
  items: [invitation],
});
function mount() {
  vi.mocked(loadEnterpriseMembershipWorkspace).mockResolvedValue(workspace);
  const onSwitch = vi.fn<() => Promise<void>>().mockResolvedValue();
  render(
    <EnterpriseMembershipRoutePage
      bootstrap={bootstrap}
      accessToken="access"
      runtime={{ ...runtime, enterpriseCode: 'current' }}
      onSwitch={onSwitch}
    />,
  );
  return { user: userEvent.setup(), onSwitch };
}
afterEach(() => vi.resetAllMocks());
it('acceptance requires review and entering the enterprise is a separate reviewed action', async () => {
  const { user, onSwitch } = mount();
  const accepted = {
    ...workspace.items[0]!,
    status: 'REGISTERED' as const,
    accepted: true,
    revision: 2,
    actions: ['SWITCH' as const],
  };
  vi.mocked(acceptEnterpriseMembership).mockResolvedValue(accepted);
  await user.click(await screen.findByRole('button', { name: 'ACCEPT' }));
  expect(acceptEnterpriseMembership).not.toHaveBeenCalled();
  vi.mocked(loadEnterpriseMembershipWorkspace).mockResolvedValue({
    ...workspace,
    items: [accepted],
  });
  await user.click(screen.getByRole('button', { name: 'confirmLabel' }));
  await screen.findByText('successMessage');
  expect(acceptEnterpriseMembership).toHaveBeenCalledTimes(1);
  expect(onSwitch).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await user.click(screen.getByRole('button', { name: 'SWITCH' }));
  expect(onSwitch).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'confirmLabel' }));
  await waitFor(() => expect(onSwitch).toHaveBeenCalledWith(accepted));
});
it('uncertain acceptance permits inspection, never automatic mutation replay', async () => {
  const { user } = mount();
  vi.mocked(acceptEnterpriseMembership).mockRejectedValue(
    new Error('Lost acknowledgement'),
  );
  await user.click(await screen.findByRole('button', { name: 'ACCEPT' }));
  await user.click(screen.getByRole('button', { name: 'confirmLabel' }));
  await screen.findByText('uncertainMessage');
  expect(acceptEnterpriseMembership).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'confirmLabel' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'inspectLabel' }));
  await waitFor(() =>
    expect(loadEnterpriseMembershipWorkspace).toHaveBeenCalledTimes(2),
  );
  expect(acceptEnterpriseMembership).toHaveBeenCalledTimes(1);
});
