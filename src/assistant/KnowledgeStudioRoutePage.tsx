/** @file Authorized native source inventory route; identity changes unmount all old source and preview state. */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Skeleton } from '@mui/material';
import { WorkspaceContainer } from '../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
} from '../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import { copilotWorkspaceNavigation } from './copilotWorkspaceNavigation';
import {
  createKnowledgeStudioClient,
  type KnowledgeInventory,
} from './api/knowledgeStudioClient';
import { KnowledgeStudioView } from './KnowledgeStudioView';
import { createCopilotCollectionsClient } from './api/copilotCollectionsClient';
import { createKnowledgeHistoryClient } from './api/knowledgeHistoryClient';
import { createKnowledgeCleanupClient } from './api/knowledgeCleanupClient';
import { createKnowledgeWriterRecoveryClient } from './api/knowledgeWriterRecoveryClient';
import { createKnowledgeMaintenanceClient } from './api/knowledgeMaintenanceClient';
import { createKnowledgeManualRefreshClient } from './api/knowledgeManualRefreshClient';
import { createKnowledgeMigrationClient } from './api/knowledgeMigrationClient';
import { KnowledgeMigrationPanel } from './KnowledgeMigrationPanel';
import { CronScheduleDraftPanel } from '../operations/cron/CronScheduleDraftPanel';
import type { AxisModuleConnection } from '../bootstrap/publicBootstrap';

interface Props {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
}

/** Admits only the backend-declared native Knowledge Studio and its available owner connection. */
export function KnowledgeStudioRoutePage(props: Props) {
  const navigation = copilotWorkspaceNavigation(
    props.bootstrap,
    'copilot.knowledge',
    'sources',
  );
  const connection = navigation
    ? selectModuleConnection(props.bootstrap, navigation.moduleName)
    : undefined;
  const cronNavigation = props.bootstrap.navigation.find(
    (item) =>
      item.moduleName === 'cronjob' &&
      item.id === 'cronjob' &&
      !['DISABLED', 'HIDDEN'].includes(item.featureState ?? 'ACTIVE') &&
      ['UP', 'DEGRADED'].includes(item.availability),
  );
  const cronConnection = cronNavigation
    ? selectModuleConnection(props.bootstrap, 'cronjob')
    : undefined;
  return (
    <WorkspaceContainer>
      {navigation && connection ? (
        <KnowledgeSession
          key={JSON.stringify([
            props.accessToken,
            props.runtime.enterpriseCode,
            connection.endpoint,
          ])}
          accessToken={props.accessToken}
          runtime={props.runtime}
          endpoint={connection.endpoint}
          cronConnection={cronConnection}
        />
      ) : (
        <Alert severity="warning">Workspace unavailable.</Alert>
      )}
    </WorkspaceContainer>
  );
}

