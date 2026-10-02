/** Authored inspection/review/original-command recovery fixtures; behavioral execution remains joint. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { stampPresentation } from './consentStampFixtures';
import { EnterpriseConsentStampRepair } from '../../src/operations/enterprise/EnterpriseConsentStampRepair';
import {
  inspectConsentStamps,
  repairConsentStamps,
} from '../../src/operations/enterprise/api/enterpriseConsentStampClient';
import type { OperationalOwnerConfiguration } from '../../src/operations/shared/operationalOwnerClient';
vi.mock('../../src/operations/enterprise/api/enterpriseConsentStampClient', () => ({
  inspectConsentStamps: vi.fn(),
  repairConsentStamps: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());
const inspection = {
  presentation: stampPresentation,
  enterpriseCode: 'child',
  revision: 3,
  grants: [
    {
      code: 'consent_fixture',
      revision: 2,
      status: 'REVOKED' as const,
      canRepair: true,
    },
  ],
};
it('never auto-inspects or repairs and repeats only an explicitly reviewed original command after uncertainty', async () => {
  vi.mocked(inspectConsentStamps).mockResolvedValue(inspection);
  vi.mocked(repairConsentStamps)
    .mockRejectedValueOnce(new Error('Interrupted'))
    .mockResolvedValueOnce(undefined);
  const user = userEvent.setup();
  render(
    <EnterpriseConsentStampRepair
      configuration={{} as OperationalOwnerConfiguration}
      target="child"
      title="Native configured title"
    />,
  );
  expect(inspectConsentStamps).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Inspect' }));
  await user.click(await screen.findByRole('checkbox'));
  expect(screen.getByRole('checkbox')).toHaveAccessibleName(
    'Owner grant: consent_fixture / Owner revision: 2 / Owner status: REVOKED',
  );
  await user.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(repairConsentStamps).not.toHaveBeenCalled();
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Inspect the original command',
  );
  const original = vi.mocked(repairConsentStamps).mock.calls[0]?.[2];
  expect(original).toMatchObject({
    enterpriseCode: 'child',
    revision: 3,
    grantCodes: ['consent_fixture'],
  });
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Inspect' }));
  expect(await screen.findByRole('checkbox')).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Confirm' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }),
  );
  expect(await screen.findByText('Recorded')).toBeInTheDocument();
  expect(vi.mocked(repairConsentStamps).mock.calls[1]?.[2]).toEqual(original);
});
it('renders the configured empty state without offering a command for absent subjects', async () => {
  vi.mocked(inspectConsentStamps).mockResolvedValue({ ...inspection, grants: [] });
  const user = userEvent.setup();
  render(
    <EnterpriseConsentStampRepair
      configuration={{} as OperationalOwnerConfiguration}
      target="child"
      title="Native configured title"
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Inspect' }));
  expect(await screen.findByText(stampPresentation.emptyMessage)).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: stampPresentation.confirmLabel }),
  ).not.toBeInTheDocument();
  expect(repairConsentStamps).not.toHaveBeenCalled();
});
