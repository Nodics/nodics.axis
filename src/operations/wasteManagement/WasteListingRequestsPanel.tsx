import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { selectModuleConnection } from '../../bootstrap/publicBootstrap';
import type { OperationalOwnerConfiguration } from '../shared/operationalOwnerClient';
import { WasteSubmissionDialog } from './WasteSubmissionDialog';
import { WasteListingReconciliation } from './WasteListingReconciliation';
import {
  loadWasteListing,
  loadWasteListings,
  parseWasteListing,
  type WasteListingPage,
  type WasteListingRequest,
  type WasteListingPresentation,
} from './api/wasteListingClient';
import {
  authorListingProduct,
  listingAuthoringSelectors,
  listingAuthoringReadback,
  listingProductConfiguration,
  listingPublicationRoute,
  type ListingAuthoredProduct,
} from './api/wasteListingAuthoringClient';
export type {
  WasteListingLabels,
  WasteListingPresentation,
} from './api/wasteListingClient';
interface Props {
  readonly configuration: OperationalOwnerConfiguration;
  readonly presentation: WasteListingPresentation;
  readonly employeeId: string;
  readonly sessionGeneration?: number;
}
interface Read<T> {
  readonly authority: object;
  readonly refresh: number;
  readonly selector: string;
  readonly value?: T;
  readonly failed?: boolean;
}

