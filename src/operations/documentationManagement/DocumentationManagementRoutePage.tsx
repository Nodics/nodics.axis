import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { axisTokens } from '../../app/axisTheme';
import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import { ShellIcon } from '../../app/shell/ShellIcon';
import type {
  AxisAuthenticatedBootstrap,
  AxisDocumentationSource,
  AxisModuleConnection,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import { selectModuleConnection } from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkbenchRoutePage } from '../../workbench/WorkbenchRoutePage';
import {
  createWorkbenchRecord,
  loadGeneratedSchemaCapabilities,
  loadWorkbenchRecords,
  updateWorkbenchRecord,
  type WorkbenchClientConfiguration,
} from '../../workbench/api/workbenchClient';
import type {
  WorkbenchRecord,
  WorkbenchSchema,
} from '../../workbench/api/workbenchContracts';
import {
  resolveWorkbenchRecordSort,
  schemaWithValidQueryCapabilities,
} from '../../workbench/workbenchRouteModel';
import type { CmsComponentContract, CmsPageContract } from '../../cms/cmsContract';
import { CmsRichTextEditor } from '../../cms/richText/CmsRichTextEditor';
import {
  cmsRichTextComponentProperties,
  cmsRichTextDocumentToText,
  documentationBlocksToCmsRichTextDocument,
  normalizeCmsRichTextProperties,
  textToCmsRichTextDocument,
  type CmsRichTextDocument,
} from '../../cms/richText/cmsRichTextContract';
import { DocumentationArticleRenderer } from '../../cms/renderers/components/documentation/DocumentationArticleRenderer';
import { DocumentationNavigationRenderer } from '../../cms/renderers/components/documentation/DocumentationNavigationRenderer';
import { DocumentationArticleTemplateRenderer } from '../../cms/renderers/templates/DocumentationArticleTemplateRenderer';
import {
  createDocumentationGovernanceClient,
  defaultDocumentationGovernanceRoutes,
  type DocumentationAuthoringModel,
  type DocumentationAuthoringPanel,
  type DocumentationGovernanceRoutes,
  type DocumentationRenderProjection,
} from './api/documentationGovernanceClient';

type DocumentationManagementTab =
  | 'navigation'
  | 'pages'
  | 'dashboards'
  | 'access'
  | 'preview'
  | 'publication'
  | 'search'
  | 'sourceEvidence'
  | 'governance';

interface DocumentationManagementRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly channel: string;
  readonly cmsBaseUrl: string;
  readonly employeeId: string;
  readonly locale: string;
  readonly navigation: AxisNavigationItem;
  readonly path: string;
  readonly runtime: AxisRuntimeConfig;
  readonly site: string;
}

interface DocumentationWorkspaceTab {
  readonly id: DocumentationManagementTab;
  readonly label: string;
  readonly icon: string;
  readonly route: string;
  readonly schemaName?: string | undefined;
  readonly order: number;
}

type AxisCmsDocumentationSource = Extract<
  AxisDocumentationSource,
  { readonly type: 'CMS' }
>;

type DocumentationContentMode = 'text' | 'html';
type DocumentationDesignerMode = 'preview' | 'edit' | 'navigation';

interface DocumentationDraftPage {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly summary: string;
  readonly body: string;
  readonly contentMode: DocumentationContentMode;
  readonly contentJson?: CmsRichTextDocument | undefined;
  readonly audience: string;
  readonly section: string;
  readonly articleComponentId?: string | undefined;
  readonly originalComponentRecord?: WorkbenchRecord | undefined;
  readonly originalPageRecord?: WorkbenchRecord | undefined;
  readonly originalRouteRecord?: WorkbenchRecord | undefined;
  readonly targetPageCode?: string | undefined;
  readonly targetRouteCode?: string | undefined;
  readonly isNew?: boolean | undefined;
}

interface DocumentationDraftLink {
  readonly id: string;
  readonly pageId: string;
  readonly label: string;
  readonly parentLabel: string;
  readonly parentOrder?: number | undefined;
  readonly order: string;
  readonly visibility: string;
  readonly navigationCode?: string | undefined;
  readonly nodeLevel?: string | undefined;
  readonly nodeType?: string | undefined;
  readonly originalNodeRecord?: WorkbenchRecord | undefined;
  readonly parentNodeCode?: string | undefined;
}

type DocumentationNavigationParentKind = 'root' | 'section' | 'page' | 'new';

interface DocumentationNavigationParentOption {
  readonly value: string;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly parentLabel: string;
  readonly parentNodeCode?: string | undefined;
  readonly order?: number | undefined;
  readonly depth: number;
  readonly kind: DocumentationNavigationParentKind;
  readonly searchText: string;
}

const navigationRootParentValue = '__documentation_root__';
const navigationNewParentValue = '__documentation_new_parent__';
const navigationNewParentPrefix = '__new_parent__:';

const fallbackTabs: readonly DocumentationWorkspaceTab[] = Object.freeze([
  Object.freeze({
    id: 'pages',
    label: 'Pages and Topic Content',
    icon: 'content',
    route: '/docs/designer',
    schemaName: 'cmsDocumentationPage',
    order: 0,
  }),
  Object.freeze({
    id: 'navigation',
    label: 'Navigation Builder',
    icon: 'list-tree',
    route: '/docs/designer/navigation',
    schemaName: 'cmsDocumentationNode',
    order: 10,
  }),
  Object.freeze({
    id: 'dashboards',
    label: 'Landing Sections',
    icon: 'dashboard',
    route: '/docs/designer/dashboards',
    schemaName: 'cmsDocumentationDashboard',
    order: 30,
  }),
  Object.freeze({
    id: 'access',
    label: 'Audience and Access Policies',
    icon: 'security',
    route: '/docs/designer/access-policies',
    schemaName: 'cmsDocumentationAccessPolicy',
    order: 40,
  }),
  Object.freeze({
    id: 'preview',
    label: 'Preview Staged Content',
    icon: 'visible',
    route: '/docs/designer/preview',
    order: 45,
  }),
  Object.freeze({
    id: 'publication',
    label: 'Review and Publication Queue',
    icon: 'workflow',
    route: '/docs/designer/publication',
    schemaName: 'cmsDocumentationPublicationState',
    order: 50,
  }),
  Object.freeze({
    id: 'search',
    label: 'Search Metadata Preview',
    icon: 'search',
    route: '/docs/designer/search',
    schemaName: 'cmsDocumentationSearchMetadata',
    order: 60,
  }),
  Object.freeze({
    id: 'sourceEvidence',
    label: 'Source Evidence Review',
    icon: 'validation',
    route: '/docs/designer/source-evidence',
    schemaName: 'cmsDocumentationPage',
    order: 70,
  }),
  Object.freeze({
    id: 'governance',
    label: 'Governance and Readiness',
    icon: 'validation',
    route: '/docs/designer/governance',
    schemaName: 'cmsDocumentationPublicationState',
    order: 80,
  }),
]);

const fallbackModel: DocumentationAuthoringModel = Object.freeze({
  contract: 'cms.documentation.authoring/v1',
  ownerModule: 'cms',
  contentAuthority: 'documentationContentCatalog',
  rendererAuthority: 'axis-runtime-renderers',
  publicationAuthority: 'nPublish',
  workspace: Object.freeze({
    route: '/docs/designer',
    landing: '/docs/designer',
    previewRoute: '/docs/designer/preview',
    searchRoute: '/docs/designer/search',
    expandableNavigation: true,
    backendDriven: true,
  }),
  panels: Object.freeze(
    fallbackTabs.flatMap((tab): readonly DocumentationAuthoringPanel[] =>
      tab.schemaName
        ? [
            Object.freeze({
              code: tab.id,
              label: tab.label,
              schemaName: tab.schemaName,
            }),
          ]
        : [],
    ),
  ),
  accessModes: Object.freeze([
    'PUBLIC',
    'AUTHENTICATED',
    'ROLE_BASED',
    'GROUP_BASED',
    'PERMISSION_BASED',
    'RESTRICTED',
  ]),
  lifecycle: Object.freeze({
    readerStates: Object.freeze(['ONLINE']),
    authorStates: Object.freeze([
      'DRAFT',
      'STAGED',
      'REVIEW_IN_PROGRESS',
      'CHANGES_REQUESTED',
      'APPROVED',
      'REJECTED',
      'ONLINE',
      'ARCHIVED',
      'RETIRED',
      'ROLLBACK_PENDING',
      'PUBLICATION_FAILED',
    ]),
    targetTypes: Object.freeze([
      'PRODUCT',
      'NAVIGATION',
      'NODE',
      'PAGE',
      'DASHBOARD',
      'ACCESS_POLICY',
      'SEARCH_METADATA',
    ]),
    workflowTriggers: Object.freeze({
      PRODUCT: Object.freeze(['CONTENT_CHANGE', 'ACCESS_POLICY_CHANGE']),
      NAVIGATION: Object.freeze(['NAVIGATION_CHANGE']),
      NODE: Object.freeze([
        'NAVIGATION_CHANGE',
        'DASHBOARD_CHANGE',
        'ACCESS_POLICY_CHANGE',
      ]),
      PAGE: Object.freeze([
        'CONTENT_CHANGE',
        'ACCESS_POLICY_CHANGE',
        'SOURCE_EVIDENCE_CHANGE',
      ]),
      DASHBOARD: Object.freeze(['DASHBOARD_CHANGE']),
      ACCESS_POLICY: Object.freeze(['ACCESS_POLICY_CHANGE']),
      SEARCH_METADATA: Object.freeze(['SEARCH_METADATA_CHANGE']),
    }),
  }),
  sequence: Object.freeze([]),
  sequenceByGroup: Object.freeze({}),
});

function pathTab(path: string): DocumentationManagementTab {
  if (path.includes('/navigation')) return 'navigation';
  if (path.includes('/pages')) return 'pages';
  if (path.includes('/dashboards')) return 'dashboards';
  if (path.includes('/access-policies')) return 'access';
  if (path.includes('/preview')) return 'preview';
  if (path.includes('/publication')) return 'publication';
  if (path.includes('/search')) return 'search';
  if (path.includes('/source-evidence')) return 'sourceEvidence';
  if (path.includes('/governance')) return 'governance';
  return 'pages';
}

function routesFromNavigation(
  navigation: AxisNavigationItem,
): DocumentationGovernanceRoutes {
  const defaults = defaultDocumentationGovernanceRoutes();
  return Object.freeze({
    authoringModelRoute:
      navigation.workbenchTarget?.authoringModelRoute ?? defaults.authoringModelRoute,
    validationRoute:
      navigation.workbenchTarget?.validationRoute ?? defaults.validationRoute,
    renderProjectionRoute:
      navigation.workbenchTarget?.renderProjectionRoute ??
      defaults.renderProjectionRoute,
    searchRoute: navigation.workbenchTarget?.searchRoute ?? defaults.searchRoute,
    publicationHandoffRoute:
      navigation.workbenchTarget?.publicationHandoffRoute ??
      defaults.publicationHandoffRoute,
    migrationPlanRoute:
      navigation.workbenchTarget?.migrationPlanRoute ?? defaults.migrationPlanRoute,
  });
}

function availableTabs(
  navigation: readonly AxisNavigationItem[],
): readonly DocumentationWorkspaceTab[] {
  const byRoute = new Map(navigation.map((item) => [item.route, item]));
  return Object.freeze(
    fallbackTabs.map((tab) => {
      const item = byRoute.get(tab.route);
      return Object.freeze({
        ...tab,
        label: item?.label ?? tab.label,
        schemaName: item?.workbenchTarget?.schemaName ?? tab.schemaName,
      });
    }),
  );
}

function routeNavigationForTab(
  base: AxisNavigationItem,
  tab: DocumentationWorkspaceTab,
): AxisNavigationItem {
  return Object.freeze({
    ...base,
    id: `documentation-management-${tab.id}`,
    label: tab.label,
    route: tab.route,
    workbenchTarget: tab.schemaName
      ? { moduleName: 'cms', schemaName: tab.schemaName }
      : base.workbenchTarget,
    workbenchPresentation: {
      ...base.workbenchPresentation,
      defaultColumns:
        tab.id === 'navigation'
          ? ['code', 'nodeTitle', 'nodeType', 'parentNode', 'nodeOrder']
          : tab.id === 'pages'
            ? ['code', 'title', 'lifecycleState', 'accessMode', 'wordCount']
            : tab.id === 'dashboards'
              ? ['code', 'title', 'ownerType', 'ownerCode', 'lifecycleState']
              : tab.id === 'access'
                ? ['code', 'targetType', 'targetCode', 'accessMode']
                : tab.id === 'publication'
                  ? ['code', 'targetType', 'targetCode', 'lifecycleState']
                  : tab.id === 'search'
                    ? ['code', 'targetType', 'targetCode', 'title', 'indexState']
                    : ['code', 'title', 'sourcePath', 'sourceChecksum'],
    },
  });
}

function connectionKey(connection: AxisModuleConnection | undefined): string {
  if (!connection) return 'missing';
  return `${connection.moduleName}:${connection.instanceId}:${connection.endpoint}:${connection.state}`;
}

function selectedDocumentationSource(
  sources: readonly AxisCmsDocumentationSource[],
  sourceId: string,
): AxisCmsDocumentationSource | undefined {
  return sources.find((source) => source.id === sourceId) ?? sources[0];
}

function documentationSourceContext(
  source: AxisCmsDocumentationSource | undefined,
): Readonly<Record<string, string>> | undefined {
  if (!source) return undefined;
  return Object.freeze({
    id: source.id,
    label: source.label,
    ownerModule: source.ownerModule,
    connectionModule: source.connectionModule,
    site: source.site,
    catalog: source.catalog,
    defaultPage: source.defaultPage,
    packCode: source.packCode,
  });
}

function editableDocumentationSources(
  sources: readonly AxisDocumentationSource[],
): readonly AxisCmsDocumentationSource[] {
  return Object.freeze(
    sources
      .filter((source): source is AxisCmsDocumentationSource => source.type === 'CMS')
      .sort(
        (left, right) =>
          left.order - right.order || left.label.localeCompare(right.label),
      ),
  );
}

