import { Alert, Box, Snackbar } from '@mui/material';
import type { PropsWithChildren } from 'react';

import { axisTokens } from '../axisTheme';
import { workspaceComponentGap } from './workspaceLayout';

/**
 * Owns the one authenticated-page viewport contract shared by every Axis route.
 * Route renderers must control only their internal composition; page gutters,
 * vertical start, and maximum content width remain shell concerns.
 */
export function WorkspaceViewport({ children }: PropsWithChildren) {
  return (
    <Box
      data-testid="axis-workspace-viewport"
      sx={{
        boxSizing: 'border-box',
        ml: 0,
        mr: 0,
        maxWidth: axisTokens.spacing.contentMaxWidth,
        minWidth: 0,
        px: {
          xs: `${String(axisTokens.spacing.pageGutter.mobile)}px`,
          sm: `${String(axisTokens.spacing.pageGutter.tablet)}px`,
          lg: `${String(axisTokens.spacing.pageGutter.desktop)}px`,
        },
        py: {
          xs: `${String(axisTokens.spacing.pageGutter.mobile)}px`,
          lg: `${String(axisTokens.spacing.pageGutter.desktop)}px`,
        },
        width: '100%',
      }}
    >
      {children}
    </Box>
  );
}

/**
 * Provides a width-safe semantic boundary for route-owned content.
 * Outer page spacing is deliberately absent because WorkspaceViewport owns it.
 */
export function WorkspaceContainer({ children }: PropsWithChildren) {
  return (
    <Box
      data-axis-layout-boundary="workspace"
      sx={{
        display: 'grid',
        gap: workspaceComponentGap,
        m: 0,
        minWidth: 0,
        p: 0,
        width: '100%',
      }}
    >
      {children}
    </Box>
  );
}

interface NotificationRegionProps {
  readonly message: string | null;
  readonly severity?: 'success' | 'info' | 'warning' | 'error';
  readonly onClose: () => void;
}

export function NotificationRegion({
  message,
  onClose,
  severity = 'info',
}: NotificationRegionProps) {
  return (
    <Snackbar
      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      autoHideDuration={6000}
      open={Boolean(message)}
      onClose={onClose}
    >
      <Alert severity={severity} variant="filled" onClose={onClose}>
        {message}
      </Alert>
    </Snackbar>
  );
}
