/** @file Responsive, accessible rendering of the backend-owned personal Copilot Workspace snapshot. */
import { useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import type { CopilotWorkspace } from './api/copilotWorkspaceClient';

interface Props {
  readonly snapshot: CopilotWorkspace;
  readonly compact?: boolean | undefined;
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
  readonly onDetails: () => void;
  readonly onConversation?: ((code?: string) => void) | undefined;
  readonly onUsage?: (() => void) | undefined;
  readonly providerCheck?: ReactNode;
}

/** Displays real bounded activity; unavailable accounting has no synthetic meter or price. */
export function CopilotWorkspaceView({
  snapshot,
  compact,
  refreshing,
  onRefresh,
  onDetails,
  onConversation,
  onUsage,
  providerCheck,
}: Props) {
  const [search, setSearch] = useState('');
  const copy = snapshot.presentation;
  const tasks = snapshot.activity.turns;
  const states = [
    { key: 'COMPLETED', label: copy.stateCompleted, color: 'success' },
    { key: 'RUNNING', label: copy.stateRunning, color: 'info' },
    { key: 'FAILED', label: copy.stateFailed, color: 'error' },
    { key: 'CANCELLED', label: copy.stateCancelled, color: 'warning' },
  ] as const;
  const counts = states.map((state) => ({
    ...state,
    count: tasks.filter((task) =>
      state.key === 'RUNNING'
        ? ['ACCEPTED', 'PROCESSING', 'CANCELLATION_REQUESTED'].includes(task.state)
        : task.state === state.key,
    ).length,
  }));
  const unknownCount =
    tasks.length - counts.reduce((sum, state) => sum + state.count, 0);
  const conversations = snapshot.activity.conversations.filter((row) =>
    (row.title ?? copy.untitled)
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const ready = snapshot.knowledge.sources.filter(
    (source) => source.state === 'PROJECTED',
  ).length;
  return (
    <Box component="section" sx={{ minWidth: 0, py: 2 }}>
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          mb: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component={compact ? 'h2' : 'h1'}
            variant={compact ? 'h6' : 'h4'}
            sx={{ overflowWrap: 'anywhere' }}
          >
            {copy.title}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {copy.subtitle}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title={copy.refresh}>
            <span>
              <IconButton
                aria-label={copy.refresh}
                disabled={refreshing}
                onClick={onRefresh}
              >
                <ShellIcon name="refresh" />
              </IconButton>
            </span>
          </Tooltip>
          {compact ? (
            <Button endIcon={<ShellIcon name="chevron-right" />} onClick={onDetails}>
              {copy.details}
            </Button>
          ) : snapshot.canStartConversation && onConversation ? (
            <Button
              variant="contained"
              startIcon={<ShellIcon name="assistant" />}
              onClick={() => onConversation()}
            >
              {copy.newConversation}
            </Button>
          ) : null}
        </Stack>
      </Stack>
      {!compact && snapshot.attention ? (
        <Box component="section" sx={{ mt: 3 }} aria-label={snapshot.attention.title}>
          <Typography component="h2" variant="h6">
            {snapshot.attention.title}
          </Typography>
          {snapshot.attention.items.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              {snapshot.attention.empty}
            </Typography>
          ) : (
            <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
              {snapshot.attention.items.map((item, index) => (
                <Stack
                  component="li"
                  key={`${item.kind}-${index}`}
                  direction="row"
                  sx={{
                    py: 1,
                    gap: 2,
                    alignItems: 'center',
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ flex: 1, overflowWrap: 'anywhere' }}
                    color={
                      item.kind === 'OUTCOME_UNKNOWN' ||
                      item.kind === 'BUDGET_EXHAUSTED'
                        ? 'warning.main'
                        : 'text.primary'
                    }
                  >
                    {item.label}
                  </Typography>
                  {item.conversationCode && onConversation ? (
                    <Tooltip title={copy.resume}>
                      <IconButton
                        aria-label={`${copy.resume}: ${item.label}`}
                        onClick={() => onConversation(item.conversationCode)}
                      >
                        <ShellIcon name="chevron-right" />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                  {item.kind.startsWith('BUDGET_') && onUsage ? (
                    <Tooltip title={item.label}>
                      <IconButton aria-label={item.label} onClick={onUsage}>
                        <ShellIcon name="chevron-right" />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </Stack>
              ))}
            </Box>
          )}
          {snapshot.attention.hasMore ? (
            <Typography variant="caption">{copy.limitedWindow}</Typography>
          ) : null}
        </Box>
      ) : null}
      {!compact ? (
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 3 }}>
          <Chip
            variant="outlined"
            size="small"
            label={`${copy.tenant}: ${snapshot.context.tenantCode}`}
            sx={{
              maxWidth: '100%',
              height: 'auto',
              minHeight: 24,
              '& .MuiChip-label': { overflowWrap: 'anywhere', whiteSpace: 'normal' },
            }}
          />
          <Chip
            variant="outlined"
            size="small"
            label={`${copy.enterprise}: ${snapshot.context.enterpriseCode ?? copy.noEnterprise}`}
            sx={{
              maxWidth: '100%',
              '& .MuiChip-label': { overflowWrap: 'anywhere', whiteSpace: 'normal' },
              height: 'auto',
              minHeight: 24,
            }}
          />
          <Chip size="small" label={copy.personal} />
        </Stack>
      ) : null}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 2,
        }}
      >
        {[
          [
            copy.conversations,
            String(snapshot.activity.conversations.length),
            copy.limitedWindow,
            'info.main',
          ],
          [
            copy.knowledge,
            snapshot.knowledge.state === 'AVAILABLE'
              ? `${ready} / ${snapshot.knowledge.sources.length}`
              : copy.unavailable,
            snapshot.knowledge.state === 'AVAILABLE'
              ? snapshot.knowledge.hasMore
                ? copy.limitedWindow
                : copy.sourceReady
              : snapshot.knowledge.state === 'NOT_AUTHORIZED'
                ? copy.sourceRestricted
                : snapshot.knowledge.state === 'DISABLED'
                  ? copy.sourceDisabled
                  : copy.sourceUnavailable,
            'success.main',
          ],
          [
            copy.provider,
            snapshot.provider.state === 'CONFIGURED'
              ? (snapshot.provider.model ?? copy.configured)
              : copy.notConfigured,
            copy.healthNotChecked,
            'warning.main',
          ],
          [
            copy.budget,
            snapshot.budget.detail
              ? snapshot.budget.detail.available.toLocaleString()
              : (snapshot.budget.unassigned ?? copy.unavailable),
            snapshot.budget.detail?.labels.budgetAvailable ?? copy.personal,
            snapshot.budget.state === 'EXHAUSTED' ? 'error.main' : 'text.secondary',
          ],
        ].map(([label, value, note, color]) => (
          <Paper
            key={label}
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 1,
              minWidth: 0,
              borderTop: 3,
              borderTopColor: color,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h6" sx={{ my: 1, overflowWrap: 'anywhere' }}>
              {value}
            </Typography>
            {!compact && label === copy.provider && providerCheck ? (
              providerCheck
            ) : (
              <Typography variant="caption" color="text.secondary">
                {note}
              </Typography>
            )}
          </Paper>
        ))}
      </Box>
      {snapshot.budget.detail ? (
        <Box component="section" aria-label={copy.budget} sx={{ mt: 3, minWidth: 0 }}>
          <Stack
            direction="row"
            sx={{ justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}
          >
            <Typography component="h2" variant="h6">
              {copy.budget}
            </Typography>
            {snapshot.budget.state === 'EXHAUSTED' ||
            snapshot.budget.detail.warningPercentage > 0 ? (
              <Typography
                role="status"
                color={
                  snapshot.budget.state === 'EXHAUSTED' ? 'error.main' : 'warning.main'
                }
              >
                {snapshot.budget.state === 'EXHAUSTED'
                  ? snapshot.budget.detail.labels.budgetExhausted
                  : snapshot.budget.detail.labels.budgetWarning}
              </Typography>
            ) : null}
          </Stack>
          <LinearProgress
            variant="determinate"
            aria-label={copy.budget}
            value={
              snapshot.budget.detail.allowance === 0
                ? 100
                : Math.min(
                    100,
                    (100 *
                      (snapshot.budget.detail.consumed +
                        snapshot.budget.detail.reserved)) /
                      snapshot.budget.detail.allowance,
                  )
            }
            sx={{ my: 2, height: 8 }}
          />
          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(5, minmax(0, 1fr))',
              },
              gap: 2,
            }}
          >
            {(
              [
                ['budgetAssigned', snapshot.budget.detail.allowance],
                ['budgetConsumed', snapshot.budget.detail.consumed],
                ['budgetReserved', snapshot.budget.detail.reserved],
                ['budgetAvailable', snapshot.budget.detail.available],
                ['budgetPending', snapshot.budget.detail.pending],
              ] as const
            ).map(([label, value]) => (
              <Box key={label} sx={{ minWidth: 0 }}>
                <Typography component="dt" variant="caption" color="text.secondary">
                  {snapshot.budget.detail!.labels[label]}
                </Typography>
                <Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                  {value.toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 2, overflowWrap: 'anywhere' }}
          >
            {snapshot.budget.detail.labels.budgetReset}:{' '}
            {new Date(snapshot.budget.detail.resetsAt).toLocaleString(undefined, {
              timeZone: snapshot.budget.detail.timezone,
            })}{' '}
            ({snapshot.budget.detail.timezone})
          </Typography>
        </Box>
      ) : null}
      {!compact ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 3fr) minmax(0, 2fr)' },
            gap: 4,
            mt: 4,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" variant="h6">
              {copy.conversations}
            </Typography>
            <TextField
              fullWidth
              size="small"
              label={copy.search}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ my: 2 }}
            />
            {conversations.length === 0 ? (
              <Typography color="text.secondary">{copy.emptyConversations}</Typography>
            ) : (
              <Stack
                component="ul"
                sx={{ p: 0, m: 0, listStyle: 'none' }}
                divider={<Divider />}
              >
                {conversations.map((row) => (
                  <Box
                    component="li"
                    key={row.conversationCode}
                    sx={{ py: 1.5, minWidth: 0 }}
                  >
                    <Button
                      fullWidth
                      disabled={!onConversation}
                      onClick={() => onConversation?.(row.conversationCode)}
                      aria-label={`${copy.resume}: ${row.title ?? copy.untitled}`}
                      endIcon={<ShellIcon name="chevron-right" />}
                      sx={{
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        textTransform: 'none',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {row.title ?? copy.untitled}
                    </Button>
                    <Typography
                      component="time"
                      dateTime={row.updatedAt}
                      variant="caption"
                      color="text.secondary"
                    >
                      {new Date(row.updatedAt).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 2 }}
            >
              {copy.limitedWindow}
            </Typography>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
              {copy.tasks}
            </Typography>
            {tasks.length === 0 ? (
              <Typography color="text.secondary">{copy.emptyTasks}</Typography>
            ) : (
              <Stack spacing={2}>
                {counts.map((state) => (
                  <Box key={state.key}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: 'space-between', mb: 0.5 }}
                    >
                      <Typography variant="body2">{state.label}</Typography>
                      <Typography variant="body2">{state.count}</Typography>
                    </Stack>
                    <LinearProgress
                      aria-label={state.label}
                      variant="determinate"
                      value={(state.count / tasks.length) * 100}
                      color={state.color}
                      sx={{
                        height: 6,
                        borderRadius: 0,
                        bgcolor: 'action.hover',
                        '& .MuiLinearProgress-bar': { transition: 'none' },
                      }}
                    />
                  </Box>
                ))}
                {unknownCount > 0 ? (
                  <Typography variant="body2">
                    {copy.stateUnknown}: {unknownCount}
                  </Typography>
                ) : null}
              </Stack>
            )}
            <Divider sx={{ my: 3 }} />
            <Typography component="h2" variant="subtitle1">
              {copy.recording}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {snapshot.recordingNotice}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {copy.retentionUnknown}
            </Typography>
            <Divider sx={{ my: 3 }} />
            <Typography component="h2" variant="subtitle1">
              {copy.knowledge}
            </Typography>
            {snapshot.knowledge.state === 'AVAILABLE' &&
            snapshot.knowledge.sources.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {copy.noSources}
              </Typography>
            ) : null}
            {snapshot.knowledge.sources.map((source) => (
              <Stack
                key={source.code}
                direction="row"
                sx={{ justifyContent: 'space-between', gap: 2, py: 1 }}
              >
                <Typography
                  variant="body2"
                  sx={{ overflowWrap: 'anywhere', minWidth: 0 }}
                >
                  {source.code}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {source.state === 'PROJECTED'
                    ? copy.sourceReady
                    : source.state === 'FAILED'
                      ? copy.sourceFailed
                      : ['UNKNOWN', 'STALE'].includes(source.state)
                        ? copy.stateUnknown
                        : copy.sourcePending}
                </Typography>
              </Stack>
            ))}
            {snapshot.knowledge.hasMore ? (
              <Typography variant="caption" color="text.secondary">
                {copy.limitedWindow}
              </Typography>
            ) : null}
          </Box>
        </Box>
      ) : null}
      {!compact && snapshot.operations ? (
        <Box sx={{ mt: 4, minWidth: 0 }}>
          <Typography component="h2" variant="h6">
            {snapshot.operations.title}
          </Typography>
          {snapshot.operations.state === 'UNAVAILABLE' ? (
            <Typography>{copy.unavailable}</Typography>
          ) : snapshot.operations.items.length === 0 ? (
            <Typography>{snapshot.operations.empty}</Typography>
          ) : (
            <Stack
              component="ul"
              divider={<Divider />}
              sx={{ listStyle: 'none', p: 0, m: 0 }}
            >
              {snapshot.operations.items.map((operation) => (
                <Stack
                  component="li"
                  key={operation.code}
                  direction={{ xs: 'column', sm: 'row' }}
                  sx={{ gap: 1, py: 1.5, justifyContent: 'space-between' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ overflowWrap: 'anywhere' }}>
                      {operation.code}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {operation.owner} / {operation.riskClass.replaceAll('_', ' ')}
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}
                  >
                    <Chip
                      size="small"
                      variant="outlined"
                      label={snapshot.operations!.labels[operation.maturity]}
                    />
                    {operation.mutates ? (
                      <Typography variant="caption">
                        {snapshot.operations!.approval}
                      </Typography>
                    ) : null}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
          {snapshot.operations.hasMore ? (
            <Typography variant="caption">{copy.limitedWindow}</Typography>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
