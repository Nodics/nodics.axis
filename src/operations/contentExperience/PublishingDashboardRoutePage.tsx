import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisModuleConnection,
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  loadProcessOperationsSummary,
  type ProcessHumanTask,
} from '../processWorkflow/api/processDefinitionClient';
import { DashboardSection } from '../shared/WorkbenchMetricDashboard';
import {
  activeConnections,
  connectionKey,
  dashboardCardPadding,
  dashboardComponentGap,
  dashboardContentGap,
  loadWorkbenchMetrics,
  metricsById,
  totalReadyMetrics,
  type WorkbenchMetricDefinition,
} from '../shared/workbenchMetricDashboardModel';

interface PublishingDashboardRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}

const publishingMetrics: readonly WorkbenchMetricDefinition[] = Object.freeze([
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
    id: 'publishing-status',
    label: 'Publishing status',
    moduleName: 'cms',
    schemaName: 'cmsOnlinePublicationPointer',
    description: 'Operational status for staged-to-online publication flow.',
    route: '/publishing/status',
    icon: 'status',
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
]);

const approvalTaskStates = Object.freeze(['OPEN', 'CLAIMED', 'ESCALATED']);

const operatorPath = Object.freeze([
  Object.freeze({
    eyebrow: 'Prepare',
    title: '1. Prepare setup',
    body: 'Initialize documentation or accelerator packages in Staged before public delivery.',
    evidence:
      'Expected evidence: selected package, target site, release code, and import status.',
    route: '/setup-accelerators',
    action: 'Open Setup',
    secondaryRoute: '/publishing/requests',
    secondaryAction: 'Review Requests',
  }),
  Object.freeze({
    eyebrow: 'Inspect',
    title: '2. Inspect request',
    body: 'Review the exact publication request, source version, target site, and dependency evidence.',
    evidence:
      'Expected evidence: publication request, generated manifest, source version, and target Online profile.',
    route: '/publishing/requests',
    action: 'View Requests',
    secondaryRoute: '/publishing/manifests',
    secondaryAction: 'Open Manifests',
  }),
  Object.freeze({
    eyebrow: 'Govern',
    title: '3. Approve change',
    body: 'Use Process approval tasks for every operation that changes Online visibility.',
    evidence:
      'Expected evidence: claimed task, approve or reject decision, reviewer, reason, and workflow timeline.',
    route: '/process/tasks',
    action: 'Review Approvals',
    secondaryRoute: '/publishing/audit',
    secondaryAction: 'Inspect Audit',
  }),
  Object.freeze({
    eyebrow: 'Verify',
    title: '4. Verify Online',
    body: 'Confirm Online pointers, manifests, receipts, and browser delivery after activation.',
    evidence:
      'Expected evidence: Online pointer, deployment receipt, browser page, and audit trail.',
    route: '/publishing/status',
    action: 'Check Online',
    secondaryRoute: '/publishing/history',
    secondaryAction: 'View History',
  }),
]);

const publishingEvidenceRooms = Object.freeze([
  Object.freeze({
    title: 'Publication Requests',
    body: 'Start here when an accelerator, CMS pack, or content change has been prepared in Staged.',
    route: '/publishing/requests',
    action: 'Open requests',
  }),
  Object.freeze({
    title: 'Approval Queue',
    body: 'Use Process tasks to approve or reject anything that changes Online visibility.',
    route: '/process/tasks',
    action: 'Review approvals',
  }),
  Object.freeze({
    title: 'Staged-to-Online Operations',
    body: 'Inspect Online pointer movement and publication state before declaring the change live.',
    route: '/publishing/status',
    action: 'Check status',
  }),
  Object.freeze({
    title: 'Publication Manifests',
    body: 'Review generated payload evidence: source version, target site, dependencies, and prepared records.',
    route: '/publishing/manifests',
    action: 'Open manifests',
  }),
  Object.freeze({
    title: 'Publishing History',
    body: 'Confirm deployment receipts and previous Online movement when investigating what changed.',
    route: '/publishing/history',
    action: 'View history',
  }),
  Object.freeze({
    title: 'Publishing Audit',
    body: 'Use audit evidence when proving who requested, approved, rejected, retried, or recovered a change.',
    route: '/publishing/audit',
    action: 'Inspect audit',
  }),
]);

