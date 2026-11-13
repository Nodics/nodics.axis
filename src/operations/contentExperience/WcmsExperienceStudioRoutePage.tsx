import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import {
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { Link as RouterLink, useLocation } from 'react-router';

import { axisTokens } from '../../app/axisTheme';
import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import { ShellIcon } from '../../app/shell/ShellIcon';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkbenchRoutePage } from '../../workbench/WorkbenchRoutePage';
import { PreviewExecution } from './ExperiencePreview';
import { GuidedExperiencePanel } from './GuidedExperiencePanel';
import {
  loadWcmsExperienceIndexStatus,
  type WcmsExperienceResolveRequest,
} from './api/wcmsExperienceClient';

interface WcmsExperienceStudioRoutePageProps {
  readonly accessToken: string;
  readonly sessionGeneration: number;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly channel: string;
  readonly cmsBaseUrl: string;
  readonly employeeId: string;
  readonly locale: string;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
  readonly site: string;
}

type ExperienceStudioTab = 'overview' | 'placements' | 'preview' | 'index-status';

interface StudioTabDefinition {
  readonly id: ExperienceStudioTab;
  readonly label: string;
  readonly route: string;
  readonly icon: string;
  readonly summary: string;
}

const tabs: readonly StudioTabDefinition[] = Object.freeze([
  Object.freeze({
    id: 'overview',
    label: 'Overview',
    route: '/content/experience-studio',
    icon: 'experience',
    summary: 'Understand targeted CMS experiences before editing records.',
  }),
  Object.freeze({
    id: 'placements',
    label: 'Placements',
    route: '/content/experience-studio/placements',
    icon: 'target',
    summary: 'Manage page, slot, target, and component placement records.',
  }),
  Object.freeze({
    id: 'preview',
    label: 'Preview',
    route: '/content/experience-studio/preview',
    icon: 'preview',
    summary: 'Resolve a staged journey exactly as Axis would inspect it.',
  }),
  Object.freeze({
    id: 'index-status',
    label: 'Index Status',
    route: '/content/experience-studio/index-status',
    icon: 'search',
    summary: 'Inspect the projection state used by storefront delivery.',
  }),
]);

const journeyCards = Object.freeze([
  Object.freeze({
    title: 'Collection journey',
    target: 'COLLECTION / your-collection',
    summary:
      'Show a targeted hero or carousel when a shopper lands from a curated collection.',
    example: '/shop?collection=your-collection&page=1&pageSize=10',
  }),
  Object.freeze({
    title: 'Brand journey',
    target: 'BRAND / your-brand',
    summary:
      'Use brand-specific banners, editorial blocks, or featured products while product search remains commerce-owned.',
    example: '/shop?brand=your-brand&page=1&pageSize=10',
  }),
  Object.freeze({
    title: 'Default fallback',
    target: 'DEFAULT / *',
    summary:
      'Keep storefront pages visually complete when no category, collection, or brand placement matches.',
    example: '/shop?page=1&pageSize=10',
  }),
]);

function activeTabForPath(pathname: string): ExperienceStudioTab {
  if (pathname.includes('/placements')) return 'placements';
  if (pathname.includes('/preview')) return 'preview';
  if (pathname.includes('/index-status')) return 'index-status';
  return 'overview';
}

function FieldGrid({ children }: { readonly children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
      }}
    >
      {children}
    </Box>
  );
}

function StudioTabs({
  activeTab,
  navigation,
}: {
  readonly activeTab: ExperienceStudioTab;
  readonly navigation: readonly AxisNavigationItem[];
}) {
  const { format: workflowText } = useAxisLocalization();
  const authorizedTabs = tabs.filter((tab) =>
    navigation.some(
      (item) =>
        item.route === tab.route &&
        ['ACTIVE', 'PREVIEW'].includes(item.featureState ?? 'ACTIVE') &&
        ['UP', 'DEGRADED'].includes(item.availability),
    ),
  );
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      {authorizedTabs.map((tab) => (
        <Button
          aria-current={activeTab === tab.id ? 'page' : undefined}
          component={RouterLink}
          key={tab.id}
          startIcon={<ShellIcon name={tab.icon} />}
          to={tab.route}
          variant={activeTab === tab.id ? 'contained' : 'outlined'}
        >
          {workflowText('experience.studio.tab.' + tab.id + '.label', tab.label)}
        </Button>
      ))}
    </Stack>
  );
}

