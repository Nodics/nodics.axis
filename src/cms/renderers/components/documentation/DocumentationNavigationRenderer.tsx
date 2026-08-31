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
import { alpha } from '@mui/material/styles';
import type { MouseEvent } from 'react';
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
    const group = section;
    const subgroup = '';
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

function sortedDocumentationItems(
  items: readonly DocumentationNavigationItem[],
): readonly DocumentationNavigationItem[] {
  return [...items].sort(
    (left, right) =>
      left.sectionOrder - right.sectionOrder ||
      left.order - right.order ||
      left.title.localeCompare(right.title),
  );
}

function DocumentationPageLink({
  activePathname,
  item,
  locationPathname,
  onNavigate,
}: {
  readonly activePathname?: string | undefined;
  readonly item: DocumentationNavigationItem;
  readonly locationPathname: string;
  readonly onNavigate?: ((route: string) => void) | undefined;
}) {
  const selected = (activePathname ?? locationPathname) === item.route;
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate) return;
    event.preventDefault();
    onNavigate(item.route);
  };

  return (
    <ListItemButton
      component={RouterLink}
      key={item.route}
      selected={selected}
      sx={{
        alignItems: 'flex-start',
        borderRadius: 1,
        minHeight: 40,
        px: 1.5,
        py: 0.75,
        '&.Mui-selected': {
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16),
          color: 'text.primary',
        },
        '&.Mui-selected:hover': {
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.22),
        },
      }}
      to={item.route}
      onClick={handleClick}
    >
      <ListItemText
        primary={item.title}
        slotProps={{
          primary: {
            title: item.title,
            sx: {
              display: '-webkit-box',
              fontSize: '0.92rem',
              fontWeight: selected ? 700 : 500,
              lineHeight: 1.35,
              overflow: 'hidden',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
            },
          },
        }}
      />
    </ListItemButton>
  );
}

export function DocumentationNavigationRenderer({
  activePathname,
  component,
  onNavigate,
}: CmsComponentRendererProps & {
  readonly activePathname?: string | undefined;
  readonly onNavigate?: ((route: string) => void) | undefined;
}) {
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
    const searchable = [
      item.title,
      item.category,
      item.group,
      item.subgroup,
      item.searchText,
      ...item.audience,
    ]
      .join(' ')
      .toLocaleLowerCase();
    return (
      (!normalizedQuery || searchable.includes(normalizedQuery)) &&
      (!audience || item.audience.includes(audience))
    );
  });
  const grouped = filtered.reduce((result, item) => {
    const section = humanize(item.section || item.category);
    const sectionEntry = result.get(section) ?? {
      order: item.sectionOrder,
      items: [],
    };
    sectionEntry.order = Math.min(sectionEntry.order, item.sectionOrder);
    sectionEntry.items.push(item);
    result.set(section, sectionEntry);
    return result;
  }, new Map<string, { order: number; items: DocumentationNavigationItem[] }>());
  const sortedGroups = [...grouped.entries()].sort(
    (left, right) => left[1].order - right[1].order || left[0].localeCompare(right[0]),
  );
  const titleAsSection = humanize(title).toLocaleLowerCase();
  const shouldUseTitleAsOnlyGroup =
    sortedGroups.length === 1 &&
    sortedGroups[0]?.[0].toLocaleLowerCase() === titleAsSection;
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
    <Stack component="nav" aria-label={title} spacing={1.25} sx={{ pr: 0.5 }}>
      <Typography component="h2" sx={{ fontWeight: 800, pr: 5 }} variant="h6">
        {title}
      </Typography>
      <TextField
        fullWidth
        placeholder={searchPlaceholder}
        size="small"
        slotProps={{
          htmlInput: {
            'aria-label': searchLabel,
          },
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
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: 'background.paper',
            borderRadius: 1,
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
      ) : shouldUseTitleAsOnlyGroup ? (
        <List dense disablePadding sx={{ py: 0.25 }}>
          {sortedDocumentationItems(sortedGroups[0]?.[1].items ?? []).map((item) => (
            <DocumentationPageLink
              activePathname={activePathname}
              item={item}
              key={item.route}
              locationPathname={location.pathname}
              onNavigate={onNavigate}
            />
          ))}
        </List>
      ) : (
        <Stack spacing={0.5}>
          {sortedGroups.map(([section, sectionEntry]) => (
            <Box component="section" key={section}>
              <ListItemButton
                aria-expanded={shouldExpand(section)}
                aria-label={`${shouldExpand(section) ? 'Collapse' : 'Expand'} ${section}`}
                dense
                onClick={() => toggleExpanded(section)}
                sx={{
                  alignItems: 'center',
                  borderRadius: 1,
                  minHeight: 44,
                  px: 1,
                  py: 0.75,
                }}
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
                      sx: {
                        fontWeight: 800,
                        lineHeight: 1.25,
                        ml: 1,
                      },
                      title: section,
                    },
                  }}
                />
              </ListItemButton>
              <Collapse in={shouldExpand(section)} timeout="auto" unmountOnExit>
                <List dense disablePadding sx={{ pl: 3.5, pr: 0.5, py: 0.5 }}>
                  {sortedDocumentationItems(sectionEntry.items).map((item) => (
                    <DocumentationPageLink
                      activePathname={activePathname}
                      item={item}
                      key={item.route}
                      locationPathname={location.pathname}
                      onNavigate={onNavigate}
                    />
                  ))}
                </List>
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