function GovernancePanel({
  client,
  connectionAvailable,
  model,
  recordPack,
}: {
  readonly client: ReturnType<typeof createDocumentationGovernanceClient> | undefined;
  readonly connectionAvailable: boolean;
  readonly model: DocumentationAuthoringModel;
  readonly recordPack: Readonly<Record<string, unknown>>;
}) {
  const [query, setQuery] = useState('documentation');
  const validation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('CMS documentation governance is unavailable');
      return client.validateAuthoringRecords(recordPack);
    },
  });
  const projection = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('CMS documentation governance is unavailable');
      return client.renderProjection(recordPack, 'AXIS');
    },
  });
  const search = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('CMS documentation governance is unavailable');
      return client.search(query, recordPack, 'AXIS');
    },
  });
  const handoff = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('CMS documentation governance is unavailable');
      return client.publicationHandoff(recordPack);
    },
  });
  const migration = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('CMS documentation governance is unavailable');
      return client.migrationPlan(recordPack);
    },
  });
  const busy =
    validation.isPending ||
    projection.isPending ||
    search.isPending ||
    handoff.isPending ||
    migration.isPending;
  const latestError = [
    validation.error,
    projection.error,
    search.error,
    handoff.error,
    migration.error,
  ].find((error): error is Error => error instanceof Error);

  return (
    <Stack spacing={2}>
      {!connectionAvailable ? (
        <Alert severity="warning">
          CMS governance APIs are not available in the current backend bootstrap.
        </Alert>
      ) : null}
      <Paper
        component="section"
        elevation={0}
        sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}
      >
        <Stack spacing={1.5}>
          <Typography variant="h6">Governance actions</Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(5, minmax(0, 1fr))',
              },
            }}
          >
            <Button
              disabled={!connectionAvailable || busy}
              startIcon={<ShellIcon name="validation" />}
              variant="outlined"
              onClick={() => validation.mutate()}
            >
              Validate
            </Button>
            <Button
              disabled={!connectionAvailable || busy}
              startIcon={<ShellIcon name="visible" />}
              variant="outlined"
              onClick={() => projection.mutate()}
            >
              Preview
            </Button>
            <Button
              disabled={!connectionAvailable || busy}
              startIcon={<ShellIcon name="workflow" />}
              variant="outlined"
              onClick={() => handoff.mutate()}
            >
              Handoff
            </Button>
            <Button
              disabled={!connectionAvailable || busy}
              startIcon={<ShellIcon name="import" />}
              variant="outlined"
              onClick={() => migration.mutate()}
            >
              Migration
            </Button>
            <Button
              disabled={!connectionAvailable || busy}
              startIcon={<ShellIcon name="refresh" />}
              variant="outlined"
              onClick={() => {
                validation.reset();
                projection.reset();
                search.reset();
                handoff.reset();
                migration.reset();
              }}
            >
              Clear
            </Button>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              fullWidth
              label="Search preview"
              size="small"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button
              disabled={!connectionAvailable || busy}
              startIcon={<ShellIcon name="search" />}
              sx={{ minWidth: 128 }}
              variant="contained"
              onClick={() => search.mutate()}
            >
              Search
            </Button>
          </Stack>
          {busy ? <LinearProgress /> : null}
          {latestError ? <Alert severity="error">{latestError.message}</Alert> : null}
        </Stack>
      </Paper>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
        }}
      >
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
          <Typography variant="h6">Readiness result</Typography>
          {validation.data ? (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Chip
                color={validation.data.status === 'READY' ? 'success' : 'warning'}
                label={validation.data.status}
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              />
              <Typography color="text.secondary" variant="body2">
                {String(validation.data.issueCount)} issues
              </Typography>
              {validation.data.issues.slice(0, 8).map((issue) => (
                <Alert
                  key={`${issue.code}:${issue.target ?? issue.message}`}
                  severity={
                    issue.severity === 'ERROR'
                      ? 'error'
                      : (issue.severity.toLowerCase() as 'warning' | 'info')
                  }
                >
                  {issue.message}
                </Alert>
              ))}
            </Stack>
          ) : (
            <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
              Run validation to check the current documentation pack.
            </Typography>
          )}
        </Paper>
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
          <Typography variant="h6">Search result</Typography>
          {search.data ? (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Typography color="text.secondary" variant="body2">
                {String(search.data.total)} matches for {search.data.query}
              </Typography>
              {search.data.results.slice(0, 6).map((result) => (
                <Box key={`${result.targetType}:${result.targetCode}`}>
                  <Typography variant="subtitle2">{result.title}</Typography>
                  <Typography color="text.secondary" variant="body2">
                    {result.summary}
                  </Typography>
                </Box>
              ))}
              {search.data.total === 0 && search.data.noResultGuidance ? (
                <Alert severity="info">{search.data.noResultGuidance}</Alert>
              ) : null}
            </Stack>
          ) : (
            <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
              Run search to preview access-filtered metadata.
            </Typography>
          )}
        </Paper>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
        }}
      >
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
          <Typography variant="h6">Render projection</Typography>
          {projection.data ? (
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
              <Chip
                label={`${String(projection.data.navigation.length)} nodes`}
                size="small"
              />
              <Chip
                label={`${String(projection.data.pages.length)} pages`}
                size="small"
              />
              <Chip
                label={`${String(projection.data.dashboards.length)} dashboards`}
                size="small"
              />
              <Chip label={projection.data.channel} size="small" />
            </Stack>
          ) : (
            <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
              Preview shows the backend-filtered reader projection for Axis.
            </Typography>
          )}
        </Paper>
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
          <Typography variant="h6">Publication and migration</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
            <Chip label={`Authority: ${model.publicationAuthority}`} size="small" />
            {handoff.data ? (
              <Chip
                color={
                  handoff.data.status === 'READY_FOR_NPUBLISH' ? 'success' : 'warning'
                }
                label={handoff.data.status}
                size="small"
              />
            ) : null}
            {migration.data ? (
              <Chip
                label={`${String(migration.data.recordCount)} migration records`}
                size="small"
              />
            ) : null}
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}

function previewRecordTitle(record: Readonly<Record<string, unknown>>): string {
  const title = [
    record.title,
    record.nodeTitle,
    record.label,
    record.name,
    record.code,
    record.targetCode,
  ].find(
    (value): value is string | number =>
      (typeof value === 'string' && value.trim() !== '') || typeof value === 'number',
  );
  return title === undefined ? 'Untitled item' : String(title);
}

function ProjectionSummary({
  projection,
}: {
  readonly projection: DocumentationRenderProjection;
}) {
  const previewRows = [
    ...projection.navigation
      .slice(0, 3)
      .map((item) => ['Navigation', previewRecordTitle(item)] as const),
    ...projection.pages
      .slice(0, 3)
      .map((item) => ['Page', previewRecordTitle(item)] as const),
    ...projection.dashboards
      .slice(0, 2)
      .map((item) => ['Dashboard', previewRecordTitle(item)] as const),
  ];

  return (
    <Stack spacing={1.5} sx={{ mt: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Chip
          label={`${String(projection.navigation.length)} navigation links`}
          size="small"
        />
        <Chip label={`${String(projection.pages.length)} pages`} size="small" />
        <Chip
          label={`${String(projection.dashboards.length)} content areas`}
          size="small"
        />
      </Stack>
      {previewRows.length > 0 ? (
        <Box sx={{ display: 'grid', gap: 1 }}>
          {previewRows.map(([kind, title], index) => (
            <Box
              key={`${kind}:${title}:${String(index)}`}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: `${String(axisTokens.radius.small)}px`,
                p: 1.25,
              }}
            >
              <Typography color="text.secondary" variant="caption">
                {kind}
              </Typography>
              <Typography variant="body2">{title}</Typography>
            </Box>
          ))}
        </Box>
      ) : (
        <Typography color="text.secondary" variant="body2">
          No staged reader items were returned for this area yet.
        </Typography>
      )}
    </Stack>
  );
}

const frameworkDraftPages: readonly DocumentationDraftPage[] = Object.freeze([
  {
    id: 'framework.what-is-nodics',
    title: 'What is Nodics?',
    slug: '/docs/framework',
    section: 'Nodics Framework',
    summary:
      'Introductory definition of Nodics, its enterprise purpose, and the first mental model for business, developer, and operator readers.',
    body: `## What is Nodics?\n\nNodics is a modular enterprise application framework for building governed business platforms without forcing every project to reinvent authentication, content management, APIs, configuration, data import, publishing, workflow, scheduled jobs, media, documentation, and operational contracts.\n\nBusiness teams use Nodics to move from idea to governed capability. Developers extend the framework through modules and project overlays. Operators can see what is staged, what is online, and which runtime owns each part of the platform.`,
    contentMode: 'text',
    audience: 'Business, architect, developer, operator',
  },
  {
    id: 'framework.why-nodics-exists',
    title: 'Why Nodics Exists',
    slug: '/docs/framework/framework-why-nodics-exists',
    section: 'Nodics Framework',
    summary:
      'Industry problems, business value, and why Nodics turns fast delivery into governed enterprise software.',
    body: `## Why Nodics exists\n\nModern teams can generate screens and services quickly, but speed alone does not create enterprise software. The difficult work is ownership, extension, auditability, lifecycle, governance, and repeatable operation.\n\nNodics exists to keep delivery fast while preserving boundaries: framework modules own reusable capability, customer projects own business extensions, Axis owns authenticated operations, and Nexus consumes approved Online content.`,
    contentMode: 'text',
    audience: 'Business, architect, administrator',
  },
  {
    id: 'framework.how-nodics-works',
    title: 'How Nodics Works',
    slug: '/docs/framework/framework-how-nodics-works',
    section: 'Nodics Framework',
    summary:
      'Mental model for framework modules, customer projects, Axis, public applications, runtime ownership, and customization.',
    body: `## How Nodics works\n\nNodics separates reusable capability from customer-specific behavior. Functional modules describe business capability, technical modules provide implementation, runtime servers activate selected modules, and projects compose the final application.\n\nAxis gives operators and business users governed access to manage content, configuration, publication, imports, process flows, health, and evidence without changing the application code directly.`,
    contentMode: 'text',
    audience: 'Business, architect, developer, operator',
  },
  {
    id: 'framework.adoption-and-first-journey',
    title: 'Adoption and First Journey',
    slug: '/docs/framework/framework-adoption-and-first-journey',
    section: 'Nodics Framework',
    summary:
      'The first business, developer, and operator path through setup, capability registration, imports, publishing, and browser verification.',
    body: `## Adoption and first journey\n\nA first Nodics journey starts with local runtime readiness, Axis login, capability discovery, content import, Staged review, Online publication, and browser verification.\n\nThe goal is not only to make a page visible. The goal is to prove that the project can move governed business data from authoring to approved reader experience with repeatable evidence.`,
    contentMode: 'text',
    audience: 'Business, operator, QA',
  },
  {
    id: 'docs.documentation-roadmap',
    title: 'Documentation Roadmap',
    slug: '/docs/framework/docs-documentation-roadmap',
    section: 'Documentation Roadmap',
    summary:
      'How the Nodics documentation product is organized and how readers choose the right path through the enterprise hierarchy.',
    body: `## Documentation roadmap\n\nThe documentation product is organized by reader journey, capability area, ownership boundary, and runtime concern. A business user should understand value and operation. A developer should understand extension points. An operator should understand evidence, states, and recovery.\n\nEvery page should make its audience, owner, route, and publication state clear.`,
    contentMode: 'text',
    audience: 'Business, author, administrator',
  },
  {
    id: 'docs.documentation-publishing-model',
    title: 'Documentation Publishing Model',
    slug: '/docs/framework/docs-documentation-publishing-model',
    section: 'Documentation Roadmap',
    summary:
      'How documentation source becomes content catalog data, Staged records, approval tasks, Online pages, and public or authenticated delivery.',
    body: `## Documentation publishing model\n\nDocumentation is authored as governed content. Draft changes are saved into Staged, reviewed through Axis, approved through the publishing workflow, and activated as Online records for Axis and Nexus readers.\n\nThis keeps authoring separate from public delivery and gives the team a safe preview path before readers see changes.`,
    contentMode: 'text',
    audience: 'Business author, approver, operator',
  },
  {
    id: 'framework.modular-architecture',
    title: 'Modular architecture and ownership',
    slug: '/docs/framework/framework-modular-architecture',
    section: 'Framework Architecture and Design',
    summary:
      'How functional modules, technical modules, runtime servers, and customer projects fit together.',
    body: `## Modular architecture and ownership\n\nFunctional modules define the business capability boundary. Technical modules provide services, schemas, routes, pipelines, tasks, and renderers. Runtime servers activate the selected module set. Customer projects compose and extend those capabilities without rewriting the framework.\n\nThe architecture is valuable because it lets teams extend safely while keeping ownership clear.`,
    contentMode: 'text',
    audience: 'Architect, developer, operator',
  },
  {
    id: 'framework.runtime-server-composition',
    title: 'Runtime Server Composition',
    slug: '/docs/framework/framework-runtime-server-composition',
    section: 'Framework Architecture and Design',
    summary:
      'How project topology composes framework modules into Platform, WCMS, Process, and other runtime servers.',
    body: `## Runtime server composition\n\nA Nodics project can run Platform, WCMS, Process, Commerce, Engagement, Axis, Nexus, and other runtime surfaces. Each server activates the modules needed for its responsibility.\n\nThis avoids one monolithic runtime while still allowing the project to behave as one governed application landscape.`,
    contentMode: 'text',
    audience: 'Architect, DevOps, operator',
  },
  {
    id: 'framework.security-identity-access-governance',
    title: 'Security, Identity, and Access Governance',
    slug: '/docs/framework/security-identity-access-governance',
    section: 'Security, Governance, and Compliance',
    summary:
      'Authentication, authorization, groups, documentation authoring roles, read-only Axis access, tenant isolation, and audit responsibilities.',
    body: `## Security, identity, and access governance\n\nAxis is an authenticated operational experience. Public readers only see approved Online content. Internal users receive capabilities through backend-provided navigation, permissions, and filtered workspaces.\n\nDocumentation authoring must respect role, tenant, locale, access mode, and audit expectations before content is published.`,
    contentMode: 'text',
    audience: 'Administrator, security, operator',
  },
  {
    id: 'framework.wcms-page-designer-components',
    title: 'WCMS Page Designer and Components',
    slug: '/docs/framework/wcms-page-designer-components',
    section: 'Web Content Management',
    summary:
      'How WCMS page designers, slots, sections, components, and media combine into governed content experiences.',
    body: `## WCMS page designer and components\n\nThe WCMS designer lets authors compose pages from templates, slots, content sections, components, media, and routes. The same governance model applies: draft in Staged, preview, approve, publish, and consume Online.\n\nDocumentation authoring should follow the same mental model so CMS users experience one consistent journey.`,
    contentMode: 'text',
    audience: 'Business author, content operator',
  },
  {
    id: 'framework.process',
    title: 'Business Process and Automation Overview',
    slug: '/docs/framework/process',
    section: 'Process and Workflow Automation',
    summary:
      'Understand why nodics.process exists, how it helps business users, developers, and operators, and where it fits with Core, Cron, Platform, Axis, and customer modules.',
    body: `## Business process and automation overview\n\nNodics Process gives projects a governed way to model long-running business flows, human tasks, decisions, timers, actions, retries, audit events, and operational recovery.\n\nBusiness users should see the process intent and status. Developers should own adapters and extension points. Operators should see health, incidents, and evidence.`,
    contentMode: 'text',
    audience: 'Business, operator, developer',
  },
  {
    id: 'framework.local-runtime-troubleshooting',
    title: 'Local Runtime Troubleshooting',
    slug: '/docs/framework/framework-local-runtime-troubleshooting',
    section: 'Nodics Installer and Workspace Setup',
    summary:
      'Practical troubleshooting for ports, stale topology state, schema import failures, publication state, and missing navigation.',
    body: `## Local runtime troubleshooting\n\nWhen a local page or operation is missing, first check whether the runtime is listening, whether the correct server role is active, whether data was imported, whether publication moved from Staged to Online, and whether the authenticated user has navigation permission.\n\nTroubleshooting should produce evidence, not guesses.`,
    contentMode: 'text',
    audience: 'Operator, developer, QA',
  },
]);

