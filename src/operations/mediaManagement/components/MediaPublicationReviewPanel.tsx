import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisModuleConnection,
} from '../../../bootstrap/publicBootstrap';
import { useAxisLocalization } from '../../../localization/AxisLocalizationContext';
import { localeDirection } from '../../../localization/localeDirection';
import type { AxisRuntimeConfig } from '../../../runtime/runtimeConfig';
import { publicationInspectionPath } from '../../contentExperience/publicationInspectionNavigation';
import { resolveMediaPublicationHandoff } from '../../readiness/mediaPublicationHandoff';
import { selectMediaAuthoringConnection } from '../mediaAuthoringAuthority';
import {
  loadMediaPublicationReview,
  loadMediaPublicationReviewImage,
  type MediaPublicationReview,
  type MediaReviewIdentity,
} from '../api/mediaPublicationReviewClient';
import type { MediaStoragePolicyClientConfiguration } from '../api/mediaStoragePolicyClient';

interface Props {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
  readonly identity: MediaReviewIdentity;
}

/** Exact Media evidence is optional inquiry, not a Process decision credential. Private scope changes retire all reads/URLs. */
export function MediaPublicationReviewPanel(props: Props) {
  const { locale } = useAxisLocalization();
  const language = locale === 'ar' ? 'ar' : 'en';
  const actor = useMemo(
    () => ({ token: props.accessToken, id: crypto.randomUUID() }),
    [props.accessToken],
  );
  const selected = selectMediaAuthoringConnection(props.bootstrap);
  const source = selected?.runtimeRole?.publication === 'STAGED' ? selected : undefined;
  const admitted = props.bootstrap.navigation.some(
    (item) =>
      item.moduleName === 'media' &&
      item.featureState === 'ACTIVE' &&
      ['UP', 'DEGRADED'].includes(item.availability),
  );
  if (!source || !admitted)
    return (
      <Alert severity="info">
        Captured Media evidence is unavailable for this workspace.
      </Alert>
    );
  const key = JSON.stringify([
    actor.id,
    props.bootstrap.tenantCode,
    props.runtime.enterpriseCode,
    props.runtime.projectCode,
    source.instanceId,
    source.endpoint,
    source.server,
    source.environment,
    source.runtimeRole,
    props.identity,
    language,
    props.bootstrap.navigation.filter((item) =>
      ['media', 'publish'].includes(item.moduleName),
    ),
  ]);
  return (
    <CapturedMediaReview
      key={key}
      {...props}
      source={source}
      locale={language}
      configuration={{
        accessToken: props.accessToken,
        enterpriseCode: props.runtime.enterpriseCode,
        timeoutMs: props.runtime.requestTimeoutMs,
      }}
    />
  );
}

