/** @file Scoped live collection inspection with plain-text results and explicit bounded queries. */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type {
  CopilotCollection,
  CopilotCollectionResult,
} from './api/copilotCollectionsClient';
import type { KnowledgeInventory } from './api/knowledgeStudioClient';
import { ShellIcon } from '../app/shell/ShellIcon';

export interface CopilotCollectionsActions {
  readonly load: (signal?: AbortSignal) => Promise<readonly CopilotCollection[]>;
  readonly query: (
    schemaName: string,
    search: string,
    page: number,
    signal?: AbortSignal,
  ) => Promise<CopilotCollectionResult>;
}

/** Clears results on query changes and aborts work on source, revision, or identity unmount. */
export function CopilotCollectionsPanel({
  actions,
  copy,
}: {
  readonly actions: CopilotCollectionsActions;
  readonly copy: KnowledgeInventory['presentation'];
}) {
  const [collections, setCollections] = useState<readonly CopilotCollection[]>();
  const [schema, setSchema] = useState('');
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<CopilotCollectionResult>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  /** Performs one query, retaining no previous content after a failure. */
  function query(page: number) {
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setFailed(false);
    setResult(undefined);
    void actions
      .query(schema, search, page, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
  }
  return (
    <Stack spacing={2} sx={{ mt: 3, minWidth: 0 }}>
      <Typography component="h3" variant="subtitle1">
        {copy.liveData}
      </Typography>
      {!collections ? (
        <Button
          sx={{ alignSelf: 'flex-start' }}
          disabled={busy}
          variant="outlined"
          onClick={() => {
            const controller = new AbortController();
            pending.current = controller;
            setBusy(true);
            setFailed(false);
            void actions
              .load(controller.signal)
              .then((items) => {
                if (!controller.signal.aborted) {
                  setCollections(items);
                  setSchema(items.find((item) => item.selected)?.schemaName ?? '');
                }
              })
              .catch(() => {
                if (!controller.signal.aborted) setFailed(true);
              })
              .finally(() => {
                if (!controller.signal.aborted) setBusy(false);
              });
          }}
        >
          {copy.loadCollections}
        </Button>
      ) : (
        <>
          <TextField
            select
            fullWidth
            label={copy.collections}
            value={schema}
            disabled={busy}
            onChange={(event) => {
              setSchema(event.target.value);
              setResult(undefined);
              setFailed(false);
            }}
          >
            {collections.map((item) => (
              <MenuItem
                key={item.schemaName}
                value={item.schemaName}
                disabled={!item.selected}
              >
                {item.label}
                {item.selected ? '' : ` (${copy.notSelected})`}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label={copy.collectionSearch}
            value={search}
            disabled={busy}
            slotProps={{ htmlInput: { maxLength: 100 } }}
            onChange={(event) => {
              setSearch(event.target.value);
              setResult(undefined);
              setFailed(false);
            }}
          />
          <Button
            sx={{ alignSelf: 'flex-start' }}
            startIcon={<ShellIcon name="search" />}
            variant="contained"
            disabled={busy || !schema || !search.trim()}
            onClick={() => query(1)}
          >
            {copy.queryRecords}
          </Button>
        </>
      )}
      {failed ? <Alert severity="warning">{copy.liveFailed}</Alert> : null}
      {result ? (
        <Box role="status" sx={{ minWidth: 0 }}>
          <Typography variant="caption">
            {new Date(result.observedAt).toLocaleString()}
          </Typography>
          {!result.records.length ? (
            <Typography>{copy.noRecords}</Typography>
          ) : (
            result.records.map((record, index) => (
              <Box
                key={index}
                component="dl"
                sx={{
                  borderTop: 1,
                  borderColor: 'divider',
                  py: 1,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(80px, 1fr) minmax(0, 2fr)',
                  gap: 1,
                  '& dd': { m: 0 },
                  overflowWrap: 'anywhere',
                }}
              >
                {Object.entries(record).map(([key, value]) => (
                  <Box key={key} sx={{ display: 'contents' }}>
                    <Typography component="dt" variant="body2" color="text.secondary">
                      {key}
                    </Typography>
                    <Typography component="dd" variant="body2">
                      {value === null ? '-' : String(value)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ))
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button
              disabled={busy || result.page <= 1}
              onClick={() => query(result.page - 1)}
            >
              {copy.previousPage}
            </Button>
            <Button
              disabled={busy || !result.mayHaveMore || result.page >= 1000}
              onClick={() => query(result.page + 1)}
            >
              {copy.nextPage}
            </Button>
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
