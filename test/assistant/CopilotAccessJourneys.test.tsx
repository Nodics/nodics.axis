/** @file Verifies inert access remediation and fail-closed diagnostic parsing. */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CopilotAccessJourneys } from '../../src/assistant/CopilotAccessJourneys';
import { parseCopilotAccessJourneys } from '../../src/assistant/api/copilotContextClient';

const fixture = {
  contractVersion: 1,
  title: 'Operation access',
  notice: 'Owner checks still apply.',
  items: [
    {
      code: 'enterprise',
      label: 'Create enterprise',
      state: 'PERMISSION_REQUIRED',
      stateLabel: 'Permission required',
      reason: 'A domain grant is missing.',
      nextStep: 'Ask the Profile administrator to review enterprise access.',
      missingPermissions: ['profile.enterprise.create'],
    },
  ],
};
describe('Operation access explanations', () => {
  it('shows expandable owner guidance without any executable command or link', () => {
    render(<CopilotAccessJourneys value={parseCopilotAccessJourneys(fixture)} />);
    fireEvent.click(screen.getByText('Operation access'));
    fireEvent.click(screen.getByText('Create enterprise'));
    expect(screen.getByText('A domain grant is missing.')).toBeVisible();
    expect(screen.getByText('profile.enterprise.create')).toBeVisible();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
  it('rejects fabricated authorization states and drops returned execution payloads', () => {
    expect(() =>
      parseCopilotAccessJourneys({
        ...fixture,
        items: [{ ...fixture.items[0], state: 'AUTHORIZED' }],
      }),
    ).toThrow();
    expect(() =>
      parseCopilotAccessJourneys({
        ...fixture,
        items: [...fixture.items, ...fixture.items],
      }),
    ).toThrow();
    const value = parseCopilotAccessJourneys({
      ...fixture,
      items: [{ ...fixture.items[0], execute: '/grant', secret: 'omit' }],
    });
    expect(value.items[0]).not.toHaveProperty('execute');
    expect(value.items[0]).not.toHaveProperty('secret');
  });
});
