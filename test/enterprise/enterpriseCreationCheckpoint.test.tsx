/** In-memory draft/remount/uncertainty fixtures, not browser acceptance or backend qualification. */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackendOperationsWorkspaceRoutePage } from '../../src/app/BackendOperationsWorkspaceRoutePage';
import {
  EnterpriseCreationCheckpoint,
  enterpriseCreationReturnPath,
  isEnterpriseCreationAcknowledgement,
} from '../../src/operations/enterprise/enterpriseCreationCheckpoint';
import {
  connection,
  workspace,
  runtime,
  section,
  values,
} from './enterpriseCreationCheckpointFixtures';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('Enterprise creation admission checkpoint', () => {
  it('projects only the exact safe allowlist and freezes caller-owned arrays', () => {
    const store = new EnterpriseCreationCheckpoint();
    const binding = store.bind(
      'actor/project/enterprise/tenant',
      connection,
      workspace,
      section,
    )!;
    const roleCodes = ['ASSET_OWNER'];
    binding.save({
      ...values,
      roleCodes,
      password: 'never',
      otp: 'never',
      accessToken: 'never',
      response: 'never',
    });
    roleCodes.push('other');
    expect(binding.get()?.values).toEqual(values);
    expect(JSON.stringify(binding.get())).not.toContain('never');
    expect(Object.isFrozen(binding.get()?.values.roleCodes)).toBe(true);
  });
  it.each(['actor', 'tenant', 'enterprise', 'project', 'owner-form'])(
    'never restores across changed %s scope',
    (scope) => {
      const store = new EnterpriseCreationCheckpoint();
      store.bind('original', connection, workspace, section)!.save(values);
      expect(store.bind(scope, connection, workspace, section)!.get()).toBeUndefined();
    },
  );
  it('invalidates old admission bindings and late receipts after logout/expiry/fresh sign-in', () => {
    const store = new EnterpriseCreationCheckpoint();
    const old = store.bind('same', connection, workspace, section)!;
    const ticket = old.begin(values)!;
    store.clear();
    const next = store.bind('same', connection, workspace, section)!;
    next.save({ ...values, name: 'New admission' });
    old.settle(ticket, true);
    old.save(values);
    expect(next.get()?.values.name).toBe('New admission');
    expect(old.get()).toBeUndefined();
  });
  it('does not restore when owner connection, role or exact form contract changes', () => {
    const store = new EnterpriseCreationCheckpoint();
    store.bind('scope', connection, workspace, section)!.save(values);
    for (const other of [
      { ...connection, instanceId: 'profile-2' },
      { ...connection, endpoint: 'https://other.example.test/nodics/profile' },
      { ...connection, runtimeRole: { code: 'OTHER', publication: 'NONE' } },
    ])
      expect(store.bind('scope', other, workspace, section)!.get()).toBeUndefined();
    expect(
      store
        .bind('scope', connection, workspace, {
          ...section,
          endpoint: { ...section.endpoint, path: '/custom/profile/enterprises' },
        })!
        .get(),
    ).toBeUndefined();
  });
  it.each(['password', 'otp', 'secret', 'privateProof'])(
    'rejects additional %s fields rather than retaining a general form payload',
    (name) => {
      const store = new EnterpriseCreationCheckpoint();
      expect(
        store.bind('scope', connection, workspace, {
          ...section,
          fields: [
            ...(section.fields ?? []),
            { name, label: name, type: 'PASSWORD', required: false },
          ],
        }),
      ).toBeUndefined();
    },
  );
  it('freezes the original uncertain operation and never allows another begin or edited key', () => {
    const binding = new EnterpriseCreationCheckpoint().bind(
      'scope',
      connection,
      workspace,
      section,
    )!;
    const ticket = binding.begin(values)!;
    binding.settle(ticket, false);
    binding.refuse(ticket);
    expect(binding.get()?.phase).toBe('UNCERTAIN');
    binding.save({ ...values, idempotencyKey: 'replacement-key' });
    expect(binding.begin(values)).toBeUndefined();
    expect(binding.get()).toEqual({ values, phase: 'UNCERTAIN' });
  });
  it.each(['label', 'constraint', 'extra-field', 'endpoint'])(
    'retains an unresolved ownership fence across changed %s metadata',
    (change) => {
      const store = new EnterpriseCreationCheckpoint();
      const original = store.bind('scope', connection, workspace, section)!;
      const ticket = original.begin(values)!;
      original.settle(ticket, false);
      const changed = {
        ...section,
        endpoint:
          change === 'endpoint'
            ? { ...section.endpoint, path: '/custom/profile/enterprises' }
            : section.endpoint,
        fields:
          change === 'extra-field'
            ? [
                ...(section.fields ?? []),
                {
                  name: 'password',
                  label: 'Password',
                  type: 'PASSWORD' as const,
                  required: false,
                },
              ]
            : section.fields?.map((field) =>
                field.name === 'name'
                  ? {
                      ...field,
                      ...(change === 'label'
                        ? { label: 'Business name' }
                        : { maximumLength: 128 }),
                    }
                  : field,
              ),
      };
      const rebound = store.bind('scope', connection, workspace, changed)!;
      expect(rebound.get()).toEqual({ values, phase: 'UNCERTAIN' });
      rebound.save({ ...values, idempotencyKey: 'replacement-key' });
      expect(rebound.begin(values)).toBeUndefined();
      expect(rebound.get()?.values.idempotencyKey).toBe(values.idempotencyKey);
    },
  );
  it('admits only a matching public owner enterprise acknowledgement', () => {
    const record = {
      code: values.code,
      name: values.name,
      tenantCode: 'business',
      active: true,
    };
    expect(isEnterpriseCreationAcknowledgement(record, values)).toBe(true);
    // createFromModel returns descriptor fields from a recursive:false generated read.
    const saved = {
      code: values.code,
      name: values.name,
      tenant: values.code,
      active: true,
      adminEmail: values.adminEmail,
      roleCodes: ['ASSET_OWNER'],
    };
    expect(isEnterpriseCreationAcknowledgement(saved, values)).toBe(true);
    expect(
      isEnterpriseCreationAcknowledgement(
        { ...saved, tenantCode: values.code },
        values,
      ),
    ).toBe(true);
    for (const response of [
      {},
      { updatedCount: 1 },
      [],
      [record],
      { code: values.code },
      { ...record, code: 'unrelated' },
      { ...record, name: 'Unrelated enterprise' },
      { ...record, tenantCode: undefined },
      { ...record, active: undefined },
      { ...record, success: false },
      { ...saved, tenant: undefined },
      { ...saved, tenant: null },
      { ...saved, tenant: { code: values.code } },
      { ...saved, tenant: [values.code] },
      { ...saved, tenant: 'another' },
      { ...saved, tenantCode: 'another' },
      { ...saved, tenantCode: null },
      { ...saved, error: { code: 'FAILED' } },
      { ...saved, errors: ['FAILED'] },
      { data: saved },
    ])
      expect(isEnterpriseCreationAcknowledgement(response, values)).toBe(false);
  });
  it('preserves only a unique owner-declared tab selector across lock', () => {
    expect(
      enterpriseCreationReturnPath(
        '/profile/enterprises',
        '?tab=enterprises&password=never&otp=never',
        workspace,
      ),
    ).toBe('/profile/enterprises?tab=enterprises');
    for (const search of [
      '?tab=secret',
      '?tab=enterprises&tab=enterprises',
      '?password=never',
    ])
      expect(
        enterpriseCreationReturnPath('/profile/enterprises', search, workspace),
      ).toBe('/profile/enterprises');
    expect(
      enterpriseCreationReturnPath(
        '/profile/enterprises',
        '?tab=enterprises',
        undefined,
      ),
    ).toBe('/profile/enterprises');
  });
});

