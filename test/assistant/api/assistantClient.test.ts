import { describe, expect, it, vi } from 'vitest';

import { createAssistantClient } from '../../../src/assistant/api/assistantClient';
import { AssistantApiError } from '../../../src/assistant/api/assistantError';

const configuration = {
  moduleBaseUrl: 'https://assistant.example.com/nodics/aiAssistant',
  enterpriseCode: 'default',
  accessToken: 'memory-only-token',
  timeoutMs: 10_000,
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const conversation = {
  conversationCode: 'conversation-1',
  definitionCode: 'axisAssistant',
  state: 'ACTIVE',
  lastSequence: 0,
};

const turn = {
  turnCode: 'turn-1',
  conversationCode: 'conversation-1',
  state: 'ACCEPTED',
  idempotencyKey: 'request-1234',
};

describe('Assistant API client', () => {
  it('creates a conversation through the direct module endpoint', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ data: { conversation } }));
    const client = createAssistantClient(configuration, request);

    await expect(
      client.createConversation({
        definitionCode: 'axisAssistant',
        title: 'Operations',
      }),
    ).resolves.toEqual(conversation);

    const [url, options] = request.mock.calls[0] ?? [];
    expect(url).toBeInstanceOf(URL);
    expect((url as URL).href).toBe(
      'https://assistant.example.com/nodics/aiAssistant/v0/conversations',
    );
    const headers = new Headers(options?.headers);
    expect(headers.get('Authorization')).toBe('Bearer memory-only-token');
    expect(headers.get('x-enterprise-code')).toBe('default');
    expect((url as URL).href).not.toContain('memory-only-token');
  });

  it('submits an idempotent turn and validates the response contract', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ data: { conversation, turn } }));
    const client = createAssistantClient(configuration, request);

    await expect(
      client.submitTurn('conversation-1', {
        message: 'Find enterprise Acme',
        idempotencyKey: 'request-1234',
      }),
    ).resolves.toEqual({ conversation, turn });

    const [, options] = request.mock.calls[0] ?? [];
    expect(new Headers(options?.headers).get('Idempotency-Key')).toBe('request-1234');
    const body = options?.body;
    expect(typeof body).toBe('string');
    if (typeof body !== 'string') throw new Error('Expected JSON request body');
    expect(JSON.parse(body)).toEqual({
      message: 'Find enterprise Acme',
      idempotencyKey: 'request-1234',
    });
  });

  it('loads bounded persisted conversation history', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        data: {
          conversation,
          page: 1,
          limit: 20,
          items: [
            {
              turn: { ...turn, state: 'COMPLETED' },
              messages: [
                { role: 'user', content: 'Question', sequence: 1 },
                { role: 'assistant', content: 'Answer', sequence: 2 },
              ],
            },
          ],
        },
      }),
    );
    const client = createAssistantClient(configuration, request);

    await expect(client.getConversationHistory('conversation-1')).resolves.toEqual(
      expect.objectContaining({
        page: 1,
        items: [
          expect.objectContaining({
            messages: [
              expect.objectContaining({ role: 'user', content: 'Question' }),
              expect.objectContaining({ role: 'assistant', content: 'Answer' }),
            ],
          }),
        ],
      }),
    );
    expect((request.mock.calls[0]?.[0] as URL).pathname).toContain(
      '/conversations/conversation-1/history',
    );
  });

  it('bounds listing and event replay inputs before transport', async () => {
    const request = vi.fn<typeof fetch>();
    const client = createAssistantClient(configuration, request);

    await expect(client.listConversations({ limit: 101 })).rejects.toThrow(
      /conversation limit/,
    );
    await expect(
      client.replayEvents('conversation-1', 'turn-1', 0, 501),
    ).rejects.toThrow(/event limit/);
    expect(request).not.toHaveBeenCalled();
  });

  it('retrieves and rejects only the backend-bound confirmation lifecycle', async () => {
    const confirmation = {
      confirmationCode: 'confirmation-1',
      conversationCode: 'conversation-1',
      operationId: 'profile_createenterprise',
      state: 'REJECTED',
      argumentsDigest: 'a'.repeat(64),
      revision: 1,
      expiresAt: '2099-01-01T00:00:00.000Z',
      impact: { summary: 'Create Acme' },
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ data: { confirmation } }));
    const client = createAssistantClient(configuration, request);

    await expect(
      client.rejectConfirmation('confirmation-1', {
        expectedRevision: 0,
        argumentsDigest: 'a'.repeat(64),
      }),
    ).resolves.toEqual(confirmation);
    const [url, options] = request.mock.calls[0] ?? [];
    expect((url as URL).pathname).toContain('/confirmations/confirmation-1/reject');
    expect(options?.method).toBe('POST');
    const body = options?.body;
    if (typeof body !== 'string') throw new Error('Expected JSON request body');
    expect(JSON.parse(body)).toEqual({
      expectedRevision: 0,
      argumentsDigest: 'a'.repeat(64),
    });
  });

  it('returns stable backend error codes without parsing message text', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      json(
        {
          code: 'ERR_AIA_00007',
          message: 'The confirmation is stale.',
          traceId: 'trace-1',
        },
        409,
      ),
    );
    const client = createAssistantClient(configuration, request);

    await expect(client.getConversation('conversation-1')).rejects.toEqual(
      expect.objectContaining<Partial<AssistantApiError>>({
        code: 'ERR_AIA_00007',
        message: 'The confirmation is stale.',
        status: 409,
        traceId: 'trace-1',
      }),
    );
  });

  it('rejects unsafe endpoints and path identifiers before sending credentials', async () => {
    expect(() =>
      createAssistantClient({
        ...configuration,
        moduleBaseUrl: 'https://user:secret@assistant.example.com',
      }),
    ).toThrow(/endpoint is invalid/);
    const request = vi.fn<typeof fetch>();
    const client = createAssistantClient(configuration, request);
    await expect(client.getConversation('../other')).rejects.toThrow(
      /conversationCode is invalid/,
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('loads and refreshes governed knowledge-source status', async () => {
    const status = {
      enabled: true,
      ingestionEnabled: true,
      lastRefreshAt: '2026-09-02T12:00:00.000Z',
      sources: [
        {
          code: 'nodics-framework-docs',
          repository: 'nodics.ai',
          sourceType: 'FRAMEWORK_DOCUMENTATION',
          classification: 'INTERNAL',
          version: 'local',
          refreshPolicy: 'ON_START',
          state: 'INDEXED',
          filesRead: 2,
          filesAccepted: 2,
          filesRejected: 0,
          chunksProjected: 5,
        },
      ],
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ data: status }))
      .mockResolvedValueOnce(json({ data: { sourceCode: 'nodics-framework-docs' } }))
      .mockResolvedValueOnce(json({ data: status }));
    const client = createAssistantClient(configuration, request);

    await expect(client.getKnowledgeStatus?.()).resolves.toEqual(status);
    await expect(
      client.refreshKnowledgeSource?.('nodics-framework-docs'),
    ).resolves.toEqual(status);
    expect((request.mock.calls[1]?.[0] as URL).pathname).toContain(
      '/knowledge/sources/nodics-framework-docs/refresh',
    );
    expect(request.mock.calls[1]?.[1]?.method).toBe('POST');
  });
});
