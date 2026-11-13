import { Box, Button, Stack } from '@mui/material';
import { Link } from 'react-router';

import { WorkspaceHeading } from './help/WorkspaceHelp';
import { WorkspaceContainer } from './shell/ShellPrimitives';

/** Generic route recovery; the admitted navigation supplies its canonical module owner. Executes no domain read or command. */
export function UnavailableWorkspaceRoutePage({
  moduleName,
  dashboardRoute,
}: {
  readonly moduleName: string;
  readonly dashboardRoute: string;
}) {
  return (
    <WorkspaceContainer>
      <Box component="section" data-axis-owner={moduleName}>
        <Stack spacing={3} sx={{ alignItems: 'flex-start' }}>
          <WorkspaceHeading
            title="Page unavailable"
            description="This page is not available in your current workspace. Choose a page from the navigation or return to your dashboard."
          />
          <Button component={Link} to={dashboardRoute} variant="outlined">
            Return to dashboard
          </Button>
        </Stack>
      </Box>
    </WorkspaceContainer>
  );
}
