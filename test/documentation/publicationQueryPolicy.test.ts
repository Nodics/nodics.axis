import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import type { DocumentationPublicationStatus } from '../../src/documentation/api/documentationPublicationClient';
import { publicationQueryPolicy } from '../../src/documentation/publicationQueryPolicy';

describe('documentation publication query policy', () => {
  it('shares a recent read across observers but explicit refresh still reads the owner', async () => {
    const client = new QueryClient();
    const queryFn = vi.fn(() =>
      Promise.resolve({ readiness: 'READY' } as DocumentationPublicationStatus),
    );
    const options = {
      ...publicationQueryPolicy,
      queryKey: ['documentation-publication', 'default', 'frameworkdocs'],
      queryFn,
    };
    await client.fetchQuery(options);
    const observers = Array.from(
      { length: 3 },
      () => new QueryObserver(client, options),
    );
    const unsubscribe = observers.map((observer) => observer.subscribe(() => {}));
    try {
      await client.fetchQuery(options);
      expect(queryFn).toHaveBeenCalledTimes(1);
      await observers[0]!.refetch();
      expect(queryFn).toHaveBeenCalledTimes(2);
      await client.invalidateQueries({ queryKey: options.queryKey });
      expect(queryFn).toHaveBeenCalledTimes(3);
    } finally {
      unsubscribe.forEach((stop) => stop());
      client.clear();
    }
  });

  it('polls only pending CMS approvals, never unavailable Media or completed publications', () => {
    expect(publicationQueryPolicy.staleTime).toBe(30_000);
    expect(publicationQueryPolicy.refetchOnWindowFocus).toBe(false);
    for (const readiness of [
      'PUBLICATION_PENDING',
      'MEDIA_DEPENDENCIES_PENDING',
      'READY',
      'FAILED',
    ] as const) {
      expect(
        publicationQueryPolicy.refetchInterval({
          state: { data: { readiness } as DocumentationPublicationStatus },
        }),
      ).toBe(readiness === 'PUBLICATION_PENDING' ? 10_000 : false);
    }
  });
});
