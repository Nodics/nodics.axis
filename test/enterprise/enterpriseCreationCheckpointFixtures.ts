/** Independent owner-declared enterprise creation and setup contract; no live data or credentials. */
import type {
  AxisBackendWorkspace,
  AxisModuleConnection,
} from '../../src/bootstrap/publicBootstrap';
import { runtime } from './registrationFixtures';
export { runtime };
export const connection: AxisModuleConnection = {
  moduleName: 'profile',
  instanceId: 'profile-1',
  endpoint: 'https://profile.example.test/nodics/profile',
  environment: 'Local',
  server: 'platformServer',
  runtimeRole: { code: 'PLATFORM', publication: 'NONE' },
  state: 'UP',
};
export const workspace: AxisBackendWorkspace = {
  renderer: 'axis.workspace.backend-operations',
  contractVersion: 0,
  title: 'Enterprise management',
  defaultTab: 'enterprises',
  setupContinuation: {
    version: 1,
    type: 'enterpriseSetupContinuation',
    available: true,
    actions: {
      inspect: {
        method: 'GET',
        path: '/nodics/profile/v0/enterprises/{enterpriseCode}/setup',
      },
      resume: {
        method: 'POST',
        path: '/nodics/profile/v0/enterprises/{enterpriseCode}/setup/resume',
        qualified: true,
        bodyFields: ['expectedRevision'],
      },
    },
    presentation: {
      title: 'Inspect enterprise setup',
      inspectLabel: 'Inspect setup',
      resumeLabel: 'Resume setup',
      workingLabel: 'Working',
      reviewTitle: 'Review continuation',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      enterpriseLabel: 'Setup enterprise',
      tenantLabel: 'Tenant',
      administratorLabel: 'Administrator',
      statusLabel: 'Status',
      revisionLabel: 'Revision',
      heldMessage: 'Needs attention',
      completeMessage: 'Setup complete',
      unavailableMessage: 'Setup unavailable',
      uncertainMessage: 'Inspect setup before continuing.',
      reasons: {},
    },
  },
  tabs: [
    {
      id: 'enterprises',
      label: 'Enterprises',
      sections: [
        {
          id: 'create-enterprise',
          type: 'form',
          title: 'Create enterprise',
          submitLabel: 'Create enterprise',
          endpoint: {
            method: 'POST',
            path: '/nodics/profile/v0/enterprises',
            bodyShape: 'MODEL',
            idempotencyField: 'idempotencyKey',
          },
          fields: [
            {
              name: 'code',
              label: 'Enterprise code',
              type: 'TEXT',
              required: true,
              maximumLength: 128,
            },
            {
              name: 'name',
              label: 'Enterprise name',
              type: 'TEXT',
              required: true,
              maximumLength: 256,
            },
            {
              name: 'adminEmail',
              label: 'Administrator email',
              type: 'EMAIL',
              required: true,
              maximumLength: 320,
            },
            {
              name: 'superEnterprise',
              label: 'Parent enterprise',
              type: 'TEXT',
              required: false,
            },
            {
              name: 'roleCodes',
              label: 'Enterprise roles',
              type: 'MULTISELECT',
              required: false,
              options: [{ value: 'ASSET_OWNER', label: 'Asset owner' }],
            },
            {
              name: 'active',
              label: 'Active',
              type: 'CHECKBOX',
              required: false,
              defaultValue: true,
            },
            {
              name: 'idempotencyKey',
              label: 'Idempotency key',
              type: 'IDEMPOTENCY',
              required: true,
            },
          ],
        },
      ],
    },
  ],
};
export const section = workspace.tabs[0]!.sections[0]!;
export const values = {
  code: 'business',
  name: 'Example Repair',
  adminEmail: 'admin@axis-onboarding-acceptance.test',
  superEnterprise: '',
  roleCodes: ['ASSET_OWNER'],
  active: true,
  idempotencyKey: 'original-operation-key',
};
