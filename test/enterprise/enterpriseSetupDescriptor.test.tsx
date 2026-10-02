/** Discovered Profile setup metadata and controlled HTTP; no live continuation or authority inference. */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackendOperationsWorkspaceRoutePage } from '../../src/app/BackendOperationsWorkspaceRoutePage';
import {
  parseBackendWorkspace,
  type AxisModuleConnection,
} from '../../src/bootstrap/publicBootstrap';
import { parseEnterpriseSetupDescriptor } from '../../src/operations/enterprise/api/enterpriseSetupDescriptor';
import { createEnterpriseSetupOwnerAdapter } from '../../src/operations/enterprise/api/enterpriseSetupTransport';
import { runtime } from './registrationFixtures';

const copy = {
  title: 'Enterprise setup',
  inspectLabel: 'Inspect setup',
  resumeLabel: 'Continue setup',
  workingLabel: 'Working...',
  reviewTitle: 'Review continuation',
  confirmLabel: 'Confirm continuation',
  cancelLabel: 'Cancel',
  enterpriseLabel: 'Enterprise',
  tenantLabel: 'Tenant',
  administratorLabel: 'Original administrator',
  statusLabel: 'Setup status',
  revisionLabel: 'Revision',
  heldMessage: 'Setup needs attention.',
  completeMessage: 'Setup is complete.',
  unavailableMessage: 'Setup inspection is unavailable.',
  uncertainMessage: 'Inspect before another command.',
  reasons: { ORIGINAL_INTENT_UNAVAILABLE: 'Original setup intent was not retained.' },
};
const rawDescriptor = {
  version: 1,
  type: 'enterpriseSetupContinuation',
  available: true,
  actions: {
    inspect: {
      method: 'GET',
      path: '/nodics/profile/v7/enterprises/{enterpriseCode}/setup',
    },
    resume: {
      method: 'POST',
      path: '/nodics/profile/v7/enterprises/{enterpriseCode}/setup/resume',
      qualified: true,
      bodyFields: ['expectedRevision'],
    },
  },
  presentation: copy,
};
const descriptor = parseEnterpriseSetupDescriptor(rawDescriptor);
const connection: AxisModuleConnection = {
  moduleName: 'profile',
  endpoint: 'https://profile.example.test/nodics/profile',
  instanceId: 'profile-one',
  environment: 'test',
  state: 'UP',
};
const payload = {
  contractVersion: 1,
  enterprise: {
    code: 'business',
    name: 'Example Repair',
    tenantCode: 'private-tenant',
  },
  administrator: {
    email: 'admin@axis-onboarding-acceptance.test',
    status: 'UNCONFIRMED',
  },
  setup: { revision: 4, state: 'RESUMABLE', canResume: true, reasonCodes: [] },
  descriptor,
};
const workspace = (setupContinuation: unknown = descriptor) =>
  parseBackendWorkspace({
    contractVersion: 0,
    title: 'Enterprise and User Management',
    renderer: 'axis.workspace.backend-operations',
    setupContinuation,
    tabs: [{ id: 'enterprises', label: 'Enterprises', sections: [] }],
  });
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('setup continuation metadata', () => {
  it('retains the validated owner contribution inside the generic workspace', () => {
    expect(workspace().setupContinuation).toEqual(descriptor);
  });
  it.each([
    { ...rawDescriptor, version: 2 },
    { ...rawDescriptor, available: 'true' },
    { ...rawDescriptor, available: false },
    {
      ...rawDescriptor,
      actions: {
        ...rawDescriptor.actions,
        inspect: { method: 'GET', path: 'https://evil.test/setup' },
      },
    },
    {
      ...rawDescriptor,
      actions: {
        ...rawDescriptor.actions,
        inspect: {
          method: 'GET',
          path: '/custom/profile/{unexpectedTarget}/setup',
        },
      },
    },
    {
      ...rawDescriptor,
      actions: {
        ...rawDescriptor.actions,
        inspect: {
          method: 'GET',
          path: '/nodics/profile/v7/enterprises/{enterpriseCode}/setup?token=x',
        },
      },
    },
    {
      ...rawDescriptor,
      actions: {
        ...rawDescriptor.actions,
        resume: {
          ...rawDescriptor.actions.resume,
          bodyFields: ['expectedRevision', 'requestKey'],
        },
      },
    },
    {
      ...rawDescriptor,
      presentation: {
        ...copy,
        reasons: { HELD: '<script>ignored</script>', toString: 'unsafe key' },
      },
    },
    { ...rawDescriptor, presentation: { ...copy, inspectLabel: '' } },
  ])('rejects invalid contribution %# before attaching credentials', (invalid) => {
    expect(() => workspace(invalid)).toThrow();
  });
});

