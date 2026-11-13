import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
} from './publicBootstrap';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import {
  loadCurrentEnterpriseDisplay,
  type CurrentEnterpriseDisplay,
} from './currentEnterpriseDisplay';

/** Display-only current-owner observation. Old, locked and changed scopes cannot display late private names. */
export function useCurrentEnterpriseDisplay({
  bootstrap,
  runtime,
  accessToken,
  generation,
  active,
}: {
  readonly bootstrap: AxisAuthenticatedBootstrap | undefined;
  readonly runtime: AxisRuntimeConfig;
  readonly accessToken: string | undefined;
  readonly generation: number | undefined;
  readonly active: boolean;
}): CurrentEnterpriseDisplay | undefined {
  const queryClient = useQueryClient();
  const profile = bootstrap && selectModuleConnection(bootstrap, 'profile');
  const actor = useMemo(
    () => (accessToken && generation ? crypto.randomUUID() : 'anonymous'),
    [accessToken, generation],
  );
  const endpoint = profile?.endpoint;
  const instance = profile?.instanceId;
  const tenant = bootstrap?.tenantCode;
  const enterprise = runtime.enterpriseCode;
  const key = useMemo(
    () => ['current-enterprise-display', actor, tenant, enterprise, endpoint, instance],
    [actor, tenant, enterprise, endpoint, instance],
  );
  useEffect(() => {
    if (!active) void queryClient.cancelQueries({ queryKey: key, exact: true });
    return () => {
      void queryClient.cancelQueries({ queryKey: key, exact: true });
    };
  }, [active, key, queryClient]);
  const query = useQuery({
    queryKey: key,
    enabled: active && Boolean(bootstrap && accessToken && endpoint && generation),
    queryFn: ({ signal }) => {
      if (!bootstrap || !accessToken || !generation)
        throw new Error('Current enterprise display is unavailable.');
      return loadCurrentEnterpriseDisplay(
        {
          bootstrap,
          accessToken,
          enterpriseCode: enterprise,
          timeoutMs: runtime.requestTimeoutMs,
          sessionGeneration: generation,
        },
        signal,
      );
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return active && query.isSuccess && !query.isFetching ? query.data : undefined;
}
