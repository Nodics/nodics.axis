import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NavigationCompositionRoutePage } from '../../src/operations/navigationComposition/NavigationCompositionRoutePage';
const request = vi.hoisted(() => vi.fn());
const authoring = vi.hoisted(() => vi.fn());
vi.mock(
  '../../src/operations/navigationComposition/api/navigationCompositionClient',
  () => ({
    executeNavigationCompositionAction: request,
    loadNavigationCompositionAuthoring: authoring,
  }),
);
const payload = {
  exportFormatVersion: 0,
  exportedAt: '2026-11-03T17:00:00Z',
  composition: {
    contractVersion: 0,
    version: 0,
    checksum: 'a'.repeat(64),
    lifecycleState: 'PUBLISHED',
    scope: { tenantCode: 'tenant', enterpriseCode: 'enterprise' },
    navigation: [],
    groups: [],
  },
};
const source = {
  moduleName: 'backoffice',
  instanceId: 'platform',
  endpoint: 'https://platform.example/nodics/backoffice',
  environment: 'local',
  state: 'UP',
};
const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
const create = vi.fn((blob: Blob) => {
    void blob;
    return 'blob:private-snapshot';
  }),
  revoke = vi.fn();
function view(actor = 'private-one') {
  return (
    <QueryClientProvider client={client}>
      <NavigationCompositionRoutePage
        accessToken={actor}
        runtime={
          {
            enterpriseCode: 'enterprise',
            projectCode: 'project',
            requestTimeoutMs: 1000,
          } as never
        }
        bootstrap={
          {
            tenantCode: 'tenant',
            navigation: [],
            moduleConnections: { backoffice: [source] },
          } as never
        }
      />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  request.mockResolvedValue(payload);
  authoring.mockResolvedValue({
    version: 0,
    checksum: 'a'.repeat(64),
    availableOperations: [
      'preview',
      'export',
      'createDraft',
      'submit',
      'approve',
      'publish',
      'rollback',
    ],
    rollbackCandidates: [],
  });
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  client.clear();
});
it('provides a file link for the exact snapshot and retires it on employee change', async () => {
  const rendered = render(view());
  const user = userEvent.setup();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Export effective' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Export effective' }));
  const link = await screen.findByRole('link', { name: 'Download snapshot' });
  expect(link).toHaveAttribute('href', 'blob:private-snapshot');
  expect(link).toHaveAttribute('download', 'axis-navigation-v0-aaaaaaaaaaaa.json');
  expect(create).toHaveBeenCalledTimes(1);
  const blob = create.mock.calls[0]?.[0] as unknown as Blob;
  expect(blob.type).toBe('application/json');
  rendered.rerender(view('private-two'));
  expect(screen.queryByRole('link', { name: 'Download snapshot' })).toBeNull();
  expect(revoke).toHaveBeenCalledWith('blob:private-snapshot');
});
it('rejects a delayed export after employee change before creating a browser artifact', async () => {
  let resolve: ((value: unknown) => void) | undefined;
  request.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const rendered = render(view());
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Export effective' })).toBeEnabled(),
  );
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Export effective' }));
  rendered.rerender(view('private-two'));
  await act(async () => {
    resolve?.(payload);
    await Promise.resolve();
  });
  expect(create).not.toHaveBeenCalled();
  expect(screen.queryByRole('link', { name: 'Download snapshot' })).toBeNull();
});
it('renders actual preview validation without claiming publication', async () => {
  request.mockResolvedValueOnce(payload).mockResolvedValue({
    mode: 'DRY_RUN_ONLY',
    persisted: false,
    published: false,
    validation: { valid: false, issues: [{ message: 'Two owners use one route.' }] },
    impact: { currentItemCount: 2, candidateItemCount: 2 },
  });
  render(view());
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Preview candidate' })).toBeEnabled(),
  );
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Preview candidate' }));
  expect(await screen.findByText(/Preview found 1 validation issues/)).toBeVisible();
  expect(screen.getByText('Two owners use one route.')).toBeVisible();
  expect(screen.queryByText(/Refresh Axis bootstrap/)).toBeNull();
  expect(create).not.toHaveBeenCalled();
});
it('preserves an actionable error on invalid acknowledgement and never retries', async () => {
  request.mockResolvedValue({ exportFormatVersion: 1 });
  render(view());
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Export effective' })).toBeEnabled(),
  );
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Export effective' }));
  expect(await screen.findByText(/invalid result|does not match/)).toBeVisible();
  expect(create).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
});

it('carries the observed owner draft revision and separates approval from publication', async () => {
  authoring.mockResolvedValue({
    version: 7,
    checksum: 'a'.repeat(64),
    availableOperations: ['approve', 'publish'],
    rollbackCandidates: [],
    draft: {
      draftId: 'nav-draft-5',
      checksum: 'b'.repeat(64),
      lifecycleState: 'SUBMITTED',
    },
  });
  request.mockResolvedValue({
    version: 8,
    checksum: 'b'.repeat(64),
    lifecycleState: 'APPROVED',
  });
  render(view());
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Approve draft' })).toBeEnabled(),
  );
  expect(screen.getByRole('button', { name: 'Publish effective' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Create draft' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Approve draft' }));
  expect(request.mock.calls[0]?.[5]).toEqual({
    expectedVersion: 7,
    expectedChecksum: 'b'.repeat(64),
    expectedDraftId: 'nav-draft-5',
  });
  expect(
    await screen.findByText('Draft approved. Publication is a separate action.'),
  ).toBeVisible();
  expect(request).toHaveBeenCalledTimes(1);
});

it('keeps commands disabled on a lifecycle read failure and supports explicit recovery', async () => {
  authoring.mockRejectedValueOnce(new Error('Lifecycle unavailable'));
  render(view());
  expect(await screen.findByText('Lifecycle unavailable')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Create draft' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Refresh lifecycle' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Create draft' })).toBeEnabled(),
  );
  expect(request).not.toHaveBeenCalled();
});

it('retires a command error only when the user explicitly refreshes current owner state', async () => {
  request.mockRejectedValueOnce(
    new Error('Unconfirmed acknowledgement; inspect owner state'),
  );
  render(view());
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Export effective' })).toBeEnabled(),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Export effective' }));
  expect(
    await screen.findByText('Unconfirmed acknowledgement; inspect owner state'),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: 'Create draft' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Refresh lifecycle' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Create draft' })).toBeEnabled(),
  );
  expect(
    screen.queryByText('Unconfirmed acknowledgement; inspect owner state'),
  ).not.toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(1);
});
