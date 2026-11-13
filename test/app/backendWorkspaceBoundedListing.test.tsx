import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { BackendOperationsWorkspaceRoutePage } from '../../src/app/BackendOperationsWorkspaceRoutePage';
import { parseBackendWorkspace } from '../../src/bootstrap/publicBootstrap';

const descriptor = {
  contractVersion: 0,
  title: 'Customer directory',
  renderer: 'axis.workspace.backend-operations',
  tabs: [
    {
      id: 'customers',
      label: 'Customers',
      sections: [
        {
          id: 'directory',
          type: 'listing',
          title: 'Find a customer',
          submitLabel: 'Search customers',
          endpoint: {
            method: 'POST',
            path: '/nodics/profile/v0/participants/search',
            resultPath: 'items',
          },
          filters: [
            {
              name: 'ownerType',
              label: 'Type',
              type: 'HIDDEN',
              required: true,
              defaultValue: 'CUSTOMER',
            },
            {
              name: 'search',
              label: 'Customer name or reference',
              type: 'TEXT',
              required: true,
              minimumLength: 3,
              maximumLength: 100,
            },
          ],
          columns: [
            { field: 'displayName', label: 'Display name' },
            { field: 'ownerCode', label: 'Customer reference' },
          ],
        },
      ],
    },
  ],
};
const workspace = parseBackendWorkspace(descriptor);
const runtime = {
  enterpriseCode: 'default',
  projectCode: 'project',
  backofficeBaseUrl: 'https://platform.example',
  requestTimeoutMs: 1000,
};
const connection = {
  moduleName: 'profile',
  endpoint: 'https://platform.example/nodics/profile',
  instanceId: 'platform',
  environment: 'local',
  state: 'UP',
};
const response = (items: unknown) =>
  new Response(
    JSON.stringify({
      code: 'SUC_SYS_00000',
      result: { contractVersion: 1, tenant: 'tenant', items },
    }),
  );
const show = (actor = 'original-actor', timeoutMs = runtime.requestTimeoutMs) => (
  <MemoryRouter>
    <BackendOperationsWorkspaceRoutePage
      workspace={workspace}
      runtime={{ ...runtime, requestTimeoutMs: timeoutMs } as never}
      accessToken={actor}
      connection={connection as never}
      bootstrap={{ tenantCode: 'tenant' } as never}
    />
  </MemoryRouter>
);
afterEach(() => vi.unstubAllGlobals());

