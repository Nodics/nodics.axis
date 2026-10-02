import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackendOperationsWorkspaceRoutePage } from '../../src/app/BackendOperationsWorkspaceRoutePage';
import {
  parseBackendWorkspace,
  type AxisBackendWorkspace,
  type AxisModuleConnection,
} from '../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';

/** Real generic Axis component with controlled HTTP; no database, provider, or live-user acceptance. */
const runtime: AxisRuntimeConfig = {
  backofficeBaseUrl: 'https://backoffice.example.test',
  enterpriseCode: 'platform',
  projectCode: 'example',
  clientContractVersion: 1,
  requestTimeoutMs: 10000,
  browserSessionCsrfCookieName: 'test_csrf',
  assistantMaximumEventBytes: 65536,
  assistantReconnectWindowMs: 1000,
  assistantIdleTimeoutMs: 5000,
};
const connection: AxisModuleConnection = {
  moduleName: 'profile',
  instanceId: 'profile-one',
  endpoint: 'https://profile.example.test',
  environment: 'test',
  state: 'UP',
};
const workspace: AxisBackendWorkspace = {
  contractVersion: 0,
  renderer: 'axis.workspace.backend-operations',
  title: 'Enterprise setup',
  defaultTab: 'enterprises',
  tabs: [
    {
      id: 'enterprises',
      label: 'Enterprises',
      sections: [
        {
          id: 'create-enterprise',
          type: 'form',
          title: 'Create enterprise',
          submitLabel: 'Prepare enterprise',
          successMessage:
            'Administrator enrolment prepared. The invitee still needs to register.',
          endpoint: {
            method: 'POST',
            path: '/nodics/profile/v0/enterprises',
            bodyShape: 'MODEL',
            idempotencyField: 'idempotencyKey',
          },
          fields: [
            {
              name: 'code',
              label: 'Enterprise reference',
              type: 'TEXT',
              required: true,
            },
            { name: 'name', label: 'Enterprise name', type: 'TEXT', required: true },
            {
              name: 'adminEmail',
              label: 'Administrator email',
              type: 'EMAIL',
              required: true,
            },
            {
              name: 'idempotencyKey',
              label: 'Request key',
              type: 'IDEMPOTENCY',
              required: true,
            },
          ],
        },
      ],
    },
  ],
};
const reply = () =>
  new Response(
    JSON.stringify({
      code: 'SUC_PRFL_00000',
      data: { code: 'example', name: 'Example', adminEmail: 'admin@example.test' },
    }),
    { status: 200 },
  );
async function fill() {
  const user = userEvent.setup();
  await user.type(
    screen.getByRole('textbox', { name: /Enterprise reference/ }),
    'example',
  );
  await user.type(screen.getByRole('textbox', { name: /Enterprise name/ }), 'Example');
  await user.type(
    screen.getByRole('textbox', { name: /Administrator email/ }),
    'admin@example.test',
  );
  return user;
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Profile-owned default-administrator setup workspace', () => {
  it('uses the discovered owner, canonical model, transport key and truthful completion copy', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(reply());
    vi.stubGlobal('fetch', transport);
    render(
      <BackendOperationsWorkspaceRoutePage
        workspace={workspace}
        runtime={runtime}
        connection={connection}
        accessToken="test-employee-token"
      />,
    );
    const user = await fill();
    expect(screen.queryByRole('textbox', { name: /Tenant/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: /Request key/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Prepare enterprise' }));
    await screen.findByText(
      'Administrator enrolment prepared. The invitee still needs to register.',
    );
    expect(transport).toHaveBeenCalledTimes(1);
    const call = transport.mock.calls[0];
    expect(call).toBeDefined();
    const target = call?.[0];
    expect(target instanceof Request ? target.url : target?.toString()).toBe(
      'https://profile.example.test/nodics/profile/v0/enterprises',
    );
    const init = call?.[1];
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(init?.body as string)).toEqual({
      model: { code: 'example', name: 'Example', adminEmail: 'admin@example.test' },
    });
    expect(new Headers(init?.headers).get('Idempotency-Key')).toMatch(
      /^create-enterprise-/,
    );
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer test-employee-token',
    );
    expect(runtime.backofficeBaseUrl).toBe('https://backoffice.example.test');
  });

  it('retains the same draft and command key after an uncertain failed response', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(reply());
    vi.stubGlobal('fetch', transport);
    render(
      <BackendOperationsWorkspaceRoutePage
        workspace={workspace}
        runtime={runtime}
        connection={connection}
        accessToken="token"
      />,
    );
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Prepare enterprise' }));
    await screen.findByText('Backend workspace request returned HTTP 503');
    expect(screen.getByRole('textbox', { name: /Administrator email/ })).toHaveValue(
      'admin@example.test',
    );
    await user.click(screen.getByRole('button', { name: 'Prepare enterprise' }));
    await waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
    const first = transport.mock.calls[0]?.[1],
      second = transport.mock.calls[1]?.[1];
    expect(new Headers(first?.headers).get('Idempotency-Key')).toBe(
      new Headers(second?.headers).get('Idempotency-Key'),
    );
    expect(first?.body).toBe(second?.body);
  });

  it('does not fall back to BackOffice when the supplied owner is unavailable', async () => {
    const transport = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', transport);
    render(
      <BackendOperationsWorkspaceRoutePage
        workspace={workspace}
        runtime={runtime}
        connection={{ ...connection, state: 'UNAVAILABLE' }}
        accessToken="token"
      />,
    );
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Prepare enterprise' }));
    await screen.findByText('Workspace connection is unavailable');
    expect(transport).not.toHaveBeenCalled();
  });

  it('retains the declared model transport and presentation metadata during parsing', () => {
    const parsed = parseBackendWorkspace(workspace);
    expect(parsed.tabs[0]?.sections[0]?.endpoint.bodyShape).toBe('MODEL');
    expect(parsed.tabs[0]?.sections[0]?.endpoint.idempotencyField).toBe(
      'idempotencyKey',
    );
    expect(parsed.tabs[0]?.sections[0]?.successMessage).toContain('invitee');
  });

  it.each(['EXECUTE', { script: 'arbitrary' }])(
    'rejects unsupported body-shape metadata %s',
    (bodyShape) => {
      const copy = structuredClone(workspace) as unknown as {
        tabs: { sections: { endpoint: Record<string, unknown> }[] }[];
      };
      const endpoint = copy.tabs[0]?.sections[0]?.endpoint;
      if (!endpoint) throw new Error('fixture missing');
      endpoint.bodyShape = bodyShape;
      expect(() => parseBackendWorkspace(copy)).toThrow(/body shape/);
    },
  );

  it('rejects a MODEL declaration lacking its request-key field', () => {
    const copy = structuredClone(workspace) as unknown as {
      tabs: { sections: { endpoint: Record<string, unknown> }[] }[];
    };
    const endpoint = copy.tabs[0]?.sections[0]?.endpoint;
    if (!endpoint) throw new Error('fixture missing');
    delete endpoint.idempotencyField;
    expect(() => parseBackendWorkspace(copy)).toThrow(/idempotency/);
  });
});
