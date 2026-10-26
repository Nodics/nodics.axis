import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { CouponAdministrativeReview } from '../../src/operations/promotions/CouponAdministrativeReview';
import {
  administrativeOffer,
  approveAdministrativeOffer,
} from '../../src/operations/promotions/couponAdministrativeClient';
import { searchProfileParticipantEnterprises } from '../../src/operations/shared/profileParticipantLookup';
import {
  couponLabels,
  type CouponWorkspace,
} from '../../src/operations/promotions/couponOfferClient';
import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from '../../src/operations/shared/operationalOwnerClient';
vi.mock('../../src/operations/shared/operationalOwnerClient', () => ({
  invokeOperationalOwner: vi.fn(),
}));
const c: OperationalOwnerConfiguration = {
  bootstrap: {
    tenantCode: 'default',
    moduleConnections: {},
    navigation: [],
    moduleCatalog: {},
    environments: [],
    documentationSources: [],
    axisPolicy: {
      contractVersion: 1,
      screenLockEnabled: false,
      idleTimeoutSeconds: 900,
      recentNavigationLimit: 10,
      revision: 1,
      source: 'DEFAULT',
    },
  },
  accessToken: 'original-admin',
  enterpriseCode: 'default',
  timeoutMs: 1000,
  ownerSelector: { runtimeRoleCode: 'COMMERCE_STAGED', publicationRole: 'STAGED' },
};
const labels = Object.fromEntries(
  couponLabels.map((key) => [key, key]),
) as CouponWorkspace['labels'];
labels.submittedBy = 'Submitted by';
labels.submittedAt = 'Submitted at';
const capability = {
  contractVersion: 1,
  crossEnterpriseReview: true,
  labels: {
    administrativeReview: 'Administrative review',
    issuerEnterpriseCode: 'Issuer enterprise',
    reviewOffer: 'Review offer',
    approve: 'Approve',
    reasonCode: 'Reason',
    confirmApproval: 'Confirm approval',
  },
  review: {
    method: 'POST',
    route: '/promotions/:promotionCode/administrative-review',
    targetField: 'issuerEnterpriseCode',
  },
};
const raw = {
  code: 'offer',
  name: 'Offer',
  status: 'SUBMITTED',
  issuerEnterpriseCode: 'retail',
  versionId: 2,
  revision: 2,
  approval: { submittedBy: 'retail-operator', submittedAt: '2026-10-23T08:30:00.000Z' },
  budget: { limit: '3000' },
  actions: { discountType: 'FIXED', discountAmount: '5' },
  conditions: { sourceProductCode: 'product' },
  couponOffer: {
    version: 1,
    supply: { mode: 'UNLIMITED' },
    expiry: { mode: 'NONE' },
    requirements: {
      type: 'CERTIFICATES',
      certificates: { quantity: 1, categoryCode: 'phone', milestoneCode: 'RECYCLED' },
    },
    terms: ['One use'],
  },
  lifecycleActions: [
    {
      actionCode: 'APPROVE',
      labelKey: 'approve',
      method: 'POST',
      route: '/promotions/offer/administrative-approve',
      issuerEnterpriseCode: 'retail',
      expectedVersionId: 2,
      expectedRevision: 2,
    },
  ],
};
const approved = {
  ...raw,
  status: 'APPROVED',
  versionId: 3,
  revision: 3,
  lifecycleActions: [],
  approval: {
    approvedBy: 'admin',
    administrativeReview: {
      actorCode: 'admin',
      actorEnterpriseCode: 'default',
      issuerEnterpriseCode: 'retail',
      tenant: 'default',
    },
  },
};
afterEach(() => vi.resetAllMocks());
function fixture() {
  let done = false;
  vi.mocked(invokeOperationalOwner).mockImplementation((_c, _m, path) => {
    if (path.endsWith('/capabilities')) return Promise.resolve(capability);
    if (path === '/participants/search')
      return Promise.resolve({
        contractVersion: 1,
        tenant: 'default',
        items: [
          { ownerType: 'ENTERPRISE', ownerCode: 'retail', displayName: 'Retail' },
        ],
      });
    if (path.endsWith('/administrative-approve')) {
      done = true;
      return Promise.resolve({ promotion: approved });
    }
    return Promise.resolve(done ? approved : raw);
  });
}
async function openReview() {
  const user = userEvent.setup();
  render(<CouponAdministrativeReview configuration={c} labels={labels} />);
  await user.type(
    await screen.findByRole('combobox', { name: 'Issuer enterprise' }),
    'Retail',
  );
  await user.click(await screen.findByRole('option', { name: 'Retail (retail)' }));
  await user.type(screen.getByRole('textbox', { name: 'Review offer' }), 'offer');
  await user.click(screen.getByRole('button', { name: 'Review offer' }));
  await screen.findByText('code: offer · Offer · SUBMITTED');
  expect(screen.getByText('Submitted by: retail-operator')).toBeVisible();
  expect(
    document.querySelector('time[datetime="2026-10-23T08:30:00.000Z"]'),
  ).toBeVisible();
  return user;
}
it('reviews and approves exact issuer while preserving original identity and displaying owner audit', async () => {
  fixture();
  const user = await openReview();
  await user.click(screen.getByRole('button', { name: 'Approve' }));
  expect(screen.getByRole('button', { name: 'Confirm approval' })).toBeDisabled();
  await user.type(screen.getByRole('textbox', { name: 'Reason' }), 'Reviewed terms');
  await user.click(screen.getByRole('button', { name: 'Confirm approval' }));
  await screen.findByText('code: offer · Offer · APPROVED');
  await screen.findByText('Actor: admin · Enterprise: default · Issuer: retail');
  const call = vi
    .mocked(invokeOperationalOwner)
    .mock.calls.find((row) => row[2].endsWith('/administrative-approve'))!;
  expect(call[0]).toBe(c);
  expect(call[3]).toEqual({
    issuerEnterpriseCode: 'retail',
    expectedVersionId: 2,
    expectedRevision: 2,
    reasonCode: 'Reviewed terms',
  });
  expect(
    vi
      .mocked(invokeOperationalOwner)
      .mock.calls.filter((row) => row[2].endsWith('/administrative-review')),
  ).toHaveLength(2);
});
it('changing offer clears inspection and does not approve stale content', async () => {
  fixture();
  const user = await openReview();
  await user.type(screen.getByRole('textbox', { name: 'Review offer' }), '-other');
  expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  expect(screen.queryByText('code: offer · Offer · SUBMITTED')).not.toBeInTheDocument();
});
it('capability refusal keeps own scope independent and exposes no target picker', async () => {
  vi.mocked(invokeOperationalOwner).mockRejectedValue(new Error('denied'));
  render(<CouponAdministrativeReview configuration={c} labels={labels} />);
  await screen.findByText('Administrative review is unavailable.');
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(invokeOperationalOwner).toHaveBeenCalledTimes(1);
});

