/** @file Verifies reviewed retirement, retained-data semantics and no replay after uncertainty. */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { KnowledgeMigrationPanel } from '../../src/assistant/KnowledgeMigrationPanel';
import {
  createKnowledgeMigrationClient,
  parseKnowledgeMigration,
  parseMigrationResult,
} from '../../src/assistant/api/knowledgeMigrationClient';

const copy = {
  eraseReview: 'Review permanent removal',
  eraseConfirm: 'Permanently remove legacy index',
  eraseInspect: 'Inspect original removal',
  eraseImpact: 'Irreversible removal after verified replacement and writer revocation.',
  eraseDone: 'Original removal acknowledged.',
  eraseUnknown: 'Removal unconfirmed; inspect only.',
  title: 'Legacy knowledge indexes',
  review: 'Review replacement',
  confirm: 'Retire legacy writes',
  inspect: 'Inspect original retirement',
  cancel: 'Cancel',
  sources: 'Verified sources',
  impact: 'Blocks legacy writes. Data is retained.',
  done: 'Retired; legacy data retained.',
  unknown: 'Unconfirmed; do not repeat.',
  unavailable: 'Evidence unavailable.',
  notStarted: 'No receipt; this does not authorize retry.',
};
const plan = {
  code: 'migration-one',
  label: 'Framework knowledge migration',
  canExecute: true,
};
const review = {
  planCode: plan.code,
  state: 'REVIEWED' as const,
  reviewDigest: 'a'.repeat(64),
  sourceCount: 3,
};
const envelope = (data: unknown) =>
  new Response(JSON.stringify({ code: 'SUC_SYS_00000', data }));