const axisDraftPages: readonly DocumentationDraftPage[] = Object.freeze([
  {
    id: 'axis.overview',
    title: 'What Is Nodics Axis?',
    slug: '/docs/nodics-axis',
    section: 'Axis Overview',
    summary:
      'Understand Axis, its backend boundary, supported runtime, setup, configuration, quality commands, and implemented scope.',
    body: `## What is Nodics Axis?\n\nNodics Axis is the authenticated operations and business administration experience for Nodics projects. It renders backend-authorized navigation, workspaces, dashboards, designers, publishing flows, health evidence, and schema-backed operations.\n\nAxis should make backend governance usable without making business users think in schemas first.`,
    contentMode: 'text',
    audience: 'Business, administrator, operator',
  },
  {
    id: 'axis.architecture',
    title: 'Architecture and Repository Boundaries',
    slug: '/docs/nodics-axis/architecture',
    section: 'Axis Architecture',
    summary:
      'Learn the per-project deployment model, authority boundaries, role journeys, security model, documentation ownership, customization rules, and verification expectations.',
    body: `## Architecture and repository boundaries\n\nAxis is a frontend application that consumes backend contracts. It should not become a parallel authority for schemas, permissions, navigation, content, publication, or runtime health.\n\nThe repository owns presentation, interaction, accessibility, frontend validation, and integration with authorized backend APIs.`,
    contentMode: 'text',
    audience: 'Architect, developer, operator',
  },
  {
    id: 'axis.design-system',
    title: 'Design System and Application Shell',
    slug: '/docs/nodics-axis/design-system',
    section: 'Axis Experience',
    summary:
      'Understand authentication layouts, design foundations, shell structure, responsive states, accessibility, recovery, and extension rules.',
    body: `## Design system and application shell\n\nThe Axis shell provides the authenticated workspace frame, navigation rail, command/search surfaces, status signals, account controls, and responsive behavior.\n\nFeature pages should feel like focused operational tools: clear hierarchy, predictable navigation, compact controls, and strong recovery states.`,
    contentMode: 'text',
    audience: 'Designer, developer, administrator',
  },
  {
    id: 'axis.documentation-content',
    title: 'Documentation Content in Axis',
    slug: '/docs/nodics-axis/documentation-content',
    section: 'Documentation',
    summary:
      'Understand dynamic documentation products, content-pack installation, renderer ownership, failure recovery, and contributor verification.',
    body: `## Documentation content in Axis\n\nAxis can render documentation products provided by backend-published content packs. Authors work in Staged content, preview the reader projection, and publish approved records for Online consumption.\n\nThe Documentation Designer should hide schema complexity until the author needs advanced record-level control.`,
    contentMode: 'text',
    audience: 'Business author, operator, developer',
  },
  {
    id: 'axis.schema-workbench',
    title: 'Axis Schema Workbench',
    slug: '/docs/nodics-axis/schema-workbench',
    section: 'Workbench',
    summary:
      'Use and extend governed schema discovery, record operations, relationship coordination, failure recovery, responsive behavior, and verification.',
    body: `## Axis schema workbench\n\nThe schema workbench is powerful, but it is a technical surface. It is appropriate for administrators and developers who need record-level control.\n\nBusiness-facing designers should sit above it and translate author goals into governed record changes.`,
    contentMode: 'text',
    audience: 'Administrator, developer',
  },
  {
    id: 'axis.page-designer',
    title: 'Axis Page Designer',
    slug: '/docs/nodics-axis/page-designer',
    section: 'Content Designer',
    summary:
      'Use the governed catalog-first Designer flow for sites, templates, dynamic slots, sections, components, media, routes, navigation, and publish readiness.',
    body: `## Axis page designer\n\nThe Page Designer gives content teams a guided way to manage sites, templates, slots, sections, components, media, routes, navigation, and publishing readiness.\n\nDocumentation Designer should follow the same pattern: choose content, edit safely, preview, link, and publish.`,
    contentMode: 'text',
    audience: 'Business author, content operator',
  },
  {
    id: 'axis.media',
    title: 'Media Management',
    slug: '/docs/nodics-axis/media',
    section: 'Media',
    summary:
      'Manage media upload, validation, usage visibility, delivery readiness, and publication evidence from Axis.',
    body: `## Media management\n\nMedia is project data. Axis should help authors select, preview, validate, and reference media without breaking ownership boundaries.\n\nDocumentation page images should eventually use the media catalogue instead of raw URLs, while still giving authors a simple insert experience.`,
    contentMode: 'text',
    audience: 'Business author, media operator',
  },
  {
    id: 'axis.feature-delivery',
    title: 'Feature Delivery and Verification',
    slug: '/docs/nodics-axis/feature-delivery',
    section: 'Delivery',
    summary:
      'Coordinate implementation, visual verification, accessibility, tests, live smoke checks, and release confidence for Axis features.',
    body: `## Feature delivery and verification\n\nAxis changes should be verified through focused tests, typecheck, and live browser checks when the change is visual or interactive.\n\nFor business journeys, the final question is not whether a component renders. It is whether the user can complete the intended operation confidently.`,
    contentMode: 'text',
    audience: 'Developer, QA, operator',
  },
]);

const kickoffDraftPages: readonly DocumentationDraftPage[] = Object.freeze([
  {
    id: 'kickoff.overview',
    title: 'Kickoff project overview',
    slug: '/docs/nodics-kickoff',
    section: 'Kickoff Overview',
    summary:
      'Understand what Nodics Kickoff owns, how it demonstrates the framework, and where project-owned documentation belongs.',
    body: `## Kickoff project overview\n\nNodics Kickoff is the reference customer project for proving local runtime, publication, Axis operations, Nexus delivery, and project-owned customization.\n\nIt demonstrates how a real project composes framework capability without moving customer-specific data back into the framework checkout.`,
    contentMode: 'text',
    audience: 'Business, architect, operator',
  },
  {
    id: 'kickoff.local-runtime',
    title: 'Local runtime topology',
    slug: '/docs/nodics-kickoff/kickoff-local-runtime',
    section: 'Local Operations',
    summary:
      'Start and reason about the local Platform, WCMS, and Process servers that make the reference project usable.',
    body: `## Local runtime topology\n\nKickoff local runtime coordinates Platform, WCMS Staged, WCMS Online, Process, Axis, Nexus, and related services. Each runtime owns a clear role in authoring, approval, delivery, or operation.\n\nA useful local setup makes the complete Staged-to-Online journey observable.`,
    contentMode: 'text',
    audience: 'Operator, developer',
  },
  {
    id: 'kickoff.local-setup-to-live',
    title: 'Local setup to live runbook',
    slug: '/docs/nodics-kickoff/kickoff-local-setup-to-live',
    section: 'Local Operations',
    summary:
      'Follow the screenshot-guided path from local startup to Axis login, guided setup, publication, and live Nexus and Agora verification.',
    body: `## Local setup to live runbook\n\nThe runbook takes a user from clean local startup through Axis login, setup readiness, Staged data, publication, and live browser verification.\n\nThe point is to prove that a customer project can become usable through governed operational steps, not manual database edits.`,
    contentMode: 'text',
    audience: 'Business, operator, QA',
  },
  {
    id: 'kickoff.local-acceptance',
    title: 'Local acceptance checklist',
    slug: '/docs/nodics-kickoff/kickoff-local-acceptance',
    section: 'Qualification',
    summary:
      'Run a fresh local database bootstrap and verify Platform, WCMS, Cron, Axis, documentation, media, and module lifecycle behavior.',
    body: `## Local acceptance checklist\n\nAcceptance should verify that runtimes start, module registration is available, documentation loads, CMS content publishes, media references resolve, and browser journeys work.\n\nThe checklist turns local confidence into repeatable evidence.`,
    contentMode: 'text',
    audience: 'QA, operator, developer',
  },
  {
    id: 'kickoff.local-publishing-operations',
    title: 'Local publishing operations',
    slug: '/docs/nodics-kickoff/kickoff-local-publishing-operations',
    section: 'Publishing',
    summary:
      'Operate, diagnose, recover, upgrade, retain, and qualify the Local Staged-to-Online publishing lifecycle without direct database access.',
    body: `## Local publishing operations\n\nPublishing moves approved records from Staged to Online through governed lifecycle services. Operators should be able to inspect status, recover failed steps, and verify delivery without writing directly to Online storage.\n\nDocumentation changes follow this same model.`,
    contentMode: 'text',
    audience: 'Operator, approver, administrator',
  },
  {
    id: 'kickoff.deployment-qualification',
    title: 'Deployment qualification',
    slug: '/docs/nodics-kickoff/kickoff-deployment-qualification',
    section: 'Qualification',
    summary:
      'Run the governed local evidence pack and coordinate production-only load, resilience, security, provider, recovery, and accessibility sign-off.',
    body: `## Deployment qualification\n\nA Kickoff deployment should prove readiness through evidence: local acceptance, security checks, resilience expectations, publication behavior, provider configuration, recovery path, and accessibility.\n\nThe qualification record should be readable by business owners and operators, not only developers.`,
    contentMode: 'text',
    audience: 'Business, operator, QA',
  },
  {
    id: 'kickoff.customization',
    title: 'Customer customization guide',
    slug: '/docs/nodics-kickoff/kickoff-customization',
    section: 'Customization',
    summary:
      'Use Kickoff as a safe example for project modules, environment configuration, and customer overlays.',
    body: `## Customer customization guide\n\nCustomer projects should customize through project modules, configuration, data, content, and approved extension points. Framework modules remain reusable and should not absorb customer-specific behavior.\n\nKickoff exists to make that boundary concrete.`,
    contentMode: 'text',
    audience: 'Business, architect, developer',
  },
  {
    id: 'kickoff.functional-journeys',
    title: 'Commerce and Engagement functional journeys',
    slug: '/docs/nodics-kickoff/kickoff-functional-journeys',
    section: 'Functional Journeys',
    summary:
      'Follow the local customer, operator, visibility, reversal, recovery, privacy, and provider-sandbox journeys with clear ownership and verification evidence.',
    body: `## Commerce and engagement functional journeys\n\nKickoff shows customer and operator journeys across commerce, engagement, visibility, reversal, privacy, provider sandbox behavior, and recovery.\n\nEach journey should connect business outcome, module ownership, data state, publication state, and browser-visible evidence.`,
    contentMode: 'text',
    audience: 'Business, operator, QA',
  },
]);

function documentationDraftPages(
  source: AxisCmsDocumentationSource | undefined,
): readonly DocumentationDraftPage[] {
  const sourceKey =
    `${source?.id ?? ''} ${source?.packCode ?? ''} ${source?.label ?? ''}`
      .toLowerCase()
      .trim();
  const pages = sourceKey.includes('axis')
    ? axisDraftPages
    : sourceKey.includes('kickoff')
      ? kickoffDraftPages
      : frameworkDraftPages;
  return Object.freeze(pages.map((page) => ({ ...page })));
}

const documentationPageSchemaRef = Object.freeze({
  schemaName: 'cmsDocumentationPage',
});
const documentationRouteSchemaRef = Object.freeze({ schemaName: 'cmsPageRoute' });
const documentationComponentSchemaRef = Object.freeze({ schemaName: 'cmsComponent' });
const documentationCmsPageSchemaRef = Object.freeze({ schemaName: 'cmsPage' });
const documentationNodeSchemaRef = Object.freeze({
  schemaName: 'cmsDocumentationNode',
});
const documentationRecordReadLimit = 1_000;

function documentationWorkbenchConnection(
  bootstrap: AxisAuthenticatedBootstrap,
  source: AxisCmsDocumentationSource | undefined,
): AxisModuleConnection | undefined {
  const moduleName = source?.connectionModule ?? 'cms';
  return (
    selectModuleConnection(bootstrap, moduleName, { publicationRole: 'STAGED' }) ??
    selectModuleConnection(bootstrap, moduleName)
  );
}

function documentationSourceProductCode(
  source: AxisCmsDocumentationSource | undefined,
): string | undefined {
  const packCode = source?.packCode?.trim();
  return packCode ? `${packCode}Product` : undefined;
}

function recordText(record: WorkbenchRecord, field: string): string {
  const value = record[field];
  return typeof value === 'string' ? value.trim() : '';
}

function recordNumber(record: WorkbenchRecord, field: string): number | undefined {
  const value = record[field];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function recordTextList(record: WorkbenchRecord, field: string): readonly string[] {
  const value = record[field];
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.filter(
      (item): item is string => typeof item === 'string' && item.trim() !== '',
    ),
  );
}

function recordObject(
  record: WorkbenchRecord | undefined,
  field: string,
): Readonly<Record<string, unknown>> {
  const value = record?.[field];
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.freeze({ ...(value as Record<string, unknown>) })
    : Object.freeze({});
}

