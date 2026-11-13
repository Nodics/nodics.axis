import {
  Avatar,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { PaletteMode } from '@mui/material/styles';
import { useState, type MouseEvent, type ReactNode } from 'react';

import type { AxisNavigationItem } from '../../bootstrap/publicBootstrap';
import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import { AxisMark } from './AxisMark';
import { RecentPagesMenu } from './RecentPagesMenu';
import { ShellIcon } from './ShellIcon';
import type { ShellNavigationItem } from './shellNavigation';

interface TopNavigationProps {
  readonly workspaceTools?: ReactNode;
  readonly assistant?: AxisNavigationItem | undefined;
  readonly contextItems: readonly string[];
  readonly technicalContextItems?: readonly string[];
  readonly employeeId?: string | undefined;
  readonly navigationToggleLabel: string;
  readonly recentItems: readonly ShellNavigationItem[];
  readonly colorMode: PaletteMode;
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
  readonly onNavigate: (route: string) => void;
  readonly onToggleNavigation: () => void;
  readonly onToggleColorMode: () => void;
  readonly onLock?: (() => void) | undefined;
  readonly onLogout?: (() => void) | undefined;
}

const utilityActionSx = {
  height: 44,
  width: 44,
  p: 0,
} as const;

const responsiveUtilityActionSx = {
  ...utilityActionSx,
  display: { xs: 'none', sm: 'inline-flex' },
} as const;

const utilityIconSx = {
  fontSize: 26,
} as const;

const parseContextItem = (item: string) => {
  const separatorIndex = item.indexOf(':');
  if (separatorIndex === -1) {
    return { label: 'Context', value: item };
  }
  return {
    label: item.slice(0, separatorIndex).trim(),
    value: item.slice(separatorIndex + 1).trim(),
  };
};

export function TopNavigation({
  assistant,
  workspaceTools,
  contextItems,
  technicalContextItems = [],
  employeeId,
  navigationToggleLabel,
  colorMode,
  onLock,
  onLogout,
  onNavigate,
  onToggleNavigation,
  onToggleColorMode,
  onQueryChange,
  query,
  recentItems,
}: TopNavigationProps) {
  const { format: workflowText } = useAxisLocalization();
  const localization = useAxisLocalization();
  const navigationSearchLabel = localization.format(
    'common.search-navigation',
    'Search navigation',
  );
  const languageLabel = localization.format(
    'common.change-language',
    'Change language',
  );
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const initials = employeeId?.slice(0, 2).toLocaleUpperCase() ?? 'AX';
  const assistantActive =
    assistant !== undefined && ['UP', 'DEGRADED'].includes(assistant.availability);
  const contextRows = contextItems.map(parseContextItem);
  const visibleContext = contextRows
    .map(({ label, value }) =>
      ['Enterprise code', 'Environments'].includes(label)
        ? `${workflowText('axis.context.' + label.toLowerCase().replaceAll(' ', '-'), label)}: ${value}`
        : value,
    )
    .join(' · ');
  const technicalRows = technicalContextItems.map(parseContextItem);

  return (
    <Stack
      direction="row"
      spacing={{ xs: 0.5, sm: 1 }}
      sx={{ alignItems: 'center', minWidth: 0, width: '100%' }}
    >
      <Tooltip title={navigationToggleLabel}>
        <IconButton
          aria-label={navigationToggleLabel}
          edge="start"
          onClick={onToggleNavigation}
        >
          <ShellIcon name="menu" />
        </IconButton>
      </Tooltip>
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <AxisMark compact reverse={colorMode === 'dark'} />
      </Box>
      <TextField
        aria-label={navigationSearchLabel}
        placeholder={navigationSearchLabel}
        size="small"
        value={query}
        sx={{
          display: { xs: 'none', sm: 'flex' },
          maxWidth: 360,
          minWidth: 220,
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <ShellIcon color="action" fontSize="small" name="search" />
              </InputAdornment>
            ),
          },
        }}
        onChange={(event) => {
          onQueryChange(event.target.value);
        }}
      />
      <Stack
        direction="row"
        spacing={{ xs: 0.25, sm: 0.5 }}
        sx={{ alignItems: 'center', flexShrink: 0, ml: 'auto !important' }}
      >
        {workspaceTools}
        {assistant ? (
          <Tooltip title={assistant.label}>
            <span>
              <IconButton
                aria-label={assistant.label}
                disabled={!assistantActive}
                onClick={() => {
                  onNavigate(assistant.route);
                }}
                sx={responsiveUtilityActionSx}
              >
                <ShellIcon
                  color={assistantActive ? 'primary' : 'disabled'}
                  name={assistant.icon}
                  sx={{ fontSize: 32 }}
                />
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
        {localization.supportedLocales.length > 1 ? (
          <Tooltip title={languageLabel}>
            <Button
              aria-label={`${languageLabel}: ${localization.locale.toLocaleUpperCase()}`}
              onClick={() => {
                const index = localization.supportedLocales.indexOf(
                  localization.locale,
                );
                localization.setLocale(
                  localization.supportedLocales[
                    (index + 1) % localization.supportedLocales.length
                  ] ?? localization.locale,
                );
              }}
              size="small"
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              {localization.locale.toLocaleUpperCase()}
            </Button>
          </Tooltip>
        ) : null}
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <RecentPagesMenu items={recentItems} onNavigate={onNavigate} />
        </Box>
        <Tooltip
          arrow
          enterDelay={200}
          placement="bottom-end"
          slotProps={{
            arrow: {
              sx: {
                color: 'background.paper',
                '&::before': {
                  border: '1px solid',
                  borderColor: 'divider',
                  boxSizing: 'border-box',
                },
              },
            },
            tooltip: {
              sx: {
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                boxShadow: (currentTheme) => currentTheme.shadows[8],
                color: 'text.primary',
                maxWidth: 'min(360px, calc(100vw - 32px))',
                p: 0,
              },
            },
          }}
          title={
            <Box
              sx={{
                minWidth: 0,
                width: { xs: 'calc(100vw - 32px)', sm: 360 },
                maxWidth: '100%',
                boxSizing: 'border-box',
                p: 2,
              }}
            >
              <Stack spacing={0.5}>
                <Typography
                  sx={{
                    color: 'text.primary',
                    fontWeight: 700,
                    letterSpacing: '0.01em',
                  }}
                  variant="subtitle1"
                  component="div"
                >
                  {workflowText('axis.ui.current-context', 'Current context')}
                </Typography>
                <Typography sx={{ color: 'text.secondary' }} variant="caption">
                  {workflowText(
                    'axis.ui.current-employee-business-context',
                    'Current employee business context.',
                  )}
                </Typography>
              </Stack>
              <Stack component="dl" spacing={1} sx={{ m: 0, mt: 1.5 }}>
                {contextRows.map((item) => (
                  <Box
                    key={`${workflowText('axis.context.' + item.label.toLowerCase().replaceAll(' ', '-'), item.label)}:${item.value}`}
                    component="div"
                    sx={{
                      alignItems: 'baseline',
                      borderTop: '1px solid',
                      borderColor: 'divider',
                      columnGap: 2,
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: 'minmax(0, 1fr) minmax(0, 1fr)',
                        sm: '140px minmax(0, 1fr)',
                      },
                      pt: 1,
                    }}
                  >
                    <Typography
                      component="dt"
                      sx={{
                        color: 'text.secondary',
                        flex: '0 0 92px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {workflowText(
                        'axis.context.' + item.label.toLowerCase().replaceAll(' ', '-'),
                        item.label,
                      )}
                    </Typography>
                    <Typography
                      component="dd"
                      sx={{
                        color: 'text.primary',
                        flex: 1,
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        lineHeight: 1.35,
                        m: 0,
                        minWidth: 0,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {item.value}
                    </Typography>
                  </Box>
                ))}
              </Stack>
              {technicalRows.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" component="div">
                    {workflowText(
                      'axis.ui.application-amp-technical-details',
                      'Application & technical details',
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {workflowText(
                      'axis.ui.composition-site-and-catalog-render-axis-they-do-not-select-business-rec',
                      'Composition Site and Catalog render Axis; they do not select business records.',
                    )}
                  </Typography>
                  <Stack component="dl" spacing={1} sx={{ m: 0, mt: 1 }}>
                    {technicalRows.map((item) => (
                      <Box
                        key={workflowText(
                          'axis.context.' +
                            item.label.toLowerCase().replaceAll(' ', '-'),
                          item.label,
                        )}
                      >
                        <Typography
                          component="dt"
                          variant="caption"
                          color="text.secondary"
                        >
                          {workflowText(
                            'axis.context.' +
                              item.label.toLowerCase().replaceAll(' ', '-'),
                            item.label,
                          )}
                        </Typography>
                        <Typography
                          component="dd"
                          variant="body2"
                          sx={{ m: 0, overflowWrap: 'anywhere' }}
                        >
                          {item.value}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>
          }
        >
          <Button
            aria-label={`${visibleContext} · ${workflowText('axis.ui.current-context', 'Current context')}`}
            color="inherit"
            sx={{
              alignItems: 'center',
              borderRadius: 1,
              color: 'text.secondary',
              gap: 0.75,
              height: 44,
              maxWidth: { md: 260, lg: 320 },
              minWidth: 44,
              px: { xs: 0, md: 1 },
              textTransform: 'none',
            }}
          >
            <ShellIcon color="action" name="info" sx={utilityIconSx} />
            <Typography
              component="span"
              variant="caption"
              sx={{
                display: { xs: 'none', md: 'inline' },
                fontWeight: 600,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {visibleContext || 'Context unavailable'}
            </Typography>
          </Button>
        </Tooltip>
        <Tooltip
          title={
            colorMode === 'light'
              ? workflowText('axis.ui.switch-to-dark-mode', 'Switch to dark mode')
              : workflowText('axis.ui.switch-to-light-mode', 'Switch to light mode')
          }
        >
          <IconButton
            aria-label={
              colorMode === 'light'
                ? workflowText('axis.ui.switch-to-dark-mode', 'Switch to dark mode')
                : workflowText('axis.ui.switch-to-light-mode', 'Switch to light mode')
            }
            onClick={onToggleColorMode}
            sx={responsiveUtilityActionSx}
          >
            <ShellIcon
              color="action"
              name={colorMode === 'light' ? 'moon' : 'sun'}
              sx={utilityIconSx}
            />
          </IconButton>
        </Tooltip>
        <Button
          aria-label={`${initials} ${employeeId ?? 'Axis recovery'} · ${workflowText('axis.ui.open-employee-menu', 'Open employee menu')}`}
          color="inherit"
          sx={{
            gap: 1,
            height: 44,
            minWidth: 0,
            px: { xs: 0.25, sm: 1 },
          }}
          onClick={(event: MouseEvent<HTMLElement>) => {
            setProfileAnchor(event.currentTarget);
          }}
        >
          <Avatar sx={{ height: { xs: 36, sm: 40 }, width: { xs: 36, sm: 40 } }}>
            {initials}
          </Avatar>{' '}
          <Typography
            noWrap
            sx={{ display: { xs: 'none', md: 'block' }, maxWidth: 140 }}
            variant="body2"
          >
            {employeeId ?? 'Axis recovery'}
          </Typography>
        </Button>
      </Stack>
      <Menu
        anchorEl={profileAnchor}
        open={Boolean(profileAnchor)}
        onClose={() => {
          setProfileAnchor(null);
        }}
      >
        <MenuItem
          onClick={() => {
            setProfileAnchor(null);
            onToggleColorMode();
          }}
        >
          {colorMode === 'light'
            ? workflowText('axis.ui.switch-to-dark-mode', 'Switch to dark mode')
            : workflowText('axis.ui.switch-to-light-mode', 'Switch to light mode')}
        </MenuItem>
        {onLock ? (
          <MenuItem
            onClick={() => {
              setProfileAnchor(null);
              onLock();
            }}
          >
            {workflowText('axis.ui.lock-screen', 'Lock screen')}
          </MenuItem>
        ) : null}
        {onLogout ? (
          <MenuItem
            onClick={() => {
              setProfileAnchor(null);
              onLogout();
            }}
          >
            {workflowText('axis.ui.sign-out', 'Sign out')}
          </MenuItem>
        ) : null}
      </Menu>
    </Stack>
  );
}
