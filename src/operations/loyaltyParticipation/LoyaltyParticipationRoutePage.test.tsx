/** Component and transport unit tests only, with synthetic owner/CMS evidence. */
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
  cleanup,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createAxisQueryClient } from '../../app/axisQueryClient';
import { LoyaltyParticipationRoutePage } from './LoyaltyParticipationRoutePage';
import {
  loyaltyView,
  parseCreditReceipt,
  parseSettings,
  parseSelections,
  type SettingsCommand,
  type CreditCommand,
  type LoyaltyView,
} from './loyaltyClient';
import {
  copy,
  navigation,
  bootstrap,
  settings,
  wallet,
  draft,
  receipt,
} from './loyaltyTestFixtures';
import { runtime } from '../../../test/enterprise/registrationFixtures';
import { resolveCmsPage } from '../../cms/cmsClient';
import type { CmsResolvedPageContract } from '../../cms/cmsContract';
vi.mock('../../cms/cmsClient', () => ({ resolveCmsPage: vi.fn() }));
let policy: typeof settings,
  walletEvidence: unknown,
  policyCommands: SettingsCommand[],
  credits: CreditCommand[],
  loseReply: boolean,
  deny: boolean;
beforeEach(() => {
  policy = structuredClone(settings);
  walletEvidence = structuredClone(wallet);
  policyCommands = [];
  credits = [];
  loseReply = false;
  deny = false;
  vi.mocked(resolveCmsPage).mockImplementation(async (options) => {
    await Promise.resolve();
    return {
      status: 'resolved',
      page: {
        site: options.site,
        path: options.path,
        page: {
          components: [
            {
              code: 'loyaltyParticipationWorkspaceCopy',
              renderer: 'axis.component.message',
              rendererContractVersion: 1,
              properties: copy,
            },
          ],
        },
      } as unknown as CmsResolvedPageContract,
    };
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, init: RequestInit) => {
      await Promise.resolve();
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token');
      expect(new Headers(init.headers).get('x-enterprise-code')).toBe('merchant');
      expect(init.cache).toBe('no-store');
      expect(init.redirect).toBe('error');
      if (deny)
        return Response.json({ code: 'ERR_LOYALTY_FORBIDDEN' }, { status: 403 });
      if (url.pathname.endsWith('/participant/wallet')) {
        expect(init.method).toBe('GET');
        expect(init.body).toBeUndefined();
        return Response.json({ data: walletEvidence });
      }
      if (typeof init.body !== 'string') throw new Error('Expected JSON');
      if (url.pathname.endsWith('/transfer-policy/read')) {
        const input = JSON.parse(init.body) as {
          programCode: string;
          rewardTypeCode: string;
        };
        expect(input).toEqual({ programCode: 'program', rewardTypeCode: 'points' });
        return Response.json({ data: policy });
      }
      if (url.pathname.endsWith('/transfer-policy')) {
        const command = JSON.parse(init.body) as SettingsCommand;
        policyCommands.push(command);
        expect(init.method).toBe('PUT');
        if (command.expectedRevision !== policy.revision)
          return Response.json({ code: 'ERR_LOYALTY_TRANSFER' }, { status: 409 });
        policy = {
          ...policy,
          revision: (policy.revision ?? -1) + 1,
          selections: command.selections,
          effective: { ...policy.effective, ...command.selections },
        };
        if (loseReply) throw new Error('lost response');
        return Response.json({ data: policy });
      }
      if (url.pathname.endsWith('/enterprise-test-credits')) {
        const command = JSON.parse(init.body) as CreditCommand;
        credits.push(command);
        if (loseReply) throw new Error('lost response');
        return Response.json({
          data: {
            ...receipt(command),
            status: credits.length > 1 ? 'CURRENT' : 'CREDITED',
          },
        });
      }
      throw new Error('Unexpected route');
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
});
function mount(view: LoyaltyView, overrides = {}) {
  const props = {
    bootstrap,
    navigation: navigation(view),
    runtime: { ...runtime, enterpriseCode: 'merchant' },
    accessToken: 'token',
    sessionGeneration: 1,
    cmsBaseUrl: 'https://cms.example.test',
    site: 'axisCmsSite',
    locale: 'en',
    channel: 'web',
    ...overrides,
  };
  const client = createAxisQueryClient();
  const tree = (values = props) => (
    <QueryClientProvider client={client}>
      <LoyaltyParticipationRoutePage {...values} />
    </QueryClientProvider>
  );
  const rendered = render(tree());
  return {
    ...rendered,
    rerenderProps: (updates: Partial<typeof props>) =>
      rendered.rerender(tree({ ...props, ...updates })),
  };
}
async function loadPolicy() {
  fireEvent.change(await screen.findByLabelText(copy.programCode), {
    target: { value: 'program' },
  });
  fireEvent.change(screen.getByLabelText(copy.rewardTypeCode), {
    target: { value: 'points' },
  });
  await userEvent.click(screen.getByRole('button', { name: copy.load }));
  await screen.findByText(copy.effective);
}
async function selectMaximum() {
  await loadPolicy();
  const field = screen.getByLabelText(copy.maximumAmount);
  expect(field).toBeDisabled();
  await userEvent.click(
    screen.getByLabelText(copy.inherit + ' - ' + copy.maximumAmount),
  );
  expect(field).toHaveValue('90');
  fireEvent.change(field, { target: { value: '50.00' } });
}
async function reviewConfirm() {
  await userEvent.click(screen.getByRole('button', { name: copy.review }));
  expect(policyCommands.length + credits.length).toBe(0);
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: copy.confirm }),
  );
}
async function fillCredit() {
  await screen.findByLabelText(copy.walletCode, { exact: false });
  for (const [key, value] of Object.entries(draft))
    fireEvent.change(
      screen.getByLabelText(copy[key as keyof typeof draft], { exact: false }),
      { target: { value } },
    );
}
it('reads original-token wallet and bounded ledger without provisioning, commands or local balances', async () => {
  mount('wallet');
  await userEvent.click(await screen.findByRole('button', { name: copy.refresh }));
  await screen.findByText('Test points');
  expect(screen.getByText('90.00')).toBeVisible();
  expect(screen.getByText('entry')).toBeVisible();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(credits).toHaveLength(0);
  expect(policyCommands).toHaveLength(0);
});
it('shows a missing wallet and refuses foreign evidence without fallback', async () => {
  walletEvidence = { ...wallet, wallet: null, balances: [], entries: [] };
  mount('wallet');
  await userEvent.click(await screen.findByRole('button', { name: copy.refresh }));
  await screen.findByText(copy.emptyWallet);
  walletEvidence = { ...wallet, owner: { ...wallet.owner, ownerCode: 'foreign' } };
  await userEvent.click(screen.getByRole('button', { name: copy.refresh }));
  await screen.findByText(copy.unavailable);
  expect(screen.queryByText('90.00')).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('uses owner-effective defaults and submits only reviewed explicit selections at the returned revision', async () => {
  mount('transferSettings');
  await selectMaximum();
  await reviewConfirm();
  await screen.findByText(copy.saved);
  expect(policyCommands).toEqual([
    {
      programCode: 'program',
      rewardTypeCode: 'points',
      expectedRevision: null,
      selections: { maximumAmount: '50.00' },
    },
  ]);
  expect(policy.revision).toBe(0);
  expect(policy.selections.incomingEnabled).toBeUndefined();
});
it('reconciles lost settings acknowledgement by reading exact selections without another write', async () => {
  mount('transferSettings');
  await selectMaximum();
  loseReply = true;
  await reviewConfirm();
  await screen.findByText(copy.uncertain);
  expect(screen.getByLabelText(copy.maximumAmount)).toBeDisabled();
  await userEvent.click(await screen.findByRole('button', { name: copy.inspect }));
  await screen.findByText(copy.saved);
  expect(policyCommands).toHaveLength(1);
});
it('stale settings revisions require a fresh read and never silently overwrite another selection', async () => {
  mount('transferSettings');
  await selectMaximum();
  policy = { ...policy, revision: 4, selections: { maximumAmount: '20.00' } };
  await reviewConfirm();
  await screen.findByText(copy.uncertain);
  await userEvent.click(await screen.findByRole('button', { name: copy.inspect }));
  await screen.findByText(copy.conflict);
  expect(screen.getByLabelText(copy.maximumAmount)).toHaveValue('20.00');
  expect(policyCommands).toHaveLength(1);
});
it('requires confirmation for test credits, preserves exact strings and displays receipt rather than current spendable balance', async () => {
  mount('enterpriseTestCredit');
  await fillCredit();
  await userEvent.click(screen.getByRole('button', { name: copy.review }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText(draft.amount)).toBeVisible();
  expect(credits).toHaveLength(0);
  await userEvent.click(within(dialog).getByRole('button', { name: copy.cancel }));
  expect(credits).toHaveLength(0);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await reviewConfirm();
  await screen.findByText(copy.creditConfirmed);
  expect(credits).toHaveLength(1);
  expect(credits[0]).toMatchObject({ ...draft, confirmed: true });
  expect(Object.keys(credits[0]!).sort()).toEqual([
    'amount',
    'confirmed',
    'idempotencyKey',
    'programCode',
    'reason',
    'rewardTypeCode',
    'walletCode',
  ]);
  expect(screen.queryByText('90.00')).toBeNull();
  expect(screen.getByText('test-ledger')).toBeVisible();
});
it('uncertain test credit freezes its intent and retries only the identical explicitly confirmed key', async () => {
  mount('enterpriseTestCredit');
  await fillCredit();
  loseReply = true;
  await reviewConfirm();
  await screen.findByText(copy.uncertain);
  expect(screen.getByLabelText(copy.walletCode, { exact: false })).toBeDisabled();
  expect(screen.queryByRole('button', { name: copy.newCredit })).toBeNull();
  loseReply = false;
  await userEvent.click(await screen.findByRole('button', { name: copy.retry }));
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: copy.confirm }),
  );
  await screen.findByText(copy.creditConfirmed);
  expect(credits).toHaveLength(2);
  expect(credits[0]).toEqual(credits[1]);
  expect(screen.getByText('CURRENT')).toBeVisible();
});
it('does not queue an offline credit or replay it when connectivity returns', async () => {
  mount('enterpriseTestCredit');
  await fillCredit();
  onlineManager.setOnline(false);
  await reviewConfirm();
  await screen.findByText(copy.uncertain);
  expect(credits).toHaveLength(0);
  onlineManager.setOnline(true);
  await Promise.resolve();
  expect(credits).toHaveLength(0);
});
it('foreign or disabled metadata makes no owner requests; authority replacement removes private drafts', async () => {
  const view = mount('enterpriseTestCredit');
  await fillCredit();
  view.rerenderProps({ bootstrap: structuredClone(bootstrap) });
  expect(screen.getByLabelText(copy.walletCode, { exact: false })).toHaveValue(
    draft.walletCode,
  );
  view.rerenderProps({ sessionGeneration: 2 });
  await waitFor(() =>
    expect(screen.getByLabelText(copy.walletCode, { exact: false })).toHaveValue(''),
  );
  view.rerenderProps({
    navigation: { ...navigation('enterpriseTestCredit'), featureState: 'DISABLED' },
  });
  expect(screen.queryByLabelText(copy.walletCode, { exact: false })).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  expect(
    loyaltyView({ ...navigation('wallet'), moduleName: 'profile' }),
  ).toBeUndefined();
});
it('malformed policy selections, foreign scope and unsupported credit receipts are never admitted as evidence', () => {
  expect(() => parseSelections({ enabled: true })).toThrow();
  expect(() => parseSelections({ maximumDailyCount: 0 })).toThrow();
  expect(() =>
    parseSettings({ ...settings, ownerCode: 'foreign' }, 'merchant', settings),
  ).toThrow();
  const command: CreditCommand = { ...draft, idempotencyKey: 'key', confirmed: true };
  expect(() =>
    parseCreditReceipt({ ...receipt(command), testOnly: false }, command),
  ).toThrow();
  expect(() =>
    parseCreditReceipt({ ...receipt(command), amount: '999' }, command),
  ).toThrow();
  expect(() =>
    parseCreditReceipt({ ...receipt(command), ledgerEntryCode: '' }, command),
  ).toThrow();
});

