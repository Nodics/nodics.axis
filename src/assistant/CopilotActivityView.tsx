/** @file Read-only enterprise activity list with explicit paging and exact employee filter. */
import { useState } from 'react';
import {
  Box,
  Button,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import type { ActivityFilters, CopilotActivity } from './api/copilotActivityClient';
import type { AssistantTransportConfiguration } from './api/assistantTransport';
import { CopilotTranscriptDialog } from './CopilotTranscriptDialog';
import { CopilotRecordedSearchDialog } from './CopilotRecordedSearchDialog';
import { CopilotLifecycleDialog } from './CopilotLifecycleDialog';
import { CopilotAuditRetentionPanel } from './CopilotAuditRetentionPanel';

/** Renders backend metadata without links that could imply transcript permission. */
export function CopilotActivityView({
  activity,
  principal,
  onFilter,
  onPage,
  onRefresh,
  filters = {},
  configuration,
}: {
  readonly activity: CopilotActivity;
  readonly principal: string;
  readonly onFilter: (value: string, filters: ActivityFilters) => void;
  readonly filters?: ActivityFilters;
  readonly onPage: (page: number) => void;
  readonly onRefresh: () => void;
  readonly configuration?: AssistantTransportConfiguration;
}) {
  const [selected, setSelected] = useState<CopilotActivity['items'][number]>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [draft, setDraft] = useState(principal);
  const [extra, setExtra] = useState(filters);
  const copy = activity.presentation;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1">
            {copy.title}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {activity.context.tenantCode} / {activity.context.enterpriseCode}
          </Typography>
        </Box>
        <Tooltip title={copy.refresh}>
          <IconButton aria-label={copy.refresh} onClick={onRefresh}>
            <ShellIcon name="refresh" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {copy.metadataOnly}
      </Typography>
      {activity.lifecycle && configuration ? (
        <>
          <Button sx={{ mb: 2 }} onClick={() => setLifecycleOpen(true)}>
            {activity.lifecycle.title}
          </Button>
          {lifecycleOpen ? (
            <CopilotLifecycleDialog
              configuration={configuration}
              copy={activity.lifecycle}
              onClose={() => setLifecycleOpen(false)}
            />
          ) : null}
        </>
      ) : null}
      {activity.contentSearch && activity.inspection && configuration ? (
        <Button
          startIcon={<ShellIcon name="search" />}
          sx={{ mb: 2 }}
          onClick={() => setSearchOpen(true)}
        >
          {activity.contentSearch.presentation.title}
        </Button>
      ) : null}
      <Stack
        component="form"
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}
        onSubmit={(event) => {
          event.preventDefault();
          onFilter(draft.trim(), extra);
        }}
      >
        <TextField
          size="small"
          label={copy.principal}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 128 } }}
        />
        {(['conversationCode', 'state', 'updatedFrom', 'updatedTo'] as const).map(
          (key) => (
            <TextField
              key={key}
              size="small"
              label={key === 'conversationCode' ? copy.conversation : copy[key]}
              type={key.startsWith('updated') ? 'datetime-local' : 'text'}
              value={
                key.startsWith('updated') && extra[key]
                  ? new Date(
                      Date.parse(extra[key]) -
                        new Date(extra[key]).getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : (extra[key] ?? '')
              }
              onChange={(event) => {
                if (
                  key.startsWith('updated') &&
                  event.target.value &&
                  !Number.isFinite(Date.parse(event.target.value))
                )
                  return;
                setExtra({
                  ...extra,
                  [key]:
                    key.startsWith('updated') && event.target.value
                      ? new Date(event.target.value).toISOString()
                      : event.target.value,
                });
              }}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { maxLength: 128 },
              }}
              sx={{ minWidth: 0, flex: { xs: '0 0 auto', sm: '1 1 180px' } }}
            />
          ),
        )}
        <Button
          type="submit"
          variant="outlined"
          startIcon={<ShellIcon name="search" />}
        >
          {copy.search}
        </Button>
      </Stack>
      {activity.items.length === 0 ? (
        <Typography role="status">{copy.empty}</Typography>
      ) : (
        <Stack
          component="ul"
          divider={<Divider />}
          sx={{ listStyle: 'none', p: 0, m: 0 }}
        >
          {activity.items.map((item) => (
            <Box
              component="li"
              key={item.conversationCode}
              sx={{
                py: 2,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr 1fr' },
                gap: 1,
                overflowWrap: 'anywhere',
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {copy.conversation}
                </Typography>
                <Typography variant="body2">{item.conversationCode}</Typography>
                {activity.inspection && configuration ? (
                  <Button size="small" onClick={() => setSelected(item)}>
                    {activity.inspection.presentation.open}
                  </Button>
                ) : null}
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {copy.employee}
                </Typography>
                <Typography variant="body2">{item.principalCode}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {copy.state}
                </Typography>
                <Typography variant="body2">{item.state}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {copy.updated}
                </Typography>
                <Typography
                  variant="body2"
                  component="time"
                  dateTime={item.updatedAt}
                  sx={{ display: 'block' }}
                >
                  {new Date(item.updatedAt).toLocaleString()}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      )}
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          gap: 1,
          mt: 2,
        }}
      >
        <Tooltip title={copy.previous}>
          <span>
            <IconButton
              aria-label={copy.previous}
              disabled={activity.page <= 1}
              onClick={() => onPage(activity.page - 1)}
            >
              <ShellIcon name="chevron-left" />
            </IconButton>
          </span>
        </Tooltip>
        <Typography variant="body2">
          {copy.page} {activity.page}
        </Typography>
        <Tooltip title={copy.next}>
          <span>
            <IconButton
              aria-label={copy.next}
              disabled={!activity.mayHaveMore || activity.page >= 1000}
              onClick={() => onPage(activity.page + 1)}
            >
              <ShellIcon name="chevron-right" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      {selected && activity.inspection && configuration ? (
        <CopilotTranscriptDialog
          configuration={configuration}
          conversationCode={selected.conversationCode}
          principalCode={selected.principalCode}
          inspection={activity.inspection}
          onClose={() => setSelected(undefined)}
        />
      ) : null}
      {activity.auditRetention && configuration ? (
        <CopilotAuditRetentionPanel
          configuration={configuration}
          capability={activity.auditRetention}
        />
      ) : null}
      {searchOpen && activity.contentSearch && activity.inspection && configuration ? (
        <CopilotRecordedSearchDialog
          configuration={configuration}
          capability={activity.contentSearch}
          inspection={activity.inspection}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}
    </Box>
  );
}