/** Owner-labelled inspection with one explicitly reviewed, pinned Product authoring command. */
export function WasteListingRequestsPanel({
  configuration,
  presentation,
  employeeId,
  sessionGeneration = 0,
}: Props) {
  const connection = selectModuleConnection(
    configuration.bootstrap,
    'eWaste',
    configuration.ownerSelector,
  );
  const productConfiguration = listingProductConfiguration(configuration);
  const productConnection =
    productConfiguration &&
    selectModuleConnection(
      configuration.bootstrap,
      'product',
      productConfiguration.ownerSelector,
    );
  const ownerIdentity = JSON.stringify([
    connection?.instanceId,
    connection?.endpoint,
    connection?.state,
    connection?.runtimeRole,
    configuration.ownerSelector,
    [
      productConnection?.instanceId,
      productConnection?.endpoint,
      productConnection?.environment,
      productConnection?.state,
      productConnection?.runtimeRole,
    ],
  ]);
  const authority = useMemo(
    () => ({
      accessToken: configuration.accessToken,
      enterpriseCode: configuration.enterpriseCode,
      tenantCode: configuration.bootstrap.tenantCode,
      employeeId,
      sessionGeneration,
      ownerIdentity,
    }),
    [
      configuration.accessToken,
      configuration.enterpriseCode,
      configuration.bootstrap.tenantCode,
      employeeId,
      sessionGeneration,
      ownerIdentity,
    ],
  );
  const [paging, setPaging] = useState<{ authority: object; page: number }>();
  const [selection, setSelection] = useState<{ authority: object; code: string }>();
  const [refresh, setRefresh] = useState(0);
  const [queueRead, setQueueRead] = useState<Read<WasteListingPage>>();
  const [detailRead, setDetailRead] = useState<Read<WasteListingRequest>>();
  const [review, setReview] = useState<{
    authority: object;
    row: WasteListingRequest;
    signature: string;
  }>();
  const [authorAttempt, setAuthorAttempt] = useState<{
    authority: object;
    row: WasteListingRequest;
    phase: 'WORKING' | 'UNCERTAIN' | 'SAVED';
    acknowledged?: ListingAuthoredProduct;
  }>();
  const authorFlight = useRef<object | undefined>(undefined);
  const live = useRef<
    { authority: object; code: string; signature: string } | undefined
  >(undefined);
  const page = paging?.authority === authority ? paging.page : 1;
  const code = selection?.authority === authority ? selection.code : '';
  const queueGeneration = useRef(0),
    detailGeneration = useRef(0);
  const queue =
    queueRead?.authority === authority &&
    queueRead.refresh === refresh &&
    queueRead.selector === String(page)
      ? queueRead
      : undefined;
  const detail =
    detailRead?.authority === authority &&
    detailRead.refresh === refresh &&
    detailRead.selector === code
      ? detailRead
      : undefined;
  useEffect(() => {
    const sequence = queueGeneration;
    const generation = ++sequence.current;
    void loadWasteListings(configuration, page)
      .then((value) => {
        if (sequence.current === generation)
          setQueueRead({ authority, refresh, selector: String(page), value });
      })
      .catch(() => {
        if (sequence.current === generation)
          setQueueRead({ authority, refresh, selector: String(page), failed: true });
      });
    return () => {
      sequence.current++;
    };
  }, [configuration, authority, page, refresh]);
  useEffect(() => {
    const sequence = detailGeneration;
    const generation = ++sequence.current;
    if (code)
      void loadWasteListing(configuration, code)
        .then((value) => {
          if (sequence.current === generation)
            setDetailRead({ authority, refresh, selector: code, value });
        })
        .catch(() => {
          if (sequence.current === generation)
            setDetailRead({ authority, refresh, selector: code, failed: true });
        });
    return () => {
      sequence.current++;
    };
  }, [configuration, authority, code, refresh]);
  const selected = queue?.failed ? undefined : detail?.value;
  const { labels, states } = presentation;
  const authorCopy = presentation.authoring;
  const signature = JSON.stringify(selected) ?? '';
  useLayoutEffect(() => {
    live.current = { authority, code, signature };
    return () => {
      live.current = undefined;
    };
  }, [authority, code, signature]);
  useLayoutEffect(
    () => () => {
      authorFlight.current = undefined;
    },
    [authority],
  );
  const attempt = authorAttempt?.authority === authority ? authorAttempt : undefined;
  const [reconciliationBusy, setReconciliationBusy] = useState(false);
  const working = attempt?.phase === 'WORKING' || reconciliationBusy;
  const held = attempt && attempt.phase !== 'SAVED';
  const currentReview =
    review?.authority === authority && review.signature === signature && !held
      ? review
      : undefined;
  let selectorsAdmitted = false;
  if (selected) {
    try {
      listingAuthoringSelectors(configuration, selected);
      selectorsAdmitted = true;
    } catch {
      /* Owner-projected unknown/legacy states remain read-only. */
    }
  }
  const canAuthor = Boolean(
    authorCopy &&
    selectorsAdmitted &&
    productConfiguration &&
    !held &&
    attempt?.row.assetCode !== selected?.assetCode,
  );
  const publicationRoute =
    selected && !held ? listingPublicationRoute(configuration, selected) : undefined;
  const observeAuthoring = async (
    row: WasteListingRequest,
    ticket: object,
    acknowledged?: ListingAuthoredProduct,
  ) => {
    try {
      const fresh = await loadWasteListing(configuration, row.assetCode);
      if (live.current?.authority !== authority || authorFlight.current !== ticket)
        return;
      if (live.current.code === row.assetCode) {
        detailGeneration.current++;
        setDetailRead({ authority, refresh, selector: row.assetCode, value: fresh });
      }
      setQueueRead((current) =>
        current?.authority === authority && current.value
          ? {
              ...current,
              value: {
                ...current.value,
                items: current.value.items.map((item) =>
                  item.assetCode === fresh.assetCode ? fresh : item,
                ),
              },
            }
          : current,
      );
      setAuthorAttempt({
        authority,
        row,
        phase: listingAuthoringReadback(row, fresh, acknowledged)
          ? 'SAVED'
          : 'UNCERTAIN',
        ...(acknowledged ? { acknowledged } : {}),
      });
    } catch {
      if (live.current?.authority === authority && authorFlight.current === ticket)
        setAuthorAttempt({
          authority,
          row,
          phase: 'UNCERTAIN',
          ...(acknowledged ? { acknowledged } : {}),
        });
    }
  };
  const confirmAuthoring = async () => {
    if (
      !currentReview ||
      !canAuthor ||
      authorFlight.current ||
      live.current?.authority !== authority ||
      live.current.signature !== currentReview.signature
    )
      return;
    const ticket = {};
    authorFlight.current = ticket;
    const original = currentReview.row;
    setReview(undefined);
    setAuthorAttempt({ authority, row: original, phase: 'WORKING' });
    let acknowledged: ListingAuthoredProduct | undefined;
    try {
      acknowledged = await authorListingProduct(configuration, original);
    } catch {
      /* Only independent owner readback can settle a lost or refused reply. */
    }
    if (live.current?.authority !== authority || authorFlight.current !== ticket)
      return;
    await observeAuthoring(original, ticket, acknowledged);
    if (authorFlight.current === ticket) authorFlight.current = undefined;
  };
  const inspectAuthoring = async () => {
    if (!attempt || attempt.phase !== 'UNCERTAIN' || authorFlight.current) return;
    const ticket = {};
    authorFlight.current = ticket;
    setAuthorAttempt({ ...attempt, phase: 'WORKING' });
    await observeAuthoring(attempt.row, ticket, attempt.acknowledged);
    if (authorFlight.current === ticket) authorFlight.current = undefined;
  };
  const authorNotice =
    attempt && authorCopy ? (
      <Alert
        severity={attempt.phase === 'SAVED' ? 'success' : 'warning'}
        action={
          attempt.phase === 'UNCERTAIN' ? (
            <Button onClick={() => void inspectAuthoring()}>
              {authorCopy.inspectLabel}
            </Button>
          ) : undefined
        }
      >
        {attempt.row.assetCode}:{' '}
        {attempt.phase === 'SAVED'
          ? authorCopy.savedMessage
          : attempt.phase === 'WORKING'
            ? authorCopy.workingLabel
            : authorCopy.uncertainMessage}
      </Alert>
    ) : null;
  const wrongEnterprise =
    selected?.eligibility.requiredEnterpriseCode !== null &&
    selected?.eligibility.requiredEnterpriseCode !== undefined &&
    selected.eligibility.requiredEnterpriseCode !==
      selected.eligibility.signedEnterpriseCode;
  const fields: readonly (readonly [string, string | number | null | undefined])[] =
    selected
      ? [
          [labels.asset, selected.assetCode],
          [labels.name, selected.productCommand?.name],
          [labels.status, states[selected.state]],
          [labels.rewardPrice, selected.rewardPrice],
          [labels.signedEnterprise, selected.eligibility.signedEnterpriseCode],
          [labels.requiredEnterprise, selected.eligibility.requiredEnterpriseCode],
          [labels.store, selected.storeContext?.code],
          [labels.product, selected.product?.productCode],
          [
            labels.priceRow,
            selected.priceRowIntent
              ? `${selected.priceRowIntent.code} / ${selected.priceRowIntent.unitAmount} ${selected.priceRowIntent.currency}`
              : null,
          ],
        ]
      : [];
  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography variant="h5" sx={{ overflowWrap: 'anywhere', minWidth: 0 }}>
          {labels.title}
        </Typography>
        <Tooltip title={labels.refresh}>
          <span>
            <IconButton
              aria-label={labels.refresh}
              disabled={!queue || working}
              onClick={() => setRefresh((value) => value + 1)}
            >
              <ShellIcon name="refresh" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      {!code && authorNotice}
      {!queue && <CircularProgress size={24} aria-label={labels.loading} />}
      {queue?.failed && <Alert severity="error">{labels.unavailable}</Alert>}
      {queue?.value && (
        <>
          <Chip
            size="small"
            label={queue.value.total}
            sx={{ alignSelf: 'flex-start' }}
          />
          {!queue.value.items.length ? (
            <Typography>{labels.empty}</Typography>
          ) : (
            <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto' }}>
              <Table size="small" aria-label={labels.title}>
                <TableHead>
                  <TableRow>
                    {[
                      labels.asset,
                      labels.name,
                      labels.status,
                      labels.rewardPrice,
                      labels.details,
                    ].map((label) => (
                      <TableCell key={label}>{label}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {queue.value.items.map((item) => (
                    <TableRow key={item.assetCode}>
                      <TableCell sx={{ overflowWrap: 'anywhere' }}>
                        {item.assetCode}
                      </TableCell>
                      <TableCell sx={{ overflowWrap: 'anywhere' }}>
                        {item.productCommand?.name || labels.unknown}
                      </TableCell>
                      <TableCell>{states[item.state]}</TableCell>
                      <TableCell>{item.rewardPrice ?? labels.unknown}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          disabled={working}
                          aria-label={`${labels.details}: ${item.assetCode}`}
                          onClick={() =>
                            setSelection({ authority, code: item.assetCode })
                          }
                        >
                          {labels.details}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', justifyContent: 'flex-end' }}
          >
            <IconButton
              aria-label={labels.previous}
              disabled={page <= 1 || working}
              onClick={() => setPaging({ authority, page: page - 1 })}
            >
              <ShellIcon name="chevron-left" />
            </IconButton>
            <Typography variant="body2">
              {labels.page} {page} /{' '}
              {Math.max(1, Math.ceil(queue.value.total / queue.value.limit))}
            </Typography>
            <IconButton
              aria-label={labels.next}
              disabled={
                working ||
                page * queue.value.limit >= queue.value.total ||
                page >= 10000
              }
              onClick={() => setPaging({ authority, page: page + 1 })}
            >
              <ShellIcon name="chevron-right" />
            </IconButton>
          </Stack>
        </>
      )}
      <WasteSubmissionDialog
        open={Boolean(code)}
        title={code}
        closeLabel={labels.close}
        busy={working}
        onClose={() => setSelection(undefined)}
      >
        <Stack spacing={2}>
          {code && authorNotice}
          {presentation.reconciliation && (
            <WasteListingReconciliation
              configuration={configuration}
              authority={authority}
              assetRevision={selected?.assetRevision}
              assetCode={
                selected?.state === 'RECONCILIATION_REQUIRED'
                  ? selected.assetCode
                  : undefined
              }
              copy={presentation.reconciliation}
              unresolvedMessage={labels.reconciliationRequired}
              onBusyChange={setReconciliationBusy}
            />
          )}
          {code && !detail && (
            <CircularProgress size={24} aria-label={labels.loading} />
          )}
          {(detail?.failed || queue?.failed) && (
            <Alert severity="error">{labels.unavailable}</Alert>
          )}
          {selected && (
            <>
              {!canAuthor && !publicationRoute && (
                <Alert severity="info">{labels.readOnly}</Alert>
              )}
              {wrongEnterprise && (
                <Alert severity="warning">{labels.wrongEnterprise}</Alert>
              )}
              {selected.state === 'OWNER_UNAVAILABLE' && (
                <Alert severity="warning">{labels.ownerUnavailable}</Alert>
              )}
              {selected.state === 'RECONCILIATION_REQUIRED' &&
                !presentation.reconciliation && (
                  <Alert severity="warning">{labels.reconciliationRequired}</Alert>
                )}
              {selected.eligibility.blockerCode && (
                <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                  {selected.eligibility.blockerCode}
                </Typography>
              )}
              <Box
                component="dl"
                sx={{
                  m: 0,
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    sm: 'minmax(100px, 1fr) minmax(0, 2fr)',
                  },
                  gap: 1,
                  '& dd': { m: 0, overflowWrap: 'anywhere' },
                  '& dt': { color: 'text.secondary' },
                }}
              >
                {fields.map(([label, value]) => (
                  <Box key={label} sx={{ display: 'contents' }}>
                    <Typography component="dt" variant="body2">
                      {label}
                    </Typography>
                    <Typography component="dd" variant="body2">
                      {value ?? labels.unknown}
                    </Typography>
                  </Box>
                ))}
              </Box>
              {!!selected.publicationReferences.length && (
                <Stack spacing={1}>
                  <Typography variant="subtitle2">{labels.publication}</Typography>
                  {selected.publicationReferences.map((ref) => (
                    <Typography
                      key={`${ref.domain}:${ref.code}`}
                      variant="body2"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {ref.domain}: {ref.code} / {ref.state}
                      {ref.processCode ? ` / ${ref.processCode}` : ''}
                    </Typography>
                  ))}
                </Stack>
              )}
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {(selected.actions.includes('AUTHOR_PRODUCT_SOURCE') ||
                  (wrongEnterprise &&
                    selected.state !== 'RECONCILIATION_REQUIRED')) && (
                  <Tooltip
                    title={
                      wrongEnterprise
                        ? labels.wrongEnterprise
                        : canAuthor
                          ? labels.authorProduct
                          : labels.commandUnavailable
                    }
                  >
                    <span>
                      <Button
                        disabled={!canAuthor}
                        onClick={() =>
                          selected &&
                          setReview({
                            authority,
                            row: parseWasteListing(
                              selected,
                              configuration.enterpriseCode,
                            ),
                            signature,
                          })
                        }
                      >
                        {labels.authorProduct}
                      </Button>
                    </span>
                  </Tooltip>
                )}
                {selected.actions.includes('OPEN_PUBLICATION_WORKFLOW') && (
                  <Tooltip
                    title={
                      publicationRoute
                        ? labels.openPublication
                        : labels.commandUnavailable
                    }
                  >
                    <span>
                      {publicationRoute ? (
                        <Button component={RouterLink} to={publicationRoute}>
                          {labels.openPublication}
                        </Button>
                      ) : (
                        <Button disabled>{labels.openPublication}</Button>
                      )}
                    </span>
                  </Tooltip>
                )}
              </Stack>
            </>
          )}
        </Stack>
      </WasteSubmissionDialog>
      {authorCopy && (
        <Dialog
          open={Boolean(currentReview)}
          onClose={() => setReview(undefined)}
          fullWidth
          maxWidth="sm"
          aria-labelledby="listing-author-review-title"
        >
          <DialogTitle id="listing-author-review-title">
            {authorCopy.reviewTitle}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={1}>
              <Typography>
                {labels.asset}: {currentReview?.row.assetCode}
              </Typography>
              <Typography>
                {labels.store}: {currentReview?.row.storeContext?.code}
              </Typography>
              <Typography>
                {labels.requiredEnterprise}:{' '}
                {currentReview?.row.storeContext?.enterpriseCode}
              </Typography>
              <Typography>
                {labels.rewardPrice}: {currentReview?.row.rewardPrice}
              </Typography>
              <Typography sx={{ overflowWrap: 'anywhere' }}>
                {currentReview?.row.productCommand?.name}
              </Typography>
              {currentReview && (
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    fontSize: '0.75rem',
                  }}
                >
                  {JSON.stringify(
                    listingAuthoringSelectors(configuration, currentReview.row),
                    null,
                    2,
                  )}
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReview(undefined)}>
              {authorCopy.cancelLabel}
            </Button>
            <Button disabled={!canAuthor} onClick={() => void confirmAuthoring()}>
              {authorCopy.confirmLabel}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Stack>
  );
}
