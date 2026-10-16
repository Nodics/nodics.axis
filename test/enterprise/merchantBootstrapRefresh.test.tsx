/** Real merchant panel/transport with synthetic HTTP responses only; no live owner or command replay. */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type {
  AxisAuthenticatedBootstrap,
  AxisModuleConnection,
} from '../../src/bootstrap/publicBootstrap';
import { MerchantRedemptionPanel } from '../../src/operations/promotions/MerchantRedemptionPanel';
import { runtime } from './registrationFixtures';

const connection: AxisModuleConnection = {
  moduleName: 'digitalCore',
  instanceId: 'commerce-a',
  endpoint: 'https://commerce.example.test/nodics/digitalCore',
  environment: 'Local',
  server: 'commerce',
  runtimeRole: { code: 'COMMERCE', publication: 'OPERATIONAL' },
  state: 'UP',
};
const bootstrap: AxisAuthenticatedBootstrap = {
  tenantCode: 'tenant-a',
  axisPolicy: {
    contractVersion: 0,
    screenLockEnabled: false,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 0,
    source: 'DEFAULT',
  },
  moduleCatalog: {},
  moduleConnections: { digitalCore: [connection] },
  environments: ['Local'],
  documentationSources: [],
  navigation: [
    {
      id: 'merchant-coupon-fulfillment',
      moduleName: 'digitalCore',
      route: '/commerce/coupons/fulfillment',
      label: 'Merchant fulfillment',
      category: 'Commerce',
      icon: 'store',
      order: 1,
      availability: 'UP',
      featureState: 'ACTIVE',
      contexts: [],
    },
  ],
};
const workspace = {
  storeRequired: true,
  storeLabel: 'Outlet',
  pricedSourceRequired: true,
  pricedSourceLabel: 'Native basket reference',
  stores: [
    { code: 'cafe', name: 'Cafe', revision: 2 },
    { code: 'bistro', name: 'Bistro', revision: 3 },
  ],
};
const row = {
  entitlementCode: 'synthetic-entitlement',
  productCode: 'synthetic-product',
  claimStatus: 'UNCLAIMED',
  revision: 1,
  merchantLabel: 'Synthetic merchant row',
  mode: 'MERCHANT_SCREEN',
  storeCode: 'cafe',
  storeRevision: 2,
};
const validated = {
  ...row,
  eligible: true,
  validationCode: 'synthetic-proof',
  validationExpiresAt: '2099-01-01T00:00:00Z',
  conditions: {
    benefit: {
      sourceReference: 'CART:basket-1',
      sourceStage: 'PRICED_CART',
      sourceHash: 'a'.repeat(64),
      sourceRevision: 1,
      storeCode: 'cafe',
      storeRevision: 2,
      currency: 'AED',
      subtotalAmount: '100',
      discountAmount: '10',
    },
  },
};
function response(value: unknown, status = 200) {
  return new Response(
    JSON.stringify(
      status === 200
        ? { code: 'SUC_SYS_00000', result: value }
        : { code: 'ERR_SYNTHETIC', message: 'Synthetic owner refused the request.' },
    ),
    { status },
  );
}
type PanelProps = Parameters<typeof MerchantRedemptionPanel>[0];
function fixture(phase: 'queue' | 'validate' | 'confirm' = 'queue') {
  let complete!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    complete = resolve;
  });
  let currentWorkspace: unknown = workspace;
  let workspaceStatus = 200;
  let nextWorkspace: Promise<Response> | undefined;
  let workspaceCalls = 0,
    queueCalls = 0,
    validationCalls = 0,
    confirmationCalls = 0;
  const request = vi.fn<typeof fetch>().mockImplementation((input) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.pathname.endsWith('/merchant/redemptions/workspace')) {
      workspaceCalls++;
      const next = nextWorkspace;
      nextWorkspace = undefined;
      return next ?? Promise.resolve(response(currentWorkspace, workspaceStatus));
    }
    if (url.pathname.endsWith('/merchant/redemptions/validate')) {
      validationCalls++;
      return phase === 'validate' ? pending : Promise.resolve(response(validated));
    }
    if (url.pathname.endsWith('/confirm')) {
      confirmationCalls++;
      return pending;
    }
    if (url.pathname.endsWith('/merchant/redemptions')) {
      queueCalls++;
      return pending;
    }
    throw new Error('Unexpected synthetic owner request');
  });
  vi.stubGlobal('fetch', request);
  let props: PanelProps = {
    bootstrap: structuredClone(bootstrap),
    runtime: { ...runtime },
    accessToken: 'synthetic-access',
    sessionGeneration: 1,
  };
  const view = render(<MerchantRedemptionPanel {...props} />);
  const user = userEvent.setup();
  return {
    view,
    user,
    request,
    workspaceCalls: () => workspaceCalls,
    queueCalls: () => queueCalls,
    validationCalls: () => validationCalls,
    confirmationCalls: () => confirmationCalls,
    setWorkspace(value: unknown, status = 200) {
      currentWorkspace = value;
      workspaceStatus = status;
    },
    deferWorkspace(value: Promise<Response>) {
      nextWorkspace = value;
    },
    rerender(patch: Partial<PanelProps> = {}) {
      props = { ...props, ...patch };
      view.rerender(<MerchantRedemptionPanel {...props} />);
    },
    refresh() {
      props = {
        ...props,
        bootstrap: structuredClone(props.bootstrap),
        runtime: { ...props.runtime },
      };
      view.rerender(<MerchantRedemptionPanel {...props} />);
    },
    async fill() {
      const outlet = await screen.findByRole('combobox', { name: 'Outlet' });
      await waitFor(() => expect(outlet).not.toHaveAttribute('aria-disabled', 'true'));
      await user.click(outlet);
      await user.click(screen.getByRole('option', { name: 'Cafe' }));
      await user.type(
        screen.getByRole('textbox', { name: 'Customer coupon code' }),
        'SYNTHETIC-COUPON',
      );
      await user.type(
        screen.getByRole('textbox', { name: 'Native basket reference' }),
        'CART:basket-1',
      );
    },
    async start() {
      await this.fill();
      await user.click(
        screen.getByRole('button', {
          name:
            phase === 'queue' ? 'Load merchant requests' : 'Validate presented coupon',
        }),
      );
      if (phase === 'confirm') {
        await screen.findByRole('dialog');
        await user.click(screen.getByRole('button', { name: 'Confirm fulfillment' }));
      }
      expect(
        screen.getByRole('status', { hidden: phase === 'confirm' }),
      ).toHaveTextContent('Working');
    },
    async settle(status = phase === 'queue' ? 200 : 400) {
      await act(async () => {
        complete(
          response(phase === 'queue' ? { redemptions: [row] } : validated, status),
        );
        await pending;
      });
    },
  };
}
function expectDraft() {
  expect(screen.getByRole('combobox', { name: 'Outlet' })).toHaveTextContent('Cafe');
  expect(screen.getByRole('textbox', { name: 'Customer coupon code' })).toHaveValue(
    'SYNTHETIC-COUPON',
  );
  expect(
    screen.getAllByRole('textbox', { name: 'Native basket reference' })[0],
  ).toHaveValue('CART:basket-1');
}
afterEach(() => vi.unstubAllGlobals());

