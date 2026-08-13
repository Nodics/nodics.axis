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
import { selectModuleConnection } from '../../bootstrap/publicBootstrap';
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
  type ContentDesignerReference,
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
  return (
    selectModuleConnection(bootstrap, 'cms', { server: 'wcmsStagedServer' }) ??
    selectModuleConnection(bootstrap, 'cms', { server: 'wcmsServer' })
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

function optionLabel(option: ContentDesignerReference): string {
  return option.name && option.name !== option.code
    ? `${option.name} (${option.code})`
    : option.code;
}

function slotsFromReferences(
  slotOptions: readonly ContentDesignerReference[],
  draftDefaults: ContentDesignerDraftDefaults,
): string {
  const optionNames = slotOptions.map((slot) => slot.name || slot.code).filter(Boolean);
  if (optionNames.length) return optionNames.join('\n');
  return draftDefaults.slots?.length ? draftDefaults.slots.join('\n') : 'body';
}

function componentHint(
  componentIntent: string,
  componentKinds: readonly ContentDesignerComponentKind[],
  componentTypes: readonly ContentDesignerReference[],
): string {
  const kind = selectedComponentKind(componentIntent, componentKinds);
  const type = componentTypes.find((item) => item.code === kind.typeCode);
  const name = type ? optionLabel(type) : kind.typeCode;
  return `Creates ${name} with renderer ${kind.renderer}. You can refine properties after the draft is saved.`;
}

function buildDraft({
  catalogIntent,
  componentIntent,
  componentKinds,
  draftDefaults,
  pageIntent,
  routeIntent,
  selectedLocale,
  siteIntent,
  slotIntent,
  templateIntent,
  supportedLocales,
}: {
  readonly catalogIntent: string;
  readonly componentIntent: string;
  readonly componentKinds: readonly ContentDesignerComponentKind[];
  readonly draftDefaults: ContentDesignerDraftDefaults;
  readonly pageIntent: string;
  readonly routeIntent: string;
  readonly selectedLocale: string;
  readonly siteIntent: string;
  readonly slotIntent: string;
  readonly templateIntent: string;
  readonly supportedLocales: readonly string[];
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
                trackingId: `${pageCode}-${slot}`,
              }),
              localizations: Object.freeze(
                supportedLocales.map((locale) =>
                  Object.freeze({
                    locale,
                    status: 'DRAFT',
                    properties: Object.freeze({
                      title: `${pageCode} ${slot} (${locale})`,
                      body: `Draft ${kind.label.toLowerCase()} content for ${slot} in ${locale}.`,
                    }),
                  }),
                ),
              ),
            }),
          ]),
        }),
      ),
    ),
    route: Object.freeze({
      channel: 'web',
      locale: selectedLocale,
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

function validationSucceeded(
  result: ContentDesignerOperationResult | undefined,
): boolean {
  return result?.valid === true || result?.status === 'VALID_DRAFT';
}

function validationEvidenceText(
  result: ContentDesignerOperationResult | undefined,
): string {
  if (!result) return 'Validate the draft to see backend evidence.';
  const evidence = result.evidence ?? result.saved ?? result;
  try {
    return JSON.stringify(evidence, null, 2);
  } catch {
    return typeof evidence === 'string' ||
      typeof evidence === 'number' ||
      typeof evidence === 'boolean'
      ? String(evidence)
      : 'Validation evidence could not be rendered as text.';
  }
}

function localizedPreviewTitle(
  component: ContentDesignerDraft['sections'][number]['components'][number] | undefined,
  locale: string,
): string {
  const value = component?.localizations?.find(
    (localization) => localization.locale === locale,
  )?.properties.title;
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : 'missing translation';
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

function DraftPreview({
  draft,
  locale,
}: {
  readonly draft: ContentDesignerDraft;
  readonly locale: string;
}) {
  return (
    <Stack dir={locale.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr'} spacing={1.5}>
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
            <Typography color="text.secondary" variant="body2">
              Locale {locale}: {localizedPreviewTitle(section.components[0], locale)}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

function ValidationEvidencePanel({
  draftIsValidated,
  result,
}: {
  readonly draftIsValidated: boolean;
  readonly result: ContentDesignerOperationResult | undefined;
}) {
  if (!result) {
    return (
      <Alert severity="info">
        Validate first. Save will unlock only after WCMS confirms this exact draft.
      </Alert>
    );
  }
  return (
    <Stack spacing={1.5}>
      <Alert severity={draftIsValidated ? 'success' : 'warning'}>
        {draftIsValidated
          ? 'This draft is validated and ready to save.'
          : 'The draft changed after validation. Revalidate before saving.'}
      </Alert>
      <Box
        component="pre"
        sx={{
          bgcolor: alpha(axisTokens.color.charcoal[900], 0.04),
          border: 1,
          borderColor: 'divider',
          borderRadius: axisTokens.radius.medium,
          color: 'text.secondary',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12,
          maxHeight: 220,
          overflow: 'auto',
          p: 1.5,
          whiteSpace: 'pre-wrap',
        }}
      >
        {validationEvidenceText(result)}
      </Box>
    </Stack>
  );
}

function BackendGuidancePanel({
  mediaFolders,
  mediaTypes,
  navigationNodes,
  publicationParts,
}: {
  readonly mediaFolders: readonly ContentDesignerReference[];
  readonly mediaTypes: readonly string[];
  readonly navigationNodes: readonly ContentDesignerReference[];
  readonly publicationParts: readonly string[];
}) {
  return (
    <Alert severity="info" variant="outlined">
      <Stack spacing={1}>
        <Typography sx={{ fontWeight: 800 }} variant="body2">
          Helpful backend hints
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Chip
            label={
              mediaFolders.length
                ? `${String(mediaFolders.length)} media folders available`
                : 'Media folders not loaded yet'
            }
            size="small"
          />
          <Chip
            label={
              mediaTypes.length
                ? `Media types: ${mediaTypes.slice(0, 4).join(', ')}`
                : 'Media types pending'
            }
            size="small"
          />
          <Chip
            label={
              navigationNodes.length
                ? `${String(navigationNodes.length)} navigation parents`
                : 'Navigation parents optional'
            }
            size="small"
          />
        </Stack>
        <Typography color="text.secondary" variant="body2">
          Save will create only the draft records. Publishing still checks:{' '}
          {publicationParts.length ? publicationParts.join(', ') : 'WCMS readiness'}.
        </Typography>
      </Stack>
    </Alert>
  );
}

export function ContentDesignerRoutePage({
  accessToken,
  bootstrap,
  routeNavigation,
  runtime,
}: ContentDesignerRoutePageProps) {
  const [catalogIntent, setCatalogIntent] = useState('');
  const [siteIntent, setSiteIntent] = useState('');
  const [templateIntent, setTemplateIntent] = useState('');
  const [pageIntent, setPageIntent] = useState('home');
  const [slotIntent, setSlotIntent] = useState('');
  const [routeIntent, setRouteIntent] = useState('');
  const [componentIntent, setComponentIntent] = useState(
    selectedComponentKind('Hero banner', fallbackComponentKinds).label,
  );
  const [selectedLocale, setSelectedLocale] = useState('en');
  const [validatedDraftSignature, setValidatedDraftSignature] = useState('');
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
  const effectiveCatalogIntent =
    catalogIntent || draftDefaults.catalogCode || 'contentCatalog';
  const effectiveTemplateIntent =
    templateIntent || draftDefaults.templateCode || 'pageTemplate';
  const metadata = authoringModel.data?.metadata;
  const supportedLocales = metadata?.localization.supportedLocales.length
    ? metadata.localization.supportedLocales
    : Object.freeze(['en', 'ar']);
  const catalogOptions = metadata?.contentCatalogs ?? [];
  const siteOptions = useMemo(
    () =>
      (metadata?.sites ?? []).filter(
        (site) =>
          !effectiveCatalogIntent ||
          !site.catalogCode ||
          site.catalogCode === effectiveCatalogIntent,
      ),
    [effectiveCatalogIntent, metadata?.sites],
  );
  const effectiveSiteIntent =
    siteIntent ||
    (siteOptions.some((site) => site.code === draftDefaults.siteCode)
      ? draftDefaults.siteCode
      : siteOptions[0]?.code) ||
    'contentSite';
  const templateOptions = metadata?.pageTemplates ?? [];
  const slotOptions = useMemo(
    () =>
      (metadata?.slotDefinitions ?? []).filter(
        (slot) =>
          !effectiveTemplateIntent ||
          !slot.templateCode ||
          slot.templateCode === effectiveTemplateIntent,
      ),
    [effectiveTemplateIntent, metadata?.slotDefinitions],
  );
  const slotOptionNames = slotOptions.map((slot) => slot.name || slot.code);
  const effectiveSlotIntent =
    slotIntent || slotsFromReferences(slotOptions, draftDefaults);
  const effectiveRouteIntent = routeIntent || draftDefaults.routePath || '/docs/home';
  const componentTypeOptions = metadata?.componentTypes ?? [];
  const mediaFolderOptions = metadata?.mediaFolders ?? [];
  const mediaTypeOptions = metadata?.mediaTypes ?? [];
  const navigationNodeOptions = metadata?.navigationNodes ?? [];
  const publicationParts =
    metadata?.publicationReadiness.requiredDraftParts ?? Object.freeze([]);
  const draft = useMemo(
    () =>
      buildDraft({
        catalogIntent: effectiveCatalogIntent,
        componentIntent,
        componentKinds,
        draftDefaults,
        pageIntent,
        routeIntent: effectiveRouteIntent,
        selectedLocale,
        siteIntent: effectiveSiteIntent,
        slotIntent: effectiveSlotIntent,
        templateIntent: effectiveTemplateIntent,
        supportedLocales,
      }),
    [
      componentIntent,
      componentKinds,
      draftDefaults,
      effectiveCatalogIntent,
      effectiveRouteIntent,
      effectiveSiteIntent,
      effectiveSlotIntent,
      effectiveTemplateIntent,
      pageIntent,
      selectedLocale,
      supportedLocales,
    ],
  );
  const draftSignature = useMemo(() => JSON.stringify(draft), [draft]);

  const validateMutation = useMutation({
    mutationFn: () => {
      if (!designerConnection) throw new Error('CMS connection is not available');
      return validateContentDesignerDraft(designerConnection, configuration, draft);
    },
    onSuccess: (result) => {
      if (validationSucceeded(result)) setValidatedDraftSignature(draftSignature);
    },
  });
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!designerConnection) throw new Error('CMS connection is not available');
      return saveContentDesignerDraft(designerConnection, configuration, draft);
    },
  });
  const draftIsValidated =
    validatedDraftSignature === draftSignature &&
    validationSucceeded(validateMutation.data);
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
              <BackendGuidancePanel
                mediaFolders={mediaFolderOptions}
                mediaTypes={mediaTypeOptions}
                navigationNodes={navigationNodeOptions}
                publicationParts={publicationParts}
              />
              <Divider />
              <Alert severity="success" variant="outlined">
                Start with the fields below. Axis has already loaded the safest backend
                defaults it can find; you only need to change what is different for this
                page.
              </Alert>
              <TextField
                helperText={
                  catalogOptions.length
                    ? 'Choose the content boundary first. Sites are filtered by this catalog.'
                    : 'Type the content catalog code when WCMS metadata is unavailable.'
                }
                label="Content Catalog"
                onChange={(event) => {
                  setCatalogIntent(event.target.value);
                  setSiteIntent('');
                }}
                select={catalogOptions.length > 0}
                value={effectiveCatalogIntent}
              >
                {catalogOptions.map((catalog) => (
                  <MenuItem key={catalog.code} value={catalog.code}>
                    {optionLabel(catalog)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                helperText={
                  siteOptions.length
                    ? 'Only sites available for the selected catalog are shown.'
                    : 'Type the site code when WCMS metadata is unavailable.'
                }
                label="Site intent"
                onChange={(event) => setSiteIntent(event.target.value)}
                select={siteOptions.length > 0}
                value={effectiveSiteIntent}
              >
                {siteOptions.map((site) => (
                  <MenuItem key={site.code} value={site.code}>
                    {optionLabel(site)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                helperText={
                  templateOptions.length
                    ? 'Selecting a template updates the suggested slot list below.'
                    : 'Type the page template code when WCMS metadata is unavailable.'
                }
                label="Template intent"
                onChange={(event) => {
                  setTemplateIntent(event.target.value);
                  setSlotIntent('');
                }}
                select={templateOptions.length > 0}
                value={effectiveTemplateIntent}
              >
                {templateOptions.map((template) => (
                  <MenuItem key={template.code} value={template.code}>
                    {optionLabel(template)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                helperText="Friendly page code. Axis generates a readable name and route preview from it."
                label="Page intent"
                onChange={(event) => setPageIntent(event.target.value)}
                value={pageIntent}
              />
              <TextField
                helperText={
                  slotOptionNames.length
                    ? `One slot per line or comma. Selected template exposes: ${slotOptionNames.join(', ')}.`
                    : 'One slot per line or comma. Designer supports any template-defined slots.'
                }
                label="Template slots"
                minRows={3}
                multiline
                onChange={(event) => setSlotIntent(event.target.value)}
                value={effectiveSlotIntent}
              />
              <TextField
                helperText="Use a clean URL. If you omit the leading slash, Axis adds it for you."
                label="Route intent"
                onChange={(event) => setRouteIntent(event.target.value)}
                value={effectiveRouteIntent}
              />
              <TextField
                helperText={componentHint(
                  componentIntent,
                  componentKinds,
                  componentTypeOptions,
                )}
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
              <Stack spacing={1}>
                <Typography sx={{ fontWeight: 700 }}>Authoring language</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {supportedLocales.map((locale) => (
                    <Button
                      aria-pressed={selectedLocale === locale}
                      key={locale}
                      onClick={() => setSelectedLocale(locale)}
                      size="small"
                      variant={selectedLocale === locale ? 'contained' : 'outlined'}
                    >
                      {locale}
                    </Button>
                  ))}
                </Stack>
                <Typography color="text.secondary" variant="body2">
                  One component identity; locale variants are saved separately. Preview
                  direction follows the selected language.
                </Typography>
              </Stack>
              <Divider />
              <DraftPreview draft={draft} locale={selectedLocale} />
              <ValidationEvidencePanel
                draftIsValidated={draftIsValidated}
                result={validateMutation.data}
              />
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
                  disabled={
                    !designerConnection || !draftIsValidated || saveMutation.isPending
                  }
                  onClick={() => saveMutation.mutate()}
                  variant="outlined"
                >
                  Save draft
                </Button>
                <Button
                  disabled={!authoringModel.data}
                  onClick={() => {
                    setCatalogIntent('');
                    setSiteIntent('');
                    setTemplateIntent('');
                    setSlotIntent('');
                    setRouteIntent('');
                    setComponentIntent(componentKinds[0]?.label ?? 'Hero banner');
                  }}
                  variant="text"
                >
                  Reset defaults
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
