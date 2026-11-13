import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { AxisModuleConnection } from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { AxisDataListing } from '../../app/table/AxisDataListing';
import {
  loadPublicationRequestPage,
  type PublicationSummary,
} from './api/publicationRequestBrowserClient';
interface Props {
  readonly source: AxisModuleConnection;
  readonly accessToken: string;
  readonly actorScope: string;
  readonly tenantCode: string;
  readonly runtime: AxisRuntimeConfig;
  readonly active: boolean;
  readonly onInspect: (code: string) => void;
}
/** Keeps collection browsing and exact-request inspection in the same source and employee scope. */
export function PublicationRequestBrowser({
  source,
  accessToken,
  actorScope,
  tenantCode,
  runtime,
  active,
  onInspect,
}: Props) {
  const { format: workflowText } = useAxisLocalization();
  const [input, setInput] = useState('');
  const [selection, setSelection] = useState({ search: '', pageNumber: 1 });
  const page = useQuery({
    enabled: active,
    queryKey: [
      'publication-request-page',
      actorScope,
      tenantCode,
      runtime.enterpriseCode,
      runtime.projectCode,
      source.instanceId,
      source.endpoint,
      source.environment,
      source.server,
      selection.search,
      selection.pageNumber,
    ],
    queryFn: () =>
      loadPublicationRequestPage(
        source,
        {
          accessToken,
          enterpriseCode: runtime.enterpriseCode,
          timeoutMs: runtime.requestTimeoutMs,
        },
        selection,
      ),
    retry: false,
    refetchOnWindowFocus: false,
  });
  if (!active) return null;
  const data = page.isError ? undefined : page.data;
  const inspect = (record: PublicationSummary) => (
    <Button
      size="small"
      variant="outlined"
      disabled={page.isFetching}
      onClick={() => onInspect(record.code)}
    >
      {workflowText('publishing.ui.inspect-request', 'Inspect request')}
    </Button>
  );
  return (
    <Stack
      component="section"
      aria-label={workflowText(
        'publishing.ui.publication-requests-in-selected-source',
        'Publication requests in selected source',
      )}
      spacing={2}
    >
      <Stack
        direction="row"
        useFlexGap
        spacing={1}
        sx={{ alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}
      >
        <Typography component="h3" variant="h6">
          {workflowText(
            'publishing.ui.requests-in-this-source',
            'Requests in this source',
          )}
        </Typography>
        <Button disabled={page.isFetching} onClick={() => void page.refetch()}>
          {workflowText('publishing.ui.refresh-request-list', 'Refresh request list')}
        </Button>
      </Stack>
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          setSelection({ search: input.trim(), pageNumber: 1 });
        }}
        sx={{ display: 'flex', gap: 1, alignItems: 'start', flexWrap: 'wrap' }}
      >
        <TextField
          label={workflowText('publishing.ui.find-a-request', 'Find a request')}
          placeholder={workflowText(
            'publishing.ui.publication-reference',
            'Publication reference',
          )}
          size="small"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 200 } }}
        />
        <Button type="submit" variant="outlined" disabled={page.isFetching}>
          {workflowText('publishing.ui.search-requests', 'Search requests')}
        </Button>
      </Box>
      {page.isFetching ? (
        <Alert severity="info">
          {workflowText(
            'publishing.ui.loading-this-source-s-publication-requests',
            'Loading this source’s publication requests…',
          )}
        </Alert>
      ) : null}
      {page.isError ? (
        <Alert severity="warning">
          {page.error instanceof Error
            ? page.error.message
            : workflowText(
                'publishing.ui.publication-requests-are-unavailable',
                'Publication requests are unavailable.',
              )}
        </Alert>
      ) : null}
      {data ? (
        <>
          <Typography variant="body2" color="text.secondary">
            {data.totalCount}{' '}
            {data.totalCount === 1
              ? workflowText('publishing.ui.request', 'request')
              : workflowText('publishing.ui.requests', 'requests')}{' '}
            {workflowText('publishing.ui.page', '· page')} {data.pageNumber}
          </Typography>
          {!data.records.length ? (
            <Alert severity="info">
              {workflowText(
                'publishing.ui.no-requests-match-in-this-source',
                'No requests match in this source.',
              )}
            </Alert>
          ) : (
            <>
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <AxisDataListing<PublicationSummary>
                  ariaLabel="Publication request list"
                  records={data.records}
                  getRowKey={(record) => record.code}
                  emptyMessage="No requests match in this source."
                  exportEnabled={false}
                  maxBodyHeight={520}
                  columns={[
                    {
                      key: 'reference',
                      label: 'Request',
                      minWidth: 300,
                      render: (record) => (
                        <Stack spacing={0.75}>
                          <Typography
                            sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
                          >
                            {record.rootCode}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ overflowWrap: 'anywhere' }}
                          >
                            {record.code}
                          </Typography>
                          {inspect(record)}
                        </Stack>
                      ),
                    },
                    {
                      key: 'state',
                      label: 'Status',
                      render: (record) => (
                        <Chip size="small" label={record.state.replaceAll('_', ' ')} />
                      ),
                    },
                    { key: 'domain', label: 'Area', render: (record) => record.domain },
                    {
                      key: 'version',
                      label: 'Source version',
                      render: (record) => record.sourceVersion,
                    },
                    {
                      key: 'revision',
                      label: 'Revision',
                      render: (record) => record.revision,
                    },
                  ]}
                />
              </Box>
              <Stack spacing={1} sx={{ display: { xs: 'flex', md: 'none' } }}>
                {data.records.map((record) => (
                  <Paper
                    key={record.code}
                    variant="outlined"
                    sx={{ p: 2, minWidth: 0 }}
                  >
                    <Stack spacing={1}>
                      <Typography
                        component="h4"
                        variant="subtitle1"
                        sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
                      >
                        {record.rootCode}
                      </Typography>
                      <Stack
                        direction="row"
                        useFlexGap
                        spacing={1}
                        sx={{ flexWrap: 'wrap' }}
                      >
                        <Chip size="small" label={record.state.replaceAll('_', ' ')} />
                        <Chip size="small" variant="outlined" label={record.domain} />
                      </Stack>
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                        {workflowText(
                          'publishing.ui.source-version-650334',
                          'Source version',
                        )}{' '}
                        {record.sourceVersion}{' '}
                        {workflowText('publishing.ui.revision', '· revision')}{' '}
                        {record.revision}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {record.code}
                      </Typography>
                      {inspect(record)}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </>
          )}
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Button
              disabled={page.isFetching || selection.pageNumber <= 1}
              onClick={() =>
                setSelection((current) => ({
                  ...current,
                  pageNumber: current.pageNumber - 1,
                }))
              }
            >
              {workflowText(
                'publishing.ui.previous-request-page',
                'Previous request page',
              )}
            </Button>
            <Button
              disabled={
                page.isFetching || data.pageNumber * data.pageSize >= data.totalCount
              }
              onClick={() =>
                setSelection((current) => ({
                  ...current,
                  pageNumber: current.pageNumber + 1,
                }))
              }
            >
              {workflowText('publishing.ui.next-request-page', 'Next request page')}
            </Button>
          </Stack>
        </>
      ) : null}
    </Stack>
  );
}
