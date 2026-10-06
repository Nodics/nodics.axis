/** @file Proves explicit review/confirmation, uncertain-start lock, strict receipts, offline rejection and scoped teardown. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeManualRefreshPanel } from '../../src/assistant/KnowledgeManualRefreshPanel';
import { createKnowledgeManualRefreshClient } from '../../src/assistant/api/knowledgeManualRefreshClient';
import {
  copy,
  historyCopy,
  source,
  requestId,
  review,
  history,
  historyResponse,
} from './knowledgeManualRefreshFixture';
const config = {
  accessToken: 'fixture',
  enterpriseCode: 'fixture',
  moduleBaseUrl: 'https://refresh-fixture.invalid/copilotApi',
  timeoutMs: 1000,
};
afterEach(() => vi.restoreAllMocks());
describe('Recorded manual refresh', () => {
  it('rejects contradictory outer and nested acknowledgements even with a valid receipt', async () => {
    for (const patch of [
      { acknowledged: false },
      { success: false },
      { code: 'ERR_OWNER' },
      { errors: ['partial'] },
    ]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          code: 'SUC_COPILOT',
          data: { contractVersion: 1, state: 'REVIEW', ...review },
          ...patch,
        }),
      );
      await expect(
        createKnowledgeManualRefreshClient(config, fetcher).preview(source, requestId),
      ).rejects.toThrow();
    }
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        code: 'SUC_COPILOT',
        data: { contractVersion: 1, state: 'REVIEW', ...review, acknowledged: false },
      }),
    );
    await expect(
      createKnowledgeManualRefreshClient(config, fetcher).preview(source, requestId),
    ).rejects.toThrow();
  });
  it('requires review and confirmation; lost acknowledgement locks the start and inspection never retries it', async () => {
    const actions = {
      preview: vi.fn().mockResolvedValue(review),
      start: vi.fn().mockRejectedValue(new Error('lost response')),
      inspect: vi.fn().mockResolvedValue(history()),
    };
    render(
      <KnowledgeManualRefreshPanel
        copy={copy}
        historyCopy={historyCopy}
        actions={actions}
      />,
    );
    expect(actions.preview).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: copy.review }));
    await screen.findByRole('checkbox', { name: copy.confirm });
    expect(screen.getByRole('button', { name: copy.start })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: copy.confirm }));
    fireEvent.click(screen.getByRole('button', { name: copy.start }));
    await screen.findByText(copy.unknown);
    expect(screen.queryByRole('button', { name: copy.start })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: copy.inspect }));
    await screen.findByText(historyCopy.inspection);
    expect(actions.start).toHaveBeenCalledOnce();
    expect(actions.inspect).toHaveBeenCalledWith(review, expect.any(AbortSignal));
  });
  it('never queues offline work and aborts an in-flight review on unmount', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const actions = {
      preview: vi.fn(() => new Promise<typeof review>(() => {})),
      start: vi.fn(),
      inspect: vi.fn(),
    };
    const mounted = render(
      <KnowledgeManualRefreshPanel
        copy={copy}
        historyCopy={historyCopy}
        actions={actions}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: copy.review }));
    expect(actions.preview).not.toHaveBeenCalled();
    online.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: copy.review }));
    await waitFor(() => expect(actions.preview).toHaveBeenCalledOnce());
    const signal = (
      actions.preview.mock.calls as unknown as [string, AbortSignal][]
    )[0]![1];
    mounted.unmount();
    expect(signal.aborted).toBe(true);
  });
  it('uses strict owner review and start receipts with one fixed POST and no raw authority fields', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        code: 'SUC_COPILOT',
        data: { contractVersion: 1, state: 'REVIEW', ...review },
      }),
    );
    const client = createKnowledgeManualRefreshClient(config, fetcher);
    expect(await client.preview(source, requestId)).toEqual(review);
    fetcher.mockResolvedValue(
      Response.json({
        code: 'SUC_COPILOT',
        data: {
          contractVersion: 1,
          state: 'START_ACKNOWLEDGED',
          evidence: 'PROCESS_INSTANCE',
          ...review,
        },
      }),
    );
    await client.start(source, review);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, options] = fetcher.mock.calls[1]!;
    expect(url instanceof URL ? url.href : url).toMatch(
      /\/v0\/knowledge\/sources\/framework-docs\/refresh\/start$/,
    );
    expect(JSON.parse(options!.body as string)).toEqual({
      requestId,
      expectedPolicyDigest: source.sourcePolicyDigest,
      reviewDigest: review.reviewDigest,
      confirmed: true,
    });
    fetcher.mockResolvedValue(
      Response.json({
        code: 'SUC_COPILOT',
        data: {
          contractVersion: 1,
          state: 'START_ACKNOWLEDGED',
          evidence: 'PROCESS_INSTANCE',
          ...review,
          instanceCode: 'knowledge-manual-' + 'd'.repeat(64),
        },
      }),
    );
    await expect(client.start(source, review)).rejects.toThrow('Unconfirmed');
  });
  it('rejects foreign inspection rows, inconsistent empty outcomes and pre-aborted or offline commands', async () => {
    const response = {
      contractVersion: 1,
      state: 'ATTEMPTS_AVAILABLE',
      requestId,
      sourceCode: source.code,
      instanceCode: review.instanceCode,
      history: historyResponse(),
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(Response.json({ code: 'SUC_COPILOT', data: response })),
      );
    const client = createKnowledgeManualRefreshClient(config, fetcher);
    expect((await client.inspect(source, review)).items).toHaveLength(1);
    response.history.items[0]!.instanceCode = 'foreign-instance';
    await expect(client.inspect(source, review)).rejects.toThrow('Foreign');
    response.history.items = [];
    await expect(client.inspect(source, review)).rejects.toThrow('Foreign');
    const controller = new AbortController();
    controller.abort();
    const before = fetcher.mock.calls.length;
    await expect(
      client.preview(source, requestId, controller.signal),
    ).rejects.toThrow();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await expect(client.start(source, review)).rejects.toThrow('unavailable');
    expect(fetcher).toHaveBeenCalledTimes(before);
  });
});
