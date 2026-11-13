import { useContentDesignerCopy } from './contentDesignerCopy';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NavigationAvailabilityRecoveryContext } from '../../bootstrap/useNavigationAvailabilityRecovery';
import { Link as RouterLink } from 'react-router';

import { axisTokens } from '../../app/axisTheme';
import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { useUnsavedNavigationGuard } from '../../app/useUnsavedNavigationGuard';
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
  submitContentDesignerDraftForPublication,
  validateContentDesignerDraft,
  type ContentDesignerAuthoringModel,
  type ContentDesignerComponentKind,
  type ContentDesignerDraft,
  type ContentDesignerDraftDefaults,
  type ContentDesignerOperationResult,
  type ContentDesignerReference,
} from './api/contentDesignerClient';
import { ContentDesignerRetirementPanel } from './ContentDesignerRetirementPanel';
import { ContentDesignerContentEditor } from './ContentDesignerContentEditor';
import { ContentDesignerSavedPagePanel } from './ContentDesignerSavedPagePanel';
import { ContentDesignerFailedSaveInspection } from './ContentDesignerFailedSaveInspection';
import {
  buildDesignerComponentContent,
  designerContentKey,
  designerLanguageReviewSignature,
  type DesignerContentValues,
} from './contentDesignerContentModel';

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

interface DraftCommand {
  readonly draft: ContentDesignerDraft;
  readonly signature: string;
  readonly scope: string;
  readonly sourceServer?: string | undefined;
  readonly sourceEnvironment?: string | undefined;
}
type SavedPageSelection = Readonly<{
  catalogCode: string;
  siteCode: string;
  pageCode: string;
}>;

/** Creation attempts bind to the exact owner scope and page identity, independently of later form edits. */
function creationIdentity(scope: string, draft: ContentDesignerDraft): string {
  return JSON.stringify([scope, draft.catalogCode, draft.siteCode, draft.page.code]);
}

