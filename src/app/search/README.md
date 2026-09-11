# Shared Axis search panel

`AxisSearchPanel` is presentation infrastructure for a caller-declared functional
module. Schema Workbench and Waste submission views both compose it. It renders
optional text search, quick controls, actions, applied-filter chips, an optional
Clear all callback, and collapsible advanced content in one responsive panel.

The caller owns query state, text-search debounce, draft/applied filters, field
validation, scope, request cancellation, loading and error handling, and export.
The panel neither loads data nor interprets schema conditions or domain filters.
Supply `ownerModule` from the authorized workspace/descriptor. An omitted chip
`onRemove` marks fixed scope; it does not create an authorization boundary.
All permission and fixed-scope enforcement stays with the backend.

Advanced content mounts on first opening and remains mounted when folded. This
preserves local drafts in embedded editors. Explicit Clear all calls the owner
reset and remounts the advanced slot, clearing unapplied local drafts too. Key the panel by the caller's workspace
identity when switching domains/schemas should start a new presentation state.
Text entry remains enabled while callers load results unless explicitly disabled;
mutation/export locks can disable shell controls independently. Embedded fields
receive their own disabled/loading state from the caller.

For a project customization, accept `AxisSearchPanelProps` in a project-owned
wrapper, pass them unchanged, and compose a CMS-provided help fragment into
`summary` or an authorized action into `actions`. Labels are caller-owned strings;
no backend-delivered code or dynamic component registry is accepted. Use
`WasteSearchPanel` as the typed domain adapter example and
`SchemaWorkbenchRenderer` for a schema-owned query builder. Extend owner-provided
CMS copy/contracts through their normal governed lifecycle; do not patch immutable
CMS baseline data or copy filter/permission logic into this container.

Tests: `test/app/search` covers draft preservation, accessibility, fixed scope,
removal and disabled actions. `test/wasteManagement` covers unified criteria,
clear/recovery, fixed families and export parity. Workbench renderer tests protect
schema capabilities, scoped routes, quick filters and query behavior. Browser
checks cover desktop/mobile expansion, text search, applied chips and recovery.
