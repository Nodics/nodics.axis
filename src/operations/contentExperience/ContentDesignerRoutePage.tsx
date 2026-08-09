import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
  AxisModuleConnection,
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
  type WorkbenchMetricDefinition,
} from '../shared/workbenchMetricDashboardModel';
import {
  loadContentDesignerAuthoringModel,
  saveContentDesignerDraft,
  validateContentDesignerDraft,
  type ContentDesignerAuthoringModel,
  type ContentDesignerComponentKind,
  type ContentDesignerDraft,
  type ContentDesignerDraftDefaults,
  type ContentDesignerOperationResult,
} from './api/contentDesignerClient';

interface ContentDesignerRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly routeNavigation?: AxisNavigationItem | undefined;
  readonly runtime: AxisRuntimeConfig;
}

interface DesignerStep {
  readonly action: string;
  readonly description: string;
  readonly icon: string;
  readonly id: string;
  readonly label: string;
  readonly route: string;
}

const designerMetrics: readonly WorkbenchMetricDefinition[] = Object.freeze([
  Object.freeze({
    id: 'catalogs',
    label: 'Content catalogs',
    moduleName: 'catalog',
    schemaName: 'catalog',
    description: 'Catalog containers that sit above sites, templates, and pages.',
    route: '/content/catalogs',
    icon: 'catalog',
  }),
  Object.freeze({
    id: 'sites',
    label: 'Sites',
    moduleName: 'cms',
    schemaName: 'cmsSite',
    description: 'Website containers available for page composition.',
    route: '/content/sites',
    icon: 'storefront',
  }),
  Object.freeze({
    id: 'page-templates',
    label: 'Templates',
    moduleName: 'cms',
    schemaName: 'cmsPageTemplate',
    description: 'Reusable page structures and allowed dynamic slots.',
    route: '/content/page-templates',
    icon: 'template',
  }),
  Object.freeze({
    id: 'pages',
    label: 'Pages',
    moduleName: 'cms',
    schemaName: 'cmsPage',
    description:
      'Authorable pages that connect catalog, site, template, slots, and components.',
    route: '/content/pages',
    icon: 'page',
  }),
  Object.freeze({
    id: 'components',
    label: 'Components',
    moduleName: 'cms',
    schemaName: 'cmsComponent',
    description: 'Reusable content blocks with text, media, and renderer data.',
    route: '/content/components',
    icon: 'component',
  }),
  Object.freeze({
    id: 'component-media',
    label: 'Media links',
    moduleName: 'cms',
    schemaName: 'cmsComponentMedia',
    description: 'Governed links from components to media records.',
    route: '/content/component-media',
    icon: 'media',
  }),
  Object.freeze({
    id: 'routes',
    label: 'Routes',
    moduleName: 'cms',
    schemaName: 'cmsPageRoute',
    description: 'Browser paths mapped to governed CMS pages.',
    route: '/content/routes',
    icon: 'route',
  }),
]);

