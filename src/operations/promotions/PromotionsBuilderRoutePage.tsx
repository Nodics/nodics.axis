import { Alert, Chip, Paper, Stack, Typography } from '@mui/material';
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

const operatorFlow = Object.freeze([
  {
    title: 'Create or edit draft',
    detail: 'Business users maintain Promotion records through backend schema validation.',
  },
  {
    title: 'Preview eligibility',
    detail: 'Checkout-like context is evaluated by Promotion preview APIs before approval.',
  },
  {
    title: 'Submit and approve',
    detail: 'Maker-checker approval and publication policy stay backend governed.',
  },
  {
    title: 'Schedule, suspend or archive',
    detail: 'Activation windows, suspension and audit are Promotion-owned state changes.',
  },
  {
    title: 'Audit redemption',
    detail: 'Coupon use, budget spend, redemptions and reversals are read from backend evidence.',
  },
]);

const backendOwnedActions = Object.freeze([
  'create',
  'preview',
  'approve',
  'schedule',
  'suspend',
  'audit',
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
      <Paper component="section" sx={{ p: 2 }} variant="outlined">
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6">
            Business-user flow
          </Typography>
          <Stack component="ol" spacing={1} sx={{ m: 0, pl: 3 }}>
            {operatorFlow.map((step) => (
              <li key={step.title}>
                <Typography component="span" sx={{ fontWeight: 700 }}>
                  {step.title}
                </Typography>
                <Typography color="text.secondary">{step.detail}</Typography>
              </li>
            ))}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {backendOwnedActions.map((action) => (
              <Chip color="primary" key={action} label={`backend:${action}`} size="small" />
            ))}
          </Stack>
        </Stack>
      </Paper>
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