it('renders explicit owner enum labels while retaining raw filter and record values', async () => {
  const records = [{ roleCode: 'LOCAL_OPERATIONS', status: 'REGISTERED' }];
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(() => Promise.resolve(response(records)));
  vi.stubGlobal('fetch', fetcher);
  const labelled = parseBackendWorkspace({
    contractVersion: 0,
    title: 'Assignments',
    renderer: 'axis.workspace.backend-operations',
    tabs: [
      {
        id: 'users',
        label: 'Assignments',
        sections: [
          {
            id: 'assignments',
            type: 'listing',
            title: 'Current assignments',
            endpoint: {
              method: 'GET',
              path: '/nodics/profile/v0/enterprises/access-assignments',
              resultPath: 'items',
            },
            columns: [
              { field: 'roleCode', label: 'Responsibility' },
              { field: 'status', label: 'Status' },
            ],
            filters: [
              {
                name: 'roleCode',
                label: 'Responsibility',
                type: 'SELECT',
                options: [
                  { value: '', label: 'Any responsibility' },
                  { value: 'LOCAL_OPERATIONS', label: 'Operations colleague' },
                ],
              },
              {
                name: 'status',
                label: 'Status',
                type: 'SELECT',
                options: [
                  { value: '', label: 'Any status' },
                  { value: 'REGISTERED', label: 'Registered' },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <BackendOperationsWorkspaceRoutePage
        workspace={labelled}
        runtime={runtime as never}
        connection={connection as never}
        accessToken="original-actor"
      />
    </MemoryRouter>,
  );
  expect(
    await screen.findByRole('cell', { name: 'Operations colleague' }),
  ).toBeVisible();
  expect(screen.getByRole('cell', { name: 'Registered' })).toBeVisible();
  await user.click(screen.getByRole('combobox', { name: 'Responsibility' }));
  await user.click(screen.getByRole('option', { name: 'Operations colleague' }));
  await user.click(screen.getByRole('button', { name: 'Apply' }));
  const requested = fetcher.mock.calls.at(-1)?.[0];
  expect(
    typeof requested === 'string'
      ? requested
      : requested instanceof URL
        ? requested.href
        : requested?.url,
  ).toContain('roleCode=LOCAL_OPERATIONS');
  expect(records).toEqual([{ roleCode: 'LOCAL_OPERATIONS', status: 'REGISTERED' }]);
});

it('accepts the deployment runtime timeout already admitted by Axis configuration', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response([]));
  vi.stubGlobal('fetch', fetcher);
  render(show('original-actor', 360000));
  const user = userEvent.setup();
  await user.type(
    screen.getByRole('textbox', { name: 'Customer name or reference' }),
    'guest',
  );
  await user.click(screen.getByRole('button', { name: 'Search customers' }));
  expect(await screen.findByText('No records returned.')).toBeVisible();
  expect(screen.queryByText('Workspace request timeout is invalid')).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('settles an unavailable owner read at the existing timeout without retrying or claiming no matches', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  render(show());
  const user = userEvent.setup();
  await user.type(
    screen.getByRole('textbox', { name: 'Customer name or reference' }),
    'Sam',
  );
  await user.click(screen.getByRole('button', { name: 'Search customers' }));
  expect(
    await screen.findByText(
      'Workspace read timed out. Try this read again.',
      {},
      { timeout: 2000 },
    ),
  ).toBeVisible();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('No records returned.')).toBeNull();
});

it('waits for valid filters, then sends only the declared bounded owner search', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    response([
      {
        ownerType: 'CUSTOMER',
        ownerCode: 'customer-one',
        displayName: 'Sam Example',
      },
    ]),
  );
  vi.stubGlobal('fetch', fetcher);
  render(show());
  const user = userEvent.setup();
  expect(
    screen.getByText('Complete the required filters to view records.'),
  ).toBeVisible();
  expect(screen.queryByText('No records returned.')).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
  await user.type(
    screen.getByRole('textbox', { name: 'Customer name or reference' }),
    'Sa',
  );
  await user.click(screen.getByRole('button', { name: 'Search customers' }));
  expect(screen.getByText(/needs at least 3 characters/)).toBeVisible();
  expect(fetcher).not.toHaveBeenCalled();
  await user.type(
    screen.getByRole('textbox', { name: 'Customer name or reference' }),
    'm',
  );
  await user.click(screen.getByRole('button', { name: 'Search customers' }));
  expect(await screen.findByText('Sam Example')).toBeVisible();
  expect(screen.getByText('customer-one')).toBeVisible();
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, init] = fetcher.mock.calls[0]!;
  expect(url instanceof URL ? url.href : typeof url === 'string' ? url : url.url).toBe(
    'https://platform.example/nodics/profile/v0/participants/search',
  );
  expect(init?.method).toBe('POST');
  const body = init?.body;
  if (typeof body !== 'string')
    throw new Error('Expected the declared JSON request body');
  expect(JSON.parse(body)).toEqual({
    ownerType: 'CUSTOMER',
    search: 'Sam',
  });
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer original-actor');
  expect(init?.redirect).toBe('error');
});

it('distinguishes a valid empty result from a malformed owner list', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(response([]))
    .mockResolvedValueOnce(response({ unexpected: true }));
  vi.stubGlobal('fetch', fetcher);
  render(show());
  const user = userEvent.setup();
  await user.type(
    screen.getByRole('textbox', { name: 'Customer name or reference' }),
    'Nobody',
  );
  await user.click(screen.getByRole('button', { name: 'Search customers' }));
  expect(await screen.findByText('No records returned.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: /^Refresh$/ }));
  expect(
    await screen.findByText(/owner did not return a valid record list/),
  ).toBeVisible();
  expect(screen.queryByText('No records returned.')).toBeNull();
});

it('retires delayed directory evidence and filter state when the employee changes', async () => {
  let finish: ((value: Response) => void) | undefined;
  const fetcher = vi.fn<typeof fetch>().mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  const view = render(show());
  const user = userEvent.setup();
  await user.type(
    screen.getByRole('textbox', { name: 'Customer name or reference' }),
    'Sam',
  );
  await user.click(screen.getByRole('button', { name: 'Search customers' }));
  view.rerender(show('different-actor'));
  await act(async () => {
    finish?.(response([{ ownerCode: 'retired', displayName: 'Retired name' }]));
    await Promise.resolve();
  });
  expect(screen.queryByText('Retired name')).toBeNull();
  expect(
    screen.getByRole('textbox', { name: 'Customer name or reference' }),
  ).toHaveValue('');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([0, -1, 4001, 101, 1.5])(
  'rejects malformed or conflicting minimum length %s',
  (minimumLength) => {
    const next = structuredClone(descriptor);
    next.tabs[0]!.sections[0]!.filters[1]!.minimumLength = minimumLength;
    expect(() => parseBackendWorkspace(next)).toThrow(/minimum length/);
  },
);
