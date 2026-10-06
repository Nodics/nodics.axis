/** @file Compact permitted knowledge selection and effective grant summary for the conversation route. */
import {
  Box,
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type { CopilotContext } from './api/copilotContextClient';
import { CopilotAccessJourneys } from './CopilotAccessJourneys';

/** Renders backend-owned permitted choices; selection can only narrow the next turn. */
export function CopilotContextView({
  context,
  selected,
  disabled,
  onChange,
}: {
  readonly context: CopilotContext;
  readonly selected: readonly string[] | undefined;
  readonly disabled: boolean;
  readonly onChange: (values: readonly string[]) => void;
}) {
  const copy = context.presentation;
  const effective = selected ?? context.groups.items.map((item) => item.code);
  return (
    <Stack sx={{ px: { xs: 2, md: 3 }, py: 2, gap: 2 }}>
      {context.recording ? (
        <Typography variant="body2" color="text.secondary">
          {context.recording.notice}
        </Typography>
      ) : null}
      {context.groups.enabled ? (
        <FormControl
          size="small"
          sx={{ width: '100%', maxWidth: 520 }}
          disabled={disabled}
        >
          <InputLabel id="copilot-knowledge-context" shrink>
            {copy.groups}
          </InputLabel>
          <Select
            multiple
            notched
            labelId="copilot-knowledge-context"
            label={copy.groups}
            value={[...effective]}
            displayEmpty
            renderValue={(values) =>
              values.length === 0
                ? copy.noGroups
                : values.length === context.groups.items.length
                  ? copy.allGroups
                  : context.groups.items
                      .filter((item) => values.includes(item.code))
                      .map((item) => item.name)
                      .join(', ')
            }
            onChange={(event) =>
              onChange(
                typeof event.target.value === 'string'
                  ? event.target.value.split(',')
                  : event.target.value,
              )
            }
            sx={{
              '& .MuiSelect-select': { whiteSpace: 'normal', overflowWrap: 'anywhere' },
            }}
          >
            {context.groups.items.map((item) => (
              <MenuItem
                key={item.code}
                value={item.code}
                sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}
              >
                <Checkbox checked={effective.includes(item.code)} />
                <ListItemText primary={item.name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : null}
      <Box component="details">
        <Typography component="summary" variant="body2" sx={{ cursor: 'pointer' }}>
          {copy.access}
        </Typography>
        <Box component="dl" sx={{ m: 0, mt: 1 }}>
          {context.access.map((item, index) => (
            <Stack
              key={item.permission}
              direction="row"
              sx={{ gap: 2, flexWrap: 'wrap', py: 0.25 }}
            >
              <Typography component="dt" variant="body2">
                {
                  copy[
                    (['knowledge', 'prepare', 'execute', 'activity'] as const)[index]!
                  ]
                }
              </Typography>
              <Typography
                component="dd"
                variant="body2"
                sx={{ m: 0 }}
                color={item.allowed ? 'success.main' : 'text.secondary'}
              >
                {item.allowed ? copy.allowed : copy.denied}
              </Typography>
            </Stack>
          ))}
        </Box>
        {context.explanations.domainAuthorization ? (
          <Typography variant="body2" sx={{ mt: 1 }}>
            {context.explanations.domainAuthorization}
          </Typography>
        ) : null}
        {context.access.some((item) => !item.allowed) &&
        context.explanations.permissionRequired ? (
          <Typography variant="body2" sx={{ mt: 1 }}>
            {context.explanations.permissionRequired}
          </Typography>
        ) : null}
        {context.groups.enabled &&
        !context.groups.items.length &&
        context.explanations.noActiveKnowledge ? (
          <Typography variant="body2" sx={{ mt: 1 }}>
            {context.explanations.noActiveKnowledge}
          </Typography>
        ) : null}
      </Box>
      {context.journeys ? <CopilotAccessJourneys value={context.journeys} /> : null}
    </Stack>
  );
}
