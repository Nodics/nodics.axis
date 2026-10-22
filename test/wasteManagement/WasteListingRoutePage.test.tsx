import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  WasteManagementRoutePage,
  type WasteManagementRoutePageProps,
} from '../../src/operations/wasteManagement/WasteManagementRoutePage';
import { WasteListingRoutePage } from '../../src/operations/wasteManagement/WasteListingRoutePage';
import { configuration, listing, presentation } from './listingFixtures';
import { loadWasteOperationsContext } from '../../src/operations/wasteManagement/api/wasteReviewClient';

vi.mock(
  '../../src/operations/wasteManagement/api/wasteReviewClient',
  async (original) => ({
    ...(await original<
      typeof import('../../src/operations/wasteManagement/api/wasteReviewClient')
    >()),
    loadWasteOperationsContext: vi.fn(),
  }),
);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const navigation = {
  id: 'ewaste-operations-listing-requests',
  moduleName: 'eWaste',
  label: 'Listing requests',
  route: '/waste/assets/electronics/listing-requests',
  category: 'waste',
  icon: 'waste',
  order: 40,
  availability: 'UP',
  featureState: 'ACTIVE',
  perspectives: [],
  contexts: [],
  backendWorkspace: {
    contractVersion: 1,
    renderer: 'axis.workspace.native',
    workspaceCode: 'waste.listing',
    viewCode: 'ewaste.listingRequests',
    title: 'Electronics listing requests',
    tabs: [],
  },
} as const;
const props: WasteManagementRoutePageProps = {
  accessToken: configuration.accessToken,
  employeeId: 'synthetic-operator',
  sessionGeneration: 1,
  bootstrap: { ...configuration.bootstrap, navigation: [navigation] },
  navigation,
  runtime: {
    enterpriseCode: configuration.enterpriseCode,
    requestTimeoutMs: 1000,
    browserSessionTimeoutMs: 15_000,
    backofficeBaseUrl: 'https://backoffice.example.test',
    projectCode: 'synthetic',
    clientContractVersion: 1,
    browserSessionCsrfCookieName: 'synthetic-csrf',
    assistantMaximumEventBytes: 1000,
    assistantReconnectWindowMs: 1000,
    assistantIdleTimeoutMs: 1000,
  },
};
const workspace = {
  contractVersion: 1,
  workspaceCode: 'waste.listing',
  viewCode: 'ewaste.listingRequests',
  presentation,
};
function transport(workspaceResponse: unknown = workspace, row: unknown = listing) {
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation((input) => {
    const url = requestUrl(input);
    const data = url.endsWith('/listing-workspace')
      ? workspaceResponse
      : url.includes('?')
        ? {
            contractVersion: 1,
            items: [row],
            total: 1,
            page: 1,
            limit: 25,
          }
        : row;
    return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200 }));
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
function requestUrl(input: RequestInfo | URL): string {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}
describe('mounted backend-contributed listing requests', () => {
  it('does not read a queue after presentation denial and retries only an explicit workspace refresh', async () => {
    const fetch = transport();
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'PRIVATE owner failure' }), {
        status: 503,
      }),
    );
    render(<WasteManagementRoutePage {...props} />);
    expect(
      await screen.findByText('Workspace presentation is unavailable.'),
    ).toBeVisible();
    expect(screen.queryByText('PRIVATE owner failure')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Refresh workspace' }));
    expect(
      await screen.findByRole('table', { name: presentation.labels.title }),
    ).toBeVisible();
    expect(fetch.mock.calls.map(([url]) => requestUrl(url))).toEqual([
      'https://waste.example.test/nodics/eWaste/v0/listing-workspace',
      'https://waste.example.test/nodics/eWaste/v0/listing-workspace',
      'https://waste.example.test/nodics/eWaste/v0/listing-requests?page=1&limit=25',
    ]);
  });
  it('retires a late presentation response after a new authenticated admission', async () => {
    let finish!: (value: Response) => void;
    const fetch = transport();
    fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(<WasteManagementRoutePage {...props} />);
    view.rerender(
      <WasteManagementRoutePage
        {...props}
        accessToken="new-synthetic-token"
        sessionGeneration={2}
      />,
    );
    expect(
      await screen.findByRole('table', { name: presentation.labels.title }),
    ).toBeVisible();
    await act(async () => {
      finish(
        new Response(
          JSON.stringify({
            data: {
              ...workspace,
              presentation: {
                ...presentation,
                labels: { ...presentation.labels, title: 'Retired private caption' },
              },
            },
          }),
          { status: 200 },
        ),
      );
      await Promise.resolve();
    });
    expect(screen.queryByText('Retired private caption')).not.toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: presentation.labels.title }),
    ).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('dispatches the exact binding into a GET-only queue/detail without loading the review workspace', async () => {
    const fetch = transport();
    render(<WasteManagementRoutePage {...props} />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Inspect listing: SYNTHETIC_ASSET' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Synthetic headphone')).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls.map(([url]) => requestUrl(url))).toEqual([
      'https://waste.example.test/nodics/eWaste/v0/listing-workspace',
      'https://waste.example.test/nodics/eWaste/v0/listing-requests?page=1&limit=25',
      'https://waste.example.test/nodics/eWaste/v0/listing-requests/SYNTHETIC_ASSET',
    ]);
    for (const [, init] of fetch.mock.calls) {
      expect(init?.method).toBe('GET');
      expect(init?.body).toBeUndefined();
      expect(new Headers(init?.headers).get('x-enterprise-code')).toBe(
        configuration.enterpriseCode,
      );
    }
    expect(loadWasteOperationsContext).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { ...workspace, workspaceCode: 'product' },
    { ...workspace, presentation: { ...presentation, states: {} } },
    { ...workspace, presentation: { ...presentation, labels: {} } },
  ])(
    'fails closed on missing or malformed presentation without exposing rows: %j',
    async (value) => {
      const fetch = transport(value);
      render(<WasteManagementRoutePage {...props} />);
      expect(
        await screen.findByText('Workspace presentation is unavailable.'),
      ).toBeVisible();
      expect(screen.queryByText('SYNTHETIC_ASSET')).not.toBeInTheDocument();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(loadWasteOperationsContext).not.toHaveBeenCalled();
    },
  );
  it('keeps an admitted reviewer in the signed enterprise and shows the required Store context read-only', async () => {
    const fetch = transport(workspace, {
      ...listing,
      eligibility: {
        ...listing.eligibility,
        signedEnterpriseCode: 'Default',
        blockerCode: 'ERR_EWASTE_LISTING_STORE_ENTERPRISE_REQUIRED',
      },
    });
    render(
      <WasteManagementRoutePage
        {...props}
        runtime={{ ...props.runtime, enterpriseCode: 'Default' }}
      />,
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Inspect listing: SYNTHETIC_ASSET' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByText(presentation.labels.wrongEnterprise),
    ).toBeVisible();
    expect(within(dialog).getByText('Default')).toBeVisible();
    expect(within(dialog).getByText('STORE_ENTERPRISE')).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: presentation.labels.authorProduct }),
    ).toBeDisabled();
    for (const [, init] of fetch.mock.calls)
      expect(new Headers(init?.headers).get('x-enterprise-code')).toBe('Default');
  });
  it.each([
    { moduleName: 'product' },
    { availability: 'DOWN' },
    { featureState: 'HIDDEN' },
    { backendWorkspace: { ...navigation.backendWorkspace, viewCode: 'invented' } },
    { backendWorkspace: { ...navigation.backendWorkspace, contractVersion: 2 } },
    {
      backendWorkspace: {
        ...navigation.backendWorkspace,
        ownerSelector: { runtimeRoleCode: 'MISSING' },
      },
    },
  ])('does not load a queue through an unavailable or altered binding: %j', (patch) => {
    const fetch = transport();
    render(
      <WasteListingRoutePage
        {...props}
        navigation={{ ...navigation, ...patch } as typeof props.navigation}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This workspace is unavailable',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
