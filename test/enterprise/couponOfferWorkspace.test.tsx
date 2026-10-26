/** Isolated owner-contract UI tests. No runtime, database, browser server or provider calls. */
import { render, screen, waitFor } from '@testing-library/react';
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
  transitionCoupon,
  type CouponWorkspace as Workspace,
} from '../../src/operations/promotions/couponOfferClient';
import { invokeOperationalOwner } from '../../src/operations/shared/operationalOwnerClient';
import { runtime } from './registrationFixtures';
import { searchReportOffers } from '../../src/operations/promotions/reportOfferLookup';
vi.mock('../../src/operations/promotions/reportOfferLookup', () => ({
  searchReportOffers: vi.fn(),
}));
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
  reportChannels: [
    { code: 'circa', name: 'Circa website' },
    { code: 'other', name: 'Other website' },
  ],
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
  lifecycleActions: [],
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

it('preserves budget and vendor but rejects unsafe or stale advertised actions', () => {
  const action = {
    actionCode: 'SUBMIT',
    labelKey: 'submit',
    method: 'POST',
    route: '/promotions/offer/submit',
    expectedVersionId: 0,
    expectedRevision: 1,
  };
  const value = {
    ...record,
    budget: { limit: '3000' },
    vendorEnterpriseRef: {
      moduleName: 'profile',
      schemaName: 'enterprise',
      code: 'market',
    },
    lifecycleActions: [action],
  };
  expect(couponRecord(value, 'offer')).toMatchObject({
    budget: { limit: '3000' },
    vendorEnterpriseRef: value.vendorEnterpriseRef,
    lifecycleActions: [action],
  });
  for (const change of [
    { route: 'https://other.test/submit' },
    { expectedRevision: 2 },
    { method: 'GET' },
    { labelKey: 'approve' },
  ])
    expect(() =>
      couponRecord({ ...value, lifecycleActions: [{ ...action, ...change }] }, 'offer'),
    ).toThrow();
  expect(() => couponRecord({ ...value, budget: { limit: '-1' } }, 'offer')).toThrow();
});

it('executes only advertised actions with exact preconditions and returns authoritative status', async () => {
  const source = couponRecord(
    {
      ...record,
      lifecycleActions: [
        {
          actionCode: 'SCHEDULE',
          labelKey: 'schedule',
          method: 'POST',
          route: '/promotions/offer/schedule',
          expectedVersionId: 0,
          expectedRevision: 1,
        },
      ],
    },
    'offer',
  );
  vi.mocked(invokeOperationalOwner)
    .mockResolvedValueOnce({ code: 'offer' })
    .mockResolvedValueOnce({
      ...record,
      status: 'SCHEDULED',
      versionId: 1,
      revision: 2,
    });
  const result = await transitionCoupon(
    { bootstrap, accessToken: 'token', enterpriseCode: 'issuer', timeoutMs: 1000 },
    source,
    source.lifecycleActions[0]!,
    'Reviewed',
  );
  expect(result.status).toBe('SCHEDULED');
  expect(vi.mocked(invokeOperationalOwner).mock.calls[0]?.slice(1)).toEqual([
    'promotion',
    '/promotions/offer/schedule',
    { expectedVersionId: 0, expectedRevision: 1, reasonCode: 'Reviewed' },
    'POST',
  ]);
  expect(invokeOperationalOwner).toHaveBeenCalledTimes(2);
  vi.mocked(invokeOperationalOwner).mockResolvedValue(record);
  await expect(
    transitionCoupon(
      { bootstrap, accessToken: 'token', enterpriseCode: 'issuer', timeoutMs: 1000 },
      source,
      source.lifecycleActions[0]!,
      'Reviewed',
    ),
  ).rejects.toThrow('could not be confirmed');
});

