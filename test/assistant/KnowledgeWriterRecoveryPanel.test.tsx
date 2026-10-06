/** @file Proves inert review, minimum-age denial, uncertain command locking and source-bound transport. */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { KnowledgeWriterRecoveryPanel } from '../../src/assistant/KnowledgeWriterRecoveryPanel';
import { createKnowledgeWriterRecoveryClient } from '../../src/assistant/api/knowledgeWriterRecoveryClient';
import { parseKnowledgeInventory } from '../../src/assistant/api/knowledgeStudioClient';
import { knowledgeStudioFixture } from './knowledgeStudioFixture';

const copy = {
  title: 'Pending refresh recovery',
  review: 'Review pending refresh',
  confirm: 'Retire pending refresh',
  cancel: 'Cancel',
  started: 'Writer started',
  chunks: 'Expected chunks',
  notEligible: 'Too recent to retire',
  impact: 'Preserves published knowledge; does not stop the worker or delete data',
  done: 'Retirement acknowledged',
  unknown: 'Outcome unknown; inspect before another action',
  unavailable: 'Review unavailable',
};
const review = {
  sourceCode: 'framework-readmes',
  sourcePolicyDigest: 'a'.repeat(64),
  revision: 7,
  reviewDigest: 'b'.repeat(64),
  startedAt: '2026-10-03T10:00:00Z',
  expectedChunks: 12,
  eligible: true,
};

describe('Pending writer recovery', () => {
  it.each(['success', 'unknown'])(
    'reviews impact and locks sent command after %s',
    async (outcome) => {
      const execute =
        outcome === 'success'
          ? vi.fn().mockResolvedValue(undefined)
          : vi.fn().mockRejectedValue(new Error('private index'));
      render(
        <KnowledgeWriterRecoveryPanel
          copy={copy}
          actions={{ preview: vi.fn().mockResolvedValue(review), execute }}
        />,
      );
      expect(execute).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', { name: copy.review }));
      expect(await screen.findByText(copy.impact)).toBeVisible();
      expect(screen.getByText('12')).toBeVisible();
      expect(execute).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', { name: copy.confirm }));
      expect(await screen.findByRole('status')).toHaveTextContent(
        outcome === 'success' ? copy.done : copy.unknown,
      );
      expect(screen.getByRole('button', { name: copy.confirm })).toBeDisabled();
      expect(screen.getByRole('button', { name: copy.cancel })).toBeDisabled();
      expect(execute).toHaveBeenCalledOnce();
      expect(screen.queryByText('private index')).toBeNull();
    },
  );
  it('does not send or queue offline and denies recent writers', async () => {
    const actions = {
      preview: vi.fn().mockResolvedValue({ ...review, eligible: false }),
      execute: vi.fn(),
    };
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<KnowledgeWriterRecoveryPanel copy={copy} actions={actions} />);
    await userEvent.click(screen.getByRole('button', { name: copy.review }));
    expect(actions.preview).not.toHaveBeenCalled();
    online.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: copy.review }));
    expect(await screen.findByText(copy.notEligible)).toBeVisible();
    expect(screen.getByRole('button', { name: copy.confirm })).toBeDisabled();
    expect(actions.execute).not.toHaveBeenCalled();
    online.mockRestore();
  });
  it('aborts and drops late review when the source or identity unmounts', async () => {
    let resolve!: (value: typeof review) => void;
    const preview = vi.fn((signal?: AbortSignal) => {
      expect(signal).toBeDefined();
      return new Promise<typeof review>((r) => {
        resolve = r;
      });
    });
    const rendered = render(
      <KnowledgeWriterRecoveryPanel
        copy={copy}
        actions={{ preview, execute: vi.fn() }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: copy.review }));
    rendered.unmount();
    expect(preview.mock.calls[0]![0]!.aborted).toBe(true);
    await act(async () => {
      resolve(review);
      await Promise.resolve();
    });
    expect(screen.queryByText(copy.impact)).toBeNull();
  });
  it('enforces matching source, exact acknowledgement revision and fixed command fields without retry', async () => {
    const source = {
      ...parseKnowledgeInventory(knowledgeStudioFixture()).sources[0]!,
      canRetireWriter: true,
      sourcePolicyDigest: review.sourcePolicyDigest,
    };
    const envelope = (data: unknown) =>
      new Response(JSON.stringify({ code: 'SUC_SYS_00000', data }));
    const result = {
      contractVersion: 1,
      state: 'RETIRED',
      sourceCode: source.code,
      sourcePolicyDigest: source.sourcePolicyDigest,
      revision: 8,
      cleanupPending: true,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        envelope({
          ...review,
          contractVersion: 1,
          state: 'REVIEWED',
          token: 'private',
        }),
      )
      .mockResolvedValueOnce(envelope(result));
    const client = createKnowledgeWriterRecoveryClient(
      {
        moduleBaseUrl: 'http://localhost:4300/copilotApi',
        accessToken: 'token',
        enterpriseCode: 'enterprise',
        timeoutMs: 1000,
      },
      fetcher,
    );
    const selected = await client.preview(source);
    expect(selected).not.toHaveProperty('token');
    await client.execute(source, selected);
    expect((fetcher.mock.calls[0]![0] as URL).pathname).toMatch(
      /writer-recovery\/preview$/,
    );
    expect(JSON.parse(fetcher.mock.calls[1]![1]?.body as string)).toEqual({
      confirmed: true,
      expectedRevision: 7,
      expectedPolicyDigest: review.sourcePolicyDigest,
      reviewDigest: review.reviewDigest,
    });
    await expect(
      client.execute(source, { ...selected, sourceCode: 'foreign' }),
    ).rejects.toThrow();
    await expect(
      client.execute(source, { ...selected, eligible: false }),
    ).rejects.toThrow();
    await expect(
      client.preview({ ...source, canRetireWriter: false }),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockResolvedValueOnce(envelope({ ...result, revision: 9 }));
    await expect(client.execute(source, selected)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('inventory refuses recovery without durable pending evidence and owner copy', () => {
    const fixture = knowledgeStudioFixture();
    const source = fixture.sources[0]!;
    expect(() =>
      parseKnowledgeInventory({
        ...fixture,
        sources: [{ ...source, canRetireWriter: true }],
      }),
    ).toThrow();
    const value = {
      ...fixture,
      recoveryPresentation: copy,
      presentation: {
        ...fixture.presentation,
        durableEvidence: 'Verified',
        inspectionRequired: 'Inspect writer',
        cleanupPending: 'Cleanup pending',
      },
      sources: [
        {
          ...source,
          canRetireWriter: true,
          status: {
            ...source.status,
            evidence: 'DURABLE_GENERATION',
            inspectionRequired: true,
          },
        },
      ],
    };
    expect(parseKnowledgeInventory(value).sources[0]?.canRetireWriter).toBe(true);
  });
});
