/** @file Accessible source inventory and non-mutating preview renderer owned by copilotApi metadata. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import { KnowledgeHistoryPanel } from './KnowledgeHistoryPanel';
import {
  KnowledgeManualRefreshPanel,
  type KnowledgeManualRefreshActions,
} from './KnowledgeManualRefreshPanel';
import { KnowledgeMaintenancePanel } from './KnowledgeMaintenancePanel';
import type { KnowledgeMaintenanceHistory } from './api/knowledgeMaintenanceClient';
import {
  KnowledgeWriterRecoveryPanel,
  type KnowledgeWriterRecoveryActions,
} from './KnowledgeWriterRecoveryPanel';
import {
  KnowledgeCleanupPanel,
  type KnowledgeCleanupActions,
} from './KnowledgeCleanupPanel';
import type { KnowledgeHistory } from './api/knowledgeHistoryClient';
import {
  CopilotCollectionsPanel,
  type CopilotCollectionsActions,
} from './CopilotCollectionsPanel';
import type {
  KnowledgeInventory,
  KnowledgePreview,
  KnowledgeSource,
} from './api/knowledgeStudioClient';

interface Props {
  readonly sourceSchedule?: (source: KnowledgeSource) => ReactNode;
  readonly manualRefresh?: (source: KnowledgeSource) => KnowledgeManualRefreshActions;
  readonly onMaintenance?:
    | ((
        source: KnowledgeSource,
        page: number,
        signal?: AbortSignal,
      ) => Promise<KnowledgeMaintenanceHistory>)
    | undefined;
  readonly recovery?:
    | ((source: KnowledgeSource) => KnowledgeWriterRecoveryActions)
    | undefined;
  readonly cleanup?: ((source: KnowledgeSource) => KnowledgeCleanupActions) | undefined;
  readonly onHistory?:
    | ((
        source: KnowledgeSource,
        page: number,
        signal?: AbortSignal,
      ) => Promise<KnowledgeHistory>)
    | undefined;
  readonly inventory: KnowledgeInventory;
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
  readonly onPage?: ((page: number) => void) | undefined;
  readonly collections?:
    | ((source: KnowledgeSource) => CopilotCollectionsActions)
    | undefined;
  readonly onIndex?:
    | ((source: KnowledgeSource, signal?: AbortSignal) => Promise<void>)
    | undefined;
  readonly onPreview: (
    source: KnowledgeSource,
    signal?: AbortSignal,
  ) => Promise<KnowledgePreview>;
}

/** Shows a searchable authorized window; hidden sources are never represented by counts or placeholders. */
export function KnowledgeStudioView({
  inventory,
  refreshing,
  onRefresh,
  onPage,
  onPreview,
  onIndex,
  collections,
  onHistory,
  manualRefresh,
  sourceSchedule,
  cleanup,
  recovery,
  onMaintenance,
}: Props) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string>();
  const [groupCode, setGroupCode] = useState('');
  const copy = inventory.presentation;
  const sources = inventory.sources.filter(
    (source) =>
      (!groupCode ||
        inventory.groups?.items.some(
          (group) =>
            group.code === groupCode && group.sourceCodes.includes(source.code),
        )) &&
      `${source.code} ${source.project} ${source.module}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const current = sources.find((source) => source.code === selected) ?? sources[0];
  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2, mb: 3 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" variant="h4">
            {copy.title}
          </Typography>
          <Typography color="text.secondary">{copy.subtitle}</Typography>
          <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
            {inventory.context.tenantCode} / {inventory.context.enterpriseCode}
          </Typography>
        </Box>
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
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md: 'minmax(240px, 1fr) minmax(0, 2fr)',
          },
          gap: 4,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {inventory.groups ? (
            <TextField
              select
              fullWidth
              size="small"
              sx={{ mb: 2 }}
              label={inventory.groups.title}
              value={groupCode}
              onChange={(event) => setGroupCode(event.target.value)}
            >
              <MenuItem value="">{inventory.groups.all}</MenuItem>
              {inventory.groups.items.map((group) => (
                <MenuItem key={group.code} value={group.code} disabled={!group.active}>
                  {group.name} (
                  {group.active ? inventory.groups!.active : inventory.groups!.inactive}
                  )
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          <TextField
            fullWidth
            size="small"
            label={copy.search}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <List aria-label={copy.source} sx={{ mt: 1 }}>
            {sources.map((source) => (
              <ListItemButton
                key={source.code}
                selected={source.code === current?.code}
                onClick={() => setSelected(source.code)}
                sx={{ overflowWrap: 'anywhere' }}
              >
                <ListItemText
                  primary={source.code}
                  secondary={`${source.classification} / ${source.enabled ? copy.enabled : copy.disabled}`}
                />
              </ListItemButton>
            ))}
          </List>
          {sources.length === 0 ? (
            <Typography color="text.secondary">{copy.empty}</Typography>
          ) : null}
          {inventory.hasMore ? (
            <Typography variant="caption">{copy.limited}</Typography>
          ) : null}
          {onPage && (inventory.hasMore || inventory.page > 1) ? (
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
              <Tooltip title={copy.previousPage}>
                <span>
                  <IconButton
                    aria-label={copy.previousPage}
                    disabled={refreshing || inventory.page <= 1}
                    onClick={() => onPage(inventory.page - 1)}
                  >
                    <ShellIcon name="chevron-left" />
                  </IconButton>
                </span>
              </Tooltip>
              <Typography variant="body2">{inventory.page}</Typography>
              <Tooltip title={copy.nextPage}>
                <span>
                  <IconButton
                    aria-label={copy.nextPage}
                    disabled={refreshing || !inventory.hasMore}
                    onClick={() => onPage(inventory.page + 1)}
                  >
                    <ShellIcon name="chevron-right" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          ) : null}
        </Box>
        {current ? (
          <SourceDetails
            key={`${current.code}:${current.version}:${current.sourcePolicyDigest}`}
            source={current}
            copy={copy}
            onPreview={onPreview}
            onIndex={current.recordedRefreshRequired ? undefined : onIndex}
            collections={collections}
            recovery={
              current.canRetireWriter && inventory.recoveryPresentation && recovery ? (
                <KnowledgeWriterRecoveryPanel
                  copy={inventory.recoveryPresentation}
                  actions={recovery(current)}
                />
              ) : null
            }
            cleanup={
              current.canCleanup && inventory.cleanupPresentation && cleanup ? (
                <KnowledgeCleanupPanel
                  copy={inventory.cleanupPresentation}
                  actions={cleanup(current)}
                />
              ) : null
            }
            history={
              <>
                {inventory.sourceSchedules &&
                current.canPreview &&
                current.sourcePolicyDigest &&
                sourceSchedule
                  ? sourceSchedule(current)
                  : null}
                {current.canStartRecordedRefresh &&
                inventory.manualRefreshPresentation &&
                inventory.historyPresentation &&
                manualRefresh ? (
                  <KnowledgeManualRefreshPanel
                    copy={inventory.manualRefreshPresentation}
                    historyCopy={inventory.historyPresentation}
                    actions={manualRefresh(current)}
                  />
                ) : null}
                {current.canInspectMaintenance &&
                inventory.maintenancePresentation &&
                onMaintenance ? (
                  <KnowledgeMaintenancePanel
                    copy={inventory.maintenancePresentation}
                    load={(page, signal) => onMaintenance(current, page, signal)}
                  />
                ) : null}
                {current.canInspectHistory &&
                inventory.historyPresentation &&
                onHistory ? (
                  <KnowledgeHistoryPanel
                    copy={inventory.historyPresentation}
                    load={(page, signal) => onHistory(current, page, signal)}
                  />
                ) : null}
              </>
            }
          />
        ) : null}
      </Box>
    </Box>
  );
}

/** Keeps preview state within one selected revision and drops late results after selection changes. */
function SourceDetails({
  source,
  copy,
  onPreview,
  onIndex,
  collections,
  history,
  cleanup,
  recovery,
}: {
  readonly source: KnowledgeSource;
  readonly copy: KnowledgeInventory['presentation'];
  readonly onPreview: Props['onPreview'];
  readonly onIndex: Props['onIndex'];
  readonly collections: Props['collections'];
  readonly history: import('react').ReactNode;
  readonly cleanup: import('react').ReactNode;
  readonly recovery: import('react').ReactNode;
}) {
  const [preview, setPreview] = useState<KnowledgePreview>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmIndex, setConfirmIndex] = useState(false);
  const [indexResult, setIndexResult] = useState<'DONE' | 'UNKNOWN'>();
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const state =
    source.status.state === 'PROJECTED'
      ? copy.ready
      : source.status.state === 'STALE'
        ? copy.stale
        : source.status.state === 'FAILED'
          ? copy.failed
          : copy.unknown;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="h2" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
        {source.code}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {['DATABASE', 'EXTERNAL_LOG'].includes(source.sourceType)
          ? copy.liveData
          : state}
      </Typography>
      {source.status.evidence === 'DURABLE_GENERATION' &&
      source.status.state === 'PROJECTED' ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {copy.durableEvidence}
        </Typography>
      ) : null}
      {source.status.inspectionRequired ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {copy.inspectionRequired}
        </Alert>
      ) : null}
      {source.status.cleanupPending ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {copy.cleanupPending}
        </Alert>
      ) : null}
      {source.status.progress ? (
        <Box sx={{ mb: 2 }} role="status">
          <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="body2">{copy.progress}</Typography>
            <Typography variant="body2">
              {source.status.progress.acknowledgedChunks} /{' '}
              {source.status.progress.expectedChunks}
            </Typography>
          </Stack>
          <LinearProgress
            aria-label={copy.progress}
            variant="determinate"
            value={
              source.status.progress.expectedChunks === 0
                ? 0
                : (100 * source.status.progress.acknowledgedChunks) /
                  source.status.progress.expectedChunks
            }
            sx={{ my: 1 }}
          />
          <Typography variant="caption">
            {source.status.progress.phase === 'SEALED'
              ? copy.progressSealed
              : source.status.progress.phase === 'WRITING'
                ? copy.progressWriting
                : copy.progressIdle}
          </Typography>
        </Box>
      ) : null}
      {cleanup}
      {recovery}
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(90px, 1fr) minmax(0, 3fr)',
          gap: 1,
          m: 0,
          '& dd': { m: 0, overflowWrap: 'anywhere' },
          '& dt': { color: 'text.secondary' },
        }}
      >
        {(
          [
            'repository',
            'project',
            'module',
            'owner',
            'classification',
            'version',
          ] as const
        ).map((key) => (
          <Box key={key} sx={{ display: 'contents' }}>
            <Typography component="dt" variant="body2">
              {copy[key]}
            </Typography>
            <Typography component="dd" variant="body2">
              {source[key]}
            </Typography>
          </Box>
        ))}
      </Box>
      {source.runtimeBinding ? (
        <Box sx={{ mt: 2, overflowWrap: 'anywhere' }}>
          <Typography variant="subtitle2">{copy.hierarchy}</Typography>
          <Typography variant="body2">
            {source.runtimeBinding.loadIndex}: {source.runtimeBinding.moduleName} /{' '}
            {source.runtimeBinding.relativeRoot}
          </Typography>
        </Box>
      ) : null}
      {source.canQuery && collections ? (
        <CopilotCollectionsPanel copy={copy} actions={collections(source)} />
      ) : null}
      <Divider sx={{ my: 3 }} />
      {(
        [
          ['included', source.paths],
          ['excluded', source.excludedPaths],
          ['extensions', source.allowedExtensions],
        ] as const
      )
        .filter(
          ([key]) =>
            key !== 'extensions' ||
            !['DATABASE', 'EXTERNAL_LOG'].includes(source.sourceType),
        )
        .map(([key, values]) => (
          <Box key={key} sx={{ mb: 2 }}>
            <Typography component="h3" variant="subtitle2">
              {source.sourceType === 'DATABASE' && key === 'included'
                ? copy.includedCollections
                : source.sourceType === 'DATABASE' && key === 'excluded'
                  ? copy.excludedCollections
                  : copy[key]}
            </Typography>
            {values.length ? (
              <Box component="ul" sx={{ pl: 2, my: 1 }}>
                {values.map((value) => (
                  <Typography
                    component="li"
                    key={value}
                    variant="body2"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {value}
                  </Typography>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {copy.none}
              </Typography>
            )}
          </Box>
        ))}
      <Typography variant="caption">{copy.secretScan}</Typography>
      {history}
      {source.canPreview ? (
        <Box sx={{ mt: 3 }}>
          <Button
            variant="outlined"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setFailed(false);
              setPreview(undefined);
              const controller = new AbortController();
              pending.current = controller;
              void onPreview(source, controller.signal)
                .then(setPreview)
                .catch(() => setFailed(true))
                .finally(() => setBusy(false));
            }}
          >
            {copy.preview}
          </Button>
        </Box>
      ) : null}
      {failed ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {copy.previewFailed}
        </Alert>
      ) : null}
      {preview ? (
        <Box role="status" sx={{ mt: 2 }}>
          <Typography variant="subtitle2">{copy.prepared}</Typography>
          <Typography variant="body2" color="text.secondary">
            {copy.previewOnly}
          </Typography>
          <Stack spacing={1} sx={{ mt: 2 }}>
            {(
              ['filesRead', 'filesAccepted', 'filesRejected', 'chunksPrepared'] as const
            ).map((key) => (
              <Stack
                direction="row"
                key={key}
                sx={{ justifyContent: 'space-between', gap: 2 }}
              >
                <Typography variant="body2">{copy[key]}</Typography>
                <Typography variant="body2">{preview[key]}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      ) : null}
      {preview && onIndex && source.sourcePolicyDigest ? (
        <Box sx={{ mt: 2 }}>
          <Button
            disabled={busy || !!indexResult || source.status.inspectionRequired}
            variant={confirmIndex ? 'contained' : 'outlined'}
            onClick={() => {
              if (!confirmIndex) {
                setConfirmIndex(true);
                return;
              }
              if (!navigator.onLine) {
                setFailed(true);
                return;
              }
              const controller = new AbortController();
              pending.current = controller;
              setBusy(true);
              void onIndex(source, controller.signal)
                .then(() => {
                  if (!controller.signal.aborted) setIndexResult('DONE');
                })
                .catch(() => {
                  if (!controller.signal.aborted) setIndexResult('UNKNOWN');
                })
                .finally(() => {
                  if (!controller.signal.aborted) setBusy(false);
                });
            }}
          >
            {confirmIndex ? copy.indexConfirm : copy.indexSource}
          </Button>
          {indexResult ? (
            <Alert
              severity={indexResult === 'DONE' ? 'success' : 'warning'}
              sx={{ mt: 2 }}
            >
              {indexResult === 'DONE' ? copy.indexDone : copy.indexUnknown}
            </Alert>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
