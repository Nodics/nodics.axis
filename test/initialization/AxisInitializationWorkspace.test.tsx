import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AxisInitializationWorkspace } from '../../src/initialization/AxisInitializationWorkspace';
import { BundledLoginPage } from '../../src/initialization/BundledLoginPage';

describe('bundled Axis initialization experience', () => {
  it('authenticates through the supplied existing Profile action without storing credentials', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    render(<BundledLoginPage onLogin={onLogin} />);
    await user.type(screen.getByLabelText(/Login ID/), 'admin');
    await user.type(screen.getByLabelText(/Password/), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onLogin).toHaveBeenCalledWith('admin', 'secret');
    expect(window.localStorage).toHaveLength(0);
  });

  it('offers initiation only before submission and exposes refresh while approval is pending', async () => {
    const user = userEvent.setup();
    const onInitiate = vi.fn();
    const onRefresh = vi.fn();
    const base = {
      baselineCode: 'axis',
      releaseCode: 'axis:axisBaseline',
      releaseVersion: '1.0.0',
      releaseStatus: 'CURRENT',
    } as const;
    const view = render(
      <AxisInitializationWorkspace
        busy={false}
        onInitiate={onInitiate}
        onLogout={vi.fn()}
        onRefresh={onRefresh}
        status={{ ...base, readiness: 'IMPORTED' }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Initialize and submit' }));
    expect(onInitiate).toHaveBeenCalledOnce();
    view.rerender(
      <AxisInitializationWorkspace
        busy={false}
        onInitiate={onInitiate}
        onLogout={vi.fn()}
        onRefresh={onRefresh}
        status={{
          ...base,
          readiness: 'PUBLICATION_PENDING',
          publication: { code: 'publication', state: 'PENDING_APPROVAL', revision: 2 },
        }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Initialize and submit' })).toBeNull();
    expect(screen.getByText(/normal Process approval/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Refresh status' }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