const publishingReadinessGates = Object.freeze([
  Object.freeze({
    title: 'Online readiness',
    body: 'Confirm target scope, active module or accelerator, generated manifest, and dependency health before approving Online movement.',
    route: '/publishing/status',
    action: 'Check readiness',
  }),
  Object.freeze({
    title: 'Staged health',
    body: 'Verify the Staged package can be imported repeatedly without duplicates, stale references, or direct Online writes.',
    route: '/publishing/manifests',
    action: 'Inspect manifests',
  }),
  Object.freeze({
    title: 'Conflict protection',
    body: 'Look for duplicate or concurrent requests, pending approvals, and incompatible target revisions before approval.',
    route: '/publishing/requests',
    action: 'Review requests',
  }),
  Object.freeze({
    title: 'Traceability',
    body: 'Every publish, reject, withdraw, retire, restore, or rollback must keep request, workflow, audit, reason, and browser evidence linked.',
    route: '/publishing/audit',
    action: 'Inspect trace',
  }),
]);

const publicationSideEffectHooks = Object.freeze([
  Object.freeze({
    title: 'Search index publication hook',
    body: 'Approved Online movement must enqueue the affected site, locale, catalog, page, product, or accelerator target for search projection refresh.',
    route: '/publishing/dependencies',
    action: 'Review dependency manifest',
  }),
  Object.freeze({
    title: 'Search reindex after publish',
    body: 'Operators need evidence that Online search was rebuilt or selectively refreshed after publication, with status visible before closure.',
    route: '/publishing/status',
    action: 'Check Online status',
  }),
  Object.freeze({
    title: 'Rollback reindex',
    body: 'Rollback or restore must trigger the same search invalidation path so storefront results return to the selected Online revision.',
    route: '/publishing/withdrawals',
    action: 'Review rollback path',
  }),
  Object.freeze({
    title: 'Publish failure recovery',
    body: 'Failures must show whether Online changed, whether search/media side effects ran, and which retry or compensation action is safe.',
    route: '/publishing/failures',
    action: 'Open recovery',
  }),
  Object.freeze({
    title: 'Search health evidence',
    body: 'Closure requires health evidence for index freshness, projection count, failed documents, and target channel verification.',
    route: '/publishing/audit',
    action: 'Inspect audit trail',
  }),
  Object.freeze({
    title: 'Media promotion readiness',
    body: 'Media assets referenced by CMS, products, categories, or campaigns must be promotable, rights-approved, and recoverable before Online approval.',
    route: '/media',
    action: 'Open Media',
  }),
]);

const publishingOperationalMetricCards = Object.freeze([
  Object.freeze({
    title: 'Latency',
    signal: 'Request created to Online verified',
    detail:
      'Track preparation, approval wait, activation, side-effect completion, and browser verification time separately.',
  }),
  Object.freeze({
    title: 'Failure rate',
    signal: 'Failed publications by target and reason',
    detail:
      'Separate validation failures, approval rejection, activation failure, search/media hook failure, and browser verification failure.',
  }),
  Object.freeze({
    title: 'Queue age',
    signal: 'Oldest waiting approval or activation',
    detail:
      'Show stale requests before operators assume publishing is blocked by the backend or already live.',
  }),
  Object.freeze({
    title: 'Retry pressure',
    signal: 'Retries and compensations by correlation id',
    detail:
      'High retry volume should point to recovery guidance, audit, and dependency health instead of repeated manual attempts.',
  }),
  Object.freeze({
    title: 'Audit volume',
    signal: 'Events per request and per Online movement',
    detail:
      'Healthy publishing should leave enough audit detail to reconstruct requester, approver, decision, reason, and result.',
  }),
  Object.freeze({
    title: 'Dependency health',
    signal: 'Blocking and warning dependencies',
    detail:
      'Surface unresolved CMS, media, localization, catalog, search, module, and accelerator dependencies before approval.',
  }),
  Object.freeze({
    title: 'Module health correlation',
    signal: 'Publishing status against module availability',
    detail:
      'A request should show whether the owning module is UP, DEGRADED, unavailable, inactive, or missing from navigation.',
  }),
  Object.freeze({
    title: 'Accelerator health correlation',
    signal: 'Setup package, approval, and Online target',
    detail:
      'Nexus, Agora, docs, and future accelerators should correlate setup status, publication status, and live verification.',
  }),
  Object.freeze({
    title: 'Operator activity',
    signal: 'Creator, approver, retry, recovery, and viewer actions',
    detail:
      'Activity metrics help enterprise administrators see workload and access patterns without weakening role separation.',
  }),
]);

