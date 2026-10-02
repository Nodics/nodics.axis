/** Authored fenced-target standalone fixtures; behavioral execution remains joint. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import { EnterpriseAdministrationRoutePage } from '../../src/operations/enterprise/EnterpriseAdministrationRoutePage';
import { invokeOperationalOwner } from '../../src/operations/shared/operationalOwnerClient';
import { loadEnterpriseAdministrationWorkspace } from '../../src/operations/enterprise/api/enterpriseAdministrationClient';
import { runtime } from './registrationFixtures';
import { stampPresentation } from './consentStampFixtures';
vi.mock('../../src/operations/shared/operationalOwnerClient', () => ({
  invokeOperationalOwner: vi.fn(),
}));
vi.mock('../../src/operations/enterprise/api/enterpriseAdministrationClient', () => ({
  loadEnterpriseAdministrationWorkspace: vi.fn(),
  changeEnterpriseAdministration: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());
it('inspects and reviews a fenced target without loading ordinary consent or relabeling issuer headers', async () => {
  const code = 'consent_' + 'a'.repeat(64),
    user = userEvent.setup();
  vi.mocked(loadEnterpriseAdministrationWorkspace).mockRejectedValue(
    new Error('Fenced'),
  );
  vi.mocked(invokeOperationalOwner).mockResolvedValueOnce({
    presentation: stampPresentation,
    version: 1,
    kind: 'ENTERPRISE_ADMINISTRATION_STAMP_REPAIR',
    enterpriseCode: 'child',
    revision: 3,
    grants: [{ code, revision: 2, status: 'REVOKED', canRepair: true }],
  });
  vi.mocked(invokeOperationalOwner).mockImplementationOnce(
    (_configuration, _module, _path, body) =>
      Promise.resolve({ ...(body as object), revision: 4, status: 'COMPLETE' }),
  );
  render(
    <MemoryRouter
      initialEntries={[
        '/profile/enterprise-administration?enterpriseCode=child&task=stamp-repair',
      ]}
    >
      <EnterpriseAdministrationRoutePage
        bootstrap={{} as AxisAuthenticatedBootstrap}
        accessToken="signed-issuer"
        runtime={runtime}
        title="Configured owner title"
      />
    </MemoryRouter>,
  );
  expect(loadEnterpriseAdministrationWorkspace).not.toHaveBeenCalled();
  expect(invokeOperationalOwner).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Inspect' }));
  await user.click(await screen.findByRole('checkbox'));
  expect(vi.mocked(invokeOperationalOwner).mock.calls[0]?.[0]).toMatchObject({
    accessToken: 'signed-issuer',
    enterpriseCode: runtime.enterpriseCode,
  });
  expect(vi.mocked(invokeOperationalOwner).mock.calls[0]?.[2]).toBe(
    '/enterprise-administration/child/consent/stamps/repair',
  );
  await user.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(invokeOperationalOwner).toHaveBeenCalledTimes(1);
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm' }),
  );
  expect(await screen.findByText('Recorded')).toBeInTheDocument();
  expect(vi.mocked(invokeOperationalOwner).mock.calls[1]?.[3]).toMatchObject({
    enterpriseCode: 'child',
    revision: 3,
    grantCodes: [code],
  });
  const body = vi.mocked(invokeOperationalOwner).mock.calls[1]?.[3] as {
    operationId?: unknown;
  };
  expect(body.operationId).toMatch(/^[a-f0-9]{32}$/);
  expect(loadEnterpriseAdministrationWorkspace).not.toHaveBeenCalled();
});
