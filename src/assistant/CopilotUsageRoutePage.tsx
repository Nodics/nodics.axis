/** @file Authorized native usage route with identity-bound state and no shared browser cache. */
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
  createCopilotUsageClient,
  type CopilotUsage,
  type CopilotUsageQuery,
} from './api/copilotUsageClient';
import { CopilotUsageView } from './CopilotUsageView';
import { CopilotBudgetPanel } from './CopilotBudgetPanel';
import { CopilotUsageCallPanel } from './CopilotUsageCallPanel';

interface Props {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
}
/** Requires a backend-declared available owner binding; a URL alone grants nothing. */
export function CopilotUsageRoutePage(props: Props) {
  const navigation = copilotWorkspaceNavigation(
    props.bootstrap,
    'copilot.usage',
    'overview',
  );
  const connection = navigation
    ? selectModuleConnection(props.bootstrap, navigation.moduleName)
    : undefined;
  return (
    <WorkspaceContainer>
      {navigation && connection ? (
        <UsageSession
          key={JSON.stringify([
            props.accessToken,
            props.runtime.enterpriseCode,
            connection.endpoint,
          ])}
          accessToken={props.accessToken}
          runtime={props.runtime}
          endpoint={connection.endpoint}
        />
      ) : (
        <Alert severity="warning">Workspace unavailable.</Alert>
      )}
    </WorkspaceContainer>
  );
}
/** Drops stale pages immediately on filter changes and aborts obsolete transport. */
function UsageSession({
  accessToken,
  runtime,
  endpoint,
}: Omit<Props, 'bootstrap'> & { readonly endpoint: string }) {
  const configuration = useMemo(
    () => ({
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      moduleBaseUrl: endpoint,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs, endpoint],
  );
  const client = useMemo(
    () => createCopilotUsageClient(configuration),
    [configuration],
  );
  const [budgetsOpen, setBudgetsOpen] = useState(false);
  const [callId, setCallId] = useState<string>();
  const [query, setQuery] = useState<CopilotUsageQuery>({
    scope: 'PERSONAL',
    principalCode: '',
    model: '',
    purpose: '',
  });
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([query, revision]);
  const [result, setResult] = useState<{
    key: string;
    usage?: CopilotUsage;
    error?: boolean;
  }>();
  useEffect(() => {
    const abort = new AbortController();
    void client
      .get(query, abort.signal)
      .then((usage) => {
        if (!abort.signal.aborted) setResult({ key, usage });
      })
      .catch(() => {
        if (!abort.signal.aborted) setResult({ key, error: true });
      });
    return () => abort.abort();
  }, [client, key, query]);
  const refresh = () => setRevision((value) => value + 1);
  if (budgetsOpen)
    return (
      <CopilotBudgetPanel
        configuration={configuration}
        onBack={() => {
          setBudgetsOpen(false);
          refresh();
        }}
      />
    );
  if (!result || result.key !== key)
    return <Skeleton variant="rectangular" height={280} />;
  if (result.error || !result.usage)
    return (
      <Alert severity="warning" action={<Button onClick={refresh}>Retry</Button>}>
        Workspace could not be loaded.
      </Alert>
    );
  return (
    <>
      <CopilotUsageView
        key={key}
        usage={result.usage}
        query={query}
        onQuery={setQuery}
        onRefresh={refresh}
        onBudgets={() => setBudgetsOpen(true)}
        onCall={setCallId}
      />
      {callId && result.usage.period?.key ? (
        <CopilotUsageCallPanel
          key={callId}
          configuration={configuration}
          callId={callId}
          periodKey={result.usage.period.key}
          onClose={() => {
            setCallId(undefined);
            refresh();
          }}
        />
      ) : null}
    </>
  );
}
