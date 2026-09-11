import { GlobalStyles, Paper, type SxProps, type Theme } from '@mui/material';
import ReactMapGL, { type MapRef } from 'react-map-gl/mapbox';
import {
  useCallback,
  useEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
  type Ref,
} from 'react';
import { shouldHandleMapWheel, type MapInteraction } from '../api/locationMapContract';

export interface AxisLocationViewState {
  readonly latitude: number;
  readonly longitude: number;
  readonly zoom: number;
}

export interface AxisLocationMapFrameProps {
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly styles?: ComponentProps<typeof GlobalStyles>['styles'] | undefined;
  readonly sx?: SxProps<Theme> | undefined;
}

export interface AxisMapboxCanvasProps {
  readonly interaction?: MapInteraction | undefined;
  readonly minimumZoom?: number | undefined;
  readonly maximumZoom?: number | undefined;
  readonly accessToken: string;
  readonly children?: ReactNode;
  readonly initialViewState: AxisLocationViewState;
  readonly mapStyle: string;
  readonly mapRef?: Ref<MapRef> | undefined;
  readonly cooperativeGestures?: boolean | undefined;
  readonly scrollZoom?: ComponentProps<typeof ReactMapGL>['scrollZoom'];
  readonly onLoad?: ComponentProps<typeof ReactMapGL>['onLoad'];
  readonly transformRequest?: ComponentProps<typeof ReactMapGL>['transformRequest'];
  readonly onError?: ComponentProps<typeof ReactMapGL>['onError'];
}

const mapboxTrackpadZoomRate = 1 / 260;
const mapboxWheelZoomRate = 1 / 900;

export function AxisLocationMapFrame({
  ariaLabel,
  children,
  className,
  styles,
  sx,
}: AxisLocationMapFrameProps) {
  return (
    <Paper
      aria-label={ariaLabel}
      className={className}
      variant="outlined"
      sx={{
        height: { xs: 420, md: 620 },
        overflow: 'hidden',
        p: 0,
        position: 'relative',
        ...sx,
      }}
    >
      {styles ? <GlobalStyles styles={styles} /> : null}
      {children}
    </Paper>
  );
}

export function AxisMapboxCanvas({
  interaction,
  minimumZoom = 0,
  maximumZoom = 20,
  accessToken,
  children,
  cooperativeGestures = true,
  initialViewState,
  mapRef,
  mapStyle,
  onError,
  onLoad,
  scrollZoom = true,
  transformRequest,
}: AxisMapboxCanvasProps) {
  const wheelCleanup = useRef<() => void>(() => {});
  useEffect(() => () => wheelCleanup.current(), []);
  const handleLoad = useCallback<
    NonNullable<ComponentProps<typeof ReactMapGL>['onLoad']>
  >(
    (event) => {
      wheelCleanup.current();
      if (interaction) {
        const map = event.target;
        map.scrollZoom.disable();
        const container = map.getContainer();
        let lastZoomAt = -Infinity;
        const wheel = (wheelEvent: WheelEvent) => {
          if (!shouldHandleMapWheel(wheelEvent, interaction, navigator.platform))
            return;
          wheelEvent.preventDefault();
          wheelEvent.stopPropagation();
          const now = performance.now();
          if (now - lastZoomAt < interaction.wheelCooldownMs) return;
          const zoom = Math.max(
            minimumZoom,
            Math.min(
              maximumZoom,
              map.getZoom() + (wheelEvent.deltaY > 0 ? -1 : 1) * interaction.wheelStep,
            ),
          );
          if (zoom === map.getZoom()) return;
          lastZoomAt = now;
          map.stop();
          map.easeTo({
            center: map.getCenter(),
            zoom,
            duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 0
              : interaction.zoomAnimationSeconds * 1000,
          });
        };
        container.addEventListener('wheel', wheel, { capture: true, passive: false });
        wheelCleanup.current = () =>
          container.removeEventListener('wheel', wheel, true);
      } else {
        event.target.scrollZoom.setZoomRate(mapboxTrackpadZoomRate);
        event.target.scrollZoom.setWheelZoomRate(mapboxWheelZoomRate);
      }
      onLoad?.(event);
    },
    [onLoad, interaction, minimumZoom, maximumZoom],
  );

  return (
    <ReactMapGL
      cooperativeGestures={interaction ? false : cooperativeGestures}
      minZoom={minimumZoom}
      maxZoom={maximumZoom}
      initialViewState={initialViewState}
      key="mapbox-street-map"
      mapboxAccessToken={accessToken}
      mapStyle={mapStyle}
      onLoad={handleLoad}
      ref={mapRef}
      scrollZoom={interaction ? false : scrollZoom}
      style={{ height: '100%', width: '100%' }}
      {...(onError ? { onError } : {})}
      {...(transformRequest ? { transformRequest } : {})}
    >
      {children}
    </ReactMapGL>
  );
}
