/** Authored administration consumer fixtures; no runtime consent, account or notification mutations. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import { EnterpriseAdministrationRoutePage } from '../../src/operations/enterprise/EnterpriseAdministrationRoutePage';
import {
  loadEnterpriseAdministrationWorkspace,
  changeEnterpriseAdministration,
  parseEnterpriseAdministrationWorkspace,
} from '../../src/operations/enterprise/api/enterpriseAdministrationClient';
import { runtime } from './registrationFixtures';
vi.mock(
  '../../src/operations/enterprise/api/enterpriseAdministrationClient',
  async (original) => ({
    ...(await original<
      typeof import('../../src/operations/enterprise/api/enterpriseAdministrationClient')
    >()),
    loadEnterpriseAdministrationWorkspace: vi.fn(),
    changeEnterpriseAdministration: vi.fn(),
  }),
);
const workspace = parseEnterpriseAdministrationWorkspace(
  {
    version: 1,
    kind: 'ENTERPRISE_ADMINISTRATION_CONSENT',
    enterpriseCode: 'child',
    revision: 0,
    presentation: Object.fromEntries(
      [
        'title',
        'grantLabel',
        'revokeLabel',
        'sourceLabel',
        'assignmentLabel',
        'roleLabel',
        'actionLabel',
        'recipientLabel',
        'expiryLabel',
        'confirmMessage',
        'uncertainMessage',
        'emptyMessage',
      ].map((key) => [key, key]),
    ),
    grants: [],
    availableCommands: [],
    options: {
      sources: [],
      roleCodes: [],
      actions: [],
      maximumRecipients: 100,
      maximumLifetimeDays: 30,
    },
    mutation: {
      revisionRequired: true,
      operationIdRequired: true,
      automaticRetry: false,
      recipientField: 'recipientAssignmentCode',
    },
  },
  'child',
);
afterEach(() => vi.resetAllMocks());
it('reviews a frozen opaque-recipient grant and prevents another write until fresh inspection', async () => {
  vi.mocked(loadEnterpriseAdministrationWorkspace).mockResolvedValueOnce({
    ...workspace,
    availableCommands: ['GRANT'],
    options: {
      ...workspace.options,
      sources: [
        {
          enterpriseCode: 'parent',
          enterpriseName: 'Parent Company',
          assignments: [
            {
              code: 'opaque-assignment',
              roleCode: 'ENTERPRISE_ADMIN',
              recipientName: 'Alex Example',
              roleLabel: 'Enterprise administrator',
            },
          ],
        },
      ],
      roleCodes: ['OPERATOR'],
      actions: ['VIEW'],
    },
  });
  vi.mocked(changeEnterpriseAdministration).mockResolvedValueOnce(undefined);
  const user = userEvent.setup();
  render(
    <MemoryRouter
      initialEntries={['/profile/enterprise-administration?enterpriseCode=child']}
    >
      <EnterpriseAdministrationRoutePage
        bootstrap={{} as AxisAuthenticatedBootstrap}
        accessToken="fixture-token"
        runtime={runtime}
      />
    </MemoryRouter>,
  );
  await user.click(await screen.findByRole('combobox', { name: 'sourceLabel' }));
  await user.click(screen.getByRole('option', { name: 'Parent Company (parent)' }));
  await user.click(screen.getByRole('combobox', { name: 'assignmentLabel' }));
  await user.click(
    screen.getByRole('option', {
      name: 'Alex Example / Enterprise administrator (opaque-assignment / ENTERPRISE_ADMIN)',
    }),
  );
  await user.click(screen.getByRole('checkbox', { name: 'OPERATOR' }));
  await user.click(screen.getByRole('checkbox', { name: 'VIEW' }));
  await user.type(
    screen.getByRole('textbox', { name: 'recipientLabel' }),
    'fixture@example.test',
  );
  fireEvent.change(screen.getByLabelText('expiryLabel'), {
    target: { value: new Date(Date.now() + 86400000).toISOString().slice(0, 16) },
  });
  await user.click(screen.getByRole('button', { name: 'grantLabel' }));
  expect(changeEnterpriseAdministration).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Confirm' }));
  await screen.findByText(/owner recorded the change/);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  const body = vi.mocked(changeEnterpriseAdministration).mock.calls[0]?.[2];
  expect(body).toMatchObject({
    operation: 'GRANT',
    revision: 0,
    sourceEnterpriseCode: 'parent',
    recipientAssignmentCode: 'opaque-assignment',
    roleCodes: ['OPERATOR'],
    actions: ['VIEW'],
    recipients: ['fixture@example.test'],
  });
  expect(body?.operationId).toMatch(/^[a-f0-9]{32}$/);
  expect(screen.getByRole('button', { name: 'grantLabel' })).toBeDisabled();
  expect(changeEnterpriseAdministration).toHaveBeenCalledTimes(1);
});
it('uses the selected target without replacing acting enterprise authority and respects owner-disabled commands', async () => {
  vi.mocked(loadEnterpriseAdministrationWorkspace).mockResolvedValueOnce(workspace);
  render(
    <MemoryRouter
      initialEntries={['/profile/enterprise-administration?enterpriseCode=child']}
    >
      <EnterpriseAdministrationRoutePage
        bootstrap={{} as AxisAuthenticatedBootstrap}
        accessToken="fixture-token"
        runtime={runtime}
      />
    </MemoryRouter>,
  );
  expect(await screen.findByRole('button', { name: 'grantLabel' })).toBeDisabled();
  expect(
    vi.mocked(loadEnterpriseAdministrationWorkspace).mock.calls[0]?.[0].enterpriseCode,
  ).toBe(runtime.enterpriseCode);
  expect(vi.mocked(loadEnterpriseAdministrationWorkspace).mock.calls[0]?.[1]).toBe(
    'child',
  );
  expect(changeEnterpriseAdministration).not.toHaveBeenCalled();
});
it('rejects ambiguous query targets rather than guessing an enterprise authority', async () => {
  render(
    <MemoryRouter
      initialEntries={[
        '/profile/enterprise-administration?enterpriseCode=child&enterpriseCode=other',
      ]}
    >
      <EnterpriseAdministrationRoutePage
        bootstrap={{} as AxisAuthenticatedBootstrap}
        accessToken="fixture-token"
        runtime={runtime}
      />
    </MemoryRouter>,
  );
  await screen.findByText('Enter a valid enterprise reference.');
  expect(loadEnterpriseAdministrationWorkspace).not.toHaveBeenCalled();
  expect(changeEnterpriseAdministration).not.toHaveBeenCalled();
});
