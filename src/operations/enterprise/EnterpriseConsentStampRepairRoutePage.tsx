/** Standalone repair presentation within authorized Profile navigation; no normal hierarchy workspace read or target listing. */
import { useMemo } from 'react';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import type { AxisAuthenticatedBootstrap } from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { EnterpriseConsentStampRepair } from './EnterpriseConsentStampRepair';

/** Starts with only the configured native title; repair task copy comes from its own admitted inspection. */
export function EnterpriseConsentStampRepairRoutePage({
  bootstrap,
  accessToken,
  runtime,
  target,
  title,
  embedded = false,
}: {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly accessToken: string;
  readonly runtime: AxisRuntimeConfig;
  readonly target: string;
  readonly title: string;
  readonly embedded?: boolean;
}) {
  const configuration = useMemo(
    () => ({
      bootstrap,
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [bootstrap, accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs],
  );
  const task = (
    <EnterpriseConsentStampRepair
      configuration={configuration}
      target={target}
      title={title}
    />
  );
  return embedded ? task : <WorkspaceContainer>{task}</WorkspaceContainer>;
}
