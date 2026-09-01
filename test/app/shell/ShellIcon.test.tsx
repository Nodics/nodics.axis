import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ShellIcon } from '../../../src/app/shell/ShellIcon';

describe('ShellIcon', () => {
  it('renders a known backend icon key as an owned vector icon', () => {
    const { container } = render(<ShellIcon name="dashboard" />);

    expect(container.querySelector('svg path')).toHaveAttribute(
      'd',
      expect.stringContaining('M3 3'),
    );
  });

  it('uses the governed module fallback for unknown icon keys', () => {
    const { container } = render(<ShellIcon name="future-capability" />);

    expect(container.querySelector('svg path')).toHaveAttribute(
      'd',
      expect.stringContaining('M4 4'),
    );
  });

  it('renders the Waste accelerator icon from backend metadata', () => {
    const { container } = render(<ShellIcon name="waste" />);

    expect(container.querySelector('svg path')).toHaveAttribute(
      'd',
      expect.stringContaining('M7 3'),
    );
  });
});
