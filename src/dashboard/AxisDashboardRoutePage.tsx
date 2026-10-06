import type { CmsComponentContract } from '../cms/cmsContract';
import { CopilotWorkspaceRoutePage } from '../assistant/CopilotWorkspaceRoutePage';
import { dashboardComposition, dashboardText } from './dashboardComposition';
import { AxisOverviewDashboard } from './AxisOverviewDashboard';
import { isDocumentation } from './overviewStatus';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { WorkspaceContainer } from '../app/shell/ShellPrimitives';
import { ShellIcon } from '../app/shell/ShellIcon';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
} from '../bootstrap/publicBootstrap';
import {
  createApplicationInitializationClient,
  type ApplicationInitializationStatus,
} from '../operations/setupAccelerators/api/applicationInitializationClient';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import { ApplicationArtwork } from './ApplicationArtwork';

const TechnicalDashboard = lazy(async () => {
  const module = await import('./AxisTechnicalDashboard');
  return { default: module.AxisTechnicalDashboard };
});
const FrameworkOverview = lazy(async () => {
  const module = await import('./AxisFrameworkOverview');
  return { default: module.AxisFrameworkOverview };
});

interface Props {
  readonly composition: CmsComponentContract;
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
}

/** Display lifecycle facts only. Missing prerequisites do not mean an offering was selected. */
function statusLabel(status?: ApplicationInitializationStatus): string {
  if (!status) return 'Not checked';
  if (status.readiness === 'READY') return 'Published';
  if (status.readiness === 'PUBLICATION_PENDING') return 'Awaiting approval';
  if (status.readiness === 'IMPORTING') return 'Preparing';
  if (status.readiness === 'IMPORTED') return 'Ready for review';
  if (status.readiness === 'NOT_IMPORTED') return 'Not configured';
  if (status.readiness === 'BLOCKED') return 'Requirements to review';
  if (status.readiness === 'RETIRED') return 'Retired';
  if (status.readiness === 'ROLLED_BACK') return 'Publication rolled back';
  if (status.readiness === 'REJECTED') return 'Changes requested';
  return 'Needs review';
}

