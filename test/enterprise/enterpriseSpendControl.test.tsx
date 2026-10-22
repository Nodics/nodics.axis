import {
  render,
  screen,
  fireEvent,
  within,
  cleanup,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createAxisQueryClient } from '../../src/app/axisQueryClient';
import { EnterpriseSpendControl } from '../../src/operations/enterprise/EnterpriseSpendControl';
import { EnterpriseBusinessAccessPanel } from '../../src/operations/enterprise/EnterpriseBusinessAccessPanel';
import { parseBusinessAccessEditorContract } from '../../src/operations/enterprise/api/businessAccessContract';
import {
  parseSpendSelection,
  updateSpend,
  type SpendCommand,
  type SpendSelection,
} from '../../src/operations/enterprise/api/enterpriseSpendClient';
import { resolveCmsPage } from '../../src/cms/cmsClient';
import type { CmsResolvedPageContract } from '../../src/cms/cmsContract';
import {
  businessAccessConfiguration,
  businessAccessWorkspace,
} from './enterpriseBusinessAccessFixtures';
const copy = {
  title: 'Purchase limit',
  currency: 'Currency or reward code',
  perPurchaseLimit: 'Per-purchase limit',
  noLimit: 'No additional limit',
  load: 'Load limit',
  review: 'Review limit',
  confirm: 'Save limit',
  cancel: 'Cancel',
  inspect: 'Inspect current limit',
  retry: 'Retry original selection',
  saved: 'Purchase limit confirmed.',
  uncertain: 'The outcome is unconfirmed. Inspect the current limit before continuing.',
  conflict: 'The purchase limit changed. Review the current selection.',
  unavailable: 'Purchase limit could not be confirmed.',
  invalid: 'Enter a currency or reward code and a non-negative decimal limit.',
  revision: 'Revision',
  actor: 'Employee',
};
vi.mock('../../src/cms/cmsClient', () => ({ resolveCmsPage: vi.fn() }));
const configuration = {
  ...businessAccessConfiguration,
  ownerSelector: { instanceId: 'fixture-profile' },
  bootstrap: {
    ...businessAccessConfiguration.bootstrap,
    moduleConnections: {
      ...businessAccessConfiguration.bootstrap.moduleConnections,
      checkoutCore: [
        {
          moduleName: 'checkoutCore',
          instanceId: 'fixture-checkout',
          endpoint: 'https://commerce.example.test/nodics/checkoutCore',
          environment: 'fixture',
          state: 'UP' as const,
        },
      ],
    },
  },
};
const cms = {
  baseUrl: 'https://cms.example.test',
  site: 'axisCmsSite',
  locale: 'en',
  channel: 'web',
};
let selection: SpendSelection, commands: SpendCommand[], lost: boolean;
beforeEach(() => {
  selection = {
    enterpriseCode: 'business',
    actorCode: 'alex@example.test',
    currency: 'POINTS',
    perPurchaseLimit: null,
    revision: null,
  };
  commands = [];
  lost = false;
  vi.mocked(resolveCmsPage).mockResolvedValue({
    status: 'resolved',
    page: {
      site: cms.site,
      path: '/commerce/enterprise-spending',
      page: {
        components: [
          {
            code: 'checkoutEnterpriseSpendCopy',
            renderer: 'axis.component.message',
            rendererContractVersion: 1,
            properties: copy,
          },
        ],
      },
    } as unknown as CmsResolvedPageContract,
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, init: RequestInit) => {
      await Promise.resolve();
      if (url.pathname.endsWith('/enterprise-team/business-access'))
        return Response.json({ data: businessAccessWorkspace });
      expect(new Headers(init.headers).get('Authorization')).toBe(
        'Bearer fixture-token',
      );
      expect(new Headers(init.headers).get('x-enterprise-code')).toBe('business');
      if (typeof init.body !== 'string') throw new Error();
      const body = JSON.parse(init.body) as SpendCommand;
      if (url.pathname.endsWith('/read')) {
        expect(body).toEqual({ actorCode: 'alex@example.test', currency: 'POINTS' });
        return Response.json({ data: selection });
      }
      expect(url.pathname).toBe(
        '/nodics/checkoutCore/v0/checkout/enterprise-spending/update',
      );
      commands.push(body);
      if (body.expectedRevision !== selection.revision)
        return Response.json({ error: true }, { status: 409 });
      selection = {
        ...selection,
        perPurchaseLimit: body.perPurchaseLimit,
        revision: (selection.revision ?? -1) + 1,
      };
      if (lost) throw new Error('Lost acknowledgement');
      return Response.json({ data: selection });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
});
function mount(actorCode = 'alex@example.test') {
  const props = { configuration, actorCode, cms, onHeldChange: vi.fn() };
  const client = createAxisQueryClient();
  const tree = (values = props) => (
    <QueryClientProvider client={client}>
      <EnterpriseSpendControl {...values} />
    </QueryClientProvider>
  );
  const view = render(tree());
  return {
    ...view,
    changeActor: () =>
      view.rerender(tree({ ...props, actorCode: 'other@example.test' })),
  };
}
async function load() {
  fireEvent.change(await screen.findByLabelText(copy.currency), {
    target: { value: 'POINTS' },
  });
  await userEvent.click(screen.getByRole('button', { name: copy.load }));
  await screen.findByLabelText(copy.noLimit);
}
async function edit() {
  await load();
  expect(screen.getByLabelText(copy.noLimit)).toBeChecked();
  await userEvent.click(screen.getByLabelText(copy.noLimit));
  fireEvent.change(screen.getByLabelText(copy.perPurchaseLimit), {
    target: { value: '50.25' },
  });
  await userEvent.click(screen.getByRole('button', { name: copy.review }));
}
it('reads owner null and reviews one exact decimal selection without authority fields or a default currency', async () => {
  mount();
  expect(await screen.findByLabelText(copy.currency)).toHaveValue('');
  await edit();
  expect(commands).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: copy.confirm }));
  await screen.findByText(copy.saved);
  expect(commands).toEqual([
    {
      actorCode: 'alex@example.test',
      currency: 'POINTS',
      perPurchaseLimit: '50.25',
      expectedRevision: null,
    },
  ]);
});
it('lost response requires read-only inspection and does not post the selection twice', async () => {
  mount();
  await edit();
  lost = true;
  await userEvent.click(screen.getByRole('button', { name: copy.confirm }));
  await screen.findByText(copy.uncertain);
  expect(screen.getByRole('button', { name: copy.retry })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: copy.inspect }));
  await screen.findByText(copy.saved);
  expect(commands).toHaveLength(1);
});
it('concurrent change is reported without rebase or blind retry', async () => {
  mount();
  await edit();
  selection = { ...selection, revision: 5, perPurchaseLimit: '3' };
  await userEvent.click(screen.getByRole('button', { name: copy.confirm }));
  await screen.findByText(copy.uncertain);
  await userEvent.click(screen.getByRole('button', { name: copy.inspect }));
  await screen.findByText(copy.conflict);
  expect(screen.getByLabelText(copy.perPurchaseLimit)).toHaveValue('3');
  expect(commands).toHaveLength(1);
});
it('a later matching limit cannot confirm an uncertain initial selection', async () => {
  mount();
  await edit();
  lost = true;
  await userEvent.click(screen.getByRole('button', { name: copy.confirm }));
  await screen.findByText(copy.uncertain);
  selection = { ...selection, revision: 5 };
  await userEvent.click(screen.getByRole('button', { name: copy.inspect }));
  await screen.findByText(copy.conflict);
  expect(screen.queryByText(copy.saved)).toBeNull();
  expect(commands).toHaveLength(1);
});
it('rejects an initial write acknowledgement carrying a later matching revision', async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      data: { ...selection, perPurchaseLimit: '50.25', revision: 5 },
    }),
  );
  await expect(
    updateSpend(configuration, {
      actorCode: selection.actorCode,
      currency: selection.currency,
      perPurchaseLimit: '50.25',
      expectedRevision: null,
    }),
  ).rejects.toThrow('Spending selection was not confirmed.');
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('offline writes never queue and actor replacement discards private selections', async () => {
  const view = mount();
  await edit();
  onlineManager.setOnline(false);
  await userEvent.click(screen.getByRole('button', { name: copy.confirm }));
  await screen.findByText(copy.uncertain);
  expect(commands).toHaveLength(0);
  onlineManager.setOnline(true);
  view.changeActor();
  await waitFor(() => expect(screen.getByLabelText(copy.currency)).toHaveValue(''));
  expect(commands).toHaveLength(0);
});
it('rejects foreign scope, actor, currency and numeric limits', () => {
  for (const patch of [
    { enterpriseCode: 'other' },
    { actorCode: 'other' },
    { currency: 'USD' },
    { perPurchaseLimit: 5 },
  ])
    expect(() =>
      parseSpendSelection(
        { ...selection, ...patch },
        configuration,
        'alex@example.test',
        'POINTS',
      ),
    ).toThrow();
});
it('mounts in the existing employee editor using loginId, not employeeCode, without changing Profile business-area selections', async () => {
  const client = createAxisQueryClient();
  render(
    <QueryClientProvider client={client}>
      <EnterpriseBusinessAccessPanel
        configuration={configuration}
        presentation={
          parseBusinessAccessEditorContract(businessAccessWorkspace.businessAccess)
            .presentation
        }
        spendCms={cms}
      />
    </QueryClientProvider>,
  );
  await userEvent.click(
    await screen.findByRole('button', { name: 'alex@example.test: Access level' }),
  );
  await load();
  expect(within(screen.getByRole('dialog')).getByText(copy.title)).toBeVisible();
  expect(commands).toHaveLength(0);
  expect(
    vi
      .mocked(fetch)
      .mock.calls.filter(([url]) =>
        (url as URL).pathname.endsWith('/enterprise-team/business-access'),
      )
      .every(([, init]) => init?.method === 'GET'),
  ).toBe(true);
});