const designerSteps: readonly DesignerStep[] = Object.freeze([
  Object.freeze({
    id: 'catalog',
    label: 'Choose catalog',
    description:
      'Start with the content catalog. A site, template, page, route, and component composition must belong to a catalog boundary.',
    icon: 'catalog',
    route: '/content/catalogs',
    action: 'Manage catalogs',
  }),
  Object.freeze({
    id: 'site',
    label: 'Choose or create site',
    description:
      'Pick the business site: brand portal, documentation site, storefront, or internal workspace.',
    icon: 'storefront',
    route: '/content/sites',
    action: 'Manage sites',
  }),
  Object.freeze({
    id: 'template',
    label: 'Select template',
    description:
      'Pick the page structure and its governed dynamic slots before adding page-specific sections.',
    icon: 'template',
    route: '/content/page-templates',
    action: 'Manage templates',
  }),
  Object.freeze({
    id: 'page',
    label: 'Create page',
    description:
      'Create the page record, connect it with catalog/site/template, and keep lifecycle state visible.',
    icon: 'page',
    route: '/content/pages',
    action: 'Manage pages',
  }),
  Object.freeze({
    id: 'section',
    label: 'Arrange sections and slots',
    description:
      'Use any allowed template slot to arrange hero, body, gallery, call-to-action, or documentation sections.',
    icon: 'layout',
    route: '/content/slot-definitions',
    action: 'Manage slots',
  }),
  Object.freeze({
    id: 'component',
    label: 'Add text/components',
    description:
      'Create reusable components for titles, rich text, cards, banners, documentation blocks, and dashboard widgets.',
    icon: 'component',
    route: '/content/components',
    action: 'Manage components',
  }),
  Object.freeze({
    id: 'media',
    label: 'Associate media',
    description:
      'Select governed media records or upload new assets through nMedia before linking them to components.',
    icon: 'media',
    route: '/media/items?folderCode=cmsAssets',
    action: 'Open media',
  }),
  Object.freeze({
    id: 'route',
    label: 'Publish route intent',
    description:
      'Map clean browser routes and navigation nodes after the page structure is ready.',
    icon: 'route',
    route: '/content/routes',
    action: 'Manage routes',
  }),
]);

const fallbackDraftDefaults: ContentDesignerDraftDefaults = Object.freeze({
  catalogCode: 'documentationContentCatalog',
  pageRenderer: 'axis.documentationPage',
  pageTypeCode: 'documentationPageType',
  routePath: '/docs/home',
  siteCode: 'axisDocumentationSite',
  slots: Object.freeze(['navigation', 'article', 'relatedResources']),
  templateCode: 'articleTemplate',
});

const fallbackComponentKinds: readonly ContentDesignerComponentKind[] = Object.freeze([
  Object.freeze({
    label: 'Hero banner',
    typeCode: 'heroBannerComponentType',
    renderer: 'axis.heroBanner',
  }),
  Object.freeze({
    label: 'Rich text',
    typeCode: 'richTextComponentType',
    renderer: 'axis.richText',
  }),
  Object.freeze({
    label: 'Image card',
    typeCode: 'imageCardComponentType',
    renderer: 'axis.imageCard',
  }),
  Object.freeze({
    label: 'Media gallery',
    typeCode: 'mediaGalleryComponentType',
    renderer: 'axis.mediaGallery',
  }),
  Object.freeze({
    label: 'Call to action',
    typeCode: 'callToActionComponentType',
    renderer: 'axis.callToAction',
  }),
  Object.freeze({
    label: 'Documentation article',
    typeCode: 'documentationArticleComponentType',
    renderer: 'axis.documentationArticle',
  }),
  Object.freeze({
    label: 'Dashboard widget',
    typeCode: 'dashboardWidgetComponentType',
    renderer: 'axis.dashboardWidget',
  }),
]);

function DesignerStepCard({
  step,
  index,
}: {
  readonly index: number;
  readonly step: DesignerStep;
}) {
  return (
    <Card elevation={0} sx={{ border: 1, borderColor: 'divider', height: '100%' }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              aria-hidden
              sx={{
                alignItems: 'center',
                bgcolor: alpha(axisTokens.color.signatureGold, 0.18),
                borderRadius: axisTokens.radius.medium,
                color: 'primary.main',
                display: 'inline-flex',
                height: 42,
                justifyContent: 'center',
                width: 42,
              }}
            >
              <ShellIcon name={step.icon} />
            </Box>
            <Box>
              <Typography color="text.secondary" variant="caption">
                Step {String(index + 1)}
              </Typography>
              <Typography variant="h6">{step.label}</Typography>
            </Box>
          </Stack>
          <Typography color="text.secondary">{step.description}</Typography>
          <Button component={RouterLink} to={step.route} variant="outlined">
            {step.action}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function firstHealthyCmsConnection(
  bootstrap: AxisAuthenticatedBootstrap,
): AxisModuleConnection | undefined {
  const cmsConnections = bootstrap.moduleConnections.cms ?? [];
  return (
    cmsConnections.find((connection) => connection.state === 'UP') ??
    cmsConnections.find((connection) => connection.state === 'DEGRADED') ??
    cmsConnections[0]
  );
}

function safeCode(value: string, fallback: string): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9_-]/g, '');
  return normalized || fallback;
}