/** Application-first entry point. BackOffice remains plan, state and operation authority. */
export function AxisDashboardRoutePage(props: Props) {
  const artworkContext = {
    bootstrap: props.bootstrap,
    accessToken: props.accessToken,
    enterpriseCode: props.runtime.enterpriseCode,
    timeoutMs: props.runtime.requestTimeoutMs,
  };
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [search, setSearch] = useState('');
  const category = params.get('category') ?? '';
  const { tabs, defaultView } = dashboardComposition(props.composition);
  const requestedView = params.get('view') ?? defaultView;
  const tab = tabs.find((tab) => tab.view === requestedView);
  const view = tab?.view;
  const applicationTab = tabs.find((tab) => tab.view === 'applications');
  const hasApplicationDetails = applicationTab?.sections.some(
    (section) => section.properties.kind === 'details',
  );
  const hasApplicationCards = applicationTab?.sections.some(
    (section) => section.properties.kind === 'applications',
  );
  const selectedCode = params.get('offering');
  const profiles = useMemo(
    () =>
      (props.bootstrap.applicationInitializationProfiles ?? [])
        .slice()
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    [props.bootstrap.applicationInitializationProfiles],
  );
  const connection = selectModuleConnection(props.bootstrap, 'backoffice');
  const queries = useQueries({
    queries: profiles.map((profile) => ({
      queryKey: [
        'setup-accelerators',
        props.runtime.enterpriseCode,
        connection?.instanceId,
        profile.code,
      ],
      enabled: Boolean(connection) && tab?.layout === 'summary',
      queryFn: () => {
        if (!connection) throw new Error('Application status is unavailable');
        return createApplicationInitializationClient({
          connection,
          enterpriseCode: props.runtime.enterpriseCode,
          accessToken: props.accessToken,
          timeoutMs: props.runtime.requestTimeoutMs,
          profileCode: profile.code,
        }).getStatus();
      },
      staleTime: 15_000,
      retry: false,
      refetchInterval: 15_000,
      refetchIntervalInBackground: false,
    })),
  });
  const entries = profiles.map((profile, index) => ({
    profile,
    query: queries[index],
  }));
  const selected = entries.find(({ profile }) => profile.code === selectedCode);
  const applications = entries.filter((entry) => !isDocumentation(entry));
  const categories = Array.from(
    new Set(applications.map(({ profile }) => profile.category)),
  );
  const visible = applications.filter(
    ({ profile }) =>
      (!category || profile.category === category) &&
      `${profile.title} ${profile.summary}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase().trim()),
  );
  const setupRoute = props.bootstrap.navigation.find(
    (item) =>
      item.moduleName === 'backoffice' &&
      item.id === 'setup-accelerators' &&
      (item.availability === 'UP' || item.availability === 'DEGRADED'),
  )?.route;
  const findings = props.bootstrap.startupValidation?.findings ?? [];
  const selectedStatus = selected?.query?.data;
  const plan = selectedStatus?.profile?.setupPlan ?? selected?.profile.setupPlan;
  const refreshing = queries.some((query) => query.isFetching);

  const updateParam = (key: string, value?: string) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  return (
    <WorkspaceContainer>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" variant="h4">
            {dashboardText(props.composition, 'title')}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {tab?.description}
          </Typography>
        </Box>
        {tab?.layout === 'summary' ? (
          <Tooltip title="Refresh application status">
            <span>
              <IconButton
                aria-label="Refresh application status"
                disabled={refreshing || !connection}
                onClick={() => {
                  for (const query of queries) void query.refetch();
                }}
              >
                {refreshing ? (
                  <CircularProgress size={20} />
                ) : (
                  <ShellIcon name="refresh" />
                )}
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
      </Stack>
      <CopilotWorkspaceRoutePage
        accessToken={props.accessToken}
        bootstrap={props.bootstrap}
        runtime={props.runtime}
        compact
      />
      <Tabs
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        textColor="inherit"
        value={view ?? false}
        onChange={(_, value: string) => updateParam('view', value)}
        aria-label="Dashboard view"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          mb: view === 'technical' ? 1 : 3,
        }}
      >
        {tabs.map((item) => (
          <Tab
            key={item.view}
            value={item.view}
            label={item.title}
            id={`${item.view}-tab`}
            aria-controls={`${item.view}-panel`}
          />
        ))}
      </Tabs>
      {!tab ? (
        <Alert severity="warning">
          This dashboard view is not included in the published composition.
        </Alert>
      ) : tab.layout === 'framework' ? (
        <Box role="tabpanel" id="overview-panel" aria-labelledby="overview-tab">
          <Suspense fallback={<LinearProgress aria-label="Loading overview" />}>
            <FrameworkOverview {...props} sections={tab.sections} />
          </Suspense>
        </Box>
      ) : tab.layout === 'operational' ? (
        <Box role="tabpanel" id={`${view}-panel`} aria-labelledby={`${view}-tab`}>
          <Suspense
            fallback={<LinearProgress aria-label="Loading operational overview" />}
          >
            <TechnicalDashboard
              {...props}
              sections={tab.sections}
              visual={tab.presentation === 'visual'}
            />
          </Suspense>
        </Box>
      ) : view === 'overview' ? (
        <Box
          sx={{ minWidth: 0 }}
          role="tabpanel"
          id="overview-panel"
          aria-labelledby="overview-tab"
        >
          <AxisOverviewDashboard
            media={artworkContext}
            bootstrap={props.bootstrap}
            entries={entries}
            findings={findings}
            sections={tab.sections}
            review={
              hasApplicationDetails
                ? (code) => setParams({ view: 'applications', offering: code })
                : undefined
            }
          />
        </Box>
      ) : (
        <Box role="tabpanel" id="applications-panel" aria-labelledby="applications-tab">
          <AxisOverviewDashboard
            media={artworkContext}
            bootstrap={props.bootstrap}
            entries={entries}
            findings={findings}
            sections={tab.sections}
            visibleApplications={visible}
            review={
              hasApplicationDetails
                ? (code) => updateParam('offering', code)
                : undefined
            }
            renderers={{
              settings: (component) => (
                <>
                  {findings.length > 0 ? (
                    <Accordion
                      disableGutters
                      elevation={0}
                      sx={{
                        gridColumn: '1 / -1',
                        mb: 3,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: '8px',
                        '&:before': { display: 'none' },
                      }}
                    >
                      <AccordionSummary expandIcon={<ShellIcon name="chevron-down" />}>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          sx={{ alignItems: 'center' }}
                        >
                          <ShellIcon name="info" color="warning" />
                          <Box>
                            <Typography sx={{ fontWeight: 700 }}>
                              {dashboardText(component, 'title')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {findings.length} configuration{' '}
                              {findings.length === 1 ? 'notice' : 'notices'}
                            </Typography>
                          </Box>
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Stack spacing={2}>
                          {findings.map((finding) => (
                            <Box key={finding.code}>
                              <Typography>{finding.message}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {finding.action}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                        <Button
                          disabled={!tabs.some((tab) => tab.view === 'technical')}
                          color="inherit"
                          startIcon={<ShellIcon name="info" />}
                          sx={{ mt: 2 }}
                          onClick={() => updateParam('view', 'technical')}
                        >
                          Review diagnostic details
                        </Button>
                      </AccordionDetails>
                    </Accordion>
                  ) : null}
                </>
              ),
              catalogue: (component) => (
                <Box sx={{ gridColumn: '1 / -1', minWidth: 0 }}>
                  {' '}
                  {!connection ? (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      Application status is unavailable. Restore the BackOffice
                      connection, then refresh.
                    </Alert>
                  ) : null}
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    sx={{
                      alignItems: { sm: 'center' },
                      justifyContent: 'space-between',
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography component="h2" variant="h5">
                        {dashboardText(component, 'title')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {visible.length === applications.length
                          ? `${applications.length} available`
                          : `${visible.length} of ${applications.length} applications`}
                      </Typography>
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        size="small"
                        label="Search applications"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <ShellIcon name="search" fontSize="small" />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                      <TextField
                        select
                        size="small"
                        label="Category"
                        slotProps={{
                          select: { displayEmpty: true },
                          inputLabel: { shrink: true },
                        }}
                        value={category}
                        onChange={(event) =>
                          updateParam('category', event.target.value)
                        }
                        sx={{ minWidth: 150 }}
                      >
                        <MenuItem value="">All categories</MenuItem>
                        {category && !categories.includes(category) ? (
                          <MenuItem value={category} disabled>
                            Unavailable category
                          </MenuItem>
                        ) : null}
                        {categories.map((item) => (
                          <MenuItem key={item} value={item}>
                            {item}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                  </Stack>
                  {!hasApplicationCards && (
                    <Box
                      component="ul"
                      aria-label="Available applications"
                      sx={{
                        listStyle: 'none',
                        m: 0,
                        p: 0,
                        borderTop: 1,
                        borderColor: 'divider',
                      }}
                    >
                      {visible.map(({ profile, query }) => (
                        <Box
                          component="li"
                          key={profile.code}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                              xs: 'minmax(0, 1fr)',
                              md: 'minmax(0, 1fr) 185px 155px',
                            },
                            alignItems: 'center',
                            gap: 2,
                            py: 2.5,
                            px: { xs: 1, sm: 2 },
                            borderBottom: 1,
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            transition: reducedMotion
                              ? 'none'
                              : 'background-color 140ms ease',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={2}
                            sx={{ alignItems: 'center', minWidth: 0 }}
                          >
                            {profile.visual ? (
                              <ApplicationArtwork
                                media={artworkContext}
                                visual={
                                  query?.isError
                                    ? undefined
                                    : query?.data?.profile?.visual
                                }
                              />
                            ) : (
                              <Box
                                sx={{
                                  width: 42,
                                  height: 42,
                                  flexShrink: 0,
                                  display: 'grid',
                                  placeItems: 'center',
                                  bgcolor: 'action.selected',
                                  borderRadius: '6px',
                                }}
                              >
                                <ShellIcon name="module" />
                              </Box>
                            )}
                            <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                              <Typography
                                component="h3"
                                variant="subtitle1"
                                sx={{ fontWeight: 700 }}
                              >
                                {profile.title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {profile.summary}
                              </Typography>
                            </Box>
                          </Stack>
                          <Box aria-live="polite" sx={{ minHeight: 28 }}>
                            {query?.isPending && connection ? (
                              <Skeleton width={125} />
                            ) : (
                              <Chip
                                size="small"
                                variant="outlined"
                                label={
                                  query?.isError
                                    ? 'Status unavailable'
                                    : statusLabel(query?.data)
                                }
                                color={
                                  query?.isError
                                    ? 'warning'
                                    : query?.data?.readiness === 'READY'
                                      ? 'success'
                                      : query?.data?.readiness === 'PUBLICATION_PENDING'
                                        ? 'info'
                                        : 'default'
                                }
                              />
                            )}
                          </Box>
                          <Button
                            color="inherit"
                            variant="outlined"
                            endIcon={<ShellIcon name="chevron-right" />}
                            aria-label={`Review ${profile.title}`}
                            disabled={!hasApplicationDetails}
                            onClick={() => updateParam('offering', profile.code)}
                            sx={{
                              minHeight: 40,
                              justifySelf: { xs: 'start', md: 'stretch' },
                            }}
                          >
                            Review setup
                          </Button>
                        </Box>
                      ))}
                    </Box>
                  )}
                  {visible.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Typography component="h3" variant="h6">
                        {applications.length
                          ? 'No matching applications'
                          : 'No offerings are available for your account'}
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 1 }}>
                        {applications.length
                          ? 'Try another search or category.'
                          : 'Ask your administrator to check the available application catalogue.'}
                      </Typography>
                      {applications.length ? (
                        <Button
                          sx={{ mt: 2 }}
                          onClick={() => {
                            setSearch('');
                            updateParam('category');
                          }}
                        >
                          Clear filters
                        </Button>
                      ) : null}
                    </Box>
                  ) : null}
                </Box>
              ),
              details: (component) => (
                <>
                  {' '}
                  <Drawer
                    anchor="right"
                    sx={{ zIndex: (theme) => theme.zIndex.modal }}
                    open={Boolean(selectedCode) && view === 'applications'}
                    onClose={() => updateParam('offering')}
                    transitionDuration={reducedMotion ? 0 : 200}
                    slotProps={{
                      paper: {
                        role: 'dialog',
                        'aria-modal': true,
                        'aria-labelledby': 'offering-title',
                        sx: {
                          width: { xs: '100%', sm: 560 },
                          maxWidth: '100%',
                          borderRadius: 0,
                        },
                      },
                    }}
                  >
                    <Stack
                      direction="row"
                      sx={{
                        p: 3,
                        gap: 2,
                        flexShrink: 0,
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        borderBottom: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                        <Typography variant="overline" color="text.secondary">
                          Setup review
                        </Typography>
                        <Typography id="offering-title" component="h2" variant="h5">
                          {selected?.profile.title ?? 'Offering unavailable'}
                        </Typography>
                        <Typography
                          color="text.secondary"
                          variant="body2"
                          sx={{ mt: 1 }}
                        >
                          {selected?.profile.summary}
                        </Typography>
                      </Box>
                      <Tooltip title="Close setup review">
                        <IconButton
                          aria-label="Close setup review"
                          onClick={() => updateParam('offering')}
                        >
                          <ShellIcon name="close" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    <Box sx={{ p: 3, flex: 1, minHeight: 0, overflowY: 'auto' }}>
                      {selected?.profile.visual ? (
                        <Box sx={{ mb: 3 }}>
                          <ApplicationArtwork
                            media={artworkContext}
                            visual={
                              selected.query?.isError
                                ? undefined
                                : selected.query?.data?.profile?.visual
                            }
                            large
                          />
                        </Box>
                      ) : null}
                      {!selected ? (
                        <Alert severity="info">
                          This offering is no longer available for your account.
                        </Alert>
                      ) : (
                        <>
                          <Stack
                            direction="row"
                            sx={{
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              mb: 3,
                            }}
                          >
                            <Box aria-live="polite">
                              <Typography variant="body2" color="text.secondary">
                                Publication status
                              </Typography>
                              <Typography sx={{ fontWeight: 700 }}>
                                {selected.query?.isError
                                  ? 'Status unavailable'
                                  : statusLabel(selectedStatus)}
                              </Typography>
                            </Box>
                            <Tooltip title="Refresh selected application">
                              <span>
                                <IconButton
                                  aria-label="Refresh selected application"
                                  disabled={selected.query?.isFetching || !connection}
                                  onClick={() => {
                                    void selected.query?.refetch();
                                  }}
                                >
                                  <ShellIcon name="refresh" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                          {selected.query?.isError ? (
                            <Alert severity="warning" sx={{ mb: 2 }}>
                              Current status could not be checked. Refresh before
                              continuing.
                            </Alert>
                          ) : null}
                          {selectedStatus?.readiness === 'IMPORTING' ? (
                            <LinearProgress
                              aria-label="Application preparation in progress"
                              sx={{ mb: 2 }}
                            />
                          ) : null}
                          <Typography
                            component="h3"
                            variant="subtitle1"
                            sx={{ mb: 2, fontWeight: 700 }}
                          >
                            {dashboardText(component, 'title')}
                          </Typography>
                          {!plan ? (
                            <Alert severity="info">
                              The setup plan is not available from the owning service
                              yet.
                            </Alert>
                          ) : (
                            plan.stages.map((stage, index) => (
                              <Accordion
                                key={`${selected.profile.code}:${stage.code}`}
                                defaultExpanded={index === 0}
                                disableGutters
                                elevation={0}
                                square
                                sx={{
                                  borderBottom: 1,
                                  borderColor: 'divider',
                                  '&:before': { display: 'none' },
                                }}
                              >
                                <AccordionSummary
                                  expandIcon={<ShellIcon name="chevron-down" />}
                                >
                                  <Stack
                                    direction="row"
                                    spacing={1.5}
                                    sx={{ alignItems: 'center' }}
                                  >
                                    <Box
                                      sx={{
                                        width: 28,
                                        height: 28,
                                        flexShrink: 0,
                                        display: 'grid',
                                        placeItems: 'center',
                                        bgcolor: 'action.selected',
                                        borderRadius: '50%',
                                        fontSize: 13,
                                      }}
                                    >
                                      {index + 1}
                                    </Box>
                                    <Box>
                                      <Typography sx={{ fontWeight: 700 }}>
                                        {stage.title}
                                      </Typography>
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                      >
                                        {stage.items.length}{' '}
                                        {stage.items.length === 1
                                          ? 'requirement'
                                          : 'requirements'}
                                      </Typography>
                                    </Box>
                                  </Stack>
                                </AccordionSummary>
                                <AccordionDetails>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mb: 2 }}
                                  >
                                    {stage.summary}
                                  </Typography>
                                  <Stack component="ul" spacing={1.5} sx={{ pl: 2 }}>
                                    {stage.items.map((item) => (
                                      <Box component="li" key={item.code}>
                                        <Typography
                                          variant="body2"
                                          sx={{ overflowWrap: 'anywhere' }}
                                        >
                                          {item.label}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          {item.required ? 'Required' : 'Optional'}
                                        </Typography>
                                      </Box>
                                    ))}
                                  </Stack>
                                </AccordionDetails>
                              </Accordion>
                            ))
                          )}
                          {selectedStatus?.capability?.nextAction ? (
                            <Box
                              sx={{
                                mt: 3,
                                borderLeft: 3,
                                borderColor: 'info.main',
                                pl: 2,
                              }}
                            >
                              <Typography variant="subtitle2">Next step</Typography>
                              <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {selectedStatus.capability.nextAction}
                              </Typography>
                            </Box>
                          ) : null}
                        </>
                      )}
                    </Box>
                    <Divider />
                    <Box sx={{ p: 3, flexShrink: 0 }}>
                      {setupRoute && selected ? (
                        <Button
                          fullWidth
                          variant="contained"
                          endIcon={<ShellIcon name="chevron-right" />}
                          onClick={() => {
                            void navigate(
                              `${setupRoute}?profile=${encodeURIComponent(selected.profile.code)}`,
                            );
                          }}
                        >
                          Continue to setup
                        </Button>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Setup is unavailable for your account. Contact an
                          administrator.
                        </Typography>
                      )}
                    </Box>
                  </Drawer>
                </>
              ),
            }}
          />
        </Box>
      )}
    </WorkspaceContainer>
  );
}
