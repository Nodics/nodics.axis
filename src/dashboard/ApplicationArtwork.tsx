import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import type { ApplicationVisual } from '../operations/setupAccelerators/api/applicationVisual';
import { loadApplicationArtwork } from '../operations/setupAccelerators/api/applicationArtworkClient';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
} from '../bootstrap/publicBootstrap';

export interface ApplicationArtworkContext {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly timeoutMs: number;
}

/** Fixed-size owner-media preview; missing data never installs or publishes an application. */
export function ApplicationArtwork({
  visual,
  large = false,
  media,
}: {
  readonly visual?: ApplicationVisual | undefined;
  readonly large?: boolean;
  readonly media?: ApplicationArtworkContext | undefined;
}) {
  const connection =
    media &&
    visual &&
    selectModuleConnection(media.bootstrap, 'media', {
      runtimeRoleCode: visual.runtimeRole,
    });
  const accessToken = media?.accessToken;
  const enterpriseCode = media?.enterpriseCode;
  const timeoutMs = media?.timeoutMs;
  const mediaCode = visual?.mediaCode;
  const runtimeRole = visual?.runtimeRole;
  const alt = visual?.alt;
  const applicationActive = visual?.active === true;
  const [loaded, setLoaded] = useState<{ source: string; url: string }>();
  const [failedSource, setFailedSource] = useState<string>();
  const source = JSON.stringify([
    connection,
    mediaCode,
    runtimeRole,
    accessToken,
    enterpriseCode,
    applicationActive,
  ]);
  useEffect(() => {
    if (
      !applicationActive ||
      !connection ||
      !accessToken ||
      !enterpriseCode ||
      !timeoutMs ||
      !mediaCode ||
      !runtimeRole ||
      !alt
    )
      return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let active = true;
    let objectUrl: string | undefined;
    void loadApplicationArtwork({
      connection,
      visual: { mediaCode, runtimeRole, alt, active: applicationActive },
      accessToken,
      enterpriseCode,
      signal: controller.signal,
    })
      .then((blob) => {
        if (!active || controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ source, url: objectUrl });
      })
      .catch(() => {
        /* Optional artwork remains a neutral placeholder. */
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    connection,
    accessToken,
    enterpriseCode,
    timeoutMs,
    mediaCode,
    runtimeRole,
    alt,
    source,
    applicationActive,
  ]);
  const imageUrl = loaded?.source === source ? loaded.url : undefined;
  const showImage = visual && imageUrl && failedSource !== imageUrl;
  return (
    <Box
      sx={{
        width: large ? '100%' : { xs: 88, sm: 120 },
        height: large ? 168 : { xs: 66, sm: 80 },
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '6px',
        bgcolor: 'action.hover',
        display: 'grid',
        placeItems: 'center',
        border: 1,
        borderColor: 'divider',
      }}
    >
      {showImage ? (
        <Box
          component="img"
          src={imageUrl}
          alt={visual.alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onError={() => setFailedSource(imageUrl)}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <Box
          component="img"
          src="/brand/application-fallback-v1.png"
          alt="Nodics"
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
    </Box>
  );
}
