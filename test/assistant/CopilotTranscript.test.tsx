/** @file Audited inspection contract, offline policy and component-local sensitive state tests. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { createAxisQueryClient } from '../../src/app/axisQueryClient';
import { CopilotTranscriptDialog } from '../../src/assistant/CopilotTranscriptDialog';
import {
  parseTranscript,
  parseTranscriptInspection,
} from '../../src/assistant/api/copilotTranscriptClient';
import {
  copilotTranscriptFixture,
  transcriptInspectionFixture,
} from './copilotTranscriptFixture';
const configuration = {
  accessToken: 'token',
  enterpriseCode: 'enterprise',
  moduleBaseUrl: 'http://localhost:4300/copilotApi',
  timeoutMs: 1000,
};
afterEach(() => {
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
});

/** Uses the production command policy; synthetic content never enters query cache. */
function mount(
  fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ code: 'SUC_TEST', data: copilotTranscriptFixture() }),
        ),
      ),
    ),
) {
  vi.stubGlobal('fetch', fetcher);
  const client = createAxisQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <CopilotTranscriptDialog
        configuration={configuration}
        conversationCode="conversation-1"
        principalCode="employee-one"
        inspection={transcriptInspectionFixture}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return { fetcher, client, view };
}
/** Selects the required declared purpose through the accessible select. */
async function selectPurpose() {
  await userEvent.click(screen.getByRole('combobox', { name: 'Inspection purpose' }));
  await userEvent.click(screen.getByRole('option', { name: 'Quality review' }));
}

it('does not fetch on opening and requires an explicit purpose and inspect command', async () => {
  const f = mount();
  expect(f.fetcher).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Inspect' })).toBeDisabled();
  await selectPurpose();
  await userEvent.click(screen.getByRole('button', { name: 'Inspect' }));
  await screen.findByText('Which knowledge groups are available for this enterprise?');
  expect(screen.getByText('Content not recorded')).toBeInTheDocument();
  expect(f.fetcher).toHaveBeenCalledOnce();
  expect(f.fetcher.mock.calls[0]![1]?.body).toBe(
    JSON.stringify({ purpose: 'QUALITY_REVIEW', page: 1 }),
  );
  expect(
    JSON.stringify(
      f.client
        .getMutationCache()
        .getAll()
        .map((mutation) => mutation.state),
    ),
  ).not.toContain('Which knowledge');
  f.view.unmount();
  expect(
    screen.queryByText('Which knowledge groups are available for this enterprise?'),
  ).toBeNull();
});

it('fails offline without queueing or reconnect replay', async () => {
  const f = mount();
  await selectPurpose();
  onlineManager.setOnline(false);
  await userEvent.click(screen.getByRole('button', { name: 'Inspect' }));
  await screen.findByText(transcriptInspectionFixture.presentation.failure);
  onlineManager.setOnline(true);
  await waitFor(() => expect(f.fetcher).not.toHaveBeenCalled());
});

it('rejects wrong context, never renders tool content and requires recording evidence', () => {
  const value = copilotTranscriptFixture();
  expect(() =>
    parseTranscript({
      ...value,
      items: [
        {
          turnCode: 't',
          recorded: false,
          messages: [{ role: 'user', sequence: 1, content: 'hidden' }],
        },
      ],
    }),
  ).toThrow();
  expect(() =>
    parseTranscript({
      ...value,
      items: [
        {
          turnCode: 't',
          recorded: true,
          messages: [{ role: 'tool', sequence: 1, content: 'hidden' }],
        },
      ],
    }),
  ).toThrow();
  expect(() =>
    parseTranscript({ ...value, items: Array(26).fill(value.items[0]) }),
  ).toThrow();
  expect(parseTranscriptInspection(null)).toBeNull();
  expect(() =>
    parseTranscriptInspection({
      ...transcriptInspectionFixture,
      purposes: [{ code: '../execute', label: 'Unsafe' }],
    }),
  ).toThrow();
  expect(parseTranscript({ ...value, secret: 'hidden' })).not.toHaveProperty('secret');
});

it('foreign enterprise response fails without displaying content', async () => {
  mount(
    vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            code: 'SUC_TEST',
            data: {
              ...copilotTranscriptFixture(),
              context: { tenantCode: 'tenant', enterpriseCode: 'other' },
            },
          }),
        ),
      ),
    ),
  );
  await selectPurpose();
  await userEvent.click(screen.getByRole('button', { name: 'Inspect' }));
  await screen.findByText(transcriptInspectionFixture.presentation.failure);
  expect(
    screen.queryByText('Which knowledge groups are available for this enterprise?'),
  ).toBeNull();
});

it('closing a pending inspector aborts transport and discards late content', async () => {
  let signal: AbortSignal | null | undefined;
  const f = mount(
    vi.fn<typeof fetch>().mockImplementation(async (_url, options) => {
      signal = options?.signal;
      return new Promise(() => {});
    }),
  );
  await selectPurpose();
  await userEvent.click(screen.getByRole('button', { name: 'Inspect' }));
  await waitFor(() => expect(f.fetcher).toHaveBeenCalledOnce());
  f.view.unmount();
  expect(signal?.aborted).toBe(true);
});
