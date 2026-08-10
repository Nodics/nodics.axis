import {
  Alert,
  Box,
  Button,
  CardActionArea,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router';

import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkbenchRoutePage } from '../../workbench/WorkbenchRoutePage';
import { engagementDomains } from './engagementDomains';

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

const quietButtonSx = {
  borderColor: 'divider',
  color: 'text.primary',
  '&:hover': { borderColor: 'text.secondary', bgcolor: 'action.hover' },
} as const;

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
  const domains = engagementDomains(bootstrap.navigation);
  const selectedDomain =
    navigation.id === 'customer-engagement'
      ? undefined
      : domains.find((domain) =>
          domain.items.some((item) => item.id === navigation.id),
        );

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            sx={{ justifyContent: 'space-between' }}
          >
            <Box sx={{ maxWidth: 880 }}>
              <Typography color="text.secondary" variant="overline">
                Customer Experience
              </Typography>
              <Typography variant="h4">{navigation.label}</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {navigation.help?.summary ??
                  'Review customer submissions and perform only backend-authorized lifecycle actions.'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Chip label="Backend governed" color="success" size="small" />
              <Chip label={navigation.availability} size="small" />
            </Stack>
          </Stack>

          {selectedDomain ? (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {domains.map((domain) => (
                  <Button
                    key={domain.id}
                    size="small"
                    sx={domain.id === selectedDomain.id ? undefined : quietButtonSx}
                    variant={domain.id === selectedDomain.id ? 'contained' : 'outlined'}
                    onClick={() =>
                      void navigate(domain.items[0]?.route ?? '/engagement')
                    }
                  >
                    {domain.label}
                  </Button>
                ))}
              </Stack>
              <FormControl fullWidth size="small" sx={{ maxWidth: 420 }}>
                <InputLabel id="engagement-current-view-label">Current view</InputLabel>
                <Select
                  label="Current view"
                  labelId="engagement-current-view-label"
                  value={navigation.route}
                  onChange={(event) => void navigate(event.target.value)}
                >
                  {selectedDomain.items.map((item) => (
                    <MenuItem key={`${item.moduleName}:${item.id}`} value={item.route}>
                      {item.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(3, minmax(0, 1fr))',
                },
              }}
            >
              {domains.map((domain) => (
                <Paper key={domain.id} variant="outlined" sx={{ overflow: 'hidden' }}>
                  <CardActionArea
                    aria-label={`Open ${domain.label}`}
                    onClick={() =>
                      void navigate(domain.items[0]?.route ?? '/engagement')
                    }
                    sx={{ minHeight: 112, p: 2, textAlign: 'left' }}
                  >
                    <Typography variant="h6">{domain.label}</Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
                      {domain.items.length} authorized{' '}
                      {domain.items.length === 1 ? 'view' : 'views'}
                    </Typography>
                    <Typography color="primary.dark" sx={{ mt: 1 }} variant="body2">
                      Start with {domain.items[0]?.label ?? domain.label}
                    </Typography>
                  </CardActionArea>
                </Paper>
              ))}
            </Box>
          )}

          {navigation.workbenchTarget ? (
            <Alert severity="info" sx={{ py: 0.25 }}>
              Protected customer evidence is shown only through this authorized backend
              workbench.
            </Alert>
          ) : null}
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
