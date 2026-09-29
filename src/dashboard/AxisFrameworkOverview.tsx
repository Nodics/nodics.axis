import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
} from '../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import type { CmsComponentContract } from '../cms/cmsContract';
import { loadProcessOperationsSummary } from '../operations/processWorkflow/api/processDefinitionClient';
import {
  activeConnections,
  connectionKey,
  loadWorkbenchMetrics,
} from '../operations/shared/workbenchMetricDashboardModel';
import { dashboardText, renderDashboardSections } from './dashboardComposition';
import {
  overviewDomains,
  overviewMetricDefinitions,
  overviewNavigation,
  overviewOpenTasks,
  overviewReferences,
} from './frameworkOverviewModel';

interface Props {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
  readonly sections: readonly CmsComponentContract[];
}
const accents = ['#286a85', '#33765b', '#8b5b94', '#aa652c', '#387b79', '#596cb0'];
const cardSx = {
  border: 1,
  borderColor: 'divider',
  borderRadius: '8px',
  bgcolor: 'background.paper',
  minWidth: 0,
};

/** Business home only. CMS composes it; authenticated owners supply all data and destinations. */
export function AxisFrameworkOverview({
  accessToken,
  bootstrap,
  runtime,
  sections,
}: Props) {
  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const section = (kind: string) =>
    sections.find((item) => item.properties.kind === kind);
  const context = section('context');
  if (!context) throw new Error('Framework Overview requires its CMS context');
  const text = (key: string) => dashboardText(context, key);
  const directory = section('domains');
  const domains = overviewDomains(
    bootstrap.navigation,
    overviewReferences(directory, 'excludedGroups'),
  );
  const visibleDomains = domains.filter((domain) =>
    `${domain.label} ${domain.items.map((item) => item.label).join(' ')}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  const selected = domains.find((domain) => domain.id === selectedDomain);
  const definitions = overviewMetricDefinitions(
    bootstrap.navigation,
    overviewReferences(section('pulse'), 'navigationRefs'),
  );
  const authorized = overviewNavigation(bootstrap.navigation);
  const taskReference = dashboardText(context, 'taskNavigationRef');
  const taskRoute = authorized.find(
    (item) => `${item.moduleName}:${item.id}` === taskReference,
  );
  const processConnection = selectModuleConnection(bootstrap, 'workflow', {
    runtimeRoleCode: 'PROCESS',
  });
  const connections = activeConnections(bootstrap).filter((connection) =>
    definitions.some((definition) => definition.moduleName === connection.moduleName),
  );
  const configuration = {
    accessToken,
    enterpriseCode: runtime.enterpriseCode,
    timeoutMs: runtime.requestTimeoutMs,
  };
  const scope = [bootstrap.tenantCode, runtime.enterpriseCode, accessToken];
  const metrics = useQuery({
    queryKey: [
      'framework-overview-records',
      ...scope,
      connectionKey(connections),
      definitions,
    ],
    enabled: definitions.length > 0 && Boolean(section('pulse')),
    queryFn: () =>
      loadWorkbenchMetrics(connections, bootstrap, configuration, definitions),
    retry: false,
    staleTime: 60_000,
  });
  const process = useQuery({
    queryKey: [
      'framework-overview-work',
      ...scope,
      processConnection?.endpoint,
      processConnection?.instanceId,
    ],
    enabled: Boolean(
      taskRoute &&
      processConnection &&
      sections.some((item) =>
        ['work', 'activity', 'exceptions'].includes(String(item.properties.kind)),
      ),
    ),
    queryFn: () => {
      if (!processConnection || !taskRoute)
        throw new Error('Process workspace unavailable');
      return loadProcessOperationsSummary(processConnection, configuration);
    },
    retry: false,
    staleTime: 60_000,
  });
  const data = process.isError ? undefined : process.data;
  const tasks = overviewOpenTasks(data?.tasks ?? [], process.dataUpdatedAt);
  const states = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of data?.tasks ?? [])
      counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [data]);
  const refreshing = metrics.isFetching || process.isFetching;
  const processUnavailable = !taskRoute || !processConnection || process.isError;
  const processNotice = () =>
    processUnavailable ? (
      <Alert severity="info">{text('workUnavailable')}</Alert>
    ) : process.isPending ? (
      <Skeleton height={100} />
    ) : null;
  const heading = (component: CmsComponentContract, icon: string, count?: number) => (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 2 }}>
      <ShellIcon name={icon} />
      <Typography component="h2" variant="h6" sx={{ flex: 1 }}>
        {dashboardText(component, 'title')}
      </Typography>
      {count !== undefined && <Chip size="small" label={count} />}
    </Stack>
  );
  const workLink = taskRoute ? (
    <Button
      component={RouterLink}
      to={taskRoute.route}
      size="small"
      color="inherit"
      endIcon={<ShellIcon name="chevron-right" />}
    >
      {text('openWork')}
    </Button>
  ) : null;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'repeat(2,minmax(0,1fr))' },
        gap: 3,
        '& p, & h2, & h3, & a': { overflowWrap: 'anywhere' },
      }}
    >
      {renderDashboardSections(sections, {
        context: (component) => (
          <Box
            sx={{
              gridColumn: '1 / -1',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              py: 1,
            }}
          >
            <Box
              component="img"
              src="/brand/application-fallback-v1.png"
              alt=""
              sx={{
                width: 104,
                height: 64,
                objectFit: 'cover',
                borderRadius: '6px',
                display: { xs: 'none', sm: 'block' },
              }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                {runtime.projectCode} · {runtime.enterpriseCode}
              </Typography>
              <Typography variant="h6">{dashboardText(component, 'title')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {text('scope')}
              </Typography>
            </Box>
            <Tooltip title={text('refresh')}>
              <span>
                <IconButton
                  aria-label={text('refresh')}
                  disabled={refreshing}
                  onClick={() => {
                    if (definitions.length) void metrics.refetch();
                    if (taskRoute && processConnection) void process.refetch();
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
          </Box>
        ),
        pulse: (component) => (
          <Box sx={{ gridColumn: '1 / -1' }}>
            {heading(component, 'dashboard')}
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: 'repeat(2,minmax(0,1fr))',
                  md: 'repeat(4,minmax(0,1fr))',
                },
              }}
            >
              {definitions.map((definition, index) => {
                const metric =
                  !metrics.isError &&
                  metrics.data?.find((item) => item.id === definition.id);
                const value =
                  metric && metric.status === 'ready' ? metric.value : undefined;
                const color = accents[index % accents.length]!;
                return (
                  <Box
                    key={definition.id}
                    component={RouterLink}
                    to={definition.route}
                    sx={{
                      ...cardSx,
                      p: 2,
                      color: 'text.primary',
                      textDecoration: 'none',
                      borderTop: `3px solid ${color}`,
                      '&:hover': { bgcolor: 'action.hover' },
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                      },
                    }}
                  >
                    <Stack
                      direction="row"
                      sx={{
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                      }}
                    >
                      <Typography variant="body2">{definition.label}</Typography>
                      <Box sx={{ color }}>
                        <ShellIcon name={definition.icon} />
                      </Box>
                    </Stack>
                    {metrics.isPending ? (
                      <Skeleton width={70} height={52} />
                    ) : (
                      <Typography
                        sx={{
                          fontSize: 34,
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          my: 1,
                        }}
                      >
                        {value === undefined ? '—' : value.toLocaleString()}
                      </Typography>
                    )}
                    <Stack
                      direction="row"
                      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {value === undefined ? text('unavailable') : text('records')}
                      </Typography>
                      <ShellIcon name="chevron-right" />
                    </Stack>
                  </Box>
                );
              })}
            </Box>
            {!definitions.length && <Alert severity="info">{text('noMetrics')}</Alert>}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1 }}
            >
              {dashboardText(component, 'description')}
              {metrics.dataUpdatedAt > 0
                ? ` · ${text('updated')} ${new Date(metrics.dataUpdatedAt).toLocaleTimeString()}`
                : ''}
            </Typography>
          </Box>
        ),
        domains: (component) => (
          <Box
            sx={{ gridColumn: '1 / -1', borderTop: 1, borderColor: 'divider', pt: 3 }}
          >
            {heading(component, 'module', domains.length)}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              sx={{
                alignItems: { sm: 'center' },
                justifyContent: 'space-between',
                gap: 2,
                mb: 2,
              }}
            >
              <Typography color="text.secondary" variant="body2">
                {dashboardText(component, 'description')}
              </Typography>
              <TextField
                size="small"
                label={text('search')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                sx={{ width: { xs: '100%', sm: 300 } }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <ShellIcon name="search" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0,1fr)',
                  sm: 'repeat(2,minmax(0,1fr))',
                  xl: 'repeat(3,minmax(0,1fr))',
                },
                gap: 2,
              }}
            >
              {visibleDomains.map((domain, index) => {
                const color = accents[index % accents.length]!;
                const quickLinks = domain.items
                  .filter((item) => item.route !== domain.entry.route)
                  .slice(0, 2);
                return (
                  <Box
                    component="article"
                    key={domain.id}
                    sx={{ ...cardSx, display: 'flex', flexDirection: 'column', p: 2.5 }}
                  >
                    <Stack
                      direction="row"
                      sx={{ alignItems: 'center', gap: 1.5, mb: 1.5 }}
                    >
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          flex: '0 0 44px',
                          borderRadius: '8px',
                          bgcolor: alpha(color, 0.12),
                          color,
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <ShellIcon name={domain.entry.icon} />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography component="h3" variant="h6">
                          {domain.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {domain.items.length} {text('destinations')}
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {domain.entry.help?.summary ?? domain.entry.label}
                    </Typography>
                    <Stack sx={{ gap: 0.5, mb: 2 }}>
                      {quickLinks.map((item) => (
                        <Button
                          key={`${item.moduleName}:${item.id}`}
                          component={RouterLink}
                          to={item.route}
                          color="inherit"
                          size="small"
                          endIcon={<ShellIcon name="chevron-right" />}
                          sx={{ justifyContent: 'space-between', textAlign: 'left' }}
                        >
                          {item.label}
                        </Button>
                      ))}
                    </Stack>
                    <Stack
                      direction="row"
                      sx={{
                        gap: 1,
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mt: 'auto',
                        flexWrap: 'wrap',
                      }}
                    >
                      <Button
                        component={RouterLink}
                        to={domain.entry.route}
                        variant="outlined"
                        color="inherit"
                        size="small"
                        endIcon={<ShellIcon name="chevron-right" />}
                      >
                        {text('openDashboard')}
                      </Button>
                      <Button
                        size="small"
                        color="inherit"
                        onClick={() => setSelectedDomain(domain.id)}
                      >
                        {text('allViews')}
                      </Button>
                    </Stack>
                  </Box>
                );
              })}
            </Box>
            {!visibleDomains.length && (
              <Alert severity="info">{text(search ? 'noResults' : 'noDomains')}</Alert>
            )}
          </Box>
        ),
        work: (component) => (
          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 3, minWidth: 0 }}>
            {heading(component, 'tasks', data ? tasks.length : undefined)}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {dashboardText(component, 'description')}
            </Typography>
            {processNotice()}
            {data && (
              <>
                <Stack direction="row" sx={{ gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Chip
                    label={`${tasks.filter((task) => task.status === 'ESCALATED').length} ${text('escalated')}`}
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                  <Chip
                    label={`${tasks.filter((task) => task.dueAt && Date.parse(task.dueAt) < process.dataUpdatedAt).length} ${text('overdue')}`}
                    size="small"
                    variant="outlined"
                  />
                </Stack>
                {tasks.slice(0, 5).map((task) => (
                  <Box
                    key={task.code}
                    sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
                    >
                      {task.nodeCode ?? task.code}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {task.instanceCode ?? task.code}
                    </Typography>
                    <Stack
                      direction="row"
                      sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap', mt: 0.5 }}
                    >
                      <Chip label={task.status} size="small" variant="outlined" />
                      {task.dueAt && (
                        <Typography variant="caption">
                          {text('due')} {new Date(task.dueAt).toLocaleDateString()}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                ))}
                {!tasks.length && <Alert severity="success">{text('noTasks')}</Alert>}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', my: 1.5 }}
                >
                  {text('bounded')}
                </Typography>
              </>
            )}
            {workLink}
          </Box>
        ),
        activity: (component) => (
          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 3, minWidth: 0 }}>
            {heading(component, 'workflow')}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {dashboardText(component, 'description')}
            </Typography>
            {processNotice()}
            {data && (
              <>
                <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
                  <Box>
                    <Typography sx={{ fontSize: 34, fontWeight: 700 }}>
                      {data.tasks.length}
                    </Typography>
                    <Typography variant="caption">{text('observedTasks')}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 34, fontWeight: 700 }}>
                      {data.instances.length}
                    </Typography>
                    <Typography variant="caption">
                      {text('observedProcesses')}
                    </Typography>
                  </Box>
                </Box>
                {states.map(([state, count], index) => (
                  <Box key={state} sx={{ mb: 2 }}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: 'space-between', mb: 0.5 }}
                    >
                      <Typography variant="body2">{state}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {count}
                      </Typography>
                    </Stack>
                    <Box
                      role="img"
                      aria-label={`${state}: ${count} / ${data.tasks.length}`}
                      sx={{
                        height: 12,
                        bgcolor: 'action.hover',
                        borderRadius: '3px',
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          width: `${(count / data.tasks.length) * 100}%`,
                          bgcolor: accents[index % accents.length],
                        }}
                      />
                    </Box>
                  </Box>
                ))}
                {!states.length && <Alert severity="info">{text('noActivity')}</Alert>}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 2 }}
                >
                  {text('bounded')} · {text('updated')}{' '}
                  {new Date(process.dataUpdatedAt).toLocaleTimeString()}
                </Typography>
              </>
            )}
          </Box>
        ),
        exceptions: (component) => (
          <Box
            sx={{ gridColumn: '1 / -1', borderTop: 1, borderColor: 'divider', pt: 3 }}
          >
            {heading(component, 'info', data?.incidents.length)}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {dashboardText(component, 'description')}
            </Typography>
            {processNotice()}
            {data && (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'minmax(0,1fr)',
                      md: 'repeat(2,minmax(0,1fr))',
                    },
                    gap: 2,
                  }}
                >
                  {data.incidents.slice(0, 6).map((incident) => (
                    <Box key={incident.code} sx={{ ...cardSx, p: 2 }}>
                      <Stack
                        direction="row"
                        sx={{ justifyContent: 'space-between', gap: 1 }}
                      >
                        <Typography variant="subtitle2">
                          {incident.errorCode}
                        </Typography>
                        <Chip label={incident.status} size="small" variant="outlined" />
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ mt: 1, overflowWrap: 'anywhere' }}
                      >
                        {incident.instanceCode}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {incident.nodeCode}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                {!data.incidents.length && (
                  <Alert severity="success">{text('noExceptions')}</Alert>
                )}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 1 }}
                >
                  {text('bounded')}
                </Typography>
              </>
            )}
            {workLink}
          </Box>
        ),
      })}
      <Drawer
        anchor="right"
        open={Boolean(selected)}
        onClose={() => setSelectedDomain(null)}
        slotProps={{
          paper: {
            'aria-label': selected?.label,
            sx: { width: { xs: '100%', sm: 460 }, maxWidth: '100%', p: 3 },
          },
        }}
      >
        {selected && (
          <>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography component="h2" variant="h6" sx={{ flex: 1 }}>
                {selected.label}
              </Typography>
              <IconButton
                aria-label={text('close')}
                onClick={() => setSelectedDomain(null)}
              >
                <ShellIcon name="close" />
              </IconButton>
            </Stack>
            <Stack spacing={1}>
              {selected.items.map((item) => (
                <Button
                  key={`${item.moduleName}:${item.id}`}
                  component={RouterLink}
                  to={item.route}
                  color="inherit"
                  endIcon={<ShellIcon name="chevron-right" />}
                  sx={{ justifyContent: 'space-between', textAlign: 'left' }}
                >
                  {item.label}
                </Button>
              ))}
            </Stack>
          </>
        )}
      </Drawer>
    </Box>
  );
}
