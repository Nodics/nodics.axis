/** @file Explicit provider checks cannot run on mount, leak raw payloads or queue offline. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { createAxisQueryClient } from '../../src/app/axisQueryClient';
import { CopilotProviderCheck } from '../../src/assistant/CopilotProviderCheck';
import { parseProviderCheck } from '../../src/assistant/api/copilotProviderClient';
const configuration = {
  accessToken: 'token',
  enterpriseCode: 'enterprise',
  moduleBaseUrl: 'http://localhost:4300/copilotApi',
  timeoutMs: 1000,
};
const result = {
  contractVersion: 1,
  context: { enterpriseCode: 'enterprise' },
  title: 'Provider connection',
  message: 'Provider verified',
  state: 'UP',
  model: 'local-model',
  observedAt: '2026-10-03T00:00:00Z',
  secret: 'never project this',
};
afterEach(() => {
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
});
/** Renders under the production no-offline-queue command policy. */
function mount() {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ code: 'SUC_TEST', data: result }))),
    );
  vi.stubGlobal('fetch', fetcher);
  render(
    <QueryClientProvider client={createAxisQueryClient()}>
      <CopilotProviderCheck configuration={configuration} label="Check connection" />
    </QueryClientProvider>,
  );
  return fetcher;
}
it('requires a click and sends an empty body exactly once', async () => {
  const fetcher = mount();
  expect(fetcher).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Check connection' }));
  await screen.findByText('Provider verified');
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0]![1]!.body).toBe('{}');
  expect(screen.queryByText('never project this')).toBeNull();
});
it('rejects offline probes without reconnect replay', async () => {
  const fetcher = mount();
  onlineManager.setOnline(false);
  await userEvent.click(screen.getByRole('button', { name: 'Check connection' }));
  await screen.findByText('Connection check could not be completed.');
  onlineManager.setOnline(true);
  await waitFor(() => expect(fetcher).not.toHaveBeenCalled());
});
it('rejects foreign and malformed health results and drops raw fields', () => {
  expect(parseProviderCheck(result, 'enterprise')).not.toHaveProperty('secret');
  expect(() => parseProviderCheck(result, 'foreign')).toThrow();
  expect(() =>
    parseProviderCheck({ ...result, state: 'invented' }, 'enterprise'),
  ).toThrow();
  expect(() =>
    parseProviderCheck({ ...result, message: 'x'.repeat(501) }, 'enterprise'),
  ).toThrow();
});