it('preserves a pending GET and draft through equal bootstrap/runtime objects without repeating the read', async () => {
  const f = fixture();
  await f.start();
  f.refresh();
  await waitFor(() => expect(f.workspaceCalls()).toBe(2));
  expectDraft();
  expect(screen.getByRole('status')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Load merchant requests' })).toBeDisabled();
  await f.settle();
  expect(await screen.findByText(/Synthetic merchant row/)).toBeVisible();
  expectDraft();
  expect(f.queueCalls()).toBe(1);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  f.refresh();
  await waitFor(() => expect(f.workspaceCalls()).toBe(3));
  expect(screen.getByText(/Synthetic merchant row/)).toBeVisible();
  expectDraft();
});

it.each(['before', 'after'] as const)(
  'preserves a real HTTP 400 queue error %s equal-bootstrap refresh',
  async (timing) => {
    const f = fixture();
    await f.start();
    if (timing === 'before') await f.settle(400);
    f.refresh();
    await waitFor(() => expect(f.workspaceCalls()).toBe(2));
    if (timing === 'after') await f.settle(400);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Synthetic owner refused the request.',
    );
    expectDraft();
    expect(f.queueCalls()).toBe(1);
    expect(f.validationCalls()).toBe(0);
  },
);

it.each(['before', 'after'] as const)(
  'preserves the refused validation HTTP 400 %s refresh, never retrying the POST',
  async (timing) => {
    const f = fixture('validate');
    await f.start();
    if (timing === 'before') await f.settle();
    f.refresh();
    await waitFor(() => expect(f.workspaceCalls()).toBe(2));
    if (timing === 'after') await f.settle();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Synthetic owner refused the request.',
    );
    expectDraft();
    expect(f.validationCalls()).toBe(1);
    expect(f.confirmationCalls()).toBe(0);
    expect(f.queueCalls()).toBe(0);
  },
);

