import {
  Avatar,
  Badge,
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
import { useState, type MouseEvent } from 'react';

import type { AxisNavigationItem } from '../../bootstrap/publicBootstrap';
import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import { AxisMark } from './AxisMark';
import { RecentPagesMenu } from './RecentPagesMenu';
import { ShellIcon } from './ShellIcon';
import type { ShellNavigationItem } from './shellNavigation';

interface TopNavigationProps {
  readonly assistant?: AxisNavigationItem | undefined;
  readonly contextItems: readonly string[];
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
  readonly onNotify: (message: string) => void;
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
  contextItems,
  employeeId,
  navigationToggleLabel,
  colorMode,
  onLock,
  onLogout,
  onNotify,
  onNavigate,
  onToggleNavigation,
  onToggleColorMode,
  onQueryChange,
  query,
  recentItems,
}: TopNavigationProps) {
  const localization = useAxisLocalization();
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const initials = employeeId?.slice(0, 2).toLocaleUpperCase() ?? 'AX';
  const assistantActive =
    assistant !== undefined && ['UP', 'DEGRADED'].includes(assistant.availability);
  const contextSummary =
    contextItems.length === 0
      ? 'Current context unavailable'
      : `Current context: ${contextItems.join(', ')}`;
  const contextRows = contextItems.map(parseContextItem);

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
        <AxisMark compact />
      </Box>
      <TextField
        aria-label="Search navigation"
        placeholder="Search navigation"
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
        <Tooltip title="My Work">
          <IconButton
            aria-label="My Work"
            onClick={() => {
              onNotify('My Work will connect to the Workflow task contract.');
            }}
            sx={utilityActionSx}
          >
            <Badge
              badgeContent={0}
              color="primary"
              showZero
              slotProps={{
                badge: {
                  sx: {
                    fontSize: 12,
                    height: 20,
                    minWidth: 20,
                    p: 0,
                  },
                },
              }}
            >
              <ShellIcon color="action" name="tasks" sx={utilityIconSx} />
            </Badge>
          </IconButton>
        </Tooltip>
        <Tooltip title="Notifications">
          <IconButton
            aria-label="Notifications"
            onClick={() => {
              onNotify('There are no new notifications.');
            }}
            sx={utilityActionSx}
          >
            <Badge color="error" variant="dot" invisible>
              <ShellIcon color="action" name="bell" sx={utilityIconSx} />
            </Badge>
          </IconButton>
        </Tooltip>
        {localization.supportedLocales.length > 1 ? (
          <Tooltip title="Change language">
            <Button
              aria-label="Change language"
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
              sx={{ display: { xs: 'none', sm: 'inline-flex' }, minWidth: 44 }}
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
                maxWidth: 360,
                p: 0,
              },
            },
          }}
          title={
            <Box sx={{ minWidth: 320, p: 2 }}>
              <Stack spacing={0.5}>
                <Typography
                  sx={{
                    color: 'text.primary',
                    fontWeight: 700,
                    letterSpacing: '0.01em',
                  }}
                  variant="subtitle1"
                >
                  Current context
                </Typography>
                <Typography sx={{ color: 'text.secondary' }} variant="caption">
                  Runtime scope used by this Axis workspace.
                </Typography>
              </Stack>
              <Stack component="dl" spacing={1} sx={{ m: 0, mt: 1.5 }}>
                {contextRows.map((item) => (
                  <Box
                    key={`${item.label}:${item.value}`}
                    component="div"
                    sx={{
                      alignItems: 'baseline',
                      borderTop: '1px solid',
                      borderColor: 'divider',
                      columnGap: 2,
                      display: 'grid',
                      gridTemplateColumns: '140px minmax(0, 1fr)',
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
                      {item.label}
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
            </Box>
          }
        >
          <IconButton aria-label={contextSummary} sx={responsiveUtilityActionSx}>
            <ShellIcon color="action" name="info" sx={utilityIconSx} />
          </IconButton>
        </Tooltip>
        <Tooltip
          title={colorMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          <IconButton
            aria-label={
              colorMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
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
          aria-label="Open employee menu"
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
          </Avatar>
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
            onNotify('Employee profile workspace is not implemented yet.');
          }}
        >
          Profile
        </MenuItem>
        <MenuItem
          onClick={() => {
            setProfileAnchor(null);
            onNotify('Appearance preferences remain available in the shell.');
          }}
        >
          Preferences
        </MenuItem>
        {onLock ? (
          <MenuItem
            onClick={() => {
              setProfileAnchor(null);
              onLock();
            }}
          >
            Lock screen
          </MenuItem>
        ) : null}
        {onLogout ? (
          <MenuItem
            onClick={() => {
              setProfileAnchor(null);
              onLogout();
            }}
          >
            Sign out
          </MenuItem>
        ) : null}
      </Menu>
    </Stack>
  );
}
