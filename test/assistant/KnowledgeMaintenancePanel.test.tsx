/** @file Read-only receipt inspection, bounded transport, redaction, failure and source-change cancellation. */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { KnowledgeMaintenancePanel } from '../../src/assistant/KnowledgeMaintenancePanel';
import {
  createKnowledgeMaintenanceClient,
  parseKnowledgeMaintenance,
} from '../../src/assistant/api/knowledgeMaintenanceClient';
import { parseKnowledgeInventory } from '../../src/assistant/api/knowledgeStudioClient';
import { knowledgeStudioFixture } from './knowledgeStudioFixture';
import {
  knowledgeMaintenanceCopy as copy,
  maintenanceReceiptFixture as receipt,
} from './knowledgeMaintenanceFixture';
const history = { page: 1, mayHaveMore: false, items: [receipt] };
afterEach(() => vi.restoreAllMocks());
/** Creates a selected authorized source, preserving the real inventory parser. */
function source() {
  const fixture = knowledgeStudioFixture();
  return parseKnowledgeInventory({
    ...fixture,
    maintenancePresentation: copy,
    sources: [
      {
        ...fixture.sources[0],
        sourcePolicyDigest: 'a'.repeat(64),
        canInspectMaintenance: true,
      },
    ],
  }).sources[0]!;
}
/** Builds a scope-bound receipt page with a private extra that must be stripped. */
function envelope() {
  return {
    contractVersion: 1,
    sourceCode: source().code,
    sourcePolicyDigest: 'a'.repeat(64),
    context: { tenantCode: 'tenant', enterpriseCode: 'enterprise' },
    page: 1,
    limit: 25,
    mayHaveMore: false,
    evidence: 'MAINTENANCE_RECEIPTS',
    items: [{ ...receipt, reviewDigest: 'private' }],
  };
}
it('loads only on explicit inspection and never represents authorization as completion', async () => {
  const load = vi.fn().mockResolvedValue(history);
  render(<KnowledgeMaintenancePanel copy={copy} load={load} />);
  expect(load).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: copy.load }));
  expect(await screen.findByText(copy.WRITER_RETIREMENT_AUTHORIZED)).toBeVisible();
  expect(screen.getByText(copy.evidence)).toBeVisible();
  expect(screen.queryByText(copy.WRITER_RETIREMENT_COMPLETED)).toBeNull();
  expect(
    screen.queryByRole('button', { name: /retire|confirm|execute|cleanup/i }),
  ).toBeNull();
  expect(screen.getByRole('button', { name: copy.next })).toBeDisabled();
  expect(load).toHaveBeenCalledExactlyOnceWith(1, expect.any(AbortSignal));
});
it('discards old evidence after denied reload and never displays raw provider details', async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce(history)
    .mockRejectedValue(new Error('private storage'));
  render(<KnowledgeMaintenancePanel copy={copy} load={load} />);
  await userEvent.click(screen.getByRole('button', { name: copy.load }));
  await screen.findByText(copy.WRITER_RETIREMENT_AUTHORIZED);
  await userEvent.click(screen.getByRole('button', { name: copy.refresh }));
  expect(await screen.findByRole('status')).toHaveTextContent(copy.unavailable);
  expect(screen.queryByText(copy.WRITER_RETIREMENT_AUTHORIZED)).toBeNull();
  expect(screen.queryByText('private storage')).toBeNull();
});
it('does not read offline and aborts pending source inspection on unmount', async () => {
  let resolve!: (value: typeof history) => void;
  const load = vi.fn((page: number, signal?: AbortSignal) => {
    expect(page).toBe(1);
    expect(signal).toBeInstanceOf(AbortSignal);
    return new Promise<typeof history>((r) => {
      resolve = r;
    });
  });
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  const view = render(<KnowledgeMaintenancePanel copy={copy} load={load} />);
  await userEvent.click(screen.getByRole('button', { name: copy.load }));
  expect(load).not.toHaveBeenCalled();
  online.mockReturnValue(true);
  await userEvent.click(screen.getByRole('button', { name: copy.load }));
  view.unmount();
  expect(load.mock.calls[0]![1]?.aborted).toBe(true);
  await act(async () => {
    resolve(history);
    await Promise.resolve();
  });
});
it('rejects foreign, duplicate, partial, malformed and excess evidence while stripping private extras', () => {
  const value = envelope();
  expect(
    JSON.stringify(parseKnowledgeMaintenance(value, source(), 'enterprise', 1)),
  ).not.toContain('private');
  for (const changed of [
    { sourceCode: 'foreign' },
    { sourcePolicyDigest: 'b'.repeat(64) },
    { context: { ...value.context, enterpriseCode: 'foreign' } },
    { items: [receipt, receipt] },
    { items: Array(26).fill(receipt) },
    { mayHaveMore: true },
    { items: [{ ...receipt, stage: 'CLEANUP_COMPLETED' }] },
    { items: [{ ...receipt, occurredAt: 'invalid' }] },
  ])
    expect(() =>
      parseKnowledgeMaintenance({ ...value, ...changed }, source(), 'enterprise', 1),
    ).toThrow();
});
it('uses only the scoped GET and denies hidden-source or unbounded requests before fetch', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(JSON.stringify({ code: 'SUC_TEST', data: envelope() })),
    );
  const client = createKnowledgeMaintenanceClient(
    {
      accessToken: 'fixture',
      enterpriseCode: 'enterprise',
      moduleBaseUrl: 'http://fixture.invalid/copilotApi',
      timeoutMs: 1000,
    },
    fetcher,
  );
  const result = await client.load(source(), 1);
  expect(result.items[0]!.stage).toBe('WRITER_RETIREMENT_AUTHORIZED');
  const url = fetcher.mock.calls[0]![0];
  expect(url instanceof Request ? url.url : url.toString()).toContain(
    '/knowledge/sources/framework-readmes/maintenance?page=1',
  );
  expect(fetcher.mock.calls[0]![1]?.method).toBe('GET');
  await expect(
    client.load({ ...source(), canInspectMaintenance: false }, 1),
  ).rejects.toThrow();
  await expect(client.load(source(), 1001)).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledOnce();
});
