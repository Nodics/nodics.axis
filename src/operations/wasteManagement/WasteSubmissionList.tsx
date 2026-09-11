import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  loadWasteReviewPhoto,
  type WasteDashboardData,
  type WasteReviewClientConfiguration,
  type WasteReviewSubmission,
} from './api/wasteReviewClient';
import { wasteName } from './wastePresentation';

type Labels = Record<string, string>;
/** Loads visible thumbnails only through the same authorized Media evidence contract as the detail view. */
function EvidenceThumbnail({
  record,
  configuration,
  allowed,
}: {
  record: WasteReviewSubmission;
  configuration: WasteReviewClientConfiguration;
  allowed: boolean;
}) {
  const [source, setSource] = useState<{
    url: string;
    configuration: WasteReviewClientConfiguration;
    revision: number;
  } | null>(null);
  const displayedSource =
    allowed &&
    source?.configuration === configuration &&
    source.revision === record.revision
      ? source.url
      : '';
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    if (!allowed || !record.metadata.photo) return;
    const load = () => {
      void loadWasteReviewPhoto(configuration, record.code)
        .then((url) => {
          if (active) setSource({ url, configuration, revision: record.revision });
        })
        .catch(() => {});
    };
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== 'undefined' && holder.current) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          load();
        }
      });
      observer.observe(holder.current);
    } else load();
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [allowed, configuration, record.code, record.revision, record.metadata.photo]);
  return (
    <Box
      ref={holder}
      sx={{
        width: { xs: 56, sm: 76 },
        height: { xs: 56, sm: 76 },
        flexShrink: 0,
        borderRadius: 1.5,
        bgcolor: 'action.hover',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
      }}
    >
      {displayedSource ? (
        <Box
          component="img"
          alt=""
          src={displayedSource}
          referrerPolicy="no-referrer"
          onError={() => setSource(null)}
          sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <Typography aria-hidden color="text.disabled" sx={{ fontSize: 26 }}>
          ▧
        </Typography>
      )}
    </Box>
  );
}
/** One domain-neutral row: quick read-only facts expand independently of the governed detail editor. */
function SubmissionRow({
  record,
  configuration,
  canReadEvidence,
  labels,
  dashboard,
  onOpen,
  disabled,
}: Pick<
  ListProps,
  'configuration' | 'canReadEvidence' | 'labels' | 'dashboard' | 'onOpen' | 'disabled'
> & { record: WasteReviewSubmission }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const facts =
    record.metadata.reviewedFacts ||
    record.metadata.verifiedFacts ||
    record.confirmedFacts ||
    record.submittedFacts;
  const name = facts.name || record.code;
  const centre = dashboard?.centres.find(
    (item) => item.code === facts.preferredCollectionPointCode,
  );
  const item = dashboard?.itemTypes.find((item) => item.code === facts.itemTypeCode);
  const type = wasteName(item?.name) || facts.itemTypeCode?.replaceAll('_', ' ') || '—';
  const review = record.evidenceReview || record.descriptor?.evidenceReview;
  return (
    <Paper
      component="li"
      variant="outlined"
      sx={{ listStyle: 'none', overflow: 'hidden', borderRadius: 2 }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: 'center', '&:hover': { bgcolor: 'action.hover' } }}
      >
        <Box
          component="button"
          type="button"
          disabled={disabled}
          onClick={() => onOpen(record.code)}
          aria-label={`${labels.openDetails || 'Open details'}: ${name}`}
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1.5, sm: 2 },
            p: 2,
            textAlign: 'left',
            background: 'none',
            color: 'inherit',
            border: 0,
            font: 'inherit',
            cursor: 'pointer',
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: -3,
            },
            '&:disabled': { cursor: 'default', opacity: 0.6 },
          }}
        >
          <EvidenceThumbnail
            record={record}
            configuration={configuration}
            allowed={canReadEvidence}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'minmax(0, 1.6fr) minmax(0, 1fr) minmax(130px, .65fr)',
              },
              alignItems: 'center',
              flex: 1,
              gap: { xs: 0.75, md: 2 },
              minWidth: 0,
            }}
          >
            <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              <Typography
                component="span"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  fontWeight: 600,
                }}
              >
                {name}
              </Typography>
              <Typography component="span" variant="body2" color="text.secondary">
                {type}
              </Typography>
              {review?.manualApprovalRequired && (
                <Typography
                  component="span"
                  variant="caption"
                  color="warning.main"
                  sx={{ display: 'block', mt: 0.5, fontWeight: 600 }}
                >
                  {review.label}
                </Typography>
              )}
            </Box>
            <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              <Typography
                component="span"
                variant="body2"
                sx={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {wasteName(centre?.name) || facts.preferredCollectionPointCode || '—'}
              </Typography>
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {labels.customer || 'Customer'}: {record.submitterRef.code}
              </Typography>
            </Box>
            <Box>
              <Chip
                component="span"
                size="small"
                label={record.submissionStatus.replaceAll('_', ' ')}
                color={
                  record.submissionStatus === 'APPROVED'
                    ? 'success'
                    : record.submissionStatus === 'REJECTED'
                      ? 'error'
                      : 'default'
                }
              />
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.5 }}
              >
                {record.metadata.submittedAt
                  ? new Date(record.metadata.submittedAt).toLocaleDateString()
                  : '—'}
              </Typography>
            </Box>
          </Box>
        </Box>
        <IconButton
          disabled={disabled}
          aria-label={`${expanded ? labels.collapseSummary || 'Collapse summary' : labels.expandSummary || 'Expand summary'}: ${name}`}
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
          sx={{ mr: 1, width: 44, height: 44 }}
        >
          <Box
            component="span"
            aria-hidden
            sx={{ transform: expanded ? 'rotate(180deg)' : undefined, fontSize: 22 }}
          >
            ⌄
          </Box>
        </IconButton>
      </Stack>
      <Collapse in={expanded} unmountOnExit>
        <Box
          id={id}
          role="region"
          aria-label={`${labels.summary || 'Summary'}: ${name}`}
          sx={{
            borderTop: 1,
            borderColor: 'divider',
            p: 2,
            pl: { xs: 2, sm: 13.5 },
            bgcolor: 'action.hover',
            overflowWrap: 'anywhere',
          }}
        >
          <Typography variant="body2">
            {facts.description || labels.noDescription || 'No description provided.'}
          </Typography>
          <Stack direction="row" useFlexGap spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2">
              {labels.quantity || 'Quantity'}: {facts.quantity ?? '—'}
            </Typography>
            <Typography variant="body2">
              {labels.condition || 'Condition'}:{' '}
              {facts.conditionGrade?.replaceAll('_', ' ') || '—'}
            </Typography>
            {facts.brand && (
              <Typography variant="body2">
                {facts.brand} {facts.model}
              </Typography>
            )}
          </Stack>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 1 }}
          >
            {record.code}
          </Typography>
          {record.metadata.publicReason && (
            <Alert severity="info" sx={{ mt: 1 }}>
              {record.metadata.publicReason}
            </Alert>
          )}
          <Button
            color="inherit"
            onClick={() => onOpen(record.code)}
            disabled={disabled}
            size="small"
            sx={{ mt: 1, flexWrap: 'wrap' }}
          >
            {labels.openDetails || 'Open details'}
          </Button>
        </Box>
      </Collapse>
    </Paper>
  );
}
interface ListProps {
  searchPanel: ReactNode;
  records: WasteReviewSubmission[];
  configuration: WasteReviewClientConfiguration;
  canReadEvidence: boolean;
  labels: Labels;
  dashboard: WasteDashboardData | null;
  onOpen: (code: string) => void;
  loading: boolean;
  failed: boolean;
  disabled: boolean;
  page: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}
