import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AxisMark } from '../../../src/app/shell/AxisMark';

describe('AxisMark', () => {
  it('renders the complete accessible wordmark', () => {
    const { container } = render(<AxisMark />);

    expect(screen.getByLabelText('Nodics Axis')).toBeInTheDocument();
    expect(screen.getByText('NODICS')).toBeInTheDocument();
    expect(screen.getByText('AXIS')).toBeInTheDocument();
    const glyph = container.querySelector('svg text');
    expect(glyph).toHaveTextContent('N');
    expect(glyph).toHaveAttribute('font-family', '"Times New Roman", Times, serif');
    expect(glyph).toHaveAttribute('font-weight', '400');
  });

  it('renders only the mark in compact navigation', () => {
    render(<AxisMark compact />);

    expect(screen.getByLabelText('Nodics Axis')).toBeInTheDocument();
    expect(screen.queryByText('NODICS')).not.toBeInTheDocument();
    expect(screen.queryByText('AXIS')).not.toBeInTheDocument();
  });
});
