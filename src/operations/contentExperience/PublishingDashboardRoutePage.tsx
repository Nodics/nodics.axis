import { useQuery } from '@tanstack/react-query';
import { Alert, Chip, Paper, Stack } from '@mui/material';
import { useMemo } from 'react';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
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
    moduleName: 'publish',
    schemaName: 'publicationStatus',
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
  const data = useQuery({
    queryKey: [
      'publishing-dashboard',
      runtime.enterpriseCode,
      connectionKey(connections),
    ],
    queryFn: () =>
      loadWorkbenchMetrics(connections, bootstrap, configuration, publishingMetrics),
  });
  const metrics = data.data;
  const readyCount = totalReadyMetrics(metrics);
  const unavailableCount =
    (metrics?.length ?? publishingMetrics.length) - readyCount;

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
          </Stack>
        </Paper>

        <DashboardSection
          description="Operational publishing records used to move approved content from staged authoring toward online delivery."
          loading={data.isPending}
          metrics={metricsById(metrics, publishingMetrics)}
          title="Publishing operations"
        />
      </Stack>
    </WorkspaceContainer>
  );
}
