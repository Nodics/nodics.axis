/** Authored published-workspace projection fixtures; behavioral execution remains joint. */
import { afterEach, expect, it, vi } from 'vitest';
import {
  parseEnterpriseAdministrationWorkspace,
  changeEnterpriseAdministration,
} from '../../src/operations/enterprise/api/enterpriseAdministrationClient';
import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from '../../src/operations/shared/operationalOwnerClient';
vi.mock('../../src/operations/shared/operationalOwnerClient', () => ({
  invokeOperationalOwner: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());
const workspace = {
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
  availableCommands: ['GRANT'],
  options: {
    sources: [
      {
        enterpriseCode: 'parent',
        assignments: [{ code: 'opaque-assignment', roleCode: 'ENTERPRISE_ADMIN' }],
      },
    ],
    roleCodes: ['OPERATOR'],
    actions: ['VIEW', 'INVITE'],
    maximumRecipients: 100,
    maximumLifetimeDays: 30,
  },
  mutation: {
    revisionRequired: true,
    operationIdRequired: true,
    automaticRetry: false,
    recipientField: 'recipientAssignmentCode',
  },
};
it('projects only inert fields and opaque assignment choices, never a private canonical locator', () => {
  const parsed = parseEnterpriseAdministrationWorkspace(
    {
      ...workspace,
      identity: { tenantCode: 'private-tenant', recordId: 'private-principal' },
    },
    'child',
  );
  expect(parsed.options.sources[0]?.assignments[0]?.code).toBe('opaque-assignment');
  expect(JSON.stringify(parsed)).not.toContain('private-principal');
  expect(JSON.stringify(parsed)).not.toContain('tenantCode');
});
it('retains declared business labels without email or identity fallbacks', () => {
  const parsed = parseEnterpriseAdministrationWorkspace(
    {
      ...workspace,
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
                email: 'private@example.test',
                identity: 'private-id',
              },
            ],
          },
        ],
      },
    },
    'child',
  );
  expect(parsed.options.sources[0]).toMatchObject({
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
  });
  expect(JSON.stringify(parsed)).not.toContain('private');
  expect(
    parseEnterpriseAdministrationWorkspace(workspace, 'child').options.sources[0],
  ).not.toHaveProperty('enterpriseName');
  for (const enterpriseName of [7, '', 'x'.repeat(257), 'Company\nPrivate']) {
    expect(() =>
      parseEnterpriseAdministrationWorkspace(
        {
          ...workspace,
          options: {
            ...workspace.options,
            sources: [{ ...workspace.options.sources[0], enterpriseName }],
          },
        },
        'child',
      ),
    ).toThrow();
  }
});
it('consumes all seven optional owner task labels while retaining required core labels', () => {
  const labels = Object.fromEntries(
    [
      'inspectLabel',
      'workingLabel',
      'reviewTitle',
      'confirmLabel',
      'cancelLabel',
      'unavailableMessage',
      'recordedMessage',
    ].map((key) => [key, 'Owner ' + key]),
  );
  const presentation = { ...workspace.presentation, ...labels };
  expect(
    parseEnterpriseAdministrationWorkspace({ ...workspace, presentation }, 'child')
      .presentation,
  ).toMatchObject(labels);
  expect(() =>
    parseEnterpriseAdministrationWorkspace(
      {
        ...workspace,
        presentation: { ...presentation, inspectLabel: 'x'.repeat(501) },
      },
      'child',
    ),
  ).toThrow();
  expect(() =>
    parseEnterpriseAdministrationWorkspace(
      { ...workspace, presentation: { ...presentation, title: undefined } },
      'child',
    ),
  ).toThrow();
});
it('sends one projected opaque-recipient command and confirms public persisted state, not an acknowledgement count', async () => {
  const input = {
    operation: 'GRANT' as const,
    operationId: 'fixture_operation_1234',
    revision: 0,
    sourceEnterpriseCode: 'parent',
    recipientAssignmentCode: 'opaque-assignment',
    roleCodes: ['OPERATOR'],
    actions: ['VIEW'],
    recipients: ['fixture@example.test'],
    expiresAt: '2026-10-10T08:00:00Z',
  };
  const snapshot = parseEnterpriseAdministrationWorkspace(workspace, 'child');
  vi.mocked(invokeOperationalOwner).mockResolvedValueOnce({
    enterpriseCode: 'child',
    revision: 1,
    grants: [
      {
        code: 'consent_' + 'a'.repeat(64),
        revision: 1,
        sourceEnterpriseCode: 'parent',
        status: 'ACTIVE',
        actions: ['VIEW'],
        roleCodes: ['OPERATOR'],
        expiresAt: input.expiresAt,
        createdAt: '2026-10-01T08:00:00Z',
      },
    ],
  });
  await changeEnterpriseAdministration({} as OperationalOwnerConfiguration, snapshot, {
    ...input,
    identity: { recordId: 'must-not-send' },
  } as typeof input);
  expect(invokeOperationalOwner).toHaveBeenCalledTimes(1);
  expect(vi.mocked(invokeOperationalOwner).mock.calls[0]?.[2]).toBe(
    '/enterprise-administration/child/consent',
  );
  expect(vi.mocked(invokeOperationalOwner).mock.calls[0]?.[3]).toEqual(input);
  vi.mocked(invokeOperationalOwner).mockResolvedValueOnce({ matchedCount: 1 });
  await expect(
    changeEnterpriseAdministration(
      {} as OperationalOwnerConfiguration,
      snapshot,
      input,
    ),
  ).rejects.toThrow();
  expect(invokeOperationalOwner).toHaveBeenCalledTimes(2);
});
it('rejects target mismatch, obsolete recipient authority and automatic retry declarations', () => {
  expect(() => parseEnterpriseAdministrationWorkspace(workspace, 'other')).toThrow();
  expect(() =>
    parseEnterpriseAdministrationWorkspace(
      { ...workspace, mutation: { ...workspace.mutation, recipientField: 'identity' } },
      'child',
    ),
  ).toThrow();
  expect(() =>
    parseEnterpriseAdministrationWorkspace(
      { ...workspace, mutation: { ...workspace.mutation, automaticRetry: true } },
      'child',
    ),
  ).toThrow();
});
it('projects owner expiry and explicit revoke availability without treating omission as permission', async () => {
  const grant = {
    code: 'consent_' + 'b'.repeat(64),
    revision: 1,
    sourceEnterpriseCode: 'parent',
    status: 'EXPIRED',
    actions: ['VIEW'],
    roleCodes: ['OPERATOR'],
    expiresAt: '2026-09-30T08:00:00Z',
    createdAt: '2026-09-01T08:00:00Z',
  };
  const snapshot = parseEnterpriseAdministrationWorkspace(
    { ...workspace, grants: [grant], availableCommands: ['REVOKE'] },
    'child',
  );
  expect(snapshot.grants[0]?.status).toBe('EXPIRED');
  expect(snapshot.grants[0]?.canRevoke).toBeUndefined();
  expect(
    parseEnterpriseAdministrationWorkspace(
      { ...workspace, grants: [{ ...grant, canRevoke: true }] },
      'child',
    ).grants[0]?.canRevoke,
  ).toBe(true);
  await expect(
    changeEnterpriseAdministration({} as OperationalOwnerConfiguration, snapshot, {
      operation: 'REVOKE',
      operationId: 'fixture_operation_1234',
      revision: 0,
      grantCode: grant.code,
    }),
  ).rejects.toThrow();
  expect(invokeOperationalOwner).not.toHaveBeenCalled();
  expect(
    parseEnterpriseAdministrationWorkspace(
      { ...workspace, grants: [{ ...grant, canRevoke: false }] },
      'child',
    ).grants[0]?.canRevoke,
  ).toBe(false);
  expect(() =>
    parseEnterpriseAdministrationWorkspace(
      { ...workspace, grants: [{ ...grant, canRevoke: 'true' }] },
      'child',
    ),
  ).toThrow();
});
it('rejects duplicate options and malformed managed revisions', () => {
  expect(() =>
    parseEnterpriseAdministrationWorkspace({ ...workspace, revision: '0' }, 'child'),
  ).toThrow();
  expect(() =>
    parseEnterpriseAdministrationWorkspace(
      {
        ...workspace,
        options: { ...workspace.options, roleCodes: ['OPERATOR', 'OPERATOR'] },
      },
      'child',
    ),
  ).toThrow();
});
