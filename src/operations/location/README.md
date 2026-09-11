# Location map rendering in Axis

Location owns provider settings, viewport, enabled controls, marker categories
and wheel behavior. Axis edits one shared configuration per map usage and renders
its versioned projection. Circa and later consumers use the same backend record.
Collection-point data and visibility remain owned by the corresponding APIs.

The map setup form waits for the persisted configuration before initializing the
editable draft. Saving supplies `expectedRevision`; Location enforces atomic
revision updates. The map refreshes at the backend interval and on window focus.
The active renderer and allowed fallback both come from Location descriptors.
Mapbox setup requires an active configuration and a valid public token.

Safe customization: change labels, colors, matching terms, enabled controls or
wheel settings through **Map Configuration**. Extend typed parsers and local
renderer adapters for a new supported contract version. Do not create an Axis
configuration store, expose secret tokens, or load backend-supplied code/markup.
Backend extension and operator contracts live in
`nodics.location/modules/locationMap/llm/contracts/shared-map-configuration.md`
in the framework repository.

Run `npm run test -- test/location`, `npm run typecheck` and focused ESLint checks.
Cover unauthorized/failing reads, incomplete provider setup, allowed fallback,
custom categories, stale saves, first-event modifier zoom, ordinary page scroll,
responsive expansion and propagation to an independently open application.

`LocationPopupContent` and its styles are maintained once in
`packages/location-map-ui` and imported through `@nodics/location-map-ui`.
Circa consumes a generated package archive containing that same source. Keep
popup changes in the package and regenerate its distribution; do not fork the
component or stylesheet in either application. Backend category configuration
continues to supply labels and colors.
