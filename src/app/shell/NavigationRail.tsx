import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Box,
  Collapse,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import { axisTokens } from '../axisTheme';
import { AxisMark } from './AxisMark';
import { navigationItemKey } from './navigationPreferences';
import { navigationParentKey } from './shellNavigation';
import { ShellIcon } from './ShellIcon';
import {
  availabilityLabel,
  type ShellNavigationGroup,
  type ShellNavigationItem,
} from './shellNavigation';

interface NavigationRailProps {
  readonly activePath: string;
  readonly compact: boolean;
  readonly groups: readonly ShellNavigationGroup[];
  readonly query: string;
  readonly favourites: ReadonlySet<string>;
  readonly onNavigate: (route: string) => void;
  readonly onQueryChange: (value: string) => void;
  readonly onToggleFavourite: (key: string) => void;
}

export function NavigationRail({
  activePath,
  compact,
  favourites,
  groups,
  onNavigate,
  onQueryChange,
  onToggleFavourite,
  query,
}: NavigationRailProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [collapsedItems, setCollapsedItems] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const itemElements = useRef(new Map<string, HTMLElement>());
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const allItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const activeItemKey = useMemo(
    () => activeNavigationItemKey(allItems, activePath),
    [activePath, allItems],
  );
  const activeAncestorKeys = useMemo(
    () => activeItemAncestorKeys(allItems, activeItemKey),
    [allItems, activeItemKey],
  );
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: visibleNavigationItems(
        group.items,
        group.label,
        normalizedQuery,
        collapsedItems,
        activeAncestorKeys,
      ),
    }))
    .filter((group) => group.items.length > 0);

  useEffect(() => {
    if (!activeItemKey) return;
    const activeElement = itemElements.current.get(activeItemKey);
    if (typeof activeElement?.scrollIntoView !== 'function') return;
    activeElement.scrollIntoView({
      behavior: 'auto',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [activeItemKey]);

  return (
    <Stack
      sx={{
        bgcolor: axisTokens.color.charcoal[950],
        color: 'common.white',
        height: '100%',
      }}
    >
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: compact ? 'center' : 'flex-start',
          minHeight: 72,
          px: compact ? 1 : 2.5,
        }}
      >
        <AxisMark compact={compact} reverse />
      </Box>
      <Divider sx={{ borderColor: alpha('#ffffff', 0.1) }} />
      {!compact ? (
        <TextField
          placeholder="Search menu"
          size="small"
          value={query}
          sx={{
            mx: 2,
            mt: 1.5,
            '& .MuiOutlinedInput-root': {
              color: 'common.white',
              bgcolor: alpha('#ffffff', 0.06),
              '& fieldset': { borderColor: alpha('#ffffff', 0.16) },
              '&:hover fieldset': { borderColor: alpha('#ffffff', 0.34) },
              '&.Mui-focused fieldset': { borderColor: 'primary.main' },
            },
            '& input::placeholder': {
              color: alpha('#ffffff', 0.58),
              opacity: 1,
            },
          }}
          slotProps={{
            htmlInput: {
              'aria-label': 'Search menu',
            },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <ShellIcon
                    fontSize="small"
                    name="search"
                    sx={{ color: alpha('#ffffff', 0.58) }}
                  />
                </InputAdornment>
              ),
            },
          }}
          onChange={(event) => {
            onQueryChange(event.target.value);
          }}
        />
      ) : null}
      <Box
        component="nav"
        aria-label="Primary navigation"
        sx={{
          flex: 1,
          overflowY: 'auto',
          py: 1.5,
          scrollbarColor: `${alpha('#ffffff', 0.2)} transparent`,
        }}
      >
        {visibleGroups.length === 0 && normalizedQuery ? (
          <Typography
            sx={{ color: alpha('#ffffff', 0.62), px: 2.5, py: 2 }}
            variant="body2"
          >
            No matching menu items
          </Typography>
        ) : null}
        {visibleGroups.map((group) => {
          const groupContainsActiveNavigation =
            activeItemKey !== undefined &&
            group.items.some(
              (item) =>
                navigationItemKey(item.moduleName, item.id) === activeItemKey ||
                activeAncestorKeys.has(navigationItemKey(item.moduleName, item.id)),
            );
          const expanded =
            compact ||
            normalizedQuery !== '' ||
            groupContainsActiveNavigation ||
            !collapsedGroups.has(group.id);
          return (
            <Box key={group.id} sx={{ mb: 1.5 }}>
              {!compact ? (
                <ListItemButton
                  aria-controls={`navigation-group-${group.id}`}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${group.label}`}
                  sx={{
                    borderRadius: `${String(axisTokens.radius.small)}px`,
                    color: alpha('#ffffff', 0.58),
                    justifyContent: 'space-between',
                    mx: 1,
                    px: 1.5,
                    py: 0.5,
                    '&:hover': {
                      bgcolor: alpha('#ffffff', 0.07),
                      color: 'common.white',
                    },
                  }}
                  onClick={() => {
                    setCollapsedGroups((current) => {
                      const next = new Set(current);
                      if (next.has(group.id)) next.delete(group.id);
                      else next.add(group.id);
                      return next;
                    });
                  }}
                >
                  <Typography variant="overline">{group.label}</Typography>
                  <Box
                    aria-hidden
                    component="span"
                    sx={{
                      borderBottom: '1.5px solid currentColor',
                      borderRight: '1.5px solid currentColor',
                      height: 7,
                      transform: expanded ? 'rotate(45deg)' : 'rotate(-45deg)',
                      transition: 'transform 150ms ease',
                      width: 7,
                    }}
                  />
                </ListItemButton>
              ) : null}
              <Collapse
                id={`navigation-group-${group.id}`}
                in={expanded}
                timeout="auto"
                unmountOnExit
              >
                <List disablePadding sx={{ px: compact ? 1.25 : 1 }}>
                  {group.items.map((item) => {
                    const unavailable = item.availability === 'UNAVAILABLE';
                    const featureDisabled = item.featureState === 'DISABLED';
                    const itemKey = navigationItemKey(item.moduleName, item.id);
                    const itemSelected = itemKey === activeItemKey;
                    const itemExpanded =
                      compact ||
                      normalizedQuery !== '' ||
                      activeAncestorKeys.has(itemKey) ||
                      !collapsedItems.has(itemKey);
                    const assistantItem =
                      item.id === 'assistant' && item.moduleName === 'aiAssistant';
                    const assistantActive =
                      assistantItem && ['UP', 'DEGRADED'].includes(item.availability);
                    const navigationItem = (
                      <ListItemButton
                        key={`${item.moduleName}:${item.id}`}
                        aria-label={item.label}
                        aria-level={item.depth + 1}
                        disabled={unavailable || featureDisabled}
                        ref={(element) => {
                          if (element) itemElements.current.set(itemKey, element);
                          else itemElements.current.delete(itemKey);
                        }}
                        selected={itemSelected}
                        sx={{
                          borderRadius: `${String(axisTokens.radius.small)}px`,
                          color: alpha('#ffffff', 0.74),
                          mb: 0.5,
                          minHeight: 42,
                          justifyContent: compact ? 'center' : 'flex-start',
                          pl: compact ? 1 : 1.5 + item.depth * 2,
                          pr: compact ? 1 : 1.5,
                          position: 'relative',
                          '&:hover': {
                            bgcolor: alpha('#ffffff', 0.07),
                            color: 'common.white',
                          },
                          '&.Mui-selected': {
                            bgcolor: alpha(axisTokens.color.signatureGold, 0.14),
                            color: 'common.white',
                          },
                          '&.Mui-selected:hover': {
                            bgcolor: alpha(axisTokens.color.signatureGold, 0.2),
                          },
                          '&.Mui-selected::before': {
                            bgcolor: 'primary.main',
                            borderRadius: '0 2px 2px 0',
                            bottom: 8,
                            content: '""',
                            left: -8,
                            position: 'absolute',
                            top: 8,
                            width: 3,
                          },
                        }}
                        onClick={() => {
                          onNavigate(item.route);
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color: itemSelected
                              ? 'primary.main'
                              : alpha('#ffffff', 0.5),
                            justifyContent: 'center',
                            minWidth: compact ? 0 : 36,
                          }}
                        >
                          <ShellIcon
                            color={
                              assistantItem
                                ? assistantActive
                                  ? 'primary'
                                  : 'disabled'
                                : 'inherit'
                            }
                            fontSize="small"
                            name={item.icon}
                          />
                        </ListItemIcon>
                        <ListItemText
                          sx={{ display: compact ? 'none' : 'block' }}
                          primary={item.label}
                          secondary={
                            item.availability === 'UP'
                              ? item.featureState === 'PREVIEW'
                                ? 'Preview'
                                : undefined
                              : availabilityLabel(item.availability)
                          }
                          slotProps={{
                            primary: { noWrap: true },
                            secondary: { noWrap: true },
                          }}
                        />
                        {!item.local && item.availability !== 'UP' ? (
                          <Tooltip title={availabilityLabel(item.availability)}>
                            <Box
                              aria-label={availabilityLabel(item.availability)}
                              component="span"
                              sx={{
                                bgcolor:
                                  item.availability === 'DEGRADED'
                                    ? 'warning.main'
                                    : 'error.main',
                                borderRadius: '50%',
                                height: 7,
                                position: compact ? 'absolute' : 'static',
                                right: compact ? 5 : 'auto',
                                top: compact ? 5 : 'auto',
                                mr: compact ? 0 : 0.5,
                                width: 7,
                              }}
                            />
                          </Tooltip>
                        ) : null}
                      </ListItemButton>
                    );
                    return compact ? (
                      <Tooltip
                        key={`${item.moduleName}:${item.id}`}
                        placement="right"
                        title={item.label}
                      >
                        <Box component="span" sx={{ display: 'block' }}>
                          {navigationItem}
                        </Box>
                      </Tooltip>
                    ) : (
                      <Box
                        key={`${item.moduleName}:${item.id}`}
                        sx={{ alignItems: 'center', display: 'flex' }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>{navigationItem}</Box>
                        {item.hasChildren ? (
                          <Tooltip
                            title={`${itemExpanded ? 'Collapse' : 'Expand'} ${item.label}`}
                          >
                            <IconButton
                              aria-label={`${itemExpanded ? 'Collapse' : 'Expand'} ${item.label}`}
                              aria-expanded={itemExpanded}
                              disabled={unavailable || featureDisabled}
                              size="small"
                              sx={{ color: alpha('#ffffff', 0.56), mr: 0.25 }}
                              onClick={() => {
                                setCollapsedItems((current) => {
                                  const next = new Set(current);
                                  if (next.has(itemKey)) next.delete(itemKey);
                                  else next.add(itemKey);
                                  return next;
                                });
                              }}
                            >
                              <ShellIcon
                                fontSize="small"
                                name={itemExpanded ? 'chevron-up' : 'chevron-down'}
                              />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                        {!item.local ? (
                          <Tooltip
                            title={
                              favourites.has(itemKey)
                                ? `Remove ${item.label} from favourites`
                                : `Add ${item.label} to favourites`
                            }
                          >
                            <IconButton
                              aria-label={
                                favourites.has(itemKey)
                                  ? `Remove ${item.label} from favourites`
                                  : `Add ${item.label} to favourites`
                              }
                              color={favourites.has(itemKey) ? 'primary' : 'inherit'}
                              size="small"
                              sx={{ color: alpha('#ffffff', 0.56), mr: 0.75 }}
                              onClick={() => {
                                onToggleFavourite(itemKey);
                              }}
                            >
                              <Box
                                aria-hidden="true"
                                component="span"
                                sx={{ fontSize: 18, lineHeight: 1 }}
                              >
                                {favourites.has(itemKey) ? '★' : '☆'}
                              </Box>
                            </IconButton>
                          </Tooltip>
                        ) : null}
                      </Box>
                    );
                  })}
                </List>
              </Collapse>
            </Box>
          );
        })}
        {visibleGroups.length === 0 ? (
          <Typography sx={{ color: alpha('#ffffff', 0.56), px: 2.5, py: 3 }}>
            No navigation results
          </Typography>
        ) : null}
      </Box>
      <Divider sx={{ borderColor: alpha('#ffffff', 0.1) }} />
      <Box sx={{ p: compact ? 1.5 : 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Box
            aria-hidden="true"
            sx={{
              bgcolor: 'success.main',
              borderRadius: '50%',
              boxShadow: `0 0 0 3px ${alpha(axisTokens.color.success, 0.16)}`,
              height: 7,
              width: 7,
            }}
          />
          <Typography sx={{ color: alpha('#ffffff', 0.64) }} variant="caption">
            {compact ? null : 'Registry connected'}
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
}

function visibleNavigationItems(
  items: readonly ShellNavigationItem[],
  groupLabel: string,
  normalizedQuery: string,
  collapsedItems: ReadonlySet<string>,
  activeAncestorKeys: ReadonlySet<string>,
): readonly ShellNavigationItem[] {
  if (!normalizedQuery) {
    const collapsedAncestors = new Set<string>();
    return items.filter((item) => {
      const parentKey = item.parentId
        ? navigationItemKey(item.parentModuleName ?? item.moduleName, item.parentId)
        : undefined;
      if (parentKey && collapsedAncestors.has(parentKey)) {
        if (item.hasChildren) {
          collapsedAncestors.add(navigationItemKey(item.moduleName, item.id));
        }
        return false;
      }
      if (
        item.hasChildren &&
        collapsedItems.has(navigationItemKey(item.moduleName, item.id)) &&
        !activeAncestorKeys.has(navigationItemKey(item.moduleName, item.id))
      ) {
        collapsedAncestors.add(navigationItemKey(item.moduleName, item.id));
      }
      return true;
    });
  }
  const byId = new Map(
    items.map((item) => [navigationParentKey(item.moduleName, item.id), item]),
  );
  const visibleIds = new Set<string>();
  items.forEach((item) => {
    const matches = `${groupLabel} ${item.label} ${item.moduleName}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);
    if (!matches) return;
    visibleIds.add(navigationParentKey(item.moduleName, item.id));
    let parentId = item.parentId;
    let parentModuleName = item.parentModuleName ?? item.moduleName;
    while (parentId) {
      const parentKey = navigationParentKey(parentModuleName, parentId);
      visibleIds.add(parentKey);
      const parent = byId.get(parentKey);
      parentId = parent?.parentId;
      parentModuleName =
        parent?.parentModuleName ?? parent?.moduleName ?? parentModuleName;
    }
  });
  return items.filter((item) =>
    visibleIds.has(navigationParentKey(item.moduleName, item.id)),
  );
}

function activeNavigationItemKey(
  items: readonly ShellNavigationItem[],
  activePath: string,
): string | undefined {
  return [...items]
    .filter((item) => routeMatches(activePath, item.route))
    .sort(
      (left, right) =>
        normalizedRoute(right.route).length - normalizedRoute(left.route).length ||
        right.depth - left.depth ||
        left.order - right.order,
    )
    .map((item) => navigationItemKey(item.moduleName, item.id))[0];
}

function activeItemAncestorKeys(
  items: readonly ShellNavigationItem[],
  activeItemKey: string | undefined,
): ReadonlySet<string> {
  const ancestors = new Set<string>();
  if (!activeItemKey) return ancestors;
  const byKey = new Map(
    items.map((item) => [navigationItemKey(item.moduleName, item.id), item]),
  );
  let current = byKey.get(activeItemKey);
  while (current?.parentId) {
    const parentKey = navigationItemKey(
      current.parentModuleName ?? current.moduleName,
      current.parentId,
    );
    if (ancestors.has(parentKey)) break;
    ancestors.add(parentKey);
    current = byKey.get(parentKey);
  }
  return ancestors;
}

function routeMatches(activePath: string, route: string): boolean {
  const normalizedActivePath = normalizedRoute(activePath);
  const normalizedItemRoute = normalizedRoute(route);
  return (
    normalizedActivePath === normalizedItemRoute ||
    (normalizedItemRoute !== '/' &&
      normalizedActivePath.startsWith(`${normalizedItemRoute}/`))
  );
}

function normalizedRoute(route: string): string {
  const [path] = route.split('#');
  if (!path || path === '/') return '/';
  return path.endsWith('/') ? path.slice(0, -1) : path;
}
