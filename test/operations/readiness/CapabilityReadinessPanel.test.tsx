import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CapabilityReadinessPanel } from '../../../src/operations/readiness/CapabilityReadinessPanel';

describe('CapabilityReadinessPanel', () => {
  it('renders dependency runtime evidence for blocked capabilities', () => {
    render(
      <CapabilityReadinessPanel
        readiness={{
          capabilityCode: 'agoraapparel',
          displayName: 'Agora Apparel',
          owningModule: 'agora.apparel',
          capabilityType: 'ACCELERATOR',
          group: 'PROJECT_ACCELERATOR',
          businessStatus: 'NEEDS_ATTENTION',
          technicalStatus: 'BLOCKED',
          nextAction: 'Restore Commerce runtime before publishing.',
          dependencies: [
            {
              kind: 'MODULE',
              code: 'nodics.commerce',
              label: 'Commerce',
              required: true,
              classification: 'FUNCTIONAL_MODULE',
              status: 'UNAVAILABLE',
              evidence: {
                classification: 'FUNCTIONAL_MODULE',
                runtimeState: 'OFFLINE',
                registrationState: 'REGISTERED',
                observedServers: ['kickoffLocal:commerceServer:node-a'],
                runtimeEvidence: {
                  source: 'FUNCTIONAL_MODULE_CATALOGUE',
                  stale: true,
                },
              },
            },
          ],
          blockers: [
            {
              code: 'RUNTIME_UNAVAILABLE',
              severity: 'BLOCKED',
              owner: 'nodics.commerce',
              message: 'Commerce runtime is offline.',
              action: 'Start target runtime.',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Dependencies')).toBeVisible();
    expect(screen.getByText('Commerce')).toBeVisible();
    expect(screen.getAllByText('FUNCTIONAL_MODULE').length).toBeGreaterThan(0);
    expect(screen.getByText('Package FUNCTIONAL_MODULE')).toBeVisible();
    expect(screen.getByText('Runtime OFFLINE')).toBeVisible();
    expect(screen.getByText('Registry REGISTERED')).toBeVisible();
    expect(screen.getByText('Stale runtime evidence')).toBeVisible();
    expect(screen.getByText('Observed kickoffLocal:commerceServer:node-a')).toBeVisible();
  });

  it('renders approval diagnostics for publication blockers', () => {
    render(
      <CapabilityReadinessPanel
        readiness={{
          capabilityCode: 'frameworkdocs',
          displayName: 'Framework docs',
          owningModule: 'nodics.docs',
          capabilityType: 'DOCUMENTATION_PACK',
          group: 'DOCUMENTATION_PACK',
          businessStatus: 'NEEDS_ATTENTION',
          technicalStatus: 'BLOCKED',
          approvalDiagnostic: {
            status: 'TASK_REFERENCE_MISSING',
            publicationState: 'PENDING_APPROVAL',
          },
          nextAction: 'Reconcile publication approval',
          dependencies: [
            {
              kind: 'PROCESS',
              code: 'publicationApproval',
              label: 'Governed publication approval',
              required: true,
              status: 'UNAVAILABLE',
              evidence: {
                approvalDiagnostic: {
                  status: 'TASK_REFERENCE_MISSING',
                  publicationState: 'PENDING_APPROVAL',
                },
              },
            },
          ],
          blockers: [
            {
              code: 'APPROVAL_TASK_MISSING',
              severity: 'REPAIR_REQUIRED',
              owner: 'process',
              message: 'Publication approval is pending but no Process task was found.',
              action: 'Reconcile publication approval',
              approvalDiagnostic: {
                status: 'TASK_REFERENCE_MISSING',
                publicationState: 'PENDING_APPROVAL',
                message: 'No actionable Process approval task was found.',
              },
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText('Approval TASK_REFERENCE_MISSING').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Publication PENDING_APPROVAL').length).toBeGreaterThan(0);
    expect(screen.getByText('Governed publication approval')).toBeVisible();
    expect(screen.getByText('No actionable Process approval task was found.')).toBeVisible();
  });
});
