import { Box, Stack, Typography } from '@mui/material';
import { memo } from 'react';

interface AssistantMessageBubbleProps {
  readonly label: string;
  readonly message: string;
  readonly speaker: 'assistant' | 'employee';
  readonly streaming?: boolean | undefined;
}

export const AssistantMessageBubble = memo(function AssistantMessageBubble({
  label,
  message,
  speaker,
  streaming = false,
}: AssistantMessageBubbleProps) {
  const employee = speaker === 'employee';
  return (
    <Stack
      component="article"
      spacing={0.75}
      sx={{ alignItems: employee ? 'flex-end' : 'flex-start', width: '100%' }}
    >
      <Typography color="text.secondary" variant="caption">
        {label}
      </Typography>
      <Box
        sx={{
          background: employee
            ? 'linear-gradient(135deg, #f5b800, #ffd33d)'
            : 'background.paper',
          border: '1px solid',
          borderColor: employee ? 'primary.dark' : 'divider',
          borderRadius: employee ? '20px 20px 6px 20px' : '6px 20px 20px 20px',
          boxShadow: employee
            ? '0 8px 20px rgba(194, 143, 0, 0.16)'
            : '0 10px 28px rgba(15, 23, 42, 0.07)',
          color: employee ? 'primary.contrastText' : 'text.primary',
          maxWidth: { xs: '94%', md: '78%' },
          px: { xs: 2, md: 2.5 },
          py: { xs: 1.5, md: 2 },
        }}
      >
        <Typography
          component="p"
          sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
        >
          {message}
          {streaming ? (
            <Box
              aria-hidden="true"
              component="span"
              sx={{
                '@keyframes assistant-cursor': {
                  '0%, 45%': { opacity: 1 },
                  '46%, 100%': { opacity: 0.2 },
                },
                animation: 'assistant-cursor 1s step-end infinite',
                bgcolor: 'primary.main',
                display: 'inline-block',
                height: '1em',
                ml: 0.5,
                verticalAlign: '-0.12em',
                width: 2,
              }}
            />
          ) : null}
        </Typography>
      </Box>
    </Stack>
  );
});
