import { useRef, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
  alpha,
} from '@mui/material';
import type { AxisAuthenticatedBootstrap } from '../bootstrap/publicBootstrap';
import type { CmsComponentContract } from '../cms/cmsContract';
import { ShellIcon } from '../app/shell/ShellIcon';
import {
  ApplicationArtwork,
  type ApplicationArtworkContext,
} from './ApplicationArtwork';
import { isDocumentation, overviewState, type Entry } from './overviewStatus';
import {
  dashboardAreas,
  dashboardText,
  renderDashboardSections,
} from './dashboardComposition';

interface Props {
  readonly media?: ApplicationArtworkContext;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly entries: readonly Entry[];
  readonly findings: NonNullable<
    AxisAuthenticatedBootstrap['startupValidation']
  >['findings'];
  readonly sections: readonly CmsComponentContract[];
  readonly review: ((code: string) => void) | undefined;
  readonly visibleApplications?: readonly Entry[];
  readonly renderers?: Readonly<
    Record<string, (component: CmsComponentContract) => ReactNode>
  >;
}

/** Presentation of authorized evidence; CMS decides which sections are present. */
export function AxisOverviewDashboard({
  bootstrap,
  entries: allEntries,
  findings,
  sections,
  review,
  media,
  visibleApplications,
  renderers,
}: Props) {
  const theme = useTheme();
  const strip = useRef<HTMLDivElement>(null);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const entries = allEntries.filter((entry) => !isDocumentation(entry));
  const documentation = allEntries.filter(isDocumentation);
  const displayedApplications = visibleApplications ?? entries;
  const groups = [
    'published',
    'approval',
    'preparing',
    'available',
    'blocked',
    'unknown',
  ] as const;
  const colors = [
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.info.main,
    theme.palette.grey[400],
    theme.palette.error.main,
    theme.palette.grey[600],
  ];
  const counts = groups.map(
    (group) => entries.filter((entry) => overviewState(entry) === group).length,
  );
  const attention = entries.filter(
    (entry) => !['published', 'available'].includes(overviewState(entry)),
  );
  const orderedFindings = [...findings].sort(
    (a, b) =>
      ['ERROR', 'WARNING', 'INFO'].indexOf(a.severity) -
      ['ERROR', 'WARNING', 'INFO'].indexOf(b.severity),
  );
  const label = (component: CmsComponentContract, state: string) =>
    dashboardText(
      component,
      typeof component.properties[state] === 'string' ? state : 'unknown',
    );
  const status = (component: CmsComponentContract, entry: Entry) => {
    const state = overviewState(entry);
    return (
      <Chip
        size="small"
        variant="outlined"
        label={label(component, state)}
        color={
          state === 'published'
            ? 'success'
            : state === 'blocked'
              ? 'error'
              : state === 'approval'
                ? 'warning'
                : 'default'
        }
        sx={{
          height: 'auto',
          minHeight: 26,
          maxWidth: '100%',
          '& .MuiChip-label': { whiteSpace: 'normal', py: 0.3 },
        }}
      />
    );
  };
  const heading = (
    component: CmsComponentContract,
    icon: string,
    trailing?: ReactNode,
  ) => (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, mb: 2 }}>
      <ShellIcon name={icon} sx={{ color: 'text.secondary' }} />
      <Typography component="h2" sx={{ fontWeight: 700, fontSize: 18, flex: 1 }}>
        {dashboardText(component, 'title')}
      </Typography>
      {trailing}
    </Stack>
  );
  const section = (
    component: CmsComponentContract,
    children: ReactNode,
    half = false,
  ) => (
    <Box
      component="section"
      aria-label={dashboardText(component, 'title')}
      sx={{
        minWidth: 0,
        gridColumn: { xs: '1 / -1', lg: half ? 'span 1' : '1 / -1' },
        borderTop: 1,
        borderColor: 'divider',
        pt: 2.5,
      }}
    >
      {children}
    </Box>
  );
  const move = (direction: number) =>
    strip.current?.scrollBy({
      left: direction * strip.current.clientWidth * 0.8,
      behavior: reducedMotion ? 'instant' : 'smooth',
    });
  // A dashboard link cannot introduce navigation that the employee was not granted.
  const canOpen = (route: string) =>
    route.startsWith('/') &&
    !route.startsWith('//') &&
    bootstrap.navigation.some(
      (item) =>
        item.route === route &&
        ['UP', 'DEGRADED'].includes(item.availability) &&
        (!item.featureState || item.featureState === 'ACTIVE'),
    );
  let position = 0;
  const segments = counts.map((count, index) => {
    const start = position;
    position += entries.length ? (count / entries.length) * 100 : 0;
    return colors[index] + ' ' + start + '% ' + position + '%';
  });
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' },
        gap: 3,
        minWidth: 0,
      }}
    >
      {renderDashboardSections(sections, {
        metrics: (component) => (
          <Box
            component="section"
            aria-label={dashboardText(component, 'title')}
            sx={{ gridColumn: '1 / -1', minWidth: 0 }}
          >
            {heading(component, 'dashboard')}
            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: {
                  xs: 'repeat(2,minmax(0,1fr))',
                  md: 'repeat(4,minmax(0,1fr))',
                },
              }}
            >
              {[
                {
                  key: 'published',
                  value: counts[0],
                  color: colors[0],
                  icon: 'approve',
                },
                {
                  key: 'preparing',
                  value: counts[2],
                  color: colors[2],
                  icon: 'module',
                },
                {
                  key: 'approval',
                  value: counts[1],
                  color: colors[1],
                  icon: 'history',
                },
                {
                  key: 'configuration',
                  value: findings.length,
                  color: colors[4],
                  icon: 'info',
                },
              ].map((metric) => (
                <Box
                  key={metric.key}
                  sx={{
                    p: 2,
                    minWidth: 0,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: '6px',
                    bgcolor: 'background.paper',
                    borderTop: '3px solid ' + metric.color,
                  }}
                >
                  <Stack
                    direction="row"
                    sx={{
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 1,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: 30,
                        fontWeight: 700,
                        lineHeight: 1.2,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {metric.value}
                    </Typography>
                    <ShellIcon name={metric.icon} sx={{ color: metric.color }} />
                  </Stack>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {dashboardText(component, metric.key)}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1 }}
            >
              {entries.length - (counts[5] ?? 0)} / {entries.length}{' '}
              {dashboardText(component, 'checked')}
            </Typography>
            {counts[5] ? (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {dashboardText(component, 'incomplete')}
              </Alert>
            ) : null}
          </Box>
        ),
        applications: (component) =>
          section(
            component,
            <>
              {heading(
                component,
                'module',
                <Stack direction="row">
                  {[-1, 1].map((direction) => (
                    <Tooltip
                      key={direction}
                      title={dashboardText(
                        component,
                        direction < 0 ? 'previous' : 'next',
                      )}
                    >
                      <span>
                        <IconButton
                          disabled={!displayedApplications.length}
                          aria-label={dashboardText(
                            component,
                            direction < 0 ? 'previous' : 'next',
                          )}
                          onClick={() => move(direction)}
                        >
                          <ShellIcon
                            name={direction < 0 ? 'chevron-left' : 'chevron-right'}
                          />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ))}
                </Stack>,
              )}
              <Box
                ref={strip}
                tabIndex={0}
                role="region"
                aria-label={dashboardText(component, 'title')}
                sx={{
                  display: 'flex',
                  gap: 2,
                  overflowX: 'auto',
                  pb: 1.5,
                  scrollSnapType: 'x proximity',
                }}
              >
                {displayedApplications.map((entry) => {
                  const steps = entry.query?.data?.preparation?.steps ?? [];
                  const complete = steps.filter((step) =>
                    ['CURRENT', 'SOURCE_READY'].includes(step.status ?? ''),
                  ).length;
                  return (
                    <Box
                      key={entry.profile.code}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        bgcolor: 'background.paper',
                        scrollSnapAlign: 'start',
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: 0,
                        flex: { xs: '0 0 88%', sm: '0 0 47%', lg: '0 0 32%' },
                      }}
                    >
                      <ApplicationArtwork
                        visual={
                          entry.query?.isError
                            ? undefined
                            : entry.query?.data?.profile?.visual
                        }
                        media={media}
                        large
                      />
                      <Stack
                        spacing={1.25}
                        sx={{ p: 2, flexGrow: 1, alignItems: 'start' }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {entry.profile.category}
                        </Typography>
                        <Typography
                          component="h3"
                          sx={{
                            fontSize: 17,
                            fontWeight: 700,
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {entry.profile.title}
                        </Typography>
                        {status(component, entry)}
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ flexGrow: 1 }}
                        >
                          {entry.profile.summary}
                        </Typography>
                        {steps.length && overviewState(entry) !== 'unknown' ? (
                          <Box sx={{ width: '100%' }}>
                            <Typography variant="caption" color="text.secondary">
                              {complete} / {steps.length}{' '}
                              {dashboardText(component, 'steps')}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={(complete / steps.length) * 100}
                              aria-label={
                                entry.profile.title +
                                ': ' +
                                dashboardText(component, 'steps')
                              }
                              sx={{ mt: 0.75, height: 5, borderRadius: 1 }}
                            />
                          </Box>
                        ) : null}
                        {review ? (
                          <Button
                            color="inherit"
                            variant="outlined"
                            fullWidth
                            endIcon={<ShellIcon name="chevron-right" />}
                            onClick={() => review(entry.profile.code)}
                          >
                            {dashboardText(component, 'review')}
                          </Button>
                        ) : null}
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
              {!entries.length && (
                <Typography color="text.secondary">
                  {dashboardText(component, 'empty')}
                </Typography>
              )}
            </>,
          ),
        readiness: (component) =>
          section(
            component,
            <>
              {heading(component, 'dashboard')}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '164px minmax(0,1fr)' },
                  alignItems: 'center',
                  gap: { xs: 2, sm: 2.5 },
                  py: 1,
                }}
              >
                <Box
                  role="img"
                  aria-label={groups
                    .map((group, i) => label(component, group) + ': ' + counts[i])
                    .join(', ')}
                  sx={{
                    width: 164,
                    height: 164,
                    borderRadius: '50%',
                    justifySelf: 'center',
                    display: 'grid',
                    placeItems: 'center',
                    background: entries.length
                      ? 'conic-gradient(' + segments.join(',') + ')'
                      : theme.palette.action.hover,
                  }}
                >
                  <Box
                    sx={{
                      width: 136,
                      height: 136,
                      borderRadius: '50%',
                      bgcolor: 'background.default',
                      display: 'grid',
                      placeContent: 'center',
                      textAlign: 'center',
                      p: 1,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: 34,
                        fontWeight: 700,
                        lineHeight: 1.2,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {entries.length
                        ? Math.round(((counts[0] ?? 0) / entries.length) * 100) + '%'
                        : '-'}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
                    >
                      {dashboardText(component, 'published')}
                    </Typography>
                  </Box>
                </Box>
                <Stack
                  component="ul"
                  spacing={0}
                  sx={{ listStyle: 'none', m: 0, p: 0 }}
                >
                  {groups.map((group, i) => (
                    <Stack
                      component="li"
                      key={group}
                      direction="row"
                      sx={{
                        gap: 1.25,
                        alignItems: 'center',
                        minHeight: 44,
                        py: 0.75,
                        borderBottom: 1,
                        borderColor: 'divider',
                        '&:last-child': { borderBottom: 0 },
                      }}
                    >
                      <Box
                        aria-hidden
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '2px',
                          bgcolor: colors[i],
                          flexShrink: 0,
                        }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            overflowWrap: 'anywhere',
                            fontWeight: counts[i] ? 600 : 400,
                            color: counts[i] ? 'text.primary' : 'text.secondary',
                          }}
                        >
                          {label(component, group)}
                        </Typography>
                        <Box
                          aria-hidden
                          sx={{
                            height: 3,
                            mt: 0.75,
                            bgcolor: 'action.hover',
                            borderRadius: 1,
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              height: '100%',
                              width: entries.length
                                ? `${((counts[i] ?? 0) / entries.length) * 100}%`
                                : '0%',
                              bgcolor: colors[i],
                            }}
                          />
                        </Box>
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          minWidth: 32,
                          px: 0.5,
                          py: 0.25,
                          textAlign: 'center',
                          borderRadius: '4px',
                          bgcolor: counts[i] ? alpha(colors[i]!, 0.1) : 'transparent',
                          color: counts[i] ? 'text.primary' : 'text.secondary',
                        }}
                      >
                        {counts[i]}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  mt: 2,
                  pt: 1.5,
                  borderTop: 1,
                  borderColor: 'divider',
                  lineHeight: 1.6,
                }}
              >
                {dashboardText(component, 'description')}
              </Typography>
            </>,
            true,
          ),
        attention: (component) =>
          section(
            component,
            <>
              {heading(
                component,
                'info',
                <Chip size="small" label={findings.length + attention.length} />,
              )}
              <Stack spacing={1}>
                {orderedFindings.map((finding) => (
                  <Box
                    key={finding.code}
                    component="details"
                    sx={{
                      border: 1,
                      borderColor: alpha(
                        theme.palette[
                          finding.severity === 'ERROR'
                            ? 'error'
                            : finding.severity === 'INFO'
                              ? 'info'
                              : 'warning'
                        ].main,
                        0.25,
                      ),
                      bgcolor: alpha(
                        theme.palette[
                          finding.severity === 'ERROR'
                            ? 'error'
                            : finding.severity === 'INFO'
                              ? 'info'
                              : 'warning'
                        ].main,
                        0.06,
                      ),
                      borderRadius: '6px',
                      px: 1.5,
                      '&[open] .finding-chevron': { transform: 'rotate(180deg)' },
                    }}
                  >
                    <Box
                      component="summary"
                      sx={{
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        minHeight: 52,
                        py: 1.25,
                        listStyle: 'none',
                        '&::-webkit-details-marker': { display: 'none' },
                        '&:focus-visible': {
                          outline: '2px solid',
                          outlineColor: 'primary.main',
                        },
                      }}
                    >
                      <ShellIcon
                        name="info"
                        color={
                          finding.severity === 'ERROR'
                            ? 'error'
                            : finding.severity === 'INFO'
                              ? 'info'
                              : 'warning'
                        }
                        sx={{ fontSize: 20, flexShrink: 0 }}
                      />
                      <Box
                        component="span"
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          overflowWrap: 'anywhere',
                          lineHeight: 1.5,
                        }}
                      >
                        {finding.message}
                      </Box>
                      <ShellIcon
                        name="chevron-down"
                        className="finding-chevron"
                        sx={{ fontSize: 20, flexShrink: 0, color: 'text.secondary' }}
                      />
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ pb: 1, overflowWrap: 'anywhere' }}
                    >
                      {finding.action}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', pb: 1.5, overflowWrap: 'anywhere' }}
                    >
                      {finding.owner}
                    </Typography>
                  </Box>
                ))}
                {attention.map((entry) => (
                  <Box
                    key={entry.profile.code}
                    component={review ? ButtonBase : 'div'}
                    {...(review
                      ? {
                          onClick: () => review(entry.profile.code),
                          'aria-label':
                            dashboardText(component, 'review') +
                            ': ' +
                            entry.profile.title,
                        }
                      : {})}
                    sx={{
                      display: 'flex',
                      width: '100%',
                      textAlign: 'start',
                      gap: 1.5,
                      alignItems: 'center',
                      borderBottom: 1,
                      borderColor: 'divider',
                      px: 1,
                      py: 1.25,
                      minHeight: 68,
                      ...(review
                        ? {
                            '&:hover': { bgcolor: 'action.hover' },
                            '&:focus-visible': {
                              outline: '2px solid',
                              outlineColor: 'primary.main',
                              outlineOffset: -2,
                            },
                          }
                        : {}),
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        width: 32,
                        height: 32,
                        flexShrink: 0,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: '6px',
                        bgcolor: alpha(
                          colors[groups.indexOf(overviewState(entry))]!,
                          0.08,
                        ),
                        color: colors[groups.indexOf(overviewState(entry))],
                      }}
                    >
                      <ShellIcon
                        name={
                          overviewState(entry) === 'approval'
                            ? 'history'
                            : overviewState(entry) === 'unknown'
                              ? 'info'
                              : 'module'
                        }
                        sx={{ fontSize: 18 }}
                      />
                    </Box>
                    <Box
                      component="span"
                      sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}
                    >
                      <Typography
                        component="span"
                        variant="subtitle2"
                        sx={{ display: 'block', fontWeight: 600 }}
                      >
                        {entry.profile.title}
                      </Typography>
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          display: 'block',
                          fontSize: 13,
                          mt: 0.25,
                          lineHeight: 1.5,
                        }}
                      >
                        {overviewState(entry) === 'unknown'
                          ? dashboardText(component, 'unknown')
                          : entry.query?.data?.capability?.nextAction ||
                            dashboardText(component, 'review')}
                      </Typography>
                    </Box>
                    {review && (
                      <ShellIcon
                        name="chevron-right"
                        sx={{ color: 'text.secondary', fontSize: 20, flexShrink: 0 }}
                      />
                    )}
                  </Box>
                ))}
                {!findings.length && !attention.length && (
                  <Alert severity="success">{dashboardText(component, 'empty')}</Alert>
                )}
              </Stack>
            </>,
            true,
          ),
        operations: (component) =>
          section(
            component,
            <>
              {heading(component, 'health')}
              {bootstrap.operationalReadiness?.checkedAt && (
                <Typography variant="caption" color="text.secondary">
                  {dashboardText(component, 'checked')}{' '}
                  {new Date(bootstrap.operationalReadiness.checkedAt).toLocaleString()}
                </Typography>
              )}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: 'repeat(2,minmax(0,1fr))',
                    lg: 'repeat(3,minmax(0,1fr))',
                  },
                  gap: 2,
                  mt: 1.5,
                }}
              >
                {dashboardAreas(component).map((area) => {
                  const item = bootstrap.operationalReadiness?.sections.find(
                    (item) => item.key === area.key,
                  );
                  const value = item?.summary[area.metric];
                  return (
                    <Box
                      key={area.key}
                      sx={{
                        minWidth: 0,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: '6px',
                        p: 2,
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Stack
                        direction="row"
                        sx={{ alignItems: 'start', gap: 1, mb: 1 }}
                      >
                        <Typography component="h3" variant="subtitle2" sx={{ flex: 1 }}>
                          {area.title}
                        </Typography>
                        <ShellIcon
                          name={item?.businessStatus === 'READY' ? 'approve' : 'info'}
                          color={
                            item?.businessStatus === 'READY' ? 'success' : 'warning'
                          }
                        />
                      </Stack>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {dashboardText(
                          component,
                          item?.businessStatus === 'READY'
                            ? 'ready'
                            : item?.businessStatus === 'NEEDS_ATTENTION'
                              ? 'needsAttention'
                              : 'unknown',
                        )}
                      </Typography>
                      <Stack
                        direction="row"
                        sx={{ alignItems: 'baseline', gap: 1, mt: 1.5 }}
                      >
                        <Typography sx={{ fontSize: 26, fontWeight: 700 }}>
                          {typeof value === 'number' && Number.isFinite(value)
                            ? value
                            : '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {area.label}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.75 }}
                      >
                        {item?.nextAction || dashboardText(component, 'empty')}
                      </Typography>
                      {item && item.blockers.length > 0 && (
                        <Box component="details" sx={{ mt: 1.5 }}>
                          <Typography
                            component="summary"
                            variant="body2"
                            sx={{ cursor: 'pointer' }}
                          >
                            {item.blockers.length} {dashboardText(component, 'details')}
                          </Typography>
                          {item.blockers.map((blocker, index) => (
                            <Typography
                              key={blocker.code + index}
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 1 }}
                            >
                              {blocker.businessImpact || blocker.message}
                            </Typography>
                          ))}
                        </Box>
                      )}
                      {item && canOpen(item.route) && (
                        <Button
                          component={RouterLink}
                          to={item.route}
                          color="inherit"
                          size="small"
                          sx={{ mt: 1.5 }}
                          endIcon={<ShellIcon name="chevron-right" />}
                        >
                          {dashboardText(component, 'review')}
                        </Button>
                      )}
                    </Box>
                  );
                })}
              </Box>
              {!bootstrap.operationalReadiness?.sections.length && (
                <Alert severity="info">{dashboardText(component, 'empty')}</Alert>
              )}
            </>,
          ),
        documentation: (component) =>
          section(
            component,
            <>
              {heading(component, 'content')}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(3,minmax(0,1fr))' },
                  gap: 2,
                }}
              >
                {documentation.map((entry) => (
                  <Stack
                    key={entry.profile.code}
                    sx={{
                      minWidth: 0,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: '6px',
                      bgcolor: 'background.paper',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      component="img"
                      src="/brand/documentation-cover-v2.png"
                      alt=""
                      loading="lazy"
                      decoding="async"
                      sx={{
                        display: 'block',
                        width: '100%',
                        height: 168,
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                    <Stack
                      spacing={1.25}
                      sx={{ p: 2, flex: 1, minWidth: 0, alignItems: 'start' }}
                    >
                      <Typography component="h3" variant="subtitle2">
                        {entry.profile.title}
                      </Typography>
                      {status(component, entry)}
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ flex: 1 }}
                      >
                        {entry.profile.summary}
                      </Typography>
                      {canOpen(dashboardText(component, 'route')) && (
                        <Button
                          component={RouterLink}
                          to={
                            dashboardText(component, 'route') +
                            '?profile=' +
                            encodeURIComponent(entry.profile.code)
                          }
                          color="inherit"
                          endIcon={<ShellIcon name="chevron-right" />}
                        >
                          {dashboardText(component, 'review')}
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                ))}
              </Box>
              {!documentation.length && (
                <Typography color="text.secondary">
                  {dashboardText(component, 'empty')}
                </Typography>
              )}
            </>,
          ),
        ...renderers,
      })}
    </Box>
  );
}