it('preserves reviewed proof/pending confirmation and an uncertain outcome without replay', async () => {
  const f = fixture('confirm');
  await f.start();
  f.refresh();
  await waitFor(() => expect(f.workspaceCalls()).toBe(2));
  expect(screen.getByRole('dialog')).toBeVisible();
  await f.settle();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Fulfillment outcome is unconfirmed',
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  f.refresh();
  await waitFor(() => expect(f.workspaceCalls()).toBe(3));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Fulfillment outcome is unconfirmed',
  );
  expectDraft();
  expect(f.confirmationCalls()).toBe(1);
  expect(f.queueCalls()).toBe(0);
});

const ownerChange = (patch: Partial<AxisModuleConnection>) => ({
  bootstrap: {
    ...bootstrap,
    moduleConnections: { digitalCore: [{ ...connection, ...patch }] },
  },
});
const changes: { name: string; patch: Partial<PanelProps> }[] = [
  { name: 'admission with a reused token', patch: { sessionGeneration: 2 } },
  { name: 'token', patch: { accessToken: 'new-synthetic-access' } },
  { name: 'tenant', patch: { bootstrap: { ...bootstrap, tenantCode: 'tenant-b' } } },
  {
    name: 'enterprise',
    patch: { runtime: { ...runtime, enterpriseCode: 'enterprise-b' } },
  },
  {
    name: 'owner endpoint',
    patch: ownerChange({ endpoint: 'https://other.example.test/nodics/digitalCore' }),
  },
  { name: 'owner instance', patch: ownerChange({ instanceId: 'commerce-b' }) },
  {
    name: 'owner role',
    patch: ownerChange({ runtimeRole: { code: 'OTHER', publication: 'OPERATIONAL' } }),
  },
  { name: 'owner availability', patch: ownerChange({ state: 'DEGRADED' }) },
  {
    name: 'owner removal',
    patch: { bootstrap: { ...bootstrap, moduleConnections: {} } },
  },
  {
    name: 'navigation access withdrawal',
    patch: { bootstrap: { ...bootstrap, navigation: [] } },
  },
];
it.each(changes)(
  'retires drafts and a late GET when $name changes',
  async ({ patch }) => {
    const f = fixture();
    await f.start();
    f.rerender(patch);
    await f.settle();
    expect(screen.queryByText(/Synthetic merchant row/)).not.toBeInTheDocument();
    const coupon = screen.queryByRole('textbox', { name: 'Customer coupon code' });
    if (coupon) expect(coupon).toHaveValue('');
    expect(f.queueCalls()).toBe(1);
    expect(f.validationCalls()).toBe(0);
  },
);

