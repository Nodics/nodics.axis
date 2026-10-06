/** @file Metadata retention preview remains non-destructive, scoped, and explicitly loaded. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { CopilotLifecycleDialog } from '../../src/assistant/CopilotLifecycleDialog';
import {
  lifecycleTextKeys,
  parseLifecycleCapability,
  parseLifecyclePreview,
} from '../../src/assistant/api/copilotLifecycleClient';
const configuration = {
  accessToken: 'token',
  enterpriseCode: 'acme',
  moduleBaseUrl: 'http://localhost:4300/copilotApi',
  timeoutMs: 1000,
};
const copy = parseLifecycleCapability({
  presentation: Object.fromEntries(lifecycleTextKeys.map((key) => [key, key])),
})!;
const data = {
  contractVersion: 1,
  context: { enterpriseCode: 'acme', tenantCode: 'tenant' },
  page: 1,
  limit: 25,
  mayHaveMore: false,
  cutoff: '2026-09-01T00:00:00Z',
  policy: { destructiveExecution: false },
  items: [
    {
      code: 'held-conversation',
      state: 'HELD',
      updatedAt: null,
      content: 'must not retain',
    },
  ],
};
afterEach(() => vi.unstubAllGlobals());
it('rejects destructive, foreign and duplicate evidence while discarding content', () => {
  expect(() =>
    parseLifecyclePreview(
      { ...data, policy: { destructiveExecution: true } },
      'acme',
      1,
    ),
  ).toThrow();
  expect(() => parseLifecyclePreview(data, 'other', 1)).toThrow();
  expect(() =>
    parseLifecyclePreview(
      { ...data, items: [...data.items, ...data.items] },
      'acme',
      1,
    ),
  ).toThrow();
  expect(JSON.stringify(parseLifecyclePreview(data, 'acme', 1))).not.toContain(
    'must not retain',
  );
});
it('loads only on explicit request and exposes no delete control', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ code: 'SUC_TEST', data })));
  vi.stubGlobal('fetch', fetcher);
  render(
    <CopilotLifecycleDialog
      copy={copy}
      configuration={configuration}
      onClose={vi.fn()}
    />,
  );
  expect(fetcher).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'inspect' }));
  await screen.findByText('held-conversation');
  expect(screen.getByText('HELD')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
