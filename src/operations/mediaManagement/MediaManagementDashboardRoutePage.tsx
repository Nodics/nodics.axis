import { useQuery } from '@tanstack/react-query';
import { Alert, Chip, Paper, Stack } from '@mui/material';
import { useMemo } from 'react';

import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisNavigationItem,
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
  type WorkbenchMetric,
  type WorkbenchMetricDefinition,
} from '../shared/workbenchMetricDashboardModel';
import { DashboardSection } from '../shared/WorkbenchMetricDashboard';
import { loadMediaSourceContexts } from './api/mediaStoragePolicyClient';

interface MediaManagementDashboardRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}

interface MediaDashboardData {
  readonly metrics: readonly WorkbenchMetric[];
  readonly sourceContextCount: number;
}

const mediaMetrics: readonly WorkbenchMetricDefinition[] = Object.freeze([
  Object.freeze({
    id: 'media-items',
    label: 'Media items',
    moduleName: 'media',
    schemaName: 'media',
    description: 'Managed assets delivered through the media module.',
    route: '/media/items',
    icon: 'media',
  }),
  Object.freeze({
    id: 'media-sets',
    label: 'Media sets',
    moduleName: 'media',
    schemaName: 'mediaSet',
    description: 'Grouped media collections for responsive or multi-asset use cases.',
    route: '/media/sets',
    icon: 'collection',
  }),
  Object.freeze({
    id: 'media-folders',
    label: 'Media folders',
    moduleName: 'media',
    schemaName: 'mediaFolder',
    description: 'Storage and governance folders available for uploads and imports.',
    route: '/media/folders',
    icon: 'folder',
  }),
  Object.freeze({
    id: 'media-formats',
    label: 'Media formats',
    moduleName: 'media',
    schemaName: 'mediaFormat',
    description:
      'Approved format contracts for previews, images, documents, and files.',
    route: '/media/formats',
    icon: 'schema',
  }),
  Object.freeze({
    id: 'media-references',
    label: 'Media references',
    moduleName: 'media',
    schemaName: 'mediaReference',
    description: 'Usage evidence linking assets back to owning records.',
    route: '/media/usage',
    icon: 'link',
  }),
]);

const mediaFolderMetrics: readonly WorkbenchMetricDefinition[] = Object.freeze([
  Object.freeze({
    id: 'content-media',
    label: 'Content media',
    moduleName: 'media',
    schemaName: 'media',
    description: 'Assets in the CMS content asset folder.',
    route: '/media/items?folderCode=cmsAssets',
    icon: 'media',
    filter: { field: 'folderCode', value: 'cmsAssets' },
  }),
  Object.freeze({
    id: 'product-media',
    label: 'Product media',
    moduleName: 'media',
    schemaName: 'media',
    description: 'Assets in the product media folder.',
    route: '/media/items?folderCode=productAssets',
    icon: 'image',
    filter: { field: 'folderCode', value: 'productAssets' },
  }),
  Object.freeze({
    id: 'import-source-files',
    label: 'Import source files',
    moduleName: 'media',
    schemaName: 'media',
    description: 'Files staged for governed import jobs.',
    route: '/media/items?folderCode=importSources',
    icon: 'upload',
    filter: { field: 'folderCode', value: 'importSources' },
  }),
  Object.freeze({
    id: 'export-files',
    label: 'Export files',
    moduleName: 'media',
    schemaName: 'media',
    description: 'Generated files from export operations.',
    route: '/media/items?folderCode=exportFiles',
    icon: 'download',
    filter: { field: 'folderCode', value: 'exportFiles' },
  }),
  Object.freeze({
    id: 'utility-files',
    label: 'Utility files',
    moduleName: 'media',
    schemaName: 'media',
    description: 'Default utility media not owned by a richer source context.',
    route: '/media/items?folderCode=default',
    icon: 'file',
    filter: { field: 'folderCode', value: 'default' },
  }),
]);

const allMetrics = Object.freeze([...mediaMetrics, ...mediaFolderMetrics]);

const productionMediaIntakeSteps = Object.freeze([
  'Upload or select Nodics-owned asset',
  'Capture checksum and source evidence',
  'Reviewer approves rights and target usage',
  'Activate media reference for content or product',
]);

const productionMediaEvidenceStates = Object.freeze([
  'UPLOADED',
  'CHECKSUM_RECORDED',
  'RIGHTS_APPROVED',
  'TARGET_USAGE_APPROVED',
  'REFERENCE_ACTIVATED',
]);

