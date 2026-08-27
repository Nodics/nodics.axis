import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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
  createDocumentationGovernanceClient,
  defaultDocumentationGovernanceRoutes,
  type DocumentationAuthoringModel,
  type DocumentationAuthoringPanel,
  type DocumentationAuthoringSequenceItem,
  type DocumentationGovernanceRoutes,
} from './api/documentationGovernanceClient';

type DocumentationManagementTab =
  | 'dashboard'
  | 'navigation'
  | 'pages'
  | 'dashboards'
  | 'access'
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

const fallbackTabs: readonly DocumentationWorkspaceTab[] = Object.freeze([
  Object.freeze({
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    route: '/content/designer/documentation',
    order: 0,
  }),
  Object.freeze({
    id: 'navigation',
    label: 'Navigation Builder',
    icon: 'list-tree',
    route: '/content/designer/documentation/navigation',
    schemaName: 'cmsDocumentationNode',
    order: 10,
  }),
  Object.freeze({
    id: 'pages',
    label: 'Pages and Topic Content',
    icon: 'content',
    route: '/content/designer/documentation/pages',
    schemaName: 'cmsDocumentationPage',
    order: 20,
  }),
  Object.freeze({
    id: 'dashboards',
    label: 'Dashboards and Content Areas',
    icon: 'dashboard',
    route: '/content/designer/documentation/dashboards',
    schemaName: 'cmsDocumentationDashboard',
    order: 30,
  }),
  Object.freeze({
    id: 'access',
    label: 'Audience and Access Policies',
    icon: 'security',
    route: '/content/designer/documentation/access-policies',
    schemaName: 'cmsDocumentationAccessPolicy',
    order: 40,
  }),
  Object.freeze({
    id: 'publication',
    label: 'Review and Publication Queue',
    icon: 'workflow',
    route: '/content/designer/documentation/publication',
    schemaName: 'cmsDocumentationPublicationState',
    order: 50,
  }),
  Object.freeze({
    id: 'search',
    label: 'Search Metadata Preview',
    icon: 'search',
    route: '/content/designer/documentation/search',
    schemaName: 'cmsDocumentationSearchMetadata',
    order: 60,
  }),
  Object.freeze({
    id: 'sourceEvidence',
    label: 'Source Evidence Review',
    icon: 'validation',
    route: '/content/designer/documentation/source-evidence',
    schemaName: 'cmsDocumentationPage',
    order: 70,
  }),
  Object.freeze({
    id: 'governance',
    label: 'Governance and Readiness',
    icon: 'validation',
    route: '/content/designer/documentation/governance',
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
    route: '/content/designer/documentation',
    landing: '/content/designer/documentation/dashboard',
    previewRoute: '/content/designer/documentation/preview',
    searchRoute: '/content/designer/documentation/search',
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

function visibleChildren(
  navigation: readonly AxisNavigationItem[],
): readonly AxisNavigationItem[] {
  const children = navigation.filter(
    (item) =>
      item.parentId === 'documentation-management' &&
      item.featureState !== 'DISABLED' &&
      item.featureState !== 'HIDDEN',
  );
  return Object.freeze(
    children.sort(
      (left, right) =>
        left.order - right.order || left.label.localeCompare(right.label),
    ),
  );
}

function countBy<T>(
  values: readonly T[],
  key: (value: T) => string,
): ReadonlyMap<string, number> {
  return values.reduce((result, value) => {
    const name = key(value);
    result.set(name, (result.get(name) ?? 0) + 1);
    return result;
  }, new Map<string, number>());
}

function modelGroups(
  model: DocumentationAuthoringModel,
): readonly [string, readonly DocumentationAuthoringSequenceItem[]][] {
  const groups = Object.entries(model.sequenceByGroup);
  if (groups.length > 0) return Object.freeze(groups);
  return Object.freeze(
    Object.entries(
      model.sequence.reduce<
        Record<string, readonly DocumentationAuthoringSequenceItem[]>
      >((result, item) => {
        result[item.group] = Object.freeze([...(result[item.group] ?? []), item]);
        return result;
      }, {}),
    ),
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

function hasAuthoringLink(navigation: readonly AxisNavigationItem[]): boolean {
  return navigation.some((item) =>
    [
      'documentation-navigation',
      'documentation-pages',
      'documentation-access-policies',
      'documentation-governance-readiness',
      'documentation-publication-queue',
    ].includes(item.id),
  );
}

function connectionKey(connection: AxisModuleConnection | undefined): string {
  if (!connection) return 'missing';
  return `${connection.moduleName}:${connection.instanceId}:${connection.endpoint}:${connection.state}`;
}

function selectedDocumentationSource(
  sources: readonly AxisDocumentationSource[],
  sourceId: string,
): AxisDocumentationSource | undefined {
  return sources.find((source) => source.id === sourceId) ?? sources[0];
}

function documentationSourceContext(
  source: AxisDocumentationSource | undefined,
): Readonly<Record<string, string>> | undefined {
  if (!source || source.type !== 'CMS') return undefined;
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

function WorkspaceMetric({
  detail,
  icon,
  label,
  value,
}: {
  readonly detail: string;
  readonly icon: string;
  readonly label: string;
  readonly value: string | number;
}) {
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(axisTokens.radius.small)}px`,
        minHeight: 116,
        p: 2,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <ShellIcon color="primary" name={icon} />
        <Box sx={{ minWidth: 0 }}>
          <Typography color="text.secondary" variant="caption">
            {label}
          </Typography>
          <Typography sx={{ lineHeight: 1.1, mt: 0.25 }} variant="h5">
            {value}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
            {detail}
          </Typography>
        </Box>
      </Stack>
    </Paper>
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
      aria-label="Documentation management views"
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

function AuthoringFlow({ model }: { readonly model: DocumentationAuthoringModel }) {
  const triggerCounts = countBy(
    model.sequence.filter((item) => item.trigger),
    (item) => item.trigger ?? 'NONE',
  );
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          sx={{ alignItems: { md: 'center' } }}
        >
          <Typography sx={{ flex: 1 }} variant="h6">
            Authoring and publication flow
          </Typography>
          <Chip label={model.publicationAuthority} size="small" />
          <Chip label={model.contentAuthority} size="small" />
        </Stack>
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
          {[
            ['Author', 'Draft content, visuals, access, and source evidence'],
            ['Validate', 'Hierarchy, pages, dashboards, search, and lifecycle'],
            ['Review', 'Submit governed records for approval'],
            ['Publish', 'Handoff approved targets to nPublish'],
            ['Read', 'Axis and Nexus render allowed Online records'],
          ].map(([title, body], index) => (
            <Box
              key={title}
              sx={{
                bgcolor: alpha(
                  axisTokens.color.signatureGold,
                  index === 3 ? 0.2 : 0.08,
                ),
                border: 1,
                borderColor: alpha(axisTokens.color.charcoal[900], 0.12),
                borderRadius: `${String(axisTokens.radius.small)}px`,
                minHeight: 104,
                p: 1.5,
              }}
            >
              <Typography variant="subtitle2">{title}</Typography>
              <Typography color="text.secondary" variant="body2">
                {body}
              </Typography>
            </Box>
          ))}
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          {[...triggerCounts.entries()].map(([trigger, count]) => (
            <Chip key={trigger} label={`${trigger}: ${String(count)}`} size="small" />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}

function AuthoringSequence({ model }: { readonly model: DocumentationAuthoringModel }) {
  const groups = modelGroups(model);
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}
    >
      <Stack spacing={1.5}>
        <Typography variant="h6">Authoring sequence</Typography>
        {groups.length === 0 ? (
          <Alert severity="info">
            The backend authoring model is available; sequence details will appear after
            the CMS governance service returns them.
          </Alert>
        ) : (
          <Box sx={{ display: 'grid', gap: 1.25 }}>
            {groups.map(([group, items]) => (
              <Box
                key={group}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1.5,
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ alignItems: { sm: 'center' }, mb: 1 }}
                >
                  <Typography sx={{ flex: 1 }} variant="subtitle2">
                    {group}
                  </Typography>
                  <Chip label={`${String(items.length)} items`} size="small" />
                </Stack>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1,
                    gridTemplateColumns: {
                      xs: '1fr',
                      md: 'repeat(2, minmax(0, 1fr))',
                    },
                  }}
                >
                  {items.map((item) => (
                    <Box
                      key={item.id}
                      sx={{
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        minHeight: 72,
                        p: 1,
                      }}
                    >
                      <Typography variant="body2">
                        {String(item.id).padStart(2, '0')}. {item.label}
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={0.75}
                        sx={{ flexWrap: 'wrap', mt: 0.75 }}
                      >
                        <Chip label={item.target} size="small" />
                        {item.trigger ? (
                          <Chip label={item.trigger} size="small" />
                        ) : null}
                        {item.accessMode ? (
                          <Chip label={item.accessMode} size="small" />
                        ) : null}
                        {item.state ? <Chip label={item.state} size="small" /> : null}
                      </Stack>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

function AuthoringShortcuts({
  model,
  tabs,
}: {
  readonly model: DocumentationAuthoringModel;
  readonly tabs: readonly DocumentationWorkspaceTab[];
}) {
  const shortcuts = model.panels
    .flatMap((panel) => {
      const tab = tabs.find((candidate) => candidate.id === panel.code);
      if (!tab || !panel.schemaName) return [];
      return [{ panel, tab }];
    })
    .sort((left, right) => left.tab.order - right.tab.order);

  if (shortcuts.length === 0) return null;

  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}
    >
      <Stack spacing={1.5}>
        <Typography variant="h6">Record editor shortcuts</Typography>
        <Box
          sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          {shortcuts.map(({ panel, tab }) => (
            <Button
              component={RouterLink}
              key={panel.code}
              startIcon={<ShellIcon name={tab.icon} />}
              sx={{
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                minHeight: 72,
                textAlign: 'left',
              }}
              to={tab.route}
              variant="outlined"
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography component="span" sx={{ display: 'block' }} variant="body2">
                  {panel.label}
                </Typography>
                <Typography
                  color="text.secondary"
                  component="span"
                  sx={{ display: 'block', overflowWrap: 'anywhere' }}
                  variant="caption"
                >
                  {panel.schemaName}
                </Typography>
              </Box>
            </Button>
          ))}
        </Box>
      </Stack>
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

function DashboardPanel({
  authoringMode,
  childrenCount,
  model,
  sourceCount,
  tabs,
}: {
  readonly authoringMode: 'Viewer' | 'Author/Admin';
  readonly childrenCount: number;
  readonly model: DocumentationAuthoringModel;
  readonly sourceCount: number;
  readonly tabs: readonly DocumentationWorkspaceTab[];
}) {
  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
        }}
      >
        <WorkspaceMetric
          detail="Backend-provided documentation products available to this session."
          icon="content"
          label="Sources"
          value={sourceCount}
        />
        <WorkspaceMetric
          detail="Documentation management destinations authorized by BackOffice."
          icon="list-tree"
          label="Workspace Links"
          value={childrenCount}
        />
        <WorkspaceMetric
          detail="Approved authoring, validation, publishing, access, and search items."
          icon="tasks"
          label="Sequence"
          value={model.sequence.length || 100}
        />
        <WorkspaceMetric
          detail="Current mode inferred from backend-filtered navigation."
          icon={authoringMode === 'Author/Admin' ? 'approve' : 'visible'}
          label="Session Mode"
          value={authoringMode}
        />
      </Box>
      <AuthoringFlow model={model} />
      <AuthoringShortcuts model={model} tabs={tabs} />
      <AuthoringSequence model={model} />
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
  const [selectedSourceId, setSelectedSourceId] = useState(
    props.bootstrap.documentationSources[0]?.id ?? 'framework',
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
  const selectedSource = selectedDocumentationSource(
    props.bootstrap.documentationSources,
    selectedSourceId,
  );
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
  const children = visibleChildren(props.bootstrap.navigation);
  const authoringMode = hasAuthoringLink(children) ? 'Author/Admin' : 'Viewer';
  const selectedTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]!;
  const showWorkbench =
    selectedTab.schemaName && !['dashboard', 'governance'].includes(selectedTab.id);
  const routeNavigation = routeNavigationForTab(props.navigation, selectedTab);

  return (
    <WorkspaceContainer>
      <WorkspaceHeading
        eyebrow="Documentation Management"
        title="Governed documentation workspace"
        description="Backend-owned content catalog, hierarchy, access, validation, publishing, and search contracts for Axis authoring."
      />
      {modelQuery.isLoading ? (
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 2 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <CircularProgress size={20} />
            <Typography variant="body2">
              Loading documentation governance model
            </Typography>
          </Stack>
        </Paper>
      ) : null}
      {modelQuery.error instanceof Error ? (
        <Alert severity="warning">
          {modelQuery.error.message}. Axis is using the local renderer contract until
          the CMS governance model is reachable.
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
              label="Documentation product"
              select
              size="small"
              sx={{ minWidth: { xs: '100%', md: 280 } }}
              value={selectedSource?.id ?? selectedSourceId}
              onChange={(event) => setSelectedSourceId(event.target.value)}
            >
              {(props.bootstrap.documentationSources.length > 0
                ? props.bootstrap.documentationSources
                : [{ id: 'framework', label: 'Framework' }]
              ).map((source) => (
                <MenuItem key={source.id} value={source.id}>
                  {source.label}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip label={model.contract} size="small" />
              <Chip label={`Owner: ${model.ownerModule}`} size="small" />
              <Chip label={`Reader: ${props.channel}`} size="small" />
              <Chip label={`Locale: ${props.locale}`} size="small" />
            </Stack>
          </Stack>
          <Divider />
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(3, minmax(0, 1fr))',
              },
            }}
          >
            {children.slice(0, 6).map((item) => (
              <Button
                component={RouterLink}
                key={item.id}
                startIcon={<ShellIcon name={item.icon} />}
                sx={{ justifyContent: 'flex-start', minHeight: 44 }}
                to={item.route}
                variant={props.path.startsWith(item.route) ? 'contained' : 'outlined'}
              >
                {item.label}
              </Button>
            ))}
          </Box>
        </Stack>
      </Paper>
      <WorkspaceTabs active={activeTab} tabs={tabs} />
      {activeTab === 'dashboard' ? (
        <DashboardPanel
          authoringMode={authoringMode}
          childrenCount={children.length}
          model={model}
          sourceCount={props.bootstrap.documentationSources.length}
          tabs={tabs}
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
          This documentation management destination is waiting for a backend schema
          target in the authorized navigation contract.
        </Alert>
      )}
    </WorkspaceContainer>
  );
}
