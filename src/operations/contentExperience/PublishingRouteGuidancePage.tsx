import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import type { AxisNavigationItem } from '../../bootstrap/publicBootstrap';

interface PublishingRouteGuidancePageProps {
  readonly path: string;
  readonly routeNavigation?: AxisNavigationItem | undefined;
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

function normalizePublishingPath(path: string): keyof typeof publishingRouteGuidance {
  const normalized = path.replace(/\/$/u, '') || '/publishing';
  if (normalized in publishingRouteGuidance) {
    return normalized as keyof typeof publishingRouteGuidance;
  }
  if (normalized.startsWith('/publishing/status')) return '/publishing/status';
  if (normalized.startsWith('/publishing/scheduled')) return '/publishing/scheduled';
  if (normalized.startsWith('/publishing/online')) return '/publishing/online';
  if (normalized.startsWith('/publishing/dependencies')) return '/publishing/dependencies';
  if (normalized.startsWith('/publishing/failures')) return '/publishing/failures';
  if (normalized.startsWith('/publishing/withdrawals')) return '/publishing/withdrawals';
  if (normalized.startsWith('/publishing/configuration')) {
    return '/publishing/configuration';
  }
  return '/publishing/requests';
}

export function PublishingRouteGuidancePage({
  path,
  routeNavigation,
}: PublishingRouteGuidancePageProps) {
  const guidance = publishingRouteGuidance[normalizePublishingPath(path)];
  return (
    <WorkspaceContainer>
      <Stack spacing={3}>
        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
        >
          <Stack spacing={2}>
            <WorkspaceHeading
              description={guidance.summary}
              eyebrow={guidance.eyebrow}
              help={routeNavigation?.help}
              title={guidance.title}
            />
            <Alert severity="info">
              This page is part of the guided publishing journey. Use it with Setup,
              Publishing Requests, Process approvals, Online Status, History, Audit, and
              browser verification rather than as an isolated table.
            </Alert>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: '1.2fr 0.8fr' },
              }}
            >
              <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="h6">What to verify here</Typography>
                  <Typography color="text.secondary">{guidance.evidence}</Typography>
                </Stack>
              </Paper>
              <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
                <Stack spacing={1.25}>
                  <Typography variant="h6">Next best actions</Typography>
                  <Button
                    component={RouterLink}
                    to={guidance.primaryRoute}
                    variant="contained"
                  >
                    {guidance.primaryAction}
                  </Button>
                  <Button
                    component={RouterLink}
                    to={guidance.secondaryRoute}
                    variant="outlined"
                  >
                    {guidance.secondaryAction}
                  </Button>
                </Stack>
              </Paper>
            </Box>
          </Stack>
        </Paper>

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: { xs: 3, md: 4 } }}
        >
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip label="1. Prepare" />
              <Chip label="2. Inspect" />
              <Chip label="3. Approve or reject" />
              <Chip label="4. Verify Online" />
              <Chip label="5. Record evidence" />
            </Stack>
            <Typography color="text.secondary">
              A publication is complete only when the Process decision and the
              user-facing browser result agree with the intended Online state.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/publishing" variant="outlined">
                Back to Publishing workspace
              </Button>
              <Button
                component={RouterLink}
                to="/setup-accelerators"
                variant="outlined"
              >
                Setup & Accelerators
              </Button>
              <Button component={RouterLink} to="/process/tasks" variant="outlined">
                Approval Queue
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </WorkspaceContainer>
  );
}