/** Fetches bounded snapshots without shared cache and invalidates source preview components on refresh. */
function KnowledgeSession({
  accessToken,
  runtime,
  endpoint,
  cronConnection,
}: Omit<Props, 'bootstrap'> & {
  readonly endpoint: string;
  readonly cronConnection: AxisModuleConnection | undefined;
}) {
  const maintenance = useMemo(
    () =>
      createKnowledgeMaintenanceClient({
        accessToken,
        enterpriseCode: runtime.enterpriseCode,
        moduleBaseUrl: endpoint,
        timeoutMs: runtime.requestTimeoutMs,
      }),
    [accessToken, runtime.enterpriseCode, endpoint, runtime.requestTimeoutMs],
  );
  const client = useMemo(
    () =>
      createKnowledgeStudioClient({
        accessToken,
        enterpriseCode: runtime.enterpriseCode,
        moduleBaseUrl: endpoint,
        timeoutMs: runtime.requestTimeoutMs,
      }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs, endpoint],
  );
  const [revision, setRevision] = useState(0);
  const migration = useMemo(
    () =>
      createKnowledgeMigrationClient({
        accessToken,
        enterpriseCode: runtime.enterpriseCode,
        moduleBaseUrl: endpoint,
        timeoutMs: runtime.requestTimeoutMs,
      }),
    [accessToken, runtime.enterpriseCode, endpoint, runtime.requestTimeoutMs],
  );
  const manualRefresh = useMemo(
    () =>
      createKnowledgeManualRefreshClient({
        accessToken,
        enterpriseCode: runtime.enterpriseCode,
        moduleBaseUrl: endpoint,
        timeoutMs: runtime.requestTimeoutMs,
      }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs, endpoint],
  );
  const recovery = useMemo(
    () =>
      createKnowledgeWriterRecoveryClient({
        accessToken,
        enterpriseCode: runtime.enterpriseCode,
        moduleBaseUrl: endpoint,
        timeoutMs: runtime.requestTimeoutMs,
      }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs, endpoint],
  );
  const cleanup = useMemo(
    () =>
      createKnowledgeCleanupClient({
        accessToken,
        enterpriseCode: runtime.enterpriseCode,
        moduleBaseUrl: endpoint,
        timeoutMs: runtime.requestTimeoutMs,
      }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs, endpoint],
  );
  const history = useMemo(
    () =>
      createKnowledgeHistoryClient({
        accessToken,
        enterpriseCode: runtime.enterpriseCode,
        moduleBaseUrl: endpoint,
        timeoutMs: runtime.requestTimeoutMs,
      }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs, endpoint],
  );
  const [page, setPage] = useState(1);
  const collections = useMemo(
    () =>
      createCopilotCollectionsClient({
        accessToken,
        enterpriseCode: runtime.enterpriseCode,
        moduleBaseUrl: endpoint,
        timeoutMs: runtime.requestTimeoutMs,
      }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs, endpoint],
  );
  const [result, setResult] = useState<{
    revision: number;
    page: number;
    inventory?: KnowledgeInventory;
    error?: boolean;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    void client
      .inventory(controller.signal, page)
      .then((inventory) => {
        if (!controller.signal.aborted) setResult({ revision, page, inventory });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ revision, page, error: true });
      });
    return () => controller.abort();
  }, [client, revision, page]);
  if (!result || result.revision !== revision || result.page !== page)
    return <Skeleton variant="rectangular" height={280} />;
  if (!result.inventory || result.error)
    return (
      <Alert
        severity="warning"
        action={
          <Button onClick={() => setRevision((value) => value + 1)}>Retry</Button>
        }
      >
        Workspace could not be loaded.
      </Alert>
    );
  return (
    <>
      <KnowledgeStudioView
        sourceSchedule={(source) =>
          cronConnection ? (
            <CronScheduleDraftPanel
              connection={cronConnection}
              configuration={{
                accessToken,
                enterpriseCode: runtime.enterpriseCode,
                timeoutMs: runtime.requestTimeoutMs,
              }}
              sourceBinding={{
                moduleName: 'copilotApi',
                sourceCode: source.code,
                policyDigest: source.sourcePolicyDigest!,
              }}
            />
          ) : null
        }
        manualRefresh={(source) => ({
          preview: (requestId, signal) =>
            manualRefresh.preview(source, requestId, signal),
          start: (review, signal) => manualRefresh.start(source, review, signal),
          inspect: (review, signal) => manualRefresh.inspect(source, review, signal),
        })}
        recovery={(source) => ({
          preview: (signal) => recovery.preview(source, signal),
          execute: (review, signal) => recovery.execute(source, review, signal),
        })}
        cleanup={(source) => ({
          preview: (signal) => cleanup.preview(source, signal),
          execute: (review, signal) => cleanup.execute(source, review, signal),
        })}
        key={`${revision}:${page}`}
        inventory={result.inventory}
        refreshing={false}
        onRefresh={() => setRevision((value) => value + 1)}
        onPage={setPage}
        onPreview={(source, signal) => client.preview(source, signal)}
        onIndex={(source, signal) => client.refresh(source, signal)}
        onHistory={(source, page, signal) => history.load(source.code, page, signal)}
        onMaintenance={(source, page, signal) => maintenance.load(source, page, signal)}
        collections={(source) => ({
          load: (signal) => collections.inventory(source, signal),
          query: (schemaName, search, page, signal) =>
            collections.query(source, schemaName, search, page, signal),
        })}
      />
      {result.inventory.legacyMigration?.plans.flatMap((plan) => [
        <KnowledgeMigrationPanel
          key={plan.code}
          plan={plan}
          copy={result.inventory!.legacyMigration!.presentation}
          client={migration}
        />,
        ...(plan.canErase !== undefined
          ? [
              <KnowledgeMigrationPanel
                key={`${plan.code}-erasure`}
                plan={plan}
                erasure
                copy={result.inventory!.legacyMigration!.presentation}
                client={migration}
              />,
            ]
          : []),
      ])}
    </>
  );
}