it('requires a reviewed reason before lifecycle execution and reads back the new state', async () => {
  const source = {
    ...record,
    budget: { limit: '3000' },
    lifecycleActions: [
      {
        actionCode: 'SUBMIT',
        labelKey: 'submit',
        method: 'POST',
        route: '/promotions/offer/submit',
        expectedVersionId: 0,
        expectedRevision: 1,
      },
    ],
  };
  let transitioned = false;
  vi.mocked(invokeOperationalOwner).mockImplementation(
    (_config, _module, path, _body, method) => {
      if (method === 'POST' && path.endsWith('/submit')) {
        transitioned = true;
        return Promise.resolve({ code: 'offer' });
      }
      return Promise.resolve(
        path.endsWith('/workspace')
          ? presentation
          : transitioned
            ? {
                ...record,
                status: 'SUBMITTED',
                versionId: 1,
                revision: 2,
                budget: { limit: '3000' },
              }
            : source,
      );
    },
  );
  const user = userEvent.setup();
  render(<CouponOfferWorkspace {...props} />);
  await user.type(await screen.findByRole('textbox', { name: 'code' }), 'offer');
  await user.click(screen.getByRole('button', { name: 'inspect' }));
  await user.click(await screen.findByRole('button', { name: 'submit' }));
  expect(screen.getByRole('button', { name: 'confirm' })).toBeDisabled();
  expect(transitioned).toBe(false);
  await user.type(screen.getByRole('textbox', { name: 'reasonCode' }), 'Reviewed');
  await user.click(screen.getByRole('button', { name: 'confirm' }));
  await screen.findByText(/offer · SUBMITTED/);
  expect(screen.queryByRole('button', { name: 'submit' })).not.toBeInTheDocument();
});

it.each(['Access denied', 'Network failure'])(
  'locks lifecycle writes after %s until fresh inspection',
  async (message) => {
    const source = {
      ...record,
      budget: { limit: '0' },
      lifecycleActions: [
        {
          actionCode: 'SUBMIT',
          labelKey: 'submit',
          method: 'POST',
          route: '/promotions/offer/submit',
          expectedVersionId: 0,
          expectedRevision: 1,
        },
      ],
    };
    vi.mocked(invokeOperationalOwner).mockImplementation(
      (_config, _module, path, _body, method) =>
        method === 'POST'
          ? Promise.reject(new Error(message))
          : Promise.resolve(path.endsWith('/workspace') ? presentation : source),
    );
    const user = userEvent.setup();
    render(<CouponOfferWorkspace {...props} />);
    await user.type(await screen.findByRole('textbox', { name: 'code' }), 'offer');
    await user.click(screen.getByRole('button', { name: 'inspect' }));
    await user.click(await screen.findByRole('button', { name: 'submit' }));
    await user.type(screen.getByRole('textbox', { name: 'reasonCode' }), 'Reviewed');
    await user.click(screen.getByRole('button', { name: 'confirm' }));
    await screen.findByText(message);
    expect(await screen.findByRole('button', { name: 'submit' })).toBeDisabled();
    expect(
      vi
        .mocked(invokeOperationalOwner)
        .mock.calls.filter((call) => call[4] === 'POST' && call[2].endsWith('/submit')),
    ).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'inspect' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'submit' })).toBeEnabled(),
    );
  },
);

it('prefills owner budget and vendor as unsaved selections without lifecycle authority', async () => {
  const source = {
    ...record,
    budget: { limit: '3000' },
    vendorEnterpriseRef: {
      moduleName: 'profile',
      schemaName: 'enterprise',
      code: 'market',
    },
  };
  vi.mocked(invokeOperationalOwner).mockImplementation(
    (_configuration, _module, path) =>
      Promise.resolve(path.endsWith('/workspace') ? presentation : source),
  );
  const user = userEvent.setup();
  render(<CouponOfferWorkspace {...props} />);
  await user.type(await screen.findByRole('textbox', { name: 'code' }), 'offer');
  await user.click(screen.getByRole('button', { name: 'inspect' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'budgetLimit' })).toHaveValue('3000'),
  );
  expect(screen.getByRole('textbox', { name: 'budgetLimit' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'prefill' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'budgetLimit' })).toBeEnabled(),
  );
  expect(
    screen.getByRole('combobox', { name: 'Vendor enterprise (optional)' }),
  ).toHaveValue('market');
  expect(screen.getByRole('textbox', { name: 'code' })).toHaveValue('');
  expect(screen.queryByRole('button', { name: 'submit' })).not.toBeInTheDocument();
});

