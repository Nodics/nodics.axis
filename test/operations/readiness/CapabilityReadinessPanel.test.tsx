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
              status: 'UNAVAILABLE',
              evidence: {
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
    expect(screen.getByText('Runtime OFFLINE')).toBeVisible();
    expect(screen.getByText('Registry REGISTERED')).toBeVisible();
    expect(screen.getByText('Stale runtime evidence')).toBeVisible();
    expect(screen.getByText('Observed kickoffLocal:commerceServer:node-a')).toBeVisible();
  });
});