const publishingDiagnosticSignals = Object.freeze([
  Object.freeze({
    title: 'Structured logs',
    detail:
      'Publication logs should include action, target, state transition, actor, request code, workflow reference, module, and outcome.',
    evidence: 'Log event contract',
  }),
  Object.freeze({
    title: 'Trace correlation IDs',
    detail:
      'Every import, validation, approval, activation, search hook, media hook, retry, and rollback should carry a shared trace id.',
    evidence: 'Trace id',
  }),
  Object.freeze({
    title: 'Request correlation IDs',
    detail:
      'Publication request code should connect manifests, Process tasks, Online pointers, history, audit, and browser evidence.',
    evidence: 'Request code',
  }),
  Object.freeze({
    title: 'Workflow correlation IDs',
    detail:
      'Workflow instance and task codes must remain visible across approval, rejection, escalation, retry, and recovery.',
    evidence: 'Workflow reference',
  }),
  Object.freeze({
    title: 'Import correlation IDs',
    detail:
      'Initializer and accelerator imports should link source package, import job, generated manifest, and publication request.',
    evidence: 'Import job',
  }),
  Object.freeze({
    title: 'Browser evidence registry',
    detail:
      'Final acceptance should record route, actor, timestamp, screenshot or run id, and observed result for every user journey.',
    evidence: 'Browser evidence',
  }),
  Object.freeze({
    title: 'Diagnostic export',
    detail:
      'Support should be able to export request, manifest, audit, workflow, dependency, and Online state without manual database digging.',
    evidence: 'Export package',
  }),
  Object.freeze({
    title: 'Support bundle',
    detail:
      'A support bundle should combine diagnostics, safe redaction, topology, module health, accelerator health, and reproduction steps.',
    evidence: 'Support bundle',
  }),
]);

const publishingScopeIsolationCards = Object.freeze([
  Object.freeze({
    title: 'Tenant scope',
    detail:
      'Requests must declare tenant ownership and prevent Online movement from leaking across tenant boundaries.',
  }),
  Object.freeze({
    title: 'Enterprise scope',
    detail:
      'Enterprise administrators need visibility across enterprise data while enterprise users remain constrained to their own enterprise.',
  }),
  Object.freeze({
    title: 'Site and profile scope',
    detail:
      'Nexus, Agora, documentation, and future accelerators should publish only to the selected site, profile, storefront, or channel.',
  }),
  Object.freeze({
    title: 'Environment scope',
    detail:
      'Staged, Online, Local, and future non-local targets must stay explicit so approvals do not accidentally cross runtime environments.',
  }),
  Object.freeze({
    title: 'Rollback and import isolation',
    detail:
      'Rollback and import jobs should restore or prepare only the same scope that was approved, audited, and browser-verified.',
  }),
]);

