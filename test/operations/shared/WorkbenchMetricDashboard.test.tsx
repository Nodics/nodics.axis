import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, it } from 'vitest';
import { DashboardSection } from '../../../src/operations/shared/WorkbenchMetricDashboard';
import type { WorkbenchMetric } from '../../../src/operations/shared/workbenchMetricDashboardModel';

it.each([
  {
    loading: true,
    status: 'unavailable' as const,
    value: undefined,
    label: 'Checking availability',
  },
  { loading: false, status: 'ready' as const, value: 0, label: 'Available' },
  {
    loading: false,
    status: 'unavailable' as const,
    value: undefined,
    label: 'Unavailable',
  },
])(
  'distinguishes read availability from publication: $label',
  ({ loading, status, value, label }) => {
    const metric: WorkbenchMetric = {
      id: 'media',
      moduleName: 'media',
      schemaName: 'media',
      route: '/media/items',
      label: 'Media items',
      icon: 'media',
      description: 'Assets',
      detail: 'Authorized inventory',
      status,
      value,
      canOpen: true,
    };
    render(
      <MemoryRouter>
        <DashboardSection
          metrics={[metric]}
          loading={loading}
          title="Media inventory"
          description="Current records"
        />
      </MemoryRouter>,
    );
    for (const state of screen.getAllByText(label)) expect(state).toBeVisible();
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
    if (status === 'ready') expect(screen.getByText('0')).toBeVisible();
    else expect(screen.queryByText('0')).not.toBeInTheDocument();
  },
);