it.each(changes)(
  'retires a late validation failure when $name changes',
  async ({ patch }) => {
    const f = fixture('validate');
    await f.start();
    f.rerender(patch);
    await f.settle();
    expect(
      screen.queryByText('Synthetic owner refused the request.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(f.validationCalls()).toBe(1);
  },
);

it.each(changes)(
  'retires reviewed proof and an old confirmation outcome when $name changes',
  async ({ patch }) => {
    const f = fixture('confirm');
    await f.start();
    f.rerender(patch);
    await f.settle();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(
      screen.queryByText(/Fulfillment outcome is unconfirmed/),
    ).not.toBeInTheDocument();
    const coupon = screen.queryByRole('textbox', { name: 'Customer coupon code' });
    if (coupon) expect(coupon).toHaveValue('');
    expect(f.confirmationCalls()).toBe(1);
    expect(f.queueCalls()).toBe(0);
  },
);

it.each([
  {
    name: 'outlet revision',
    value: {
      ...workspace,
      stores: [{ ...workspace.stores[0], revision: 4 }, workspace.stores[1]],
    },
  },
  { name: 'outlet scope', value: { ...workspace, stores: [workspace.stores[1]] } },
  { name: 'store requirement', value: { ...workspace, storeRequired: false } },
  { name: 'source requirement', value: { ...workspace, pricedSourceRequired: false } },
  {
    name: 'malformed evidence',
    value: { ...workspace, stores: [{ ...workspace.stores[0], revision: 0 }] },
  },
])('retires pending replies and inputs on fresh $name change', async ({ value }) => {
  const f = fixture();
  await f.start();
  f.setWorkspace(value);
  f.refresh();
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Customer coupon code' })).toHaveValue(
      '',
    ),
  );
  await f.settle();
  expect(screen.queryByText(/Synthetic merchant row/)).not.toBeInTheDocument();
  expect(f.queueCalls()).toBe(1);
});

it('retires pending replies when fresh owner authorization rejects changed permissions/access groups', async () => {
  const f = fixture();
  await f.start();
  f.setWorkspace({}, 403);
  f.refresh();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Synthetic owner refused the request.',
  );
  await f.settle();
  expect(screen.queryByText(/Synthetic merchant row/)).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Customer coupon code' })).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Load merchant requests' })).toBeDisabled();
});

it('refreshes labels/order without retiring an unchanged outlet scope or draft', async () => {
  const f = fixture();
  await f.fill();
  f.setWorkspace({
    ...workspace,
    stores: [workspace.stores[1], { ...workspace.stores[0], name: 'Renamed Cafe' }],
  });
  f.refresh();
  expect(await screen.findByText('Renamed Cafe')).toBeVisible();
  expectDraft();
  expect(f.queueCalls()).toBe(0);
});

it('blocks new commands during fresh workspace inspection and rejects its superseded reply', async () => {
  const f = fixture();
  await f.fill();
  let complete!: (value: Response) => void;
  const pendingWorkspace = new Promise<Response>((resolve) => {
    complete = resolve;
  });
  f.deferWorkspace(pendingWorkspace);
  f.refresh();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Validate presented coupon' }),
    ).toBeDisabled(),
  );
  expectDraft();
  f.refresh();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Validate presented coupon' }),
    ).toBeEnabled(),
  );
  await act(async () => {
    complete(response({}, 403));
    await pendingWorkspace;
  });
  expectDraft();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(f.validationCalls()).toBe(0);
});

it('retires an unmounted panel reply without issuing a dependent request', async () => {
  const f = fixture();
  await f.start();
  f.view.unmount();
  await f.settle();
  expect(f.queueCalls()).toBe(1);
  expect(f.workspaceCalls()).toBe(1);
});
