/** Independent safe DTO fixtures; behavioral execution remains a separate acceptance gate. */
import { expect, it } from 'vitest';
import {
  parseEnterpriseMembership,
  parseEnterpriseTeamWorkspace,
  parseEnterpriseMembershipWorkspace,
  parseEnterpriseRecoveryWorkspace,
} from '../../src/operations/enterprise/api/enterpriseMembershipClient';
const item = {
  code: 'membership',
  revision: 1,
  enterpriseCode: 'business',
  enterpriseName: 'Business',
  responsibility: 'Operator',
  status: 'REGISTERED',
  accepted: true,
};
it('operator recovery strips private evidence and rejects ambiguous recovery declarations', () => {
  const value = {
    contractVersion: 1,
    owner: 'profile',
    enterpriseCode: 'business',
    operation: {
      id: 'operation_12345678',
      phase: 'PENDING',
      teamRevision: 7,
      recoverable: true,
      actor: 'private',
      input: { password: 'private' },
    },
    presentation: Object.fromEntries(
      [
        'title',
        'inspectLabel',
        'reviewTitle',
        'confirmLabel',
        'cancelLabel',
        'unavailableMessage',
        'uncertainMessage',
      ].map((key) => [key, key]),
    ),
  };
  expect(parseEnterpriseRecoveryWorkspace(value).operation).not.toHaveProperty('actor');
  expect(parseEnterpriseRecoveryWorkspace(value).operation).not.toHaveProperty('input');
  for (const operation of [
    { ...value.operation, phase: 'COMPLETE' },
    { ...value.operation, teamRevision: '7' },
    { ...value.operation, recoverable: 'true' },
  ])
    expect(() => parseEnterpriseRecoveryWorkspace({ ...value, operation })).toThrow();
});
it('projects no private binding, credential or tenant evidence', () => {
  expect(
    parseEnterpriseMembership({
      ...item,
      tenant: 'private',
      password: 'private',
      membership: { identity: 'private' },
    }),
  ).toEqual(item);
});
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
const workspace = {
  contractVersion: 1,
  owner: 'profile',
  renderer: 'axis.enterprise-team',
  enterpriseCode: 'business',
  enterpriseName: 'Business',
  presentation,
  items: [
    {
      ...item,
      email: 'operator@example.test',
      designated: false,
      actions: ['SUSPEND'],
    },
  ],
  operation: null,
};
it('personal task rejects current-context switches, suspended acceptance and unknown actions', () => {
  const value = {
    ...workspace,
    renderer: 'axis.enterprise-memberships',
    enterpriseCode: 'current',
    presentation: {
      ...presentation,
      enterpriseLabel: 'Enterprise',
      ACCEPT: 'Accept',
      SWITCH: 'Switch',
    },
    items: [{ ...item, actions: ['SWITCH'], password: 'private' }],
  };
  expect(parseEnterpriseMembershipWorkspace(value).items[0]).not.toHaveProperty(
    'password',
  );
  for (const invalid of [
    { ...value, enterpriseCode: 'business' },
    {
      ...value,
      items: [{ ...item, status: 'SUSPENDED', accepted: false, actions: ['ACCEPT'] }],
    },
    { ...value, items: [{ ...item, actions: ['REVOKE'] }] },
    { ...value, items: [{ ...item, actions: ['ACCEPT', 'SWITCH'] }] },
  ])
    expect(() => parseEnterpriseMembershipWorkspace(invalid)).toThrow();
});
it('projects team business state without private operation or identity evidence', () => {
  const projected = parseEnterpriseTeamWorkspace({
    ...workspace,
    operation: {
      id: 'operation_12345678',
      phase: 'PENDING',
      actor: 'secret',
      hash: 'secret',
    },
    items: [{ ...workspace.items[0], password: 'secret', identity: 'secret' }],
  });
  expect(projected.operation).toEqual({ id: 'operation_12345678', phase: 'PENDING' });
  expect(projected.items[0]).not.toHaveProperty('password');
  expect(projected.items[0]).not.toHaveProperty('identity');
});
it('accepts withdrawal only as the sole unused-invitation action', () => {
  const invitation = {
    ...workspace.items[0],
    accepted: false,
    status: 'ACTIVE',
    actions: ['WITHDRAW'],
  };
  expect(
    parseEnterpriseTeamWorkspace({ ...workspace, items: [invitation] }).items[0]
      ?.actions,
  ).toEqual(['WITHDRAW']);
  for (const value of [
    { ...invitation, accepted: true, status: 'REGISTERED' },
    { ...invitation, designated: true },
    { ...invitation, actions: ['WITHDRAW', 'RESUME'] },
  ])
    expect(() =>
      parseEnterpriseTeamWorkspace({ ...workspace, items: [value] }),
    ).toThrow();
});
it('rejects cross-enterprise rows, duplicate identities, unknown actions and incomplete copy', () => {
  for (const value of [
    { ...workspace, items: [{ ...workspace.items[0], enterpriseCode: 'another' }] },
    { ...workspace, items: [workspace.items[0], workspace.items[0]] },
    { ...workspace, items: [{ ...workspace.items[0], actions: ['DELETE_IDENTITY'] }] },
    { ...workspace, presentation: {} },
    { ...workspace, operation: { id: 'short', phase: 'PENDING' } },
    { ...workspace, items: Array.from({ length: 101 }, () => workspace.items[0]) },
    { ...workspace, owner: 'customer' },
  ])
    expect(() => parseEnterpriseTeamWorkspace(value)).toThrow();
});
it('rejects write acknowledgements and inconsistent accepted states', () => {
  expect(() => parseEnterpriseMembership({ matchedCount: 1 })).toThrow();
  expect(() => parseEnterpriseMembership({ ...item, revision: 0 })).toThrow();
  expect(() => parseEnterpriseMembership({ ...item, status: 'SUSPENDED' })).toThrow();
  expect(
    parseEnterpriseMembership({ ...item, status: 'SUSPENDED', accepted: false })
      .accepted,
  ).toBe(false);
});