it('equivalent bootstrap refresh preserves typed issuer, focus and directory results while capabilities refresh', async () => {
  fixture();
  const user = userEvent.setup();
  const first: OperationalOwnerConfiguration = {
    ...c,
    bootstrap: {
      ...c.bootstrap,
      moduleConnections: {
        promotion: [
          {
            moduleName: 'promotion',
            instanceId: 'staged',
            endpoint: 'https://promotion.test',
            environment: 'local',
            state: 'UP',
            runtimeRole: { code: 'COMMERCE_STAGED', publication: 'STAGED' },
          },
        ],
      },
      navigation: [
        {
          id: 'coupon-offer-authoring',
          label: 'Coupon Offers',
          route: '/commerce/coupon-offers',
          order: 1,
          moduleName: 'promotion',
          category: 'commerce',
          icon: 'commerce',
          availability: 'UP',
          featureState: 'ACTIVE',
          backendWorkspace: {
            title: 'Coupon Offers',
            tabs: [],
            contractVersion: 1,
            renderer: 'axis.workspace.native',
            workspaceCode: 'promotion.couponOffers',
            viewCode: 'authoring',
            ownerSelector: {
              runtimeRoleCode: 'COMMERCE_STAGED',
              publicationRole: 'STAGED',
            },
          },
        },
      ],
    },
  };
  const { rerender } = render(
    <CouponAdministrativeReview configuration={first} labels={labels} />,
  );
  const input = await screen.findByRole('combobox', { name: 'Issuer enterprise' });
  await user.type(input, 'GREENPERKS');
  await screen.findByRole('option', { name: 'Retail (retail)' });
  let finish!: (value: unknown) => void;
  vi.mocked(invokeOperationalOwner).mockImplementation((_c, _m, path) =>
    path.endsWith('/capabilities')
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : Promise.resolve({
          contractVersion: 1,
          tenant: 'default',
          items: [
            {
              ownerType: 'ENTERPRISE',
              ownerCode: 'GREENPERKS_RETAIL',
              displayName: 'GreenPerks Retail',
            },
          ],
        }),
  );
  const refreshed = {
    ...first,
    bootstrap: {
      ...first.bootstrap,
      moduleConnections: {
        promotion: first.bootstrap.moduleConnections.promotion!.map((connection) => ({
          ...connection,
          state: 'DEGRADED' as const,
          checkedAt: 'new-health-time',
        })),
      },
      navigation: first.bootstrap.navigation.map((item) => ({
        ...item,
        label: 'Updated presentation',
        availability: 'DEGRADED' as const,
        checkedAt: 'new-poll-time',
      })),
    },
  };
  rerender(<CouponAdministrativeReview configuration={refreshed} labels={labels} />);
  expect(screen.getByRole('combobox', { name: 'Issuer enterprise' })).toBe(input);
  expect(input).toHaveValue('GREENPERKS');
  expect(input).toHaveFocus();
  await user.click(
    await screen.findByRole('option', {
      name: 'GreenPerks Retail (GREENPERKS_RETAIL)',
    }),
  );
  await act(async () => {
    finish(capability);
    await Promise.resolve();
  });
  expect(screen.getByRole('combobox', { name: 'Issuer enterprise' })).toHaveValue(
    'GreenPerks Retail (GREENPERKS_RETAIL)',
  );
});