function safeRoute(value: string, fallback: string): string {
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function parseSlots(value: string): readonly string[] {
  const slots = value
    .split(/[\n,]+/)
    .map((slot) => slot.trim())
    .filter(Boolean);
  return Object.freeze(slots.length > 0 ? slots : ['body']);
}

function selectedComponentKind(
  label: string,
  componentKinds: readonly ContentDesignerComponentKind[],
): ContentDesignerComponentKind {
  const selected = componentKinds.find((kind) => kind.label === label);
  if (selected) return selected;
  const fallback = componentKinds.find((kind) => kind.label === 'Hero banner');
  if (!fallback) throw new Error('Content Designer component kind catalog is empty');
  return fallback;
}

function buildDraft({
  catalogIntent,
  componentIntent,
  componentKinds,
  draftDefaults,
  pageIntent,
  routeIntent,
  siteIntent,
  slotIntent,
  templateIntent,
}: {
  readonly catalogIntent: string;
  readonly componentIntent: string;
  readonly componentKinds: readonly ContentDesignerComponentKind[];
  readonly draftDefaults: ContentDesignerDraftDefaults;
  readonly pageIntent: string;
  readonly routeIntent: string;
  readonly siteIntent: string;
  readonly slotIntent: string;
  readonly templateIntent: string;
}): ContentDesignerDraft {
  const pageCode = safeCode(pageIntent, 'newPage');
  const kind = selectedComponentKind(componentIntent, componentKinds);
  const defaultSlots =
    draftDefaults.slots && draftDefaults.slots.length
      ? draftDefaults.slots.join('\n')
      : 'body';
  const slots = parseSlots(slotIntent || defaultSlots);
  return Object.freeze({
    catalogCode: safeCode(catalogIntent, draftDefaults.catalogCode ?? 'contentCatalog'),
    siteCode: safeCode(siteIntent, draftDefaults.siteCode ?? 'contentSite'),
    templateCode: safeCode(
      templateIntent,
      draftDefaults.templateCode ?? 'pageTemplate',
    ),
    page: Object.freeze({
      code: pageCode,
      name:
        pageCode
          .replace(/[-_]+/g, ' ')
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .replace(/^./, (letter) => letter.toUpperCase()) || pageCode,
      renderer: draftDefaults.pageRenderer ?? 'axis.page',
      typeCode: draftDefaults.pageTypeCode ?? 'contentPageType',
    }),
    sections: Object.freeze(
      slots.map((slot, index) =>
        Object.freeze({
          slot,
          index,
          components: Object.freeze([
            Object.freeze({
              code: `${pageCode}${slot.charAt(0).toUpperCase()}${slot.slice(1)}Component`,
              renderer: kind.renderer,
              typeCode: kind.typeCode,
              accessMode: 'AUTHENTICATED',
              properties: Object.freeze({
                title: `${pageCode} ${slot}`,
                body: `Draft ${kind.label.toLowerCase()} content for ${slot}.`,
              }),
            }),
          ]),
        }),
      ),
    ),
    route: Object.freeze({
      channel: 'web',
      locale: 'en',
      path: safeRoute(routeIntent, `/docs/${pageCode}`),
    }),
    navigation: Object.freeze({
      label: pageCode,
      parentCode: 'nodicsDocumentation',
    }),
  });
}

function operationMessage(
  result: ContentDesignerOperationResult | undefined,
  fallback: string,
): string {
  if (!result) return fallback;
  if (result.status) return result.status;
  if (result.valid === true) return 'VALID_DRAFT';
  return fallback;
}

function draftRoutePath(draft: ContentDesignerDraft): string {
  const path = draft.route?.path;
  return typeof path === 'string' ? path : 'not assigned';
}

function AuthoringContractPanel({
  model,
  isLoading,
  error,
}: {
  readonly error: Error | null;
  readonly isLoading: boolean;
  readonly model: ContentDesignerAuthoringModel | undefined;
}) {
  if (isLoading) {
    return (
      <Stack spacing={1}>
        <Typography variant="h6">Authoring contract</Typography>
        <LinearProgress aria-label="Loading CMS Designer authoring contract" />
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert severity="warning">
        {error.message || 'CMS Designer authoring contract could not be loaded.'}
      </Alert>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="h6">Authoring contract</Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Chip
          color={model?.rules.catalogFirst ? 'success' : 'warning'}
          label={model?.rules.catalogFirst ? 'Catalog first' : 'Catalog rule unknown'}
        />
        <Chip
          color={model?.rules.arbitrarySlots ? 'success' : 'warning'}
          label={
            model?.rules.arbitrarySlots
              ? 'Template Slots: any number'
              : 'Slot flexibility unknown'
          }
        />
        <Chip
          color={model?.rules.frontendPersistence === false ? 'success' : 'warning'}
          label={
            model?.rules.frontendPersistence === false
              ? 'Backend persistence only'
              : 'Persistence rule unknown'
          }
        />
      </Stack>
      <Typography color="text.secondary" variant="body2">
        {model?.hierarchy?.length
          ? model.hierarchy.join(' → ')
          : 'Content Catalog → Site → Template → Page → Slots → Sections → Components → Media → Route → Navigation'}
      </Typography>
      <Typography color="text.secondary" variant="body2">
        Supported operations:{' '}
        {model?.operations?.length ? model.operations.join(', ') : 'loading from WCMS'}
      </Typography>
    </Stack>
  );
}

function DraftPreview({ draft }: { readonly draft: ContentDesignerDraft }) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="h6">Generated catalog-first preview</Typography>
      <Stack spacing={0.75}>
        <Typography>Catalog: {draft.catalogCode}</Typography>
        <Typography>Site: {draft.siteCode}</Typography>
        <Typography>Template: {draft.templateCode}</Typography>
        <Typography>Page: {draft.page.code}</Typography>
        <Typography>Route: {draftRoutePath(draft)}</Typography>
      </Stack>
      <Divider />
      <Stack spacing={1}>
        {draft.sections.map((section) => (
          <Box
            key={`${section.slot}-${String(section.index ?? 0)}`}
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: axisTokens.radius.medium,
              p: 1.5,
            }}
          >
            <Typography sx={{ fontWeight: 800 }}>
              Slot: {section.slot} · Section {String((section.index ?? 0) + 1)}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Components:{' '}
              {section.components
                .map((component) => `${component.code} (${component.typeCode})`)
                .join(', ')}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

export function ContentDesignerRoutePage({
  accessToken,
  bootstrap,
  routeNavigation,
  runtime,
}: ContentDesignerRoutePageProps) {
  const [catalogIntent, setCatalogIntent] = useState('documentationContentCatalog');
  const [siteIntent, setSiteIntent] = useState('axisDocumentationSite');
  const [templateIntent, setTemplateIntent] = useState('articleTemplate');
  const [pageIntent, setPageIntent] = useState('home');
  const [slotIntent, setSlotIntent] = useState('navigation\narticle\nrelatedResources');
  const [routeIntent, setRouteIntent] = useState('/docs/home');
  const [componentIntent, setComponentIntent] = useState(
    selectedComponentKind('Hero banner', fallbackComponentKinds).label,
  );
  const connections = useMemo(() => activeConnections(bootstrap), [bootstrap]);
  const designerConnection = useMemo(
    () => firstHealthyCmsConnection(bootstrap),
    [bootstrap],
  );
  const configuration = useMemo(
    () => ({
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs],
  );
  const data = useQuery({
    queryKey: ['content-designer', runtime.enterpriseCode, connectionKey(connections)],
    queryFn: () =>
      loadWorkbenchMetrics(connections, bootstrap, configuration, designerMetrics),
  });
  const authoringModel = useQuery({
    enabled: Boolean(designerConnection),
    queryKey: [
      'content-designer-authoring-model',
      runtime.enterpriseCode,
      designerConnection?.instanceId,
    ],
    queryFn: () => {
      if (!designerConnection) throw new Error('CMS connection is not available');
      return loadContentDesignerAuthoringModel(designerConnection, configuration);
    },
  });
  const componentKinds = authoringModel.data?.defaults.componentKinds.length
    ? authoringModel.data.defaults.componentKinds
    : fallbackComponentKinds;
  const draftDefaults =
    authoringModel.data?.defaults.draftDefaults ?? fallbackDraftDefaults;
  const draft = useMemo(
    () =>
      buildDraft({
        catalogIntent,
        componentIntent,
        componentKinds,
        draftDefaults,
        pageIntent,
        routeIntent,
        siteIntent,
        slotIntent,
        templateIntent,
      }),
    [
      catalogIntent,
      componentIntent,
      componentKinds,
      draftDefaults,
      pageIntent,
      routeIntent,
      siteIntent,
      slotIntent,
      templateIntent,
    ],
  );
  const validateMutation = useMutation({
    mutationFn: () => {
      if (!designerConnection) throw new Error('CMS connection is not available');
      return validateContentDesignerDraft(designerConnection, configuration, draft);
    },
  });
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!designerConnection) throw new Error('CMS connection is not available');
      return saveContentDesignerDraft(designerConnection, configuration, draft);
    },
  });
  const metrics = metricsById(data.data, designerMetrics);
  const operationError =
    validateMutation.error instanceof Error
      ? validateMutation.error
      : saveMutation.error instanceof Error
        ? saveMutation.error
        : undefined;

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
                description="Guide business users through catalog, site, page, section, component, media, route, and navigation composition without bypassing WCMS or nMedia ownership."
                help={routeNavigation?.help}
                eyebrow="Governed page composition"
                headingVariant="h3"
                title="Content Designer"
              />
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}
              >
                <Chip color="success" label="WCMS governed" />
                <Chip label="Catalog first" />
                <Chip label="Dynamic slots" />
                <Chip label="Media by reference" />
              </Stack>
            </Stack>

            <Alert
              severity={data.isError || authoringModel.isError ? 'warning' : 'info'}
            >
              {data.isError
                ? data.error instanceof Error
                  ? data.error.message
                  : 'Designer readiness could not be loaded from live WCMS contracts.'
                : 'This designer is intentionally not a pixel-perfect website builder. It is a guided composition workspace over backend-owned WCMS catalogs, sites, templates, slots, components, media references, routes, and publishing contracts.'}
            </Alert>
          </Stack>
        </Paper>

        <Box
          sx={{
            display: 'grid',
            gap: dashboardComponentGap,
            gridTemplateColumns: {
              xs: '1fr',
              xl: 'minmax(0, 1.05fr) minmax(420px, 0.95fr)',
            },
          }}
        >
          <Paper
            component="section"
            elevation={0}
            sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
          >
            <Stack spacing={dashboardContentGap}>
              <Box>
                <Typography variant="h4">Designer flow</Typography>
                <Typography color="text.secondary">
                  Follow this sequence when creating a content experience. Each step
                  opens the governed record workspace that owns the final data.
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gap: dashboardComponentGap,
                  gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                }}
              >
                {designerSteps.map((step, index) => (
                  <DesignerStepCard key={step.id} index={index} step={step} />
                ))}
              </Box>
            </Stack>
          </Paper>

          <Paper
            component="aside"
            elevation={0}
            sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
          >
            <Stack spacing={dashboardContentGap}>
              <Box>
                <Typography variant="h4">Composition draft</Typography>
                <Typography color="text.secondary">
                  Capture a catalog-first draft, validate it against WCMS, then save it
                  through the backend authoring service.
                </Typography>
              </Box>
              <AuthoringContractPanel
                error={
                  authoringModel.error instanceof Error ? authoringModel.error : null
                }
                isLoading={authoringModel.isLoading}
                model={authoringModel.data}
              />
              <Divider />
              <TextField
                label="Content Catalog"
                onChange={(event) => setCatalogIntent(event.target.value)}
                value={catalogIntent}
              />
              <TextField
                label="Site intent"
                onChange={(event) => setSiteIntent(event.target.value)}
                select
                value={siteIntent}
              >
                <MenuItem value="defaultCmsSite">Default content site</MenuItem>
                <MenuItem value="axisDocumentationSite">
                  Axis documentation site
                </MenuItem>
                <MenuItem value="frameworkDocumentationSite">
                  Framework documentation site
                </MenuItem>
                <MenuItem value="projectDocumentationSite">
                  Project documentation site
                </MenuItem>
                <MenuItem value="newCustomerSite">New customer site</MenuItem>
              </TextField>
              <TextField
                label="Template intent"
                onChange={(event) => setTemplateIntent(event.target.value)}
                value={templateIntent}
              />
              <TextField
                label="Page intent"
                onChange={(event) => setPageIntent(event.target.value)}
                value={pageIntent}
              />
              <TextField
                helperText="One slot per line or comma. Designer supports any template-defined slots."
                label="Template slots"
                minRows={3}
                multiline
                onChange={(event) => setSlotIntent(event.target.value)}
                value={slotIntent}
              />
              <TextField
                label="Route intent"
                onChange={(event) => setRouteIntent(event.target.value)}
                value={routeIntent}
              />
              <TextField
                label="Primary component type"
                onChange={(event) => setComponentIntent(event.target.value)}
                select
                value={componentIntent}
              >
                {componentKinds.map((kind) => (
                  <MenuItem key={kind.label} value={kind.label}>
                    {kind.label}
                  </MenuItem>
                ))}
              </TextField>
              <Divider />
              <DraftPreview draft={draft} />
              {operationError ? (
                <Alert severity="error">{operationError.message}</Alert>
              ) : null}
              {validateMutation.data ? (
                <Alert
                  severity={
                    validateMutation.data.valid === false ? 'warning' : 'success'
                  }
                >
                  Validation result:{' '}
                  {operationMessage(validateMutation.data, 'CMS validation completed')}
                </Alert>
              ) : null}
              {saveMutation.data ? (
                <Alert severity="success">
                  Save result: {operationMessage(saveMutation.data, 'CMS draft saved')}
                </Alert>
              ) : null}
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Button
                  disabled={!designerConnection || validateMutation.isPending}
                  onClick={() => validateMutation.mutate()}
                  variant="contained"
                >
                  Validate draft
                </Button>
                <Button
                  disabled={!designerConnection || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                  variant="outlined"
                >
                  Save draft
                </Button>
                <Button
                  component={RouterLink}
                  to="/media/items?folderCode=cmsAssets"
                  variant="outlined"
                >
                  Choose media
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Box>

        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <Stack spacing={dashboardContentGap}>
            <Box>
              <Typography variant="h4">Readiness snapshot</Typography>
              <Typography color="text.secondary">
                These counts come from live workbench contracts. If one is unavailable,
                the designer can still explain the flow, but save actions must stay
                inside the owning workspace.
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gap: dashboardComponentGap,
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(4, minmax(0, 1fr))',
                },
              }}
            >
              {metrics.map((metric) => (
                <Card
                  key={metric.id}
                  elevation={0}
                  sx={{ border: 1, borderColor: 'divider' }}
                >
                  <CardContent>
                    <Stack spacing={1}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <Typography variant="h6">{metric.label}</Typography>
                        <Chip
                          color={metric.status === 'ready' ? 'success' : 'warning'}
                          label={metric.status === 'ready' ? 'Live' : 'Unavailable'}
                          size="small"
                        />
                      </Stack>
                      <Typography sx={{ fontSize: 34, fontWeight: 800 }}>
                        {metric.status === 'ready'
                          ? new Intl.NumberFormat().format(metric.value ?? 0)
                          : '—'}
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        {metric.detail}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Stack>
        </Paper>
      </Stack>
    </WorkspaceContainer>
  );
}