const productionMediaControls = Object.freeze([
  {
    title: 'Rights policy check',
    detail:
      'Reject production activation unless the media record carries approved license, owner and target-usage evidence.',
  },
  {
    title: 'Checksum and source proof',
    detail:
      'Show checksum, source system, original filename and intake run so operators can audit replacement assets.',
  },
  {
    title: 'Target usage approval',
    detail:
      'Approve each content, product, category or promotion usage separately before the media reference becomes active.',
  },
  {
    title: 'Emergency deactivation',
    detail:
      'Allow operators to deactivate a bad reference without deleting audit history or the owning product/content record.',
  },
]);

const productionMediaApprovalChecklist = Object.freeze([
  {
    title: 'Replacement intake',
    owner: 'Media operator',
    proof: ['original filename', 'source system', 'checksum', 'intake run'],
  },
  {
    title: 'Rights approval',
    owner: 'Content reviewer',
    proof: ['license type', 'asset owner', 'reviewer', 'approval timestamp'],
  },
  {
    title: 'Target promotion',
    owner: 'Media governance',
    proof: ['target type', 'target code', 'usage scope', 'activation revision'],
  },
  {
    title: 'Rollback readiness',
    owner: 'Operations',
    proof: [
      'previous reference',
      'deactivation reason',
      'audit trail',
      'recovery note',
    ],
  },
]);

const mediaReferenceLifecycleActions = Object.freeze([
  {
    label: 'Approve reference',
    route: 'POST /nodics/media/v0/references/{referenceCode}/approve',
    permission: 'media.reference.lifecycle.manage',
  },
  {
    label: 'Activate reference',
    route: 'POST /nodics/media/v0/references/{referenceCode}/activate',
    permission: 'media.reference.lifecycle.manage',
  },
  {
    label: 'Deactivate reference',
    route: 'POST /nodics/media/v0/references/{referenceCode}/deactivate',
    permission: 'media.reference.lifecycle.manage',
  },
]);

const mediaPublicationReadinessPolicies = Object.freeze([
  {
    title: 'Publication hook ownership',
    detail:
      'CMS, catalog, and accelerator publishing may reference media, but the media module owns promotion eligibility, rights state, checksum, and active reference status.',
  },
  {
    title: 'Promotion readiness',
    detail:
      'Before Online approval, required media references must be uploaded, rights-approved, target-approved, format-compatible, and bound to the correct content or product revision.',
  },
  {
    title: 'Rollback behavior',
    detail:
      'Rollback should restore the previous active reference or deactivate the new reference without deleting audit history, source evidence, or rejected replacement files.',
  },
  {
    title: 'Missing-asset fallback',
    detail:
      'When a required asset is missing or not approved, storefront and CMS preview should show a controlled placeholder or blocked-publication message instead of broken imagery.',
  },
  {
    title: 'External provider gate',
    detail:
      'CDN, DAM, storage, or transformation providers remain externally qualified gates; local acceptance records the policy but cannot certify production provider behavior.',
  },
]);

async function loadMediaDashboardData(
  connections: ReturnType<typeof activeConnections>,
  bootstrap: AxisAuthenticatedBootstrap,
  configuration: {
    readonly accessToken: string;
    readonly enterpriseCode: string;
    readonly timeoutMs: number;
  },
): Promise<MediaDashboardData> {
  const metrics = await loadWorkbenchMetrics(
    connections,
    bootstrap,
    configuration,
    allMetrics,
  );
  const mediaConnection = selectModuleConnection(bootstrap, 'media');
  const sourceContexts = mediaConnection
    ? await loadMediaSourceContexts(mediaConnection, configuration).catch(() =>
        Object.freeze([]),
      )
    : Object.freeze([]);
  return Object.freeze({
    metrics,
    sourceContextCount: sourceContexts.length,
  });
}