describe('authorized descriptor transport', () => {
  it('honours custom router prefixes, versions and action paths on the authorized Profile base', async () => {
    const custom = parseEnterpriseSetupDescriptor({
      ...rawDescriptor,
      actions: {
        inspect: {
          method: 'GET',
          path: '/customer/api.identity/release-3/enterprises/{enterpriseCode}/inspect',
        },
        resume: {
          ...rawDescriptor.actions.resume,
          path: '/customer/api.identity/release-4/continue/{enterpriseCode}',
        },
      },
    });
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: { ...payload, descriptor: custom } }), {
          status: 200,
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const owner = createEnterpriseSetupOwnerAdapter(
      custom,
      { ...connection, endpoint: 'https://profile.example.test/customer/api.identity' },
      runtime,
      'test-session',
    );
    await owner.inspect('business');
    await owner.resume!('business', { expectedRevision: 4 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://profile.example.test/customer/api.identity/release-3/enterprises/business/inspect',
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      'https://profile.example.test/customer/api.identity/release-4/continue/business',
    );
  });
  it('rejects a path outside the authorized Profile base before any request', () => {
    const outside = parseEnterpriseSetupDescriptor({
      ...rawDescriptor,
      actions: {
        inspect: { method: 'GET', path: '/other-owner/{enterpriseCode}/inspect' },
        resume: {
          ...rawDescriptor.actions.resume,
          path: '/other-owner/{enterpriseCode}/resume',
        },
      },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(() =>
      createEnterpriseSetupOwnerAdapter(outside, connection, runtime, 'test-session'),
    ).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    '//evil.test/{enterpriseCode}/setup',
    'https://user:secret@evil.test/{enterpriseCode}/setup',
    '/custom/{enterpriseCode}/setup#secret',
    '/custom/../{enterpriseCode}/setup',
    '/custom/./{enterpriseCode}/setup',
    '/custom/%2e%2e/{enterpriseCode}/setup',
    '/custom/%2f/{enterpriseCode}/setup',
    '/custom\\evil/{enterpriseCode}/setup',
    '/custom/{enterpriseCode}/{enterpriseCode}/setup',
    '/custom/{otherCode}/setup',
    '/custom/{enterpriseCode}/:otherCode/setup',
  ])(
    'rejects unsafe declared path %s before owner credentials are attached',
    (path) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      expect(() =>
        createEnterpriseSetupOwnerAdapter(
          parseEnterpriseSetupDescriptor({
            ...rawDescriptor,
            actions: { ...rawDescriptor.actions, inspect: { method: 'GET', path } },
          }),
          connection,
          runtime,
          'test-session',
        ),
      ).toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it.each(['POST', 'PATCH', 'DELETE'])(
    'rejects unexpected inspection method %s',
    (method) => {
      expect(() =>
        parseEnterpriseSetupDescriptor({
          ...rawDescriptor,
          actions: {
            ...rawDescriptor.actions,
            inspect: { ...rawDescriptor.actions.inspect, method },
          },
        }),
      ).toThrow();
    },
  );
  it('uses the declared version on the Profile origin, signed source header and exact resume body', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: payload }), { status: 200 }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const owner = createEnterpriseSetupOwnerAdapter(
      descriptor,
      connection,
      runtime,
      'test-session',
    );
    await owner.inspect('business');
    await owner.resume!('business', { expectedRevision: 4 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://profile.example.test/nodics/profile/v7/enterprises/business/setup',
    );
    const read = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(read.method).toBe('GET');
    expect(read.body).toBeUndefined();
    const write = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(write.method).toBe('POST');
    expect(JSON.parse(write.body as string)).toEqual({ expectedRevision: 4 });
    expect(new Headers(write.headers).get('x-enterprise-code')).toBe(
      runtime.enterpriseCode,
    );
    expect(new Headers(write.headers).get('Authorization')).toBe('Bearer test-session');
    expect(new Headers(write.headers).has('Idempotency-Key')).toBe(false);
    expect(write.credentials).toBe('omit');
    expect(write.redirect).toBe('error');
  });
  it.each([
    { ...connection, moduleName: 'commerce' },
    { ...connection, state: 'UNAVAILABLE' as const },
    { ...connection, endpoint: 'https://user:secret@profile.example.test' },
    { ...connection, endpoint: 'https://profile.example.test?token=secret' },
    { ...connection, endpoint: 'https://profile.example.test/nodics/profile#secret' },
    { ...connection, endpoint: 'https://profile.example.test/nodics/../profile' },
  ])(
    'refuses invalid or unavailable owner connection %# without network access',
    (invalid) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      expect(() =>
        createEnterpriseSetupOwnerAdapter(descriptor, invalid, runtime, 'test-session'),
      ).toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it('does not qualify a disabled resume or retry an uncertain reply', async () => {
    const inspectOnly = parseEnterpriseSetupDescriptor({
      ...rawDescriptor,
      actions: {
        ...rawDescriptor.actions,
        resume: { ...rawDescriptor.actions.resume, qualified: false },
      },
    });
    const owner = createEnterpriseSetupOwnerAdapter(
      inspectOnly,
      connection,
      runtime,
      'test-session',
    );
    expect(owner.resume).toBeUndefined();
    const fetchMock = vi.fn().mockRejectedValue(new Error('connection lost'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(owner.inspect('business')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('fails closed when the fresh response has no owner descriptor', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ data: { ...payload, descriptor: undefined } }),
            { status: 200 },
          ),
        ),
    );
    const owner = createEnterpriseSetupOwnerAdapter(
      descriptor,
      connection,
      runtime,
      'test-session',
    );
    await expect(owner.inspect('business')).rejects.toThrow('contract');
  });
});

describe('generic workspace integration', () => {
  it.each(['complete', 'uncertain'] as const)(
    'preserves a pending command and its %s result through equivalent catalogue refreshes without replay',
    async (outcome) => {
      const completed = {
        ...payload,
        setup: { revision: 5, state: 'COMPLETE', canResume: false, reasonCodes: [] },
      };
      let resolveWrite!: (value: Response) => void;
      let rejectWrite!: (reason: Error) => void;
      let current = payload;
      const fetchMock = vi
        .fn<(input: RequestInfo | URL, options: RequestInit) => Promise<Response>>()
        .mockImplementation((_input, options) =>
          options.method === 'POST'
            ? new Promise<Response>((resolve, reject) => {
                resolveWrite = resolve;
                rejectWrite = reject;
              })
            : Promise.resolve(
                new Response(JSON.stringify({ data: current }), { status: 200 }),
              ),
        );
      vi.stubGlobal('fetch', fetchMock);
      const content = () => (
        <MemoryRouter>
          <BackendOperationsWorkspaceRoutePage
            workspace={workspace()}
            connection={{ ...connection }}
            runtime={{ ...runtime }}
            accessToken="test-session"
            sessionGeneration={1}
          />
        </MemoryRouter>
      );
      const view = render(content());
      const user = userEvent.setup();
      await user.type(
        screen.getByRole('textbox', { name: copy.enterpriseLabel }),
        'business',
      );
      await user.click(screen.getByRole('button', { name: copy.inspectLabel }));
      await screen.findByRole('heading', { name: 'Example Repair' });
      await user.click(screen.getByRole('button', { name: copy.resumeLabel }));
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: copy.confirmLabel,
        }),
      );
      expect(
        fetchMock.mock.calls.filter(([, options]) => options.method === 'POST'),
      ).toHaveLength(1);
      view.rerender(content());
      expect(screen.getByRole('dialog')).toBeVisible();
      expect(screen.getByLabelText(copy.enterpriseLabel)).toBeDisabled();
      await act(async () => {
        if (outcome === 'complete') {
          current = completed;
          resolveWrite(
            new Response(JSON.stringify({ data: completed }), { status: 200 }),
          );
        } else rejectWrite(new Error('Reply unavailable'));
        await Promise.resolve();
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await screen.findByText(
        outcome === 'complete' ? copy.completeMessage : copy.uncertainMessage,
        { exact: outcome !== 'complete' },
      );
      view.rerender(content());
      expect(
        screen.getByText(
          outcome === 'complete' ? copy.completeMessage : copy.uncertainMessage,
          { exact: outcome !== 'complete' },
        ),
      ).toBeVisible();
      expect(screen.getByRole('textbox', { name: copy.enterpriseLabel })).toHaveValue(
        'business',
      );
      expect(
        fetchMock.mock.calls.filter(([, options]) => options.method === 'POST'),
      ).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(outcome === 'complete' ? 3 : 2);
    },
  );

  it.each([
    'token',
    'generation',
    'endpoint',
    'enterprise',
    'contract',
    'qualification',
  ] as const)(
    'retires pending replies on a real %s change without replay',
    async (change) => {
      let finish!: (value: Response) => void;
      const fetchMock = vi
        .fn<(input: RequestInfo | URL, options: RequestInit) => Promise<Response>>()
        .mockImplementation((_input, options) =>
          options.method === 'POST'
            ? new Promise<Response>((resolve) => {
                finish = resolve;
              })
            : Promise.resolve(
                new Response(JSON.stringify({ data: payload }), { status: 200 }),
              ),
        );
      vi.stubGlobal('fetch', fetchMock);
      const content = (changed: boolean) => (
        <MemoryRouter>
          <BackendOperationsWorkspaceRoutePage
            workspace={workspace(
              changed && ['contract', 'qualification'].includes(change)
                ? parseEnterpriseSetupDescriptor({
                    ...rawDescriptor,
                    actions: {
                      ...rawDescriptor.actions,
                      resume: {
                        ...rawDescriptor.actions.resume,
                        ...(change === 'contract'
                          ? {
                              path: '/nodics/profile/v8/enterprises/{enterpriseCode}/setup/resume',
                            }
                          : { qualified: false }),
                      },
                    },
                  })
                : descriptor,
            )}
            connection={
              changed && change === 'endpoint'
                ? {
                    ...connection,
                    endpoint: 'https://other.example.test/nodics/profile',
                  }
                : { ...connection }
            }
            runtime={
              changed && change === 'enterprise'
                ? { ...runtime, enterpriseCode: 'other-enterprise' }
                : { ...runtime }
            }
            accessToken={
              changed && change === 'token' ? 'replacement-session' : 'test-session'
            }
            sessionGeneration={changed && change === 'generation' ? 2 : 1}
          />
        </MemoryRouter>
      );
      const view = render(content(false));
      const user = userEvent.setup();
      await user.type(
        screen.getByRole('textbox', { name: copy.enterpriseLabel }),
        'business',
      );
      await user.click(screen.getByRole('button', { name: copy.inspectLabel }));
      await screen.findByRole('heading', { name: 'Example Repair' });
      await user.click(screen.getByRole('button', { name: copy.resumeLabel }));
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: copy.confirmLabel,
        }),
      );
      view.rerender(content(true));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await act(async () => {
        finish(new Response(JSON.stringify({ data: payload }), { status: 200 }));
        await Promise.resolve();
      });
      expect(
        screen.queryByRole('heading', { name: 'Example Repair' }),
      ).not.toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(
        fetchMock.mock.calls.filter(([, options]) => options.method === 'POST'),
      ).toHaveLength(1);
    },
  );

  it.each([undefined, {}, { inspect: rawDescriptor.actions.inspect }])(
    'renders unavailable missing-action metadata inert %# without fallback requests',
    (actions) => {
      const disabled = { ...rawDescriptor, available: false, actions };
      const parsed = workspace(disabled);
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      render(
        <MemoryRouter>
          <BackendOperationsWorkspaceRoutePage
            workspace={parsed}
            connection={connection}
            runtime={runtime}
            accessToken="test-session"
          />
        </MemoryRouter>,
      );
      expect(screen.getByRole('heading', { name: copy.title })).toBeVisible();
      expect(screen.getByText(copy.unavailableMessage)).toBeVisible();
      expect(
        screen.queryByRole('button', { name: copy.inspectLabel }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: copy.resumeLabel }),
      ).not.toBeInTheDocument();
      expect(() =>
        createEnterpriseSetupOwnerAdapter(
          parsed.setupContinuation!,
          connection,
          runtime,
          'test-session',
        ),
      ).toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it.each([undefined, {}, { inspect: rawDescriptor.actions.inspect }])(
    'rejects available missing-action metadata %# instead of inventing commands',
    (actions) => {
      expect(() => workspace({ ...rawDescriptor, available: true, actions })).toThrow();
    },
  );
  it('honours freshly disabled resume qualification despite an older eligible descriptor', async () => {
    const fresh = parseEnterpriseSetupDescriptor({
      ...rawDescriptor,
      actions: {
        ...rawDescriptor.actions,
        resume: { ...rawDescriptor.actions.resume, qualified: false },
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { ...payload, descriptor: fresh } }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <MemoryRouter>
        <BackendOperationsWorkspaceRoutePage
          workspace={workspace()}
          connection={connection}
          runtime={runtime}
          accessToken="test-session"
        />
      </MemoryRouter>,
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Enterprise' }),
      'business',
    );
    await userEvent.click(screen.getByRole('button', { name: copy.inspectLabel }));
    await screen.findByRole('heading', { name: 'Example Repair' });
    expect(
      screen.queryByRole('button', { name: copy.resumeLabel }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('renders and inspects the contributed task without a new route or raw status', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: payload }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <MemoryRouter>
        <BackendOperationsWorkspaceRoutePage
          workspace={workspace()}
          connection={connection}
          runtime={runtime}
          accessToken="test-session"
        />
      </MemoryRouter>,
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Enterprise' }),
      'business',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Inspect setup' }));
    await screen.findByRole('heading', { name: 'Example Repair' });
    expect(screen.getByRole('button', { name: 'Continue setup' })).toBeVisible();
    expect(screen.queryByText('UNCONFIRMED')).not.toBeInTheDocument();
    expect(screen.queryByText('private-tenant')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('renders a qualified-off contribution inert with no inspect request', () => {
    const disabled = {
      ...rawDescriptor,
      available: false,
      actions: {
        ...rawDescriptor.actions,
        resume: { ...rawDescriptor.actions.resume, qualified: false },
      },
    };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <MemoryRouter>
        <BackendOperationsWorkspaceRoutePage
          workspace={workspace(disabled)}
          connection={connection}
          runtime={runtime}
          accessToken="test-session"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(copy.unavailableMessage)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: copy.inspectLabel }),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('shows historical held evidence with null revision without offering resume', async () => {
    const held = {
      ...payload,
      setup: {
        revision: null,
        state: 'HELD',
        canResume: false,
        reasonCodes: ['ORIGINAL_INTENT_UNAVAILABLE'],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ data: held }), { status: 200 }),
        ),
    );
    render(
      <MemoryRouter>
        <BackendOperationsWorkspaceRoutePage
          workspace={workspace()}
          connection={connection}
          runtime={runtime}
          accessToken="test-session"
        />
      </MemoryRouter>,
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Enterprise' }),
      'business',
    );
    await userEvent.click(screen.getByRole('button', { name: copy.inspectLabel }));
    await screen.findByText(copy.reasons.ORIGINAL_INTENT_UNAVAILABLE);
    expect(
      screen.queryByRole('button', { name: copy.resumeLabel }),
    ).not.toBeInTheDocument();
  });
});
