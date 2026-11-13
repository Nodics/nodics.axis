import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import type {
  OnlineDocumentationGuide,
  OnlineDocumentationGuideCatalogue,
  OnlineDocumentationTopic,
} from '../bootstrap/onlineDocumentationGuides';

/** Display imported guide links in their delivered order. */
export function DocumentationGuideNavigation({
  navigation,
}: {
  readonly navigation: OnlineDocumentationGuideCatalogue['navigation'];
}) {
  return (
    <Box
      component="nav"
      aria-label="Documentation guides"
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
    >
      {navigation.map((entry) => (
        <Button key={entry.id} component={RouterLink} to={entry.route}>
          {entry.label}
        </Button>
      ))}
    </Box>
  );
}

/** Channel headings organize the exact articles the Online catalogue grants for this guide. */
export function DocumentationSourceNavigation({
  guide,
  activePath,
}: {
  readonly guide: OnlineDocumentationGuide;
  readonly activePath: string;
}) {
  const [query, setQuery] = useState('');
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filteredTopics = guide.topics.filter((topic) => {
    const label = `${topic.label} ${topic.channelLabel ?? ''}`.toLocaleLowerCase();
    return terms.every((term) => label.includes(term));
  });
  const groups = new Map<string, OnlineDocumentationTopic[]>();
  for (const topic of filteredTopics) {
    const id = topic.channelId ?? '';
    const group = groups.get(id);
    if (group) group.push(topic);
    else groups.set(id, [topic]);
  }
  return (
    <Stack component="nav" aria-label="Documentation topics" spacing={2}>
      <TextField
        label="Find a topic"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by topic or section"
        size="small"
        sx={{ maxWidth: 560 }}
      />
      <Typography role="status" color="text.secondary" variant="body2">
        {filteredTopics.length} of {guide.topics.length} topics
      </Typography>
      {!filteredTopics.length && (
        <Box>
          <Typography>No topics match your search.</Typography>
          <Button onClick={() => setQuery('')}>Clear search</Button>
        </Box>
      )}
      {Array.from(groups, ([id, topics]) => (
        <Box key={id} component="section" aria-label={topics[0]?.channelLabel}>
          {topics[0]?.channelLabel && (
            <Typography component="h2" variant="subtitle1">
              {topics[0].channelLabel}
            </Typography>
          )}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(3, minmax(0, 1fr))',
              },
              gap: 1,
            }}
          >
            {topics.map((topic) => (
              <Button
                key={topic.id}
                component={RouterLink}
                variant="outlined"
                sx={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  minHeight: 56,
                  px: 2,
                  borderColor: 'divider',
                  color: 'text.primary',
                  overflowWrap: 'anywhere',
                }}
                aria-current={topic.route === activePath ? 'page' : undefined}
                to={{
                  pathname: topic.route,
                  search:
                    guide.guide === 'project' ? (guide.route.split('?')[1] ?? '') : '',
                }}
              >
                {topic.label}
              </Button>
            ))}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
