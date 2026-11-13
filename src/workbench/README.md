# Schema Workbench Frontend

Axis renders effective backend schema descriptors and CMS presentation copy.
Module discovery, permissions, validation, reference identity, versioning and
publication remain owned by the connected Nodics services.

Locally implemented owner adapters may supply `ownerTransport` to reuse these
forms with bounded owner commands. This is executable frontend code, never a
bootstrap-supplied function. It must preserve signed headers, validate the owner
envelope, reject unsupported routes without fallback, and supply a target-specific
cache key. Advertised capability/create/update commands may explicitly use POST.
See [Product Workbench](../operations/productManagement/README.md). Administrative
target selection does not grant ordinary CRUD or publication authority.

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

## Canonical schema discovery

The shared client loads the selected module's `v0/schemas` collection. Details use
an explicitly advertised capability route or `v0/schemas/:schema`. There is no
Workbench discovery fallback after a missing route, denied request or invalid
metadata. An advertised inactive capability sends no request. These calls are
shared by import/export, media, documentation editing and other business screens;
keep their test fixtures on the same backend contract.

Preserve connection identity, partial discovery, Staged-only authoring selection
and the backend's effective fields/forms/relationships. Configure backend schemas
and grants through their existing owners; do not add a browser schema catalogue.
In the global Workbench, discovery may keep the last qualified descriptors
mounted during an additive startup refresh so an open form retains its draft.
This is limited to the same signed session and unchanged prior connections;
any source removal, replacement, or scope change requires fresh discovery.
The backend must expose the canonical routes before this client is deployed.
Changing the bootstrap path/version requires an explicit typed-client contract
change. Resource mutations and bounded bulk use canonical schema APIs. Aggregate
metadata resolves the existing owning business command. All Workbench HTTP
transports are removed; do not restore them for assumed old clients.

Scoped workspaces discover missing foreign relationship targets from the selected
schema's backend declarations. Axis reads one canonical schema detail from a unique
healthy authorized connection in the same environment, preferring the source
runtime. Missing or ambiguous owners, denied reads, wrong identities and Online
publishable sources remain unavailable; no other endpoint or runtime is tried.
These descriptors join only the relationship runtime, not the main schema browser
or navigation. Read-only Staged websites remain selectable without Create/Edit.
Private query scopes include actor, tenant, enterprise, project and exact source
coordinates. Failed refreshed metadata is hidden. Retry reads metadata again while
preserving the open form; it never retries related or parent writes. Bounded custom
owner transports retain their existing route contract and do not implicitly gain
foreign discovery. `workbenchRelationshipDiscovery.test.ts`, existing related form
cases and native article creation cover this boundary. CMS's existing `retryLabel`
can label transport recovery; schema relationship labels and target display fields
remain backend-owned.

Navigation-scoped business workspaces use their admitted owner label as the page
heading; the generic CMS Workbench brand is suppressed for that scope. Global
schema discovery retains its technical heading, and a custom owner header retains
heading ownership. Customize labels through owner navigation/CMS, not route-prefix
heuristics. BrandRenderer and SchemaWorkbenchRenderer tests protect the heading
boundary; native responsive/theme acceptance remains required.

Before a navigation-scoped workspace has selected its admitted descriptor, it
keeps the owner heading and shows CMS loading copy, the safe discovery failure
or CMS no-types copy. Explicit retry calls the existing metadata GET callback;
it never initializes data or replays a write. The global browser retains its
selection prompt. Loading also covers the short interval between successful
discovery and applying the exact route target. Existing loadingLabel,
noSchemasLabel and retryLabel CMS properties customize this presentation.

Owner renderers may call the optional local `clearLifecycleFeedback` callback after
confirmed owner inspection or an acknowledged replacement receipt. It clears only
completed React Query presentation feedback, never a pending mutation, API command,
permission, saved record or publication state. Renderers retain their own uncertain
command references until the existing owner inspection contract confirms them.

Relationship fields show the owner's bounded description as their accessible
field guidance. A selected record's existing `displayProperties` formatter supplies
its readable label. Labels stay in actor/source/field-scoped view snapshots outside
`WorkbenchRelationshipDraft` and API payloads. The form carries those snapshots
through its review and Back navigation; removal still changes only the raw
reference. Unknown existing references retain their canonical code and explicit
owner-record inspection rather than an invented name or automatic lookup.

The relationship runtime's query partition includes the current authorized
catalogue's module/instance/endpoint identities, stably ordered. A changed endpoint
on the same logical instance retires cached lookups and names; unrelated labels,
health observations or catalogue ordering do not. This key is a cache partition,
never connection discovery or authority. Explicit record previews remount when the
actor, source, field or display projection changes, retiring late private results.
Customize names via owner `displayProperties` and guidance via the relationship
description; preserve raw payloads and this retirement boundary. Focused tests in
`RelationshipFieldPresentation.test.tsx` and `workbenchRelationshipScope.test.ts`
cover selection, review, removal, no extra reads, canonical saves and private scope
replacement; whole-form native acceptance remains separate.

