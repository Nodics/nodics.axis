/** Profile-native administration entry; owner definitions and the existing generic command/checkpoint renderer remain authoritative. */
import { Alert, Button, CircularProgress, Stack } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import {
  BackendOperationsWorkspaceRoutePage,
  type BackendOperationsWorkspaceRoutePageProps,
} from '../../app/BackendOperationsWorkspaceRoutePage';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import type { AxisBackendWorkspace } from '../../bootstrap/publicBootstrap';
import { loadEnterpriseManagementWorkspace } from './api/enterpriseManagementWorkspaceClient';

/** Loads fresh choices once per admitted original session/owner context; late responses cannot mount old forms. */
export function EnterpriseManagementRoutePage(
  props: BackendOperationsWorkspaceRoutePageProps,
) {
  const { bootstrap, connection, accessToken, runtime, sessionGeneration } = props;
  const configuration = useMemo(
    () =>
      bootstrap && accessToken && connection?.moduleName === 'profile'
        ? {
            bootstrap,
            accessToken,
            enterpriseCode: runtime.enterpriseCode,
            timeoutMs: runtime.requestTimeoutMs,
            ownerSelector: {
              instanceId: connection.instanceId,
              environment: connection.environment,
              ...(connection.server ? { server: connection.server } : {}),
            },
          }
        : undefined,
    [
      bootstrap,
      connection,
      accessToken,
      runtime.enterpriseCode,
      runtime.requestTimeoutMs,
    ],
  );
  const context = useMemo(
    () => ({ configuration, sessionGeneration }),
    [configuration, sessionGeneration],
  );
  const [state, setState] = useState<{
    context: typeof context;
    workspace?: AxisBackendWorkspace;
    error?: string;
  }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (!configuration) return () => controller.abort();
    void loadEnterpriseManagementWorkspace(configuration, controller.signal)
      .then((workspace) => {
        if (!controller.signal.aborted) setState({ context, workspace });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            context,
            error:
              error instanceof Error
                ? error.message
                : 'Enterprise management is unavailable.',
          });
      });
    return () => {
      controller.abort();
    };
  }, [configuration, context, attempt]);
  const current = state?.context === context ? state : undefined;
  const error = configuration
    ? current?.error
    : 'The owning enterprise service is unavailable.';
  if (current?.workspace)
    return (
      <BackendOperationsWorkspaceRoutePage {...props} workspace={current.workspace} />
    );
  return (
    <WorkspaceContainer>
      <Stack spacing={2}>
        <WorkspaceHeading
          title={props.workspace.title}
          description={props.workspace.description}
        />
        {error ? (
          <>
            <Alert severity="error">{error}</Alert>
            <Button
              onClick={() => {
                setState(undefined);
                setAttempt((value) => value + 1);
              }}
            >
              Retry
            </Button>
          </>
        ) : (
          <CircularProgress aria-label="Loading enterprise management" />
        )}
      </Stack>
    </WorkspaceContainer>
  );
}
