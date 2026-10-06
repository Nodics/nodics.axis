/** @file Native administrative activity route; remounts on identity/enterprise changes and clears stale pages during requests. */
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
  createCopilotActivityClient,
  type CopilotActivity,
  type ActivityFilters,
} from './api/copilotActivityClient';
import { CopilotActivityView } from './CopilotActivityView';

interface Props {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
}

/** Requires a declared available activity workspace, not merely a guessed route. */
export function CopilotActivityRoutePage(props: Props) {
  const navigation = copilotWorkspaceNavigation(
    props.bootstrap,
    'copilot.activity',
    'conversations',
  );
  const connection = navigation
    ? selectModuleConnection(props.bootstrap, navigation.moduleName)
    : undefined;
  return (
    <WorkspaceContainer>
      {navigation && connection ? (
        <ActivitySession
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

/** Uses uncached bounded GET requests and drops late responses after navigation. */
function ActivitySession({
  accessToken,
  runtime,
  endpoint,
}: Omit<Props, 'bootstrap'> & { readonly endpoint: string }) {
  const client = useMemo(
    () =>
      createCopilotActivityClient({
        accessToken,
        enterpriseCode: runtime.enterpriseCode,
        moduleBaseUrl: endpoint,
        timeoutMs: runtime.requestTimeoutMs,
      }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs, endpoint],
  );
  const [query, setQuery] = useState<{
    page: number;
    principal: string;
    revision: number;
    filters: ActivityFilters;
  }>({
    page: 1,
    principal: '',
    revision: 0,
    filters: {},
  });
  const key = JSON.stringify(query);
  const [result, setResult] = useState<{
    key: string;
    activity?: CopilotActivity;
    error?: boolean;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    void client
      .list(query.page, query.principal, controller.signal, query.filters)
      .then((activity) => {
        if (!controller.signal.aborted) setResult({ key, activity });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, error: true });
      });
    return () => controller.abort();
  }, [client, key, query.page, query.principal, query.filters]);
  const refresh = () =>
    setQuery((value) => ({ ...value, revision: value.revision + 1 }));
  if (!result || result.key !== key)
    return <Skeleton variant="rectangular" height={280} />;
  if (result.error || !result.activity)
    return (
      <Alert severity="warning" action={<Button onClick={refresh}>Retry</Button>}>
        Workspace could not be loaded.
      </Alert>
    );
  return (
    <CopilotActivityView
      key={key}
      configuration={{
        accessToken,
        enterpriseCode: runtime.enterpriseCode,
        moduleBaseUrl: endpoint,
        timeoutMs: runtime.requestTimeoutMs,
      }}
      activity={result.activity}
      principal={query.principal}
      filters={query.filters}
      onRefresh={refresh}
      onPage={(page) => setQuery((value) => ({ ...value, page }))}
      onFilter={(principal, filters) =>
        setQuery((value) => ({
          principal,
          filters,
          page: 1,
          revision: value.revision + 1,
        }))
      }
    />
  );
}
