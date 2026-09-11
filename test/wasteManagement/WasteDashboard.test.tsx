import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { WasteDashboard } from '../../src/operations/wasteManagement/WasteDashboard';
const props = {
  data: null,
  counts: { ALL: 42, OPEN: 12, APPROVED: 22, REJECTED: 8 },
  labels: {
    filters: 'Refine your view',
    dateFrom: 'Submitted from',
    dateTo: 'Submitted until',
    apply: 'Apply filters',
    reset: 'Clear filters',
    total: 'Total submissions',
    pending: 'Awaiting review',
    approved: 'Approved',
    rejected: 'Rejected',
    trend: 'Submission activity',
    distribution: 'Review outcomes',
    family: 'Waste family',
    centre: 'Collection centre',
    area: 'Area / city',
    channel: 'Channel',
    size: 'Handling size',
    all: 'All',
  },
  filters: {},
  appliedFilters: {},
  setFilters: vi.fn(),
  apply: vi.fn(),
  reset: vi.fn(),
  onStatus: vi.fn(),
  busy: false,
};
it('uses the full shared refinement on dashboards without repeated outcomes', async () => {
  render(<WasteDashboard {...props} showSummary />);
  const user = userEvent.setup();
  const toggle = screen.getByRole('button', { name: 'Refine your view' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await user.click(toggle);
  expect(screen.getByLabelText('Submitted from')).toBeVisible();
  for (const label of [
    'Waste family',
    'Collection centre',
    'Area / city',
    'Channel',
    'Handling size',
  ]) {
    expect(screen.getByRole('combobox', { name: label })).toBeVisible();
  }
  expect(screen.getByText('42')).toBeVisible();
  expect(screen.getByText('Submission activity')).toBeVisible();
  expect(screen.queryByText('Review outcomes')).not.toBeInTheDocument();
});
it('keeps the refinement accordion on operational views without dashboard cards', () => {
  render(<WasteDashboard {...props} showSummary={false} />);
  expect(screen.getByRole('button', { name: 'Refine your view' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  expect(screen.queryByText('Total submissions')).not.toBeInTheDocument();
});
