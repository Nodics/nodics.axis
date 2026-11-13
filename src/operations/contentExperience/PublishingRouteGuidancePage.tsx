import { usePublishingGuidanceCopy } from './publishingGuidanceCopy';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router';
import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import { ShellIcon } from '../../app/shell/ShellIcon';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { PublicationInspectionPanel } from './PublicationInspectionPanel';
interface PublishingRouteGuidancePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly path: string;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}
const publishingRouteGuidance = Object.freeze({
  '/publishing/requests': Object.freeze({
    title: 'Publication Requests',
    eyebrow: 'Inspect',
    summary:
      'Review the governed request that was created after setup, import, or content submission.',
    evidence:
      'Look for source version, target site or application, requested operation, generated manifest, and workflow reference.',
    primaryAction: 'Review approval queue',
    primaryRoute: '/process/tasks',
    secondaryAction: 'Open manifests',
    secondaryRoute: '/publishing/manifests',
  }),
  '/publishing/status': Object.freeze({
    title: 'Staged-to-Online Operations',
    eyebrow: 'Verify',
    summary:
      'Confirm whether the approved Staged content has moved the authoritative Online pointer.',
    evidence:
      'Look for Online pointer state, target version, publication revision, deployment status, and browser verification result.',
    primaryAction: 'View history',
    primaryRoute: '/publishing/history',
    secondaryAction: 'Inspect audit',
    secondaryRoute: '/publishing/audit',
  }),
  '/publishing/manifests': Object.freeze({
    title: 'Publication Manifests',
    eyebrow: 'Evidence',
    summary:
      'Inspect the generated publishing payload before or after approval so operators know exactly what can move Online.',
    evidence:
      'Look for source records, dependencies, target profile, release code, and generated hashes.',
    primaryAction: 'View requests',
    primaryRoute: '/publishing/requests',
    secondaryAction: 'Check Online status',
    secondaryRoute: '/publishing/status',
  }),
  '/publishing/history': Object.freeze({
    title: 'Publishing History',
    eyebrow: 'Receipts',
    summary:
      'Use deployment receipts to understand what was published, rejected, retired, or rolled back over time.',
    evidence:
      'Look for deployment receipt, Online target version, completion time, reviewer, and rollback candidate.',
    primaryAction: 'Confirm Online state',
    primaryRoute: '/publishing/status',
    secondaryAction: 'Inspect audit',
    secondaryRoute: '/publishing/audit',
  }),
  '/publishing/audit': Object.freeze({
    title: 'Publishing Audit',
    eyebrow: 'Traceability',
    summary:
      'Use audit records when proving who requested, approved, rejected, retried, recovered, or retired a publication.',
    evidence:
      'Look for actor, decision, reason, correlation id, workflow reference, and affected publication code.',
    primaryAction: 'View requests',
    primaryRoute: '/publishing/requests',
    secondaryAction: 'View history',
    secondaryRoute: '/publishing/history',
  }),
  '/publishing/scheduled': Object.freeze({
    title: 'Scheduled Publications',
    eyebrow: 'Planned',
    summary:
      'Prepare future publications without bypassing approval, audit, or final Online verification.',
    evidence:
      'Look for schedule, target version, approval state, owner, and safe withdrawal path before activation time.',
    primaryAction: 'Review requests',
    primaryRoute: '/publishing/requests',
    secondaryAction: 'Withdrawals & rollbacks',
    secondaryRoute: '/publishing/withdrawals',
  }),
  '/publishing/online': Object.freeze({
    title: 'Online Publications',
    eyebrow: 'Live',
    summary:
      'Review what Online currently serves to Nexus, Agora, and other customer-facing channels.',
    evidence:
      'Look for live pointer, site or storefront, version, publication revision, and browser URL to verify.',
    primaryAction: 'Check status',
    primaryRoute: '/publishing/status',
    secondaryAction: 'View history',
    secondaryRoute: '/publishing/history',
  }),
  '/publishing/dependencies': Object.freeze({
    title: 'Publication Dependencies',
    eyebrow: 'Readiness',
    summary:
      'Inspect upstream content, media, localization, and commerce dependencies before approving Online movement.',
    evidence:
      'Look for missing references, inactive media, localization gaps, incompatible versions, and blocked target schemas.',
    primaryAction: 'Open manifests',
    primaryRoute: '/publishing/manifests',
    secondaryAction: 'View requests',
    secondaryRoute: '/publishing/requests',
  }),
  '/publishing/failures': Object.freeze({
    title: 'Failures & Recovery',
    eyebrow: 'Recover',
    summary:
      'Recover failed publication operations with audit-first discipline instead of repeating actions blindly.',
    evidence:
      'Look for failed action, retry count, compensation state, correlation id, and whether Online changed.',
    primaryAction: 'Inspect audit',
    primaryRoute: '/publishing/audit',
    secondaryAction: 'Check Online status',
    secondaryRoute: '/publishing/status',
  }),
  '/publishing/withdrawals': Object.freeze({
    title: 'Withdrawals & Rollbacks',
    eyebrow: 'Reverse',
    summary:
      'Withdraw pending work or roll back approved Online movement through explicit evidence and review.',
    evidence:
      'Look for current Online version, rollback candidate, business reason, requester, approver, and browser verification.',
    primaryAction: 'View history',
    primaryRoute: '/publishing/history',
    secondaryAction: 'Inspect audit',
    secondaryRoute: '/publishing/audit',
  }),
  '/publishing/configuration': Object.freeze({
    title: 'Publishing Configuration',
    eyebrow: 'Governance',
    summary:
      'Review the publication policy surface before changing operational behavior, approval gates, or target mappings.',
    evidence:
      'Look for target profile, approval requirement, runtime role, schema ownership, and environment-specific constraints.',
    primaryAction: 'Open Publishing',
    primaryRoute: '/publishing',
    secondaryAction: 'Module registry',
    secondaryRoute: '/registry',
  }),
});

