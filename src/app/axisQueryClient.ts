/**
 * Browser query policy: reads may recover, but commands must never queue offline.
 * Backend owners retain authorization, idempotency and business validation.
 */
import { MutationCache, onlineManager, QueryClient } from '@tanstack/react-query';

/** Creates the shared client without replaying writes after connectivity returns. */
export function createAxisQueryClient() {
  return new QueryClient({
    mutationCache: new MutationCache({
      onMutate: (_variables, mutation) => {
        if (
          mutation.options.networkMode !== 'always' ||
          (mutation.options.retry !== false && mutation.options.retry !== 0) ||
          mutation.options.scope !== undefined
        ) {
          throw new Error('This action has an unsupported command queue policy.');
        }
        if (
          !onlineManager.isOnline() ||
          (typeof navigator !== 'undefined' && navigator.onLine === false)
        ) {
          throw new Error(
            'Axis is offline. This action was not sent. Reconnect before trying again.',
          );
        }
      },
    }),
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000 },
      // A connection lost after admission must fail, not wait for reconnection.
      mutations: { retry: false, networkMode: 'always' },
    },
  });
}
