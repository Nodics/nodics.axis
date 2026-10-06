/** Authored recovery fixtures; owner transport is mocked and joint acceptance remains deferred. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import { ApplicationRecoveryRoutePage } from '../../src/operations/enterprise/ApplicationRecoveryRoutePage';
import { invokeOperationalOwner } from '../../src/operations/shared/operationalOwnerClient';
import { runtime } from './registrationFixtures';
vi.mock('../../src/operations/shared/operationalOwnerClient', () => ({
  invokeOperationalOwner: vi.fn(),
}));
const bootstrap: AxisAuthenticatedBootstrap = {
  axisPolicy: {
    contractVersion: 0,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 1,
    source: 'DEFAULT',
  },
  navigation: [],
  environments: [],
  moduleCatalog: {},
  moduleConnections: {},
  documentationSources: [],
  tenantCode: 'businessTenant',
};
const code = 'enterpriseAccess_' + 'a'.repeat(64);
const presentation = Object.fromEntries(
  [
    'title',
    'inspectLabel',
    'reviewTitle',
    'RETRY_REVIEW_START',
    'RETRY_NOTIFICATION',
    'RETRY_REVIEW_RETIREMENT',
    'confirmLabel',
    'cancelLabel',
    'uncertainMessage',
  ].map((key) => [key, key]),
);
const application = {
  code,
  enterpriseCode: 'business',
  revision: 4,
  status: 'AWAITING_REVIEW',
  reviewStatus: 'STARTED',
  notificationStatus: 'NOT_REQUESTED',
  canRetireReview: false,
  reviewRetirementAttempts: [
    {
      attempt: 1,
      status: 'WITHDRAWN',
      closedAt: '2026-09-30T08:00:00Z',
      reviewStarted: true,
      canRetireReview: true,
    },
  ],
};
const recovery = { contractVersion: 1, owner: 'profile', application, presentation };
async function inspect() {
  const user = userEvent.setup();
  render(
    <ApplicationRecoveryRoutePage
      bootstrap={bootstrap}
      accessToken="fixture-token"
      runtime={runtime}
      title="Recovery"
    />,
  );
  await user.type(screen.getByRole('textbox', { name: 'Application' }), code);
  await user.click(screen.getByRole('button', { name: 'Inspect' }));
  return user;
}
afterEach(() => vi.resetAllMocks());
it('reviews one historical attempt and submits its identity with the current assignment revision once', async () => {
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce(recovery)
    .mockResolvedValueOnce({
      ...application,
      retirementStatus: 'RETIRED',
      retirementAttempt: 1,
    });
  const user = await inspect();
  await user.click(
    await screen.findByRole('button', { name: 'RETRY_REVIEW_RETIREMENT / #1' }),
  );
  expect(vi.mocked(invokeOperationalOwner)).toHaveBeenCalledTimes(1);
  expect(vi.mocked(invokeOperationalOwner).mock.calls[0]?.[2]).toBe(
    '/enterprise-access/applications/' + encodeURIComponent(code) + '/recovery',
  );
  await user.click(screen.getByRole('button', { name: 'confirmLabel' }));
  await waitFor(() =>
    expect(vi.mocked(invokeOperationalOwner)).toHaveBeenCalledTimes(2),
  );
  expect(vi.mocked(invokeOperationalOwner).mock.calls[1]?.[3]).toEqual({
    operation: 'RETRY_REVIEW_RETIREMENT',
    revision: 4,
    attempt: 1,
  });
  expect(vi.mocked(invokeOperationalOwner).mock.calls[1]?.[2]).toBe(
    '/enterprise-access/applications/' + encodeURIComponent(code) + '/actions',
  );
});
it('requires fresh inspection after an unconfirmed retirement without repeating the command', async () => {
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce(recovery)
    .mockResolvedValueOnce({ ...application, retirementStatus: 'UNCONFIRMED' });
  const user = await inspect();
  await user.click(
    await screen.findByRole('button', { name: 'RETRY_REVIEW_RETIREMENT / #1' }),
  );
  await user.click(screen.getByRole('button', { name: 'confirmLabel' }));
  await screen.findByText('uncertainMessage');
  expect(
    screen.queryByRole('button', { name: 'RETRY_REVIEW_RETIREMENT / #1' }),
  ).toBeNull();
  expect(vi.mocked(invokeOperationalOwner)).toHaveBeenCalledTimes(2);
});
it('rejects duplicate or malformed attempt selectors without enabling recovery', async () => {
  vi.mocked(invokeOperationalOwner).mockResolvedValueOnce({
    ...recovery,
    application: {
      ...application,
      reviewRetirementAttempts: [
        application.reviewRetirementAttempts[0],
        application.reviewRetirementAttempts[0],
      ],
    },
  });
  await inspect();
  await screen.findByText('Application recovery could not be confirmed.');
  expect(screen.queryByRole('button', { name: /RETRY_REVIEW_RETIREMENT/ })).toBeNull();
});
