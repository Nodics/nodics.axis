/** Rendered team review/recovery fixtures. Authenticated owner transport is mocked; no live acceptance is claimed. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import { EnterpriseTeamRoutePage } from '../../src/operations/enterprise/EnterpriseTeamRoutePage';
import {
  changeEnterpriseMembership,
  loadEnterpriseTeamWorkspace,
  parseEnterpriseTeamWorkspace,
} from '../../src/operations/enterprise/api/enterpriseMembershipClient';
import { runtime } from './registrationFixtures';

vi.mock(
  '../../src/operations/enterprise/api/enterpriseMembershipClient',
  async (original) => ({
    ...(await original<
      typeof import('../../src/operations/enterprise/api/enterpriseMembershipClient')
    >()),
    loadEnterpriseTeamWorkspace: vi.fn(),
    changeEnterpriseMembership: vi.fn(),
    handoverEnterpriseAdministrator: vi.fn(),
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
  tenantCode: 'businessTenant',
};
const presentation = Object.fromEntries(
  [
    'title',
    'refreshLabel',
    'emailLabel',
    'responsibilityLabel',
    'statusLabel',
    'designatedLabel',
    'emptyMessage',
    'SUSPEND',
    'REVOKE',
    'RESUME',
    'WITHDRAW',
    'HANDOVER',
    'reviewTitle',
    'reviewMessage',
    'confirmLabel',
    'cancelLabel',
    'inspectLabel',
    'retryLabel',
    'uncertainMessage',
    'pendingMessage',
    'successMessage',
    'reconcileMessage',
    'PENDING',
    'ACTIVE',
    'REGISTERED',
    'SUSPENDED',
    'REVOKED',
  ].map((key) => [key, key]),
);
const member = {
  code: 'operator',
  revision: 1,
  enterpriseCode: 'business',
  enterpriseName: 'Business',
  responsibility: 'Operator',
  status: 'REGISTERED',
  accepted: true,
  email: 'operator@example.test',
  designated: false,
  actions: ['SUSPEND'],
};
const workspace = parseEnterpriseTeamWorkspace({
  contractVersion: 1,
  owner: 'profile',
  renderer: 'axis.enterprise-team',
  enterpriseCode: 'business',
  enterpriseName: 'Business',
  presentation,
  items: [member],
  operation: null,
});
function mount() {
  vi.mocked(loadEnterpriseTeamWorkspace).mockResolvedValue(workspace);
  return {
    user: userEvent.setup(),
    view: render(
      <EnterpriseTeamRoutePage
        bootstrap={bootstrap}
        accessToken="test-token"
        runtime={{ ...runtime, enterpriseCode: 'business' }}
      />,
    ),
  };
}
afterEach(() => vi.resetAllMocks());
it('requires explicit review before submitting an immutable revision and operation ID', async () => {
  vi.mocked(changeEnterpriseMembership).mockResolvedValue(workspace.items[0]!);
  const { user } = mount();
  await user.click(await screen.findByRole('button', { name: 'SUSPEND' }));
  expect(changeEnterpriseMembership).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'confirmLabel' }));
  await screen.findByText('successMessage');
  expect(changeEnterpriseMembership).toHaveBeenCalledTimes(1);
  const command = vi.mocked(changeEnterpriseMembership).mock.calls[0]!;
  expect(command[1]).toBe('SUSPEND');
  expect(command[2]).toEqual(workspace.items[0]);
  expect(command[3]).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
});
it('uncertain writes never auto-retry and explicit resume retains the same reviewed input', async () => {
  vi.mocked(changeEnterpriseMembership).mockRejectedValue(
    new Error('Uncertain delivery'),
  );
  const { user } = mount();
  await user.click(await screen.findByRole('button', { name: 'SUSPEND' }));
  await user.click(screen.getByRole('button', { name: 'confirmLabel' }));
  await screen.findByText('uncertainMessage');
  expect(changeEnterpriseMembership).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'cancelLabel' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'inspectLabel' }));
  await waitFor(() => expect(loadEnterpriseTeamWorkspace).toHaveBeenCalledTimes(2));
  await user.click(screen.getByRole('button', { name: 'retryLabel' }));
  await waitFor(() => expect(changeEnterpriseMembership).toHaveBeenCalledTimes(2));
  const calls = vi.mocked(changeEnterpriseMembership).mock.calls;
  expect(calls[1]?.slice(1)).toEqual(calls[0]?.slice(1));
});
it('pending owner operations disable new commands without exposing operator recovery actions', async () => {
  const { user } = mount();
  vi.mocked(loadEnterpriseTeamWorkspace).mockResolvedValue({
    ...workspace,
    operation: { id: 'operation_12345678', phase: 'PENDING' },
  });
  await screen.findByRole('button', { name: 'SUSPEND' });
  await user.click(screen.getByRole('button', { name: 'refreshLabel' }));
  await screen.findByText('pendingMessage');
  expect(screen.getByRole('button', { name: 'SUSPEND' })).toBeDisabled();
  expect(changeEnterpriseMembership).not.toHaveBeenCalled();
});
