import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';

import type { ProcessGraph } from './api/processDefinitionClient';

/** Displays declared handoffs without treating node storage order as execution order. */
export function WorkflowGraphConnections({
  graph,
  onRemove,
}: {
  readonly graph: ProcessGraph;
  readonly onRemove?: ((code: string) => void) | undefined;
}) {
  const names = new Map(graph.nodes.map((node) => [node.code, node.name ?? node.code]));
  return (
    <Stack spacing={1}>
      <Typography component="h3" variant="h6">
        Connections
      </Typography>
      {graph.transitions.length === 0 ? (
        <Alert severity="info">
          No connections yet. Connect the workflow steps, then save and validate the
          draft.
        </Alert>
      ) : (
        <Stack
          component="ul"
          aria-label="Workflow connections"
          spacing={1}
          sx={{ listStyle: 'none', m: 0, p: 0 }}
        >
          {graph.transitions.map((transition) => (
            <Box
              component="li"
              key={transition.code}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 1.5,
                minWidth: 0,
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
              >
                <Stack spacing={0.5} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <Typography>{`${names.get(transition.source) ?? transition.source} → ${names.get(transition.target) ?? transition.target}`}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {transition.name ?? transition.code}
                  </Typography>
                  {transition.condition !== undefined || transition.default ? (
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                      {transition.condition !== undefined ? (
                        <Chip size="small" label="Conditional" variant="outlined" />
                      ) : null}
                      {transition.default ? (
                        <Chip size="small" label="Default" variant="outlined" />
                      ) : null}
                    </Stack>
                  ) : null}
                </Stack>
                {onRemove ? (
                  <Button
                    aria-label={`Remove connection ${transition.code}`}
                    color="error"
                    onClick={() => onRemove(transition.code)}
                    variant="outlined"
                    sx={{
                      alignSelf: { xs: 'flex-start', sm: 'center' },
                      flexShrink: 0,
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