it.each(['token', 'tenant', 'enterprise', 'owner'] as const)(
  'real %s changes clear issuer and pending confirmation',
  async (dimension) => {
    fixture();
    const user = userEvent.setup();
    const { rerender } = render(
      <CouponAdministrativeReview configuration={c} labels={labels} />,
    );
    await user.type(
      await screen.findByRole('combobox', { name: 'Issuer enterprise' }),
      'Retail',
    );
    await user.click(await screen.findByRole('option', { name: 'Retail (retail)' }));
    await user.type(screen.getByRole('textbox', { name: 'Review offer' }), 'offer');
    await user.click(screen.getByRole('button', { name: 'Review offer' }));
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const next: OperationalOwnerConfiguration = { ...c, bootstrap: { ...c.bootstrap } };
    if (dimension === 'token') next.accessToken = 'new-session';
    if (dimension === 'tenant')
      next.bootstrap = { ...next.bootstrap, tenantCode: 'another' };
    if (dimension === 'enterprise') next.enterpriseCode = 'another';
    if (dimension === 'owner')
      next.bootstrap = {
        ...next.bootstrap,
        moduleConnections: {
          profile: [
            {
              moduleName: 'profile',
              instanceId: 'replacement',
              endpoint: 'https://new-profile.test',
              environment: 'local',
              state: 'UP',
            },
          ],
        },
      };
    rerender(<CouponAdministrativeReview configuration={next} labels={labels} />);
    expect(
      await screen.findByRole('combobox', { name: 'Issuer enterprise' }),
    ).toHaveValue('');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  },
);

it('clearing target retires pending reads and cannot restore the previous review', async () => {
  fixture();
  const user = await openReview();
  let finish!: (value: unknown) => void;
  vi.mocked(invokeOperationalOwner).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await user.click(screen.getByRole('button', { name: 'Review offer' }));
  const pending = vi.mocked(invokeOperationalOwner).mock.calls.at(-1)?.[5]?.signal;
  await user.click(screen.getByRole('combobox', { name: 'Issuer enterprise' }));
  await user.click(screen.getByRole('button', { name: 'Clear' }));
  expect(pending?.aborted).toBe(true);
  await act(async () => {
    finish(raw);
    await Promise.resolve();
  });
  expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  expect(screen.queryByText('code: offer · Offer · SUBMITTED')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('rejects foreign targets, unsafe actions and foreign directory data', async () => {
  expect(() =>
    administrativeOffer(
      { ...raw, issuerEnterpriseCode: 'other' },
      'retail',
      'offer',
      'default',
    ),
  ).toThrow();
  expect(() =>
    administrativeOffer(
      {
        ...raw,
        lifecycleActions: [{ ...raw.lifecycleActions[0], route: 'https://evil.test' }],
      },
      'retail',
      'offer',
      'default',
    ),
  ).toThrow();
  vi.mocked(invokeOperationalOwner).mockResolvedValue({
    contractVersion: 1,
    tenant: 'foreign',
    items: [],
  });
  await expect(searchProfileParticipantEnterprises(c, 'Retail')).rejects.toThrow();
});
it('failed approval is never retried automatically and requires target readback', async () => {
  fixture();
  const user = await openReview();
  vi.mocked(invokeOperationalOwner).mockRejectedValue(new Error('Access denied'));
  await user.click(screen.getByRole('button', { name: 'Approve' }));
  await user.type(screen.getByRole('textbox', { name: 'Reason' }), 'Reviewed');
  await user.click(screen.getByRole('button', { name: 'Confirm approval' }));
  await screen.findByText('Access denied');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled(),
  );
  expect(
    vi
      .mocked(invokeOperationalOwner)
      .mock.calls.filter((row) => row[2].endsWith('/administrative-approve')),
  ).toHaveLength(1);
});
it('approval acknowledgement without fresh audited readback is not success', async () => {
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce({ promotion: approved })
    .mockResolvedValueOnce(raw);
  await expect(
    approveAdministrativeOffer(
      c,
      administrativeOffer(raw, 'retail', 'offer', 'default'),
      'Reviewed',
    ),
  ).rejects.toThrow();
});
