import { Alert, Box, Button, Chip, Stack } from '@mui/material';
import { useContext } from 'react';
import { NavigationAvailabilityRecoveryContext } from '../bootstrap/useNavigationAvailabilityRecovery';
import { ShellIcon } from './shell/ShellIcon';

import type { AxisNavigationItem } from '../bootstrap/publicBootstrap';
import { WorkspaceHeading } from './help/WorkspaceHelp';
import { WorkspaceContainer } from './shell/ShellPrimitives';

interface ModuleWorkspacePlaceholderProps {
  readonly item: AxisNavigationItem;
}

/** Presents owner-declared readiness without inferring domain behavior. */
export function ModuleWorkspacePlaceholder({ item }: ModuleWorkspacePlaceholderProps) {
  const disabled = item.featureState === 'DISABLED';
  const recovery = useContext(NavigationAvailabilityRecoveryContext);
  const canRefresh = recovery?.itemId === item.id && recovery.route === item.route;
  return (
    <WorkspaceContainer>
      <Box component="section" aria-label={`${item.label} workspace`}>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <WorkspaceHeading
              description="This authorized module capability was discovered through BackOffice."
              help={item.help}
              title={item.label}
            />
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip label={item.moduleName} size="small" variant="outlined" />
              <Chip
                color={item.availability === 'DEGRADED' ? 'warning' : 'success'}
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
                ? 'This workspace is disabled in the selected runtime.'
                : 'The workspace renderer is not implemented yet. Axis has not inferred business behavior or called an unapproved operation.'}
          </Alert>
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
