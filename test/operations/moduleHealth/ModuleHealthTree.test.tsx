import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ModuleHealthSummary } from '../../../src/operations/moduleHealth/api/moduleHealthContracts';
import { ModuleHealthTree } from '../../../src/operations/moduleHealth/ModuleHealthTree';

const availability = {
  state: 'UP' as const,
  activeInstances: 1,
  healthyInstances: 1,
  unavailableInstances: 0,
  unknownInstances: 0,
};
const modules: readonly ModuleHealthSummary[] = [
  {
    moduleName: 'nodics.platform',
    displayName: 'Core Capabilities',
    moduleKind: 'group',
    environments: ['kickoffLocal'],
    servers: ['monoServer'],
    availability,
  },
  {
    moduleName: 'profile',
    displayName: 'Profile and Identity',
    parentModule: 'nodics.platform',
    canonicalIdentity: 'nodics.platform/modules/profile',
    moduleKind: 'capability',
    environments: ['kickoffLocal'],
    servers: ['monoServer'],
    availability,
  },
];

describe('ModuleHealthTree', () => {
  it('renders loader-owned hierarchy, toggles groups, and selects only concrete modules', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <ModuleHealthTree
        modules={modules}
        onSelect={onSelect}
        search=""
        stateColor={() => 'success'}
      />,
    );

    expect(screen.getByText('Core Capabilities')).toBeVisible();
    expect(screen.getByText('Profile and Identity')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Collapse Core Capabilities' }),
    );
    expect(screen.queryByText('Profile and Identity')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand Core Capabilities' }));
    await user.click(screen.getByText('Profile and Identity'));
    expect(onSelect).toHaveBeenCalledWith('profile');
  });

  it('keeps an ancestor visible when a descendant canonical path matches search', () => {
    render(
      <ModuleHealthTree
        modules={modules}
        onSelect={() => undefined}
        search="nodics.platform/modules/profile"
        stateColor={() => 'success'}
      />,
    );

    expect(screen.getByText('Core Capabilities')).toBeVisible();
    expect(screen.getByText('Profile and Identity')).toBeVisible();
  });

  it('expands selected module details inline and collapses them when selection clears', async () => {
    const { rerender } = render(
      <ModuleHealthTree
        modules={modules}
        onSelect={() => undefined}
        search=""
        selectedContent={<div>Runtime instance details</div>}
        selectedModule="profile"
        stateColor={() => 'success'}
      />,
    );

    expect(screen.getByText('Runtime instance details')).toBeVisible();
    expect(screen.getByText('Profile and Identity').closest('button')).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    rerender(
      <ModuleHealthTree
        modules={modules}
        onSelect={() => undefined}
        search=""
        selectedContent={<div>Runtime instance details</div>}
        stateColor={() => 'success'}
      />,
    );

    expect(screen.getByText('Profile and Identity').closest('button')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await waitForElementToBeRemoved(() =>
      screen.queryByText('Runtime instance details'),
    );
  });
});
