import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  loadOperationalReadiness,
  type AxisAuthenticatedBootstrap,
} from './publicBootstrap';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';

/** Observes only an explicitly opened diagnostic view. Callers supply their opaque actor/tenant/owner scope; report absence and fetching never certify readiness. */
export function useOperationalReadinessObservation({
  bootstrap,
  runtime,
  accessToken,
  scope,
  active = true,
  retainObservation = false,
}: {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
  readonly accessToken: string;
  readonly scope: string;
  readonly active?: boolean;
  readonly retainObservation?: boolean;
}) {
  const onDemand = bootstrap.operationalReadinessObservation?.mode === 'ON_DEMAND';
  const queryClient = useQueryClient();
  const ownerScope = JSON.stringify([
    scope,
    runtime.backofficeBaseUrl,
    runtime.clientContractVersion,
  ]);
  useEffect(() => {
    if (!active || !onDemand)
      void queryClient.cancelQueries({
        queryKey: ['axis-operational-readiness', ownerScope],
        exact: true,
      });
  }, [active, onDemand, ownerScope, queryClient]);
  const query = useQuery({
    queryKey: ['axis-operational-readiness', ownerScope],
    enabled:
      active && onDemand && Boolean(bootstrap.moduleConnections.backoffice?.length),
    staleTime: retainObservation ? Infinity : 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: ({ signal }) =>
      loadOperationalReadiness(
        runtime.backofficeBaseUrl,
        runtime.clientContractVersion,
        accessToken,
        runtime.requestTimeoutMs,
        bootstrap,
        signal,
      ),
  });
  return {
    onDemand,
    query,
    bootstrap: onDemand
      ? {
          ...bootstrap,
          operationalReadiness:
            active && query.isSuccess && !query.isFetching ? query.data : undefined,
        }
      : bootstrap,
  };
}
