/** @file Guards source window, preview revision and canonical endpoint contracts. */
import { describe, expect, it, vi } from 'vitest';
import {
  createKnowledgeStudioClient,
  parseKnowledgeInventory,
  parseKnowledgePreview,
} from '../../../src/assistant/api/knowledgeStudioClient';
import { knowledgeStudioFixture } from '../knowledgeStudioFixture';

describe('Knowledge Studio contracts', () => {
  it('requests explicit pages and rejects mismatched page evidence', async () => {
    const fixture = knowledgeStudioFixture();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ code: 'SUC_SYS_00000', data: { ...fixture, page: 2 } }),
          ),
        ),
      );
    const client = createKnowledgeStudioClient(
      {
        moduleBaseUrl: 'http://localhost:4300/copilotApi',
        enterpriseCode: 'enterprise',
        accessToken: 'token',
        timeoutMs: 1000,
      },
      fetcher,
    );
    expect((await client.inventory(undefined, 2)).page).toBe(2);
    expect((fetcher.mock.calls[0]![0] as URL).search).toBe('?page=2');
    await expect(client.inventory(undefined, 3)).rejects.toThrow();
    await expect(client.inventory(undefined, 0)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(() => parseKnowledgeInventory({ ...fixture, page: -1 })).toThrow();
  });
  it('drops private fields and rejects malformed source windows', () => {
    const fixture = knowledgeStudioFixture();
    const result = parseKnowledgeInventory({
      ...fixture,
      repositoryRoots: { root: '/secret' },
    });
    expect(JSON.stringify(result)).not.toContain('/secret');
    expect(() => parseKnowledgeInventory({ ...fixture, limit: 0 })).toThrow();
    expect(() => parseKnowledgeInventory({ ...fixture, hasMore: 'false' })).toThrow();
    fixture.sources[0]!.secretScanRequired = false;
    expect(() => parseKnowledgeInventory(fixture)).toThrow();
  });
  it('binds previews to the inspected revision and validates count consistency', () => {
    const source = parseKnowledgeInventory(knowledgeStudioFixture()).sources[0]!;
    const report = {
      sourceCode: source.code,
      sourceVersion: source.version,
      state: 'PREPARED',
      filesRead: 2,
      filesAccepted: 1,
      filesRejected: 1,
      chunksPrepared: 3,
    };
    expect(parseKnowledgePreview(report, source).chunksPrepared).toBe(3);
    expect(() =>
      parseKnowledgePreview({ ...report, sourceVersion: 'changed' }, source),
    ).toThrow();
    expect(() => parseKnowledgePreview({ ...report, filesRead: 0 }, source)).toThrow();
  });
  it('uses only source inventory and preview endpoints and rejects mismatched enterprise', async () => {
    const fixture = knowledgeStudioFixture();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'SUC_SYS_00000', data: fixture })),
      );
    const client = createKnowledgeStudioClient(
      {
        moduleBaseUrl: 'http://localhost:4300/copilotApi',
        enterpriseCode: 'enterprise',
        accessToken: 'token',
        timeoutMs: 1000,
      },
      fetcher,
    );
    const inventory = await client.inventory();
    const source = inventory.sources[0]!;
    fetcher.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'SUC_SYS_00000',
          data: {
            sourceCode: source.code,
            sourceVersion: source.version,
            state: 'PREPARED',
            filesRead: 0,
            filesAccepted: 0,
            filesRejected: 0,
            chunksPrepared: 0,
          },
        }),
      ),
    );
    await client.preview(source);
    expect((fetcher.mock.calls[1]![0] as URL).pathname).toBe(
      '/copilotApi/v0/knowledge/sources/framework-readmes/preview',
    );
    expect(fetcher.mock.calls[1]![1]?.method).toBe('POST');
    fixture.context.enterpriseCode = 'other';
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'SUC_SYS_00000', data: fixture })),
    );
    await expect(client.inventory()).rejects.toThrow(/context mismatch/);
  });
});
