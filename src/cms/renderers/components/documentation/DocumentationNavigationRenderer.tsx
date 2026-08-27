import {
  Box,
  Chip,
  Collapse,
  Divider,
  IconButton,
  InputAdornment,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router';

import { ShellIcon } from '../../../../app/shell/ShellIcon';
import { arrayProperty, stringProperty } from '../../shared/rendererProperties';
import type { CmsComponentRendererProps } from '../../shared/rendererTypes';

const MAX_ITEMS = 500;
const MAX_VALUE_LENGTH = 500;

interface DocumentationNavigationItem {
  readonly title: string;
  readonly route: string;
  readonly category: string;
  readonly section: string;
  readonly sectionOrder: number;
  readonly group: string;
  readonly groupOrder: number;
  readonly subgroup: string;
  readonly order: number;
  readonly audience: readonly string[];
  readonly searchText: string;
}

function boundedString(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_VALUE_LENGTH) : '';
}

function humanize(value: string): string {
  const normalized = value.replaceAll(/[-_]+/g, ' ').trim();
  return normalized
    ? normalized.replace(/\b\w/g, (character) => character.toUpperCase())
    : 'General';
}

function boundedNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseItems(value: readonly unknown[]): readonly DocumentationNavigationItem[] {
  return value.slice(0, MAX_ITEMS).flatMap((candidate) => {
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      return [];
    }
    const record = candidate as Readonly<Record<string, unknown>>;
    const title = boundedString(record.title);
    const route = boundedString(record.route);
    const category =
      boundedString(record.sectionTitle) ||
      boundedString(record.category) ||
      boundedString(record.section);
    const section = category || 'Documentation';
    const group =
      boundedString(record.groupTitle) || boundedString(record.group) || section;
    const subgroup =
      boundedString(record.subgroupTitle) || boundedString(record.subgroup);
    const searchText = boundedString(record.searchText);
    if (!title || !route.startsWith('/docs')) return [];
    const audience = Array.isArray(record.audience)
      ? record.audience.map(boundedString).filter(Boolean).slice(0, 20)
      : [];
    return [
      {
        title,
        route,
        category,
        section,
        sectionOrder: boundedNumber(record.sectionOrder, 100),
        group,
        groupOrder: boundedNumber(record.groupOrder, 100),
        subgroup,
        order: boundedNumber(record.order, 100),
        audience,
        searchText,
      },
    ];
  });
}

