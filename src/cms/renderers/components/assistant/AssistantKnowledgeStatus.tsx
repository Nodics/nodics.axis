import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';

import type { AssistantKnowledgeStatus as KnowledgeStatus } from '../../../../assistant/api/assistantContracts';

interface AssistantKnowledgeStatusProps {
  readonly status?: KnowledgeStatus | undefined;
  readonly loading: boolean;
  readonly error?: string | undefined;
  readonly refreshingSource?: string | undefined;
  readonly title: string;
  readonly sourcesLabel: string;
  readonly chunksLabel: string;
  readonly lastRefreshLabel: string;
  readonly refreshLabel: string;
  readonly refreshingLabel: string;
  readonly unavailableLabel: string;
  readonly onRefresh: (sourceCode: string) => Promise<void>;
}

export function AssistantKnowledgeStatus(props: AssistantKnowledgeStatusProps) {
  if (props.loading) {
    return (
      <Stack direction="row" spacing={1} sx={{ p: 2 }}>
        <CircularProgress size={18} />
        <Typography>{props.title}</Typography>
      </Stack>
    );
  }
  if (props.error)
    return (
      <Alert severity="warning">
        {props.unavailableLabel}: {props.error}
      </Alert>
    );
  if (!props.status) return null;
  const chunks = props.status.sources.reduce(
    (total, source) => total + source.chunksProjected,
    0,
  );
  return (
    <Box
      sx={{
        borderBottom: '1px solid',
        borderColor: 'divider',
        px: { xs: 2, md: 3 },
        py: 1.5,
      }}
    >
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { lg: 'center' } }}
      >
        <Typography sx={{ fontWeight: 700 }}>{props.title}</Typography>
        <Chip
          size="small"
          label={`${props.sourcesLabel}: ${props.status.sources.length}`}
        />
        <Chip size="small" label={`${props.chunksLabel}: ${chunks}`} />
        {props.status.lastRefreshAt ? (
          <Typography color="text.secondary" variant="caption">
            {props.lastRefreshLabel}:{' '}
            {new Date(props.status.lastRefreshAt).toLocaleString()}
          </Typography>
        ) : null}
        <Stack
          direction="row"
          spacing={1}
          sx={{ ml: { lg: 'auto' }, overflowX: 'auto' }}
        >
          {props.status.sources.map((source) => (
            <Button
              key={source.code}
              size="small"
              variant="outlined"
              disabled={Boolean(props.refreshingSource)}
              onClick={() => void props.onRefresh(source.code)}
            >
              {props.refreshingSource === source.code
                ? props.refreshingLabel
                : `${props.refreshLabel} ${source.code}`}
            </Button>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
