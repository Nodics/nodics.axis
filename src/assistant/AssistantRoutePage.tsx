import { useMemo } from 'react';

import { CmsRoutePage } from '../app/CmsRoutePage';
import type { AxisModuleConnection } from '../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import { createAssistantClient } from './api/assistantClient';
import { useAssistantPresentation } from './presentation/useAssistantPresentation';

interface AssistantRoutePageProps {
  readonly accessToken: string;
  readonly channel: string;
  readonly cmsBaseUrl: string;
  readonly connection: AxisModuleConnection;
  readonly employeeId: string;
  readonly locale: string;
  readonly runtime: AxisRuntimeConfig;
  readonly site: string;
}

export function AssistantRoutePage(props: AssistantRoutePageProps) {
  const assistantRequestTimeoutMs = Math.max(
    props.runtime.requestTimeoutMs,
    props.runtime.assistantIdleTimeoutMs,
  );
  const client = useMemo(
    () =>
      createAssistantClient({
        moduleBaseUrl: props.connection.endpoint,
        enterpriseCode: props.runtime.enterpriseCode,
        accessToken: props.accessToken,
        timeoutMs: assistantRequestTimeoutMs,
      }),
    [
      props.accessToken,
      props.connection.endpoint,
      props.runtime.enterpriseCode,
      assistantRequestTimeoutMs,
    ],
  );
  const scope = useMemo(
    () => ({
      enterpriseCode: props.runtime.enterpriseCode,
      employeeId: props.employeeId,
    }),
    [props.employeeId, props.runtime.enterpriseCode],
  );
  const controller = useAssistantPresentation({
    scope,
    client,
    definitionCode: 'axisAssistant',
    streamConfiguration: {
      moduleBaseUrl: props.connection.endpoint,
      enterpriseCode: props.runtime.enterpriseCode,
      accessToken: props.accessToken,
      timeoutMs: assistantRequestTimeoutMs,
      maximumEventBytes: props.runtime.assistantMaximumEventBytes,
      reconnectWindowMs: props.runtime.assistantReconnectWindowMs,
      idleTimeoutMs: props.runtime.assistantIdleTimeoutMs,
    },
  });

  return (
    <CmsRoutePage
      accessToken={props.accessToken}
      actions={{ assistant: controller }}
      channel={props.channel}
      cmsBaseUrl={props.cmsBaseUrl}
      enterpriseCode={props.runtime.enterpriseCode}
      locale={props.locale}
      path="/assistant"
      site={props.site}
      timeoutMs={props.runtime.requestTimeoutMs}
    />
  );
}