function sentenceCaseLabel(value: string): string {
  return value
    .replace(/\.[^.]+$/, '')
    .replace(/[-_.]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function documentationRecordSection(
  record: WorkbenchRecord,
  source: AxisCmsDocumentationSource | undefined,
): string {
  const sourcePath = recordText(record, 'sourcePath');
  const pathSection = /docs\/pages\/([^/]+)/u.exec(sourcePath)?.[1];
  if (pathSection) return sentenceCaseLabel(pathSection);
  return source?.label ?? recordText(record, 'technicalModule') ?? 'Documentation';
}

function documentationRecordBody(record: WorkbenchRecord, title: string): string {
  const summary = recordText(record, 'summary');
  const businessSummary = recordText(record, 'businessSummary');
  const technicalSummary = recordText(record, 'technicalSummary');
  const sourcePath = recordText(record, 'sourcePath');
  const sections = [
    `## ${title}`,
    summary,
    businessSummary ? `### Business context\n\n${businessSummary}` : '',
    technicalSummary ? `### Technical context\n\n${technicalSummary}` : '',
    sourcePath ? `### Source evidence\n\n${sourcePath}` : '',
  ].filter((section) => section.trim() !== '');
  return sections.join('\n\n');
}

function pageRichTextDocument(page: DocumentationDraftPage): CmsRichTextDocument {
  return page.contentJson ?? textToCmsRichTextDocument(page.body);
}

function documentationDesignerComponent(
  code: string,
  renderer: string,
  slot: string,
  index: number,
  properties: Readonly<Record<string, unknown>>,
): CmsComponentContract {
  return Object.freeze({
    code,
    typeCode: code,
    renderer,
    rendererContractVersion: 2,
    rendererChannels: Object.freeze(['web']),
    rendererDeprecated: false,
    properties: Object.freeze({ ...properties }),
    slot,
    index,
    components: Object.freeze([]),
  });
}

function documentationDesignerPageContract(
  page: DocumentationDraftPage,
): CmsPageContract {
  return Object.freeze({
    code: page.targetPageCode ?? page.id,
    name: page.title,
    typeCode: 'nodicsDocumentationArticlePageType',
    template: 'nodicsDocumentationArticleTemplate',
    renderer: 'documentation.page.article',
    rendererContractVersion: 2,
    rendererChannels: Object.freeze(['web']),
    rendererDeprecated: false,
    templateContract: Object.freeze({
      code: 'nodicsDocumentationArticleTemplate',
      renderer: 'documentation.template.article',
      contractVersion: 2,
    }),
    components: Object.freeze([]),
  });
}

function documentationSectionOrder(section: string): number {
  const normalized = section.trim().toLowerCase();
  let score = 0;
  for (const character of normalized) {
    score = (score * 31 + character.charCodeAt(0)) % 997;
  }
  return score + 100;
}

function documentationDesignerNavigationComponent(
  pages: readonly DocumentationDraftPage[],
  links: readonly DocumentationDraftLink[],
  selectedSource: AxisCmsDocumentationSource | undefined,
): CmsComponentContract {
  const pageById = new Map(pages.map((page) => [page.id, page]));
  const linkedPageIds = new Set<string>();
  const parentOrderByLabel = new Map<string, number>();
  links.forEach((link, index) => {
    const parentLabel = link.parentLabel || 'Wiki home';
    const currentOrder = parentOrderByLabel.get(parentLabel);
    const nextOrder = link.parentOrder ?? (index + 1) * 10;
    parentOrderByLabel.set(
      parentLabel,
      currentOrder === undefined ? nextOrder : Math.min(currentOrder, nextOrder),
    );
  });
  const linkedItems = links.flatMap((link, index) => {
    const page = pageById.get(link.pageId);
    if (!page) return [];
    linkedPageIds.add(page.id);
    const parentLabel = link.parentLabel || page.section || 'Wiki home';
    return [
      {
        title: link.label || page.title,
        route: page.slug,
        sectionTitle: parentLabel,
        sectionOrder:
          parentOrderByLabel.get(parentLabel) ?? documentationSectionOrder(parentLabel),
        order: Number(link.order) || (index + 1) * 10,
        audience: documentationAudienceValues(page.audience),
        searchText: [
          link.label,
          parentLabel,
          page.title,
          page.slug,
          page.section,
          page.summary,
          page.audience,
          link.visibility,
        ].join(' '),
      },
    ];
  });
  const unlinkedItems = pages.flatMap((page, index) =>
    linkedPageIds.has(page.id)
      ? []
      : [
          {
            title: page.title,
            route: page.slug,
            sectionTitle: 'Unlinked staged pages',
            sectionOrder: 9000,
            order: (index + 1) * 10,
            audience: documentationAudienceValues(page.audience),
            searchText: [
              page.title,
              page.slug,
              page.section,
              page.summary,
              page.audience,
              'unlinked staged pages',
            ].join(' '),
          },
        ],
  );
  return documentationDesignerComponent(
    'documentationDesignerNavigation',
    'documentation.component.navigation',
    'navigation',
    5,
    {
      title: selectedSource?.label ?? 'Documentation',
      searchLabel: 'Search pages',
      searchPlaceholder: 'Search documentation pages',
      emptyMessage: 'No staged documentation pages match this search.',
      items: [...linkedItems, ...unlinkedItems],
    },
  );
}

function documentationNavigationParentOptions({
  currentLink,
  links,
  pages,
  selectedSource,
}: {
  readonly currentLink: DocumentationDraftLink;
  readonly links: readonly DocumentationDraftLink[];
  readonly pages: readonly DocumentationDraftPage[];
  readonly selectedSource: AxisCmsDocumentationSource | undefined;
}): readonly DocumentationNavigationParentOption[] {
  const rootLabel = `${selectedSource?.label ?? 'Documentation'} root`;
  const pageById = new Map(pages.map((page) => [page.id, page]));
  const sectionOptions = new Map<
    string,
    DocumentationNavigationParentOption & { readonly sortKey: number }
  >();
  const pageOptions = new Map<
    string,
    DocumentationNavigationParentOption & {
      readonly parentKey: string;
      readonly sortKey: number;
    }
  >();
  links.forEach((link) => {
    if (link.parentNodeCode && link.parentLabel) {
      const sectionOrder =
        link.parentOrder ?? documentationSectionOrder(link.parentLabel);
      sectionOptions.set(
        `section:${link.parentNodeCode}`,
        Object.freeze({
          value: `section:${link.parentNodeCode}`,
          label: link.parentLabel,
          title: link.parentLabel,
          description: 'Topic in the current documentation navigation.',
          parentLabel: link.parentLabel,
          parentNodeCode: link.parentNodeCode,
          order: sectionOrder,
          depth: 1,
          kind: 'section',
          searchText: `${link.parentLabel} existing navigation parent section topic ${rootLabel}`,
          sortKey: sectionOrder,
        }),
      );
    }
    if (link.id !== currentLink.id && link.pageId !== currentLink.pageId) {
      const page = pageById.get(link.pageId);
      const pageNodeCode =
        recordText(link.originalNodeRecord ?? {}, 'code') || link.id || page?.id;
      if (pageNodeCode) {
        const parentLabel = link.parentLabel || page?.section || 'Wiki home';
        const parentOrder =
          link.parentOrder ?? documentationSectionOrder(parentLabel || 'Wiki home');
        const pageOrder = Number(link.order) || 100;
        const parentKey = link.parentNodeCode
          ? `section:${link.parentNodeCode}`
          : navigationRootParentValue;
        const title = link.label || page?.title || pageNodeCode;
        const pathLabel =
          parentKey === navigationRootParentValue ? title : `${parentLabel} / ${title}`;
        pageOptions.set(
          `page:${pageNodeCode}`,
          Object.freeze({
            value: `page:${pageNodeCode}`,
            label: pathLabel,
            title,
            description: page?.slug || `Child page under ${parentLabel}`,
            parentLabel: title,
            parentNodeCode: pageNodeCode,
            order: pageOrder,
            depth: parentKey === navigationRootParentValue ? 1 : 2,
            kind: 'page',
            searchText: [
              link.label,
              pathLabel,
              page?.title,
              page?.slug,
              parentLabel,
              page?.summary,
              'existing page link',
            ].join(' '),
            parentKey,
            sortKey: 100_000 + parentOrder * 1_000 + pageOrder,
          }),
        );
      }
    }
  });
  const pagesByParent = new Map<
    string,
    Array<
      DocumentationNavigationParentOption & {
        readonly parentKey: string;
        readonly sortKey: number;
      }
    >
  >();
  pageOptions.forEach((option) => {
    const parentPages = pagesByParent.get(option.parentKey) ?? [];
    parentPages.push(option);
    pagesByParent.set(option.parentKey, parentPages);
  });
  const orderedOptions: Array<
    DocumentationNavigationParentOption & { readonly sortKey?: number }
  > = [
    Object.freeze({
      value: navigationRootParentValue,
      label: `Top level (${rootLabel})`,
      title: 'Top level',
      description: 'Place beside first-level documentation topics.',
      parentLabel: rootLabel,
      parentNodeCode: '',
      order: 0,
      depth: 0,
      kind: 'root' as const,
      searchText: `top level root ${rootLabel}`,
      sortKey: 0,
    }),
  ];
  const pushPages = (parentKey: string) => {
    const childPages = pagesByParent.get(parentKey) ?? [];
    childPages
      .sort(
        (left, right) =>
          left.sortKey - right.sortKey || left.title.localeCompare(right.title),
      )
      .forEach((option) => orderedOptions.push(option));
  };
  pushPages(navigationRootParentValue);
  [...sectionOptions.values()]
    .sort(
      (left, right) =>
        left.sortKey - right.sortKey || left.title.localeCompare(right.title),
    )
    .forEach((section) => {
      orderedOptions.push(section);
      pushPages(section.value);
    });
  [...pageOptions.values()]
    .filter((option) => !orderedOptions.some((item) => item.value === option.value))
    .sort(
      (left, right) =>
        left.sortKey - right.sortKey || left.title.localeCompare(right.title),
    )
    .forEach((option) => orderedOptions.push(option));
  orderedOptions.push(
    Object.freeze({
      value: navigationNewParentValue,
      label: 'Create new parent topic',
      title: 'Create new parent topic',
      description: 'Create a new top-level topic and place this page under it.',
      parentLabel: 'New topic',
      parentNodeCode: navigationNewParentValue,
      order: 100,
      depth: 0,
      kind: 'new' as const,
      searchText: 'create new parent topic',
      sortKey: 1_000_000,
    }),
  );
  return Object.freeze(
    orderedOptions.map((option) =>
      Object.freeze({
        value: option.value,
        label: option.label,
        title: option.title,
        description: option.description,
        parentLabel: option.parentLabel,
        parentNodeCode: option.parentNodeCode,
        order: option.order,
        depth: option.depth,
        kind: option.kind,
        searchText: option.searchText,
      }),
    ),
  );
}

function selectedNavigationParentValue(
  link: DocumentationDraftLink,
  options: readonly DocumentationNavigationParentOption[],
): string {
  if (link.parentNodeCode?.startsWith(navigationNewParentPrefix)) {
    return navigationNewParentValue;
  }
  if (link.parentNodeCode) {
    const existing = options.find(
      (option) => option.parentNodeCode === link.parentNodeCode,
    );
    if (existing) return existing.value;
  }
  return navigationRootParentValue;
}

function navigationPathSegments(
  link: DocumentationDraftLink,
  selectedSource: AxisCmsDocumentationSource | undefined,
): readonly string[] {
  const rootLabel = `${selectedSource?.label ?? 'Documentation'} root`;
  const parentLabel = link.parentLabel.trim();
  return Object.freeze(
    [
      'Wiki home',
      parentLabel && parentLabel !== rootLabel ? parentLabel : '',
      link.label,
    ]
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function documentationDesignerHeadingAnchor(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .slice(0, 80) || 'section'
  );
}

function documentationDesignerArticleComponent(
  page: DocumentationDraftPage,
): CmsComponentContract {
  const richText = cmsRichTextComponentProperties(pageRichTextDocument(page));
  const headings = richText.blocks.flatMap((block) => {
    if (block.kind !== 'heading') return [];
    const text = typeof block.text === 'string' ? block.text : '';
    const level = typeof block.level === 'number' ? block.level : 2;
    if (!text || level <= 1) return [];
    return [
      {
        anchor: documentationDesignerHeadingAnchor(text),
        level,
        text,
      },
    ];
  });
  return documentationDesignerComponent(
    page.articleComponentId ?? `${page.id}-article`,
    'documentation.component.article',
    'article',
    10,
    {
      title: page.title,
      category: page.section,
      summary: page.summary,
      route: page.slug,
      audience: documentationAudienceValues(page.audience),
      lifecycleState: page.isNew ? 'NEW STAGED DRAFT' : 'STAGED DRAFT',
      maturityState: page.isNew ? 'Drafting' : 'Editable preview',
      accessMode: 'PUBLIC',
      headings,
      visualRequirements: Object.freeze(['staged preview']),
      blocks: richText.blocks,
    },
  );
}

async function loadAllDocumentationRecords(
  connection: AxisModuleConnection,
  schema: WorkbenchSchema,
  configuration: WorkbenchClientConfiguration,
  signal: AbortSignal | undefined,
): Promise<readonly WorkbenchRecord[]> {
  const pageSize = Math.min(
    Math.max(schema.queryCapabilities.defaultPageSize, 50),
    schema.queryCapabilities.maximumPageSize,
    documentationRecordReadLimit,
  );
  const sort = resolveWorkbenchRecordSort(schema, undefined);
  const firstPage = await loadWorkbenchRecords(
    connection,
    schema,
    configuration,
    {
      search: '',
      pageNumber: 1,
      pageSize,
      sort,
    },
    fetch,
    signal,
  );
  const records = [...firstPage.records];
  const totalCount = Math.min(firstPage.totalCount, documentationRecordReadLimit);
  let pageNumber = 2;
  while (records.length < totalCount) {
    const nextPage = await loadWorkbenchRecords(
      connection,
      schema,
      configuration,
      {
        search: '',
        pageNumber,
        pageSize,
        sort,
      },
      fetch,
      signal,
    );
    if (nextPage.records.length === 0) break;
    records.push(...nextPage.records);
    pageNumber += 1;
  }
  return Object.freeze(records.slice(0, documentationRecordReadLimit));
}

async function loadDocumentationDraftPagesFromCms(
  bootstrap: AxisAuthenticatedBootstrap,
  selectedSource: AxisCmsDocumentationSource | undefined,
  configuration: WorkbenchClientConfiguration,
  signal: AbortSignal | undefined,
): Promise<readonly DocumentationDraftPage[]> {
  const connection = documentationWorkbenchConnection(bootstrap, selectedSource);
  if (!connection) return Object.freeze([]);
  const [pageSchema, routeSchema, componentSchema] = await Promise.all([
    loadGeneratedSchemaCapabilities(
      connection,
      documentationPageSchemaRef,
      configuration,
      fetch,
    ).then(schemaWithValidQueryCapabilities),
    loadGeneratedSchemaCapabilities(
      connection,
      documentationRouteSchemaRef,
      configuration,
      fetch,
    ).then(schemaWithValidQueryCapabilities),
    loadGeneratedSchemaCapabilities(
      connection,
      documentationComponentSchemaRef,
      configuration,
      fetch,
    ).then(schemaWithValidQueryCapabilities),
  ]);
  const [pageRecords, routeRecords, componentRecords] = await Promise.all([
    loadAllDocumentationRecords(connection, pageSchema, configuration, signal),
    loadAllDocumentationRecords(connection, routeSchema, configuration, signal),
    loadAllDocumentationRecords(connection, componentSchema, configuration, signal),
  ]);
  const expectedProduct = documentationSourceProductCode(selectedSource);
  const matchingProductExists =
    expectedProduct !== undefined &&
    pageRecords.some((record) => recordText(record, 'product') === expectedProduct);
  const records = matchingProductExists
    ? pageRecords.filter((record) => recordText(record, 'product') === expectedProduct)
    : pageRecords;
  const routeByCode = new Map<string, string>();
  const routeByPage = new Map<string, string>();
  routeRecords.forEach((record) => {
    const path = recordText(record, 'path');
    if (!path) return;
    const code = recordText(record, 'code');
    const page = recordText(record, 'page');
    if (code) routeByCode.set(code, path);
    if (page) routeByPage.set(page, path);
  });
  const componentByCode = new Map<string, WorkbenchRecord>();
  componentRecords.forEach((record) => {
    const code = recordText(record, 'code');
    if (code) componentByCode.set(code, record);
  });
  const pages = records
    .map((record): DocumentationDraftPage | undefined => {
      const id = recordText(record, 'code') || recordText(record, 'documentId');
      const title = recordText(record, 'title');
      if (!id || !title) return undefined;
      const targetRoute = recordText(record, 'targetRoute');
      const targetPage = recordText(record, 'targetPage');
      const articleComponentId = recordText(record, 'articleComponent');
      const articleComponent = componentByCode.get(articleComponentId);
      const articleProperties = recordObject(articleComponent, 'properties');
      const fallbackBody = documentationRecordBody(record, title);
      const contentJson = documentationBlocksToCmsRichTextDocument(
        articleProperties.blocks,
        fallbackBody,
      );
      const audience = recordTextList(record, 'audience')
        .map(sentenceCaseLabel)
        .join(', ');
      const slug =
        routeByCode.get(targetRoute) ??
        routeByPage.get(targetPage) ??
        selectedSource?.defaultPage ??
        selectedSource?.route ??
        '/docs';
      return {
        id,
        title,
        slug,
        section: documentationRecordSection(record, selectedSource),
        summary:
          recordText(record, 'summary') || 'Documentation page ready for editing.',
        body: cmsRichTextDocumentToText(contentJson) || fallbackBody,
        contentMode: 'text',
        contentJson,
        audience: audience || 'Business, architect, developer, operator',
        articleComponentId,
        originalComponentRecord: articleComponent,
        originalPageRecord: record,
        originalRouteRecord: routeRecords.find(
          (route) =>
            recordText(route, 'code') === targetRoute ||
            recordText(route, 'page') === targetPage,
        ),
        targetPageCode: targetPage,
        targetRouteCode: targetRoute,
      };
    })
    .filter((page): page is DocumentationDraftPage => Boolean(page));
  const uniquePages = new Map<string, DocumentationDraftPage>();
  pages.forEach((page) => uniquePages.set(page.id, page));
  return Object.freeze(
    [...uniquePages.values()].sort(
      (left, right) =>
        left.section.localeCompare(right.section) ||
        left.title.localeCompare(right.title),
    ),
  );
}

function useDocumentationDraftPageSource({
  accessToken,
  bootstrap,
  runtime,
  selectedSource,
}: {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
  readonly selectedSource: AxisCmsDocumentationSource | undefined;
}): {
  readonly isLoading: boolean;
  readonly pages: readonly DocumentationDraftPage[];
  readonly sourceError: Error | null;
} {
  const fallbackPages = useMemo(
    () => documentationDraftPages(selectedSource),
    [selectedSource],
  );
  const configuration = useMemo<WorkbenchClientConfiguration>(
    () => ({
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs],
  );
  const cmsPages = useQuery({
    enabled: Boolean(documentationWorkbenchConnection(bootstrap, selectedSource)),
    queryKey: [
      'documentation-designer',
      'cms-pages',
      runtime.enterpriseCode,
      selectedSource?.id ?? 'framework',
      selectedSource?.packCode ?? '',
      connectionKey(documentationWorkbenchConnection(bootstrap, selectedSource)),
    ],
    queryFn: ({ signal }) =>
      loadDocumentationDraftPagesFromCms(
        bootstrap,
        selectedSource,
        configuration,
        signal,
      ),
  });
  const pages =
    cmsPages.data && cmsPages.data.length > 0 ? cmsPages.data : fallbackPages;
  return {
    isLoading: cmsPages.isLoading,
    pages,
    sourceError: cmsPages.error instanceof Error ? cmsPages.error : null,
  };
}

function documentationDraftLinks(
  pages: readonly DocumentationDraftPage[],
): readonly DocumentationDraftLink[] {
  return Object.freeze(
    pages.map((page, index) => ({
      id: `${page.id}-link`,
      pageId: page.id,
      label: page.title,
      parentLabel: index === 0 ? 'Wiki home' : (pages[0]?.title ?? 'Wiki home'),
      parentOrder: index === 0 ? 0 : 10,
      order: String((index + 1) * 10),
      visibility: index === 0 ? 'Public' : 'Axis + Nexus',
    })),
  );
}

function navigationVisibilityLabel(accessMode: string): string {
  const normalized = accessMode.trim().toUpperCase();
  if (normalized === 'AUTHENTICATED') return 'Internal Axis';
  if (normalized === 'ROLE_BASED' || normalized === 'GROUP_BASED')
    return 'Permission limited';
  return normalized === 'PUBLIC' ? 'Axis + Nexus' : 'Public';
}

function visibilityAccessMode(visibility: string): string {
  const normalized = visibility.trim().toLowerCase();
  if (normalized.includes('internal')) return 'AUTHENTICATED';
  if (normalized.includes('permission')) return 'ROLE_BASED';
  return 'PUBLIC';
}

function documentationNavigationCode(
  source: AxisCmsDocumentationSource | undefined,
  originalNode: WorkbenchRecord | undefined,
): string {
  return (
    recordText(originalNode ?? {}, 'navigation') ||
    (source?.packCode
      ? `${source.packCode}Navigation`
      : 'nodicsDocumentationNavigation')
  );
}

function findPageForNavigationNode(
  node: WorkbenchRecord,
  pages: readonly DocumentationDraftPage[],
): DocumentationDraftPage | undefined {
  const targetDocumentationPage = recordText(node, 'targetDocumentationPage');
  const targetPage = recordText(node, 'targetPage');
  const targetRoute = recordText(node, 'targetRoute');
  return pages.find(
    (page) =>
      recordText(page.originalPageRecord ?? {}, 'code') === targetDocumentationPage ||
      page.id === targetDocumentationPage ||
      page.targetPageCode === targetPage ||
      page.targetRouteCode === targetRoute,
  );
}

async function loadDocumentationDraftLinksFromCms(
  bootstrap: AxisAuthenticatedBootstrap,
  selectedSource: AxisCmsDocumentationSource | undefined,
  configuration: WorkbenchClientConfiguration,
  pages: readonly DocumentationDraftPage[],
  signal: AbortSignal | undefined,
): Promise<readonly DocumentationDraftLink[]> {
  const connection = documentationWorkbenchConnection(bootstrap, selectedSource);
  if (!connection) return Object.freeze([]);
  const nodeSchema = await loadGeneratedSchemaCapabilities(
    connection,
    documentationNodeSchemaRef,
    configuration,
    fetch,
  ).then(schemaWithValidQueryCapabilities);
  const nodeRecords = await loadAllDocumentationRecords(
    connection,
    nodeSchema,
    configuration,
    signal,
  );
  const expectedProduct = documentationSourceProductCode(selectedSource);
  const matchingProductExists =
    expectedProduct !== undefined &&
    nodeRecords.some((record) => recordText(record, 'product') === expectedProduct);
  const records = matchingProductExists
    ? nodeRecords.filter((record) => recordText(record, 'product') === expectedProduct)
    : nodeRecords;
  const nodeByCode = new Map<string, WorkbenchRecord>();
  records.forEach((record) => {
    const code = recordText(record, 'code');
    if (code) nodeByCode.set(code, record);
  });
  const links = records
    .map((record): DocumentationDraftLink | undefined => {
      const page = findPageForNavigationNode(record, pages);
      if (!page) return undefined;
      const parentNodeCode = recordText(record, 'parentNode');
      const parentNode = parentNodeCode ? nodeByCode.get(parentNodeCode) : undefined;
      const parentNodeType = recordText(parentNode ?? {}, 'nodeType');
      const parentNodeTitle =
        parentNodeType === 'PAGE' || parentNodeType === 'PAGE_LINK'
          ? ''
          : recordText(parentNode ?? {}, 'nodeTitle');
      const parentNodeOrder =
        parentNode === undefined ? undefined : recordNumber(parentNode, 'nodeOrder');
      const code = recordText(record, 'code');
      const label = recordText(record, 'nodeTitle') || page.title;
      return {
        id: code || `${page.id}-link`,
        pageId: page.id,
        label,
        parentLabel:
          parentNodeTitle ||
          page.section ||
          (parentNodeCode ? sentenceCaseLabel(parentNodeCode) : 'Wiki home'),
        parentOrder: parentNodeOrder,
        order: String(recordNumber(record, 'nodeOrder') ?? 100),
        visibility: navigationVisibilityLabel(recordText(record, 'accessMode')),
        navigationCode: recordText(record, 'navigation'),
        nodeLevel: recordText(record, 'nodeLevel'),
        nodeType: recordText(record, 'nodeType'),
        originalNodeRecord: record,
        parentNodeCode,
      };
    })
    .filter((link): link is DocumentationDraftLink => Boolean(link));
  return Object.freeze(
    links.sort(
      (left, right) =>
        Number(left.order) - Number(right.order) ||
        left.label.localeCompare(right.label),
    ),
  );
}

function useDocumentationDraftLinkSource({
  accessToken,
  bootstrap,
  pages,
  runtime,
  selectedSource,
}: {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly pages: readonly DocumentationDraftPage[];
  readonly runtime: AxisRuntimeConfig;
  readonly selectedSource: AxisCmsDocumentationSource | undefined;
}): {
  readonly isLoading: boolean;
  readonly links: readonly DocumentationDraftLink[];
  readonly sourceError: Error | null;
} {
  const fallbackLinks = useMemo(() => documentationDraftLinks(pages), [pages]);
  const configuration = useMemo<WorkbenchClientConfiguration>(
    () => ({
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs],
  );
  const cmsLinks = useQuery({
    enabled:
      Boolean(documentationWorkbenchConnection(bootstrap, selectedSource)) &&
      pages.length > 0,
    queryKey: [
      'documentation-designer',
      'cms-navigation-links',
      runtime.enterpriseCode,
      selectedSource?.id ?? 'framework',
      selectedSource?.packCode ?? '',
      pages.map((page) => page.id).join('|'),
      connectionKey(documentationWorkbenchConnection(bootstrap, selectedSource)),
    ],
    queryFn: ({ signal }) =>
      loadDocumentationDraftLinksFromCms(
        bootstrap,
        selectedSource,
        configuration,
        pages,
        signal,
      ),
  });
  const links =
    cmsLinks.data && cmsLinks.data.length > 0 ? cmsLinks.data : fallbackLinks;
  return {
    isLoading: cmsLinks.isLoading,
    links,
    sourceError: cmsLinks.error instanceof Error ? cmsLinks.error : null,
  };
}

interface PersistDocumentationDraftLinkInput {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly configuration: WorkbenchClientConfiguration;
  readonly link: DocumentationDraftLink;
  readonly pages: readonly DocumentationDraftPage[];
  readonly selectedSource: AxisCmsDocumentationSource | undefined;
}

async function saveDocumentationDraftLink({
  bootstrap,
  configuration,
  link,
  pages,
  selectedSource,
}: PersistDocumentationDraftLinkInput): Promise<void> {
  const connection = documentationWorkbenchConnection(bootstrap, selectedSource);
  if (!connection) throw new Error('Documentation staged connection is unavailable');
  const nodeSchema = await loadGeneratedSchemaCapabilities(
    connection,
    documentationNodeSchemaRef,
    configuration,
    fetch,
  );
  const page = pages.find((item) => item.id === link.pageId);
  if (!page) throw new Error('Select a documentation page before saving the link');
  const codeSegment = documentationCodeSegment(link.id || `${link.label}-${page.slug}`);
  const nodeCode =
    recordText(link.originalNodeRecord ?? {}, 'code') || `cmsDocsNode${codeSegment}`;
  const productCode =
    recordText(link.originalNodeRecord ?? {}, 'product') ||
    documentationSourceProductCode(selectedSource) ||
    `${selectedSource?.id ?? 'documentation'}Product`;
  const requestedParentNodeCode = link.parentNodeCode?.trim() ?? '';
  const parentNodeCode = requestedParentNodeCode.startsWith(navigationNewParentPrefix)
    ? `cmsDocsNode${documentationCodeSegment(link.parentLabel || 'Topic')}`
    : requestedParentNodeCode;
  if (requestedParentNodeCode.startsWith(navigationNewParentPrefix)) {
    await createWorkbenchRecord(
      connection,
      nodeSchema,
      {
        code: parentNodeCode,
        product: productCode,
        navigation: documentationNavigationCode(
          selectedSource,
          link.originalNodeRecord,
        ),
        nodeLevel: 'SECTION',
        nodeType: 'CONTAINER',
        nodeTitle: link.parentLabel || 'New topic',
        nodeSummary: `Navigation topic for ${page.title}.`,
        nodeOrder: link.parentOrder ?? documentationSectionOrder(link.parentLabel),
        expandable: true,
        expandedByDefault: true,
        nodeIcon: 'folder',
        accessMode: visibilityAccessMode(link.visibility),
        allowedRoles: [],
        allowedGroups: [],
        allowedPermissions: [],
        lifecycleState: 'STAGED',
        maturityState: 'IMPLEMENTED',
        locale: recordText(link.originalNodeRecord ?? {}, 'locale') || 'en',
        channel: recordText(link.originalNodeRecord ?? {}, 'channel') || 'web',
        active: true,
      },
      configuration,
      fetch,
    );
  }
  const model = {
    ...(link.originalNodeRecord ?? {}),
    code: nodeCode,
    product: productCode,
    navigation: documentationNavigationCode(selectedSource, link.originalNodeRecord),
    parentNode: parentNodeCode || undefined,
    nodeLevel:
      link.nodeLevel ||
      recordText(link.originalNodeRecord ?? {}, 'nodeLevel') ||
      'TOPIC',
    nodeType:
      link.nodeType || recordText(link.originalNodeRecord ?? {}, 'nodeType') || 'PAGE',
    nodeTitle: link.label,
    nodeSummary: page.summary,
    nodeContentArea: {
      ...recordObject(link.originalNodeRecord, 'nodeContentArea'),
      route: page.slug,
    },
    targetDocumentationPage:
      recordText(page.originalPageRecord ?? {}, 'code') || page.id,
    targetPage:
      page.targetPageCode || recordText(page.originalPageRecord ?? {}, 'targetPage'),
    targetRoute:
      page.targetRouteCode || recordText(page.originalPageRecord ?? {}, 'targetRoute'),
    nodeOrder: Number(link.order) || 100,
    expandable: false,
    expandedByDefault: false,
    nodeIcon: recordText(link.originalNodeRecord ?? {}, 'nodeIcon') || 'file-text',
    nodeAudience: documentationAudienceValues(page.audience),
    accessMode: visibilityAccessMode(link.visibility),
    allowedRoles: link.originalNodeRecord?.allowedRoles ?? [],
    allowedGroups: link.originalNodeRecord?.allowedGroups ?? [],
    allowedPermissions: link.originalNodeRecord?.allowedPermissions ?? [],
    lifecycleState: 'STAGED',
    maturityState:
      recordText(link.originalNodeRecord ?? {}, 'maturityState') || 'IMPLEMENTED',
    locale: recordText(link.originalNodeRecord ?? {}, 'locale') || 'en',
    channel: recordText(link.originalNodeRecord ?? {}, 'channel') || 'web',
    active: true,
  };
  if (link.originalNodeRecord) {
    await updateWorkbenchRecord(
      connection,
      nodeSchema,
      link.originalNodeRecord,
      model,
      configuration,
      fetch,
    );
  } else {
    await createWorkbenchRecord(connection, nodeSchema, model, configuration, fetch);
  }
}

function emptyDocumentationPage(
  source: AxisCmsDocumentationSource | undefined,
): DocumentationDraftPage {
  const prefix = (source?.id ?? 'framework').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const body =
    'Write the page content here. Add business context, decisions, steps, examples, notes, links, images, or code snippets when needed.';
  return {
    id: `${prefix}-new-page`,
    title: 'New documentation page',
    slug: `/docs/${prefix}/new-page`,
    summary: 'Short reader-facing summary for this page.',
    body,
    contentMode: 'text',
    contentJson: textToCmsRichTextDocument(body),
    audience: 'Business, architect, developer, operator',
    section: source?.label ?? 'Documentation',
    isNew: true,
  };
}

function updatePageDraft(
  page: DocumentationDraftPage,
  changes: Partial<DocumentationDraftPage>,
): DocumentationDraftPage {
  return { ...page, ...changes };
}

function documentationCodeSegment(value: string): string {
  const normalized = value
    .replace(/^\/docs\/?/u, '')
    .replace(/[^A-Za-z0-9]+/gu, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace(/\s+/gu, '');
  return normalized || 'NewPage';
}

function documentationAudienceValues(value: string): readonly string[] {
  return Object.freeze(
    value
      .split(',')
      .map((item) => item.trim().toLowerCase().replace(/\s+/gu, '-'))
      .filter(Boolean),
  );
}

interface PersistDocumentationDraftInput {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly configuration: WorkbenchClientConfiguration;
  readonly page: DocumentationDraftPage;
  readonly selectedSource: AxisCmsDocumentationSource | undefined;
}

async function saveDocumentationDraftPage({
  bootstrap,
  configuration,
  page,
  selectedSource,
}: PersistDocumentationDraftInput): Promise<void> {
  const connection = documentationWorkbenchConnection(bootstrap, selectedSource);
  if (!connection) throw new Error('Documentation staged connection is unavailable');
  const [componentSchema, documentationPageSchema, routeSchema, cmsPageSchema] =
    await Promise.all([
      loadGeneratedSchemaCapabilities(
        connection,
        documentationComponentSchemaRef,
        configuration,
        fetch,
      ),
      loadGeneratedSchemaCapabilities(
        connection,
        documentationPageSchemaRef,
        configuration,
        fetch,
      ),
      loadGeneratedSchemaCapabilities(
        connection,
        documentationRouteSchemaRef,
        configuration,
        fetch,
      ),
      loadGeneratedSchemaCapabilities(
        connection,
        documentationCmsPageSchemaRef,
        configuration,
        fetch,
      ),
    ]);
  const richText = cmsRichTextComponentProperties(pageRichTextDocument(page));
  const audience = documentationAudienceValues(page.audience);
  const codeSegment = documentationCodeSegment(page.id || page.slug || page.title);
  const componentCode = page.articleComponentId || `cmsRichTextComponent${codeSegment}`;
  const routeCode = page.targetRouteCode || `cmsRichTextRoute${codeSegment}`;
  const cmsPageCode = page.targetPageCode || `cmsRichTextPage${codeSegment}`;
  const productCode =
    recordText(page.originalPageRecord ?? {}, 'product') ||
    documentationSourceProductCode(selectedSource) ||
    `${selectedSource?.id ?? 'documentation'}Product`;
  const baseProperties = recordObject(page.originalComponentRecord, 'properties');
  const componentProperties = normalizeCmsRichTextProperties({
    ...baseProperties,
    ...richText,
    title: page.title,
    route: page.slug,
    summary: page.summary,
    audience,
    sectionTitle: page.section,
    groupTitle: page.section,
    lifecycleState: 'STAGED',
  });
  const componentModel = {
    ...(page.originalComponentRecord ?? {}),
    code: componentCode,
    typeCode:
      recordText(page.originalComponentRecord ?? {}, 'typeCode') ||
      'cmsRichTextComponent',
    renderer:
      recordText(page.originalComponentRecord ?? {}, 'renderer') ||
      'cms.component.rich-text',
    accessMode:
      recordText(page.originalComponentRecord ?? {}, 'accessMode') || 'PUBLIC',
    properties: {
      ...baseProperties,
      ...componentProperties,
      title: page.title,
      route: page.slug,
      summary: page.summary,
      audience,
      sectionTitle: page.section,
      groupTitle: page.section,
      lifecycleState: 'STAGED',
    },
    active: true,
  };
  if (page.originalComponentRecord) {
    await updateWorkbenchRecord(
      connection,
      componentSchema,
      page.originalComponentRecord,
      componentModel,
      configuration,
      fetch,
    );
  } else {
    await createWorkbenchRecord(
      connection,
      componentSchema,
      componentModel,
      configuration,
      fetch,
    );
  }
  const pageModel = {
    ...(page.originalPageRecord ?? {}),
    code:
      recordText(page.originalPageRecord ?? {}, 'code') ||
      `cmsRichTextDocumentation${codeSegment}`,
    product: productCode,
    documentId: page.id,
    title: page.title,
    summary: page.summary,
    targetPage: cmsPageCode,
    targetRoute: routeCode,
    articleComponent: componentCode,
    template:
      recordText(page.originalPageRecord ?? {}, 'template') ||
      'nodicsDocumentationArticleTemplate',
    audience,
    lifecycleState: 'STAGED',
    active: true,
  };
  if (page.originalPageRecord) {
    await updateWorkbenchRecord(
      connection,
      documentationPageSchema,
      page.originalPageRecord,
      pageModel,
      configuration,
      fetch,
    );
  } else {
    await createWorkbenchRecord(
      connection,
      documentationPageSchema,
      pageModel,
      configuration,
      fetch,
    );
    await createWorkbenchRecord(
      connection,
      cmsPageSchema,
      {
        code: cmsPageCode,
        name: page.title,
        cmsSite: selectedSource?.site ? [selectedSource.site] : [],
        typeCode: 'nodicsDocumentationArticlePageType',
        template: 'nodicsDocumentationArticleTemplate',
        renderer: 'documentation.page.article',
        cmsComponents: [
          {
            active: true,
            index: 5,
            slot: 'navigation',
            target: 'nodicsDocumentationNavigation',
          },
          { active: true, index: 10, slot: 'article', target: componentCode },
        ],
        active: true,
      },
      configuration,
      fetch,
    );
  }
  const routeModel = {
    ...(page.originalRouteRecord ?? {}),
    code: routeCode,
    site: selectedSource?.site ?? 'nodicsDocumentationSite',
    path: page.slug,
    locale: 'en',
    channel: 'web',
    page: cmsPageCode,
    routeType: 'PAGE',
    deliveryState: 'STAGED',
    accessMode: 'PUBLIC',
    active: true,
  };
  if (page.originalRouteRecord) {
    await updateWorkbenchRecord(
      connection,
      routeSchema,
      page.originalRouteRecord,
      routeModel,
      configuration,
      fetch,
    );
  } else {
    await createWorkbenchRecord(
      connection,
      routeSchema,
      routeModel,
      configuration,
      fetch,
    );
  }
}

function DocumentationContentEditor({
  draft,
  onChange,
}: {
  readonly draft: DocumentationDraftPage;
  readonly onChange: (next: DocumentationDraftPage) => void;
}) {
  return (
    <Stack spacing={2}>
      <Paper
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: `${String(axisTokens.radius.small)}px`,
          p: 1.25,
        }}
      >
        <Stack spacing={1.25}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
          >
            <Typography variant="subtitle2">Page details</Typography>
            <Typography color="text.secondary" variant="caption">
              Reader metadata saved with the staged page
            </Typography>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            }}
          >
            <TextField
              label="Page title"
              size="small"
              value={draft.title}
              onChange={(event) =>
                onChange(updatePageDraft(draft, { title: event.target.value }))
              }
            />
            <TextField
              label="Page URL"
              size="small"
              value={draft.slug}
              onChange={(event) =>
                onChange(updatePageDraft(draft, { slug: event.target.value }))
              }
            />
          </Box>
          <TextField
            label="Reader summary"
            multiline
            minRows={1}
            size="small"
            value={draft.summary}
            onChange={(event) =>
              onChange(updatePageDraft(draft, { summary: event.target.value }))
            }
          />
          <TextField
            label="Audience"
            size="small"
            value={draft.audience}
            onChange={(event) =>
              onChange(updatePageDraft(draft, { audience: event.target.value }))
            }
          />
        </Stack>
      </Paper>
      <CmsRichTextEditor
        label="Page content"
        placeholder="Write the page content. Add links, images, lists, code snippets, tables, and notes."
        value={pageRichTextDocument(draft)}
        onChange={(contentJson, body) =>
          onChange(updatePageDraft(draft, { body, contentJson, contentMode: 'text' }))
        }
      />
    </Stack>
  );
}

function SelectedPageSummary({ page }: { readonly page: DocumentationDraftPage }) {
  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(axisTokens.radius.small)}px`,
        p: 1.25,
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
      >
        <Stack direction="row" spacing={1} sx={{ minWidth: 0 }}>
          <Box
            sx={{
              alignItems: 'center',
              bgcolor: alpha(axisTokens.color.charcoal[900], 0.035),
              border: 1,
              borderColor: 'divider',
              borderRadius: `${String(axisTokens.radius.small)}px`,
              color: 'text.secondary',
              display: 'flex',
              flex: '0 0 auto',
              height: 32,
              justifyContent: 'center',
              width: 32,
            }}
          >
            <ShellIcon fontSize="small" name="content" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography color="text.secondary" variant="overline">
              {page.isNew ? 'New staged page' : 'Editing staged page'}
            </Typography>
            <Typography
              sx={{
                lineHeight: 1.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: { md: 'nowrap' },
              }}
              variant="h6"
            >
              {page.title}
            </Typography>
            <Typography
              color="text.secondary"
              sx={{
                mt: 0.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: { md: 'nowrap' },
              }}
              variant="caption"
            >
              {page.slug}
            </Typography>
          </Box>
        </Stack>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{
            flex: '0 0 auto',
            flexWrap: 'wrap',
            justifyContent: { md: 'flex-end' },
          }}
        >
          <Chip label={page.section} size="small" />
        </Stack>
      </Stack>
    </Paper>
  );
}

function PageAuthoringProgress({ isNew }: { readonly isNew: boolean }) {
  const steps = [
    isNew ? 'Draft page' : 'Select page',
    'Edit content',
    'Preview',
    'Save to Staged',
    'Link in navigation',
  ];

  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      {steps.map((step, index) => (
        <Chip
          key={step}
          label={`${String(index + 1)}. ${step}`}
          size="small"
          sx={{
            bgcolor:
              index < 3
                ? alpha(axisTokens.color.signatureGold, 0.1)
                : alpha(axisTokens.color.charcoal[900], 0.05),
            color: 'text.primary',
            fontWeight: axisTokens.typography.weight.semibold,
          }}
        />
      ))}
    </Stack>
  );
}

function DocumentationDesignerNavigationSlot({
  activePathname,
  component,
  onCreate,
  onManageNavigation,
  onSelectRoute,
  pageCount,
}: {
  readonly activePathname: string;
  readonly component: CmsComponentContract;
  readonly onCreate: () => void;
  readonly onManageNavigation: () => void;
  readonly onSelectRoute: (route: string) => void;
  readonly pageCount: number;
}) {
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Button
          size="small"
          startIcon={<ShellIcon name="add" />}
          variant="contained"
          onClick={onCreate}
        >
          New page
        </Button>
        <Button
          size="small"
          startIcon={<ShellIcon name="list-tree" />}
          variant="outlined"
          onClick={onManageNavigation}
        >
          Navigation
        </Button>
      </Stack>
      <Chip
        label={`${String(pageCount)} staged pages`}
        size="small"
        sx={{
          alignSelf: 'flex-start',
          bgcolor: alpha(axisTokens.color.charcoal[900], 0.05),
          fontWeight: axisTokens.typography.weight.semibold,
        }}
      />
      <DocumentationNavigationRenderer
        activePathname={activePathname}
        component={component}
        onNavigate={onSelectRoute}
      />
    </Stack>
  );
}

function DocumentationDesignerArticleActions({
  isNew,
  mode,
  onEdit,
  onManageNavigation,
  onPreview,
  onSave,
  saving,
}: {
  readonly isNew: boolean;
  readonly mode: DocumentationDesignerMode;
  readonly onEdit: () => void;
  readonly onManageNavigation: () => void;
  readonly onPreview: () => void;
  readonly onSave: () => void;
  readonly saving: boolean;
}) {
  const editing = mode === 'edit';
  const navigation = mode === 'navigation';
  const modeTitle = navigation
    ? 'Editing navigation placement'
    : editing
      ? 'Editing staged documentation'
      : 'Staged documentation preview';
  const modeDescription = navigation
    ? 'Place this page in the reader navigation, then save it to Staged.'
    : editing
      ? 'Update the reader page, then save it to Staged.'
      : 'Preview exactly how this staged page reads before publishing.';
  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: alpha(axisTokens.color.charcoal[900], 0.025),
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(axisTokens.radius.small)}px`,
        mb: 2,
        px: 1.25,
        py: 1,
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        sx={{
          alignItems: { md: 'center' },
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ShellIcon
            color="primary"
            name={navigation ? 'list-tree' : editing ? 'edit' : 'visible'}
          />
          <Box>
            <Typography variant="subtitle2">{modeTitle}</Typography>
            <Typography color="text.secondary" variant="caption">
              {modeDescription}
            </Typography>
          </Box>
        </Stack>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ flexWrap: 'wrap', justifyContent: { md: 'flex-end' } }}
        >
          {navigation ? (
            <>
              <Button size="small" variant="outlined" onClick={onPreview}>
                Preview page
              </Button>
              <Button size="small" variant="contained" onClick={onEdit}>
                Back to page editing
              </Button>
            </>
          ) : null}
          {!navigation && editing ? (
            <Button size="small" variant="outlined" onClick={onPreview}>
              Preview
            </Button>
          ) : null}
          {!navigation && !editing ? (
            <Button size="small" variant="contained" onClick={onEdit}>
              Edit page
            </Button>
          ) : null}
          {!navigation ? (
            <>
              <Button
                size="small"
                startIcon={<ShellIcon name="list-tree" />}
                variant="text"
                onClick={onManageNavigation}
              >
                Link navigation
              </Button>
              <Button
                disabled={saving}
                size="small"
                startIcon={<ShellIcon name="approve" />}
                variant={editing || isNew ? 'contained' : 'outlined'}
                onClick={onSave}
              >
                {saving ? 'Saving' : 'Save staged'}
              </Button>
            </>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}

function DocumentationDesignerNavigationEditor({
  link,
  onChange,
  onPreviewPage,
  onSave,
  page,
  parentOptions,
  saveError,
  saveMessage,
  selectedSource,
  saving,
}: {
  readonly link: DocumentationDraftLink;
  readonly onChange: (changes: Partial<DocumentationDraftLink>) => void;
  readonly onPreviewPage: () => void;
  readonly onSave: () => void;
  readonly page: DocumentationDraftPage;
  readonly parentOptions: readonly DocumentationNavigationParentOption[];
  readonly saveError: Error | null;
  readonly saveMessage: string | undefined;
  readonly selectedSource: AxisCmsDocumentationSource | undefined;
  readonly saving: boolean;
}) {
  const selectedParentValue = selectedNavigationParentValue(link, parentOptions);
  const selectedParentOption =
    parentOptions.find((option) => option.value === selectedParentValue) ??
    parentOptions[0] ??
    null;
  const creatingParent = selectedParentValue === navigationNewParentValue;
  const pathSegments = navigationPathSegments(link, selectedSource);
  const handleParentSelection = (value: string) => {
    const option = parentOptions.find((item) => item.value === value);
    if (!option) return;
    if (option.kind === 'new') {
      const parentLabel =
        link.parentLabel &&
        link.parentLabel !== `${selectedSource?.label ?? 'Documentation'} root`
          ? link.parentLabel
          : 'New topic';
      onChange({
        parentLabel,
        parentNodeCode: `${navigationNewParentPrefix}${documentationCodeSegment(
          parentLabel,
        )}`,
        parentOrder: documentationSectionOrder(parentLabel),
      });
      return;
    }
    onChange({
      parentLabel: option.parentLabel,
      parentNodeCode: option.parentNodeCode,
      parentOrder: option.order,
    });
  };
  const handleNewParentLabel = (parentLabel: string) => {
    onChange({
      parentLabel,
      parentNodeCode: `${navigationNewParentPrefix}${documentationCodeSegment(
        parentLabel,
      )}`,
      parentOrder: documentationSectionOrder(parentLabel),
    });
  };

  return (
    <Stack spacing={1.5}>
      {saveMessage ? <Alert severity="success">{saveMessage}</Alert> : null}
      {saveError ? <Alert severity="error">{saveError.message}</Alert> : null}
      <Paper
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: `${String(axisTokens.radius.small)}px`,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            bgcolor: alpha(axisTokens.color.signatureGold, 0.055),
            borderBottom: 1,
            borderColor: 'divider',
            p: { xs: 1.5, lg: 2 },
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.25}
            sx={{ alignItems: { md: 'flex-start' }, justifyContent: 'space-between' }}
          >
            <Stack direction="row" spacing={1.25} sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  alignItems: 'center',
                  bgcolor: alpha(axisTokens.color.signatureGold, 0.18),
                  borderRadius: `${String(axisTokens.radius.small)}px`,
                  color: 'primary.main',
                  display: 'flex',
                  flex: '0 0 auto',
                  height: 36,
                  justifyContent: 'center',
                  width: 36,
                }}
              >
                <ShellIcon fontSize="small" name="list-tree" />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography color="text.secondary" variant="overline">
                  Navigation placement
                </Typography>
                <Typography sx={{ lineHeight: 1.22 }} variant="h6">
                  Place this page where readers expect it.
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
                  Move this link to the top level, below a section, or under another
                  page without leaving the editor.
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
              <Chip label={page.section} size="small" />
              <Chip label={link.visibility} size="small" variant="outlined" />
            </Stack>
          </Stack>
        </Box>
        <Box sx={{ p: { xs: 1.5, lg: 2 } }}>
          <Stack spacing={1.5}>
            <Paper
              elevation={0}
              sx={{
                bgcolor: alpha(axisTokens.color.charcoal[900], 0.02),
                border: 1,
                borderColor: 'divider',
                borderRadius: `${String(axisTokens.radius.small)}px`,
                p: 1.5,
              }}
            >
              <Typography color="text.secondary" variant="overline">
                Selected page
              </Typography>
              <Typography sx={{ lineHeight: 1.25 }} variant="subtitle1">
                {page.title}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {page.slug}
              </Typography>
            </Paper>
            <Box
              sx={{
                display: 'grid',
                gap: 1.25,
                gridTemplateColumns: { xs: '1fr', md: '1.3fr 1fr' },
              }}
            >
              <TextField
                label="Navigation label"
                size="small"
                value={link.label}
                onChange={(event) => onChange({ label: event.target.value })}
              />
              <Autocomplete
                filterOptions={(options, state) => {
                  const query = state.inputValue.trim().toLocaleLowerCase();
                  if (!query) return options;
                  return options.filter((option) =>
                    [option.label, option.title, option.description, option.searchText]
                      .join(' ')
                      .toLocaleLowerCase()
                      .includes(query),
                  );
                }}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.value === value.value}
                options={parentOptions}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Place under"
                    placeholder="Search hierarchy"
                    size="small"
                  />
                )}
                renderOption={(props, option) => {
                  const { key, ...optionProps } = props;
                  return (
                    <Box
                      component="li"
                      key={key}
                      {...optionProps}
                      sx={{
                        alignItems: 'flex-start !important',
                        borderLeft:
                          option.depth > 0 ? '1px solid' : '1px solid transparent',
                        borderLeftColor:
                          option.depth > 0
                            ? alpha(axisTokens.color.charcoal[900], 0.12)
                            : 'transparent',
                        ml: `${String(option.depth * 1.4)}rem !important`,
                        pl: '0.9rem !important',
                      }}
                    >
                      <Stack spacing={0.25}>
                        <Typography variant="body2">{option.title}</Typography>
                        <Typography color="text.secondary" variant="caption">
                          {option.label === option.title
                            ? option.description
                            : option.label}
                        </Typography>
                      </Stack>
                    </Box>
                  );
                }}
                size="small"
                value={selectedParentOption}
                onChange={(_event, option) => {
                  if (option) handleParentSelection(option.value);
                }}
              />
              {creatingParent ? (
                <TextField
                  label="New parent topic"
                  size="small"
                  value={link.parentLabel}
                  onChange={(event) => handleNewParentLabel(event.target.value)}
                />
              ) : null}
              <TextField
                helperText="Lower numbers appear first under the selected parent."
                label="Sibling order"
                size="small"
                value={link.order}
                onChange={(event) => onChange({ order: event.target.value })}
              />
              <TextField
                label="Visibility"
                select
                size="small"
                value={link.visibility}
                onChange={(event) => onChange({ visibility: event.target.value })}
              >
                {['Public', 'Axis + Nexus', 'Internal Axis', 'Permission limited'].map(
                  (visibility) => (
                    <MenuItem key={visibility} value={visibility}>
                      {visibility}
                    </MenuItem>
                  ),
                )}
              </TextField>
            </Box>
            <Paper
              elevation={0}
              sx={{
                bgcolor: alpha(axisTokens.color.signatureGold, 0.06),
                border: 1,
                borderColor: alpha(axisTokens.color.signatureGold, 0.24),
                borderRadius: `${String(axisTokens.radius.small)}px`,
                p: 1.5,
              }}
            >
              <Typography color="text.secondary" variant="overline">
                Reader path preview
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{
                  alignItems: { sm: 'center' },
                  flexWrap: 'wrap',
                  mt: 0.75,
                }}
              >
                {pathSegments.map((item, index) => (
                  <Stack
                    direction="row"
                    key={`${item}:${String(index)}`}
                    spacing={1}
                    sx={{ alignItems: 'center' }}
                  >
                    {index > 0 ? (
                      <ShellIcon
                        color="disabled"
                        fontSize="small"
                        name="chevron-right"
                      />
                    ) : null}
                    <Chip
                      label={item || 'Untitled'}
                      size="small"
                      sx={{
                        bgcolor:
                          index === 2
                            ? alpha(axisTokens.color.signatureGold, 0.18)
                            : 'background.paper',
                        fontWeight: axisTokens.typography.weight.semibold,
                      }}
                    />
                  </Stack>
                ))}
              </Stack>
            </Paper>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ justifyContent: 'flex-end' }}
            >
              <Button
                size="small"
                startIcon={<ShellIcon name="visible" />}
                variant="outlined"
                onClick={onPreviewPage}
              >
                Back to preview
              </Button>
              <Button
                disabled={saving}
                size="small"
                startIcon={<ShellIcon name="approve" />}
                variant="contained"
                onClick={onSave}
              >
                {saving ? 'Saving navigation' : 'Save navigation'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>
    </Stack>
  );
}

