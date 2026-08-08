import { AppBar, Box, Drawer, Toolbar, useMediaQuery, useTheme } from '@mui/material';
import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import type { AxisNavigationItem } from '../../bootstrap/publicBootstrap';
import { useAxisAppearance } from '../AxisAppearanceContext';
import { axisTokens } from '../axisTheme';
import { contextDisplayName } from './contextDisplayName';
import { NavigationRail } from './NavigationRail';
import {
  loadNavigationPreferences,
  navigationItemKey,
  recordRecentNavigation,
  saveNavigationPreferences,
  toggleNavigationFavourite,
} from './navigationPreferences';
import { NotificationRegion } from './ShellPrimitives';
import {
  composeShellNavigation,
  type ShellNavigationGroup,
  type ShellNavigationItem,
} from './shellNavigation';
import { TopNavigation } from './TopNavigation';

interface AppShellProps extends PropsWithChildren {
  readonly employeeId?: string | undefined;
  readonly enterpriseCode?: string | undefined;
  readonly tenantCode?: string | undefined;
  readonly environments?: readonly string[] | undefined;
  readonly site?: string | undefined;
  readonly catalog?: string | undefined;
  readonly navigation?: readonly AxisNavigationItem[] | undefined;
  readonly onLock?: (() => void) | undefined;
  readonly onLogout?: (() => void) | undefined;
  readonly recentNavigationLimit?: number | undefined;
}

const NAVIGATION_RAIL_WIDTH_STORAGE_KEY = 'nodics-axis-navigation-rail-width-v1';
const NAVIGATION_RAIL_MIN_WIDTH = 220;
const NAVIGATION_RAIL_MAX_WIDTH = 420;

function boundedNavigationRailWidth(value: number): number {
  return Math.min(
    Math.max(Math.round(value), NAVIGATION_RAIL_MIN_WIDTH),
    NAVIGATION_RAIL_MAX_WIDTH,
  );
}

function loadNavigationRailWidth(storage: Storage): number {
  const stored = storage.getItem(NAVIGATION_RAIL_WIDTH_STORAGE_KEY);
  if (stored === null) return axisTokens.spacing.shellRail;
  const value = Number(stored);
  return Number.isFinite(value)
    ? boundedNavigationRailWidth(value)
    : axisTokens.spacing.shellRail;
}