function page(
  checkpoint: EnterpriseCreationCheckpoint,
  generation = 1,
  selectedWorkspace = workspace,
) {
  return (
    <BackendOperationsWorkspaceRoutePage
      runtime={runtime}
      workspace={selectedWorkspace}
      connection={connection}
      accessToken="fixture-token"
      sessionGeneration={generation}
      enterpriseCreationCheckpoint={{
        checkpoint,
        scope: 'same-admission/project/tenant/enterprise',
      }}
    />
  );
}
async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Enterprise code/), 'business');
  await user.type(screen.getByLabelText(/^Enterprise name/), 'Example Repair');
  await user.type(
    screen.getByLabelText(/^Administrator email/),
    'admin@axis-onboarding-acceptance.test',
  );
}
describe('Enterprise creation routed remount', () => {
  it.each(['acknowledged', 'uncertain', 'failed', 'refresh-failed'])(
    'refreshes only declared listing reads after creation: %s',
    async (outcome) => {
      const checkpoint = new EnterpriseCreationCheckpoint();
      const registryWorkspace = {
        ...workspace,
        tabs: workspace.tabs.map((tab) => ({
          ...tab,
          sections: [
            {
              id: 'enterprise-list',
              type: 'listing' as const,
              title: 'Enterprise Registry',
              endpoint: {
                method: 'GET' as const,
                path: '/nodics/profile/v0/enterprises/search',
                resultPath: 'items',
              },
              columns: [{ field: 'name', label: 'Name' }],
              filters: [
                {
                  name: 'query',
                  label: 'Registry filter',
                  type: 'TEXT' as const,
                  required: false,
                },
              ],
            },
            ...tab.sections,
          ],
        })),
      };
      let reads = 0;
      let writes = 0;
      const fetcher = vi.fn<typeof fetch>((input, init) => {
        const url = new URL(
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
        );
        if (url.pathname.endsWith('/search')) {
          reads++;
          expect(init?.method ?? 'GET').toBe('GET');
          if (reads > 1) expect(url.searchParams.get('query')).toBe('business');
          if (outcome === 'refresh-failed' && reads === 2)
            return Promise.resolve(
              new Response(JSON.stringify({ message: 'Registry read unavailable' }), {
                status: 503,
              }),
            );
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: {
                  items: writes ? [{ code: 'business', name: 'Example Repair' }] : [],
                },
              }),
              { status: 200 },
            ),
          );
        }
        expect(init?.method).toBe('POST');
        writes++;
        return Promise.resolve(
          new Response(
            JSON.stringify(
              outcome === 'failed'
                ? { message: 'Creation outcome unavailable' }
                : {
                    data:
                      outcome === 'uncertain'
                        ? {}
                        : {
                            code: 'business',
                            name: 'Example Repair',
                            tenant: 'business',
                            active: true,
                          },
                  },
            ),
            { status: outcome === 'failed' ? 503 : 200 },
          ),
        );
      });
      vi.stubGlobal('fetch', fetcher);
      render(page(checkpoint, 1, registryWorkspace));
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled(),
      );
      await user.type(screen.getByLabelText('Registry filter'), 'business');
      await fill(user);
      await user.click(screen.getByRole('button', { name: 'Create enterprise' }));
      if (outcome === 'uncertain' || outcome === 'failed') {
        await screen.findByText(
          outcome === 'failed'
            ? 'Creation outcome unavailable'
            : 'Backend workspace response could not be confirmed',
        );
        expect(reads).toBe(1);
        expect(
          screen.getByRole('button', { name: 'Create enterprise' }),
        ).toBeDisabled();
        await user.click(screen.getByRole('button', { name: 'Refresh' }));
        await screen.findByText('Example Repair');
        expect(
          screen.getByRole('button', { name: 'Create enterprise' }),
        ).toBeDisabled();
      } else {
        await screen.findByText('Request completed.');
        await waitFor(() => expect(reads).toBe(2));
        if (outcome === 'refresh-failed') {
          await screen.findByText('Registry read unavailable');
          expect(screen.getByText('Request completed.')).toBeVisible();
          await user.click(screen.getByRole('button', { name: 'Refresh' }));
        }
        await screen.findByText('Example Repair');
        expect(screen.getByLabelText(/^Enterprise code/)).toHaveValue('');
      }
      expect(screen.getByLabelText('Registry filter')).toHaveValue('business');
      expect(writes).toBe(1);
      expect(reads).toBe(outcome === 'refresh-failed' ? 3 : 2);
    },
  );

  it('acknowledges the saved descriptor-shaped Profile record without requiring tenantCode', async () => {
    const checkpoint = new EnterpriseCreationCheckpoint();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            code: 'business',
            name: 'Example Repair',
            tenant: 'business',
            active: true,
            adminEmail: values.adminEmail,
            roleCodes: ['ASSET_OWNER'],
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    render(page(checkpoint));
    const user = userEvent.setup();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Create enterprise' }));
    await waitFor(() =>
      expect(screen.getByLabelText(/^Enterprise code/)).toHaveValue(''),
    );
    expect(
      screen.queryByText('Backend workspace response could not be confirmed'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create enterprise' })).toBeEnabled();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each(['inspect', 'continue'])(
    'clears the stale creation error only after matching COMPLETE via %s',
    async (completion) => {
      const checkpoint = new EnterpriseCreationCheckpoint();
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: {} }), { status: 200 }),
        );
      vi.stubGlobal('fetch', fetcher);
      const view = render(page(checkpoint));
      const user = userEvent.setup();
      await fill(user);
      await user.click(screen.getByRole('button', { name: 'Create enterprise' }));
      const message = 'Backend workspace response could not be confirmed';
      await screen.findByText(message);
      const binding = checkpoint.bind(
        'same-admission/project/tenant/enterprise',
        connection,
        workspace,
        section,
      )!;
      const originalKey = binding.get()?.values.idempotencyKey;
      const snapshot = (
        state: 'HELD' | 'RESUMABLE' | 'COMPLETE',
        code = 'business',
      ) => ({
        contractVersion: 1,
        enterprise: { code, name: 'Example Repair', tenantCode: code },
        administrator: { email: values.adminEmail, status: 'PENDING' },
        setup: {
          revision: state === 'COMPLETE' ? 2 : 1,
          state,
          canResume: state === 'RESUMABLE',
          reasonCodes: [],
        },
        descriptor: workspace.setupContinuation,
      });
      const response = (data: unknown) =>
        new Response(JSON.stringify({ data }), { status: 200 });
      for (const data of [
        snapshot('HELD'),
        snapshot('COMPLETE', 'unrelated'),
        snapshot('RESUMABLE'),
      ]) {
        fetcher.mockResolvedValueOnce(response(data));
        await user.click(screen.getByRole('button', { name: 'Inspect setup' }));
        await waitFor(() =>
          expect(screen.getByRole('button', { name: 'Inspect setup' })).toBeEnabled(),
        );
        expect(screen.getByText(message)).toBeVisible();
        expect(
          screen.getByRole('button', { name: 'Create enterprise' }),
        ).toBeDisabled();
        expect(binding.get()?.values.idempotencyKey).toBe(originalKey);
      }
      view.rerender(page(checkpoint));
      expect(screen.getByText(message)).toBeVisible();
      if (completion === 'continue') {
        fetcher.mockResolvedValueOnce(response(snapshot('COMPLETE')));
        await user.click(screen.getByRole('button', { name: 'Resume setup' }));
        fetcher.mockResolvedValueOnce(response(snapshot('COMPLETE')));
        await user.click(screen.getByRole('button', { name: 'Confirm' }));
      } else {
        fetcher.mockResolvedValueOnce(response(snapshot('COMPLETE')));
        await user.click(screen.getByRole('button', { name: 'Inspect setup' }));
      }
      await waitFor(() =>
        expect(screen.getByLabelText(/^Enterprise code/)).toHaveValue(''),
      );
      expect(screen.queryByText(message)).not.toBeInTheDocument();
      expect(
        await screen.findByRole('button', { name: 'Create enterprise' }),
      ).toBeEnabled();
      expect(binding.get()?.phase).toBe('DRAFT');
      expect(
        fetcher.mock.calls.filter(
          ([url, init]) =>
            init?.method === 'POST' && url === fetcher.mock.calls[0]?.[0],
        ),
      ).toHaveLength(1);
      expect(
        fetcher.mock.calls.filter(([url]) => {
          const path =
            typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
          return path.endsWith('/resume');
        }),
      ).toHaveLength(completion === 'continue' ? 1 : 0);
    },
  );

  it.each([
    { status: 409, code: 'ERR_PROFILE_ENTERPRISE_DUPLICATE', editable: true },
    { status: 500, code: 'ERR_PROFILE_ENTERPRISE_DUPLICATE', editable: false },
    { status: 409, code: 'ERR_PRFL_00003', editable: false },
    { status: 400, code: 'ERR_PRFL_00003', editable: false },
    { status: 409, code: undefined, editable: false },
    { status: 503, code: 'ERR_PROFILE_TENANT_PROVISIONING_HELD', editable: false },
  ])(
    'retains editable input only for the definite pre-write duplicate $status/$code',
    async ({ status, code, editable }) => {
      const checkpoint = new EnterpriseCreationCheckpoint();
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ code, message: 'Enterprise code already exists' }),
            { status },
          ),
        );
      vi.stubGlobal('fetch', fetcher);
      render(page(checkpoint));
      const user = userEvent.setup();
      await fill(user);
      await user.click(screen.getByRole('button', { name: 'Create enterprise' }));
      await screen.findByText('Enterprise code already exists');
      const binding = checkpoint.bind(
        'same-admission/project/tenant/enterprise',
        connection,
        workspace,
        section,
      )!;
      expect(binding.get()?.phase).toBe(editable ? 'DRAFT' : 'UNCERTAIN');
      expect(screen.getByLabelText(/^Enterprise code/)).toHaveValue('business');
      expect(screen.getByLabelText(/^Enterprise name/)).toHaveValue('Example Repair');
      expect(screen.getByLabelText(/^Administrator email/)).toHaveValue(
        values.adminEmail,
      );
      const button = screen.getByRole('button', { name: 'Create enterprise' });
      if (editable) {
        expect(button).toBeEnabled();
        expect(screen.getByLabelText(/^Enterprise code/)).toBeEnabled();
        expect(
          screen.queryByText(
            workspace.setupContinuation!.presentation.uncertainMessage,
          ),
        ).not.toBeInTheDocument();
        const originalKey = new Headers(fetcher.mock.calls[0]?.[1]?.headers).get(
          'Idempotency-Key',
        );
        expect(binding.get()?.values.idempotencyKey).toBe(originalKey);
        await user.type(screen.getByLabelText(/^Enterprise code/), '-new');
        expect(binding.get()?.values.idempotencyKey).toBe(originalKey);
      } else expect(button).toBeDisabled();
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it('restores an unsubmitted form and original key after same-lineage unlock without a request', async () => {
    const checkpoint = new EnterpriseCreationCheckpoint();
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup();
    const first = render(page(checkpoint));
    await fill(user);
    const binding = checkpoint.bind(
      'same-admission/project/tenant/enterprise',
      connection,
      workspace,
      section,
    )!;
    const key = binding.get()?.values.idempotencyKey;
    first.unmount();
    render(page(checkpoint, 2));
    expect(screen.getByLabelText(/^Enterprise name/)).toHaveValue('Example Repair');
    expect(screen.getByLabelText(/^Administrator email/)).toHaveValue(
      values.adminEmail,
    );
    expect(binding.get()?.values.idempotencyKey).toBe(key);
    expect(screen.getByRole('button', { name: 'Create enterprise' })).toBeEnabled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    'holds a late %s receipt across lock, with only explicit owner inspection available',
    async (acknowledged) => {
      const checkpoint = new EnterpriseCreationCheckpoint();
      let resolve: ((value: Response) => void) | undefined;
      let reject: ((reason: Error) => void) | undefined;
      const fetcher = vi.fn<typeof fetch>().mockImplementation(
        () =>
          new Promise<Response>((yes, no) => {
            resolve = yes;
            reject = no;
          }),
      );
      vi.stubGlobal('fetch', fetcher);
      const user = userEvent.setup();
      const first = render(page(checkpoint));
      await fill(user);
      await user.click(screen.getByRole('button', { name: 'Create enterprise' }));
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText(workspace.setupContinuation!.presentation.workingLabel),
      ).toBeVisible();
      expect(
        screen.queryByText(workspace.setupContinuation!.presentation.uncertainMessage),
      ).not.toBeInTheDocument();
      const key = new Headers(fetcher.mock.calls[0]?.[1]?.headers).get(
        'Idempotency-Key',
      );
      const body = fetcher.mock.calls[0]?.[1]?.body;
      if (typeof body !== 'string') throw new Error('Expected the declared model body');
      expect(body).not.toContain('idempotencyKey');
      first.unmount();
      render(page(checkpoint, 2));
      expect(
        screen.getByText(workspace.setupContinuation!.presentation.workingLabel),
      ).toBeVisible();
      expect(
        screen.queryByText(workspace.setupContinuation!.presentation.uncertainMessage),
      ).not.toBeInTheDocument();
      await act(async () => {
        if (acknowledged)
          resolve?.(
            new Response(
              JSON.stringify({
                data: {
                  code: 'business',
                  name: 'Example Repair',
                  tenantCode: 'business',
                  active: true,
                  password: 'private-response',
                },
              }),
              {
                status: 200,
              },
            ),
          );
        else reject?.(new TypeError('Failed to fetch'));
        await Promise.resolve();
      });
      expect(screen.getByRole('button', { name: 'Create enterprise' })).toBeDisabled();
      expect(screen.getByLabelText(/^Enterprise name/)).toHaveValue('Example Repair');
      expect(screen.getByText('Inspect setup before continuing.')).toBeVisible();
      const binding = checkpoint.bind(
        'same-admission/project/tenant/enterprise',
        connection,
        workspace,
        section,
      )!;
      expect(binding.get()?.values.idempotencyKey).toBe(key);
      expect(binding.get()?.phase).toBe(acknowledged ? 'ACKNOWLEDGED' : 'UNCERTAIN');
      expect(JSON.stringify(binding.get())).not.toContain('private-response');
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('textbox', { name: 'Setup enterprise' })).toHaveValue(
        'business',
      );
      fetcher.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              contractVersion: 1,
              enterprise: {
                code: 'business',
                name: 'Example Repair',
                tenantCode: 'tenant',
              },
              administrator: { email: values.adminEmail, status: 'PENDING' },
              setup: { revision: 1, state: 'HELD', canResume: false, reasonCodes: [] },
              descriptor: workspace.setupContinuation,
            },
          }),
          { status: 200 },
        ),
      );
      await user.click(screen.getByRole('button', { name: 'Inspect setup' }));
      await screen.findByRole('heading', { name: 'Example Repair' });
      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
      expect(fetcher.mock.calls[1]?.[1]?.method ?? 'GET').toBe('GET');
      expect(screen.getByRole('button', { name: 'Create enterprise' })).toBeDisabled();
      expect(binding.get()?.values.idempotencyKey).toBe(key);
      fetcher.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              contractVersion: 1,
              enterprise: {
                code: 'business',
                name: 'Example Repair',
                tenantCode: 'tenant',
              },
              administrator: { email: values.adminEmail, status: 'READY' },
              setup: {
                revision: 2,
                state: 'COMPLETE',
                canResume: false,
                reasonCodes: [],
              },
              descriptor: workspace.setupContinuation,
            },
          }),
          { status: 200 },
        ),
      );
      await user.click(screen.getByRole('button', { name: 'Inspect setup' }));
      await waitFor(() =>
        expect(screen.getByLabelText(/^Enterprise code/)).toHaveValue(''),
      );
      expect(fetcher).toHaveBeenCalledTimes(3);
      expect(
        fetcher.mock.calls.filter(([, init]) => init?.method === 'POST'),
      ).toHaveLength(1);
      expect(binding.get()?.phase).toBe('DRAFT');
    },
  );
  it('does not recover a previous actor draft after a fresh admission', async () => {
    const checkpoint = new EnterpriseCreationCheckpoint();
    const user = userEvent.setup();
    const first = render(page(checkpoint));
    await fill(user);
    first.unmount();
    checkpoint.clear();
    render(page(checkpoint, 2));
    expect(screen.getByLabelText(/^Enterprise code/)).toHaveValue('');
    expect(screen.getByLabelText(/^Administrator email/)).toHaveValue('');
  });
  it.each([
    {},
    { unrelated: 'data' },
    { code: 'another', name: 'Example Repair', tenantCode: 'another', active: true },
  ])(
    'holds HTTP 200 %j without losing the original key or enabling a second create',
    async (data) => {
      const checkpoint = new EnterpriseCreationCheckpoint();
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify({ data }), { status: 200 }));
      vi.stubGlobal('fetch', fetcher);
      const user = userEvent.setup();
      const view = render(page(checkpoint));
      await fill(user);
      await user.click(screen.getByRole('button', { name: 'Create enterprise' }));
      await screen.findByText('Backend workspace response could not be confirmed');
      const key = new Headers(fetcher.mock.calls[0]?.[1]?.headers).get(
        'Idempotency-Key',
      );
      const binding = checkpoint.bind(
        'same-admission/project/tenant/enterprise',
        connection,
        workspace,
        section,
      )!;
      expect(binding.get()?.phase).toBe('UNCERTAIN');
      expect(binding.get()?.values.idempotencyKey).toBe(key);
      expect(screen.getByRole('button', { name: 'Create enterprise' })).toBeDisabled();
      const changedWorkspace = {
        ...workspace,
        tabs: workspace.tabs.map((tab) => ({
          ...tab,
          sections: tab.sections.map((item) => ({
            ...item,
            fields: item.fields?.map((field) =>
              field.name === 'name' ? { ...field, label: 'Business name' } : field,
            ),
          })),
        })),
      };
      view.rerender(
        <BackendOperationsWorkspaceRoutePage
          runtime={runtime}
          workspace={changedWorkspace}
          connection={connection}
          accessToken="fixture-token"
          sessionGeneration={1}
          enterpriseCreationCheckpoint={{
            checkpoint,
            scope: 'same-admission/project/tenant/enterprise',
          }}
        />,
      );
      expect(screen.getByLabelText(/^Business name/)).toHaveValue('Example Repair');
      expect(screen.getByRole('button', { name: 'Create enterprise' })).toBeDisabled();
      expect(binding.get()?.values.idempotencyKey).toBe(key);
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
});