export function DocumentationNavigationRenderer({
  component,
}: CmsComponentRendererProps) {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [audience, setAudience] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(['*']));
  const title = stringProperty(component, 'title', 'Documentation');
  const searchLabel = stringProperty(component, 'searchLabel', 'Search documentation');
  const searchPlaceholder = stringProperty(
    component,
    'searchPlaceholder',
    'Search documentation',
  );
  const emptyMessage = stringProperty(
    component,
    'emptyMessage',
    'No documentation matches your search.',
  );
  const items = useMemo(
    () => parseItems(arrayProperty(component, 'items')),
    [component],
  );
  const audiences = useMemo(
    () => [...new Set(items.flatMap((item) => item.audience))].sort(),
    [items],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = items.filter((item) => {
    const searchable = [item.title, item.category, item.searchText, ...item.audience]
      .join(' ')
      .toLocaleLowerCase();
    return (
      (!normalizedQuery || searchable.includes(normalizedQuery)) &&
      (!audience || item.audience.includes(audience))
    );
  });
  const grouped = filtered.reduce((result, item) => {
    const section = humanize(item.section || item.category);
    const group = humanize(item.group || item.category);
    const sectionEntry = result.get(section) ?? {
      order: item.sectionOrder,
      groups: new Map<string, DocumentationNavigationItem[]>(),
    };
    sectionEntry.order = Math.min(sectionEntry.order, item.sectionOrder);
    sectionEntry.groups.set(group, [...(sectionEntry.groups.get(group) ?? []), item]);
    result.set(section, sectionEntry);
    return result;
  }, new Map<string, { order: number; groups: Map<string, DocumentationNavigationItem[]> }>());
  const toggleExpanded = (key: string) => {
    setExpanded((current) => {
      if (current.has('*')) return new Set();
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const shouldExpand = (key: string) =>
    Boolean(normalizedQuery) || expanded.has('*') || expanded.has(key);

  return (
    <Stack component="nav" aria-label={title} spacing={1}>
      <Typography component="h2" variant="h6">
        {title}
      </Typography>
      <TextField
        fullWidth
        label={searchLabel}
        placeholder={searchPlaceholder}
        size="small"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <ShellIcon color="action" fontSize="small" name="search" />
              </InputAdornment>
            ),
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Clear documentation search"
                  edge="end"
                  size="small"
                  onClick={() => setQuery('')}
                >
                  <span aria-hidden="true">×</span>
                </IconButton>
              </InputAdornment>
            ) : undefined,
          },
        }}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <Box
        aria-label="Documentation audience filters"
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}
      >
        {audiences.map((item) => (
          <Chip
            clickable
            color={audience === item ? 'primary' : 'default'}
            key={item}
            label={humanize(item)}
            size="small"
            variant={audience === item ? 'filled' : 'outlined'}
            onClick={() => setAudience((current) => (current === item ? '' : item))}
          />
        ))}
      </Box>
      <Divider />
      {filtered.length === 0 ? (
        <Typography color="text.secondary" role="status" variant="body2">
          {emptyMessage}
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {[...grouped.entries()]
            .sort(
              (left, right) =>
                left[1].order - right[1].order || left[0].localeCompare(right[0]),
            )
            .map(([section, sectionEntry]) => (
              <Box component="section" key={section}>
                <ListItemButton
                  aria-expanded={shouldExpand(section)}
                  aria-label={`${shouldExpand(section) ? 'Collapse' : 'Expand'} ${section}`}
                  dense
                  onClick={() => toggleExpanded(section)}
                  sx={{ borderRadius: 1 }}
                >
                  <ShellIcon
                    color="action"
                    fontSize="small"
                    name={shouldExpand(section) ? 'chevron-down' : 'chevron-right'}
                  />
                  <ListItemText
                    primary={section}
                    slotProps={{
                      primary: {
                        sx: { fontWeight: 700, ml: 1 },
                        title: section,
                      },
                    }}
                  />
                </ListItemButton>
                <Collapse in={shouldExpand(section)} timeout="auto" unmountOnExit>
                  <Stack spacing={0.75} sx={{ pl: 1 }}>
                    {[...sectionEntry.groups.entries()]
                      .sort((left, right) => {
                        const leftOrder = Math.min(
                          ...left[1].map((item) => item.groupOrder),
                        );
                        const rightOrder = Math.min(
                          ...right[1].map((item) => item.groupOrder),
                        );
                        return (
                          leftOrder - rightOrder || left[0].localeCompare(right[0])
                        );
                      })
                      .map(([group, groupItems]) => {
                        const groupKey = `${section}:${group}`;
                        return (
                          <Box key={group} component="section">
                            <ListItemButton
                              aria-expanded={shouldExpand(groupKey)}
                              aria-label={`${shouldExpand(groupKey) ? 'Collapse' : 'Expand'} ${group}`}
                              dense
                              onClick={() => toggleExpanded(groupKey)}
                              sx={{ borderRadius: 1, pl: 2 }}
                            >
                              <ShellIcon
                                color="action"
                                fontSize="small"
                                name={
                                  shouldExpand(groupKey)
                                    ? 'chevron-down'
                                    : 'chevron-right'
                                }
                              />
                              <ListItemText
                                primary={group}
                                slotProps={{
                                  primary: {
                                    color: 'text.secondary',
                                    sx: { fontWeight: 600, ml: 1 },
                                    title: group,
                                  },
                                }}
                              />
                            </ListItemButton>
                            <Collapse
                              in={shouldExpand(groupKey)}
                              timeout="auto"
                              unmountOnExit
                            >
                              <List dense disablePadding sx={{ pl: 3 }}>
                                {groupItems
                                  .sort(
                                    (left, right) =>
                                      left.order - right.order ||
                                      left.title.localeCompare(right.title),
                                  )
                                  .map((item) => (
                                    <ListItemButton
                                      component={RouterLink}
                                      key={item.route}
                                      selected={location.pathname === item.route}
                                      sx={{ borderRadius: 1 }}
                                      to={item.route}
                                    >
                                      <ListItemText
                                        primary={item.title}
                                        secondary={
                                          item.subgroup
                                            ? humanize(item.subgroup)
                                            : undefined
                                        }
                                        slotProps={{
                                          primary: { noWrap: true, title: item.title },
                                          secondary: {
                                            noWrap: true,
                                            title: item.subgroup,
                                          },
                                        }}
                                      />
                                    </ListItemButton>
                                  ))}
                              </List>
                            </Collapse>
                          </Box>
                        );
                      })}
                  </Stack>
                </Collapse>
              </Box>
            ))}
        </Stack>
      )}
      {location.pathname !== '/docs' ? (
        <Link component={RouterLink} to="/docs" underline="hover">
          Documentation home
        </Link>
      ) : null}
    </Stack>
  );
}