export function PublishingRouteGuidancePage({
  accessToken,
  bootstrap,
  path,
  routeNavigation,
  runtime,
}: PublishingRouteGuidancePageProps) {
  const location = useLocation();
  const text = usePublishingGuidanceCopy();
  const normalized = path.replace(/\/$/, '');
  const guidance =
    publishingRouteGuidance[
      normalized in publishingRouteGuidance
        ? (normalized as keyof typeof publishingRouteGuidance)
        : '/publishing/requests'
    ];
  return (
    <WorkspaceContainer>
      <Stack spacing={3}>
        <Paper component="section" variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <WorkspaceHeading
            title={text(guidance.title)}
            description={text(guidance.summary)}
            eyebrow={text(guidance.eyebrow)}
            help={routeNavigation?.help}
          />
        </Paper>
        <PublicationInspectionPanel
          key={`${path}:${location.search}:${bootstrap.tenantCode}:${runtime.enterpriseCode}`}
          accessToken={accessToken}
          bootstrap={bootstrap}
          runtime={runtime}
        />
        <Accordion
          slotProps={{ heading: { component: 'h2' } }}
          disableGutters
          elevation={0}
        >
          <AccordionSummary
            id="publishing-guide-1-heading"
            aria-controls="publishing-guide-1-panel"
            expandIcon={<ShellIcon name="chevron-down" />}
          >
            <Typography>{text('Publishing guide')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <Typography>{text(guidance.evidence)}</Typography>
              <Typography color="text.secondary">
                {text(
                  'Prepare the content, inspect the saved version, review its Process decision, then verify the website and recorded Online receipt.',
                )}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button component={RouterLink} to={guidance.primaryRoute}>
                  {text(guidance.primaryAction)}
                </Button>
                <Button component={RouterLink} to={guidance.secondaryRoute}>
                  {text(guidance.secondaryAction)}
                </Button>
              </Stack>
            </Stack>
          </AccordionDetails>
        </Accordion>
      </Stack>
    </WorkspaceContainer>
  );
}
