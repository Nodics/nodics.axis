/** Authored Digital Core notification fixtures; frozen message retry remains an owner decision. NOT RUN. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import { OrderNotificationRoutePage } from '../../src/operations/notifications/OrderNotificationRoutePage';
import { invokeOperationalOwner } from '../../src/operations/shared/operationalOwnerClient';
import { runtime } from './registrationFixtures';
vi.mock('../../src/operations/shared/operationalOwnerClient', () => ({
  invokeOperationalOwner: vi.fn(),
}));
const fields = {
  kind: {
    name: 'kind',
    label: 'Event',
    type: 'SELECT',
    required: true,
    options: ['PURCHASED', 'REFUNDED'],
  },
  revision: {
    name: 'expectedRevision',
    label: 'Order revision',
    type: 'NUMBER',
    required: true,
    hidden: true,
    valueFromRecord: 'orderRevision',
  },
  confirmed: {
    name: 'confirmed',
    label: 'Confirm retry',
    type: 'BOOLEAN',
    required: true,
  },
};
const workspace = {
  contractVersion: 1,
  workspaceCode: 'commerce.orderNotifications',
  viewCode: 'orderNotifications.detail',
  featureState: 'ACTIVE',
  orderCode: 'order-1',
  orderRevision: 2,
  financialState: 'COMPLETED',
  presentation: { title: 'Order Notifications' },
  events: [
    {
      kind: 'PURCHASED',
      status: 'INSPECTED',
      retryEligible: true,
      outcomes: [
        {
          channel: 'EMAIL',
          intentCode: 'COMM_' + 'a'.repeat(64),
          status: 'ACCEPTED',
          revision: 1,
          observed: true,
        },
      ],
    },
    { kind: 'REFUNDED', status: 'NO_SOURCE_EVENT', retryEligible: false, outcomes: [] },
  ],
  commands: [
    {
      id: 'inspect',
      label: 'Inspect Notification',
      ownerModule: 'digitalCore',
      handlerAction: 'inspect',
      operationRoute: '/orders/:code/notifications/inspect',
      httpMethod: 'POST',
      inputFields: [fields.kind],
      confirmationRequired: false,
      enabled: true,
      eligibleKinds: ['PURCHASED', 'REFUNDED'],
    },
    {
      id: 'retry',
      label: 'Retry Original Notification',
      ownerModule: 'digitalCore',
      handlerAction: 'retry',
      operationRoute: '/orders/:code/notifications/retry',
      httpMethod: 'POST',
      inputFields: [fields.kind, fields.revision, fields.confirmed],
      confirmationRequired: true,
      enabled: true,
      eligibleKinds: ['PURCHASED'],
    },
  ],
};
async function lookup() {
  const user = userEvent.setup();
  render(
    <OrderNotificationRoutePage
      bootstrap={{} as AxisAuthenticatedBootstrap}
      accessToken="fixture-token"
      runtime={runtime}
      title="Notifications"
    />,
  );
  await user.type(screen.getByRole('textbox', { name: 'Order reference' }), 'order-1');
  await user.click(screen.getByRole('button', { name: 'Inspect' }));
  await screen.findByText('PURCHASED / INSPECTED');
  return user;
}
afterEach(() => vi.resetAllMocks());
it('reviews an owner-eligible original retry with exact order revision and no recipient or intent selector', async () => {
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce(workspace)
    .mockResolvedValueOnce({
      status: 'REQUESTED',
      outcomes: [
        { intentCode: 'COMM_' + 'a'.repeat(64), status: 'RETRY_PENDING', revision: 2 },
      ],
    });
  const user = await lookup();
  expect(screen.getByText('order-1 / COMPLETED / 2')).toBeVisible();
  await user.click(
    screen.getAllByRole('button', { name: 'Retry Original Notification' })[0]!,
  );
  expect(invokeOperationalOwner).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Confirm retry' }));
  await screen.findByText(/Retry was requested/);
  expect(vi.mocked(invokeOperationalOwner).mock.calls[1]?.[2]).toBe(
    '/orders/order-1/notifications/retry',
  );
  expect(vi.mocked(invokeOperationalOwner).mock.calls[1]?.[3]).toEqual({
    kind: 'PURCHASED',
    expectedRevision: 2,
    confirmed: true,
  });
  expect(
    screen.queryByRole('button', { name: 'Retry Original Notification' }),
  ).toBeNull();
});
it('clears actionable state on uncertainty and does not automatically repeat a notification', async () => {
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce(workspace)
    .mockResolvedValueOnce({ status: 'UNCONFIRMED' });
  const user = await lookup();
  await user.click(
    screen.getAllByRole('button', { name: 'Retry Original Notification' })[0]!,
  );
  await user.click(screen.getByRole('button', { name: 'Confirm retry' }));
  await screen.findByText(/notification outcome is unconfirmed/);
  expect(invokeOperationalOwner).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
it('rejects executable or alternate transport metadata rather than attaching credentials to it', async () => {
  vi.mocked(invokeOperationalOwner).mockResolvedValueOnce({
    ...workspace,
    commands: workspace.commands.map((command) => ({
      ...command,
      operationRoute: 'https://untrusted.example.test/send',
    })),
  });
  const user = userEvent.setup();
  render(
    <OrderNotificationRoutePage
      bootstrap={{} as AxisAuthenticatedBootstrap}
      accessToken="fixture-token"
      runtime={runtime}
      title="Notifications"
    />,
  );
  await user.type(screen.getByRole('textbox', { name: 'Order reference' }), 'order-1');
  await user.click(screen.getByRole('button', { name: 'Inspect' }));
  await screen.findByText('Order notifications could not be confirmed.');
  expect(invokeOperationalOwner).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByRole('button', { name: 'Retry Original Notification' }),
  ).toBeNull();
});
