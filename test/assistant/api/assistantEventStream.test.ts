import { describe, expect, it, vi } from 'vitest';

import { streamAssistantTurn } from '../../../src/assistant/api/assistantEventStream';
import type { AssistantTurnEvent } from '../../../src/assistant/api/assistantContracts';

const configuration = {
  moduleBaseUrl: 'https://assistant.example.com/nodics/aiAssistant',
  enterpriseCode: 'default',
  accessToken: 'memory-only-token',
  timeoutMs: 10_000,
  maximumEventBytes: 4096,
  reconnectWindowMs: 10_000,
  idleTimeoutMs: 30_000,
  reconnectDelayMs: 0,
};

function event(sequence: number, eventType: string): string {
  return [
    `id: turn-1-${sequence}`,
    `event: ${eventType.toLowerCase()}`,
    `data: ${JSON.stringify({
      contractVersion: 1,
      conversationId: 'conversation-1',
      turnId: 'turn-1',
      eventId: `turn-1-${sequence}`,
      eventType,
      sequence,
      createdAt: '2026-07-25T00:00:00.000Z',
      data: {},
    })}`,
    '',
    '',
  ].join('\n');
}

function streamResponse(chunks: readonly string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } },
  );
}

describe('Assistant event stream', () => {
  it('authenticates, validates, and delivers ordered events through terminal state', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        streamResponse([event(1, 'TURN_ACCEPTED'), event(2, 'COMPLETED')]),
      );
    const received: AssistantTurnEvent[] = [];

    await streamAssistantTurn(
      configuration,
      {
        conversationCode: 'conversation-1',
        turnCode: 'turn-1',
        onEvent: (value) => received.push(value),
      },
      request,
    );

    expect(received.map(({ eventType }) => eventType)).toEqual([
      'TURN_ACCEPTED',
      'COMPLETED',
    ]);
    const [url, options] = request.mock.calls[0] ?? [];
    expect((url as URL).pathname).toBe(
      '/nodics/aiAssistant/v0/conversations/conversation-1/turns/turn-1/stream',
    );
    const headers = new Headers(options?.headers);
    expect(headers.get('Authorization')).toBe('Bearer memory-only-token');
    expect(headers.get('Accept')).toBe('text/event-stream');
  });

  it('resumes after a transient disconnect without delivering duplicates', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(streamResponse([event(1, 'TURN_ACCEPTED')]))
      .mockResolvedValueOnce(
        streamResponse([event(1, 'TURN_ACCEPTED'), event(2, 'COMPLETED')]),
      );
    const sequences: number[] = [];
    const reconnect = vi.fn();

    await streamAssistantTurn(
      configuration,
      {
        conversationCode: 'conversation-1',
        turnCode: 'turn-1',
        onEvent: (value) => sequences.push(value.sequence),
        onReconnect: reconnect,
      },
      request,
    );

    expect(sequences).toEqual([1, 2]);
    expect(reconnect).toHaveBeenCalledWith(1, 1);
    const [url, options] = request.mock.calls[1] ?? [];
    expect((url as URL).searchParams.get('afterSequence')).toBe('1');
    expect(new Headers(options?.headers).get('Last-Event-ID')).toBe('turn-1-1');
  });

  it('rejects cross-turn and out-of-sequence events', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(streamResponse([event(2, 'COMPLETED')]));

    await expect(
      streamAssistantTurn(
        configuration,
        {
          conversationCode: 'conversation-1',
          turnCode: 'turn-1',
          onEvent: vi.fn(),
        },
        request,
      ),
    ).rejects.toThrow(/not contiguous/);
  });
});
