import { GlobalStyles, Paper, type SxProps, type Theme } from '@mui/material';
import ReactMapGL, { type MapRef } from 'react-map-gl/mapbox';
import { useCallback, type ComponentProps, type ReactNode, type Ref } from 'react';

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
  const handleLoad = useCallback<
    NonNullable<ComponentProps<typeof ReactMapGL>['onLoad']>
  >(
    (event) => {
      event.target.scrollZoom.setZoomRate(mapboxTrackpadZoomRate);
      event.target.scrollZoom.setWheelZoomRate(mapboxWheelZoomRate);
      onLoad?.(event);
    },
    [onLoad],
  );

  return (
    <ReactMapGL
      cooperativeGestures={cooperativeGestures}
      initialViewState={initialViewState}
      key="mapbox-street-map"
      mapboxAccessToken={accessToken}
      mapStyle={mapStyle}
      onLoad={handleLoad}
      ref={mapRef}
      scrollZoom={scrollZoom}
      style={{ height: '100%', width: '100%' }}
      {...(onError ? { onError } : {})}
      {...(transformRequest ? { transformRequest } : {})}
    >
      {children}
    </ReactMapGL>
  );
}
