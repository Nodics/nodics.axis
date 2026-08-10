import {
  Box,
  Chip,
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
    const searchText = boundedString(record.searchText);
    if (!title || !route.startsWith('/docs')) return [];
    const audience = Array.isArray(record.audience)
      ? record.audience.map(boundedString).filter(Boolean).slice(0, 20)
      : [];
    return [{ title, route, category, audience, searchText }];
  });
}

export function DocumentationNavigationRenderer({
  component,
}: CmsComponentRendererProps) {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [audience, setAudience] = useState('');
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
    const category = humanize(item.category);
    result.set(category, [...(result.get(category) ?? []), item]);
    return result;
  }, new Map<string, DocumentationNavigationItem[]>());

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
          {[...grouped.entries()].map(([category, categoryItems]) => (
            <Box component="section" key={category}>
              <Typography
                component="h3"
                color="text.secondary"
                sx={{ px: 1, py: 0.75 }}
                variant="overline"
              >
                {category}
              </Typography>
              <List dense disablePadding>
                {categoryItems.map((item) => (
                  <ListItemButton
                    component={RouterLink}
                    key={item.route}
                    selected={location.pathname === item.route}
                    to={item.route}
                  >
                    <ListItemText
                      primary={item.title}
                      slotProps={{ primary: { noWrap: true, title: item.title } }}
                    />
                  </ListItemButton>
                ))}
              </List>
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
