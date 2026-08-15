import { Alert, Chip, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';

import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkbenchRoutePage } from '../../workbench/WorkbenchRoutePage';

interface PromotionsBuilderRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly channel: string;
  readonly cmsBaseUrl: string;
  readonly employeeId: string;
  readonly locale: string;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
  readonly site: string;
}

const builderStages = Object.freeze([
  'Eligibility',
  'Actions',
  'Priority',
  'Coupon and budget',
  'Preview',
  'Publish',
]);

/**
 * Renders the Promotion-owned builder workbench. Axis owns layout, operator
 * guidance, and safe presentation defaults only; promotion rules, validation,
 * coupon redemption, budgets, approvals, and publication remain backend-owned.
 */
export function PromotionsBuilderRoutePage(props: PromotionsBuilderRoutePageProps) {
  const routeNavigation = useMemo<AxisNavigationItem>(
    () => ({
      ...props.navigation,
      moduleName: 'promotion',
      workbenchTarget: {
        moduleName: 'promotion',
        schemaName: 'promotion',
      },
      workbenchPresentation: {
        ...props.navigation.workbenchPresentation,
        defaultColumns: [
          'code',
          'name',
          'status',
          'priority',
          'validFrom',
          'validTo',
          'revision',
        ],
      },
    }),
    [props.navigation],
  );

  return (
    <Stack spacing={2}>
      <Stack spacing={0.75}>
        <Typography variant="h4">Promotions Builder</Typography>
        <Typography color="text.secondary">
          Compose business-user promotions through the Promotion-owned workbench
          contract. Axis does not calculate eligibility or mutate redemption state.
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {builderStages.map((stage) => (
          <Chip key={stage} label={stage} variant="outlined" />
        ))}
      </Stack>
      <Alert severity="info">
        Builder changes stay governed by backend schemas, permissions, maker-checker
        policy, and publication flow. Customer checkout receives only the approved
        Promotion preview/apply API.
      </Alert>
      <WorkbenchRoutePage
        accessToken={props.accessToken}
        bootstrap={props.bootstrap}
        channel={props.channel}
        cmsBaseUrl={props.cmsBaseUrl}
        employeeId={props.employeeId}
        locale={props.locale}
        routeNavigation={routeNavigation}
        routeSchema={routeNavigation.workbenchTarget}
        runtime={props.runtime}
        site={props.site}
      />
    </Stack>
  );
}