/** The wrapper owns remount scope; unrelated reason edits preserve the inspected image and never refetch it. */
function CapturedMediaReview(
  props: Props & {
    source: AxisModuleConnection;
    locale: string;
    configuration: MediaStoragePolicyClientConfiguration;
  },
) {
  const captured = useRef(props);
  const { source, configuration, identity, locale } = captured.current;
  const [review, setReview] = useState<MediaPublicationReview>();
  const [phase, setPhase] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [retry, setRetry] = useState(0);
  const [image, setImage] = useState<string>();
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const active = useRef(false),
    epoch = useRef(0),
    imageUrl = useRef<string | undefined>(undefined),
    imageBusy = useRef(false);
  const previousCopy = useRef<MediaPublicationReview['presentation'] | undefined>(
    undefined,
  );
  useEffect(() => {
    active.current = true;
    const observed = ++epoch.current;
    setPhase('LOADING');
    setReview(undefined);
    setImage(undefined);
    setImageError(false);
    setImageLoading(false);
    imageBusy.current = false;
    if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    imageUrl.current = undefined;
    void loadMediaPublicationReview(source, configuration, identity, locale)
      .then((result) => {
        if (!active.current || observed !== epoch.current) return;
        previousCopy.current = result.presentation;
        setReview(result);
        setPhase('READY');
      })
      .catch(() => {
        if (active.current && observed === epoch.current) setPhase('ERROR');
      });
    return () => {
      active.current = false;
      epoch.current += 1;
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
      imageUrl.current = undefined;
    };
  }, [source, configuration, identity, locale, retry]);
  const copy = review?.presentation ?? previousCopy.current;
  const openImage = async () => {
    if (!review || imageBusy.current || phase !== 'READY') return;
    imageBusy.current = true;
    setImageLoading(true);
    setImageError(false);
    const observed = epoch.current;
    try {
      const blob = await loadMediaPublicationReviewImage(
        source,
        configuration,
        identity,
        review,
      );
      if (!active.current || observed !== epoch.current) return;
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
      const url = URL.createObjectURL(blob);
      imageUrl.current = url;
      setImage(url);
    } catch {
      if (active.current && observed === epoch.current) setImageError(true);
    } finally {
      if (active.current && observed === epoch.current) {
        imageBusy.current = false;
        setImageLoading(false);
      }
    }
  };
  const publicationPath = review
    ? publicationInspectionPath(props.bootstrap, source, review.publicationCode)
    : undefined;
  const handoff = review?.workingAsset;
  const selectedHandoffOwner = handoff?.handoff
    ? selectModuleConnection(
        props.bootstrap,
        'media',
        handoff.handoff.backendWorkspace.ownerSelector,
      )
    : undefined;
  const workingPath =
    selectedHandoffOwner?.instanceId === source.instanceId &&
    selectedHandoffOwner.endpoint === source.endpoint
      ? resolveMediaPublicationHandoff(props.bootstrap, handoff)
      : undefined;
  return (
    <Box
      component="section"
      lang={locale}
      dir={localeDirection(locale)}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, minWidth: 0 }}
    >
      <Stack spacing={1.5}>
        {phase === 'LOADING' ? (
          <Typography role="status">
            {copy?.loading ?? 'Loading captured Media evidence…'}
          </Typography>
        ) : phase === 'ERROR' ? (
          <Alert severity="warning">
            {copy?.unavailable ?? 'Captured Media evidence could not be loaded.'}
          </Alert>
        ) : review ? (
          <>
            <Typography component="h3" variant="subtitle1">
              {copy?.title}
            </Typography>
            <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
              {review.asset.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {copy?.captured}
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{ flexWrap: 'wrap' }}
            >
              <Typography variant="body2">
                {copy?.version}: {review.asset.versionId}
              </Typography>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                {copy?.fileType}: {review.asset.mimeType}
              </Typography>
              <Typography variant="body2">
                {copy?.size}: {review.asset.sizeBytes.toLocaleString(locale)} B
              </Typography>
            </Stack>
            {!review.previewAvailable ? (
              <Typography variant="body2" color="text.secondary">
                {copy?.unsupported}
              </Typography>
            ) : null}
            {imageLoading ? (
              <Typography role="status">{copy?.loading}</Typography>
            ) : null}
            {imageError ? <Alert severity="warning">{copy?.unavailable}</Alert> : null}
            {image ? (
              <Box
                component="img"
                src={image}
                alt={review.asset.name}
                onError={() => {
                  setImageError(true);
                  if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
                  imageUrl.current = undefined;
                  setImage(undefined);
                }}
                sx={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: 360,
                  objectFit: 'contain',
                  alignSelf: 'flex-start',
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                }}
              />
            ) : null}
            <Typography variant="caption" color="text.secondary">
              {copy?.historical}
            </Typography>
          </>
        ) : null}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ flexWrap: 'wrap' }}
        >
          {review?.previewAvailable ? (
            image ? (
              <Button
                onClick={() => {
                  if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
                  imageUrl.current = undefined;
                  setImage(undefined);
                }}
              >
                {copy?.hide}
              </Button>
            ) : (
              <Button disabled={imageLoading} onClick={() => void openImage()}>
                {copy?.preview}
              </Button>
            )
          ) : null}
          {publicationPath ? (
            <Button component={RouterLink} to={publicationPath}>
              {copy?.publication}
            </Button>
          ) : null}
          {workingPath ? (
            <Button component={RouterLink} to={workingPath}>
              {copy?.openAsset}
            </Button>
          ) : null}
          <Button
            disabled={phase === 'LOADING' || imageLoading}
            onClick={() => setRetry((current) => current + 1)}
          >
            {copy?.refresh ?? 'Refresh captured evidence'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
