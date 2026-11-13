import { Alert, Box, Button, Chip, Stack } from '@mui/material';
import { useContext } from 'react';
import { Link } from 'react-router';
import {
  hasUnavailableNavigation,
  NavigationAvailabilityRecoveryContext,
} from '../bootstrap/useNavigationAvailabilityRecovery';
import { ShellIcon } from './shell/ShellIcon';

import type { AxisNavigationItem } from '../bootstrap/publicBootstrap';
import { WorkspaceHeading } from './help/WorkspaceHelp';
import { WorkspaceContainer } from './shell/ShellPrimitives';

interface ModuleWorkspacePlaceholderProps {
  readonly item: AxisNavigationItem;
  readonly dashboardRoute?: string | undefined;
}

/** Presents owner-declared readiness without inferring domain behavior. */
export function ModuleWorkspacePlaceholder({
  item,
  dashboardRoute,
}: ModuleWorkspacePlaceholderProps) {
  const disabled = item.featureState === 'DISABLED';
  const recovery = useContext(NavigationAvailabilityRecoveryContext);
  const canRefresh =
    recovery?.moduleName === item.moduleName &&
    recovery.route === item.route &&
    hasUnavailableNavigation(item);
  return (
    <WorkspaceContainer>
      <Box component="section" aria-label={`${item.label} workspace`}>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <WorkspaceHeading
              description="Review availability and next steps for this workspace."
              help={item.help}
              title={item.label}
            />
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip label={item.moduleName} size="small" variant="outlined" />
              <Chip
                color={['UP'].includes(item.availability) ? 'success' : 'warning'}
                label={
                  disabled ? `Module health: ${item.availability}` : item.availability
                }
                size="small"
              />
              {disabled ? <Chip color="warning" label="DISABLED" size="small" /> : null}
            </Stack>
          </Stack>
          <Alert severity={disabled ? 'warning' : 'info'}>
            {canRefresh
              ? (recovery.message ?? 'This workspace is temporarily unavailable.')
              : disabled
                ? 'This workspace is disabled in the selected runtime. Choose another page or contact your administrator to review its configuration.'
                : 'This workspace is not available in the current Axis experience. Choose another page from the navigation or contact your administrator.'}
          </Alert>
          {dashboardRoute ? (
            <Button
              component={Link}
              to={dashboardRoute}
              variant="outlined"
              sx={{ alignSelf: 'flex-start' }}
            >
              Return to dashboard
            </Button>
          ) : null}
          {canRefresh ? (
            <Button
              disabled={recovery.refreshing}
              onClick={recovery.refresh}
              startIcon={<ShellIcon name="refresh" />}
              sx={{ alignSelf: 'flex-start' }}
            >
              Refresh availability
            </Button>
          ) : null}
        </Stack>
      </Box>
    </WorkspaceContainer>
  );
}