const designerMetrics: readonly WorkbenchMetricDefinition[] = Object.freeze([
  Object.freeze({
    id: 'catalogs',
    label: 'Content catalogs',
    moduleName: 'catalog',
    schemaName: 'catalog',
    ownerSelector: { runtimeRoleCode: 'WCMS_STAGED', publicationRole: 'STAGED' },
    description: 'Catalog containers that sit above sites, templates, and pages.',
    route: '/content/catalogs',
    icon: 'catalog',
  }),
  Object.freeze({
    id: 'sites',
    label: 'Sites',
    moduleName: 'cms',
    schemaName: 'cmsSite',
    ownerSelector: { runtimeRoleCode: 'WCMS_STAGED', publicationRole: 'STAGED' },
    description: 'Website containers available for page composition.',
    route: '/content/sites',
    icon: 'storefront',
  }),
  Object.freeze({
    id: 'page-templates',
    label: 'Templates',
    moduleName: 'cms',
    schemaName: 'cmsPageTemplate',
    ownerSelector: { runtimeRoleCode: 'WCMS_STAGED', publicationRole: 'STAGED' },
    description: 'Reusable page structures and allowed dynamic slots.',
    route: '/content/page-templates',
    icon: 'template',
  }),
  Object.freeze({
    id: 'pages',
    label: 'Pages',
    moduleName: 'cms',
    schemaName: 'cmsPage',
    ownerSelector: { runtimeRoleCode: 'WCMS_STAGED', publicationRole: 'STAGED' },
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
    ownerSelector: { runtimeRoleCode: 'WCMS_STAGED', publicationRole: 'STAGED' },
    description: 'Reusable content blocks with text, media, and renderer data.',
    route: '/content/components',
    icon: 'component',
  }),
  Object.freeze({
    id: 'component-media',
    label: 'Media links',
    moduleName: 'cms',
    schemaName: 'cmsComponentMedia',
    ownerSelector: { runtimeRoleCode: 'WCMS_STAGED', publicationRole: 'STAGED' },
    description: 'Governed links from components to media records.',
    route: '/content/component-media',
    icon: 'media',
  }),
  Object.freeze({
    id: 'routes',
    label: 'Routes',
    moduleName: 'cms',
    schemaName: 'cmsPageRoute',
    ownerSelector: { runtimeRoleCode: 'WCMS_STAGED', publicationRole: 'STAGED' },
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

const emptyDraftDefaults: ContentDesignerDraftDefaults = Object.freeze({});
const emptyComponentKinds: readonly ContentDesignerComponentKind[] = Object.freeze([]);

/** Displays a workflow step without exposing a link absent from authorized navigation. */
function DesignerStepCard({
  step,
  index,
  available,
}: {
  readonly index: number;
  readonly step: DesignerStep;
  readonly available: boolean;
}) {
  const { text: designerText } = useContentDesignerCopy();

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
                {designerText('Step')} {String(index + 1)}
              </Typography>
              <Typography component="h3" variant="h6">
                {designerText(step.label)}
              </Typography>
            </Box>
          </Stack>
          <Typography color="text.secondary">
            {designerText(step.description)}
          </Typography>
          {available ? (
            <Button component={RouterLink} to={step.route} variant="outlined">
              {designerText(step.action)}
            </Button>
          ) : (
            <Button disabled variant="outlined">
              {designerText(step.action)}
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Selects only the catalogue-declared authoring role, independent of deployment server names. */
function firstHealthyCmsConnection(
  bootstrap: AxisAuthenticatedBootstrap,
): AxisModuleConnection | undefined {
  return selectModuleConnection(bootstrap, 'cms', {
    runtimeRoleCode: 'WCMS_STAGED',
    publicationRole: 'STAGED',
  });
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
): ContentDesignerComponentKind | undefined {
  const selected = componentKinds.find((kind) => kind.label === label);
  if (selected) return selected;
  return componentKinds[0];
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
  designerText: ReturnType<typeof useContentDesignerCopy>['text'],
): string {
  const kind = selectedComponentKind(componentIntent, componentKinds);
  if (!kind)
    return designerText(
      'No component types are configured for this authoring application.',
    );
  const type = componentTypes.find((item) => item.code === kind.typeCode);
  const name = type ? optionLabel(type) : kind.typeCode;
  return designerText(
    'Enter the content for {name} below. Your changes remain a draft until approved.',
    { name },
  );
}

function buildDraft({
  accessModeIntent,
  catalogIntent,
  componentIntent,
  componentKinds,
  componentContentBySlot,
  draftDefaults,
  pageIntent,
  pageNameIntent,
  routeIntent,
  routeLocale,
  siteIntent,
  slotIntent,
  templateIntent,
}: {
  readonly accessModeIntent: string;
  readonly catalogIntent: string;
  readonly componentIntent: string;
  readonly componentKinds: readonly ContentDesignerComponentKind[];
  readonly componentContentBySlot: Readonly<
    Record<string, ReturnType<typeof buildDesignerComponentContent>>
  >;
  readonly draftDefaults: ContentDesignerDraftDefaults;
  readonly pageIntent: string;
  readonly pageNameIntent: string;
  readonly routeIntent: string;
  readonly routeLocale: string;
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
  const accessMode = safeCode(
    accessModeIntent,
    draftDefaults.accessMode ?? 'AUTHENTICATED',
  ).toUpperCase();
  return Object.freeze({
    catalogCode: safeCode(catalogIntent, draftDefaults.catalogCode ?? ''),
    siteCode: safeCode(siteIntent, draftDefaults.siteCode ?? ''),
    templateCode: safeCode(templateIntent, draftDefaults.templateCode ?? ''),
    page: Object.freeze({
      code: pageCode,
      name:
        pageNameIntent.trim() ||
        pageCode
          .replace(/[-_]+/g, ' ')
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .replace(/^./, (letter) => letter.toUpperCase()) ||
        pageCode,
      renderer: draftDefaults.pageRenderer ?? '',
      typeCode: draftDefaults.pageTypeCode ?? '',
    }),
    sections: Object.freeze(
      slots.map((slot, index) =>
        Object.freeze({
          slot,
          index,
          components: Object.freeze([
            Object.freeze({
              code: `${pageCode}${slot.charAt(0).toUpperCase()}${slot.slice(1)}Component`,
              renderer: kind?.renderer ?? '',
              typeCode: kind?.typeCode ?? '',
              accessMode,
              properties: Object.freeze({
                trackingId: `${pageCode}-${slot}`,
                ...componentContentBySlot[slot]?.properties,
              }),
              localizations:
                componentContentBySlot[slot]?.localizations ?? Object.freeze([]),
            }),
          ]),
        }),
      ),
    ),
    route: Object.freeze({
      accessMode,
      channel: 'web',
      locale: routeLocale,
      path: safeRoute(routeIntent, `/${pageCode}`),
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

function savedVersionMessage(
  result: ContentDesignerOperationResult | undefined,
  designerText: ReturnType<typeof useContentDesignerCopy>['text'],
): string {
  const saved = result?.saved;
  if (!saved || typeof saved !== 'object') {
    return designerText('CMS draft saved as governed Staged records.');
  }
  const text = JSON.stringify(saved);
  const match = text.match(/"versionId"\s*:\s*(\d+)/u);
  return match
    ? designerText('CMS draft saved as immutable Staged version {version}.', {
        version: match[1] ?? '',
      })
    : designerText('CMS draft saved as governed Staged records.');
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
  if (value === undefined) {
    const sharedTitle = component?.properties?.title;
    return typeof sharedTitle === 'string' || typeof sharedTitle === 'number'
      ? String(sharedTitle)
      : 'Heading not entered';
  }
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : 'Heading not entered';
}

function AuthoringContractPanel({
  model,
  isLoading,
  error,
  onRefresh,
  refreshDisabled,
}: {
  readonly error: Error | null;
  readonly onRefresh: () => void;
  readonly refreshDisabled: boolean;
  readonly isLoading: boolean;
  readonly model: ContentDesignerAuthoringModel | undefined;
}) {
  const { text: designerText, formatError } = useContentDesignerCopy();

  if (isLoading) {
    return (
      <Stack spacing={1}>
        <Typography component="h4" variant="h6">
          {designerText('Authoring contract')}
        </Typography>
        <LinearProgress
          aria-label={designerText('Loading CMS Designer authoring contract')}
        />
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack spacing={1}>
        <Alert severity="warning">
          {formatError(error, designerText('Content workspace could not be checked.'))}
          <Typography variant="body2">
            {designerText(
              'Check content access for this enterprise, then retry. Your draft entries remain available.',
            )}
          </Typography>
        </Alert>
        <Button disabled={refreshDisabled} onClick={onRefresh}>
          {designerText('Retry content setup')}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Typography component="h4" variant="h6">
        {designerText('Authoring contract')}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Chip
          color={model?.rules.catalogFirst ? 'success' : 'warning'}
          label={
            model?.rules.catalogFirst
              ? designerText('Catalog first')
              : designerText('Catalog rule unknown')
          }
        />
        <Chip
          color={model?.rules.arbitrarySlots ? 'success' : 'warning'}
          label={
            model?.rules.arbitrarySlots
              ? designerText('Template Slots: any number')
              : designerText('Slot flexibility unknown')
          }
        />
        <Chip
          color={model?.rules.frontendPersistence === false ? 'success' : 'warning'}
          label={
            model?.rules.frontendPersistence === false
              ? designerText('Backend persistence only')
              : designerText('Persistence rule unknown')
          }
        />
      </Stack>
      <Typography color="text.secondary" variant="body2">
        {model?.hierarchy?.length
          ? model.hierarchy.join(' → ')
          : designerText(
              'Content Catalog → Site → Template → Page → Slots → Sections → Components → Media → Route → Navigation',
            )}
      </Typography>
      <Typography color="text.secondary" variant="body2">
        {designerText('Supported operations:')}{' '}
        {model
          ? model.operations.join(', ') || designerText('None')
          : designerText('loading from WCMS')}
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
  const { text: designerText } = useContentDesignerCopy();

  return (
    <Stack dir={locale.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr'} spacing={1.5}>
      <Typography component="h4" variant="h6">
        {designerText('Generated catalog-first preview')}
      </Typography>
      <Stack spacing={0.75}>
        <Typography>
          {designerText('Catalog:')} {draft.catalogCode}
        </Typography>
        <Typography>
          {designerText('Site:')} {draft.siteCode}
        </Typography>
        <Typography>
          {designerText('Template:')} {draft.templateCode}
        </Typography>
        <Typography>
          {designerText('Page:')} {draft.page.code}
        </Typography>
        <Typography>
          {designerText('Route:')} {designerText(draftRoutePath(draft))}
        </Typography>
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
              {designerText('Slot:')} {section.slot} {designerText('· Section')}{' '}
              {String((section.index ?? 0) + 1)}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {designerText('Components:')}{' '}
              {section.components
                .map((component) => `${component.code} (${component.typeCode})`)
                .join(', ')}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {designerText('Locale')} {locale}:{' '}
              {designerText(localizedPreviewTitle(section.components[0], locale))}
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
  const { text: designerText } = useContentDesignerCopy();

  if (!result) {
    return (
      <Alert severity="info">
        {designerText(
          'Validate first. Save will unlock only after WCMS confirms this exact draft.',
        )}
      </Alert>
    );
  }
  return (
    <Stack spacing={1.5}>
      <Alert severity={draftIsValidated ? 'success' : 'warning'}>
        {draftIsValidated
          ? designerText('This draft is validated and ready to save.')
          : designerText(
              'The draft changed after validation. Revalidate before saving.',
            )}
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
        {designerText(validationEvidenceText(result))}
      </Box>
    </Stack>
  );
}

function ContentPublishReadinessPanel({
  draft,
  draftIsSaved,
  draftIsValidated,
  publicationParts,
  routePath,
  slotOptions,
}: {
  readonly draft: ContentDesignerDraft;
  readonly draftIsSaved: boolean;
  readonly draftIsValidated: boolean;
  readonly publicationParts: readonly string[];
  readonly routePath: string;
  readonly slotOptions: readonly ContentDesignerReference[];
}) {
  const { text: designerText } = useContentDesignerCopy();

  const hasTemplateSlotEvidence =
    Boolean(slotOptions.length && draft.sections.length) &&
    draft.sections.every((section) =>
      slotOptions.some((slot) => (slot.name || slot.code) === section.slot),
    );
  const hasComponentEvidence =
    draft.sections.length > 0 &&
    draft.sections.every(
      (section) =>
        section.components.length > 0 &&
        section.components.every((component) => Boolean(component.typeCode)),
    );
  const hasRouteEvidence = routePath.startsWith('/');
  const hasMediaEvidence = draft.sections.some((section) =>
    section.components.some((component) => (component.media ?? []).length > 0),
  );
  const checks = [
    {
      label: designerText('Content workspace readiness'),
      ready: draftIsValidated,
      detail: draftIsValidated
        ? designerText('WCMS validated this exact draft.')
        : designerText('Validate this exact draft before save or submit.'),
    },
    {
      label: designerText('Template dependency'),
      ready: Boolean(draft.templateCode),
      detail: draft.templateCode
        ? designerText('Template {template} is selected for this draft.', {
            template: draft.templateCode,
          })
        : designerText('Select a page template.'),
    },
    {
      label: designerText('Component dependency'),
      ready: hasComponentEvidence,
      detail: hasComponentEvidence
        ? designerText('Every section has a component with a selected type.')
        : designerText('Choose a component type for each section.'),
    },
    {
      label: designerText('Route dependency'),
      ready: hasRouteEvidence,
      detail: hasRouteEvidence
        ? designerText('Web address {route} is browser-addressable.', {
            route: routePath,
          })
        : designerText('Web address must start with a slash.'),
    },
    {
      label: designerText('Media dependency'),
      ready: hasMediaEvidence,
      neutral: true,
      detail: hasMediaEvidence
        ? designerText('Linked assets will be checked by CMS before publication.')
        : designerText(
            'No assets are linked to this draft. CMS checks required media before publication.',
          ),
    },
    {
      label: designerText('Layout-slot dependency'),
      ready: hasTemplateSlotEvidence,
      detail: hasTemplateSlotEvidence
        ? designerText('Draft slots match the selected template.')
        : designerText(
            'Choose a template with defined slots and match each section to a slot.',
          ),
    },
    {
      label: designerText('Preview before submit'),
      ready: draftIsValidated && draftIsSaved,
      detail: draftIsSaved
        ? designerText(
            'Draft preview has been validated and saved before publication submit.',
          )
        : designerText('Save the validated draft before submitting for publication.'),
    },
  ];
  return (
    <Card
      variant="outlined"
      sx={{ bgcolor: 'background.default', borderStyle: 'dashed' }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography component="h4" variant="h6">
              {designerText('CMS publishing readiness and impact')}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {designerText(
                'Validate dependencies before submit. Publishing impact is the saved Staged draft plus route, component, template, media, and layout evidence that approvers should inspect before Online movement.',
              )}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            }}
          >
            {checks.map((check) => (
              <Alert
                key={check.label}
                severity={
                  'neutral' in check ? 'info' : check.ready ? 'success' : 'warning'
                }
              >
                <Typography component="div" variant="subtitle2">
                  {check.label}
                </Typography>
                <Typography component="div" variant="body2">
                  {check.detail}
                </Typography>
              </Alert>
            ))}
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Chip
              label={designerText('Catalog: {catalog}', { catalog: draft.catalogCode })}
              size="small"
            />
            <Chip
              label={designerText('Site: {site}', { site: draft.siteCode })}
              size="small"
              variant="outlined"
            />
            <Chip
              label={designerText('Template: {template}', {
                template: draft.templateCode,
              })}
              size="small"
              variant="outlined"
            />
            <Chip
              label={designerText('Route: {route}', { route: routePath })}
              size="small"
              variant="outlined"
            />
            <Chip
              label={
                publicationParts.length
                  ? designerText('Required parts: {parts}', {
                      parts: publicationParts.join(', '),
                    })
                  : designerText('Required parts: WCMS default')
              }
              size="small"
              variant="outlined"
            />
          </Stack>
          <Alert severity="info">
            {designerText(
              'Approval impact summary: approvers should compare the saved Staged draft, route intent, template slots, components, media references, and target site before approving the publication request.',
            )}
          </Alert>
        </Stack>
      </CardContent>
    </Card>
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
  const { text: designerText } = useContentDesignerCopy();

  return (
    <Alert severity="info" variant="outlined">
      <Stack spacing={1}>
        <Typography sx={{ fontWeight: 800 }} variant="body2">
          {designerText('Content setup notes')}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Chip
            label={
              mediaFolders.length
                ? designerText('{count, number} media folders available', {
                    count: mediaFolders.length,
                  })
                : designerText('Media folders not loaded yet')
            }
            size="small"
          />
          <Chip
            label={
              mediaTypes.length
                ? designerText('Media types: {types}', {
                    types: mediaTypes.slice(0, 4).join(', '),
                  })
                : designerText('Media types pending')
            }
            size="small"
          />
          <Chip
            label={
              navigationNodes.length
                ? designerText('{count, number} navigation parents', {
                    count: navigationNodes.length,
                  })
                : designerText('Navigation parents optional')
            }
            size="small"
          />
        </Stack>
        <Typography color="text.secondary" variant="body2">
          {designerText(
            'Save will create only the draft records. Publishing still checks:',
          )}{' '}
          {publicationParts.length
            ? publicationParts.join(', ')
            : designerText('WCMS readiness')}
          .
        </Typography>
      </Stack>
    </Alert>
  );
}

/** Renders CMS-owned references and commands; bootstrap and the fresh owner model govern executable controls. */
export function ContentDesignerRoutePage({
  accessToken,
  bootstrap,
  routeNavigation,
  runtime,
}: ContentDesignerRoutePageProps) {
  const {
    text: designerText,
    locale: interfaceLocale,
    formatError,
  } = useContentDesignerCopy();

  const availabilityRecovery = useContext(NavigationAvailabilityRecoveryContext);
  const [catalogIntent, setCatalogIntent] = useState('');
  const [siteIntent, setSiteIntent] = useState('');
  const [templateIntent, setTemplateIntent] = useState('');
  const [pageIntent, setPageIntent] = useState('');
  const [pageNameIntent, setPageNameIntent] = useState('');
  const [createdPages, setCreatedPages] = useState<
    ReadonlyMap<string, SavedPageSelection>
  >(new Map());
  const [savedPageHandoff, setSavedPageHandoff] =
    useState<Readonly<{ scope: string; selection: SavedPageSelection }>>();
  const saveAttempts = useRef(new Set<string>());
  const publicationStarted = useRef(false);
  const [publicationHold, setPublicationHold] = useState<DraftCommand>();
  const [slotIntent, setSlotIntent] = useState('');
  const [routeIntent, setRouteIntent] = useState<string | undefined>();
  const [accessModeIntent, setAccessModeIntent] = useState('');
  const [componentIntent, setComponentIntent] = useState('');
  const [selectedLocale, setSelectedLocale] = useState('en');
  const [contentValues, setContentValues] = useState<DesignerContentValues>({});
  const [reviewedLanguages, setReviewedLanguages] = useState<
    Readonly<Record<string, string>>
  >({});
  const [validatedDraftSignature, setValidatedDraftSignature] = useState('');
  const [savedDraftSignature, setSavedDraftSignature] = useState('');
  const [validatedScope, setValidatedScope] = useState('');
  const [savedScope, setSavedScope] = useState('');
  // Opaque cache partition: credentials never enter query keys or request receipts.
  const actorScope = useMemo(
    () =>
      accessToken ? crypto.getRandomValues(new Uint32Array(4)).join('-') : 'anonymous',
    [accessToken],
  );
  const [retirementPending, setRetirementPending] = useState(false);
  const [savedPagePending, setSavedPagePending] = useState(false);
  const [savedPageExpanded, setSavedPageExpanded] = useState(false);
  const [newPageExpanded, setNewPageExpanded] = useState(true);
  const [savedPageVisited, setSavedPageVisited] = useState(false);
  const [failedSave, setFailedSave] = useState<{
    readonly draft: ContentDesignerDraft;
    readonly scope: string;
  }>();
  const [inventoryExpanded, setInventoryExpanded] = useState(false);
  const authorizedNavigation = useMemo(
    () =>
      bootstrap.navigation.filter(
        (item) =>
          ['ACTIVE', 'PREVIEW'].includes(item.featureState ?? 'ACTIVE') &&
          ['UP', 'DEGRADED'].includes(item.availability),
      ),
    [bootstrap],
  );
  // Bootstrap owns navigation admission. A reachable module alone never admits schema reads.
  const permittedMetrics = useMemo(
    () =>
      designerMetrics.filter((metric) =>
        authorizedNavigation.some(
          (item) =>
            item.workbenchTarget?.moduleName === metric.moduleName &&
            item.workbenchTarget.schemaName === metric.schemaName,
        ),
      ),
    [authorizedNavigation],
  );
  const connections = useMemo(
    () =>
      activeConnections(bootstrap).filter((connection) =>
        permittedMetrics.some((metric) => metric.moduleName === connection.moduleName),
      ),
    [bootstrap, permittedMetrics],
  );
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
    enabled: inventoryExpanded && permittedMetrics.length > 0 && connections.length > 0,
    queryKey: [
      'content-designer',
      bootstrap.tenantCode,
      runtime.enterpriseCode,
      connectionKey(connections),
      permittedMetrics.map((metric) => metric.id),
    ],
    queryFn: () =>
      loadWorkbenchMetrics(connections, bootstrap, configuration, permittedMetrics),
  });
  const authoringModel = useQuery({
    enabled: Boolean(designerConnection),
    queryKey: [
      'content-designer-authoring-model',
      actorScope,
      bootstrap.tenantCode,
      runtime.enterpriseCode,
      designerConnection?.instanceId,
      designerConnection?.endpoint,
    ],
    queryFn: () => {
      if (!designerConnection)
        throw new Error(designerText('CMS connection is not available'));
      return loadContentDesignerAuthoringModel(designerConnection, configuration);
    },
  });
  const draftDefaults =
    authoringModel.data?.defaults.draftDefaults ?? emptyDraftDefaults;
  const metadata = authoringModel.data?.metadata;
  const catalogOptions = metadata?.contentCatalogs ?? [];
  // Deployment defaults suggest a choice only when the current scoped owner admits it.
  const suggestedCatalog = catalogIntent || draftDefaults.catalogCode || '';
  const effectiveCatalogIntent = catalogOptions.some(
    (catalog) => catalog.code === suggestedCatalog,
  )
    ? suggestedCatalog
    : catalogOptions.length === 1
      ? (catalogOptions[0]?.code ?? '')
      : '';
  const componentTypeOptions = Object.freeze(
    (metadata?.componentTypes ?? []).filter(
      (type) => !type.catalogCode || type.catalogCode === effectiveCatalogIntent,
    ),
  );
  const componentKinds = Object.freeze(
    (authoringModel.data?.defaults.componentKinds ?? emptyComponentKinds).filter(
      (kind) => componentTypeOptions.some((type) => type.code === kind.typeCode),
    ),
  );
  const effectiveComponentIntent = componentKinds.some(
    (kind) => kind.label === componentIntent,
  )
    ? componentIntent
    : componentKinds[0]?.label || '';
  const supportedLocales = metadata?.localization.supportedLocales.length
    ? metadata.localization.supportedLocales
    : Object.freeze(['en', 'ar']);
  const siteOptions = useMemo(
    () =>
      (metadata?.sites ?? []).filter(
        (site) =>
          Boolean(effectiveCatalogIntent) &&
          (!site.catalogCode || site.catalogCode === effectiveCatalogIntent),
      ),
    [effectiveCatalogIntent, metadata?.sites],
  );
  const effectiveSiteIntent =
    (siteOptions.some((site) => site.code === siteIntent) ? siteIntent : '') ||
    (siteOptions.some((site) => site.code === draftDefaults.siteCode)
      ? draftDefaults.siteCode
      : siteOptions[0]?.code) ||
    '';
  const templateOptions = Object.freeze(
    (metadata?.pageTemplates ?? []).filter(
      (template) =>
        Boolean(effectiveCatalogIntent) &&
        (!template.catalogCode || template.catalogCode === effectiveCatalogIntent),
    ),
  );
  const effectiveTemplateIntent = templateOptions.some(
    (template) => template.code === templateIntent,
  )
    ? templateIntent
    : templateOptions.some((template) => template.code === draftDefaults.templateCode)
      ? draftDefaults.templateCode!
      : templateOptions[0]?.code || '';
  const selectedTemplate = templateOptions.find(
    (template) => template.code === effectiveTemplateIntent,
  );
  const templateDraftDefaults = {
    ...draftDefaults,
    catalogCode: effectiveCatalogIntent,
    siteCode: effectiveSiteIntent,
    templateCode: effectiveTemplateIntent,
    pageRenderer: draftDefaults.pageRenderer,
    pageTypeCode: selectedTemplate?.typeCode ?? draftDefaults.pageTypeCode,
  };
  const slotOptions = (metadata?.slotDefinitions ?? []).filter(
    (slot) =>
      (!slot.catalogCode || slot.catalogCode === effectiveCatalogIntent) &&
      (!effectiveTemplateIntent ||
        !slot.templateCode ||
        slot.templateCode === effectiveTemplateIntent),
  );
  const slotOptionNames = slotOptions.map((slot) => slot.name || slot.code);
  const effectiveSlotIntent =
    slotIntent || slotsFromReferences(slotOptions, draftDefaults);
  const effectiveRouteIntent =
    routeIntent ??
    (draftDefaults.routePath || (pageIntent ? `/${safeCode(pageIntent, '')}` : ''));
  const pageCodeValid = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(pageIntent);
  const effectiveAccessModeIntent = (
    accessModeIntent ||
    draftDefaults.accessMode ||
    'AUTHENTICATED'
  ).toUpperCase();
  const mediaFolderOptions = metadata?.mediaFolders ?? [];
  const mediaTypeOptions = metadata?.mediaTypes ?? [];
  const navigationNodeOptions = metadata?.navigationNodes ?? [];
  const publicationParts =
    metadata?.publicationReadiness.requiredDraftParts ?? Object.freeze([]);
  const activeContentKind = selectedComponentKind(
    effectiveComponentIntent,
    componentKinds,
  );
  const contentFields = activeContentKind?.fields ?? [];
  const contentPropertySchema = componentTypeOptions.find(
    (type) => type.code === activeContentKind?.typeCode,
  )?.propertySchema;
  const defaultContentLocale = metadata?.localization.defaultLocale ?? 'en';
  const contentScope = JSON.stringify([
    bootstrap.tenantCode,
    runtime.enterpriseCode,
    effectiveCatalogIntent,
    effectiveSiteIntent,
    effectiveTemplateIntent,
    activeContentKind?.typeCode,
  ]);
  const contentSlots = parseSlots(
    effectiveSlotIntent ||
      (templateDraftDefaults.slots?.length
        ? templateDraftDefaults.slots.join('\n')
        : 'body'),
  );
  const componentContentBySlot = Object.fromEntries(
    contentSlots.map((slot) => [
      slot,
      buildDesignerComponentContent({
        scope: contentScope,
        slot,
        fields: contentFields,
        propertySchema: contentPropertySchema,
        defaultLocale: defaultContentLocale,
        supportedLocales,
        values: contentValues,
        reviewedLanguages,
        slotsForReview: contentSlots,
      }),
    ]),
  );
  const contentComplete = contentSlots.every(
    (slot) => componentContentBySlot[slot]?.complete,
  );
  const draft = buildDraft({
    accessModeIntent: effectiveAccessModeIntent,
    catalogIntent: effectiveCatalogIntent,
    componentIntent: effectiveComponentIntent,
    componentKinds,
    componentContentBySlot,
    draftDefaults: templateDraftDefaults,
    pageIntent,
    pageNameIntent,
    routeIntent: effectiveRouteIntent,
    routeLocale: metadata?.localization.routeLocale ?? defaultContentLocale,
    siteIntent: effectiveSiteIntent,
    slotIntent: effectiveSlotIntent,
    templateIntent: effectiveTemplateIntent,
  });
  const translationsReady = draft.sections.every((section) =>
    section.components.every((component) =>
      (component.localizations ?? []).every(
        (localization) => localization.status === 'READY',
      ),
    ),
  );
  const selectedLanguageHasContent = draft.sections.some((section) =>
    section.components.some((component) =>
      component.localizations?.some(
        (localization) => localization.locale === selectedLocale,
      ),
    ),
  );
  const selectedLanguageReviewed =
    reviewedLanguages[designerContentKey(contentScope, '*', selectedLocale)] ===
    designerLanguageReviewSignature(
      contentScope,
      contentSlots,
      selectedLocale,
      contentValues,
    );
  const authoringReady = Boolean(
    authoringModel.data &&
    (!authoringModel.data.presentation || pageNameIntent.trim()) &&
    pageCodeValid &&
    effectiveRouteIntent.trim() &&
    componentKinds.length &&
    contentComplete &&
    draft.catalogCode &&
    draft.siteCode &&
    draft.templateCode &&
    draft.page.typeCode &&
    draft.page.renderer,
  );
  const draftSignature = JSON.stringify(draft);
  const hasUnsavedNewPage =
    Boolean(
      pageIntent || pageNameIntent || routeIntent || Object.keys(contentValues).length,
    ) && savedDraftSignature !== draftSignature;
  useUnsavedNavigationGuard(hasUnsavedNewPage || savedPagePending);
  useEffect(() => {
    if (!hasUnsavedNewPage && !savedPagePending) return;
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectDraft);
    return () => window.removeEventListener('beforeunload', protectDraft);
  }, [hasUnsavedNewPage, savedPagePending]);
  const permittedOperations =
    designerConnection && authoringModel.isSuccess && !authoringModel.isFetching
      ? authoringModel.data.operations
      : [];
  const canValidate = permittedOperations.includes('validateDraftComposition');
  const canSave = permittedOperations.includes('saveDraftComposition');
  const canSubmit = permittedOperations.includes('submitForPublication');

  const operationScope = JSON.stringify([
    actorScope,
    bootstrap.tenantCode,
    runtime.enterpriseCode,
    designerConnection?.instanceId,
    designerConnection?.endpoint,
  ]);
  const pageIdentity = creationIdentity(operationScope, draft);
  const createdPage = createdPages.get(pageIdentity);
  const currentSavedPageHandoff =
    savedPageHandoff?.scope === operationScope ? savedPageHandoff.selection : undefined;
  const currentPublicationHold =
    publicationHold?.scope === operationScope ? publicationHold : undefined;
  const presentationSource = authoringModel.data?.presentation;
  const presentation = presentationSource
    ? {
        ...presentationSource,
        newPageTitle: designerText(presentationSource.newPageTitle),
        pageNameLabel: designerText(presentationSource.pageNameLabel),
        pageNameHelp: designerText(presentationSource.pageNameHelp),
        createdMessage: designerText(presentationSource.createdMessage),
        continueLabel: designerText(presentationSource.continueLabel),
        knownSavedMessage: designerText(presentationSource.knownSavedMessage),
        changedAfterCreationMessage: designerText(
          presentationSource.changedAfterCreationMessage,
        ),
        publicationUnconfirmedMessage: designerText(
          presentationSource.publicationUnconfirmedMessage,
        ),
      }
    : undefined;
  const canReopen = permittedOperations.includes('getDraftComposition');
  const command: DraftCommand = {
    draft,
    signature: draftSignature,
    scope: operationScope,
    sourceServer: designerConnection?.server,
    sourceEnvironment: designerConnection?.environment,
  };
  const validateMutation = useMutation({
    mutationFn: (input: DraftCommand) => {
      if (
        !canValidate ||
        retirementPending ||
        savedPagePending ||
        failedSave ||
        publicationHold ||
        createdPage
      )
        throw new Error(designerText('CMS did not authorize this operation'));
      if (!designerConnection || !authoringReady || input.scope !== operationScope)
        throw new Error(
          designerText(
            'Choose the configured authoring references before validating a draft',
          ),
        );
      return validateContentDesignerDraft(
        designerConnection,
        configuration,
        input.draft,
      );
    },
    onSuccess: (result, input) => {
      if (validationSucceeded(result)) {
        setValidatedDraftSignature(input.signature);
        setValidatedScope(input.scope);
      }
    },
  });
  const saveMutation = useMutation({
    mutationFn: (input: DraftCommand) => {
      if (
        !canSave ||
        retirementPending ||
        savedPagePending ||
        failedSave ||
        publicationHold ||
        createdPages.has(creationIdentity(input.scope, input.draft)) ||
        input.scope !== operationScope
      )
        throw new Error(designerText('CMS did not authorize this operation'));
      if (!designerConnection)
        throw new Error(designerText('CMS connection is not available'));
      return saveContentDesignerDraft(designerConnection, configuration, input.draft);
    },
    onSuccess: (_result, input) => {
      setSavedDraftSignature(input.signature);
      setSavedScope(input.scope);
      setCreatedPages((previous) =>
        new Map(previous).set(creationIdentity(input.scope, input.draft), {
          catalogCode: input.draft.catalogCode,
          siteCode: input.draft.siteCode,
          pageCode: input.draft.page.code,
        }),
      );
    },
    onError: (_error, input) =>
      setFailedSave({ draft: input.draft, scope: input.scope }),
  });
  const submitPublicationMutation = useMutation({
    mutationFn: (input: DraftCommand) => {
      if (
        !canSubmit ||
        retirementPending ||
        savedPagePending ||
        failedSave ||
        canReopen ||
        input.scope !== operationScope
      )
        throw new Error(designerText('CMS did not authorize this operation'));
      if (!designerConnection)
        throw new Error(designerText('CMS connection is not available'));
      return submitContentDesignerDraftForPublication(
        designerConnection,
        configuration,
        input.draft,
      );
    },
  });
  const draftIsValidated =
    authoringReady &&
    validatedScope === operationScope &&
    validatedDraftSignature === draftSignature &&
    validationSucceeded(validateMutation.data);
  const draftIsSaved =
    authoringReady &&
    savedScope === operationScope &&
    savedDraftSignature === draftSignature &&
    Boolean(saveMutation.data);
  const submittedPublication =
    submitPublicationMutation.variables?.scope === operationScope
      ? submitPublicationMutation.data?.publication
      : undefined;
  const requestInspectionPath =
    submittedPublication || currentPublicationHold
      ? '/publishing/requests?' +
        new URLSearchParams({
          ...(submittedPublication
            ? { publicationCode: submittedPublication.code }
            : {}),
          sourceServer:
            currentPublicationHold?.sourceServer ??
            submitPublicationMutation.variables?.sourceServer ??
            '',
          sourceEnvironment:
            currentPublicationHold?.sourceEnvironment ??
            submitPublicationMutation.variables?.sourceEnvironment ??
            '',
        }).toString()
      : undefined;
  const metrics = metricsById(data.data, permittedMetrics);
  const operationError =
    validateMutation.error instanceof Error
      ? validateMutation.error
      : saveMutation.error instanceof Error
        ? saveMutation.error
        : submitPublicationMutation.error instanceof Error
          ? submitPublicationMutation.error
          : undefined;

  return (
    <WorkspaceContainer>
      <Stack spacing={dashboardComponentGap}>
        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: dashboardCardPadding }}
        >
          <WorkspaceHeading
            description={designerText(
              'Create pages, arrange content, and review drafts before publishing.',
            )}
            help={routeNavigation?.help}
            headingVariant="h3"
            title={designerText(routeNavigation?.label || 'Content Designer')}
          />
        </Paper>

        {designerConnection &&
        authoringModel.data &&
        authoringModel.data.operations.includes('getDraftComposition') ? (
          <Accordion
            expanded={savedPageExpanded}
            onChange={(_event, expanded) => {
              setSavedPageExpanded(expanded);
              if (expanded) {
                setSavedPageVisited(true);
                setNewPageExpanded(false);
              }
            }}
            slotProps={{ heading: { component: 'h2' } }}
            disableGutters
            elevation={0}
            sx={{ border: 1, borderColor: 'divider' }}
          >
            <AccordionSummary
              id="designer-1-heading"
              aria-controls="designer-1-panel"
              expandIcon={<ShellIcon name="chevron-down" />}
            >
              <Typography component="span" variant="h5">
                {designerText('Open an existing page')}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {savedPageVisited ? (
                <ContentDesignerSavedPagePanel
                  key={JSON.stringify([operationScope, currentSavedPageHandoff])}
                  initialSelection={currentSavedPageHandoff}
                  cachePartition={operationScope}
                  connection={designerConnection}
                  configuration={configuration}
                  mediaConnection={selectModuleConnection(bootstrap, 'media', {
                    runtimeRoleCode: 'WCMS_STAGED',
                    publicationRole: 'STAGED',
                  })}
                  canInspectPublishing={authorizedNavigation.some(
                    (item) => item.route === '/publishing/requests',
                  )}
                  model={{ ...authoringModel.data, operations: permittedOperations }}
                  disabled={
                    retirementPending ||
                    validateMutation.isPending ||
                    saveMutation.isPending ||
                    submitPublicationMutation.isPending
                  }
                  onPendingChange={setSavedPagePending}
                />
              ) : null}
            </AccordionDetails>
          </Accordion>
        ) : null}

        {savedPagePending && !savedPageExpanded ? (
          <Alert severity="info">
            {designerText(
              'An existing page has local changes or a command awaiting inspection. Open the existing-page panel to continue.',
            )}
          </Alert>
        ) : null}

        <Accordion
          expanded={newPageExpanded}
          onChange={(_event, expanded) => {
            setNewPageExpanded(expanded);
            if (expanded) setSavedPageExpanded(false);
          }}
          disableGutters
          elevation={0}
          slotProps={{ heading: { component: 'h2' } }}
          sx={{ border: 1, borderColor: 'divider' }}
        >
          <AccordionSummary
            id="designer-2-heading"
            aria-controls="designer-2-panel"
            expandIcon={<ShellIcon name="chevron-down" />}
          >
            <Typography component="span" variant="h5">
              {presentation?.newPageTitle || designerText('Page draft')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Paper component="section" elevation={0} sx={{ p: { xs: 0, md: 1 } }}>
              <Box
                sx={{
                  display: 'grid',
                  gap: dashboardContentGap,
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    lg: 'repeat(2, minmax(0, 1fr))',
                  },
                  '& > *': { minWidth: 0 },
                  '& > :not(.MuiFormControl-root)': { gridColumn: '1 / -1' },
                }}
              >
                <Box>
                  <Typography color="text.secondary">
                    {designerText(
                      'Choose a website, add your page content, then validate and save.',
                    )}
                  </Typography>
                </Box>
                {!designerConnection ? (
                  <Alert severity="warning">
                    {designerText(
                      'The content authoring workspace is currently unavailable. Your page entries remain here while availability is refreshed.',
                    )}{' '}
                    {availabilityRecovery ? (
                      <Button
                        disabled={availabilityRecovery.refreshing}
                        onClick={availabilityRecovery.refresh}
                      >
                        {designerText('Refresh workspace availability')}
                      </Button>
                    ) : null}
                  </Alert>
                ) : null}
                <Button
                  disabled={!designerConnection || authoringModel.isFetching}
                  onClick={() => void authoringModel.refetch()}
                >
                  {designerText('Refresh content setup')}
                </Button>
                {authoringModel.isError || authoringModel.isLoading ? (
                  <AuthoringContractPanel
                    error={
                      authoringModel.error instanceof Error
                        ? authoringModel.error
                        : null
                    }
                    isLoading={authoringModel.isLoading}
                    model={authoringModel.data}
                    onRefresh={() => void authoringModel.refetch()}
                    refreshDisabled={!designerConnection || authoringModel.isFetching}
                  />
                ) : (
                  <Accordion disableGutters elevation={0}>
                    <AccordionSummary
                      id="designer-3-heading"
                      aria-controls="designer-3-panel"
                      expandIcon={<ShellIcon name="chevron-down" />}
                    >
                      <Typography>{designerText('Content setup details')}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <AuthoringContractPanel
                        error={null}
                        isLoading={authoringModel.isLoading}
                        model={authoringModel.data}
                        onRefresh={() => void authoringModel.refetch()}
                        refreshDisabled={
                          !designerConnection || authoringModel.isFetching
                        }
                      />
                      <BackendGuidancePanel
                        mediaFolders={mediaFolderOptions}
                        mediaTypes={mediaTypeOptions}
                        navigationNodes={navigationNodeOptions}
                        publicationParts={publicationParts}
                      />
                    </AccordionDetails>
                  </Accordion>
                )}
                <Divider />
                <Alert severity="info" variant="outlined">
                  {authoringModel.isSuccess &&
                  catalogOptions.length &&
                  siteOptions.length &&
                  componentKinds.length
                    ? designerText(
                        'Choose your website and template, then enter the page details. Validate the complete draft before saving.',
                      )
                    : !designerConnection
                      ? designerText(
                          'Content setup can be checked after the authoring workspace reconnects.',
                        )
                      : designerText(
                          'Content setup is incomplete. An editable website, template, and component types are required for this enterprise before a draft can be validated.',
                        )}
                </Alert>
                <Alert severity="info" variant="outlined">
                  {designerText(
                    'Saving creates a draft version. Submit the saved version for approval when it is ready to publish.',
                  )}
                </Alert>
                <TextField
                  helperText={
                    catalogOptions.length
                      ? designerText(
                          'Choose the content boundary first. Sites are filtered by this catalog.',
                        )
                      : undefined
                  }
                  label={designerText('Content Catalog')}
                  onChange={(event) => {
                    setCatalogIntent(event.target.value);
                    setSiteIntent('');
                  }}
                  disabled={catalogOptions.length === 0}
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
                      ? designerText(
                          'Only sites available for the selected catalog are shown.',
                        )
                      : undefined
                  }
                  label={designerText('Website')}
                  onChange={(event) => setSiteIntent(event.target.value)}
                  disabled={siteOptions.length === 0}
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
                      ? designerText(
                          'Selecting a template updates the suggested slot list below.',
                        )
                      : undefined
                  }
                  label={designerText('Page template')}
                  onChange={(event) => {
                    setTemplateIntent(event.target.value);
                    setSlotIntent('');
                  }}
                  disabled={templateOptions.length === 0}
                  select={templateOptions.length > 0}
                  value={effectiveTemplateIntent}
                >
                  {templateOptions.map((template) => (
                    <MenuItem key={template.code} value={template.code}>
                      {optionLabel(template)}
                    </MenuItem>
                  ))}
                </TextField>
                {presentation ? (
                  <TextField
                    label={presentation.pageNameLabel}
                    helperText={presentation.pageNameHelp}
                    required
                    value={pageNameIntent}
                    onChange={(event) => setPageNameIntent(event.target.value)}
                  />
                ) : null}
                <TextField
                  helperText={
                    pageIntent && !pageCodeValid
                      ? designerText(
                          'Use up to 128 letters, numbers, hyphens or underscores, starting with a letter or number.',
                        )
                      : designerText(
                          'Enter a unique page code. The web address is suggested from this code.',
                        )
                  }
                  error={Boolean(pageIntent) && !pageCodeValid}
                  required
                  slotProps={{ htmlInput: { maxLength: 128 } }}
                  label={designerText('Page code')}
                  onChange={(event) => setPageIntent(event.target.value)}
                  value={pageIntent}
                />
                <TextField
                  helperText={
                    slotOptionNames.length
                      ? designerText(
                          'One slot per line or comma. Selected template exposes: {slots}.',
                          { slots: slotOptionNames.join(', ') },
                        )
                      : designerText(
                          'One slot per line or comma. Designer supports any template-defined slots.',
                        )
                  }
                  label={designerText('Page sections')}
                  minRows={3}
                  multiline
                  onChange={(event) => setSlotIntent(event.target.value)}
                  value={effectiveSlotIntent}
                />
                <TextField
                  helperText={designerText(
                    'Use a clean URL. If you omit the leading slash, Axis adds it for you.',
                  )}
                  label={designerText('Web address')}
                  onChange={(event) => setRouteIntent(event.target.value)}
                  value={effectiveRouteIntent}
                />
                <TextField
                  helperText={designerText(
                    'Controls whether this route is publicly delivered or requires an authenticated CMS request.',
                  )}
                  label={designerText('Delivery access')}
                  onChange={(event) => setAccessModeIntent(event.target.value)}
                  select
                  value={effectiveAccessModeIntent}
                >
                  {['PUBLIC', 'AUTHENTICATED', 'CUSTOMER'].map((mode) => (
                    <MenuItem key={mode} value={mode}>
                      {mode}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  helperText={componentHint(
                    effectiveComponentIntent,
                    componentKinds,
                    componentTypeOptions,
                    designerText,
                  )}
                  label={designerText('Content type')}
                  onChange={(event) => setComponentIntent(event.target.value)}
                  select
                  value={effectiveComponentIntent}
                >
                  {componentKinds.map((kind) => (
                    <MenuItem key={kind.label} value={kind.label}>
                      {kind.label}
                    </MenuItem>
                  ))}
                </TextField>
                <Stack spacing={1}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {designerText('Authoring language')}
                  </Typography>
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
                    {designerText(
                      'Enter content in each language you need. Fields marked as shared keep the same value in every language. Blank translations use the default language.',
                    )}
                  </Typography>
                </Stack>
                <Divider />
                <ContentDesignerContentEditor
                  scope={contentScope}
                  slots={contentSlots}
                  fields={contentFields}
                  propertySchema={contentPropertySchema}
                  defaultLocale={defaultContentLocale}
                  locale={selectedLocale}
                  values={contentValues}
                  onChange={(key, property, value) =>
                    setContentValues((previous) => ({
                      ...previous,
                      [key]: { ...previous[key], [property]: value },
                    }))
                  }
                />
                {contentFields.length > 0 && !contentComplete ? (
                  <Alert severity="info">
                    {designerText(
                      'Complete the required headings, card details, and default language content before validating.',
                    )}
                  </Alert>
                ) : null}
                {selectedLanguageHasContent ? (
                  <Stack spacing={1}>
                    <Alert severity={selectedLanguageReviewed ? 'success' : 'info'}>
                      {selectedLanguageReviewed
                        ? designerText(
                            'Content in {locale} is marked ready. Editing it requires another review.',
                            { locale: selectedLocale },
                          )
                        : designerText(
                            'Review the content in {locale}, then mark it ready before submitting for publication.',
                            { locale: selectedLocale },
                          )}
                    </Alert>
                    <Button
                      disabled={!contentComplete || selectedLanguageReviewed}
                      onClick={() =>
                        setReviewedLanguages((previous) => ({
                          ...previous,
                          [designerContentKey(contentScope, '*', selectedLocale)]:
                            designerLanguageReviewSignature(
                              contentScope,
                              contentSlots,
                              selectedLocale,
                              contentValues,
                            ),
                        }))
                      }
                    >
                      {designerText('Mark')} {selectedLocale}{' '}
                      {designerText('content ready')}
                    </Button>
                  </Stack>
                ) : null}
                {!translationsReady ? (
                  <Alert severity="info">
                    {designerText(
                      'All entered translations must be reviewed and marked ready before publication. You can save unfinished content as a draft.',
                    )}
                  </Alert>
                ) : null}
                <Accordion disableGutters elevation={0}>
                  <AccordionSummary
                    id="designer-4-heading"
                    aria-controls="designer-4-panel"
                    expandIcon={<ShellIcon name="chevron-down" />}
                  >
                    <Typography>
                      {designerText('Draft preview and publication checks')}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      <DraftPreview draft={draft} locale={selectedLocale} />
                      <ValidationEvidencePanel
                        draftIsValidated={draftIsValidated}
                        result={draftIsValidated ? validateMutation.data : undefined}
                      />
                      <ContentPublishReadinessPanel
                        draft={draft}
                        draftIsSaved={draftIsSaved}
                        draftIsValidated={draftIsValidated}
                        publicationParts={publicationParts}
                        routePath={draftRoutePath(draft)}
                        slotOptions={slotOptions}
                      />
                    </Stack>
                  </AccordionDetails>
                </Accordion>
                {operationError ? (
                  <Alert severity="error">
                    {formatError(
                      operationError,
                      designerText('Content workspace could not be checked.'),
                    )}
                  </Alert>
                ) : null}
                {validateMutation.data ? (
                  <Alert
                    severity={
                      validateMutation.data.valid === false ? 'warning' : 'success'
                    }
                  >
                    {validateMutation.variables?.signature === draftSignature &&
                    validateMutation.variables.scope === operationScope
                      ? designerText('Validation result:')
                      : designerText('Earlier draft validation:')}{' '}
                    {operationMessage(
                      validateMutation.data,
                      designerText('CMS validation completed'),
                    )}
                  </Alert>
                ) : null}
                {saveMutation.data &&
                saveMutation.variables?.scope === operationScope ? (
                  <Alert severity="success">
                    {draftIsSaved
                      ? designerText('Save result:')
                      : designerText('Earlier draft save:')}{' '}
                    {savedVersionMessage(saveMutation.data, designerText)}
                  </Alert>
                ) : null}
                {createdPage ? (
                  <Alert severity="info">
                    {draftIsSaved
                      ? presentation?.createdMessage ||
                        designerText(
                          'Draft saved. Reopen the saved page to inspect the result and continue.',
                        )
                      : presentation?.knownSavedMessage ||
                        designerText(
                          'Continue in the saved-page editor to change this saved page.',
                        )}
                    {!draftIsSaved ? (
                      <Typography variant="body2">
                        {presentation?.changedAfterCreationMessage ||
                          designerText(
                            'The form changed after its saved version. These entries remain here while the saved copy is inspected.',
                          )}
                      </Typography>
                    ) : null}
                    {canReopen ? (
                      <Button
                        disabled={
                          savedPagePending ||
                          retirementPending ||
                          saveMutation.isPending ||
                          submitPublicationMutation.isPending ||
                          Boolean(publicationHold)
                        }
                        onClick={() => {
                          if (
                            savedPagePending ||
                            retirementPending ||
                            publicationHold ||
                            !canReopen
                          )
                            return;
                          setSavedPageHandoff({
                            scope: operationScope,
                            selection: createdPage,
                          });
                          setSavedPageVisited(true);
                          setSavedPageExpanded(true);
                          setNewPageExpanded(false);
                        }}
                      >
                        {presentation?.continueLabel || designerText('Open saved page')}
                      </Button>
                    ) : null}
                  </Alert>
                ) : null}
                {failedSave?.scope === operationScope ? (
                  <ContentDesignerFailedSaveInspection
                    key={`${operationScope}:${failedSave.scope}:${failedSave.draft.page.code}`}
                    connection={designerConnection}
                    configuration={configuration}
                    draft={failedSave.draft}
                    enabled={
                      failedSave.scope === operationScope &&
                      permittedOperations.includes('getDraftComposition')
                    }
                    onMissingConfirmed={() => {
                      saveAttempts.current.delete(
                        creationIdentity(failedSave.scope, failedSave.draft),
                      );
                      setFailedSave(undefined);
                      saveMutation.reset();
                      validateMutation.reset();
                      setValidatedDraftSignature('');
                      setSavedDraftSignature('');
                    }}
                  />
                ) : null}
                {currentPublicationHold && submitPublicationMutation.isError ? (
                  <Alert severity="warning">
                    {presentation?.publicationUnconfirmedMessage ||
                      designerText(
                        'The publication request was not confirmed. Inspect Publishing before another command.',
                      )}
                    {requestInspectionPath &&
                    authorizedNavigation.some(
                      (item) => item.route === '/publishing/requests',
                    ) ? (
                      <Button component={RouterLink} to={requestInspectionPath}>
                        {designerText('Inspect publication request')}
                      </Button>
                    ) : null}
                  </Alert>
                ) : null}
                {submitPublicationMutation.data &&
                submitPublicationMutation.variables?.scope === operationScope ? (
                  <Alert severity="success">
                    {submitPublicationMutation.variables?.signature ===
                      draftSignature &&
                    submitPublicationMutation.variables.scope === operationScope
                      ? designerText('Publishing result:')
                      : designerText('Earlier draft publishing result:')}{' '}
                    {operationMessage(
                      submitPublicationMutation.data,
                      designerText('CMS publication request submitted'),
                    )}
                  </Alert>
                ) : null}
                {submittedPublication ? (
                  <Stack spacing={1}>
                    <Typography sx={{ overflowWrap: 'anywhere' }}>
                      {designerText('Publication:')} {submittedPublication.code}
                    </Typography>
                    {requestInspectionPath &&
                    authorizedNavigation.some(
                      (item) => item.route === '/publishing/requests',
                    ) ? (
                      <Button
                        component={RouterLink}
                        to={requestInspectionPath}
                        variant="contained"
                      >
                        {designerText('Inspect this request')}
                      </Button>
                    ) : null}
                    {submittedPublication.workflowRef &&
                    authorizedNavigation.some(
                      (item) => item.route === '/process/tasks',
                    ) ? (
                      <Button
                        component={RouterLink}
                        to={
                          '/process/tasks?instanceCode=' +
                          encodeURIComponent(submittedPublication.workflowRef)
                        }
                        variant="outlined"
                      >
                        {designerText('Review this approval')}
                      </Button>
                    ) : null}
                  </Stack>
                ) : null}
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  <Button
                    disabled={
                      !canValidate ||
                      retirementPending ||
                      savedPagePending ||
                      Boolean(failedSave) ||
                      Boolean(createdPage) ||
                      Boolean(publicationHold) ||
                      !designerConnection ||
                      !authoringReady ||
                      validateMutation.isPending ||
                      saveMutation.isPending ||
                      submitPublicationMutation.isPending
                    }
                    onClick={() => validateMutation.mutate(command)}
                    variant="contained"
                  >
                    {designerText('Validate draft')}
                  </Button>
                  <Button
                    disabled={
                      !canSave ||
                      retirementPending ||
                      savedPagePending ||
                      Boolean(failedSave) ||
                      Boolean(createdPage) ||
                      Boolean(publicationHold) ||
                      !designerConnection ||
                      !draftIsValidated ||
                      saveMutation.isPending ||
                      submitPublicationMutation.isPending
                    }
                    onClick={() => {
                      if (
                        saveAttempts.current.has(pageIdentity) ||
                        saveMutation.isPending ||
                        createdPage ||
                        publicationHold ||
                        failedSave
                      )
                        return;
                      saveAttempts.current.add(pageIdentity);
                      saveMutation.mutate(command);
                    }}
                    variant="outlined"
                  >
                    {designerText('Save draft')}
                  </Button>
                  <Button
                    disabled={
                      !canSubmit ||
                      canReopen ||
                      Boolean(publicationHold) ||
                      !translationsReady ||
                      retirementPending ||
                      savedPagePending ||
                      Boolean(failedSave) ||
                      !designerConnection ||
                      !draftIsValidated ||
                      !draftIsSaved ||
                      submitPublicationMutation.isPending
                    }
                    onClick={() => {
                      if (
                        publicationStarted.current ||
                        canReopen ||
                        publicationHold ||
                        submitPublicationMutation.isPending
                      )
                        return;
                      publicationStarted.current = true;
                      setPublicationHold(command);
                      submitPublicationMutation.mutate(command);
                    }}
                    variant="outlined"
                  >
                    {designerText('Submit for approval')}
                  </Button>
                  <Button
                    disabled={!authoringModel.data}
                    onClick={() => {
                      setCatalogIntent('');
                      setSiteIntent('');
                      setTemplateIntent('');
                      setSlotIntent('');
                      setRouteIntent(undefined);
                      setComponentIntent(componentKinds[0]?.label ?? '');
                    }}
                    variant="text"
                  >
                    {designerText('Reset defaults')}
                  </Button>
                  {authorizedNavigation.some(
                    (item) => item.route === '/media/items',
                  ) ? (
                    <Button
                      component={RouterLink}
                      to="/media/items?folderCode=cmsAssets"
                      variant="outlined"
                    >
                      {designerText('Choose media')}
                    </Button>
                  ) : null}
                  {authorizedNavigation.some(
                    (item) => item.route === '/publishing/requests',
                  ) ? (
                    <Button
                      component={RouterLink}
                      to="/publishing/requests"
                      variant="text"
                    >
                      {designerText('Review publication requests')}
                    </Button>
                  ) : null}
                  {authorizedNavigation.some(
                    (item) => item.route === '/publishing/status',
                  ) ? (
                    <Button
                      component={RouterLink}
                      to="/publishing/status"
                      variant="text"
                    >
                      {designerText('Verify Online status')}
                    </Button>
                  ) : null}
                </Stack>
                {authoringModel.data?.retirement && (
                  <Accordion disableGutters elevation={0}>
                    <AccordionSummary
                      id="designer-5-heading"
                      aria-controls="designer-5-panel"
                      expandIcon={<ShellIcon name="chevron-down" />}
                    >
                      <Typography>{designerText('Manage existing content')}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <ContentDesignerRetirementPanel
                        connection={designerConnection}
                        configuration={configuration}
                        operations={permittedOperations}
                        presentation={authoringModel.data.retirement}
                        catalogCode={effectiveCatalogIntent}
                        siteCode={effectiveSiteIntent}
                        disabled={
                          Boolean(publicationHold) ||
                          savedPagePending ||
                          validateMutation.isPending ||
                          saveMutation.isPending ||
                          submitPublicationMutation.isPending
                        }
                        onPendingChange={setRetirementPending}
                        onRetired={() => {
                          setValidatedDraftSignature('');
                          setSavedDraftSignature('');
                          validateMutation.reset();
                          saveMutation.reset();
                          submitPublicationMutation.reset();
                        }}
                      />
                    </AccordionDetails>
                  </Accordion>
                )}
              </Box>
            </Paper>
          </AccordionDetails>
        </Accordion>

        <Accordion
          slotProps={{ heading: { component: 'h2' } }}
          disableGutters
          elevation={0}
          sx={{ border: 1, borderColor: 'divider' }}
        >
          <AccordionSummary
            id="designer-6-heading"
            aria-controls="designer-6-panel"
            expandIcon={<ShellIcon name="chevron-down" />}
          >
            <Typography component="span" variant="h6">
              {designerText('Website setup and reference workspaces')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={dashboardContentGap}>
              <Box>
                <Typography color="text.secondary">
                  {designerText(
                    'Use these reference workspaces to manage reusable content and website settings. Create and validate your page in the draft above.',
                  )}
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
                  <DesignerStepCard
                    key={step.id}
                    index={index}
                    step={step}
                    available={authorizedNavigation.some(
                      (item) => item.route === step.route.split('?')[0],
                    )}
                  />
                ))}
              </Box>
            </Stack>
          </AccordionDetails>
        </Accordion>

        {permittedMetrics.length > 0 ? (
          <Accordion
            disableGutters
            elevation={0}
            slotProps={{ heading: { component: 'h2' } }}
            expanded={inventoryExpanded}
            onChange={(_event, expanded) => setInventoryExpanded(expanded)}
            sx={{ border: 1, borderColor: 'divider' }}
          >
            <AccordionSummary
              id="designer-7-heading"
              aria-controls="designer-7-panel"
              expandIcon={<ShellIcon name="chevron-down" />}
            >
              <Typography component="span" variant="h6">
                {designerText('Content inventory')}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {data.isFetching ? (
                <LinearProgress
                  aria-label={designerText('Loading content inventory')}
                />
              ) : null}
              {data.isError ? (
                <Alert severity="warning">
                  {designerText(
                    'Content inventory could not be checked. The content authoring commands remain independently validated by CMS.',
                  )}
                </Alert>
              ) : null}
              <Stack spacing={dashboardContentGap}>
                <Box>
                  <Typography component="h3" variant="h4">
                    {designerText('Readiness snapshot')}
                  </Typography>
                  <Typography color="text.secondary">
                    {designerText(
                      'These counts come from live workbench contracts. If one is unavailable, the designer can still explain the flow, but save actions must stay inside the owning workspace.',
                    )}
                  </Typography>
                </Box>
                <Alert severity="info">
                  {designerText(
                    'CMS Online verification card: after a publication request is approved, confirm Online status, deployment history, audit evidence, and browser rendering for',
                  )}{' '}
                  {draftRoutePath(draft)}{' '}
                  {designerText('before closing the content task.')}
                </Alert>
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
                            sx={{
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Typography component="h4" variant="h6">
                              {designerText(metric.label)}
                            </Typography>
                            <Chip
                              color={metric.status === 'ready' ? 'success' : 'warning'}
                              label={
                                metric.status === 'ready'
                                  ? designerText('Available')
                                  : designerText('Unavailable')
                              }
                              size="small"
                            />
                          </Stack>
                          <Typography sx={{ fontSize: 34, fontWeight: 800 }}>
                            {metric.status === 'ready'
                              ? new Intl.NumberFormat(interfaceLocale).format(
                                  metric.value ?? 0,
                                )
                              : '—'}
                          </Typography>
                          <Typography color="text.secondary" variant="body2">
                            {designerText(metric.detail)}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              </Stack>
            </AccordionDetails>
          </Accordion>
        ) : null}
      </Stack>
    </WorkspaceContainer>
  );
}