function DocumentationDesignerArticleSlot({
  articleComponent,
  link,
  linkSaveError,
  linkSaveMessage,
  linkSaving,
  mode,
  onChange,
  onEdit,
  onManageNavigation,
  onNavigationChange,
  onNavigationSave,
  onPreview,
  onSave,
  page,
  parentOptions,
  selectedSource,
  saving,
}: {
  readonly articleComponent: CmsComponentContract;
  readonly link: DocumentationDraftLink;
  readonly linkSaveError: Error | null;
  readonly linkSaveMessage: string | undefined;
  readonly linkSaving: boolean;
  readonly mode: DocumentationDesignerMode;
  readonly onChange: (next: DocumentationDraftPage) => void;
  readonly onEdit: () => void;
  readonly onManageNavigation: () => void;
  readonly onNavigationChange: (changes: Partial<DocumentationDraftLink>) => void;
  readonly onNavigationSave: () => void;
  readonly onPreview: () => void;
  readonly onSave: () => void;
  readonly page: DocumentationDraftPage;
  readonly parentOptions: readonly DocumentationNavigationParentOption[];
  readonly selectedSource: AxisCmsDocumentationSource | undefined;
  readonly saving: boolean;
}) {
  const editing = mode === 'edit';
  return (
    <Stack spacing={0}>
      <DocumentationDesignerArticleActions
        isNew={Boolean(page.isNew)}
        mode={mode}
        saving={saving}
        onEdit={onEdit}
        onManageNavigation={onManageNavigation}
        onPreview={onPreview}
        onSave={onSave}
      />
      {mode === 'navigation' ? (
        <DocumentationDesignerNavigationEditor
          link={link}
          page={page}
          parentOptions={parentOptions}
          saveError={linkSaveError}
          saveMessage={linkSaveMessage}
          selectedSource={selectedSource}
          saving={linkSaving}
          onChange={onNavigationChange}
          onPreviewPage={onPreview}
          onSave={onNavigationSave}
        />
      ) : editing ? (
        <Stack spacing={1.5}>
          <SelectedPageSummary page={page} />
          <DocumentationContentEditor draft={page} onChange={onChange} />
        </Stack>
      ) : (
        <DocumentationArticleRenderer component={articleComponent} />
      )}
    </Stack>
  );
}

