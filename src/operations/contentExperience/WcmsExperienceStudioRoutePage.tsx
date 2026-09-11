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
import {
  loadWcmsExperienceIndexStatus,
  previewWcmsExperience,
  type WcmsExperienceResolveRequest,
} from './api/wcmsExperienceClient';

interface WcmsExperienceStudioRoutePageProps {
  readonly accessToken: string;
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
    target: 'COLLECTION / agoraNewArrivals',
    summary:
      'Show a targeted hero or carousel when a shopper lands from a curated collection.',
    example: '/shop?collection=agoraNewArrivals&page=1&pageSize=10',
  }),
  Object.freeze({
    title: 'Brand journey',
    target: 'BRAND / atelier-minimal',
    summary:
      'Use brand-specific banners, editorial blocks, or featured products while product search remains commerce-owned.',
    example: '/shop?brand=atelier-minimal&page=1&pageSize=10',
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

function StudioTabs({ activeTab }: { readonly activeTab: ExperienceStudioTab }) {
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
      {tabs.map((tab) => (
        <Button
          aria-pressed={activeTab === tab.id}
          component={RouterLink}
          key={tab.id}
          startIcon={<ShellIcon name={tab.icon} />}
          to={tab.route}
          variant={activeTab === tab.id ? 'contained' : 'outlined'}
        >
          {tab.label}
        </Button>
      ))}
    </Stack>
  );
}

function OverviewPanel() {
  return (
    <Stack spacing={3}>
      <Alert severity="info">
        Experience Studio is an Axis control surface. CMS components and placements stay
        backend-owned, publication stays governed, and storefront delivery reads indexed
        projections only.
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
                <Typography variant="h5">{card.title}</Typography>
                <Typography color="text.secondary">{card.summary}</Typography>
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
          <Typography variant="h5">Governed flow</Typography>
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
                <Typography color="primary" variant="overline">
                  Step {String(index + 1)}
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>{step}</Typography>
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
  defaultRequest,
}: {
  readonly configuration: {
    readonly accessToken: string;
    readonly enterpriseCode: string;
    readonly timeoutMs: number;
  };
  readonly connection: ReturnType<typeof selectModuleConnection>;
  readonly defaultRequest: WcmsExperienceResolveRequest;
}) {
  const [request, setRequest] = useState<WcmsExperienceResolveRequest>(defaultRequest);
  const preview = useMutation({
    mutationFn: () => {
      if (!connection) throw new Error('WCMS Experience connection is unavailable.');
      return previewWcmsExperience(connection, configuration, request);
    },
  });
  const slotEntries = Object.entries(preview.data?.slots ?? {});

  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', p: { xs: 2, md: 3 } }}
    >
      <Stack spacing={3}>
        <WorkspaceHeading
          description="Resolve staged placements for a selected journey. Axis sends the context; the backend authoring controller forces preview mode and returns storefront-safe component projections."
          eyebrow="Staged inspection"
          headingVariant="h4"
          title="Preview targeted experience"
        />
        {!connection ? (
          <Alert severity="warning">
            WCMS Experience runtime is not available in the authenticated BackOffice
            module connections.
          </Alert>
        ) : null}
        <FieldGrid>
          <TextField
            label="Site"
            onChange={(event) =>
              setRequest((current) => ({ ...current, site: event.target.value }))
            }
            value={request.site}
          />
          <TextField
            label="Page type"
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
            label="Target type"
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
            label="Target code"
            onChange={(event) =>
              setRequest((current) => ({ ...current, targetCode: event.target.value }))
            }
            value={request.targetCode}
          />
          <TextField
            label="Locale"
            onChange={(event) =>
              setRequest((current) => ({ ...current, locale: event.target.value }))
            }
            value={request.locale}
          />
          <TextField
            label="Channel"
            onChange={(event) =>
              setRequest((current) => ({ ...current, channel: event.target.value }))
            }
            value={request.channel}
          />
        </FieldGrid>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            disabled={!connection || preview.isPending}
            onClick={() => preview.mutate()}
            startIcon={<ShellIcon name="visible" />}
            variant="contained"
          >
            Run staged preview
          </Button>
          <Button
            component={RouterLink}
            to="/content/experience-studio/placements"
            variant="outlined"
          >
            Manage placements
          </Button>
        </Stack>
        {preview.isPending ? <LinearProgress /> : null}
        {preview.isError ? (
          <Alert severity="error">
            {preview.error instanceof Error
              ? preview.error.message
              : 'Preview request failed.'}
          </Alert>
        ) : null}
        {preview.data ? (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip
                color={preview.data.diagnostics.matched ? 'success' : 'warning'}
                label={preview.data.diagnostics.matched ? 'Matched' : 'Fallback only'}
              />
              <Chip
                label={`${String(preview.data.diagnostics.placementCount)} placements`}
              />
              {preview.data.release ? <Chip label={preview.data.release} /> : null}
              {preview.data.indexVersion ? (
                <Chip label={preview.data.indexVersion} />
              ) : null}
            </Stack>
            {slotEntries.length > 0 ? (
              slotEntries.map(([slot, components]) => (
                <Paper
                  elevation={0}
                  key={slot}
                  sx={{ border: 1, borderColor: 'divider', p: 2 }}
                >
                  <Typography variant="h6">{slot}</Typography>
                  {components.map((component) => (
                    <Typography color="text.secondary" key={component.placementCode}>
                      {component.placementCode} → {component.componentCode} ·{' '}
                      {component.rendererKey} v{String(component.contractVersion)}
                    </Typography>
                  ))}
                </Paper>
              ))
            ) : (
              <Alert severity="warning">No slots were returned for this context.</Alert>
            )}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

function IndexStatusPanel({
  configuration,
  connection,
}: {
  readonly configuration: {
    readonly accessToken: string;
    readonly enterpriseCode: string;
    readonly timeoutMs: number;
  };
  readonly connection: ReturnType<typeof selectModuleConnection>;
}) {
  const status = useQuery({
    enabled: Boolean(connection),
    queryKey: ['wcms-experience-index-status', connection?.instanceId],
    queryFn: () => {
      if (!connection) throw new Error('WCMS Experience connection is unavailable.');
      return loadWcmsExperienceIndexStatus(connection, configuration);
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
          description="Inspect whether published placements have been projected into the current Discovery/Elasticsearch delivery index."
          eyebrow="Operational diagnostics"
          headingVariant="h4"
          title="Index Status"
        />
        {!connection ? (
          <Alert severity="warning">
            WCMS Experience runtime is not available in the authenticated BackOffice
            module connections.
          </Alert>
        ) : null}
        {status.isPending && connection ? <LinearProgress /> : null}
        {status.isError ? (
          <Alert severity="error">
            {status.error instanceof Error
              ? status.error.message
              : 'Index status request failed.'}
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
                'Documents',
                status.data.documentCount === undefined
                  ? '—'
                  : new Intl.NumberFormat().format(status.data.documentCount),
              ],
              ['Current index', status.data.currentIndexVersion ?? '—'],
              ['Last indexed', status.data.lastIndexedAt ?? '—'],
              ['Online alias', status.data.onlineAliasTemplate ?? '—'],
            ].map(([label, value]) => (
              <Paper
                elevation={0}
                key={label}
                sx={{ border: 1, borderColor: 'divider', p: 2 }}
              >
                <Typography color="text.secondary" variant="body2">
                  {label}
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
  const location = useLocation();
  const activeTab = activeTabForPath(location.pathname);
  const connection =
    selectModuleConnection(props.bootstrap, 'wcmsExperience', {
      server: 'wcmsStagedServer',
    }) ?? selectModuleConnection(props.bootstrap, 'wcmsExperience');
  const configuration = useMemo(
    () => ({
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      timeoutMs: props.runtime.requestTimeoutMs,
    }),
    [props.accessToken, props.runtime.enterpriseCode, props.runtime.requestTimeoutMs],
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
      targetType: 'COLLECTION',
      targetCode: 'agoraNewArrivals',
      locale: props.locale,
      channel: props.channel,
      device: 'desktop',
    }),
    [props.channel, props.locale, props.site],
  );

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
                description="Configure targeted CMS components for collection, brand, category, and fallback storefront journeys without changing frontend code."
                help={props.navigation.help}
                eyebrow="WCMS Experience"
                headingVariant="h3"
                title="Experience Studio"
              />
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip label="CMS-owned components" />
                <Chip label="Discovery delivery index" />
                <Chip color="success" label="Backend-governed" />
              </Stack>
            </Stack>
            <Divider />
            <StudioTabs activeTab={activeTab} />
            <Typography color="text.secondary">
              {tabs.find((tab) => tab.id === activeTab)?.summary}
            </Typography>
          </Stack>
        </Paper>

        {activeTab === 'overview' ? <OverviewPanel /> : null}
        {activeTab === 'placements' ? (
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
        ) : null}
        {activeTab === 'preview' ? (
          <PreviewPanel
            configuration={configuration}
            connection={connection}
            defaultRequest={defaultRequest}
          />
        ) : null}
        {activeTab === 'index-status' ? (
          <IndexStatusPanel configuration={configuration} connection={connection} />
        ) : null}
      </Stack>
    </WorkspaceContainer>
  );
}
