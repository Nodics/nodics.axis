import { useEffect, useMemo } from 'react';
import type { AxisModuleConnection } from '../../bootstrap/publicBootstrap';
import {
  createApplicationStatusQueue,
  type ApplicationReadinessScheduling,
} from './api/applicationStatusQueue';

/** Shares Setup's owner-configured scheduling mechanism with read-only views. Scope changes retire work; the queue retains no status or credential evidence. */
export function useApplicationReadinessQueue({
  accessToken,
  tenantCode,
  enterpriseCode,
  projectCode,
  connection,
  policy,
  active = true,
  preferredKey,
}: {
  readonly accessToken: string;
  readonly tenantCode: string;
  readonly enterpriseCode: string;
  readonly projectCode: string;
  readonly connection: AxisModuleConnection | undefined;
  readonly policy: ApplicationReadinessScheduling | undefined;
  readonly active?: boolean;
  readonly preferredKey?: string | undefined;
}) {
  const actor = useMemo(
    () => (accessToken ? crypto.randomUUID() : 'anonymous'),
    [accessToken],
  );
  const owner = JSON.stringify(
    connection
      ? [
          connection.moduleName,
          connection.instanceId,
          connection.endpoint,
          connection.environment,
          connection.server,
          connection.runtimeRole?.code,
          connection.runtimeRole?.publication,
          connection.state,
        ]
      : null,
  );
  const version = policy?.contractVersion,
    concurrency = policy?.concurrency,
    priorityBurst = policy?.priorityBurst;
  const scope = JSON.stringify([
    actor,
    tenantCode,
    enterpriseCode,
    projectCode,
    owner,
    version,
    concurrency,
    priorityBurst,
  ]);
  const queue = useMemo(() => {
    void scope;
    return createApplicationStatusQueue(
      version === undefined || concurrency === undefined || priorityBurst === undefined
        ? undefined
        : { contractVersion: version, concurrency, priorityBurst },
    );
  }, [scope, version, concurrency, priorityBurst]);
  useEffect(() => {
    if (active) queue.activate();
    else queue.deactivate();
    return () => queue.deactivate();
  }, [queue, active]);
  useEffect(() => queue.prefer(preferredKey), [queue, preferredKey]);
  return { queue, scope };
}
