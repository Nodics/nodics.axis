/** @file Inert operation-specific access explanations; never grants authority, runs a command or navigates an unverified route. */
import { Box, Stack, Typography } from '@mui/material';
import type { CopilotContext } from './api/copilotContextClient';

/** Shows compact expandable journeys with backend-provided reasons and administrator remediation. */
export function CopilotAccessJourneys({
  value,
}: {
  readonly value: NonNullable<CopilotContext['journeys']>;
}) {
  return (
    <Box component="details" sx={{ minWidth: 0 }}>
      <Typography component="summary" variant="body2" sx={{ cursor: 'pointer' }}>
        {value.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
        {value.notice}
      </Typography>
      {value.items.map((item) => (
        <Box
          component="details"
          key={item.code}
          sx={{ borderTop: 1, borderColor: 'divider', py: 1, minWidth: 0 }}
        >
          <Box component="summary" sx={{ cursor: 'pointer', overflowWrap: 'anywhere' }}>
            <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
              {item.label}
            </Typography>
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              sx={{ ml: 1 }}
            >
              {item.stateLabel}
            </Typography>
          </Box>
          <Stack sx={{ gap: 1, mt: 1 }}>
            <Typography variant="body2">{item.reason}</Typography>
            <Typography variant="body2" color="text.secondary">
              {item.nextStep}
            </Typography>
            {item.missingPermissions.length ? (
              <Typography
                component="code"
                variant="caption"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {item.missingPermissions.join(', ')}
              </Typography>
            ) : null}
          </Stack>
        </Box>
      ))}
    </Box>
  );
}