it('places admitted administrative review before creation and keeps owner enum choices', async () => {
  vi.mocked(invokeOperationalOwner).mockImplementation(
    (_configuration, _module, path) =>
      Promise.resolve(
        path.endsWith('/workspace')
          ? presentation
          : {
              contractVersion: 1,
              crossEnterpriseReview: true,
              labels: {
                administrativeReview: 'Review existing offers',
                issuerEnterpriseCode: 'Issuer',
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
            },
      ),
  );
  render(<CouponOfferWorkspace {...props} />);
  const review = await screen.findByRole('heading', { name: 'Review existing offers' });
  const creation = screen.getByRole('heading', { name: 'title' });
  expect(
    review.compareDocumentPosition(creation) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(screen.getByRole('combobox', { name: 'benefit' })).toBeEnabled();
  expect(screen.getByRole('combobox', { name: 'requirements' })).toBeEnabled();
  expect(
    vi
      .mocked(invokeOperationalOwner)
      .mock.calls.every((call) =>
        [
          '/promotions/coupon-offers/workspace',
          '/promotions/administrative-review/capabilities',
        ].includes(call[2]),
      ),
  ).toBe(true);
});

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
  expect(
    screen.queryByRole('combobox', { name: 'Vendor enterprise (optional)' }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'prefill' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'code' })).toHaveValue(''),
  );
  expect(screen.getByRole('textbox', { name: 'value' })).toBeEnabled();
  expect(
    screen.getByRole('combobox', { name: 'Vendor enterprise (optional)' }),
  ).toHaveValue('');
  expect(screen.queryByText(/offer · DRAFT/)).not.toBeInTheDocument();
  expect(
    vi
      .mocked(invokeOperationalOwner)
      .mock.calls.filter((call) => !call[2].endsWith('/capabilities'))
      .every((call) => call[4] === undefined),
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
  const body = JSON.parse(fetcher.mock.calls[0]![1]!.body as string) as Record<
    string,
    unknown
  >;
  expect(body).not.toHaveProperty('vendorEnterpriseRef');
  expect(body).not.toHaveProperty('budget');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(vi.mocked(invokeOperationalOwner).mock.calls[0]?.[2]).toBe(
    '/promotions/offer/coupon-offer',
  );
});

it('new vendor reference changes only the create body, never signed issuer headers or other authority', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        data: {
          code: 'offer',
          status: 'DRAFT',
          revision: 1,
          versionId: 0,
        },
      }),
      { status: 200 },
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  vi.mocked(invokeOperationalOwner).mockResolvedValue(record);
  await createCoupon(
    { bootstrap, accessToken: 'token', enterpriseCode: 'issuer', timeoutMs: 1000 },
    {
      ...record,
      budget: { limit: '3000' },
      couponOffer: couponRecord(record, 'offer').couponOffer,
      vendorEnterpriseRef: {
        moduleName: 'profile',
        schemaName: 'enterprise',
        code: 'marketplace',
      },
    },
  );
  const request = fetcher.mock.calls[0]![1]!;
  expect(request.headers).toMatchObject({
    'x-enterprise-code': 'issuer',
    Authorization: 'Bearer token',
  });
  const body = JSON.parse(request.body as string) as Record<string, unknown>;
  expect(body.vendorEnterpriseRef).toEqual({
    moduleName: 'profile',
    schemaName: 'enterprise',
    code: 'marketplace',
  });
  expect(body.budget).toEqual({ limit: '3000' });
  for (const field of [
    'issuerEnterpriseRef',
    'enterpriseCode',
    'tenant',
    'permissions',
  ])
    expect(body[field]).toBeUndefined();
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
  vi.mocked(searchReportOffers).mockResolvedValue([
    { code: 'offer', name: 'Original partner offer' },
  ]);
  await user.click(await screen.findByRole('combobox', { name: 'reportOffer' }));
  await user.click(
    await screen.findByRole('option', { name: /Original partner offer/ }),
  );
  await user.click(screen.getByRole('combobox', { name: 'channel' }));
  await user.click(screen.getByRole('option', { name: 'Circa website' }));
  await user.click(screen.getByRole('button', { name: 'loadReport' }));
  await screen.findByRole('table');
  for (const [configuration] of vi.mocked(invokeOperationalOwner).mock.calls) {
    expect(configuration.ownerSelector).toEqual({
      runtimeRoleCode: 'COMMERCE',
      publicationRole: 'OPERATIONAL',
    });
  }
  expect(
    screen.getAllByRole('cell').filter((cell) => cell.textContent === 'protected'),
  ).toHaveLength(11);
  expect(document.querySelector('time')?.getAttribute('datetime')).toBe(
    '2026-10-18T00:00:00.000Z',
  );
  expect(
    screen.getByText(
      new RegExp(
        new Date('2026-10-18T00:00:00.000Z')
          .toLocaleString()
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      ),
    ),
  ).toBeInTheDocument();
  await user.click(screen.getByRole('combobox', { name: 'channel' }));
  await user.click(screen.getByRole('option', { name: 'Other website' }));
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
