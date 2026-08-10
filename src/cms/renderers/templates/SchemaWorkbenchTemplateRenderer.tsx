import { Box, Stack } from '@mui/material';
import type { ReactNode } from 'react';

import { WorkspaceContainer } from '../../../app/shell/ShellPrimitives';
import { axisTokens } from '../../../app/axisTheme';
import type { CmsPageContract } from '../../cmsContract';

export interface SchemaWorkbenchTemplateSlots {
  readonly header: ReactNode;
  readonly content: ReactNode;
}

interface SchemaWorkbenchTemplateRendererProps {
  readonly page: CmsPageContract;
  readonly slots: SchemaWorkbenchTemplateSlots;
}

export function SchemaWorkbenchTemplateRenderer({
  page,
  slots,
}: SchemaWorkbenchTemplateRendererProps) {
  return (
    <WorkspaceContainer>
      <Stack
        component="section"
        aria-label={page.name ?? 'Schema Workbench'}
        spacing={1}
        sx={{
          height: {
            xs: 'auto',
            lg: `calc(100dvh - ${String(axisTokens.spacing.header + axisTokens.spacing.pageGutter.desktop * 2)}px)`,
          },
          minHeight: 0,
          overflow: { xs: 'visible', lg: 'hidden' },
        }}
      >
        <Box>{slots.header}</Box>
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overflow: { xs: 'visible', lg: 'hidden' },
            position: 'relative',
          }}
        >
          {slots.content}
        </Box>
      </Stack>
    </WorkspaceContainer>
  );
}
