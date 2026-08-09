import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Chip, Paper, Stack } from '@mui/material';
import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  activeConnections,
  connectionKey,
  dashboardCardPadding,
  dashboardComponentGap,
  dashboardContentGap,
  loadWorkbenchMetrics,
  metricsById,
  totalMetricValue,
  totalReadyMetrics,
  type WorkbenchMetricDefinition,
} from '../shared/workbenchMetricDashboardModel';
import { DashboardSection } from '../shared/WorkbenchMetricDashboard';

interface ContentDashboardRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}

const authoringMetrics: readonly WorkbenchMetricDefinition[] = Object.freeze([
  Object.freeze({
    id: 'sites',
    label: 'Websites',
    moduleName: 'cms',
    schemaName: 'cmsSite',
    description: 'Authoring sites configured for brands, storefronts, or portals.',
    route: '/content/sites',
    icon: 'cms',
  }),
  Object.freeze({
    id: 'catalogs',
    label: 'Content catalogs',
    moduleName: 'catalog',
    schemaName: 'catalog',
    description: 'Governed content catalog containers available to WCMS.',
    route: '/content/catalogs',
    icon: 'catalog',
  }),
  Object.freeze({
    id: 'pages',
    label: 'Pages',
    moduleName: 'cms',
    schemaName: 'cmsPage',
    description: 'Renderable CMS pages backed by approved Axis components.',
    route: '/content/pages',
    icon: 'page',
  }),
  Object.freeze({
    id: 'routes',
    label: 'Page routes',
    moduleName: 'cms',
    schemaName: 'cmsPageRoute',
    description: 'Browser route mappings resolved by backend-owned delivery contracts.',
    route: '/content/routes',
    icon: 'route',
  }),
  Object.freeze({
    id: 'components',
    label: 'Components',
    moduleName: 'cms',
    schemaName: 'cmsComponent',
    description: 'Reusable content blocks that Axis renders through safe mappings.',
    route: '/content/components',
    icon: 'component',
  }),
  Object.freeze({
    id: 'component-media',
    label: 'Component media links',
    moduleName: 'cms',
    schemaName: 'cmsComponentMedia',
    description: 'Governed references from CMS components to media assets.',
    route: '/content/component-media',
    icon: 'media',
  }),
]);

const governanceMetrics: readonly WorkbenchMetricDefinition[] = Object.freeze([
  Object.freeze({
    id: 'type-codes',
    label: 'Page and component types',
    moduleName: 'cms',
    schemaName: 'cmsTypeCode',
    description: 'Backend type codes that connect content models with renderers.',
    route: '/content/type-codes',
    icon: 'schema',
  }),
  Object.freeze({
    id: 'renderer-mappings',
    label: 'Renderer mappings',
    moduleName: 'cms',
    schemaName: 'cmsTypeCode2Renderer',
    description: 'Approved renderer contracts Axis can use for CMS content.',
    route: '/content/renderer-mappings',
    icon: 'integration',
  }),
  Object.freeze({
    id: 'page-templates',
    label: 'Page templates',
    moduleName: 'cms',
    schemaName: 'cmsPageTemplate',
    description: 'Reusable page structures and controlled content slots.',
    route: '/content/page-templates',
    icon: 'template',
  }),
  Object.freeze({
    id: 'slot-definitions',
    label: 'Slot definitions',
    moduleName: 'cms',
    schemaName: 'cmsSlotDefinition',
    description: 'Slot contracts that decide where components can appear.',
    route: '/content/slot-definitions',
    icon: 'layout',
  }),
  Object.freeze({
    id: 'navigation',
    label: 'Navigation nodes',
    moduleName: 'cms',
    schemaName: 'cmsNavigationNode',
    description: 'Managed navigation entries for CMS-driven experiences.',
    route: '/content/navigation',
    icon: 'navigation',
  }),
  Object.freeze({
    id: 'restrictions',
    label: 'Restrictions',
    moduleName: 'cms',
    schemaName: 'cmsRestriction',
    description: 'Visibility rules controlling page, component, and navigation access.',
    route: '/content/restrictions',
    icon: 'security',
  }),
]);

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

const allMetrics = Object.freeze([
  ...authoringMetrics,
  ...governanceMetrics,
  ...publishingMetrics,
]);

export function ContentDashboardRoutePage({
  accessToken,
  bootstrap,
  routeNavigation,
  runtime,
}: ContentDashboardRoutePageProps) {
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
    queryKey: ['content-dashboard', runtime.enterpriseCode, connectionKey(connections)],
    queryFn: () =>
      loadWorkbenchMetrics(connections, bootstrap, configuration, allMetrics),
  });
  const metrics = data.data;
  const readyCount = totalReadyMetrics(metrics);
  const unavailableCount = (metrics?.length ?? allMetrics.length) - readyCount;
  const totalRecords = totalMetricValue(metrics);

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
                description="Monitor WCMS authoring, page composition, renderer contracts, visibility governance, and publishing readiness from one content workspace."
                help={routeNavigation?.help}
                eyebrow="Content workspace"
                headingVariant="h3"
                title="Content and Experience"
              />
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Button
                  component={RouterLink}
                  size="small"
                  to="/content/designer"
                  variant="contained"
                >
                  Open designer
                </Button>
                <Chip label={`${String(allMetrics.length)} metrics`} />
                <Chip
                  label={`${new Intl.NumberFormat().format(totalRecords)} records`}
                />
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
                  : 'Content dashboard metrics are currently unavailable.'
                : 'Counts are loaded from authorized WCMS and publishing workbench contracts. Media inventory is intentionally handled under Media Management.'}
            </Alert>
          </Stack>
        </Paper>

        <DashboardSection
          description="Primary WCMS objects used to build websites, pages, routes, and reusable components."
          loading={data.isPending}
          metrics={metricsById(metrics, authoringMetrics)}
          title="Authoring inventory"
        />

        <DashboardSection
          description="Renderer contracts, templates, slots, navigation, and restrictions that keep content safe and traceable."
          loading={data.isPending}
          metrics={metricsById(metrics, governanceMetrics)}
          title="Composition governance"
        />

        <DashboardSection
          description="Publication requests, status, manifests, history, and audit evidence for staged-to-online delivery."
          loading={data.isPending}
          metrics={metricsById(metrics, publishingMetrics)}
          title="Publishing readiness"
        />
      </Stack>
    </WorkspaceContainer>
  );
}
