/** @file Proves Workspace projection validation and canonical GET-only transport. */
import { describe, expect, it, vi } from 'vitest';
import {
  createCopilotWorkspaceClient,
  parseCopilotWorkspace,
} from '../../../src/assistant/api/copilotWorkspaceClient';
import { workspaceFixture } from '../workspaceFixture';

describe('Copilot workspace contract', () => {
  it('drops undeclared private configuration and retains bounded metadata', () => {
    const result = parseCopilotWorkspace({
      ...workspaceFixture(),
      secrets: 'must-not-retain',
      messages: ['private'],
    });
    expect(result.activity.conversations).toHaveLength(1);
    expect(JSON.stringify(result)).not.toMatch(/must-not-retain|private/);
  });
  it('rejects unsupported accounting and missing presentation', () => {
    expect(() =>
      parseCopilotWorkspace({
        ...workspaceFixture(),
        budget: { state: 'UNAVAILABLE', available: 0 },
      }),
    ).toThrow();
    expect(() =>
      parseCopilotWorkspace({ ...workspaceFixture(), presentation: {} }),
    ).toThrow();
    expect(() =>
      parseCopilotWorkspace({ ...workspaceFixture(), scope: 'ENTERPRISE' }),
    ).toThrow();
  });
  it('rejects oversized activity windows', () => {
    const input = workspaceFixture();
    input.activity.limit = 1;
    input.activity.conversations.push({ ...input.activity.conversations[0]! });
    expect(() => parseCopilotWorkspace(input)).toThrow();
  });
  it('rejects invalid dates and undeclared source window state', () => {
    const input = workspaceFixture();
    input.observedAt = 'invalid';
    expect(() => parseCopilotWorkspace(input)).toThrow(/timestamp/);
    const valid = workspaceFixture();
    expect(() =>
      parseCopilotWorkspace({
        ...valid,
        knowledge: { ...valid.knowledge, hasMore: 'false' },
      }),
    ).toThrow(/flag/);
  });
  it('calls only the canonical read endpoint with current enterprise context', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ code: 'SUC_SYS_00000', data: workspaceFixture() }),
        ),
      );
    const client = createCopilotWorkspaceClient(
      {
        moduleBaseUrl: 'http://localhost:4300/copilotApi',
        enterpriseCode: 'enterprise',
        accessToken: 'test-token',
        timeoutMs: 1000,
      },
      fetcher,
    );
    await client.get();
    expect((fetcher.mock.calls[0]?.[0] as URL).href).toBe(
      'http://localhost:4300/copilotApi/v0/workspace',
    );
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET');
    expect(
      new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('x-enterprise-code'),
    ).toBe('enterprise');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
