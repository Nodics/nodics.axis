import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  activeConnections,
  connectionKey,
  dashboardCardPadding,
  dashboardComponentGap,
  dashboardContentGap,
  loadWorkbenchMetrics,
  metricsById,
  type WorkbenchMetricDefinition,
} from '../shared/workbenchMetricDashboardModel';
import { DashboardSection } from '../shared/WorkbenchMetricDashboard';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';

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

const metricDefinitionsByRoute = Object.freeze({
  '/publishing/requests': Object.freeze([
    Object.freeze({
      id: 'publishing-requests',
      label: 'Publishing requests',
      moduleName: 'publish',
      schemaName: 'publicationRequest',
      description: 'Governed requests moving staged content toward delivery.',
      route: '/publishing/requests',
      icon: 'workflow',
    }),
    Object.freeze({
      id: 'publishing-manifests',
      label: 'Publication manifests',
      moduleName: 'cms',
      schemaName: 'cmsPublicationManifest',
      description: 'Generated evidence describing prepared publishing payloads.',
      route: '/publishing/manifests',
      icon: 'file',
    }),
  ]),
  '/publishing/status': Object.freeze([
    Object.freeze({
      id: 'publishing-status',
      label: 'Publishing status',
      moduleName: 'cms',
      schemaName: 'cmsOnlinePublicationPointer',
      description: 'Operational status for staged-to-online publication flow.',
      route: '/publishing/status',
      icon: 'status',
    }),
    Object.freeze({
      id: 'publishing-history',
      label: 'Publishing history',
      moduleName: 'cms',
      schemaName: 'cmsPublicationDeploymentReceipt',
      description: 'Historical publishing receipts and deployment evidence.',
      route: '/publishing/history',
      icon: 'history',
    }),
  ]),
  '/publishing/manifests': Object.freeze([
    Object.freeze({
      id: 'publishing-manifests',
      label: 'Publication manifests',
      moduleName: 'cms',
      schemaName: 'cmsPublicationManifest',
      description: 'Generated evidence describing prepared publishing payloads.',
      route: '/publishing/manifests',
      icon: 'file',
    }),
  ]),
  '/publishing/history': Object.freeze([
    Object.freeze({
      id: 'publishing-history',
      label: 'Publishing history',
      moduleName: 'cms',
      schemaName: 'cmsPublicationDeploymentReceipt',
      description: 'Historical publishing receipts and deployment evidence.',
      route: '/publishing/history',
      icon: 'history',
    }),
    Object.freeze({
      id: 'publishing-audit',
      label: 'Publishing audit',
      moduleName: 'publish',
      schemaName: 'publicationAudit',
      description: 'Traceability records for publishing operations.',
      route: '/publishing/audit',
      icon: 'audit',
    }),
  ]),
  '/publishing/audit': Object.freeze([
    Object.freeze({
      id: 'publishing-audit',
      label: 'Publishing audit',
      moduleName: 'publish',
      schemaName: 'publicationAudit',
      description: 'Traceability records for publishing operations.',
      route: '/publishing/audit',
      icon: 'audit',
    }),
  ]),
  '/publishing/scheduled': Object.freeze([
    Object.freeze({
      id: 'scheduled-publication-requests',
      label: 'Scheduled publication requests',
      moduleName: 'publish',
      schemaName: 'publicationRequest',
      description: 'Future-dated or queued publication requests awaiting governance.',
      route: '/publishing/scheduled',
      icon: 'workflow',
    }),
  ]),
  '/publishing/online': Object.freeze([
    Object.freeze({
      id: 'online-publication-pointers',
      label: 'Online publication pointers',
      moduleName: 'cms',
      schemaName: 'cmsOnlinePublicationPointer',
      description: 'Current Online targets served by customer-facing channels.',
      route: '/publishing/online',
      icon: 'status',
    }),
    Object.freeze({
      id: 'online-publication-history',
      label: 'Publishing history',
      moduleName: 'cms',
      schemaName: 'cmsPublicationDeploymentReceipt',
      description: 'Receipts proving how the current Online state was reached.',
      route: '/publishing/history',
      icon: 'history',
    }),
  ]),
  '/publishing/dependencies': Object.freeze([
    Object.freeze({
      id: 'dependency-manifests',
      label: 'Publication manifests',
      moduleName: 'cms',
      schemaName: 'cmsPublicationManifest',
      description: 'Prepared payload and dependency evidence.',
      route: '/publishing/manifests',
      icon: 'file',
    }),
  ]),
  '/publishing/failures': Object.freeze([
    Object.freeze({
      id: 'failure-audit',
      label: 'Publishing audit',
      moduleName: 'publish',
      schemaName: 'publicationAudit',
      description: 'Audit evidence for failed, retried, or recovered operations.',
      route: '/publishing/audit',
      icon: 'audit',
    }),
  ]),
  '/publishing/withdrawals': Object.freeze([
    Object.freeze({
      id: 'rollback-history',
      label: 'Publishing history',
      moduleName: 'cms',
      schemaName: 'cmsPublicationDeploymentReceipt',
      description: 'Receipts used to choose rollback or withdrawal targets.',
      route: '/publishing/history',
      icon: 'history',
    }),
    Object.freeze({
      id: 'rollback-audit',
      label: 'Publishing audit',
      moduleName: 'publish',
      schemaName: 'publicationAudit',
      description: 'Traceability for withdrawal, rollback, retire, and re-publish decisions.',
      route: '/publishing/audit',
      icon: 'audit',
    }),
  ]),
  '/publishing/configuration': Object.freeze([
    Object.freeze({
      id: 'configuration-requests',
      label: 'Publishing requests',
      moduleName: 'publish',
      schemaName: 'publicationRequest',
      description: 'Operational publishing requests affected by policy and target mapping.',
      route: '/publishing/requests',
      icon: 'workflow',
    }),
  ]),
} satisfies Record<string, readonly WorkbenchMetricDefinition[]>);

