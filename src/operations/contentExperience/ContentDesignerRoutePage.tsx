import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router';

import { axisTokens } from '../../app/axisTheme';
import { WorkspaceHeading } from '../../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import { ShellIcon } from '../../app/shell/ShellIcon';
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
  type WorkbenchMetricDefinition,
} from '../shared/workbenchMetricDashboardModel';

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
    description: 'Reusable page structures and allowed slots.',
    route: '/content/page-templates',
    icon: 'template',
  }),
  Object.freeze({
    id: 'pages',
    label: 'Pages',
    moduleName: 'cms',
    schemaName: 'cmsPage',
    description: 'Authorable pages that connect templates, slots, and components.',
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
    id: 'site',
    label: 'Choose or create site',
    description:
      'Start with the business site: brand portal, documentation site, storefront, or internal workspace.',
    icon: 'storefront',
    route: '/content/sites',
    action: 'Manage sites',
  }),
  Object.freeze({
    id: 'template',
    label: 'Select template',
    description:
      'Pick the page structure and its governed slots before adding page-specific content.',
    icon: 'template',
    route: '/content/page-templates',
    action: 'Manage templates',
  }),
  Object.freeze({
    id: 'page',
    label: 'Create page',
    description:
      'Create the page record, connect it with site/catalog/template, and keep lifecycle state visible.',
    icon: 'page',
    route: '/content/pages',
    action: 'Manage pages',
  }),
  Object.freeze({
    id: 'section',
    label: 'Arrange sections and slots',
    description:
      'Use slot definitions to decide where hero, body, gallery, call-to-action, or documentation sections can appear.',
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

const componentKinds = Object.freeze([
  'Hero banner',
  'Rich text',
  'Image card',
  'Media gallery',
  'Call to action',
  'Documentation article',
  'Dashboard widget',
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

export function ContentDesignerRoutePage({
  accessToken,
  bootstrap,
  routeNavigation,
  runtime,
}: ContentDesignerRoutePageProps) {
  const [siteIntent, setSiteIntent] = useState('defaultCmsSite');
  const [pageIntent, setPageIntent] = useState('home');
  const [componentIntent, setComponentIntent] = useState(componentKinds[0]);
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
    queryKey: ['content-designer', runtime.enterpriseCode, connectionKey(connections)],
    queryFn: () =>
      loadWorkbenchMetrics(connections, bootstrap, configuration, designerMetrics),
  });
  const metrics = metricsById(data.data, designerMetrics);

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
                description="Guide business users through site, page, section, component, media, and route composition without bypassing WCMS or nMedia ownership."
                help={routeNavigation?.help}
                eyebrow="Governed page composition"
                headingVariant="h3"
                title="Content Designer"
              />
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <Chip color="success" label="WCMS governed" />
                <Chip label="Template first" />
                <Chip label="Media by reference" />
              </Stack>
            </Stack>

            <Alert severity={data.isError ? 'warning' : 'info'}>
              {data.isError
                ? data.error instanceof Error
                  ? data.error.message
                  : 'Designer readiness could not be loaded from live WCMS contracts.'
                : 'This designer is intentionally not a pixel-perfect website builder. It is a guided composition workspace over backend-owned WCMS pages, templates, slots, components, media references, routes, and publishing contracts.'}
            </Alert>
          </Stack>
        </Paper>

        <Box
          sx={{
            display: 'grid',
            gap: dashboardComponentGap,
            gridTemplateColumns: {
              xs: '1fr',
              xl: 'minmax(0, 1.2fr) minmax(360px, 0.8fr)',
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
                <Typography variant="h4">Composition brief</Typography>
                <Typography color="text.secondary">
                  Capture the business intent before creating records. Later this brief
                  can become a guided save workflow.
                </Typography>
              </Box>
              <TextField
                label="Site intent"
                onChange={(event) => setSiteIntent(event.target.value)}
                select
                value={siteIntent}
              >
                <MenuItem value="defaultCmsSite">Default content site</MenuItem>
                <MenuItem value="axisCmsSite">Axis back-office site</MenuItem>
                <MenuItem value="documentationSite">Documentation site</MenuItem>
                <MenuItem value="newCustomerSite">New customer site</MenuItem>
              </TextField>
              <TextField
                label="Page intent"
                onChange={(event) => setPageIntent(event.target.value)}
                value={pageIntent}
              />
              <TextField
                label="Primary component type"
                onChange={(event) => setComponentIntent(event.target.value)}
                select
                value={componentIntent}
              >
                {componentKinds.map((kind) => (
                  <MenuItem key={kind} value={kind}>
                    {kind}
                  </MenuItem>
                ))}
              </TextField>
              <Divider />
              <Stack spacing={1}>
                <Typography variant="h6">Generated authoring checklist</Typography>
                <Typography color="text.secondary">
                  Site: {siteIntent}; page: {pageIntent || 'new page'}; first component:{' '}
                  {componentIntent}. Create or verify template slots, then attach
                  text/media through CMS component records.
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Button component={RouterLink} to="/content/pages" variant="contained">
                  Start with page
                </Button>
                <Button
                  component={RouterLink}
                  to="/content/components"
                  variant="outlined"
                >
                  Add component
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
                  xl: 'repeat(3, minmax(0, 1fr))',
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
