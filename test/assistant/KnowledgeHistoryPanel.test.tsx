/** @file Proves inert durable history, explicit reads, bounded paging and source teardown. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KnowledgeHistoryPanel } from '../../src/assistant/KnowledgeHistoryPanel';
import {
  parseKnowledgeHistory,
  parseKnowledgeHistoryCopy,
  createKnowledgeHistoryClient,
} from '../../src/assistant/api/knowledgeHistoryClient';

export const historyCopy = parseKnowledgeHistoryCopy({
  title: 'Refresh executions',
  load: 'Load execution history',
  refresh: 'Reload history',
  empty: 'No executions',
  unavailable: 'Execution history unavailable',
  definition: 'Process definition',
  version: 'Published version',
  instance: 'Execution',
  started: 'Started',
  completed: 'Completed',
  currentPolicy: 'Current source policy',
  previousPolicy: 'Previous source policy',
  previous: 'Previous page',
  next: 'Next page',
  ready: 'Awaiting claim',
  claimed: 'In progress',
  done: 'Completed',
  failed: 'Failed',
  inspection: 'Outcome requires inspection',
  recovery: 'Process operator review required',
  evidence: 'Persisted Process evidence',
});
/** Synthetic owner response; not evidence of a live Process execution. */
export function historyFixture() {
  return {
    contractVersion: 2,
    evidence: 'PROCESS_ACTION_ATTEMPTS',
    sourceCode: 'docs',
    page: 1,
    limit: 25,
    hasMore: true,
    definitionCode: 'refresh-docs',
    definitionVersion: 1,
    observedAt: '2026-10-03T00:02:00Z',
    items: [
      {
        instanceCode: 'refresh-1',
        executionCode: '12345678-1234-1234-1234-123456789012',
        status: 'INSPECTION_REQUIRED',
        definitionVersion: 1,
        currentPolicy: false,
        recovery: 'PROCESS_INSPECTION',
        startedAt: '2026-10-03T00:00:00Z',
        completedAt: null,
      },
    ],
  };
}
describe('Knowledge execution history', () => {
  it('requires an explicit read and displays uncertainty without a retry-mutation button', async () => {
    const load = vi
      .fn()
      .mockResolvedValue(parseKnowledgeHistory(historyFixture(), 'docs', 1));
    render(<KnowledgeHistoryPanel copy={historyCopy} load={load} />);
    expect(load).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: historyCopy.load }));
    await screen.findByText('Outcome requires inspection');
    expect(screen.getByText('Previous source policy')).toBeTruthy();
    expect(screen.getByText('Process operator review required')).toBeTruthy();
    expect(
      screen.getByText('Execution: 12345678-1234-1234-1234-123456789012'),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /retry|execute|refresh source/i }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: historyCopy.next }));
    await waitFor(() =>
      expect(load).toHaveBeenLastCalledWith(2, expect.any(AbortSignal)),
    );
  });
  it('aborts a pending read when the source is removed', async () => {
    const load = vi.fn(
      () => new Promise<ReturnType<typeof parseKnowledgeHistory>>(() => {}),
    );
    const view = render(<KnowledgeHistoryPanel copy={historyCopy} load={load} />);
    fireEvent.click(screen.getByRole('button', { name: historyCopy.load }));
    await waitFor(() => expect(load).toHaveBeenCalledOnce());
    const signal = (load.mock.calls as unknown as [number, AbortSignal][])[0]![1];
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
  it('shows unavailable for synchronous transport failures', async () => {
    const load = vi.fn(() => {
      throw new Error('transport unavailable');
    });
    render(<KnowledgeHistoryPanel copy={historyCopy} load={load} />);
    fireEvent.click(screen.getByRole('button', { name: historyCopy.load }));
    await screen.findByText(historyCopy.unavailable);
    expect(load).toHaveBeenCalledOnce();
  });
  it('rejects foreign sources, malformed statuses and unbounded owner pages', () => {
    const input = historyFixture();
    expect(() => parseKnowledgeHistory(input, 'foreign', 1)).toThrow();
    expect(() =>
      parseKnowledgeHistory(
        { ...input, items: Array(26).fill(input.items[0]) },
        'docs',
        1,
      ),
    ).toThrow();
    expect(() =>
      parseKnowledgeHistory(
        { ...input, items: [{ ...input.items[0], status: 'RETRY_NOW' }] },
        'docs',
        1,
      ),
    ).toThrow();
    const result = parseKnowledgeHistory(
      { ...input, context: { secret: 'discard' } },
      'docs',
      1,
    );
    expect(result).not.toHaveProperty('context');
  });
  it('uses only the canonical bounded read route', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ code: 'SUC_SYS_00000', data: historyFixture() })),
      );
    const client = createKnowledgeHistoryClient(
      {
        accessToken: 'token',
        enterpriseCode: 'enterprise',
        moduleBaseUrl: 'http://localhost:4300/copilotApi',
        timeoutMs: 1000,
      },
      fetcher,
    );
    await client.load('docs', 1);
    const sent = fetcher.mock.calls[0]![0];
    const url =
      typeof sent === 'string' ? sent : sent instanceof URL ? sent.href : sent.url;
    expect(url).toContain('/knowledge/sources/docs/history?page=1');
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(client.load('../escape', 1)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('retains separate attempts for one instance across versions but rejects duplicate execution evidence', () => {
    const input = historyFixture();
    const second = {
      ...input.items[0]!,
      executionCode: '22345678-1234-1234-1234-123456789012',
      definitionVersion: 2,
    };
    const history = parseKnowledgeHistory(
      { ...input, items: [input.items[0], second] },
      'docs',
      1,
    );
    expect(history.items.map((item) => item.definitionVersion)).toEqual([1, 2]);
    expect(() =>
      parseKnowledgeHistory({ ...input, items: [second, second] }, 'docs', 1),
    ).toThrow();
    expect(() =>
      parseKnowledgeHistory(
        { ...input, items: [{ ...second, status: 'COMPLETED', completedAt: null }] },
        'docs',
        1,
      ),
    ).toThrow();
    expect(() =>
      parseKnowledgeHistory(
        { ...input, items: [{ ...second, recovery: 'NONE' }] },
        'docs',
        1,
      ),
    ).toThrow();
  });
});
