/** Synthetic CMS and owner transports only; no live activation or browser acceptance. */
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
  cleanup,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createAxisQueryClient } from '../../app/axisQueryClient';
import { CommercialAgreementRoutePage } from './CommercialAgreementRoutePage';
import {
  admitsAgreementWorkspace,
  parseAgreementWorkspace,
  parseAgreementCopy,
  type AgreementCommand,
} from './agreementClient';
import { emptyAgreementTerms, prepareAgreementTerms } from './agreementDraft';
import {
  copy,
  navigation,
  bootstrap,
  workspace,
  initialRecord,
  terms,
} from './agreementTestFixtures';
import { resolveCmsPage } from '../../cms/cmsClient';
import type { CmsResolvedPageContract } from '../../cms/cmsContract';
import { runtime } from '../../../test/enterprise/registrationFixtures';
vi.mock('../../cms/cmsClient', () => ({ resolveCmsPage: vi.fn() }));
let state: typeof initialRecord | undefined,
  commands: AgreementCommand[],
  allowed: string[],
  loseReply: boolean;
const cms = {
  site: 'axisCmsSite',
  path: navigation.route,
  page: {
    components: [
      {
        code: 'commercialAgreementWorkspaceCopy',
        renderer: 'axis.component.message',
        rendererContractVersion: 1,
        properties: copy,
      },
    ],
  },
} as unknown as CmsResolvedPageContract;
beforeEach(() => {
  state = structuredClone(initialRecord);
  commands = [];
  allowed = ['read', 'search', 'record'];
  loseReply = false;
  vi.mocked(resolveCmsPage).mockResolvedValue({ status: 'resolved', page: cms });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, init: RequestInit) => {
      await Promise.resolve();
      if (typeof init.body !== 'string') throw new Error('Expected JSON body');
      const body = JSON.parse(init.body) as AgreementCommand & {
        pageNumber: number;
        pageSize: number;
      };
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token');
      expect(new Headers(init.headers).get('x-enterprise-code')).toBe('merchant');
      let data: unknown;
      if (url.pathname.endsWith('/workspace'))
        data = {
          ...workspace,
          enterpriseCode: body.enterpriseCode,
          availableCommands: allowed,
        };
      else if (url.pathname.endsWith('/search'))
        data = {
          pageNumber: body.pageNumber,
          pageSize: body.pageSize,
          hasMore: false,
          agreements: state
            ? [
                {
                  code: state.code,
                  revision: state.revision,
                  latestVersion: state.revision,
                  enterpriseRef: state.enterpriseRef,
                },
              ]
            : [],
        };
      else if (url.pathname.endsWith('/read')) {
        if (!state)
          return Response.json({ code: 'ERR_AGREEMENT_MISSING' }, { status: 404 });
        data = state;
      } else {
        commands.push(body);
        if (!state || !state.versions.some((v) => v.commandId === body.commandId)) {
          const version = {
            version: body.expectedRevision + 1,
            commandId: body.commandId,
            actor: 'operator',
            recordedAt: '2026-10-19T00:00:00Z',
            terms: body.terms,
            command: {
              commandId: body.commandId,
              expectedRevision: body.expectedRevision,
              terms: body.terms,
            },
            agreedPrice: {
              reference: body.terms.priceRef,
              unitAmount: '125.00',
              currency: 'AED',
            },
          };
          state = {
            code: body.code,
            enterpriseRef: {
              module: 'profile',
              schema: 'enterprise',
              code: body.enterpriseCode,
            },
            revision: version.version,
            versions: [...(state?.versions || []), version],
          };
        }
        if (loseReply) throw new Error('Lost acknowledgement');
        data = {
          code: body.code,
          version: body.expectedRevision + 1,
          revision: state.revision,
          replayed: false,
        };
      }
      return Response.json({ data });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
});
function mount(overrides = {}) {
  const props = {
    bootstrap,
    navigation,
    accessToken: 'token',
    sessionGeneration: 1,
    runtime: { ...runtime, enterpriseCode: 'merchant' },
    cmsBaseUrl: 'https://cms.example.test',
    site: 'axisCmsSite',
    locale: 'en',
    channel: 'web',
    ...overrides,
  };
  const client = createAxisQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <CommercialAgreementRoutePage {...props} />
    </QueryClientProvider>,
  );
  return {
    ...view,
    props,
    client,
    rerenderProps: (patch: Partial<typeof props>) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <CommercialAgreementRoutePage {...props} {...patch} />
        </QueryClientProvider>,
      ),
  };
}
async function open() {
  await userEvent.click(await screen.findByRole('button', { name: copy.search }));
  await userEvent.click(
    await screen.findByRole('button', { name: /agreement Revision: 1/ }),
  );
  await screen.findByText(copy.agreedPrice + ': 125.00 AED');
}
async function amend() {
  await open();
  await userEvent.click(screen.getByRole('button', { name: copy.amend }));
  fireEvent.change(screen.getByLabelText(copy.effectiveFrom, { exact: false }), {
    target: { value: '2026-11-01T00:00:00Z' },
  });
  fireEvent.change(screen.getByLabelText(copy.serviceStart, { exact: false }), {
    target: { value: '2026-11-01T00:00:00Z' },
  });
}
it('loads CMS copy, lists scoped records and reads retained history without a mutation', async () => {
  mount();
  await open();
  expect(commands).toHaveLength(0);
  expect(screen.getByText('Recorded by: operator')).toBeVisible();
  expect(screen.getByLabelText(copy.services, { exact: false })).toBeDisabled();
});
it('confirms a reviewed amendment once and reads persisted history with the exact revision and command identity', async () => {
  mount();
  await amend();
  await userEvent.click(screen.getByRole('button', { name: copy.review }));
  const dialog = screen.getByRole('dialog');
  expect(commands).toHaveLength(0);
  await userEvent.click(within(dialog).getByRole('button', { name: copy.confirm }));
  await screen.findByText(copy.recorded);
  expect(commands).toHaveLength(1);
  expect(commands[0]?.expectedRevision).toBe(1);
  expect(commands[0]?.terms.effectiveFrom).toBe('2026-11-01T00:00:00.000Z');
  expect(state?.versions).toHaveLength(2);
});
it('retains an uncertain immutable command and reconciles committed history without issuing another write', async () => {
  mount();
  await amend();
  loseReply = true;
  await userEvent.click(screen.getByRole('button', { name: copy.review }));
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: copy.confirm }),
  );
  await screen.findByText(copy.uncertain);
  expect(commands).toHaveLength(1);
  expect(screen.getByLabelText(copy.services, { exact: false })).toBeDisabled();
  await userEvent.click(await screen.findByRole('button', { name: copy.inspect }));
  await screen.findByText(copy.recorded);
  expect(commands).toHaveLength(1);
});
it('read-only owner admission hides creation/amendment and an absent or disabled navigation never sends owner calls', async () => {
  allowed = ['search', 'read'];
  const view = mount();
  await open();
  expect(screen.queryByRole('button', { name: copy.create })).toBeNull();
  expect(screen.queryByRole('button', { name: copy.amend })).toBeNull();
  const count = vi.mocked(fetch).mock.calls.length;
  view.rerenderProps({ navigation: { ...navigation, featureState: 'DISABLED' } });
  expect(screen.queryByLabelText(copy.services)).toBeNull();
  expect(vi.mocked(fetch).mock.calls).toHaveLength(count);
});
it('equivalent bootstrap refresh preserves a draft, but a new admission clears private state', async () => {
  const view = mount();
  await amend();
  fireEvent.change(screen.getByLabelText(copy.services, { exact: false }), {
    target: { value: 'Private unsaved terms' },
  });
  view.rerenderProps({ bootstrap: structuredClone(bootstrap) });
  expect(screen.getByLabelText(copy.services, { exact: false })).toHaveValue(
    'Private unsaved terms',
  );
  view.rerenderProps({ sessionGeneration: 2 });
  await screen.findByRole('button', { name: copy.search });
  expect(screen.queryByLabelText(copy.services)).toBeNull();
});
it('offline confirmation never invokes the owner and never resumes when connectivity returns', async () => {
  mount();
  await amend();
  await userEvent.click(screen.getByRole('button', { name: copy.review }));
  onlineManager.setOnline(false);
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: copy.confirm }),
  );
  await screen.findByText(copy.uncertain);
  onlineManager.setOnline(true);
  await waitFor(() => expect(commands).toHaveLength(0));
});
it('new agreement has no implicit business selections and cancellation preserves the draft until explicit discard', async () => {
  mount();
  await userEvent.click(await screen.findByRole('button', { name: copy.search }));
  await userEvent.click(await screen.findByRole('button', { name: copy.create }));
  expect(screen.getByLabelText(copy.code, { exact: false })).toHaveValue('');
  expect(screen.getByLabelText(copy.packageCode, { exact: false })).toHaveValue('');
  await userEvent.click(screen.getByRole('button', { name: copy.discard }));
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: copy.cancel }),
  );
  expect(screen.getByLabelText(copy.code, { exact: false })).toBeVisible();
  expect(commands).toHaveLength(0);
});
it('guards exact owner/view dispatch, metadata shapes, CMS labels and neutral transport preparation', () => {
  expect(admitsAgreementWorkspace({ ...navigation, moduleName: 'profile' })).toBe(
    false,
  );
  expect(
    admitsAgreementWorkspace({
      ...navigation,
      backendWorkspace: { ...navigation.backendWorkspace!, viewCode: 'foreign' },
    }),
  ).toBe(false);
  expect(() =>
    parseAgreementWorkspace(
      { ...workspace, mutation: { automaticRetry: true } },
      'merchant',
    ),
  ).toThrow();
  expect(() =>
    parseAgreementCopy({ ...cms, page: { ...cms.page, components: [] } }),
  ).toThrow();
  expect(emptyAgreementTerms().model).toBe('');
  expect(emptyAgreementTerms().benefits).toEqual([]);
  for (const model of ['FIXED_PRICE', 'SUBSCRIPTION'])
    for (const paymentTerms of ['PREPAID', 'INVOICE']) {
      const prepared = prepareAgreementTerms({
        ...terms,
        model,
        paymentTerms,
        billingPeriod: 'Monthly',
      });
      expect(prepared.model).toBe(model);
      expect(prepared.paymentTerms).toBe(paymentTerms);
    }
});
it('unmounted command acknowledgements cannot issue dependent reads or restore evidence', async () => {
  const view = mount();
  await amend();
  let release: ((response: Response) => void) | undefined;
  const delegate = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation((url, init) =>
    (url instanceof URL ? url.href : typeof url === 'string' ? url : url.url).endsWith(
      '/record',
    )
      ? new Promise<Response>((resolve) => {
          release = resolve;
        })
      : delegate(url, init),
  );
  await userEvent.click(screen.getByRole('button', { name: copy.review }));
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: copy.confirm }),
  );
  await waitFor(() => expect(release).toBeDefined());
  view.unmount();
  const calls = vi.mocked(fetch).mock.calls.length;
  release!(
    Response.json({
      data: { code: 'agreement', version: 2, revision: 2, replayed: false },
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(vi.mocked(fetch).mock.calls).toHaveLength(calls);
});

it('records a complete new agreement only after explicit business selections and confirmation', async () => {
  state = undefined;
  mount();
  await userEvent.click(await screen.findByRole('button', { name: copy.search }));
  await userEvent.click(await screen.findByRole('button', { name: copy.create }));
  const values = {
    code: 'new-agreement',
    packageCode: 'package',
    packageVersion: '1',
    priceCode: 'price',
    priceVersion: '1',
    services: 'Agreed services',
    allowances: 'Descriptive only',
    effectiveFrom: '2026-10-01T00:00:00Z',
    serviceStart: '2026-10-01T00:00:00Z',
    paymentSchedule: 'By invoice',
    terminationTerms: 'By agreement',
    financialTreatment: 'No automatic charge',
    evidenceRef: 'document-1',
  };
  for (const [key, value] of Object.entries(values))
    fireEvent.change(
      screen.getByLabelText(copy[key as keyof typeof copy], { exact: false }),
      { target: { value } },
    );
  for (const [key, value] of [
    ['model', 'FIXED_PRICE'],
    ['paymentTerms', 'INVOICE'],
    ['renewalMode', 'NONE'],
  ] as const) {
    await userEvent.click(screen.getByLabelText(copy[key], { exact: false }));
    await userEvent.click(await screen.findByRole('option', { name: copy[value] }));
  }
  await userEvent.click(screen.getByRole('button', { name: copy.review }));
  expect(commands).toHaveLength(0);
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: copy.confirm }),
  );
  await screen.findByText(copy.recorded);
  expect(commands[0]?.expectedRevision).toBe(0);
  expect(commands[0]?.code).toBe('new-agreement');
  expect(commands[0]?.terms.model).toBe('FIXED_PRICE');
  expect(commands[0]?.terms.paymentTerms).toBe('INVOICE');
  expect(state).toMatchObject({ revision: 1 });
});
