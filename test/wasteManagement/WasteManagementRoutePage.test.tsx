import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { WasteManagementRoutePage } from '../../src/operations/wasteManagement/WasteManagementRoutePage';

function renderPage() {
  const navigation = {
    id: 'circa-waste-operations',
    moduleName: 'circa.eWaste',
    label: 'Circa Waste Operations',
    route: '/waste/assets',
    category: 'waste',
    icon: 'waste',
    order: 1545,
    availability: 'UP',
    featureState: 'PREVIEW',
    perspectives: [],
    contexts: [],
  } as const;

  return render(
    <WasteManagementRoutePage
      accessToken="token"
      bootstrap={{ navigation: [navigation], moduleConnections: {} } as never}
      employeeId="operator"
      navigation={navigation}
      runtime={{ enterpriseCode: 'default', requestTimeoutMs: 1000 } as never}
    />,
  );
}

describe('WasteManagementRoutePage', () => {
  it('renders waste approval workspace and approves selected evidence', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.getByRole('heading', { name: 'Circa Waste Operations' }),
    ).toBeVisible();
    expect(screen.getByText(/Review customer eWaste evidence/i)).toBeVisible();
    expect(screen.getByText('EWA-AX-1042')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(screen.getByText(/EWA-AX-1042 approved/i)).toBeVisible();
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
  });

  it('shows enterprise coupon management and publishes draft coupons', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('tab', { name: 'Coupon management' }));
    expect(screen.getByText(/EcoMart/)).toBeVisible();
    const publishButton = screen
      .getAllByRole('button', { name: 'Publish coupon' })
      .find((button) => !button.hasAttribute('disabled'));
    if (!publishButton) throw new Error('Expected a draft coupon publish button');
    await user.click(publishButton);

    expect(screen.getByText(/published through Promotion-owned coupon policy/i)).toBeVisible();
  });

  it('documents backend ownership contracts for the visual slice', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('tab', { name: 'Operation contracts' }));

    expect(screen.getByText('Create waste submission')).toBeVisible();
    expect(screen.getByText('Owner: Waste API')).toBeVisible();
    expect(screen.getByText('Credit wallet appreciation')).toBeVisible();
    expect(screen.getByText('Owner: Loyalty Wallet')).toBeVisible();
    expect(screen.getByText('Publish enterprise coupon')).toBeVisible();
    expect(screen.getByText('Owner: Promotion API')).toBeVisible();
  });
});
