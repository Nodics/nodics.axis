/** Existing Product Workbench with an optional native-admin business target, never session switching. */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Stack, Typography } from '@mui/material';
import { selectModuleConnection } from '../../bootstrap/publicBootstrap';
import {
  WorkbenchRoutePage,
  type WorkbenchRoutePageProps,
} from '../../workbench/WorkbenchRoutePage';
import { ProfileEnterpriseSelector } from '../shared/ProfileEnterpriseSelector';
import type { ProfileEnterpriseOption } from '../shared/profileEnterpriseLookup';
import { searchProfileParticipantEnterprises } from '../shared/profileParticipantLookup';
import {
  loadProductAdministrativeCapability,
  productAdministrativeTransport,
  type ProductAdministrativeCapability,
} from './productAdministrativeClient';

export function ProductWorkbenchRoutePage(props: WorkbenchRoutePageProps) {
  if (
    props.routeSchema?.moduleName !== 'product' ||
    props.routeSchema.schemaName !== 'product'
  )
    return <WorkbenchRoutePage {...props} />;
  return <ProductRootWorkspace {...props} />;
}
function ProductRootWorkspace(props: WorkbenchRoutePageProps) {
  const connection = selectModuleConnection(props.bootstrap, 'product', {
    runtimeRoleCode: 'COMMERCE_STAGED',
    publicationRole: 'STAGED',
  });
  const configuration = useMemo(
    () => ({
      bootstrap: props.bootstrap,
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      timeoutMs: props.runtime.requestTimeoutMs,
    }),
    [
      props.bootstrap,
      props.accessToken,
      props.runtime.enterpriseCode,
      props.runtime.requestTimeoutMs,
    ],
  );
  const profile = selectModuleConnection(props.bootstrap, 'profile');
  const authority = JSON.stringify([
    props.accessToken,
    props.employeeId,
    props.runtime.enterpriseCode,
    props.bootstrap.tenantCode,
    connection?.endpoint,
    connection?.instanceId,
    connection?.environment,
    connection?.server,
    profile?.endpoint,
    profile?.instanceId,
    props.routeNavigation?.id,
    props.routeNavigation?.featureState,
    props.routeNavigation &&
      ['UP', 'DEGRADED'].includes(props.routeNavigation.availability),
  ]);
  const [state, setState] = useState<{
    authority: string;
    capability?: ProductAdministrativeCapability;
    error?: string;
  }>();
  useEffect(() => {
    if (!connection) return;
    const controller = new AbortController();
    void loadProductAdministrativeCapability(
      configuration,
      connection,
      configuration.enterpriseCode,
      controller.signal,
    )
      .then((capability) => {
        if (!controller.signal.aborted) setState({ authority, capability });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({
            authority,
            error: 'Cross-enterprise Product management is unavailable.',
          });
      });
    return () => controller.abort();
  }, [configuration, connection, authority]);
  if (!connection) return <WorkbenchRoutePage {...props} />;
  if (state?.authority !== authority)
    return <Typography role="status">Loading...</Typography>;
  if (!state.capability)
    return (
      <WorkbenchRoutePage
        {...props}
        ownerHeader={<Alert severity="info">{state.error}</Alert>}
      />
    );
  return <TargetWorkspace key={authority} {...props} capability={state.capability} />;
}
function TargetWorkspace(
  props: WorkbenchRoutePageProps & { capability: ProductAdministrativeCapability },
) {
  const [target, setTarget] = useState<ProfileEnterpriseOption | null>(null);
  const connection = selectModuleConnection(props.bootstrap, 'product', {
    runtimeRoleCode: 'COMMERCE_STAGED',
    publicationRole: 'STAGED',
  })!;
  const configuration = useMemo(
    () => ({
      bootstrap: props.bootstrap,
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      timeoutMs: props.runtime.requestTimeoutMs,
    }),
    [
      props.bootstrap,
      props.accessToken,
      props.runtime.enterpriseCode,
      props.runtime.requestTimeoutMs,
    ],
  );
  const transport = useMemo(
    () =>
      target
        ? productAdministrativeTransport(configuration, connection, target.code)
        : undefined,
    [configuration, connection, target],
  );
  const scopedBootstrap = useMemo(
    () =>
      target
        ? {
            ...props.bootstrap,
            moduleConnections: {
              ...props.bootstrap.moduleConnections,
              product: [connection],
            },
          }
        : props.bootstrap,
    [props.bootstrap, connection, target],
  );
  const ownerHeader = (
    <Stack spacing={2} sx={{ minWidth: 0, mb: 1 }}>
      <Typography variant="h6">{props.capability.labels.title}</Typography>
      <ProfileEnterpriseSelector
        label={props.capability.labels.targetEnterpriseCode}
        configuration={configuration}
        value={target}
        onChange={setTarget}
        disabled={false}
        searchEnterprises={searchProfileParticipantEnterprises}
      />
      {target && (
        <Typography>
          {props.capability.labels.targetEnterpriseCode}: {target.label} · Actor:{' '}
          {String(props.capability.audit.actorCode)} · Enterprise:{' '}
          {configuration.enterpriseCode}
        </Typography>
      )}
    </Stack>
  );
  return (
    <WorkbenchRoutePage
      key={target?.code || 'own-enterprise'}
      {...props}
      bootstrap={scopedBootstrap}
      ownerTransport={transport}
      ownerHeader={ownerHeader}
    />
  );
}
