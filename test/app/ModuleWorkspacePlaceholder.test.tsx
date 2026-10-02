/** Owner-readiness presentation only; no runtime or registration authority. */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModuleWorkspacePlaceholder } from '../../src/app/ModuleWorkspacePlaceholder';
import type { AxisNavigationItem } from '../../src/bootstrap/publicBootstrap';

const item: AxisNavigationItem = {
  id: 'example-capability',
  label: 'Example capability',
  route: '/example',
  moduleName: 'example',
  category: 'platform',
  icon: 'module',
  order: 1,
  availability: 'UP',
  featureState: 'ACTIVE',
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Generic module workspace readiness', () => {
  it('reports backend-disabled readiness even when the module is UP', () => {
    const transport = vi.fn();
    vi.stubGlobal('fetch', transport);
    render(<ModuleWorkspacePlaceholder item={{ ...item, featureState: 'DISABLED' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This workspace is disabled in the selected runtime.',
    );
    expect(screen.getByText('DISABLED')).toBeInTheDocument();
    expect(screen.getByText('Module health: UP')).toBeInTheDocument();
    expect(screen.queryByText(/renderer is not implemented/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(transport).not.toHaveBeenCalled();
  });

  it('distinguishes active unsupported renderers from disabled capabilities', () => {
    render(<ModuleWorkspacePlaceholder item={item} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'renderer is not implemented yet',
    );
    expect(
      screen.queryByText(/disabled in the selected runtime/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('DISABLED')).not.toBeInTheDocument();
  });
});
