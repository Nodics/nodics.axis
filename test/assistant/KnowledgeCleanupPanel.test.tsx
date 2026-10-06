/** @file Proves explicit cleanup review, no uncertain replay, offline denial and late-result disposal. */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { KnowledgeCleanupPanel } from '../../src/assistant/KnowledgeCleanupPanel';
import { createKnowledgeCleanupClient } from '../../src/assistant/api/knowledgeCleanupClient';
import { parseKnowledgeInventory } from '../../src/assistant/api/knowledgeStudioClient';
import { knowledgeStudioFixture } from './knowledgeStudioFixture';

const copy = {
  title: 'Index cleanup',
  review: 'Review cleanup',
  confirm: 'Confirm cleanup',
  cancel: 'Cancel',
  eligible: 'Published generations',
  operatorOnly: 'Operator inspection',
  done: 'Cleanup acknowledged',
  unknown: 'Outcome unconfirmed',
  unavailable: 'Review unavailable',
};
const review = {
  revision: 7,
  reviewDigest: 'b'.repeat(64),
  sourceCode: 'framework-readmes',
  sourcePolicyDigest: 'a'.repeat(64),
  eligibleGenerations: 2,
  operatorOnlyGenerations: 1,
};

describe('Reviewed knowledge cleanup', () => {
  it.each(['success', 'unknown'])(
    'requires review and locks after %s',
    async (outcome) => {
      const execute =
        outcome === 'success'
          ? vi.fn().mockResolvedValue(undefined)
          : vi.fn().mockRejectedValue(new Error('private host'));
      const preview = vi.fn().mockResolvedValue(review);
      render(<KnowledgeCleanupPanel copy={copy} actions={{ preview, execute }} />);
      expect(execute).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', { name: copy.review }));
      expect(await screen.findByText('2')).toBeVisible();
      expect(screen.getByText('1')).toBeVisible();
      expect(execute).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', { name: copy.confirm }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        outcome === 'success' ? copy.done : copy.unknown,
      );
      expect(screen.getByRole('button', { name: copy.confirm })).toBeDisabled();
      expect(screen.getByRole('button', { name: copy.cancel })).toBeDisabled();
      expect(execute).toHaveBeenCalledOnce();
      expect(screen.queryByText('private host')).toBeNull();
    },
  );
  it('abandoned-only debt cannot execute; offline review does not send or queue', async () => {
    const actions = {
      preview: vi.fn().mockResolvedValue({ ...review, eligibleGenerations: 0 }),
      execute: vi.fn(),
    };
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<KnowledgeCleanupPanel copy={copy} actions={actions} />);
    await userEvent.click(screen.getByRole('button', { name: copy.review }));
    expect(actions.preview).not.toHaveBeenCalled();
    online.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: copy.review }));
    expect(await screen.findByRole('button', { name: copy.confirm })).toBeDisabled();
    expect(actions.execute).not.toHaveBeenCalled();
    online.mockRestore();
  });
  it('aborts source teardown and discards a late review', async () => {
    let resolve!: (value: typeof review) => void;
    const preview = vi.fn((signal?: AbortSignal) => {
      expect(signal).toBeDefined();
      return new Promise<typeof review>((value) => {
        resolve = value;
      });
    });
    const rendered = render(
      <KnowledgeCleanupPanel copy={copy} actions={{ preview, execute: vi.fn() }} />,
    );
    await userEvent.click(screen.getByRole('button', { name: copy.review }));
    rendered.unmount();
    expect(preview.mock.calls[0]![0]!.aborted).toBe(true);
    await act(async () => {
      resolve(review);
      await Promise.resolve();
    });
    expect(screen.queryByRole('button', { name: copy.confirm })).toBeNull();
  });
  it('binds transport review and acknowledgement to source and revision, without retry', async () => {
    const fixture = knowledgeStudioFixture();
    const source = {
      ...parseKnowledgeInventory(fixture).sources[0]!,
      canCleanup: true,
      sourcePolicyDigest: review.sourcePolicyDigest,
    };
    const envelope = (data: unknown) =>
      new Response(JSON.stringify({ code: 'SUC_SYS_00000', data }));
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        envelope({ ...review, contractVersion: 1, state: 'REVIEWED' }),
      )
      .mockResolvedValueOnce(
        envelope({
          contractVersion: 1,
          state: 'CLEANED',
          sourceCode: source.code,
          sourcePolicyDigest: source.sourcePolicyDigest,
          revision: 9,
          cleanupPending: true,
        }),
      );
    const client = createKnowledgeCleanupClient(
      {
        moduleBaseUrl: 'http://localhost:4300/copilotApi',
        accessToken: 'token',
        enterpriseCode: 'enterprise',
        timeoutMs: 1000,
      },
      fetcher,
    );
    const selected = await client.preview(source);
    await client.execute(source, selected);
    expect((fetcher.mock.calls[0]![0] as URL).pathname).toMatch(/cleanup\/preview$/);
    expect(JSON.parse(fetcher.mock.calls[1]![1]?.body as string)).toEqual({
      confirmed: true,
      expectedRevision: 7,
      expectedPolicyDigest: review.sourcePolicyDigest,
      reviewDigest: review.reviewDigest,
    });
    await expect(
      client.execute(source, { ...selected, sourceCode: 'foreign' }),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockResolvedValueOnce(
      envelope({ contractVersion: 1, state: 'CLEANED', sourceCode: 'foreign' }),
    );
    await expect(client.execute(source, selected)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(3);
    await expect(client.preview({ ...source, canCleanup: false })).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
