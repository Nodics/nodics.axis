/** @file Connects authorized native Workspace navigation to a scope-isolated, read-only backend snapshot. */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Skeleton, Stack } from '@mui/material';
import { useNavigate } from 'react-router';
import { WorkspaceContainer } from '../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisNavigationItem,
} from '../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import {
  createCopilotWorkspaceClient,
  type CopilotWorkspace,
} from './api/copilotWorkspaceClient';
import { CopilotWorkspaceView } from './CopilotWorkspaceView';
import { copilotWorkspaceNavigation } from './copilotWorkspaceNavigation';
import { CopilotProviderCheck } from './CopilotProviderCheck';

interface Props {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
  readonly compact?: boolean | undefined;
}

/** Hides unavailable summary contributions instead of creating alternate navigation. */
export function CopilotWorkspaceRoutePage(props: Props) {
  const navigation = copilotWorkspaceNavigation(props.bootstrap);
  const connection = navigation
    ? selectModuleConnection(props.bootstrap, navigation.moduleName)
    : undefined;
  if ((!navigation || !connection) && props.compact) return null;
  const content =
    !navigation || !connection ? (
      <Alert severity="warning">Copilot workspace is unavailable.</Alert>
    ) : (
      <WorkspaceSnapshot
        {...props}
        navigation={navigation}
        endpoint={connection.endpoint}
      />
    );
  return props.compact ? content : <WorkspaceContainer>{content}</WorkspaceContainer>;
}

/** Discards snapshots when token, enterprise or endpoint changes and cancels obsolete reads. */
function WorkspaceSnapshot(
  props: Props & { readonly navigation: AxisNavigationItem; readonly endpoint: string },
) {
  const navigate = useNavigate();
  const client = useMemo(
    () =>
      createCopilotWorkspaceClient({
        moduleBaseUrl: props.endpoint,
        enterpriseCode: props.runtime.enterpriseCode,
        accessToken: props.accessToken,
        timeoutMs: props.runtime.requestTimeoutMs,
      }),
    [
      props.endpoint,
      props.runtime.enterpriseCode,
      props.accessToken,
      props.runtime.requestTimeoutMs,
    ],
  );
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    client: typeof client;
    revision: number;
    snapshot?: CopilotWorkspace;
    error?: boolean;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    void client
      .get(controller.signal)
      .then((snapshot) => {
        if (!controller.signal.aborted) setResult({ client, revision, snapshot });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ client, revision, error: true });
      });
    return () => controller.abort();
  }, [client, revision]);
  const current = result?.client === client ? result : undefined;
  const pending = !current || current.revision !== revision;
  const conversation = props.bootstrap.navigation.find(
    (item) =>
      item.moduleName === 'copilotApi' &&
      item.id === 'assistant' &&
      !['DISABLED', 'HIDDEN'].includes(item.featureState ?? 'ACTIVE') &&
      ['UP', 'DEGRADED'].includes(item.availability),
  );
  const usageNavigation = copilotWorkspaceNavigation(
    props.bootstrap,
    'copilot.usage',
    'overview',
  );
  return (
    <Box sx={{ minWidth: 0 }}>
      {current?.error ? (
        <Alert
          severity="warning"
          action={
            <Button
              disabled={pending}
              onClick={() => setRevision((value) => value + 1)}
            >
              Retry
            </Button>
          }
        >
          Copilot workspace could not be loaded.
        </Alert>
      ) : current?.snapshot ? (
        <CopilotWorkspaceView
          snapshot={current.snapshot}
          providerCheck={
            !props.compact && current.snapshot.provider.checkLabel ? (
              <CopilotProviderCheck
                key={JSON.stringify([
                  props.accessToken,
                  props.runtime.enterpriseCode,
                  props.endpoint,
                ])}
                configuration={{
                  accessToken: props.accessToken,
                  enterpriseCode: props.runtime.enterpriseCode,
                  moduleBaseUrl: props.endpoint,
                  timeoutMs: props.runtime.requestTimeoutMs,
                }}
                label={current.snapshot.provider.checkLabel}
              />
            ) : null
          }
          compact={props.compact}
          refreshing={pending}
          onRefresh={() => setRevision((value) => value + 1)}
          onUsage={
            usageNavigation
              ? () => {
                  void navigate(usageNavigation.route);
                }
              : undefined
          }
          onDetails={() => {
            void navigate(props.navigation.route);
          }}
          onConversation={
            conversation
              ? (code) => {
                  const query = new URLSearchParams(
                    code ? { conversation: code } : { new: '1' },
                  );
                  void navigate(`${conversation.route}?${query.toString()}`);
                }
              : undefined
          }
        />
      ) : (
        <Stack
          role="status"
          aria-label={props.navigation.label}
          spacing={2}
          sx={{ py: 3 }}
        >
          <Skeleton width="45%" height={40} />
          <Skeleton variant="rectangular" height={140} />
        </Stack>
      )}
    </Box>
  );
}
