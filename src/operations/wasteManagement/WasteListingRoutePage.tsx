import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { selectModuleConnection } from '../../bootstrap/publicBootstrap';
import type { WasteManagementRoutePageProps } from './WasteManagementRoutePage';
import { WasteListingRequestsPanel } from './WasteListingRequestsPanel';
import {
  loadWasteListingWorkspace,
  type WasteListingPresentation,
} from './api/wasteListingClient';

/** Mounts only the declared Waste listing binding, separate from Waste review admission. */
export function WasteListingRoutePage(props: WasteManagementRoutePageProps) {
  const binding = props.navigation.backendWorkspace;
  const configuration = useMemo(
    () => ({
      bootstrap: props.bootstrap,
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      timeoutMs: props.runtime.requestTimeoutMs,
      ownerSelector: binding?.ownerSelector,
    }),
    [
      props.bootstrap,
      props.accessToken,
      props.runtime.enterpriseCode,
      props.runtime.requestTimeoutMs,
      binding?.ownerSelector,
    ],
  );
  const connection = selectModuleConnection(
    props.bootstrap,
    'eWaste',
    binding?.ownerSelector,
  );
  const admitted = Boolean(
    props.navigation.moduleName === 'eWaste' &&
    binding?.contractVersion === 1 &&
    binding.renderer === 'axis.workspace.native' &&
    binding.workspaceCode === 'waste.listing' &&
    binding.viewCode === 'ewaste.listingRequests' &&
    !['DISABLED', 'HIDDEN'].includes(props.navigation.featureState ?? 'ACTIVE') &&
    ['UP', 'DEGRADED'].includes(props.navigation.availability) &&
    connection?.endpoint,
  );
  const ownerIdentity = JSON.stringify([
    props.navigation.id,
    props.navigation.moduleName,
    props.navigation.route,
    binding,
    connection?.instanceId,
    connection?.endpoint,
    connection?.state,
    connection?.runtimeRole,
  ]);
  const authority = useMemo(
    () => ({
      accessToken: props.accessToken,
      employeeId: props.employeeId,
      sessionGeneration: props.sessionGeneration ?? 0,
      tenantCode: props.bootstrap.tenantCode,
      enterpriseCode: props.runtime.enterpriseCode,
      ownerIdentity,
    }),
    [
      props.accessToken,
      props.employeeId,
      props.sessionGeneration,
      props.bootstrap.tenantCode,
      props.runtime.enterpriseCode,
      ownerIdentity,
    ],
  );
  const [refresh, setRefresh] = useState(0);
  const [read, setRead] = useState<{
    authority: object;
    refresh: number;
    value?: WasteListingPresentation;
    failed?: boolean;
  }>();
  const generation = useRef(0);
  const current =
    read?.authority === authority && read.refresh === refresh ? read : undefined;
  useEffect(() => {
    const sequence = generation;
    const attempt = ++sequence.current;
    if (admitted)
      void loadWasteListingWorkspace(configuration)
        .then((value) => {
          if (sequence.current === attempt) setRead({ authority, refresh, value });
        })
        .catch(() => {
          if (sequence.current === attempt)
            setRead({ authority, refresh, failed: true });
        });
    return () => {
      sequence.current++;
    };
  }, [admitted, configuration, authority, refresh]);
  return (
    <WorkspaceContainer>
      <Stack data-functional-module="eWaste" sx={{ minWidth: 0 }}>
        {admitted && current?.value ? (
          <WasteListingRequestsPanel
            configuration={configuration}
            presentation={current.value}
            employeeId={props.employeeId}
            sessionGeneration={props.sessionGeneration ?? 0}
          />
        ) : !admitted ? (
          <Alert severity="error">
            This workspace is unavailable in the current runtime.
          </Alert>
        ) : (
          <Stack spacing={2}>
            <Typography variant="h5">{props.navigation.label}</Typography>
            {!current ? (
              <CircularProgress size={24} aria-label="Loading workspace" />
            ) : (
              <>
                <Alert severity="error">Workspace presentation is unavailable.</Alert>
                <Tooltip title="Refresh workspace">
                  <IconButton
                    aria-label="Refresh workspace"
                    onClick={() => setRefresh((value) => value + 1)}
                  >
                    <ShellIcon name="refresh" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>
        )}
      </Stack>
    </WorkspaceContainer>
  );
}
