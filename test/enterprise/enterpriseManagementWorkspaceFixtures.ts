/** Independent Profile task fixtures; arbitrary responsibility codes prove the browser owns no role map. */
import type { AxisBackendWorkspace } from '../../src/bootstrap/publicBootstrap';
import { businessAccessConfiguration } from './enterpriseBusinessAccessFixtures';
import { runtime as baseRuntime } from './registrationFixtures';

export const configuration = businessAccessConfiguration;
export const runtime = { ...baseRuntime, enterpriseCode: configuration.enterpriseCode };
export const connection = configuration.bootstrap.moduleConnections.profile![0]!;
export const descriptor: AxisBackendWorkspace = {
  contractVersion: 1,
  renderer: 'axis.workspace.native',
  workspaceCode: 'profile.enterpriseManagement',
  viewCode: 'administration',
  title: 'Enterprise management',
  tabs: [],
};
export const workspace: AxisBackendWorkspace = {
  contractVersion: 0,
  renderer: 'axis.workspace.backend-operations',
  title: 'Current enterprise management',
  defaultTab: 'users',
  tabs: [
    {
      id: 'users',
      label: 'Invitations',
      sections: [
        {
          id: 'assign-user',
          type: 'form',
          title: 'Invite a colleague',
          submitLabel: 'Assign access',
          endpoint: {
            method: 'POST',
            path: '/nodics/profile/v0/enterprises/{enterpriseCode}/access-assignments',
          },
          fields: [
            {
              name: 'email',
              label: 'Employee email',
              type: 'TEXT',
              required: true,
              maximumLength: 320,
            },
            {
              name: 'roleCode',
              label: 'Additional responsibilities',
              type: 'SELECT',
              required: true,
              options: [
                { value: 'LOCAL_OPERATIONS', label: 'Operations colleague' },
                { value: 'LOCAL_REVIEW', label: 'Review colleague' },
              ],
            },
            {
              name: 'enterpriseCode',
              label: 'Enterprise scope',
              type: 'TEXT',
              required: true,
              defaultValue: configuration.enterpriseCode,
            },
            {
              name: 'idempotencyKey',
              label: 'Command reference',
              type: 'IDEMPOTENCY',
              required: true,
            },
          ],
        },
      ],
    },
  ],
};
export const task = {
  contractVersion: 1,
  kind: 'ENTERPRISE_MANAGEMENT',
  enterpriseCode: configuration.enterpriseCode,
  workspace,
};