const roleGuidance = Object.freeze([
  Object.freeze({
    role: 'Creator',
    responsibility: 'Prepare content, data packs, media, or accelerator initialization.',
    boundary: 'Cannot make Online visible without approval.',
  }),
  Object.freeze({
    role: 'Approver',
    responsibility: 'Approve or reject Process tasks after checking target and impact.',
    boundary: 'Must record a reason and verify Online after decision.',
  }),
  Object.freeze({
    role: 'Enterprise admin',
    responsibility: 'Own target profiles, policy, module activation, and recovery oversight.',
    boundary: 'Should not bypass workflow evidence for convenience.',
  }),
  Object.freeze({
    role: 'Viewer',
    responsibility: 'Inspect status, history, audit, and live evidence.',
    boundary: 'Read-only access; no publishing state changes.',
  }),
]);

const rollbackValidationSteps = Object.freeze([
  'Identify current Online pointer and last approved receipt.',
  'Choose rollback, withdrawal, retire, or re-publish target from history.',
  'Confirm business reason, requester, approver, and affected channel.',
  'Execute only through governed operation, then check audit.',
  'Browser-verify Nexus, Agora, or target customer-facing page.',
]);

const routeReadinessChecks = Object.freeze({
  '/publishing/requests': Object.freeze([
    'Request has target scope: enterprise, tenant, site or profile, module or accelerator, and environment.',
    'Request is not a duplicate of an open approval or an incompatible target revision.',
    'Request includes business reason, source package, manifest, and workflow reference.',
  ]),
  '/publishing/status': Object.freeze([
    'Online pointer matches the approved target version and publication revision.',
    'Staged-to-Online movement did not bypass Process approval.',
    'Browser verification confirms the intended public or operator-facing result.',
  ]),
  '/publishing/manifests': Object.freeze([
    'Manifest declares package class: init, core, sample, project, docs, or media.',
    'Manifest references are resolvable and dependency warnings are understood before approval.',
    'Checksum and source version remain stable between preview, submit, approval, and publish.',
  ]),
  '/publishing/history': Object.freeze([
    'Receipt links request, workflow, actor, target version, Online pointer, and completion time.',
    'Rollback candidate is explicit before any reverse operation.',
    'Rejected, withdrawn, retired, restored, and rolled-back outcomes keep reason visibility.',
  ]),
  '/publishing/audit': Object.freeze([
    'Audit trail links request code, workflow reference, actor, action, reason, and correlation id.',
    'Failure or retry entries explain whether Online changed.',
    'Audit evidence can be used to reconstruct request-to-Online and Online-to-source traceability.',
  ]),
  '/publishing/scheduled': Object.freeze([
    'Schedule does not activate before approval is complete.',
    'Cancel or withdraw path is clear before the activation window.',
    'Target version and scope are still valid at activation time.',
  ]),
  '/publishing/online': Object.freeze([
    'Live pointer, revision, and target route match the approved request.',
    'Nexus, Agora, or target channel renders the expected Online state in browser.',
    'History and audit can explain how the current Online state was reached.',
  ]),
  '/publishing/dependencies': Object.freeze([
    'Content, media, layout, localization, catalog, and search dependencies are declared.',
    'Blocking dependencies are fixed before approval instead of becoming runtime surprises.',
    'Warning-only dependencies are visible to the approver with business impact.',
  ]),
  '/publishing/failures': Object.freeze([
    'Failure reason, retry count, compensation state, and correlation id are visible.',
    'Operator can tell whether Online changed before retrying.',
    'Recovery action points to audit, status, and browser verification.',
  ]),
  '/publishing/withdrawals': Object.freeze([
    'Current Online state and rollback or withdrawal target are visible.',
    'Reason is mandatory and survives history and audit views.',
    'Reverse operation ends with Online status and browser verification.',
  ]),
  '/publishing/configuration': Object.freeze([
    'Approval requirement, target mapping, runtime role, and schema ownership are visible.',
    'Configuration changes cannot weaken Staged-to-Online approval guarantees.',
    'Version-zero policy remains explicit while Nodics is still pre-release.',
  ]),
} satisfies Record<keyof typeof publishingRouteGuidance, readonly string[]>);

