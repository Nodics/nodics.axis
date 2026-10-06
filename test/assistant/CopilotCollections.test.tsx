/** @file Live collection contract, explicit-query and sensitive-result lifetime coverage. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { createCopilotCollectionsClient } from '../../src/assistant/api/copilotCollectionsClient';
import { parseKnowledgeInventory } from '../../src/assistant/api/knowledgeStudioClient';
import { CopilotCollectionsPanel } from '../../src/assistant/CopilotCollectionsPanel';
import { knowledgeStudioFixture } from './knowledgeStudioFixture';

const configuration = {
  accessToken: 'token',
  enterpriseCode: 'enterprise',
  moduleBaseUrl: 'http://localhost:4300/copilotApi',
  timeoutMs: 1000,
};
const fixture = knowledgeStudioFixture();
const inventory = parseKnowledgeInventory({
  ...fixture,
  sources: [
    {
      ...fixture.sources[0],
      sourceType: 'DATABASE',
      canQuery: true,
      sourcePolicyDigest: 'a'.repeat(64),
    },
  ],
});
const source = inventory.sources[0]!;
const collections = [
  { schemaName: 'product', label: 'Products', selected: true },
  { schemaName: 'user', label: 'Users', selected: false },
];
const envelope = {
  contractVersion: 1,
  sourceCode: source.code,
  sourcePolicyDigest: source.sourcePolicyDigest,
};
afterEach(() => vi.unstubAllGlobals());

it('binds collection metadata and live results to the exact source policy', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'SUC_TEST', data: { ...envelope, items: collections } }),
      ),
    );
  const client = createCopilotCollectionsClient(configuration, fetcher);
  expect(await client.inventory(source)).toEqual(collections);
  fetcher.mockResolvedValue(
    new Response(
      JSON.stringify({
        code: 'SUC_TEST',
        data: { ...envelope, sourcePolicyDigest: 'b'.repeat(64), items: collections },
      }),
    ),
  );
  await expect(client.inventory(source)).rejects.toThrow('changed');
  fetcher.mockResolvedValue(
    new Response(
      JSON.stringify({
        code: 'SUC_TEST',
        data: {
          ...envelope,
          schemaName: 'product',
          page: 1,
          limit: 25,
          mayHaveMore: false,
          observedAt: '2026-10-03T00:00:00Z',
          records: [{ code: 'product-one', nested: { secret: true } }],
        },
      }),
    ),
  );
  await expect(client.query(source, 'product', 'one', 1)).rejects.toThrow('fields');
});

it('rejects offline and undeclared queries without transport or retry', async () => {
  const fetcher = vi.fn<typeof fetch>();
  const client = createCopilotCollectionsClient(configuration, fetcher);
  await expect(client.inventory({ ...source, canQuery: false })).rejects.toThrow();
  vi.stubGlobal('navigator', { onLine: false });
  await expect(client.query(source, 'product', 'one', 1)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});

it('loads choices explicitly, disables exclusions and clears plain-text results after edits', async () => {
  const actions = {
    load: vi.fn().mockResolvedValue(collections),
    query: vi.fn().mockResolvedValue({
      records: [{ code: '<script>inert</script>' }],
      observedAt: '2026-10-03T00:00:00Z',
      page: 1,
      mayHaveMore: false,
    }),
  };
  const view = render(
    <CopilotCollectionsPanel actions={actions} copy={inventory.presentation} />,
  );
  expect(actions.load).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'loadCollections' }));
  await userEvent.click(await screen.findByRole('combobox', { name: 'collections' }));
  expect(screen.getByRole('option', { name: 'Users (notSelected)' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await userEvent.click(screen.getByRole('option', { name: 'Products' }));
  await userEvent.type(
    screen.getByRole('textbox', { name: 'collectionSearch' }),
    'one',
  );
  await userEvent.click(screen.getByRole('button', { name: 'queryRecords' }));
  await screen.findByText('<script>inert</script>');
  expect(actions.query).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector('script')).toBeNull();
  await userEvent.type(screen.getByRole('textbox', { name: 'collectionSearch' }), 'x');
  expect(screen.queryByText('<script>inert</script>')).toBeNull();
});