function DocumentationPageDesignerPanel({
  accessToken,
  bootstrap,
  initialMode = 'preview',
  runtime,
  selectedSource,
}: {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly initialMode?: DocumentationDesignerMode | undefined;
  readonly runtime: AxisRuntimeConfig;
  readonly selectedSource: AxisCmsDocumentationSource | undefined;
}) {
  const pageSource = useDocumentationDraftPageSource({
    accessToken,
    bootstrap,
    runtime,
    selectedSource,
  });
  const [pages, setPages] = useState<readonly DocumentationDraftPage[]>(
    pageSource.pages,
  );
  const [selectedPageId, setSelectedPageId] = useState(pages[0]?.id ?? '');
  const linkSource = useDocumentationDraftLinkSource({
    accessToken,
    bootstrap,
    pages,
    runtime,
    selectedSource,
  });
  const [links, setLinks] = useState<readonly DocumentationDraftLink[]>(
    linkSource.links,
  );
  const [mode, setMode] = useState<DocumentationDesignerMode>(initialMode);
  const [saveMessage, setSaveMessage] = useState<string>();
  const [linkSaveMessage, setLinkSaveMessage] = useState<string>();
  const configuration = useMemo<WorkbenchClientConfiguration>(
    () => ({
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs],
  );
  const savePage = useMutation({
    mutationFn: (page: DocumentationDraftPage) =>
      saveDocumentationDraftPage({
        bootstrap,
        configuration,
        page,
        selectedSource,
      }),
    onSuccess: (_result, page) => {
      setSaveMessage(`${page.title} saved to Staged documentation.`);
      setPages((current) =>
        current.map((item) => (item.id === page.id ? { ...item, isNew: false } : item)),
      );
      setMode('preview');
    },
  });
  const saveLink = useMutation({
    mutationFn: (link: DocumentationDraftLink) =>
      saveDocumentationDraftLink({
        bootstrap,
        configuration,
        link,
        pages,
        selectedSource,
      }),
    onSuccess: (_result, link) => {
      setLinkSaveMessage(`${link.label} saved to Staged navigation.`);
    },
  });

  useEffect(() => {
    queueMicrotask(() => {
      setPages(pageSource.pages);
      setSelectedPageId((current) =>
        pageSource.pages.some((page) => page.id === current)
          ? current
          : (pageSource.pages[0]?.id ?? ''),
      );
      setMode(initialMode);
      setSaveMessage(undefined);
      setLinkSaveMessage(undefined);
    });
  }, [initialMode, pageSource.pages]);

  useEffect(() => {
    queueMicrotask(() => {
      setLinks(linkSource.links);
      setLinkSaveMessage(undefined);
    });
  }, [linkSource.links]);

  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? pages[0];
  const selectedNavigationLink = selectedPage
    ? (links.find((link) => link.pageId === selectedPage.id) ?? {
        id: `${selectedPage.id}-new-link`,
        pageId: selectedPage.id,
        label: selectedPage.title,
        parentLabel: selectedPage.section || 'Wiki home',
        parentOrder: documentationSectionOrder(selectedPage.section || 'Wiki home'),
        order: '100',
        visibility: 'Axis + Nexus',
      })
    : undefined;
  const parentOptions =
    selectedNavigationLink && selectedPage
      ? documentationNavigationParentOptions({
          currentLink: selectedNavigationLink,
          links,
          pages,
          selectedSource,
        })
      : Object.freeze([]);

  const updateSelectedPage = (next: DocumentationDraftPage) => {
    setPages((current) => current.map((page) => (page.id === next.id ? next : page)));
    setSaveMessage(undefined);
    savePage.reset();
  };

  const updateSelectedNavigationLink = (changes: Partial<DocumentationDraftLink>) => {
    if (!selectedNavigationLink) return;
    const next = { ...selectedNavigationLink, ...changes };
    setLinks((current) =>
      current.some((link) => link.id === next.id)
        ? current.map((link) => (link.id === next.id ? next : link))
        : [next, ...current],
    );
    setLinkSaveMessage(undefined);
    saveLink.reset();
  };

  const createNewPage = () => {
    const next = emptyDocumentationPage(selectedSource);
    setPages((current) =>
      current.some((page) => page.id === next.id) ? current : [next, ...current],
    );
    setSelectedPageId(next.id);
    setMode('edit');
    setSaveMessage(undefined);
    setLinkSaveMessage(undefined);
    savePage.reset();
    saveLink.reset();
  };

  const selectPageRoute = (route: string) => {
    const next = pages.find((page) => page.slug === route);
    if (!next) return;
    setSelectedPageId(next.id);
    setMode((current) => (current === 'navigation' ? 'navigation' : 'preview'));
    setSaveMessage(undefined);
    setLinkSaveMessage(undefined);
    savePage.reset();
    saveLink.reset();
  };

  if (!selectedPage || !selectedNavigationLink) {
    return (
      <Alert severity="info">
        Select a documentation area before creating the first page.
      </Alert>
    );
  }

  const designerPage = documentationDesignerPageContract(selectedPage);
  const navigationComponent = documentationDesignerNavigationComponent(
    pages,
    links,
    selectedSource,
  );
  const articleComponent = documentationDesignerArticleComponent(selectedPage);

  return (
    <Stack spacing={1.5}>
      <Paper
        elevation={0}
        sx={{
          bgcolor: alpha(axisTokens.color.charcoal[900], 0.025),
          border: 1,
          borderColor: 'divider',
          borderRadius: `${String(axisTokens.radius.small)}px`,
          px: { xs: 1.5, lg: 2 },
          py: 1.25,
        }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.25}
          sx={{ alignItems: { lg: 'center' }, justifyContent: 'space-between' }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography color="text.secondary" variant="overline">
              Documentation Designer
            </Typography>
            <Typography sx={{ lineHeight: 1.2 }} variant="h6">
              Edit the staged documentation in the same reader layout.
            </Typography>
          </Box>
          <PageAuthoringProgress isNew={Boolean(selectedPage.isNew)} />
        </Stack>
      </Paper>
      {pageSource.isLoading ? (
        <LinearProgress aria-label="Loading documentation pages" />
      ) : null}
      {pageSource.sourceError ? (
        <Alert severity="info">
          Axis could not load the live CMS page catalogue, so it is showing the built-in
          documentation seed list.
        </Alert>
      ) : null}
      {saveMessage ? <Alert severity="success">{saveMessage}</Alert> : null}
      {savePage.error instanceof Error ? (
        <Alert severity="error">{savePage.error.message}</Alert>
      ) : null}
      <DocumentationArticleTemplateRenderer
        embedded
        page={designerPage}
        slots={{
          navigation: (
            <DocumentationDesignerNavigationSlot
              activePathname={selectedPage.slug}
              component={navigationComponent}
              pageCount={pages.length}
              onCreate={createNewPage}
              onManageNavigation={() => setMode('navigation')}
              onSelectRoute={selectPageRoute}
            />
          ),
          article: (
            <DocumentationDesignerArticleSlot
              articleComponent={articleComponent}
              link={selectedNavigationLink}
              linkSaveError={saveLink.error instanceof Error ? saveLink.error : null}
              linkSaveMessage={linkSaveMessage}
              linkSaving={saveLink.isPending}
              mode={mode}
              page={selectedPage}
              parentOptions={parentOptions}
              selectedSource={selectedSource}
              saving={savePage.isPending}
              onChange={updateSelectedPage}
              onEdit={() => setMode('edit')}
              onManageNavigation={() => setMode('navigation')}
              onNavigationChange={updateSelectedNavigationLink}
              onNavigationSave={() =>
                selectedNavigationLink ? saveLink.mutate(selectedNavigationLink) : null
              }
              onPreview={() => setMode('preview')}
              onSave={() => savePage.mutate(selectedPage)}
            />
          ),
        }}
      />
    </Stack>
  );
}

function PreviewDestinationCard({
  buttonLabel,
  description,
  disabled,
  icon,
  projection,
  title,
  tone,
  onPreview,
}: {
  readonly buttonLabel: string;
  readonly description: string;
  readonly disabled: boolean;
  readonly icon: string;
  readonly projection: DocumentationRenderProjection | undefined;
  readonly title: string;
  readonly tone: 'contained' | 'outlined';
  readonly onPreview: () => void;
}) {
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{
        border: 1,
        borderColor: projection
          ? alpha(axisTokens.color.signatureGold, 0.55)
          : 'divider',
        borderRadius: `${String(axisTokens.radius.medium)}px`,
        minHeight: 320,
        overflow: 'hidden',
      }}
    >
      <Stack spacing={0}>
        <Box
          sx={{
            bgcolor: projection
              ? alpha(axisTokens.color.signatureGold, 0.08)
              : 'background.default',
            borderBottom: 1,
            borderColor: 'divider',
            p: 2,
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
            <Box
              sx={{
                bgcolor: alpha(axisTokens.color.signatureGold, 0.18),
                borderRadius: `${String(axisTokens.radius.small)}px`,
                color: 'primary.main',
                display: 'grid',
                flex: '0 0 auto',
                height: 40,
                placeItems: 'center',
                width: 40,
              }}
            >
              <ShellIcon name={icon} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6">{title}</Typography>
              <Typography color="text.secondary" variant="body2">
                {description}
              </Typography>
            </Box>
            <Chip
              label={projection ? 'Preview ready' : 'Staged'}
              size="small"
              variant={projection ? 'filled' : 'outlined'}
            />
          </Stack>
        </Box>
        <Box sx={{ p: 2 }}>
          {projection ? (
            <ProjectionSummary projection={projection} />
          ) : (
            <Box
              sx={{
                bgcolor: alpha(axisTokens.color.charcoal[900], 0.025),
                border: 1,
                borderColor: 'divider',
                borderRadius: `${String(axisTokens.radius.small)}px`,
                minHeight: 136,
                p: 2,
              }}
            >
              <Typography variant="subtitle2">No preview loaded yet</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
                Run staged preview to see the navigation links, pages, and content areas
                that would be visible after approval.
              </Typography>
            </Box>
          )}
          <Button
            disabled={disabled}
            fullWidth
            startIcon={<ShellIcon name={icon} />}
            sx={{ mt: 2, minHeight: 44 }}
            variant={tone}
            onClick={onPreview}
          >
            {buttonLabel}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

function PreviewPanel({
  client,
  connectionAvailable,
  recordPack,
  selectedSource,
}: {
  readonly client: ReturnType<typeof createDocumentationGovernanceClient> | undefined;
  readonly connectionAvailable: boolean;
  readonly recordPack: Readonly<Record<string, unknown>>;
  readonly selectedSource: AxisDocumentationSource | undefined;
}) {
  const axisPreview = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('Staged preview is unavailable');
      return client.renderProjection(recordPack, 'AXIS');
    },
  });
  const nexusPreview = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('Staged preview is unavailable');
      return client.renderProjection(recordPack, 'NEXUS');
    },
  });
  const busy = axisPreview.isPending || nexusPreview.isPending;
  const latestError =
    axisPreview.error instanceof Error
      ? axisPreview.error
      : nexusPreview.error instanceof Error
        ? nexusPreview.error
        : undefined;

  return (
    <Stack spacing={2}>
      <Paper
        component="section"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          border: 1,
          borderColor: alpha(axisTokens.color.signatureGold, 0.35),
          borderRadius: `${String(axisTokens.radius.medium)}px`,
          overflow: 'hidden',
          p: { xs: 2, md: 3 },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 2, lg: 3 },
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.4fr) 360px' },
          }}
        >
          <Stack spacing={2}>
            <Box>
              <Typography color="text.secondary" variant="overline">
                Staged preview
              </Typography>
              <Typography sx={{ maxWidth: 760 }} variant="h4">
                Review staged documentation before it goes Online
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 820 }}>
                This preview reads staged documentation through the designer projection.
                It does not use the public Online documentation route, so authors can
                verify page and navigation changes before approval.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip
                icon={<ShellIcon name="content" />}
                label={selectedSource?.label ?? 'Documentation area'}
              />
              <Chip icon={<ShellIcon name="visible" />} label="Staged content" />
              <Chip icon={<ShellIcon name="approve" />} label="Not published yet" />
            </Stack>
            {!connectionAvailable ? (
              <Alert severity="info">
                Staged preview will be available when the CMS designer connection is
                reachable.
              </Alert>
            ) : null}
            {latestError ? <Alert severity="error">{latestError.message}</Alert> : null}
          </Stack>
          <Box
            sx={{
              bgcolor: alpha(axisTokens.color.signatureGold, 0.08),
              border: 1,
              borderColor: alpha(axisTokens.color.signatureGold, 0.35),
              borderRadius: `${String(axisTokens.radius.small)}px`,
              p: 2,
            }}
          >
            <Typography variant="subtitle2">Preview path</Typography>
            <Stack spacing={1.25} sx={{ mt: 1.5 }}>
              {[
                ['Staged', 'Draft page and link changes'],
                ['Preview', 'Axis and Nexus reader projection'],
                ['Approve', 'Business review before publish'],
                ['Online', 'Visible in public documentation'],
              ].map(([title, body], index) => (
                <Stack
                  direction="row"
                  key={title}
                  spacing={1.25}
                  sx={{ alignItems: 'flex-start' }}
                >
                  <Box
                    sx={{
                      bgcolor:
                        index === 1
                          ? axisTokens.color.signatureGold
                          : 'background.paper',
                      border: 1,
                      borderColor: alpha(axisTokens.color.signatureGold, 0.45),
                      borderRadius: '999px',
                      flex: '0 0 auto',
                      height: 28,
                      mt: 0.25,
                      width: 28,
                    }}
                  />
                  <Box>
                    <Typography variant="subtitle2">{title}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {body}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Box>
        {busy ? <LinearProgress sx={{ mt: 2 }} /> : null}
      </Paper>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
        }}
      >
        <PreviewDestinationCard
          buttonLabel="Preview Axis staged view"
          description="Check how editors and operators will read the staged documentation inside Axis."
          disabled={!connectionAvailable || busy}
          icon="visible"
          projection={axisPreview.data}
          title="Axis staged result"
          tone="contained"
          onPreview={() => axisPreview.mutate()}
        />
        <PreviewDestinationCard
          buttonLabel="Preview Nexus staged view"
          description="Check the Nexus reader projection before the same content is published Online."
          disabled={!connectionAvailable || busy}
          icon="storefront"
          projection={nexusPreview.data}
          title="Nexus staged result"
          tone="outlined"
          onPreview={() => nexusPreview.mutate()}
        />
      </Box>
    </Stack>
  );
}

