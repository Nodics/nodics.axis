import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RuntimeConfigurationRoutePage } from '../../../src/operations/runtimeConfiguration/RuntimeConfigurationRoutePage';
import * as client from '../../../src/operations/runtimeConfiguration/api/runtimeConfigurationClient';

vi.mock(
  '../../../src/operations/runtimeConfiguration/api/runtimeConfigurationClient',
  () => ({
    loadRuntimeConfigurationSchemas: vi.fn(),
    loadRuntimeConfigurationEffective: vi.fn(),
    saveRuntimeConfigurationUpdate: vi.fn(),
    validateRuntimeConfigurationUpdate: vi.fn(),
  }),
);
const schema = {
  code: 'telegram',
  fields: [{ code: 'token', label: 'Token', sensitive: true }],
  secretPersistence: { required: true, ready: true, reason: 'READY' },
};
const effective = {
  code: 'telegram',
  status: 'UNCONFIGURED',
  missingRequired: [],
  values: {},
  secretPersistence: schema.secretPersistence,
};
function setup() {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cache}>
      <RuntimeConfigurationRoutePage
        accessToken="employee"
        runtime={{ enterpriseCode: 'default', requestTimeoutMs: 1000 } as never}
        navigation={{ label: 'Runtime configuration' } as never}
        bootstrap={
          {
            moduleConnections: {
              system: ['PLATFORM', 'ENGAGEMENT'].map((role) => ({
                moduleName: 'system',
                instanceId: role,
                runtimeRole: { code: role, publication: 'NONE' },
                endpoint: `https://${role.toLowerCase()}.example.test/system`,
                environment: 'LOCAL',
                state: 'UP',
              })),
            },
          } as never
        }
      />
    </QueryClientProvider>,
  );
  return cache;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(client.loadRuntimeConfigurationSchemas).mockResolvedValue([schema]);
  vi.mocked(client.loadRuntimeConfigurationEffective).mockResolvedValue(effective);
  vi.mocked(client.saveRuntimeConfigurationUpdate).mockResolvedValue({
    code: 'telegram',
  });
});
describe('runtime configuration owner readiness', () => {
  it('blocks edits when the effective owner read fails', async () => {
    vi.mocked(client.loadRuntimeConfigurationEffective).mockRejectedValue(
      new Error('Owner unavailable'),
    );
    setup();
    await screen.findByText('Owner unavailable');
    expect(screen.getByLabelText('New value')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refresh readiness' })).toBeEnabled();
  });
  it('blocks secret entry and save before the runtime encryption key exists', async () => {
    vi.mocked(client.loadRuntimeConfigurationEffective).mockResolvedValue({
      ...effective,
      secretPersistence: {
        required: true,
        ready: false,
        reason: 'ENCRYPTION_KEY_REQUIRED',
      },
    });
    setup();
    await screen.findByText(/Configure the selected runtime encryption key/);
    expect(screen.getByLabelText('New value')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(client.saveRuntimeConfigurationUpdate).not.toHaveBeenCalled();
  });
  it('fails closed when sensitive readiness is omitted', async () => {
    vi.mocked(client.loadRuntimeConfigurationEffective).mockResolvedValue({
      ...effective,
      secretPersistence: undefined,
    });
    setup();
    await screen.findByText(/Secret persistence readiness has not been confirmed/);
    expect(screen.getByLabelText('New value')).toBeDisabled();
  });
  it('selects the authorized runtime instance, isolates cache and clears secret drafts', async () => {
    const user = userEvent.setup();
    const cache = setup();
    await waitFor(() => expect(screen.getByLabelText('New value')).toBeEnabled());
    await user.type(screen.getByLabelText('New value'), 'private-test-token');
    expect(screen.getByRole('button', { name: 'Validate' })).toBeDisabled();
    await user.click(screen.getByLabelText('Runtime target'));
    await user.click(screen.getByRole('option', { name: 'ENGAGEMENT / ENGAGEMENT' }));
    await waitFor(() =>
      expect(client.loadRuntimeConfigurationEffective).toHaveBeenLastCalledWith(
        expect.objectContaining({ ownerSelector: { instanceId: 'ENGAGEMENT' } }),
        'telegram',
      ),
    );
    expect(screen.getByLabelText('New value')).toHaveValue('');
    expect(
      cache
        .getQueryCache()
        .findAll({ queryKey: ['runtime-configuration-effective'] })
        .filter((query) => query.state.data !== undefined),
    ).toHaveLength(2);
    await waitFor(() => expect(screen.getByLabelText('New value')).toBeEnabled());
    await user.type(screen.getByLabelText('New value'), 'new-test-token');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(client.saveRuntimeConfigurationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ ownerSelector: { instanceId: 'ENGAGEMENT' } }),
        'telegram',
        { token: 'new-test-token' },
      ),
    );
    expect(client.validateRuntimeConfigurationUpdate).not.toHaveBeenCalled();
  });
});