const publishingUxAssuranceCards = Object.freeze([
  Object.freeze({
    title: 'Responsive desktop journey',
    detail:
      'Desktop operators should see the full cockpit, side navigation, evidence rooms, metrics, diagnostics, and action links without hidden prerequisites.',
  }),
  Object.freeze({
    title: 'Responsive tablet journey',
    detail:
      'Tablet layouts should keep cards readable, actions reachable, and publishing sequence understandable when columns collapse.',
  }),
  Object.freeze({
    title: 'Responsive mobile journey',
    detail:
      'Mobile layouts should preserve the same journey order: prepare, inspect, approve, verify, recover, and record evidence.',
  }),
  Object.freeze({
    title: 'Empty state',
    detail:
      'Empty requests, tasks, receipts, or pointers must explain why no data is present and where the operator should go next.',
  }),
  Object.freeze({
    title: 'Loading state',
    detail:
      'Loading and partial data states should distinguish backend fetch progress from missing permissions or unavailable modules.',
  }),
  Object.freeze({
    title: 'Error state',
    detail:
      'Errors should provide the failed evidence room, safe recovery path, and support bundle expectation without implying Online changed.',
  }),
  Object.freeze({
    title: 'No-permission state',
    detail:
      'No-permission messaging should explain the missing capability and preserve read-only evidence when the user is allowed to view it.',
  }),
]);

const publishingApiAcceptanceCards = Object.freeze([
  Object.freeze({
    title: 'API contract inventory',
    detail:
      'Inventory publication request, manifest, status, history, audit, dependency, workflow, import, search, media, and accelerator endpoints before final release.',
  }),
  Object.freeze({
    title: 'Data migration dry-run',
    detail:
      'Dry-runs should prove imports, migration transforms, duplicate protection, rollback candidates, and version-zero assumptions before real Online movement.',
  }),
  Object.freeze({
    title: 'Production readiness checklist',
    detail:
      'Release readiness must include topology, module activation, approval workflow, observability, browser journeys, rollback, security, and support evidence.',
  }),
  Object.freeze({
    title: 'Final acceptance',
    detail:
      'The framework is accepted only when local journeys, backend authorities, product decisions, external gates, and release evidence are all explicitly closed.',
  }),
]);

const canonicalPublicationStates = Object.freeze([
  'DRAFT',
  'VALIDATING',
  'VALIDATED',
  'PENDING_APPROVAL',
  'REJECTED',
  'APPROVED',
  'ACTIVATING',
  'ONLINE',
  'FAILED',
  'WITHDRAWN',
  'RETIRED',
  'RESTORED',
  'ROLLED_BACK',
]);

function taskIsActionable(task: ProcessHumanTask): boolean {
  return (
    approvalTaskStates.includes(task.status) &&
    task.nodeCode === 'publicationReview' &&
    (task.instanceCode?.startsWith('cmsPublicationApproval-') ?? false)
  );
}

function workflowConnection(
  bootstrap: AxisAuthenticatedBootstrap,
): AxisModuleConnection | undefined {
  return (
    selectModuleConnection(bootstrap, 'flowApi', { server: 'processServer' }) ??
    selectModuleConnection(bootstrap, 'flowApi') ??
    selectModuleConnection(bootstrap, 'workflow', { server: 'processServer' }) ??
    selectModuleConnection(bootstrap, 'workflow')
  );
}

