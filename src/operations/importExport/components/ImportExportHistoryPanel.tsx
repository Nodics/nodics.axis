import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
} from '@mui/material';

import { ShellIcon } from '../../../app/shell/ShellIcon';
import type { ImportRunFailure, ImportRunSummary } from '../api/dataReleaseContracts';
import {
  formatRunType,
  formatStatus,
  summarizeModules,
  type HistoryFilter,
} from '../importExportPresentation';

interface ImportExportHistoryPanelProps {
  readonly filter: HistoryFilter;
  readonly filteredRuns: readonly ImportRunSummary[];
  readonly isError: boolean;
  readonly isLoading: boolean;
  readonly isSuccess: boolean;
  readonly onFilterChange: (value: HistoryFilter) => void;
  readonly onSearchChange: (value: string) => void;
  readonly runs: readonly ImportRunSummary[];
  readonly search: string;
  readonly errorMessage: string | undefined;
}

function count(value: number | undefined): string {
  return value === undefined ? '0' : value.toLocaleString();
}

function failureTitle(failure: ImportRunFailure, index: number): string {
  return (
    failure.recordKey ??
    failure.fileName ??
    failure.headerName ??
    `Failure ${String(index + 1)}`
  );
}

function failureContext(failure: ImportRunFailure): string {
  return [
    failure.fileName ? `File: ${failure.fileName}` : undefined,
    failure.schemaName ? `Schema: ${failure.schemaName}` : undefined,
    failure.operation ? `Operation: ${failure.operation}` : undefined,
    failure.tenant ? `Tenant: ${failure.tenant}` : undefined,
  ]
    .filter((item): item is string => Boolean(item))
    .join(' · ');
}

function ImportRunFailureList(props: {
  readonly failures: readonly ImportRunFailure[];
}) {
  if (props.failures.length === 0) return null;
  return (
    <Paper
      elevation={0}
      sx={(theme) => ({
        bgcolor: alpha(theme.palette.error.main, 0.06),
        border: 1,
        borderColor: alpha(theme.palette.error.main, 0.18),
        mx: { xs: 1.5, md: 2 },
        mb: 1.5,
        p: { xs: 1.25, md: 1.5 },
      })}
    >
      <Stack spacing={1}>
        <Typography color="error.dark" sx={{ fontWeight: 800 }}>
          Failed records
        </Typography>
        {props.failures.slice(0, 10).map((failure, index) => (
          <Box key={`${failureTitle(failure, index)}-${String(index)}`}>
            <Typography sx={{ fontWeight: 700 }}>
              {failureTitle(failure, index)}
              {failure.error?.code ? ` · ${failure.error.code}` : ''}
            </Typography>
            {failure.error?.message ? (
              <Typography color="text.secondary" variant="body2">
                {failure.error.message}
              </Typography>
            ) : null}
            {failureContext(failure) ? (
              <Typography color="text.secondary" variant="caption">
                {failureContext(failure)}
              </Typography>
            ) : null}
          </Box>
        ))}
        {props.failures.length > 10 ? (
          <Typography color="text.secondary" variant="caption">
            Showing first 10 of {props.failures.length.toLocaleString()} failures.
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}

export function ImportExportHistoryPanel(props: ImportExportHistoryPanelProps) {
  return (
    <Stack spacing={1.25}>
      <Alert severity="info">
        This is the secured Nodics run projection. Axis does not retain a browser-side
        audit log.
      </Alert>
      <Paper
        elevation={0}
        sx={{
          bgcolor: 'background.default',
          border: 1,
          borderColor: 'divider',
          p: { xs: 1.25, md: 1.5 },
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          sx={{ alignItems: { md: 'center' }, gap: 1.25 }}
        >
          <ToggleButtonGroup
            aria-label="History type"
            exclusive
            onChange={(_, value: HistoryFilter | null) => {
              if (value) props.onFilterChange(value);
            }}
            size="small"
            value={props.filter}
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="imports">Imports</ToggleButton>
            <ToggleButton value="exports">Exports</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            aria-label="Search import and export history"
            onChange={(event) => props.onSearchChange(event.target.value)}
            placeholder="Search by run, module, status, user, or date"
            size="small"
            sx={{ flex: 1 }}
            value={props.search}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <ShellIcon color="action" fontSize="small" name="search" />
                  </InputAdornment>
                ),
                endAdornment: props.search ? (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Clear history search"
                      edge="end"
                      onClick={() => props.onSearchChange('')}
                      size="small"
                    >
                      <Box component="span" sx={{ fontSize: '1.25rem', lineHeight: 1 }}>
                        ×
                      </Box>
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />
        </Stack>
      </Paper>
      {props.isLoading ? (
        <CircularProgress aria-label="Loading import history" />
      ) : null}
      {props.isError ? <Alert severity="error">{props.errorMessage}</Alert> : null}
      {props.isSuccess && props.runs.length === 0 ? (
        <Alert severity="info">
          No import or export runs are available for this tenant.
        </Alert>
      ) : null}
      {props.isSuccess && props.runs.length > 0 && props.filteredRuns.length === 0 ? (
        <Alert severity="info">
          No {props.filter === 'all' ? 'import or export' : props.filter} history
          matches the current search.
        </Alert>
      ) : null}
      {props.filteredRuns.length > 0 ? (
        <Paper
          variant="outlined"
          sx={{ bgcolor: 'background.paper', overflow: 'hidden' }}
        >
          {props.filteredRuns.map((run, index) => (
            <Box key={run.runId}>
              {index > 0 ? <Divider /> : null}
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                sx={{
                  alignItems: { md: 'center' },
                  gap: { xs: 1, md: 2 },
                  px: { xs: 1.5, md: 2 },
                  py: { xs: 1.35, md: 1.5 },
                }}
              >
                <Stack sx={{ flex: 1, minWidth: 0 }} spacing={0.45}>
                  <Stack
                    direction="row"
                    sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}
                  >
                    <Typography component="h3" variant="h6">
                      {formatRunType(run.dataType)}
                    </Typography>
                    <Chip label={formatStatus(run.status)} size="small" />
                    {run.createdAt ? (
                      <Typography color="text.secondary" variant="caption">
                        {run.createdAt}
                      </Typography>
                    ) : null}
                  </Stack>
                  <Typography color="text.secondary" variant="body2">
                    {summarizeModules(run.modules)}
                  </Typography>
                  {run.summary ? (
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                      <Chip
                        label={`${count(run.summary.recordsRead)} read`}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={`${count(run.summary.recordsSucceeded)} succeeded`}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        color={
                          (run.summary.recordsFailed ?? 0) > 0 ? 'error' : 'default'
                        }
                        label={`${count(run.summary.recordsFailed)} failed`}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                  ) : null}
                  <Typography
                    color="text.secondary"
                    sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}
                    variant="caption"
                  >
                    Run {run.runId}
                  </Typography>
                </Stack>
                <Chip
                  label={run.dataType ? run.dataType.toUpperCase() : 'IMPORT'}
                  size="small"
                  sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
                />
              </Stack>
              <ImportRunFailureList failures={run.failures ?? []} />
            </Box>
          ))}
        </Paper>
      ) : null}
    </Stack>
  );
}