const traceabilityChecklist = Object.freeze([
  'Request code',
  'Workflow reference',
  'Target scope',
  'Manifest or source package',
  'Actor and decision',
  'Reason',
  'Online pointer or receipt',
  'Browser evidence',
]);

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
  accessToken,
  bootstrap,
  path,
  routeNavigation,
  runtime,
}: PublishingRouteGuidancePageProps) {
  const normalizedPath = normalizePublishingPath(path);
  const guidance = publishingRouteGuidance[normalizedPath];
  const routeMetrics = metricDefinitionsByRoute[normalizedPath];
  const readinessChecks = routeReadinessChecks[normalizedPath];
  const connections = useMemo(() => activeConnections(bootstrap), [bootstrap]);
  const configuration = useMemo(
    () => ({
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs],
  );
  const metrics = useQuery({
    queryKey: [
      'publishing-route-guidance',
      normalizedPath,
      runtime.enterpriseCode,
      connectionKey(connections),
    ],
    queryFn: () => loadWorkbenchMetrics(connections, bootstrap, configuration, routeMetrics),
  });
  return (
    <WorkspaceContainer>
      <Stack spacing={dashboardComponentGap}>
        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
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

        <DashboardSection
          description="Live backend counts for the schemas that support this publishing route."
          loading={metrics.isPending}
          metrics={metricsById(metrics.data, routeMetrics)}
          title="Live workbench evidence"
        />

        {metrics.isError ? (
          <Alert severity="warning">
            {metrics.error instanceof Error
              ? metrics.error.message
              : 'Publishing route metrics are currently unavailable.'}
          </Alert>
        ) : null}

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <Box>
              <Typography variant="h5">Readiness, conflict, and trace checks</Typography>
              <Typography color="text.secondary">
                Use these checks before treating this route as complete. They keep
                Online readiness, Staged health, duplicate request prevention, and
                reason visibility in the same operator path.
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', lg: '1.15fr 0.85fr' },
              }}
            >
              <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
                <Stack spacing={1.25}>
                  <Typography variant="h6">Route readiness checks</Typography>
                  {readinessChecks.map((check, index) => (
                    <Stack
                      direction="row"
                      key={check}
                      spacing={1.25}
                      sx={{ alignItems: 'flex-start' }}
                    >
                      <Chip label={String(index + 1)} size="small" />
                      <Typography color="text.secondary" variant="body2">
                        {check}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
              <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
                <Stack spacing={1.25}>
                  <Typography variant="h6">Traceability must show</Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {traceabilityChecklist.map((item) => (
                      <Chip key={item} label={item} size="small" variant="outlined" />
                    ))}
                  </Stack>
                  <Alert severity="info">
                    If any trace element is missing, the operator should keep the item
                    in review instead of declaring the publication complete.
                  </Alert>
                </Stack>
              </Paper>
            </Box>
          </Stack>
        </Paper>

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
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

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <Box>
              <Typography variant="h5">Role and access guidance</Typography>
              <Typography color="text.secondary">
                These are the target publishing responsibilities. Backend permissions
                remain authoritative; Axis should explain them before roles are fully
                separated.
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {roleGuidance.map((item) => (
                <Paper
                  component="article"
                  elevation={0}
                  key={item.role}
                  sx={{ border: 1, borderColor: 'divider', p: 2 }}
                >
                  <Stack spacing={1}>
                    <Chip color="warning" label={item.role} size="small" />
                    <Typography variant="body2">{item.responsibility}</Typography>
                    <Typography color="text.secondary" variant="caption">
                      Boundary: {item.boundary}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Box>
          </Stack>
        </Paper>

        {normalizedPath === '/publishing/failures' ||
        normalizedPath === '/publishing/withdrawals' ||
        normalizedPath === '/publishing/history' ? (
          <Paper
            component="section"
            elevation={0}
            sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
          >
            <Stack spacing={dashboardContentGap}>
              <Box>
                <Typography variant="h5">Recovery validation checklist</Typography>
                <Typography color="text.secondary">
                  Use this checklist before executing rollback, withdrawal, retire, or
                  re-publish operations.
                </Typography>
              </Box>
              <Stack spacing={1}>
                {rollbackValidationSteps.map((step, index) => (
                  <Paper
                    component="article"
                    elevation={0}
                    key={step}
                    sx={{ border: 1, borderColor: 'divider', p: 1.5 }}
                  >
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Chip label={String(index + 1)} size="small" />
                      <Typography>{step}</Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
              <Alert severity="warning">
                Do not execute recovery blindly. A valid recovery ends with Process or
                audit evidence plus browser verification of the target public channel.
              </Alert>
            </Stack>
          </Paper>
        ) : null}
      </Stack>
    </WorkspaceContainer>
  );
}
