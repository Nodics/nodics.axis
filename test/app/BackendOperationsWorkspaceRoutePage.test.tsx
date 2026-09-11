import { loadPublicBackendWorkspace } from '../../src/app/backendWorkspaceClient';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
});

describe('BackendOperationsWorkspaceRoutePage', () => {
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

    const result = await loadPublicBackendWorkspace(runtime);
    expect(result.title).toBe('Enterprise and User Management');
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        '/nodics/profile/v0/enterprise-access/workspace',
        'https://backoffice.example.test',
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
