# Schema Workbench Frontend

Axis renders effective backend schema descriptors and CMS presentation copy.
Module discovery, permissions, validation, reference identity, versioning and
publication remain owned by the connected Nodics services.

## Business Editing

Records open by default; Schema remains a separate inspection tab. Effective
`backoffice.form` supplies field groups, business copy, review, columns and any
owner-managed create operation. The client has no Enterprise-specific save path.
Project-added fields appear in the remaining-fields group without frontend edits.
Hidden presentation fields do not establish a security boundary.

Forms preserve unfinished inputs between steps, validate before review, and ask
before discarding changed input. Enum selections retain typed values; localized
text has per-language fields. Related creation opens a separate dialog and adds
an unsaved draft to the parent. Existing references remain selectable and editable
when authorized. Nested detail dialogs intentionally offer no Delete operation.

The final save resolves child references before saving the parent. Successful
children are checkpointed only while the form remains mounted. Partial failure
is visible, retry retains those references, and discarding does not roll back
saved children. This is not a cross-module transaction or durable draft recovery.
Domain-owned create actions use the existing aggregate endpoint with a stable
per-form command key. They never fall back to a generic insert on failure.

For backend concurrency descriptors with `managed: true`, the client removes
the technical field from business patches and sends the original record token
in the existing query. A legacy record without the field uses token 0. The
persisted response becomes the next editing snapshot; no browser arithmetic or
automatic latest-token retry is allowed. The backend marks the counter read-only.
Other concurrency descriptors and versioned saves retain their existing paths.
Record-list reads and post-mutation invalidation share one prefix including the
connection instance and endpoint. Do not omit these segments or reuse a cached
pre-edit record as the next editing snapshot. Mutation failures remain visible
once without clearing the user's draft.

The Model tab shows a collapsible listing and selected record. Reference links
use `WorkbenchModelDialog`, which preserves the preceding level and offers
editing when both relationship actions and target schema operations permit it.
Nested dialogs intentionally have no delete callback. Missing targets and failed
saves leave the current context available for correction.

The global schema browser sits horizontally above the schema/model workspace.
Its search and module filter share a row on wider screens and stack on small
screens. Results have their own bounded scroll region; collapsing the browser
preserves filters, loaded result count, selected schema and model state. Scoped
navigation pages continue to omit this global browser. Labels remain supplied by
the existing CMS component properties; no discovery or authorization logic moves
into the presentation layer. The renderer tests protect panel order, collapse
recovery, module filtering, loading failures and incremental results.
Publishable source schemas use the backend `authoring` descriptor: the default
browser and route/deep-link resolution list only the Staged authority. Online or
missing-role copies are never a fallback when Staged is unavailable. The complete
descriptor set remains available for reference inspection, with target operations
enforced by the backend. A missing selected connection cannot fall back to a
different runtime. Generic read-only publication projections remain inspectable.
Raw Online source records are not an authoritative Published view; approval,
active snapshots, withdrawal and rollback remain with the owning publication UI.

Genuine operational runtime-specific copies retain their connection identity and show the
backend server/environment in search results. They must not be merged by schema
name: operational runtimes can hold different records and permissions. Remote-only
duplicate registrations must be corrected by the backend registration authority.

`WorkbenchRecordForm` prepares nested drafts without writing during Add to draft.
`workbenchRelatedDrafts` keeps draft metadata outside API payloads, resolves child
records first, and checkpoints successful reference values for an in-form retry.
This is sequential persistence, not a transaction or durable workflow. Reloading
loses unsaved drafts; cancelling cannot undo already completed child writes.
Clearing an association sends an empty list or null rather than deleting a model.

Customize labels through the owning CMS component properties, fields and actions
through effective backend schemas, and visual styling through Axis theme tokens.
For a project presentation extension, compose `WorkbenchModelDialog` with the
existing typed relationship runtime and a CMS-derived `WorkbenchRelationshipCopy`.
Do not introduce a client schema registry, domain-specific save routes, or
browser-owned permission rules. Dialog widths are constrained on small screens;
forms use one column below the medium breakpoint and retain explicit Cancel.

Focused verification covers nested edit failure/retry, permissions, top-level
delete, selecting versus creating references, enum inputs, reference clearing,
and descendant save checkpoints:

```sh
npm test -- --run test/workbench test/cms/renderers/components/workbench/SchemaWorkbenchRenderer.test.tsx
npm run typecheck
npm run build
```

Business and backend guidance is maintained in
`nodics.platform/modules/axis/docs/pages/schema-workbench.md` in the Nodics
framework repository.

Record search uses the shared `AxisSearchPanel` with the schema-owned
`SchemaQueryBuilder` as its advanced content. Text search keeps its existing
300 ms debounce. Advanced drafts survive folding; applied conditions and fixed
scope remain visible. Clear all clears text and optional conditions without
changing owner-enforced fixed filters. Query capabilities and typed AND/OR
semantics remain supplied by the backend descriptor. Shared shell extension and
verification guidance is in [Axis search](../app/search/README.md).
