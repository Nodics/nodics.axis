/** Independent public contract fixtures. No backend source, permission catalogue or live identities are imported. */
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import type { EnterpriseTeamWorkspace } from '../../src/operations/enterprise/api/enterpriseMembershipClient';

export const businessAccessWorkspace = {
  contractVersion: 1,
  enterpriseCode: 'business',
  businessAccess: {
    contractVersion: 1,
    presentation: {
      employeeLabel: 'Employee',
      areaLabel: 'Business area',
      levelLabel: 'Access level',
      scopeLabel: 'Enterprise scope',
      noAccess: 'No access',
      view: 'View',
      edit: 'Edit',
      fullControl: 'Full control',
      advancedLabel: 'Advanced access',
      advancedMessage:
        'Additional groups remain unchanged by business area selections.',
      refreshLabel: 'Refresh',
      responsibilityLabel: 'Responsibility',
      emptyMessage: 'No employees',
      reviewTitle: 'Review changes',
      reviewMessage: 'Confirm the reviewed changes.',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      inspectLabel: 'Inspect',
      retryLabel: 'Retry reviewed changes',
      uncertainMessage: 'The outcome is uncertain. Inspect before retrying.',
      successMessage: 'Changes confirmed.',
    },
    businessAreas: ['products', 'content', 'waste'].map((code) => ({
      code,
      label:
        code === 'products' ? 'Products' : code === 'content' ? 'Content' : 'Waste',
      ownerModule: code,
      scopeType: 'ENTERPRISE',
      levels: ['view', 'edit', 'fullControl'].map((value) => ({
        value,
        roleCode: `${code}_${value}`,
      })),
    })),
  },
  employees: [
    {
      employeeCode: 'alex',
      loginId: 'alex@example.test',
      name: 'Alex',
      assignmentCode: 'assignment-alex',
      reviewFingerprint: 'a'.repeat(64),
      selections: [
        { businessArea: 'products', accessLevel: 'view' },
        { businessArea: 'content', accessLevel: 'view' },
        { businessArea: 'waste', accessLevel: 'edit' },
      ],
      otherGroupCodes: ['customReviewerGroup'],
    },
  ],
};

export const teamPresentation: EnterpriseTeamWorkspace['presentation'] = {
  title: 'Team',
  refreshLabel: 'Refresh',
  emailLabel: 'Email',
  responsibilityLabel: 'Responsibility',
  statusLabel: 'Status',
  designatedLabel: 'Designated administrator',
  emptyMessage: 'No employees',
  SUSPEND: 'Suspend',
  REVOKE: 'Revoke membership',
  RESUME: 'Resume',
  WITHDRAW: 'Withdraw',
  HANDOVER: 'Handover',
  reviewTitle: 'Review changes',
  reviewMessage: 'Confirm the reviewed changes.',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  inspectLabel: 'Inspect',
  retryLabel: 'Retry reviewed changes',
  uncertainMessage: 'The outcome is uncertain. Inspect before retrying.',
  pendingMessage: 'A team command is pending.',
  successMessage: 'Changes confirmed.',
  reconcileMessage: 'Reconcile',
  PENDING: 'Pending',
  ACTIVE: 'Active',
  REGISTERED: 'Registered',
  SUSPENDED: 'Suspended',
  REVOKED: 'Revoked',
};

export const businessAccessConfiguration = {
  bootstrap: {
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
    documentationSources: [],
    tenantCode: 'businessTenant',
    moduleConnections: {
      profile: [
        {
          moduleName: 'profile',
          instanceId: 'fixture-profile',
          endpoint: 'https://profile.example.test/nodics/profile',
          environment: 'fixture',
          state: 'UP',
        },
      ],
    },
  } as AxisAuthenticatedBootstrap,
  accessToken: 'fixture-token',
  enterpriseCode: 'business',
  timeoutMs: 10000,
};

/** Resolves a recorded fetch URL without stringifying arbitrary request objects. */
export function businessAccessRequestUrl(input: Parameters<typeof fetch>[0]): string {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}