function OverviewPanel() {
  const { format: workflowText } = useAxisLocalization();
  return (
    <Stack spacing={3}>
      <Alert severity="info">
        {workflowText(
          'experience.ui.preview-how-placements-will-appear-on-the-storefront-when-the-preview-is',
          'Preview how placements will appear on the storefront. When the preview is ready, submit the changes for review before publishing.',
        )}
      </Alert>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        {journeyCards.map((card) => (
          <Card
            elevation={0}
            key={card.title}
            sx={{ border: 1, borderColor: 'divider' }}
          >
            <CardContent>
              <Stack spacing={1.5}>
                <Chip
                  label={card.target}
                  size="small"
                  sx={{ alignSelf: 'flex-start' }}
                />
                <Typography component="h2" variant="h5">
                  {workflowText(
                    'experience.studio.journey.' +
                      (card.target.split(' / ')[0]?.toLowerCase() ?? 'default') +
                      '.title',
                    card.title,
                  )}
                </Typography>
                <Typography color="text.secondary">
                  {workflowText(
                    'experience.studio.journey.' +
                      (card.target.split(' / ')[0]?.toLowerCase() ?? 'default') +
                      '.summary',
                    card.summary,
                  )}
                </Typography>
                <Typography
                  sx={{
                    bgcolor: alpha(axisTokens.color.signatureGold, 0.12),
                    borderRadius: axisTokens.radius.small,
                    fontFamily: 'monospace',
                    px: 1.5,
                    py: 1,
                    wordBreak: 'break-word',
                  }}
                  variant="body2"
                >
                  {card.example}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>
      <Paper
        elevation={0}
        sx={{ border: 1, borderColor: 'divider', p: { xs: 2, md: 3 } }}
      >
        <Stack spacing={2}>
          <Typography component="h2" variant="h5">
            {workflowText('experience.ui.governed-flow', 'Governed flow')}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(5, minmax(0, 1fr))',
              },
            }}
          >
            {[
              'Create CMS component',
              'Attach placement',
              'Preview staged journey',
              'Publish through nPublish',
              'Monitor index status',
            ].map((step, index) => (
              <Box
                key={step}
                sx={{
                  bgcolor: alpha(axisTokens.color.charcoal[950], 0.04),
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: axisTokens.radius.medium,
                  p: 2,
                }}
              >
                <Typography color="text.secondary" variant="overline">
                  {workflowText('experience.ui.step', 'Step')} {String(index + 1)}
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>
                  {workflowText('experience.studio.step.' + String(index + 1), step)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}

function PreviewPanel({
  configuration,
  connection,
  request,
  setRequest,
  supportsPrivatePreparation,
}: {
  readonly configuration: {
    readonly accessToken: string;
    readonly enterpriseCode: string;
    readonly timeoutMs: number;
  };
  readonly connection: ReturnType<typeof selectModuleConnection>;
  readonly request: WcmsExperienceResolveRequest;
  readonly setRequest: React.Dispatch<
    React.SetStateAction<WcmsExperienceResolveRequest>
  >;
  readonly supportsPrivatePreparation: boolean;
}) {
  const { format: workflowText } = useAxisLocalization();
  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', p: { xs: 2, md: 3 } }}
    >
      <Stack spacing={3}>
        <WorkspaceHeading
          description={workflowText(
            'experience.ui.inspect-indexed-staged-content-for-the-selected-journey-match-site-local',
            'Inspect indexed Staged content for the selected journey. Match Site, locale and channel to the placement records. Authored records require a qualified Staged projection before they can appear here.',
          )}
          eyebrow="Staged inspection"
          headingComponent="h2"
          headingVariant="h4"
          title={workflowText(
            'experience.ui.preview-targeted-experience',
            'Preview targeted experience',
          )}
        />
        {!connection ? (
          <Alert severity="warning">
            {workflowText(
              'experience.ui.wcms-experience-runtime-is-not-available-in-the-authenticated-backoffice',
              'WCMS Experience runtime is not available in the authenticated BackOffice module connections.',
            )}
          </Alert>
        ) : null}
        <Alert severity="info">
          {workflowText(
            'experience.ui.preview-capability-this-inspection-requires-a-qualified-staged-discovery',
            'Preview capability: this inspection requires a qualified Staged Discovery projection. Saving or importing a placement does not publish or index it automatically.',
          )}
        </Alert>
        <FieldGrid>
          <TextField
            label={workflowText('experience.ui.site', 'Site')}
            onChange={(event) =>
              setRequest((current) => ({ ...current, site: event.target.value }))
            }
            value={request.site}
          />
          <TextField
            label={workflowText('experience.ui.page-type', 'Page type')}
            onChange={(event) =>
              setRequest((current) => ({ ...current, pageType: event.target.value }))
            }
            select
            value={request.pageType}
          >
            {[
              'PRODUCT_LISTING',
              'COLLECTION_INDEX',
              'BRAND_INDEX',
              'CATEGORY_DETAIL',
              'COLLECTION_DETAIL',
              'BRAND_DETAIL',
            ].map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={workflowText('experience.ui.target-type', 'Target type')}
            onChange={(event) =>
              setRequest((current) => ({ ...current, targetType: event.target.value }))
            }
            select
            value={request.targetType}
          >
            {['DEFAULT', 'CATEGORY', 'COLLECTION', 'BRAND'].map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={workflowText('experience.ui.target-code', 'Target code')}
            onChange={(event) =>
              setRequest((current) => ({ ...current, targetCode: event.target.value }))
            }
            value={request.targetCode}
          />
          <TextField
            label={workflowText('experience.ui.locale', 'Locale')}
            onChange={(event) =>
              setRequest((current) => ({ ...current, locale: event.target.value }))
            }
            value={request.locale}
          />
          <TextField
            label={workflowText('experience.ui.channel', 'Channel')}
            onChange={(event) =>
              setRequest((current) => ({ ...current, channel: event.target.value }))
            }
            value={request.channel}
          />
        </FieldGrid>
        <PreviewExecution
          key={JSON.stringify(request)}
          request={request}
          configuration={configuration}
          connection={connection}
          supportsPrivatePreparation={supportsPrivatePreparation}
        />
      </Stack>
    </Paper>
  );
}

function IndexStatusPanel({
  configuration,
  connection,
  context,
  ownerScope,
}: {
  readonly context: WcmsExperienceResolveRequest;
  readonly ownerScope: string;
  readonly configuration: {
    readonly accessToken: string;
    readonly enterpriseCode: string;
    readonly timeoutMs: number;
  };
  readonly connection: ReturnType<typeof selectModuleConnection>;
}) {
  const { format: workflowText, locale } = useAxisLocalization();
  const { formatError } = useAxisLocalization();
  const status = useQuery({
    enabled: Boolean(connection && context.site.trim()),
    queryKey: ['wcms-experience-index-status', ownerScope, context],
    queryFn: () => {
      if (!connection) throw new Error('WCMS Experience connection is unavailable.');
      return loadWcmsExperienceIndexStatus(connection, configuration, fetch, context);
    },
  });

  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', p: { xs: 2, md: 3 } }}
    >
      <Stack spacing={2}>
        <WorkspaceHeading
          description={workflowText(
            'experience.ui.observe-matching-staged-projections-for-this-journey-this-bounded-check-',
            'Observe matching Staged projections for this journey. This bounded check does not certify Online publication or alias health.',
          )}
          eyebrow="Operational diagnostics"
          headingComponent="h2"
          headingVariant="h4"
          title={workflowText('experience.ui.index-status', 'Index Status')}
        />
        <Alert severity="info">
          {workflowText('experience.ui.site-c9aa3f', 'Site:')} {context.site} ·{' '}
          {context.pageType} · {context.targetType}/{context.targetCode} ·{' '}
          {context.locale} · {context.channel}
        </Alert>
        <Button
          disabled={!connection || status.isFetching}
          onClick={() => {
            void status.refetch();
          }}
          variant="outlined"
        >
          {workflowText(
            'experience.ui.refresh-index-evidence',
            'Refresh index evidence',
          )}
        </Button>
        {!connection ? (
          <Alert severity="warning">
            {workflowText(
              'experience.ui.wcms-experience-runtime-is-not-available-in-the-authenticated-backoffice',
              'WCMS Experience runtime is not available in the authenticated BackOffice module connections.',
            )}
          </Alert>
        ) : null}
        {status.isPending && connection ? <LinearProgress /> : null}
        {status.isError ? (
          <Alert severity="error">
            {formatError(
              status.error,
              workflowText(
                'experience.ui.index-status-request-failed',
                'Index status request failed.',
              ),
            )}
          </Alert>
        ) : null}
        {status.data ? (
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            }}
          >
            {[
              ['Status', status.data.status],
              ['Indexing mode', status.data.indexingMode],
              [
                'Matching projections',
                status.data.documentCount === undefined
                  ? '—'
                  : new Intl.NumberFormat(locale).format(status.data.documentCount),
              ],
              ['Current index', status.data.currentIndexVersion ?? '—'],
              [
                'Last indexed',
                status.data.lastIndexedAt &&
                Number.isFinite(Date.parse(status.data.lastIndexedAt))
                  ? new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(status.data.lastIndexedAt))
                  : '—',
              ],
              ['Publication context', status.data.publication ?? '—'],
              ['Observation limit', String(status.data.observationLimit ?? '—')],
            ].map(([label, value]) => (
              <Paper
                elevation={0}
                key={label}
                sx={{ border: 1, borderColor: 'divider', p: 2 }}
              >
                <Typography color="text.secondary" variant="body2">
                  {workflowText(
                    'experience.status.' + label!.toLowerCase().replaceAll(' ', '-'),
                    label!,
                  )}
                </Typography>
                <Typography sx={{ fontWeight: 800 }}>{value ?? '—'}</Typography>
              </Paper>
            ))}
          </Box>
        ) : null}
        {status.data?.message ? (
          <Alert severity="info">{status.data.message}</Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}

/**
 * Renders Axis Experience Studio from backend-owned wcmsExperience navigation,
 * schema, preview, and index-status contracts. Axis owns the interaction shell
 * only; CMS components, placements, permissions, publication, and indexing
 * remain backend-owned.
 */
export function WcmsExperienceStudioRoutePage(
  props: WcmsExperienceStudioRoutePageProps,
) {
  const connection = selectModuleConnection(props.bootstrap, 'wcmsExperience', {
    publicationRole: 'STAGED',
  });
  const scope = JSON.stringify([
    props.sessionGeneration,
    props.bootstrap.tenantCode,
    props.runtime.enterpriseCode,
    connection?.instanceId,
    connection?.endpoint,
    props.site,
    props.locale,
    props.channel,
  ]);
  return (
    <ExperienceStudioWorkspace
      key={scope}
      {...props}
      ownerScope={scope}
      connection={connection}
    />
  );
}

function ExperienceStudioWorkspace(
  props: WcmsExperienceStudioRoutePageProps & {
    readonly ownerScope: string;
    readonly connection: ReturnType<typeof selectModuleConnection>;
  },
) {
  const { format: workflowText } = useAxisLocalization();
  const location = useLocation();
  const activeTab = activeTabForPath(location.pathname);
  const connection = props.connection;
  const configuration = useMemo(
    () => ({
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      timeoutMs: props.runtime.requestTimeoutMs,
      sessionGeneration: props.sessionGeneration,
    }),
    [
      props.accessToken,
      props.runtime.enterpriseCode,
      props.runtime.requestTimeoutMs,
      props.sessionGeneration,
    ],
  );
  const placementsNavigation = useMemo<AxisNavigationItem>(
    () => ({
      ...props.navigation,
      id: 'wcms-experience-placements',
      label: 'Experience placements',
      route: '/content/experience-studio/placements',
      moduleName: 'wcmsExperience',
      workbenchTarget: {
        moduleName: 'wcmsExperience',
        schemaName: 'cmsExperiencePlacement',
      },
      workbenchPresentation: {
        ...props.navigation.workbenchPresentation,
        defaultColumns: [
          'code',
          'site',
          'pageType',
          'slot',
          'targetType',
          'targetCode',
          'component',
          'priority',
          'publicationStatus',
          'deliveryStatus',
        ],
      },
    }),
    [props.navigation],
  );
  const defaultRequest = useMemo<WcmsExperienceResolveRequest>(
    () => ({
      site: props.site,
      pageType: 'PRODUCT_LISTING',
      targetType: 'DEFAULT',
      targetCode: '*',
      locale: props.locale,
      channel: props.channel,
      device: 'desktop',
    }),
    [props.channel, props.locale, props.site],
  );

  const [request, setRequest] = useState(defaultRequest);

  return (
    <WorkspaceContainer>
      <Stack spacing={3}>
        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: { xs: 2, md: 3 } }}
        >
          <Stack spacing={2}>
            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'space-between' }}
            >
              <WorkspaceHeading
                description={workflowText(
                  'experience.ui.configure-targeted-cms-components-for-collection-brand-category-and-fall',
                  'Configure targeted CMS components for collection, brand, category, and fallback storefront journeys without changing frontend code.',
                )}
                help={props.navigation.help}
                eyebrow="WCMS Experience"
                headingComponent="h1"
                headingVariant="h3"
                title={workflowText(
                  'experience.ui.experience-studio',
                  'Experience Studio',
                )}
              />
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip
                  label={workflowText(
                    'experience.ui.cms-owned-components',
                    'CMS-owned components',
                  )}
                />
                <Chip
                  label={workflowText(
                    'experience.ui.discovery-delivery-index',
                    'Discovery delivery index',
                  )}
                />
                <Chip
                  color="success"
                  label={workflowText(
                    'experience.ui.backend-governed',
                    'Backend-governed',
                  )}
                />
              </Stack>
            </Stack>
            <Divider />
            <StudioTabs activeTab={activeTab} navigation={props.bootstrap.navigation} />
            <Typography color="text.secondary">
              {workflowText(
                'experience.studio.tab.' + activeTab + '.summary',
                tabs.find((tab) => tab.id === activeTab)?.summary ?? '',
              )}
            </Typography>
          </Stack>
        </Paper>

        {activeTab === 'overview' ? <OverviewPanel /> : null}
        {activeTab === 'placements' && connection ? (
          <GuidedExperiencePanel
            bootstrap={props.bootstrap}
            connection={connection}
            configuration={configuration}
            cachePartition={props.ownerScope}
            locale={props.locale}
            channel={props.channel}
          />
        ) : null}
        {activeTab === 'placements' && !connection ? (
          <Alert severity="warning">
            {workflowText(
              'experience.ui.experience-authoring-is-temporarily-unavailable-inspect-readiness-and-re',
              'Experience authoring is temporarily unavailable. Inspect readiness and refresh availability before continuing.',
            )}
          </Alert>
        ) : null}
        {activeTab === 'placements' ? (
          <Accordion slotProps={{ transition: { unmountOnExit: true } }}>
            <AccordionSummary expandIcon={<ShellIcon name="chevron-down" />}>
              {workflowText(
                'experience.ui.advanced-placement-records',
                'Advanced placement records',
              )}
            </AccordionSummary>
            <AccordionDetails>
              <WorkbenchRoutePage
                accessToken={props.accessToken}
                bootstrap={props.bootstrap}
                channel={props.channel}
                cmsBaseUrl={props.cmsBaseUrl}
                employeeId={props.employeeId}
                locale={props.locale}
                routeNavigation={placementsNavigation}
                routeSchema={placementsNavigation.workbenchTarget}
                runtime={props.runtime}
                site={props.site}
              />
            </AccordionDetails>
          </Accordion>
        ) : null}
        {activeTab === 'preview' ? (
          <PreviewPanel
            configuration={configuration}
            connection={connection}
            request={request}
            setRequest={setRequest}
            supportsPrivatePreparation={props.bootstrap.navigation.some(
              (item) =>
                item.id === 'wcms-experience-preview' &&
                item.lifecycleActions?.some(
                  (action) =>
                    action.id === 'prepare-private-preview' &&
                    action.featureState === 'ACTIVE' &&
                    action.ownerModule === 'wcmsExperience' &&
                    action.handlerAction === 'preparePreview' &&
                    action.httpMethod === 'POST' &&
                    action.operationRoute ===
                      '/nodics/wcmsExperience/v0/authoring/preparation',
                ),
            )}
          />
        ) : null}
        {activeTab === 'index-status' ? (
          <IndexStatusPanel
            configuration={configuration}
            connection={connection}
            context={request}
            ownerScope={props.ownerScope}
          />
        ) : null}
      </Stack>
    </WorkspaceContainer>
  );
}
