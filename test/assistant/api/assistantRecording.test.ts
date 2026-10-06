/** @file Recording-off transport rejects missing, foreign, oversized and unordered temporary delivery. */
import { describe, expect, it } from 'vitest';
import { createAssistantClient } from '../../../src/assistant/api/assistantClient';

const conversation = {
  conversationCode: 'conversation',
  definitionCode: 'axisAssistant',
  state: 'ACTIVE',
  lastSequence: 2,
};
const turn = {
  turnCode: 'turn',
  conversationCode: 'conversation',
  state: 'COMPLETED',
  recording: { enabled: false, version: '2', notice: 'Content not recorded' },
};
const event = {
  contractVersion: 1,
  eventCode: 'event',
  conversationCode: 'conversation',
  turnCode: 'turn',
  eventType: 'COMPLETED',
  sequence: 1,
  createdAt: '2026-10-03T00:00:00Z',
  data: {},
};
/** Supplies one bounded API response without browser storage. */
function submit(delivery: unknown) {
  return createAssistantClient(
    {
      accessToken: 'token',
      enterpriseCode: 'enterprise',
      moduleBaseUrl: 'https://example.test/copilotApi',
      timeoutMs: 1000,
    },
    () =>
      Promise.resolve(
        new Response(
          JSON.stringify({ code: 'SUC_TEST', data: { conversation, turn, delivery } }),
        ),
      ),
  ).submitTurn('conversation', { message: 'question', idempotencyKey: 'one' });
}
describe('request-only delivery', () => {
  it('accepts only the current turn and never fabricates replay', async () => {
    const result = await submit({ mode: 'REQUEST_ONLY', events: [event] });
    expect(result.delivery).toHaveLength(1);
    expect(result.turn.recording?.enabled).toBe(false);
  });
  it('rejects invalid temporary delivery contracts', async () => {
    for (const delivery of [
      undefined,
      { mode: 'DURABLE', events: [] },
      { mode: 'REQUEST_ONLY', events: [{ ...event, turnCode: 'foreign' }] },
      { mode: 'REQUEST_ONLY', events: [{ ...event, sequence: 2 }] },
      { mode: 'REQUEST_ONLY', events: Array(501).fill(event) },
    ])
      await expect(submit(delivery)).rejects.toThrow();
  });
});
