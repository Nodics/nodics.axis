import { Box, IconButton, Paper, Stack, Tooltip } from '@mui/material';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  readonly embedded?: boolean | undefined;
  readonly page: CmsPageContract;
  readonly slots: DocumentationArticleTemplateSlots;
}

const documentationNavigationWidthKey = 'axis.documentation.navigationWidth';
const defaultDocumentationNavigationWidth = 360;
const minDocumentationNavigationWidth = 280;
const maxDocumentationNavigationWidth = 640;

function clampDocumentationNavigationWidth(width: number): number {
  return Math.min(
    maxDocumentationNavigationWidth,
    Math.max(minDocumentationNavigationWidth, Math.round(width)),
  );
}

function initialDocumentationNavigationWidth(): number {
  if (typeof window === 'undefined') return defaultDocumentationNavigationWidth;
  const storedValue = window.localStorage.getItem(documentationNavigationWidthKey);
  if (!storedValue) return defaultDocumentationNavigationWidth;
  const stored = Number(storedValue);
  return Number.isFinite(stored)
    ? clampDocumentationNavigationWidth(stored)
    : defaultDocumentationNavigationWidth;
}

export function DocumentationArticleTemplateRenderer({
  embedded = false,
  page,
  slots,
}: DocumentationArticleTemplateRendererProps) {
  const location = useLocation();
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [navigationWidth, setNavigationWidth] = useState(
    initialDocumentationNavigationWidth,
  );
  const articleScrollRef = useRef<HTMLElement>(null);
  const resizeStartRef = useRef<Readonly<{ x: number; width: number }> | null>(null);
  const stopNavigationResizeRef = useRef<() => void>(() => undefined);

  const handleNavigationResize = useCallback((event: PointerEvent) => {
    if (!resizeStartRef.current) return;
    setNavigationWidth(
      clampDocumentationNavigationWidth(
        resizeStartRef.current.width + event.clientX - resizeStartRef.current.x,
      ),
    );
  }, []);

  const stopNavigationResize = useCallback(() => {
    resizeStartRef.current = null;
    document.removeEventListener('pointermove', handleNavigationResize);
    document.removeEventListener('pointerup', stopNavigationResizeRef.current);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleNavigationResize]);

  useEffect(() => {
    if (location.hash) return;
    if (articleScrollRef.current) articleScrollRef.current.scrollTop = 0;
  }, [location.hash, location.pathname]);

  useEffect(() => {
    window.localStorage.setItem(
      documentationNavigationWidthKey,
      String(navigationWidth),
    );
  }, [navigationWidth]);

  useEffect(() => {
    stopNavigationResizeRef.current = stopNavigationResize;
  }, [stopNavigationResize]);

  useEffect(() => () => stopNavigationResizeRef.current(), []);

  const content = (
    <Box
      sx={{
        alignItems: 'stretch',
        display: 'grid',
        gridTemplateColumns: navigationOpen
          ? {
              xs: 'minmax(0, 1fr)',
              lg: `${String(navigationWidth)}px 10px minmax(0, 1fr)`,
            }
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
      {navigationOpen ? (
        <Box
          aria-label="Resize documentation navigation"
          aria-valuemax={maxDocumentationNavigationWidth}
          aria-valuemin={minDocumentationNavigationWidth}
          aria-valuenow={navigationWidth}
          data-testid="documentation-layout-resizer"
          onDoubleClick={() => setNavigationWidth(defaultDocumentationNavigationWidth)}
          onPointerDown={(event) => {
            event.preventDefault();
            resizeStartRef.current = {
              x: event.clientX,
              width: navigationWidth,
            };
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            document.addEventListener('pointermove', handleNavigationResize);
            document.addEventListener('pointerup', stopNavigationResizeRef.current);
          }}
          role="separator"
          sx={{
            alignItems: 'center',
            cursor: 'col-resize',
            display: { xs: 'none', lg: 'flex' },
            justifyContent: 'center',
            mx: -0.25,
            outline: 0,
            touchAction: 'none',
            '&::before': {
              bgcolor: 'divider',
              borderRadius: axisTokens.radius.pill,
              content: '""',
              height: '100%',
              maxHeight: 96,
              transition: (theme) =>
                theme.transitions.create(['background-color', 'width']),
              width: 2,
            },
            '&:hover::before, &:focus-visible::before': {
              bgcolor: 'primary.main',
              width: 4,
            },
          }}
          tabIndex={0}
        />
      ) : null}
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
  );

  return embedded ? content : <WorkspaceContainer>{content}</WorkspaceContainer>;
}
