/** Authored consent review and uncertainty fixtures; behavioral execution remains joint. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import { CustomerParticipationRoutePage } from '../../src/operations/enterprise/CustomerParticipationRoutePage';
import { invokeOperationalOwner } from '../../src/operations/shared/operationalOwnerClient';
import { runtime } from './registrationFixtures';
vi.mock('../../src/operations/shared/operationalOwnerClient', () => ({
  invokeOperationalOwner: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());
const workspace = {
  contractVersion: 1,
  owner: 'profile',
  enterpriseCode: runtime.enterpriseCode,
  participation: null,
  lifecycleQualified: true,
  terms: {
    version: 'v1',
    digest: 'a'.repeat(64),
    documentCode: 'terms-1',
    title: 'Owner terms',
    content: 'Exact owner document.',
  },
  presentation: {
    title: 'Customer participation',
    refreshLabel: 'Inspect',
    consentLabel: 'I accept these terms',
    acceptLabel: 'Accept',
    acceptedMessage: 'Recorded',
    uncertainMessage: 'Inspect before another command',
    renewLabel: 'Renew',
    withdrawLabel: 'Withdraw',
    withdrawReviewTitle: 'Review withdrawal',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
  },
};
const mount = () =>
  render(
    <CustomerParticipationRoutePage
      bootstrap={{} as AxisAuthenticatedBootstrap}
      accessToken="employee-token"
      runtime={runtime}
    />,
  );
it('requires unchecked explicit consent and review before sending exact terms once', async () => {
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce(workspace)
    .mockResolvedValueOnce({
      accepted: true,
      enterpriseCode: runtime.enterpriseCode,
      revision: 1,
    });
  const user = userEvent.setup();
  mount();
  expect(await screen.findByRole('button', { name: 'Accept' })).toBeDisabled();
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Accept' }));
  expect(invokeOperationalOwner).toHaveBeenCalledTimes(1);
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('Exact owner document.')).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
  expect(await screen.findByText('Recorded')).toBeInTheDocument();
  expect(vi.mocked(invokeOperationalOwner).mock.calls[1]?.slice(1)).toEqual([
    'profile',
    '/customer/participation/accept',
    { termsVersion: 'v1', termsDigest: 'a'.repeat(64), accepted: true },
  ]);
  expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
});
it('treats mismatched revision as uncertain and removes command state', async () => {
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce(workspace)
    .mockResolvedValueOnce({
      accepted: true,
      enterpriseCode: runtime.enterpriseCode,
      revision: 9,
    });
  const user = userEvent.setup();
  mount();
  await screen.findByRole('button', { name: 'Accept' });
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Accept' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Inspect before another command',
  );
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(invokeOperationalOwner).toHaveBeenCalledTimes(2);
});
it('does not renew owner-confirmed current terms or switch Axis to Customer proof', async () => {
  vi.mocked(invokeOperationalOwner).mockResolvedValueOnce({
    ...workspace,
    lifecycleQualified: false,
    participation: {
      phase: 'COMPLETE',
      revision: 4,
      currentTerms: true,
      canSwitch: true,
    },
  });
  mount();
  expect(await screen.findByRole('button', { name: 'Renew' })).toBeDisabled();
  expect(screen.getByRole('checkbox')).toBeDisabled();
  expect(invokeOperationalOwner).toHaveBeenCalledTimes(1);
});
