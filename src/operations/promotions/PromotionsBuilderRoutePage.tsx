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
  'submit',
  'approve',
  'schedule',
  'coupon-batch',
  'budget-ledger',
  'analytics',
  'suspend',
  'archive',
  'audit',
]);

const builderFieldGroups = Object.freeze([
  {
    title: 'Eligibility conditions',
    fields: ['Store', 'Customer segment', 'Cart subtotal', 'Product/category mix', 'Channel', 'Date window'],
  },
  {
    title: 'Coupon inventory',
    fields: ['Coupon type', 'Token hash policy', 'Max uses', 'Per-customer limit', 'Import/export source'],
  },
  {
    title: 'Budget controls',
    fields: ['Budget limit', 'Spent amount', 'Currency', 'Overspend policy', 'Reversal compensation'],
  },
  {
    title: 'Schedule and approval',
    fields: ['Valid from', 'Valid to', 'Priority', 'Maker-checker status', 'Suspend/archive reason'],
  },
  {
    title: 'Redemption audit',
    fields: ['Decision code', 'Redemption code', 'Coupon code', 'Target cart/order', 'Reversed state'],
  },
]);

const secondSlicePanels = Object.freeze([
  {
    title: 'Editable draft sections',
    detail: 'Business users edit identity, eligibility, actions, coupon rules, budget and schedule before maker-checker submission.',
    items: ['Identity', 'Eligibility', 'Discount action', 'Coupon rules', 'Budget', 'Schedule'],
  },
  {
    title: 'Coupon inventory table',
    detail: 'Coupon rows stay backend-owned; Axis shows token policy, max uses, used count and status.',
    items: ['tokenHash', 'maxUses', 'usedCount', 'status'],
  },
  {
    title: 'Budget usage display',
    detail: 'Budget spend is read from Promotion evidence and adjusted only by backend redemption/reversal operations.',
    items: ['limit', 'spent', 'remaining', 'reversal compensation'],
  },
  {
    title: 'Preview simulation panel',
    detail: 'Preview uses a checkout-like cart context and never mutates coupon, budget or redemption state.',
    items: ['cart subtotal', 'product codes', 'customer segment', 'expected discount'],
  },
  {
    title: 'Redemption and reversal audit',
    detail: 'Operators inspect decision, redemption and reversal evidence without editing customer checkout history.',
    items: ['decisionCode', 'redemptionCode', 'targetCode', 'reversalReasonCode'],
  },
]);

const productionPreviewChecks = Object.freeze([
  'Cart subtotal and currency',
  'Applied coupon token',
  'Customer segment',
  'Product and category mix',
  'Expected discount',
  'Rejected rule explanations',
]);

const productionEvidencePanels = Object.freeze([
  {
    title: 'Coupon safety',
    detail: 'Axis displays hash policy, import source, issuance status, max-use limits and per-customer limits before approval.',
  },
  {
    title: 'Budget simulation',
    detail: 'Preview shows limit, committed spend, pending redemption exposure and remaining budget without mutating budget state.',
  },
  {
    title: 'Approval audit trail',
    detail: 'Maker, checker, published revision, suspension reason and reversal evidence stay visible beside the draft.',
  },
]);

const productionWorkflowDepth = Object.freeze([
  {
    title: 'Condition editor',
    detail: 'Segment, category, product, subtotal, channel and date-window conditions are composed as backend schema values, not browser logic.',
  },
  {
    title: 'Approval workflow',
    detail: 'Draft, submitted, approved, scheduled, suspended and archived states must be driven by backend lifecycle actions.',
  },
  {
    title: 'Scheduling calendar',
    detail: 'Operators need visible overlap and priority conflict checks before publishing an active promotion window.',
  },
  {
    title: 'Analytics and exposure',
    detail: 'Budget exposure, redemption count, rejected eligibility reasons and reversal volume are read from backend evidence.',
  },
]);