it('explicit original-command recovery requires its retained key and never substitutes a new key', async () => {
  mount('enterpriseTestCredit');
  await fillCredit();
  await userEvent.click(screen.getByLabelText(copy.recoverOriginal));
  await userEvent.click(screen.getByRole('button', { name: copy.review }));
  await screen.findByText(copy.invalid);
  expect(credits).toHaveLength(0);
  fireEvent.change(screen.getByLabelText(copy.idempotencyKey, { exact: false }), {
    target: { value: 'retained-original-key' },
  });
  await reviewConfirm();
  await screen.findByText(copy.creditConfirmed);
  expect(credits[0]?.idempotencyKey).toBe('retained-original-key');
});
it('late credit completion after authority replacement cannot display an old receipt or issue dependent calls', async () => {
  const view = mount('enterpriseTestCredit');
  await fillCredit();
  let release: ((r: Response) => void) | undefined;
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await userEvent.click(screen.getByRole('button', { name: copy.review }));
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: copy.confirm }),
  );
  await waitFor(() => expect(release).toBeDefined());
  view.unmount();
  release!(
    Response.json({
      data: receipt({ ...draft, idempotencyKey: 'unknown', confirmed: true }),
    }),
  );
  await Promise.resolve();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(copy.creditConfirmed)).toBeNull();
});
it('CMS failure and owner denial expose no stale evidence and never use alternate connections', async () => {
  const view = mount('wallet');
  deny = true;
  await userEvent.click(await screen.findByRole('button', { name: copy.refresh }));
  await screen.findByText(copy.unavailable);
  expect(fetch).toHaveBeenCalledTimes(1);
  view.unmount();
  vi.mocked(resolveCmsPage).mockRejectedValue(new Error('Synthetic missing copy'));
  mount('transferSettings');
  await screen.findByText('Synthetic missing copy');
  expect(screen.queryByLabelText(copy.programCode)).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});
