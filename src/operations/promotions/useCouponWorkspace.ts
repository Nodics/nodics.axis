/** Loads owner copy and admission; current session/runtime authority retires stale replies and drafts. */
import { useEffect, useMemo, useState } from 'react';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { invokeOperationalOwner } from '../shared/operationalOwnerClient';
import { couponWorkspace, type CouponWorkspace } from './couponOfferClient';

export type CouponWorkspaceProps = {
  bootstrap: AxisAuthenticatedBootstrap;
  accessToken: string;
  runtime: AxisRuntimeConfig;
  sessionGeneration?: number;
};
const selectors = {
  authoring: { runtimeRoleCode: 'COMMERCE_STAGED', publicationRole: 'STAGED' },
  reporting: { runtimeRoleCode: 'COMMERCE', publicationRole: 'ONLINE' },
} as const;

/** No fallback runtime and no navigation inferred from a path; admission is the owner's exact native workspace. */
export function useCouponWorkspace(
  props: CouponWorkspaceProps,
  mode: keyof typeof selectors,
) {
  const { bootstrap, accessToken, runtime, sessionGeneration = 0 } = props;
  const workspaceCode =
    mode === 'authoring' ? 'promotion.couponOffers' : 'promotion.couponAcquisition';
  const navigation = bootstrap.navigation.find(
    (item) =>
      item.moduleName === 'promotion' &&
      item.backendWorkspace?.workspaceCode === workspaceCode &&
      item.backendWorkspace.viewCode === mode,
  );
  const connection = selectModuleConnection(bootstrap, 'promotion', selectors[mode]);
  const allowed =
    !!navigation &&
    ['ACTIVE', 'PREVIEW'].includes(navigation.featureState || '') &&
    ['UP', 'DEGRADED'].includes(navigation.availability) &&
    !!connection;
  const ownerIdentity = JSON.stringify([
    connection?.endpoint,
    connection?.instanceId,
    connection?.state,
    navigation?.route,
    navigation?.featureState,
    navigation?.availability,
  ]);
  const authority = useMemo(
    () => ({
      accessToken,
      sessionGeneration,
      tenantCode: bootstrap.tenantCode,
      enterpriseCode: runtime.enterpriseCode,
      projectCode: runtime.projectCode,
      ownerIdentity,
    }),
    [
      accessToken,
      sessionGeneration,
      bootstrap.tenantCode,
      runtime.enterpriseCode,
      runtime.projectCode,
      ownerIdentity,
    ],
  );
  const configuration = useMemo(
    () => ({
      bootstrap,
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      timeoutMs: runtime.requestTimeoutMs,
      ownerSelector: selectors[mode],
    }),
    [bootstrap, accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs, mode],
  );
  const [state, setState] = useState<{
    authority: object;
    configuration: object;
    workspace?: CouponWorkspace;
    error?: string;
  }>();
  useEffect(() => {
    if (!allowed) return;
    let current = true;
    void invokeOperationalOwner(
      configuration,
      'promotion',
      '/promotions/coupon-offers/workspace',
    )
      .then(couponWorkspace)
      .then((workspace) => {
        if (current) setState({ authority, configuration, workspace });
      })
      .catch(() => {
        if (current)
          setState({
            authority,
            configuration,
            error: 'The owner workspace could not be loaded.',
          });
      });
    return () => {
      current = false;
    };
  }, [configuration, authority, allowed]);
  const current = allowed && state?.authority === authority ? state : undefined;
  return {
    allowed,
    configuration,
    authority,
    workspace: current?.workspace,
    error: current?.error,
    pending: current?.configuration !== configuration,
  };
}
