import { Box, IconButton, Paper, Stack, Tooltip } from '@mui/material';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';

import { axisTokens } from '../../../app/axisTheme';
import { ShellIcon } from '../../../app/shell/ShellIcon';
import { WorkspaceContainer } from '../../../app/shell/ShellPrimitives';
import { workspacePanelPadding } from '../../../app/shell/workspaceLayout';
import type { CmsPageContract } from '../../cmsContract';

export interface DocumentationArticleTemplateSlots {
  readonly navigation: ReactNode;
  readonly article: ReactNode;
}

interface DocumentationArticleTemplateRendererProps {
  readonly page: CmsPageContract;
  readonly slots: DocumentationArticleTemplateSlots;
}

export function DocumentationArticleTemplateRenderer({
  page,
  slots,
}: DocumentationArticleTemplateRendererProps) {
  const location = useLocation();
  const [navigationOpen, setNavigationOpen] = useState(true);
  const articleScrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (location.hash) return;
    if (articleScrollRef.current) articleScrollRef.current.scrollTop = 0;
  }, [location.hash, location.pathname]);

  return (
    <WorkspaceContainer>
      <Box
        sx={{
          alignItems: 'stretch',
          display: 'grid',
          gap: 1,
          gridTemplateColumns: navigationOpen
            ? { xs: 'minmax(0, 1fr)', lg: '300px minmax(0, 1fr)' }
            : { xs: '56px minmax(0, 1fr)', lg: '56px minmax(0, 1fr)' },
          gridTemplateRows: { xs: 'auto', lg: 'minmax(0, 1fr)' },
          height: {
            xs: 'auto',
            lg: `calc(100dvh - ${String(axisTokens.spacing.header + axisTokens.spacing.pageGutter.desktop * 2 + 52)}px)`,
          },
          minHeight: 0,
          overflow: { xs: 'visible', lg: 'hidden' },
        }}
      >
        <Paper
          component="aside"
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            height: { xs: 'auto', lg: '100%' },
            minHeight: 0,
            overflow: 'hidden',
            p: navigationOpen ? workspacePanelPadding : 1,
          }}
        >
          {navigationOpen ? (
            <Stack
              spacing={0}
              sx={{ height: '100%', minHeight: 0, position: 'relative' }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  transform: 'translateY(-25%)',
                  zIndex: 1,
                }}
              >
                <Tooltip title="Hide documentation navigation">
                  <IconButton
                    aria-label="Hide documentation navigation"
                    size="small"
                    onClick={() => setNavigationOpen(false)}
                  >
                    <ShellIcon fontSize="small" name="chevron-left" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box
                data-testid="documentation-navigation-scroll-region"
                sx={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  '& > nav > h2:first-of-type': { pr: 5 },
                  scrollbarGutter: 'stable',
                }}
              >
                {slots.navigation}
              </Box>
            </Stack>
          ) : (
            <Stack sx={{ alignItems: 'center' }}>
              <Tooltip title="Show documentation navigation">
                <IconButton
                  aria-label="Show documentation navigation"
                  onClick={() => setNavigationOpen(true)}
                >
                  <ShellIcon name="chevron-right" />
                </IconButton>
              </Tooltip>
              <ShellIcon color="disabled" name="content" sx={{ mt: 1 }} />
            </Stack>
          )}
        </Paper>
        <Paper
          ref={articleScrollRef}
          component="article"
          aria-label={page.name ?? 'Documentation article'}
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            height: { xs: 'auto', lg: '100%' },
            minWidth: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            p: workspacePanelPadding,
            scrollbarGutter: 'stable',
          }}
          data-testid="documentation-article-scroll-region"
        >
          <Box sx={{ minWidth: 0 }}>{slots.article}</Box>
        </Paper>
      </Box>
    </WorkspaceContainer>
  );
}