export function AppShell({
  catalog,
  children,
  employeeId,
  enterpriseCode = 'default',
  tenantCode = 'default',
  environments = [],
  navigation = [],
  onLock,
  onLogout,
  recentNavigationLimit,
  site,
}: AppShellProps) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleMode } = useAxisAppearance();
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [navigationCompact, setNavigationCompact] = useState(false);
  const [navigationRailWidth, setNavigationRailWidth] = useState(() =>
    loadNavigationRailWidth(window.localStorage),
  );
  const [navigationResizing, setNavigationResizing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const navigationPreferenceLimits = useMemo(
    () => Object.freeze({ recentItems: recentNavigationLimit }),
    [recentNavigationLimit],
  );
  const [navigationPreferences, setNavigationPreferences] = useState(() =>
    loadNavigationPreferences(window.localStorage, navigationPreferenceLimits),
  );
  const baseGroups = useMemo(() => composeShellNavigation(navigation), [navigation]);
  const navigationByKey = useMemo(
    () =>
      new Map(
        baseGroups
          .flatMap((group) => group.items)
          .filter((item) => !item.local)
          .map((item) => [navigationItemKey(item.moduleName, item.id), item]),
      ),
    [baseGroups],
  );
  const recentNavigationItems = useMemo(
    () =>
      Object.freeze(
        navigationPreferences.recents
          .map((key) => navigationByKey.get(key))
          .filter((item): item is ShellNavigationItem => item !== undefined),
      ),
    [navigationByKey, navigationPreferences.recents],
  );
  const groups = useMemo(() => {
    const quickGroup = (
      id: string,
      label: string,
      order: number,
      keys: readonly string[],
    ): ShellNavigationGroup | undefined => {
      const items = keys
        .map((key) => navigationByKey.get(key))
        .filter((item): item is ShellNavigationItem => item !== undefined)
        .map((item) => ({ ...item, depth: 0, hasChildren: false }));
      return items.length === 0
        ? undefined
        : Object.freeze({ id, label, order, items: Object.freeze(items) });
    };
    const favourites = quickGroup(
      'favourites',
      'Favourites',
      50,
      navigationPreferences.favourites,
    );
    const workspaceItems = [
      ...(baseGroups.find((group) => group.id === 'workspace')?.items ?? []),
      ...(favourites?.items.map((item) => ({
        ...item,
        id: `favourite-${item.id}`,
        label: `Favourite: ${item.label}`,
        local: true,
      })) ?? []),
    ];
    const mergedGroups = baseGroups.map((group) =>
      group.id === 'workspace'
        ? { ...group, items: Object.freeze(workspaceItems) }
        : group,
    );
    return Object.freeze(mergedGroups);
  }, [baseGroups, navigationByKey, navigationPreferences.favourites]);
  const assistant = useMemo(
    () =>
      navigation.find(
        (item) => item.id === 'assistant' && item.moduleName === 'aiAssistant',
      ),
    [navigation],
  );
  const contextItems = useMemo(() => {
    const environmentLabel =
      environments.length === 0
        ? 'Environment unavailable'
        : environments.length === 1
          ? `Environment: ${contextDisplayName(environments[0] ?? '')}`
          : `Environments: ${String(environments.length)}`;
    return [
      environmentLabel,
      `Tenant: ${contextDisplayName(tenantCode)}`,
      `Enterprise: ${contextDisplayName(enterpriseCode)}`,
      ...(site ? [`Site: ${contextDisplayName(site)}`] : []),
      ...(catalog ? [`Catalog: ${contextDisplayName(catalog)}`] : []),
    ];
  }, [catalog, enterpriseCode, environments, site, tenantCode]);
  const desktopRailWidth = navigationCompact
    ? axisTokens.spacing.shellRailCompact
    : navigationRailWidth;

  const resizeNavigationRail = useCallback((clientX: number) => {
    setNavigationRailWidth(boundedNavigationRailWidth(clientX));
  }, []);

  useEffect(() => {
    const offline = () => {
      setNotification('Axis is offline. Administrative operations are paused.');
    };
    const online = () => {
      setNotification('Connection restored.');
    };
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, []);

  useEffect(() => {
    saveNavigationPreferences(
      navigationPreferences,
      window.localStorage,
      navigationPreferenceLimits,
    );
  }, [navigationPreferenceLimits, navigationPreferences]);

  useEffect(() => {
    window.localStorage.setItem(
      NAVIGATION_RAIL_WIDTH_STORAGE_KEY,
      String(navigationRailWidth),
    );
  }, [navigationRailWidth]);

  useEffect(() => {
    if (!navigationResizing) return undefined;
    const handlePointerMove = (event: PointerEvent) => {
      resizeNavigationRail(event.clientX);
    };
    const handlePointerUp = () => {
      setNavigationResizing(false);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [navigationResizing, resizeNavigationRail]);

  useEffect(() => {
    if (location.hash) return;
    if (typeof mainScrollRef.current?.scrollTo === 'function') {
      mainScrollRef.current.scrollTo({ behavior: 'auto', left: 0, top: 0 });
    }
  }, [location.hash, location.pathname]);

  const navigateTo = (route: string) => {
    const item = navigation.find((candidate) => candidate.route === route);
    if (item) {
      setNavigationPreferences((current) =>
        recordRecentNavigation(
          current,
          navigationItemKey(item.moduleName, item.id),
          navigationPreferenceLimits,
        ),
      );
    }
    setNavigationOpen(false);
    setQuery('');
    void navigate(route);
  };

  return (
    <Box sx={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
      <AppBar
        color="inherit"
        elevation={0}
        position="fixed"
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          ml: { md: `${String(desktopRailWidth)}px` },
          transition: (currentTheme) =>
            currentTheme.transitions.create(['margin-left', 'width'], {
              duration: axisTokens.motion.standard,
            }),
          width: { md: `calc(100% - ${String(desktopRailWidth)}px)` },
          zIndex: (currentTheme) => currentTheme.zIndex.drawer + 1,
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
          },
        }}
      >
        <Toolbar
          sx={{
            gap: 1,
            minHeight: `${String(axisTokens.spacing.header)}px !important`,
          }}
        >
          <TopNavigation
            assistant={assistant}
            contextItems={contextItems}
            employeeId={employeeId}
            navigationToggleLabel={
              desktop
                ? navigationCompact
                  ? 'Expand navigation'
                  : 'Collapse navigation'
                : 'Open navigation'
            }
            colorMode={mode}
            query={query}
            onLock={onLock}
            onLogout={onLogout}
            onNavigate={navigateTo}
            onNotify={setNotification}
            recentItems={recentNavigationItems}
            onToggleNavigation={() => {
              if (desktop) {
                setNavigationCompact((current) => !current);
              } else {
                setNavigationOpen(true);
              }
            }}
            onToggleColorMode={toggleMode}
            onQueryChange={setQuery}
          />
        </Toolbar>
      </AppBar>
      <Drawer
        ModalProps={{ keepMounted: true }}
        open={desktop || navigationOpen}
        variant={desktop ? 'permanent' : 'temporary'}
        slotProps={{
          paper: {
            sx: {
              borderRight: '1px solid',
              borderColor: 'divider',
              height: '100dvh',
              maxHeight: '100dvh',
              overflow: 'hidden',
              overflowX: 'hidden',
              position: 'relative',
              transition: (currentTheme) =>
                currentTheme.transitions.create('width', {
                  duration: axisTokens.motion.standard,
                }),
              width: desktop ? desktopRailWidth : axisTokens.spacing.shellRail,
              '@media (prefers-reduced-motion: reduce)': {
                transition: 'none',
              },
            },
          },
        }}
        onClose={() => {
          setNavigationOpen(false);
        }}
      >
        <NavigationRail
          activePath={location.pathname}
          compact={desktop && navigationCompact}
          favourites={new Set(navigationPreferences.favourites)}
          groups={groups}
          query={query}
          onNavigate={navigateTo}
          onQueryChange={setQuery}
          onToggleFavourite={(key) => {
            setNavigationPreferences((current) =>
              toggleNavigationFavourite(current, key, navigationPreferenceLimits),
            );
          }}
        />
        {desktop && !navigationCompact ? (
          <Box
            aria-label="Resize navigation"
            aria-orientation="vertical"
            aria-valuemax={NAVIGATION_RAIL_MAX_WIDTH}
            aria-valuemin={NAVIGATION_RAIL_MIN_WIDTH}
            aria-valuenow={navigationRailWidth}
            role="separator"
            tabIndex={0}
            sx={{
              bottom: 0,
              cursor: 'col-resize',
              position: 'absolute',
              right: 0,
              top: 0,
              width: 10,
              zIndex: 1,
              '&::after': {
                bgcolor: navigationResizing ? 'primary.main' : 'transparent',
                bottom: 0,
                content: '""',
                position: 'absolute',
                right: 0,
                top: 0,
                transition: (currentTheme) =>
                  currentTheme.transitions.create('background-color', {
                    duration: axisTokens.motion.fast,
                  }),
                width: 2,
              },
              '&:hover::after, &:focus-visible::after': {
                bgcolor: 'primary.main',
              },
              '@media (prefers-reduced-motion: reduce)': {
                '&::after': {
                  transition: 'none',
                },
              },
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setNavigationRailWidth((current) =>
                  boundedNavigationRailWidth(current - 16),
                );
              } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                setNavigationRailWidth((current) =>
                  boundedNavigationRailWidth(current + 16),
                );
              } else if (event.key === 'Home') {
                event.preventDefault();
                setNavigationRailWidth(NAVIGATION_RAIL_MIN_WIDTH);
              } else if (event.key === 'End') {
                event.preventDefault();
                setNavigationRailWidth(NAVIGATION_RAIL_MAX_WIDTH);
              }
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              if (typeof event.currentTarget.setPointerCapture === 'function') {
                event.currentTarget.setPointerCapture(event.pointerId);
              }
              resizeNavigationRail(event.clientX);
              setNavigationResizing(true);
            }}
          />
        ) : null}
      </Drawer>
      <Box
        sx={{
          flexGrow: 1,
          height: '100dvh',
          maxHeight: '100dvh',
          minWidth: 0,
          overflow: 'hidden',
          pt: `${String(axisTokens.spacing.header)}px`,
          transition: (currentTheme) =>
            currentTheme.transitions.create('width', {
              duration: axisTokens.motion.standard,
            }),
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
          },
        }}
      >
        <Box
          component="main"
          id="main-content"
          ref={mainScrollRef}
          sx={{
            height: `calc(100dvh - ${String(axisTokens.spacing.header)}px)`,
            overflowX: 'hidden',
            overflowY: 'auto',
            scrollBehavior: 'auto',
          }}
        >
          {children}
        </Box>
      </Box>
      <NotificationRegion
        message={notification}
        severity={notification === 'Connection restored.' ? 'success' : 'info'}
        onClose={() => {
          setNotification(null);
        }}
      />
    </Box>
  );
}