/**
 * Renders the Axis documentation management workspace. Axis owns the browser
 * composition and state; CMS owns documentation records and governance APIs.
 */
export function DocumentationManagementRoutePage(
  props: DocumentationManagementRoutePageProps,
) {
  const activeTab = pathTab(props.path);
  const designerSources = useMemo(
    () => editableDocumentationSources(props.bootstrap.documentationSources),
    [props.bootstrap.documentationSources],
  );
  const [selectedSourceId, setSelectedSourceId] = useState(
    designerSources[0]?.id ?? 'framework',
  );
  const connection =
    selectModuleConnection(props.bootstrap, 'cms', {
      publicationRole: 'STAGED',
    }) ?? selectModuleConnection(props.bootstrap, 'cms');
  const routes = useMemo(
    () => routesFromNavigation(props.navigation),
    [props.navigation],
  );
  const client = useMemo(
    () =>
      connection
        ? createDocumentationGovernanceClient(
            connection,
            {
              accessToken: props.accessToken,
              enterpriseCode: props.runtime.enterpriseCode,
              timeoutMs: props.runtime.requestTimeoutMs,
            },
            routes,
          )
        : undefined,
    [
      connection,
      props.accessToken,
      props.runtime.enterpriseCode,
      props.runtime.requestTimeoutMs,
      routes,
    ],
  );
  const modelQuery = useQuery({
    enabled: Boolean(client),
    queryKey: [
      'documentation-governance-model',
      props.runtime.enterpriseCode,
      connectionKey(connection),
      routes.authoringModelRoute,
    ],
    queryFn: async () => {
      if (!client) throw new Error('CMS documentation governance is unavailable');
      return client.loadAuthoringModel();
    },
  });
  const model = modelQuery.data ?? fallbackModel;
  const selectedSource = selectedDocumentationSource(designerSources, selectedSourceId);
  const recordPack = useMemo(
    () =>
      Object.freeze({
        ...(documentationSourceContext(selectedSource)
          ? {
              sourceContext: documentationSourceContext(selectedSource),
              packCode: documentationSourceContext(selectedSource)?.packCode,
            }
          : {}),
      }),
    [selectedSource],
  );
  const tabs = availableTabs(props.bootstrap.navigation);
  const selectedTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]!;
  const showWorkbench =
    selectedTab.schemaName &&
    !['governance', 'pages', 'navigation'].includes(selectedTab.id);
  const routeNavigation = routeNavigationForTab(props.navigation, selectedTab);

  return (
    <WorkspaceContainer>
      <WorkspaceHeading
        eyebrow="Documentation Designer"
        title="Create and publish documentation"
        description="Create pages, organize links, preview the reader experience, and publish approved documentation to Axis and Nexus."
      />
      {modelQuery.isLoading ? (
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <CircularProgress size={20} />
            <Typography variant="body2">Loading documentation designer</Typography>
          </Stack>
        </Paper>
      ) : null}
      {modelQuery.error instanceof Error && activeTab === 'governance' ? (
        <Alert severity="info">
          Axis is showing the built-in designer journey while live CMS guidance is
          unavailable.
        </Alert>
      ) : null}
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            sx={{ alignItems: { md: 'center' } }}
          >
            <TextField
              label="Documentation area"
              select
              size="small"
              sx={{ minWidth: { xs: '100%', md: 280 } }}
              value={selectedSource?.id ?? selectedSourceId}
              onChange={(event) => setSelectedSourceId(event.target.value)}
            >
              {(designerSources.length > 0
                ? designerSources
                : [{ id: 'framework', label: 'Framework' }]
              ).map((source) => (
                <MenuItem key={source.id} value={source.id}>
                  {source.label}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip
                icon={<ShellIcon name="visible" />}
                label="Visible in Axis"
                size="small"
              />
              <Chip
                icon={<ShellIcon name="storefront" />}
                label="Publishes to Nexus"
                size="small"
              />
              <Chip
                icon={<ShellIcon name="approve" />}
                label="Governed approval"
                size="small"
              />
            </Stack>
          </Stack>
        </Stack>
      </Paper>
      {activeTab === 'pages' ? (
        <DocumentationPageDesignerPanel
          accessToken={props.accessToken}
          bootstrap={props.bootstrap}
          runtime={props.runtime}
          selectedSource={selectedSource}
        />
      ) : activeTab === 'navigation' ? (
        <DocumentationPageDesignerPanel
          accessToken={props.accessToken}
          bootstrap={props.bootstrap}
          initialMode="navigation"
          runtime={props.runtime}
          selectedSource={selectedSource}
        />
      ) : activeTab === 'preview' ? (
        <PreviewPanel
          client={client}
          connectionAvailable={Boolean(connection)}
          recordPack={recordPack}
          selectedSource={selectedSource}
        />
      ) : activeTab === 'governance' ? (
        <GovernancePanel
          client={client}
          connectionAvailable={Boolean(connection)}
          model={model}
          recordPack={recordPack}
        />
      ) : showWorkbench && routeNavigation.workbenchTarget ? (
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
      ) : (
        <Alert severity="info">
          This documentation designer destination is waiting for a backend schema target
          in the authorized navigation contract.
        </Alert>
      )}
    </WorkspaceContainer>
  );
}