Generated create/update requests carry the mounted form's original command key in `Idempotency-Key`. Authentication, transport failure and subsequent explicit inspection do not manufacture a new intent or automatically replay a write. Receipt-enabled owners may reject a repeated key and require inspection of the original result; header forwarding alone does not promise durable replay.

Optional owner field metadata `readOnlyOnUpdate` applies only when editing an existing record. Keep required identity/nomination inputs on creation, omit protected fields and relationships from update forms/payloads, and retain the original identity/counter query. Older descriptors may omit the flag; malformed supplied flags refuse. The server retains independent normalization and domain guards.

Optional text cleared in an update is sent as an explicit empty string, including
inline text fields. Creation still omits empty text; undefined values remain
omitted in either operation. Backend validation and update-field policy remain
authoritative. `workbenchRecordPaths.test.ts` and `WorkbenchRecordForm.test.tsx`
cover the clear without changing false, zero, or relationship semantics.

An update compares empty text with the original record: only a previously
nonempty string becomes an explicit clear. Untouched missing, null or already
empty values remain omitted. This includes inline fields initialized as blank
inputs; forms do not manufacture optional record fields while editing another.

When an authorized schema owner explicitly disables generic record routers, its typed `recordApi` notice keeps Schema inspection available. Axis sends no record search, displays no zero/empty table and offers no generic create/update. The owner message explains availability; changing frontend flags cannot enable the API. Customize schema/router policy only at its backend owner. The schema utility contract, Workbench client parser and renderer tests cover this boundary.

Record listings never generate local CSV downloads. When the authenticated catalogue admits the existing BackOffice Import & Export workspace, its labelled link opens the Exports area with only the exact model/source identity as a hint. Fresh discovery must re-admit that source; no endpoint, record query, row selection or permission travels in the URL. Users choose columns, confirm their export query, preview and generate through nExport and download its governed Media artifact. Missing, denied or ambiguous destinations provide no shortcut. Schema-definition inspection export remains metadata-only.

Record detail headings reuse the owner displayProperties projection used by relationship choices, falling back to the canonical identity. Stable identity fields remain visible; Axis never invents a business name or performs an extra lookup.

The selected model purpose stays visible in Records and Schema, using the effective owner description without a browser purpose registry. Schema inspection retains explicit owner and operation metadata; disabled record APIs keep their owner explanation.

Global discovery preserves a partial-coverage report when an authorised owner connection fails or returns invalid metadata. Healthy models remain visible with a generic incomplete-catalogue notice and only authorised source coordinates; raw response errors stay private. Retry issues metadata reads only. Both global and scoped selections must still exist in current successful discovery; failed refreshes cannot retain an older descriptor as operation authority. Existing array consumers delegate to the same discovery implementation. Customize the optional CMS incompleteSchemasLabel or owner schema metadata, never a second model registry or automatic write retry. Client and renderer regressions cover partial success, private diagnostics and manual recovery; native acceptance additionally faults one source and verifies its model/actions retire and recover.

A generated write with a lost/malformed transport response or server failure shows an unconfirmed-outcome instruction: retain inputs and inspect saved records before another submission. Explicit owner 4xx rejections retain their original message/code; read failures remain read failures. The client performs one attempt and retains the mounted intent key. Record inspection can reveal current values but is not an original-command receipt or durable replay guarantee; exact inspection remains with receipt-enabled owners. Native acceptance drops a real response after persistence and independently inspects owner state without replay.

Generic discovery also visits modules that offer no schema endpoint and runtimes with no admitted schema read. Confirmed HTTP403/404/405 exclusions do not become transport-failure coverage notices or trigger a fallback. Network/server failures and invalid metadata do. A completely unavailable catalogue still fails closed; current-source selection and owner API checks remain mandatory.

Date controls display the UTC calendar day from an owner ISO timestamp. Opening or reviewing a form preserves the original timestamp; only a deliberate date edit replaces it with a calendar-day value, which the generated client normalizes to UTC midnight.

Listings show bounded inert JSON summaries for admitted structured fields. Only advertised relationships render relationship controls; an ordinary localized/object value is not labelled as related data. Open the record to inspect the complete admitted value.

A failed record transport read gives a bounded reconnection instruction instead of browser error jargon. It does not become an empty result or trigger a fallback/replay; explicit owner HTTP validation and permission errors keep their existing status/message handling.

Navigation may declare the strict logical `workbenchPresentation.ownerSelector`.
Route-bound discovery and deep links use its single live authorized match; absent
or ambiguous owners remain unavailable without generic discovery or a physical
server-name fallback. The selector is part of the private query scope so changing
it retires prior discovery. It grants no permission. Generic schema browsing and
legacy undeclared navigation retain their existing behavior. Extend this contract
in the Framework owner contribution; test selection and refusal in
`WorkbenchRoutePage.test.ts` and parsing in `publicBootstrap.test.ts`.