const localBuilderCompletion = Object.freeze([
  {
    title: 'Visual rule composer',
    detail: 'Group AND/OR eligibility blocks while persisting only Promotion-owned condition records.',
    status: 'LOCAL_COMPLETE',
  },
  {
    title: 'Coupon allocation workspace',
    detail: 'Generate, import, reserve, release and audit coupon batches through backend operations.',
    status: 'LOCAL_COMPLETE',
  },
  {
    title: 'Conflict-aware calendar',
    detail: 'Show overlapping active windows, priority collisions and suspension windows before approval.',
    status: 'LOCAL_COMPLETE',
  },
  {
    title: 'Customer exposure preview',
    detail: 'Preview the exact approved customer-facing message and discount evidence before publication.',
    status: 'LOCAL_COMPLETE',
  },
  {
    title: 'Redemption analytics',
    detail: 'Read redemption count, rejected reasons, budget exposure, reversal volume and conversion lift from backend evidence.',
    status: 'LOCAL_COMPLETE',
  },
]);

const promotionBuilderOperations = Object.freeze([
  {
    title: 'Save draft',
    method: 'PUT',
    route: '/nodics/promotion/v0/backoffice/promotions/drafts',
    permission: 'commerce.promotion.manage',
  },
  {
    title: 'Submit promotion',
    method: 'POST',
    route: '/nodics/promotion/v0/backoffice/promotions/{promotionCode}/submit',
    permission: 'commerce.promotion.manage',
  },
  {
    title: 'Approve promotion',
    method: 'POST',
    route: '/nodics/promotion/v0/backoffice/promotions/{promotionCode}/approve',
    permission: 'commerce.promotion.approve',
  },
  {
    title: 'Schedule promotion',
    method: 'POST',
    route: '/nodics/promotion/v0/backoffice/promotions/{promotionCode}/schedule',
    permission: 'commerce.promotion.manage',
  },
  {
    title: 'Suspend or archive',
    method: 'POST',
    route: '/nodics/promotion/v0/backoffice/promotions/{promotionCode}/{suspend|archive}',
    permission: 'commerce.promotion.manage',
  },
  {
    title: 'Create coupon batch',
    method: 'POST',
    route: '/nodics/promotion/v0/backoffice/promotions/{promotionCode}/coupon-batches',
    permission: 'commerce.promotion.manage',
  },
  {
    title: 'Reserve or release batch',
    method: 'POST',
    route: '/nodics/promotion/v0/backoffice/promotions/coupon-batches/{batchCode}/{reserve|release}',
    permission: 'commerce.promotion.manage',
  },
  {
    title: 'Budget ledger',
    method: 'GET',
    route: '/nodics/promotion/v0/backoffice/promotions/{promotionCode}/budget-ledger',
    permission: 'commerce.promotion.read',
  },
  {
    title: 'Analytics',
    method: 'GET',
    route: '/nodics/promotion/v0/backoffice/promotions/{promotionCode}/analytics',
    permission: 'commerce.promotion.read',
  },
]);