describe('Legacy index retirement', () => {
  it.each([false, true])(
    'preserves keyboard focus through review, cancel and uncertain dispatch (erasure=%s)',
    async (erasure) => {
      const client = {
        preview: vi.fn().mockResolvedValue(review),
        previewErasure: vi.fn().mockResolvedValue(review),
        execute: vi.fn().mockRejectedValue(new Error('lost response')),
        erase: vi.fn().mockRejectedValue(new Error('lost response')),
        inspect: vi.fn(),
        inspectErasure: vi.fn(),
      };
      const user = userEvent.setup();
      render(
        <KnowledgeMigrationPanel
          erasure={erasure}
          plan={{ ...plan, canErase: true }}
          copy={copy}
          client={client}
        />,
      );
      await user.click(
        screen.getByRole('button', { name: erasure ? copy.eraseReview : copy.review }),
      );
      expect(
        screen.getByRole('button', {
          name: erasure ? copy.eraseConfirm : copy.confirm,
        }),
      ).toHaveFocus();
      await user.click(screen.getByRole('button', { name: copy.cancel }));
      expect(
        screen.getByRole('button', { name: erasure ? copy.eraseReview : copy.review }),
      ).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(
        screen.getByRole('button', {
          name: erasure ? copy.eraseConfirm : copy.confirm,
        }),
      ).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(await screen.findByRole('status')).toHaveTextContent(
        erasure ? copy.eraseUnknown : copy.unknown,
      );
      expect(
        screen.getByRole('button', {
          name: erasure ? copy.eraseInspect : copy.inspect,
        }),
      ).toHaveFocus();
    },
  );
  it('does not steal focus from another control while a review is pending', async () => {
    let resolve!: (value: typeof review) => void;
    const client = {
      preview: vi.fn().mockImplementation(
        () =>
          new Promise<typeof review>((r) => {
            resolve = r;
          }),
      ),
      execute: vi.fn(),
      inspect: vi.fn(),
      previewErasure: vi.fn(),
      erase: vi.fn(),
      inspectErasure: vi.fn(),
    };
    const user = userEvent.setup();
    render(
      <>
        <KnowledgeMigrationPanel plan={plan} copy={copy} client={client} />
        <button>Other task</button>
      </>,
    );
    await user.click(screen.getByRole('button', { name: copy.review }));
    await user.click(screen.getByRole('button', { name: 'Other task' }));
    await act(() => {
      resolve(review);
      return Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Other task' })).toHaveFocus();
  });
  it('uses separate erasure routes and grants while preserving read-only inspection', async () => {
    const erased = {
      contractVersion: 1,
      planCode: plan.code,
      state: 'ERASED',
      physicalCleanupComplete: true,
      retainedLegacyData: false,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        envelope({
          ...review,
          contractVersion: 1,
          physicalCleanupComplete: false,
          retainedLegacyData: true,
        }),
      )
      .mockResolvedValueOnce(envelope(erased))
      .mockResolvedValueOnce(envelope(erased));
    const client = createKnowledgeMigrationClient(
      {
        moduleBaseUrl: 'http://localhost:4300/copilotApi',
        accessToken: 'token',
        enterpriseCode: 'enterprise',
        timeoutMs: 1000,
      },
      fetcher,
    );
    await expect(client.previewErasure(plan)).rejects.toThrow('Migration unavailable');
    await expect(client.erase(plan, review)).rejects.toThrow('Migration unavailable');
    expect(fetcher).not.toHaveBeenCalled();
    const enabled = { ...plan, canErase: true };
    const selected = await client.previewErasure(enabled);
    await client.erase(enabled, selected);
    await client.inspectErasure({ ...plan, canExecute: false, canErase: false });
    expect(fetcher.mock.calls.map(([url]) => (url as URL).pathname)).toEqual([
      '/copilotApi/v0/knowledge/migrations/migration-one/erasure-preview',
      '/copilotApi/v0/knowledge/migrations/migration-one/erase',
      '/copilotApi/v0/knowledge/migrations/migration-one/erasure-inspect',
    ]);
    expect(
      fetcher.mock.calls.map(
        ([, options]) => JSON.parse(options?.body as string) as unknown,
      ),
    ).toEqual([{}, { confirmed: true, reviewDigest: review.reviewDigest }, {}]);
  });
  it('does not retry an erasure transport failure', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('Connection lost'));
    const client = createKnowledgeMigrationClient(
      {
        moduleBaseUrl: 'http://localhost:4300/copilotApi',
        accessToken: 'token',
        enterpriseCode: 'enterprise',
        timeoutMs: 1000,
      },
      fetcher,
    );
    await expect(client.erase({ ...plan, canErase: true }, review)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each(['ERASED', 'OUTCOME_UNKNOWN'])(
    'separates irreversible erasure and prevents replay after %s',
    async (state) => {
      const client = {
        preview: vi.fn(),
        execute: vi.fn(),
        inspect: vi.fn(),
        previewErasure: vi.fn().mockResolvedValue(review),
        erase:
          state === 'ERASED'
            ? vi.fn().mockResolvedValue({ planCode: plan.code, state })
            : vi.fn().mockRejectedValue(new Error('unknown')),
        inspectErasure: vi
          .fn()
          .mockResolvedValue({ planCode: plan.code, state: 'OUTCOME_UNKNOWN' }),
      };
      render(
        <KnowledgeMigrationPanel
          erasure
          plan={{ ...plan, canErase: true }}
          copy={copy}
          client={client}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: copy.eraseReview }));
      expect(await screen.findByText(copy.eraseImpact)).toBeVisible();
      await userEvent.dblClick(screen.getByRole('button', { name: copy.eraseConfirm }));
      expect(await screen.findByRole('status')).toHaveTextContent(
        state === 'ERASED' ? copy.eraseDone : copy.eraseUnknown,
      );
      expect(client.erase).toHaveBeenCalledOnce();
      expect(client.execute).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', { name: copy.eraseInspect }));
      expect(await screen.findByRole('status')).toHaveTextContent(copy.eraseUnknown);
      expect(screen.queryByRole('button', { name: copy.eraseReview })).toBeNull();
      expect(screen.queryByRole('button', { name: copy.eraseConfirm })).toBeNull();
    },
  );
  it('accepts erasure only on its separate surface with consistent evidence', () => {
    const erased = {
      contractVersion: 1,
      planCode: plan.code,
      state: 'ERASED',
      physicalCleanupComplete: true,
      retainedLegacyData: false,
    };
    expect(parseMigrationResult(erased, plan, true).state).toBe('ERASED');
    expect(() => parseMigrationResult(erased, plan)).toThrow();
    expect(() =>
      parseMigrationResult({ ...erased, retainedLegacyData: true }, plan, true),
    ).toThrow();
    expect(() =>
      parseMigrationResult({ ...erased, physicalCleanupComplete: false }, plan, true),
    ).toThrow();
  });
  it.each(['RETIRED', 'OUTCOME_UNKNOWN'])(
    'requires review and never exposes another command after %s',
    async (state) => {
      const client = {
        previewErasure: vi.fn(),
        erase: vi.fn(),
        inspectErasure: vi.fn(),
        preview: vi.fn().mockResolvedValue(review),
        execute:
          state === 'RETIRED'
            ? vi.fn().mockResolvedValue({ planCode: plan.code, state })
            : vi.fn().mockRejectedValue(new Error('private index')),
        inspect: vi
          .fn()
          .mockResolvedValue({ planCode: plan.code, state: 'NOT_STARTED' }),
      };
      render(<KnowledgeMigrationPanel plan={plan} copy={copy} client={client} />);
      expect(client.execute).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', { name: copy.review }));
      expect(await screen.findByText(copy.impact)).toBeVisible();
      await userEvent.dblClick(screen.getByRole('button', { name: copy.confirm }));
      expect(await screen.findByRole('status')).toHaveTextContent(
        state === 'RETIRED' ? copy.done : copy.unknown,
      );
      expect(client.execute).toHaveBeenCalledOnce();
      expect(screen.queryByRole('button', { name: copy.confirm })).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: copy.inspect }));
      expect(await screen.findByRole('status')).toHaveTextContent(copy.notStarted);
      expect(screen.queryByRole('button', { name: copy.review })).toBeNull();
    },
  );
  it('offers inspection only without mutation admission and suppresses offline requests', async () => {
    const client = {
      preview: vi.fn(),
      execute: vi.fn(),
      inspect: vi.fn(),
      previewErasure: vi.fn(),
      erase: vi.fn(),
      inspectErasure: vi.fn(),
    };
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(
      <KnowledgeMigrationPanel
        plan={{ ...plan, canExecute: false }}
        copy={copy}
        client={client}
      />,
    );
    expect(screen.queryByRole('button', { name: copy.review })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: copy.inspect }));
    expect(client.inspect).not.toHaveBeenCalled();
    online.mockRestore();
  });
  it('rejects foreign, contradictory and invalid owner evidence and sends only fixed review fields', async () => {
    expect(
      parseKnowledgeMigration({ plans: [plan], presentation: copy }).plans,
    ).toEqual([plan]);
    expect(() =>
      parseKnowledgeMigration({ plans: [plan, plan], presentation: copy }),
    ).toThrow();
    const result = {
      ...review,
      contractVersion: 1,
      retainedLegacyData: true,
      physicalCleanupComplete: false,
    };
    expect(() =>
      parseMigrationResult({ ...result, planCode: 'foreign' }, plan),
    ).toThrow();
    expect(() =>
      parseMigrationResult({ ...result, physicalCleanupComplete: true }, plan),
    ).toThrow();
    expect(() => parseMigrationResult({ ...result, sourceCount: 101 }, plan)).toThrow();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(envelope(result))
      .mockResolvedValueOnce(envelope({ ...result, state: 'RETIRED' }));
    const client = createKnowledgeMigrationClient(
      {
        moduleBaseUrl: 'http://localhost:4300/copilotApi',
        accessToken: 'token',
        enterpriseCode: 'enterprise',
        timeoutMs: 1000,
      },
      fetcher,
    );
    const selected = await client.preview(plan);
    await client.execute(plan, selected);
    expect((fetcher.mock.calls[1]![0] as URL).pathname).toMatch(
      /knowledge\/migrations\/migration-one\/retire$/,
    );
    expect(JSON.parse(fetcher.mock.calls[1]![1]?.body as string)).toEqual({
      confirmed: true,
      reviewDigest: review.reviewDigest,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
