import type { DocumentationPublicationStatus } from './api/documentationPublicationClient';

// Shell, dashboard and article observers share one bounded readiness read.
export const publicationQueryPolicy = {
  staleTime: 30_000,
  refetchOnWindowFocus: false,
  refetchInterval: (query: {
    state: { data?: DocumentationPublicationStatus | undefined };
  }): number | false =>
    query.state.data?.readiness === 'PUBLICATION_PENDING' ? 10_000 : false,
};
