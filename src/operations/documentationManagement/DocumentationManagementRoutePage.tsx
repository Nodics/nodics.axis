import {
  Alert,
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
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';

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
  loadGeneratedSchemaCapabilities,
  loadWorkbenchRecords,
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
import {
  createDocumentationGovernanceClient,
  defaultDocumentationGovernanceRoutes,
  type DocumentationAuthoringModel,
  type DocumentationAuthoringPanel,
  type DocumentationGovernanceRoutes,
  type DocumentationRenderProjection,
} from './api/documentationGovernanceClient';

type DocumentationManagementTab =
  | 'dashboard'
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

interface DocumentationDraftPage {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly summary: string;
  readonly body: string;
  readonly contentMode: DocumentationContentMode;
  readonly audience: string;
  readonly section: string;
}

interface DocumentationDraftLink {
  readonly id: string;
  readonly pageId: string;
  readonly label: string;
  readonly parentLabel: string;
  readonly order: string;
  readonly visibility: string;
}

const fallbackTabs: readonly DocumentationWorkspaceTab[] = Object.freeze([
  Object.freeze({
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    route: '/docs/designer',
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
    id: 'pages',
    label: 'Pages and Topic Content',
    icon: 'content',
    route: '/docs/designer/pages',
    schemaName: 'cmsDocumentationPage',
    order: 20,
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
    landing: '/docs/designer/dashboard',
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
  return 'dashboard';
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

function WorkspaceTabs({
  active,
  tabs,
}: {
  readonly active: DocumentationManagementTab;
  readonly tabs: readonly DocumentationWorkspaceTab[];
}) {
  return (
    <Paper
      component="nav"
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(axisTokens.radius.small)}px`,
        display: 'flex',
        gap: 1,
        minWidth: 0,
        overflowX: 'auto',
        p: 1,
      }}
      aria-label="Documentation designer views"
    >
      {tabs.map((tab) => (
        <Button
          aria-current={active === tab.id ? 'page' : undefined}
          component={RouterLink}
          key={tab.id}
          size="small"
          startIcon={<ShellIcon fontSize="small" name={tab.icon} />}
          sx={{ flex: '0 0 auto', minHeight: 36, whiteSpace: 'nowrap' }}
          to={tab.route}
          variant={active === tab.id ? 'contained' : 'text'}
        >
          {tab.label}
        </Button>
      ))}
    </Paper>
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
  return String(
    record.title ??
      record.nodeTitle ??
      record.label ??
      record.name ??
      record.code ??
      record.targetCode ??
      'Untitled item',
  );
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

const documentationPageSchemaRef = Object.freeze({ schemaName: 'cmsDocumentationPage' });
const documentationRouteSchemaRef = Object.freeze({ schemaName: 'cmsPageRoute' });
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

function recordTextList(record: WorkbenchRecord, field: string): readonly string[] {
  const value = record[field];
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.filter((item): item is string => typeof item === 'string' && item.trim() !== ''),
  );
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
  const [pageSchema, routeSchema] = await Promise.all([
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
  ]);
  const [pageRecords, routeRecords] = await Promise.all([
    loadAllDocumentationRecords(connection, pageSchema, configuration, signal),
    loadAllDocumentationRecords(connection, routeSchema, configuration, signal),
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
  const pages = records
    .map((record): DocumentationDraftPage | undefined => {
      const id = recordText(record, 'code') || recordText(record, 'documentId');
      const title = recordText(record, 'title');
      if (!id || !title) return undefined;
      const targetRoute = recordText(record, 'targetRoute');
      const targetPage = recordText(record, 'targetPage');
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
        summary: recordText(record, 'summary') || 'Documentation page ready for editing.',
        body: documentationRecordBody(record, title),
        contentMode: 'text',
        audience: audience || 'Business, architect, developer, operator',
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
      order: String((index + 1) * 10),
      visibility: index === 0 ? 'Public' : 'Axis + Nexus',
    })),
  );
}

function emptyDocumentationPage(
  source: AxisCmsDocumentationSource | undefined,
): DocumentationDraftPage {
  const prefix = (source?.id ?? 'framework').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return {
    id: `${prefix}-new-page`,
    title: 'New documentation page',
    slug: `/docs/${prefix}/new-page`,
    summary: 'Short reader-facing summary for this page.',
    body: 'Write the page content here. Add business context, decisions, steps, examples, notes, or HTML when needed.',
    contentMode: 'text',
    audience: 'Business, architect, developer, operator',
    section: source?.label ?? 'Documentation',
  };
}

function updatePageDraft(
  page: DocumentationDraftPage,
  changes: Partial<DocumentationDraftPage>,
): DocumentationDraftPage {
  return { ...page, ...changes };
}

function htmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function inlinePreviewParts(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined && match[2] !== undefined) {
      parts.push(
        <Box
          alt={match[1] || 'Documentation image'}
          component="img"
          key={`${keyPrefix}:image:${String(match.index)}`}
          src={match[2]}
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: `${String(axisTokens.radius.small)}px`,
            display: 'block',
            maxHeight: 280,
            maxWidth: '100%',
            objectFit: 'cover',
            my: 1.5,
          }}
        />,
      );
    } else if (match[3] !== undefined && match[4] !== undefined) {
      parts.push(
        <Box
          component="a"
          href={match[4]}
          key={`${keyPrefix}:link:${String(match.index)}`}
          rel="noreferrer"
          sx={{ color: 'primary.main', fontWeight: 700 }}
          target="_blank"
        >
          {match[3]}
        </Box>,
      );
    } else if (match[5] !== undefined) {
      parts.push(
        <Box
          component="strong"
          key={`${keyPrefix}:bold:${String(match.index)}`}
          sx={{ color: 'text.primary' }}
        >
          {match[5]}
        </Box>,
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function TextPreviewBlock({
  index,
  section,
}: {
  readonly index: number;
  readonly section: string;
}) {
  const lines = section.split('\n').map((line) => line.trim());
  if (section.startsWith('## ')) {
    return (
      <Typography component="h3" sx={{ lineHeight: 1.25 }} variant="h6">
        {inlinePreviewParts(section.replace(/^##\s+/, ''), `heading:${String(index)}`)}
      </Typography>
    );
  }
  if (lines.every((line) => line.startsWith('- '))) {
    return (
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {lines.map((line, lineIndex) => (
          <Typography
            color="text.secondary"
            component="li"
            key={`${line}:${String(lineIndex)}`}
            sx={{ lineHeight: 1.65 }}
          >
            {inlinePreviewParts(
              line.replace(/^-\s+/, ''),
              `list:${String(index)}:${String(lineIndex)}`,
            )}
          </Typography>
        ))}
      </Box>
    );
  }
  if (section.startsWith('> ')) {
    return (
      <Box
        component="blockquote"
        sx={{
          borderLeft: 3,
          borderColor: 'primary.main',
          color: 'text.secondary',
          m: 0,
          pl: 2,
        }}
      >
        <Typography sx={{ lineHeight: 1.65 }}>
          {inlinePreviewParts(section.replace(/^>\s+/, ''), `quote:${String(index)}`)}
        </Typography>
      </Box>
    );
  }
  return (
    <Typography
      color={index === 0 ? 'text.primary' : 'text.secondary'}
      sx={{ lineHeight: 1.65 }}
    >
      {inlinePreviewParts(section, `paragraph:${String(index)}`)}
    </Typography>
  );
}

function RichContentPreview({
  mode,
  value,
}: {
  readonly mode: DocumentationContentMode;
  readonly value: string;
}) {
  if (mode === 'html') {
    return (
      <Box
        component="iframe"
        sandbox=""
        srcDoc={`<!doctype html><html><head><style>body{font:16px/1.65 system-ui,-apple-system,Segoe UI,sans-serif;color:#25282d;margin:0;padding:20px}h1,h2,h3{line-height:1.2}a{color:#b99000}</style></head><body>${value}</body></html>`}
        sx={{
          bgcolor: 'background.paper',
          border: 0,
          borderRadius: `${String(axisTokens.radius.small)}px`,
          minHeight: 300,
          width: '100%',
        }}
        title="Documentation HTML preview"
      />
    );
  }

  return (
    <Stack
      spacing={1.5}
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(axisTokens.radius.small)}px`,
        minHeight: 300,
        p: 2.5,
      }}
    >
      {value
        .split(/\n{2,}/)
        .map((section) => section.trim())
        .filter(Boolean)
        .map((section, index) => (
          <TextPreviewBlock
            index={index}
            key={`${section.slice(0, 24)}:${String(index)}`}
            section={section}
          />
        ))}
    </Stack>
  );
}

function DocumentationContentEditor({
  draft,
  onChange,
}: {
  readonly draft: DocumentationDraftPage;
  readonly onChange: (next: DocumentationDraftPage) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [linkText, setLinkText] = useState('Read more');
  const [linkUrl, setLinkUrl] = useState('https://nodics.ai');
  const [imageAlt, setImageAlt] = useState('Documentation image');
  const [imageUrl, setImageUrl] = useState('');

  const selectedText = () => {
    const input = textareaRef.current;
    if (!input) return '';
    return draft.body.slice(input.selectionStart, input.selectionEnd);
  };

  const insertAtCursor = (value: string) => {
    const input = textareaRef.current;
    const start = input?.selectionStart ?? draft.body.length;
    const end = input?.selectionEnd ?? draft.body.length;
    const nextBody = `${draft.body.slice(0, start)}${value}${draft.body.slice(end)}`;
    onChange(updatePageDraft(draft, { body: nextBody }));
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        start + value.length,
        start + value.length,
      );
    });
  };

  const wrapSelection = (before: string, after = '', placeholder = 'Text') => {
    const input = textareaRef.current;
    const start = input?.selectionStart ?? draft.body.length;
    const end = input?.selectionEnd ?? draft.body.length;
    const current = draft.body.slice(start, end) || placeholder;
    const value = `${before}${current}${after}`;
    const nextBody = `${draft.body.slice(0, start)}${value}${draft.body.slice(end)}`;
    onChange(updatePageDraft(draft, { body: nextBody }));
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        start + before.length,
        start + before.length + current.length,
      );
    });
  };

  const insertLink = () => {
    const text = selectedText() || linkText || 'Link';
    const url = linkUrl || 'https://';
    insertAtCursor(
      draft.contentMode === 'html'
        ? `<a href="${htmlAttribute(url)}">${htmlAttribute(text)}</a>`
        : `[${text}](${url})`,
    );
  };

  const insertImage = () => {
    const alt = imageAlt || 'Documentation image';
    const url = imageUrl || 'https://';
    insertAtCursor(
      draft.contentMode === 'html'
        ? `<img src="${htmlAttribute(url)}" alt="${htmlAttribute(alt)}" />`
        : `![${alt}](${url})`,
    );
  };

  const modeButton = (mode: DocumentationContentMode, label: string) => (
    <Button
      size="small"
      variant={draft.contentMode === mode ? 'contained' : 'outlined'}
      onClick={() => onChange(updatePageDraft(draft, { contentMode: mode }))}
    >
      {label}
    </Button>
  );

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
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
        minRows={2}
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
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {modeButton('text', 'Text')}
        {modeButton('html', 'HTML')}
      </Stack>
      <Paper
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: `${String(axisTokens.radius.small)}px`,
          p: 1.5,
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button
              size="small"
              startIcon={<ShellIcon name="format" />}
              variant="outlined"
              onClick={() =>
                draft.contentMode === 'html'
                  ? wrapSelection('<h2>', '</h2>', 'Section heading')
                  : wrapSelection('## ', '', 'Section heading')
              }
            >
              Heading
            </Button>
            <Button
              size="small"
              sx={{ fontWeight: 800 }}
              variant="outlined"
              onClick={() =>
                draft.contentMode === 'html'
                  ? wrapSelection('<strong>', '</strong>', 'Important text')
                  : wrapSelection('**', '**', 'Important text')
              }
            >
              Bold
            </Button>
            <Button
              size="small"
              startIcon={<ShellIcon name="list-tree" />}
              variant="outlined"
              onClick={() =>
                insertAtCursor(
                  draft.contentMode === 'html'
                    ? '<ul><li>First point</li><li>Second point</li></ul>'
                    : '- First point\n- Second point',
                )
              }
            >
              List
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() =>
                draft.contentMode === 'html'
                  ? wrapSelection('<blockquote>', '</blockquote>', 'Important note')
                  : wrapSelection('> ', '', 'Important note')
              }
            >
              Quote
            </Button>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr auto' },
            }}
          >
            <TextField
              label="Link text"
              size="small"
              value={linkText}
              onChange={(event) => setLinkText(event.target.value)}
            />
            <TextField
              label="Link URL"
              size="small"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
            />
            <Button
              startIcon={<ShellIcon name="reference" />}
              variant="outlined"
              onClick={insertLink}
            >
              Insert link
            </Button>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr auto' },
            }}
          >
            <TextField
              label="Image alt text"
              size="small"
              value={imageAlt}
              onChange={(event) => setImageAlt(event.target.value)}
            />
            <TextField
              label="Image URL"
              size="small"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
            />
            <Button
              disabled={!imageUrl.trim()}
              startIcon={<ShellIcon name="media" />}
              variant="outlined"
              onClick={insertImage}
            >
              Insert image
            </Button>
          </Box>
          <Paper
            elevation={0}
            sx={{
              bgcolor: alpha(axisTokens.color.charcoal[900], 0.025),
              border: 1,
              borderColor: 'divider',
              borderRadius: `${String(axisTokens.radius.small)}px`,
              minHeight: 96,
              overflow: 'hidden',
              p: 1.25,
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{ alignItems: { sm: 'center' } }}
            >
              {imageUrl.trim() ? (
                <Box
                  alt={imageAlt || 'Selected documentation image'}
                  component="img"
                  src={imageUrl}
                  sx={{
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: `${String(axisTokens.radius.small)}px`,
                    height: 74,
                    objectFit: 'cover',
                    width: 112,
                  }}
                />
              ) : (
                <Box
                  sx={{
                    alignItems: 'center',
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: `${String(axisTokens.radius.small)}px`,
                    color: 'text.secondary',
                    display: 'flex',
                    height: 74,
                    justifyContent: 'center',
                    width: 112,
                  }}
                >
                  <ShellIcon name="media" />
                </Box>
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2">Image preview</Typography>
                <Typography color="text.secondary" variant="body2">
                  {imageUrl.trim()
                    ? 'This image will be inserted at the cursor and rendered in the page preview.'
                    : 'Paste an image URL to view it before inserting it into the page.'}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Stack>
      </Paper>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
        }}
      >
        <TextField
          label={draft.contentMode === 'html' ? 'HTML content' : 'Page content'}
          inputRef={textareaRef}
          multiline
          minRows={11}
          size="small"
          value={draft.body}
          onChange={(event) =>
            onChange(updatePageDraft(draft, { body: event.target.value }))
          }
          sx={{
            '& textarea': {
              fontFamily:
                draft.contentMode === 'html'
                  ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                  : undefined,
              lineHeight: 1.65,
            },
          }}
        />
        <Box>
          <Typography color="text.secondary" sx={{ mb: 1 }} variant="overline">
            Live preview
          </Typography>
          <RichContentPreview mode={draft.contentMode} value={draft.body} />
        </Box>
      </Box>
    </Stack>
  );
}

function PageSelectionRail({
  pages,
  selectedPageId,
  onCreate,
  onSelect,
}: {
  readonly pages: readonly DocumentationDraftPage[];
  readonly selectedPageId: string;
  readonly onCreate: () => void;
  readonly onSelect: (pageId: string) => void;
}) {
  const [pageSearch, setPageSearch] = useState('');
  const normalizedSearch = pageSearch.trim().toLowerCase();
  const filteredPages = useMemo(
    () =>
      normalizedSearch
        ? pages.filter((page) =>
            [
              page.title,
              page.slug,
              page.section,
              page.summary,
              page.audience,
            ]
              .join(' ')
              .toLowerCase()
              .includes(normalizedSearch),
          )
        : pages,
    [normalizedSearch, pages],
  );
  const countLabel =
    filteredPages.length === pages.length
      ? `${String(pages.length)} pages`
      : `${String(filteredPages.length)} of ${String(pages.length)}`;

  useEffect(() => {
    if (!normalizedSearch || filteredPages.length === 0) return;
    if (filteredPages.some((page) => page.id === selectedPageId)) return;
    const firstMatch = filteredPages[0];
    if (firstMatch) onSelect(firstMatch.id);
  }, [filteredPages, normalizedSearch, onSelect, selectedPageId]);

  return (
    <Paper
      component="aside"
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(axisTokens.radius.small)}px`,
        p: 1.5,
      }}
    >
      <Stack spacing={1.25}>
        <Button
          startIcon={<ShellIcon name="add" />}
          sx={{ justifyContent: 'flex-start' }}
          variant="contained"
          onClick={() => {
            setPageSearch('');
            onCreate();
          }}
        >
          Create new page
        </Button>
        <TextField
          fullWidth
          label="Search pages"
          placeholder="Find by title, route, topic, or audience"
          size="small"
          value={pageSearch}
          onChange={(event) => setPageSearch(event.target.value)}
        />
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography color="text.secondary" variant="overline">
            Existing pages
          </Typography>
          <Chip label={countLabel} size="small" />
        </Stack>
        <Stack
          spacing={1}
          sx={{
            maxHeight: { xs: 360, lg: 640 },
            overflowY: 'auto',
            pr: 0.5,
          }}
        >
          {filteredPages.map((page) => (
            <Button
              key={page.id}
              sx={{
                alignItems: 'flex-start',
                borderColor:
                  page.id === selectedPageId
                    ? undefined
                    : alpha(axisTokens.color.charcoal[900], 0.16),
                color: page.id === selectedPageId ? undefined : 'text.primary',
                justifyContent: 'flex-start',
                minHeight: 76,
                p: 1.25,
                textAlign: 'left',
                width: '100%',
                '&:hover': {
                  borderColor: alpha(axisTokens.color.signatureGold, 0.55),
                  bgcolor: alpha(axisTokens.color.signatureGold, 0.08),
                },
              }}
              variant={page.id === selectedPageId ? 'contained' : 'outlined'}
              onClick={() => onSelect(page.id)}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography component="span" sx={{ display: 'block' }} variant="body2">
                  {page.title}
                </Typography>
                <Typography
                  color={page.id === selectedPageId ? 'inherit' : 'text.secondary'}
                  component="span"
                  sx={{
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  variant="caption"
                >
                  {page.section}
                </Typography>
                <Typography
                  color={page.id === selectedPageId ? 'inherit' : 'text.secondary'}
                  component="span"
                  sx={{
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  variant="caption"
                >
                  {page.slug}
                </Typography>
              </Box>
            </Button>
          ))}
          {filteredPages.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                bgcolor: alpha(axisTokens.color.signatureGold, 0.06),
                border: 1,
                borderColor: alpha(axisTokens.color.signatureGold, 0.22),
                p: 1.5,
              }}
            >
              <Typography variant="body2">No documentation pages match this search.</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="caption">
                Try a page title, route, module name, or audience.
              </Typography>
            </Paper>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}

function SelectedPageSummary({ page }: { readonly page: DocumentationDraftPage }) {
  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: alpha(axisTokens.color.signatureGold, 0.35),
        borderRadius: `${String(axisTokens.radius.small)}px`,
        p: 1.5,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <Box
          sx={{
            alignItems: 'center',
            bgcolor: alpha(axisTokens.color.signatureGold, 0.18),
            borderRadius: `${String(axisTokens.radius.small)}px`,
            color: 'primary.main',
            display: 'flex',
            height: 42,
            justifyContent: 'center',
            width: 42,
          }}
        >
          <ShellIcon name="content" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography color="text.secondary" variant="overline">
            Editing existing page
          </Typography>
          <Typography sx={{ lineHeight: 1.2 }} variant="h6">
            {page.title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
            {page.summary}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
            <Chip label={page.slug} size="small" />
            <Chip label={page.section} size="small" />
            <Chip label={page.audience} size="small" />
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

function DocumentationPageDesignerPanel({
  accessToken,
  bootstrap,
  runtime,
  selectedSource,
}: {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
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
  const [saveMessage, setSaveMessage] = useState<string>();

  useEffect(() => {
    setPages(pageSource.pages);
    setSelectedPageId((current) =>
      pageSource.pages.some((page) => page.id === current)
        ? current
        : (pageSource.pages[0]?.id ?? ''),
    );
    setSaveMessage(undefined);
  }, [pageSource.pages]);

  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? pages[0];

  const updateSelectedPage = (next: DocumentationDraftPage) => {
    setPages((current) => current.map((page) => (page.id === next.id ? next : page)));
    setSaveMessage(undefined);
  };

  const createNewPage = () => {
    const next = emptyDocumentationPage(selectedSource);
    setPages((current) =>
      current.some((page) => page.id === next.id) ? current : [next, ...current],
    );
    setSelectedPageId(next.id);
    setSaveMessage(undefined);
  };

  if (!selectedPage) {
    return (
      <Alert severity="info">
        Select a documentation area before creating the first page.
      </Alert>
    );
  }

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={2}
          sx={{ alignItems: { lg: 'center' } }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography color="text.secondary" variant="overline">
              Page authoring
            </Typography>
            <Typography variant="h5">
              Select a page, edit content, preview it.
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              This is the business-facing editor. Authors should not need to know the
              underlying CMS schema before writing or updating documentation.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Chip icon={<ShellIcon name="content" />} label="Staged draft" />
            <Chip icon={<ShellIcon name="visible" />} label="Live preview" />
          </Stack>
        </Stack>
        {pageSource.isLoading ? (
          <LinearProgress aria-label="Loading documentation pages" />
        ) : null}
        {pageSource.sourceError ? (
          <Alert severity="info">
            Axis could not load the live CMS page catalogue, so it is showing the
            built-in documentation seed list.
          </Alert>
        ) : null}
        {saveMessage ? <Alert severity="success">{saveMessage}</Alert> : null}
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', lg: '300px minmax(0, 1fr)' },
          }}
        >
          <PageSelectionRail
            pages={pages}
            selectedPageId={selectedPage.id}
            onCreate={createNewPage}
            onSelect={setSelectedPageId}
          />
          <Paper
            elevation={0}
            sx={{
              bgcolor: alpha(axisTokens.color.signatureGold, 0.04),
              border: 1,
              borderColor: alpha(axisTokens.color.signatureGold, 0.25),
              borderRadius: `${String(axisTokens.radius.small)}px`,
              p: 2,
            }}
          >
            <Stack spacing={2}>
              <SelectedPageSummary page={selectedPage} />
              <DocumentationContentEditor
                draft={selectedPage}
                onChange={updateSelectedPage}
              />
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ justifyContent: 'flex-end' }}
              >
                <Button
                  component={RouterLink}
                  startIcon={<ShellIcon name="list-tree" />}
                  to="/docs/designer/navigation"
                  variant="outlined"
                >
                  Link to navigation
                </Button>
                <Button
                  startIcon={<ShellIcon name="approve" />}
                  variant="contained"
                  onClick={() =>
                    setSaveMessage(
                      `${selectedPage.title} saved as a staged documentation draft.`,
                    )
                  }
                >
                  Save staged draft
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Box>
      </Stack>
    </Paper>
  );
}

function DocumentationNavigationDesignerPanel({
  accessToken,
  bootstrap,
  runtime,
  selectedSource,
}: {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
  readonly selectedSource: AxisCmsDocumentationSource | undefined;
}) {
  const pageSource = useDocumentationDraftPageSource({
    accessToken,
    bootstrap,
    runtime,
    selectedSource,
  });
  const pages = pageSource.pages;
  const [links, setLinks] = useState<readonly DocumentationDraftLink[]>(() =>
    documentationDraftLinks(pages),
  );
  const [selectedLinkId, setSelectedLinkId] = useState(links[0]?.id ?? '');
  const [saveMessage, setSaveMessage] = useState<string>();
  const selectedLink = links.find((link) => link.id === selectedLinkId) ?? links[0];

  useEffect(() => {
    const nextLinks = documentationDraftLinks(pageSource.pages);
    setLinks(nextLinks);
    setSelectedLinkId((current) =>
      nextLinks.some((link) => link.id === current)
        ? current
        : (nextLinks[0]?.id ?? ''),
    );
    setSaveMessage(undefined);
  }, [pageSource.pages]);

  const updateSelectedLink = (changes: Partial<DocumentationDraftLink>) => {
    if (!selectedLink) return;
    setLinks((current) =>
      current.map((link) =>
        link.id === selectedLink.id ? { ...link, ...changes } : link,
      ),
    );
    setSaveMessage(undefined);
  };

  const createLink = () => {
    const firstPage = pages[0];
    if (!firstPage) return;
    const next: DocumentationDraftLink = {
      id: `${firstPage.id}-new-link`,
      pageId: firstPage.id,
      label: 'New navigation link',
      parentLabel: 'Wiki home',
      order: '90',
      visibility: 'Axis + Nexus',
    };
    setLinks((current) =>
      current.some((link) => link.id === next.id) ? current : [next, ...current],
    );
    setSelectedLinkId(next.id);
    setSaveMessage(undefined);
  };

  if (!selectedLink) {
    return (
      <Alert severity="info">Create a page before linking it to navigation.</Alert>
    );
  }

  const selectedPage =
    pages.find((page) => page.id === selectedLink.pageId) ?? pages[0];

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={2}
          sx={{ alignItems: { lg: 'center' } }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography color="text.secondary" variant="overline">
              Navigation linking
            </Typography>
            <Typography variant="h5">
              Choose where the documentation page appears.
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              Authors can select a page, choose its parent topic, update the label,
              preview the reader path, and save the staged navigation link.
            </Typography>
          </Box>
          <Button
            component={RouterLink}
            startIcon={<ShellIcon name="content" />}
            to="/docs/designer/pages"
            variant="outlined"
          >
            Back to pages
          </Button>
        </Stack>
        {pageSource.isLoading ? (
          <LinearProgress aria-label="Loading documentation navigation pages" />
        ) : null}
        {pageSource.sourceError ? (
          <Alert severity="info">
            Axis could not load the live CMS page catalogue, so navigation is using the
            built-in documentation seed list.
          </Alert>
        ) : null}
        {saveMessage ? <Alert severity="success">{saveMessage}</Alert> : null}
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', lg: '320px minmax(0, 1fr)' },
          }}
        >
          <Paper
            component="aside"
            elevation={0}
            sx={{ border: 1, borderColor: 'divider', p: 1.5 }}
          >
            <Stack spacing={1.25}>
              <Button
                startIcon={<ShellIcon name="add" />}
                sx={{ justifyContent: 'flex-start' }}
                variant="contained"
                onClick={createLink}
              >
                Add navigation link
              </Button>
              <Typography color="text.secondary" variant="overline">
                Existing navigation
              </Typography>
              {links.map((link) => (
                <Button
                  key={link.id}
                  sx={{
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    p: 1.25,
                    textAlign: 'left',
                  }}
                  variant={link.id === selectedLink.id ? 'contained' : 'outlined'}
                  onClick={() => setSelectedLinkId(link.id)}
                >
                  <Box>
                    <Typography component="span" sx={{ display: 'block' }}>
                      {link.label}
                    </Typography>
                    <Typography
                      color={link.id === selectedLink.id ? 'inherit' : 'text.secondary'}
                      component="span"
                      sx={{ display: 'block' }}
                      variant="caption"
                    >
                      {link.parentLabel}
                    </Typography>
                  </Box>
                </Button>
              ))}
            </Stack>
          </Paper>
          <Paper
            elevation={0}
            sx={{
              bgcolor: alpha(axisTokens.color.signatureGold, 0.04),
              border: 1,
              borderColor: alpha(axisTokens.color.signatureGold, 0.25),
              borderRadius: `${String(axisTokens.radius.small)}px`,
              p: 2,
            }}
          >
            <Stack spacing={2}>
              <Paper
                elevation={0}
                sx={{
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: alpha(axisTokens.color.signatureGold, 0.35),
                  borderRadius: `${String(axisTokens.radius.small)}px`,
                  p: 1.5,
                }}
              >
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  sx={{ alignItems: { md: 'flex-start' } }}
                >
                  <Box
                    sx={{
                      alignItems: 'center',
                      bgcolor: alpha(axisTokens.color.signatureGold, 0.18),
                      borderRadius: `${String(axisTokens.radius.small)}px`,
                      color: 'primary.main',
                      display: 'flex',
                      height: 42,
                      justifyContent: 'center',
                      width: 42,
                    }}
                  >
                    <ShellIcon name="list-tree" />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography color="text.secondary" variant="overline">
                      Editing existing link
                    </Typography>
                    <Typography sx={{ lineHeight: 1.2 }} variant="h6">
                      {selectedLink.label}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
                      Appears under {selectedLink.parentLabel} and opens{' '}
                      {selectedPage?.title ?? 'the selected page'}.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Chip label={selectedLink.visibility} size="small" />
                    <Chip label={`Order ${selectedLink.order}`} size="small" />
                  </Stack>
                </Stack>
              </Paper>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                }}
              >
                <TextField
                  label="Page"
                  select
                  value={selectedLink.pageId}
                  onChange={(event) =>
                    updateSelectedLink({ pageId: event.target.value })
                  }
                >
                  {pages.map((page) => (
                    <MenuItem key={page.id} value={page.id}>
                      {page.title}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Link label"
                  value={selectedLink.label}
                  onChange={(event) =>
                    updateSelectedLink({ label: event.target.value })
                  }
                />
                <TextField
                  label="Parent topic"
                  value={selectedLink.parentLabel}
                  onChange={(event) =>
                    updateSelectedLink({ parentLabel: event.target.value })
                  }
                />
                <TextField
                  label="Display order"
                  value={selectedLink.order}
                  onChange={(event) =>
                    updateSelectedLink({ order: event.target.value })
                  }
                />
                <TextField
                  label="Visibility"
                  select
                  value={selectedLink.visibility}
                  onChange={(event) =>
                    updateSelectedLink({ visibility: event.target.value })
                  }
                >
                  {[
                    'Public',
                    'Axis + Nexus',
                    'Internal Axis',
                    'Permission limited',
                  ].map((visibility) => (
                    <MenuItem key={visibility} value={visibility}>
                      {visibility}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              <Paper
                elevation={0}
                sx={{
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: `${String(axisTokens.radius.small)}px`,
                  p: 2,
                }}
              >
                <Typography color="text.secondary" variant="overline">
                  Reader navigation preview
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <Typography variant="body2">Wiki home</Typography>
                  <Box sx={{ borderLeft: 2, borderColor: 'primary.main', pl: 2 }}>
                    <Typography variant="body2">{selectedLink.parentLabel}</Typography>
                    <Box
                      sx={{
                        bgcolor: alpha(axisTokens.color.signatureGold, 0.14),
                        border: 1,
                        borderColor: alpha(axisTokens.color.signatureGold, 0.35),
                        borderRadius: `${String(axisTokens.radius.small)}px`,
                        mt: 1,
                        p: 1.25,
                      }}
                    >
                      <Typography variant="subtitle2">{selectedLink.label}</Typography>
                      <Typography color="text.secondary" variant="caption">
                        {selectedPage?.slug ?? '/docs'} · {selectedLink.visibility} ·
                        order {selectedLink.order}
                      </Typography>
                    </Box>
                  </Box>
                </Stack>
              </Paper>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ justifyContent: 'flex-end' }}
              >
                <Button
                  component={RouterLink}
                  startIcon={<ShellIcon name="visible" />}
                  to="/docs/designer/preview"
                  variant="outlined"
                >
                  Preview staged content
                </Button>
                <Button
                  startIcon={<ShellIcon name="approve" />}
                  variant="contained"
                  onClick={() =>
                    setSaveMessage(`${selectedLink.label} saved to staged navigation.`)
                  }
                >
                  Save navigation link
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Box>
      </Stack>
    </Paper>
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

function DashboardPanel({
  selectedSource,
  tabs,
}: {
  readonly selectedSource: AxisDocumentationSource | undefined;
  readonly tabs: readonly DocumentationWorkspaceTab[];
}) {
  const tabRoute = (id: DocumentationManagementTab) =>
    tabs.find((tab) => tab.id === id)?.route ?? '/docs/designer';
  const primaryActions = [
    {
      step: '01',
      title: 'Create or update a page',
      body: 'Write the page title, summary, content sections, media, and reader tags.',
      outcome: 'Draft content',
      icon: 'content',
      route: tabRoute('pages'),
      action: 'Open pages',
    },
    {
      step: '02',
      title: 'Place it in navigation',
      body: 'Choose the section, parent topic, link label, and order readers will see.',
      outcome: 'Reader link',
      icon: 'list-tree',
      route: tabRoute('navigation'),
      action: 'Open links',
    },
    {
      step: '03',
      title: 'Set visibility',
      body: 'Decide whether the page is public, internal to Axis, or permission-limited.',
      outcome: 'Audience rules',
      icon: 'visible',
      route: tabRoute('access'),
      action: 'Open access',
    },
    {
      step: '04',
      title: 'Preview staged content',
      body: 'Review staged pages and links before they become Online documentation.',
      outcome: 'Staged review',
      icon: 'visible',
      route: tabRoute('preview'),
      action: 'Open preview',
    },
    {
      step: '05',
      title: 'Publish when ready',
      body: 'Review the change, submit for approval, and make it visible to readers.',
      outcome: 'Axis + Nexus',
      icon: 'workflow',
      route: tabRoute('publication'),
      action: 'Open publishing',
    },
  ] as const;
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{
        bgcolor: alpha(axisTokens.color.signatureGold, 0.08),
        border: 1,
        borderColor: alpha(axisTokens.color.signatureGold, 0.35),
        borderRadius: `${String(axisTokens.radius.medium)}px`,
        overflow: 'hidden',
        p: { xs: 2, md: 3 },
      }}
    >
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={2}
          sx={{ alignItems: { lg: 'center' } }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography color="text.secondary" variant="overline">
              Current workspace
            </Typography>
            <Typography sx={{ lineHeight: 1.05 }} variant="h4">
              Create, update, preview, and publish documentation.
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 820 }}>
              Select the documentation area, edit the page, place the link, preview the
              reader experience, then publish so the approved content is visible in Axis
              and Nexus.
            </Typography>
          </Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexWrap: 'wrap', justifyContent: { lg: 'flex-end' } }}
          >
            <Chip
              icon={<ShellIcon name="content" />}
              label={selectedSource?.label ?? 'Documentation area'}
            />
            <Chip icon={<ShellIcon name="visible" />} label="Axis preview" />
            <Chip icon={<ShellIcon name="storefront" />} label="Nexus ready" />
          </Stack>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gap: 1.25,
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(6, minmax(0, 1fr))',
            },
            position: 'relative',
          }}
        >
          {primaryActions.map((item, index) => (
            <Paper
              component="article"
              elevation={0}
              key={item.title}
              sx={{
                background:
                  index === primaryActions.length - 1
                    ? `linear-gradient(180deg, ${alpha(
                        axisTokens.color.signatureGold,
                        0.2,
                      )} 0%, ${alpha(axisTokens.color.signatureGold, 0.07)} 100%)`
                    : `linear-gradient(180deg, ${alpha(
                        axisTokens.color.charcoal[900],
                        0.025,
                      )} 0%, ${alpha(axisTokens.color.signatureGold, 0.045)} 100%)`,
                border: 1,
                borderColor:
                  index === primaryActions.length - 1
                    ? alpha(axisTokens.color.signatureGold, 0.55)
                    : alpha(axisTokens.color.charcoal[900], 0.1),
                borderRadius: `${String(axisTokens.radius.small)}px`,
                boxShadow:
                  index === primaryActions.length - 1
                    ? `0 18px 42px ${alpha(axisTokens.color.signatureGold, 0.16)}`
                    : `0 12px 32px ${alpha(axisTokens.color.charcoal[900], 0.06)}`,
                display: 'flex',
                flexDirection: 'column',
                gridColumn: {
                  xs: 'auto',
                  md: index === primaryActions.length - 1 ? '1 / -1' : 'auto',
                  lg: index < 3 ? 'span 2' : 'span 3',
                },
                minHeight: 238,
                overflow: 'hidden',
                p: 1.75,
                position: 'relative',
                transition: 'transform 160ms ease, box-shadow 160ms ease',
                '&:hover': {
                  boxShadow: `0 20px 44px ${alpha(
                    axisTokens.color.charcoal[900],
                    0.12,
                  )}`,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Box
                sx={{
                  bgcolor: alpha(axisTokens.color.signatureGold, 0.16),
                  borderBottomLeftRadius: `${String(axisTokens.radius.small)}px`,
                  color: 'text.secondary',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 0,
                  px: 1.25,
                  py: 0.75,
                  position: 'absolute',
                  right: 0,
                  top: 0,
                }}
              >
                {item.step}
              </Box>
              <Stack spacing={1.25} sx={{ flex: 1, pr: 1 }}>
                <Box
                  sx={{
                    alignItems: 'center',
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: alpha(axisTokens.color.signatureGold, 0.45),
                    borderRadius: 999,
                    boxShadow: `0 8px 18px ${alpha(
                      axisTokens.color.signatureGold,
                      0.16,
                    )}`,
                    display: 'inline-flex',
                    height: 42,
                    justifyContent: 'center',
                    width: 42,
                  }}
                >
                  <ShellIcon color="primary" name={item.icon} />
                </Box>
                <Chip
                  label={item.outcome}
                  size="small"
                  sx={{
                    alignSelf: 'flex-start',
                    bgcolor: 'background.paper',
                    borderColor: alpha(axisTokens.color.signatureGold, 0.35),
                    fontWeight: 700,
                  }}
                  variant="outlined"
                />
                <Typography sx={{ lineHeight: 1.15 }} variant="subtitle1">
                  {item.title}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {item.body}
                </Typography>
              </Stack>
              <Button
                component={RouterLink}
                endIcon={<ShellIcon name="chevron-right" />}
                sx={{
                  alignSelf: 'stretch',
                  justifyContent: 'space-between',
                  mt: 2,
                  px: 1.5,
                }}
                to={item.route}
                variant={index === primaryActions.length - 1 ? 'contained' : 'outlined'}
              >
                {item.action}
              </Button>
            </Paper>
          ))}
        </Box>
      </Stack>
    </Paper>
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
    !['dashboard', 'governance', 'pages', 'navigation'].includes(selectedTab.id);
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
      {activeTab === 'dashboard' ? null : (
        <WorkspaceTabs active={activeTab} tabs={tabs} />
      )}
      {activeTab === 'dashboard' ? (
        <DashboardPanel selectedSource={selectedSource} tabs={tabs} />
      ) : activeTab === 'pages' ? (
        <DocumentationPageDesignerPanel
          accessToken={props.accessToken}
          bootstrap={props.bootstrap}
          runtime={props.runtime}
          selectedSource={selectedSource}
        />
      ) : activeTab === 'navigation' ? (
        <DocumentationNavigationDesignerPanel
          accessToken={props.accessToken}
          bootstrap={props.bootstrap}
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
