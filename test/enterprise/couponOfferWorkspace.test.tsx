/** Isolated owner-contract UI tests. No runtime, database, browser server or provider calls. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import { CouponOfferWorkspace } from '../../src/operations/promotions/CouponOfferWorkspace';
import { CouponAcquisitionReportPanel } from '../../src/operations/promotions/CouponAcquisitionReportPanel';
import {
  acquisitionReport,
  couponLabels,
  couponRecord,
  couponWorkspace,
  createCoupon,
  type CouponWorkspace as Workspace,
} from '../../src/operations/promotions/couponOfferClient';
import { invokeOperationalOwner } from '../../src/operations/shared/operationalOwnerClient';
import { runtime } from './registrationFixtures';
vi.mock('../../src/operations/shared/operationalOwnerClient', () => ({
  invokeOperationalOwner: vi.fn(),
}));
vi.mock('../../src/bootstrap/publicBootstrap', () => ({
  selectModuleConnection: () => ({
    endpoint: 'https://fixture.example.test/promotion',
    instanceId: 'staged',
    state: 'UP',
  }),
}));
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

const presentation: Workspace = {
  contractVersion: 1,
  canCreate: true,
  labels: Object.fromEntries(
    couponLabels.map((key) => [key, key]),
  ) as Workspace['labels'],
  benefitOptions: [
    { value: 'PERCENT', label: 'Percent' },
    { value: 'FIXED', label: 'Fixed' },
    { value: 'ITEM', label: 'Item' },
  ],
  requirementOptions: [
    { value: 'REWARDS', label: 'Rewards' },
    { value: 'CERTIFICATES', label: 'Certificates' },
    { value: 'BOTH', label: 'Both' },
  ],
  limits: {
    maximumCertificates: 100,
    maximumTerms: 30,
    maximumTermLength: 1000,
    maximumPolicyBytes: 65536,
    maximumParticipants: 100,
    maximumStores: 100,
    reservationSeconds: 900,
    maximumReservationSeconds: 3600,
  },
};
const record = {
  code: 'offer',
  name: 'Original',
  status: 'DRAFT',
  revision: 1,
  versionId: 0,
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
};
const bootstrap = {
  tenantCode: 'tenant',
  navigation: [
    {
      moduleName: 'promotion',
      route: '/commerce/coupon-offers',
      featureState: 'ACTIVE',
      availability: 'UP',
      backendWorkspace: {
        workspaceCode: 'promotion.couponOffers',
        viewCode: 'authoring',
      },
    },
    {
      moduleName: 'promotion',
      route: '/commerce/coupon-acquisition',
      featureState: 'ACTIVE',
      availability: 'UP',
      backendWorkspace: {
        workspaceCode: 'promotion.couponAcquisition',
        viewCode: 'reporting',
      },
    },
  ],
} as unknown as AxisAuthenticatedBootstrap;
const props = { bootstrap, accessToken: 'fixture-token', runtime };

it('requires complete owner metadata and rejects acknowledged or foreign saved-record responses', () => {
  expect(couponWorkspace(presentation)).toEqual(presentation);
  expect(() => couponWorkspace({ ...presentation, labels: {} })).toThrow();
  expect(() => couponWorkspace({ ...presentation, limits: {} })).toThrow();
  expect(() =>
    couponRecord({ acknowledged: true, matchedCount: 1 }, 'offer'),
  ).toThrow();
  expect(() => couponRecord({ ...record, code: 'foreign' }, 'offer')).toThrow();
});

it('only inspects saved promises and prefill creates an unsaved identity without copying live state', async () => {
  vi.mocked(invokeOperationalOwner).mockImplementation(
    (_configuration, _module, path) =>
      Promise.resolve(path.endsWith('/workspace') ? presentation : record),
  );
  const user = userEvent.setup();
  render(<CouponOfferWorkspace {...props} />);
  await user.type(await screen.findByRole('textbox', { name: 'code' }), 'offer');
  await user.click(screen.getByRole('button', { name: 'inspect' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'value' })).toHaveValue('5'),
  );
  expect(screen.getByRole('textbox', { name: 'value' })).toBeDisabled();
  expect(screen.getByRole('checkbox', { name: 'unlimited' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'prefill' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'code' })).toHaveValue(''),
  );
  expect(screen.getByRole('textbox', { name: 'value' })).toBeEnabled();
  expect(screen.queryByText(/offer · DRAFT/)).not.toBeInTheDocument();
  expect(
    vi.mocked(invokeOperationalOwner).mock.calls.every((call) => call[4] === undefined),
  ).toBe(true);
});

it('creation is explicitly reviewed and an uncertain write cannot be repeated automatically', async () => {
  vi.mocked(invokeOperationalOwner).mockResolvedValue(presentation);
  const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('network failure'));
  vi.stubGlobal('fetch', fetcher);
  const user = userEvent.setup();
  render(<CouponOfferWorkspace {...props} />);
  await user.type(await screen.findByRole('textbox', { name: 'code' }), 'new-offer');
  await user.type(screen.getByRole('textbox', { name: 'name' }), 'New offer');
  await user.type(screen.getByRole('textbox', { name: 'product' }), 'product');
  await user.click(screen.getByRole('combobox', { name: 'benefit' }));
  await user.click(screen.getByRole('option', { name: 'Fixed' }));
  await user.type(screen.getByRole('textbox', { name: 'value' }), '5');
  for (const name of ['unlimited', 'noExpiry', 'allStores'])
    await user.click(screen.getByRole('checkbox', { name }));
  await user.click(screen.getByRole('combobox', { name: 'requirements' }));
  await user.click(screen.getByRole('option', { name: 'Certificates' }));
  await user.type(screen.getByRole('spinbutton', { name: 'certificates' }), '1');
  await user.type(screen.getByRole('textbox', { name: 'category' }), 'phone');
  await user.type(screen.getByRole('textbox', { name: 'milestone' }), 'RECYCLED');
  await user.click(screen.getByRole('button', { name: 'review' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'confirm' }));
  await screen.findByText('uncertain');
  expect(fetcher).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'review' })).toBeDisabled();
  const body = JSON.parse(fetcher.mock.calls[0]![1]?.body as string) as {
    couponOffer: { requirements: { type: string; priceRef?: string } };
    tenant?: string;
    ownerId?: string;
  };
  expect(body.couponOffer.requirements.type).toBe('CERTIFICATES');
  expect(body.couponOffer.requirements.priceRef).toBeUndefined();
  expect(body.tenant).toBeUndefined();
  expect(body.ownerId).toBeUndefined();
});

it('creation uses PUT once and requires fresh persisted inspection, never submitted fields as success', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        data: { code: 'offer', status: 'DRAFT', revision: 1, versionId: 0 },
      }),
      { status: 200 },
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  vi.mocked(invokeOperationalOwner).mockResolvedValue(record);
  await createCoupon(
    { bootstrap, accessToken: 'token', enterpriseCode: 'enterprise', timeoutMs: 1000 },
    { ...record, couponOffer: couponRecord(record, 'offer').couponOffer },
  );
  expect(fetcher.mock.calls[0]![1]?.method).toBe('PUT');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(vi.mocked(invokeOperationalOwner).mock.calls[0]?.[2]).toBe(
    '/promotions/offer/coupon-offer',
  );
});

it('aggregate rendering preserves protected cells and refuses unprotected malformed counts', async () => {
  const selection = {
    promotionCode: 'offer',
    view: 'ISSUER' as const,
    channelCode: 'circa',
    scope: { type: 'ENTERPRISE' as const, code: 'platform' },
    period: { fromDate: null, toDate: null },
    breakdown: 'NONE' as const,
  };
  const protectedReport = {
    ...selection,
    contractVersion: 2,
    meaning: 'NEW_OR_RETURNING_THROUGH_CHANNEL',
    scope: { ...selection.scope, basis: 'SIGNED_ENTERPRISE' },
    rows: [],
    status: 'AVAILABLE',
    view: 'ISSUER',
    channelCode: 'circa',
    timezone: 'UTC',
    protected: true,
    counts: {
      issuances: null,
      purchases: null,
      redemptions: null,
      distinctOwners: null,
      newThroughChannel: null,
      returningThroughChannel: null,
      unknown: null,
    },
    rates: Object.fromEntries(
      [
        'redemptionRate',
        'newThroughChannelRate',
        'returningThroughChannelRate',
        'unknownRate',
      ].map((key) => [key, { numerator: null, denominator: null, percent: null }]),
    ),
    dataUpdatedThrough: '2026-10-18T00:00:00.000Z',
  };
  expect(() =>
    acquisitionReport(
      { ...protectedReport, counts: { purchases: 0, redemptions: null } },
      selection,
    ),
  ).toThrow();
  expect(() =>
    acquisitionReport({ ...protectedReport, view: 'REDEEMER' }, selection),
  ).toThrow();
  vi.mocked(invokeOperationalOwner).mockImplementation(
    (_configuration, _module, path) =>
      Promise.resolve(path.endsWith('/workspace') ? presentation : protectedReport),
  );
  const user = userEvent.setup();
  render(<CouponAcquisitionReportPanel {...props} />);
  await user.type(await screen.findByRole('textbox', { name: 'code' }), 'offer');
  await user.type(screen.getByRole('textbox', { name: 'channel' }), 'circa');
  await user.click(screen.getByRole('button', { name: 'loadReport' }));
  await screen.findByRole('table');
  expect(
    screen.getAllByRole('cell').filter((cell) => cell.textContent === 'protected'),
  ).toHaveLength(11);
  expect(screen.getByText(/2026-10-18T00:00:00.000Z/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'channel' }), {
    target: { value: 'other' },
  });
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('withdrawn navigation sends no owner command and a changed session retires draft fields', async () => {
  vi.mocked(invokeOperationalOwner).mockResolvedValue(presentation);
  const user = userEvent.setup();
  const view = render(<CouponOfferWorkspace {...props} />);
  await user.type(
    await screen.findByRole('textbox', { name: 'code' }),
    'private-draft',
  );
  view.rerender(<CouponOfferWorkspace {...props} sessionGeneration={2} />);
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'code' })).toHaveValue(''),
  );
  vi.mocked(invokeOperationalOwner).mockClear();
  view.rerender(
    <CouponOfferWorkspace {...props} bootstrap={{ ...bootstrap, navigation: [] }} />,
  );
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(invokeOperationalOwner).not.toHaveBeenCalled();
});