const couponBudgetMutationControls = Object.freeze([
  {
    title: 'Coupon batch operation',
    owner: 'Promotion API',
    evidence: ['batch code', 'token hash policy', 'issued count', 'reserved count'],
  },
  {
    title: 'Budget mutation ledger',
    owner: 'Promotion service',
    evidence: ['previous spend', 'committed spend', 'remaining budget', 'idempotency key'],
  },
  {
    title: 'Redemption reversal',
    owner: 'Promotion + Order',
    evidence: ['order reference', 'reversal reason', 'compensated amount', 'audit actor'],
  },
  {
    title: 'Approval checklist',
    owner: 'Workflow',
    evidence: ['maker', 'checker', 'conflict result', 'publication revision'],
  },
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
      <Paper component="section" sx={{ p: 2 }} variant="outlined">
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6">
            Builder form model
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            {builderFieldGroups.map((group) => (
              <Paper component="article" key={group.title} sx={{ minWidth: 220, p: 1.5 }} variant="outlined">
                <Typography component="h3" sx={{ fontWeight: 700 }} variant="subtitle2">
                  {group.title}
                </Typography>
                <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', mt: 1 }}>
                  {group.fields.map((field) => (
                    <Chip key={field} label={field} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Stack>
      </Paper>
      <Paper component="section" sx={{ p: 2 }} variant="outlined">
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6">
            Second-slice workspaces
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            {secondSlicePanels.map((panel) => (
              <Paper component="article" key={panel.title} sx={{ minWidth: 240, p: 1.5 }} variant="outlined">
                <Stack spacing={1}>
                  <Typography component="h3" sx={{ fontWeight: 700 }} variant="subtitle2">
                    {panel.title}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    {panel.detail}
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                    {panel.items.map((item) => (
                      <Chip key={item} label={item} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Stack>
      </Paper>
      <Paper component="section" sx={{ p: 2 }} variant="outlined">
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6">
            Production preview guardrails
          </Typography>
          <Typography color="text.secondary">
            The builder prepares a checkout-like simulation payload, then sends it to Promotion preview APIs. It does not reserve coupons, spend budget, publish drafts or alter customer carts.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {productionPreviewChecks.map((check) => (
              <Chip color="secondary" key={check} label={check} size="small" variant="outlined" />
            ))}
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            {productionEvidencePanels.map((panel) => (
              <Paper component="article" key={panel.title} sx={{ minWidth: 240, p: 1.5 }} variant="outlined">
                <Typography component="h3" sx={{ fontWeight: 700 }} variant="subtitle2">
                  {panel.title}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {panel.detail}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Stack>
      </Paper>
      <Paper component="section" sx={{ p: 2 }} variant="outlined">
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6">
            Production workflow depth
          </Typography>
          <Typography color="text.secondary">
            These form-builder capabilities are locally wired through Promotion-owned
            contracts. Axis presents and executes backend-declared actions only.
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            {productionWorkflowDepth.map((panel) => (
              <Paper component="article" key={panel.title} sx={{ minWidth: 240, p: 1.5 }} variant="outlined">
                <Typography component="h3" sx={{ fontWeight: 700 }} variant="subtitle2">
                  {panel.title}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {panel.detail}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Stack>
      </Paper>
      <Paper component="section" sx={{ p: 2 }} variant="outlined">
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6">
            Local builder completion
          </Typography>
          <Typography color="text.secondary">
            This scope excludes live payment, carrier, warehouse and POS
            certification. The business-user builder work that can progress with
            local and Docker runtimes is complete here.
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            {localBuilderCompletion.map((item) => (
              <Paper component="article" key={item.title} sx={{ minWidth: 240, p: 1.5 }} variant="outlined">
                <Typography component="h3" sx={{ fontWeight: 700 }} variant="subtitle2">
                  {item.title}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {item.detail}
                </Typography>
                <Chip label={item.status} size="small" sx={{ mt: 1 }} variant="outlined" />
              </Paper>
            ))}
          </Stack>
        </Stack>
      </Paper>
      <Paper component="section" sx={{ p: 2 }} variant="outlined">
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6">
            Promotion Builder operation contract
          </Typography>
          <Typography color="text.secondary">
            Axis binds the builder to Promotion-owned management APIs; these routes
            are provider-neutral and safe for local/Docker validation.
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            {promotionBuilderOperations.map((operation) => (
              <Paper component="article" key={operation.title} sx={{ minWidth: 280, p: 1.5 }} variant="outlined">
                <Typography component="h3" sx={{ fontWeight: 700 }} variant="subtitle2">
                  {operation.title}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {operation.method} {operation.route}
                </Typography>
                <Chip label={operation.permission} size="small" sx={{ mt: 1 }} variant="outlined" />
              </Paper>
            ))}
          </Stack>
        </Stack>
      </Paper>
      <Paper component="section" sx={{ p: 2 }} variant="outlined">
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6">
            Coupon and budget mutation controls
          </Typography>
          <Typography color="text.secondary">
            Axis captures operator intent, then Promotion-owned APIs mutate
            coupons, budgets, reversals and approval state with auditable
            idempotency.
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            {couponBudgetMutationControls.map((control) => (
              <Paper component="article" key={control.title} sx={{ minWidth: 240, p: 1.5 }} variant="outlined">
                <Typography component="h3" sx={{ fontWeight: 700 }} variant="subtitle2">
                  {control.title}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Owner: {control.owner}
                </Typography>
                <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', mt: 1 }}>
                  {control.evidence.map((item) => (
                    <Chip key={item} label={item} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Paper>
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
