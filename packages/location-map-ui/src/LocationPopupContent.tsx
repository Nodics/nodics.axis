/** Existing Axis collection-centre popup, extracted unchanged in purpose for shared use.
 * Location owns category/configuration data; consumers provide already-authorized centre facts.
 */
export interface LocationPopupCoordinate {
  readonly latitude: number;
  readonly longitude: number;
}
export interface LocationPopupRecord extends LocationPopupCoordinate {
  readonly name: string;
  readonly mapCategory?:
    | { readonly code: string; readonly label: string; readonly color: string }
    | undefined;
}
function customerCollectionMessage(record: LocationPopupRecord): string {
  if (record.mapCategory?.code === 'repair')
    return 'Bring your device here for repair or reuse support.';
  if (record.mapCategory?.code === 'trade-in')
    return 'Bring eligible e-waste here for trade-in support.';
  return 'Drop off approved e-waste here for verified recycling.';
}

export function LocationPopupContent({
  directionsEnabled,
  directionsOrigin,
  location,
  onClose,
}: {
  readonly directionsEnabled: boolean;
  readonly directionsOrigin: LocationPopupCoordinate | undefined;
  readonly location: LocationPopupRecord;
  readonly onClose: () => void;
}) {
  const color = location.mapCategory?.color || '#6c7970';
  const tag = {
    className: 'location-tag',
    label: location.mapCategory?.label || 'Collection centre',
  };
  const handleDirectionsClick = () => {
    const origin = directionsOrigin
      ? `&origin=${directionsOrigin.latitude.toString()},${directionsOrigin.longitude.toString()}`
      : '';
    const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${location.latitude.toString()},${location.longitude.toString()}`;
    window.open(url, '_blank');
  };

  return (
    <div
      className="location-popup"
      role="dialog"
      aria-label="Collection centre details"
    >
      <button
        aria-label="Close collection centre popup"
        className="location-popup__close"
        onClick={onClose}
        type="button"
      >
        x
      </button>
      <div className="location-popup__address">{location.name}</div>
      <div className="location-popup__summary">
        {customerCollectionMessage(location)}
      </div>
      <div className="location-popup__tags">
        <span
          className={tag.className}
          style={{
            color: color,
            backgroundColor: `${color}18`,
          }}
        >
          {tag.label}
        </span>
        {directionsEnabled && (
          <button
            className="location-popup__direction"
            onClick={handleDirectionsClick}
            type="button"
          >
            Directions
          </button>
        )}
      </div>
    </div>
  );
}
