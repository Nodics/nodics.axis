/** @file Displays backend-measured Copilot usage; missing measurements never imply zero cost. */
import { Chip, Paper, Stack, Typography } from '@mui/material';

import type { AssistantUsage } from '../../../../assistant/api/assistantContracts';

interface AssistantUsageCardProps {
  readonly usage: AssistantUsage;
  readonly title: string;
  readonly inputLabel: string;
  readonly outputLabel: string;
  readonly cachedLabel: string;
  readonly reasoningLabel: string;
  readonly embeddingLabel: string;
  readonly reconciliationLabel: string;
}

/** Renders known token counts and a neutral placeholder for unknown measurements. */
export function AssistantUsageCard(props: AssistantUsageCardProps) {
  const values = [
    [props.inputLabel, props.usage.inputTokens],
    [props.outputLabel, props.usage.outputTokens],
    [props.cachedLabel, props.usage.cachedInputTokens],
    [props.reasoningLabel, props.usage.reasoningTokens],
    [props.embeddingLabel, props.usage.embeddingTokens],
  ] as const;
  return (
    <Paper component="section" variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Typography component="h3" sx={{ fontWeight: 700 }}>
          {props.title}
        </Typography>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {values.map(([label, value]) => (
            <Chip
              key={label}
              label={`${label}: ${value === null ? '-' : String(value)}`}
              size="small"
            />
          ))}
        </Stack>
        {props.usage.reconciliationState ? (
          <Typography color="text.secondary" variant="body2">
            {props.reconciliationLabel}: {props.usage.reconciliationState}
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}
