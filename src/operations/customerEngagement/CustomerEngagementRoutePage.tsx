import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router';

import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkbenchRoutePage } from '../../workbench/WorkbenchRoutePage';

interface CustomerEngagementRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly channel: string;
  readonly cmsBaseUrl: string;
  readonly employeeId: string;
  readonly locale: string;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
  readonly site: string;
}

const engagementItems = (
  items: readonly AxisNavigationItem[],
): readonly AxisNavigationItem[] =>
  items
    .filter(
      (item) => item.route.startsWith('/engagement') && item.featureState !== 'HIDDEN',
    )
    .sort((left, right) => left.order - right.order);

export function CustomerEngagementRoutePage({
  accessToken,
  bootstrap,
  channel,
  cmsBaseUrl,
  employeeId,
  locale,
  navigation,
  runtime,
  site,
}: CustomerEngagementRoutePageProps) {
  const navigate = useNavigate();
  const workspaces = engagementItems(bootstrap.navigation);
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            sx={{ justifyContent: 'space-between' }}
          >
            <Box>
              <Typography variant="overline">Customer Experience</Typography>
              <Typography variant="h4">{navigation.label}</Typography>
              <Typography color="text.secondary">
                {navigation.help?.summary ??
                  'Review customer submissions and perform only backend-authorized lifecycle actions.'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Chip label="Backend governed" color="success" size="small" />
              <Chip label={navigation.availability} size="small" />
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {workspaces.map((item) => (
              <Button
                key={`${item.moduleName}:${item.id}`}
                size="small"
                variant={item.id === navigation.id ? 'contained' : 'outlined'}
                onClick={() => void navigate(item.route)}
              >
                {item.label}
              </Button>
            ))}
          </Stack>
          <Alert severity="info">
            Customer evidence, contact details, consent proof, and editorial source text
            remain protected record data. Axis displays them only through the authorized
            workbench contract and never creates a browser-side customer engagement
            store.
          </Alert>
        </Stack>
      </Paper>
      {navigation.workbenchTarget ? (
        <WorkbenchRoutePage
          accessToken={accessToken}
          bootstrap={bootstrap}
          channel={channel}
          cmsBaseUrl={cmsBaseUrl}
          employeeId={employeeId}
          locale={locale}
          routeNavigation={navigation}
          routeSchema={navigation.workbenchTarget}
          runtime={runtime}
          site={site}
        />
      ) : null}
    </Stack>
  );
}