export function MediaManagementDashboardRoutePage({
  accessToken,
  bootstrap,
  routeNavigation,
  runtime,
}: MediaManagementDashboardRoutePageProps) {
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
      'media-management-dashboard',
      runtime.enterpriseCode,
      connectionKey(connections),
    ],
    queryFn: () => loadMediaDashboardData(connections, bootstrap, configuration),
  });
  const metrics = data.data?.metrics;
  const readyCount = totalReadyMetrics(metrics);
  const unavailableCount = (metrics?.length ?? allMetrics.length) - readyCount;
  const sourceContextCount = data.data?.sourceContextCount ?? 0;
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
                description="Govern media inventory, storage folders, format contracts, usage references, and source-specific asset buckets."
                help={routeNavigation?.help}
                eyebrow="Media workspace"
                headingVariant="h3"
                title="Media Management"
              />
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
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
                <Chip label={`${String(sourceContextCount)} media contexts`} />
              </Stack>
            </Stack>

            <Alert severity={data.isError ? 'warning' : 'info'}>
              {data.isError
                ? data.error instanceof Error
                  ? data.error.message
                  : 'Media dashboard metrics are currently unavailable.'
                : 'Counts are loaded from authorized media workbench contracts. CMS content may reference media, but media inventory remains owned by Media Management.'}
            </Alert>
          </Stack>
        </Paper>

        <DashboardSection
          description="Media records, sets, folders, formats, and references owned by the media module."
          loading={data.isPending}
          metrics={metricsById(metrics, mediaMetrics)}
          title="Media management"
        />

        <DashboardSection
          description="A practical split of media by source folder so authors can distinguish CMS assets, product assets, utility files, and import/export files."
          loading={data.isPending}
          metrics={metricsById(metrics, mediaFolderMetrics)}
          title="Media by source"
        />

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <WorkspaceHeading
              description="Replacement media for Agora and other storefronts must pass upload, checksum, reviewer approval, and media-reference activation before production use."
              eyebrow="Production intake"
              headingVariant="h4"
              title="Approved media activation flow"
            />
            <Stack component="ol" spacing={1} sx={{ m: 0, pl: 3 }}>
              {productionMediaIntakeSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              {productionMediaEvidenceStates.map((state) => (
                <Chip key={state} label={state} size="small" variant="outlined" />
              ))}
            </Stack>
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
              {productionMediaControls.map((control) => (
                <Paper
                  component="article"
                  key={control.title}
                  sx={{ minWidth: 240, p: 1.5 }}
                  variant="outlined"
                >
                  <strong>{control.title}</strong>
                  <p>{control.detail}</p>
                </Paper>
              ))}
            </Stack>
            <WorkspaceHeading
              description="Operator checklist for replacing reference assets with approved Nodics media while preserving audit and rollback evidence."
              eyebrow="Media governance"
              headingVariant="h5"
              title="Media intake approval checklist"
            />
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
              {productionMediaApprovalChecklist.map((item) => (
                <Paper
                  component="article"
                  key={item.title}
                  sx={{ minWidth: 240, p: 1.5 }}
                  variant="outlined"
                >
                  <strong>{item.title}</strong>
                  <p>Owner: {item.owner}</p>
                  <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                    {item.proof.map((proof) => (
                      <Chip key={proof} label={proof} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </Paper>
              ))}
            </Stack>
            <WorkspaceHeading
              description="Axis surfaces these as Media-owned lifecycle operations; it does not approve rights or activate files by itself."
              eyebrow="Executable backend actions"
              headingVariant="h5"
              title="Media reference lifecycle operations"
            />
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
              {mediaReferenceLifecycleActions.map((action) => (
                <Paper
                  component="article"
                  key={action.label}
                  sx={{ minWidth: 260, p: 1.5 }}
                  variant="outlined"
                >
                  <strong>{action.label}</strong>
                  <p>{action.route}</p>
                  <Chip label={action.permission} size="small" variant="outlined" />
                </Paper>
              ))}
            </Stack>
            <Alert severity="warning">
              Sample or reference-site media remains inactive until a Nodics-owned asset
              is uploaded, checksum evidence is recorded, reviewer approval is captured,
              and the media reference is activated.
            </Alert>
            <WorkspaceHeading
              description="Publishing needs media hooks that are safe for CMS, products, accelerators, rollback, and missing-asset recovery."
              eyebrow="Publication readiness"
              headingVariant="h5"
              title="Media publication safety"
            />
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
              {mediaPublicationReadinessPolicies.map((policy) => (
                <Paper
                  component="article"
                  key={policy.title}
                  sx={{ minWidth: 260, p: 1.5 }}
                  variant="outlined"
                >
                  <strong>{policy.title}</strong>
                  <p>{policy.detail}</p>
                </Paper>
              ))}
            </Stack>
            <Alert severity="info">
              Media provider qualification remains a release gate outside this local
              Axis check. Local validation can prove the operator journey and policy
              visibility, not CDN/DAM production readiness.
            </Alert>
          </Stack>
        </Paper>
      </Stack>
    </WorkspaceContainer>
  );
}