/** Shared listing for backend-declared Waste family views. Filtering, paging and permissions stay with the owner API. */
export function WasteSubmissionList(props: ListProps) {
  const { labels, loading, disabled, total, page, limit } = props;
  return (
    <Stack spacing={2} aria-busy={loading}>
      {props.searchPanel}
      <Typography variant="body2" color="text.secondary" role="status">
        {loading
          ? labels.loading || 'Loading submissions…'
          : props.failed
            ? labels.resultsUnavailable ||
              'Results unavailable. Adjust the search or retry.'
            : `${total} ${labels.submissions || 'submissions'} · ${labels.page || 'page'} ${page}`}
      </Typography>
      <Stack component="ul" spacing={1.5} sx={{ m: 0, p: 0 }}>
        {props.records.map((record) => (
          <SubmissionRow
            key={record.code}
            record={record}
            {...props}
            disabled={disabled || loading}
          />
        ))}
      </Stack>
      {!loading && !props.failed && !props.records.length && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography>
            {labels.noResults || 'No submissions match these filters.'}
          </Typography>
        </Paper>
      )}
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button
          disabled={disabled || loading || page <= 1}
          onClick={() => props.onPage(page - 1)}
        >
          {labels.previous || 'Previous'}
        </Button>
        <Button
          disabled={disabled || loading || page * limit >= total}
          onClick={() => props.onPage(page + 1)}
        >
          {labels.next || 'Next'}
        </Button>
      </Stack>
    </Stack>
  );
}