export function PublishingDashboardRoutePage({
  accessToken,
  bootstrap,
  routeNavigation,
  runtime,
}: PublishingDashboardRoutePageProps) {
  const connections = useMemo(() => activeConnections(bootstrap), [bootstrap]);
  const configuration = useMemo(
    () => ({
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs],
  );
  const processConnection = useMemo(() => workflowConnection(bootstrap), [bootstrap]);
  const data = useQuery({
    queryKey: [
      'publishing-dashboard',
      runtime.enterpriseCode,
      connectionKey(connections),
    ],
    queryFn: () =>
      loadWorkbenchMetrics(connections, bootstrap, configuration, publishingMetrics),
  });
  const processSummary = useQuery({
    enabled: Boolean(processConnection),
    queryKey: [
      'publishing-approval-tasks',
      runtime.enterpriseCode,
      processConnection?.instanceId ?? 'unavailable',
      processConnection?.state ?? 'unavailable',
    ],
    queryFn: async () => {
      if (!processConnection) return undefined;
      return loadProcessOperationsSummary(processConnection, configuration);
    },
  });
  const metrics = data.data;
  const readyCount = totalReadyMetrics(metrics);
  const unavailableCount = (metrics?.length ?? publishingMetrics.length) - readyCount;
  const approvalTasks = Object.freeze(
    (processSummary.data?.tasks ?? []).filter(taskIsActionable),
  );

  return (
    <WorkspaceContainer>
      <Stack spacing={dashboardComponentGap}>
        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'space-between' }}
            >
              <WorkspaceHeading
                description="Track publication requests, staged-to-online status, generated manifests, deployment receipts, and audit evidence."
                help={routeNavigation?.help}
                eyebrow="Publishing workspace"
                headingVariant="h3"
                title="Publishing"
              />
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Chip label={`${String(publishingMetrics.length)} metrics`} />
                <Chip color="success" label={`${String(readyCount)} live`} />
                {unavailableCount > 0 ? (
                  <Chip
                    color="warning"
                    label={`${String(unavailableCount)} unavailable`}
                    variant="outlined"
                  />
                ) : null}
              </Stack>
            </Stack>

            <Alert severity={data.isError ? 'warning' : 'info'}>
              {data.isError
                ? data.error instanceof Error
                  ? data.error.message
                  : 'Publishing dashboard metrics are currently unavailable.'
                : 'Counts are loaded from authorized publishing and WCMS workbench contracts. Publishing remains a governed backend operation; Axis only presents the workspace.'}
            </Alert>

            <Paper
              elevation={0}
              sx={{
                bgcolor: 'warning.50',
                border: 1,
                borderColor: 'warning.200',
                p: 2,
              }}
            >
              <Stack
                direction={{ xs: 'column', lg: 'row' }}
                spacing={2}
                sx={{ alignItems: { lg: 'center' }, justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography color="warning.dark" variant="overline">
                    Guided publishing lane
                  </Typography>
                  <Typography variant="h6">
                    Setup, approval, publication, and live verification stay in one
                    governed journey.
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Use this cockpit when a data pack, accelerator, CMS page, or media
                    update must move from Staged preparation to Online evidence.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  <Button
                    component={RouterLink}
                    to="/setup-accelerators"
                    variant="contained"
                  >
                    Start setup
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/publishing/requests"
                    variant="outlined"
                  >
                    Inspect requests
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        </Paper>

        <DashboardSection
          description="Operational publishing records used to move approved content from staged authoring toward online delivery."
          loading={data.isPending}
          metrics={metricsById(metrics, publishingMetrics)}
          title="Publishing operations"
        />

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <Box>
              <Typography variant="h5">Publishing metrics cockpit</Typography>
              <Typography color="text.secondary">
                Enterprise operators need more than record counts. These are the
                publishing-health signals Axis should expose from requests, workflow,
                audit, manifests, Online receipts, dependency manifests, and browser
                evidence.
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(3, minmax(0, 1fr))',
                },
              }}
            >
              {publishingOperationalMetricCards.map((metric) => (
                <Paper
                  component="article"
                  elevation={0}
                  key={metric.title}
                  sx={{ border: 1, borderColor: 'divider', p: 2 }}
                >
                  <Stack spacing={1}>
                    <Typography variant="h6">{metric.title}</Typography>
                    <Chip label={metric.signal} size="small" variant="outlined" />
                    <Typography color="text.secondary" variant="body2">
                      {metric.detail}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Box>
            <Alert severity="info">
              Metric cards describe the required operational view. Values should stay
              backend-derived so Axis does not invent health from frontend-only state.
            </Alert>
          </Stack>
        </Paper>

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <Box>
              <Typography variant="h5">Scope isolation and final acceptance gates</Typography>
              <Typography color="text.secondary">
                Publishing must be scoped before it is approved. Axis can make tenant,
                enterprise, site/profile, environment, import, rollback, API, migration,
                and final-acceptance expectations visible, while backend policy remains
                the enforcement authority.
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {publishingScopeIsolationCards.map((scope) => (
                <Paper
                  component="article"
                  elevation={0}
                  key={scope.title}
                  sx={{ border: 1, borderColor: 'divider', p: 2 }}
                >
                  <Stack spacing={1}>
                    <Typography variant="h6">{scope.title}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {scope.detail}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Box>
            <Alert severity="warning">
              Scope isolation is product-authority work. This panel makes the decision
              visible, but final closure still requires backend enforcement and role
              policy validation.
            </Alert>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {publishingApiAcceptanceCards.map((card) => (
                <Paper
                  component="article"
                  elevation={0}
                  key={card.title}
                  sx={{ border: 1, borderColor: 'divider', p: 2 }}
                >
                  <Stack spacing={1}>
                    <Typography variant="h6">{card.title}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {card.detail}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Box>
          </Stack>
        </Paper>

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <Box>
              <Typography variant="h5">Responsive and state UX assurance</Typography>
              <Typography color="text.secondary">
                Publishing must stay simple, descriptive, and professional even when
                data is empty, loading, unavailable, denied, or viewed on a smaller
                screen.
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(3, minmax(0, 1fr))',
                },
              }}
            >
              {publishingUxAssuranceCards.map((card) => (
                <Paper
                  component="article"
                  elevation={0}
                  key={card.title}
                  sx={{ border: 1, borderColor: 'divider', p: 2 }}
                >
                  <Stack spacing={1}>
                    <Typography variant="h6">{card.title}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {card.detail}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Box>
          </Stack>
        </Paper>

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <Box>
              <Typography variant="h5">Diagnostics and supportability</Typography>
              <Typography color="text.secondary">
                Publishing support needs a single trail across imports, requests,
                workflow, Online movement, search/media side effects, browser
                verification, and recovery. These signals define what operators should
                capture before escalating a publishing incident.
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {publishingDiagnosticSignals.map((signal) => (
                <Paper
                  component="article"
                  elevation={0}
                  key={signal.title}
                  sx={{ border: 1, borderColor: 'divider', p: 2 }}
                >
                  <Stack spacing={1}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Typography variant="h6">{signal.title}</Typography>
                      <Chip label={signal.evidence} size="small" variant="outlined" />
                    </Stack>
                    <Typography color="text.secondary" variant="body2">
                      {signal.detail}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Box>
            <Alert severity="info">
              Diagnostic exports and support bundles must be backend-produced and
              permissioned. Axis defines the operator expectation and links the evidence
              rooms; it should not scrape sensitive data from the browser.
            </Alert>
          </Stack>
        </Paper>

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <Box>
              <Typography variant="h5">Readiness and lifecycle policy</Typography>
              <Typography color="text.secondary">
                Use the same status language and readiness checks across requests,
                approvals, history, audit, and live verification. This keeps the
                operator journey understandable even when the backend evidence is spread
                across multiple schemas.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              {canonicalPublicationStates.map((state) => (
                <Chip key={state} label={state} size="small" variant="outlined" />
              ))}
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {publishingReadinessGates.map((gate) => (
                <Paper
                  component="article"
                  elevation={0}
                  key={gate.title}
                  sx={{ border: 1, borderColor: 'divider', p: 2 }}
                >
                  <Stack spacing={1.25}>
                    <Typography variant="h6">{gate.title}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {gate.body}
                    </Typography>
                    <Button
                      component={RouterLink}
                      size="small"
                      to={gate.route}
                      variant="outlined"
                    >
                      {gate.action}
                    </Button>
                  </Stack>
                </Paper>
              ))}
            </Box>
            <Alert severity="info">
              Staged imports prepare evidence; approval authorizes Online movement.
              Axis should never describe an import as live until Online status and
              browser delivery are verified.
            </Alert>
          </Stack>
        </Paper>

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <Box>
              <Typography variant="h5">Search and media publication hooks</Typography>
              <Typography color="text.secondary">
                Publishing is not complete when the database pointer changes. Search
                projections, media promotion readiness, rollback reindex, and failure
                recovery must be traceable before an operator closes the request.
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {publicationSideEffectHooks.map((hook) => (
                <Paper
                  component="article"
                  elevation={0}
                  key={hook.title}
                  sx={{ border: 1, borderColor: 'divider', p: 2 }}
                >
                  <Stack spacing={1.25}>
                    <Typography variant="h6">{hook.title}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {hook.body}
                    </Typography>
                    <Button
                      component={RouterLink}
                      size="small"
                      to={hook.route}
                      variant="outlined"
                    >
                      {hook.action}
                    </Button>
                  </Stack>
                </Paper>
              ))}
            </Box>
            <Alert severity="warning">
              Search and media hooks stay backend-owned. Axis should expose readiness,
              health, audit, and browser evidence, but must not silently mark Online
              publication complete when side effects are still pending.
            </Alert>
          </Stack>
        </Paper>

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <Box>
              <Typography variant="h5">Publishing evidence map</Typography>
              <Typography color="text.secondary">
                These pages are not separate tasks. They are the evidence rooms for one
                publishing journey: request, approval, Online movement, manifest,
                receipt, and audit.
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(3, minmax(0, 1fr))',
                },
              }}
            >
              {publishingEvidenceRooms.map((room) => (
                <Paper
                  component="article"
                  elevation={0}
                  key={room.title}
                  sx={{ border: 1, borderColor: 'divider', p: 2 }}
                >
                  <Stack spacing={1.25}>
                    <Typography variant="h6">{room.title}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {room.body}
                    </Typography>
                    <Button
                      component={RouterLink}
                      size="small"
                      to={room.route}
                      variant="outlined"
                    >
                      {room.action}
                    </Button>
                  </Stack>
                </Paper>
              ))}
            </Box>
          </Stack>
        </Paper>

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <Box>
              <Typography variant="h5">Guided operator journey</Typography>
              <Typography color="text.secondary">
                Follow the same sequence every time: prepare the change, inspect the
                generated request, approve or reject through Process, then verify Online
                with receipts and browser evidence.
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(4, minmax(0, 1fr))',
                },
              }}
            >
              {operatorPath.map((step, index) => (
                <Paper
                  component="article"
                  elevation={0}
                  key={step.title}
                  sx={{
                    border: 1,
                    borderColor: index === 0 ? 'warning.300' : 'divider',
                    p: 2,
                    position: 'relative',
                  }}
                >
                  <Stack spacing={1.25}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Chip color="warning" label={step.eyebrow} size="small" />
                      <Typography color="text.secondary" variant="caption">
                        Step {String(index + 1)} of {String(operatorPath.length)}
                      </Typography>
                    </Stack>
                    <Typography variant="h6">{step.title}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {step.body}
                    </Typography>
                    <Divider />
                    <Typography color="text.secondary" variant="caption">
                      {step.evidence}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                      <Button
                        component={RouterLink}
                        size="small"
                        to={step.route}
                        variant={index === 0 ? 'contained' : 'outlined'}
                      >
                        {step.action}
                      </Button>
                      <Button
                        component={RouterLink}
                        size="small"
                        to={step.secondaryRoute}
                        variant="text"
                      >
                        {step.secondaryAction}
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Box>
            <Alert severity="success">
              Completion means both sides are proven: the backend approval path has a
              Process decision and the user-facing browser page shows the intended
              Online result.
            </Alert>
          </Stack>
        </Paper>

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <Box>
              <Typography variant="h5">Rollback, withdrawal, and re-publish guardrails</Typography>
              <Typography color="text.secondary">
                Recovery work should be handled with the same evidence discipline as a
                normal publication. Do not treat rollback as a shortcut around approval,
                audit, or browser verification.
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              }}
            >
              <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
                <Stack spacing={1}>
                  <Chip color="warning" label="Rollback" size="small" />
                  <Typography variant="h6">Return to a previous approved state</Typography>
                  <Typography color="text.secondary" variant="body2">
                    Use history and audit first, then confirm which prior Online pointer
                    or receipt should become authoritative again.
                  </Typography>
                </Stack>
              </Paper>
              <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
                <Stack spacing={1}>
                  <Chip color="warning" label="Withdraw" size="small" />
                  <Typography variant="h6">Stop a pending or scheduled publication</Typography>
                  <Typography color="text.secondary" variant="body2">
                    Withdrawal should explain what remains in Staged and why Online must
                    stay unchanged.
                  </Typography>
                </Stack>
              </Paper>
              <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
                <Stack spacing={1}>
                  <Chip color="warning" label="Retire / re-publish" size="small" />
                  <Typography variant="h6">Retire obsolete live content safely</Typography>
                  <Typography color="text.secondary" variant="body2">
                    Re-publish only from approved evidence, then verify the live page or
                    storefront from the browser.
                  </Typography>
                </Stack>
              </Paper>
            </Box>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/publishing/history" variant="outlined">
                Start from history
              </Button>
              <Button component={RouterLink} to="/publishing/audit" variant="outlined">
                Inspect audit trail
              </Button>
              <Button component={RouterLink} to="/publishing/status" variant="outlined">
                Confirm Online state
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
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'space-between' }}
            >
              <Box>
                <Typography variant="h5">Approval tasks</Typography>
                <Typography color="text.secondary">
                  Publication approvals are governed Process tasks. Review them here or
                  open the full task inbox to claim, approve, reject, or inspect
                  workflow evidence.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Chip
                  color={processConnection ? 'success' : 'warning'}
                  label={
                    processConnection ? processConnection.state : 'Process unavailable'
                  }
                  variant={processConnection ? 'filled' : 'outlined'}
                />
                <Chip
                  color={approvalTasks.length ? 'warning' : 'success'}
                  label={`${String(approvalTasks.length)} pending`}
                  variant={approvalTasks.length ? 'filled' : 'outlined'}
                />
              </Stack>
            </Stack>

            {!processConnection ? (
              <Alert severity="warning">
                The Process runtime is not available, so Axis cannot show publication
                approval tasks. Start Process and return to Publishing → Approval Tasks.
              </Alert>
            ) : processSummary.isError ? (
              <Alert severity="warning">
                {processSummary.error instanceof Error
                  ? processSummary.error.message
                  : 'Approval tasks are currently unavailable.'}
              </Alert>
            ) : approvalTasks.length === 0 ? (
              <Alert severity="success">
                No publishing approval tasks are waiting. If Nexus or Agora still show
                unpublished content, inspect Publishing Requests and Staged-to-Online
                Status next.
              </Alert>
            ) : (
              <Stack spacing={1.5}>
                {approvalTasks.slice(0, 5).map((task) => (
                  <Paper
                    component="article"
                    elevation={0}
                    key={task.code}
                    sx={{ border: 1, borderColor: 'divider', p: 2 }}
                  >
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1.5}
                      sx={{ justifyContent: 'space-between' }}
                    >
                      <Box>
                        <Typography variant="h6">{task.code}</Typography>
                        <Typography color="text.secondary">
                          Instance {task.instanceCode ?? 'unknown'} · node{' '}
                          {task.nodeCode ?? 'unknown'} · assignee{' '}
                          {task.assignee ?? 'unassigned'}
                        </Typography>
                      </Box>
                      <Chip color="warning" label={task.status} />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/process/tasks" variant="contained">
                Review approval tasks
              </Button>
              <Button
                component={RouterLink}
                to="/publishing/requests"
                variant="outlined"
              >
                View publishing requests
              </Button>
              <Button component={RouterLink} to="/publishing/status" variant="outlined">
                Check Online status
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </WorkspaceContainer>
  );
}
