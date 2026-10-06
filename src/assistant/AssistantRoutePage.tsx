/** @file Separate conversation route; resume links remain subject to backend ownership checks. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { CmsRoutePage } from '../app/CmsRoutePage';
import type { AxisModuleConnection } from '../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import { createAssistantClient } from './api/assistantClient';
import { useAssistantPresentation } from './presentation/useAssistantPresentation';
import {
  createCopilotContextClient,
  type CopilotContext,
} from './api/copilotContextClient';
import { CopilotContextView } from './CopilotContextView';
import { CopilotLiveReadComposer } from './CopilotLiveReadComposer';
import { CopilotInspectionComposer } from './CopilotInspectionComposer';
import { CopilotCouponComposer } from './CopilotCouponComposer';
import { createCopilotCouponClient } from './api/copilotCouponClient';
import {
  createCopilotCollectionsClient,
  type CopilotCollectionSource,
} from './api/copilotCollectionsClient';

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
  return (
    <ScopedAssistantRoutePage
      key={JSON.stringify([
        props.accessToken,
        props.employeeId,
        props.runtime.enterpriseCode,
        props.connection.endpoint,
      ])}
      {...props}
    />
  );
}

/** Remounts all conversation and knowledge selection state when authorization scope changes. */
function ScopedAssistantRoutePage(props: AssistantRoutePageProps) {
  const [context, setContext] = useState<CopilotContext>();
  const [selected, setSelected] = useState<readonly string[]>();
  const [searchParams] = useSearchParams();
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
  const couponClient = useMemo(
    () =>
      createCopilotCouponClient({
        moduleBaseUrl: props.connection.endpoint,
        enterpriseCode: props.runtime.enterpriseCode,
        accessToken: props.accessToken,
        timeoutMs: assistantRequestTimeoutMs,
      }),
    [
      props.connection.endpoint,
      props.runtime.enterpriseCode,
      props.accessToken,
      assistantRequestTimeoutMs,
    ],
  );
  const collectionsClient = useMemo(
    () =>
      createCopilotCollectionsClient({
        moduleBaseUrl: props.connection.endpoint,
        enterpriseCode: props.runtime.enterpriseCode,
        accessToken: props.accessToken,
        timeoutMs: props.runtime.requestTimeoutMs,
      }),
    [
      props.connection.endpoint,
      props.runtime.enterpriseCode,
      props.accessToken,
      props.runtime.requestTimeoutMs,
    ],
  );
  const loadCollections = useCallback(
    (source: CopilotCollectionSource, signal: AbortSignal) =>
      collectionsClient.inventory(source, signal),
    [collectionsClient],
  );
  const controller = useAssistantPresentation({
    scope,
    client,
    definitionCode: 'axisAssistant',
    knowledgeGroupCodes: selected,
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
  useEffect(() => {
    const abort = new AbortController();
    const contextClient = createCopilotContextClient({
      moduleBaseUrl: props.connection.endpoint,
      enterpriseCode: props.runtime.enterpriseCode,
      accessToken: props.accessToken,
      timeoutMs: props.runtime.requestTimeoutMs,
    });
    void contextClient
      .get(abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setContext(value);
      })
      .catch(() => {
        if (!abort.signal.aborted) setContext(undefined);
      });
    return () => abort.abort();
  }, [
    props.accessToken,
    props.connection.endpoint,
    props.runtime.enterpriseCode,
    props.runtime.requestTimeoutMs,
  ]);

  const conversationCode = searchParams.get('conversation');
  const newRequested = searchParams.get('new') === '1';
  const { selectConversation, newConversation } = controller;
  useEffect(() => {
    if (conversationCode) void selectConversation(conversationCode);
    else if (newRequested) newConversation();
  }, [conversationCode, newRequested, selectConversation, newConversation]);

  return (
    <>
      {context ? (
        <CopilotContextView
          context={context}
          selected={selected}
          disabled={['SUBMITTING', 'STREAMING', 'CANCELLING'].includes(
            controller.state.status,
          )}
          onChange={setSelected}
        />
      ) : null}
      {context?.liveReads?.sources.length ? (
        <CopilotLiveReadComposer
          key={JSON.stringify(selected)}
          contract={{
            ...context.liveReads,
            sources: context.liveReads.sources.filter(
              (source) =>
                !context.groups.enabled ||
                selected === undefined ||
                source.groupCodes.some((code) => selected.includes(code)),
            ),
          }}
          disabled={[
            'CREATING_CONVERSATION',
            'SUBMITTING',
            'STREAMING',
            'CANCELLING',
          ].includes(controller.state.status)}
          loadCollections={loadCollections}
          onSubmit={controller.submit}
        />
      ) : null}
      {context?.rulesInspection ? (
        <CopilotInspectionComposer
          intent="copilot.rules.inspect"
          contract={context.rulesInspection}
          disabled={[
            'CREATING_CONVERSATION',
            'SUBMITTING',
            'STREAMING',
            'CANCELLING',
          ].includes(controller.state.status)}
          onSubmit={controller.submit}
        />
      ) : null}
      {context?.importInspection ? (
        <CopilotInspectionComposer
          intent="copilot.import.inspect"
          contract={context.importInspection}
          disabled={[
            'CREATING_CONVERSATION',
            'SUBMITTING',
            'STREAMING',
            'CANCELLING',
          ].includes(controller.state.status)}
          onSubmit={controller.submit}
        />
      ) : null}
      {context?.coupon ? (
        <CopilotCouponComposer
          contract={context.coupon}
          client={couponClient}
          actions={client}
        />
      ) : null}
      {context?.processInspection ? (
        <CopilotInspectionComposer
          intent="copilot.process.inspect"
          contract={context.processInspection}
          disabled={[
            'CREATING_CONVERSATION',
            'SUBMITTING',
            'STREAMING',
            'CANCELLING',
          ].includes(controller.state.status)}
          onSubmit={controller.submit}
        />
      ) : null}
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
    </>
  );
}
