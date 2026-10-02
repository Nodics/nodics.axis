import { loadPublicBackendWorkspace } from '../../src/app/backendWorkspaceClient';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackendOperationsWorkspaceRoutePage } from '../../src/app/BackendOperationsWorkspaceRoutePage';
import type { AxisBackendWorkspace } from '../../src/bootstrap/publicBootstrap';
import { parseBackendWorkspace } from '../../src/bootstrap/publicBootstrap';

const runtime = Object.freeze({
  backofficeBaseUrl: 'https://backoffice.example.test',
  enterpriseCode: 'default',
  requestTimeoutMs: 1000,
}) as never;

const workspace: AxisBackendWorkspace = Object.freeze({
  contractVersion: 0,
  title: 'Enterprise and User Management',
  description: 'Backend-owned workspace',
  renderer: 'axis.workspace.backend-operations',
  defaultTab: 'enterprises',
  tabs: Object.freeze([
    Object.freeze({
      id: 'enterprises',
      label: 'Enterprises',
      sections: Object.freeze([
        Object.freeze({
          id: 'enterprise-list',
          type: 'listing',
          title: 'Enterprise Registry',
          endpoint: Object.freeze({
            method: 'GET',
            path: '/nodics/profile/v0/enterprises/search',
            resultPath: 'items',
          }),
          columns: Object.freeze([
            Object.freeze({ field: 'code', label: 'Code' }),
            Object.freeze({ field: 'name', label: 'Name' }),
          ]),
          filters: Object.freeze([
            Object.freeze({
              name: 'code',
              label: 'Enterprise code',
              type: 'TEXT',
              required: false,
            }),
          ]),
        }),
        Object.freeze({
          id: 'create-enterprise',
          type: 'form',
          title: 'Create Enterprise',
          submitLabel: 'Create enterprise',
          endpoint: Object.freeze({
            method: 'POST',
            path: '/nodics/profile/v0/enterprises',
          }),
          fields: Object.freeze([
            Object.freeze({
              name: 'code',
              label: 'Enterprise code',
              type: 'TEXT',
              required: true,
            }),
            Object.freeze({
              name: 'name',
              label: 'Enterprise name',
              type: 'TEXT',
              required: true,
            }),
            Object.freeze({
              name: 'idempotencyKey',
              label: 'Idempotency key',
              type: 'IDEMPOTENCY',
              required: true,
            }),
          ]),
        }),
      ]),
    }),
  ]),
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const publication: AxisBackendWorkspace = {
  ...workspace,
  defaultTab: 'request',
  tabs: [
    {
      id: 'request',
      label: 'Request',
      sections: [
        {
          id: 'publish',
          type: 'form',
          title: 'Inspect current source',
          submitLabel: 'Request Approval',
          endpoint: { method: 'POST', path: '/nodics/media/v0/library/publications' },
          readSource: {
            endpoint: { method: 'GET', path: '/nodics/media/v0/library/{mediaCode}' },
            parameter: 'mediaCode',
            fields: { mediaCode: 'code', versionId: 'versionId' },
            commandId: 'requestPublication',
            unavailableMessage: 'Owner prerequisites are not satisfied',
          },
          fields: [
            {
              name: 'mediaCode',
              label: 'Media code',
              type: 'TEXT',
              required: true,
              defaultFromParameter: 'mediaCode',
            },
            {
              name: 'versionId',
              label: 'Exact version',
              type: 'TEXT',
              required: true,
              defaultFromParameter: 'versionId',
            },
            {
              name: 'publicationCode',
              label: 'Reference',
              type: 'IDEMPOTENCY',
              required: true,
            },
          ],
        },
      ],
    },
  ],
};

describe('owner-declared row inspection', () => {
  it.each([
    {
      code: 'asset-a',
      versionId: null,
      message: 'Qualified current storage is unavailable.',
      expected: 'Qualified current storage is unavailable.',
    },
    {
      code: 'wrong-asset',
      versionId: null,
      message: 'Wrong owner diagnostic',
      expected: 'Owner prerequisites are not satisfied',
    },
    {
      code: 'asset-a',
      message: 'Missing governed owner permission.',
      expected: 'Missing governed owner permission.',
    },
    {
      code: 'wrong-asset',
      message: 'Private mismatched diagnostic',
      expected: 'Owner prerequisites are not satisfied',
    },
    {
      code: 'asset-a',
      message: 'x'.repeat(513),
      expected: 'Owner prerequisites are not satisfied',
    },
    {
      code: 'asset-a',
      message: { secret: 'not text' },
      expected: 'Owner prerequisites are not satisfied',
    },
  ])(
    'shows bounded matched owner diagnostics without enabling submission ($code)',
    async ({ code, message, expected, versionId }) => {
      const original = window.location.href;
      window.history.replaceState({}, '', '?mediaCode=asset-a');
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              code,
              versionId: versionId === null ? null : 9,
              commands: [],
              publicationReadiness: { message },
            },
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal('fetch', fetcher);
      const configured = {
        ...publication,
        tabs: publication.tabs.map((tab) => ({
          ...tab,
          sections: tab.sections.map((section) => ({
            ...section,
            readSource: section.readSource
              ? {
                  ...section.readSource,
                  unavailableMessagePath: 'publicationReadiness.message',
                }
              : undefined,
          })),
        })),
      };
      try {
        render(
          <BackendOperationsWorkspaceRoutePage
            runtime={runtime}
            accessToken="employee"
            workspace={configured}
          />,
        );
        expect(await screen.findByText(expected)).toBeVisible();
        expect(screen.getByRole('textbox', { name: 'Media code' })).toHaveValue(
          code === 'asset-a' ? 'asset-a' : '',
        );
        expect(screen.getByRole('textbox', { name: 'Exact version' })).toHaveValue(
          code === 'asset-a' && versionId !== null ? '9' : '',
        );
        expect(screen.getByRole('textbox', { name: 'Exact version' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Request Approval' })).toBeDisabled();
        expect(fetcher).toHaveBeenCalledOnce();
        const [input, options] = fetcher.mock.calls[0]!;
        expect(
          input instanceof Request ? input.method : (options?.method ?? 'GET'),
        ).toBe('GET');
      } finally {
        window.history.replaceState({}, '', original);
      }
    },
  );
  it('blocks uncertain submission until explicit inspection without changing its command reference', async () => {
    const original = window.location.href;
    window.history.replaceState({}, '', '?mediaCode=asset-a');
    const commands: string[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_input, options) => {
      if (options?.method === 'POST') {
        if (typeof options.body !== 'string') throw new Error('Expected body');
        commands.push(options.body);
        return Promise.reject(new Error('Acknowledgement unavailable'));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              code: 'asset-a',
              versionId: 9,
              commands: [
                {
                  id: 'requestPublication',
                  method: 'POST',
                  mediaCode: 'asset-a',
                  versionId: 9,
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );
    });
    vi.stubGlobal('fetch', fetcher);
    try {
      render(
        <BackendOperationsWorkspaceRoutePage
          runtime={runtime}
          accessToken="employee"
          workspace={publication}
        />,
      );
      const submit = screen.getByRole('button', { name: 'Request Approval' });
      await waitFor(() => expect(submit).toBeEnabled());
      const user = userEvent.setup();
      await user.click(submit);
      await screen.findByText('Acknowledgement unavailable');
      expect(submit).toBeDisabled();
      expect(commands).toHaveLength(1);
      await user.click(screen.getByRole('button', { name: 'Refresh inspection' }));
      await waitFor(() => expect(submit).toBeEnabled());
      expect(commands).toHaveLength(1);
      await user.click(submit);
      await waitFor(() => expect(commands).toHaveLength(2));
      expect(commands[1]).toBe(commands[0]);
    } finally {
      window.history.replaceState({}, '', original);
    }
  });
  it('links only authorized workspace routes without executing row commands', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: { items: [{ code: 'asset-a', versionId: 8 }] } }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    const listing: AxisBackendWorkspace = {
      ...workspace,
      tabs: [
        {
          id: 'list',
          label: 'List',
          sections: [
            {
              id: 'records',
              type: 'listing',
              title: 'Records',
              endpoint: {
                method: 'GET',
                path: '/nodics/media/v0/library',
                resultPath: 'items',
              },
              columns: [{ field: 'code', label: 'Code' }],
              rowNavigation: {
                label: 'Inspect',
                route: '/media/publication',
                parameters: { mediaCode: 'code' },
              },
            },
          ],
        },
      ],
    };
    const rendered = render(
      <MemoryRouter>
        <BackendOperationsWorkspaceRoutePage
          runtime={runtime}
          workspace={listing}
          accessToken="employee"
          authorizedRoutes={['/media/publication']}
        />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: 'Inspect' })).toHaveAttribute(
      'href',
      '/media/publication?mediaCode=asset-a',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    rendered.rerender(
      <MemoryRouter>
        <BackendOperationsWorkspaceRoutePage
          runtime={runtime}
          workspace={listing}
          accessToken="employee"
          authorizedRoutes={[]}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: 'Inspect' })).toBeNull();
  });
  it('reads fresh exact version without query/body, freezes fields and waits for explicit submission', async () => {
    const original = window.location.href;
    window.history.replaceState({}, '', '?mediaCode=asset-a&versionId=1');
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              code: 'asset-a',
              versionId: 9,
              commands: [
                {
                  id: 'requestPublication',
                  method: 'POST',
                  mediaCode: 'asset-a',
                  versionId: 9,
                  path: 'https://untrusted.test',
                },
              ],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { publicationCode: 'acknowledged' } }), {
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    try {
      render(
        <BackendOperationsWorkspaceRoutePage
          runtime={runtime}
          accessToken="employee"
          workspace={publication}
        />,
      );
      const submit = screen.getByRole('button', { name: 'Request Approval' });
      await waitFor(() => expect(submit).toBeEnabled());
      expect(screen.getByRole('textbox', { name: 'Exact version' })).toHaveValue('9');
      expect(screen.getByRole('textbox', { name: 'Exact version' })).toBeDisabled();
      expect(fetcher).toHaveBeenCalledTimes(1);
      const [url, read] = fetcher.mock.calls[0]!;
      expect(
        url instanceof URL ? url.href : typeof url === 'string' ? url : url.url,
      ).toBe('https://backoffice.example.test/nodics/media/v0/library/asset-a');
      expect(read?.body).toBeUndefined();
      await userEvent.setup().click(submit);
      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
      const [writeUrl, write] = fetcher.mock.calls[1]!;
      expect(
        writeUrl instanceof URL
          ? writeUrl.href
          : typeof writeUrl === 'string'
            ? writeUrl
            : writeUrl.url,
      ).toBe('https://backoffice.example.test/nodics/media/v0/library/publications');
      if (typeof write?.body !== 'string') throw new Error('Expected JSON body');
      const submitted: unknown = JSON.parse(write.body);
      expect(submitted).toMatchObject({
        mediaCode: 'asset-a',
        versionId: '9',
      });
      expect(typeof (submitted as Record<string, unknown>).publicationCode).toBe(
        'string',
      );
    } finally {
      window.history.replaceState({}, '', original);
    }
  });
  it.each(['failed', 'wrong-version', 'ineligible'])(
    'shows only fresh source evidence and blocks publication on %s inspection',
    async (scenario) => {
      const original = window.location.href;
      window.history.replaceState({}, '', '?mediaCode=asset-a&versionId=1');
      const data = {
        code: 'asset-a',
        versionId: 9,
        commands:
          scenario === 'ineligible'
            ? []
            : [
                {
                  id: 'requestPublication',
                  method: 'POST',
                  mediaCode: 'asset-a',
                  versionId: 8,
                },
              ],
      };
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(
            JSON.stringify(
              scenario === 'failed' ? { message: 'Inspection unavailable' } : { data },
            ),
            { status: scenario === 'failed' ? 503 : 200 },
          ),
        );
      vi.stubGlobal('fetch', fetcher);
      try {
        render(
          <BackendOperationsWorkspaceRoutePage
            runtime={runtime}
            workspace={publication}
            accessToken="employee"
          />,
        );
        await screen.findByText(
          scenario === 'failed'
            ? 'Inspection unavailable'
            : 'Owner prerequisites are not satisfied',
        );
        expect(screen.getByRole('textbox', { name: 'Exact version' })).toHaveValue(
          scenario === 'failed' ? '' : '9',
        );
        expect(screen.getByRole('textbox', { name: 'Exact version' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Request Approval' })).toBeDisabled();
        expect(fetcher).toHaveBeenCalledTimes(1);
      } finally {
        window.history.replaceState({}, '', original);
      }
    },
  );
  it('rejects mutation-based inspection descriptors', () => {
    const invalid = {
      ...publication,
      tabs: [
        {
          id: 'request',
          label: 'Request',
          sections: [
            {
              ...publication.tabs[0]!.sections[0],
              readSource: {
                ...publication.tabs[0]!.sections[0]!.readSource,
                endpoint: { method: 'POST', path: '/inspect/{mediaCode}' },
              },
            },
          ],
        },
      ],
    };
    expect(() => parseBackendWorkspace(invalid)).toThrow(/parameterized GET/);
  });
  it.each([
    { endpoint: { method: 'GET', path: '/nodics/profile/v0/library/{mediaCode}' } },
    {
      endpoint: {
        method: 'GET',
        path: '/nodics/media/v0/library/{mediaCode}?extra=yes',
      },
    },
    {
      endpoint: {
        method: 'GET',
        path: '/nodics/media/v0/library/{mediaCode}/{mediaCode}',
      },
    },
    { fields: { mediaCode: 'code', secret: 'credential' } },
  ])('rejects owner inspection escape %j', (change) => {
    const section = publication.tabs[0]!.sections[0]!;
    expect(() =>
      parseBackendWorkspace({
        ...publication,
        tabs: [
          {
            id: 'request',
            label: 'Request',
            sections: [
              { ...section, readSource: { ...section.readSource, ...change } },
            ],
          },
        ],
      }),
    ).toThrow();
  });
});

describe('BackendOperationsWorkspaceRoutePage', () => {
  it('contains the listing minimum width without widening its sibling form or workspace grid', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: { items: [{ code: 'sample', name: 'Sample' }] } }),
        {
          status: 200,
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(
      <div style={{ width: 374 }}>
        <BackendOperationsWorkspaceRoutePage
          accessToken="token"
          runtime={runtime}
          workspace={workspace}
        />
      </div>,
    );
    expect(await screen.findByText('Sample')).toBeVisible();
    const boundary = container.querySelector(
      '[data-axis-layout-boundary="workspace"]',
    )!;
    expect(boundary).toHaveStyle({
      gridTemplateColumns: 'minmax(0, 1fr)',
      minWidth: '0px',
    });
    const table = screen.getByRole('table');
    expect(table).toHaveStyle({ minWidth: '720px' });
    const scroller = table.parentElement!;
    expect(scroller).toHaveStyle({
      overflowX: 'auto',
      minWidth: '0px',
      width: '100%',
      maxWidth: '100%',
    });
    for (const node of [
      scroller.parentElement!,
      scroller.parentElement!.parentElement!,
      screen
        .getByRole('heading', { name: 'Create Enterprise' })
        .closest('.MuiPaper-root')!,
      boundary.firstElementChild!,
      scroller.parentElement!.parentElement!.parentElement!,
    ])
      expect(node).toHaveStyle({ minWidth: '0px' });
    expect(screen.getByRole('textbox', { name: 'Enterprise name' })).toHaveValue('');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('renders backend-provided listings and posts backend-provided forms', async () => {
    const fetchMock = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      await Promise.resolve();
      const requestUrl =
        typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (requestUrl.includes('/enterprises/search')) {
        return new Response(
          JSON.stringify({
            code: 'SUC_PRFL_00000',
            data: { items: [{ code: 'du-shop', name: 'Du Shop' }] },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      expect(requestUrl).toBe(
        'https://backoffice.example.test/nodics/profile/v0/enterprises',
      );
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token');
      expect(new Headers(init?.headers).get('x-enterprise-code')).toBe('default');
      expect(JSON.parse(init?.body as string)).toMatchObject({
        code: 'i2e',
        name: 'I2E',
      });
      return new Response(
        JSON.stringify({ code: 'SUC_PRFL_00000', data: { code: 'i2e', name: 'I2E' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <BackendOperationsWorkspaceRoutePage
        accessToken="token"
        runtime={runtime}
        workspace={workspace}
      />,
    );

    expect(await screen.findByText('Du Shop')).toBeVisible();
    await screen.findByText('Create Enterprise');
    await userEvent.click(screen.getByRole('button', { name: 'Create enterprise' }));
    expect(await screen.findByText('Enterprise code is required.')).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const enterpriseCodeFields = screen.getAllByRole('textbox', {
      name: 'Enterprise code',
    });
    const formEnterpriseCode = enterpriseCodeFields[enterpriseCodeFields.length - 1];
    expect(formEnterpriseCode).toBeDefined();
    await userEvent.type(formEnterpriseCode as HTMLElement, 'i2e');
    await userEvent.type(
      screen.getByRole('textbox', { name: /Enterprise name/ }),
      'I2E',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create enterprise' }));

    await waitFor(() => expect(screen.getByText('Request completed.')).toBeVisible());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST'),
    ).toHaveLength(1);
  });

  it('loads the public registration workspace without an authorization header', async () => {
    const fetchMock = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      await Promise.resolve();
      expect(new Headers(init?.headers).get('Authorization')).toBeNull();
      return new Response(JSON.stringify({ code: 'SUC_PRFL_00000', data: workspace }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await loadPublicBackendWorkspace(
      runtime,
      'https://profile.example.test',
    );
    expect(result.title).toBe('Enterprise and User Management');
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        '/nodics/profile/v0/enterprise-access/workspace',
        'https://profile.example.test',
      ),
      expect.any(Object),
    );
  });

  it('rejects unsafe backend workspace endpoints', () => {
    expect(() =>
      parseBackendWorkspace({
        ...workspace,
        tabs: [
          {
            id: 'bad',
            label: 'Bad',
            sections: [
              {
                id: 'bad-form',
                type: 'form',
                title: 'Bad Form',
                endpoint: { method: 'POST', path: 'https://evil.example.test' },
              },
            ],
          },
        ],
      }),
    ).toThrow(/application-relative route/);
  });

  it('opens the declared users tab with a bounded enterprise default and sends nothing automatically', () => {
    const previousUrl = window.location.href;
    window.history.replaceState({}, '', '?tab=users&enterpriseCode=example-company');
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const users: AxisBackendWorkspace = {
      ...workspace,
      tabs: [
        {
          id: 'users',
          label: 'Users',
          sections: [
            {
              id: 'assign',
              type: 'form',
              title: 'Assign user',
              submitLabel: 'Assign',
              endpoint: {
                method: 'POST',
                path: '/nodics/profile/v0/enterprise-access',
              },
              fields: [
                {
                  name: 'enterpriseCode',
                  label: 'Enterprise',
                  type: 'TEXT',
                  maximumLength: 7,
                  defaultFromParameter: 'enterpriseCode',
                  required: true,
                },
              ],
            },
          ],
        },
      ],
    };
    try {
      render(
        <BackendOperationsWorkspaceRoutePage
          accessToken="token"
          runtime={runtime}
          workspace={users}
        />,
      );
      expect(screen.getByRole('textbox', { name: 'Enterprise' })).toHaveValue(
        'example',
      );
      expect(screen.getByRole('tab', { name: 'Users' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(fetcher).not.toHaveBeenCalled();
      expect(() =>
        parseBackendWorkspace({
          ...users,
          tabs: [
            {
              ...users.tabs[0],
              sections: [
                {
                  ...users.tabs[0]!.sections[0],
                  fields: [
                    {
                      name: 'password',
                      label: 'Password',
                      type: 'PASSWORD',
                      defaultFromParameter: 'password',
                    },
                  ],
                },
              ],
            },
          ],
        }),
      ).toThrow(/context parameter/);
    } finally {
      window.history.replaceState({}, '', previousUrl);
    }
  });
});
